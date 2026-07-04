/**
 * 完整回测：验证 script.js 中区间比预测对组合生成的实际效果
 * 对比：有 ivPrediction vs 无 ivPrediction（两种策略的全部流程）
 */
const fs = require('fs');
const allDraws = JSON.parse(fs.readFileSync('./all_draws.json', 'utf8'));

console.log("═".repeat(80));
console.log("  完整回测：区间比预测（ivPrediction）对组合生成的影响");
console.log("═".repeat(80));

// ═══ 工具函数（与 script.js 一致）═══
function gi(n) { return n <= 12 ? 0 : n <= 24 ? 1 : 2; }
function tails(nums) { return [...new Set(nums.map(n => n % 10))]; }
function sum(a) { return a.reduce((s, v) => s + v, 0); }
function oddCount(a) { return a.filter(n => n % 2 === 1).length; }
function getIvDistance(r1, r2) { let d = 0; for (let i = 0; i < 3; i++) d += Math.abs((r1[i]||0) - (r2[i]||0)); return d; }
function intervalRatio(nums) { const iv = [0,0,0]; nums.forEach(n => iv[gi(n)]++); return iv; }
function getIv(n) { return n <= 12 ? 0 : n <= 24 ? 1 : 2; }

// ═══ 尾号预测（与 script.js predictLikelyTailsV4Enhanced 一致）═══
function getArithmeticTails(tails) {
  const arithTails = new Set();
  const sorted = [...tails].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const diff = sorted[j] - sorted[i];
      if (diff === 2 || diff === 3 || diff === 4) {
        arithTails.add(sorted[i]); arithTails.add(sorted[j]);
        arithTails.add((sorted[j] + diff) % 10); arithTails.add((sorted[i] - diff + 10) % 10);
      }
    }
  }
  return [...arithTails];
}

function predictLikelyTailsV4Enhanced(sourceTails, transData, refRows, sourceRow, weights) {
  const scores = new Map();
  for (let t = 0; t <= 9; t++) scores.set(t, 0);
  sourceTails.forEach((st) => { for (let tt = 0; tt <= 9; tt++) { scores.set(tt, scores.get(tt) + (transData.transFreq.get(`${st}→${tt}`) || 0)); } });
  transData.tailFreq.forEach((count, tail) => { scores.set(tail, scores.get(tail) + count * 0.5); });
  if (refRows && refRows.length > 0) {
    const ref1 = refRows.find(r => r.row === sourceRow - 1);
    if (ref1) {
      ref1.tailSet.forEach(t => scores.set(t, scores.get(t) + weights.overlap1));
      const arith1 = getArithmeticTails([...ref1.tailSet]);
      arith1.forEach(t => { if (!ref1.tailSet.has(t)) scores.set(t, scores.get(t) + weights.arith1); });
    }
    const ref10 = refRows.find(r => r.row === sourceRow - 10);
    if (ref10) {
      ref10.tailSet.forEach(t => scores.set(t, scores.get(t) + weights.overlap10));
      const arith10 = getArithmeticTails([...ref10.tailSet]);
      arith10.forEach(t => { if (!ref10.tailSet.has(t)) scores.set(t, scores.get(t) + weights.arith10); });
    }
    if (ref1 && ref10) { [...ref1.tailSet].filter(t => ref10.tailSet.has(t)).forEach(t => scores.set(t, scores.get(t) + weights.overlapBonus)); }
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]);
}

function analyzeTailTransitionsV4(sourceRow, lookback, draws) {
  lookback = lookback || 12;
  const transFreq = new Map(); const tailFreq = new Map();
  for (let t = 0; t <= 9; t++) tailFreq.set(t, 0);
  const start = Math.max(0, sourceRow - lookback);
  for (let i = start; i < sourceRow - 1; i++) {
    const srcNums = draws[i].front, tgtNums = draws[i + 1].front;
    if (srcNums.length !== 5 || tgtNums.length !== 5) continue;
    const srcTails = tails(srcNums), tgtTails = tails(tgtNums);
    tgtTails.forEach((tt) => tailFreq.set(tt, tailFreq.get(tt) + 1));
    srcTails.forEach((st) => tgtTails.forEach((tt) => { transFreq.set(`${st}→${tt}`, (transFreq.get(`${st}→${tt}`) || 0) + 1); }));
  }
  return { transFreq, tailFreq };
}

function buildRefRows(currentIdx, draws) {
  const refRows = [];
  if (currentIdx >= 1) refRows.push({ row: currentIdx - 1, tailSet: new Set(tails(draws[currentIdx - 1].front)) });
  if (currentIdx >= 10) refRows.push({ row: currentIdx - 10, tailSet: new Set(tails(draws[currentIdx - 10].front)) });
  return refRows;
}

// ═══ 区间比预测（与 script.js predictTargetIntervalRatio 一致）═══
function predictIntervalRatio(sourceRow, sourceIv, draws) {
  const sourceIvKey = sourceIv.join(":");
  const transitions = new Map();
  const windowSize = Math.min(60, draws.length);
  let specificCount = 0;
  let globalDistSum = 0, globalDistCount = 0;
  for (let i = 0; i < draws.length - 1; i++) {
    const sIv = intervalRatio(draws[i].front);
    const tIv = intervalRatio(draws[i + 1].front);
    globalDistSum += getIvDistance(sIv, tIv);
    globalDistCount++;
    const sKey = sIv.join(":");
    if (sKey !== sourceIvKey) continue;
    specificCount++;
    const tKey = tIv.join(":");
    const recency = 1 + (i - Math.max(0, draws.length - 2 - windowSize)) / windowSize * 2;
    const entry = transitions.get(tKey) || { count: 0, weight: 0 };
    entry.count++;
    entry.weight += recency;
    transitions.set(tKey, entry);
  }
  const globalAvgDist = globalDistCount > 0 ? globalDistSum / globalDistCount : 3.0;
  const minSpecific = 4;
  const blendWeight = Math.min(1, specificCount / minSpecific);
  const maxWeight = Math.max(1, ...[...transitions.values()].map((d) => d.weight));
  const sorted = [...transitions.entries()]
    .map(([ivKey, data]) => ({
      iv: ivKey.split(":").map(Number),
      ivKey,
      score: data.count * 0.7 + (data.weight / maxWeight) * 30,
      count: data.count,
      weight: data.weight
    }))
    .sort((a, b) => b.score - a.score);
  if (sorted.length === 0) {
    const neutralDist = Math.round(globalAvgDist);
    return { predictedIv: sourceIv, predictedIvKey: sourceIvKey, distance: neutralDist, confidence: 0, topCandidates: [], globalAvgDist };
  }
  const topCandidates = sorted.slice(0, 3);
  const rawDistance = getIvDistance(sourceIv, topCandidates[0].iv);
  const totalScore = topCandidates.reduce((s, c) => s + c.score, 0);
  const rawConfidence = topCandidates[0].score / Math.max(0.1, totalScore);
  const blendedDistance = Math.round(rawDistance * blendWeight + globalAvgDist * (1 - blendWeight));
  const confidence = rawConfidence * blendWeight;
  return { predictedIv: topCandidates[0].iv, predictedIvKey: topCandidates[0].ivKey, distance: blendedDistance, confidence, topCandidates, globalAvgDist };
}

// ═══ 组合生成（与 script.js buildSampleFrontCombosV4 一致）═══
function buildCombos(pool, ivPrediction, usePrediction, maxCombos) {
  const combos = [];
  
  // 确定区间比优先级
  let ratios;
  if (usePrediction && ivPrediction && ivPrediction.predictedIv) {
    const predKey = ivPrediction.predictedIv.join(":");
    const defaults = ["2:2:1","2:1:2","1:2:2","3:1:1","1:3:1","1:1:3"];
    ratios = [predKey, ...defaults.filter(r => r !== predKey)];
  } else {
    ratios = ["2:2:1","2:1:2","1:2:2","3:1:1","1:3:1","1:1:3"];
  }
  
  // 按区间比回溯生成
  ratios.forEach(ratioKey => {
    const [r0,r1,r2] = ratioKey.split(":").map(Number);
    const z0 = pool.filter(n => getIv(n) === 0).slice(0, r0 + 6);
    const z1 = pool.filter(n => getIv(n) === 1).slice(0, r1 + 6);
    const z2 = pool.filter(n => getIv(n) === 2).slice(0, r2 + 6);
    if (z0.length < r0 || z1.length < r1 || z2.length < r2) return;
    
    function bt(idx, chosen) {
      if (combos.length >= maxCombos) return;
      if (idx >= 3) {
        if (chosen.length === 5) {
          const sorted = [...chosen].sort((a,b)=>a-b);
          const s = sum(sorted);
          const od = oddCount(sorted);
          const sp = sorted[4] - sorted[0];
          if (s < 60 || s > 120) return;
          if (od === 0 || od === 5) return;
          if (sp < 15 || sp > 32) return;
          let maxRun = 1, run = 1;
          for (let i = 1; i < sorted.length; i++) {
            if (sorted[i] === sorted[i-1] + 1) { run++; maxRun = Math.max(maxRun, run); }
            else run = 1;
          }
          if (maxRun >= 4) return;
          combos.push(sorted);
        }
        return;
      }
      const arr = idx === 0 ? z0 : idx === 1 ? z1 : z2;
      const need = [r0,r1,r2][idx];
      function pick(start, depth, picked) {
        if (depth === need) { bt(idx+1, [...chosen, ...picked]); return; }
        for (let i = start; i <= arr.length - (need - depth); i++) {
          picked.push(arr[i]); pick(i+1, depth+1, picked); picked.pop();
        }
      }
      pick(0, 0, []);
    }
    bt(0, []);
  });
  
  // 自由回溯（区间比无约束）
  if (combos.length < maxCombos) {
    const seen = new Set(combos.map(c => c.join(",")));
    const topPool = pool.slice(0, 20);
    function btFree(start, chosen) {
      if (combos.length >= maxCombos) return;
      if (chosen.length === 5) {
        const sorted = [...chosen].sort((a,b)=>a-b);
        const key = sorted.join(",");
        if (seen.has(key)) return;
        const s = sum(sorted);
        const od = oddCount(sorted);
        const sp = sorted[4] - sorted[0];
        if (s < 60 || s > 120) return;
        if (od === 0 || od === 5) return;
        if (sp < 15 || sp > 32) return;
        combos.push(sorted);
        seen.add(key);
        return;
      }
      if (start >= topPool.length || topPool.length - start < 5 - chosen.length) return;
      btFree(start + 1, chosen);
      chosen.push(topPool[start]);
      btFree(start + 1, chosen);
      chosen.pop();
    }
    btFree(0, []);
  }
  
  return combos.slice(0, maxCombos);
}

// ═══ 评分（与 script.js v4ScoreCombo 核心逻辑一致）═══
const V4_TAIL_SAME = 35, V4_TAIL_NEIGHBOR = 15, V4_TAIL_WITHIN = 8;

function scoreCombo(sorted, sourceNums, predictedTails, ivPrediction) {
  const s = sum(sorted);
  const sp = sorted[4] - sorted[0];
  const od = oddCount(sorted);
  
  // 硬过滤
  if (od === 0 || od === 5) return null;
  if (s < 60 || s > 120) return null;
  if (sp < 15 || sp > 32) return null;
  
  let score = 0;
  
  // 结构评分
  if (sp >= 18 && sp <= 24) score += 18; else if (sp >= 26 && sp <= 33) score += 12;
  if (od === 1) score += 12; else if (od === 2) score += 6; else if (od === 3) score += 8;
  
  // 区间覆盖
  const iv = intervalRatio(sorted);
  if (!iv.includes(0)) score += 5; else if (iv.filter(c => c === 0).length === 1) score += 2;
  
  // 尾号多样
  const ct = tails(sorted);
  if (ct.length >= 5) score += 4; else if (ct.length >= 4) score += 2;
  
  // 锚点变换
  const as = new Set(sourceNums);
  if (sourceNums.length > 0) {
    let akh = 0;
    sorted.forEach(n => { if (as.has(n)) akh++; });
    score += akh * 18;
    if (akh >= 2 && akh <= 3) score += (akh - 1) * 10;
  }
  
  // 尾号预测匹配
  if (predictedTails && predictedTails.length > 0) {
    const topTails = new Set(predictedTails.slice(0, 6).map(([t]) => t));
    const nearTails = new Set(predictedTails.slice(0, 8).map(([t]) => t));
    sorted.forEach(n => {
      const t = n % 10;
      if (topTails.has(t)) score += V4_TAIL_SAME;
      else if (nearTails.has(t)) score += V4_TAIL_NEIGHBOR;
    });
  }
  
  // 区间比预测匹配
  if (ivPrediction && ivPrediction.predictedIv) {
    const predIv = ivPrediction.predictedIv;
    const matchScore = 30;
    const ivKey = iv.join(":");
    const predKey = predIv.join(":");
    if (ivKey === predKey) score += matchScore;
    else {
      const dist = getIvDistance(iv, predIv);
      score += Math.max(0, matchScore - dist * 10);
    }
  }
  
  return score;
}

// ═══ 回测 ═══
const weights = { overlap1: 15, neighbor1: 0, arith1: 6, overlap10: 12, neighbor10: 0, arith10: 4, overlapBonus: 10 };
const testCount = 50;
const startIdx = Math.max(20, allDraws.length - testCount - 1);

console.log(`\n📊 测试配置: ${testCount}期回测, 从第${startIdx}期开始`);
console.log(`  尾号权重: overlap1=${weights.overlap1}, arith1=${weights.arith1}, overlap10=${weights.overlap10}, arith10=${weights.arith10}`);

let totalPairs = 0;
let ivPredCorrect = 0, ivPredTotal = 0, ivPredDistSum = 0;

// 统计
const stats = {
  withPred: { bestGe3: 0, bestGe4: 0, totalHits: [0,0,0,0,0,0], perComboHits: [0,0,0,0,0,0], comboCount: 0, bestArray: [] },
  withoutPred: { bestGe3: 0, bestGe4: 0, totalHits: [0,0,0,0,0,0], perComboHits: [0,0,0,0,0,0], comboCount: 0, bestArray: [] }
};

for (let i = startIdx; i < allDraws.length - 1; i++) {
  const targetDraw = allDraws[i + 1];
  const targetNums = new Set(targetDraw.front);
  const targetIv = targetDraw.front;
  const draws = allDraws.slice(0, i + 1);
  const sourceTails = tails(draws[i].front);
  const sourceIv = intervalRatio(draws[i].front);
  const sourceNums = draws[i].front;
  
  // 尾号转移分析
  const transData = analyzeTailTransitionsV4(i + 1, 12, draws);
  const refRows = buildRefRows(i + 1, draws);
  
  // 尾号预测
  const predictedTails = predictLikelyTailsV4Enhanced(sourceTails, transData, refRows, i + 1, weights);
  
  // 区间比预测
  const ivPrediction = predictIntervalRatio(i + 1, sourceIv, draws);
  
  // 检查区间比预测准确性
  ivPredTotal++;
  const predIvKey = ivPrediction.predictedIv.join(":");
  const targetIvKey = intervalRatio(targetDraw.front).join(":");
  if (predIvKey === targetIvKey) ivPredCorrect++;
  ivPredDistSum += getIvDistance(ivPrediction.predictedIv, intervalRatio(targetDraw.front));
  
  // 构建候选池
  const topTails = new Set(predictedTails.slice(0, 8).map(([t]) => t));
  const pool = [];
  for (let n = 1; n <= 35; n++) {
    if (topTails.has(n % 10)) pool.push(n);
  }
  
  // 策略有预测
  const combosWith = buildCombos(pool, ivPrediction, true, 300);
  const scoredWith = combosWith.map(c => ({ nums: c, score: scoreCombo(c, sourceNums, predictedTails, ivPrediction) }))
    .filter(r => r.score !== null)
    .sort((a, b) => b.score - a.score);
  const top5With = scoredWith.slice(0, 5);
  
  // 策略无预测
  const combosWithout = buildCombos(pool, ivPrediction, false, 300);
  const scoredWithout = combosWithout.map(c => ({ nums: c, score: scoreCombo(c, sourceNums, predictedTails, null) }))
    .filter(r => r.score !== null)
    .sort((a, b) => b.score - a.score);
  const top5Without = scoredWithout.slice(0, 5);
  
  // 统计命中
  const processTop5 = (top5, statsObj) => {
    if (top5.length === 0) return;
    const hits = top5.map(r => r.nums.filter(n => targetNums.has(n)).length);
    const best = Math.max(...hits);
    hits.forEach(h => statsObj.totalHits[h]++);
    statsObj.comboCount += top5.length;
    statsObj.bestArray.push(best);
    if (best >= 3) statsObj.bestGe3++;
    if (best >= 4) statsObj.bestGe4++;
  };
  
  processTop5(top5With, stats.withPred);
  processTop5(top5Without, stats.withoutPred);
  totalPairs++;
}

// ═══ 输出结果 ═══
console.log(`\n${"═".repeat(80)}`);
console.log(`  回测结果（${totalPairs}期）`);
console.log(`${"═".repeat(80)}`);

const showStats = (label, s) => {
  console.log(`\n  ── ${label} ──`);
  console.log(`  Best≥3: ${s.bestGe3}/${totalPairs} (${(s.bestGe3/totalPairs*100).toFixed(1)}%)`);
  console.log(`  Best≥4: ${s.bestGe4}/${totalPairs} (${(s.bestGe4/totalPairs*100).toFixed(1)}%)`);
  console.log(`  每注命中分布: 0球:${s.totalHits[0]} | 1球:${s.totalHits[1]} | 2球:${s.totalHits[2]} | 3球:${s.totalHits[3]} | 4球:${s.totalHits[4]} | 5球:${s.totalHits[5]}`);
  const avgHit = s.totalHits.reduce((a, h, i) => a + h * i, 0) / s.comboCount;
  console.log(`  平均命中/注: ${avgHit.toFixed(2)}`);
  console.log(`  Best命中分布: 0:${s.bestArray.filter(b=>b===0).length} 1:${s.bestArray.filter(b=>b===1).length} 2:${s.bestArray.filter(b=>b===2).length} 3:${s.bestArray.filter(b=>b===3).length} 4:${s.bestArray.filter(b=>b===4).length} 5:${s.bestArray.filter(b=>b===5).length}`);
};

showStats("A: 有预测区间比（ivPrediction优先）", stats.withPred);
showStats("B: 无预测区间比（默认区间比顺序）", stats.withoutPred);

// 差异分析
console.log(`\n${"═".repeat(80)}`);
console.log(`  对比分析`);
console.log(`${"═".repeat(80)}`);

const ge3Diff = stats.withPred.bestGe3 - stats.withoutPred.bestGe3;
const ge4Diff = stats.withPred.bestGe4 - stats.withoutPred.bestGe4;
const avgHitWith = stats.withPred.totalHits.reduce((a, h, i) => a + h * i, 0) / stats.withPred.comboCount;
const avgHitWithout = stats.withoutPred.totalHits.reduce((a, h, i) => a + h * i, 0) / stats.withoutPred.comboCount;
const avgDiff = avgHitWith - avgHitWithout;

console.log(`  ≥3球率差异: ${ge3Diff > 0 ? '+' : ''}${ge3Diff} (${stats.withPred.bestGe3} vs ${stats.withoutPred.bestGe3})`);
console.log(`  ≥4球率差异: ${ge4Diff > 0 ? '+' : ''}${ge4Diff} (${stats.withPred.bestGe4} vs ${stats.withoutPred.bestGe4})`);
console.log(`  平均命中差异: ${avgDiff > 0 ? '+' : ''}${avgDiff.toFixed(2)}`);

console.log(`\n📈 区间比预测统计:`);
console.log(`  准确性: ${ivPredCorrect}/${ivPredTotal} (${(ivPredCorrect/ivPredTotal*100).toFixed(1)}%)`);
console.log(`  平均距离: ${(ivPredDistSum/ivPredTotal).toFixed(2)}`);

console.log(`\n🎯 结论:`);
if (ge3Diff > 0) {
  console.log(`  ✅ 预测区间比策略在≥3球率上提升了 ${ge3Diff} 期（+${(ge3Diff/totalPairs*100).toFixed(1)}%）`);
} else if (ge3Diff < 0) {
  console.log(`  ⚠️  预测区间比策略在≥3球率上下降了 ${Math.abs(ge3Diff)} 期`);
} else {
  console.log(`  ℹ️  预测区间比策略效果相同`);
}
if (ge4Diff > 0) {
  console.log(`  ✅ ≥4球率提升了 ${ge4Diff} 期`);
} else if (ge4Diff < 0) {
  console.log(`  ⚠️  ≥4球率下降了 ${Math.abs(ge4Diff)} 期`);
}

console.log(`\n⏱️  完成时间: ${new Date().toLocaleString()}`);
