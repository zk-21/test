// 多维度优化实验：测试不同策略对命中率的影响
const fs = require('fs');
const src = fs.readFileSync('optimized_picker.js', 'utf-8');
const dataMatch = src.match(/const ALL_DRAWS = (\[[\s\S]*?\]);/);
if (!dataMatch) { console.log('无法提取ALL_DRAWS'); process.exit(1); }
const ALL_DRAWS = eval(dataMatch[1]);

function gi(n) { return Math.floor((n - 1) / 5); }
function intervalRatio(nums) {
  const c = [0,0,0,0,0,0,0];
  nums.forEach(n => c[gi(n)]++);
  return c;
}
function buildTailNeighborSet(tails) {
  const s = new Set();
  tails.forEach(t => { s.add(t); s.add((t+1)%10); s.add((t+9)%10); });
  return s;
}

// ===== 策略A: 基线（当前+12单间隔） =====
function trendMap_baseline(sourceIdx) {
  const sourceDraw = ALL_DRAWS[sourceIdx];
  if (!sourceDraw) return new Map();
  const sourceNumbers = [...sourceDraw.front].sort((a,b)=>a-b);
  const sourceTails = new Set(sourceNumbers.map(n => n%10));
  const sourceTailNeighborSet = buildTailNeighborSet([...sourceTails]);
  const sourceIv = intervalRatio(sourceNumbers);
  const sourceIvKey = sourceIv.join(":");
  const targetMap = new Map();

  const end = sourceIdx - 12;
  const start = Math.max(0, end - 50);
  for (let i = start; i <= end; i++) {
    const histSrc = ALL_DRAWS[i];
    const histTgt = ALL_DRAWS[i + 12];
    if (!histSrc || !histTgt) continue;
    const histNumbers = [...histSrc.front].sort((a,b)=>a-b);
    const histSet = new Set(histNumbers);
    const histTails = new Set(histNumbers.map(n => n%10));
    const histTailNeighborSet = buildTailNeighborSet([...histTails]);
    const exactOverlap = sourceNumbers.filter(n => histSet.has(n)).length;
    const neighborOverlap = sourceNumbers.filter(n => histSet.has(n-1) || histSet.has(n+1)).length;
    const tailOverlap = sourceNumbers.filter(n => histTails.has(n%10)).length;
    const tailNeighborOverlap = sourceNumbers.filter(n => histTailNeighborSet.has(n%10)).length;
    const selectedTailSignal = histNumbers.filter(n => sourceTails.has(n%10)).length;
    const selectedTailNeighborSignal = histNumbers.filter(n => sourceTailNeighborSet.has(n%10)).length;
    const histIv = intervalRatio(histNumbers);
    const ratioMatch = histIv.join(":") === sourceIvKey ? 1 : 0;
    const intervalDiff = histIv.reduce((t,c,j) => t + Math.abs(c - sourceIv[j]), 0);
    const intervalSimilarity = Math.max(0, 6 - intervalDiff);
    const rowDistance = Math.abs(i - sourceIdx);
    const proximityBonus = rowDistance <= 3 ? 10 : rowDistance <= 6 ? 6 : rowDistance <= 10 ? 3 : 0;
    const weight = exactOverlap*18 + neighborOverlap*10 + tailOverlap*8 + tailNeighborOverlap*4 +
      selectedTailSignal*5 + selectedTailNeighborSignal*2 + ratioMatch*16 + intervalSimilarity*3 + proximityBonus;
    if (weight <= 0) continue;
    [...histTgt.front].forEach(number => {
      targetMap.set(number, (targetMap.get(number)||0) + weight);
      [number-1, number+1].forEach(nb => {
        if (nb < 1 || nb > 35) return;
        targetMap.set(nb, (targetMap.get(nb)||0) + Math.max(2, Math.round(weight*0.25)));
      });
    });
  }
  return targetMap;
}

// ===== 策略B: 扩大回溯窗口（100期） =====
function trendMap_wideLookback(sourceIdx) {
  const sourceDraw = ALL_DRAWS[sourceIdx];
  if (!sourceDraw) return new Map();
  const sourceNumbers = [...sourceDraw.front].sort((a,b)=>a-b);
  const sourceTails = new Set(sourceNumbers.map(n => n%10));
  const sourceTailNeighborSet = buildTailNeighborSet([...sourceTails]);
  const sourceIv = intervalRatio(sourceNumbers);
  const sourceIvKey = sourceIv.join(":");
  const targetMap = new Map();

  const end = sourceIdx - 12;
  const start = Math.max(0, end - 100); // 扩大到100
  for (let i = start; i <= end; i++) {
    const histSrc = ALL_DRAWS[i];
    const histTgt = ALL_DRAWS[i + 12];
    if (!histSrc || !histTgt) continue;
    const histNumbers = [...histSrc.front].sort((a,b)=>a-b);
    const histSet = new Set(histNumbers);
    const histTails = new Set(histNumbers.map(n => n%10));
    const histTailNeighborSet = buildTailNeighborSet([...histTails]);
    const exactOverlap = sourceNumbers.filter(n => histSet.has(n)).length;
    const neighborOverlap = sourceNumbers.filter(n => histSet.has(n-1) || histSet.has(n+1)).length;
    const tailOverlap = sourceNumbers.filter(n => histTails.has(n%10)).length;
    const tailNeighborOverlap = sourceNumbers.filter(n => histTailNeighborSet.has(n%10)).length;
    const selectedTailSignal = histNumbers.filter(n => sourceTails.has(n%10)).length;
    const selectedTailNeighborSignal = histNumbers.filter(n => sourceTailNeighborSet.has(n%10)).length;
    const histIv = intervalRatio(histNumbers);
    const ratioMatch = histIv.join(":") === sourceIvKey ? 1 : 0;
    const intervalDiff = histIv.reduce((t,c,j) => t + Math.abs(c - sourceIv[j]), 0);
    const intervalSimilarity = Math.max(0, 6 - intervalDiff);
    const rowDistance = Math.abs(i - sourceIdx);
    const proximityBonus = rowDistance <= 3 ? 10 : rowDistance <= 6 ? 6 : rowDistance <= 10 ? 3 : 0;
    const weight = exactOverlap*18 + neighborOverlap*10 + tailOverlap*8 + tailNeighborOverlap*4 +
      selectedTailSignal*5 + selectedTailNeighborSignal*2 + ratioMatch*16 + intervalSimilarity*3 + proximityBonus;
    if (weight <= 0) continue;
    [...histTgt.front].forEach(number => {
      targetMap.set(number, (targetMap.get(number)||0) + weight);
      [number-1, number+1].forEach(nb => {
        if (nb < 1 || nb > 35) return;
        targetMap.set(nb, (targetMap.get(nb)||0) + Math.max(2, Math.round(weight*0.25)));
      });
    });
  }
  return targetMap;
}

// ===== 策略C: 多间隔集成（+10, +11, +12, +13 加权融合）=====
function trendMap_multiInterval(sourceIdx) {
  const sourceDraw = ALL_DRAWS[sourceIdx];
  if (!sourceDraw) return new Map();
  const sourceNumbers = [...sourceDraw.front].sort((a,b)=>a-b);
  const sourceTails = new Set(sourceNumbers.map(n => n%10));
  const sourceTailNeighborSet = buildTailNeighborSet([...sourceTails]);
  const sourceIv = intervalRatio(sourceNumbers);
  const sourceIvKey = sourceIv.join(":");
  const targetMap = new Map();

  // 多间隔集成
  const intervals = [
    { iv: 10, w: 0.6 },
    { iv: 11, w: 0.8 },
    { iv: 12, w: 1.0 },
    { iv: 13, w: 0.7 },
    { iv: 14, w: 0.5 },
  ];

  for (const {iv, w: ivWeight} of intervals) {
    const end = sourceIdx - iv;
    const start = Math.max(0, end - 50);
    for (let i = start; i <= end; i++) {
      const histSrc = ALL_DRAWS[i];
      const histTgt = ALL_DRAWS[i + iv];
      if (!histSrc || !histTgt) continue;
      const histNumbers = [...histSrc.front].sort((a,b)=>a-b);
      const histSet = new Set(histNumbers);
      const histTails = new Set(histNumbers.map(n => n%10));
      const histTailNeighborSet = buildTailNeighborSet([...histTails]);
      const exactOverlap = sourceNumbers.filter(n => histSet.has(n)).length;
      const neighborOverlap = sourceNumbers.filter(n => histSet.has(n-1) || histSet.has(n+1)).length;
      const tailOverlap = sourceNumbers.filter(n => histTails.has(n%10)).length;
      const tailNeighborOverlap = sourceNumbers.filter(n => histTailNeighborSet.has(n%10)).length;
      const selectedTailSignal = histNumbers.filter(n => sourceTails.has(n%10)).length;
      const selectedTailNeighborSignal = histNumbers.filter(n => sourceTailNeighborSet.has(n%10)).length;
      const histIv = intervalRatio(histNumbers);
      const ratioMatch = histIv.join(":") === sourceIvKey ? 1 : 0;
      const intervalDiff = histIv.reduce((t,c,j) => t + Math.abs(c - sourceIv[j]), 0);
      const intervalSimilarity = Math.max(0, 6 - intervalDiff);
      const rowDistance = Math.abs(i - sourceIdx);
      const proximityBonus = rowDistance <= 3 ? 10 : rowDistance <= 6 ? 6 : rowDistance <= 10 ? 3 : 0;
      const weight = (exactOverlap*18 + neighborOverlap*10 + tailOverlap*8 + tailNeighborOverlap*4 +
        selectedTailSignal*5 + selectedTailNeighborSignal*2 + ratioMatch*16 + intervalSimilarity*3 + proximityBonus) * ivWeight;
      if (weight <= 0) continue;
      [...histTgt.front].forEach(number => {
        targetMap.set(number, (targetMap.get(number)||0) + weight);
        [number-1, number+1].forEach(nb => {
          if (nb < 1 || nb > 35) return;
          targetMap.set(nb, (targetMap.get(nb)||0) + Math.max(2, Math.round(weight*0.25)));
        });
      });
    }
  }
  return targetMap;
}

// ===== 策略D: 宽松匹配（降低精确匹配门槛，增加匹配对数）=====
function trendMap_looseMatch(sourceIdx) {
  const sourceDraw = ALL_DRAWS[sourceIdx];
  if (!sourceDraw) return new Map();
  const sourceNumbers = [...sourceDraw.front].sort((a,b)=>a-b);
  const sourceTails = new Set(sourceNumbers.map(n => n%10));
  const sourceTailNeighborSet = buildTailNeighborSet([...sourceTails]);
  const sourceIv = intervalRatio(sourceNumbers);
  const sourceIvKey = sourceIv.join(":");
  const targetMap = new Map();

  const end = sourceIdx - 12;
  const start = Math.max(0, end - 50);
  for (let i = start; i <= end; i++) {
    const histSrc = ALL_DRAWS[i];
    const histTgt = ALL_DRAWS[i + 12];
    if (!histSrc || !histTgt) continue;
    const histNumbers = [...histSrc.front].sort((a,b)=>a-b);
    const histSet = new Set(histNumbers);
    const histTails = new Set(histNumbers.map(n => n%10));
    const histTailNeighborSet = buildTailNeighborSet([...histTails]);

    // 宽松匹配：加入"差1"的近似匹配
    const exactOverlap = sourceNumbers.filter(n => histSet.has(n)).length;
    const nearOverlap = sourceNumbers.filter(n => histSet.has(n-1) || histSet.has(n+1)).length;
    const neighborOverlap = nearOverlap;
    const tailOverlap = sourceNumbers.filter(n => histTails.has(n%10)).length;
    const tailNeighborOverlap = sourceNumbers.filter(n => histTailNeighborSet.has(n%10)).length;
    const selectedTailSignal = histNumbers.filter(n => sourceTails.has(n%10)).length;
    const selectedTailNeighborSignal = histNumbers.filter(n => sourceTailNeighborSet.has(n%10)).length;
    const histIv = intervalRatio(histNumbers);
    const ratioMatch = histIv.join(":") === sourceIvKey ? 1 : 0;
    const intervalDiff = histIv.reduce((t,c,j) => t + Math.abs(c - sourceIv[j]), 0);
    const intervalSimilarity = Math.max(0, 8 - intervalDiff); // 更宽松的区间相似度
    const rowDistance = Math.abs(i - sourceIdx);
    const proximityBonus = rowDistance <= 5 ? 12 : rowDistance <= 10 ? 6 : rowDistance <= 20 ? 3 : 0;

    // 提高邻号和尾号权重，降低精确匹配门槛
    const weight = exactOverlap*14 + neighborOverlap*12 + tailOverlap*10 + tailNeighborOverlap*6 +
      selectedTailSignal*6 + selectedTailNeighborSignal*3 + ratioMatch*12 + intervalSimilarity*4 + proximityBonus;
    if (weight <= 0) continue;
    [...histTgt.front].forEach(number => {
      targetMap.set(number, (targetMap.get(number)||0) + weight);
      [number-1, number+1].forEach(nb => {
        if (nb < 1 || nb > 35) return;
        targetMap.set(nb, (targetMap.get(nb)||0) + Math.max(2, Math.round(weight*0.3)));
      });
    });
  }
  return targetMap;
}

// ===== 策略E: 和值/奇偶趋势过滤 =====
function trendMap_withFilter(sourceIdx) {
  // 先预测目标和值范围和奇偶
  const recent5 = [];
  for (let i = Math.max(0, sourceIdx-4); i <= sourceIdx; i++) {
    const nums = ALL_DRAWS[i].front;
    recent5.push({ sum: nums.reduce((a,b)=>a+b,0), odd: nums.filter(n=>n%2===1).length });
  }
  const avgSum = recent5.reduce((a,b)=>a+b.sum,0) / recent5.length;
  const avgOdd = recent5.reduce((a,b)=>a+b.odd,0) / recent5.length;

  const baseMap = trendMap_baseline(sourceIdx);

  // 用历史数据和值/奇偶趋势加权
  const sourceDraw = ALL_DRAWS[sourceIdx];
  const sourceNumbers = [...sourceDraw.front].sort((a,b)=>a-b);
  const end = sourceIdx - 12;
  const start = Math.max(0, end - 50);

  const filteredMap = new Map();
  for (let i = start; i <= end; i++) {
    const histSrc = ALL_DRAWS[i];
    const histTgt = ALL_DRAWS[i + 12];
    if (!histSrc || !histTgt) continue;
    const histNumbers = [...histSrc.front].sort((a,b)=>a-b);
    const histSet = new Set(histNumbers);
    const exactOverlap = sourceNumbers.filter(n => histSet.has(n)).length;
    if (exactOverlap < 1) continue; // 至少1个精确匹配

    const tgtSum = histTgt.front.reduce((a,b)=>a+b,0);
    const tgtOdd = histTgt.front.filter(n=>n%2===1).length;

    // 和值/奇偶相似度加成
    const sumDiff = Math.abs(tgtSum - avgSum);
    const sumBonus = sumDiff <= 10 ? 1.3 : sumDiff <= 20 ? 1.1 : 0.8;
    const oddDiff = Math.abs(tgtOdd - avgOdd);
    const oddBonus = oddDiff <= 1 ? 1.2 : 1.0;

    const structuralBonus = sumBonus * oddBonus;

    [...histTgt.front].forEach(number => {
      const base = baseMap.get(number) || 0;
      filteredMap.set(number, base * structuralBonus);
    });
  }

  // 合并原始分数和过滤分数
  const merged = new Map(baseMap);
  filteredMap.forEach((v, k) => {
    merged.set(k, (merged.get(k)||0) + v * 0.5);
  });
  return merged;
}

// ===== 策略F: 动态间隔选择（根据近期命中率自动选最优间隔）=====
function trendMap_adaptiveInterval(sourceIdx) {
  // 用最近10期的留一法验证，找最优间隔
  const testIntervals = [8, 9, 10, 11, 12, 13, 14];
  const intervalScores = new Map();

  for (const iv of testIntervals) {
    let totalHit = 0, count = 0;
    for (let t = Math.max(12, sourceIdx - 15); t <= sourceIdx - 1; t++) {
      const tgtIdx = t + 10; // 预测+10期后的结果
      if (tgtIdx >= ALL_DRAWS.length) continue;

      // 用t-iv期的数据预测t期
      const srcIdx2 = t - iv;
      if (srcIdx2 < 0) continue;
      const srcNums = new Set(ALL_DRAWS[srcIdx2].front);
      const tgtNums = new Set(ALL_DRAWS[t].front);
      let hit = 0;
      srcNums.forEach(n => { if (tgtNums.has(n)) hit++; });
      totalHit += hit;
      count++;
    }
    intervalScores.set(iv, count > 0 ? totalHit / count : 0);
  }

  // 选top3间隔
  const sorted = [...intervalScores.entries()].sort((a,b) => b[1]-a[1]);
  const top3 = sorted.slice(0, 3);

  const sourceDraw = ALL_DRAWS[sourceIdx];
  if (!sourceDraw) return new Map();
  const sourceNumbers = [...sourceDraw.front].sort((a,b)=>a-b);
  const sourceTails = new Set(sourceNumbers.map(n => n%10));
  const sourceTailNeighborSet = buildTailNeighborSet([...sourceTails]);
  const sourceIv = intervalRatio(sourceNumbers);
  const sourceIvKey = sourceIv.join(":");
  const targetMap = new Map();

  for (const [iv, score] of top3) {
    const ivWeight = 0.5 + score * 5; // 根据历史命中率加权
    const end = sourceIdx - iv;
    const start = Math.max(0, end - 50);
    for (let i = start; i <= end; i++) {
      const histSrc = ALL_DRAWS[i];
      const histTgt = ALL_DRAWS[i + iv];
      if (!histSrc || !histTgt) continue;
      const histNumbers = [...histSrc.front].sort((a,b)=>a-b);
      const histSet = new Set(histNumbers);
      const histTails = new Set(histNumbers.map(n => n%10));
      const histTailNeighborSet = buildTailNeighborSet([...histTails]);
      const exactOverlap = sourceNumbers.filter(n => histSet.has(n)).length;
      const neighborOverlap = sourceNumbers.filter(n => histSet.has(n-1) || histSet.has(n+1)).length;
      const tailOverlap = sourceNumbers.filter(n => histTails.has(n%10)).length;
      const tailNeighborOverlap = sourceNumbers.filter(n => histTailNeighborSet.has(n%10)).length;
      const selectedTailSignal = histNumbers.filter(n => sourceTails.has(n%10)).length;
      const selectedTailNeighborSignal = histNumbers.filter(n => sourceTailNeighborSet.has(n%10)).length;
      const histIv = intervalRatio(histNumbers);
      const ratioMatch = histIv.join(":") === sourceIvKey ? 1 : 0;
      const intervalDiff = histIv.reduce((t,c,j) => t + Math.abs(c - sourceIv[j]), 0);
      const intervalSimilarity = Math.max(0, 6 - intervalDiff);
      const rowDistance = Math.abs(i - sourceIdx);
      const proximityBonus = rowDistance <= 3 ? 10 : rowDistance <= 6 ? 6 : rowDistance <= 10 ? 3 : 0;
      const weight = (exactOverlap*18 + neighborOverlap*10 + tailOverlap*8 + tailNeighborOverlap*4 +
        selectedTailSignal*5 + selectedTailNeighborSignal*2 + ratioMatch*16 + intervalSimilarity*3 + proximityBonus) * ivWeight;
      if (weight <= 0) continue;
      [...histTgt.front].forEach(number => {
        targetMap.set(number, (targetMap.get(number)||0) + weight);
        [number-1, number+1].forEach(nb => {
          if (nb < 1 || nb > 35) return;
          targetMap.set(nb, (targetMap.get(nb)||0) + Math.max(2, Math.round(weight*0.25)));
        });
      });
    }
  }
  return targetMap;
}

// ===== 策略G: 号码级频率统计（不匹配模式，直接统计历史目标频率）=====
function trendMap_frequencyOnly(sourceIdx) {
  const targetMap = new Map();
  // 直接统计最近N期的+12期目标号码频率
  const end = sourceIdx - 12;
  const start = Math.max(0, end - 30);
  for (let i = start; i <= end; i++) {
    const histTgt = ALL_DRAWS[i + 12];
    if (!histTgt) continue;
    const rowDistance = Math.abs(i - sourceIdx);
    const recency = Math.max(1, 10 - Math.floor(rowDistance / 3));
    [...histTgt.front].forEach(n => {
      targetMap.set(n, (targetMap.get(n)||0) + recency);
      [n-1, n+1].forEach(nb => {
        if (nb < 1 || nb > 35) return;
        targetMap.set(nb, (targetMap.get(nb)||0) + Math.max(1, Math.round(recency * 0.3)));
      });
    });
  }
  return targetMap;
}

// ===== 回测引擎 =====
function backtest(trendFn, label) {
  const startIdx = 15;
  const endIdx = ALL_DRAWS.length - 1 - 10;
  let totalPairs = 0;
  let top5Hits = 0, top5AtLeast3 = 0, top5ZeroBall = 0;
  let top10Hits = 0, top10AtLeast3 = 0;
  let top15Hits = 0, top15AtLeast3 = 0;

  for (let sourceIdx = startIdx; sourceIdx <= endIdx; sourceIdx++) {
    const targetIdx = sourceIdx + 10;
    if (targetIdx >= ALL_DRAWS.length) continue;

    const scores = trendFn(sourceIdx);
    if (scores.size === 0) continue;

    const sorted = [...scores.entries()].sort((a,b) => b[1]-a[1]);
    const targetDraw = ALL_DRAWS[targetIdx];
    const targetNumbers = new Set(targetDraw.front);

    // Top5
    const top5 = sorted.slice(0, 5).map(([n]) => n);
    let hit5 = 0;
    top5.forEach(n => { if (targetNumbers.has(n)) hit5++; });
    top5Hits += hit5;
    if (hit5 >= 3) top5AtLeast3++;
    if (hit5 === 0) top5ZeroBall++;

    // Top10
    const top10 = sorted.slice(0, 10).map(([n]) => n);
    let hit10 = 0;
    top10.forEach(n => { if (targetNumbers.has(n)) hit10++; });
    top10Hits += hit10;
    if (hit10 >= 3) top10AtLeast3++;

    // Top15
    const top15 = sorted.slice(0, 15).map(([n]) => n);
    let hit15 = 0;
    top15.forEach(n => { if (targetNumbers.has(n)) hit15++; });
    top15Hits += hit15;
    if (hit15 >= 3) top15AtLeast3++;

    totalPairs++;
  }

  return {
    label, n: totalPairs,
    top5Rate: (top5Hits / (totalPairs * 5) * 100).toFixed(1),
    top5ge3: (top5AtLeast3 / totalPairs * 100).toFixed(1),
    top5zero: top5ZeroBall,
    top10Rate: (top10Hits / (totalPairs * 10) * 100).toFixed(1),
    top10ge3: (top10AtLeast3 / totalPairs * 100).toFixed(1),
    top15Rate: (top15Hits / (totalPairs * 15) * 100).toFixed(1),
    top15ge3: (top15AtLeast3 / totalPairs * 100).toFixed(1),
  };
}

// ===== 运行所有策略 =====
console.log('═══════════════════════════════════════════════════════════════════');
console.log('  多维度优化策略对比实验');
console.log('═══════════════════════════════════════════════════════════════════');
console.log(`  数据: ${ALL_DRAWS.length}期 | 仅测试趋势映射信号质量`);
console.log('');

const strategies = [
  [trendMap_baseline, 'A: 基线(+12单间隔,lookback=50)'],
  [trendMap_wideLookback, 'B: 扩大回溯(lookback=100)'],
  [trendMap_multiInterval, 'C: 多间隔集成(+10~+14加权)'],
  [trendMap_looseMatch, 'D: 宽松匹配(提高邻号/尾号权重)'],
  [trendMap_withFilter, 'E: 和值/奇偶趋势过滤'],
  [trendMap_adaptiveInterval, 'F: 动态间隔选择(自适应)'],
  [trendMap_frequencyOnly, 'G: 纯频率统计(无模式匹配)'],
];

const results = [];
for (const [fn, label] of strategies) {
  results.push(backtest(fn, label));
}

// 按Top5命中率排序
results.sort((a, b) => parseFloat(b.top5Rate) - parseFloat(a.top5Rate));

console.log('  ┌──────────────────────────────────────┬────────┬────────┬────────┬────────┬────────┬────────┬────────┐');
console.log('  │ 策略                                  │ Top5   │ Top5≥3 │ Top5零 │ Top10  │ Top10≥3│ Top15  │ Top15≥3│');
console.log('  ├──────────────────────────────────────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┤');
for (const r of results) {
  const name = r.label.padEnd(36);
  console.log(`  │ ${name} │ ${r.top5Rate.padStart(5)}% │ ${r.top5ge3.padStart(5)}% │ ${String(r.top5zero).padStart(4)}   │ ${r.top10Rate.padStart(5)}% │ ${r.top10ge3.padStart(5)}% │ ${r.top15Rate.padStart(5)}% │ ${r.top15ge3.padStart(5)}% │`);
}
console.log('  └──────────────────────────────────────┴────────┴────────┴────────┴────────┴────────┴────────┴────────┘');
console.log(`  配对数: ${results[0].n}`);
