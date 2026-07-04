/**
 * backtest_interval_unchanged_tail_boost.js — 区间不变时尾号加成优化
 * 
 * 基于发现的规律：
 * - 区间不变时尾重率最高（0.71-0.91）
 * - 区间不变时重号率最高（0.73-0.83）
 * - 区间不变占33-40%的比例
 * 
 * 优化策略：当检测到区间可能不变时，提升尾号匹配和重号权重
 * 
 * 运行：node backtest_interval_unchanged_tail_boost.js
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
  
  // 检查最近几期的区间比是否相同
  for (let i = 1; i <= lookback; i++) {
    const prevIv = intervalRatio(allDraws[sourceIdx - i].front);
    totalComparisons++;
    if (currentIv[0] === prevIv[0] && currentIv[1] === prevIv[1] && currentIv[2] === prevIv[2]) {
      sameCount++;
    }
  }
  
  const stabilityScore = sameCount / totalComparisons;
  const isStable = stabilityScore >= 0.4; // 40%以上相同认为稳定
  
  return { isStable, stabilityScore, currentIv };
}

// ===== 检测区间变化方向 =====
function detectIntervalDirection(allDraws, sourceIdx) {
  if (sourceIdx < 2) return { direction: 'unknown', confidence: 0 };
  
  const currentIv = intervalRatio(allDraws[sourceIdx].front);
  const prevIv = intervalRatio(allDraws[sourceIdx - 1].front);
  const prevPrevIv = intervalRatio(allDraws[sourceIdx - 2].front);
  
  // 计算各区间的变化方向
  const directions = [];
  for (let zone = 0; zone < 3; zone++) {
    const diff1 = currentIv[zone] - prevIv[zone];
    const diff2 = prevIv[zone] - prevPrevIv[zone];
    
    // 连续同向变化
    if (diff1 > 0 && diff2 > 0) directions.push({ zone, direction: 'increase', consecutive: 2 });
    else if (diff1 < 0 && diff2 < 0) directions.push({ zone, direction: 'decrease', consecutive: 2 });
    else if (diff1 > 0) directions.push({ zone, direction: 'increase', consecutive: 1 });
    else if (diff1 < 0) directions.push({ zone, direction: 'decrease', consecutive: 1 });
    else directions.push({ zone, direction: 'stable', consecutive: 0 });
  }
  
  // 检测极值
  const extremes = [];
  for (let zone = 0; zone < 3; zone++) {
    if (currentIv[zone] >= 4) extremes.push({ zone, type: 'high', value: currentIv[zone] });
    if (currentIv[zone] === 0) extremes.push({ zone, type: 'low', value: 0 });
  }
  
  return { directions, extremes, currentIv };
}

// ===== 带区间稳定性优化的候选池构建 =====
function buildV4PoolOptimized(sourceIdx, allDraws, config) {
  const sourceDraw = allDraws[sourceIdx];
  if (!sourceDraw) return null;
  
  const selectedNumbers = [...sourceDraw.front].sort((a, b) => a - b);
  const sourceTails = tails(selectedNumbers);
  
  // 检测区间稳定性
  const stability = detectIntervalStability(allDraws, sourceIdx);
  const direction = detectIntervalDirection(allDraws, sourceIdx);
  
  // 预处理映射
  const bridgeMap = buildBridgeMap(selectedNumbers);
  const arithMap = buildArithmeticMap(selectedNumbers);
  
  // 热号
  const hotness = new Map();
  for (let i = Math.max(0, sourceIdx - 10); i < sourceIdx; i++) {
    allDraws[i].front.forEach(n => hotness.set(n, (hotness.get(n) || 0) + 1));
  }
  
  // 重号统计（用于区间不变时的加成）
  const repeatNumbers = new Map();
  if (sourceIdx > 0) {
    const prevDraw = allDraws[sourceIdx - 1];
    if (prevDraw) {
      prevDraw.front.forEach(n => repeatNumbers.set(n, 1));
    }
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
    
    // === 区间稳定性优化 ===
    if (config.enableStabilityBoost) {
      const zone = getSampleIntervalIndex(n);
      
      // 规则1: 区间稳定时，提升尾号匹配权重
      if (stability.isStable) {
        if (predictedTails.length > 0) {
          const topTails = new Set(predictedTails.slice(0, 5).map(([tt]) => tt));
          if (topTails.has(t)) {
            score += config.stabilityTailBoost; // 额外尾号加成
          }
        }
        
        // 规则2: 区间稳定时，提升重号权重
        if (repeatNumbers.has(n)) {
          score += config.stabilityRepeatBoost; // 重号加成
        }
      }
      
      // 规则3: 连续同向变化后，预期反转
      for (const dir of direction.directions) {
        if (dir.consecutive >= 2) {
          if (dir.direction === 'increase' && zone === dir.zone) {
            score -= 2; // 预期该区间减少，轻微惩罚
          } else if (dir.direction === 'decrease' && zone === dir.zone) {
            score += 2; // 预期该区间增加，轻微加分
          }
        }
      }
      
      // 规则4: 极值回归
      for (const extreme of direction.extremes) {
        if (extreme.type === 'low' && zone === extreme.zone) {
          score += 3; // 从0回归，加分
        } else if (extreme.type === 'high' && zone === extreme.zone) {
          score -= 2; // 从极高回归，轻微惩罚
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
    direction,
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
console.log("║  🧪 区间稳定性优化测试（尾号+重号加成）                            ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

const allDraws = picker.ALL_DRAWS;
const TEST_COUNT = 50;
const startIdx = allDraws.length - TEST_COUNT - 1;

console.log(`📊 数据范围：${allDraws[0].issue} ~ ${allDraws[allDraws.length - 1].issue}（共${allDraws.length}期）`);
console.log(`📊 测试区间：${allDraws[startIdx].issue} ~ ${allDraws[allDraws.length - 1].issue}（共${TEST_COUNT}期）`);
console.log(`📊 候选池大小：${V4_POOL_SIZE}球\n`);

// 测试配置
const configs = [
  { enableStabilityBoost: false, stabilityTailBoost: 0, stabilityRepeatBoost: 0, label: "基准" },
  { enableStabilityBoost: true, stabilityTailBoost: 3, stabilityRepeatBoost: 2, label: "保守(+3/+2)" },
  { enableStabilityBoost: true, stabilityTailBoost: 5, stabilityRepeatBoost: 3, label: "中等(+5/+3)" },
  { enableStabilityBoost: true, stabilityTailBoost: 8, stabilityRepeatBoost: 5, label: "激进(+8/+5)" },
  { enableStabilityBoost: true, stabilityTailBoost: 5, stabilityRepeatBoost: 0, label: "仅尾号(+5/+0)" },
  { enableStabilityBoost: true, stabilityTailBoost: 0, stabilityRepeatBoost: 5, label: "仅重号(+0/+5)" },
];

const results = [];

for (const config of configs) {
  let totalHits = 0, totalJointHits = 0, totalPoolHits = 0;
  let validTests = 0;
  let stableTests = 0, stableHits = 0;
  
  for (let t = 0; t < TEST_COUNT; t++) {
    const targetIdx = allDraws.length - 1 - t;
    const sourceIdx = targetIdx - 1;
    const source2Idx = sourceIdx - 1;
    
    if (sourceIdx < 0 || source2Idx < 0) continue;
    
    const targetDraw = allDraws[targetIdx];
    const targetSet = new Set(targetDraw.front);
    
    // 构建池
    const mainPool = buildV4PoolOptimized(sourceIdx, allDraws, config);
    const auxPool = buildV4PoolOptimized(source2Idx, allDraws, config);
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
    
    // 统计稳定期的表现
    if (mainPool.stability.isStable) {
      stableTests++;
      stableHits += top5Hit;
    }
  }
  
  const avgHit = (totalHits / validTests * 100).toFixed(2);
  const avgJoint = (totalJointHits / validTests * 100).toFixed(2);
  const avgPool = (totalPoolHits / validTests / 5 * 100).toFixed(2);
  const stableHitRate = stableTests > 0 ? (stableHits / stableTests * 100).toFixed(1) : "N/A";
  
  results.push({
    label: config.label,
    config,
    top5HitRate: parseFloat(avgHit),
    jointHitRate: parseFloat(avgJoint),
    poolCoverage: parseFloat(avgPool),
    stableTests,
    stableHitRate,
  });
}

// 输出结果
console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║                        📊 回测结果对比                              ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

console.log("配置              | Top5命中率 | 联合命中率 | 池覆盖率 | 稳定期命中率 | 稳定期数");
console.log("─".repeat(90));

const baseline = results[0];

results.forEach((r, i) => {
  const top5Diff = (r.top5HitRate - baseline.top5HitRate).toFixed(2);
  const jointDiff = (r.jointHitRate - baseline.jointHitRate).toFixed(2);
  const poolDiff = (r.poolCoverage - baseline.poolCoverage).toFixed(2);
  
  const top5Sign = parseFloat(top5Diff) >= 0 ? "+" : "";
  const jointSign = parseFloat(jointDiff) >= 0 ? "+" : "";
  const poolSign = parseFloat(poolDiff) >= 0 ? "+" : "";
  
  console.log(
    `${r.label.padEnd(17)} | ${r.top5HitRate.toFixed(2)}%${top5Sign}${top5Diff} | ${r.jointHitRate.toFixed(2)}%${jointSign}${jointDiff} | ${r.poolCoverage.toFixed(2)}%${poolSign}${poolDiff} | ${r.stableHitRate}% | ${r.stableTests}`
  );
});

// 找出最佳配置
const bestIdx = results.reduce((bestIdx, r, idx) => {
  return r.jointHitRate > results[bestIdx].jointHitRate ? idx : bestIdx;
}, 0);

const best = results[bestIdx];
console.log("\n" + "═".repeat(90));
console.log(`🏆 最佳配置: ${best.label}`);
console.log(`   Top5命中率: ${baseline.top5HitRate.toFixed(2)}% → ${best.top5HitRate.toFixed(2)}%（${(best.top5HitRate - baseline.top5HitRate) >= 0 ? "+" : ""}${(best.top5HitRate - baseline.top5HitRate).toFixed(2)}pp）`);
console.log(`   联合命中率: ${baseline.jointHitRate.toFixed(2)}% → ${best.jointHitRate.toFixed(2)}%（${(best.jointHitRate - baseline.jointHitRate) >= 0 ? "+" : ""}${(best.jointHitRate - baseline.jointHitRate).toFixed(2)}pp）`);
console.log(`   池覆盖率: ${baseline.poolCoverage.toFixed(2)}% → ${best.poolCoverage.toFixed(2)}%（${(best.poolCoverage - baseline.poolCoverage) >= 0 ? "+" : ""}${(best.poolCoverage - baseline.poolCoverage).toFixed(2)}pp）`);
console.log(`   稳定期命中率: ${best.stableHitRate}%`);

// 输出JSON报告
const report = {
  timestamp: new Date().toISOString(),
  testConfig: {
    testCount: TEST_COUNT,
    poolSize: V4_POOL_SIZE,
    dataRange: `${allDraws[0].issue} ~ ${allDraws[allDraws.length - 1].issue}`,
  },
  results: results.map(r => ({
    label: r.label,
    top5HitRate: r.top5HitRate,
    jointHitRate: r.jointHitRate,
    poolCoverage: r.poolCoverage,
    stableTests: r.stableTests,
    stableHitRate: r.stableHitRate,
  })),
  bestConfig: {
    label: best.label,
    top5HitRate: best.top5HitRate,
    jointHitRate: best.jointHitRate,
    poolCoverage: best.poolCoverage,
    stableHitRate: best.stableHitRate,
    top5Improvement: parseFloat((best.top5HitRate - baseline.top5HitRate).toFixed(2)),
    jointImprovement: parseFloat((best.jointHitRate - baseline.jointHitRate).toFixed(2)),
    poolImprovement: parseFloat((best.poolCoverage - baseline.poolCoverage).toFixed(2)),
  },
};

fs.writeFileSync(
  path.join(__dirname, 'analysis_output', 'interval_unchanged_tail_boost_report.json'),
  JSON.stringify(report, null, 2)
);

console.log("\n📁 报告已保存: analysis_output/interval_unchanged_tail_boost_report.json");
