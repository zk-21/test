// 权重优化：网格搜索 buildPlusTenTrendMap 最优权重配置
const fs = require('fs');
const src = fs.readFileSync('optimized_picker.js', 'utf-8');
const dataMatch = src.match(/const ALL_DRAWS = (\[[\s\S]*?\]);/);
if (!dataMatch) { console.log('无法提取ALL_DRAWS'); process.exit(1); }
const ALL_DRAWS = eval(dataMatch[1]);

// ===== 工具函数 =====
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

// ===== 趋势映射（参数化权重）=====
function buildTrendMap(sourceIdx, W) {
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
    const proximityBonus = rowDistance <= 3 ? W.proxNear : rowDistance <= 6 ? W.proxMid : rowDistance <= 10 ? W.proxFar : 0;

    const weight =
      exactOverlap * W.exact + neighborOverlap * W.neighbor +
      tailOverlap * W.tail + tailNeighborOverlap * W.tailNb +
      selectedTailSignal * W.selTail + selectedTailNeighborSignal * W.selTailNb +
      ratioMatch * W.ratio + intervalSimilarity * W.ivSim + proximityBonus;

    if (weight <= 0) continue;

    const tgtNumbers = [...histTgt.front];
    tgtNumbers.forEach(number => {
      targetMap.set(number, (targetMap.get(number)||0) + weight);
      [number-1, number+1].forEach(nb => {
        if (nb < 1 || nb > 35) return;
        const nbWeight = Math.max(2, Math.round(weight * W.nbFactor));
        targetMap.set(nb, (targetMap.get(nb)||0) + nbWeight);
      });
    });
  }

  return targetMap;
}

// ===== 回测 =====
function backtest(weights) {
  const startIdx = 12;
  const endIdx = ALL_DRAWS.length - 1 - 10;
  let totalPairs = 0;
  let top5Hits = 0, top5AtLeast3 = 0, top5ZeroBall = 0;
  let top10Hits = 0, top10AtLeast3 = 0;

  for (let sourceIdx = startIdx; sourceIdx <= endIdx; sourceIdx++) {
    const targetIdx = sourceIdx + 10;
    if (targetIdx >= ALL_DRAWS.length) continue;

    const trendScores = buildTrendMap(sourceIdx, weights);
    if (trendScores.size === 0) continue;

    const sorted = [...trendScores.entries()].sort((a,b) => b[1]-a[1]);
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

    totalPairs++;
  }

  return {
    n: totalPairs,
    top5Rate: (top5Hits / (totalPairs * 5) * 100).toFixed(1),
    top5ge3: (top5AtLeast3 / totalPairs * 100).toFixed(1),
    top5zero: top5ZeroBall,
    top10Rate: (top10Hits / (totalPairs * 10) * 100).toFixed(1),
    top10ge3: (top10AtLeast3 / totalPairs * 100).toFixed(1),
  };
}

// ===== 权重配置搜索 =====
const baseWeights = {
  exact: 18, neighbor: 10, tail: 8, tailNb: 4,
  selTail: 5, selTailNb: 2, ratio: 16, ivSim: 3,
  proxNear: 10, proxMid: 6, proxFar: 3, nbFactor: 0.25
};

// 生成候选配置
const configs = [];

// 1. 基线
configs.push({ name: '基线(当前)', w: {...baseWeights} });

// 2. 提高精确重叠权重
for (const exact of [14, 20, 24, 28]) {
  configs.push({ name: `exact=${exact}`, w: {...baseWeights, exact} });
}

// 3. 提高邻号权重
for (const neighbor of [6, 12, 16]) {
  configs.push({ name: `neighbor=${neighbor}`, w: {...baseWeights, neighbor} });
}

// 4. 调整区间比
for (const ratio of [10, 20, 24]) {
  configs.push({ name: `ratio=${ratio}`, w: {...baseWeights, ratio} });
}

// 5. 调整尾号
for (const tail of [4, 10, 12]) {
  configs.push({ name: `tail=${tail}`, w: {...baseWeights, tail} });
}

// 6. 调整距离加成
configs.push({ name: 'proxNear=15', w: {...baseWeights, proxNear: 15} });
configs.push({ name: 'proxNear=5', w: {...baseWeights, proxNear: 5} });
configs.push({ name: 'proxNear=0(无距离加成)', w: {...baseWeights, proxNear: 0, proxMid: 0, proxFar: 0} });

// 7. 调整邻号系数
for (const nbFactor of [0.15, 0.35, 0.5]) {
  configs.push({ name: `nbFactor=${nbFactor}`, w: {...baseWeights, nbFactor} });
}

// 8. 组合优化
configs.push({ name: '高exact+高neighbor', w: {...baseWeights, exact: 24, neighbor: 14} });
configs.push({ name: '高exact+高ratio', w: {...baseWeights, exact: 24, ratio: 22} });
configs.push({ name: '高exact+低prox', w: {...baseWeights, exact: 24, proxNear: 5, proxMid: 3, proxFar: 1} });
configs.push({ name: '高exact+高tail', w: {...baseWeights, exact: 24, tail: 12} });
configs.push({ name: '高exact+高nbFactor', w: {...baseWeights, exact: 24, nbFactor: 0.4} });
configs.push({ name: '全高权重', w: {...baseWeights, exact: 24, neighbor: 14, ratio: 22, tail: 12} });
configs.push({ name: '精确主导', w: {...baseWeights, exact: 30, neighbor: 8, ratio: 12, tail: 6} });
configs.push({ name: '邻号主导', w: {...baseWeights, exact: 12, neighbor: 18, ratio: 10, tail: 6} });
configs.push({ name: '尾号主导', w: {...baseWeights, exact: 12, neighbor: 8, ratio: 10, tail: 16, selTail: 10} });
configs.push({ name: '均衡型', w: {...baseWeights, exact: 16, neighbor: 12, ratio: 16, tail: 10, selTail: 8} });
configs.push({ name: '极简(仅exact+neighbor)', w: {...baseWeights, exact: 20, neighbor: 15, tail: 0, tailNb: 0, selTail: 0, selTailNb: 0, ratio: 0, ivSim: 0, proxNear: 0, proxMid: 0, proxFar: 0} });
configs.push({ name: 'exact+neighbor+ratio', w: {...baseWeights, exact: 20, neighbor: 12, ratio: 18, tail: 4, tailNb: 2, selTail: 3, selTailNb: 1, ivSim: 2} });

console.log('═══════════════════════════════════════════════════════════');
console.log('  权重优化网格搜索（+12期趋势映射）');
console.log('═══════════════════════════════════════════════════════════');
console.log(`  数据: ${ALL_DRAWS.length}期 | 配置数: ${configs.length}`);
console.log('');

const results = [];
for (const cfg of configs) {
  const r = backtest(cfg.w);
  results.push({ name: cfg.name, ...r });
}

// 按Top5命中率排序
results.sort((a, b) => parseFloat(b.top5Rate) - parseFloat(a.top5Rate));

console.log('  ┌────────────────────────────┬─────────┬─────────┬─────────┬─────────┬─────────┬────────┐');
console.log('  │ 配置                        │ Top5命中 │ Top5≥3  │ Top5零球│ Top10命中│ Top10≥3 │ 配对数 │');
console.log('  ├────────────────────────────┼─────────┼─────────┼─────────┼─────────┼─────────┼────────┤');
for (const r of results) {
  const name = r.name.padEnd(26);
  console.log(`  │ ${name} │ ${r.top5Rate.padStart(5)}%  │ ${r.top5ge3.padStart(5)}%  │ ${String(r.top5zero).padStart(5)}   │ ${r.top10Rate.padStart(5)}%  │ ${r.top10ge3.padStart(5)}%  │ ${String(r.n).padStart(4)}   │`);
}
console.log('  └────────────────────────────┴─────────┴─────────┴─────────┴─────────┴─────────┴────────┘');

// 输出最优配置
const best = results[0];
console.log(`\n  🏆 最优配置: ${best.name}`);
console.log(`     Top5命中率: ${best.top5Rate}% | Top5≥3球: ${best.top5ge3}% | Top5零球: ${best.top5zero}`);
