const fs = require('fs');

// 读取历史数据
const draws = JSON.parse(fs.readFileSync('all_draws.json', 'utf8'));

console.log(`分析历史数据: ${draws.length} 期\n`);

// 分析尾号大小分布模式
function analyzeTailSizeDistribution() {
  const sizeFreq = new Map(); // 大小分布 -> 出现次数
  const sizeHitRate = new Map(); // 大小分布 -> 命中率
  
  const totalDraws = draws.length;
  
  for (let i = 1; i < totalDraws; i++) {
    const currentDraw = draws[i];
    const prevDraw = draws[i - 1];
    
    const currentTails = currentDraw.front.map(n => n % 10);
    const prevTails = prevDraw.front.map(n => n % 10);
    
    // 计算当前期尾号的大小分布
    // 小尾号：0-4，大尾号：5-9
    const smallCount = currentTails.filter(t => t <= 4).length;
    const largeCount = currentTails.filter(t => t >= 5).length;
    const sizePattern = `${smallCount}小${largeCount}大`;
    
    // 统计大小分布频率
    sizeFreq.set(sizePattern, (sizeFreq.get(sizePattern) || 0) + 1);
    
    // 计算大小分布与下期命中的关系
    if (i < totalDraws - 1) {
      const nextDraw = draws[i + 1];
      const nextTails = nextDraw.front.map(n => n % 10);
      
      // 检查下期是否有相同的大小分布
      const nextSmallCount = nextTails.filter(t => t <= 4).length;
      const nextLargeCount = nextTails.filter(t => t >= 5).length;
      const nextSizePattern = `${nextSmallCount}小${nextLargeCount}大`;
      
      if (!sizeHitRate.has(sizePattern)) {
        sizeHitRate.set(sizePattern, { hits: 0, total: 0 });
      }
      const stats = sizeHitRate.get(sizePattern);
      stats.total++;
      if (sizePattern === nextSizePattern) stats.hits++;
    }
  }
  
  console.log('=== 尾号大小分布频率分析 ===');
  console.log(`分析期数: ${totalDraws - 1} 期\n`);
  
  // 按频率排序
  const sortedSizes = [...sizeFreq.entries()].sort((a, b) => b[1] - a[1]);
  
  console.log('大小分布频率:');
  sortedSizes.forEach(([pattern, count]) => {
    console.log(`  ${pattern}: ${count}次 (${(count / (totalDraws - 1) * 100).toFixed(1)}%)`);
  });
  
  console.log('\n=== 大小分布命中率分析 ===');
  console.log('大小分布在下期出现的命中率:');
  
  const sortedHitRates = [...sizeHitRate.entries()].sort((a, b) => {
    const rateA = a[1].hits / a[1].total;
    const rateB = b[1].hits / b[1].total;
    return rateB - rateA;
  });
  
  sortedHitRates.forEach(([pattern, stats]) => {
    const hitRate = stats.hits / stats.total;
    console.log(`  ${pattern}: 命中率 ${(hitRate * 100).toFixed(1)}% (${stats.hits}/${stats.total})`);
  });
  
  // 分析奇偶分布
  console.log('\n=== 奇偶分布频率分析 ===');
  
  const oddEvenFreq = new Map(); // 奇偶分布 -> 出现次数
  
  for (let i = 1; i < totalDraws; i++) {
    const currentDraw = draws[i];
    const currentTails = currentDraw.front.map(n => n % 10);
    
    const oddCount = currentTails.filter(t => t % 2 === 1).length;
    const evenCount = currentTails.filter(t => t % 2 === 0).length;
    const oddEvenPattern = `${oddCount}奇${evenCount}偶`;
    
    oddEvenFreq.set(oddEvenPattern, (oddEvenFreq.get(oddEvenPattern) || 0) + 1);
  }
  
  console.log('奇偶分布频率:');
  const sortedOddEven = [...oddEvenFreq.entries()].sort((a, b) => b[1] - a[1]);
  sortedOddEven.forEach(([pattern, count]) => {
    console.log(`  ${pattern}: ${count}次 (${(count / (totalDraws - 1) * 100).toFixed(1)}%)`);
  });
  
  return {
    sizeFreq,
    sizeHitRate,
    oddEvenFreq
  };
}

// 运行分析
const results = analyzeTailSizeDistribution();

// 生成优化建议
console.log('\n=== 优化建议 ===');
console.log('1. 大小分布权重调整:');
console.log('   根据大小分布命中率调整组合优化中的大小分布权重');
console.log('   高命中率大小分布应该给予更高权重');

console.log('\n2. 奇偶分布权重调整:');
console.log('   根据奇偶分布频率调整组合优化中的奇偶分布权重');
console.log('   常见奇偶分布应该给予更高权重');

console.log('\n3. 实际应用:');
console.log('   在组合优化中，考虑尾号的大小分布和奇偶分布');
console.log('   优先选择符合历史分布模式的组合');
