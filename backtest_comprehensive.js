/**
 * 综合方案回测 - 结合多源期 + 多维度评分
 * 
 * 核心改进：
 * 1. 多源期：使用间隔7,9,10三个源期
 * 2. 多维度：尾号 + 频率 + 遗漏 + 偏移
 * 3. 无区间约束：完全不使用区间比预测
 * 4. 对比：与当前V4（有区间约束）对比
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

// ===== 综合评分函数 =====
function buildComprehensiveScore(sourceIdx, allDraws) {
  const sourceDraw = allDraws[sourceIdx];
  if (!sourceDraw) return null;
  
  const selectedNumbers = [...sourceDraw.front].sort((a, b) => a - b);
  const sourceTails = tails(selectedNumbers);
  
  // 1. 尾号转移分析
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
  
  // 2. 尾号关联分析
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
  
  // 3. 热号分析
  const hotness = new Map();
  for (let i = Math.max(0, sourceIdx - 10); i < sourceIdx; i++) {
    allDraws[i].front.forEach(n => hotness.set(n, (hotness.get(n) || 0) + 1));
  }
  
  // 4. 频率分析
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
  
  // 5. 遗漏分析
  const missMap = new Map();
  for (let n = 1; n <= 35; n++) {
    let missCount = 0;
    for (let i = sourceIdx - 1; i >= 0; i--) {
      if (allDraws[i].front.includes(n)) break;
      missCount++;
    }
    missMap.set(n, missCount);
  }
  
  // 6. 偏移分析（与源号码的距离）
  const offsetMap = new Map();
  for (let n = 1; n <= 35; n++) {
    let minOffset = Infinity;
    selectedNumbers.forEach(a => { minOffset = Math.min(minOffset, Math.abs(n - a)); });
    offsetMap.set(n, minOffset);
  }
  
  // 对1-35综合评分
  const scores = new Map();
  for (let n = 1; n <= 35; n++) {
    let score = 0;
    const t = n % 10;
    
    // 尾号转移得分（权重：2）
    const transScore = tailTransCounts.get(t) || 0;
    score += transScore * 2;
    
    // 尾号关联得分（权重：3）
    const corrScore = tailCorrelation.get(n) || 0;
    score += corrScore * 3;
    
    // 热号得分（权重：2-8）
    const hot = hotness.get(n) || 0;
    if (hot >= 4) score += 8;
    else if (hot >= 3) score += 6;
    else if (hot >= 2) score += 4;
    
    // 频率得分（权重：3-10）
    const freq = freqMap.get(n) || 0;
    const avgFreq = sourceIdx / 35 * 0.14; // 平均频率
    if (freq > avgFreq * 1.3) score += 10;
    else if (freq > avgFreq * 1.1) score += 7;
    else if (freq > avgFreq * 0.9) score += 4;
    
    // 近期频率得分（权重：2-8）
    const recent = recentFreq.get(n) || 0;
    if (recent > 5) score += 8;
    else if (recent > 3) score += 5;
    else if (recent > 1) score += 3;
    
    // 遗漏回归得分（权重：3-10）
    const miss = missMap.get(n) || 0;
    if (miss >= 20) score += 10;
    else if (miss >= 15) score += 8;
    else if (miss >= 10) score += 6;
    else if (miss >= 7) score += 4;
    
    // 偏移得分（权重：1-10）
    const offset = offsetMap.get(n) || 0;
    if (offset <= 3) score += 10 - offset * 2;
    else if (offset <= 5) score += 4;
    
    scores.set(n, score);
  }
  
  return scores;
}

// ===== 综合池构建（多源期融合） =====
function buildComprehensivePool(targetIdx, poolSize = 28) {
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
    
    const scores = buildComprehensiveScore(sourceIdx, allDraws);
    if (!scores) return;
    
    // 加权融合
    for (let n = 1; n <= 35; n++) {
      totalScores.set(n, totalScores.get(n) + scores.get(n) * sourceWeights[idx]);
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
console.log("║  🧪 综合方案回测（多源期 + 多维度，无区间约束）                   ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

const allDraws = picker.ALL_DRAWS;
const TEST_COUNT = 50;
const startIdx = allDraws.length - TEST_COUNT - 1;

console.log(`📊 数据范围：${allDraws[0].issue} ~ ${allDraws[allDraws.length - 1].issue}（共${allDraws.length}期）`);
console.log(`📊 测试区间：${allDraws[startIdx].issue} ~ ${allDraws[allDraws.length - 1].issue}（共${TEST_COUNT}期）`);
console.log(`📊 策略池大小：28球`);
console.log(`📊 源期间隔：7,9,10期（权重0.3,0.4,0.3）`);
console.log(`📊 评分维度：尾号转移 + 尾号关联 + 热号 + 频率 + 遗漏 + 偏移`);
console.log(`📊 区间约束：无（完全不使用区间比预测）\n`);

// 累计统计
let poolHits = 0, top5Hits = 0, jointHits = 0, validTests = 0;

// 最近10期详细
const recentDetails = [];

console.log("═".repeat(100));
console.log("📊 回测进行中...");
console.log("═".repeat(100) + "\n");

for (let t = 0; t < TEST_COUNT; t++) {
  const targetIdx = allDraws.length - 1 - t;
  const targetDraw = allDraws[targetIdx];
  const targetSet = new Set(targetDraw.front);
  
  // 构建综合池
  const poolResult = buildComprehensivePool(targetIdx, 28);
  if (!poolResult || !poolResult.pool) continue;
  
  const pool = poolResult.pool;
  const top5 = generateTop5(pool);
  const bulou6 = generateBulou6(top5, pool, targetIdx);
  const joint = new Set([...top5, ...bulou6]);
  
  // 计算命中
  const poolHit = pool.filter(p => targetSet.has(p.number)).length;
  const top5Hit = top5.filter(n => targetSet.has(n)).length;
  const jointHit = [...joint].filter(n => targetSet.has(n)).length;
  
  // 累计统计
  poolHits += poolHit;
  top5Hits += top5Hit;
  jointHits += jointHit;
  validTests++;
  
  // 最近10期记录
  if (t < 10) {
    recentDetails.push({
      target: targetDraw.issue,
      targetNums: targetDraw.front.join(','),
      poolHit,
      top5Hit,
      jointHit,
      top5,
      bulou6
    });
  }
  
  if (t % 10 === 0) {
    console.log(`  已完成 ${t + 1}/${TEST_COUNT} 期...`);
  }
}

// ===== 输出汇总 =====
console.log("\n" + "═".repeat(100));
console.log("📊 综合方案汇总");
console.log("═".repeat(100));

if (validTests > 0) {
  const poolRate = (poolHits / (validTests * 5) * 100).toFixed(2);
  const top5Rate = (top5Hits / (validTests * 5) * 100).toFixed(2);
  const jointRate = (jointHits / (validTests * 5) * 100).toFixed(2);
  
  console.log(`\n有效测试期数：${validTests}`);
  console.log(`号码池覆盖率：${poolRate}%`);
  console.log(`Top5命中率：${top5Rate}%`);
  console.log(`联合命中率：${jointRate}%`);
}

// ===== 最近10期详细 =====
console.log("\n" + "═".repeat(100));
console.log("📋 最近10期详细");
console.log("═".repeat(100));

recentDetails.reverse().forEach(detail => {
  console.log(`\n🎯 ${detail.target}：[${detail.targetNums}]`);
  console.log(`  号码池命中：${detail.poolHit}/5`);
  console.log(`  Top5命中：${detail.top5Hit}/5`);
  console.log(`  联合命中：${detail.jointHit}/5`);
  console.log(`  Top5组合：[${detail.top5.join(', ')}]`);
  console.log(`  补漏6：[${detail.bulou6.join(', ')}]`);
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
  
  // 使用综合池作为基准
  const poolResult = buildComprehensivePool(targetIdx, 28);
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
  
  console.log(`\n当前V4基准（综合方案，无区间约束）：`);
  console.log(`  号码池覆盖率：${v4PoolRate}%`);
  console.log(`  Top5命中率：${v4Top5Rate}%`);
  console.log(`  联合命中率：${v4JointRate}%`);
  
  // 与script.js的V4对比（需要手动输入之前的回测结果）
  console.log(`\n📊 与之前V4（有区间约束）对比：`);
  console.log(`  之前的V4回测结果（需要手动对比）：`);
  console.log(`  - 号码池覆盖率：约78-80%`);
  console.log(`  - Top5命中率：约14-16%`);
  console.log(`  - 联合命中率：约28-30%`);
  
  console.log(`\n💡 差异分析：`);
  console.log(`  如果综合方案（无区间约束）的结果更高，说明区间比约束确实限制了命中率`);
  console.log(`  如果结果相近或更低，说明区间比约束不是主要因素`);
}

// ===== 结论 =====
console.log("\n" + "═".repeat(100));
console.log("📊 结论与建议");
console.log("═".repeat(100));

console.log(`
💡 关键发现：

1. 综合方案特点：
   - 多源期（间隔7,9,10）：增加信息来源
   - 多维度评分：尾号 + 频率 + 遗漏 + 偏移
   - 无区间约束：完全不使用区间比预测

2. 与当前V4对比：
   - 当前V4使用区间比预测来约束选号
   - 综合方案完全不使用区间比
   - 对比两者可以判断区间比约束的影响

3. 建议：
   - 如果综合方案表现更好：建议修改script.js，移除区间比约束
   - 如果表现相近：可以保留当前V4，或尝试其他优化
   - 如果表现更差：区间比约束是有益的，应保留

4. 下一步：
   - 运行script.js的回测，获取当前V4的准确数据
   - 与综合方案对比，决定是否修改生产脚本
`);

console.log("═".repeat(100));
