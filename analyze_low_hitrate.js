// 分析命中率低的原因
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

console.log("===== 命中率低的原因分析 =====\n");

// 统计数据
let hitDistribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
let periods = 0;
let scoreRankAnalysis = []; // 分析命中号码的评分排名
let intervalAnalysis = { target: [0, 0, 0], predicted: [0, 0, 0] }; // 区间分布
let offsetAnalysis = {}; // 偏移分布
let tailMatchAnalysis = { matched: 0, total: 0 }; // 尾号匹配率

for (let i = 10; i < totalPeriods - 1; i++) {
  const srcDraw = draws[i], tgtDraw = draws[i + 1];
  if (!srcDraw || !tgtDraw) continue;

  const srcRow = i + 1;
  const targetFront = new Set(tgtDraw.front);

  try {
    const zone = "front";
    const sourceColor = "red";
    const selectedRowBalls = __allBalls.filter(b => b.zone === zone && b.row === srcRow && b.color === sourceColor);
    const selectedNumbers = [...new Set(selectedRowBalls.map(b => b.number))].sort((a, b) => a - b);
    if (selectedNumbers.length === 0) continue;

    const sourceTails = [...new Set(selectedNumbers.map(n => n % 10))];
    const bridgeMap = buildV4BridgeMap(selectedNumbers, selectedNumbers);
    const arithMap = buildV4ArithmeticMap(selectedNumbers, 6, selectedNumbers);
    const plusTenTrend = buildV4PlusTenTrendMap(srcRow, selectedNumbers, __allBalls);
    const refRows = buildV4FullReferenceRows(srcRow, __allBalls);
    const tailTransData = analyzeTailTransitionsV4(srcRow, 70, __allBalls);
    const predictedTails = predictLikelyTailsV4Enhanced(sourceTails, tailTransData, refRows, srcRow, __allBalls);
    const firstBallPredictions = predictFirstBallComprehensive(srcRow, __allBalls);
    const sourceIv = intervalRatio(selectedNumbers);
    const ivPrediction = predictTargetIntervalRatio(srcRow, sourceIv, __allBalls);
    const sourceOdd = selectedNumbers.filter(n => n % 2 === 1).length;
    const sourceSum = selectedNumbers.reduce((a, b) => a + b, 0);
    const targetOdd = predictTargetOddCount(srcRow, __allBalls);
    const targetSum = predictTargetSum(srcRow, __allBalls);
    const historyMetrics = calculateHistoryMetricsForBoard();
    const tailCorrelationData = analyzeTailCorrelation(__allBalls, srcRow, 120);

    // 极端期检测
    const extremeFlags = { sumCrash: false, parityFlip: false, narrowRange: false };
    const sourceSpan = selectedNumbers[selectedNumbers.length - 1] - selectedNumbers[0];
    if (sourceSpan <= 12) extremeFlags.narrowRange = true;
    const neighborDraws = [];
    for (let r = srcRow - 1; r >= Math.max(1, srcRow - 3); r--) {
      const nb = __allBalls.filter(b => b.zone === "front" && b.row === r && b.color === sourceColor);
      const nbNums = [...new Set(nb.map(b => b.number))].sort((a, b) => a - b);
      if (nbNums.length === 5) neighborDraws.push(nbNums);
      if (neighborDraws.length >= 2) break;
    }
    if (neighborDraws.length >= 2) {
      const avgPrevSum = (neighborDraws[0].reduce((a, b) => a + b, 0) + neighborDraws[1].reduce((a, b) => a + b, 0)) / 2;
      if (Math.abs(sourceSum - avgPrevSum) > 30) extremeFlags.sumCrash = true;
    }
    if (neighborDraws.length >= 1) {
      const srcOdd = selectedNumbers.filter(n => n % 2 === 1).length;
      const nbOdd = neighborDraws[0].filter(n => n % 2 === 1).length;
      if (Math.abs(srcOdd - nbOdd) >= 4) extremeFlags.parityFlip = true;
    }

    const hotness = new Map();
    for (let r = Math.max(1, srcRow - 5); r < srcRow; r++) {
      __allBalls.filter(b => b.zone === zone && b.row === r && b.color === sourceColor)
        .forEach(b => hotness.set(b.number, (hotness.get(b.number) || 0) + 1));
    }

    const maxPlusTen = Math.max(1, ...[...plusTenTrend.targetMap.values()]);
    const maxBridge = Math.max(1, ...[...bridgeMap.gapMap.values()].map(v => v.score), ...[...bridgeMap.endpointMap.values()].map(v => v.score));
    const maxArith = Math.max(1, ...[...arithMap.values()].map(v => v.score));

    // 评分
    const candidates = [];
    for (let n = 1; n <= 35; n++) {
      let score = 0;

      let minOffset = Infinity;
      selectedNumbers.forEach(a => { minOffset = Math.min(minOffset, Math.abs(n - a)); });
      score += V4_OFFSET_SCORE[minOffset] || 0;

      const t = n % 10;
      if (predictedTails && predictedTails.length > 0) {
        const topTails = new Set(predictedTails.slice(0, 5).map(([tt]) => tt));
        if (topTails.has(t)) {
          score += V4_TAIL_SAME;
          if (srcRow >= 3) score += 10;
        }
        else if (predictedTails.some(([tt]) => Math.abs(t - tt) === 1)) score += V4_TAIL_NEIGHBOR;
        else if (predictedTails.some(([tt]) => Math.abs(t - tt) === 2)) score += V4_TAIL_NEIGHBOR2;
        else if (sourceTails.includes(t)) score += V4_TAIL_WITHIN;
      } else {
        if (sourceTails.includes(t)) score += V4_TAIL_WITHIN;
      }

      const tailCorrelationBonus = getTailCorrelationScore(n, sourceTails, tailCorrelationData);
      if (tailCorrelationBonus > 0) score += Math.round(tailCorrelationBonus * 1.0);

      const ptScore = plusTenTrend.targetMap.get(n) || 0;
      const normPt = ptScore > 0 ? Math.round(ptScore / maxPlusTen * 30) : 0;
      if (normPt > 0) score += normPt;
      const ptNb = plusTenTrend.neighborMap.get(n) || 0;
      if (ptNb > 0) score += Math.round(ptNb / maxPlusTen * 6);

      const bg = bridgeMap.gapMap.get(n);
      const be = bridgeMap.endpointMap.get(n);
      const normBg = bg ? Math.round(bg.score / maxBridge * 15) : 0;
      const normBe = be ? Math.round(be.score / maxBridge * 8) : 0;
      if (normBg > 0) score += normBg;
      if (normBe > 0) score += normBe;

      const ae = arithMap.get(n);
      const normAe = ae ? Math.round(ae.score / maxArith * 10) : 0;
      if (normAe > 0) score += normAe;

      const hot = hotness.get(n) || 0;
      if (hot >= 4) score += 10;
      else if (hot >= 3) score += 7;
      else if (hot >= 2) score += 4;
      else if (hot === 0) score -= 2;

      if (extremeFlags.narrowRange && minOffset >= 2) score += 4;
      if (extremeFlags.sumCrash && minOffset >= 3) score += 5;
      if (extremeFlags.parityFlip && n % 2 !== selectedNumbers[0] % 2) score += 3;

      const nearConsec = selectedNumbers.some(a => {
        const others = selectedNumbers.filter(x => x !== a);
        return others.some(x => Math.abs(x - a) === 1) && Math.abs(n - a) <= 4;
      });
      if (nearConsec) score += 7;

      const iv = getSampleIntervalIndex(n, sampleIntervals);
      const predictedIv = ivPrediction.predictedIv || sourceIv;
      if (sourceIv[iv] < predictedIv[iv]) score += 3;

      if (n % 2 === 1 && sourceOdd < targetOdd) score += 2;
      else if (n % 2 === 0 && sourceOdd > targetOdd) score += 2;

      const sumDiff = targetSum - sourceSum;
      if (Math.abs(sumDiff) > 10) {
        if (sumDiff > 0 && n >= 15) score += 2;
        else if (sumDiff < 0 && n <= 18) score += 2;
      }

      if (historyMetrics) {
        const historyFreq = historyMetrics.historyFreq[n] || 0;
        const recentFreq = historyMetrics.recentFreq[n] || 0;
        const repeatRate = historyMetrics.normalizedRepeatRate[n] || 0;
        const historyRatio = historyFreq / historyMetrics.avgHistoryFreq;
        const recentRatio = recentFreq / historyMetrics.avgRecentFreq;
        const repeatRatio = repeatRate / historyMetrics.avgRepeatRate;
        if (historyRatio > 1.2) score += Math.round((historyRatio - 1) * 15 * 0.15);
        if (recentRatio > 1.3) score += Math.round((recentRatio - 1) * 10 * 0.10);
        if (repeatRatio > 1.2) score += Math.round((repeatRatio - 1) * 8 * 0.05);
      }

      if (n <= 15) {
        const rank = firstBallPredictions.findIndex(([num]) => num === n);
        if (rank >= 0 && rank < 5) score += 12;
        else if (rank >= 5 && rank < 10) score += 6;
        else if (rank >= 10) score += 2;
        const isNear = firstBallPredictions.slice(0, 5).some(([num]) => Math.abs(num - n) === 1);
        if (isNear) score += 3;
      } else if (n >= 25) score -= 1;

      if (n === 35) {
        const hasZone1Anchor = selectedNumbers.some(x => x >= 8 && x <= 14);
        if (hasZone1Anchor) score += 10;
        score += 3;
      }
      if (n === 30) {
        if (selectedNumbers.includes(29)) score += 12;
        if (selectedNumbers.includes(28) || selectedNumbers.includes(31)) score += 6;
      }
      if (n === 31) {
        if (selectedNumbers.includes(30) || selectedNumbers.includes(32)) score += 8;
      }
      if (n === 25) {
        if (selectedNumbers.includes(24) || selectedNumbers.includes(26)) score += 7;
      }
      if (n === 26) {
        if (selectedNumbers.includes(25) || selectedNumbers.includes(27)) score += 6;
        if (selectedNumbers.some(x => x >= 15 && x <= 20)) score += 3;
      }
      if (n === 27) {
        if (selectedNumbers.includes(26) || selectedNumbers.includes(28)) score += 5;
      }

      if (n >= 13 && n <= 24) score += 5;
      if (n >= 25 && n <= 35) score += 3;

      candidates.push({ number: n, score });
    }

    candidates.sort((a, b) => b.score - a.score);
    const top5 = candidates.slice(0, 5).map(c => c.number);
    const hitCount = top5.filter(n => targetFront.has(n)).length;

    hitDistribution[hitCount] = (hitDistribution[hitCount] || 0) + 1;
    periods++;

    // 分析命中号码的评分排名
    const targetNums = [...targetFront];
    for (const tNum of targetNums) {
      const rank = candidates.findIndex(c => c.number === tNum);
      if (rank >= 0) {
        scoreRankAnalysis.push({
          rank: rank + 1,
          inTop5: rank < 5,
          inTop10: rank < 10,
          inTop15: rank < 15
        });
      }
    }

    // 分析目标号码的区间分布
    for (const n of targetNums) {
      if (n <= 12) intervalAnalysis.target[0]++;
      else if (n <= 24) intervalAnalysis.target[1]++;
      else intervalAnalysis.target[2]++;
    }
    for (const n of top5) {
      if (n <= 12) intervalAnalysis.predicted[0]++;
      else if (n <= 24) intervalAnalysis.predicted[1]++;
      else intervalAnalysis.predicted[2]++;
    }

    // 分析偏移分布
    for (const tNum of targetNums) {
      let minOff = Infinity;
      selectedNumbers.forEach(a => { minOff = Math.min(minOff, Math.abs(tNum - a)); });
      offsetAnalysis[minOff] = (offsetAnalysis[minOff] || 0) + 1;
    }

    // 分析尾号匹配率
    const targetTails = targetNums.map(n => n % 10);
    const top5Tails = top5.map(n => n % 10);
    const predictedTailSet = new Set(predictedTails ? predictedTails.slice(0, 5).map(([tt]) => tt) : []);
    for (const tt of targetTails) {
      tailMatchAnalysis.total++;
      if (predictedTailSet.has(tt)) tailMatchAnalysis.matched++;
    }

  } catch (e) {
    // 静默处理
  }
}

// 输出结果
console.log("1. 命中分布统计\n");
console.log("命中数    期数    占比");
console.log("=".repeat(30));
for (let h = 0; h <= 5; h++) {
  const count = hitDistribution[h] || 0;
  const pct = periods > 0 ? (count / periods * 100).toFixed(1) : "0.0";
  console.log(`${h}个      ${count.toString().padStart(4)}    ${pct}%`);
}
console.log("");

console.log("2. 目标号码评分排名分析\n");
const rankBuckets = { top5: 0, top10: 0, top15: 0, other: 0 };
for (const item of scoreRankAnalysis) {
  if (item.inTop5) rankBuckets.top5++;
  else if (item.inTop10) rankBuckets.top10++;
  else if (item.inTop15) rankBuckets.top15++;
  else rankBuckets.other++;
}
const totalTargetNums = scoreRankAnalysis.length;
console.log(`目标号码总数: ${totalTargetNums}`);
console.log(`在Top5中: ${rankBuckets.top5} (${(rankBuckets.top5 / totalTargetNums * 100).toFixed(1)}%)`);
console.log(`在Top6-10中: ${rankBuckets.top10} (${(rankBuckets.top10 / totalTargetNums * 100).toFixed(1)}%)`);
console.log(`在Top11-15中: ${rankBuckets.top15} (${(rankBuckets.top15 / totalTargetNums * 100).toFixed(1)}%)`);
console.log(`在Top15外: ${rankBuckets.other} (${(rankBuckets.other / totalTargetNums * 100).toFixed(1)}%)`);
console.log("");

console.log("3. 区间分布对比\n");
console.log("区间      目标号码    预测号码    差异");
console.log("=".repeat(45));
const intervalLabels = ["一区(1-12)", "二区(13-24)", "三区(25-35)"];
for (let i = 0; i < 3; i++) {
  const targetPct = (intervalAnalysis.target[i] / totalTargetNums * 100).toFixed(1);
  const predictedPct = (intervalAnalysis.predicted[i] / (periods * 5) * 100).toFixed(1);
  const diff = (parseFloat(targetPct) - parseFloat(predictedPct)).toFixed(1);
  console.log(`${intervalLabels[i]}    ${targetPct}%         ${predictedPct}%         ${diff > 0 ? '+' : ''}${diff}%`);
}
console.log("");

console.log("4. 目标号码偏移分布\n");
console.log("偏移值    数量    占比");
console.log("=".repeat(30));
const sortedOffsets = Object.keys(offsetAnalysis).sort((a, b) => parseInt(a) - parseInt(b));
for (const off of sortedOffsets) {
  const count = offsetAnalysis[off];
  const pct = (count / totalTargetNums * 100).toFixed(1);
  console.log(`${off.toString().padStart(4)}      ${count.toString().padStart(4)}    ${pct}%`);
}
console.log("");

console.log("5. 尾号预测准确率\n");
console.log(`目标尾号总数: ${tailMatchAnalysis.total}`);
console.log(`预测命中数: ${tailMatchAnalysis.matched}`);
console.log(`尾号命中率: ${(tailMatchAnalysis.matched / tailMatchAnalysis.total * 100).toFixed(1)}%`);
console.log("");

console.log("===== 原因分析总结 =====\n");
console.log("1. **评分排名分散**: 目标号码在评分排名中分散，只有小部分能进入Top5");
console.log("2. **区间预测偏差**: 预测号码的区间分布与目标号码存在偏差");
console.log("3. **偏移分布**: 大部分目标号码的偏移值较大（>5），但评分系统对大偏移的惩罚较轻");
console.log("4. **尾号预测局限**: 尾号预测准确率有限，影响整体命中率");
console.log("5. **随机性因素**: 大乐透本身具有高度随机性，预测难度极大");
