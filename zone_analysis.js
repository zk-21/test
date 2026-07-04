// 分区间深度分析脚本
const fs = require('fs');
const raw = fs.readFileSync('all_draws.json', 'utf-8');
const draws = JSON.parse(raw);
draws.sort((a, b) => parseInt(a.issue) - parseInt(b.issue));

console.log(`数据范围: ${draws[0].issue} ~ ${draws[draws.length-1].issue} (共${draws.length}期)`);
console.log("=".repeat(100));

function getZone(n) { return n <= 12 ? 0 : n <= 24 ? 1 : 2; }
const zoneNames = ['一区(1-12)', '二区(13-24)', '三区(25-35)'];
const recentN = 30;

// 预计算区间比
const zoneRatios = draws.map(d => {
  const z = [0, 0, 0];
  d.front.forEach(n => z[getZone(n)]++);
  return z;
});

// ═══ 1. 区间比变化趋势 ═══
console.log("\n" + "=".repeat(100));
console.log("1. 区间比变化趋势（每10期滑动窗口）");
console.log("=".repeat(100));

const windowSize = 10;
console.log(`${'窗口'.padEnd(16)} | ${'一区均'.padEnd(8)} | ${'二区均'.padEnd(8)} | ${'三区均'.padEnd(8)} | ${'最常见区间比'.padEnd(14)} | 趋势`);
console.log("-".repeat(90));

for (let start = 0; start <= draws.length - windowSize; start += windowSize) {
  const end = Math.min(start + windowSize, draws.length);
  const actualSize = end - start;
  const sum = [0, 0, 0];
  const ratioCount = {};
  for (let i = start; i < end; i++) {
    for (let z = 0; z < 3; z++) sum[z] += zoneRatios[i][z];
    const key = zoneRatios[i].join(':');
    ratioCount[key] = (ratioCount[key] || 0) + 1;
  }
  const avg = sum.map(s => (s / actualSize).toFixed(2));
  const topRatio = Object.entries(ratioCount).sort((a, b) => b[1] - a[1])[0];
  const mid = start + Math.floor(actualSize / 2);
  const firstHalf = [0, 0, 0], secondHalf = [0, 0, 0];
  for (let i = start; i < mid; i++) for (let z = 0; z < 3; z++) firstHalf[z] += zoneRatios[i][z];
  for (let i = mid; i < end; i++) for (let z = 0; z < 3; z++) secondHalf[z] += zoneRatios[i][z];
  const halfSize = mid - start;
  const trends = [];
  for (let z = 0; z < 3; z++) {
    const diff = secondHalf[z] / (actualSize - halfSize) - firstHalf[z] / halfSize;
    if (diff > 0.15) trends.push(`${zoneNames[z].slice(0,2)}↑`);
    else if (diff < -0.15) trends.push(`${zoneNames[z].slice(0,2)}↓`);
  }
  const period = `${draws[start].issue.slice(-3)}-${draws[end-1].issue.slice(-3)}`;
  console.log(`${period.padEnd(16)} | ${avg[0].padEnd(8)} | ${avg[1].padEnd(8)} | ${avg[2].padEnd(8)} | ${topRatio[0].padEnd(8)}(${topRatio[1]}次) | ${trends.join(' ') || '平稳'}`);
}

// 区间比分布统计
console.log("\n--- 区间比分布统计 (全部181期) ---");
const allRatioCount = {};
zoneRatios.forEach(r => { const key = r.join(':'); allRatioCount[key] = (allRatioCount[key] || 0) + 1; });
Object.entries(allRatioCount).sort((a, b) => b[1] - a[1]).forEach(([ratio, count]) => {
  console.log(`  ${ratio}: ${count}次 (${(count/draws.length*100).toFixed(1)}%)`);
});

// ═══ 2. 各区间尾号分布 ═══
console.log("\n" + "=".repeat(100));
console.log("2. 各区间尾号分布");
console.log("=".repeat(100));

for (let z = 0; z < 3; z++) {
  const tailDist = new Array(10).fill(0);
  let total = 0;
  draws.forEach(d => d.front.filter(n => getZone(n) === z).forEach(n => { tailDist[n % 10]++; total++; }));
  console.log(`\n  ${zoneNames[z]} 尾号分布 (共${total}球):`);
  const maxTail = Math.max(...tailDist);
  const minTail = Math.min(...tailDist);
  for (let t = 0; t < 10; t++) {
    const bar = '█'.repeat(Math.round(tailDist[t] / maxTail * 20));
    const marker = tailDist[t] === maxTail ? ' ← 最热' : tailDist[t] === minTail ? ' ← 最冷' : '';
    console.log(`    尾号${t}: ${String(tailDist[t]).padStart(3)}次 (${(tailDist[t]/total*100).toFixed(1)}%) ${bar}${marker}`);
  }
}

// 尾号冷热变化
console.log("\n--- 尾号冷热变化（近30期 vs 前期）---");
for (let z = 0; z < 3; z++) {
  const recentTail = new Array(10).fill(0), earlyTail = new Array(10).fill(0);
  let recentTotal = 0, earlyTotal = 0;
  draws.forEach((d, i) => {
    d.front.filter(n => getZone(n) === z).forEach(n => {
      if (i >= draws.length - recentN) { recentTail[n % 10]++; recentTotal++; }
      else { earlyTail[n % 10]++; earlyTotal++; }
    });
  });
  console.log(`\n  ${zoneNames[z]}:`);
  const changes = [];
  for (let t = 0; t < 10; t++) {
    const recentRate = recentTotal > 0 ? recentTail[t] / recentTotal : 0;
    const earlyRate = earlyTotal > 0 ? earlyTail[t] / earlyTotal : 0;
    const diff = recentRate - earlyRate;
    if (Math.abs(diff) > 0.03) changes.push({ tail: t, diff });
  }
  changes.sort((a, b) => b.diff - a.diff);
  const heating = changes.filter(c => c.diff > 0);
  const cooling = changes.filter(c => c.diff < 0);
  if (heating.length) console.log(`    升温尾号: ${heating.map(c => `${c.tail}(+${(c.diff*100).toFixed(1)}%)`).join(', ')}`);
  if (cooling.length) console.log(`    降温尾号: ${cooling.map(c => `${c.tail}(${(c.diff*100).toFixed(1)}%)`).join(', ')}`);
}

// ═══ 3. 各区间重复号分析 ═══
console.log("\n" + "=".repeat(100));
console.log("3. 各区间重复号（与上期相同号码）分析");
console.log("=".repeat(100));

for (let z = 0; z < 3; z++) {
  let repeatCount = 0, totalPeriods = 0;
  const repeatDist = {};
  const repeatGaps = [];
  let lastRepeatIdx = -1;
  for (let i = 1; i < draws.length; i++) {
    const prev = new Set(draws[i-1].front.filter(n => getZone(n) === z));
    const curr = draws[i].front.filter(n => getZone(n) === z);
    const repeats = curr.filter(n => prev.has(n));
    totalPeriods++;
    if (repeats.length > 0) { repeatCount++; if (lastRepeatIdx >= 0) repeatGaps.push(i - lastRepeatIdx); lastRepeatIdx = i; }
    repeatDist[repeats.length] = (repeatDist[repeats.length] || 0) + 1;
  }
  const avgGap = repeatGaps.length > 0 ? (repeatGaps.reduce((a,b) => a+b, 0) / repeatGaps.length).toFixed(1) : 'N/A';
  console.log(`\n  ${zoneNames[z]}:`);
  console.log(`    有重复号的期数: ${repeatCount}/${totalPeriods} (${(repeatCount/totalPeriods*100).toFixed(1)}%)`);
  console.log(`    重复号间隔均值: ${avgGap}期`);
  Object.entries(repeatDist).sort((a,b) => parseInt(a[0]) - parseInt(b[0])).forEach(([cnt, freq]) => {
    console.log(`    重复${cnt}个: ${freq}次 (${(freq/totalPeriods*100).toFixed(1)}%)`);
  });
  let recentRepeat = 0;
  for (let i = draws.length - recentN; i < draws.length; i++) {
    const prev = new Set(draws[i-1].front.filter(n => getZone(n) === z));
    const curr = draws[i].front.filter(n => getZone(n) === z);
    if (curr.some(n => prev.has(n))) recentRepeat++;
  }
  console.log(`    近${recentN}期重复率: ${(recentRepeat/recentN*100).toFixed(1)}%`);
}

// ═══ 4. 各区间邻号分析 ═══
console.log("\n" + "=".repeat(100));
console.log("4. 各区间邻号（与上期号码±1）分析");
console.log("=".repeat(100));

for (let z = 0; z < 3; z++) {
  let neighborCount = 0, totalPeriods = 0;
  const neighborDist = {};
  for (let i = 1; i < draws.length; i++) {
    const prev = draws[i-1].front.filter(n => getZone(n) === z);
    const curr = draws[i].front.filter(n => getZone(n) === z);
    const neighbors = curr.filter(n => prev.some(p => Math.abs(n - p) === 1));
    totalPeriods++;
    if (neighbors.length > 0) neighborCount++;
    neighborDist[neighbors.length] = (neighborDist[neighbors.length] || 0) + 1;
  }
  console.log(`\n  ${zoneNames[z]}:`);
  console.log(`    有邻号的期数: ${neighborCount}/${totalPeriods} (${(neighborCount/totalPeriods*100).toFixed(1)}%)`);
  Object.entries(neighborDist).sort((a,b) => parseInt(a[0]) - parseInt(b[0])).forEach(([cnt, freq]) => {
    console.log(`    邻号${cnt}个: ${freq}次 (${(freq/totalPeriods*100).toFixed(1)}%)`);
  });
  let recentNeighbor = 0;
  for (let i = draws.length - recentN; i < draws.length; i++) {
    const prev = draws[i-1].front.filter(n => getZone(n) === z);
    const curr = draws[i].front.filter(n => getZone(n) === z);
    if (curr.some(n => prev.some(p => Math.abs(n - p) === 1))) recentNeighbor++;
  }
  console.log(`    近${recentN}期邻号率: ${(recentNeighbor/recentN*100).toFixed(1)}%`);
}

// ═══ 5. 各区间跨度分析 ═══
console.log("\n" + "=".repeat(100));
console.log("5. 各区间跨度（区间内最大-最小）分析");
console.log("=".repeat(100));

for (let z = 0; z < 3; z++) {
  const spans = [];
  const zoneMin = z === 0 ? 1 : z === 1 ? 13 : 25;
  const zoneMax = z === 0 ? 12 : z === 1 ? 24 : 35;
  draws.forEach(d => {
    const zoneNums = d.front.filter(n => getZone(n) === z).sort((a, b) => a - b);
    if (zoneNums.length >= 2) spans.push(zoneNums[zoneNums.length - 1] - zoneNums[0]);
    else if (zoneNums.length === 1) spans.push(0);
    else spans.push(-1);
  });
  const validSpans = spans.filter(s => s >= 0);
  const nonZeroSpans = spans.filter(s => s > 0);
  const avgSpan = validSpans.length > 0 ? (validSpans.reduce((a,b) => a+b, 0) / validSpans.length).toFixed(1) : 'N/A';
  const avgNonZero = nonZeroSpans.length > 0 ? (nonZeroSpans.reduce((a,b) => a+b, 0) / nonZeroSpans.length).toFixed(1) : 'N/A';
  console.log(`\n  ${zoneNames[z]} (最大可能跨度: ${zoneMax - zoneMin}):`);
  console.log(`    平均跨度: ${avgSpan} (含0球期)  ${avgNonZero} (仅>=2球期)`);
  console.log(`    0球期数: ${spans.filter(s => s === -1).length}  1球期数(跨度0): ${spans.filter(s => s === 0).length}`);
  const spanBuckets = { '0': 0, '1-3': 0, '4-6': 0, '7-9': 0, '10+': 0 };
  validSpans.forEach(s => {
    if (s === 0) spanBuckets['0']++;
    else if (s <= 3) spanBuckets['1-3']++;
    else if (s <= 6) spanBuckets['4-6']++;
    else if (s <= 9) spanBuckets['7-9']++;
    else spanBuckets['10+']++;
  });
  console.log(`    跨度分布:`);
  Object.entries(spanBuckets).forEach(([range, count]) => {
    if (count > 0) console.log(`      ${range.padEnd(5)}: ${count}次 (${(count/validSpans.length*100).toFixed(1)}%)`);
  });
  const recentSpans = spans.slice(-recentN).filter(s => s >= 0);
  const earlySpans = spans.slice(0, -recentN).filter(s => s >= 0);
  const recentAvg = recentSpans.length > 0 ? (recentSpans.reduce((a,b) => a+b, 0) / recentSpans.length).toFixed(1) : 'N/A';
  const earlyAvg = earlySpans.length > 0 ? (earlySpans.reduce((a,b) => a+b, 0) / earlySpans.length).toFixed(1) : 'N/A';
  console.log(`    近${recentN}期平均跨度: ${recentAvg}  vs  前期: ${earlyAvg}`);
}

// ═══ 6. 各区间和值分析 ═══
console.log("\n" + "=".repeat(100));
console.log("6. 各区间和值分析");
console.log("=".repeat(100));

for (let z = 0; z < 3; z++) {
  const sums = draws.map(d => d.front.filter(n => getZone(n) === z).reduce((a, b) => a + b, 0));
  const avgSum = (sums.reduce((a,b) => a+b, 0) / sums.length).toFixed(1);
  const sorted = [...sums].sort((a,b) => a-b);
  const median = sorted[Math.floor(sorted.length / 2)];
  console.log(`\n  ${zoneNames[z]}:`);
  console.log(`    和值范围: ${Math.min(...sums)} ~ ${Math.max(...sums)}  平均: ${avgSum}  中位数: ${median}`);
  const recentSums = sums.slice(-recentN);
  const earlySums = sums.slice(0, -recentN);
  const recentAvg = (recentSums.reduce((a,b) => a+b, 0) / recentSums.length).toFixed(1);
  const earlyAvg = (earlySums.reduce((a,b) => a+b, 0) / earlySums.length).toFixed(1);
  console.log(`    近${recentN}期平均和值: ${recentAvg}  vs  前期: ${earlyAvg}`);
  console.log(`    最近10期和值: ${sums.slice(-10).join(', ')}`);
}

// ═══ 7. 各区间出球数量变化趋势 ═══
console.log("\n" + "=".repeat(100));
console.log("7. 各区间出球数量变化趋势");
console.log("=".repeat(100));

for (let z = 0; z < 3; z++) {
  const counts = zoneRatios.map(r => r[z]);
  const avg = (counts.reduce((a,b) => a+b, 0) / counts.length).toFixed(2);
  let maxConsec0 = 0, currConsec0 = 0;
  counts.forEach(c => { if (c === 0) { currConsec0++; maxConsec0 = Math.max(maxConsec0, currConsec0); } else currConsec0 = 0; });
  let maxConsec3 = 0, currConsec3 = 0;
  counts.forEach(c => { if (c >= 3) { currConsec3++; maxConsec3 = Math.max(maxConsec3, currConsec3); } else currConsec3 = 0; });
  console.log(`\n  ${zoneNames[z]}:`);
  console.log(`    平均出球: ${avg}个/期`);
  for (let c = 0; c <= 5; c++) {
    const cnt = counts.filter(x => x === c).length;
    console.log(`    ${c}球: ${cnt}次 (${(cnt/counts.length*100).toFixed(1)}%)`);
  }
  console.log(`    最长连续断区: ${maxConsec0}期  最长连续>=3球: ${maxConsec3}期`);
  const recentCounts = counts.slice(-recentN);
  const earlyCounts = counts.slice(0, -recentN);
  const recentAvg = (recentCounts.reduce((a,b) => a+b, 0) / recentCounts.length).toFixed(2);
  const earlyAvg = (earlyCounts.reduce((a,b) => a+b, 0) / earlyCounts.length).toFixed(2);
  console.log(`    近${recentN}期平均: ${recentAvg}  vs  前期: ${earlyAvg}`);
  console.log(`    最近10期出球: [${counts.slice(-10).join(', ')}]`);
}

// ═══ 8. 各区间奇偶比分析 ═══
console.log("\n" + "=".repeat(100));
console.log("8. 各区间奇偶比分析");
console.log("=".repeat(100));

for (let z = 0; z < 3; z++) {
  let oddTotal = 0, evenTotal = 0;
  const ratios = {};
  draws.forEach(d => {
    const zoneNums = d.front.filter(n => getZone(n) === z);
    const odd = zoneNums.filter(n => n % 2 === 1).length;
    const even = zoneNums.length - odd;
    oddTotal += odd; evenTotal += even;
    const key = `${odd}:${even}`;
    ratios[key] = (ratios[key] || 0) + 1;
  });
  console.log(`\n  ${zoneNames[z]} (奇${oddTotal}:偶${evenTotal}):`);
  Object.entries(ratios).sort((a,b) => b[1] - a[1]).forEach(([ratio, count]) => {
    console.log(`    奇:偶=${ratio}: ${count}次 (${(count/draws.length*100).toFixed(1)}%)`);
  });
}

// ═══ 9. 各区间号码频率 ═══
console.log("\n" + "=".repeat(100));
console.log("9. 各区间号码出现频率");
console.log("=".repeat(100));

for (let z = 0; z < 3; z++) {
  const zoneMin = z === 0 ? 1 : z === 1 ? 13 : 25;
  const zoneMax = z === 0 ? 12 : z === 1 ? 24 : 35;
  const freq = {};
  for (let n = zoneMin; n <= zoneMax; n++) freq[n] = 0;
  draws.forEach(d => d.front.filter(n => getZone(n) === z).forEach(n => freq[n]++));
  const maxFreq = Math.max(...Object.values(freq));
  const minFreq = Math.min(...Object.values(freq));
  const avgFreq = (Object.values(freq).reduce((a,b) => a+b, 0) / Object.values(freq).length).toFixed(1);
  console.log(`\n  ${zoneNames[z]} (平均${avgFreq}次):`);
  for (let n = zoneMin; n <= zoneMax; n++) {
    const bar = '█'.repeat(Math.round(freq[n] / maxFreq * 25));
    const marker = freq[n] === maxFreq ? ' ★最热' : freq[n] === minFreq ? ' ☆最冷' : '';
    console.log(`    ${String(n).padStart(2)}号: ${String(freq[n]).padStart(3)}次 ${bar}${marker}`);
  }
  const recentFreq = {};
  for (let n = zoneMin; n <= zoneMax; n++) recentFreq[n] = 0;
  draws.slice(-recentN).forEach(d => d.front.filter(n => getZone(n) === z).forEach(n => recentFreq[n]++));
  const hotRecent = Object.entries(recentFreq).sort((a,b) => b[1] - a[1]).slice(0, 3);
  const coldRecent = Object.entries(recentFreq).sort((a,b) => a[1] - b[1]).slice(0, 3);
  console.log(`    近${recentN}期最热: ${hotRecent.map(([n,c]) => `${n}号(${c}次)`).join(', ')}`);
  console.log(`    近${recentN}期最冷: ${coldRecent.map(([n,c]) => `${n}号(${c}次)`).join(', ')}`);
}

// ═══ 10. 各区间转移概率矩阵 ═══
console.log("\n" + "=".repeat(100));
console.log("10. 各区间出球数量转移概率（本期→下期）");
console.log("=".repeat(100));

for (let z = 0; z < 3; z++) {
  const transition = {};
  for (let i = 0; i < draws.length - 1; i++) {
    const curr = zoneRatios[i][z];
    const next = zoneRatios[i + 1][z];
    if (!transition[curr]) transition[curr] = {};
    transition[curr][next] = (transition[curr][next] || 0) + 1;
  }
  console.log(`\n  ${zoneNames[z]} 转移概率:`);
  Object.keys(transition).sort((a,b) => parseInt(a) - parseInt(b)).forEach(from => {
    const total = Object.values(transition[from]).reduce((a,b) => a+b, 0);
    const probs = Object.entries(transition[from]).sort((a,b) => parseInt(a[0]) - parseInt(b[0]))
      .map(([to, count]) => `${to}:${(count/total*100).toFixed(0)}%`).join('  ');
    console.log(`    ${from}球(${String(total).padStart(3)}次) → ${probs}`);
  });
}

// ═══ 11. 综合趋势总结 ═══
console.log("\n" + "=".repeat(100));
console.log("11. 综合趋势总结（近30期 vs 全部181期对比）");
console.log("=".repeat(100));

function calcStats(drawSet) {
  const zSum = [0, 0, 0];
  drawSet.forEach(d => d.front.forEach(n => zSum[getZone(n)]++));
  const total = drawSet.length * 5;
  const zoneRatio = zSum.map(s => (s / total * 100).toFixed(1));
  const sums = drawSet.map(d => d.front.reduce((a,b) => a+b, 0));
  const avgSum = (sums.reduce((a,b) => a+b, 0) / sums.length).toFixed(1);
  const spans = drawSet.map(d => { const s = [...d.front].sort((a,b) => a-b); return s[s.length-1] - s[0]; });
  const avgSpan = (spans.reduce((a,b) => a+b, 0) / spans.length).toFixed(1);
  let repeatRate = 0;
  for (let i = 1; i < drawSet.length; i++) {
    const prev = new Set(drawSet[i-1].front);
    if (drawSet[i].front.some(n => prev.has(n))) repeatRate++;
  }
  repeatRate = ((repeatRate / (drawSet.length - 1)) * 100).toFixed(1);
  let neighborRate = 0;
  for (let i = 1; i < drawSet.length; i++) {
    const prev = drawSet[i-1].front;
    if (drawSet[i].front.some(n => prev.some(p => Math.abs(n - p) === 1))) neighborRate++;
  }
  neighborRate = ((neighborRate / (drawSet.length - 1)) * 100).toFixed(1);
  let odd = 0;
  drawSet.forEach(d => d.front.forEach(n => { if (n % 2 === 1) odd++; }));
  const oddRate = (odd / total * 100).toFixed(1);
  return { zoneRatio, avgSum, avgSpan, repeatRate, neighborRate, oddRate };
}

const allStats = calcStats(draws);
const recentStats = calcStats(draws.slice(-recentN));
const earlyStats = calcStats(draws.slice(0, -recentN));

console.log(`\n  ${'指标'.padEnd(16)} | ${'全部181期'.padEnd(12)} | ${'前151期'.padEnd(12)} | ${'近30期'.padEnd(12)} | 变化趋势`);
console.log("  " + "-".repeat(80));
console.log(`  ${'区间比(一:二:三)'.padEnd(16)} | ${allStats.zoneRatio.join(':').padEnd(12)} | ${earlyStats.zoneRatio.join(':').padEnd(12)} | ${recentStats.zoneRatio.join(':').padEnd(12)} |`);
console.log(`  ${'平均和值'.padEnd(16)} | ${allStats.avgSum.padEnd(12)} | ${earlyStats.avgSum.padEnd(12)} | ${recentStats.avgSum.padEnd(12)} | ${parseFloat(recentStats.avgSum) > parseFloat(earlyStats.avgSum) ? '↑ 和值上升' : '↓ 和值下降'}`);
console.log(`  ${'平均跨度'.padEnd(16)} | ${allStats.avgSpan.padEnd(12)} | ${earlyStats.avgSpan.padEnd(12)} | ${recentStats.avgSpan.padEnd(12)} | ${parseFloat(recentStats.avgSpan) > parseFloat(earlyStats.avgSpan) ? '↑ 跨度增大' : '↓ 跨度减小'}`);
console.log(`  ${'重复号率'.padEnd(16)} | ${(allStats.repeatRate + '%').padEnd(12)} | ${(earlyStats.repeatRate + '%').padEnd(12)} | ${(recentStats.repeatRate + '%').padEnd(12)} | ${parseFloat(recentStats.repeatRate) > parseFloat(earlyStats.repeatRate) ? '↑ 重复增多' : '↓ 重复减少'}`);
console.log(`  ${'邻号率'.padEnd(16)} | ${(allStats.neighborRate + '%').padEnd(12)} | ${(earlyStats.neighborRate + '%').padEnd(12)} | ${(recentStats.neighborRate + '%').padEnd(12)} | ${parseFloat(recentStats.neighborRate) > parseFloat(earlyStats.neighborRate) ? '↑ 邻号增多' : '↓ 邻号减少'}`);
console.log(`  ${'奇数占比'.padEnd(16)} | ${(allStats.oddRate + '%').padEnd(12)} | ${(earlyStats.oddRate + '%').padEnd(12)} | ${(recentStats.oddRate + '%').padEnd(12)} | ${parseFloat(recentStats.oddRate) > parseFloat(earlyStats.oddRate) ? '↑ 奇数增多' : '↓ 偶数增多'}`);

console.log("\n完成!");
