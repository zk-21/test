// 分析尾号预测覆盖情况
const fs = require('fs');

const content = fs.readFileSync('backtest_result.txt', 'utf8');
const lines = content.split('\n');

let totalTargetTails = 0;
let coveredTargetTails = 0;
let missedTargetTails = 0;
let totalPeriods = 0;

// 尾号统计
const tailStats = {};
for (let t = 0; t <= 9; t++) {
  tailStats[t] = { total: 0, covered: 0, missed: 0 };
}

// 每期分析
const periodResults = [];
let currentPeriod = null;
let targetNums = [];
let poolNums = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  
  // 匹配期号: "第 X 期验证  源期: XXXXX → 目标期: XXXXX"
  const periodMatch = line.match(/^第\s*(\d+)\s*期验证/);
  if (periodMatch) {
    if (currentPeriod && targetNums.length > 0) {
      periodResults.push({
        period: currentPeriod,
        targetNums: [...targetNums],
        poolNums: [...poolNums]
      });
    }
    currentPeriod = periodMatch[1];
    targetNums = [];
    poolNums = [];
    continue;
  }
  
  // 匹配目的号码: "目的号码(下期开奖): [8, 10, 25, 29, 30]"
  if (line.includes('目的号码(下期开奖):')) {
    const match = line.match(/\[([^\]]+)\]/);
    if (match) {
      targetNums = match[1].split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    }
    continue;
  }
  
  // 匹配候选池: "候选池: [1, 2, 3, ...]"
  if (line.includes('候选池:') && line.includes('[')) {
    const match = line.match(/\[([^\]]+)\]/);
    if (match) {
      poolNums = match[1].split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    }
    continue;
  }
}

// 添加最后一期
if (currentPeriod && targetNums.length > 0) {
  periodResults.push({
    period: currentPeriod,
    targetNums: [...targetNums],
    poolNums: [...poolNums]
  });
}

// 分析每期尾号覆盖
periodResults.forEach(r => {
  const targetTails = r.targetNums.map(n => n % 10);
  const poolTails = new Set(r.poolNums.map(n => n % 10));
  
  totalPeriods++;
  
  targetTails.forEach(tail => {
    totalTargetTails++;
    tailStats[tail].total++;
    
    if (poolTails.has(tail)) {
      coveredTargetTails++;
      tailStats[tail].covered++;
    } else {
      missedTargetTails++;
      tailStats[tail].missed++;
    }
  });
});

// 输出结果
console.log('尾号预测覆盖分析报告');
console.log('====================');
console.log(`总验证期数: ${totalPeriods}`);
console.log(`目的号码总尾号数: ${totalTargetTails}`);
console.log(`被候选池覆盖的尾号数: ${coveredTargetTails}`);
console.log(`未被覆盖的尾号数: ${missedTargetTails}`);
console.log(`尾号覆盖率: ${(coveredTargetTails/totalTargetTails*100).toFixed(1)}%`);
console.log('');

console.log('各尾号覆盖情况:');
console.log('尾号 | 总出现 | 被覆盖 | 未覆盖 | 覆盖率');
console.log('-----|--------|--------|--------|--------');

for (let t = 0; t <= 9; t++) {
  const stats = tailStats[t];
  const coverage = stats.total > 0 ? (stats.covered / stats.total * 100).toFixed(1) : '0.0';
  console.log(`  ${t}  |  ${stats.total.toString().padStart(4)}  |  ${stats.covered.toString().padStart(4)}  |  ${stats.missed.toString().padStart(4)}  |  ${coverage}%`);
}

// 分析未覆盖尾号的模式
console.log('');
console.log('未覆盖尾号分析:');
console.log('未覆盖最多的尾号:');
const missedTails = Object.entries(tailStats)
  .map(([tail, stats]) => ({ tail: parseInt(tail), missed: stats.missed, total: stats.total }))
  .filter(s => s.missed > 0)
  .sort((a, b) => b.missed - a.missed);

missedTails.forEach(s => {
  console.log(`  尾号${s.tail}: 未覆盖${s.missed}次 (共${s.total}次出现, 覆盖率${((s.total-s.missed)/s.total*100).toFixed(1)}%)`);
});

// 分析连续未覆盖的尾号
console.log('');
console.log('连续未覆盖的尾号对:');
const missedPairs = {};
periodResults.forEach(r => {
  const targetTails = r.targetNums.map(n => n % 10);
  const poolTails = new Set(r.poolNums.map(n => n % 10));
  
  const missed = targetTails.filter(t => !poolTails.has(t));
  for (let i = 0; i < missed.length; i++) {
    for (let j = i + 1; j < missed.length; j++) {
      const pair = `${missed[i]}-${missed[j]}`;
      missedPairs[pair] = (missedPairs[pair] || 0) + 1;
    }
  }
});

const sortedPairs = Object.entries(missedPairs)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

sortedPairs.forEach(([pair, count]) => {
  console.log(`  尾号对${pair}: 同时未覆盖${count}次`);
});
