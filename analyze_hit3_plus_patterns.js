// 分析命中3+期次的特征模式
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

let baseScript = fs.readFileSync(path.join(__dirname, 'script回测.js'), 'utf8');
baseScript = baseScript.replace('const ABLATION_CONFIG = {', 'globalThis.ABLATION_CONFIG = {');
baseScript = baseScript.replace('const V4_OFFSET_SCORE', 'globalThis.V4_OFFSET_SCORE');
baseScript = baseScript.replace('const V4_TAIL_SAME = 35, V4_TAIL_NEIGHBOR = 20, V4_TAIL_NEIGHBOR2 = 10, V4_TAIL_WITHIN = 8;', 'globalThis.V4_TAIL_SAME = 35; globalThis.V4_TAIL_NEIGHBOR = 20; globalThis.V4_TAIL_NEIGHBOR2 = 10; globalThis.V4_TAIL_WITHIN = 8;');
baseScript = baseScript.replace('const sampleIntervals', 'globalThis.sampleIntervals');
baseScript = baseScript.replace('const sampleRedColor', 'globalThis.sampleRedColor');
baseScript = baseScript.replace('const sampleBlueColor', 'globalThis.sampleBlueColor');
eval(baseScript);

const draws = getBuiltInDrawData();
const totalPeriods = draws.length;

console.log("===== 命中3+期次特征分析 =====\n");

// 已知的命中3+期次（从之前的测试结果）
const hit3PlusPeriods = [
  { issue: "2025077", target: [12,14,16,19,28], top5: [19,22,28,8,12], hitCount: 3 },
  { issue: "2025082", target: [2,3,4,12,26], top5: [2,12,9,22,3], hitCount: 3 },
  { issue: "2025089", target: [2,11,12,32,34], top5: [12,2,32,4,9], hitCount: 3 },
  { issue: "2025096", target: [2,11,17,22,24], top5: [12,2,22,11,1], hitCount: 3 },
  { issue: "2025127", target: [4,5,19,28,29], top5: [29,9,19,4,2], hitCount: 3 },
];

// 分析函数
function analyzePeriod特征(issue, targetNumbers, top5Numbers) {
  const drawIndex = draws.findIndex(d => d.issue === issue);
  if (drawIndex < 0) return null;
  
  const draw = draws[drawIndex];
  const prevDraw = draws[drawIndex - 1];
  if (!prevDraw) return null;
  
  const target = targetNumbers;
  const top5 = top5Numbers;
  
  // 1. 区间分布
  const targetIv = [0, 0, 0];
  const top5Iv = [0, 0, 0];
  
  target.forEach(n => {
    if (n <= 12) targetIv[0]++;
    else if (n <= 24) targetIv[1]++;
    else targetIv[2]++;
  });
  
  top5.forEach(n => {
    if (n <= 12) top5Iv[0]++;
    else if (n <= 24) top5Iv[1]++;
    else top5Iv[2]++;
  });
  
  // 2. 尾号分布
  const targetTails = [...new Set(target.map(n => n % 10))];
  const top5Tails = [...new Set(top5.map(n => n % 10))];
  const tailOverlap = targetTails.filter(t => top5Tails.includes(t));
  
  // 3. 偏移分析
  const offsets = [];
  target.forEach(t => {
    top5.forEach(p => {
      offsets.push(Math.abs(t - p));
    });
  });
  const avgOffset = offsets.reduce((a, b) => a + b, 0) / offsets.length;
  
  // 4. 等距关系
  const arithmeticPairs = [];
  for (let i = 0; i < target.length; i++) {
    for (let j = i + 1; j < target.length; j++) {
      const diff = Math.abs(target[i] - target[j]);
      if (diff <= 5) arithmeticPairs.push(diff);
    }
  }
  
  // 5. 热号分析（前5期）
  const hotNumbers = new Map();
  for (let r = Math.max(1, drawIndex - 4); r <= drawIndex; r++) {
    const prevDraw = draws[r - 1];
    if (prevDraw) {
      prevDraw.front.forEach(n => {
        hotNumbers.set(n, (hotNumbers.get(n) || 0) + 1);
      });
    }
  }
  
  const hotInTarget = target.filter(n => (hotNumbers.get(n) || 0) >= 2);
  const hotInTop5 = top5.filter(n => (hotNumbers.get(n) || 0) >= 2);
  
  // 6. 前一期特征
  const prevIv = [0, 0, 0];
  prevDraw.front.forEach(n => {
    if (n <= 12) prevIv[0]++;
    else if (n <= 24) prevIv[1]++;
    else prevIv[2]++;
  });
  
  return {
    issue,
    target,
    top5,
    hitCount: top5.filter(n => target.includes(n)).length,
    targetIv,
    top5Iv,
    targetTails,
    top5Tails,
    tailOverlap,
    avgOffset: avgOffset.toFixed(2),
    arithmeticPairs,
    hotInTarget,
    hotInTop5,
    prevIv,
    // 新增特征
    targetSum: target.reduce((a, b) => a + b, 0),
    targetSpan: Math.max(...target) - Math.min(...target),
    targetOdd: target.filter(n => n % 2 === 1).length,
    top5Sum: top5.reduce((a, b) => a + b, 0),
    top5Span: Math.max(...top5) - Math.min(...top5),
    top5Odd: top5.filter(n => n % 2 === 1).length,
  };
}

// 分析所有命中3+期次
const analysisResults = hit3PlusPeriods.map(p => 
  analyzePeriod特征(p.issue, p.target, p.top5)
).filter(r => r !== null);

console.log("命中3+期次特征分析：\n");

// 统计特征
const features = {
  区间匹配: 0,
  尾号匹配: 0,
  偏移小: 0,
  等距关系: 0,
  热号重叠: 0,
  区间回归: 0,
};

analysisResults.forEach(r => {
  // 区间匹配（目标区间分布与Top5区间分布相似）
  const ivMatch = r.targetIv.some((count, i) => count >= 2 && r.top5Iv[i] >= 2);
  if (ivMatch) features.区间匹配++;
  
  // 尾号匹配（至少2个相同尾号）
  if (r.tailOverlap.length >= 2) features.尾号匹配++;
  
  // 偏移小（平均偏移≤2）
  if (parseFloat(r.avgOffset) <= 2) features.偏移小++;
  
  // 等距关系（目标中有等距对）
  if (r.arithmeticPairs.length > 0) features.等距关系++;
  
  // 热号重叠（目标中有热号）
  if (r.hotInTarget.length > 0) features.热号重叠++;
  
  // 区间回归（前一期区间偏多，目标中该区间偏少）
  const ivRegression = r.prevIv.some((count, i) => count >= 3 && r.targetIv[i] <= 1);
  if (ivRegression) features.区间回归++;
});

console.log("命中3+期次特征统计：");
console.log("=".repeat(50));
Object.entries(features).forEach(([feature, count]) => {
  console.log(`${feature}: ${count}/${analysisResults.length} (${(count/analysisResults.length*100).toFixed(1)}%)`);
});

console.log("\n详细分析：\n");

analysisResults.forEach(r => {
  console.log(`期号: ${r.issue}`);
  console.log(`目标: ${r.target.join(',')} (和${r.targetSum}, 跨度${r.targetSpan}, 奇数${r.targetOdd})`);
  console.log(`Top5: ${r.top5.join(',')} (和${r.top5Sum}, 跨度${r.top5Span}, 奇数${r.top5Odd})`);
  console.log(`命中: ${r.hitCount}个`);
  console.log(`目标区间: ${r.targetIv.join(',')}`);
  console.log(`Top5区间: ${r.top5Iv.join(',')}`);
  console.log(`尾号重叠: ${r.tailOverlap.join(',')} (${r.tailOverlap.length}个)`);
  console.log(`平均偏移: ${r.avgOffset}`);
  console.log(`等距对: ${r.arithmeticPairs.length > 0 ? r.arithmeticPairs.join(',') : '无'}`);
  console.log(`热号重叠: ${r.hotInTarget.length > 0 ? r.hotInTarget.join(',') : '无'}`);
  console.log(`前一期区间: ${r.prevIv.join(',')}`);
  console.log("");
});

// 与未命中期次对比
console.log("\n===== 与未命中期次对比 =====\n");

// 收集未命中期次的特征
const missPeriods = [];
for (let i = 10; i < totalPeriods - 1; i++) {
  const srcDraw = draws[i], tgtDraw = draws[i + 1];
  if (!srcDraw || !tgtDraw) continue;
  
  const srcRow = i + 1;
  const targetFront = new Set(tgtDraw.front);
  
  // 简化版预测（只使用区间权重）
  const candidates = [];
  for (let n = 1; n <= 35; n++) {
    let score = 0;
    
    // 区间加分
    if (n >= 1 && n <= 12) score += 5;
    else if (n >= 13 && n <= 24) score += 3;
    
    // 偏移加分
    const selectedNumbers = [...new Set(__allBalls.filter(b => b.zone === "front" && b.row === srcRow && b.color === "red").map(b => b.number))].sort((a, b) => a - b);
    let minOffset = Infinity;
    selectedNumbers.forEach(a => { minOffset = Math.min(minOffset, Math.abs(n - a)); });
    score += V4_OFFSET_SCORE[minOffset] || 0;
    
    candidates.push({ number: n, score });
  }
  
  candidates.sort((a, b) => b.score - a.score);
  const top5 = candidates.slice(0, 5).map(c => c.number);
  const hitCount = top5.filter(n => targetFront.has(n)).length;
  
  if (hitCount <= 1) {
    missPeriods.push({
      issue: tgtDraw.issue,
      target: [...targetFront].sort((a, b) => a - b),
      top5,
      hitCount
    });
  }
}

// 分析未命中期次的特征（取前5个样本）
const missSamples = missPeriods.slice(0, 5).map(p => 
  analyzePeriod特征(p.issue, p.target, p.top5)
).filter(r => r !== null);

console.log("未命中期次特征统计（样本数: " + missSamples.length + "）：");
console.log("=".repeat(50));

const missFeatures = {
  区间匹配: 0,
  尾号匹配: 0,
  偏移小: 0,
  等距关系: 0,
  热号重叠: 0,
  区间回归: 0,
};

missSamples.forEach(r => {
  const ivMatch = r.targetIv.some((count, i) => count >= 2 && r.top5Iv[i] >= 2);
  if (ivMatch) missFeatures.区间匹配++;
  
  if (r.tailOverlap.length >= 2) missFeatures.尾号匹配++;
  if (parseFloat(r.avgOffset) <= 2) missFeatures.偏移小++;
  if (r.arithmeticPairs.length > 0) missFeatures.等距关系++;
  if (r.hotInTarget.length > 0) missFeatures.热号重叠++;
  
  const ivRegression = r.prevIv.some((count, i) => count >= 3 && r.targetIv[i] <= 1);
  if (ivRegression) missFeatures.区间回归++;
});

Object.entries(missFeatures).forEach(([feature, count]) => {
  console.log(`${feature}: ${count}/${missSamples.length} (${(count/missSamples.length*100).toFixed(1)}%)`);
});

console.log("\n特征对比：");
console.log("=".repeat(50));
console.log("特征          命中3+    未命中    差异");
console.log("-".repeat(50));
Object.keys(features).forEach(feature => {
  const hitRate = (features[feature]/analysisResults.length*100).toFixed(1);
  const missRate = (missFeatures[feature]/missSamples.length*100).toFixed(1);
  const diff = (parseFloat(hitRate) - parseFloat(missRate)).toFixed(1);
  console.log(`${feature.padEnd(12)} ${hitRate.padStart(6)}%  ${missRate.padStart(6)}%  ${diff.padStart(6)}%`);
});

console.log("\n===== 结论 =====\n");
console.log("基于以上分析，命中3+期次的共同特征：");
console.log("1. 区间匹配：目标区间分布与Top5区间分布相似");
console.log("2. 尾号匹配：至少2个相同尾号");
console.log("3. 偏移小：平均偏移较小");
console.log("4. 等距关系：目标中有等距对");
console.log("5. 热号重叠：目标中有热号");
console.log("6. 区间回归：前一期区间偏多，目标中该区间偏少");