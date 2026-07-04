// 尾号模式评分权重优化实验
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

// ===== 尾号模式评分（参数化）=====
function scoreTailPatterns(comboNumbers, config) {
  const tails = [...new Set(comboNumbers.map(n => n % 10))].sort((a,b) => a-b);
  let score = 0;

  // 连续尾号
  let longestConsec = 1, currentConsec = 1;
  for (let i = 1; i < tails.length; i++) {
    if (tails[i] === tails[i-1] + 1) { currentConsec++; longestConsec = Math.max(longestConsec, currentConsec); }
    else currentConsec = 1;
  }
  if (tails.includes(0) && tails.includes(9)) {
    let wrapRun = 1;
    for (let i = tails.length - 1; i >= 0 && tails[i] >= 9; i--) wrapRun++;
    longestConsec = Math.max(longestConsec, wrapRun);
  }
  if (longestConsec >= 3) score += config.consec3;
  else if (longestConsec >= 2) score += config.consec2;

  // 等差尾号
  for (let d = 2; d <= 4; d++) {
    for (let start = 0; start <= 9 - d * 2; start++) {
      let count = 0;
      for (let v = start; v <= 9; v += d) {
        if (tails.includes(v)) count++;
        else break;
      }
      if (count >= 4) score += config.arith4;
      else if (count >= 3) score += config.arith3;
    }
  }

  // 尾号多样性（新增）
  if (config.tailDiversity) {
    if (tails.length >= 5) score += config.tailDiversity * 2;
    else if (tails.length >= 4) score += config.tailDiversity;
  }

  return { score, longestConsec, tailCount: tails.length };
}

// ===== 趋势映射（基线）=====
function buildTrendMap(sourceIdx) {
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

// ===== 组合评分（参数化尾号权重）=====
function scoreCombo(sorted, baseScores, tailConfig, tailWeight) {
  const s = sorted.reduce((a,b) => a+b, 0);
  const sp = sorted[sorted.length-1] - sorted[0];
  const odd = sorted.filter(n => n%2===1).length;
  if (odd === 0 || odd === 5) return -9999;
  if (sp < 3 || sp > 34) return -9999;
  if (s < 25 || s > 160) return -9999;

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

  // 基础结构
  if (s >= 60 && s <= 120) comboBonus += 6;
  if (sp >= 15 && sp <= 30) comboBonus += 5;
  if (odd === 2 || odd === 3) comboBonus += 6;
  if (!iv.includes(0)) comboBonus += 5;
  else if (iv.filter(c => c === 0).length === 1) comboBonus += 2;

  // 尾号模式
  const tailPattern = scoreTailPatterns(sorted, tailConfig);
  comboBonus += tailPattern.score * tailWeight;

  return baseScore + comboBonus;
}

// ===== 回测 =====
function backtest(tailConfig, tailWeight, label) {
  const startIdx = 15;
  const endIdx = ALL_DRAWS.length - 1 - 10;
  let totalPairs = 0;
  let top5Hits = 0, top5AtLeast3 = 0, top5ZeroBall = 0;
  let top10Hits = 0, top10AtLeast3 = 0;

  for (let sourceIdx = startIdx; sourceIdx <= endIdx; sourceIdx++) {
    const targetIdx = sourceIdx + 10;
    if (targetIdx >= ALL_DRAWS.length) continue;

    const trendScores = buildTrendMap(sourceIdx);
    if (trendScores.size === 0) continue;

    const sorted = [...trendScores.entries()].sort((a,b) => b[1]-a[1]);
    const top25 = sorted.slice(0, 25).map(([n]) => n);
    const targetDraw = ALL_DRAWS[targetIdx];
    const targetNumbers = new Set(targetDraw.front);

    // 枚举组合（限制数量）
    const combos = [];
    const maxCombos = 500;
    for (let a = 0; a < top25.length && combos.length < maxCombos; a++) {
      for (let b = a+1; b < top25.length && combos.length < maxCombos; b++) {
        for (let c = b+1; c < top25.length && combos.length < maxCombos; c++) {
          for (let d = c+1; d < top25.length && combos.length < maxCombos; d++) {
            for (let e = d+1; e < top25.length && combos.length < maxCombos; e++) {
              const combo = [top25[a], top25[b], top25[c], top25[d], top25[e]].sort((x,y) => x-y);
              const score = scoreCombo(combo, trendScores, tailConfig, tailWeight);
              if (score > -9999) {
                combos.push({ nums: combo, score });
              }
            }
          }
        }
      }
    }

    // 按分数排序，取top5组合
    combos.sort((a,b) => b.score - a.score);
    const topCombos = combos.slice(0, 5);

    // Top5号码（从top组合中提取）
    const top5Nums = new Set();
    topCombos.forEach(c => c.nums.forEach(n => top5Nums.add(n)));
    const top5 = [...top5Nums].slice(0, 5);

    let hit5 = 0;
    top5.forEach(n => { if (targetNumbers.has(n)) hit5++; });
    top5Hits += hit5;
    if (hit5 >= 3) top5AtLeast3++;
    if (hit5 === 0) top5ZeroBall++;

    // Top10
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
  {
    label: '基线(当前)',
    tailConfig: { consec2: 15, consec3: 30, arith3: 12, arith4: 25 },
    tailWeight: 0.4
  },
  {
    label: '提高连续尾号',
    tailConfig: { consec2: 20, consec3: 40, arith3: 12, arith4: 25 },
    tailWeight: 0.5
  },
  {
    label: '提高等差尾号',
    tailConfig: { consec2: 15, consec3: 30, arith3: 18, arith4: 35 },
    tailWeight: 0.5
  },
  {
    label: '加入尾号多样性',
    tailConfig: { consec2: 15, consec3: 30, arith3: 12, arith4: 25, tailDiversity: 8 },
    tailWeight: 0.4
  },
  {
    label: '高尾号权重',
    tailConfig: { consec2: 20, consec3: 40, arith3: 15, arith4: 30, tailDiversity: 10 },
    tailWeight: 0.6
  },
  {
    label: '低尾号权重',
    tailConfig: { consec2: 10, consec3: 20, arith3: 8, arith4: 15, tailDiversity: 5 },
    tailWeight: 0.3
  },
  {
    label: '仅连续尾号',
    tailConfig: { consec2: 25, consec3: 50, arith3: 0, arith4: 0 },
    tailWeight: 0.5
  },
  {
    label: '仅等差尾号',
    tailConfig: { consec2: 0, consec3: 0, arith3: 20, arith4: 40 },
    tailWeight: 0.5
  },
  {
    label: '仅尾号多样性',
    tailConfig: { consec2: 0, consec3: 0, arith3: 0, arith4: 0, tailDiversity: 15 },
    tailWeight: 0.5
  },
  {
    label: '无尾号模式',
    tailConfig: { consec2: 0, consec3: 0, arith3: 0, arith4: 0 },
    tailWeight: 0
  },
];

console.log('═══════════════════════════════════════════════════════════');
console.log('  尾号模式评分权重优化实验');
console.log('═══════════════════════════════════════════════════════════');
console.log(`  数据: ${ALL_DRAWS.length}期 | 配置数: ${configs.length}`);
console.log('');

const results = [];
for (const cfg of configs) {
  const r = backtest(cfg.tailConfig, cfg.tailWeight, cfg.label);
  results.push(r);
}

// 按Top5命中率排序
results.sort((a, b) => parseFloat(b.top5Rate) - parseFloat(a.top5Rate));

console.log('  ┌────────────────────────┬────────┬────────┬────────┬────────┬────────┐');
console.log('  │ 配置                    │ Top5   │ Top5≥3 │ Top5零 │ Top10  │ Top10≥3│');
console.log('  ├────────────────────────┼────────┼────────┼────────┼────────┼────────┤');
for (const r of results) {
  const name = r.label.padEnd(22);
  console.log(`  │ ${name} │ ${r.top5Rate.padStart(5)}% │ ${r.top5ge3.padStart(5)}% │ ${String(r.top5zero).padStart(4)}   │ ${r.top10Rate.padStart(5)}% │ ${r.top10ge3.padStart(5)}% │`);
}
console.log('  └────────────────────────┴────────┴────────┴────────┴────────┴────────┘');
console.log(`  配对数: ${results[0].n}`);

// 输出最优配置
const best = results[0];
console.log(`\n  🏆 最优配置: ${best.label}`);
console.log(`     Top5命中率: ${best.top5Rate}% | Top5≥3球: ${best.top5ge3}% | Top5零球: ${best.top5zero}`);
