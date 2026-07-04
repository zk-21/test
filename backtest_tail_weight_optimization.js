/**
 * backtest_tail_weight_optimization.js — 尾号权重优化测试
 * 
 * 测试两个环节的尾号权重优化：
 * 1. 组合评分中的尾号匹配权重（当前: +3/匹配）
 * 2. 补漏6中的尾号匹配权重（当前: +10）
 * 
 * 运行：node backtest_tail_weight_optimization.js
 */

const fs = require('fs');
const path = require('path');

// 加载数据
let code = fs.readFileSync(path.join(__dirname, 'optimized_picker.js'), 'utf-8');
const cliStart = code.indexOf('\nconst args = process.argv.slice');
if (cliStart > 0) code = code.substring(0, cliStart);

const wrappedCode = "(function() {\n  var module = { exports: {} };\n  var exports = module.exports;\n  " + code + "\n  return { predict, predictNext, predictBack, ALL_DRAWS, issueMap, buildPairs };\n})()";
const picker = eval(wrappedCode);

// ===== V4评分常量（与script.js一致）=====
const V4_OFFSET_SCORE = { 0:20, 1:15, 2:13, 3:12, 4:10, 5:8, 6:6, 7:5, 8:4, 9:3, 10:2 };
const V4_TAIL_SAME = 35, V4_TAIL_NEIGHBOR = 15, V4_TAIL_WITHIN = 8;
const V4_POOL_SIZE = 26;
const V4_HISTORY_FREQ_WEIGHT = 0.15;
const V4_RECENT_FREQ_WEIGHT = 0.10;
const V4_REPEAT_RATE_WEIGHT = 0.05;

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

// ===== 核心：buildSampleNumbersV4 简化版 =====
function buildV4Pool(sourceIdx, hotWindow = 10, trendWindow = 50) {
  const allDraws = picker.ALL_DRAWS;
  const sourceDraw = allDraws[sourceIdx];
  if (!sourceDraw) return null;
  
  const selectedNumbers = [...sourceDraw.front].sort((a, b) => a - b);
  const sourceTails = tails(selectedNumbers);
  
  // 预处理映射
  const bridgeMap = buildBridgeMap(selectedNumbers);
  const arithMap = buildArithmeticMap(selectedNumbers);
  const plusTenTrend = buildPlusTenTrendMap(sourceIdx, trendWindow, allDraws);
  
  // 热号
  const hotness = new Map();
  for (let i = Math.max(0, sourceIdx - hotWindow); i < sourceIdx; i++) {
    allDraws[i].front.forEach(n => hotness.set(n, (hotness.get(n) || 0) + 1));
  }
  
  // 归一化参考值
  const maxPlusTen = Math.max(1, ...[...plusTenTrend.targetMap.values()]);
  const maxBridge = Math.max(1,
    ...[...bridgeMap.gapMap.values()].map(v => v.score),
    ...[...bridgeMap.endpointMap.values()].map(v => v.score)
  );
  const maxArith = Math.max(1, ...[...arithMap.values()].map(v => v.score));
  
  // 历史频率
  const historyFreq = new Map(), recentFreq = new Map(), repeatRate = new Map();
  for (let n = 1; n <= 35; n++) {
    let hf = 0, rf = 0, rr = 0;
    for (let i = 0; i < sourceIdx; i++) {
      if (allDraws[i].front.includes(n)) {
        hf++;
        if (i >= sourceIdx - 30) rf++;
      }
    }
    for (let i = 0; i < sourceIdx - 1; i++) {
      if (allDraws[i].front.includes(n) && allDraws[i + 1].front.includes(n)) rr++;
    }
    historyFreq.set(n, hf);
    recentFreq.set(n, rf);
    repeatRate.set(n, rr);
  }
  const avgHF = [...historyFreq.values()].reduce((a, b) => a + b, 0) / 35;
  const avgRF = [...recentFreq.values()].reduce((a, b) => a + b, 0) / 35;
  const avgRR = [...repeatRate.values()].reduce((a, b) => a + b, 0) / 35;
  
  // 尾号转移分析
  const tailTransCounts = new Map();
  for (let i = Math.max(0, sourceIdx - 50); i < sourceIdx; i++) {
    const prevTails = tails(allDraws[i].front);
    const overlapTails = prevTails.filter(t => sourceTails.includes(t));
    if (overlapTails.length >= 2) {
      const nextTails = tails(allDraws[i + 1] ? allDraws[i + 1].front : []);
      nextTails.forEach(t => {
        tailTransCounts.set(t, (tailTransCounts.get(t) || 0) + overlapTails.length);
      });
    }
  }
  const predictedTails = [...tailTransCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
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
    
    // +10期趋势
    const ptScore = plusTenTrend.targetMap.get(n) || 0;
    if (ptScore > 0) score += Math.round(ptScore / maxPlusTen * 30);
    const ptNb = plusTenTrend.neighborMap.get(n) || 0;
    if (ptNb > 0) score += Math.round(ptNb / maxPlusTen * 6);
    
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
    
    // 历史频率评分
    const hf = historyFreq.get(n) || 0;
    const rf = recentFreq.get(n) || 0;
    const rr = repeatRate.get(n) || 0;
    const hRatio = avgHF > 0 ? hf / avgHF : 1;
    const rRatio = avgRF > 0 ? rf / avgRF : 1;
    const rrRatio = avgRR > 0 ? rr / avgRR : 1;
    if (hRatio > 1.2) score += Math.round((hRatio - 1) * 15 * V4_HISTORY_FREQ_WEIGHT);
    if (rRatio > 1.3) score += Math.round((rRatio - 1) * 10 * V4_RECENT_FREQ_WEIGHT);
    if (rrRatio > 1.2) score += Math.round((rrRatio - 1) * 8 * V4_REPEAT_RATE_WEIGHT);
    
    // 区间平衡
    const srcIv = intervalRatio(selectedNumbers);
    const z = getSampleIntervalIndex(n);
    if (srcIv[z] < Math.max(...srcIv)) score += 2;
    
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
    sourceTails,
    selectedNumbers,
  };
}

// ===== 辅助分析函数 =====
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

function buildPlusTenTrendMap(srcIdx, window, allDraws) {
  const targetMap = new Map(), neighborMap = new Map();
  const end = Math.min(allDraws.length - 1, srcIdx + window);
  for (let i = srcIdx + 1; i <= end; i++) {
    const d = allDraws[i];
    if (!d) continue;
    d.front.forEach(n => {
      targetMap.set(n, (targetMap.get(n) || 0) + 1);
      [-1, 1].forEach(dn => {
        const nb = n + dn;
        if (nb >= 1 && nb <= 35) neighborMap.set(nb, (neighborMap.get(nb) || 0) + 1);
      });
    });
  }
  return { targetMap, neighborMap };
}

// ===== 并集池合并 =====
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
  
  return {
    pool: merged,
    candidateEntries: merged,
  };
}

// ===== 带权重的组合生成（考虑尾号匹配）=====
function generateTopCombosWithTailWeight(pool, pickCount = 5, comboTailWeight = 3, predictedTails = []) {
  // 简化版：直接取Top5，但用尾号权重调整分数
  const predTailsSet = new Set(predictedTails.slice(0, 5).map(([t]) => t));
  
  const adjusted = pool.map(e => {
    let adjustedScore = e.score;
    if (predTailsSet.has(e.number % 10)) {
      adjustedScore += comboTailWeight; // 尾号匹配加分
    }
    return { ...e, adjustedScore };
  });
  
  adjusted.sort((a, b) => b.adjustedScore - a.adjustedScore);
  return adjusted.slice(0, pickCount).map(e => e.number);
}

// ===== 带权重的补漏6生成 =====
function generateBulou6WithWeight(top5Nums, pool, srcIdx, predictedTails, bulou6TailWeight = 10) {
  const allDraws = picker.ALL_DRAWS;
  const top5Set = new Set(top5Nums);
  
  const missMap = new Map(), hotMap = new Map();
  for (let n = 1; n <= 35; n++) {
    let m = 0, h = 0;
    for (let i = srcIdx - 1; i >= Math.max(0, srcIdx - 20); i--) { if (allDraws[i].front.includes(n)) break; m++; }
    for (let i = srcIdx - 1; i >= Math.max(0, srcIdx - 10); i--) { if (allDraws[i].front.includes(n)) h++; }
    missMap.set(n, m); hotMap.set(n, h);
  }
  
  const top5Iv = intervalRatio(top5Nums);
  const ivMin = top5Iv.indexOf(Math.min(...top5Iv));
  const predTails = predictedTails ? new Set(predictedTails.slice(0, 5).map(([t]) => t)) : new Set();
  
  const scored = pool
    .filter(e => !top5Set.has(e.number))
    .map(e => {
      const n = e.number;
      let s = e.score;
      if (predTails.has(n % 10)) s += bulou6TailWeight; // 可调权重
      const z = getSampleIntervalIndex(n);
      if (z === ivMin) s += 6;
      const hot = hotMap.get(n) || 0;
      if (hot >= 3) s += 8; else if (hot >= 2) s += 4;
      const miss = missMap.get(n) || 0;
      if (miss >= 10) s += 5; else if (miss >= 7) s += 3;
      s += 25;
      let md = Infinity; top5Nums.forEach(cn => { const d = Math.abs(n - cn); if (d < md) md = d; });
      if (md === 1) s += 12; else if (md === 2) s += 6; else if (md === 3) s += 3;
      return { number: n, score: s };
    })
    .sort((a, b) => b.score - a.score);
  
  return scored.length >= 5 ? scored.slice(0, 5).map(e => e.number).sort((a, b) => a - b) : [];
}

// ===== 主回测 =====
console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║  🧪 尾号权重优化测试（组合评分 + 补漏6）                          ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

const allDraws = picker.ALL_DRAWS;
const TEST_COUNT = 50;
const startIdx = allDraws.length - TEST_COUNT - 1;

console.log(`📊 数据范围：${allDraws[0].issue} ~ ${allDraws[allDraws.length - 1].issue}（共${allDraws.length}期）`);
console.log(`📊 测试区间：${allDraws[startIdx].issue} ~ ${allDraws[allDraws.length - 1].issue}（共${TEST_COUNT}期）`);
console.log(`📊 候选池大小：${V4_POOL_SIZE}球\n`);

// 测试参数组合
const testConfigs = [
  // 基准（当前参数）
  { comboTailWeight: 3, bulou6TailWeight: 10, label: "基准(3/10)" },
  
  // 组合评分尾号权重测试
  { comboTailWeight: 2, bulou6TailWeight: 10, label: "组合×2(2/10)" },
  { comboTailWeight: 4, bulou6TailWeight: 10, label: "组合×4(4/10)" },
  { comboTailWeight: 5, bulou6TailWeight: 10, label: "组合×5(5/10)" },
  { comboTailWeight: 6, bulou6TailWeight: 10, label: "组合×6(6/10)" },
  
  // 补漏6尾号权重测试
  { comboTailWeight: 3, bulou6TailWeight: 5,  label: "补漏×5(3/5)" },
  { comboTailWeight: 3, bulou6TailWeight: 8,  label: "补漏×8(3/8)" },
  { comboTailWeight: 3, bulou6TailWeight: 15, label: "补漏×15(3/15)" },
  { comboTailWeight: 3, bulou6TailWeight: 20, label: "补漏×20(3/20)" },
  
  // 组合优化
  { comboTailWeight: 4, bulou6TailWeight: 8,  label: "组合4/补漏8" },
  { comboTailWeight: 5, bulou6TailWeight: 8,  label: "组合5/补漏8" },
  { comboTailWeight: 4, bulou6TailWeight: 15, label: "组合4/补漏15" },
];

// 运行所有配置
const results = [];

for (const config of testConfigs) {
  let totalHits = 0;
  let totalJointHits = 0;
  let totalPoolHits = 0;
  let validTests = 0;
  
  for (let t = 0; t < TEST_COUNT; t++) {
    const targetIdx = allDraws.length - 1 - t;
    const sourceIdx = targetIdx - 1;
    const source2Idx = sourceIdx - 1;
    
    if (sourceIdx < 0 || source2Idx < 0) continue;
    
    const targetDraw = allDraws[targetIdx];
    const targetSet = new Set(targetDraw.front);
    
    // 构建并集池
    const mainPool = buildV4Pool(sourceIdx);
    const auxPool = buildV4Pool(source2Idx);
    if (!mainPool || !auxPool) continue;
    
    const merged = mergePools(mainPool, auxPool, 0.7, 0.3);
    
    // 使用带权重的组合生成
    const top5 = generateTopCombosWithTailWeight(
      merged.pool, 5, config.comboTailWeight, mainPool.predictedTails
    );
    
    // 使用带权重的补漏6
    const bulou6 = generateBulou6WithWeight(
      top5, merged.pool, targetIdx, mainPool.predictedTails, config.bulou6TailWeight
    );
    
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
    label: config.label,
    comboTailWeight: config.comboTailWeight,
    bulou6TailWeight: config.bulou6TailWeight,
    top5HitRate: parseFloat(avgHit),
    jointHitRate: parseFloat(avgJoint),
    poolCoverage: parseFloat(avgPool),
    avgTop5Hits: (totalHits / validTests).toFixed(2),
    avgJointHits: (totalJointHits / validTests).toFixed(2),
  });
}

// 输出结果
console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║                        📊 回测结果对比                              ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

// 按联合命中率排序
results.sort((a, b) => b.jointHitRate - a.jointHitRate);

console.log("排名 | 配置              | 组合权重 | 补漏权重 | Top5命中率 | 联合命中率 | 池覆盖率");
console.log("─".repeat(85));

const baseline = results.find(r => r.label === "基准(3/10)");

results.forEach((r, i) => {
  const top5Diff = (r.top5HitRate - baseline.top5HitRate).toFixed(2);
  const jointDiff = (r.jointHitRate - baseline.jointHitRate).toFixed(2);
  const poolDiff = (r.poolCoverage - baseline.poolCoverage).toFixed(2);
  
  const top5Sign = parseFloat(top5Diff) >= 0 ? "+" : "";
  const jointSign = parseFloat(jointDiff) >= 0 ? "+" : "";
  const poolSign = parseFloat(poolDiff) >= 0 ? "+" : "";
  
  console.log(
    `${String(i + 1).padStart(2)}   | ${r.label.padEnd(17)} | ${String(r.comboTailWeight).padStart(6)}   | ${String(r.bulou6TailWeight).padStart(6)}   | ${r.top5HitRate.toFixed(2)}%${top5Sign}${top5Diff} | ${r.jointHitRate.toFixed(2)}%${jointSign}${jointDiff} | ${r.poolCoverage.toFixed(2)}%${poolSign}${poolDiff}`
  );
});

// 最佳配置
const best = results[0];
console.log("\n" + "═".repeat(85));
console.log(`🏆 最佳配置: ${best.label}`);
console.log(`   组合评分尾号权重: ${best.comboTailWeight}（基准: 3）`);
console.log(`   补漏6尾号权重: ${best.bulou6TailWeight}（基准: 10）`);
console.log(`   Top5命中率: ${best.top5HitRate.toFixed(2)}%（基准: ${baseline.top5HitRate.toFixed(2)}%）`);
console.log(`   联合命中率: ${best.jointHitRate.toFixed(2)}%（基准: ${baseline.jointHitRate.toFixed(2)}%）`);
console.log(`   提升: ${(best.jointHitRate - baseline.jointHitRate).toFixed(2)}pp`);

// 生成优化建议
console.log("\n" + "═".repeat(85));
console.log("📋 优化建议：");

if (best.comboTailWeight !== 3) {
  console.log(`1. 组合评分尾号权重: ${best.comboTailWeight > 3 ? "可提升" : "可降低"}至 ${best.comboTailWeight}`);
}

if (best.bulou6TailWeight !== 10) {
  console.log(`2. 补漏6尾号权重: ${best.bulou6TailWeight > 10 ? "可提升" : "可降低"}至 ${best.bulou6TailWeight}`);
}

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
    comboTailWeight: best.comboTailWeight,
    bulou6TailWeight: best.bulou6TailWeight,
    top5HitRate: best.top5HitRate,
    jointHitRate: best.jointHitRate,
    improvement: parseFloat((best.jointHitRate - baseline.jointHitRate).toFixed(2)),
  },
};

fs.writeFileSync(
  path.join(__dirname, 'analysis_output', 'tail_weight_optimization_report.json'),
  JSON.stringify(report, null, 2)
);

console.log("\n📁 报告已保存: analysis_output/tail_weight_optimization_report.json");
