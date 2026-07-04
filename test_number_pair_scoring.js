// ======================== 号码对评分独立测试脚本 ========================
// 目标：对比有/无号码对评分对回测指标的影响
// 用法：node test_number_pair_scoring.js

const __isNode = (typeof window === 'undefined');
if (!__isNode) { console.error("请用 Node.js 运行此脚本"); process.exit(1); }

const fs = require('fs');
const path = require('path');

// ─── 加载开奖数据 ───
const rawJs = fs.readFileSync(path.join(__dirname, 'all_draws.js'), 'utf8');
const match = rawJs.match(/window\.ALL_DRAWS_DATA\s*=\s*(\[[\s\S]*?\]);/);
if (!match) { console.error('无法解析 all_draws.js'); process.exit(1); }
const ALL_DRAWS_DATA = eval(match[1]);

// ─── 模拟浏览器环境（最小化）───
function mockEl() {
  return {
    querySelector: () => mockEl(), querySelectorAll: () => [],
    addEventListener: () => {}, append: () => {}, appendChild: () => {},
    remove: () => {}, classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => false },
    dataset: {}, textContent: "", innerHTML: "",
    style: new Proxy({}, { get: () => () => {} }),
    offsetWidth: 0, offsetHeight: 0, closest: () => null,
    getAttribute: () => null, setAttribute: () => {}, matches: () => false,
  };
}
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
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.navigator = { userAgent: 'node' };
global.location = { href: '' };
global.Image = class { };
global.getComputedStyle = () => ({});
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// ─── 加载主脚本（定义所有函数）───
console.log("[初始化] 加载 script回测.js 中的所有函数...");
try {
  eval(fs.readFileSync(path.join(__dirname, 'script回测.js'), 'utf8'));
} catch (e) {
  // 主脚本的主程序逻辑可能报错，但函数已经定义
  console.log("[初始化] 主脚本加载完成（主程序逻辑错误已忽略）");
}

// ─── 验证关键函数存在 ───
const requiredFunctions = [
  'collectBalls', 'getBuiltInDrawData', 'buildSampleNumbersV4TailOnly',
  'buildSampleNumbersV4', 'buildSampleFrontCombosV5', 'selectCoverageOptimalCombos',
  'getTargetPrevIntervalRatio', 'intervalRatio', 'predictTargetIntervalRatio',
  'buildSampleNumbers', 'buildSampleFreeCombos', 'generateBackBridgeCombos',
  'analyzeTargetTailPatterns', 'v4HistoryMetrics'
];
const missing = requiredFunctions.filter(fn => typeof global[fn] !== 'function' && typeof eval(`typeof ${fn}`) === 'undefined');
if (missing.length > 0) {
  console.error(`[错误] 缺少关键函数: ${missing.join(', ')}`);
  console.error("请确保 script回测.js 中的函数定义完整");
  process.exit(1);
}
console.log("[初始化] 所有关键函数验证通过\n");

// ─── 号码对评分函数 ───
function calcNumberPairScore(nums, sourceNums) {
  if (!nums || nums.length === 0 || !sourceNums || sourceNums.length === 0) return 0;
  
  let score = 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const srcSet = new Set(sourceNums);
  
  // 1. 有限重复：组合中的号码与源号码重复
  const repeatCount = sorted.filter(n => srcSet.has(n)).length;
  score += Math.min(repeatCount, 3) * 5;
  
  // 2. 连号：组合中包含连续号码
  let consecutivePairs = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i + 1] - sorted[i] === 1) consecutivePairs++;
  }
  score += Math.min(consecutivePairs, 2) * 6;
  
  // 3. 桥接：组合中的号码填补源号码的间隔
  const srcSorted = [...sourceNums].sort((a, b) => a - b);
  let bridgeCount = 0;
  for (let i = 0; i < srcSorted.length - 1; i++) {
    const gap = srcSorted[i + 1] - srcSorted[i];
    if (gap >= 2 && gap <= 5) {
      const hasBridge = sorted.some(n => n > srcSorted[i] && n < srcSorted[i + 1]);
      if (hasBridge) bridgeCount++;
    }
  }
  score += Math.min(bridgeCount, 2) * 4;
  
  // 4. 与选中行等差号：组合中的号码与源号码形成等差关系
  let arithmeticCount = 0;
  for (const n of sorted) {
    for (const src of srcSorted) {
      const diff = Math.abs(n - src);
      if (diff >= 2 && diff <= 5 && diff !== 3) {
        arithmeticCount++;
        break;
      }
    }
  }
  score += Math.min(arithmeticCount, 3) * 3;
  
  return score;
}

// ─── 单次回测函数 ───
function runSingleBacktest(enablePairScoring, seedVal) {
  if (seedVal) {
    let s = seedVal;
    Math.random = function() {
      s |= 0;
      s = s + 0x6D2B79F5 | 0;
      var t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  
  const draws = [...getBuiltInDrawData()].reverse();
  const allBalls = [];
  draws.forEach((draw, idx) => {
    const row = idx + 1;
    draw.front.forEach(num => {
      allBalls.push({ row, zone: "front", number: num, label: String(num), color: "#d6202a", colors: ["#d6202a"], protected: false });
    });
    draw.back.forEach(num => {
      allBalls.push({ row, zone: "back", number: num, label: String(num), color: "#1768b7", colors: ["#1768b7"], protected: false });
    });
  });
  
  const PREDICT_INTERVAL = 10;
  const results = [];
  const totalDraws = draws.length;
  
  for (let sourceIdx = 1; sourceIdx <= totalDraws - PREDICT_INTERVAL - 1; sourceIdx++) {
    v4HistoryMetrics = null;
    
    const targetIdx = sourceIdx + PREDICT_INTERVAL;
    const targetDraw = draws[targetIdx];
    if (!targetDraw) continue;
    
    const targetNums = [...targetDraw.front].sort((a, b) => a - b);
    const targetSet = new Set(targetNums);
    
    const mainSourceIdx = sourceIdx + 9;
    const auxSourceIdx1 = sourceIdx;
    const auxSourceIdx2 = sourceIdx - 1;
    
    const sourceDraw = draws[mainSourceIdx];
    if (!sourceDraw) continue;
    
    const sourceNums = [...sourceDraw.front].sort((a, b) => a - b);
    const sourceRow = mainSourceIdx + 1;
    
    const secondSourceRow = auxSourceIdx1 + 1;
    const thirdSourceRow = auxSourceIdx2 + 1;
    const sourceRows = [sourceRow, secondSourceRow, thirdSourceRow];
    
    try {
      const ratioPlan = null;
      
      const allSamples = sourceRows.map(row => ({
        row,
        sample: buildSampleNumbersV4TailOnly(row, "front", ratioPlan, allBalls)
      }));
      
      const mainSample = allSamples[0].sample;
      const predSourceIv = getTargetPrevIntervalRatio(sourceRow, intervalRatio(mainSample.numbers || sourceNums), allBalls, PREDICT_INTERVAL);
      const ivPrediction = predictTargetIntervalRatio(targetIdx, predSourceIv, allBalls);
      
      const weights = [0.5, 0.3, 0.2];
      const mainPredictedTails = allSamples[0].sample.predictedTails || null;
      const allSourceCombos = allSamples.map((item, idx) => {
        const s = item.sample;
        const v4Refs = s.referenceRows || [];
        const tailsToUse = idx === 0 ? s.predictedTails : mainPredictedTails;
        const combos = buildSampleFrontCombosV5(
          s.candidateEntries, v4Refs,
          s.selectedNumbers, s.selectedNumbers,
          tailsToUse || null,
          ivPrediction || null,
          s.firstBallPredictions || null,
          s.extremeFlags || null,
          ratioPlan, item.row, allBalls
        );
        return { row: item.row, sample: s, combos, weight: weights[idx] };
      });
      
      const allCombos = [];
      allSourceCombos.forEach(item => {
        item.combos.forEach(combo => {
          allCombos.push({
            ...combo,
            sourceRow: item.row,
            sourceWeight: item.weight,
            weightedScore: (combo.score || 0) * item.weight
          });
        });
      });
      allCombos.sort((a, b) => b.weightedScore - a.weightedScore);
      
      // ─── 号码对评分（可选）───
      if (enablePairScoring) {
        allCombos.forEach(combo => {
          const pairScore = calcNumberPairScore(combo.numbers, sourceNums);
          combo.weightedScore = (combo.weightedScore || 0) + pairScore;
        });
        allCombos.sort((a, b) => b.weightedScore - a.weightedScore);
      }
      
      const scoreMap = new Map();
      allSamples.forEach((item, idx) => {
        const w = weights[idx] || 0.1;
        item.sample.candidateEntries.forEach(e => {
          scoreMap.set(e.number, (scoreMap.get(e.number) || 0) + e.score * w);
        });
      });
      const V4_POOL_SIZE = 30;
      const mergedEntries = [...scoreMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, V4_POOL_SIZE)
        .map(([num, score]) => {
          let o = {};
          for (const item of allSamples) {
            const found = item.sample.candidateEntries.find(e => e.number === num);
            if (found) { o = found; break; }
          }
          return { number: num, score, ...o };
        });
      
      const poolNumbers = mergedEntries.map(e => e.number);
      
      // 尾号融合
      const tailScores = new Map();
      for (let t = 0; t <= 9; t++) tailScores.set(t, 0);
      allSamples.forEach((item, idx) => {
        const w = weights[idx] || 0.1;
        const sourceTails = item.sample.selectedNumbers ? [...new Set(item.sample.selectedNumbers.map(n => n % 10))] : [];
        sourceTails.forEach(t => tailScores.set(t, tailScores.get(t) + 10 * w));
        (item.sample.predictedTails || []).forEach(([t, s]) => tailScores.set(t, tailScores.get(t) + s * w * 0.3));
      });
      const predictedTails = [...tailScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      
      // 选择Top5
      const targetPatterns = analyzeTargetTailPatterns(sourceRow, allBalls, 100);
      const mainSourceTails = mainSample.selectedNumbers ? [...new Set(mainSample.selectedNumbers.map(n => n % 10))] : [];
      const prevRow = sourceRow - 1;
      const prevBalls = allBalls.filter(b => b.zone === "front" && b.row === prevRow);
      const prevTails = prevBalls.length > 0 ? [...new Set(prevBalls.map(b => b.number % 10))] : [];
      const tailRelationData = {
        predictedTails: predictedTails,
        sourceTails: mainSourceTails,
        prevTails: prevTails,
        targetPatterns: targetPatterns
      };
      
      const selectedFront = poolNumbers.length > 0
        ? selectCoverageOptimalCombos(allCombos, poolNumbers, 5, tailRelationData)
        : allCombos.slice(0, 5);
      
      // Top5指标
      const top5Hits = selectedFront.map(c => (c.numbers || []).filter(n => targetSet.has(n)).length);
      const top5Union = new Set();
      selectedFront.forEach(c => (c.numbers || []).forEach(n => top5Union.add(n)));
      const top5UnionCoverage = targetNums.filter(n => top5Union.has(n)).length;
      
      // 候选池覆盖
      const poolCoverage = targetNums.filter(n => poolNumbers.includes(n)).length;
      
      results.push({ top5Hits, top5UnionCoverage, poolCoverage });
    } catch (err) {
      // 跳过错误
    }
  }
  
  const cnt = results.length;
  if (cnt === 0) return null;
  
  let sumTop5Max = 0, sumTop5Union = 0, sumPool = 0;
  let hit3 = 0, hit4 = 0, hit5 = 0;
  let top5HitDistribution = [0, 0, 0, 0, 0, 0]; // 0-5球
  
  results.forEach(r => {
    const maxH = Math.max(...r.top5Hits);
    sumTop5Max += maxH;
    sumTop5Union += r.top5UnionCoverage;
    sumPool += r.poolCoverage;
    if (maxH >= 3) hit3++;
    if (maxH >= 4) hit4++;
    if (maxH >= 5) hit5++;
    top5HitDistribution[maxH]++;
  });
  
  return {
    cnt,
    avgTop5Max: (sumTop5Max / cnt).toFixed(3),
    avgTop5Union: (sumTop5Union / cnt).toFixed(3),
    avgPool: (sumPool / cnt).toFixed(3),
    hit3, hit4, hit5,
    hit3Rate: (hit3 / cnt * 100).toFixed(1),
    hit4Rate: (hit4 / cnt * 100).toFixed(1),
    hit5Rate: (hit5 / cnt * 100).toFixed(1),
    top5HitDistribution
  };
}

// ─── 主测试流程 ───
console.log("=".repeat(90));
console.log("号码对评分效果对比测试");
console.log("=".repeat(90));
console.log("");

const seeds = [12345, 67890, 11111, 54321, 99999];
const baselineResults = [];
const pairScoringResults = [];

for (const seed of seeds) {
  console.log(`\n测试种子: ${seed}`);
  console.log("-".repeat(60));
  
  // 基线（无号码对评分）
  const baseline = runSingleBacktest(false, seed);
  if (baseline) {
    baselineResults.push(baseline);
    console.log(`  [基线] Top5最高命中均值: ${baseline.avgTop5Max}, 联合覆盖: ${baseline.avgTop5Union}, 池覆盖: ${baseline.avgPool}`);
    console.log(`         3+球: ${baseline.hit3}次(${baseline.hit3Rate}%), 4+球: ${baseline.hit4}次(${baseline.hit4Rate}%), 5球: ${baseline.hit5}次(${baseline.hit5Rate}%)`);
  }
  
  // 号码对评分
  const withPair = runSingleBacktest(true, seed);
  if (withPair) {
    pairScoringResults.push(withPair);
    console.log(`  [号码对] Top5最高命中均值: ${withPair.avgTop5Max}, 联合覆盖: ${withPair.avgTop5Union}, 池覆盖: ${withPair.avgPool}`);
    console.log(`          3+球: ${withPair.hit3}次(${withPair.hit3Rate}%), 4+球: ${withPair.hit4}次(${withPair.hit4Rate}%), 5球: ${withPair.hit5}次(${withPair.hit5Rate}%)`);
  }
  
  if (baseline && withPair) {
    const diff = (parseFloat(withPair.avgTop5Union) - parseFloat(baseline.avgTop5Union)).toFixed(3);
    const diffSign = diff > 0 ? '+' : '';
    console.log(`  [差异] 联合覆盖变化: ${diffSign}${diff}`);
  }
}

// ─── 汇总统计 ───
console.log("\n" + "=".repeat(90));
console.log("汇总统计");
console.log("=".repeat(90));

if (baselineResults.length > 0 && pairScoringResults.length > 0) {
  const avgBaseline = {
    avgTop5Max: (baselineResults.reduce((s, r) => s + parseFloat(r.avgTop5Max), 0) / baselineResults.length).toFixed(3),
    avgTop5Union: (baselineResults.reduce((s, r) => s + parseFloat(r.avgTop5Union), 0) / baselineResults.length).toFixed(3),
    avgPool: (baselineResults.reduce((s, r) => s + parseFloat(r.avgPool), 0) / baselineResults.length).toFixed(3),
    hit3: Math.round(baselineResults.reduce((s, r) => s + r.hit3, 0) / baselineResults.length),
    hit4: Math.round(baselineResults.reduce((s, r) => s + r.hit4, 0) / baselineResults.length),
    hit5: Math.round(baselineResults.reduce((s, r) => s + r.hit5, 0) / baselineResults.length),
  };
  
  const avgPairScoring = {
    avgTop5Max: (pairScoringResults.reduce((s, r) => s + parseFloat(r.avgTop5Max), 0) / pairScoringResults.length).toFixed(3),
    avgTop5Union: (pairScoringResults.reduce((s, r) => s + parseFloat(r.avgTop5Union), 0) / pairScoringResults.length).toFixed(3),
    avgPool: (pairScoringResults.reduce((s, r) => s + parseFloat(r.avgPool), 0) / pairScoringResults.length).toFixed(3),
    hit3: Math.round(pairScoringResults.reduce((s, r) => s + r.hit3, 0) / pairScoringResults.length),
    hit4: Math.round(pairScoringResults.reduce((s, r) => s + r.hit4, 0) / pairScoringResults.length),
    hit5: Math.round(pairScoringResults.reduce((s, r) => s + r.hit5, 0) / pairScoringResults.length),
  };
  
  console.log("\n指标                | 基线(无号码对) | 号码对评分 | 差异");
  console.log("-".repeat(65));
  console.log(`Top5最高命中均值    | ${avgBaseline.avgTop5Max.padStart(12)} | ${avgPairScoring.avgTop5Max.padStart(10)} | ${(parseFloat(avgPairScoring.avgTop5Max) - parseFloat(avgBaseline.avgTop5Max)).toFixed(3)}`);
  console.log(`Top5联合覆盖均值    | ${avgBaseline.avgTop5Union.padStart(12)} | ${avgPairScoring.avgTop5Union.padStart(10)} | ${(parseFloat(avgPairScoring.avgTop5Union) - parseFloat(avgBaseline.avgTop5Union)).toFixed(3)}`);
  console.log(`候选池覆盖均值      | ${avgBaseline.avgPool.padStart(12)} | ${avgPairScoring.avgPool.padStart(10)} | ${(parseFloat(avgPairScoring.avgPool) - parseFloat(avgBaseline.avgPool)).toFixed(3)}`);
  console.log(`3+球命中期数        | ${String(avgBaseline.hit3).padStart(12)} | ${String(avgPairScoring.hit3).padStart(10)} | ${avgPairScoring.hit3 - avgBaseline.hit3}`);
  console.log(`4+球命中期数        | ${String(avgBaseline.hit4).padStart(12)} | ${String(avgPairScoring.hit4).padStart(10)} | ${avgPairScoring.hit4 - avgBaseline.hit4}`);
  console.log(`5球命中期数         | ${String(avgBaseline.hit5).padStart(12)} | ${String(avgPairScoring.hit5).padStart(10)} | ${avgPairScoring.hit5 - avgBaseline.hit5}`);
  
  // 判断哪个更优
  console.log("\n" + "=".repeat(90));
  console.log("结论");
  console.log("=".repeat(90));
  
  const unionDiff = parseFloat(avgPairScoring.avgTop5Union) - parseFloat(avgBaseline.avgTop5Union);
  const maxDiff = parseFloat(avgPairScoring.avgTop5Max) - parseFloat(avgBaseline.avgTop5Max);
  const poolDiff = parseFloat(avgPairScoring.avgPool) - parseFloat(avgBaseline.avgPool);
  
  if (unionDiff > 0.05 || maxDiff > 0.05) {
    console.log("✅ 号码对评分策略更优！建议启用。");
  } else if (unionDiff < -0.05 || maxDiff < -0.05) {
    console.log("❌ 基线策略更优，号码对评分策略效果下降。");
  } else {
    console.log("⚠️ 两种策略效果接近，差异不显著。");
  }
  
  console.log(`\n联合覆盖变化: ${unionDiff > 0 ? '+' : ''}${unionDiff.toFixed(3)}`);
  console.log(`最高命中变化: ${maxDiff > 0 ? '+' : ''}${maxDiff.toFixed(3)}`);
  console.log(`候选池覆盖变化: ${poolDiff > 0 ? '+' : ''}${poolDiff.toFixed(3)}`);
}

console.log("\n测试完成！");
