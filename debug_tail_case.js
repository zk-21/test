// 调试特定案例的尾号预测
// 源(选中号): 3, 8, 22, 26, 29 → 尾号: {3, 8, 2, 6, 9}
// 目的行前一行: 2, 9, 14, 20, 31 → 尾号: {0, 1, 2, 4, 9}
// 目的行: 2, 6, 14, 22, 24 → 尾号: {2, 4, 6}

const __isNode = true;
const fs = require('fs');
const path = require('path');

// 加载开奖数据
const rawJs = fs.readFileSync(path.join(__dirname, 'all_draws.js'), 'utf8');
const match = rawJs.match(/window\.ALL_DRAWS_DATA\s*=\s*(\[[\s\S]*?\]);/);
const ALL_DRAWS_DATA = eval(match[1]);

// mock环境
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
const _originalRandom = Math.random;
Math.random = seededRandom;
global.resetSeed = function() { _seed = FIXED_SEED; };

const __allBalls = [];
const draws = [...ALL_DRAWS_DATA].reverse();
draws.forEach((draw, idx) => {
  const rowNum = idx + 1;
  draw.front.forEach(n => __allBalls.push({ row: rowNum, zone: "front", number: n, label: String(n), color: "red", colors: ["red"], protected: false }));
  draw.back.forEach(n => __allBalls.push({ row: rowNum, zone: "back", number: n, label: String(n), color: "blue", colors: ["blue"], protected: false }));
});
global.__allBalls = __allBalls;

// 加载主脚本
eval(fs.readFileSync(path.join(__dirname, 'script回测.js'), 'utf8'));

console.log("=== 尾号预测调试 ===");
console.log("");

// 找到2026044期（选中号）和2026053期（前一行）
const draws2 = getBuiltInDrawData();
console.log("数据总期数:", draws2.length);

// 找到2026044期的索引
let srcIdx = -1, prevIdx = -1;
for (let i = 0; i < draws2.length; i++) {
  if (draws2[i].issue === '2026044') srcIdx = i;
  if (draws2[i].issue === '2026053') prevIdx = i;
}

console.log("2026044期索引:", srcIdx, "号码:", draws2[srcIdx]?.front);
console.log("2026053期索引:", prevIdx, "号码:", draws2[prevIdx]?.front);
console.log("2026054期号码:", draws2[prevIdx+1]?.front);

// 源行号
const srcRow = srcIdx + 1;
const prevRow = prevIdx + 1;

console.log("\n源行号:", srcRow, "前一行行号:", prevRow);

const srcNums = draws2[srcIdx].front.sort((a,b)=>a-b);
const prevNums = draws2[prevIdx].front.sort((a,b)=>a-b);
const targetNums = draws2[prevIdx+1].front.sort((a,b)=>a-b);

console.log("\n选中号:", srcNums, "→ 尾号:", [...new Set(srcNums.map(n=>n%10))].sort());
console.log("前一行:", prevNums, "→ 尾号:", [...new Set(prevNums.map(n=>n%10))].sort());
console.log("目的行:", targetNums, "→ 尾号:", [...new Set(targetNums.map(n=>n%10))].sort());

// 构建引用行
const refRows = buildV4FullReferenceRows(srcRow, __allBalls);
const srcTails = [...new Set(srcNums.map(n => n % 10))];

// 尾号转移数据
const tailTransData = analyzeTailTransitionsV4(srcRow, 70, __allBalls);

// 预测尾号
const predictedTails = predictLikelyTailsV4Enhanced(srcTails, tailTransData, refRows, srcRow, __allBalls);

console.log("\n=== 尾号预测结果 ===");
console.log("Top5预测尾号:", predictedTails.slice(0,5).map(([t,s])=>`${t}(${s.toFixed(1)})`));
console.log("Top6预测尾号:", predictedTails.slice(0,6).map(([t,s])=>`${t}(${s.toFixed(1)})`));

const targetTails = [...new Set(targetNums.map(n=>n%10))];
console.log("\n目标尾号:", targetTails);

const top5Set = new Set(predictedTails.slice(0,5).map(([t])=>t));
const top6Set = new Set(predictedTails.slice(0,6).map(([t])=>t));

console.log("\nTop5命中:", targetTails.filter(t=>top5Set.has(t)));
console.log("Top5未命中:", targetTails.filter(t=>!top5Set.has(t)));
console.log("Top6命中:", targetTails.filter(t=>top6Set.has(t)));
console.log("Top6未命中:", targetTails.filter(t=>!top6Set.has(t)));

// 详细分析每个信号的贡献
console.log("\n=== 逐信号分析 ===");

// 1. 转移概率
const transScores = new Map();
for (let t = 0; t <= 9; t++) transScores.set(t, 0);
srcTails.forEach(st => {
  for (let tt = 0; tt <= 9; tt++) {
    const key = `${st}→${tt}`;
    const count = tailTransData.transFreq.get(key) || 0;
    transScores.set(tt, transScores.get(tt) + count);
  }
});
console.log("\n1. 转移概率:");
[...transScores.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([t,s]) => {
  const hit = targetTails.includes(t) ? "✓" : " ";
  console.log(`   尾号${t}: ${s.toFixed(0)} ${hit}`);
});

// 2. 参考行重叠
const ref1 = refRows.find(r => r.row === srcRow - 1);
if (ref1) {
  console.log("\n2. 参考行(上期)尾号:", [...ref1.tailSet]);
  console.log("   与目标重叠:", [...ref1.tailSet].filter(t=>targetTails.includes(t)));
}

// 3. 桥接
if (ref1) {
  const currentSortedScores = [...predictedTails].slice(0, 10);
  const top3Tails = currentSortedScores.slice(0, 3).map(([tail]) => tail);
  const bridgeTails = getCrossSetBridgeTailScores([...ref1.tailSet], top3Tails);
  if (bridgeTails.length > 0) {
    console.log("\n3. 桥接尾号(前一行↔Top3预测):");
    bridgeTails.forEach(([t, s]) => {
      const hit = targetTails.includes(t) ? "✓" : " ";
      console.log(`   尾号${t}: +${s} ${hit}`);
    });
    console.log("   前一行尾号:", [...ref1.tailSet]);
    console.log("   Top3预测尾号:", top3Tails);
  }
}

// 4. 前一行尾号集合
const prevTails = [...new Set(prevNums.map(n => n % 10))];
console.log("\n4. 前一行尾号:", prevTails);
console.log("   前一行尾号中在目标中的:", prevTails.filter(t => targetTails.includes(t)));
console.log("   前一行尾号中不在目标中的:", prevTails.filter(t => !targetTails.includes(t)));

// 关键分析: 尾号4
console.log("\n=== 尾号4分析 ===");
console.log("尾号4在目标中:", targetTails.includes(4) ? "✓ 是" : "否");
console.log("尾号4在源中:", srcTails.includes(4) ? "✓ 是" : "否");
console.log("尾号4在前一行中:", prevTails.includes(4) ? "✓ 是" : "否");
const t4Score = predictedTails.find(([t])=>t===4);
console.log("尾号4预测分数:", t4Score ? t4Score[1].toFixed(1) : "未找到", "排名:", predictedTails.findIndex(([t])=>t===4)+1);
