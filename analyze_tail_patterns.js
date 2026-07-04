const fs = require('fs');

// 读取历史数据
const draws = JSON.parse(fs.readFileSync('all_draws.json', 'utf8'));

console.log(`分析历史数据: ${draws.length} 期\n`);

// 分析函数
function analyzePatterns() {
  let consecutiveCount = 0; // 2连续
  let threeConsecutiveCount = 0; // 3连续
  let arithmeticCount = 0; // 等差
  let crossRowCount = 0; // 跨行重复
  let oddEvenBalancedCount = 0; // 奇偶平衡
  
  const totalDraws = draws.length;
  
  for (let i = 1; i < totalDraws; i++) {
    const currentDraw = draws[i];
    const prevDraw = draws[i - 1];
    
    const currentTails = currentDraw.front.map(n => n % 10);
    const prevTails = prevDraw.front.map(n => n % 10);
    
    // 1. 连续性分析
    const sorted = [...currentTails].sort((a, b) => a - b);
    let maxConsecutive = 1;
    let currentConsecutive = 1;
    for (let j = 1; j < sorted.length; j++) {
      if (sorted[j] === sorted[j-1] + 1 || (sorted[j-1] === 9 && sorted[j] === 0)) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 1;
      }
    }
    
    if (maxConsecutive >= 2) consecutiveCount++;
    if (maxConsecutive >= 3) threeConsecutiveCount++;
    
    // 2. 等差性分析
    let hasArithmetic = false;
    if (sorted.length >= 3) {
      for (let j = 0; j < sorted.length - 2; j++) {
        for (let k = j + 1; k < sorted.length - 1; k++) {
          for (let l = k + 1; l < sorted.length; l++) {
            const diff1 = (sorted[k] - sorted[j] + 10) % 10;
            const diff2 = (sorted[l] - sorted[k] + 10) % 10;
            if (diff1 === diff2 && diff1 >= 1 && diff1 <= 4) {
              hasArithmetic = true;
              break;
            }
          }
          if (hasArithmetic) break;
        }
        if (hasArithmetic) break;
      }
    }
    if (hasArithmetic) arithmeticCount++;
    
    // 3. 跨行重复分析
    const prevTailSet = new Set(prevTails);
    let crossRowMatches = 0;
    currentTails.forEach(t => {
      if (prevTailSet.has(t)) crossRowMatches++;
    });
    if (crossRowMatches > 0) crossRowCount++;
    
    // 4. 奇偶平衡分析
    const evenCount = currentTails.filter(t => t % 2 === 0).length;
    const oddCount = currentTails.filter(t => t % 2 === 1).length;
    if (evenCount >= 2 && oddCount >= 2) oddEvenBalancedCount++;
  }
  
  console.log('=== 历史模式频率分析 ===');
  console.log(`分析期数: ${totalDraws - 1} 期 (从第2期开始)\n`);
  
  console.log(`1. 连续性:`);
  console.log(`   2连续或以上: ${consecutiveCount} 期 (${(consecutiveCount / (totalDraws - 1) * 100).toFixed(1)}%)`);
  console.log(`   3连续或以上: ${threeConsecutiveCount} 期 (${(threeConsecutiveCount / (totalDraws - 1) * 100).toFixed(1)}%)`);
  
  console.log(`\n2. 等差性:`);
  console.log(`   存在等差模式: ${arithmeticCount} 期 (${(arithmeticCount / (totalDraws - 1) * 100).toFixed(1)}%)`);
  
  console.log(`\n3. 跨行重复:`);
  console.log(`   至少1个尾号重复: ${crossRowCount} 期 (${(crossRowCount / (totalDraws - 1) * 100).toFixed(1)}%)`);
  
  console.log(`\n4. 奇偶平衡:`);
  console.log(`   至少2奇2偶: ${oddEvenBalancedCount} 期 (${(oddEvenBalancedCount / (totalDraws - 1) * 100).toFixed(1)}%)`);
  
  // 计算建议权重
  console.log('\n=== 建议权重调整 ===');
  
  const consecutiveRate = consecutiveCount / (totalDraws - 1);
  const threeConsecutiveRate = threeConsecutiveCount / (totalDraws - 1);
  const arithmeticRate = arithmeticCount / (totalDraws - 1);
  const crossRowRate = crossRowCount / (totalDraws - 1);
  const oddEvenRate = oddEvenBalancedCount / (totalDraws - 1);
  
  // 基于频率调整权重（频率越高，权重越低，避免过度优化）
  const baseWeight = 20;
  
  console.log(`连续性 (2连续): 频率 ${(consecutiveRate * 100).toFixed(1)}% → 建议权重: ${Math.round(baseWeight * (1 - consecutiveRate))}`);
  console.log(`连续性 (3连续): 频率 ${(threeConsecutiveRate * 100).toFixed(1)}% → 建议权重: ${Math.round(baseWeight * (1 - threeConsecutiveRate) * 1.5)}`);
  console.log(`等差性: 频率 ${(arithmeticRate * 100).toFixed(1)}% → 建议权重: ${Math.round(baseWeight * (1 - arithmeticRate))}`);
  console.log(`跨行重复: 频率 ${(crossRowRate * 100).toFixed(1)}% → 建议权重: ${Math.round(baseWeight * (1 - crossRowRate))}`);
  console.log(`奇偶平衡: 频率 ${(oddEvenRate * 100).toFixed(1)}% → 建议权重: ${Math.round(baseWeight * (1 - oddEvenRate))}`);
  
  return {
    consecutiveRate,
    threeConsecutiveRate,
    arithmeticRate,
    crossRowRate,
    oddEvenRate
  };
}

// 运行分析
const rates = analyzePatterns();

// 生成优化建议
console.log('\n=== 优化建议 ===');
console.log('1. 当前组合优化权重:');
console.log('   - 连续性: 2连续+10, 3连续+20');
console.log('   - 等差性: +15');
console.log('   - 跨行重复: 每个+8');
console.log('   - 奇偶平衡: +5');

console.log('\n2. 基于历史频率的调整建议:');
if (rates.consecutiveRate > 0.5) {
  console.log('   - 连续性频率很高，可以降低权重，避免过度优化');
} else {
  console.log('   - 连续性频率适中，保持当前权重');
}

if (rates.arithmeticRate > 0.3) {
  console.log('   - 等差性频率较高，可以适当降低权重');
} else {
  console.log('   - 等差性频率较低，可以保持或提高权重');
}

if (rates.crossRowRate > 0.7) {
  console.log('   - 跨行重复频率很高，可以降低权重');
} else {
  console.log('   - 跨行重复频率适中，保持当前权重');
}

console.log('\n3. 动态权重调整方案:');
console.log('   根据历史频率动态调整权重，避免过度优化常见模式');
