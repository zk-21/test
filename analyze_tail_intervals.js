const fs = require('fs');

// 读取历史数据
const draws = JSON.parse(fs.readFileSync('all_draws.json', 'utf8'));

console.log(`分析历史数据: ${draws.length} 期\n`);

// 分析尾号间隔模式
function analyzeTailIntervals() {
  const intervalFreq = new Map(); // 间隔 -> 出现次数
  const intervalHitRate = new Map(); // 间隔 -> 命中率
  
  const totalDraws = draws.length;
  
  for (let i = 1; i < totalDraws; i++) {
    const currentDraw = draws[i];
    const prevDraw = draws[i - 1];
    
    const currentTails = currentDraw.front.map(n => n % 10);
    const prevTails = prevDraw.front.map(n => n % 10);
    
    // 计算当前期尾号之间的间隔
    const sorted = [...currentTails].sort((a, b) => a - b);
    const intervals = [];
    for (let j = 0; j < sorted.length - 1; j++) {
      const interval = (sorted[j+1] - sorted[j] + 10) % 10;
      intervals.push(interval);
    }
    
    // 统计间隔频率
    intervals.forEach(interval => {
      intervalFreq.set(interval, (intervalFreq.get(interval) || 0) + 1);
    });
    
    // 计算间隔与下期命中的关系
    if (i < totalDraws - 1) {
      const nextDraw = draws[i + 1];
      const nextTails = nextDraw.front.map(n => n % 10);
      
      // 检查当前期的间隔模式是否在下期出现
      intervals.forEach(interval => {
        // 检查下期是否有相同的间隔
        const nextSorted = [...nextTails].sort((a, b) => a - b);
        let hasInterval = false;
        for (let k = 0; k < nextSorted.length - 1; k++) {
          const nextInterval = (nextSorted[k+1] - nextSorted[k] + 10) % 10;
          if (nextInterval === interval) {
            hasInterval = true;
            break;
          }
        }
        
        if (!intervalHitRate.has(interval)) {
          intervalHitRate.set(interval, { hits: 0, total: 0 });
        }
        const stats = intervalHitRate.get(interval);
        stats.total++;
        if (hasInterval) stats.hits++;
      });
    }
  }
  
  console.log('=== 尾号间隔频率分析 ===');
  console.log(`分析期数: ${totalDraws - 1} 期\n`);
  
  // 按频率排序
  const sortedIntervals = [...intervalFreq.entries()].sort((a, b) => b[1] - a[1]);
  
  console.log('间隔频率:');
  sortedIntervals.forEach(([interval, count]) => {
    console.log(`  间隔${interval}: ${count}次 (${(count / (totalDraws - 1) * 100).toFixed(1)}%)`);
  });
  
  console.log('\n=== 间隔命中率分析 ===');
  console.log('间隔在下期出现的命中率:');
  
  const sortedHitRates = [...intervalHitRate.entries()].sort((a, b) => {
    const rateA = a[1].hits / a[1].total;
    const rateB = b[1].hits / b[1].total;
    return rateB - rateA;
  });
  
  sortedHitRates.forEach(([interval, stats]) => {
    const hitRate = stats.hits / stats.total;
    console.log(`  间隔${interval}: 命中率 ${(hitRate * 100).toFixed(1)}% (${stats.hits}/${stats.total})`);
  });
  
  // 分析间隔组合模式
  console.log('\n=== 间隔组合模式分析 ===');
  
  const comboFreq = new Map(); // 间隔组合 -> 出现次数
  
  for (let i = 1; i < totalDraws; i++) {
    const currentDraw = draws[i];
    const currentTails = currentDraw.front.map(n => n % 10);
    
    const sorted = [...currentTails].sort((a, b) => a - b);
    const intervals = [];
    for (let j = 0; j < sorted.length - 1; j++) {
      const interval = (sorted[j+1] - sorted[j] + 10) % 10;
      intervals.push(interval);
    }
    
    // 生成间隔组合（连续2个间隔）
    for (let j = 0; j < intervals.length - 1; j++) {
      const combo = `${intervals[j]}-${intervals[j+1]}`;
      comboFreq.set(combo, (comboFreq.get(combo) || 0) + 1);
    }
  }
  
  console.log('间隔组合频率（连续2个间隔）:');
  const sortedCombos = [...comboFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  sortedCombos.forEach(([combo, count]) => {
    console.log(`  ${combo}: ${count}次 (${(count / (totalDraws - 1) * 100).toFixed(1)}%)`);
  });
  
  return {
    intervalFreq,
    intervalHitRate,
    comboFreq
  };
}

// 运行分析
const results = analyzeTailIntervals();

// 生成优化建议
console.log('\n=== 优化建议 ===');
console.log('1. 间隔权重调整:');
console.log('   根据间隔命中率调整组合优化中的间隔权重');
console.log('   高命中率间隔应该给予更高权重');

console.log('\n2. 间隔组合模式:');
console.log('   考虑间隔组合的连续性，如1-2、2-3等');
console.log('   这些组合模式可能对预测有帮助');

console.log('\n3. 实际应用:');
console.log('   在组合优化中，考虑尾号之间的间隔模式');
console.log('   优先选择符合历史间隔模式的组合');
