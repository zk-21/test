// 分析每期预测指标
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

console.log("===== 每期预测指标分析 =====\n");
console.log(`总期数: ${totalPeriods}\n`);

// 存储每期预测结果
const periodResults = [];

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

    // 评分所有号码
    const candidates = [];
    for (let n = 1; n <= 35; n++) {
      let score = 0;
      const signals = [];

      // 偏移评分
      let minOffset = Infinity;
      selectedNumbers.forEach(a => { minOffset = Math.min(minOffset, Math.abs(n - a)); });
      score += V4_OFFSET_SCORE[minOffset] || 0;
      if (minOffset <= 2) signals.push('offset');

      // 尾号关联
      const t = n % 10;
      if (predictedTails && predictedTails.length > 0) {
        const topTails = new Set(predictedTails.slice(0, 5).map(([tt]) => tt));
      if (topTails.has(t)) {
        score += V4_TAIL_SAME;
        const isIntervalStable = srcRow >= 3;
        if (isIntervalStable) score += 10;
        signals.push('tail_same');
        }
        else if (predictedTails.some(([tt]) => Math.abs(t - tt) === 1)) {
          score += V4_TAIL_NEIGHBOR;
          signals.push('tail_neighbor');
        }
        else if (predictedTails.some(([tt]) => Math.abs(t - tt) === 2)) {
          score += V4_TAIL_NEIGHBOR2;
          signals.push('tail_neighbor2');
        }
        else if (sourceTails.includes(t)) {
          score += V4_TAIL_WITHIN;
          signals.push('tail_within');
        }
      } else {
        if (sourceTails.includes(t)) {
          score += V4_TAIL_WITHIN;
          signals.push('tail_within');
        }
      }

      // 尾号关联性加分
      const tailCorrelationBonus = getTailCorrelationScore(n, sourceTails, tailCorrelationData);
      if (tailCorrelationBonus > 0) score += Math.round(tailCorrelationBonus * 1.0);

      // +10趋势
      const ptScore = plusTenTrend.targetMap.get(n) || 0;
      const normPt = ptScore > 0 ? Math.round(ptScore / maxPlusTen * 30) : 0;
      if (normPt > 0) {
        score += normPt;
        if (normPt >= 15) signals.push('strong_plusten');
      }
      const ptNb = plusTenTrend.neighborMap.get(n) || 0;
      if (ptNb > 0) score += Math.round(ptNb / maxPlusTen * 6);

      // 桥梁
      const bg = bridgeMap.gapMap.get(n);
      const be = bridgeMap.endpointMap.get(n);
      const normBg = bg ? Math.round(bg.score / maxBridge * 15) : 0;
      const normBe = be ? Math.round(be.score / maxBridge * 8) : 0;
      if (normBg > 0) score += normBg;
      if (normBe > 0) score += normBe;
      if (normBg >= 8 || normBe >= 5) signals.push('bridge');

      // 等距
      const ae = arithMap.get(n);
      const normAe = ae ? Math.round(ae.score / maxArith * 10) : 0;
      if (normAe > 0) {
        score += normAe;
        if (normAe >= 5) signals.push('arithmetic');
      }

      // 热号
      const hot = hotness.get(n) || 0;
      if (hot >= 4) { score += 10; signals.push('hot'); }
      else if (hot >= 3) { score += 7; signals.push('hot'); }
      else if (hot >= 2) score += 4;
      else if (hot === 0) score -= 2;

      // 连号附近奖励
      const nearConsec = selectedNumbers.some(a => {
        const others = selectedNumbers.filter(x => x !== a);
        return others.some(x => Math.abs(x - a) === 1) && Math.abs(n - a) <= 4;
      });
      if (nearConsec) { score += 7; signals.push('consecutive'); }

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
        if (rank >= 0 && rank < 5) { score += 12; signals.push('first_ball'); }
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

      candidates.push({ number: n, score, signals });
    }

    candidates.sort((a, b) => b.score - a.score);

    // 取Top5和Top6
    const top5 = candidates.slice(0, 5).map(c => c.number);
    const top6 = candidates.slice(0, 6).map(c => c.number);

    // 计算命中
    const hit5 = top5.filter(n => targetFront.has(n)).length;
    const hit6 = top6.filter(n => targetFront.has(n)).length;

    // 计算尾号命中
    const targetTails = [...targetFront].map(n => n % 10);
    const top5Tails = predictedTails.slice(0, 5).map(([t]) => t);
    const top6Tails = predictedTails.slice(0, 6).map(([t]) => t);
    const tailHit5 = top5Tails.filter(t => targetTails.includes(t)).length;
    const tailHit6 = top6Tails.filter(t => targetTails.includes(t)).length;

    periodResults.push({
      period: i + 1,
      issue: tgtDraw.issue,
      targetFront: [...targetFront].sort((a, b) => a - b),
      top5,
      top6,
      hit5,
      hit6,
      tailHit5,
      tailHit6,
      predictedTails: predictedTails.slice(0, 6).map(([t, s]) => `${t}(${s.toFixed(1)})`).join(', ')
    });
  } catch (e) {
    console.log(`第${i + 1}期出错:`, e.message);
  }
}

// 输出每期结果
console.log("===== 每期预测结果 =====\n");
console.log("期号".padEnd(10) + "目标号码".padEnd(20) + "Top5预测".padEnd(20) + "Top5命中".padStart(10) + "Top6命中".padStart(10) + "尾号命中5".padStart(10) + "尾号命中6".padStart(10));
console.log("=".repeat(90));

for (const r of periodResults) {
  const targetStr = r.targetFront.join(',');
  const top5Str = r.top5.join(',');
  console.log(
    r.issue.padEnd(10) +
    targetStr.padEnd(20) +
    top5Str.padEnd(20) +
    r.hit5.toString().padStart(10) +
    r.hit6.toString().padStart(10) +
    r.tailHit5.toString().padStart(10) +
    r.tailHit6.toString().padStart(10)
  );
}

// 统计汇总
console.log("\n===== 统计汇总 =====\n");

const totalPeriodsAnalyzed = periodResults.length;
const hit5Dist = [0, 0, 0, 0, 0, 0]; // 0, 1, 2, 3, 4, 5
const hit6Dist = [0, 0, 0, 0, 0, 0, 0]; // 0, 1, 2, 3, 4, 5, 6
const tailHit5Dist = [0, 0, 0, 0, 0, 0]; // 0, 1, 2, 3, 4, 5
const tailHit6Dist = [0, 0, 0, 0, 0, 0, 0]; // 0, 1, 2, 3, 4, 5, 6

let totalHit5 = 0, totalHit6 = 0;
let totalTailHit5 = 0, totalTailHit6 = 0;
let hit3Plus5 = 0, hit4Plus5 = 0, hit5_5 = 0;
let hit3Plus6 = 0, hit4Plus6 = 0, hit5_6 = 0;

for (const r of periodResults) {
  hit5Dist[r.hit5]++;
  hit6Dist[r.hit6]++;
  tailHit5Dist[r.tailHit5]++;
  tailHit6Dist[r.tailHit6]++;

  totalHit5 += r.hit5;
  totalHit6 += r.hit6;
  totalTailHit5 += r.tailHit5;
  totalTailHit6 += r.tailHit6;

  if (r.hit5 >= 3) hit3Plus5++;
  if (r.hit5 >= 4) hit4Plus5++;
  if (r.hit5 >= 5) hit5_5++;

  if (r.hit6 >= 3) hit3Plus6++;
  if (r.hit6 >= 4) hit4Plus6++;
  if (r.hit6 >= 5) hit5_6++;
}

console.log(`总分析期数: ${totalPeriodsAnalyzed}`);
console.log(`\nTop5号码命中:`);
console.log(`  平均命中: ${(totalHit5 / totalPeriodsAnalyzed).toFixed(2)}个/期`);
console.log(`  命中3+期数: ${hit3Plus5} (${(hit3Plus5 / totalPeriodsAnalyzed * 100).toFixed(1)}%)`);
console.log(`  命中4+期数: ${hit4Plus5} (${(hit4Plus5 / totalPeriodsAnalyzed * 100).toFixed(1)}%)`);
console.log(`  命中5期数: ${hit5_5} (${(hit5_5 / totalPeriodsAnalyzed * 100).toFixed(1)}%)`);
console.log(`  命中分布: ${hit5Dist.map((v, i) => `${i}个:${v}期`).join(', ')}`);

console.log(`\nTop6号码命中:`);
console.log(`  平均命中: ${(totalHit6 / totalPeriodsAnalyzed).toFixed(2)}个/期`);
console.log(`  命中3+期数: ${hit3Plus6} (${(hit3Plus6 / totalPeriodsAnalyzed * 100).toFixed(1)}%)`);
console.log(`  命中4+期数: ${hit4Plus6} (${(hit4Plus6 / totalPeriodsAnalyzed * 100).toFixed(1)}%)`);
console.log(`  命中5期数: ${hit5_6} (${(hit5_6 / totalPeriodsAnalyzed * 100).toFixed(1)}%)`);
console.log(`  命中分布: ${hit6Dist.map((v, i) => `${i}个:${v}期`).join(', ')}`);

console.log(`\nTop5尾号命中:`);
console.log(`  平均命中: ${(totalTailHit5 / totalPeriodsAnalyzed).toFixed(2)}个/期`);
console.log(`  命中分布: ${tailHit5Dist.map((v, i) => `${i}个:${v}期`).join(', ')}`);

console.log(`\nTop6尾号命中:`);
console.log(`  平均命中: ${(totalTailHit6 / totalPeriodsAnalyzed).toFixed(2)}个/期`);
console.log(`  命中分布: ${tailHit6Dist.map((v, i) => `${i}个:${v}期`).join(', ')}`);

// 输出详细每期数据到文件
console.log("\n===== 输出详细数据到文件 =====\n");
const csvLines = ['期号,目标号码,Top5预测,Top5命中,Top6命中,尾号命中5,尾号命中6,预测尾号'];
for (const r of periodResults) {
  csvLines.push(`${r.issue},"${r.targetFront.join(',')}","${r.top5.join(',')}",${r.hit5},${r.hit6},${r.tailHit5},${r.tailHit6},"${r.predictedTails}"`);
}
fs.writeFileSync('per_period_metrics.csv', csvLines.join('\n'), 'utf8');
console.log("已输出详细数据到: per_period_metrics.csv");

// 输出命中3+的期详情
console.log("\n===== 命中3+的期详情 =====\n");
const hit3PlusPeriods = periodResults.filter(r => r.hit5 >= 3);
if (hit3PlusPeriods.length > 0) {
  for (const r of hit3PlusPeriods) {
    console.log(`期号: ${r.issue}`);
    console.log(`  目标: ${r.targetFront.join(',')}`);
    console.log(`  Top5: ${r.top5.join(',')} (命中${r.hit5}个)`);
    console.log(`  Top6: ${r.top6.join(',')} (命中${r.hit6}个)`);
    console.log(`  预测尾号: ${r.predictedTails}`);
    console.log("");
  }
} else {
  console.log("无命中3+的期");
}