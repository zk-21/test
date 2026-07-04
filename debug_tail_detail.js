// 深入分析：哪些信号在帮倒忙
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
mockDoc.querySelector = () => mockEl(); mockDoc.querySelectorAll = () => [];
mockDoc.getElementById = () => mockEl(); mockDoc.createElement = () => mockEl();
mockDoc.createDocumentFragment = () => mockEl(); mockDoc.body = mockEl();
mockDoc.documentElement = mockEl(); mockDoc.addEventListener = () => {};
global.document = mockDoc;
global.window = Object.assign(mockEl(), { ALL_DRAWS_DATA, addEventListener: () => {} });
global.localStorage = { getItem:()=>null, setItem:()=>{}, removeItem:()=>{} };
global.sessionStorage = { getItem:()=>null, setItem:()=>{}, removeItem:()=>{} };
global.XLSX = null; global.alert = () => {};
global.URL = { createObjectURL: ()=>"", revokeObjectURL:()=>{} };
global.matchMedia = () => ({ matches: false });
if (!global.navigator) global.navigator = { onLine: true, standalone: false };
global.location = { href: "" };
global.FileReader = class { readAsArrayBuffer() {} };
if (!globalThis.addEventListener) globalThis.addEventListener = () => {};
global.getComputedStyle = () => ({ getPropertyValue: () => "0" });
global.CSS = { supports: () => false };
global.HTMLElement = class {}; global.SVGElement = class {}; global.Image = class {};
global.MediaRecorder = class {}; global.SpeechSynthesisUtterance = class {};
global.URLSearchParams = class { constructor() {} get() { return null; } };
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.Blob = class {};
global.atob = (s) => Buffer.from(s, 'base64').toString('binary');
global.btoa = (s) => Buffer.from(s, 'binary').toString('base64');

const FIXED_SEED = 12345;
let _seed = FIXED_SEED;
function seededRandom() {
  _seed |= 0; _seed = _seed + 0x6D2B79F5 | 0;
  var t = Math.imul(_seed ^ _seed >>> 15, 1 | _seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
Math.random = seededRandom;
global.resetSeed = function() { _seed = FIXED_SEED; };

const __allBalls = [];
[...ALL_DRAWS_DATA].reverse().forEach((draw, idx) => {
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
const predictedTails = predictLikelyTailsV4Enhanced(srcTails, tailTransData, refRows, srcRow, __allBalls);

console.log("=== 尾号预测详细排名 ===\n");
predictedTails.forEach(([t, s], rank) => {
  const isSrc = srcTails.includes(t) ? "源尾号" : "";
  const isTarget = [2,4,6].includes(t) ? "★目标" : "";
  const isPrev = [0,1,2,4,9].includes(t) ? "前一行" : "";
  const tags = [isSrc, isTarget, isPrev].filter(Boolean).join(", ");
  console.log(`第${rank+1}名: 尾号${t}  分数${s.toFixed(1)}  ${tags}`);
});

console.log("\n=== 转移概率矩阵（源尾号→目标尾号）===\n");
srcTails.forEach(st => {
  const row = [];
  for (let tt = 0; tt <= 9; tt++) {
    const key = `${st}→${tt}`;
    const count = tailTransData.transFreq.get(key) || 0;
    row.push(count);
  }
  console.log(`  ${st}→: ${row.map((v,i) => `${i}:${v}`).join("  ")}`);
});

console.log("\n=== 分析尾号6被挤掉的原因 ===\n");
console.log("目标尾号 {2, 4, 6}:");
console.log("  尾号2: 源有(22), 前一行有(2) → 转移+重叠双加分 → 排名第2 ✓");
console.log("  尾号4: 源没有, 前一行有(14,20) → 主要靠前一行加分 → 排名第4 ✓");
console.log("  尾号6: 源有(26), 前一行没有 → 仅靠转移概率 → 排名第8 ✗");

console.log("\n非目标尾号占据了Top5:");
console.log("  尾号3(第1名): 源尾号(3) → 转移概率最高(3→3=21) 但目标没有");
console.log("  尾号5(第3名): 非源非前一行 → 转移+等差加分 但目标没有");
console.log("  尾号8(第4名): 源尾号(8) → 转移概率高 但目标没有");
console.log("  尾号1(第5名): 非源 → 靠前一行(31)加分 但目标没有");

console.log("\n=== 关键问题 ===\n");
console.log("1. 尾号3(源尾号,21分转移)排第1，但目标没有 → 浪费");
console.log("2. 尾号5(非源非目标)排第3 → 转移概率给了错误信号");
console.log("3. 尾号6(源尾号)仅67分转移，远低于尾号3(99分)和尾号2(81分)");
console.log("   原因: 3→6转移只有16分, 6→6自身转移只有9分");

// 分析6→6为什么低
console.log("\n=== 历史转移频率统计 ===");
console.log("尾号6的来源尾号分布:");
for (let s = 0; s <= 9; s++) {
  const key = `${s}→6`;
  const count = tailTransData.transFreq.get(key) || 0;
  if (count > 0) console.log(`  ${s}→6: ${count}次`);
}

console.log("\n尾号3的目标尾号分布:");
for (let t = 0; t <= 9; t++) {
  const key = `3→${t}`;
  const count = tailTransData.transFreq.get(key) || 0;
  console.log(`  3→${t}: ${count}次`);
}
