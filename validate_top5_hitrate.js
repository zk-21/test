// 验证并优化Top5命中率
// 基于ALL_DRAWS数据分析模式，提出评分优化建议

const fs = require('fs');

// 读取optimized_picker.js中的ALL_DRAWS数据
const content = fs.readFileSync('optimized_picker.js', 'utf-8');
const allDrawsMatch = content.match(/const ALL_DRAWS\s*=\s*(\[[\s\S]*?\]);/);
if (!allDrawsMatch) {
  console.error('无法找到ALL_DRAWS数据');
  process.exit(1);
}

const ALL_DRAWS = eval(allDrawsMatch[1]);
console.log(`加载了 ${ALL_DRAWS.length} 期数据`);
console.log(`数据范围: ${ALL_DRAWS[0].issue} ~ ${ALL_DRAWS[ALL_DRAWS.length - 1].issue}\n`);

// ==================== 分析函数 ====================

// 1. 号码频率分析
function analyzeFrequency() {
  const freq = new Array(36).fill(0);
  ALL_DRAWS.forEach(d => d.front.forEach(n => freq[n]++));
  
  console.log('=== 1. 号码频率分析 (1-35) ===');
  const freqData = [];
  for (let n = 1; n <= 35; n++) {
    freqData.push({ number: n, count: freq[n], rate: (freq[n] / ALL_DRAWS.length * 100).toFixed(1) });
  }
  freqData.sort((a, b) => b.count - a.count);
  
  console.log('高频号 (Top10):');
  freqData.slice(0, 10).forEach((d, i) => {
    console.log(`  ${i + 1}. 号码${String(d.number).padStart(2)}: ${d.count}次 (${d.rate}%)`);
  });
  
  console.log('\n低频号 (Bottom10):');
  freqData.slice(-10).forEach((d, i) => {
    console.log(`  ${i + 1}. 号码${String(d.number).padStart(2)}: ${d.count}次 (${d.rate}%)`);
  });
  
  return freqData;
}

// 2. 区间分布分析
function analyzeZoneDistribution() {
  console.log('\n=== 2. 区间分布分析 ===');
  const zoneCounts = [0, 0, 0]; // 1-12, 13-24, 25-35
  
  ALL_DRAWS.forEach(d => {
    d.front.forEach(n => {
      if (n <= 12) zoneCounts[0]++;
      else if (n <= 24) zoneCounts[1]++;
      else zoneCounts[2]++;
    });
  });
  
  const total = zoneCounts.reduce((a, b) => a + b, 0);
  console.log(`I区 (1-12):  ${zoneCounts[0]}球 (${(zoneCounts[0] / total * 100).toFixed(1)}%)`);
  console.log(`II区 (13-24): ${zoneCounts[1]}球 (${(zoneCounts[1] / total * 100).toFixed(1)}%)`);
  console.log(`III区 (25-35): ${zoneCounts[2]}球 (${(zoneCounts[2] / total * 100).toFixed(1)}%)`);
  
  return zoneCounts;
}

// 3. 尾号分布分析
function analyzeTailDistribution() {
  console.log('\n=== 3. 尾号分布分析 ===');
  const tailCounts = new Array(10).fill(0);
  
  ALL_DRAWS.forEach(d => {
    d.front.forEach(n => tailCounts[n % 10]++);
  });
  
  const total = tailCounts.reduce((a, b) => a + b, 0);
  for (let t = 0; t < 10; t++) {
    const bar = '█'.repeat(Math.round(tailCounts[t] / total * 50));
    console.log(`尾号${t}: ${String(tailCounts[t]).padStart(3)}次 (${(tailCounts[t] / total * 100).toFixed(1)}%) ${bar}`);
  }
  
  return tailCounts;
}

// 4. 连号模式分析
function analyzeConsecutivePatterns() {
  console.log('\n=== 4. 连号模式分析 ===');
  let noConsec = 0, doubleConsec = 0, tripleConsec = 0, quadConsec = 0;
  
  ALL_DRAWS.forEach(d => {
    const sorted = [...d.front].sort((a, b) => a - b);
    let maxRun = 1, run = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] === 1) { run++; maxRun = Math.max(maxRun, run); }
      else run = 1;
    }
    if (maxRun === 1) noConsec++;
    else if (maxRun === 2) doubleConsec++;
    else if (maxRun === 3) tripleConsec++;
    else quadConsec++;
  });
  
  const total = ALL_DRAWS.length;
  console.log(`无连号: ${noConsec}期 (${(noConsec / total * 100).toFixed(1)}%)`);
  console.log(`双连号: ${doubleConsec}期 (${(doubleConsec / total * 100).toFixed(1)}%)`);
  console.log(`三连号: ${tripleConsec}期 (${(tripleConsec / total * 100).toFixed(1)}%)`);
  console.log(`四连号: ${quadConsec}期 (${(quadConsec / total * 100).toFixed(1)}%)`);
}

// 5. 奇偶比分析
function analyzeOddEvenRatio() {
  console.log('\n=== 5. 奇偶比分析 ===');
  const oddCounts = [0, 0, 0, 0, 0, 0]; // 0-5个奇数
  
  ALL_DRAWS.forEach(d => {
    const odd = d.front.filter(n => n % 2 === 1).length;
    oddCounts[odd]++;
  });
  
  const total = ALL_DRAWS.length;
  for (let i = 0; i <= 5; i++) {
    console.log(`${i}奇${5 - i}偶: ${oddCounts[i]}期 (${(oddCounts[i] / total * 100).toFixed(1)}%)`);
  }
}

// 6. 和值分布分析
function analyzeSumDistribution() {
  console.log('\n=== 6. 和值分布分析 ===');
  const sums = ALL_DRAWS.map(d => d.front.reduce((a, b) => a + b, 0));
  const avg = sums.reduce((a, b) => a + b, 0) / sums.length;
  const min = Math.min(...sums);
  const max = Math.max(...sums);
  
  console.log(`平均和值: ${avg.toFixed(1)}`);
  console.log(`最小和值: ${min}`);
  console.log(`最大和值: ${max}`);
  
  // 和值区间分布
  const ranges = [
    { label: '<60', min: 0, max: 59 },
    { label: '60-79', min: 60, max: 79 },
    { label: '80-99', min: 80, max: 99 },
    { label: '100-119', min: 100, max: 119 },
    { label: '≥120', min: 120, max: 999 }
  ];
  
  console.log('\n和值区间分布:');
  ranges.forEach(r => {
    const count = sums.filter(s => s >= r.min && s <= r.max).length;
    console.log(`  ${r.label}: ${count}期 (${(count / sums.length * 100).toFixed(1)}%)`);
  });
}

// 7. 跨度分布分析
function analyzeSpanDistribution() {
  console.log('\n=== 7. 跨度分布分析 ===');
  const spans = ALL_DRAWS.map(d => {
    const sorted = [...d.front].sort((a, b) => a - b);
    return sorted[4] - sorted[0];
  });
  
  const avg = spans.reduce((a, b) => a + b, 0) / spans.length;
  console.log(`平均跨度: ${avg.toFixed(1)}`);
  
  const ranges = [
    { label: '<15', min: 0, max: 14 },
    { label: '15-19', min: 15, max: 19 },
    { label: '20-24', min: 20, max: 24 },
    { label: '25-29', min: 25, max: 29 },
    { label: '≥30', min: 30, max: 99 }
  ];
  
  console.log('\n跨度区间分布:');
  ranges.forEach(r => {
    const count = spans.filter(s => s >= r.min && s <= r.max).length;
    console.log(`  ${r.label}: ${count}期 (${(count / spans.length * 100).toFixed(1)}%)`);
  });
}

// 8. 间隔期号码重复分析
function analyzeRepeatPattern() {
  console.log('\n=== 8. 间隔期号码重复分析 ===');
  const intervals = [5, 10, 12, 15];
  
  intervals.forEach(interval => {
    let totalRepeats = 0;
    let pairCount = 0;
    
    for (let i = 0; i < ALL_DRAWS.length - interval; i++) {
      const source = new Set(ALL_DRAWS[i].front);
      const target = ALL_DRAWS[i + interval].front;
      const repeats = target.filter(n => source.has(n)).length;
      totalRepeats += repeats;
      pairCount++;
    }
    
    const avgRepeats = totalRepeats / pairCount;
    console.log(`${interval}期间隔: 平均重复${avgRepeats.toFixed(2)}球 (${pairCount}对)`);
  });
}

// 9. 号码共现分析（哪些号码经常一起出现）
function analyzeCoOccurrence() {
  console.log('\n=== 9. 号码共现分析 (Top20高频组合) ===');
  const pairCounts = new Map();
  
  ALL_DRAWS.forEach(d => {
    const sorted = [...d.front].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const key = `${sorted[i]}-${sorted[j]}`;
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }
  });
  
  const sortedPairs = [...pairCounts.entries()].sort((a, b) => b[1] - a[1]);
  sortedPairs.slice(0, 20).forEach(([pair, count], i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${pair}: ${count}次`);
  });
}

// 10. 10期间隔转移矩阵分析
function analyzeTransitionMatrix() {
  console.log('\n=== 10. 10期间隔号码转移分析 ===');
  
  // 统计每个号码在10期后再次出现的概率
  const appearCount = new Array(36).fill(0);
  const reappearCount = new Array(36).fill(0);
  
  for (let i = 0; i < ALL_DRAWS.length - 10; i++) {
    const source = ALL_DRAWS[i].front;
    const target = ALL_DRAWS[i + 10].front;
    const targetSet = new Set(target);
    
    source.forEach(n => {
      appearCount[n]++;
      if (targetSet.has(n)) reappearCount[n]++;
    });
  }
  
  console.log('号码在10期后重复出现概率:');
  const repeatData = [];
  for (let n = 1; n <= 35; n++) {
    if (appearCount[n] > 0) {
      const rate = reappearCount[n] / appearCount[n] * 100;
      repeatData.push({ number: n, count: appearCount[n], reappear: reappearCount[n], rate });
    }
  }
  
  repeatData.sort((a, b) => b.rate - a.rate);
  console.log('\n高重复率号码 (Top10):');
  repeatData.slice(0, 10).forEach((d, i) => {
    console.log(`  ${i + 1}. 号码${String(d.number).padStart(2)}: ${d.reappear}/${d.count} (${d.rate.toFixed(1)}%)`);
  });
  
  console.log('\n低重复率号码 (Bottom10):');
  repeatData.slice(-10).forEach((d, i) => {
    console.log(`  ${i + 1}. 号码${String(d.number).padStart(2)}: ${d.reappear}/${d.count} (${d.rate.toFixed(1)}%)`);
  });
}

// 11. 区间比转移分析
function analyzeIntervalRatioTransition() {
  console.log('\n=== 11. 区间比转移分析 (10期间隔) ===');
  
  const transitionCounts = new Map();
  let totalPairs = 0;
  
  for (let i = 0; i < ALL_DRAWS.length - 10; i++) {
    const source = ALL_DRAWS[i].front;
    const target = ALL_DRAWS[i + 10].front;
    
    const srcIv = [0, 0, 0];
    const tgtIv = [0, 0, 0];
    
    source.forEach(n => {
      if (n <= 12) srcIv[0]++;
      else if (n <= 24) srcIv[1]++;
      else srcIv[2]++;
    });
    
    target.forEach(n => {
      if (n <= 12) tgtIv[0]++;
      else if (n <= 24) tgtIv[1]++;
      else tgtIv[2]++;
    });
    
    const srcKey = srcIv.join(':');
    const tgtKey = tgtIv.join(':');
    const transKey = `${srcKey}→${tgtKey}`;
    
    transitionCounts.set(transKey, (transitionCounts.get(transKey) || 0) + 1);
    totalPairs++;
  }
  
  // 显示最常见的转移模式
  const sortedTrans = [...transitionCounts.entries()].sort((a, b) => b[1] - a[1]);
  console.log('最常见的区间比转移 (Top15):');
  sortedTrans.slice(0, 15).forEach(([trans, count], i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${trans}: ${count}次 (${(count / totalPairs * 100).toFixed(1)}%)`);
  });
}

// 12. 热号/冷号分析
function analyzeHotColdNumbers() {
  console.log('\n=== 12. 热号/冷号分析 (近10期) ===');
  
  const recentDraws = ALL_DRAWS.slice(-10);
  const recentFreq = new Array(36).fill(0);
  
  recentDraws.forEach(d => d.front.forEach(n => recentFreq[n]++));
  
  const hotNumbers = [];
  const coldNumbers = [];
  
  for (let n = 1; n <= 35; n++) {
    if (recentFreq[n] >= 3) hotNumbers.push({ number: n, count: recentFreq[n] });
    if (recentFreq[n] === 0) coldNumbers.push({ number: n, count: 0 });
  }
  
  console.log(`热号 (近10期出现≥3次): ${hotNumbers.map(d => d.number).join(', ')}`);
  console.log(`冷号 (近10期未出现): ${coldNumbers.map(d => d.number).join(', ')}`);
}

// 13. 基于历史数据验证Top5命中率
function validateTop5HitRate() {
  console.log('\n=== 13. Top5命中率验证 (10期间隔) ===');
  
  let totalHits = 0;
  let totalBalls = 0;
  let hitDistribution = [0, 0, 0, 0, 0, 0]; // 0-5球命中
  
  for (let i = 0; i < ALL_DRAWS.length - 10; i++) {
    const source = ALL_DRAWS[i].front;
    const target = ALL_DRAWS[i + 10].front;
    const targetSet = new Set(target);
    
    // 模拟简单的选号策略：基于源号码的偏移
    const predicted = new Set();
    source.forEach(n => {
      predicted.add(n); // 保留源号码
      if (n > 1) predicted.add(n - 1);
      if (n < 35) predicted.add(n + 1);
      if (n > 3) predicted.add(n - 3);
      if (n < 33) predicted.add(n + 3);
    });
    
    // 取前5个
    const predArray = [...predicted].slice(0, 5);
    const hits = predArray.filter(n => targetSet.has(n)).length;
    
    totalHits += hits;
    totalBalls += 5;
    hitDistribution[hits]++;
  }
  
  const pairs = ALL_DRAWS.length - 10;
  console.log(`总配对: ${pairs}`);
  console.log(`总命中: ${totalHits}/${totalBalls} (${(totalHits / totalBalls * 100).toFixed(1)}%)`);
  console.log('\n命中分布:');
  for (let i = 5; i >= 0; i--) {
    console.log(`  ${i}球: ${hitDistribution[i]}对 (${(hitDistribution[i] / pairs * 100).toFixed(1)}%)`);
  }
}

// 14. 分析最优号码池大小
function analyzeOptimalPoolSize() {
  console.log('\n=== 14. 号码池大小与覆盖率分析 ===');
  
  const poolSizes = [20, 22, 25, 28, 30, 32, 35];
  
  poolSizes.forEach(poolSize => {
    let totalCoverage = 0;
    let totalBalls = 0;
    
    for (let i = 0; i < ALL_DRAWS.length - 10; i++) {
      const source = ALL_DRAWS[i].front;
      const target = ALL_DRAWS[i + 10].front;
      const targetSet = new Set(target);
      
      // 生成候选池（简化版）
      const pool = new Set();
      source.forEach(n => {
        pool.add(n);
        for (let d = 1; d <= 5; d++) {
          if (n - d >= 1) pool.add(n - d);
          if (n + d <= 35) pool.add(n + d);
        }
      });
      
      // 限制池大小
      const poolArray = [...pool].slice(0, poolSize);
      const coverage = poolArray.filter(n => targetSet.has(n)).length;
      
      totalCoverage += coverage;
      totalBalls += 5;
    }
    
    const pairs = ALL_DRAWS.length - 10;
    console.log(`池大小${poolSize}: 覆盖${totalCoverage}/${totalBalls} (${(totalCoverage / totalBalls * 100).toFixed(1)}%)`);
  });
}

// 运行所有分析
console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║              📊 ALL_DRAWS 数据验证与分析报告                        ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

analyzeFrequency();
analyzeZoneDistribution();
analyzeTailDistribution();
analyzeConsecutivePatterns();
analyzeOddEvenRatio();
analyzeSumDistribution();
analyzeSpanDistribution();
analyzeRepeatPattern();
analyzeCoOccurrence();
analyzeTransitionMatrix();
analyzeIntervalRatioTransition();
analyzeHotColdNumbers();
validateTop5HitRate();
analyzeOptimalPoolSize();

console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
console.log('║              📋 优化建议                                            ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');

console.log(`
1. 号码池优化:
   - 基于频率分析调整号码权重
   - 高频号应获得更高基础分
   - 冷号可适当降低权重

2. 区间比优化:
   - 根据区间比转移分析调整预测
   - 最常见的区间比应获得更高权重

3. 尾号优化:
   - 尾号分布相对均匀，但某些尾号略有偏差
   - 可适当调整尾号匹配权重

4. 连号/奇偶/和值/跨度:
   - 这些结构特征可用于组合级评分
   - 当前约束基本合理

5. 间隔期重复号:
   - 10期间隔平均重复约1-2球
   - 可适当调整重复号惩罚/奖励

6. 号码共现:
   - 某些号码组合出现频率较高
   - 可用于组合级评分加分

7. 热号/冷号:
   - 热号近期出现频率高，可适当加分
   - 冷号可作为补漏候选
`);

console.log('分析完成！');