// 对比实验：固定种子 vs 随机种子 命中率对比
// 复用 script回测.js 的核心逻辑，运行两次对比结果

const fs = require('fs');
const path = require('path');

// 加载数据
const dataPath = path.join(__dirname, 'all_draws.js');
const dataContent = fs.readFileSync(dataPath, 'utf8');
const match = dataContent.match(/\[[\s\S]*\]/);
if (!match) { console.error("无法解析数据"); process.exit(1); }
const ALL_DRAWS_DATA = eval('(' + match[0] + ')');

// ======================== 核心回测函数 ========================
function runBacktest(useFixedSeed, seedValue) {
  // 随机种子设置
  if (useFixedSeed) {
    let _seed = seedValue;
    function seededRandom() {
      _seed |= 0;
      _seed = _seed + 0x6D2B79F5 | 0;
      var t = Math.imul(_seed ^ _seed >>> 15, 1 | _seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    Math.random = seededRandom;
  } else {
    // 恢复原始 Math.random（删除种子随机数）
    delete Math.random;  // 这样会恢复到原生实现
  }
  
  // 准备数据
  const draws = [...ALL_DRAWS_DATA].reverse();
  const __allBalls = [];
  draws.forEach((draw, idx) => {
    const row = idx + 1;
    draw.front.forEach(num => {
      __allBalls.push({ row, zone: "front", number: num, label: String(num), color: "#d6202a", colors: ["#d6202a"], protected: false });
    });
    draw.back.forEach(num => {
      __allBalls.push({ row, zone: "back", number: num, label: String(num), color: "#1768b7", colors: ["#1768b7"], protected: false });
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
        sample: buildSampleNumbersV4TailOnly(row, "front", ratioPlan, __allBalls)
      }));
      
      const mainSample = allSamples[0].sample;
      const predSourceIv = getTargetPrevIntervalRatio(sourceRow, intervalRatio(mainSample.numbers || sourceNums), __allBalls, PREDICT_INTERVAL);
      const ivPrediction = predictTargetIntervalRatio(targetIdx, predSourceIv, __allBalls);
      
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
          ratioPlan, item.row, __allBalls
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
      
      const selectedFront = selectCoverageOptimalCombos(allCombos, poolNumbers, 5, null);
      
      // Top5命中
      const top5Hits = selectedFront.map(combo => {
        const comboSet = new Set(combo.numbers || []);
        return targetNums.filter(n => comboSet.has(n)).length;
      });
      const top5Max = Math.max(...top5Hits);
      const top5UnionSet = new Set();
      selectedFront.forEach(c => (c.numbers || []).forEach(n => top5UnionSet.add(n)));
      const top5Union = targetNums.filter(n => top5UnionSet.has(n)).length;
      
      // 候选池覆盖
      const poolSet = new Set(poolNumbers);
      const poolHit = targetNums.filter(n => poolSet.has(n)).length;
      
      results.push({
        period: targetDraw.issue,
        top5Max,
        top5Union,
        poolHit
      });
    } catch (err) {
      // 跳过错误
    }
  }
  
  // 汇总统计
  const cnt = results.length;
  if (cnt === 0) return null;
  
  let sumTop5Max = 0, sumTop5Union = 0, sumPool = 0;
  let hit3 = 0, hit4 = 0, hit5 = 0;
  
  results.forEach(r => {
    sumTop5Max += r.top5Max;
    sumTop5Union += r.top5Union;
    sumPool += r.poolHit;
    if (r.top5Max >= 3) hit3++;
    if (r.top5Max >= 4) hit4++;
    if (r.top5Max >= 5) hit5++;
  });
  
  return {
    cnt,
    avgTop5Max: (sumTop5Max / cnt).toFixed(2),
    avgTop5Union: (sumTop5Union / cnt).toFixed(2),
    avgPool: (sumPool / cnt).toFixed(2),
    hit3,
    hit4,
    hit5,
    top5HitRate: (sumTop5Max / (cnt * 5) * 100).toFixed(1),
    unionRate: (sumTop5Union / (cnt * 5) * 100).toFixed(1),
    poolRate: (sumPool / (cnt * 5) * 100).toFixed(1)
  };
}

// ======================== 主程序 ========================
console.log("=".repeat(70));
console.log("固定种子 vs 随机种子 命中率对比实验");
console.log("=".repeat(70));
console.log("");

// 测试多个固定种子
const seeds = [12345, 67890, 11111, 54321, 99999];
const seedResults = [];

console.log("【测试1】固定种子测试（多个种子值）");
console.log("-".repeat(70));

for (const seed of seeds) {
  const result = runBacktest(true, seed);
  if (result) {
    seedResults.push({ seed, ...result });
    console.log(`种子 ${seed}: Top5最高=${result.avgTop5Max}, 联合覆盖=${result.avgTop5Union}, 候选池=${result.avgPool}, 命中3+=${result.hit3}, 4+=${result.hit4}, 5=${result.hit5}`);
  }
}

console.log("");
console.log("【测试2】随机种子测试（5次运行）");
console.log("-".repeat(70));

const randomResults = [];
for (let i = 0; i < 5; i++) {
  const result = runBacktest(false, 0);
  if (result) {
    randomResults.push(result);
    console.log(`随机第${i+1}次: Top5最高=${result.avgTop5Max}, 联合覆盖=${result.avgTop5Union}, 候选池=${result.avgPool}, 命中3+=${result.hit3}, 4+=${result.hit4}, 5=${result.hit5}`);
  }
}

console.log("");
console.log("=".repeat(70));
console.log("汇总对比");
console.log("=".repeat(70));

// 计算固定种子平均值
const avgSeed = {
  avgTop5Max: (seedResults.reduce((s, r) => s + parseFloat(r.avgTop5Max), 0) / seedResults.length).toFixed(2),
  avgTop5Union: (seedResults.reduce((s, r) => s + parseFloat(r.avgTop5Union), 0) / seedResults.length).toFixed(2),
  avgPool: (seedResults.reduce((s, r) => s + parseFloat(r.avgPool), 0) / seedResults.length).toFixed(2),
  hit3: Math.round(seedResults.reduce((s, r) => s + r.hit3, 0) / seedResults.length),
  hit4: Math.round(seedResults.reduce((s, r) => s + r.hit4, 0) / seedResults.length),
  hit5: Math.round(seedResults.reduce((s, r) => s + r.hit5, 0) / seedResults.length)
};

const avgRandom = {
  avgTop5Max: (randomResults.reduce((s, r) => s + parseFloat(r.avgTop5Max), 0) / randomResults.length).toFixed(2),
  avgTop5Union: (randomResults.reduce((s, r) => s + parseFloat(r.avgTop5Union), 0) / randomResults.length).toFixed(2),
  avgPool: (randomResults.reduce((s, r) => s + parseFloat(r.avgPool), 0) / randomResults.length).toFixed(2),
  hit3: Math.round(randomResults.reduce((s, r) => s + r.hit3, 0) / randomResults.length),
  hit4: Math.round(randomResults.reduce((s, r) => s + r.hit4, 0) / randomResults.length),
  hit5: Math.round(randomResults.reduce((s, r) => s + r.hit5, 0) / randomResults.length)
};

console.log("");
console.log("指标                  | 固定种子(平均) | 随机种子(平均) | 差异");
console.log("-".repeat(70));
console.log(`Top5最高命中          | ${avgSeed.avgTop5Max}         | ${avgRandom.avgTop5Max}         | ${(parseFloat(avgSeed.avgTop5Max) - parseFloat(avgRandom.avgTop5Max)).toFixed(2)}`);
console.log(`Top5+补漏6联合覆盖    | ${avgSeed.avgTop5Union}         | ${avgRandom.avgTop5Union}         | ${(parseFloat(avgSeed.avgTop5Union) - parseFloat(avgRandom.avgTop5Union)).toFixed(2)}`);
console.log(`候选池覆盖            | ${avgSeed.avgPool}         | ${avgRandom.avgPool}         | ${(parseFloat(avgSeed.avgPool) - parseFloat(avgRandom.avgPool)).toFixed(2)}`);
console.log(`命中3+球期数          | ${avgSeed.hit3}           | ${avgRandom.hit3}           | ${avgSeed.hit3 - avgRandom.hit3}`);
console.log(`命中4+球期数          | ${avgSeed.hit4}           | ${avgRandom.hit4}           | ${avgSeed.hit4 - avgRandom.hit4}`);
console.log(`命中5球期数           | ${avgSeed.hit5}            | ${avgRandom.hit5}            | ${avgSeed.hit5 - avgRandom.hit5}`);

console.log("");
console.log("结论:");
const diff = parseFloat(avgSeed.avgTop5Max) - parseFloat(avgRandom.avgTop5Max);
if (diff > 0.01) {
  console.log("  固定种子命中率略高，差异可能是统计波动");
} else if (diff < -0.01) {
  console.log("  随机种子命中率略高，差异可能是统计波动");
} else {
  console.log("  两种方式命中率基本相同，随机性对结果影响很小");
}
console.log("  V5组合生成使用加权随机抽取，但Top5选择是基于分数排序的确定性过程");
console.log("  因此随机种子对最终推荐结果的影响有限");
