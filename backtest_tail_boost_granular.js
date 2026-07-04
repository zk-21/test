/**
 * backtest_tail_boost_granular.js — 尾号加成精细测试
 * 
 * 专注于测试区间稳定时的尾号加成权重
 * 
 * 运行：node backtest_tail_boost_granular.js
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

// ===== 检测区间稳定性 =====
function detectIntervalStability(allDraws, sourceIdx, lookback = 5) {
  if (sourceIdx < lookback) return { isStable: false, stabilityScore: 0 };
  
  const currentIv = intervalRatio(allDraws[sourceIdx].front);
  let sameCount = 0;
  let totalComparisons = 0;
  
  for (let i = 1; i <= lookback; i++) {
    const prevIv = intervalRatio(allDraws[sourceIdx - i].front);
    totalComparisons++;
    if (currentIv[0] === prevIv[0] && currentIv[1] === prevIv[1] && currentIv[2] === prevIv[2]) {
      sameCount++;
    }
  }
  
  const stabilityScore = sameCount / totalComparisons;
  const isStable = stabilityScore >= 0.4;
  
  return { isStable, stabilityScore, currentIv };
}

// ===== 带尾号加成的候选池构建 =====
function buildV4PoolWithTailBoost(sourceIdx, allDraws, tailBoost) {
  const sourceDraw = allDraws[sourceIdx];
  if (!sourceDraw) return null;
  
  const selectedNumbers = [...sourceDraw.front].sort((a, b) => a - b);
  const sourceTails = tails(selectedNumbers);
  
  // 检测区间稳定性
  const stability = detectIntervalStability(allDraws, sourceIdx);
  
  // 预处理映射
  const bridgeMap = buildBridgeMap(selectedNumbers);
  const arithMap = buildArithmeticMap(selectedNumbers);
  
  // 热号
  const hotness = new Map();
  for (let i = Math.max(0, sourceIdx - 10); i < sourceIdx; i++) {
    allDraws[i].front.forEach(n => hotness.set(n, (hotness.get(n) || 0) + 1));
  }
  
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
  
  // 归一化参考值
  const maxBridge = Math.max(1,
    ...[...bridgeMap.gapMap.values()].map(v => v.score),
    ...[...bridgeMap.endpointMap.values()].map(v => v.score)
  );
  const maxArith = Math.max(1, ...[...arithMap.values()].map(v => v.score));
  
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
    
    // 桥梁
    const bg = bridgeMap.gapMap.get(n);
    const be = bridgeMap.endpointMap.get(n);
    if (bg) score += Math.round(bg.score / maxBridge * 15);
    if (be) score += Math.round(be.score / maxBridge * 8);
    
    // 等距
    const ae = arithMap.get(n);
    if (ae) score += Math.round(ae.score / maxArith * 10);
    
    // 热号
    const hot = hotness.get(n) || 0;
    if (hot >= 4) score += 6;
    else if (hot >= 3) score += 4;
    else if (hot >= 2) score += 2;
    else if (hot === 0) score -= 1;
    
    // === 区间稳定时尾号加成 ===
    if (stability.isStable && tailBoost > 0) {
      if (predictedTails.length > 0) {
        const topTails = new Set(predictedTails.slice(0, 5).map(([tt]) => tt));
        if (topTails.has(t)) {
          score += tailBoost; // 额外尾号加成
        }
      }
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
    stability,
  };
}

// ===== 辅助函数 =====
function buildBridgeMap(nums) {
  const gapMap = new Map(), endpointMap = new Map();
  for (let i = 0; i < nums.length - 1; i++) {
    const gap = nums[i + 1] - nums[i];
    if (gap >= 2 && gap <= 4) {
      for (let m = nums[i] + 1; m < nums[i + 1]; m++) {
        gapMap.set(m, { score: 5 - (gap - 2) });
      }
      endpointMap.set(nums[i], { score: (endpointMap.get(nums[i])?.score || 0) + 3 });
      endpointMap.set(nums[i + 1], { score: (endpointMap.get(nums[i + 1])?.score || 0) + 3 });
    }
  }
  return { gapMap, endpointMap };
}

function buildArithmeticMap(nums) {
  const map = new Map();
  for (let d = 2; d <= 6; d++) {
    nums.forEach(n => {
      const lo = n - d, hi = n + d;
      if (nums.includes(lo) && nums.includes(hi)) {
        map.set(n, { score: (map.get(n)?.score || 0) + 4 });
      }
    });
  }
  return map;
}

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

function generateBulou6(top5Nums, pool, srcIdx, predictedTails) {
  const allDraws = picker.ALL_DRAWS;
  const top5Set = new Set(top5Nums);
  
  const predTails = predictedTails ? new Set(predictedTails.slice(0, 5).map(([t]) => t)) : new Set();
  
  const scored = pool
    .filter(e => !top5Set.has(e.number))
    .map(e => {
      const n = e.number;
      let s = e.score;
      if (predTails.has(n % 10)) s += 5;
      const z = getSampleIntervalIndex(n);
      let md = Infinity; top5Nums.forEach(cn => { const d = Math.abs(n - cn); if (d < md) md = d; });
      if (md === 1) s += 12; else if (md === 2) s += 6; else if (md === 3) s += 3;
      return { number: n, score: s };
    })
    .sort((a, b) => b.score - a.score);
  
  return scored.length >= 5 ? scored.slice(0, 5).map(e => e.number).sort((a, b) => a - b) : [];
}

// ===== 主回测 =====
console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║  🧪 尾号加成精细测试（区间稳定时）                                 ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

const allDraws = picker.ALL_DRAWS;
const TEST_COUNT = 50;
const startIdx = allDraws.length - TEST_COUNT - 1;

console.log(`📊 数据范围：${allDraws[0].issue} ~ ${allDraws[allDraws.length - 1].issue}（共${allDraws.length}期）`);
console.log(`📊 测试区间：${allDraws[startIdx].issue} ~ ${allDraws[allDraws.length - 1].issue}（共${TEST_COUNT}期）`);
console.log(`📊 候选池大小：${V4_POOL_SIZE}球\n`);

// 测试不同的尾号加成值
const tailBoostValues = [0, 2, 3, 4, 5, 6, 7, 8, 10];

const results = [];

for (const tailBoost of tailBoostValues) {
  let totalHits = 0, totalJointHits = 0, totalPoolHits = 0;
  let validTests = 0;
  
  for (let t = 0; t < TEST_COUNT; t++) {
    const targetIdx = allDraws.length - 1 - t;
    const sourceIdx = targetIdx - 1;
    const source2Idx = sourceIdx - 1;
    
    if (sourceIdx < 0 || source2Idx < 0) continue;
    
    const targetDraw = allDraws[targetIdx];
    const targetSet = new Set(targetDraw.front);
    
    // 构建池
    const mainPool = buildV4PoolWithTailBoost(sourceIdx, allDraws, tailBoost);
    const auxPool = buildV4PoolWithTailBoost(source2Idx, allDraws, tailBoost);
    if (!mainPool || !auxPool) continue;
    
    const merged = mergePools(mainPool, auxPool, 0.7, 0.3);
    
    // 生成组合
    const top5 = merged.pool.slice(0, 5).map(e => e.number);
    const bulou6 = generateBulou6(top5, merged.pool, targetIdx, mainPool.predictedTails);
    
    // 统计命中
    const top5Hit = top5.filter(n => targetSet.has(n)).length;
    const joint = new Set([...top5, ...bulou6]);
    const jointHit = [...joint].filter(n => targetSet.has(n)).length;
    const poolHit = merged.pool.filter(e => targetSet.has(e.number)).length;
    
    totalHits += top5Hit;
    totalJointHits += jointHit;
    totalPoolHits += poolHit;
    validTests++;
  }
  
  const avgHit = (totalHits / validTests * 100).toFixed(2);
  const avgJoint = (totalJointHits / validTests * 100).toFixed(2);
  const avgPool = (totalPoolHits / validTests / 5 * 100).toFixed(2);
  
  results.push({
    tailBoost,
    top5HitRate: parseFloat(avgHit),
    jointHitRate: parseFloat(avgJoint),
    poolCoverage: parseFloat(avgPool),
  });
}

// 输出结果
console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║                        📊 回测结果对比                              ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

console.log("尾号加成 | Top5命中率 | 联合命中率 | 池覆盖率 | Top5变化 | 联合变化");
console.log("─".repeat(75));

const baseline = results[0];

results.forEach((r, i) => {
  const top5Diff = (r.top5HitRate - baseline.top5HitRate).toFixed(2);
  const jointDiff = (r.jointHitRate - baseline.jointHitRate).toFixed(2);
  const poolDiff = (r.poolCoverage - baseline.poolCoverage).toFixed(2);
  
  const top5Sign = parseFloat(top5Diff) >= 0 ? "+" : "";
  const jointSign = parseFloat(jointDiff) >= 0 ? "+" : "";
  
  console.log(
    `${String(r.tailBoost).padStart(6)}   | ${r.top5HitRate.toFixed(2)}% | ${r.jointHitRate.toFixed(2)}% | ${r.poolCoverage.toFixed(2)}% | ${top5Sign}${top5Diff}pp | ${jointSign}${jointDiff}pp`
  );
});

// 找出最佳配置
const bestIdx = results.reduce((bestIdx, r, idx) => {
  // 综合考虑Top5和联合命中率
  const bestScore = results[bestIdx].top5HitRate + results[bestIdx].jointHitRate;
  const currentScore = r.top5HitRate + r.jointHitRate;
  return currentScore > bestScore ? idx : bestIdx;
}, 0);

const best = results[bestIdx];
console.log("\n" + "═".repeat(75));
console.log(`🏆 最佳配置: 尾号加成 = ${best.tailBoost}`);
console.log(`   Top5命中率: ${baseline.top5HitRate.toFixed(2)}% → ${best.top5HitRate.toFixed(2)}%（${(best.top5HitRate - baseline.top5HitRate) >= 0 ? "+" : ""}${(best.top5HitRate - baseline.top5HitRate).toFixed(2)}pp）`);
console.log(`   联合命中率: ${baseline.jointHitRate.toFixed(2)}% → ${best.jointHitRate.toFixed(2)}%（${(best.jointHitRate - baseline.jointHitRate) >= 0 ? "+" : ""}${(best.jointHitRate - baseline.jointHitRate).toFixed(2)}pp）`);
console.log(`   池覆盖率: ${baseline.poolCoverage.toFixed(2)}% → ${best.poolCoverage.toFixed(2)}%（${(best.poolCoverage - baseline.poolCoverage) >= 0 ? "+" : ""}${(best.poolCoverage - baseline.poolCoverage).toFixed(2)}pp）`);

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
    tailBoost: best.tailBoost,
    top5HitRate: best.top5HitRate,
    jointHitRate: best.jointHitRate,
    poolCoverage: best.poolCoverage,
    top5Improvement: parseFloat((best.top5HitRate - baseline.top5HitRate).toFixed(2)),
    jointImprovement: parseFloat((best.jointHitRate - baseline.jointHitRate).toFixed(2)),
    poolImprovement: parseFloat((best.poolCoverage - baseline.poolCoverage).toFixed(2)),
  },
};

fs.writeFileSync(
  path.join(__dirname, 'analysis_output', 'tail_boost_granular_report.json'),
  JSON.stringify(report, null, 2)
);

console.log("\n📁 报告已保存: analysis_output/tail_boost_granular_report.json");
