// 趋势映射参数 + 结构约束综合优化
const fs = require('fs');
const src = fs.readFileSync('optimized_picker.js', 'utf-8');
const dataMatch = src.match(/const ALL_DRAWS = (\[[\s\S]*?\]);/);
if (!dataMatch) { console.log('无法提取ALL_DRAWS'); process.exit(1); }
const ALL_DRAWS = eval(dataMatch[1]);

console.log('═══════════════════════════════════════════════════════════');
console.log('  趋势映射参数 + 结构约束综合优化');
console.log('═══════════════════════════════════════════════════════════');
console.log(`  数据: ${ALL_DRAWS.length}期\n`);

function intervalRatio(numbers) {
  const zones = [0, 0, 0];
  numbers.forEach(n => {
    if (n <= 12) zones[0]++;
    else if (n <= 24) zones[1]++;
    else zones[2]++;
  });
  return zones;
}

function buildTrendMap(sourceIdx, params) {
  const sourceDraw = ALL_DRAWS[sourceIdx];
  if (!sourceDraw) return new Map();
  const sourceNumbers = [...sourceDraw.front].sort((a,b)=>a-b);
  const sourceTails = new Set(sourceNumbers.map(n => n%10));
  const sourceTailNeighborSet = new Set();
  sourceTails.forEach(t => {
    sourceTailNeighborSet.add(t);
    sourceTailNeighborSet.add((t + 1) % 10);
    sourceTailNeighborSet.add((t + 9) % 10);
  });
  const sourceIv = intervalRatio(sourceNumbers);
  const sourceIvKey = sourceIv.join(':');

  const end = sourceIdx - params.interval;
  const start = Math.max(0, end - params.lookback);
  const targetMap = new Map();
  const neighborMap = new Map();

  for (let i = start; i <= end; i++) {
    const histSrc = ALL_DRAWS[i];
    const histTgt = ALL_DRAWS[i + params.interval];
    if (!histSrc || !histTgt) continue;
    const histNumbers = [...histSrc.front].sort((a,b)=>a-b);
    const histSet = new Set(histNumbers);
    const histTails = new Set(histNumbers.map(n => n%10));
    const histTailNeighborSet = new Set();
    histTails.forEach(t => {
      histTailNeighborSet.add(t);
      histTailNeighborSet.add((t + 1) % 10);
      histTailNeighborSet.add((t + 9) % 10);
    });

    const exactOverlap = sourceNumbers.filter(n => histSet.has(n)).length;
    const neighborOverlap = sourceNumbers.filter(n => histSet.has(n-1) || histSet.has(n+1)).length;
    const tailOverlap = sourceNumbers.filter(n => histTails.has(n%10)).length;
    const tailNeighborOverlap = sourceNumbers.filter(n => histTailNeighborSet.has(n%10)).length;
    const selectedTailSignal = histNumbers.filter(n => sourceTails.has(n%10)).length;
    const selectedTailNeighborSignal = histNumbers.filter(n => sourceTailNeighborSet.has(n%10)).length;
    const histIv = intervalRatio(histNumbers);
    const ratioMatch = histIv.join(':') === sourceIvKey ? 1 : 0;
    const intervalDiff = histIv.reduce((t,c,j) => t + Math.abs(c - sourceIv[j]), 0);
    const intervalSimilarity = Math.max(0, 6 - intervalDiff);
    const rowDistance = Math.abs(i - sourceIdx);
    const proximityBonus = rowDistance <= 3 ? 10 : rowDistance <= 6 ? 6 : rowDistance <= 10 ? 3 : 0;

    let weight = exactOverlap * 18 + neighborOverlap * 10 +
      tailOverlap * 8 + tailNeighborOverlap * 4 +
      selectedTailSignal * 5 + selectedTailNeighborSignal * 2 +
      ratioMatch * 16 + intervalSimilarity * 3 + proximityBonus;
    if (weight <= 0) continue;

    [...histTgt.front].forEach(number => {
      targetMap.set(number, (targetMap.get(number)||0) + weight);
      for (let d = 1; d <= 3; d++) {
        [number - d, number + d].forEach(nb => {
          if (nb < 1 || nb > 35) return;
          const nbWeight = Math.max(1, Math.round(weight * 0.4 * (1 - d * 0.2)));
          neighborMap.set(nb, (neighborMap.get(nb) || 0) + nbWeight);
        });
      }
    });
  }

  neighborMap.forEach((v, k) => {
    targetMap.set(k, (targetMap.get(k) || 0) + v);
  });
  return targetMap;
}

function backtest(params, label) {
  const startIdx = Math.max(params.interval + 3, 15);
  const endIdx = ALL_DRAWS.length - 1 - params.predictOffset;
  let totalPairs = 0;
  const hitDist = [0, 0, 0, 0, 0, 0];

  for (let sourceIdx = startIdx; sourceIdx <= endIdx; sourceIdx++) {
    const targetIdx = sourceIdx + params.predictOffset;
    if (targetIdx >= ALL_DRAWS.length) continue;

    const trendScores = buildTrendMap(sourceIdx, params);
    if (trendScores.size === 0) continue;

    const sorted = [...trendScores.entries()].sort((a,b) => b[1]-a[1]);
    const top20 = sorted.slice(0, 20).map(([n]) => n);
    const targetDraw = ALL_DRAWS[targetIdx];
    const targetNumbers = new Set(targetDraw.front);

    const combos = [];
    const pool = top20;

    for (let i = 0; i < pool.length; i++) {
      for (let j = i+1; j < pool.length; j++) {
        for (let k = j+1; k < pool.length; k++) {
          for (let l = k+1; l < pool.length; l++) {
            for (let m = l+1; m < pool.length; m++) {
              const combo = [pool[i], pool[j], pool[k], pool[l], pool[m]].sort((a,b) => a-b);
              const unique = [...new Set(combo)];
              if (unique.length !== 5) continue;
              const s = unique.reduce((a,b) => a+b, 0);
              if (s < params.sumMin || s > params.sumMax) continue;
              const sp = unique[4] - unique[0];
              if (sp < params.spanMin || sp > params.spanMax) continue;

              let maxRun = 1, run = 1;
              for (let x = 1; x < unique.length; x++) {
                if (unique[x] === unique[x-1] + 1) { run++; maxRun = Math.max(maxRun, run); }
                else run = 1;
              }
              if (maxRun > 3) continue;

              const hit = unique.filter(n => targetNumbers.has(n)).length;
              let score = unique.reduce((s2, n) => s2 + (trendScores.get(n) || 0), 0);

              // 结构评分
              if (sp >= 18 && sp <= 24) score += 18;
              else if (sp >= 26 && sp <= 33) score += 12;
              const odd = unique.filter(n => n%2===1).length;
              if (odd === 2) score += 12;
              if (odd === 3) score += 8;
              const iv = intervalRatio(unique);
              const ivKey = iv.join(':');
              if (ivKey === '2:2:1' || ivKey === '1:2:2' || ivKey === '2:1:2') score += 24;
              if (ivKey === '1:3:1' || ivKey === '1:4:0') score += 16;
              const tailSet = new Set(unique.map(n => n%10));
              if (tailSet.size >= 4) score += 10;

              combos.push({ combo: unique, hit, score });
            }
          }
        }
      }
    }

    combos.sort((a,b) => b.score - a.score);
    const top5 = combos.slice(0, 5);
    const bestHit = top5[0]?.hit || 0;
    totalPairs++;
    hitDist[bestHit]++;
  }

  const hit1 = hitDist.slice(1).reduce((a,b)=>a+b,0);
  const hit3 = hitDist.slice(3).reduce((a,b)=>a+b,0);
  const avg = hitDist.reduce((s,v,i) => s+v*i, 0) / totalPairs;

  return {
    label, totalPairs,
    top5Rate: (hit1/totalPairs*100).toFixed(1),
    top5ge3: (hit3/totalPairs*100).toFixed(1),
    zeroBall: hitDist[0],
    avgHit: avg.toFixed(2),
    hitDist
  };
}

// ===== 实验1: 趋势映射间隔 =====
console.log('═══════════════════════════════════════════════════════════');
console.log('  实验1: 趋势映射间隔 (+10 ~ +16)');
console.log('═══════════════════════════════════════════════════════════\n');

const intervalResults = [];
for (let interval = 10; interval <= 16; interval++) {
  const r = backtest({
    interval, lookback: 50, predictOffset: 10,
    sumMin: 68, sumMax: 108, spanMin: 14, spanMax: 34
  }, `间隔+${interval}`);
  intervalResults.push(r);
  console.log(`  间隔+${interval}: Top5=${r.top5Rate}%, ≥3球=${r.top5ge3}%, 零球=${r.zeroBall}, 平均=${r.avgHit}`);
}

// ===== 实验2: lookback窗口 =====
console.log('\n═══════════════════════════════════════════════════════════');
console.log('  实验2: lookback窗口 (30 ~ 70)');
console.log('═══════════════════════════════════════════════════════════\n');

const lookbackResults = [];
for (let lb = 30; lb <= 70; lb += 10) {
  const r = backtest({
    interval: 12, lookback: lb, predictOffset: 10,
    sumMin: 68, sumMax: 108, spanMin: 14, spanMax: 34
  }, `lookback=${lb}`);
  lookbackResults.push(r);
  console.log(`  lookback=${lb}: Top5=${r.top5Rate}%, ≥3球=${r.top5ge3}%, 零球=${r.zeroBall}, 平均=${r.avgHit}`);
}

// ===== 实验3: 预测偏移 =====
console.log('\n═══════════════════════════════════════════════════════════');
console.log('  实验3: 预测偏移 (+8 ~ +14)');
console.log('═══════════════════════════════════════════════════════════\n');

const offsetResults = [];
for (let off = 8; off <= 14; off++) {
  const r = backtest({
    interval: 12, lookback: 50, predictOffset: off,
    sumMin: 68, sumMax: 108, spanMin: 14, spanMax: 34
  }, `预测偏移+${off}`);
  offsetResults.push(r);
  console.log(`  预测偏移+${off}: Top5=${r.top5Rate}%, ≥3球=${r.top5ge3}%, 零球=${r.zeroBall}, 平均=${r.avgHit}`);
}

// ===== 实验4: 和值范围 =====
console.log('\n═══════════════════════════════════════════════════════════');
console.log('  实验4: 和值范围');
console.log('═══════════════════════════════════════════════════════════\n');

const sumConfigs = [
  { sumMin: 60, sumMax: 120, label: '[60,120] 宽' },
  { sumMin: 65, sumMax: 115, label: '[65,115]' },
  { sumMin: 68, sumMax: 108, label: '[68,108] 当前' },
  { sumMin: 70, sumMax: 105, label: '[70,105]' },
  { sumMin: 72, sumMax: 100, label: '[72,100] 紧' },
  { sumMin: 75, sumMax: 95,  label: '[75,95] 极紧' },
];

const sumResults = [];
sumConfigs.forEach(c => {
  const r = backtest({
    interval: 12, lookback: 50, predictOffset: 10,
    sumMin: c.sumMin, sumMax: c.sumMax, spanMin: 14, spanMax: 34
  }, c.label);
  sumResults.push(r);
  console.log(`  和值${c.label}: Top5=${r.top5Rate}%, ≥3球=${r.top5ge3}%, 零球=${r.zeroBall}, 平均=${r.avgHit}`);
});

// ===== 实验5: 跨度范围 =====
console.log('\n═══════════════════════════════════════════════════════════');
console.log('  实验5: 跨度范围');
console.log('═══════════════════════════════════════════════════════════\n');

const spanConfigs = [
  { spanMin: 10, spanMax: 34, label: '[10,34] 宽' },
  { spanMin: 14, spanMax: 34, label: '[14,34] 当前' },
  { spanMin: 16, spanMax: 32, label: '[16,32]' },
  { spanMin: 18, spanMax: 30, label: '[18,30] 紧' },
  { spanMin: 20, spanMax: 28, label: '[20,28] 极紧' },
];

const spanResults = [];
spanConfigs.forEach(c => {
  const r = backtest({
    interval: 12, lookback: 50, predictOffset: 10,
    sumMin: 68, sumMax: 108, spanMin: c.spanMin, spanMax: c.spanMax
  }, c.label);
  spanResults.push(r);
  console.log(`  跨度${c.label}: Top5=${r.top5Rate}%, ≥3球=${r.top5ge3}%, 零球=${r.zeroBall}, 平均=${r.avgHit}`);
});

// ===== 实验6: 综合最优组合 =====
console.log('\n═══════════════════════════════════════════════════════════');
console.log('  实验6: 综合最优参数组合');
console.log('═══════════════════════════════════════════════════════════\n');

// 从上面实验中选最优参数组合
const bestInterval = intervalResults.sort((a,b) => parseFloat(b.top5Rate) - parseFloat(a.top5Rate))[0];
const bestLookback = lookbackResults.sort((a,b) => parseFloat(b.top5Rate) - parseFloat(a.top5Rate))[0];
const bestOffset = offsetResults.sort((a,b) => parseFloat(b.top5Rate) - parseFloat(a.top5Rate))[0];
const bestSum = sumResults.sort((a,b) => parseFloat(b.top5Rate) - parseFloat(a.top5Rate))[0];
const bestSpan = spanResults.sort((a,b) => parseFloat(b.top5Rate) - parseFloat(a.top5Rate))[0];

console.log(`  最优间隔: ${bestInterval.label} (Top5=${bestInterval.top5Rate}%)`);
console.log(`  最优lookback: ${bestLookback.label} (Top5=${bestLookback.top5Rate}%)`);
console.log(`  最优预测偏移: ${bestOffset.label} (Top5=${bestOffset.top5Rate}%)`);
console.log(`  最优和值: ${bestSum.label} (Top5=${bestSum.top5Rate}%)`);
console.log(`  最优跨度: ${bestSpan.label} (Top5=${bestSpan.top5Rate}%)\n`);

// 提取最优参数
const bestIntervalVal = parseInt(bestInterval.label.match(/\d+/)[0]);
const bestLookbackVal = parseInt(bestLookback.label.match(/\d+/)[0]);
const bestOffsetVal = parseInt(bestOffset.label.match(/\d+/)[0]);

// 测试综合最优 vs 基线
const comboResults = [];

// 基线
const baseline = backtest({
  interval: 12, lookback: 50, predictOffset: 10,
  sumMin: 68, sumMax: 108, spanMin: 14, spanMax: 34
}, '基线(当前参数)');
comboResults.push(baseline);

// 综合最优
const comboBest = backtest({
  interval: bestIntervalVal, lookback: bestLookbackVal, predictOffset: bestOffsetVal,
  sumMin: parseInt(bestSum.label.match(/\d+/)[0]),
  sumMax: parseInt(bestSum.label.match(/\d+/g)[1]),
  spanMin: parseInt(bestSpan.label.match(/\d+/)[0]),
  spanMax: parseInt(bestSpan.label.match(/\d+/g)[1])
}, '综合最优');
comboResults.push(comboBest);

// 手动测试几个有潜力的组合
const manualCombos = [
  { interval: 11, lookback: 50, predictOffset: 10, sumMin: 68, sumMax: 108, spanMin: 14, spanMax: 34, label: '间隔+11' },
  { interval: 13, lookback: 50, predictOffset: 10, sumMin: 68, sumMax: 108, spanMin: 14, spanMax: 34, label: '间隔+13' },
  { interval: 12, lookback: 40, predictOffset: 10, sumMin: 68, sumMax: 108, spanMin: 14, spanMax: 34, label: 'lookback=40' },
  { interval: 12, lookback: 50, predictOffset: 12, sumMin: 68, sumMax: 108, spanMin: 14, spanMax: 34, label: '预测偏移=间隔' },
  { interval: 11, lookback: 40, predictOffset: 10, sumMin: 68, sumMax: 108, spanMin: 14, spanMax: 34, label: '间隔+11+lb40' },
  { interval: 13, lookback: 60, predictOffset: 10, sumMin: 68, sumMax: 108, spanMin: 14, spanMax: 34, label: '间隔+13+lb60' },
];

manualCombos.forEach(c => {
  const r = backtest(c, c.label);
  comboResults.push(r);
});

console.log('┌──────────────────────────────┬────────┬────────┬────────┬────────┐');
console.log('│ 配置                          │ Top5   │ Top5≥3 │ 零球   │ 平均   │');
console.log('├──────────────────────────────┼────────┼────────┼────────┼────────┤');
comboResults.sort((a,b) => parseFloat(b.top5Rate) - parseFloat(a.top5Rate));
comboResults.forEach(r => {
  console.log(`│ ${r.label.padEnd(28)} │ ${r.top5Rate.padStart(5)}% │ ${r.top5ge3.padStart(5)}% │   ${String(r.zeroBall).padStart(2)}   │ ${r.avgHit}  │`);
});
console.log('└──────────────────────────────┴────────┴────────┴────────┴────────┘');
console.log(`配对数: ${comboResults[0].totalPairs}`);

// 命中分布详情
console.log('\n═══════════════════════════════════════════════════════════');
console.log('  命中球数分布详情（Top3配置）');
console.log('═══════════════════════════════════════════════════════════\n');

const top3 = comboResults.slice(0, 3);
console.log('┌──────────┬');
let header = '│ 命中球数  │';
top3.forEach(r => { header += ` ${r.label.padEnd(18)} │`; });
console.log(header);
console.log('├──────────┼' + top3.map(() => '─────────────────────┼').join(''));

for (let h = 5; h >= 0; h--) {
  let row = `│   ${h}球    │`;
  top3.forEach(r => {
    const cnt = r.hitDist[h];
    const pct = (cnt/r.totalPairs*100).toFixed(1);
    row += `  ${String(cnt).padStart(3)} (${pct.padStart(5)}%)   │`;
  });
  console.log(row);
}
console.log('└──────────┴' + top3.map(() => '─────────────────────┴').join(''));
