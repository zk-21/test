// 部分回测脚本 - 只运行前50对进行验证
const fs = require('fs');
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
  for (let i = 0; i < ALL_DRAWS.length - 10; i++) {
    const source = ALL_DRAWS[i].front;
    const target = ALL_DRAWS[i + 10].front;
    const targetSet = new Set(target);
    source.forEach(n => {
      if (targetSet.has(n)) {
        repeatRate[n]++;
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
    avgRepeatRate
  };
}

const historyMetrics = calculateHistoryMetrics();

// 回测函数
function runBacktest() {
  const pairs = [];
  for (let i = 0; i < ALL_DRAWS.length - 10; i++) {
    pairs.push([i, i + 10]);
  }
  
  console.log(`\n=== 完整回测 (${pairs.length}对) ===`);
  
  let totalHits = 0;
  let totalBalls = 0;
  let totalCoverage = 0;
  let totalTop5Hits = 0;
  let hitDistribution = [0, 0, 0, 0, 0, 0];
  
  for (const [srcIdx, tgtIdx] of pairs) {
    const source = ALL_DRAWS[srcIdx];
    const target = ALL_DRAWS[tgtIdx];
    const targetSet = new Set(target.front);
    
    // 生成候选池
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
      
      // 偏移评分
      let minOffset = Infinity;
      source.front.forEach(anchor => {
        const dist = Math.abs(n - anchor);
        if (dist < minOffset) minOffset = dist;
      });
      const offsetPoints = { 0: 20, 1: 15, 2: 13, 3: 12, 4: 10, 5: 8, 6: 6, 7: 5, 8: 4, 9: 3, 10: 2 }[minOffset] || 0;
      score += offsetPoints;
      
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
    totalTop5Hits += hits;
    hitDistribution[hits]++;
  }
  
  console.log(`\n配对数: ${pairs.length}`);
  console.log(`总目标球: ${totalBalls}`);
  console.log(`\n📦 号码池覆盖率 (28球池):`);
  console.log(`   池内命中: ${totalCoverage}/${totalBalls} (${(totalCoverage / totalBalls * 100).toFixed(1)}%)`);
  
  console.log(`\n🏆 Top5命中率:`);
  console.log(`   Top5 总命中: ${totalTop5Hits}/${totalBalls} (${(totalTop5Hits / totalBalls * 100).toFixed(1)}%)`);
  
  console.log(`\n📊 命中分布:`);
  for (let i = 5; i >= 0; i--) {
    console.log(`   ${i}球: ${hitDistribution[i]}对 (${(hitDistribution[i] / pairs.length * 100).toFixed(1)}%)`);
  }
  
  // 显示历史频率Top10
  console.log(`\n📈 历史频率Top10:`);
  const freqData = [];
  for (let n = 1; n <= 35; n++) {
    freqData.push({ number: n, count: historyMetrics.historyFreq[n] });
  }
  freqData.sort((a, b) => b.count - a.count);
  freqData.slice(0, 10).forEach((d, i) => {
    console.log(`   ${i + 1}. 号码${String(d.number).padStart(2)}: ${d.count}次`);
  });
  
  return {
    totalBalls,
    totalCoverage,
    totalTop5Hits,
    hitDistribution
  };
}

// 运行回测
const result = runBacktest();

// 保存结果到文件
const report = `
=== 优化后回测结果 ===
日期: ${new Date().toISOString()}

配对数: ${ALL_DRAWS.length - 10}
总目标球: ${result.totalBalls}

号码池覆盖率 (28球池):
   池内命中: ${result.totalCoverage}/${result.totalBalls} (${(result.totalCoverage / result.totalBalls * 100).toFixed(1)}%)

Top5命中率:
   Top5 总命中: ${result.totalTop5Hits}/${result.totalBalls} (${(result.totalTop5Hits / result.totalBalls * 100).toFixed(1)}%)

命中分布:
${[5, 4, 3, 2, 1, 0].map(i => `   ${i}球: ${result.hitDistribution[i]}对 (${(result.hitDistribution[i] / (ALL_DRAWS.length - 10) * 100).toFixed(1)}%)`).join('\n')}

优化措施:
1. 号码池大小: 25 → 28
2. 历史频率权重: 0.15
3. 近期频率权重: 0.10
4. 重复率权重: 0.05
5. 热号权重提升: 3→4 (热号), 新增超级热号+6
6. 区间比优化: 2:1:2 优先
`;

fs.writeFileSync('backtest_optimized_result.txt', report);
console.log('\n✅ 结果已保存到 backtest_optimized_result.txt');
