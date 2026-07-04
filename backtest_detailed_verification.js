/**
 * backtest_detailed_verification.js — 详细命中验证
 * 
 * 验证每期：
 * 1. Top5命中个数
 * 2. 补漏6命中个数
 * 3. Top5+补漏6联合覆盖目的号码的个数
 * 4. 候选号码池覆盖目的号码的个数
 * 
 * 运行：node backtest_detailed_verification.js
 */

const fs = require('fs');
const path = require('path');

// 加载数据
let code = fs.readFileSync(path.join(__dirname, 'optimized_picker.js'), 'utf-8');
const cliStart = code.indexOf('\nconst args = process.argv.slice');
if (cliStart > 0) code = code.substring(0, cliStart);

const wrappedCode = "(function() {\n  var module = { exports: {} };\n  var exports = module.exports;\n  " + code + "\n  return { predict, predictNext, predictBack, ALL_DRAWS, issueMap, buildPairs };\n})()";
const picker = eval(wrappedCode);

// ===== 常量 =====
const V4_OFFSET_SCORE = { 0:20, 1:15, 2:13, 3:12, 4:10, 5:8, 6:6, 7:5, 8:4, 9:3, 10:2 };
const V4_TAIL_SAME = 35, V4_TAIL_NEIGHBOR = 15, V4_TAIL_WITHIN = 8;
const V4_POOL_SIZE = 26;

// 辅助函数
function sum(arr) { return arr.reduce((a, b) => a + b, 0); }
function oddCount(arr) { return arr.filter(n => n % 2 === 1).length; }
function intervalRatio(nums) {
  const z = [0, 0, 0];
  nums.forEach(n => { if (n <= 12) z[0]++; else if (n <= 24) z[1]++; else z[2]++; });
  return z;
}
function tails(nums) { return [...new Set(nums.map(n => n % 10))]; }
function getSampleIntervalIndex(n) { return n <= 12 ? 0 : n <= 24 ? 1 : 2; }
function getIntervalRatioDistance(ratio1, ratio2) {
  let dist = 0;
  for (let i = 0; i < 3; i++) dist += Math.abs((ratio1[i] || 0) - (ratio2[i] || 0));
  return dist;
}

// ===== 区间比预测函数 =====
function predictTargetIntervalRatio(sourceRow, sourceIv, allDraws) {
  const sourceIvKey = sourceIv.join(":");
  const transitions = new Map();
  const windowSize = Math.min(60, allDraws.length);

  let specificCount = 0;
  let globalDistSum = 0, globalDistCount = 0;
  for (let i = 0; i < allDraws.length - 1; i++) {
    const sIv = intervalRatio(allDraws[i].front);
    const tIv = intervalRatio(allDraws[i + 1].front);
    globalDistSum += getIntervalRatioDistance(sIv, tIv);
    globalDistCount++;
    const sKey = sIv.join(":");
    if (sKey !== sourceIvKey) continue;
    specificCount++;
    const tKey = tIv.join(":");
    const recency = 1 + (i - Math.max(0, allDraws.length - 2 - windowSize)) / windowSize * 2;
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

  // 规律增强
  const patternBoost = new Map();
  if (allDraws.length >= 3) {
    const recentIvs = [];
    for (let i = Math.max(0, allDraws.length - 5); i < allDraws.length; i++) {
      recentIvs.push(intervalRatio(allDraws[i].front));
    }
    
    // 区间不变检测
    let sameCount = 0;
    for (let i = recentIvs.length - 1; i >= 1; i--) {
      if (recentIvs[i][0] === recentIvs[i-1][0] && 
          recentIvs[i][1] === recentIvs[i-1][1] && 
          recentIvs[i][2] === recentIvs[i-1][2]) {
        sameCount++;
      } else break;
    }
    if (sameCount >= 2) {
      const currentKey = sourceIv.join(":");
      const boost = patternBoost.get(currentKey) || 0;
      patternBoost.set(currentKey, boost + sameCount * 3);
    }
    
    // 极值回归
    for (let zone = 0; zone < 3; zone++) {
      if (sourceIv[zone] === 0) {
        const predicted = [...sourceIv];
        predicted[zone] = Math.min(3, predicted[zone] + 2);
        const key = predicted.join(":");
        const boost = patternBoost.get(key) || 0;
        patternBoost.set(key, boost + 8);
        
        const predicted2 = [...sourceIv];
        predicted2[zone] = Math.min(3, predicted2[zone] + 1);
        const key2 = predicted2.join(":");
        const boost2 = patternBoost.get(key2) || 0;
        patternBoost.set(key2, boost2 + 5);
      }
      if (sourceIv[zone] >= 4) {
        const predicted = [...sourceIv];
        predicted[zone] = Math.max(0, predicted[zone] - 2);
        const key = predicted.join(":");
        const boost = patternBoost.get(key) || 0;
        patternBoost.set(key, boost + 8);
        
        const predicted2 = [...sourceIv];
        predicted2[zone] = Math.max(0, predicted2[zone] - 1);
        const key2 = predicted2.join(":");
        const boost2 = patternBoost.get(key2) || 0;
        patternBoost.set(key2, boost2 + 5);
      }
    }
    
    // 连续同向反转
    if (recentIvs.length >= 3) {
      const current = recentIvs[recentIvs.length - 1];
      const prev = recentIvs[recentIvs.length - 2];
      const prevPrev = recentIvs[recentIvs.length - 3];
      
      for (let zone = 0; zone < 3; zone++) {
        const diff1 = current[zone] - prev[zone];
        const diff2 = prev[zone] - prevPrev[zone];
        
        if (diff1 > 0 && diff2 > 0) {
          const predicted = [...current];
          predicted[zone] = Math.max(0, predicted[zone] - 1);
          const key = predicted.join(":");
          const boost = patternBoost.get(key) || 0;
          patternBoost.set(key, boost + 4);
        }
        if (diff1 < 0 && diff2 < 0) {
          const predicted = [...current];
          predicted[zone] = Math.min(5, predicted[zone] + 1);
          const key = predicted.join(":");
          const boost = patternBoost.get(key) || 0;
          patternBoost.set(key, boost + 4);
        }
      }
    }
  }
  
  // 应用规律加分
  const enhanced = sorted.map(candidate => {
    const patternBonus = patternBoost.get(candidate.ivKey) || 0;
    return {
      ...candidate,
      score: candidate.score + patternBonus,
      patternBonus
    };
  }).sort((a, b) => b.score - a.score);

  const topCandidates = enhanced.slice(0, 3);
  const rawDistance = getIntervalRatioDistance(sourceIv, topCandidates[0].iv);
  const totalScore = topCandidates.reduce((s, c) => s + c.score, 0);
  const rawConfidence = topCandidates[0].score / Math.max(0.1, totalScore);

  const blendedDistance = Math.round(rawDistance * blendWeight + globalAvgDist * (1 - blendWeight));
  const confidence = rawConfidence * blendWeight;

  return { 
    predictedIv: topCandidates[0].iv, 
    predictedIvKey: topCandidates[0].ivKey, 
    distance: blendedDistance, 
    confidence, 
    topCandidates: topCandidates.slice(0, 5),
    globalAvgDist,
    patternBoost: Object.fromEntries(patternBoost)
  };
}

// ===== 构建候选池 =====
function buildPool(sourceIdx, allDraws) {
  const sourceDraw = allDraws[sourceIdx];
  if (!sourceDraw) return null;
  
  const selectedNumbers = [...sourceDraw.front].sort((a, b) => a - b);
  const sourceTails = tails(selectedNumbers);
  const sourceIv = intervalRatio(selectedNumbers);
  
  // 预测区间比
  const ivPrediction = predictTargetIntervalRatio(sourceIdx, sourceIv, allDraws.slice(0, sourceIdx + 1));
  
  // 尾号预测
  const tailTransCounts = new Map();
  for (let i = Math.max(0, sourceIdx - 50); i < sourceIdx; i++) {
    const prevTails = tails(allDraws[i].front);
    const overlapTails = prevTails.filter(t => sourceTails.includes(t));
    if (overlapTails.length >= 1) {
      const nextTails = tails(allDraws[i + 1] ? allDraws[i + 1].front : []);
      nextTails.forEach(t => {
        tailTransCounts.set(t, (tailTransCounts.get(t) || 0) + overlapTails.length);
      });
    }
  }
  const predictedTails = [...tailTransCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  // 热号
  const hotness = new Map();
  for (let i = Math.max(0, sourceIdx - 10); i < sourceIdx; i++) {
    allDraws[i].front.forEach(n => hotness.set(n, (hotness.get(n) || 0) + 1));
  }
  
  // 对1-35逐一评分
  const candidates = [];
  for (let n = 1; n <= 35; n++) {
    let score = 0;
    
    // 偏移评分
    let minOffset = Infinity;
    selectedNumbers.forEach(a => { minOffset = Math.min(minOffset, Math.abs(n - a)); });
    score += V4_OFFSET_SCORE[minOffset] || 0;
    
    // 尾号关联
    const t = n % 10;
    if (predictedTails.length > 0) {
      const topTails = new Set(predictedTails.slice(0, 5).map(([tt]) => tt));
      if (topTails.has(t)) score += V4_TAIL_SAME;
      else if (predictedTails.some(([tt]) => Math.abs(t - tt) === 1)) score += V4_TAIL_NEIGHBOR;
      else if (sourceTails.includes(t)) score += V4_TAIL_WITHIN;
    } else {
      if (sourceTails.includes(t)) score += V4_TAIL_WITHIN;
    }
    
    // 热号
    const hot = hotness.get(n) || 0;
    if (hot >= 4) score += 6;
    else if (hot >= 3) score += 4;
    else if (hot >= 2) score += 2;
    else if (hot === 0) score -= 1;
    
    // 区间比优化加分
    const zone = getSampleIntervalIndex(n);
    const currentCount = sourceIv[zone];
    const predictedCount = ivPrediction.predictedIv[zone];
    
    if (predictedCount > currentCount) {
      score += 3;
    } else if (predictedCount < currentCount) {
      score -= 1;
    }
    
    candidates.push({ number: n, score });
  }
  
  // 排序 + 区间保底
  candidates.sort((a, b) => b.score - a.score);
  const minIv = [3, 3, 3];
  const pool = [];
  const zoneCount = [0, 0, 0];
  const seen = new Set();
  
  for (const c of candidates) {
    if (pool.length >= V4_POOL_SIZE) break;
    const z = getSampleIntervalIndex(c.number);
    if (zoneCount[z] < minIv[z]) {
      pool.push(c);
      zoneCount[z]++;
      seen.add(c.number);
    }
  }
  for (const c of candidates) {
    if (pool.length >= V4_POOL_SIZE) break;
    if (!seen.has(c.number)) {
      pool.push(c);
      seen.add(c.number);
    }
  }
  pool.sort((a, b) => b.score - a.score);
  
  return {
    pool: pool.slice(0, V4_POOL_SIZE),
    candidateEntries: pool.slice(0, V4_POOL_SIZE).map((c, i) => ({
      number: c.number, score: c.score, rank: i + 1
    })),
    predictedTails,
    ivPrediction,
    sourceIv,
  };
}

// ===== 合并池 =====
function mergePools(pool1, pool2, W1 = 0.7, W2 = 0.3) {
  const scoreMap = new Map();
  pool1.candidateEntries.forEach(e => scoreMap.set(e.number, (scoreMap.get(e.number) || 0) + e.score * W1));
  pool2.candidateEntries.forEach(e => scoreMap.set(e.number, (scoreMap.get(e.number) || 0) + e.score * W2));
  
  const merged = [...scoreMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, V4_POOL_SIZE)
    .map(([num, score], i) => ({
      number: num, score, rank: i + 1
    }));
  
  return { pool: merged, candidateEntries: merged };
}

// ===== 生成补漏6 =====
function generateBulou6(top5Nums, pool, predictedTails) {
  const top5Set = new Set(top5Nums);
  const predTails = predictedTails ? new Set(predictedTails.slice(0, 5).map(([t]) => t)) : new Set();
  
  const scored = pool
    .filter(e => !top5Set.has(e.number))
    .map(e => {
      const n = e.number;
      let s = e.score;
      if (predTails.has(n % 10)) s += 5; // 补漏6尾号权重=5
      let md = Infinity; top5Nums.forEach(cn => { const d = Math.abs(n - cn); if (d < md) md = d; });
      if (md === 1) s += 12; else if (md === 2) s += 6; else if (md === 3) s += 3;
      return { number: n, score: s };
    })
    .sort((a, b) => b.score - a.score);
  
  return scored.length >= 5 ? scored.slice(0, 5).map(e => e.number).sort((a, b) => a - b) : [];
}

// ===== 主回测 =====
console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║  📊 详细命中验证                                                   ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

const allDraws = picker.ALL_DRAWS;
const TEST_COUNT = 50;
const startIdx = allDraws.length - TEST_COUNT - 1;

console.log(`📊 数据范围：${allDraws[0].issue} ~ ${allDraws[allDraws.length - 1].issue}（共${allDraws.length}期）`);
console.log(`📊 测试区间：${allDraws[startIdx].issue} ~ ${allDraws[allDraws.length - 1].issue}（共${TEST_COUNT}期）`);
console.log(`📊 候选池大小：${V4_POOL_SIZE}球\n`);

// 详细结果
const detailedResults = [];
let totalTop5Hit = 0, totalBulou6Hit = 0, totalJointHit = 0, totalPoolHit = 0;
let validTests = 0;

for (let t = 0; t < TEST_COUNT; t++) {
  const targetIdx = allDraws.length - 1 - t;
  const sourceIdx = targetIdx - 1;
  const source2Idx = sourceIdx - 1;
  
  if (sourceIdx < 0 || source2Idx < 0) continue;
  
  const targetDraw = allDraws[targetIdx];
  const targetSet = new Set(targetDraw.front);
  
  // 构建池
  const mainPool = buildPool(sourceIdx, allDraws);
  const auxPool = buildPool(source2Idx, allDraws);
  if (!mainPool || !auxPool) continue;
  
  const merged = mergePools(mainPool, auxPool, 0.7, 0.3);
  
  // 生成组合
  const top5 = merged.pool.slice(0, 5).map(e => e.number);
  const bulou6 = generateBulou6(top5, merged.pool, mainPool.predictedTails);
  
  // 统计命中
  const top5Hit = top5.filter(n => targetSet.has(n)).length;
  const bulou6Hit = bulou6.filter(n => targetSet.has(n)).length;
  const joint = new Set([...top5, ...bulou6]);
  const jointHit = [...joint].filter(n => targetSet.has(n)).length;
  const poolHit = merged.pool.filter(e => targetSet.has(e.number)).length;
  
  totalTop5Hit += top5Hit;
  totalBulou6Hit += bulou6Hit;
  totalJointHit += jointHit;
  totalPoolHit += poolHit;
  validTests++;
  
  // 详细结果
  detailedResults.push({
    issue: targetDraw.issue,
    targetNumbers: targetDraw.front,
    top5,
    top5Hit,
    top5HitNumbers: top5.filter(n => targetSet.has(n)),
    bulou6,
    bulou6Hit,
    bulou6HitNumbers: bulou6.filter(n => targetSet.has(n)),
    jointHit,
    jointHitNumbers: [...joint].filter(n => targetSet.has(n)),
    poolHit,
    poolCoverage: (poolHit / 5 * 100).toFixed(1),
  });
}

// 输出详细结果
console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║                        📋 每期详细命中情况                          ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

console.log("期号      | 目标号码        | Top5命中 | 补漏6命中 | 联合命中 | 池覆盖 | 池覆盖率");
console.log("─".repeat(95));

detailedResults.forEach(r => {
  const top5Str = r.top5Hit > 0 ? `${r.top5Hit}个(${r.top5HitNumbers.join(',')})` : '0个';
  const bulou6Str = r.bulou6Hit > 0 ? `${r.bulou6Hit}个(${r.bulou6HitNumbers.join(',')})` : '0个';
  const jointStr = r.jointHit > 0 ? `${r.jointHit}个(${r.jointHitNumbers.join(',')})` : '0个';
  
  console.log(
    `${r.issue.padEnd(10)} | ${r.targetNumbers.join(',').padEnd(15)} | ${top5Str.padEnd(10)} | ${bulou6Str.padEnd(10)} | ${jointStr.padEnd(10)} | ${r.poolHit}个 | ${r.poolCoverage}%`
  );
});

// 统计汇总
console.log("\n" + "═".repeat(95));
console.log("📊 统计汇总：\n");

const avgTop5Hit = (totalTop5Hit / validTests).toFixed(2);
const avgBulou6Hit = (totalBulou6Hit / validTests).toFixed(2);
const avgJointHit = (totalJointHit / validTests).toFixed(2);
const avgPoolHit = (totalPoolHit / validTests).toFixed(2);
const top5HitRate = (totalTop5Hit / validTests / 5 * 100).toFixed(2);
const bulou6HitRate = (totalBulou6Hit / validTests / 5 * 100).toFixed(2);
const jointHitRate = (totalJointHit / validTests / 5 * 100).toFixed(2);
const poolCoverageRate = (totalPoolHit / validTests / 5 * 100).toFixed(2);

console.log(`1. Top5平均命中：${avgTop5Hit}个/期（命中率：${top5HitRate}%）`);
console.log(`2. 补漏6平均命中：${avgBulou6Hit}个/期（命中率：${bulou6HitRate}%）`);
console.log(`3. 联合平均命中：${avgJointHit}个/期（命中率：${jointHitRate}%）`);
console.log(`4. 池平均覆盖：${avgPoolHit}个/期（覆盖率：${poolCoverageRate}%）`);

// 命中分布统计
console.log("\n📊 命中分布统计：\n");

const top5Distribution = [0, 0, 0, 0, 0, 0]; // 0-5个命中
const bulou6Distribution = [0, 0, 0, 0, 0, 0];
const jointDistribution = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // 0-10个命中

detailedResults.forEach(r => {
  top5Distribution[r.top5Hit]++;
  bulou6Distribution[r.bulou6Hit]++;
  jointDistribution[r.jointHit]++;
});

console.log("Top5命中分布：");
for (let i = 0; i <= 5; i++) {
  const count = top5Distribution[i];
  const percentage = (count / validTests * 100).toFixed(1);
  console.log(`  ${i}个命中：${count}期（${percentage}%）`);
}

console.log("\n补漏6命中分布：");
for (let i = 0; i <= 5; i++) {
  const count = bulou6Distribution[i];
  const percentage = (count / validTests * 100).toFixed(1);
  console.log(`  ${i}个命中：${count}期（${percentage}%）`);
}

console.log("\n联合命中分布：");
for (let i = 0; i <= 10; i++) {
  const count = jointDistribution[i];
  if (count > 0) {
    const percentage = (count / validTests * 100).toFixed(1);
    console.log(`  ${i}个命中：${count}期（${percentage}%）`);
  }
}

// 补漏6增补效果分析
console.log("\n📊 补漏6增补效果分析：\n");

let bulou6AddedCoverage = 0;
let bulou6AddedCount = 0;
let top5OnlyCoverage = 0;

detailedResults.forEach(r => {
  const top5Set = new Set(r.top5);
  const bulou6Set = new Set(r.bulou6);
  const targetSet = new Set(r.targetNumbers);
  
  // Top5单独覆盖
  const top5Covered = r.top5.filter(n => targetSet.has(n)).length;
  top5OnlyCoverage += top5Covered;
  
  // 补漏6增补覆盖
  const bulou6NewCovered = r.bulou6.filter(n => targetSet.has(n) && !top5Set.has(n)).length;
  bulou6AddedCoverage += bulou6NewCovered;
  bulou6AddedCount += bulou6NewCovered;
});

console.log(`Top5单独覆盖：${top5OnlyCoverage}个（平均${(top5OnlyCoverage / validTests).toFixed(2)}个/期）`);
console.log(`补漏6增补覆盖：${bulou6AddedCoverage}个（平均${(bulou6AddedCoverage / validTests).toFixed(2)}个/期）`);
console.log(`补漏6增补率：${(bulou6AddedCoverage / top5OnlyCoverage * 100).toFixed(1)}%`);

// 输出JSON报告
const report = {
  timestamp: new Date().toISOString(),
  testConfig: {
    testCount: TEST_COUNT,
    poolSize: V4_POOL_SIZE,
    dataRange: `${allDraws[0].issue} ~ ${allDraws[allDraws.length - 1].issue}`,
  },
  summary: {
    avgTop5Hit: parseFloat(avgTop5Hit),
    avgBulou6Hit: parseFloat(avgBulou6Hit),
    avgJointHit: parseFloat(avgJointHit),
    avgPoolHit: parseFloat(avgPoolHit),
    top5HitRate: parseFloat(top5HitRate),
    bulou6HitRate: parseFloat(bulou6HitRate),
    jointHitRate: parseFloat(jointHitRate),
    poolCoverageRate: parseFloat(poolCoverageRate),
  },
  distribution: {
    top5: top5Distribution,
    bulou6: bulou6Distribution,
    joint: jointDistribution,
  },
  bulou6Effect: {
    top5OnlyCoverage,
    bulou6AddedCoverage,
    bulou6AddedRate: parseFloat((bulou6AddedCoverage / top5OnlyCoverage * 100).toFixed(1)),
  },
  detailedResults,
};

fs.writeFileSync(path.join(__dirname, 'backtest_detailed_verification_report.json'), JSON.stringify(report, null, 2));
console.log(`\n📄 报告已保存: backtest_detailed_verification_report.json`);
