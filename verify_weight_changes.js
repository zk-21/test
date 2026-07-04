// 验证权重修改效果
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
baseScript = baseScript.replace('const V4_TAIL_SAME = 12, V4_TAIL_NEIGHBOR = 8, V4_TAIL_NEIGHBOR2 = 4, V4_TAIL_WITHIN = 3;', 'globalThis.V4_TAIL_SAME = 12; globalThis.V4_TAIL_NEIGHBOR = 8; globalThis.V4_TAIL_NEIGHBOR2 = 4; globalThis.V4_TAIL_WITHIN = 3;');
baseScript = baseScript.replace('const sampleIntervals', 'globalThis.sampleIntervals');
baseScript = baseScript.replace('const sampleRedColor', 'globalThis.sampleRedColor');
baseScript = baseScript.replace('const sampleBlueColor', 'globalThis.sampleBlueColor');
eval(baseScript);

const draws = getBuiltInDrawData();
const totalPeriods = draws.length;

console.log("===== 权重修改效果验证 =====\n");
console.log("修改内容：");
console.log("  V4_OFFSET_SCORE: max 20 → 30");
console.log("  V4_TAIL_SAME: 35 → 12");
console.log("  V4_TAIL_NEIGHBOR: 20 → 8");
console.log("  V4_TAIL_NEIGHBOR2: 10 → 4");
console.log("  V4_TAIL_WITHIN: 8 → 3");
console.log("  等距归一化系数: 10 → 18");
console.log("");

let hit3Count = 0, hit4Count = 0, hit5Count = 0;
let periods = 0;
let totalHits = 0;
let hit3Periods = [], hit4Periods = [], hit5Periods = [];

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

    const hotness = new Map();
    for (let r = Math.max(1, srcRow - 5); r < srcRow; r++) {
      __allBalls.filter(b => b.zone === zone && b.row === r && b.color === sourceColor)
        .forEach(b => hotness.set(b.number, (hotness.get(b.number) || 0) + 1));
    }

    const maxPlusTen = Math.max(1, ...[...plusTenTrend.targetMap.values()]);
    const maxBridge = Math.max(1, ...[...bridgeMap.gapMap.values()].map(v => v.score), ...[...bridgeMap.endpointMap.values()].map(v => v.score));
    const maxArith = Math.max(1, ...[...arithMap.values()].map(v => v.score));

    const candidates = [];
    for (let n = 1; n <= 35; n++) {
      let score = 0;

      // 偏移评分（使用修改后的权重）
      let minOffset = Infinity;
      selectedNumbers.forEach(a => { minOffset = Math.min(minOffset, Math.abs(n - a)); });
      score += V4_OFFSET_SCORE[minOffset] || 0;

      // 尾号关联（使用修改后的权重）
      const t = n % 10;
      if (predictedTails && predictedTails.length > 0) {
        const topTails = new Set(predictedTails.slice(0, 5).map(([tt]) => tt));
        if (topTails.has(t)) {
          score += V4_TAIL_SAME;
          const isIntervalStable = srcRow >= 3;
          if (isIntervalStable) score += 10;
        }
        else if (predictedTails.some(([tt]) => Math.abs(t - tt) === 1)) score += V4_TAIL_NEIGHBOR;
        else if (predictedTails.some(([tt]) => Math.abs(t - tt) === 2)) score += V4_TAIL_NEIGHBOR2;
        else if (sourceTails.includes(t)) score += V4_TAIL_WITHIN;
      } else {
        if (sourceTails.includes(t)) score += V4_TAIL_WITHIN;
      }

      // 尾号关联性加分
      const tailCorrelationBonus = getTailCorrelationScore(n, sourceTails, tailCorrelationData);
      if (tailCorrelationBonus > 0) score += Math.round(tailCorrelationBonus * 1.0);

      // +10趋势
      const ptScore = plusTenTrend.targetMap.get(n) || 0;
      const normPt = ptScore > 0 ? Math.round(ptScore / maxPlusTen * 30) : 0;
      if (normPt > 0) score += normPt;
      const ptNb = plusTenTrend.neighborMap.get(n) || 0;
      if (ptNb > 0) score += Math.round(ptNb / maxPlusTen * 6);

      // 桥梁
      const bg = bridgeMap.gapMap.get(n);
      const be = bridgeMap.endpointMap.get(n);
      const normBg = bg ? Math.round(bg.score / maxBridge * 15) : 0;
      const normBe = be ? Math.round(be.score / maxBridge * 8) : 0;
      if (normBg > 0) score += normBg;
      if (normBe > 0) score += normBe;

      // 等距（使用修改后的归一化系数 18）
      const ae = arithMap.get(n);
      const normAe = ae ? Math.round(ae.score / maxArith * 18) : 0;
      if (normAe > 0) score += normAe;

      // 热号
      const hot = hotness.get(n) || 0;
      if (hot >= 4) score += 10;
      else if (hot >= 3) score += 7;
      else if (hot >= 2) score += 4;
      else if (hot === 0) score -= 2;

      // 连号附近奖励
      const nearConsec = selectedNumbers.some(a => {
        const others = selectedNumbers.filter(x => x !== a);
        return others.some(x => Math.abs(x - a) === 1) && Math.abs(n - a) <= 4;
      });
      if (nearConsec) score += 7;

      // 区间平衡
      const iv = getSampleIntervalIndex(n, sampleIntervals);
      const predictedIv = ivPrediction.predictedIv || sourceIv;
      if (sourceIv[iv] < predictedIv[iv]) score += 3;

      // 奇偶平衡
      if (n % 2 === 1 && sourceOdd < targetOdd) score += 2;
      else if (n % 2 === 0 && sourceOdd > targetOdd) score += 2;

      // 和值贡献
      const sumDiff = targetSum - sourceSum;
      if (Math.abs(sumDiff) > 10) {
        if (sumDiff > 0 && n >= 15) score += 2;
        else if (sumDiff < 0 && n <= 18) score += 2;
      }

      // 历史频率评分
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

      // 首位球综合动态预测加分
      if (n <= 15) {
        const rank = firstBallPredictions.findIndex(([num]) => num === n);
        if (rank >= 0 && rank < 5) score += 12;
        else if (rank >= 5 && rank < 10) score += 6;
        else if (rank >= 10) score += 2;
        const isNear = firstBallPredictions.slice(0, 5).some(([num]) => Math.abs(num - n) === 1);
        if (isNear) score += 3;
      } else if (n >= 25) score -= 1;

      // 特殊号码加分
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

      // 区间基础分
      if (n >= 13 && n <= 24) score += 5;
      if (n >= 25 && n <= 35) score += 3;

      candidates.push({ number: n, score });
    }

    candidates.sort((a, b) => b.score - a.score);
    const top5 = candidates.slice(0, 5).map(c => c.number);
    const hitCount = top5.filter(n => targetFront.has(n)).length;

    if (hitCount >= 3) {
      hit3Count++;
      hit3Periods.push({
        issue: tgtDraw.issue,
        target: [...targetFront].sort((a, b) => a - b),
        top5: top5,
        hitCount: hitCount
      });
    }
    if (hitCount >= 4) {
      hit4Count++;
      hit4Periods.push({
        issue: tgtDraw.issue,
        target: [...targetFront].sort((a, b) => a - b),
        top5: top5,
        hitCount: hitCount
      });
    }
    if (hitCount >= 5) {
      hit5Count++;
      hit5Periods.push({
        issue: tgtDraw.issue,
        target: [...targetFront].sort((a, b) => a - b),
        top5: top5,
        hitCount: hitCount
      });
    }
    totalHits += hitCount;
    periods++;
  } catch (e) {
    // 静默处理
  }
}

const avgHits = periods > 0 ? (totalHits / periods).toFixed(2) : "0.00";
const hit3Rate = periods > 0 ? (hit3Count / periods * 100).toFixed(1) : "0.0";
const hit4Rate = periods > 0 ? (hit4Count / periods * 100).toFixed(1) : "0.0";
const hit5Rate = periods > 0 ? (hit5Count / periods * 100).toFixed(1) : "0.0";

console.log("===== 测试结果（修改后）=====\n");
console.log(`测试期数: ${periods}`);
console.log(`命中3+期数: ${hit3Count} (${hit3Rate}%)`);
console.log(`命中4+期数: ${hit4Count} (${hit4Rate}%)`);
console.log(`命中5期数: ${hit5Count} (${hit5Rate}%)`);
console.log(`平均命中: ${avgHits}个/期`);
console.log("");

// 对比基线
console.log("===== 与基线对比 =====\n");
console.log("指标          修改前(基线)    修改后        变化");
console.log("=".repeat(55));
console.log(`命中3+期数     4期(2.4%)      ${hit3Count}期(${hit3Rate}%)    ${hit3Count >= 4 ? '✅ 保持/提升' : '⚠️ 下降'}`);
console.log(`命中4+期数     0期(0.0%)      ${hit4Count}期(${hit4Rate}%)    ${hit4Count > 0 ? '✅ 提升' : '⚪ 未变'}`);
console.log(`平均命中       0.76个/期      ${avgHits}个/期      ${parseFloat(avgHits) >= 0.76 ? '✅ 保持/提升' : '⚠️ 下降'}`);
console.log("");

// 输出命中3+的期详情
if (hit3Periods.length > 0) {
  console.log("===== 命中3+的期详情 =====\n");
  for (const period of hit3Periods) {
    console.log(`期号: ${period.issue}`);
    console.log(`目标: ${period.target.join(',')}`);
    console.log(`Top5: ${period.top5.join(',')} (命中${period.hitCount}个)`);
    console.log("");
  }
}

// 输出命中4+的期详情
if (hit4Periods.length > 0) {
  console.log("===== 命中4+的期详情 =====\n");
  for (const period of hit4Periods) {
    console.log(`期号: ${period.issue}`);
    console.log(`目标: ${period.target.join(',')}`);
    console.log(`Top5: ${period.top5.join(',')} (命中${period.hitCount}个)`);
    console.log("");
  }
}

// 分析结论
console.log("===== 分析结论 =====\n");
if (hit3Count >= 4 && hit4Count > 0) {
  console.log("✅ 权重调整效果良好：命中3+保持，命中4+提升！");
} else if (hit3Count >= 4 && hit4Count === 0) {
  console.log("⚪ 权重调整效果中性：命中3+保持，命中4+未出现");
} else if (hit3Count < 4) {
  console.log("⚠️ 权重调整可能过度：命中3+下降，需要微调");
}
