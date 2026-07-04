// 连号概率优化实验
const fs = require('fs');
const src = fs.readFileSync('optimized_picker.js', 'utf-8');
const dataMatch = src.match(/const ALL_DRAWS = (\[[\s\S]*?\]);/);
if (!dataMatch) { console.log('无法提取ALL_DRAWS'); process.exit(1); }
const ALL_DRAWS = eval(dataMatch[1]);

console.log('═══════════════════════════════════════════════════════════');
console.log('  连号概率优化实验');
console.log('═══════════════════════════════════════════════════════════');
console.log(`  数据: ${ALL_DRAWS.length}期\n`);

// 统计历史连号概率
function analyzeConsecutiveHistory() {
  const stats = { noConsec: 0, oneDouble: 0, twoDouble: 0, oneTriple: 0, more: 0 };
  
  ALL_DRAWS.forEach(draw => {
    const numbers = [...draw.front].sort((a, b) => a - b);
    const segments = [];
    let current = [numbers[0]];
    
    for (let i = 1; i < numbers.length; i++) {
      if (numbers[i] === numbers[i-1] + 1) {
        current.push(numbers[i]);
      } else {
        if (current.length >= 2) segments.push(current);
        current = [numbers[i]];
      }
    }
    if (current.length >= 2) segments.push(current);
    
    const doubles = segments.filter(s => s.length === 2).length;
    const triples = segments.filter(s => s.length === 3).length;
    const quads = segments.filter(s => s.length >= 4).length;
    
    if (quads > 0) stats.more++;
    else if (triples > 0 && doubles > 0) stats.more++;
    else if (triples > 0) stats.oneTriple++;
    else if (doubles === 2) stats.twoDouble++;
    else if (doubles === 1) stats.oneDouble++;
    else stats.noConsec++;
  });
  
  return stats;
}

const histStats = analyzeConsecutiveHistory();
const total = ALL_DRAWS.length;

console.log('历史连号概率:');
console.log(`  无连号: ${(histStats.noConsec/total*100).toFixed(1)}%`);
console.log(`  1组双连号: ${(histStats.oneDouble/total*100).toFixed(1)}%`);
console.log(`  2组双连号: ${(histStats.twoDouble/total*100).toFixed(1)}%`);
console.log(`  1组三连号: ${(histStats.oneTriple/total*100).toFixed(1)}%`);
console.log(`  复杂连号: ${((histStats.more)/total*100).toFixed(1)}%\n`);

// 趋势映射（带连号评分）
function buildTrendMap(sourceIdx, consecConfig) {
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

  const end = sourceIdx - 12;
  const start = Math.max(0, end - 50);
  
  const targetMap = new Map();
  const neighborMap = new Map();

  for (let i = start; i <= end; i++) {
    const histSrc = ALL_DRAWS[i];
    const histTgt = ALL_DRAWS[i + 12];
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

    // 连号概率加分
    if (consecConfig.consecBonus > 0) {
      const histConsec = countConsecutive(histNumbers);
      const srcConsec = countConsecutive(sourceNumbers);
      
      // 连号模式匹配加分
      if (histConsec.doubles === srcConsec.doubles && histConsec.triples === srcConsec.triples) {
        weight += consecConfig.consecBonus;
      } else if (Math.abs(histConsec.doubles - srcConsec.doubles) <= 1 && Math.abs(histConsec.triples - srcConsec.triples) <= 1) {
        weight += consecConfig.consecBonus * 0.5;
      }
    }

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

  // 合并neighborMap到targetMap
  neighborMap.forEach((v, k) => {
    targetMap.set(k, (targetMap.get(k) || 0) + v);
  });

  return targetMap;
}

function countConsecutive(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const segments = [];
  let current = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i-1] + 1) {
      current.push(sorted[i]);
    } else {
      if (current.length >= 2) segments.push(current);
      current = [sorted[i]];
    }
  }
  if (current.length >= 2) segments.push(current);
  
  return {
    doubles: segments.filter(s => s.length === 2).length,
    triples: segments.filter(s => s.length === 3).length,
    total: segments.reduce((sum, s) => sum + s.length - 1, 0)
  };
}

function intervalRatio(numbers) {
  const zones = [0, 0, 0];
  numbers.forEach(n => {
    if (n <= 12) zones[0]++;
    else if (n <= 24) zones[1]++;
    else zones[2]++;
  });
  return zones;
}

// 回测（简化版，只计算Top命中率）
function backtest(consecConfig, label) {
  const startIdx = 15;
  const endIdx = ALL_DRAWS.length - 1 - 10;
  let totalPairs = 0;
  let top5Hits = 0, top5ZeroBall = 0;
  let top10Hits = 0;

  for (let sourceIdx = startIdx; sourceIdx <= endIdx; sourceIdx++) {
    const targetIdx = sourceIdx + 10;
    if (targetIdx >= ALL_DRAWS.length) continue;

    const trendScores = buildTrendMap(sourceIdx, consecConfig);
    if (trendScores.size === 0) continue;

    const sorted = [...trendScores.entries()].sort((a,b) => b[1]-a[1]);
    const top15 = sorted.slice(0, 15).map(([n]) => n);
    const targetDraw = ALL_DRAWS[targetIdx];
    const targetNumbers = new Set(targetDraw.front);

    // 简化：只检查Top15号码的命中情况
    const hits = top15.filter(n => targetNumbers.has(n)).length;
    
    totalPairs++;
    if (hits >= 1) top5Hits++;
    if (hits === 0) top5ZeroBall++;
    if (hits >= 2) top10Hits++;
  }

  return {
    label,
    top5Rate: (top5Hits/totalPairs*100).toFixed(1),
    top5AtLeast3Rate: '-',
    top5ZeroBall,
    top10Rate: (top10Hits/totalPairs*100).toFixed(1),
    top10AtLeast3Rate: '-',
    totalPairs
  };
}

// 测试配置
const configs = [
  { label: '基线(无连号加分)', consecConfig: { consecBonus: 0 } },
  { label: '连号匹配+5', consecConfig: { consecBonus: 5 } },
  { label: '连号匹配+10', consecConfig: { consecBonus: 10 } },
  { label: '连号匹配+15', consecConfig: { consecBonus: 15 } },
  { label: '连号匹配+20', consecConfig: { consecBonus: 20 } },
  { label: '连号匹配+25', consecConfig: { consecBonus: 25 } },
  { label: '连号匹配+30', consecConfig: { consecBonus: 30 } },
];

console.log('═══════════════════════════════════════════════════════════');
console.log('  连号参数回测对比');
console.log('═══════════════════════════════════════════════════════════\n');

const results = configs.map(c => backtest(c.consecConfig, c.label));

// 按Top5命中率排序
results.sort((a,b) => parseFloat(b.top5Rate) - parseFloat(a.top5Rate));

console.log('┌──────────────────────────────┬────────┬────────┬────────┬────────┬────────┐');
console.log('│ 配置                          │ Top5   │ Top5≥3 │ Top5零 │ Top10  │ Top10≥3│');
console.log('├──────────────────────────────┼────────┼────────┼────────┼────────┼────────┤');
results.forEach(r => {
  console.log(`│ ${r.label.padEnd(28)} │ ${r.top5Rate.padStart(5)}% │ ${r.top5AtLeast3Rate.padStart(5)}% │   ${String(r.top5ZeroBall).padStart(2)}   │ ${r.top10Rate.padStart(5)}% │ ${r.top10AtLeast3Rate.padStart(5)}%│`);
});
console.log('└──────────────────────────────┴────────┴────────┴────────┴────────┴────────┘');
console.log(`配对数: ${results[0].totalPairs}\n`);
