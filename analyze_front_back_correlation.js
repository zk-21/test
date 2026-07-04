/**
 * 分析前区选号结果与后区号码的关联
 */

const fs = require('fs');
const path = require('path');

// 加载数据
const pickerContent = fs.readFileSync(path.join(__dirname, 'optimized_picker.js'), 'utf8');
const startMarker = 'const ALL_DRAWS = [';
const startIdx = pickerContent.indexOf(startMarker);
let bracketCount = 0, endIdx = -1;
for (let i = startIdx + startMarker.length - 1; i < pickerContent.length; i++) {
  if (pickerContent[i] === '[') bracketCount++;
  else if (pickerContent[i] === ']') { bracketCount--; if (bracketCount === 0) { endIdx = i + 1; break; } }
}
const ALL_DRAWS = new Function(`return ${pickerContent.substring(startIdx, endIdx).replace('const ALL_DRAWS = ', '')}`)();

console.log(`加载 ${ALL_DRAWS.length} 期数据\n`);

// ==================== 1. 前区和值 vs 后区号码 ====================
console.log('═'.repeat(60));
console.log('  1. 前区和值区间 vs 后区热号');
console.log('═'.repeat(60));

const sumGroups = {
  low: { range: [0, 80], backFreq: new Array(13).fill(0), count: 0 },
  mid: { range: [81, 120], backFreq: new Array(13).fill(0), count: 0 },
  high: { range: [121, 999], backFreq: new Array(13).fill(0), count: 0 }
};

ALL_DRAWS.forEach(d => {
  if (!d.front || !d.back) return;
  const sum = d.front.reduce((a, b) => a + b, 0);
  const group = sum <= 80 ? 'low' : sum <= 120 ? 'mid' : 'high';
  sumGroups[group].count++;
  d.back.forEach(b => sumGroups[group].backFreq[b]++);
});

Object.entries(sumGroups).forEach(([name, g]) => {
  console.log(`\n  ${name} (${g.range[0]}-${g.range[1]}): ${g.count}期`);
  const top3 = [...Array(12).keys()].map(i => i + 1).sort((a, b) => g.backFreq[b] - g.backFreq[a]).slice(0, 3);
  top3.forEach(n => console.log(`    ${n}: ${g.backFreq[n]}次 (${(g.backFreq[n]/g.count*100).toFixed(1)}%)`));
});

// ==================== 2. 前区奇偶比 vs 后区奇偶 ====================
console.log('\n' + '═'.repeat(60));
console.log('  2. 前区奇偶比 vs 后区奇偶');
console.log('═'.repeat(60));

const oeGroups = {};
ALL_DRAWS.forEach(d => {
  if (!d.front || !d.back) return;
  const frontOdd = d.front.filter(n => n % 2 === 1).length;
  const key = `${frontOdd}奇${5 - frontOdd}偶`;
  if (!oeGroups[key]) oeGroups[key] = { count: 0, backOdd: 0, backEven: 0 };
  oeGroups[key].count++;
  oeGroups[key].backOdd += d.back.filter(n => n % 2 === 1).length;
  oeGroups[key].backEven += d.back.filter(n => n % 2 === 0).length;
});

Object.entries(oeGroups).sort((a, b) => b[1].count - a[1].count).forEach(([key, g]) => {
  console.log(`  ${key}: ${g.count}期 → 后区奇偶比 ${(g.backOdd/g.count).toFixed(2)}:${(g.backEven/g.count).toFixed(2)}`);
});

// ==================== 3. 前区大小比 vs 后区大小 ====================
console.log('\n' + '═'.repeat(60));
console.log('  3. 前区大小比 vs 后区大小');
console.log('═'.repeat(60));

const sizeGroups = {};
ALL_DRAWS.forEach(d => {
  if (!d.front || !d.back) return;
  const frontBig = d.front.filter(n => n >= 18).length;
  const key = `${frontBig}大${5 - frontBig}小`;
  if (!sizeGroups[key]) sizeGroups[key] = { count: 0, backBig: 0, backSmall: 0 };
  sizeGroups[key].count++;
  sizeGroups[key].backBig += d.back.filter(n => n >= 7).length;
  sizeGroups[key].backSmall += d.back.filter(n => n < 7).length;
});

Object.entries(sizeGroups).sort((a, b) => b[1].count - a[1].count).forEach(([key, g]) => {
  console.log(`  ${key}: ${g.count}期 → 后区大小比 ${(g.backBig/g.count).toFixed(2)}:${(g.backSmall/g.count).toFixed(2)}`);
});

// ==================== 4. 前区跨度 vs 后区跨度 ====================
console.log('\n' + '═'.repeat(60));
console.log('  4. 前区跨度 vs 后区跨度');
console.log('═'.repeat(60));

const spanGroups = { low: { count: 0, backSpan: 0 }, mid: { count: 0, backSpan: 0 }, high: { count: 0, backSpan: 0 } };
ALL_DRAWS.forEach(d => {
  if (!d.front || !d.back || d.front.length < 5 || d.back.length < 2) return;
  const frontSpan = Math.max(...d.front) - Math.min(...d.front);
  const backSpan = Math.abs(d.back[0] - d.back[1]);
  const group = frontSpan <= 20 ? 'low' : frontSpan <= 28 ? 'mid' : 'high';
  spanGroups[group].count++;
  spanGroups[group].backSpan += backSpan;
});

Object.entries(spanGroups).forEach(([name, g]) => {
  if (g.count > 0) console.log(`  前区跨度${name}: ${g.count}期 → 平均后区跨度 ${(g.backSpan/g.count).toFixed(2)}`);
});

// ==================== 5. 前区号码尾数 vs 后区号码 ====================
console.log('\n' + '═'.repeat(60));
console.log('  5. 前区尾数分布 vs 后区号码');
console.log('═'.repeat(60));

const tailGroups = {};
ALL_DRAWS.forEach(d => {
  if (!d.front || !d.back) return;
  const frontTails = new Set(d.front.map(n => n % 10));
  const key = [...frontTails].sort().join(',');
  if (!tailGroups[key]) tailGroups[key] = { count: 0, backFreq: new Array(13).fill(0) };
  tailGroups[key].count++;
  d.back.forEach(b => tailGroups[key].backFreq[b]++);
});

// 找最常见的前区尾数组合
const topTailGroups = Object.entries(tailGroups).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
topTailGroups.forEach(([key, g]) => {
  if (g.count >= 3) {
    const topBack = [...Array(12).keys()].map(i => i + 1).sort((a, b) => g.backFreq[b] - g.backFreq[a]).slice(0, 2);
    console.log(`  前区尾数[${key}]: ${g.count}期 → 后区热号 ${topBack.join(',')}`);
  }
});

// ==================== 6. 前区重复号码 vs 后区 ====================
console.log('\n' + '═'.repeat(60));
console.log('  6. 前区重复号码数量 vs 后区重复');
console.log('═'.repeat(60));

let repeatStats = {};
for (let i = 1; i < ALL_DRAWS.length; i++) {
  const prev = ALL_DRAWS[i - 1];
  const curr = ALL_DRAWS[i];
  if (!prev.front || !curr.front || !prev.back || !curr.back) continue;
  
  const frontRepeat = curr.front.filter(n => prev.front.includes(n)).length;
  const backRepeat = curr.back.filter(b => prev.back.includes(b)).length;
  
  const key = `前区重复${frontRepeat}个`;
  if (!repeatStats[key]) repeatStats[key] = { count: 0, backRepeat0: 0, backRepeat1: 0, backRepeat2: 0 };
  repeatStats[key].count++;
  repeatStats[key][`backRepeat${backRepeat}`]++;
}

Object.entries(repeatStats).sort((a, b) => b[1].count - a[1].count).forEach(([key, g]) => {
  const r0 = g.backRepeat0 || 0;
  const r1 = g.backRepeat1 || 0;
  const r2 = g.backRepeat2 || 0;
  console.log(`  ${key}: ${g.count}期 → 后区重复0球${r0}次( ${(r0/g.count*100).toFixed(0)}%) 1球${r1}次( ${(r1/g.count*100).toFixed(0)}%) 2球${r2}次`);
});

// ==================== 7. 综合：前区特征预测后区 ====================
console.log('\n' + '═'.repeat(60));
console.log('  7. 综合：基于前区特征的后区预测准确率');
console.log('═'.repeat(60));

// 简单规则：如果前区和值低，后区选大号；如果前区和值高，后区选小号
let ruleHit = 0, ruleTotal = 0;
for (let i = 10; i < ALL_DRAWS.length; i++) {
  const curr = ALL_DRAWS[i];
  const prev = ALL_DRAWS[i - 1];
  if (!curr.front || !curr.back || !prev.front || !prev.back) continue;
  
  const frontSum = curr.front.reduce((a, b) => a + b, 0);
  const prevFrontSum = prev.front.reduce((a, b) => a + b, 0);
  
  // 规则：前区和值上涨时，后区选偏小号码；下跌时选偏大
  let predicted = [];
  if (frontSum > prevFrontSum) {
    // 和值上涨，后区偏小（1-6）
    predicted = [1, 2, 3, 4, 5, 6];
  } else {
    // 和值下跌，后区偏大（7-12）
    predicted = [7, 8, 9, 10, 11, 12];
  }
  
  const hits = predicted.filter(p => curr.back.includes(p)).length;
  ruleTotal++;
  if (hits >= 1) ruleHit++;
}
console.log(`  前区和值涨跌预测后区大小: ${ruleHit}/${ruleTotal} = ${(ruleHit/ruleTotal*100).toFixed(1)}% ≥1球命中率`);
