// 快速回测脚本 - 只运行前20对进行验证
const fs = require('fs');

// 读取并执行optimized_picker.js，但不触发回测
const content = fs.readFileSync('./optimized_picker.js', 'utf-8');

// 提取ALL_DRAWS数据
const allDrawsMatch = content.match(/const ALL_DRAWS\s*=\s*(\[[\s\S]*?\]);/);
if (!allDrawsMatch) {
  console.error('无法找到ALL_DRAWS数据');
  process.exit(1);
}

const ALL_DRAWS = eval(allDrawsMatch[1]);
console.log(`加载了 ${ALL_DRAWS.length} 期数据`);

// 计算历史频率指标
function calculateHistoryMetrics() {
  const totalDraws = ALL_DRAWS.length;
  
  const historyFreq = new Array(36).fill(0);
  ALL_DRAWS.forEach(d => d.front.forEach(n => historyFreq[n]++));
  
  const recentWindow = 20;
  const recentFreq = new Array(36).fill(0);
  ALL_DRAWS.slice(-recentWindow).forEach(d => d.front.forEach(n => recentFreq[n]++));
  
  const repeatRate = new Array(36).fill(0);
  let repeatCount = 0;
  for (let i = 0; i < ALL_DRAWS.length - 10; i++) {
    const source = ALL_DRAWS[i].front;
    const target = ALL_DRAWS[i + 10].front;
    const targetSet = new Set(target);
    source.forEach(n => {
      if (targetSet.has(n)) {
        repeatRate[n]++;
        repeatCount++;
      }
    });
  }
  const repeatPairs = ALL_DRAWS.length - 10;
  const normalizedRepeatRate = repeatRate.map(count => count / repeatPairs);
  
  const avgHistoryFreq = historyFreq.reduce((a, b) => a + b, 0) / 35;
  const avgRecentFreq = recentFreq.reduce((a, b) => a + b, 0) / 35;
  const avgRepeatRate = normalizedRepeatRate.reduce((a, b) => a + b, 0) / 35;
  
  return {
    historyFreq,
    recentFreq,
    normalizedRepeatRate,
    avgHistoryFreq,
    avgRecentFreq,
    avgRepeatRate,
    totalDraws,
    recentWindow,
    repeatPairs
  };
}

const historyMetrics = calculateHistoryMetrics();

// 简化的回测逻辑
console.log('\n=== 快速回测验证（前20对）===');

let totalHits = 0;
let totalBalls = 0;
let totalCoverage = 0;
const pairs = [];

for (let i = 0; i < Math.min(20, ALL_DRAWS.length - 10); i++) {
  const source = ALL_DRAWS[i];
  const target = ALL_DRAWS[i + 10];
  const targetSet = new Set(target.front);
  
  // 模拟选号策略（简化版）
  const pool = new Set();
  source.front.forEach(n => {
    pool.add(n);
    for (let d = 1; d <= 5; d++) {
      if (n - d >= 1) pool.add(n - d);
      if (n + d <= 35) pool.add(n + d);
    }
  });
  
  // 添加历史频率高的号码
  const poolArray = [...pool];
  const scored = poolArray.map(n => {
    let score = 0;
    const historyFreq = historyMetrics.historyFreq[n] || 0;
    const recentFreq = historyMetrics.recentFreq[n] || 0;
    const repeatRate = historyMetrics.normalizedRepeatRate[n] || 0;
    
    // 历史频率加分
    if (historyFreq > historyMetrics.avgHistoryFreq * 1.2) {
      score += Math.round((historyFreq / historyMetrics.avgHistoryFreq - 1) * 15 * 0.15);
    }
    
    // 近期频率加分
    if (recentFreq > historyMetrics.avgRecentFreq * 1.3) {
      score += Math.round((recentFreq / historyMetrics.avgRecentFreq - 1) * 10 * 0.10);
    }
    
    // 重复率加分
    if (repeatRate > historyMetrics.avgRepeatRate * 1.2) {
      score += Math.round((repeatRate / historyMetrics.avgRepeatRate - 1) * 8 * 0.05);
    }
    
    return { number: n, score };
  });
  
  // 按分数排序，取前28个（新的池大小）
  const sortedPool = scored.sort((a, b) => b.score - a.score).slice(0, 28);
  const poolNumbers = sortedPool.map(e => e.number);
  
  // 计算覆盖率
  const coverage = poolNumbers.filter(n => targetSet.has(n)).length;
  totalCoverage += coverage;
  
  // 简单选号：取前5个高分号码
  const selected = poolNumbers.slice(0, 5);
  const hits = selected.filter(n => targetSet.has(n)).length;
  
  totalHits += hits;
  totalBalls += 5;
  
  pairs.push({
    source: source.issue,
    target: target.issue,
    selected,
    target: target.front,
    hits,
    coverage
  });
}

console.log(`\n配对数: ${pairs.length}`);
console.log(`号码池覆盖率: ${totalCoverage}/${totalBalls} (${(totalCoverage / totalBalls * 100).toFixed(1)}%)`);
console.log(`Top5命中率: ${totalHits}/${totalBalls} (${(totalHits / totalBalls * 100).toFixed(1)}%)`);

console.log('\n前5对详细结果:');
pairs.slice(0, 5).forEach((p, i) => {
  console.log(`  ${i + 1}. ${p.source} → ${p.target}: 选${p.selected.join(',')} | 目标${p.target.join(',')} | 命中${p.hits} | 覆盖${p.coverage}`);
});

// 显示历史频率Top10
console.log('\n历史频率Top10:');
const freqData = [];
for (let n = 1; n <= 35; n++) {
  freqData.push({ number: n, count: historyMetrics.historyFreq[n] });
}
freqData.sort((a, b) => b.count - a.count);
freqData.slice(0, 10).forEach((d, i) => {
  console.log(`  ${i + 1}. 号码${String(d.number).padStart(2)}: ${d.count}次`);
});
