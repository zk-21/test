/**
 * script.js 生成示例 vs v3 命中率对比回测
 * 
 * 🆕 使用 v3 (optimized_picker.js) 的数据源
 * script.js 风格评分逻辑：14路信号 + 桥接/等差 + +10趋势 → 组合枚举
 */

// ═══════════ v3 的数据源 (与 optimized_picker.js 完全一致) ═══════════
const ALL_DRAWS = [
  { issue: "2026002", front: [4, 8, 15, 20, 31], back: [7, 8] },
  { issue: "2026003", front: [2, 9, 11, 15, 16], back: [2, 4] },
  { issue: "2026004", front: [5, 18, 23, 25, 32], back: [5, 9] },
  { issue: "2026005", front: [2, 4, 16, 23, 35], back: [6, 11] },
  { issue: "2026006", front: [5, 12, 18, 23, 35], back: [6, 12] },
  { issue: "2026007", front: [1, 3, 13, 20, 26], back: [3, 10] },
  { issue: "2026008", front: [3, 6, 17, 21, 33], back: [5, 11] },
  { issue: "2026009", front: [5, 12, 13, 14, 33], back: [5, 8] },
  { issue: "2026010", front: [2, 3, 13, 18, 26], back: [2, 9] },
  { issue: "2026011", front: [14, 21, 23, 29, 33], back: [2, 10] },
  { issue: "2026012", front: [1, 2, 9, 22, 25], back: [1, 6] },
  { issue: "2026013", front: [3, 5, 6, 23, 26], back: [1, 4] },
  { issue: "2026014", front: [16, 18, 23, 34, 35], back: [1, 6] },
  { issue: "2026015", front: [1, 4, 10, 13, 17], back: [3, 11] },
  { issue: "2026016", front: [8, 9, 12, 19, 24], back: [1, 6] },
  { issue: "2026017", front: [4, 5, 10, 23, 31], back: [7, 12] },
  { issue: "2026018", front: [9, 11, 19, 30, 35], back: [1, 12] },
  { issue: "2026019", front: [12, 13, 14, 16, 31], back: [4, 12] },
  { issue: "2026020", front: [1, 10, 21, 23, 29], back: [10, 12] },
  { issue: "2026021", front: [5, 8, 12, 14, 17], back: [4, 5] },
  { issue: "2026022", front: [5, 9, 10, 18, 26], back: [5, 6] },
  { issue: "2026023", front: [9, 25, 26, 27, 28], back: [1, 8] },
  { issue: "2026024", front: [2, 4, 8, 10, 21], back: [9, 12] },
  { issue: "2026025", front: [3, 15, 24, 28, 29], back: [3, 7] },
  { issue: "2026026", front: [10, 11, 22, 26, 32], back: [1, 8] },
  { issue: "2026027", front: [9, 10, 11, 12, 16], back: [1, 11] },
  { issue: "2026028", front: [15, 27, 29, 30, 34], back: [1, 10] },
  { issue: "2026029", front: [3, 5, 17, 33, 35], back: [5, 7] },
  { issue: "2026030", front: [2, 13, 22, 28, 34], back: [5, 12] },
  { issue: "2026031", front: [6, 8, 22, 29, 34], back: [5, 7] },
  { issue: "2026032", front: [3, 4, 19, 26, 32], back: [1, 12] },
  { issue: "2026033", front: [3, 5, 7, 9, 18], back: [2, 10] },
  { issue: "2026034", front: [11, 12, 25, 26, 27], back: [8, 11] },
  { issue: "2026035", front: [2, 22, 30, 33, 34], back: [8, 12] },
  { issue: "2026036", front: [4, 7, 16, 26, 32], back: [5, 8] },
  { issue: "2026037", front: [7, 12, 13, 28, 32], back: [6, 8] },
  { issue: "2026038", front: [8, 17, 21, 33, 35], back: [6, 7] },
  { issue: "2026039", front: [9, 11, 20, 26, 27], back: [6, 9] },
  { issue: "2026040", front: [6, 12, 13, 21, 34], back: [8, 9] },
  { issue: "2026041", front: [24, 25, 27, 29, 34], back: [2, 6] },
  { issue: "2026042", front: [2, 7, 13, 19, 24], back: [3, 8] },
  { issue: "2026043", front: [8, 12, 14, 19, 22], back: [11, 12] },
  { issue: "2026044", front: [3, 8, 22, 26, 29], back: [7, 10] },
  { issue: "2026045", front: [1, 15, 21, 26, 33], back: [4, 7] },
  { issue: "2026046", front: [1, 13, 18, 27, 33], back: [4, 7] },
  { issue: "2026047", front: [9, 20, 21, 23, 28], back: [6, 11] },
  { issue: "2026048", front: [11, 17, 20, 23, 35], back: [1, 10] },
  { issue: "2026049", front: [1, 6, 14, 15, 17], back: [2, 3] },
  { issue: "2026050", front: [6, 10, 14, 23, 33], back: [8, 10] },
  { issue: "2026051", front: [13, 18, 28, 32, 33], back: [2, 11] },
  { issue: "2026052", front: [2, 3, 20, 28, 33], back: [2, 12] },
  { issue: "2026053", front: [2, 9, 14, 20, 31], back: [5, 9] },
  { issue: "2026054", front: [2, 6, 14, 22, 24], back: [8, 11] },
  { issue: "2026055", front: [9, 10, 20, 33, 35], back: [4, 11] },
  { issue: "2026056", front: [6, 7, 18, 21, 30], back: [1, 5] },
  { issue: "2026057", front: [23, 25, 26, 27, 34], back: [4, 10] },
  { issue: "2026058", front: [7, 12, 13, 18, 34], back: [1, 5] },
  { issue: "2026059", front: [6, 13, 17, 19, 26], back: [7, 8] },
  { issue: "2026060", front: [22, 28, 30, 31, 34], back: [1, 5] },
  { issue: "2026061", front: [10, 12, 26, 31, 35], back: [2, 12] },
  { issue: "2026062", front: [7, 15, 20, 24, 29], back: [4, 10] },
  { issue: "2026063", front: [3, 15, 20, 29, 31], back: [1, 12] },
  { issue: "2026064", front: [3, 13, 15, 17, 21], back: [2, 7] },
  { issue: "2026065", front: [4, 11, 12, 13, 25], back: [4, 8] },
  { issue: "2026066", front: [10, 13, 19, 21, 30], back: [4, 5] },
  { issue: "2026067", front: [6, 16, 18, 19, 28], back: [7, 11] },
  { issue: "2026068", front: [3, 11, 12, 21, 22], back: [6, 10] },
  { issue: "2026069", front: [12, 19, 21, 24, 29], back: [3, 10] },
];

const issueMap = {};
ALL_DRAWS.forEach(d => issueMap[d.issue] = d);

// ═══════════ 常量 (script.js 风格) ═══════════
const SAMPLE_WINDOW_RADIUS = 1;
const SAMPLE_FIXED_REF_ROW = 30;
const SAMPLE_RULE_WEIGHT = 8;
const SAMPLE_WEAK_WEIGHT = 4;
const CONFIG = { frontMax: 35, backMax: 12, poolSize: 25, pickCount: 5 };

// ═══════════ 工具函数 ═══════════
function gi(n) { return n <= 12 ? 0 : n <= 24 ? 1 : 2; }
function tail(n) { return n % 10; }
function sum(nums) { return nums.reduce((a, b) => a + b, 0); }
function span(nums) { const s = [...nums].sort((a,b)=>a-b); return s[s.length-1] - s[0]; }
function oddCount(nums) { return nums.filter(n => n % 2 === 1).length; }
function intervalRatio(nums) {
  const c = [0, 0, 0];
  nums.forEach(n => c[gi(n)]++);
  return c;
}

function buildTailNeighborSet(tails) {
  const s = new Set();
  tails.forEach(t => { s.add(t); s.add((t+1)%10); s.add((t+9)%10); });
  return s;
}

function sampleSignalLevel(value, threshold) {
  return value >= threshold ? value : 0;
}

// ═══════════ S1: 参考窗口 ═══════════
function getSourceWindow(sourceIdx) {
  const start = Math.max(0, sourceIdx - SAMPLE_WINDOW_RADIUS);
  const end = Math.min(ALL_DRAWS.length - 1, sourceIdx + SAMPLE_WINDOW_RADIUS);
  const refRows = [];
  for (let i = start; i <= end; i++) refRows.push(i);
  const fixedIdx = Math.min(SAMPLE_FIXED_REF_ROW, ALL_DRAWS.length - 1);
  if (!refRows.includes(fixedIdx)) refRows.push(fixedIdx);
  return { start, end, refRows, fixedRefRow: fixedIdx };
}

// ═══════════ S2: 桥接分析 ═══════════
function buildBridgeMap(referenceRows) {
  const gapMap = new Map();
  const endpointMap = new Map();

  referenceRows.forEach(rowIdx => {
    const draw = ALL_DRAWS[rowIdx];
    if (!draw) return;
    const numbers = [...draw.front].sort((a,b)=>a-b);

    for (let li = 0; li < numbers.length; li++) {
      for (let ri = li + 1; ri < numbers.length; ri++) {
        const gap = numbers[ri] - numbers[li];
        if (gap < 2 || gap > 4) continue;
        const closeness = 5 - gap;

        [numbers[li], numbers[ri]].forEach(endpoint => {
          const cur = endpointMap.get(endpoint) || { number: endpoint, bridgeEndpointHits: 0, bridgeScore: 0 };
          cur.bridgeEndpointHits += 1;
          cur.bridgeScore += 8 + closeness * 3;
          endpointMap.set(endpoint, cur);
        });

        for (let n = numbers[li] + 1; n < numbers[ri]; n++) {
          const cur = gapMap.get(n) || { number: n, bridgeHits: 0, bridgeScore: 0 };
          cur.bridgeHits += 1;
          cur.bridgeScore += 24 + closeness * 6;
          gapMap.set(n, cur);
        }
      }
    }
  });

  return { gapMap, endpointMap };
}

// ═══════════ S3: 等差分析 ═══════════
function buildArithmeticMap(referenceRows) {
  const endpointMap = new Map();

  referenceRows.forEach(rowIdx => {
    const draw = ALL_DRAWS[rowIdx];
    if (!draw) return;
    const numbers = [...draw.front].sort((a,b)=>a-b);

    numbers.forEach(anchor => {
      for (let diff = 1; diff <= 17; diff++) {
        const left = anchor - diff;
        const right = anchor + diff;
        const hasLeft = left >= 1 && numbers.includes(left);
        const hasRight = right <= 35 && numbers.includes(right);
        if (!hasLeft && !hasRight) continue;
        const closeness = Math.max(1, 18 - diff);

        if (hasLeft) {
          const cur = endpointMap.get(left) || { number: left, arithmeticEndpointHits: 0, arithmeticScore: 0 };
          cur.arithmeticEndpointHits += 1;
          cur.arithmeticScore += 10 + closeness * 4;
          endpointMap.set(left, cur);
        }
        if (hasRight) {
          const cur = endpointMap.get(right) || { number: right, arithmeticEndpointHits: 0, arithmeticScore: 0 };
          cur.arithmeticEndpointHits += 1;
          cur.arithmeticScore += 10 + closeness * 4;
          endpointMap.set(right, cur);
        }
      }
    });
  });

  return endpointMap;
}

// ═══════════ S4: 尾号模式分数 ═══════════
function buildTailPatternScores(tails) {
  const scores = new Map();
  const uniqueTails = [...new Set(tails)].sort((a,b)=>a-b);

  for (let i = 0; i < uniqueTails.length; i++) {
    let run = 1;
    for (let j = i + 1; j < uniqueTails.length && uniqueTails[j] === uniqueTails[j-1] + 1; j++) run++;
    if (run >= 2) {
      for (let k = i; k < i + run; k++) {
        scores.set(uniqueTails[k], (scores.get(uniqueTails[k])||0) + run * 2);
      }
    }
  }

  for (let i = 0; i < uniqueTails.length; i++) {
    for (let j = i + 1; j < uniqueTails.length; j++) {
      const diff = uniqueTails[j] - uniqueTails[i];
      const third = uniqueTails[j] + diff;
      if (third < 10 && uniqueTails.includes(third)) {
        [uniqueTails[i], uniqueTails[j], third].forEach(t => {
          scores.set(t, (scores.get(t)||0) + 6);
        });
      }
    }
  }

  return scores;
}

// ═══════════ S5: +12期趋势映射（回测最优，与 optimized_picker.js 对齐）═══
function buildPlusTenTrendMap(sourceIdx) {
  const sourceDraw = ALL_DRAWS[sourceIdx];
  if (!sourceDraw) return { targetMap: new Map(), neighborMap: new Map() };

  const sourceNumbers = [...sourceDraw.front].sort((a,b)=>a-b);
  const sourceTails = new Set(sourceNumbers.map(n => n%10));
  const sourceTailNeighborSet = buildTailNeighborSet([...sourceTails]);
  const sourceIv = intervalRatio(sourceNumbers);
  const sourceIvKey = sourceIv.join(":");

  const targetMap = new Map();
  const neighborMap = new Map();

  // 单间隔+13（回测最优：≥3球命中率4.8%，平均命中0.81）
  const end = sourceIdx - 13;
  const start = Math.max(0, end - 50);

  for (let i = start; i <= end; i++) {
    const histSrc = ALL_DRAWS[i];
    const histTgt = ALL_DRAWS[i + 13];
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
      for (let d = 1; d <= 3; d++) {
        [number - d, number + d].forEach(nb => {
          if (nb < 1 || nb > 35) return;
          const nbWeight = Math.max(1, Math.round(weight * 0.4 * (1 - d * 0.2)));
          neighborMap.set(nb, (neighborMap.get(nb) || 0) + nbWeight);
        });
      }
    });
  }

  return { targetMap, neighborMap };
}

// ═══════════ 核心：script.js 风格候选号码评分 ═══════════
function scriptStylePredict(sourceIdx) {
  const sourceDraw = ALL_DRAWS[sourceIdx];
  if (!sourceDraw) return null;

  const window = getSourceWindow(sourceIdx);
  const sourceNumbers = [...sourceDraw.front].sort((a,b)=>a-b);

  const windowNumbers = [];
  const windowTails = [];
  window.refRows.forEach(ri => {
    const d = ALL_DRAWS[ri];
    if (!d) return;
    d.front.forEach(n => { windowNumbers.push(n); windowTails.push(n%10); });
  });

  const lastRowDraw = ALL_DRAWS[window.fixedRefRow];
  const lastRowNumbers = lastRowDraw ? [...lastRowDraw.front] : [];
  const lastRowSet = new Set(lastRowNumbers);
  const lastRowTails = new Set(lastRowNumbers.map(n => n%10));
  const lastRowTailCounts = new Map();
  lastRowNumbers.forEach(n => lastRowTailCounts.set(n%10, (lastRowTailCounts.get(n%10)||0)+1));
  const lastRowTailNeighborSet = buildTailNeighborSet([...lastRowTails]);

  const supportRows = window.refRows.filter(r => r !== sourceIdx);
  const supportSet = new Set();
  supportRows.forEach(ri => {
    const d = ALL_DRAWS[ri];
    if (d) d.front.forEach(n => supportSet.add(n));
  });

  const numberCounts = new Map();
  windowNumbers.forEach(n => numberCounts.set(n, (numberCounts.get(n)||0)+1));
  const tailCounts = new Map();
  windowTails.forEach(t => tailCounts.set(t, (tailCounts.get(t)||0)+1));

  const tailPatternScores = buildTailPatternScores(windowTails);

  const referenceRows = [...new Set(window.refRows.concat([window.fixedRefRow]))];
  const bridgeMap = buildBridgeMap(referenceRows);
  const arithmeticMap = buildArithmeticMap(referenceRows);

  const plusTenTrend = buildPlusTenTrendMap(sourceIdx);

  // 候选号码评分
  const candidateMap = new Map();
  for (let n = 1; n <= 35; n++) {
    candidateMap.set(n, { number: n, score: 0 });
  }

  const scoredNumbers = new Set();
  window.refRows.forEach(ri => {
    const d = ALL_DRAWS[ri];
    if (!d) return;
    d.front.forEach(n => {
      if (scoredNumbers.has(n)) return;
      scoredNumbers.add(n);

      const entry = {
        selectedTailHits: lastRowTailCounts.get(n%10) || 0,
        selectedTailNeighborHits: lastRowTailNeighborSet.has(n%10) ? 1 : 0,
        tailCount: tailCounts.get(n%10) || 0,
        lastRowTailHits: lastRowTails.has(n%10) ? 1 : 0,
        tailPatternScore: tailPatternScores.get(n%10) || 0,
        lastRowHits: lastRowSet.has(n) ? 1 : 0,
        hits: numberCounts.get(n) || 0,
        bridgeEndpointHits: (bridgeMap.endpointMap.get(n) || {bridgeEndpointHits:0}).bridgeEndpointHits,
        bridgeHits: (bridgeMap.gapMap.get(n) || {bridgeHits:0}).bridgeHits,
        arithmeticEndpointHits: (arithmeticMap.get(n) || {arithmeticEndpointHits:0}).arithmeticEndpointHits,
        arithmeticScore: (arithmeticMap.get(n) || {arithmeticScore:0}).arithmeticScore,
      };

      let score = 0;
      score += sampleSignalLevel(entry.selectedTailHits, 2) * SAMPLE_RULE_WEIGHT;
      score += sampleSignalLevel(entry.selectedTailNeighborHits, 1) * SAMPLE_WEAK_WEIGHT;
      score += sampleSignalLevel(entry.tailCount, 3) * SAMPLE_RULE_WEIGHT;
      score += sampleSignalLevel(entry.lastRowTailHits, 1) * SAMPLE_RULE_WEIGHT;
      score += sampleSignalLevel(entry.tailPatternScore, 3) * SAMPLE_RULE_WEIGHT;
      score += sampleSignalLevel(entry.lastRowHits, 1) * SAMPLE_RULE_WEIGHT;
      score += sampleSignalLevel(entry.hits, 3) * SAMPLE_RULE_WEIGHT;
      score += sampleSignalLevel(entry.bridgeEndpointHits, 3) * SAMPLE_RULE_WEIGHT;
      score += sampleSignalLevel(entry.arithmeticEndpointHits, 3) * (SAMPLE_RULE_WEIGHT + 2);
      score += sampleSignalLevel(entry.arithmeticScore, 3) * (SAMPLE_RULE_WEIGHT + 2);

      const candidate = candidateMap.get(n);
      candidate.score += score;
    });
  });

  // 桥接间隙加分
  bridgeMap.gapMap.forEach((entry, n) => {
    const c = candidateMap.get(n);
    if (!c) return;
    c.score += Math.round(entry.bridgeScore * 0.82);
  });

  // 等差端点加分
  arithmeticMap.forEach((entry, n) => {
    const c = candidateMap.get(n);
    if (!c) return;
    c.score += Math.round(entry.arithmeticScore * 0.78);
  });

  // 邻居扩散
  const topCandidates = [...candidateMap.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  topCandidates.forEach(c => {
    [c.number - 1, c.number + 1].forEach(neighbor => {
      if (neighbor < 1 || neighbor > 35) return;
      const nc = candidateMap.get(neighbor);
      if (nc) nc.score += 20;
    });
  });

  // +10期趋势加分
  plusTenTrend.targetMap.forEach((trendScore, n) => {
    const c = candidateMap.get(n);
    if (!c) return;
    c.score += Math.min(68, Math.round(trendScore * 0.38));
  });
  plusTenTrend.neighborMap.forEach((trendScore, n) => {
    const c = candidateMap.get(n);
    if (!c) return;
    c.score += Math.min(28, Math.round(trendScore * 0.28));
  });

  // 排序候选
  const sortedCandidates = [...candidateMap.values()]
    .sort((a, b) => b.score - a.score);

  // 号码池
  const pool = sortedCandidates.slice(0, CONFIG.poolSize).map(c => ({
    number: c.number,
    score: c.score,
  }));

  // 组合生成：C(25,5) 全枚举 + 结构偏置
  const poolNums = pool.map(p => p.number);
  const allCombos = [];

  function walkAll(start, chosen) {
    if (chosen.length === 5) {
      const nums = [...chosen].sort((a,b)=>a-b);
      const comboSum = sum(nums);
      const comboSpan = span(nums);
      const comboOdd = oddCount(nums);

      if (comboSum < 70 || comboSum > 105) return;  // 优化：基于回测最优[70,105]
      if (comboOdd < 1 || comboOdd > 4) return;
      if (comboSpan < 16 || comboSpan > 32) return;  // 优化：基于回测最优[16,32]

      let maxRun = 1, curRun = 1;
      for (let i = 1; i < nums.length; i++) {
        if (nums[i] === nums[i-1] + 1) { curRun++; maxRun = Math.max(maxRun, curRun); }
        else curRun = 1;
      }
      if (maxRun >= 4) return;

      let score = nums.reduce((s, n) => s + ((candidateMap.get(n)||{}).score || 0), 0);

      if (comboSpan >= 18 && comboSpan <= 24) score += 18;
      else if (comboSpan >= 26 && comboSpan <= 33) score += 12;
      if (comboOdd === 1) score += 12;
      if (comboOdd === 3) score += 8;

      const iv = intervalRatio(nums);
      const ivKey = iv.join(":");
      if (ivKey === "2:2:1" || ivKey === "1:2:2" || ivKey === "2:1:2") score += 24;
      if (ivKey === "1:3:1" || ivKey === "1:4:0") score += 16;

      const tailSet = new Set(nums.map(n => n%10));
      if (tailSet.size >= 4) score += 10;

      // 🆕 连号概率奖励（基于历史分布：50%无连号, 38.2%双连号, 5.9%三连号）
      const consecSegs = [];
      let curSeg = [nums[0]];
      for (let i = 1; i < nums.length; i++) {
        if (nums[i] === nums[i-1] + 1) curSeg.push(nums[i]);
        else { if (curSeg.length >= 2) consecSegs.push(curSeg); curSeg = [nums[i]]; }
      }
      if (curSeg.length >= 2) consecSegs.push(curSeg);
      const dblCnt = consecSegs.filter(s => s.length === 2).length;
      const trplCnt = consecSegs.filter(s => s.length === 3).length;
      const totalPairs = dblCnt + trplCnt * 2;
      if (totalPairs === 0) score += 3;        // 无连号：50%概率
      else if (dblCnt === 1 && trplCnt === 0) score += 5;  // 1组双连号：38.2%
      else if (trplCnt === 1 && dblCnt === 0) score += 3;  // 1组三连号：5.9%
      else if (dblCnt === 1 && trplCnt === 1) score += 2;  // 双+三：1.5%

      allCombos.push({ numbers: nums, score });
      return;
    }
    if (start >= poolNums.length || poolNums.length - start < 5 - chosen.length) return;
    walkAll(start + 1, chosen);
    chosen.push(poolNums[start]);
    walkAll(start + 1, chosen);
    chosen.pop();
  }
  walkAll(0, []);
  allCombos.sort((a, b) => b.score - a.score);

  return {
    sourceFront: sourceNumbers,
    pool,
    combinations: allCombos.slice(0, 8).map(c => c.numbers),
    topScoreCombo: sortedCandidates.slice(0, 5).map(c => c.number).sort((a,b)=>a-b),
  };
}

// ═══════════ 构建 10 期间隔配对 ═══════════
function buildPairs(interval) {
  const pairs = [];
  const sortedIssues = ALL_DRAWS.map(d => d.issue).sort();
  sortedIssues.forEach(srcIssue => {
    const srcNum = parseInt(srcIssue.slice(4));
    const tgtIssue = srcIssue.slice(0, 4) + String(srcNum + interval).padStart(3, "0");
    if (issueMap[tgtIssue]) {
      pairs.push([srcIssue, tgtIssue]);
    }
  });
  return pairs;
}

// ═══════════ 回测 ═══════════
console.log("═".repeat(70));
console.log("║  📊 script.js 风格回测 (使用 v3 数据源)                              ║");
console.log("═".repeat(70));

const fullPairs = buildPairs(10);
console.log(`\n  数据: v3 ALL_DRAWS | ${ALL_DRAWS.length}期 (${ALL_DRAWS[0].issue}~${ALL_DRAWS[ALL_DRAWS.length-1].issue})`);
console.log(`  10期间隔配对: ${fullPairs.length}对`);
console.log("  script.js风格: 14路信号 + 桥接/等差 + +10趋势 → C(25,5)枚举 + 结构偏置");

console.log("\n" + "─".repeat(70));
console.log("  🎨 script.js 风格回测结果");
console.log("─".repeat(70));

const results = [];
fullPairs.forEach(([sIssue, tIssue], idx) => {
  const sIdx = ALL_DRAWS.findIndex(d => d.issue === sIssue);
  const tIdx = ALL_DRAWS.findIndex(d => d.issue === tIssue);
  const result = scriptStylePredict(sIdx);
  if (!result) return;

  const tgtSet = new Set(ALL_DRAWS[tIdx].front);
  const poolHits = result.pool.filter(p => tgtSet.has(p.number));
  const top8Hits = result.combinations.map(c => c.filter(n => tgtSet.has(n)).length);
  const bestHit = Math.max(...top8Hits, 0);
  const topScoreHit = result.topScoreCombo ? result.topScoreCombo.filter(n => tgtSet.has(n)).length : 0;
  // Union coverage: Top5 & Top8
  function calcUnion(allCombos, topN) {
    const u = new Set();
    allCombos.slice(0, topN).forEach(c => c.forEach(n => u.add(n)));
    return [...tgtSet].filter(n => u.has(n)).length;
  }
  const union5 = calcUnion(result.combinations, 5);
  const union8 = calcUnion(result.combinations, 8);

  results.push({ sIssue, tIssue, poolHitCount: poolHits.length, bestHit, top8Hits, topScoreHit, union5, union8 });
});

const totalBalls = results.length * 5;
const cov = results.reduce((a, r) => a + r.poolHitCount, 0);
const best3plus = results.filter(r => r.bestHit >= 3).length;
const best4plus = results.filter(r => r.bestHit >= 4).length;
const best5 = results.filter(r => r.bestHit >= 5).length;

console.log(`  池覆盖率: ${cov}/${totalBalls} (${(cov/totalBalls*100).toFixed(1)}%)`);
console.log(`  最佳≥3球: ${best3plus}/${results.length} (${(best3plus/results.length*100).toFixed(1)}%)`);
console.log(`  最佳≥4球: ${best4plus}/${results.length} (${(best4plus/results.length*100).toFixed(1)}%)`);
console.log(`  最佳=5球: ${best5}/${results.length} (${(best5/results.length*100).toFixed(1)}%)`);

// 命中分布
const bestDist = [0,0,0,0,0,0];
results.forEach(r => bestDist[r.bestHit]++);
console.log(`  最佳命中分布: 5球${bestDist[5]} | 4球${bestDist[4]} | 3球${bestDist[3]} | 2球${bestDist[2]} | 1球${bestDist[1]} | 0球${bestDist[0]}`);

const poolDist = [0,0,0,0,0,0];
results.forEach(r => poolDist[r.poolHitCount]++);
console.log(`  池命中分布: 5球${poolDist[5]} | 4球${poolDist[4]} | 3球${poolDist[3]} | 2球${poolDist[2]} | 1球${poolDist[1]} | 0球${poolDist[0]}`);

const topScoreHits = results.reduce((a, r) => a + (r.topScoreHit || 0), 0);
const topScore3plus = results.filter(r => (r.topScoreHit || 0) >= 3).length;
console.log(`  Top5纯分数: ≥3球 ${topScore3plus}/${results.length} (${(topScore3plus/results.length*100).toFixed(1)}%)`);

// Top1-Top8 命中率
console.log(`\n  🏆 Top1-Top8 各注命中率:`);
for (let i = 0; i < 8; i++) {
  const totalHits = results.reduce((a, r) => a + (r.top8Hits[i] || 0), 0);
  const cnt = results.reduce((a, r) => a + (i < r.top8Hits.length ? 1 : 0), 0);
  if (cnt > 0) console.log(`      Top${i+1}: ${totalHits}/${cnt*5} (${(totalHits/(cnt*5)*100).toFixed(1)}%)`);
}

// Union coverage Top5 & Top8
console.log(`\n  📦 前N注联合覆盖 (所有号码去重):`);
const totalUnionBalls = results.length * 5;
const u5Total = results.reduce((a, r) => a + (r.union5 || 0), 0);
const u8Total = results.reduce((a, r) => a + (r.union8 || 0), 0);

function showUnionDist(topN, key) {
  const dist = [0,0,0,0,0,0];
  results.forEach(r => dist[r[key]]++);
  const g3 = dist[5] + dist[4] + dist[3];
  console.log(`      Top${topN}: ${results.reduce((a,r)=>a+r[key],0)}/${totalUnionBalls} (${(results.reduce((a,r)=>a+r[key],0)/totalUnionBalls*100).toFixed(1)}%) | ≥3球:${g3}/${results.length}对 | 全5:${dist[5]} | 4球:${dist[4]} | 3球:${dist[3]} | 2球:${dist[2]} | 1球:${dist[1]} | 0球:${dist[0]}`);
}
showUnionDist(5, 'union5');
showUnionDist(8, 'union8');

// ═══════════ v3 基准对比 ═══════════
console.log("\n" + "─".repeat(70));
console.log("  🎯 v3 基准 (optimized_picker.js backtest 已知结果)");
console.log("─".repeat(70));
console.log(`  池覆盖率: 95.2%`);
console.log(`  Top1命中: 27.2%`);
console.log(`  最佳≥3球: 25.9%`);
console.log(`  最佳≥4球: ~10.3%`);
console.log(`  最佳=5球: ~3.4%`);

// ═══════════ 对比汇总 ═══════════
console.log("\n" + "═".repeat(70));
console.log("║                  📊 对比汇总 (同数据源)                              ║");
console.log("═".repeat(70));

const sCov = (cov/totalBalls*100).toFixed(1);
const sBest3 = (best3plus/results.length*100).toFixed(1);
const sBest4 = (best4plus/results.length*100).toFixed(1);
const sBest5 = (best5/results.length*100).toFixed(1);

const rows = [
  ["池覆盖率", "95.2%", sCov + "%"],
  ["最佳≥3球", "25.9%", sBest3 + "%"],
  ["最佳≥4球", "~10.3%", sBest4 + "%"],
  ["最佳=5球", "~3.4%", sBest5 + "%"],
];

console.log("  ┌────────────────────┬──────────┬──────────┬──────────┐");
console.log("  │       指标          │    v3    │ script.js│   差距   │");
console.log("  ├────────────────────┼──────────┼──────────┼──────────┤");
rows.forEach(([name, v3v, sv]) => {
  const vn = parseFloat(v3v);
  const sn = parseFloat(sv);
  if (isNaN(vn) || isNaN(sn)) {
    console.log(`  │ ${name.padEnd(18)} │ ${v3v.padStart(7)} │ ${sv.padStart(7)} │    N/A   │`);
    return;
  }
  const d = sn - vn;
  const arrow = d > 0 ? "▲+" : d < 0 ? "▼" : "─ ";
  console.log(`  │ ${name.padEnd(18)} │ ${v3v.padStart(7)} │ ${sv.padStart(7)} │ ${arrow}${d.toFixed(1).padStart(5)}% │`);
});
console.log("  └────────────────────┴──────────┴──────────┴──────────┘");

const v3Wins = rows.filter(([,v3v,sv]) => parseFloat(v3v) > parseFloat(sv)).length;
const sWins = rows.filter(([,v3v,sv]) => parseFloat(sv) > parseFloat(v3v)).length;
console.log(`\n  🏆 v3领先${v3Wins}项 | script.js领先${sWins}项`);
console.log(`\n  📌 数据源: optimized_picker.js ALL_DRAWS (${ALL_DRAWS[0].issue}~${ALL_DRAWS[ALL_DRAWS.length-1].issue}, ${ALL_DRAWS.length}期)`);
console.log("  📌 script.js评分: 14路信号 + 桥接/等差 + +10趋势 → C(25,5)全枚举");
