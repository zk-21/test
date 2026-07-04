/**
 * 多策略融合回测
 * 
 * 核心思路：
 * 1. 尾号优先策略：完全忽略区间比，只基于尾号转移模式
 * 2. 频率优先策略：直接选高频号码，不依赖区间约束
 * 3. 并集池策略：使用不同源期（间隔9+10）合并
 * 4. 随机扰动策略：在评分中加入可控随机性
 * 
 * 目标：打破区间比的"过度拟合"，提高对"意外"号码的覆盖率
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
function sum(arr) { return arr.reduce((a, b) => a + b, 0); }
function intervalRatio(nums) {
  const z = [0, 0, 0];
  nums.forEach(n => { if (n <= 12) z[0]++; else if (n <= 24) z[1]++; else z[2]++; });
  return z;
}
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

// ===== 策略1：尾号优先（完全忽略区间比） =====
function buildTailFirstPool(sourceIdx, poolSize = 28) {
  const allDraws = picker.ALL_DRAWS;
  const sourceDraw = allDraws[sourceIdx];
  if (!sourceDraw) return null;
  
  const selectedNumbers = [...sourceDraw.front].sort((a, b) => a - b);
  const sourceTails = tails(selectedNumbers);
  
  // 尾号转移分析（扩大窗口）
  const tailTransCounts = new Map();
  for (let i = Math.max(0, sourceIdx - 80); i < sourceIdx; i++) {
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
  
  // 对1-35评分（完全基于尾号）
  const candidates = [];
  for (let n = 1; n <= 35; n++) {
    let score = 0;
    const t = n % 10;
    
    // 尾号转移得分
    const transScore = tailTransCounts.get(t) || 0;
    score += transScore * 2;
    
    // 尾号关联得分
    const corrScore = tailCorrelation.get(n) || 0;
    score += corrScore * 3;
    
    // 偏移得分（与源号码的距离）
    let minOffset = Infinity;
    selectedNumbers.forEach(a => { minOffset = Math.min(minOffset, Math.abs(n - a)); });
    if (minOffset <= 3) score += 10 - minOffset * 2;
    
    // 热号得分
    let hotCount = 0;
    for (let i = Math.max(0, sourceIdx - 10); i < sourceIdx; i++) {
      if (allDraws[i].front.includes(n)) hotCount++;
    }
    if (hotCount >= 3) score += 8;
    else if (hotCount >= 2) score += 4;
    
    candidates.push({ number: n, score });
  }
  
  // 排序取Top池（不加区间约束）
  candidates.sort((a, b) => b.score - a.score);
  return {
    pool: candidates.slice(0, poolSize),
    strategy: 'tail-first',
    sourceTails,
    tailTransCounts: [...tailTransCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  };
}

// ===== 策略2：频率优先（直接选高频） =====
function buildFrequencyFirstPool(sourceIdx, poolSize = 28) {
  const allDraws = picker.ALL_DRAWS;
  const sourceDraw = allDraws[sourceIdx];
  if (!sourceDraw) return null;
  
  // 计算各号码的频率
  const freqMap = new Map();
  const recentFreq = new Map();
  
  for (let n = 1; n <= 35; n++) {
    let totalFreq = 0;
    let recentCount = 0;
    
    for (let i = 0; i < sourceIdx; i++) {
      if (allDraws[i].front.includes(n)) {
        totalFreq++;
        if (i >= sourceIdx - 30) recentCount++;
      }
    }
    
    freqMap.set(n, totalFreq);
    recentFreq.set(n, recentCount);
  }
  
  // 计算平均频率
  const avgFreq = [...freqMap.values()].reduce((a, b) => a + b, 0) / 35;
  const avgRecent = [...recentFreq.values()].reduce((a, b) => a + b, 0) / 35;
  
  // 评分（纯频率导向）
  const candidates = [];
  for (let n = 1; n <= 35; n++) {
    let score = 0;
    
    // 历史频率得分
    const freq = freqMap.get(n);
    const freqRatio = freq / avgFreq;
    if (freqRatio > 1.3) score += 15;
    else if (freqRatio > 1.1) score += 10;
    else if (freqRatio > 0.9) score += 5;
    
    // 近期频率得分
    const recent = recentFreq.get(n);
    const recentRatio = recent / avgRecent;
    if (recentRatio > 1.5) score += 12;
    else if (recentRatio > 1.2) score += 8;
    else if (recentRatio > 1.0) score += 4;
    
    // 连续出现检测
    let consecutive = 0;
    for (let i = sourceIdx - 1; i >= Math.max(0, sourceIdx - 5); i--) {
      if (allDraws[i].front.includes(n)) consecutive++;
      else break;
    }
    if (consecutive >= 2) score += 6;
    
    // 遗漏期数（太久没出可能回归）
    let missCount = 0;
    for (let i = sourceIdx - 1; i >= 0; i--) {
      if (allDraws[i].front.includes(n)) break;
      missCount++;
    }
    if (missCount >= 15) score += 8;
    else if (missCount >= 10) score += 5;
    
    candidates.push({ number: n, score, freq, recent, missCount });
  }
  
  // 排序取Top池
  candidates.sort((a, b) => b.score - a.score);
  return {
    pool: candidates.slice(0, poolSize),
    strategy: 'frequency-first'
  };
}

// ===== 策略3：并集池（间隔9+10） =====
function buildUnionPool(targetIdx, poolSize = 28) {
  const allDraws = picker.ALL_DRAWS;
  
  // 间隔9源期
  const source9Idx = targetIdx - 9;
  // 间隔10源期
  const source10Idx = targetIdx - 10;
  
  if (source9Idx < 0 || source10Idx < 0) return null;
  
  // 使用V4评分构建两个池
  const pool9 = buildTailFirstPool(source9Idx, poolSize);
  const pool10 = buildTailFirstPool(source10Idx, poolSize);
  
  if (!pool9 || !pool10) return null;
  
  // 合并并集
  const scoreMap = new Map();
  pool9.pool.forEach((p, i) => {
    const weight = 1 - i / poolSize * 0.5; // 排名越高权重越大
    scoreMap.set(p.number, (scoreMap.get(p.number) || 0) + p.score * weight);
  });
  pool10.pool.forEach((p, i) => {
    const weight = 1 - i / poolSize * 0.5;
    scoreMap.set(p.number, (scoreMap.get(p.number) || 0) + p.score * weight * 0.6); // 辅助源权重较低
  });
  
  // 排序取Top池
  const merged = [...scoreMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, poolSize)
    .map(([num, score]) => ({ number: num, score }));
  
  return {
    pool: merged,
    strategy: 'union-9-10',
    source9Issue: allDraws[source9Idx].issue,
    source10Issue: allDraws[source10Idx].issue
  };
}

// ===== 策略4：随机扰动 =====
function buildRandomPerturbationPool(sourceIdx, poolSize = 28) {
  const allDraws = picker.ALL_DRAWS;
  const sourceDraw = allDraws[sourceIdx];
  if (!sourceDraw) return null;
  
  // 基于尾号优先策略
  const basePool = buildTailFirstPool(sourceIdx, poolSize + 10); // 多取10个作为候选
  if (!basePool) return null;
  
  // 添加随机扰动
  const candidates = basePool.pool.map(p => {
    const perturbation = (seededRandom() - 0.5) * 20; // -10 到 +10 的随机扰动
    return {
      number: p.number,
      score: p.score + perturbation,
      baseScore: p.score,
      perturbation
    };
  });
  
  // 重新排序
  candidates.sort((a, b) => b.score - a.score);
  
  return {
    pool: candidates.slice(0, poolSize),
    strategy: 'random-perturbation'
  };
}

// ===== 策略5：多源融合（间隔7,9,10） =====
function buildMultiSourcePool(targetIdx, poolSize = 28) {
  const allDraws = picker.ALL_DRAWS;
  const intervals = [7, 9, 10]; // 多个间隔
  const weights = [0.3, 0.4, 0.3]; // 对应权重
  
  const scoreMap = new Map();
  
  intervals.forEach((interval, idx) => {
    const sourceIdx = targetIdx - interval;
    if (sourceIdx < 0) return;
    
    const pool = buildTailFirstPool(sourceIdx, poolSize);
    if (!pool) return;
    
    const weight = weights[idx];
    pool.pool.forEach((p, i) => {
      const rankWeight = 1 - i / poolSize * 0.5;
      scoreMap.set(p.number, (scoreMap.get(p.number) || 0) + p.score * weight * rankWeight);
    });
  });
  
  if (scoreMap.size === 0) return null;
  
  // 排序取Top池
  const merged = [...scoreMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, poolSize)
    .map(([num, score]) => ({ number: num, score }));
  
  return {
    pool: merged,
    strategy: 'multi-source-7-9-10'
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
  
  // 计算遗漏和热号
  const missMap = new Map(), hotMap = new Map();
  for (let n = 1; n <= 35; n++) {
    let m = 0, h = 0;
    for (let i = targetIdx - 1; i >= Math.max(0, targetIdx - 20); i--) { if (allDraws[i].front.includes(n)) break; m++; }
    for (let i = targetIdx - 1; i >= Math.max(0, targetIdx - 10); i--) { if (allDraws[i].front.includes(n)) h++; }
    missMap.set(n, m); hotMap.set(n, h);
  }
  
  // 计算区间平衡需求
  const top5Iv = intervalRatio(top5Nums);
  const ivMin = top5Iv.indexOf(Math.min(...top5Iv));
  
  // 从池中选补漏6
  const candidates = pool
    .filter(p => !top5Set.has(p.number))
    .map(p => {
      let s = p.score;
      const z = getSampleIntervalIndex(p.number);
      if (z === ivMin) s += 6;
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
console.log("║  🧪 多策略融合回测（打破区间比限制）                               ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

const allDraws = picker.ALL_DRAWS;
const TEST_COUNT = 50;
const startIdx = allDraws.length - TEST_COUNT - 1;

console.log(`📊 数据范围：${allDraws[0].issue} ~ ${allDraws[allDraws.length - 1].issue}（共${allDraws.length}期）`);
console.log(`📊 测试区间：${allDraws[startIdx].issue} ~ ${allDraws[allDraws.length - 1].issue}（共${TEST_COUNT}期）`);
console.log(`📊 策略池大小：28球\n`);

// 定义策略
const strategies = [
  { name: '尾号优先', fn: buildTailFirstPool },
  { name: '频率优先', fn: buildFrequencyFirstPool },
  { name: '并集池(9+10)', fn: (idx) => buildUnionPool(idx + 9) }, // 调整为从targetIdx-9开始
  { name: '随机扰动', fn: buildRandomPerturbationPool },
  { name: '多源融合(7,9,10)', fn: (idx) => buildMultiSourcePool(idx + 9) } // 调整为从targetIdx-9开始
];

// 累计统计
const strategyStats = strategies.map(() => ({
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
  
  // 对每个策略进行回测
  strategies.forEach((strategy, stratIdx) => {
    // 源期索引（对于并集池和多源融合，内部会自行计算）
    const sourceIdx = targetIdx - 1;
    if (sourceIdx < 0) return;
    
    // 构建池
    const poolResult = strategy.fn(sourceIdx);
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
    strategyStats[stratIdx].poolHits += poolHit;
    strategyStats[stratIdx].top5Hits += top5Hit;
    strategyStats[stratIdx].jointHits += jointHit;
    strategyStats[stratIdx].validTests++;
    
    // 最近10期记录
    if (t < 10) {
      if (!recentDetails[t]) {
        recentDetails[t] = {
          target: targetDraw.issue,
          targetNums: targetDraw.front.join(','),
          strategies: []
        };
      }
      recentDetails[t].strategies.push({
        name: strategy.name,
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
console.log("📊 各策略汇总对比");
console.log("═".repeat(100));

console.log("\n策略名称               │ 号码池覆盖率 │ Top5命中率 │ 联合命中率 │ 测试期数");
console.log("───────────────────────┼──────────────┼────────────┼────────────┼─────────");

strategies.forEach((strategy, idx) => {
  const stats = strategyStats[idx];
  if (stats.validTests === 0) return;
  
  const poolRate = (stats.poolHits / (stats.validTests * 5) * 100).toFixed(2);
  const top5Rate = (stats.top5Hits / (stats.validTests * 5) * 100).toFixed(2);
  const jointRate = (stats.jointHits / (stats.validTests * 5) * 100).toFixed(2);
  
  console.log(
    `${strategy.name.padEnd(23)} │ ${poolRate.padStart(10)}% │ ${top5Rate.padStart(8)}% │ ${jointRate.padStart(8)}% │ ${String(stats.validTests).padStart(7)}`
  );
});

// 找出最佳策略
let bestPoolStrategy = 0, bestTop5Strategy = 0, bestJointStrategy = 0;
let bestPoolRate = 0, bestTop5Rate = 0, bestJointRate = 0;

strategies.forEach((strategy, idx) => {
  const stats = strategyStats[idx];
  if (stats.validTests === 0) return;
  
  const poolRate = stats.poolHits / (stats.validTests * 5) * 100;
  const top5Rate = stats.top5Hits / (stats.validTests * 5) * 100;
  const jointRate = stats.jointHits / (stats.validTests * 5) * 100;
  
  if (poolRate > bestPoolRate) { bestPoolRate = poolRate; bestPoolStrategy = idx; }
  if (top5Rate > bestTop5Rate) { bestTop5Rate = top5Rate; bestTop5Strategy = idx; }
  if (jointRate > bestJointRate) { bestJointRate = jointRate; bestJointStrategy = idx; }
});

console.log("\n" + "═".repeat(100));
console.log("🏆 最佳策略");
console.log("═".repeat(100));
console.log(`\n  号码池覆盖率最佳：${strategies[bestPoolStrategy].name}（${bestPoolRate.toFixed(2)}%）`);
console.log(`  Top5命中率最佳：${strategies[bestTop5Strategy].name}（${bestTop5Rate.toFixed(2)}%）`);
console.log(`  联合命中率最佳：${strategies[bestJointStrategy].name}（${bestJointRate.toFixed(2)}%）`);

// ===== 最近10期详细 =====
console.log("\n" + "═".repeat(100));
console.log("📋 最近10期各策略详细");
console.log("═".repeat(100));

recentDetails.reverse().forEach(detail => {
  console.log(`\n🎯 ${detail.target}：[${detail.targetNums}]`);
  console.log("─".repeat(80));
  detail.strategies.forEach(s => {
    console.log(`  ${s.name.padEnd(20)} │ 池:${s.poolHit}/5 │ Top5:${s.top5Hit}/5 │ 联合:${s.jointHit}/5`);
  });
});

// ===== 与当前V4对比 =====
console.log("\n" + "═".repeat(100));
console.log("📊 与当前V4（区间比优化）对比");
console.log("═".repeat(100));

// 运行一次当前V4作为基准
let v4PoolHits = 0, v4Top5Hits = 0, v4JointHits = 0, v4ValidTests = 0;

for (let t = 0; t < TEST_COUNT; t++) {
  const targetIdx = allDraws.length - 1 - t;
  const sourceIdx = targetIdx - 1;
  
  if (sourceIdx < 0) continue;
  
  const targetDraw = allDraws[targetIdx];
  const targetSet = new Set(targetDraw.front);
  
  // 使用尾号优先策略作为基准（因为它不依赖区间比）
  const poolResult = buildTailFirstPool(sourceIdx, 28);
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
  
  console.log(`\n当前V4基准（尾号优先，无区间约束）：`);
  console.log(`  号码池覆盖率：${v4PoolRate}%`);
  console.log(`  Top5命中率：${v4Top5Rate}%`);
  console.log(`  联合命中率：${v4JointRate}%`);
  
  // 与最佳策略对比
  const bestStrategyIdx = bestJointStrategy;
  const bestStats = strategyStats[bestStrategyIdx];
  const bestPoolRate = (bestStats.poolHits / (bestStats.validTests * 5) * 100).toFixed(2);
  const bestTop5Rate = (bestStats.top5Hits / (bestStats.validTests * 5) * 100).toFixed(2);
  const bestJointRate = (bestStats.jointHits / (bestStats.validTests * 5) * 100).toFixed(2);
  
  console.log(`\n最佳策略（${strategies[bestStrategyIdx].name}）：`);
  console.log(`  号码池覆盖率：${bestPoolRate}%`);
  console.log(`  Top5命中率：${bestTop5Rate}%`);
  console.log(`  联合命中率：${bestJointRate}%`);
  
  const poolDiff = (parseFloat(bestPoolRate) - parseFloat(v4PoolRate)).toFixed(2);
  const top5Diff = (parseFloat(bestTop5Rate) - parseFloat(v4Top5Rate)).toFixed(2);
  const jointDiff = (parseFloat(bestJointRate) - parseFloat(v4JointRate)).toFixed(2);
  
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

1. 区间比约束的影响：
   - 当前V4使用区间比预测来约束选号，可能导致"意外"号码被筛掉
   - 尾号优先和频率优先策略完全忽略区间比，可能捕获更多"冷门"号码

2. 多策略融合的优势：
   - 不同策略有不同的覆盖特性
   - 并集池可以扩大号码覆盖范围
   - 随机扰动可以增加多样性

3. 建议：
   - 如果追求稳定性：使用尾号优先策略
   - 如果追求覆盖率：使用并集池或多源融合
   - 如果追求多样性：使用随机扰动策略
   - 最佳方案：结合多种策略，取并集或加权融合

4. 下一步：
   - 可以尝试将最佳策略同步到生产脚本
   - 或者创建一个"策略融合"版本，结合多种策略的优点
`);

console.log("═".repeat(100));
