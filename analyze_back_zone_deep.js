/**
 * 后区深度分析 - 寻找可利用的规律
 * 直接从optimized_picker.js加载数据
 */

const fs = require('fs');
const path = require('path');

// 从optimized_picker.js中提取ALL_DRAWS
// 使用Function构造器来执行，避免全局污染
const pickerContent = fs.readFileSync(path.join(__dirname, 'optimized_picker.js'), 'utf8');
// 提取从 const ALL_DRAWS = [ 到 ]; 之间的内容
const startMarker = 'const ALL_DRAWS = [';
const startIdx = pickerContent.indexOf(startMarker);
if (startIdx === -1) { console.error('无法找到ALL_DRAWS'); process.exit(1); }
let bracketCount = 0;
let endIdx = -1;
for (let i = startIdx + startMarker.length - 1; i < pickerContent.length; i++) {
  if (pickerContent[i] === '[') bracketCount++;
  else if (pickerContent[i] === ']') {
    bracketCount--;
    if (bracketCount === 0) { endIdx = i + 1; break; }
  }
}
const dataCode = pickerContent.substring(startIdx, endIdx);
const ALL_DRAWS = new Function(`return ${dataCode.replace('const ALL_DRAWS = ', '')}`)();

console.log(`加载 ${ALL_DRAWS.length} 期数据\n`);

// ==================== 分析1：后区号码频率分布 ====================
console.log('═'.repeat(60));
console.log('  分析1: 后区号码出现频率（全局）');
console.log('═'.repeat(60));

const globalFreq = new Array(13).fill(0);
ALL_DRAWS.forEach(d => {
  if (d.back) d.back.forEach(b => globalFreq[b]++);
});
const totalBack = ALL_DRAWS.length * 2;
for (let n = 1; n <= 12; n++) {
  const pct = (globalFreq[n] / totalBack * 100).toFixed(1);
  const bar = '█'.repeat(Math.round(globalFreq[n] / totalBack * 50));
  console.log(`  ${String(n).padStart(2)}: ${String(globalFreq[n]).padStart(3)}次 (${pct}%) ${bar}`);
}
console.log(`  理论期望: 每号${(totalBack/12).toFixed(0)}次 (${(100/12).toFixed(1)}%)`);

// ==================== 分析2：后区号码遗漏分布 ====================
console.log('\n' + '═'.repeat(60));
console.log('  分析2: 当前各号码遗漏期数');
console.log('═'.repeat(60));

const lastIdx = ALL_DRAWS.length - 1;
const gaps = new Array(13).fill(0);
for (let n = 1; n <= 12; n++) {
  let g = 0;
  for (let i = lastIdx; i >= 0; i--) {
    if (ALL_DRAWS[i].back && ALL_DRAWS[i].back.includes(n)) break;
    g++;
  }
  gaps[n] = g;
}
for (let n = 1; n <= 12; n++) {
  const bar = '░'.repeat(Math.min(gaps[n], 30));
  console.log(`  ${String(n).padStart(2)}: 遗漏${String(gaps[n]).padStart(2)}期 ${bar}`);
}

// ==================== 分析3：后区号码对共现 ====================
console.log('\n' + '═'.repeat(60));
console.log('  分析3: 后区号码对共现频率');
console.log('═'.repeat(60));

const pairCount = {};
ALL_DRAWS.forEach(d => {
  if (d.back && d.back.length >= 2) {
    const key = `${Math.min(d.back[0], d.back[1])}-${Math.max(d.back[0], d.back[1])}`;
    pairCount[key] = (pairCount[key] || 0) + 1;
  }
});
const pairArr = Object.entries(pairCount).sort((a, b) => b[1] - a[1]);
console.log('  最常见组合:');
pairArr.slice(0, 10).forEach(([pair, cnt]) => {
  console.log(`    ${pair}: ${cnt}次 (${(cnt/ALL_DRAWS.length*100).toFixed(1)}%)`);
});
console.log('  最少见组合:');
pairArr.slice(-5).forEach(([pair, cnt]) => {
  console.log(`    ${pair}: ${cnt}次 (${(cnt/ALL_DRAWS.length*100).toFixed(1)}%)`);
});

// ==================== 分析4：后区和值分布 ====================
console.log('\n' + '═'.repeat(60));
console.log('  分析4: 后区和值分布');
console.log('═'.repeat(60));

const sumDist = {};
ALL_DRAWS.forEach(d => {
  if (d.back && d.back.length >= 2) {
    const s = d.back[0] + d.back[1];
    sumDist[s] = (sumDist[s] || 0) + 1;
  }
});
const sumArr = Object.entries(sumDist).map(([s, c]) => [+s, c]).sort((a, b) => a[0] - b[0]);
sumArr.forEach(([s, c]) => {
  const bar = '█'.repeat(Math.round(c / ALL_DRAWS.length * 30));
  console.log(`  和值${String(s).padStart(2)}: ${String(c).padStart(3)}次 ${bar}`);
});

// ==================== 分析5：后区奇偶分布 ====================
console.log('\n' + '═'.repeat(60));
console.log('  分析5: 后区奇偶组合');
console.log('═'.repeat(60));

const oeDist = { '2奇0偶': 0, '1奇1偶': 0, '0奇2偶': 0 };
ALL_DRAWS.forEach(d => {
  if (d.back && d.back.length >= 2) {
    const odd = d.back.filter(b => b % 2 === 1).length;
    if (odd === 2) oeDist['2奇0偶']++;
    else if (odd === 1) oeDist['1奇1偶']++;
    else oeDist['0奇2偶']++;
  }
});
Object.entries(oeDist).forEach(([k, v]) => {
  console.log(`  ${k}: ${v}次 (${(v/ALL_DRAWS.length*100).toFixed(1)}%)`);
});

// ==================== 分析6：连续期后区号码关联 ====================
console.log('\n' + '═'.repeat(60));
console.log('  分析6: 连续期后区号码重复/相邻关系');
console.log('═'.repeat(60));

let repeatCount = 0, neighborCount = 0, totalPairs = 0;
for (let i = 1; i < ALL_DRAWS.length; i++) {
  const prev = ALL_DRAWS[i-1].back;
  const curr = ALL_DRAWS[i].back;
  if (!prev || !curr) continue;
  totalPairs++;
  
  // 重复
  const overlap = curr.filter(b => prev.includes(b));
  repeatCount += overlap.length;
  
  // 相邻（±1）
  curr.forEach(c => {
    prev.forEach(p => {
      if (Math.abs(c - p) === 1) neighborCount++;
    });
  });
}
console.log(`  连续期后区重复: 平均${(repeatCount/totalPairs).toFixed(2)}球/对`);
console.log(`  连续期后区相邻: 平均${(neighborCount/totalPairs).toFixed(2)}对/对`);
console.log(`  随机期望重复: ${(2*2/12).toFixed(2)}球/对`);

// ==================== 分析7：前区和值变化 vs 后区 ====================
console.log('\n' + '═'.repeat(60));
console.log('  分析7: 前区和值涨跌 vs 后区号码特征');
console.log('═'.repeat(60));

let upBackFreq = new Array(13).fill(0), upCount = 0;
let downBackFreq = new Array(13).fill(0), downCount = 0;
let flatBackFreq = new Array(13).fill(0), flatCount = 0;

for (let i = 1; i < ALL_DRAWS.length; i++) {
  const prev = ALL_DRAWS[i-1];
  const curr = ALL_DRAWS[i];
  if (!prev.front || !curr.front || !curr.back) continue;
  
  const prevSum = prev.front.reduce((a, b) => a + b, 0);
  const currSum = curr.front.reduce((a, b) => a + b, 0);
  const diff = currSum - prevSum;
  
  if (diff > 10) {
    curr.back.forEach(b => upBackFreq[b]++);
    upCount++;
  } else if (diff < -10) {
    curr.back.forEach(b => downBackFreq[b]++);
    downCount++;
  } else {
    curr.back.forEach(b => flatBackFreq[b]++);
    flatCount++;
  }
}

console.log(`  前区和值上涨(>10): ${upCount}期`);
console.log(`  前区和值下跌(<-10): ${downCount}期`);
console.log(`  前区和值稳定(±10): ${flatCount}期`);
console.log(`\n  和值上涨时后区热号:`);
const upSorted = [...Array(12).keys()].map(i => i+1).sort((a,b) => upBackFreq[b] - upBackFreq[a]);
upSorted.slice(0, 5).forEach(n => console.log(`    ${n}: ${upBackFreq[n]}次`));
console.log(`  和值下跌时后区热号:`);
const downSorted = [...Array(12).keys()].map(i => i+1).sort((a,b) => downBackFreq[b] - downBackFreq[a]);
downSorted.slice(0, 5).forEach(n => console.log(`    ${n}: ${downBackFreq[n]}次`));

// ==================== 分析8：直接预测2球 vs 选6球 ====================
console.log('\n' + '═'.repeat(60));
console.log('  分析8: 直接选2球 vs 选6球命中2球概率');
console.log('═'.repeat(60));

// 模拟：用历史频率直接选2球
let directHit2 = 0, directHit1 = 0, directHit0 = 0;
const testStart = 20; // 从第20期开始测试

for (let i = testStart; i < ALL_DRAWS.length; i++) {
  const actual = ALL_DRAWS[i].back;
  if (!actual || actual.length < 2) continue;
  
  // 用前10期频率选2球
  const freq = new Array(13).fill(0);
  const start = Math.max(0, i - 10);
  for (let j = start; j < i; j++) {
    if (ALL_DRAWS[j].back) ALL_DRAWS[j].back.forEach(b => freq[b]++);
  }
  
  // 遗漏加分
  const gap = new Array(13).fill(0);
  for (let n = 1; n <= 12; n++) {
    let g = 0;
    for (let j = i-1; j >= 0; j--) {
      if (ALL_DRAWS[j].back && ALL_DRAWS[j].back.includes(n)) break;
      g++;
    }
    gap[n] = g;
  }
  
  // 选Top2
  const scored = [...Array(12).keys()].map(n => ({
    n: n + 1,
    score: freq[n+1] + (gap[n+1] >= 6 ? gap[n+1] * 0.8 : 0)
  })).sort((a, b) => b.score - a.score || b.n - a.n);
  
  const predicted = [scored[0].n, scored[1].n];
  const hits = predicted.filter(p => actual.includes(p)).length;
  
  if (hits === 2) directHit2++;
  else if (hits === 1) directHit1++;
  else directHit0++;
}

const directTotal = directHit2 + directHit1 + directHit0;
console.log(`  直接选2球（频率+遗漏Top2）:`);
console.log(`    命中2球: ${directHit2}次 (${(directHit2/directTotal*100).toFixed(1)}%)`);
console.log(`    命中1球: ${directHit1}次 (${(directHit1/directTotal*100).toFixed(1)}%)`);
console.log(`    命中0球: ${directHit0}次 (${(directHit0/directTotal*100).toFixed(1)}%)`);
console.log(`    随机期望: 2球${(1/66*100).toFixed(1)}% 1球${(20/66*100).toFixed(1)}% 0球${(45/66*100).toFixed(1)}%`);

// ==================== 分析9：后区连号出现频率 ====================
console.log('\n' + '═'.repeat(60));
console.log('  分析9: 后区连号（相邻号码）出现频率');
console.log('═'.repeat(60));

let consecutiveCount = 0;
ALL_DRAWS.forEach(d => {
  if (d.back && d.back.length >= 2) {
    if (Math.abs(d.back[0] - d.back[1]) === 1) consecutiveCount++;
  }
});
console.log(`  连号出现: ${consecutiveCount}次 (${(consecutiveCount/ALL_DRAWS.length*100).toFixed(1)}%)`);
console.log(`  理论概率: ${(11/66*100).toFixed(1)}% (11个相邻对/66总对)`);

// ==================== 分析10：后区跨距分布 ====================
console.log('\n' + '═'.repeat(60));
console.log('  分析10: 后区跨距（两球差值）分布');
console.log('═'.repeat(60));

const spanDist = {};
ALL_DRAWS.forEach(d => {
  if (d.back && d.back.length >= 2) {
    const span = Math.abs(d.back[0] - d.back[1]);
    spanDist[span] = (spanDist[span] || 0) + 1;
  }
});
for (let s = 1; s <= 11; s++) {
  const cnt = spanDist[s] || 0;
  const bar = '█'.repeat(Math.round(cnt / ALL_DRAWS.length * 20));
  console.log(`  跨距${String(s).padStart(2)}: ${String(cnt).padStart(3)}次 (${(cnt/ALL_DRAWS.length*100).toFixed(1)}%) ${bar}`);
}

// ==================== 分析11：近5期后区号码 vs 下一期 ====================
console.log('\n' + '═'.repeat(60));
console.log('  分析11: 近5期出现过的后区号码，下一期是否更易出现？');
console.log('═'.repeat(60));

let repeatFromRecent5 = 0, notRepeatFromRecent5 = 0;
for (let i = 5; i < ALL_DRAWS.length; i++) {
  const recent = new Set();
  for (let j = i-5; j < i; j++) {
    if (ALL_DRAWS[j].back) ALL_DRAWS[j].back.forEach(b => recent.add(b));
  }
  const curr = ALL_DRAWS[i].back;
  if (!curr) continue;
  const overlap = curr.filter(b => recent.has(b));
  repeatFromRecent5 += overlap.length;
  notRepeatFromRecent5 += (2 - overlap.length);
}
const totalRecent5 = repeatFromRecent5 + notRepeatFromRecent5;
console.log(`  近5期出现的号码在下一期重复: ${repeatFromRecent5}次 (${(repeatFromRecent5/totalRecent5*100).toFixed(1)}%)`);
console.log(`  近5期未出现的号码在下一期出现: ${notRepeatFromRecent5}次 (${(notRepeatFromRecent5/totalRecent5*100).toFixed(1)}%)`);
console.log(`  理论随机: 近5期出现过的号码占${(10/12*100).toFixed(1)}%（10/12个号码）`);

// ==================== 分析12：后区号码冷热转换 ====================
console.log('\n' + '═'.repeat(60));
console.log('  分析12: 后区号码冷热转换规律');
console.log('═'.repeat(60));

// 分析：连续3期未出现的号码，下一期出现概率
let coldAppear = 0, coldTotal = 0;
for (let i = 3; i < ALL_DRAWS.length; i++) {
  const coldNums = [];
  for (let n = 1; n <= 12; n++) {
    let missing = true;
    for (let j = i-3; j < i; j++) {
      if (ALL_DRAWS[j].back && ALL_DRAWS[j].back.includes(n)) { missing = false; break; }
    }
    if (missing) coldNums.push(n);
  }
  coldTotal += coldNums.length;
  const curr = ALL_DRAWS[i].back;
  if (curr) {
    coldAppear += curr.filter(b => coldNums.includes(b)).length;
  }
}
console.log(`  连续3期未出现的号码，下一期出现: ${coldAppear}/${coldTotal} (${(coldAppear/coldTotal*100).toFixed(1)}%)`);
console.log(`  理论随机: ${(2/12*100).toFixed(1)}%`);

// 连续5期未出现
let cold5Appear = 0, cold5Total = 0;
for (let i = 5; i < ALL_DRAWS.length; i++) {
  const coldNums = [];
  for (let n = 1; n <= 12; n++) {
    let missing = true;
    for (let j = i-5; j < i; j++) {
      if (ALL_DRAWS[j].back && ALL_DRAWS[j].back.includes(n)) { missing = false; break; }
    }
    if (missing) coldNums.push(n);
  }
  cold5Total += coldNums.length;
  const curr = ALL_DRAWS[i].back;
  if (curr) {
    cold5Appear += curr.filter(b => coldNums.includes(b)).length;
  }
}
console.log(`  连续5期未出现的号码，下一期出现: ${cold5Appear}/${cold5Total} (${(cold5Total > 0 ? (cold5Appear/cold5Total*100).toFixed(1) : 'N/A')}%)`);
