/**
 * backtest_interval_ratio_enhanced.js — 增强区间比预测函数测试
 * 
 * 测试 script.js 中增强的 predictTargetIntervalRatio 函数：
 * 1. 区间不变检测（连续3期以上相同 → 预期继续不变）
 * 2. 极值回归（一区=0 → +2, 三区≥4 → -2）
 * 3. 连续同向反转（连续2期同向 → 预期反转）
 * 
 * 运行：node backtest_interval_ratio_enhanced.js
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

// ===== 增强的区间比预测函数（从 script.js 复制） =====
function predictTargetIntervalRatioEnhanced(sourceRow, sourceIv, allDraws) {
  const sourceIvKey = sourceIv.join(":");
  const transitions = new Map();
  const windowSize = Math.min(60, allDraws.length);

  // ① 收集同源区间比特定转移 + 全局平均转移距离
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

  // 🆕 规律增强：区间变化模式检测
  const patternBoost = new Map(); // 区间比 -> 额外加分
  
  if (allDraws.length >= 3) {
    const recentIvs = [];
    for (let i = Math.max(0, allDraws.length - 5); i < allDraws.length; i++) {
      recentIvs.push(intervalRatio(allDraws[i].front));
    }
    
    // 规律1: 区间不变时（占比33-40%），预期可能继续不变
    // 检测最近几期区间比是否相同
    let sameCount = 0;
    for (let i = recentIvs.length - 1; i >= 1; i--) {
      if (recentIvs[i][0] === recentIvs[i-1][0] && 
          recentIvs[i][1] === recentIvs[i-1][1] && 
          recentIvs[i][2] === recentIvs[i-1][2]) {
        sameCount++;
      } else break;
    }
    if (sameCount >= 2) {
      // 连续3期以上相同，预期可能继续不变
      const currentKey = sourceIv.join(":");
      const boost = patternBoost.get(currentKey) || 0;
      patternBoost.set(currentKey, boost + sameCount * 3);
    }
    
    // 规律2: 极值后回归（概率78-100%）
    for (let zone = 0; zone < 3; zone++) {
      if (sourceIv[zone] === 0) {
        // 极低值，预期回归（+1或+2）
        const predicted = [...sourceIv];
        predicted[zone] = Math.min(3, predicted[zone] + 2);
        const key = predicted.join(":");
        const boost = patternBoost.get(key) || 0;
        patternBoost.set(key, boost + 8); // 高置信度
        
        // 也考虑+1的情况
        const predicted2 = [...sourceIv];
        predicted2[zone] = Math.min(3, predicted2[zone] + 1);
        const key2 = predicted2.join(":");
        const boost2 = patternBoost.get(key2) || 0;
        patternBoost.set(key2, boost2 + 5);
      }
      if (sourceIv[zone] >= 4) {
        // 极高值，预期回归（-1或-2）
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
    
    // 规律3: 连续同向变化后反转（小样本，谨慎使用）
    if (recentIvs.length >= 3) {
      const current = recentIvs[recentIvs.length - 1];
      const prev = recentIvs[recentIvs.length - 2];
      const prevPrev = recentIvs[recentIvs.length - 3];
      
      for (let zone = 0; zone < 3; zone++) {
        const diff1 = current[zone] - prev[zone];
        const diff2 = prev[zone] - prevPrev[zone];
        
        // 连续2期增大后，预期减小
        if (diff1 > 0 && diff2 > 0) {
          const predicted = [...current];
          predicted[zone] = Math.max(0, predicted[zone] - 1);
          const key = predicted.join(":");
          const boost = patternBoost.get(key) || 0;
          patternBoost.set(key, boost + 4); // 中等置信度
        }
        // 连续2期减小后，预期增大
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
  
  // 应用规律加分到候选
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

  // ② 与全局均值融合：防止小样本过拟合
  const blendedDistance = Math.round(rawDistance * blendWeight + globalAvgDist * (1 - blendWeight));
  const confidence = rawConfidence * blendWeight;

  return { 
    predictedIv: topCandidates[0].iv, 
    predictedIvKey: topCandidates[0].ivKey, 
    distance: blendedDistance, 
    confidence, 
    topCandidates: topCandidates.slice(0, 5), // 返回更多候选供参考
    globalAvgDist,
    patternBoost: Object.fromEntries(patternBoost) // 返回规律加分信息
  };
}

// ===== 基础区间比预测函数（无增强） =====
function predictTargetIntervalRatioBaseline(sourceRow, sourceIv, allDraws) {
  const sourceIvKey = sourceIv.join(":");
  const transitions = new Map();
  const windowSize = Math.min(60, allDraws.length);

  // ① 收集同源区间比特定转移 + 全局平均转移距离
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

  const topCandidates = sorted.slice(0, 3);
  const rawDistance = getIntervalRatioDistance(sourceIv, topCandidates[0].iv);
  const totalScore = topCandidates.reduce((s, c) => s + c.score, 0);
  const rawConfidence = topCandidates[0].score / Math.max(0.1, totalScore);

  // ② 与全局均值融合：防止小样本过拟合
  const blendedDistance = Math.round(rawDistance * blendWeight + globalAvgDist * (1 - blendWeight));
  const confidence = rawConfidence * blendWeight;

  return { 
    predictedIv: topCandidates[0].iv, 
    predictedIvKey: topCandidates[0].ivKey, 
    distance: blendedDistance, 
    confidence, 
    topCandidates: topCandidates.slice(0, 5),
    globalAvgDist
  };
}

// ===== 构建候选池（简化版） =====
function buildPool(sourceIdx, allDraws, useEnhancedPrediction = true) {
  const sourceDraw = allDraws[sourceIdx];
  if (!sourceDraw) return null;
  
  const selectedNumbers = [...sourceDraw.front].sort((a, b) => a - b);
  const sourceTails = tails(selectedNumbers);
  const sourceIv = intervalRatio(selectedNumbers);
  
  // 预测区间比
  const ivPrediction = useEnhancedPrediction 
    ? predictTargetIntervalRatioEnhanced(sourceIdx, sourceIv, allDraws.slice(0, sourceIdx + 1))
    : predictTargetIntervalRatioBaseline(sourceIdx, sourceIv, allDraws.slice(0, sourceIdx + 1));
  
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
    
    // 预测该区间需要增加号码
    if (predictedCount > currentCount) {
      score += 3;
    }
    // 预测该区间需要减少号码
    else if (predictedCount < currentCount) {
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
console.log("║  🧪 增强区间比预测函数测试                                         ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

const allDraws = picker.ALL_DRAWS;
const TEST_COUNT = 50;
const startIdx = allDraws.length - TEST_COUNT - 1;

console.log(`📊 数据范围：${allDraws[0].issue} ~ ${allDraws[allDraws.length - 1].issue}（共${allDraws.length}期）`);
console.log(`📊 测试区间：${allDraws[startIdx].issue} ~ ${allDraws[allDraws.length - 1].issue}（共${TEST_COUNT}期）`);
console.log(`📊 候选池大小：${V4_POOL_SIZE}球\n`);

// 测试配置
const configs = [
  { useEnhanced: false, label: "基准（无增强预测）" },
  { useEnhanced: true,  label: "增强区间比预测" },
];

const results = [];

for (const config of configs) {
  let totalHits = 0, totalJointHits = 0, totalPoolHits = 0;
  let validTests = 0;
  let ivPredictionCorrect = 0, ivPredictionTotal = 0;
  let patternBoostApplied = 0;
  
  for (let t = 0; t < TEST_COUNT; t++) {
    const targetIdx = allDraws.length - 1 - t;
    const sourceIdx = targetIdx - 1;
    const source2Idx = sourceIdx - 1;
    
    if (sourceIdx < 0 || source2Idx < 0) continue;
    
    const targetDraw = allDraws[targetIdx];
    const targetSet = new Set(targetDraw.front);
    
    // 构建池
    const mainPool = buildPool(sourceIdx, allDraws, config.useEnhanced);
    const auxPool = buildPool(source2Idx, allDraws, config.useEnhanced);
    if (!mainPool || !auxPool) continue;
    
    const merged = mergePools(mainPool, auxPool, 0.7, 0.3);
    
    // 生成组合
    const top5 = merged.pool.slice(0, 5).map(e => e.number);
    const bulou6 = generateBulou6(top5, merged.pool, mainPool.predictedTails);
    
    // 统计命中
    const top5Hit = top5.filter(n => targetSet.has(n)).length;
    const joint = new Set([...top5, ...bulou6]);
    const jointHit = [...joint].filter(n => targetSet.has(n)).length;
    const poolHit = merged.pool.filter(e => targetSet.has(e.number)).length;
    
    totalHits += top5Hit;
    totalJointHits += jointHit;
    totalPoolHits += poolHit;
    validTests++;
    
    // 验证区间预测准确率
    const actualIv = intervalRatio(targetDraw.front);
    const predictedIv = mainPool.ivPrediction.predictedIv;
    
    // 检查预测方向是否正确
    for (let zone = 0; zone < 3; zone++) {
      const currentCount = mainPool.sourceIv[zone];
      const predictedDirection = predictedIv[zone] - currentCount;
      const actualDirection = actualIv[zone] - currentCount;
      
      if (Math.sign(predictedDirection) === Math.sign(actualDirection) || 
          (predictedDirection === 0 && actualDirection === 0)) {
        ivPredictionCorrect++;
      }
      ivPredictionTotal++;
    }
    
    // 统计规律加分应用次数
    if (config.useEnhanced && mainPool.ivPrediction.patternBoost) {
      const boostValues = Object.values(mainPool.ivPrediction.patternBoost);
      if (boostValues.some(v => v > 0)) {
        patternBoostApplied++;
      }
    }
  }
  
  const avgHit = (totalHits / validTests * 100).toFixed(2);
  const avgJoint = (totalJointHits / validTests * 100).toFixed(2);
  const avgPool = (totalPoolHits / validTests / 5 * 100).toFixed(2);
  const ivAccuracy = ivPredictionTotal > 0 ? (ivPredictionCorrect / ivPredictionTotal * 100).toFixed(1) : "N/A";
  
  results.push({
    label: config.label,
    useEnhanced: config.useEnhanced,
    top5HitRate: parseFloat(avgHit),
    jointHitRate: parseFloat(avgJoint),
    poolCoverage: parseFloat(avgPool),
    ivPredictionAccuracy: parseFloat(ivAccuracy),
    patternBoostRate: config.useEnhanced ? (patternBoostApplied / validTests * 100).toFixed(1) : "N/A",
  });
}

// 输出结果
console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║                        📊 回测结果对比                              ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

console.log("配置                      | Top5命中率 | 联合命中率 | 池覆盖率 | 区间预测准确率 | 规律加分应用率");
console.log("─".repeat(95));

const baseline = results[0];

results.forEach((r, i) => {
  const top5Diff = (r.top5HitRate - baseline.top5HitRate).toFixed(2);
  const jointDiff = (r.jointHitRate - baseline.jointHitRate).toFixed(2);
  const poolDiff = (r.poolCoverage - baseline.poolCoverage).toFixed(2);
  const ivDiff = (r.ivPredictionAccuracy - baseline.ivPredictionAccuracy).toFixed(1);
  
  const top5Sign = parseFloat(top5Diff) >= 0 ? "+" : "";
  const jointSign = parseFloat(jointDiff) >= 0 ? "+" : "";
  const poolSign = parseFloat(poolDiff) >= 0 ? "+" : "";
  const ivSign = parseFloat(ivDiff) >= 0 ? "+" : "";
  
  console.log(
    `${r.label.padEnd(25)} | ${r.top5HitRate.toFixed(2)}%${top5Sign}${top5Diff} | ${r.jointHitRate.toFixed(2)}%${jointSign}${jointDiff} | ${r.poolCoverage.toFixed(2)}%${poolSign}${poolDiff} | ${r.ivPredictionAccuracy.toFixed(1)}%${ivSign}${ivDiff} | ${r.patternBoostRate}%`
  );
});

// 最佳配置
const best = results[1]; // 增强预测配置
console.log("\n" + "═".repeat(95));
console.log(`🏆 优化效果：`);
console.log(`   Top5命中率: ${baseline.top5HitRate.toFixed(2)}% → ${best.top5HitRate.toFixed(2)}%（${(best.top5HitRate - baseline.top5HitRate) >= 0 ? "+" : ""}${(best.top5HitRate - baseline.top5HitRate).toFixed(2)}pp）`);
console.log(`   联合命中率: ${baseline.jointHitRate.toFixed(2)}% → ${best.jointHitRate.toFixed(2)}%（${(best.jointHitRate - baseline.jointHitRate) >= 0 ? "+" : ""}${(best.jointHitRate - baseline.jointHitRate).toFixed(2)}pp）`);
console.log(`   池覆盖率: ${baseline.poolCoverage.toFixed(2)}% → ${best.poolCoverage.toFixed(2)}%（${(best.poolCoverage - baseline.poolCoverage) >= 0 ? "+" : ""}${(best.poolCoverage - baseline.poolCoverage).toFixed(2)}pp）`);
console.log(`   区间预测准确率: ${baseline.ivPredictionAccuracy.toFixed(1)}% → ${best.ivPredictionAccuracy.toFixed(1)}%（${(best.ivPredictionAccuracy - baseline.ivPredictionAccuracy) >= 0 ? "+" : ""}${(best.ivPredictionAccuracy - baseline.ivPredictionAccuracy).toFixed(1)}pp）`);
console.log(`   规律加分应用率: ${best.patternBoostRate}%`);

// 输出JSON报告
const report = {
  timestamp: new Date().toISOString(),
  testConfig: {
    testCount: TEST_COUNT,
    poolSize: V4_POOL_SIZE,
    dataRange: `${allDraws[0].issue} ~ ${allDraws[allDraws.length - 1].issue}`,
  },
  results,
  bestConfig: {
    useEnhancedPrediction: best.useEnhanced,
    top5HitRate: best.top5HitRate,
    jointHitRate: best.jointHitRate,
    poolCoverage: best.poolCoverage,
    ivPredictionAccuracy: best.ivPredictionAccuracy,
    patternBoostRate: best.patternBoostRate,
  },
  recommendation: best.top5HitRate > baseline.top5HitRate && best.jointHitRate > baseline.jointHitRate 
    ? "✅ 增强区间比预测有效，建议集成到 script.js"
    : "⚠️ 增强区间比预测效果不明显，建议进一步优化"
};

fs.writeFileSync(path.join(__dirname, 'backtest_interval_ratio_enhanced_report.json'), JSON.stringify(report, null, 2));
console.log(`\n📄 报告已保存: backtest_interval_ratio_enhanced_report.json`);
