// 诊断脚本：追踪未覆盖球在候选池中的排名和分数
// 问题：未覆盖球是"从未进入任何源池"还是"进入后分数太低被筛掉"？

const fs = require("fs");
const vm = require("vm");

// 加载 script回测.js 的所有函数
const code = fs.readFileSync("script回测.js", "utf-8");
const sandbox = { console, Math, Set, Map, Array, Object, JSON, parseInt, parseFloat, Infinity, require, process, setTimeout, clearTimeout, setInterval, clearInterval, Date, Number, String, Boolean, RegExp, Error, TypeError, RangeError, isNaN, isFinite, undefined, NaN };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

// 提取需要的函数和变量
const {
  buildSampleNumbersV4, collectBalls, getSampleSourceWindow,
  sampleRedColor, ballHasColor, getSampleIntervalIndex, sampleIntervals,
  intervalRatio, predictTargetIntervalRatio, getTargetPrevIntervalRatio,
  buildSampleFrontCombosV5, buildSampleFreeCombos, generateBackBridgeCombos,
  buildV4SingleSamplePlan, selectCoverageOptimalCombos,
  V4_POOL_SIZE, SECOND_INTERVAL, PREDICT_INTERVAL,
  resetSeed, v4HistoryMetrics
} = sandbox;

// 加载数据
const drawsRaw = JSON.parse(fs.readFileSync("all_draws.json", "utf-8"));
const draws = [null, ...drawsRaw]; // 1-indexed
const totalDraws = draws.length - 1;

const __allBalls = collectBalls();

console.log("=".repeat(80));
console.log("未覆盖球诊断分析");
console.log("=".repeat(80));
console.log(`V4_POOL_SIZE = ${V4_POOL_SIZE}`);
console.log(`数据期数: ${totalDraws}`);
console.log();

// 统计
const ballMissCount = new Map(); // 球号 → 被漏次数
const ballRankWhenMissed = new Map(); // 球号 → [排名列表]
const ballScoreGapWhenMissed = new Map(); // 球号 → [与cutoff的分差列表]
const ballInSourcePools = new Map(); // 球号 → {in0, in1, in2, inNone} 计数
let totalUncovered = 0;
let totalPeriods = 0;

if (typeof resetSeed === 'function') resetSeed();

for (let sourceIdx = 1; sourceIdx <= totalDraws - PREDICT_INTERVAL - 1; sourceIdx++) {
  sandbox.v4HistoryMetrics = null;
  
  const targetIdx = sourceIdx + PREDICT_INTERVAL;
  const targetDraw = draws[targetIdx];
  if (!targetDraw) continue;
  
  const targetNums = [...targetDraw.front].sort((a, b) => a - b);
  const targetSet = new Set(targetNums);
  
  const mainSourceIdx = sourceIdx + SECOND_INTERVAL;
  const auxSourceIdx = sourceIdx;
  const secondSourceRow = auxSourceIdx + 1;
  const thirdSourceRow = auxSourceIdx;
  
  const sourceDraw = draws[mainSourceIdx];
  if (!sourceDraw) continue;
  
  const sourceNums = [...sourceDraw.front].sort((a, b) => a - b);
  const sourceRow = mainSourceIdx + 1;
  const sourceRows = [sourceRow, secondSourceRow, thirdSourceRow];
  
  totalPeriods++;
  
  try {
    const ratioPlan = null;
    
    // 1. 主源V4候选池
    let frontSample = buildSampleNumbersV4(sourceRow, "front", ratioPlan, __allBalls);
    const predSourceIv = getTargetPrevIntervalRatio(sourceRow, intervalRatio(frontSample.numbers || sourceNums), __allBalls, PREDICT_INTERVAL);
    frontSample.ivPrediction = predictTargetIntervalRatio(targetIdx, predSourceIv, __allBalls, PREDICT_INTERVAL);
    
    // 2. 多源融合
    const allSamples = sourceRows.map(row => ({
      row,
      sample: buildSampleNumbersV4(row, "front", ratioPlan, __allBalls)
    }));
    
    // 记录每个源池包含哪些号码
    const sourcePoolSets = allSamples.map(item => new Set(item.sample.candidates || []));
    
    // 加权合并
    const weights = [0.5, 0.3, 0.2];
    const scoreMap = new Map();
    const allScoreMap = new Map(); // 所有号码的分数（不截断）
    
    allSamples.forEach((item, idx) => {
      const w = weights[idx] || 0.1;
      item.sample.candidateEntries.forEach(e => {
        scoreMap.set(e.number, (scoreMap.get(e.number) || 0) + e.score * w);
      });
    });
    
    // 获取所有35个号码的融合分数
    for (let n = 1; n <= 35; n++) {
      allScoreMap.set(n, scoreMap.get(n) || 0);
    }
    
    const mergedSorted = [...scoreMap.entries()]
      .sort((a, b) => b[1] - a[1]);
    
    const mergedEntries = mergedSorted
      .slice(0, V4_POOL_SIZE)
      .map(([num, score]) => {
        let o = {};
        for (const item of allSamples) {
          const found = item.sample.candidateEntries.find(e => e.number === num);
          if (found) { o = found; break; }
        }
        return {
          number: num, score, baseScore: score, rank: 0,
          selectedTailHits: o.selectedTailHits || 0, selectedTailNeighborHits: o.selectedTailNeighborHits || 0,
          tailCount: o.tailCount || 0, lastRowTailHits: o.lastRowTailHits || 0,
          tailPatternScore: o.tailPatternScore || 0, upperColorHits: o.upperColorHits || 0,
          upperColorTailHits: o.upperColorTailHits || 0, upperColorTailNeighborHits: o.upperColorTailNeighborHits || 0,
          hits: o.hits || 0, bridgeEndpointHits: o.bridgeEndpointHits || 0,
          arithmeticEndpointHits: o.arithmeticEndpointHits || 0, arithmeticScore: o.arithmeticScore || 0,
          integrityBonus: o.integrityBonus || 0, templateHits: o.templateHits || 0,
          sameRowSupport: o.sameRowSupport || 0, plusTenScore: o.plusTenScore || 0,
          plusTenNeighborScore: o.plusTenNeighborScore || 0, farOffsetCount: o.farOffsetCount || 0,
          anchorKeepPenalty: o.anchorKeepPenalty || 0, transformedCount: o.transformedCount || 0,
        };
      });
    
    frontSample.candidateEntries = mergedEntries;
    frontSample.candidates = frontSample.candidateEntries.map(e => e.number);
    frontSample.numbers = frontSample.candidateEntries.slice(0, 5).map(e => e.number);
    
    // 尾号关系加分
    const sourceTails = [...new Set(frontSample.numbers.map(n => n % 10))];
    const tailBonus  = new Map();
    sourceTails.forEach(t => {
      tailBonus.set((t + 1) % 10, (tailBonus.get((t + 1) % 10) || 0) + 4);
      tailBonus.set((t + 9) % 10, (tailBonus.get((t + 9) % 10) || 0) + 4);
      tailBonus.set((t + 2) % 10, (tailBonus.get((t + 2) % 10) || 0) + 3);
      tailBonus.set((t + 8) % 10, (tailBonus.get((t + 8) % 10) || 0) + 3);
      tailBonus.set((t + 3) % 10, (tailBonus.get((t + 3) % 10) || 0) + 2);
      tailBonus.set((t + 7) % 10, (tailBonus.get((t + 7) % 10) || 0) + 2);
    });
    for (let i = 0; i < sourceTails.length; i++) {
      for (let j = i + 1; j < sourceTails.length; j++) {
        const t1 = sourceTails[i], t2 = sourceTails[j];
        const diff = Math.abs(t1 - t2);
        if (diff === 2 || diff === 8) {
          const mid = Math.round((t1 + t2) / 2) % 10;
          tailBonus.set(mid, (tailBonus.get(mid) || 0) + 3);
          tailBonus.set((mid + 5) % 10, (tailBonus.get((mid + 5) % 10) || 0) + 3);
        }
        if (diff === 4 || diff === 6) {
          const mid = Math.round((t1 + t2) / 2) % 10;
          tailBonus.set(mid, (tailBonus.get(mid) || 0) + 2);
        }
      }
    }
    sourceTails.forEach(t => tailBonus.delete(t));
    if (tailBonus.size > 0) {
      frontSample.candidateEntries.forEach(e => {
        const bonus = tailBonus.get(e.number % 10);
        if (bonus) e.score += bonus;
      });
    }
    frontSample.candidateEntries.sort((a, b) => b.score - a.score);
    frontSample.candidates = frontSample.candidateEntries.map(e => e.number);
    
    // 最终池
    const poolSet = new Set(frontSample.candidates.slice(0, V4_POOL_SIZE));
    const cutoffScore = frontSample.candidateEntries[V4_POOL_SIZE - 1]?.score || 0;
    
    // 检查未覆盖球
    for (const tn of targetNums) {
      if (!poolSet.has(tn)) {
        totalUncovered++;
        ballMissCount.set(tn, (ballMissCount.get(tn) || 0) + 1);
        
        // 查找该球在融合排序中的排名
        const rankInMerged = mergedSorted.findIndex(([num]) => num === tn) + 1;
        const ballScore = scoreMap.get(tn) || 0;
        const scoreGap = ballScore - cutoffScore;
        
        if (!ballRankWhenMissed.has(tn)) ballRankWhenMissed.set(tn, []);
        ballRankWhenMissed.get(tn).push(rankInMerged);
        
        if (!ballScoreGapWhenMissed.has(tn)) ballScoreGapWhenMissed.set(tn, []);
        ballScoreGapWhenMissed.get(tn).push(scoreGap);
        
        // 检查在哪些源池中出现
        const inSources = sourcePoolSets.map(s => s.has(tn));
        const inCount = inSources.filter(Boolean).length;
        
        if (!ballInSourcePools.has(tn)) ballInSourcePools.set(tn, { in0: 0, in1: 0, in2: 0, inNone: 0, inAll: 0 });
        const stats = ballInSourcePools.get(tn);
        if (inSources[0]) stats.in0++;
        if (inSources[1]) stats.in1++;
        if (inSources[2]) stats.in2++;
        if (inCount === 0) stats.inNone++;
        if (inCount === 3) stats.inAll++;
      }
    }
  } catch (e) {
    // skip
  }
}

// 输出结果
console.log(`总验证期数: ${totalPeriods}`);
console.log(`总未覆盖球数: ${totalUncovered}`);
console.log();

// 按漏球次数排序
const sortedBalls = [...ballMissCount.entries()].sort((a, b) => b[1] - a[1]);

console.log("=".repeat(80));
console.log("未覆盖球详细诊断");
console.log("=".repeat(80));
console.log();
console.log("球号 | 漏球次数 | 平均排名 | 排名范围 | 平均分差 | 分差范围 | 源池出现情况");
console.log("-".repeat(100));

for (const [ball, count] of sortedBalls) {
  const ranks = ballRankWhenMissed.get(ball) || [];
  const gaps = ballScoreGapWhenMissed.get(ball) || [];
  const srcStats = ballInSourcePools.get(ball) || { in0: 0, in1: 0, in2: 0, inNone: 0, inAll: 0 };
  
  const avgRank = (ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1);
  const minRank = Math.min(...ranks);
  const maxRank = Math.max(...ranks);
  
  const avgGap = (gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1);
  const minGap = Math.min(...gaps).toFixed(1);
  const maxGap = Math.max(...gaps).toFixed(1);
  
  console.log(
    `球${String(ball).padStart(2)} | ` +
    `${String(count).padStart(4)}次   | ` +
    `${String(avgRank).padStart(6)}  | ` +
    `${String(minRank).padStart(3)}-${String(maxRank).padStart(3)}   | ` +
    `${String(avgGap).padStart(7)} | ` +
    `${String(minGap).padStart(6)}~${String(maxGap).padStart(6)} | ` +
    `主源:${srcStats.in0} 辅1:${srcStats.in1} 辅2:${srcStats.in2} 全无:${srcStats.inNone} 全有:${srcStats.inAll}`
  );
}

console.log();
console.log("=".repeat(80));
console.log("分类统计");
console.log("=".repeat(80));

// 分类：从未进入任何源池 vs 进入源池但融合后被筛掉
let neverInAnyPool = 0;
let inPoolButFiltered = 0;
let inPoolRank31_35 = 0; // 排名31-35（刚好被截断）
let inPoolRank36plus = 0; // 排名36+（完全不在融合结果中）

for (const [ball, count] of sortedBalls) {
  const srcStats = ballInSourcePools.get(ball) || { inNone: 0 };
  const ranks = ballRankWhenMissed.get(ball) || [];
  
  if (srcStats.inNone === count) {
    neverInAnyPool += count;
  } else {
    inPoolButFiltered += count;
    // 检查排名分布
    for (const r of ranks) {
      if (r <= 35) inPoolRank31_35++;
      else inPoolRank36plus++;
    }
  }
}

console.log();
console.log(`从未进入任何源池: ${neverInAnyPool}次 (${(neverInAnyPool/totalUncovered*100).toFixed(1)}%)`);
console.log(`进入源池但被筛掉: ${inPoolButFiltered}次 (${(inPoolButFiltered/totalUncovered*100).toFixed(1)}%)`);
console.log(`  其中排名31-35（刚好被截断）: ${inPoolRank31_35}次`);
console.log(`  其中排名36+（融合后完全不在）: ${inPoolRank36plus}次`);

console.log();
console.log("=".repeat(80));
console.log("分区间统计");
console.log("=".repeat(80));

const zoneStats = [
  { name: "一区(1-12)", balls: sortedBalls.filter(([b]) => b >= 1 && b <= 12) },
  { name: "二区(13-24)", balls: sortedBalls.filter(([b]) => b >= 13 && b <= 24) },
  { name: "三区(25-35)", balls: sortedBalls.filter(([b]) => b >= 25 && b <= 35) },
];

for (const zone of zoneStats) {
  const totalMiss = zone.balls.reduce((s, [, c]) => s + c, 0);
  const neverIn = zone.balls.reduce((s, [b]) => {
    const st = ballInSourcePools.get(b) || { inNone: 0 };
    return s + st.inNone;
  }, 0);
  const inButFiltered = totalMiss - neverIn;
  
  console.log(`\n${zone.name}: 总漏球${totalMiss}次`);
  console.log(`  从未进入源池: ${neverIn}次 (${(neverIn/Math.max(1,totalMiss)*100).toFixed(1)}%)`);
  console.log(`  进入源池被筛: ${inButFiltered}次 (${(inButFiltered/Math.max(1,totalMiss)*100).toFixed(1)}%)`);
}

console.log();
console.log("=".repeat(80));
console.log("高频漏球（>=10次）的排名分布详情");
console.log("=".repeat(80));

for (const [ball, count] of sortedBalls) {
  if (count < 10) continue;
  const ranks = ballRankWhenMissed.get(ball) || [];
  const gaps = ballScoreGapWhenMissed.get(ball) || [];
  const srcStats = ballInSourcePools.get(ball) || {};
  
  console.log(`\n球${ball} (漏${count}次):`);
  console.log(`  排名分布: ${[...ranks].sort((a,b)=>a-b).join(', ')}`);
  console.log(`  分差分布: ${gaps.map(g => g.toFixed(1)).sort().join(', ')}`);
  console.log(`  源池出现: 主源${srcStats.in0||0}/${count}, 辅源1(${srcStats.in1||0}/${count}), 辅源2(${srcStats.in2||0}/${count})`);
  
  // 排名区间统计
  const r31_33 = ranks.filter(r => r >= 31 && r <= 33).length;
  const r34_35 = ranks.filter(r => r >= 34 && r <= 35).length;
  const r36plus = ranks.filter(r => r > 35).length;
  const rBelow30 = ranks.filter(r => r <= 30).length;
  console.log(`  排名<=30(应在池中): ${rBelow30}次, 31-33: ${r31_33}次, 34-35: ${r34_35}次, 36+: ${r36plus}次`);
}

console.log("\n完成!");
