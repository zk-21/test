// 分析前一期区间比与当期区间比的关系
const __isNode = true;
const fs = require('fs');
const path = require('path');

const rawJs = fs.readFileSync(path.join(__dirname, 'all_draws.js'), 'utf8');
const match = rawJs.match(/window\.ALL_DRAWS_DATA\s*=\s*(\[[\s\S]*?\]);/);
const ALL_DRAWS_DATA = eval(match[1]);

const draws = ALL_DRAWS_DATA;
const totalPeriods = draws.length;

console.log("===== 前一期区间比与当期区间比关系分析 =====\n");

// 计算每期的区间分布
function getIntervalRatio(front) {
  const iv = [0, 0, 0];
  front.forEach(n => {
    if (n <= 12) iv[0]++;
    else if (n <= 24) iv[1]++;
    else iv[2]++;
  });
  return iv;
}

// 统计区间转移矩阵
const transitionMatrix = {};
// 前一期区间比 -> 当期区间比的统计
const prevToCurrent = {};

// 记录所有期的区间分布
const intervalHistory = [];
for (let i = 0; i < totalPeriods; i++) {
  const iv = getIntervalRatio(draws[i].front);
  intervalHistory.push(iv);
}

// 分析区间转移规律
console.log("1. 区间转移概率矩阵\n");
console.log("前一期区间分布 -> 当期区间分布的概率\n");

// 统计前一期每种区间分布出现后，当期各种区间分布的概率
const prevPatterns = {};
for (let i = 1; i < totalPeriods; i++) {
  const prevKey = intervalHistory[i-1].join(',');
  const currKey = intervalHistory[i].join(',');
  
  if (!prevPatterns[prevKey]) {
    prevPatterns[prevKey] = { total: 0, patterns: {} };
  }
  prevPatterns[prevKey].total++;
  prevPatterns[prevKey].patterns[currKey] = (prevPatterns[prevKey].patterns[currKey] || 0) + 1;
}

// 输出转移概率
console.log("前一期分布    当期分布        次数    概率");
console.log("=".repeat(60));

const sortedPrevPatterns = Object.entries(prevPatterns).sort((a, b) => b[1].total - a[1].total);
for (const [prevKey, data] of sortedPrevPatterns.slice(0, 15)) {  // 只显示前15种
  const sortedCurrPatterns = Object.entries(data.patterns).sort((a, b) => b[1] - a[1]);
  for (const [currKey, count] of sortedCurrPatterns.slice(0, 5)) {  // 每种前一期只显示前5种当期
    const prob = (count / data.total * 100).toFixed(1);
    console.log(`${prevKey.padEnd(15)}${currKey.padEnd(15)}${count.toString().padStart(5)}    ${prob}%`);
  }
  console.log("-".repeat(60));
}

// 分析区间变化趋势
console.log("\n2. 区间变化趋势分析\n");

// 统计前一期区间比与当期区间比的相关性
let samePattern = 0;
let increaseZone1 = 0, decreaseZone1 = 0;
let increaseZone2 = 0, decreaseZone2 = 0;
let increaseZone3 = 0, decreaseZone3 = 0;

for (let i = 1; i < totalPeriods; i++) {
  const prev = intervalHistory[i-1];
  const curr = intervalHistory[i];
  
  if (prev.join(',') === curr.join(',') ) samePattern++;
  if (curr[0] > prev[0]) increaseZone1++;
  if (curr[0] < prev[0]) decreaseZone1++;
  if (curr[1] > prev[1]) increaseZone2++;
  if (curr[1] < prev[1]) decreaseZone2++;
  if (curr[2] > prev[2]) increaseZone3++;
  if (curr[2] < prev[2]) decreaseZone3++;
}

const totalTransitions = totalPeriods - 1;
console.log(`总期数: ${totalTransitions}`);
console.log(`区间分布完全相同: ${samePattern}期 (${(samePattern/totalTransitions*100).toFixed(1)}%)`);
console.log("");
console.log("区间变化统计:");
console.log(`一区增加: ${increaseZone1}期 (${(increaseZone1/totalTransitions*100).toFixed(1)}%)`);
console.log(`一区减少: ${decreaseZone1}期 (${(decreaseZone1/totalTransitions*100).toFixed(1)}%)`);
console.log(`二区增加: ${increaseZone2}期 (${(increaseZone2/totalTransitions*100).toFixed(1)}%)`);
console.log(`二区减少: ${decreaseZone2}期 (${(decreaseZone2/totalTransitions*100).toFixed(1)}%)`);
console.log(`三区增加: ${increaseZone3}期 (${(increaseZone3/totalTransitions*100).toFixed(1)}%)`);
console.log(`三区减少: ${decreaseZone3}期 (${(decreaseZone3/totalTransitions*100).toFixed(1)}%)`);

// 分析区间"回归"现象
console.log("\n3. 区间回归现象分析\n");

// 如果前一期某区间偏多，下一期是否倾向于减少？
let overRepresented = { zone1: { total: 0, decrease: 0 }, zone2: { total: 0, decrease: 0 }, zone3: { total: 0, decrease: 0 } };
let underRepresented = { zone1: { total: 0, increase: 0 }, zone2: { total: 0, increase: 0 }, zone3: { total: 0, increase: 0 } };

const avgInterval = [0, 0, 0];
for (const iv of intervalHistory) {
  avgInterval[0] += iv[0];
  avgInterval[1] += iv[1];
  avgInterval[2] += iv[2];
}
avgInterval[0] /= totalPeriods;
avgInterval[1] /= totalPeriods;
avgInterval[2] /= totalPeriods;

console.log(`历史平均区间分布: 一区${avgInterval[0].toFixed(2)}个, 二区${avgInterval[1].toFixed(2)}个, 三区${avgInterval[2].toFixed(2)}个`);

for (let i = 1; i < totalPeriods; i++) {
  const prev = intervalHistory[i-1];
  const curr = intervalHistory[i];
  
  // 一区
  if (prev[0] > avgInterval[0]) {
    overRepresented.zone1.total++;
    if (curr[0] < prev[0]) overRepresented.zone1.decrease++;
  }
  if (prev[0] < avgInterval[0]) {
    underRepresented.zone1.total++;
    if (curr[0] > prev[0]) underRepresented.zone1.increase++;
  }
  
  // 二区
  if (prev[1] > avgInterval[1]) {
    overRepresented.zone2.total++;
    if (curr[1] < prev[1]) overRepresented.zone2.decrease++;
  }
  if (prev[1] < avgInterval[1]) {
    underRepresented.zone2.total++;
    if (curr[1] > prev[1]) underRepresented.zone2.increase++;
  }
  
  // 三区
  if (prev[2] > avgInterval[2]) {
    overRepresented.zone3.total++;
    if (curr[2] < prev[2]) overRepresented.zone3.decrease++;
  }
  if (prev[2] < avgInterval[2]) {
    underRepresented.zone3.total++;
    if (curr[2] > prev[2]) underRepresented.zone3.increase++;
  }
}

console.log("\n区间回归概率:");
console.log("区间    偏多时减少概率    偏少时增加概率");
console.log("=".repeat(50));
console.log(`一区    ${(overRepresented.zone1.decrease/overRepresented.zone1.total*100).toFixed(1)}%            ${(underRepresented.zone1.increase/underRepresented.zone1.total*100).toFixed(1)}%`);
console.log(`二区    ${(overRepresented.zone2.decrease/overRepresented.zone2.total*100).toFixed(1)}%            ${(underRepresented.zone2.increase/underRepresented.zone2.total*100).toFixed(1)}%`);
console.log(`三区    ${(overRepresented.zone3.decrease/overRepresented.zone3.total*100).toFixed(1)}%            ${(underRepresented.zone3.increase/underRepresented.zone3.total*100).toFixed(1)}%`);

// 分析连续模式
console.log("\n4. 连续相同区间分布的概率\n");

let consecutiveSame = 0;
let maxConsecutive = 0;
let currentConsecutive = 0;

for (let i = 1; i < totalPeriods; i++) {
  if (intervalHistory[i].join(',') === intervalHistory[i-1].join(',')) {
    currentConsecutive++;
    consecutiveSame++;
  } else {
    maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    currentConsecutive = 0;
  }
}
maxConsecutive = Math.max(maxConsecutive, currentConsecutive);

console.log(`连续相同区间分布的次数: ${consecutiveSame}`);
console.log(`最长连续相同: ${maxConsecutive}期`);
console.log(`连续相同的概率: ${(consecutiveSame/(totalPeriods-1)*100).toFixed(1)}%`);

// 分析最近期数的区间变化
console.log("\n5. 最近期数区间变化趋势\n");

const recentWindows = [5, 10, 20];
for (const window of recentWindows) {
  const recent = intervalHistory.slice(-window);
  const recentAvg = [0, 0, 0];
  for (const iv of recent) {
    recentAvg[0] += iv[0];
    recentAvg[1] += iv[1];
    recentAvg[2] += iv[2];
  }
  recentAvg[0] /= window;
  recentAvg[1] /= window;
  recentAvg[2] /= window;
  
  console.log(`最近${window}期平均: 一区${recentAvg[0].toFixed(2)}个, 二区${recentAvg[1].toFixed(2)}个, 三区${recentAvg[2].toFixed(2)}个`);
  
  // 与历史平均对比
  const diff0 = (recentAvg[0] - avgInterval[0]).toFixed(2);
  const diff1 = (recentAvg[1] - avgInterval[1]).toFixed(2);
  const diff2 = (recentAvg[2] - avgInterval[2]).toFixed(2);
  console.log(`  与历史平均差异: 一区${diff0 > 0 ? '+' : ''}${diff0}, 二区${diff1 > 0 ? '+' : ''}${diff1}, 三区${diff2 > 0 ? '+' : ''}${diff2}`);
}

// 总结
console.log("\n===== 分析结论 =====\n");
console.log("1. 区间分布存在一定的回归倾向：");
console.log("   - 当某区间偏多时，下一期倾向于减少");
console.log("   - 当某区间偏少时，下一期倾向于增加");
console.log("");
console.log("2. 区间分布变化具有随机性：");
console.log("   - 连续相同区间分布的概率较低");
console.log("   - 区间变化难以准确预测");
console.log("");
console.log("3. 动态调整建议：");
console.log("   - 根据前一期区间分布，动态调整当期区间权重");
console.log("   - 前一期偏多的区间，当期适当降低权重");
console.log("   - 前一期偏少的区间，当期适当提高权重");
