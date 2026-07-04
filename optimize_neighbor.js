// 邻号与邻号延伸优化实验
const fs = require('fs');
const src = fs.readFileSync('optimized_picker.js', 'utf-8');
const dataMatch = src.match(/const ALL_DRAWS = (\[[\s\S]*?\]);/);
if (!dataMatch) { console.log('无法提取ALL_DRAWS'); process.exit(1); }
const ALL_DRAWS = eval(dataMatch[1]);

console.log('═══════════════════════════════════════════════════════════');
console.log('  邻号与邻号延伸优化实验');
console.log('═══════════════════════════════════════════════════════════');
console.log(`  数据: ${ALL_DRAWS.length}期`);
console.log('');

// ===== 1. 分析历史邻号规律 =====
let totalPairs = 0;
const neighborStats = { exact: 0, nb1: 0, nb2: 0, nb3: 0, nb4: 0, nb5: 0 };

for (let i = 0; i < ALL_DRAWS.length - 2; i++) {
  const src = new Set(ALL_DRAWS[i].front);
  const tgt = ALL_DRAWS[i + 1].front;
  totalPairs++;

  tgt.forEach(n => {
    if (src.has(n)) neighborStats.exact++;
    else if (src.has(n-1) || src.has(n+1)) neighborStats.nb1++;
    else if (src.has(n-2) || src.has(n+2)) neighborStats.nb2++;
    else if (src.has(n-3) || src.has(n+3)) neighborStats.nb3++;
    else if (src.has(n-4) || src.has(n+4)) neighborStats.nb4++;
    else if (src.has(n-5) || src.has(n+5)) neighborStats.nb5++;
  });
}

console.log('  相邻两期号码关系分布:');
console.log('  ┌──────────┬────────┬────────┐');
console.log('  │ 关系类型   │  次数  │  占比  │');
console.log('  ├──────────┼────────┼────────┤');
const total = Object.values(neighborStats).reduce((a,b)=>a+b,0);
for (const [k, v] of Object.entries(neighborStats)) {
  const pct = (v / total * 100).toFixed(1);
  const label = k === 'exact' ? '精确命中' : k === 'nb1' ? '邻号(±1)' : k === 'nb2' ? '隔1号(±2)' : k === 'nb3' ? '隔2号(±3)' : k === 'nb4' ? '隔3号(±4)' : '隔4号(±5)';
  console.log(`  │ ${label.padEnd(10)} │ ${String(v).padStart(4)}   │ ${pct.padStart(5)}% │`);
}
console.log('  └──────────┴────────────────┘');
console.log(`  总号码对: ${total}`);
console.log('');

// ===== 2. 回测不同邻号权重 =====
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

// 趋势映射（支持邻号延伸）
function buildTrendMap(sourceIdx, nbConfig) {
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
    const weight = exactOverlap*18 + neighborOverlap*nbConfig.nbWeight + tailOverlap*8 + tailNeighborOverlap*4 +
      selectedTailSignal*5 + selectedTailNeighborSignal*2 + ratioMatch*16 + intervalSimilarity*3 + proximityBonus;
    if (weight <= 0) continue;
    [...histTgt.front].forEach(number => {
      targetMap.set(number, (targetMap.get(number)||0) + weight);
      // 邻号延伸
      for (let d = 1; d <= nbConfig.nbExtend; d++) {
        [number-d, number+d].forEach(nb => {
          if (nb < 1 || nb > 35) return;
          const nbWeight = Math.max(1, Math.round(weight * nbConfig.nbFactor * (1 - d * 0.2)));
          targetMap.set(nb, (targetMap.get(nb)||0) + nbWeight);
        });
      }
    });
  }
  return targetMap;
}

function scoreCombo(sorted, baseScores) {
  const s = sorted.reduce((a,b) => a+b, 0);
  const sp = sorted[sorted.length-1] - sorted[0];
  const odd = sorted.filter(n => n%2===1).length;
  if (odd === 0 || odd === 5) return -9999;
  if (sp < 14 || sp > 34) return -9999;
  if (s < 68 || s > 108) return -9999;

  let maxConsec = 1, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i-1] === 1) { run++; maxConsec = Math.max(maxConsec, run); }
    else run = 1;
  }
  if (maxConsec > 3) return -9999;

  const iv = [0,0,0];
  sorted.forEach(n => iv[gi(n)]++);
  if (iv[0] >= 5 || iv[2] >= 5) return -9999;

  const baseScore = sorted.reduce((a, n) => a + (baseScores.get(n) || 0), 0);
  let comboBonus = 0;
  if (s >= 68 && s <= 108) comboBonus += 6;
  if (sp >= 15 && sp <= 30) comboBonus += 5;
  if (odd === 2 || odd === 3) comboBonus += 6;
  if (!iv.includes(0)) comboBonus += 5;
  else if (iv.filter(c => c === 0).length === 1) comboBonus += 2;

  return baseScore + comboBonus;
}

function backtest(nbConfig, label) {
  const startIdx = 15;
  const endIdx = ALL_DRAWS.length - 1 - 10;
  let totalPairs = 0;
  let top5Hits = 0, top5AtLeast3 = 0, top5ZeroBall = 0;
  let top10Hits = 0, top10AtLeast3 = 0;

  for (let sourceIdx = startIdx; sourceIdx <= endIdx; sourceIdx++) {
    const targetIdx = sourceIdx + 10;
    if (targetIdx >= ALL_DRAWS.length) continue;

    const trendScores = buildTrendMap(sourceIdx, nbConfig);
    if (trendScores.size === 0) continue;

    const sorted = [...trendScores.entries()].sort((a,b) => b[1]-a[1]);
    const top25 = sorted.slice(0, 25).map(([n]) => n);
    const targetDraw = ALL_DRAWS[targetIdx];
    const targetNumbers = new Set(targetDraw.front);

    const combos = [];
    const maxCombos = 500;
    for (let a = 0; a < top25.length && combos.length < maxCombos; a++) {
      for (let b = a+1; b < top25.length && combos.length < maxCombos; b++) {
        for (let c = b+1; c < top25.length && combos.length < maxCombos; c++) {
          for (let d = c+1; d < top25.length && combos.length < maxCombos; d++) {
            for (let e = d+1; e < top25.length && combos.length < maxCombos; e++) {
              const combo = [top25[a], top25[b], top25[c], top25[d], top25[e]].sort((x,y) => x-y);
              const score = scoreCombo(combo, trendScores);
              if (score > -9999) combos.push({ nums: combo, score });
            }
          }
        }
      }
    }

    combos.sort((a,b) => b.score - a.score);
    const topCombos = combos.slice(0, 5);
    const top5Nums = new Set();
    topCombos.forEach(c => c.nums.forEach(n => top5Nums.add(n)));
    const top5 = [...top5Nums].slice(0, 5);
    let hit5 = 0;
    top5.forEach(n => { if (targetNumbers.has(n)) hit5++; });
    top5Hits += hit5;
    if (hit5 >= 3) top5AtLeast3++;
    if (hit5 === 0) top5ZeroBall++;

    const top10Nums = new Set();
    combos.slice(0, 10).forEach(c => c.nums.forEach(n => top10Nums.add(n)));
    const top10 = [...top10Nums].slice(0, 10);
    let hit10 = 0;
    top10.forEach(n => { if (targetNumbers.has(n)) hit10++; });
    top10Hits += hit10;
    if (hit10 >= 3) top10AtLeast3++;

    totalPairs++;
  }

  return {
    label, n: totalPairs,
    top5Rate: (top5Hits / (totalPairs * 5) * 100).toFixed(1),
    top5ge3: (top5AtLeast3 / totalPairs * 100).toFixed(1),
    top5zero: top5ZeroBall,
    top10Rate: (top10Hits / (totalPairs * 10) * 100).toFixed(1),
    top10ge3: (top10AtLeast3 / totalPairs * 100).toFixed(1),
  };
}

// ===== 测试配置 =====
const configs = [
  { label: '基线(nbWeight=10,extend=1)', nbConfig: { nbWeight: 10, nbExtend: 1, nbFactor: 0.25 } },
  { label: '提高邻号权重(nb=14)', nbConfig: { nbWeight: 14, nbExtend: 1, nbFactor: 0.25 } },
  { label: '降低邻号权重(nb=6)', nbConfig: { nbWeight: 6, nbExtend: 1, nbFactor: 0.25 } },
  { label: '邻号延伸2层(extend=2)', nbConfig: { nbWeight: 10, nbExtend: 2, nbFactor: 0.25 } },
  { label: '邻号延伸3层(extend=3)', nbConfig: { nbWeight: 10, nbExtend: 3, nbFactor: 0.25 } },
  { label: '高权重+延伸2层', nbConfig: { nbWeight: 14, nbExtend: 2, nbFactor: 0.25 } },
  { label: '高权重+延伸3层', nbConfig: { nbWeight: 14, nbExtend: 3, nbFactor: 0.25 } },
  { label: '高因子(0.4)+延伸2层', nbConfig: { nbWeight: 10, nbExtend: 2, nbFactor: 0.4 } },
  { label: '高因子(0.4)+延伸3层', nbConfig: { nbWeight: 10, nbExtend: 3, nbFactor: 0.4 } },
  { label: '无邻号延伸(extend=0)', nbConfig: { nbWeight: 10, nbExtend: 0, nbFactor: 0.25 } },
];

console.log('═══════════════════════════════════════════════════════════');
console.log('  邻号参数回测对比');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

const results = [];
for (const cfg of configs) {
  results.push(backtest(cfg.nbConfig, cfg.label));
}

results.sort((a, b) => parseFloat(b.top5Rate) - parseFloat(a.top5Rate));

console.log('  ┌──────────────────────────────┬────────┬────────┬────────┬────────┬────────┐');
console.log('  │ 配置                          │ Top5   │ Top5≥3 │ Top5零 │ Top10  │ Top10≥3│');
console.log('  ├──────────────────────────────┼────────┼────────┼────────────────┼────────┤');
for (const r of results) {
  const name = r.label.padEnd(28);
  console.log(`  │ ${name} │ ${r.top5Rate.padStart(5)}% │ ${r.top5ge3.padStart(5)}% │ ${String(r.top5zero).padStart(4)}   │ ${r.top10Rate.padStart(5)}% │ ${r.top10ge3.padStart(5)}% │`);
}
console.log('  └──────────────────────────────┴────────┴────────┴────────┴────────┴────────┘');
console.log(`  配对数: ${results[0].n}`);
