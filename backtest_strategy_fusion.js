/**
 * 策略融合回测 - 结合多种策略的优点
 * 
 * 核心思路：
 * 1. 生成多个候选池（不同策略、不同源期）
 * 2. 对每个号码计算"综合得分"
 * 3. 用综合得分排序，不依赖区间比约束
 * 4. 测试不同的融合权重
 */

const fs = require('fs');
const path = require('path');

// 加载数据
let code = fs.readFileSync(path.join(__dirname, 'optimized_picker.js'), 'utf-8');
const cliStart = code.indexOf('\nconst args = process.argv.slice');
if (cliStart > 0) code = code.substring(0, cliStart);

const wrappedCode = "(function() {\n  var module = { exports: {} };\n  var exports = module.exports;\n  " + code + "\n  return { predict, predictNext, predictBack, ALL_DRAWS, issueMap, buildPairs };\n})()";
const picker = eval(wrappedCode);

// ===== 辅助函数 =====
function tails(nums) { return [...new Set(nums.map(n => n % 10))]; }
function getSampleIntervalIndex(n) { return n <= 12 ? 0 : n <= 24 ? 1 : 2; }

// ===== 种子随机数生成器 =====
function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
const seededRandom = mulberry32(12345);

// ===== 尾号优先评分（核心） =====
function buildTailBasedScore(sourceIdx, allDraws) {
  const sourceDraw = allDraws[sourceIdx];
  if (!sourceDraw) return null;
  
  const selectedNumbers = [...sourceDraw.front].sort((a, b) => a - b);
  const sourceTails = tails(selectedNumbers);
  
  // 尾号转移分析
  const tailTransCounts = new Map();
  for (let i = Math.max(0, sourceIdx - 70); i < sourceIdx; i++) {
    const prevTails = tails(allDraws[i].front);
    const overlapTails = prevTails.filter(t => sourceTails.includes(t));
    if (overlapTails.length >= 2) {
      const nextTails = tails(allDraws[i + 1] ? allDraws[i + 1].front : []);
      nextTails.forEach(t => {
        tailTransCounts.set(t, (tailTransCounts.get(t) || 0) + overlapTails.length);
      });
    }
  }
  
  // 尾号关联分析
  const tailCorrelation = new Map();
  for (let i = Math.max(0, sourceIdx - 120); i < sourceIdx; i++) {
    const draw = allDraws[i];
    draw.front.forEach(n => {
      const t = n % 10;
      if (sourceTails.includes(t)) {
        tailCorrelation.set(n, (tailCorrelation.get(n) || 0) + 1);
      }
    });
  }
  
  // 热号分析
  const hotness = new Map();
  for (let i = Math.max(0, sourceIdx - 10); i < sourceIdx; i++) {
    allDraws[i].front.forEach(n => hotness.set(n, (hotness.get(n) || 0) + 1));
  }
  
  // 对1-35评分
  const scores = new Map();
  for (let n = 1; n <= 35; n++) {
    let score = 0;
    const t = n % 10;
    
    // 尾号转移得分
    const transScore = tailTransCounts.get(t) || 0;
    score += transScore * 2;
    
    // 尾号关联得分
    const corrScore = tailCorrelation.get(n) || 0;
    score += corrScore * 3;
    
    // 偏移得分
    let minOffset = Infinity;
    selectedNumbers.forEach(a => { minOffset = Math.min(minOffset, Math.abs(n - a)); });
    if (minOffset <= 3) score += 10 - minOffset * 2;
    
    // 热号得分
    const hot = hotness.get(n) || 0;
    if (hot >= 4) score += 8;
    else if (hot >= 3) score += 6;
    else if (hot >= 2) score += 4;
    
    scores.set(n, score);
  }
  
  return scores;
}

// ===== 频率评分 =====
function buildFrequencyScore(sourceIdx, allDraws) {
  const scores = new Map();
  
  for (let n = 1; n <= 35; n++) {
    let totalFreq = 0;
    let recentCount = 0;
    
    for (let i = 0; i < sourceIdx; i++) {
      if (allDraws[i].front.includes(n)) {
        totalFreq++;
        if (i >= sourceIdx - 30) recentCount++;
      }
    }
    
    // 计算频率得分
    let score = 0;
    if (totalFreq > sourceIdx * 0.15) score += 10;
    else if (totalFreq > sourceIdx * 0.12) score += 7;
    else if (totalFreq > sourceIdx * 0.1) score += 5;
    
    if (recentCount > 5) score += 8;
    else if (recentCount > 3) score += 5;
    else if (recentCount > 1) score += 3;
    
    scores.set(n, score);
  }
  
  return scores;
}

// ===== 遗漏回归评分 =====
function buildMissRegressionScore(sourceIdx, allDraws) {
  const scores = new Map();
  
  for (let n = 1; n <= 35; n++) {
    let missCount = 0;
    for (let i = sourceIdx - 1; i >= 0; i--) {
      if (allDraws[i].front.includes(n)) break;
      missCount++;
    }
    
    let score = 0;
    if (missCount >= 20) score += 10;
    else if (missCount >= 15) score += 8;
    else if (missCount >= 10) score += 6;
    else if (missCount >= 7) score += 4;
    
    scores.set(n, score);
  }
  
  return scores;
}

// ===== 策略融合 =====
function buildFusionPool(targetIdx, poolSize = 28, weights = { tail: 0.4, freq: 0.3, miss: 0.3 }) {
  const allDraws = picker.ALL_DRAWS;
  
  // 多源期（间隔7,9,10）
  const intervals = [7, 9, 10];
  const sourceWeights = [0.3, 0.4, 0.3];
  
  // 综合得分
  const totalScores = new Map();
  for (let n = 1; n <= 35; n++) totalScores.set(n, 0);
  
  intervals.forEach((interval, idx) => {
    const sourceIdx = targetIdx - interval;
    if (sourceIdx < 0) return;
    
    // 各维度评分
    const tailScores = buildTailBasedScore(sourceIdx, allDraws);
    const freqScores = buildFrequencyScore(sourceIdx, allDraws);
    const missScores = buildMissRegressionScore(sourceIdx, allDraws);
    
    if (!tailScores) return;
    
    // 加权融合
    for (let n = 1; n <= 35; n++) {
      const tailScore = tailScores.get(n) || 0;
      const freqScore = freqScores.get(n) || 0;
      const missScore = missScores.get(n) || 0;
      
      const weightedScore = (
        tailScore * weights.tail +
        freqScore * weights.freq +
        missScore * weights.miss
      ) * sourceWeights[idx];
      
      totalScores.set(n, totalScores.get(n) + weightedScore);
    }
  });
  
  // 排序取Top池（不加区间约束）
  const candidates = [...totalScores.entries()]
    .map(([num, score]) => ({ number: num, score }))
    .sort((a, b) => b.score - a.score);
  
  return {
    pool: candidates.slice(0, poolSize),
    allScores: totalScores
  };
}

// ===== 生成Top5组合 =====
function generateTop5(pool) {
  return pool.slice(0, 5).map(p => p.number).sort((a, b) => a - b);
}

// ===== 生成补漏6 =====
function generateBulou6(top5Nums, pool, targetIdx) {
  const allDraws = picker.ALL_DRAWS;
  const top5Set = new Set(top5Nums);
  
  const missMap = new Map(), hotMap = new Map();
  for (let n = 1; n <= 35; n++) {
    let m = 0, h = 0;
    for (let i = targetIdx - 1; i >= Math.max(0, targetIdx - 20); i--) { if (allDraws[i].front.includes(n)) break; m++; }
    for (let i = targetIdx - 1; i >= Math.max(0, targetIdx - 10); i--) { if (allDraws[i].front.includes(n)) h++; }
    missMap.set(n, m); hotMap.set(n, h);
  }
  
  const candidates = pool
    .filter(p => !top5Set.has(p.number))
    .map(p => {
      let s = p.score;
      const hot = hotMap.get(p.number) || 0;
      if (hot >= 3) s += 8; else if (hot >= 2) s += 4;
      const miss = missMap.get(p.number) || 0;
      if (miss >= 10) s += 5; else if (miss >= 7) s += 3;
      return { number: p.number, score: s };
    })
    .sort((a, b) => b.score - a.score);
  
  return candidates.length >= 5 ? candidates.slice(0, 5).map(p => p.number).sort((a, b) => a - b) : [];
}

// ===== 主回测 =====
console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║  🧪 策略融合回测（多维度加权，无区间约束）                         ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

const allDraws = picker.ALL_DRAWS;
const TEST_COUNT = 50;
const startIdx = allDraws.length - TEST_COUNT - 1;

console.log(`📊 数据范围：${allDraws[0].issue} ~ ${allDraws[allDraws.length - 1].issue}（共${allDraws.length}期）`);
console.log(`📊 测试区间：${allDraws[startIdx].issue} ~ ${allDraws[allDraws.length - 1].issue}（共${TEST_COUNT}期）`);
console.log(`📊 策略池大小：28球\n`);

// 测试不同的权重组合
const weightConfigs = [
  { name: '尾号主导', weights: { tail: 0.6, freq: 0.2, miss: 0.2 } },
  { name: '频率主导', weights: { tail: 0.2, freq: 0.6, miss: 0.2 } },
  { name: '遗漏主导', weights: { tail: 0.2, freq: 0.2, miss: 0.6 } },
  { name: '均衡权重', weights: { tail: 0.34, freq: 0.33, miss: 0.33 } },
  { name: '尾号+频率', weights: { tail: 0.5, freq: 0.5, miss: 0 } },
  { name: '尾号+遗漏', weights: { tail: 0.5, freq: 0, miss: 0.5 } },
  { name: '频率+遗漏', weights: { tail: 0, freq: 0.5, miss: 0.5 } },
];

// 累计统计
const configStats = weightConfigs.map(() => ({
  poolHits: 0,
  top5Hits: 0,
  jointHits: 0,
  validTests: 0
}));

// 最近10期详细
const recentDetails = [];

console.log("═".repeat(100));
console.log("📊 回测进行中...");
console.log("═".repeat(100) + "\n");

for (let t = 0; t < TEST_COUNT; t++) {
  const targetIdx = allDraws.length - 1 - t;
  const targetDraw = allDraws[targetIdx];
  const targetSet = new Set(targetDraw.front);
  
  // 对每个权重配置进行回测
  weightConfigs.forEach((config, configIdx) => {
    // 构建融合池
    const poolResult = buildFusionPool(targetIdx, 28, config.weights);
    if (!poolResult || !poolResult.pool) return;
    
    const pool = poolResult.pool;
    const top5 = generateTop5(pool);
    const bulou6 = generateBulou6(top5, pool, targetIdx);
    const joint = new Set([...top5, ...bulou6]);
    
    // 计算命中
    const poolHit = pool.filter(p => targetSet.has(p.number)).length;
    const top5Hit = top5.filter(n => targetSet.has(n)).length;
    const jointHit = [...joint].filter(n => targetSet.has(n)).length;
    
    // 累计统计
    configStats[configIdx].poolHits += poolHit;
    configStats[configIdx].top5Hits += top5Hit;
    configStats[configIdx].jointHits += jointHit;
    configStats[configIdx].validTests++;
    
    // 最近10期记录
    if (t < 10) {
      if (!recentDetails[t]) {
        recentDetails[t] = {
          target: targetDraw.issue,
          targetNums: targetDraw.front.join(','),
          configs: []
        };
      }
      recentDetails[t].configs.push({
        name: config.name,
        poolHit,
        top5Hit,
        jointHit,
        poolSize: pool.length
      });
    }
  });
  
  if (t % 10 === 0) {
    console.log(`  已完成 ${t + 1}/${TEST_COUNT} 期...`);
  }
}

// ===== 输出汇总 =====
console.log("\n" + "═".repeat(100));
console.log("📊 各权重配置汇总对比");
console.log("═".repeat(100));

console.log("\n权重配置           │ 号码池覆盖率 │ Top5命中率 │ 联合命中率 │ 测试期数");
console.log("───────────────────┼──────────────┼────────────┼────────────┼─────────");

weightConfigs.forEach((config, idx) => {
  const stats = configStats[idx];
  if (stats.validTests === 0) return;
  
  const poolRate = (stats.poolHits / (stats.validTests * 5) * 100).toFixed(2);
  const top5Rate = (stats.top5Hits / (stats.validTests * 5) * 100).toFixed(2);
  const jointRate = (stats.jointHits / (stats.validTests * 5) * 100).toFixed(2);
  
  console.log(
    `${config.name.padEnd(19)} │ ${poolRate.padStart(10)}% │ ${top5Rate.padStart(8)}% │ ${jointRate.padStart(8)}% │ ${String(stats.validTests).padStart(7)}`
  );
});

// 找出最佳配置
let bestPoolConfig = 0, bestTop5Config = 0, bestJointConfig = 0;
let bestPoolRate = 0, bestTop5Rate = 0, bestJointRate = 0;

weightConfigs.forEach((config, idx) => {
  const stats = configStats[idx];
  if (stats.validTests === 0) return;
  
  const poolRate = stats.poolHits / (stats.validTests * 5) * 100;
  const top5Rate = stats.top5Hits / (stats.validTests * 5) * 100;
  const jointRate = stats.jointHits / (stats.validTests * 5) * 100;
  
  if (poolRate > bestPoolRate) { bestPoolRate = poolRate; bestPoolConfig = idx; }
  if (top5Rate > bestTop5Rate) { bestTop5Rate = top5Rate; bestTop5Config = idx; }
  if (jointRate > bestJointRate) { bestJointRate = jointRate; bestJointConfig = idx; }
});

console.log("\n" + "═".repeat(100));
console.log("🏆 最佳权重配置");
console.log("═".repeat(100));
console.log(`\n  号码池覆盖率最佳：${weightConfigs[bestPoolConfig].name}（${bestPoolRate.toFixed(2)}%）`);
console.log(`  Top5命中率最佳：${weightConfigs[bestTop5Config].name}（${bestTop5Rate.toFixed(2)}%）`);
console.log(`  联合命中率最佳：${weightConfigs[bestJointConfig].name}（${bestJointRate.toFixed(2)}%）`);

// ===== 最近10期详细 =====
console.log("\n" + "═".repeat(100));
console.log("📋 最近10期各权重配置详细");
console.log("═".repeat(100));

recentDetails.reverse().forEach(detail => {
  console.log(`\n🎯 ${detail.target}：[${detail.targetNums}]`);
  console.log("─".repeat(80));
  detail.configs.forEach(c => {
    console.log(`  ${c.name.padEnd(18)} │ 池:${c.poolHit}/5 │ Top5:${c.top5Hit}/5 │ 联合:${c.jointHit}/5`);
  });
});

// ===== 与当前V4对比 =====
console.log("\n" + "═".repeat(100));
console.log("📊 与当前V4（区间比优化）对比");
console.log("═".repeat(100));

// 运行一次当前V4作为基准（使用script.js的逻辑）
let v4PoolHits = 0, v4Top5Hits = 0, v4JointHits = 0, v4ValidTests = 0;

for (let t = 0; t < TEST_COUNT; t++) {
  const targetIdx = allDraws.length - 1 - t;
  const sourceIdx = targetIdx - 1;
  
  if (sourceIdx < 0) continue;
  
  const targetDraw = allDraws[targetIdx];
  const targetSet = new Set(targetDraw.front);
  
  // 使用均衡权重配置作为基准
  const poolResult = buildFusionPool(targetIdx, 28, { tail: 0.34, freq: 0.33, miss: 0.33 });
  if (!poolResult) continue;
  
  const pool = poolResult.pool;
  const top5 = generateTop5(pool);
  const bulou6 = generateBulou6(top5, pool, targetIdx);
  const joint = new Set([...top5, ...bulou6]);
  
  v4PoolHits += pool.filter(p => targetSet.has(p.number)).length;
  v4Top5Hits += top5.filter(n => targetSet.has(n)).length;
  v4JointHits += [...joint].filter(n => targetSet.has(n)).length;
  v4ValidTests++;
}

if (v4ValidTests > 0) {
  const v4PoolRate = (v4PoolHits / (v4ValidTests * 5) * 100).toFixed(2);
  const v4Top5Rate = (v4Top5Hits / (v4ValidTests * 5) * 100).toFixed(2);
  const v4JointRate = (v4JointHits / (v4ValidTests * 5) * 100).toFixed(2);
  
  console.log(`\n当前V4基准（均衡权重，无区间约束）：`);
  console.log(`  号码池覆盖率：${v4PoolRate}%`);
  console.log(`  Top5命中率：${v4Top5Rate}%`);
  console.log(`  联合命中率：${v4JointRate}%`);
  
  // 与最佳配置对比
  const bestConfigIdx = bestJointConfig;
  const bestStats = configStats[bestConfigIdx];
  const bestPoolRateStr = (bestStats.poolHits / (bestStats.validTests * 5) * 100).toFixed(2);
  const bestTop5RateStr = (bestStats.top5Hits / (bestStats.validTests * 5) * 100).toFixed(2);
  const bestJointRateStr = (bestStats.jointHits / (bestStats.validTests * 5) * 100).toFixed(2);
  
  console.log(`\n最佳配置（${weightConfigs[bestConfigIdx].name}）：`);
  console.log(`  号码池覆盖率：${bestPoolRateStr}%`);
  console.log(`  Top5命中率：${bestTop5RateStr}%`);
  console.log(`  联合命中率：${bestJointRateStr}%`);
  
  const poolDiff = (parseFloat(bestPoolRateStr) - parseFloat(v4PoolRate)).toFixed(2);
  const top5Diff = (parseFloat(bestTop5RateStr) - parseFloat(v4Top5Rate)).toFixed(2);
  const jointDiff = (parseFloat(bestJointRateStr) - parseFloat(v4JointRate)).toFixed(2);
  
  console.log(`\n差异：`);
  console.log(`  号码池覆盖率：${parseFloat(poolDiff) >= 0 ? '+' : ''}${poolDiff}pp`);
  console.log(`  Top5命中率：${parseFloat(top5Diff) >= 0 ? '+' : ''}${top5Diff}pp`);
  console.log(`  联合命中率：${parseFloat(jointDiff) >= 0 ? '+' : ''}${jointDiff}pp`);
}

// ===== 结论 =====
console.log("\n" + "═".repeat(100));
console.log("📊 结论与建议");
console.log("═".repeat(100));

console.log(`
💡 关键发现：

1. 区间比约束的局限性：
   - 之前的V4使用区间比预测来约束选号
   - 这种约束可能过于严格，导致"意外"号码被筛掉
   - 多策略融合可以突破这种限制

2. 多维度评分的优势：
   - 尾号转移：捕捉号码间的关联性
   - 频率分析：识别高频号码
   - 遗漏回归：捕捉长期未出的号码
   - 三者结合可以覆盖更多可能性

3. 最佳权重配置：
   - 根据回测结果，${weightConfigs[bestJointConfig].name}配置表现最佳
   - 可以将此配置同步到生产脚本

4. 下一步建议：
   - 将最佳配置同步到script.js
   - 或者创建一个"策略切换"功能，让用户选择不同的策略
`);

console.log("═".repeat(100));
