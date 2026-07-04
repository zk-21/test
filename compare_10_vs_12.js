// 对比 script.js 风格：+10 vs +12 趋势映射（独立实现）
const fs = require('fs');
const src = fs.readFileSync('script_vs_v3_backtest.js', 'utf-8');
const dataMatch = src.match(/const ALL_DRAWS = (\[[\s\S]*?\]);/);
if (!dataMatch) { console.log('无法提取ALL_DRAWS'); process.exit(1); }
const ALL_DRAWS = eval(dataMatch[1]);

// ===== 工具函数 =====
function gi(n) { return Math.floor((n - 1) / 5); }

function intervalRatio(nums) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  nums.forEach(n => c[gi(n)]++);
  const maxIdx = c.indexOf(Math.max(...c));
  const ratios = c.map(v => maxIdx === 0 ? v : v);
  return ratios;
}

function buildTailNeighborSet(tails) {
  const s = new Set();
  tails.forEach(t => { s.add(t); s.add((t+1)%10); s.add((t+9)%10); });
  return s;
}

// ===== 趋势映射（支持指定间隔）=====
function buildTrendMap(sourceIdx, interval) {
  const sourceDraw = ALL_DRAWS[sourceIdx];
  if (!sourceDraw) return { targetMap: new Map(), neighborMap: new Map() };

  const sourceNumbers = [...sourceDraw.front].sort((a,b)=>a-b);
  const sourceTails = new Set(sourceNumbers.map(n => n%10));
  const sourceTailNeighborSet = buildTailNeighborSet([...sourceTails]);
  const sourceIv = intervalRatio(sourceNumbers);
  const sourceIvKey = sourceIv.join(":");

  const targetMap = new Map();
  const neighborMap = new Map();

  const end = sourceIdx - interval;
  const start = Math.max(0, end - 50);

  for (let i = start; i <= end; i++) {
    const histSrc = ALL_DRAWS[i];
    const histTgt = ALL_DRAWS[i + interval];
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

    const weight = exactOverlap * 18 + neighborOverlap * 10 +
      tailOverlap * 8 + tailNeighborOverlap * 4 +
      selectedTailSignal * 5 + selectedTailNeighborSignal * 2 +
      ratioMatch * 16 + intervalSimilarity * 3 + proximityBonus;

    if (weight <= 0) continue;

    const tgtNumbers = [...histTgt.front];
    tgtNumbers.forEach(number => {
      targetMap.set(number, (targetMap.get(number)||0) + weight);
      [number-1, number+1].forEach(neighbor => {
        if (neighbor < 1 || neighbor > 35) return;
        neighborMap.set(neighbor, (neighborMap.get(neighbor)||0) + Math.max(2, Math.round(weight*0.25)));
      });
    });
  }

  return { targetMap, neighborMap };
}

// ===== script.js 风格评分（简化版：14路信号）=====
function scriptStyleScore(sourceIdx) {
  const sourceDraw = ALL_DRAWS[sourceIdx];
  if (!sourceDraw) return new Map();

  const sourceNumbers = [...sourceDraw.front].sort((a,b)=>a-b);
  const sourceTails = new Set(sourceNumbers.map(n => n%10));
  const sourceTailNeighborSet = buildTailNeighborSet([...sourceTails]);

  // 近5期窗口
  const windowStart = Math.max(0, sourceIdx - 4);
  const windowNumbers = [];
  for (let i = windowStart; i <= sourceIdx; i++) {
    ALL_DRAWS[i].front.forEach(n => windowNumbers.push(n));
  }
  const windowFreq = new Map();
  windowNumbers.forEach(n => windowFreq.set(n, (windowFreq.get(n)||0) + 1));

  // 近10期频率
  const freq10Start = Math.max(0, sourceIdx - 9);
  const freq10 = new Map();
  for (let i = freq10Start; i <= sourceIdx; i++) {
    ALL_DRAWS[i].front.forEach(n => freq10.set(n, (freq10.get(n)||0) + 1));
  }

  const scores = new Map();
  for (let n = 1; n <= 35; n++) {
    let score = 0;

    // S1: 趋势映射（外部传入）
    // S2: 窗口热号
    score += (windowFreq.get(n) || 0) * 3;
    // S3: 10期频率
    score += (freq10.get(n) || 0) * 2;
    // S4: 尾数覆盖
    if (sourceTails.has(n % 10)) score += 5;
    if (sourceTailNeighborSet.has(n % 10)) score += 2;
    // S5: 冷号回补
    if (!windowFreq.has(n) && freq10.has(n)) score += 4;
    // S6: 邻号
    if (sourceNumbers.includes(n-1) || sourceNumbers.includes(n+1)) score += 3;

    scores.set(n, score);
  }

  return scores;
}

// ===== 回测 =====
function backtest(interval) {
  const startIdx = 12;
  const endIdx = ALL_DRAWS.length - 1 - 10; // 需要target存在
  let totalPairs = 0;
  let top5Hits = 0, top5AtLeast3 = 0, top5ZeroBall = 0;
  let poolCoverage = 0, poolTotal = 0;
  let bestAtLeast3 = 0, bestAtLeast4 = 0, bestExact5 = 0;

  for (let sourceIdx = startIdx; sourceIdx <= endIdx; sourceIdx++) {
    const targetIdx = sourceIdx + 10;
    if (targetIdx >= ALL_DRAWS.length) continue;

    const trendResult = buildTrendMap(sourceIdx, interval);
    const baseScores = scriptStyleScore(sourceIdx);

    // 合并趋势信号
    const mergedScores = new Map(baseScores);
    trendResult.targetMap.forEach((w, n) => {
      mergedScores.set(n, (mergedScores.get(n)||0) + w * 2.0);
    });
    trendResult.neighborMap.forEach((w, n) => {
      mergedScores.set(n, (mergedScores.get(n)||0) + w * 0.8);
    });

    // 取top25
    const sorted = [...mergedScores.entries()].sort((a,b) => b[1]-a[1]);
    const top25 = sorted.slice(0, 25).map(([n]) => n);
    const top25Set = new Set(top25);

    const targetDraw = ALL_DRAWS[targetIdx];
    const targetNumbers = new Set(targetDraw.front);

    // 池覆盖
    let poolHit = 0;
    top25Set.forEach(n => { if (targetNumbers.has(n)) poolHit++; });
    poolCoverage += poolHit;
    poolTotal += 5;

    // Top5（分数最高的5个）
    const top5 = sorted.slice(0, 5).map(([n]) => n);
    let top5Hit = 0;
    top5.forEach(n => { if (targetNumbers.has(n)) top5Hit++; });
    top5Hits += top5Hit;
    if (top5Hit >= 3) top5AtLeast3++;
    if (top5Hit === 0) top5ZeroBall++;

    // 最佳组合（从top25中枚举，限制数量）
    const top25Arr = top25.sort((a,b)=>a-b);
    let bestHit = 0;
    let combosChecked = 0;
    const maxCombos = 2000;

    for (let a = 0; a < top25Arr.length && combosChecked < maxCombos; a++) {
      for (let b = a+1; b < top25Arr.length && combosChecked < maxCombos; b++) {
        for (let c = b+1; c < top25Arr.length && combosChecked < maxCombos; c++) {
          for (let d = c+1; d < top25Arr.length && combosChecked < maxCombos; d++) {
            for (let e = d+1; e < top25Arr.length && combosChecked < maxCombos; e++) {
              const combo = [top25Arr[a], top25Arr[b], top25Arr[c], top25Arr[d], top25Arr[e]];
              let hit = 0;
              combo.forEach(n => { if (targetNumbers.has(n)) hit++; });
              if (hit > bestHit) bestHit = hit;
              combosChecked++;
            }
          }
        }
      }
    }

    totalPairs++;
    if (bestHit >= 3) bestAtLeast3++;
    if (bestHit >= 4) bestAtLeast4++;
    if (bestHit === 5) bestExact5++;
  }

  return {
    totalPairs,
    top5HitRate: (top5Hits / (totalPairs * 5) * 100).toFixed(1),
    top5AtLeast3: (top5AtLeast3 / totalPairs * 100).toFixed(1),
    top5ZeroBall: top5ZeroBall,
    poolCoverage: (poolCoverage / poolTotal * 100).toFixed(1),
    bestAtLeast3: (bestAtLeast3 / totalPairs * 100).toFixed(1),
    bestAtLeast4: (bestAtLeast4 / totalPairs * 100).toFixed(1),
    bestExact5: (bestExact5 / totalPairs * 100).toFixed(1),
  };
}

console.log('═══════════════════════════════════════════════════');
console.log('  script.js 风格: +10 vs +12 趋势映射对比');
console.log('═══════════════════════════════════════════════════');
console.log(`  数据: ${ALL_DRAWS.length}期`);
console.log('');

const r10 = backtest(10);
const r12 = backtest(12);

function fmtDiff(v1, v2, higher=true) {
  const diff = parseFloat(v2) - parseFloat(v1);
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}`;
}

console.log('  ┌─────────────────┬──────────┬──────────┬──────────┐');
console.log('  │      指标        │   +10    │   +12    │   差异   │');
console.log('  ├─────────────────┼──────────┼──────────┼──────────┤');
console.log(`  │ 池覆盖率         │ ${r10.poolCoverage.padStart(6)}%  │ ${r12.poolCoverage.padStart(6)}%  │ ${fmtDiff(r10.poolCoverage, r12.poolCoverage).padStart(6)}%   │`);
console.log(`  │ Top5命中率       │ ${r10.top5HitRate.padStart(6)}%  │ ${r12.top5HitRate.padStart(6)}%  │ ${fmtDiff(r10.top5HitRate, r12.top5HitRate).padStart(6)}%   │`);
console.log(`  │ Top5≥3球         │ ${r10.top5AtLeast3.padStart(6)}%  │ ${r12.top5AtLeast3.padStart(6)}%  │ ${fmtDiff(r10.top5AtLeast3, r12.top5AtLeast3).padStart(6)}%   │`);
console.log(`  │ Top5零球数       │ ${String(r10.top5ZeroBall).padStart(6)}    │ ${String(r12.top5ZeroBall).padStart(6)}    │ ${String(r12.top5ZeroBall - r10.top5ZeroBall).padStart(6)}     │`);
console.log(`  │ 最佳组合≥3球     │ ${r10.bestAtLeast3.padStart(6)}%  │ ${r12.bestAtLeast3.padStart(6)}%  │ ${fmtDiff(r10.bestAtLeast3, r12.bestAtLeast3).padStart(6)}%   │`);
console.log(`  │ 最佳组合≥4球     │ ${r10.bestAtLeast4.padStart(6)}%  │ ${r12.bestAtLeast4.padStart(6)}%  │ ${fmtDiff(r10.bestAtLeast4, r12.bestAtLeast4).padStart(6)}%   │`);
console.log(`  │ 最佳组合=5球     │ ${r10.bestExact5.padStart(6)}%  │ ${r12.bestExact5.padStart(6)}%  │ ${fmtDiff(r10.bestExact5, r12.bestExact5).padStart(6)}%   │`);
console.log('  └─────────────────┴──────────┴──────────┴──────────┘');
console.log(`  总配对数: ${r10.totalPairs}`);
