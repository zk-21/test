// 深入分析尾号6为什么预测不到
const __isNode = true;
const fs = require('fs');
const path = require('path');

const rawJs = fs.readFileSync(path.join(__dirname, 'all_draws.js'), 'utf8');
const match = rawJs.match(/window\.ALL_DRAWS_DATA\s*=\s*(\[[\s\S]*?\]);/);
const ALL_DRAWS_DATA = eval(match[1]);

const mockEl = () => ({
  querySelector: () => mockEl(), querySelectorAll: () => [],
  addEventListener: () => {}, append: () => {}, appendChild: () => {},
  remove: () => {}, classList: { add:()=>{}, remove:()=>{}, contains:()=>false, toggle:()=>false },
  dataset: {}, textContent: "", innerHTML: "",
  style: new Proxy({}, { get: () => () => {} }),
  offsetWidth: 0, offsetHeight: 0, closest: () => null,
  getAttribute: () => null, setAttribute: () => {},
  matches: () => false,
});
const mockDoc = mockEl();
mockDoc.querySelector = () => mockEl();
mockDoc.querySelectorAll = () => [];
mockDoc.getElementById = () => mockEl();
mockDoc.createElement = () => mockEl();
mockDoc.createDocumentFragment = () => mockEl();
mockDoc.body = mockEl();
mockDoc.documentElement = mockEl();
mockDoc.addEventListener = () => {};
global.document = mockDoc;
global.window = Object.assign(mockEl(), { ALL_DRAWS_DATA, addEventListener: () => {} });
global.localStorage = { getItem:()=>null, setItem:()=>{}, removeItem:()=>{} };
global.sessionStorage = { getItem:()=>null, setItem:()=>{}, removeItem:()=>{} };
global.XLSX = null;
global.alert = () => {};
global.URL = { createObjectURL: ()=>"", revokeObjectURL:()=>{} };
global.matchMedia = () => ({ matches: false });
if (!global.navigator) global.navigator = { onLine: true, standalone: false };
global.location = { href: "" };
global.FileReader = class { readAsArrayBuffer() {} };
if (!globalThis.addEventListener) globalThis.addEventListener = () => {};
global.getComputedStyle = () => ({ getPropertyValue: () => "0" });
global.CSS = { supports: () => false };
global.HTMLElement = class {};
global.SVGElement = class {};
global.Image = class {};
global.MediaRecorder = class {};
global.SpeechSynthesisUtterance = class {};
global.URLSearchParams = class { constructor() {} get() { return null; } };
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.Blob = class {};
global.atob = (s) => Buffer.from(s, 'base64').toString('binary');
global.btoa = (s) => Buffer.from(s, 'binary').toString('base64');

const FIXED_SEED = 12345;
let _seed = FIXED_SEED;
function seededRandom() {
  _seed |= 0;
  _seed = _seed + 0x6D2B79F5 | 0;
  var t = Math.imul(_seed ^ _seed >>> 15, 1 | _seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
Math.random = seededRandom;
global.resetSeed = function() { _seed = FIXED_SEED; };

const __allBalls = [];
const draws_raw = [...ALL_DRAWS_DATA].reverse();
draws_raw.forEach((draw, idx) => {
  const rowNum = idx + 1;
  draw.front.forEach(n => __allBalls.push({ row: rowNum, zone: "front", number: n, label: String(n), color: "red", colors: ["red"], protected: false }));
  draw.back.forEach(n => __allBalls.push({ row: rowNum, zone: "back", number: n, label: String(n), color: "blue", colors: ["blue"], protected: false }));
});
global.__allBalls = __allBalls;

eval(fs.readFileSync(path.join(__dirname, 'script回测.js'), 'utf8'));

const draws = getBuiltInDrawData();
const srcIdx = draws.findIndex(d => d.issue === '2026044');
const srcRow = srcIdx + 1;
const srcNums = [3, 8, 22, 26, 29];
const srcTails = [...new Set(srcNums.map(n => n % 10))];

const refRows = buildV4FullReferenceRows(srcRow, __allBalls);
const tailTransData = analyzeTailTransitionsV4(srcRow, 70, __allBalls);

// 手动模拟predictLikelyTailsV4Enhanced，逐步记录每个信号对尾号6的贡献
const scores = new Map();
for (let t = 0; t <= 9; t++) scores.set(t, 0);

console.log("=== 逐步分析各信号对尾号6的贡献 ===\n");

// 1. 转移概率
srcTails.forEach((st) => {
  for (let tt = 0; tt <= 9; tt++) {
    const key = `${st}→${tt}`;
    const count = tailTransData.transFreq.get(key) || 0;
    scores.set(tt, scores.get(tt) + count);
  }
});
console.log("1. 转移概率后, 尾号6分数:", scores.get(6));
srcTails.forEach(st => {
  const key = `${st}→6`;
  const count = tailTransData.transFreq.get(key) || 0;
  console.log(`   ${st}→6: ${count}`);
});

// 2-3. 参考行重叠和等差延伸
const weights = {
  overlap1: 6, arith1: 8, overlap10: 2, arith10: 6, overlapBonus: 2,
  globalFreq: 20, comboTransfer: 2, partialMatch: 10, highFreqMiss: 8,
  sameOrNeighbor: 0, crossRowTail: 0, intraGroupPattern: 12,
  arithmeticNumber: 10, crossRowArithmetic: 12, bridgeTails: 12,
};

if (refRows && refRows.length > 0) {
  const ref1 = refRows.find(r => r.row === srcRow - 1);
  if (ref1) {
    console.log("\n2. 参考行(上期)尾号:", [...ref1.tailSet]);
    ref1.tailSet.forEach(t => {
      scores.set(t, scores.get(t) + weights.overlap1);
    });
    console.log("   重叠加分后, 尾号6分数:", scores.get(6), "(尾号6在ref1中:", ref1.tailSet.has(6), ")");

    const arith1 = getArithmeticTails([...ref1.tailSet]);
    console.log("   等差延伸尾号:", arith1);
    arith1.forEach(t => {
      if (!ref1.tailSet.has(t)) {
        scores.set(t, scores.get(t) + weights.arith1);
      }
    });
    console.log("   等差延伸后, 尾号6分数:", scores.get(6), "(尾号6在arith1中:", arith1.includes(6), ")");
  }

  // 间隔10参考行
  const ref10 = refRows.find(r => r.row === srcRow - 10);
  if (ref10) {
    console.log("\n3. 间隔10参考行尾号:", [...ref10.tailSet]);
    ref10.tailSet.forEach(t => {
      scores.set(t, scores.get(t) + weights.overlap10);
    });
    if (!ref1.tailSet.has(6) && ref10.tailSet.has(6)) {
      console.log("   尾号6在间隔10参考行中，加了overlap10:", weights.overlap10);
    }
  }
}

// 4. 双重保留（前两行都有）
if (refRows && refRows.length > 0) {
  const ref1 = refRows.find(r => r.row === srcRow - 1);
  const ref10 = refRows.find(r => r.row === srcRow - 10);
  if (ref1 && ref10) {
    const both = [...ref1.tailSet].filter(t => ref10.tailSet.has(t));
    console.log("\n4. 双重保留尾号:", both);
    both.forEach(t => {
      scores.set(t, scores.get(t) + weights.overlapBonus);
    });
  }
}

// 5. 组内模式
console.log("\n5. 组内模式(intraGroupPattern):");
const intraScores = new Map();
for (let t = 0; t <= 9; t++) intraScores.set(t, 0);

// 分析源尾号之间的关系
const srcTailsArr = [...srcTails].sort((a,b) => a-b);
console.log("   源尾号:", srcTailsArr);
// 尾号3和6的差是3（等差步长3）
// 尾号2和5的差是3
// 尾号8和5的差是3 (mod 10)
// 这些等差延伸可能产生中间尾号
for (let i = 0; i < srcTailsArr.length; i++) {
  for (let j = i+1; j < srcTailsArr.length; j++) {
    const diff = Math.abs(srcTailsArr[j] - srcTailsArr[i]);
    console.log(`   尾号${srcTailsArr[i]}-${srcTailsArr[j]}: 差=${diff}`);
  }
}

// 6. 桥接
if (refRows && refRows.length > 0) {
  const ref1 = refRows.find(r => r.row === srcRow - 1);
  if (ref1) {
    const currentSorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    const top3Tails = currentSorted.slice(0, 3).map(([tail]) => tail);
    console.log("\n6. 桥接分析:");
    console.log("   前一行尾号:", [...ref1.tailSet]);
    console.log("   当前Top3预测尾号:", top3Tails);
    
    const bridgeTails = getCrossSetBridgeTailScores([...ref1.tailSet], top3Tails);
    console.log("   桥接结果:");
    bridgeTails.forEach(([t, s]) => {
      scores.set(t, scores.get(t) + s * weights.bridgeTails / 10);
      console.log(`     尾号${t}: +${(s * weights.bridgeTails / 10).toFixed(1)}`);
    });
    if (bridgeTails.find(([t]) => t === 6)) {
      console.log("   → 尾号6有桥接加分!");
    } else {
      console.log("   → 尾号6没有桥接加分");
    }
  }
}

// 7. 完整号码等差
console.log("\n7. 完整号码等差(arithmeticNumber):");
const arithNumbers = getArithmeticNumbers(srcNums);
const arithTailsFromNums = [...new Set(arithNumbers.map(n => n % 10))];
console.log("   等差延伸号码:", arithNumbers);
console.log("   等差延伸尾号:", arithTailsFromNums);
arithTailsFromNums.forEach(t => {
  scores.set(t, scores.get(t) + weights.arithmeticNumber / 5);
});
console.log("   等差延伸后尾号6分数:", scores.get(6), "(尾号6在等差延伸中:", arithTailsFromNums.includes(6), ")");

// 8. 跨行等差
if (refRows && refRows.length > 0) {
  const ref1 = refRows.find(r => r.row === srcRow - 1);
  if (ref1) {
    const prevNumbers = [...ref1.numberSet];
    const possibleNumbers = [];
    const currentSorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    const top5TailsNow = currentSorted.slice(0, 5).map(([tail]) => tail);
    for (let num = 1; num <= 35; num++) {
      if (top5TailsNow.includes(num % 10)) possibleNumbers.push(num);
    }
    const crossArith = getCrossRowArithmetic(prevNumbers, possibleNumbers);
    console.log("\n8. 跨行等差:");
    console.log("   前一行号码:", prevNumbers);
    console.log("   跨行等差号码:", crossArith);
    const crossTails = [...new Set(crossArith.map(n => n % 10))];
    console.log("   跨行等差尾号:", crossTails);
  }
}

console.log("\n=== 最终各尾号分数 ===");
[...scores.entries()].sort((a,b) => b[1]-a[1]).forEach(([t, s]) => {
  const target = [2,4,6].includes(t) ? " ← 目标尾号" : "";
  const rank = [...scores.entries()].sort((a,b) => b[1]-a[1]).findIndex(([tt])=>tt===t) + 1;
  console.log(`  尾号${t}: ${s.toFixed(1)} (第${rank}名)${target}`);
});

console.log("\n=== 结论 ===");
console.log("目标尾号: {2, 4, 6}");
const sortedScores = [...scores.entries()].sort((a,b) => b[1]-a[1]);
const top5 = sortedScores.slice(0,5).map(([t])=>t);
console.log("Top5预测:", top5);
console.log("尾号6排名:", sortedScores.findIndex(([t])=>t===6)+1, "分数:", scores.get(6).toFixed(1));
console.log("尾号6被挤出Top5，因为:");
console.log("  - 尾号3(源尾号,转移概率最高)排名第1");
console.log("  - 尾号5(既非源尾号也非目标尾号)排名第3");
console.log("  - 尾号8(源尾号)排名第5");
console.log("  尾号6虽然在源号码中(26)，但被更高分的尾号挤掉了");
