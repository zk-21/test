const fs = require('fs');

// 读取回测输出文件（UTF-16编码）
// 注意：可以切换分析不同版本的回测结果
const inputFile = process.argv[2] || 'backtest_with_tails.txt';
console.log(`分析文件: ${inputFile}`);
const content = fs.readFileSync(inputFile, 'utf16le');

// 使用正则表达式提取所有尾号预测详情块
const regex = /【指标0】尾号预测详情:\s*\n\s*预测尾号\(Top5\): \[([^\]]+)\]\s*\n\s*实际尾号:\s*\[([^\]]+)\]\s*\n\s*命中尾号:\s*\[([^\]]+)\]\s*\n\s*漏掉尾号:\s*\[([^\]]+)\]\s*\n\s*尾号命中率:\s*(\d+)\/(\d+)/g;

const results = [];
let match;

while ((match = regex.exec(content)) !== null) {
  const predicted = match[1].split(', ').map(Number);
  const actual = match[2].split(', ').map(Number);
  const hit = match[3].split(', ').map(Number);
  const missed = match[4].split(', ').map(Number);
  const hitCount = parseInt(match[5]);
  const totalCount = parseInt(match[6]);
  
  results.push({
    predicted,
    actual,
    hit,
    missed,
    hitRate: hitCount / totalCount
  });
}

console.log(`总共分析 ${results.length} 期数据`);

if (results.length === 0) {
  console.log('没有找到数据，请检查文件格式');
  // 调试：输出部分内容
  console.log('文件前2000字符:');
  console.log(content.substring(0, 2000));
  process.exit(1);
}

// 1. 统计漏掉的尾号频率
const missedFreq = new Map();
for (let t = 0; t <= 9; t++) missedFreq.set(t, 0);

results.forEach(r => {
  r.missed.forEach(t => {
    missedFreq.set(t, missedFreq.get(t) + 1);
  });
});

console.log('\n=== 漏掉的尾号频率分布 ===');
const sortedMissed = [...missedFreq.entries()].sort((a, b) => b[1] - a[1]);
sortedMissed.forEach(([tail, count]) => {
  console.log(`尾号 ${tail}: 漏掉 ${count} 次 (${(count / results.length * 100).toFixed(1)}%)`);
});

// 2. 统计预测尾号频率
const predFreq = new Map();
for (let t = 0; t <= 9; t++) predFreq.set(t, 0);

results.forEach(r => {
  r.predicted.forEach(t => {
    predFreq.set(t, predFreq.get(t) + 1);
  });
});

console.log('\n=== 预测尾号频率分布（Top5） ===');
const sortedPred = [...predFreq.entries()].sort((a, b) => b[1] - a[1]);
sortedPred.forEach(([tail, count]) => {
  console.log(`尾号 ${tail}: 预测 ${count} 次 (${(count / results.length * 100).toFixed(1)}%)`);
});

// 3. 统计实际尾号频率
const actualFreq = new Map();
for (let t = 0; t <= 9; t++) actualFreq.set(t, 0);

results.forEach(r => {
  r.actual.forEach(t => {
    actualFreq.set(t, actualFreq.get(t) + 1);
  });
});

console.log('\n=== 实际尾号频率分布 ===');
const sortedActual = [...actualFreq.entries()].sort((a, b) => b[1] - a[1]);
sortedActual.forEach(([tail, count]) => {
  console.log(`尾号 ${tail}: 出现 ${count} 次 (${(count / results.length * 100).toFixed(1)}%)`);
});

// 4. 分析预测与实际的偏差
console.log('\n=== 预测偏差分析 ===');
console.log('尾号 | 预测次数 | 实际次数 | 偏差 | 漏掉次数');
console.log('-----|----------|----------|------|----------');

for (let t = 0; t <= 9; t++) {
  const pred = predFreq.get(t);
  const actual = actualFreq.get(t);
  const missed = missedFreq.get(t);
  const bias = pred - actual;
  console.log(`${t.toString().padStart(4)} | ${pred.toString().padStart(8)} | ${actual.toString().padStart(8)} | ${bias.toString().padStart(4)} | ${missed.toString().padStart(8)}`);
}

// 5. 分析漏掉的尾号与预测尾号的关系
console.log('\n=== 漏掉尾号与预测尾号的关系 ===');
console.log('分析：当尾号X被漏掉时，哪些尾号被预测了？');

const missedWithPred = new Map();
for (let t = 0; t <= 9; t++) missedWithPred.set(t, new Array(10).fill(0));

results.forEach(r => {
  r.missed.forEach(missedTail => {
    r.predicted.forEach(predTail => {
      missedWithPred.get(missedTail)[predTail]++;
    });
  });
});

console.log('\n漏掉尾号X时，预测尾号Y的次数：');
console.log('漏掉\\预测 | 0  1  2  3  4  5  6  7  8  9');
console.log('----------|----------------------------');

for (let missed = 0; missed <= 9; missed++) {
  const preds = missedWithPred.get(missed);
  const line = `${missed.toString().padStart(8)} | ${preds.map(p => p.toString().padStart(2)).join(' ')}`;
  console.log(line);
}

// 6. 计算平均尾号命中率
const avgHitRate = results.reduce((sum, r) => sum + r.hitRate, 0) / results.length;
console.log(`\n=== 平均尾号命中率: ${(avgHitRate * 100).toFixed(1)}% ===`);

// 7. 命中率分布
const hitRateDist = new Map();
results.forEach(r => {
  const rateKey = Math.floor(r.hitRate * 10) / 10; // 0.0, 0.1, 0.2, ...
  hitRateDist.set(rateKey, (hitRateDist.get(rateKey) || 0) + 1);
});

console.log('\n=== 尾号命中率分布 ===');
const sortedRates = [...hitRateDist.entries()].sort((a, b) => a[0] - b[0]);
sortedRates.forEach(([rate, count]) => {
  console.log(`${(rate * 100).toFixed(0)}%: ${count} 期 (${(count / results.length * 100).toFixed(1)}%)`);
});

// 8. 分析漏掉尾号与预测尾号的相邻关系
console.log('\n=== 漏掉尾号与预测尾号的相邻关系分析 ===');
console.log('分析：漏掉的尾号是否与预测的尾号相邻（±1）？');

let adjacentCount = 0;
let totalMissed = 0;

results.forEach(r => {
  r.missed.forEach(missedTail => {
    totalMissed++;
    const isAdjacent = r.predicted.some(predTail => 
      Math.abs(predTail - missedTail) === 1 || 
      (missedTail === 0 && predTail === 9) || 
      (missedTail === 9 && predTail === 0)
    );
    if (isAdjacent) adjacentCount++;
  });
});

console.log(`漏掉的尾号与预测尾号相邻的比例: ${adjacentCount}/${totalMissed} = ${(adjacentCount / totalMissed * 100).toFixed(1)}%`);

// 9. 分析漏掉尾号是否在前一期出现过
console.log('\n=== 分析漏掉尾号的历史出现情况 ===');
console.log('注：这里分析的是漏掉尾号在预测尾号中的分布模式');

// 统计漏掉尾号在预测尾号中的位置
const missedPosition = new Array(5).fill(0);
results.forEach(r => {
  r.missed.forEach(missedTail => {
    const pos = r.predicted.indexOf(missedTail);
    if (pos !== -1) {
      missedPosition[pos]++;
    }
  });
});

console.log('漏掉尾号在预测尾号Top5中的位置分布：');
console.log(`Top1: ${missedPosition[0]} 次`);
console.log(`Top2: ${missedPosition[1]} 次`);
console.log(`Top3: ${missedPosition[2]} 次`);
console.log(`Top4: ${missedPosition[3]} 次`);
console.log(`Top5: ${missedPosition[4]} 次`);
console.log(`不在Top5中: ${totalMissed - missedPosition.reduce((a, b) => a + b, 0)} 次`);

// 10. 输出一些典型案例
console.log('\n=== 典型案例分析 ===');
console.log('漏掉尾号最多的案例：');

const topMissed = results
  .map((r, i) => ({ ...r, index: i, missedCount: r.missed.length }))
  .sort((a, b) => b.missedCount - a.missedCount)
  .slice(0, 5);

topMissed.forEach((r, i) => {
  console.log(`\n案例 ${i + 1}: 第${r.index + 1}期`);
  console.log(`  预测尾号: [${r.predicted.join(', ')}]`);
  console.log(`  实际尾号: [${r.actual.join(', ')}]`);
  console.log(`  漏掉尾号: [${r.missed.join(', ')}]`);
  console.log(`  命中率: ${(r.hitRate * 100).toFixed(0)}%`);
});

// 11. 分析漏掉尾号的规律
console.log('\n=== 漏掉尾号规律分析 ===');
console.log('分析：哪些尾号最容易被漏掉？');

const mostMissed = sortedMissed.slice(0, 3);
console.log('最容易被漏掉的尾号:');
mostMissed.forEach(([tail, count]) => {
  console.log(`  尾号 ${tail}: 被漏掉 ${count} 次 (${(count / results.length * 100).toFixed(1)}%)`);
});

console.log('\n分析：这些尾号在预测中的频率如何？');
mostMissed.forEach(([tail, count]) => {
  const predCount = predFreq.get(tail);
  const actualCount = actualFreq.get(tail);
  console.log(`  尾号 ${tail}: 预测 ${predCount} 次, 实际出现 ${actualCount} 次, 漏掉 ${count} 次`);
  console.log(`    预测频率: ${(predCount / results.length * 100).toFixed(1)}%, 实际频率: ${(actualCount / results.length * 100).toFixed(1)}%`);
});