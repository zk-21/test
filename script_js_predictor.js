/**
 * script.js V4 预测逻辑的 Node.js 实现
 * 完全同步 optimized_picker.js v6 算法
 */

const fs = require('fs');

// ===================== 数据 ============================
const ALL_DRAWS = JSON.parse(fs.readFileSync('all_draws.json', 'utf8'));
const issueMap = {};
ALL_DRAWS.forEach(d => issueMap[d.issue] = d);

// ===================== 配置 ============================
const CONFIG = {
  frontMax: 35,
  backMax: 12,
  poolSize: 24,
  pickCount: 5,

  // 偏移评分权重
  offsetScore: {
    0: 20,
    1: 15,
    2: 13,
    3: 12,
    4: 10,
    5: 8,
    6: 6,
    7: 5,
    8: 4,
    9: 3,
    10: 2,
  },

  // 尾号关联分数
  tailSameScore: 35,
  tailNeighborScore: 15,
  tailWithinSource: 8,

  // 区间相关
  intervalMatchScore: 30,
  intervalTwoScore: 15,

  // 结构约束
  targetSum: 87.5,
  sumTolerance: 17.5,
  targetSpan: 24,
  spanTolerance: 8,

  // 极端期检测阈值
  extremeSumDrop: 30,
  extremeParityFlip: 4,

  // 惩罚
  anchorOverusePenalty: 8,
  extremeZonePenalty: 200,
  sumOutlierPenalty: 15,

  // 优化配置
  comboPoolTop: 20,
  comboSampleMax: 500,
  hotBoostWeight: 8,
  tailPatternBonus: 10,
  comboDiversityMin: 0.3,
  
  // 历史频率权重
  historyFreqWeight: 0.15,
  recentFreqWeight: 0.10,
  repeatRateWeight: 0.05,
};

// ===================== 历史频率分析 ============================
function calculateHistoryMetrics() {
  const totalDraws = ALL_DRAWS.length;
  
  // 1. 历史频率
  const historyFreq = new Array(36).fill(0);
  ALL_DRAWS.forEach(d => d.front.forEach(n => historyFreq[n]++));
  
  // 2. 近期频率
  const recentWindow = 20;
  const recentFreq = new Array(36).fill(0);
  ALL_DRAWS.slice(-recentWindow).forEach(d => d.front.forEach(n => recentFreq[n]++));
  
  // 3. 重复率
  const repeatRate = new Array(36).fill(0);
  let repeatCount = 0;
  for (let i = 0; i < ALL_DRAWS.length - 10; i++) {
    const source = ALL_DRAWS[i].front;
    const target = ALL_DRAWS[i + 10].front;
    const targetSet = new Set(target);
    source.forEach(n => {
      if (targetSet.has(n)) {
        repeatRate[n]++;
        repeatCount++;
      }
    });
  }
  const repeatPairs = ALL_DRAWS.length - 10;
  const normalizedRepeatRate = repeatRate.map(count => count / repeatPairs);
  
  const avgHistoryFreq = historyFreq.reduce((a, b) => a + b, 0) / 35;
  const avgRecentFreq = recentFreq.reduce((a, b) => a + b, 0) / 35;
  const avgRepeatRate = normalizedRepeatRate.reduce((a, b) => a + b, 0) / 35;
  
  return {
    historyFreq,
    recentFreq,
    normalizedRepeatRate,
    avgHistoryFreq,
    avgRecentFreq,
    avgRepeatRate,
    totalDraws,
    recentWindow,
    repeatPairs
  };
}

const historyMetrics = calculateHistoryMetrics();

// ===================== 工具函数 =========================
function gi(n) {
  if (n <= 12) return 0;
  if (n <= 24) return 1;
  return 2;
}

function tail(n) { return n % 10; }

function tails(nums) {
  return [...new Set(nums.map((n) => n % 10))].sort((a, b) => a - b);
}

function sum(nums) { return nums.reduce((a, b) => a + b, 0); }

function span(nums) {
  const s = [...nums].sort((a, b) => a - b);
  return s[s.length - 1] - s[0];
}

function oddCount(nums) { return nums.filter((n) => n % 2 === 1).length; }

function intervalRatio(nums) {
  const iv = [0, 0, 0];
  nums.forEach((n) => iv[gi(n)]++);
  return iv;
}

function getIntervalRatioDistance(ratio1, ratio2) {
  let dist = 0;
  for (let i = 0; i < 3; i++) dist += Math.abs((ratio1[i] || 0) - (ratio2[i] || 0));
  return dist;
}

function predictTargetIntervalRatio(sourceIdx, sourceIv) {
  const sourceIvKey = sourceIv.join(":");
  const transitions = new Map();

  const windowSize = Math.min(60, sourceIdx);
  let specificCount = 0;
  let globalDistSum = 0, globalDistCount = 0;

  for (let i = 0; i < sourceIdx; i++) {
    if (i >= ALL_DRAWS.length - 1) continue;
    const sIv = intervalRatio(ALL_DRAWS[i].front);
    const tIv = intervalRatio(ALL_DRAWS[i + 1].front);
    const sKey = sIv.join(":");
    globalDistSum += getIntervalRatioDistance(sIv, tIv);
    globalDistCount++;
    if (sKey !== sourceIvKey) continue;
    specificCount++;
    const tKey = tIv.join(":");
    const recency = 1 + (i - Math.max(0, sourceIdx - windowSize)) / windowSize * 2;
    const entry = transitions.get(tKey) || { count: 0, weight: 0 };
    entry.count++;
    entry.weight += recency;
    transitions.set(tKey, entry);
  }

  const globalAvgDist = globalDistCount > 0 ? globalDistSum / globalDistCount : 3.0;
  const minSpecific = 4;
  const blendWeight = Math.min(1, specificCount / minSpecific);

  const maxWeight = Math.max(1, ...[...transitions.values()].map(d => d.weight));
  const sorted = [...transitions.entries()]
    .map(([ivKey, data]) => ({
      iv: ivKey.split(":").map(Number),
      ivKey,
      score: data.count * 0.7 + (data.weight / maxWeight) * 30,
      count: data.count,
      weight: data.weight
    }))
    .sort((a, b) => b.score - a.score);

  if (sorted.length === 0) {
    const neutralDist = Math.round(globalAvgDist);
    return { predictedIv: sourceIv, predictedIvKey: sourceIvKey, distance: neutralDist, confidence: 0, topCandidates: [], globalAvgDist };
  }

  const topCandidates = sorted.slice(0, 3);
  const predictedIv = topCandidates[0].iv;
  const rawDistance = getIntervalRatioDistance(sourceIv, predictedIv);
  const totalScore = topCandidates.reduce((s, c) => s + c.score, 0);
  const rawConfidence = topCandidates[0].score / Math.max(0.1, totalScore);

  const blendedDistance = Math.round(rawDistance * blendWeight + globalAvgDist * (1 - blendWeight));
  const confidence = rawConfidence * blendWeight;

  return { predictedIv, predictedIvKey: topCandidates[0].ivKey, distance: blendedDistance, confidence, topCandidates, globalAvgDist };
}

function sortByScore(arr) {
  return [...arr].sort((a, b) => b.score - a.score);
}

// ===================== 连号/结构分析工具 =====================
function buildConsecutiveSegments(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const segments = [];
  let seg = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] === 1) {
      seg.push(sorted[i]);
    } else {
      if (seg.length >= 2) segments.push(seg);
      seg = [sorted[i]];
    }
  }
  if (seg.length >= 2) segments.push(seg);
  return segments;
}

function countConsecutivePairs(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  let pairs = 0, longestRun = 1, currentRun = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] === 1) {
      currentRun++;
      pairs++;
      longestRun = Math.max(longestRun, currentRun);
    } else {
      currentRun = 1;
    }
  }
  return { pairs, longestRun };
}

function getRunPenalty(numbers, anchorNumbers = []) {
  const segments = buildConsecutiveSegments(numbers);
  const anchorSet = new Set(anchorNumbers);
  let longestRun = 0, runPenalty = 0, doubleRunCount = 0;
  segments.forEach((seg) => {
    longestRun = Math.max(longestRun, seg.length);
    const supportCount = seg.filter((n) => anchorSet.has(n)).length;
    const supportRatio = seg.length > 0 ? supportCount / seg.length : 0;
    const discount = supportRatio >= 0.8 ? 0.45 : supportRatio >= 0.6 ? 0.75 : 1;
    if (seg.length === 2) {
      doubleRunCount++;
      runPenalty += Math.round(8 * discount);
    } else if (seg.length >= 4) {
      runPenalty += Math.round((70 + (seg.length - 4) * 16) * discount);
    } else if (seg.length === 3) {
      runPenalty += Math.round(36 * discount);
    }
  });
  if (doubleRunCount >= 2) runPenalty += (doubleRunCount - 1) * 6;
  return { longestRun, runPenalty, doubleRunCount, segmentCount: segments.length };
}

function getRepeatPenalty(numbers, sourceNumbers = []) {
  const sourceSet = new Set(sourceNumbers);
  const repeatCount = numbers.filter((n) => sourceSet.has(n)).length;
  let penalty = 0;
  if (repeatCount === 0) penalty = 0;
  else if (repeatCount === 1) penalty = 4;
  else if (repeatCount === 2) penalty = 10;
  else if (repeatCount === 3) penalty = 30 + (repeatCount - 3) * 8;
  else penalty = 30 + (repeatCount - 3) * 20;
  return { repeatCount, repeatPenalty: penalty };
}

function scoreTailPatterns(comboNumbers) {
  const tails = [...new Set(comboNumbers.map((n) => n % 10))].sort((a, b) => a - b);
  let score = 0;
  let longestConsec = 1, currentConsec = 1;
  for (let i = 1; i < tails.length; i++) {
    if (tails[i] === tails[i - 1] + 1) { currentConsec++; longestConsec = Math.max(longestConsec, currentConsec); }
    else currentConsec = 1;
  }
  if (tails.includes(0) && tails.includes(9)) {
    let wrapRun = 1;
    for (let i = tails.length - 1; i >= 0 && tails[i] >= 9; i--) wrapRun++;
    longestConsec = Math.max(longestConsec, wrapRun);
  }
  if (longestConsec >= 3) score += 40;
  else if (longestConsec >= 2) score += 20;

  for (let d = 2; d <= 4; d++) {
    for (let start = 0; start <= 9 - d * 2; start++) {
      let count = 0;
      for (let v = start; v <= 9; v += d) {
        if (tails.includes(v)) count++;
        else break;
      }
      if (count >= 4) score += 30;
      else if (count >= 3) score += 15;
    }
  }

  if (tails.length >= 5) score += 20;
  else if (tails.length >= 4) score += 10;

  return { score, longestConsec, tailCount: tails.length };
}

// ===================== S1: +13期趋势映射 =====================
function buildPlusTenTrendMap(sourceIdx, lookback = 50) {
  const sourceDraw = ALL_DRAWS[sourceIdx];
  if (!sourceDraw) return { targetMap: new Map(), neighborMap: new Map() };

  const sourceNumbers = [...sourceDraw.front].sort((a, b) => a - b);
  const sourceTails = new Set(sourceNumbers.map((n) => n % 10));
  const sourceTailNeighborSet = new Set();
  sourceTails.forEach((t) => {
    sourceTailNeighborSet.add(t);
    sourceTailNeighborSet.add((t + 1) % 10);
    sourceTailNeighborSet.add((t + 9) % 10);
  });
  const sourceIv = intervalRatio(sourceNumbers);
  const sourceIvKey = sourceIv.join(":");

  const targetMap = new Map();
  const neighborMap = new Map();

  const end = sourceIdx - 13;
  const start = Math.max(0, end - lookback);

  for (let i = start; i <= end; i++) {
    const histSrc = ALL_DRAWS[i];
    const histTgt = ALL_DRAWS[i + 13];
    if (!histSrc || !histTgt) continue;

    const histNumbers = [...histSrc.front].sort((a, b) => a - b);
    const histSet = new Set(histNumbers);
    const histTails = new Set(histNumbers.map((n) => n % 10));
    const histTailNeighborSet = new Set();
    histTails.forEach((t) => {
      histTailNeighborSet.add(t);
      histTailNeighborSet.add((t + 1) % 10);
      histTailNeighborSet.add((t + 9) % 10);
    });

    const exactOverlap = sourceNumbers.filter((n) => histSet.has(n)).length;
    const neighborOverlap = sourceNumbers.filter((n) => histSet.has(n - 1) || histSet.has(n + 1)).length;
    const tailOverlap = sourceNumbers.filter((n) => histTails.has(n % 10)).length;
    const tailNeighborOverlap = sourceNumbers.filter((n) => histTailNeighborSet.has(n % 10)).length;

    const selectedTailSignal = histNumbers.filter((n) => sourceTails.has(n % 10)).length;
    const selectedTailNeighborSignal = histNumbers.filter((n) => sourceTailNeighborSet.has(n % 10)).length;

    const histIv = intervalRatio(histNumbers);
    const ratioMatch = (histIv.join(":") === sourceIvKey) ? 1 : 0;

    const intervalDiff = histIv.reduce((t, c, j) => t + Math.abs(c - sourceIv[j]), 0);
    const intervalSimilarity = Math.max(0, 6 - intervalDiff);

    const rowDistance = Math.abs(i - sourceIdx);
    const proximityBonus = rowDistance <= 3 ? 10 : rowDistance <= 6 ? 6 : rowDistance <= 10 ? 3 : 0;

    const weight =
      exactOverlap * 18 + neighborOverlap * 10 +
      tailOverlap * 8 + tailNeighborOverlap * 4 +
      selectedTailSignal * 5 + selectedTailNeighborSignal * 2 +
      ratioMatch * 16 + intervalSimilarity * 3 + proximityBonus;

    if (weight <= 0) continue;

    const tgtNumbers = [...histTgt.front];
    tgtNumbers.forEach((number) => {
      targetMap.set(number, (targetMap.get(number) || 0) + weight);
      for (let d = 1; d <= 3; d++) {
        [number - d, number + d].forEach((nb) => {
          if (nb < 1 || nb > CONFIG.frontMax) return;
          const nbWeight = Math.max(1, Math.round(weight * 0.4 * (1 - d * 0.2)));
          neighborMap.set(nb, (neighborMap.get(nb) || 0) + nbWeight);
        });
      }
    });
  }

  return { targetMap, neighborMap };
}

// ===================== S2: 桥梁分析 =====================
function buildBridgeMap(anchorNumbers, supportNumbers = []) {
  const maxGap = 4;
  const anchors = [...anchorNumbers].sort((a, b) => a - b);
  const supportSet = new Set(supportNumbers);
  const supportTailSet = new Set([...supportSet].map((n) => n % 10));

  const gapMap = new Map();
  const endpointMap = new Map();

  for (let li = 0; li < anchors.length; li++) {
    for (let ri = li + 1; ri < anchors.length; ri++) {
      const left = anchors[li];
      const right = anchors[ri];
      const gap = right - left;
      if (gap <= 1 || gap > maxGap) continue;

      const closeness = Math.max(1, maxGap - gap + 1);

      [left, right].forEach((endpoint) => {
        const cur = endpointMap.get(endpoint) || { score: 0, hits: 0 };
        cur.hits += 1;
        cur.score += 8 + closeness * 3;
        if (supportSet.has(endpoint)) cur.score += 6;
        if (supportSet.has(endpoint - 1)) cur.score += 2;
        if (supportSet.has(endpoint + 1)) cur.score += 2;
        endpointMap.set(endpoint, cur);
      });

      for (let n = left + 1; n < right; n++) {
        const cur = gapMap.get(n) || { score: 0, hits: 0 };
        cur.hits += 1;
        cur.score += 24 + closeness * 6;
        if (supportSet.has(n)) cur.score += 14;
        let nbSupport = 0;
        if (supportSet.has(n - 1)) nbSupport++;
        if (supportSet.has(n + 1)) nbSupport++;
        if (nbSupport > 0) cur.score += nbSupport * 4;
        if (supportTailSet.has(n % 10)) cur.score += 2;
        gapMap.set(n, cur);
      }
    }
  }

  return { gapMap, endpointMap };
}

// ===================== S3: 等距端点分析 =====================
function buildArithmeticEndpointMap(anchorNumbers, supportNumbers = [], maxGap = 6) {
  const anchors = [...anchorNumbers].sort((a, b) => a - b);
  const supportSet = new Set(supportNumbers);
  const endpointMap = new Map();

  anchors.forEach((anchor) => {
    for (let diff = 1; diff <= maxGap; diff++) {
      const left = anchor - diff;
      const right = anchor + diff;
      if (left < 1 && right > CONFIG.frontMax) continue;

      const closeness = Math.max(1, maxGap - diff + 1);
      [left, right].forEach((endpoint) => {
        if (endpoint < 1 || endpoint > CONFIG.frontMax) return;
        const cur = endpointMap.get(endpoint) || { score: 0, hits: 0 };
        cur.hits += 1;
        cur.score += 10 + closeness * 4;
        if (supportSet.has(endpoint)) cur.score += 6;
        if (supportSet.has(endpoint - 1) || supportSet.has(endpoint + 1)) cur.score += 2;
        endpointMap.set(endpoint, cur);
      });
    }
  });

  return endpointMap;
}

// ===================== S4: 增强扩散惩罚 =====================
function getEnhancedSpreadPenalty(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  if (sorted.length <= 1) return { penalty: 0, span: 0, maxWindowCount: sorted.length, coveredIntervals: 1 };

  const span = sorted[sorted.length - 1] - sorted[0];
  const iv = [0, 0, 0];
  sorted.forEach((n) => iv[gi(n)]++);
  const coveredIntervals = iv.filter((c) => c > 0).length;
  const maxIntervalCount = Math.max(...iv);

  let penalty = 0;
  const denseWidth = 8;

  if (coveredIntervals >= 3) {
    if (span <= 18) penalty += 2;
    if (span <= 16) penalty += 6;
    if (span <= 13) penalty += 10;
    if (span <= 10) penalty += 16;
  } else if (coveredIntervals === 2) {
    if (span <= 12) penalty += 3;
    if (span <= 10) penalty += 7;
    if (span <= 8) penalty += 12;
    if (span <= 6) penalty += 16;
  } else {
    if (span <= 7) penalty += 2;
    if (span <= 5) penalty += 6;
    if (span <= 3) penalty += 10;
  }

  let maxWindowCount = 0;
  for (let si = 0; si < sorted.length; si++) {
    let ei = si;
    while (ei < sorted.length && sorted[ei] - sorted[si] <= denseWidth) ei++;
    const count = ei - si;
    maxWindowCount = Math.max(maxWindowCount, count);
    if (coveredIntervals >= 3) {
      if (count >= 4) penalty += 14 + (count - 4) * 8;
      else if (count === 3) penalty += 4;
    } else if (coveredIntervals === 2) {
      if (count >= 4) penalty += 10 + (count - 4) * 6;
    } else {
      if (count >= 4) penalty += 8 + (count - 4) * 4;
    }
  }

  if (coveredIntervals >= 3 && maxIntervalCount >= 4) {
    penalty += 10 + (maxIntervalCount - 4) * 6;
  } else if (coveredIntervals === 2 && maxIntervalCount >= 4) {
    penalty += 8 + (maxIntervalCount - 4) * 4;
  }

  return { penalty, span, maxWindowCount, coveredIntervals, maxIntervalCount };
}

// ===================== S5: 参考行分析 =====================
function buildReferenceWindow(sourceIdx, lookback = 5) {
  const refs = [];
  const start = Math.max(0, sourceIdx - lookback);
  for (let i = start; i < sourceIdx; i++) {
    const d = ALL_DRAWS[i];
    if (!d) continue;
    const numbers = [...d.front].sort((a, b) => a - b);
    const tailSet = new Set(numbers.map((n) => n % 10));
    const iv = intervalRatio(numbers);
    const { pairs: consecutivePairs, longestRun } = countConsecutivePairs(numbers);
    const consecutiveSegments = buildConsecutiveSegments(numbers);
    const arithEndpoints = new Set();
    for (let diff = 2; diff <= 6; diff++) {
      numbers.forEach((n) => {
        const a = n - diff, b = n + diff;
        if (a >= 1 && a <= 35 && numbers.includes(a)) arithEndpoints.add(n).add(a);
        if (b >= 1 && b <= 35 && numbers.includes(b)) arithEndpoints.add(n).add(b);
      });
    }
    const bridgeGaps = new Set();
    const bridgeEndpoints = new Set();
    for (let j = 0; j < numbers.length - 1; j++) {
      const gap = numbers[j + 1] - numbers[j];
      if (gap >= 2 && gap <= 4) {
        for (let g = numbers[j] + 1; g < numbers[j + 1]; g++) bridgeGaps.add(g);
        bridgeEndpoints.add(numbers[j]); bridgeEndpoints.add(numbers[j + 1]);
      }
    }
    const tailCount = new Map();
    numbers.forEach((n) => tailCount.set(n % 10, (tailCount.get(n % 10) || 0) + 1));
    let strongestTail = null, strongestCount = 0;
    tailCount.forEach((c, t) => { if (c > strongestCount) { strongestCount = c; strongestTail = t; } });
    refs.push({
      row: i,
      numbers,
      numberSet: new Set(numbers),
      tailSet,
      ivKey: iv.join(":"),
      iv,
      consecutivePairs,
      longestRun,
      consecutiveSegments,
      arithEndpoints,
      bridgeGaps,
      bridgeEndpoints,
      strongestTail,
      strongestCount,
    });
  }
  return refs;
}

// ===================== S6: 组合 vs 参考行评分 =====================
function scoreComboAgainstReferences(comboNumbers, refs) {
  let totalScore = 0;
  let satisfiedRows = 0;

  refs.forEach((ref) => {
    let rowScore = 0;
    let localSignals = 0;

    const tailOverlap = comboNumbers.filter((n) => ref.tailSet.has(n % 10)).length;
    rowScore += Math.min(tailOverlap, 3) * 8;
    if (tailOverlap >= 1) localSignals++;

    const tailNeighborSet = new Set();
    ref.tailSet.forEach((t) => { tailNeighborSet.add((t + 1) % 10); tailNeighborSet.add((t + 9) % 10); });
    const tailNeighbor = comboNumbers.filter((n) => tailNeighborSet.has(n % 10)).length;
    rowScore += Math.min(tailNeighbor, 3) * 4;
    if (tailNeighbor >= 1) localSignals++;

    const overlap = comboNumbers.filter((n) => ref.numberSet.has(n)).length;
    rowScore += Math.min(overlap, 3) * 8;
    if (overlap >= 1) localSignals++;

    const neighborHits = comboNumbers.filter((n) =>
      ref.numberSet.has(n - 1) || ref.numberSet.has(n + 1)
    ).length;
    rowScore += Math.min(neighborHits, 3) * 4;
    if (neighborHits >= 1) localSignals++;

    const comboIv = intervalRatio(comboNumbers);
    if (comboIv.join(":") === ref.ivKey) { rowScore += 12; localSignals++; }

    if (ref.strongestCount >= 2 && ref.strongestTail !== null) {
      const strongestHits = comboNumbers.filter((n) => n % 10 === ref.strongestTail).length;
      if (strongestHits >= 1) localSignals++;
      rowScore += strongestHits * 6;
    }

    if (ref.arithEndpoints && ref.arithEndpoints.size > 0) {
      const arithHits = comboNumbers.filter((n) => ref.arithEndpoints.has(n)).length;
      rowScore += arithHits * 5;
      if (arithHits >= 2) { rowScore += 6; localSignals++; }
    }

    if (ref.bridgeGaps && ref.bridgeGaps.size > 0) {
      const gapHits = comboNumbers.filter((n) => ref.bridgeGaps.has(n)).length;
      const endHits = comboNumbers.filter((n) => ref.bridgeEndpoints.has(n)).length;
      rowScore += gapHits * 6 + endHits * 4;
      if (gapHits + endHits >= 2) { rowScore += 5; localSignals++; }
    }

    const { pairs: comboPairs, longestRun: comboLongestRun } = countConsecutivePairs(comboNumbers);
    const pairSim = ref.consecutivePairs > 0
      ? Math.max(0, 3 - Math.abs(comboPairs - ref.consecutivePairs))
      : comboPairs === 0 ? 1 : 0;
    const runSim = ref.longestRun > 1
      ? Math.max(0, 3 - Math.abs(comboLongestRun - ref.longestRun))
      : comboLongestRun <= 2 ? 1 : 0;
    rowScore += (pairSim + runSim) * 3;
    if (pairSim >= 2 || runSim >= 2) localSignals++;

    (ref.consecutiveSegments || []).forEach((seg) => {
      const segSet = new Set(seg);
      const shared = comboNumbers.filter((n) => segSet.has(n)).length;
      const adj = comboNumbers.filter((n) => segSet.has(n - 1) || segSet.has(n + 1)).length;
      if (shared >= Math.min(2, seg.length)) { rowScore += 8; localSignals++; }
      else if (adj > 0) rowScore += 3;
    });

    if (rowScore >= 20) satisfiedRows++;
    totalScore += rowScore;
  });

  return { score: totalScore, satisfiedRows };
}

// ===================== 热/冷号分析 =====================
function computeHotness(sourceIdx, lookback = 10) {
  const freq = new Map();
  for (let n = 1; n <= 35; n++) freq.set(n, 0);
  const start = Math.max(0, sourceIdx - lookback);
  for (let i = start; i < sourceIdx; i++) {
    const d = ALL_DRAWS[i];
    if (!d) continue;
    d.front.forEach((n) => freq.set(n, freq.get(n) + 1));
  }
  return freq;
}

// ===================== 尾号转移模式分析 =====================
function analyzeTailTransitions(sourceIdx, lookback = 12) {
  const transFreq = new Map();
  const tailFreq = new Map();
  for (let t = 0; t <= 9; t++) tailFreq.set(t, 0);

  const start = Math.max(0, sourceIdx - lookback);
  for (let i = start; i < sourceIdx - 1; i++) {
    const src = ALL_DRAWS[i];
    const tgt = ALL_DRAWS[i + 1];
    if (!src || !tgt) continue;
    const srcTails = tails(src.front);
    const tgtTails = tails(tgt.front);
    tgtTails.forEach((tt) => tailFreq.set(tt, tailFreq.get(tt) + 1));
    srcTails.forEach((st) => {
      tgtTails.forEach((tt) => {
        const key = `${st}→${tt}`;
        transFreq.set(key, (transFreq.get(key) || 0) + 1);
      });
    });
  }
  return { transFreq, tailFreq };
}

function predictLikelyTails(sourceTails, transData) {
  const scores = new Map();
  for (let t = 0; t <= 9; t++) scores.set(t, 0);

  sourceTails.forEach((st) => {
    for (let tt = 0; tt <= 9; tt++) {
      const key = `${st}→${tt}`;
      const count = transData.transFreq.get(key) || 0;
      scores.set(tt, scores.get(tt) + count);
    }
  });

  transData.tailFreq.forEach((count, tail) => {
    scores.set(tail, scores.get(tail) + count * 0.5);
  });

  return [...scores.entries()].sort((a, b) => b[1] - a[1]);
}

// ===================== 极端期检测 =====================
function detectExtreme(sourceDraw, neighborDraws) {
  const flags = {
    sumCrash: false,
    parityFlip: false,
    narrowRange: false,
  };

  if (neighborDraws.length >= 2) {
    const prevSums = neighborDraws.slice(0, 2).map((d) => sum(d.front));
    const avgPrev = prevSums.reduce((a, b) => a + b, 0) / prevSums.length;
    const srcSum = sum(sourceDraw.front);
    if (Math.abs(srcSum - avgPrev) > CONFIG.extremeSumDrop) {
      flags.sumCrash = true;
    }
  }

  if (neighborDraws.length >= 1) {
    const srcOdd = oddCount(sourceDraw.front);
    const nbOdd = oddCount(neighborDraws[0].front);
    if (Math.abs(srcOdd - nbOdd) >= CONFIG.extremeParityFlip) {
      flags.parityFlip = true;
    }
  }

  const srcSpan = span(sourceDraw.front);
  if (srcSpan <= 12) flags.narrowRange = true;

  return flags;
}

// ===================== 核心：生成候选号码池 =====================
function generateCandidatePool(sourceDraw, targetTails, targetIv, extremeFlags, hotness = null, extraMaps = null, ivPrediction = null, targetDraw = null) {
  const anchors = sourceDraw.front;
  const sourceTails = tails(anchors);
  const sourceIv = intervalRatio(anchors);
  const sourceOdd = oddCount(anchors);
  const sourceSum = sum(anchors);
  const targetOdd = targetDraw ? oddCount(targetDraw.front) : null;
  const targetSum = targetDraw ? sum(targetDraw.front) : null;

  const plusTenTargetMap = extraMaps?.plusTenTargetMap || new Map();
  const plusTenNeighborMap = extraMaps?.plusTenNeighborMap || new Map();
  const bridgeGapMap = extraMaps?.bridgeGapMap || new Map();
  const bridgeEndpointMap = extraMaps?.bridgeEndpointMap || new Map();
  const arithmeticEndpointMap = extraMaps?.arithmeticEndpointMap || new Map();
  const prevDrawTails = extraMaps?.prevDrawTails || [];

  const maxPlusTenScore = Math.max(1, ...[...plusTenTargetMap.values()]);
  const maxBridgeScore = Math.max(1, ...[...bridgeGapMap.values()].map((v) => v.score), ...[...bridgeEndpointMap.values()].map((v) => v.score));
  const maxArithScore = Math.max(1, ...[...arithmeticEndpointMap.values()].map((v) => v.score));

  const candidates = [];
  for (let n = 1; n <= CONFIG.frontMax; n++) {
    let score = 0;
    const reasons = [];

    let minOffset = Infinity;
    let bestAnchor = null;
    anchors.forEach((anchor) => {
      const dist = Math.abs(n - anchor);
      if (dist < minOffset) { minOffset = dist; bestAnchor = anchor; }
    });
    const offsetPoints = CONFIG.offsetScore[minOffset] || 0;
    score += offsetPoints;
    if (offsetPoints > 0) reasons.push(`偏移${minOffset}(锚点${bestAnchor}):+${offsetPoints}`);

    const t = tail(n);
    if (targetTails && targetTails.includes(t)) { score += CONFIG.tailSameScore; reasons.push(`尾号匹配:+${CONFIG.tailSameScore}`); }
    else if (targetTails && targetTails.some((tt) => Math.abs(t - tt) === 1)) { score += CONFIG.tailNeighborScore; reasons.push(`尾号±1:+${CONFIG.tailNeighborScore}`); }
    else if (sourceTails.includes(t)) { score += CONFIG.tailWithinSource; reasons.push(`选中行尾号:+${CONFIG.tailWithinSource}`); }

    // 🆕 源行前一期尾号加权（统计规律：与目标行尾号重2-3个）
    if (prevDrawTails.includes(t)) { score += 5; reasons.push(`前一期尾号:+5`); }

    const iv = gi(n);
    if (targetIv && targetIv[iv] > 0) { score += 5; reasons.push(`区间匹配:+5`); }
    if (targetIv && sourceIv[iv] < targetIv[iv]) { score += 3; reasons.push(`区间平衡:+3`); }
    if (targetOdd !== null) {
      if (n % 2 === 1 && sourceOdd < targetOdd) { score += 2; reasons.push(`奇偶平衡(奇):+2`); }
      else if (n % 2 === 0 && sourceOdd > targetOdd) { score += 2; reasons.push(`奇偶平衡(偶):+2`); }
    }
    if (targetSum !== null) {
      const diff = targetSum - sourceSum;
      if (Math.abs(diff) > 10) {
        if (diff > 0 && n >= 15) { score += 2; reasons.push(`和值贡献(大):+2`); }
        else if (diff < 0 && n <= 18) { score += 2; reasons.push(`和值贡献(小):+2`); }
      }
    }

    const plusTenScore = plusTenTargetMap.get(n) || 0;
    const plusTenNeighborScore = plusTenNeighborMap.get(n) || 0;
    if (plusTenScore > 0) { const normalized = Math.round(plusTenScore / maxPlusTenScore * 30); score += normalized; reasons.push(`+10趋势:${normalized}`); }
    if (plusTenNeighborScore > 0) { score += Math.round(plusTenNeighborScore / maxPlusTenScore * 6); }

    const bridgeGap = bridgeGapMap.get(n);
    const bridgeEnd = bridgeEndpointMap.get(n);
    if (bridgeGap) { const bgNorm = Math.round(bridgeGap.score / maxBridgeScore * 15); score += bgNorm; if (bgNorm >= 5) reasons.push(`桥梁间隙:+${bgNorm}`); }
    if (bridgeEnd) { const beNorm = Math.round(bridgeEnd.score / maxBridgeScore * 8); score += beNorm; if (beNorm >= 3) reasons.push(`桥梁端点:+${beNorm}`); }

    const arithEnd = arithmeticEndpointMap.get(n);
    if (arithEnd) { const aeNorm = Math.round(arithEnd.score / maxArithScore * 10); score += aeNorm; if (aeNorm >= 4) reasons.push(`等距端点:+${aeNorm}`); }

    if (hotness) {
      const hotCount = hotness.get(n) || 0;
      if (hotCount >= 4) score += 6;
      else if (hotCount >= 3) score += 4;
      else if (hotCount >= 2) score += 2;
      else if (hotCount === 0) score -= 1;
    }

    const historyFreq = historyMetrics.historyFreq[n] || 0;
    const recentFreq = historyMetrics.recentFreq[n] || 0;
    const repeatRate = historyMetrics.normalizedRepeatRate[n] || 0;
    const historyRatio = historyFreq / historyMetrics.avgHistoryFreq;
    const recentRatio = recentFreq / historyMetrics.avgRecentFreq;
    const repeatRatio = repeatRate / historyMetrics.avgRepeatRate;
    if (historyRatio > 1.2) { const historyBonus = Math.round((historyRatio - 1) * 15 * CONFIG.historyFreqWeight); score += historyBonus; if (historyBonus >= 2) reasons.push(`历史频率:+${historyBonus}`); }
    if (recentRatio > 1.3) { const recentBonus = Math.round((recentRatio - 1) * 10 * CONFIG.recentFreqWeight); score += recentBonus; if (recentBonus >= 1) reasons.push(`近期频率:+${recentBonus}`); }
    if (repeatRatio > 1.2) { const repeatBonus = Math.round((repeatRatio - 1) * 8 * CONFIG.repeatRateWeight); score += repeatBonus; if (repeatBonus >= 1) reasons.push(`重复率:+${repeatBonus}`); }

    if (extremeFlags.sumCrash && minOffset >= 3) score += 5;
    if (extremeFlags.parityFlip && n % 2 !== anchors[0] % 2) score += 3;

    const nearConsec = anchors.some((a) => {
      const others = anchors.filter((x) => x !== a);
      return others.some((x) => Math.abs(x - a) === 1) && Math.abs(n - a) <= 4;
    });
    if (nearConsec) { score += 7; reasons.push("连号支撑:+7"); }

    candidates.push({ number: n, score, reasons: reasons.join(" | "), minOffset, bestAnchor, zone: gi(n) });
  }

  const sorted = sortByScore(candidates);
  const pool = [];
  const zoneCount = [0, 0, 0];
  const seen = new Set();
  for (const c of sorted) {
    if (seen.has(c.number)) continue;
    if (pool.length >= CONFIG.poolSize) break;
    seen.add(c.number);
    pool.push(c);
    zoneCount[c.zone]++;
  }
  for (let z = 0; z < 3; z++) {
    while (zoneCount[z] < 3) {
      const filler = sorted.find((c) => gi(c.number) === z && !seen.has(c.number));
      if (!filler) break;
      const weakest = pool.findIndex((p) => gi(p.number) !== z && !anchors.includes(p.number));
      if (weakest === -1) { seen.add(filler.number); pool.push(filler); }
      else { seen.delete(pool[weakest].number); seen.add(filler.number); pool[weakest] = filler; }
      zoneCount[z]++;
    }
  }
  return sortByScore(pool).slice(0, CONFIG.poolSize);
}

// ===================== 快速组合生成（组合级智能评分 v4） =====================
function generateCombinationsFast(pool, count, sourceTails = null, predictedTails = null, referenceRows = null, anchorNumbers = null, sourceNumbers = null, ivPrediction = null) {
  const refs = referenceRows || [];
  const anchors = anchorNumbers || [];
  const sourceNums = sourceNumbers || [];
  const allCombos = [];
  const seenGlobal = new Set();

  function scoreCombo(sorted, selected) {
    const s = sum(sorted);
    const sp = sorted[sorted.length - 1] - sorted[0];
    const odd = sorted.filter((n) => n % 2 === 1).length;
    if (odd === 0 || odd === 5) return null;
    if (sp < 3 || sp > 34) return null;
    if (s < 25 || s > 160) return null;

    let maxConsec = 1, run = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] === 1) { run++; maxConsec = Math.max(maxConsec, run); }
      else run = 1;
    }
    if (maxConsec > 3) return null;

    const iv = [0, 0, 0];
    sorted.forEach((n) => iv[gi(n)]++);
    if (iv[0] >= 5 || iv[2] >= 5) return null;

    const baseScore = selected.reduce((a, b) => a + b.score, 0);
    let comboBonus = 0;

    if (sp >= 18 && sp <= 24) comboBonus += 18;
    else if (sp >= 26 && sp <= 33) comboBonus += 12;
    if (odd === 1) comboBonus += 12;
    else if (odd === 3) comboBonus += 8;
    if (!iv.includes(0)) comboBonus += 5;
    else if (iv.filter((c) => c === 0).length === 1) comboBonus += 2;
    
    const ivKey = iv.join(":");
    const commonRatios = ["2:1:2", "2:2:1", "1:2:2", "3:1:1", "1:3:1", "1:1:3"];
    const ratioIndex = commonRatios.indexOf(ivKey);
    if (ratioIndex >= 0) { comboBonus += ratioIndex < 3 ? 8 : 4; }

    const spread = getEnhancedSpreadPenalty(sorted);
    comboBonus -= Math.min(spread.penalty, 30);
    if (spread.coveredIntervals === 3 && spread.maxWindowCount <= 3) comboBonus += 5;
    if (spread.maxIntervalCount <= 2) comboBonus += 3;

    const comboTails = tails(sorted);
    if (comboTails.length >= 5) comboBonus += 4;
    else if (comboTails.length >= 4) comboBonus += 2;

    if (predictedTails && predictedTails.length > 0) {
      const topTails = new Set(predictedTails.slice(0, 5).map(([t]) => t));
      comboBonus += comboTails.filter((t) => topTails.has(t)).length * 3;
    }

    const ivMax = Math.max(...iv);
    if (ivMax >= 3) comboBonus -= (ivMax - 2) * 4;

    if (anchors.length > 0) {
      const anchorSet = new Set(anchors);
      let anchorKeepHits = 0, anchorOffsetSum = 0;
      sorted.forEach((n) => {
        if (anchorSet.has(n)) { anchorKeepHits++; return; }
        let bestPts = 0;
        anchors.forEach((a) => { const pts = CONFIG.offsetScore[Math.abs(n - a)] || 0; if (pts > bestPts) bestPts = pts; });
        anchorOffsetSum += bestPts;
      });
      comboBonus += Math.min(anchorOffsetSum * 0.6 + anchorKeepHits * 18, 35);
      if (anchorKeepHits >= 2 && anchorKeepHits <= 3) comboBonus += (anchorKeepHits - 1) * 10;
      else if (anchorKeepHits >= 4) comboBonus -= (anchorKeepHits - 3) * 8;
      const explainedAnchors = new Set();
      sorted.forEach((n) => { anchors.forEach((a) => { if (CONFIG.offsetScore[Math.abs(n - a)] > 0) explainedAnchors.add(a); }); });
      if (explainedAnchors.size >= 4) comboBonus += 8;
      else if (explainedAnchors.size >= 3) comboBonus += 4;
    }

    const runResult = getRunPenalty(sorted, anchors);
    comboBonus -= Math.min(runResult.runPenalty * 0.3, 20);

    const consecSegments = buildConsecutiveSegments(sorted);
    const doubleCount = consecSegments.filter(s => s.length === 2).length;
    const tripleCount = consecSegments.filter(s => s.length === 3).length;
    const totalConsecPairs = doubleCount + tripleCount * 2;
    if (totalConsecPairs === 0) comboBonus += 3;
    else if (doubleCount === 1 && tripleCount === 0) comboBonus += 5;
    else if (tripleCount === 1 && doubleCount === 0) comboBonus += 3;
    else if (doubleCount === 1 && tripleCount === 1) comboBonus += 2;

    if (sourceNums.length > 0) {
      const repeatResult = getRepeatPenalty(sorted, sourceNums);
      comboBonus -= Math.min(repeatResult.repeatPenalty * 0.8, 35);
    }

    if (ivPrediction && sourceNums.length > 0) {
      const srcSet = new Set(sourceNums);
      const repeatCnt = sorted.filter(n => srcSet.has(n)).length;
      const dist = ivPrediction.distance;
      if (dist <= 2 && repeatCnt >= 1 && repeatCnt <= 2) comboBonus += 3;
      else if (dist >= 5 && repeatCnt <= 1) comboBonus += 3;
    }

    const tailPattern = scoreTailPatterns(sorted);
    comboBonus += tailPattern.score * 0.6;

    if (refs.length > 0) {
      const refResult = scoreComboAgainstReferences(sorted, refs);
      comboBonus += Math.round(refResult.score / 14);
      if (refResult.satisfiedRows >= 2) comboBonus += 7;
      else if (refResult.satisfiedRows >= 1) comboBonus += 3;
    }

    return { numbers: sorted, score: baseScore + comboBonus, sum: s, span: sp, odd, iv: iv.join(":"), baseScore, comboBonus };
  }

  // 策略1: 按不同区间比分别生成组合
  const ratioFreq = new Map();
  refs.forEach((ref) => { if (!ref.isSelectedRow) ratioFreq.set(ref.ivKey, (ratioFreq.get(ref.ivKey) || 0) + 1); });
  const priorityRatios = [...ratioFreq.entries()].sort((a, b) => b[1] - a[1]).map(([rk]) => rk.split(":").map(Number));
  const defaults = [[2, 1, 2], [2, 2, 1], [1, 2, 2], [3, 1, 1], [1, 3, 1], [1, 1, 3]];
  defaults.forEach((r) => { if (!priorityRatios.some((pr) => pr.join(":") === r.join(":"))) priorityRatios.push(r); });
  const useRatios = priorityRatios.slice(0, 6);

  useRatios.forEach((ratio) => {
    const z0 = pool.filter((c) => gi(c.number) === 0).slice(0, ratio[0] + 6);
    const z1 = pool.filter((c) => gi(c.number) === 1).slice(0, ratio[1] + 6);
    const z2 = pool.filter((c) => gi(c.number) === 2).slice(0, ratio[2] + 6);
    if (z0.length < ratio[0] || z1.length < ratio[1] || z2.length < ratio[2]) return;

    const localCombos = [];
    const seenLocal = new Set();
    const maxLocal = 200;

    function pick(zoneIdx, selected) {
      if (localCombos.length >= maxLocal) return;
      if (zoneIdx === 3) {
        if (selected.length !== count) return;
        const sorted = [...selected.map((x) => x.number)].sort((a, b) => a - b);
        const key = sorted.join(",");
        if (seenLocal.has(key) || seenGlobal.has(key)) return;
        seenLocal.add(key);
        const result = scoreCombo(sorted, selected);
        if (result) localCombos.push(result);
        return;
      }
      const arr = [z0, z1, z2][zoneIdx];
      const need = ratio[zoneIdx];
      (function rec(start, cur) {
        if (localCombos.length >= maxLocal) return;
        if (cur.length === need) { pick(zoneIdx + 1, [...selected, ...cur]); return; }
        for (let i = start; i <= arr.length - (need - cur.length); i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); }
      })(0, []);
    }
    pick(0, []);

    localCombos.sort((a, b) => b.score - a.score).slice(0, 15).forEach((c) => {
      const k = c.numbers.join(",");
      if (!seenGlobal.has(k)) { seenGlobal.add(k); allCombos.push(c); }
    });
  });

  // 策略2: 自由回溯
  const top20 = pool.slice(0, 20);
  const freeCombos = [];
  const seenFree = new Set();
  (function freeBacktrack(start, cur) {
    if (freeCombos.length >= 150) return;
    if (cur.length === count) {
      const sorted = [...cur.map((x) => x.number)].sort((a, b) => a - b);
      const key = sorted.join(",");
      if (seenFree.has(key) || seenGlobal.has(key)) return;
      seenFree.add(key);
      const result = scoreCombo(sorted, cur);
      if (result) freeCombos.push(result);
      return;
    }
    for (let i = start; i <= top20.length - (count - cur.length); i++) { cur.push(top20[i]); freeBacktrack(i + 1, cur); cur.pop(); }
  })(0, []);

  freeCombos.sort((a, b) => b.score - a.score).slice(0, 15).forEach((c) => {
    const k = c.numbers.join(",");
    if (!seenGlobal.has(k)) { seenGlobal.add(k); allCombos.push(c); }
  });

  allCombos.sort((a, b) => b.score - a.score);

  if (allCombos.length < 20) {
    const greedy = pool.slice(0, count).sort((a, b) => a.number - b.number).map((c) => c.number);
    const gk = greedy.join(",");
    if (!seenGlobal.has(gk)) allCombos.push({
      numbers: greedy, score: pool.slice(0, count).reduce((a, b) => a + b.score, 0),
      sum: sum(greedy), span: span(greedy), odd: oddCount(greedy), iv: intervalRatio(greedy).join(":"),
      baseScore: pool.slice(0, count).reduce((a, b) => a + b.score, 0), comboBonus: 0
    });
  }

  return selectDiverseTopN(allCombos, 20);
}

// 多样性感知的 TopN 选择
function selectDiverseTopN(combos, n) {
  if (combos.length <= n) return combos;
  const selected = [combos[0]];
  const remaining = [...combos.slice(1)];
  const fingerprint = (c) => ({
    iv: c.iv, sumBucket: Math.round(c.sum / 10) * 10, spanBucket: Math.round(c.span / 5) * 5,
    odd: c.odd, numberSet: new Set(c.numbers),
  });
  const fps = remaining.map(fingerprint);

  while (selected.length < n && remaining.length > 0) {
    const selFps = selected.map(fingerprint);
    let bestIdx = 0, bestCombined = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const fp = fps[i];
      let diversity = 0;
      selFps.forEach((sfp) => {
        if (fp.iv !== sfp.iv) diversity += 20;
        if (Math.abs(fp.sumBucket - sfp.sumBucket) > 10) diversity += 12;
        if (Math.abs(fp.spanBucket - sfp.spanBucket) > 5) diversity += 8;
        let overlap = 0;
        fp.numberSet.forEach((n) => { if (sfp.numberSet.has(n)) overlap++; });
        diversity += (5 - overlap) * 8;
      });
      const combined = remaining[i].score * 0.75 + diversity;
      if (combined > bestCombined) { bestCombined = combined; bestIdx = i; }
    }
    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
    fps.splice(bestIdx, 1);
  }
  return selected;
}

// ===================== 预测主流程 =====================
function predict(sourceIssue, targetIssue, fastMode = false) {
  const sourceDraw = issueMap[sourceIssue];
  const targetDraw = issueMap[targetIssue];
  if (!sourceDraw) { console.error(`找不到选中行 ${sourceIssue}`); return null; }

  const sourceTails = tails(sourceDraw.front);
  const targetTails = targetDraw ? tails(targetDraw.front) : null;
  const targetIv = targetDraw ? intervalRatio(targetDraw.front) : null;

  const allIssues = ALL_DRAWS.map((d) => d.issue);
  const srcIdx = allIssues.indexOf(sourceIssue);
  const neighbors = [];
  for (let i = srcIdx - 1; i >= 0 && neighbors.length < 3; i--) {
    if (allIssues[i] !== targetIssue) neighbors.push(issueMap[allIssues[i]]);
  }

  const extremeFlags = detectExtreme(sourceDraw, neighbors);
  const hotness = computeHotness(srcIdx, 10);
  const plusTenTrend = buildPlusTenTrendMap(srcIdx, 50);
  const bridgeMap = buildBridgeMap(sourceDraw.front, sourceDraw.front);
  const arithmeticMap = buildArithmeticEndpointMap(sourceDraw.front, sourceDraw.front, 6);

  const referenceRows = buildReferenceWindow(srcIdx, 6);
  {
    const tIdx = allIssues.indexOf(targetIssue);
    const idx = tIdx - 1;
    if (idx > srcIdx && idx < ALL_DRAWS.length) {
      const d = ALL_DRAWS[idx];
      if (d && !referenceRows.some(r => r.row === idx)) {
        const pn = [...d.front].sort((a, b) => a - b);
        const { pairs: xp, longestRun: xlr } = countConsecutivePairs(pn);
        const xs = buildConsecutiveSegments(pn);
        const xae = new Set();
        for (let dd = 2; dd <= 6; dd++) {
          pn.forEach((n) => {
            const a = n - dd, b = n + dd;
            if (a >= 1 && a <= 35 && pn.includes(a)) { xae.add(n); xae.add(a); }
            if (b >= 1 && b <= 35 && pn.includes(b)) { xae.add(n); xae.add(b); }
          });
        }
        const xbg = new Set(), xbe = new Set();
        for (let j = 0; j < pn.length - 1; j++) {
          const g = pn[j + 1] - pn[j];
          if (g >= 2 && g <= 4) {
            for (let m = pn[j] + 1; m < pn[j + 1]; m++) xbg.add(m);
            xbe.add(pn[j]); xbe.add(pn[j + 1]);
          }
        }
        const xtc = new Map();
        pn.forEach((n) => xtc.set(n % 10, (xtc.get(n % 10) || 0) + 1));
        let xst = null, xsc = 0;
        xtc.forEach((c, t) => { if (c > xsc) { xsc = c; xst = t; } });
        referenceRows.push({
          row: idx, numbers: pn, numberSet: new Set(pn),
          tailSet: new Set(pn.map((n) => n % 10)),
          ivKey: intervalRatio(pn).join(":"), iv: intervalRatio(pn),
          consecutivePairs: xp, longestRun: xlr, consecutiveSegments: xs,
          arithEndpoints: xae, bridgeGaps: xbg, bridgeEndpoints: xbe,
          strongestTail: xst, strongestCount: xsc,
        });
      }
    }
  }

  const tailTransData = analyzeTailTransitions(srcIdx, 12);
  const predictedTails = predictLikelyTails(sourceTails, tailTransData);
  const sourceIv = intervalRatio(sourceDraw.front);
  const ivPrediction = predictTargetIntervalRatio(srcIdx, sourceIv);

  // 获取源行前一期的尾号（统计规律：与10期后目标行尾号重2-3个）
  const prevDraw = srcIdx > 0 ? ALL_DRAWS[srcIdx - 1] : null;
  const prevDrawTails = prevDraw ? tails(prevDraw.front) : [];

  const extraMaps = {
    plusTenTargetMap: plusTenTrend.targetMap,
    plusTenNeighborMap: plusTenTrend.neighborMap,
    bridgeGapMap: bridgeMap.gapMap,
    bridgeEndpointMap: bridgeMap.endpointMap,
    arithmeticEndpointMap: arithmeticMap,
    prevDrawTails,
  };

  const pool = generateCandidatePool(sourceDraw, targetTails, targetIv, extremeFlags, hotness, extraMaps, ivPrediction, targetDraw);
  const combinations = generateCombinationsFast(pool, CONFIG.pickCount, sourceTails, predictedTails, referenceRows, sourceDraw.front, sourceDraw.front, ivPrediction);

  return {
    sourceIssue, targetIssue,
    sourceFront: sourceDraw.front,
    targetFront: targetDraw ? targetDraw.front : null,
    targetTails: targetTails || sourceTails,
    extremeFlags, pool, combinations, predictedTails, ivPrediction,
  };
}

// ===================== 构建配对 =====================
function buildPairs(interval) {
  const pairs = [];
  const sortedIssues = ALL_DRAWS.map((d) => d.issue).sort();
  sortedIssues.forEach((srcIssue) => {
    const srcNum = parseInt(srcIssue.slice(4));
    const tgtIssue = srcIssue.slice(0, 4) + String(srcNum + interval).padStart(3, "0");
    if (issueMap[tgtIssue]) pairs.push([srcIssue, tgtIssue]);
  });
  return pairs;
}

// ===================== 后区预测 =====================
function predictBack(sourceDrawIdx) {
  const gap = new Array(13).fill(0);
  const bridgeScore = new Array(13).fill(0);

  for (let n = 1; n <= 12; n++) {
    let g = 0;
    for (let i = sourceDrawIdx; i >= 0; i--) {
      if (ALL_DRAWS[i] && ALL_DRAWS[i].back && ALL_DRAWS[i].back.includes(n)) break;
      g++;
    }
    gap[n] = g;
  }

  const prevDraw = ALL_DRAWS[sourceDrawIdx - 1];
  if (prevDraw && prevDraw.back) {
    prevDraw.back.forEach(p => {
      bridgeScore[p] += 2;
      for (let offset = -3; offset <= 3; offset++) {
        if (offset === 0) continue;
        const nb = p + offset;
        if (nb >= 1 && nb <= 12) bridgeScore[nb] += Math.max(0, 4 - Math.abs(offset));
      }
    });
  }

  return [...Array(12).keys()].map(i => i + 1)
    .sort((a, b) => {
      const gapBonusA = gap[a] >= 6 ? gap[a] * 0.3 : 0;
      const gapBonusB = gap[b] >= 6 ? gap[b] * 0.3 : 0;
      const sa = bridgeScore[a] * 4 + gapBonusA;
      const sb = bridgeScore[b] * 4 + gapBonusB;
      return sb - sa || b - a;
    })
    .slice(0, 6);
}

// ===================== 回测验证 =====================
function backtest() {
  const fullPairs = buildPairs(10);
  console.log("╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║   🎯 script_js_predictor 回测报告 (同步 optimized_picker v6)        ║");
  console.log("╚══════════════════════════════════════════════════════════════════════╝\n");
  console.log(`  可用数据: ${ALL_DRAWS.length}期 (${ALL_DRAWS[0].issue} ~ ${ALL_DRAWS[ALL_DRAWS.length - 1].issue})`);
  console.log(`  10期配对: ${fullPairs.length}对\n`);

  let totalCoverage = 0, totalTopHits = 0, totalTop3Hits = 0, totalTop5Hits = 0;
  let totalTop6Hit = 0, totalTop7Hit = 0, totalTop8Hit = 0;
  let totalUnionHits5 = 0, totalUnionHits6 = 0, totalUnionHits7 = 0, totalUnionHits8 = 0;
  let totalBackHits = 0;
  let totalTop6补漏Hit = 0;
  let totalTop6补漏UnionHit = 0;
  const perPair = [];
  const allIssues = ALL_DRAWS.map((d) => d.issue);

  fullPairs.forEach(([sIssue, tIssue], pairIdx) => {
    const result = predict(sIssue, null, true);  // 不传target，避免泄露
    if (!result) return;

    // 手动补回target信息（仅用于输出对比，不影响评分）
    const tgtDraw = issueMap[tIssue];
    if (tgtDraw) { result.targetFront = tgtDraw.front; result.targetTails = tails(tgtDraw.front); }

    const srcIdx = allIssues.indexOf(sIssue);
    const targetSet = new Set(result.targetFront || []);
    const poolNumbers = result.pool.map((n) => n.number);
    const poolHits = poolNumbers.filter((n) => targetSet.has(n));
    totalCoverage += poolHits.length;

    const backPred = predictBack(srcIdx);
    const backHits = tgtDraw ? tgtDraw.back.filter((b) => backPred.includes(b)).length : 0;
    totalBackHits += backHits;

    let bestHit = 0;
    const top5Hits = [];
    result.combinations.slice(0, 5).forEach((combo, idx) => {
      const hits = combo.numbers.filter((n) => targetSet.has(n)).length;
      bestHit = Math.max(bestHit, hits);
      top5Hits.push(hits);
      if (idx === 0) totalTopHits += hits;
      if (idx < 3) totalTop3Hits += hits;
      totalTop5Hits += hits;
    });

    const t6 = result.combinations[5] ? result.combinations[5].numbers.filter((n) => targetSet.has(n)).length : 0;
    const t7 = result.combinations[6] ? result.combinations[6].numbers.filter((n) => targetSet.has(n)).length : 0;
    const t8 = result.combinations[7] ? result.combinations[7].numbers.filter((n) => targetSet.has(n)).length : 0;
    totalTop6Hit += t6;
    totalTop7Hit += t7;
    totalTop8Hit += t8;

    // 补漏6逻辑
    const top5CoveredNums = new Set();
    result.combinations.slice(0, 5).forEach(c => c.numbers.forEach(n => top5CoveredNums.add(n)));
    const top5Freq = new Map();
    result.combinations.slice(0, 5).forEach(c => c.numbers.forEach(n => top5Freq.set(n, (top5Freq.get(n) || 0) + 1)));

    const missWindow = 20;
    const missMap = new Map();
    for (let n = 1; n <= 35; n++) {
      let gap = 0;
      for (let i = srcIdx - 1; i >= Math.max(0, srcIdx - missWindow); i--) {
        if (ALL_DRAWS[i].front.includes(n)) break;
        gap++;
      }
      missMap.set(n, gap);
    }

    const hotWindow = 10;
    const hotMap = new Map();
    for (let n = 1; n <= 35; n++) {
      let cnt = 0;
      for (let i = srcIdx - 1; i >= Math.max(0, srcIdx - hotWindow); i--) {
        if (ALL_DRAWS[i].front.includes(n)) cnt++;
      }
      hotMap.set(n, cnt);
    }

    const predTails6 = result.predictedTails ? new Set(result.predictedTails.slice(0, 5).map(([t]) => t)) : new Set();
    const top5IvCounts = [0, 0, 0];
    result.combinations.slice(0, 5).forEach(c => {
      c.numbers.forEach(n => { if (n <= 12) top5IvCounts[0]++; else if (n <= 24) top5IvCounts[1]++; else top5IvCounts[2]++; });
    });
    const top5IvMinIdx = top5IvCounts.indexOf(Math.min(...top5IvCounts));

    const candidate6Scored = result.pool
      .filter(e => {
        const n = e.number;
        const freq = top5Freq.get(n) || 0;
        return !top5CoveredNums.has(n) || freq >= 1;
      })
      .map(e => {
        const n = e.number;
        const freq = top5Freq.get(n) || 0;
        const miss = missMap.get(n) || 0;
        const hot = hotMap.get(n) || 0;
        let score6 = e.score;
        if (predTails6.has(n % 10)) score6 += 10;
        const zone = n <= 12 ? 0 : n <= 24 ? 1 : 2;
        if (zone === top5IvMinIdx) score6 += 6;
        if (hot >= 3) score6 += 8;
        else if (hot >= 2) score6 += 4;
        if (miss >= 10) score6 += 5;
        else if (miss >= 7) score6 += 3;
        if (freq >= 3) score6 += 30;
        else if (freq <= 1) score6 += 25;
        else if (freq >= 2) score6 += 15;
        let minDistToTop5 = Infinity;
        top5CoveredNums.forEach(cn => { const d = Math.abs(n - cn); if (d < minDistToTop5) minDistToTop5 = d; });
        if (minDistToTop5 === 1) score6 += 12;
        else if (minDistToTop5 === 2) score6 += 6;
        else if (minDistToTop5 === 3) score6 += 3;
        return { number: n, poolScore: e.score, freq, miss, hot, score6 };
      })
      .sort((a, b) => b.score6 - a.score6);

    function buildCombo6(candidates, count = 5) {
      if (candidates.length < count) return null;
      const combos = [];
      const greedy = candidates.slice(0, count).map(e => e.number).sort((a, b) => a - b);
      combos.push(greedy);
      for (let trial = 0; trial < 3; trial++) {
        const pool = [...candidates];
        const selected = [];
        for (let i = 0; i < count && pool.length > 0; i++) {
          const totalWeight = pool.reduce((s, e) => s + Math.max(1, e.score6 + 50), 0);
          let r = Math.random() * totalWeight;
          let idx = 0;
          for (let j = 0; j < pool.length; j++) {
            r -= Math.max(1, pool[j].score6 + 50);
            if (r <= 0) { idx = j; break; }
          }
          selected.push(pool[idx].number);
          pool.splice(idx, 1);
        }
        combos.push(selected.sort((a, b) => a - b));
      }
      let bestCombo = null, bestScore = -Infinity;
      for (const nums of combos) {
        const s = nums.reduce((a, b) => a + b, 0);
        const sp = Math.max(...nums) - Math.min(...nums);
        const odd = nums.filter(n => n % 2 === 1).length;
        const iv = [0, 0, 0];
        nums.forEach(n => { if (n <= 12) iv[0]++; else if (n <= 24) iv[1]++; else iv[2]++; });
        let structScore = 0;
        if (s >= 65 && s <= 115) structScore += 10;
        if (sp >= 12 && sp <= 28) structScore += 8;
        if (odd >= 1 && odd <= 4) structScore += 6;
        if (iv[0] > 0 && iv[1] > 0 && iv[2] > 0) structScore += 10;
        else if ((iv[0] > 0 && iv[1] > 0) || (iv[1] > 0 && iv[2] > 0) || (iv[0] > 0 && iv[2] > 0)) structScore += 5;
        const numScore = nums.reduce((s, n) => {
          const entry = candidates.find(e => e.number === n);
          return s + (entry ? entry.score6 : 0);
        }, 0);
        const total = numScore + structScore * 2;
        if (total > bestScore) { bestScore = total; bestCombo = nums; }
      }
      return { numbers: bestCombo, score: bestScore };
    }

    let combo6补漏 = buildCombo6(candidate6Scored, 5);
    if (!combo6补漏 && candidate6Scored.length > 0) {
      const supplement = result.pool
        .filter(e => !top5CoveredNums.has(e.number) && !candidate6Scored.some(c => c.number === e.number))
        .sort((a, b) => b.score - a.score);
      let all = [...candidate6Scored, ...supplement.map(e => ({ number: e.number, score6: e.score }))];
      if (all.length < 5) {
        const coveredPool = result.pool
          .filter(e => top5CoveredNums.has(e.number) && !all.some(c => c.number === e.number))
          .sort((a, b) => b.score - a.score);
        all = [...all, ...coveredPool.map(e => ({ number: e.number, score6: e.score * 0.5 }))];
      }
      all = all.slice(0, 5);
      const nums = all.map(e => e.number).sort((a, b) => a - b);
      combo6补漏 = { numbers: nums, score: all.reduce((s, e) => s + e.score6, 0) };
    }

    let hits6补漏 = 0, union5_6hits = 0;
    if (combo6补漏) {
      hits6补漏 = combo6补漏.numbers.filter(n => targetSet.has(n)).length;
      totalTop6补漏Hit += hits6补漏;
      const union5_6 = new Set();
      result.combinations.slice(0, 5).forEach(c => c.numbers.forEach(n => union5_6.add(n)));
      combo6补漏.numbers.forEach(n => union5_6.add(n));
      union5_6hits = [...targetSet].filter(n => union5_6.has(n)).length;
      totalTop6补漏UnionHit += union5_6hits;
    }

    function calcUnionHits(combos, topN) {
      const union = new Set();
      combos.slice(0, topN).forEach((c) => c.numbers.forEach((n) => union.add(n)));
      return [...targetSet].filter((n) => union.has(n)).length;
    }
    const u5 = calcUnionHits(result.combinations, 5);
    const u6 = calcUnionHits(result.combinations, 6);
    const u7 = calcUnionHits(result.combinations, 7);
    const u8 = calcUnionHits(result.combinations, 8);
    totalUnionHits5 += u5; totalUnionHits6 += u6; totalUnionHits7 += u7; totalUnionHits8 += u8;

    perPair.push({
      sIssue, tIssue, src: result.sourceFront, tgt: result.targetFront,
      poolHits: poolHits.length, bestHit, top5Hits,
      backHits, unionHits: u5, union6: u6, union7: u7, union8: u8,
      combo6补漏hits: hits6补漏, combo6补漏union: union5_6hits,
    });
  });

  const totalBalls = fullPairs.length * 5;
  const N = fullPairs.length;

  console.log("\n" + "═".repeat(70));
  console.log("📊 汇总统计");
  console.log("═".repeat(70));
  console.log(`\n   总配对: ${N} | 总目标球: ${totalBalls}`);
  console.log(`\n   📦 号码池覆盖率 (${CONFIG.poolSize}球池):`);
  console.log(`      池内命中: ${totalCoverage}/${totalBalls} (${(totalCoverage / totalBalls * 100).toFixed(1)}%)`);

  const covDist = [0, 0, 0, 0, 0, 0];
  perPair.forEach((r) => covDist[r.poolHits]++);
  console.log(`      池覆盖分布: 5球${covDist[5]}对 | 4球${covDist[4]}对 | 3球${covDist[3]}对 | ≤2球${covDist[2] + covDist[1] + covDist[0]}对`);

  console.log(`\n   🎯 前N注联合覆盖:`);
  [{ n: 5, total: totalUnionHits5, key: 'unionHits' }, { n: 6, total: totalUnionHits6, key: 'union6' }, { n: 7, total: totalUnionHits7, key: 'union7' }, { n: 8, total: totalUnionHits8, key: 'union8' }].forEach(({ n, total, key }) => {
    const dist = [0, 0, 0, 0, 0, 0];
    perPair.forEach((r) => dist[r[key]]++);
    console.log(`      Top${n}: ${total}/${totalBalls} (${(total / totalBalls * 100).toFixed(1)}%) | ≥3球:${dist[5] + dist[4] + dist[3]}/${N}对 | 全5:${dist[5]}对`);
  });

  console.log(`\n   🏆 前5组合命中率:`);
  console.log(`      Top1 命中: ${totalTopHits}/${totalBalls} (${(totalTopHits / totalBalls * 100).toFixed(1)}%)`);
  console.log(`      Top3 总命中: ${totalTop3Hits}/${totalBalls * 3} (${(totalTop3Hits / (totalBalls * 3) * 100).toFixed(1)}%)`);
  console.log(`      Top5 总命中: ${totalTop5Hits}/${totalBalls * 5} (${(totalTop5Hits / (totalBalls * 5) * 100).toFixed(1)}%)`);

  const t1Hit = perPair.reduce((s, r) => s + r.top5Hits[0], 0);
  const t2Hit = perPair.reduce((s, r) => s + r.top5Hits[1], 0);
  const t3Hit = perPair.reduce((s, r) => s + r.top5Hits[2], 0);
  const t4Hit = perPair.reduce((s, r) => s + r.top5Hits[3], 0);
  const t5Hit = perPair.reduce((s, r) => s + r.top5Hits[4], 0);

  console.log(`\n   ┌─────────┬──────────┬──────────┬──────────┐`);
  console.log(`   │ 组合    │ 总命中   │ 命中率   │ 平均/对  │`);
  console.log(`   ├─────────┼──────────┼──────────┼──────────┤`);
  console.log(`   │ Top1    │ ${String(t1Hit).padStart(4)}/${String(N*5).padStart(4)} │ ${(t1Hit/(N*5)*100).toFixed(1).padStart(6)}%  │ ${(t1Hit/N).toFixed(2).padStart(6)}   │`);
  console.log(`   │ Top2    │ ${String(t2Hit).padStart(4)}/${String(N*5).padStart(4)} │ ${(t2Hit/(N*5)*100).toFixed(1).padStart(6)}%  │ ${(t2Hit/N).toFixed(2).padStart(6)}   │`);
  console.log(`   │ Top3    │ ${String(t3Hit).padStart(4)}/${String(N*5).padStart(4)} │ ${(t3Hit/(N*5)*100).toFixed(1).padStart(6)}%  │ ${(t3Hit/N).toFixed(2).padStart(6)}   │`);
  console.log(`   │ Top4    │ ${String(t4Hit).padStart(4)}/${String(N*5).padStart(4)} │ ${(t4Hit/(N*5)*100).toFixed(1).padStart(6)}%  │ ${(t4Hit/N).toFixed(2).padStart(6)}   │`);
  console.log(`   │ Top5    │ ${String(t5Hit).padStart(4)}/${String(N*5).padStart(4)} │ ${(t5Hit/(N*5)*100).toFixed(1).padStart(6)}%  │ ${(t5Hit/N).toFixed(2).padStart(6)}   │`);
  console.log(`   │ 补漏6   │ ${String(totalTop6补漏Hit).padStart(4)}/${String(N*5).padStart(4)} │ ${(totalTop6补漏Hit/(N*5)*100).toFixed(1).padStart(6)}%  │ ${(totalTop6补漏Hit/N).toFixed(2).padStart(6)}   │`);
  console.log(`   ├─────────┼──────────┼──────────┼──────────┤`);
  console.log(`   │T1-5联合 │ ${String(totalUnionHits5).padStart(4)}/${String(N*5).padStart(4)} │ ${(totalUnionHits5/(N*5)*100).toFixed(1).padStart(6)}%  │ ${(totalUnionHits5/N).toFixed(2).padStart(6)}   │`);
  console.log(`   │T1-6联合 │ ${String(totalTop6补漏UnionHit).padStart(4)}/${String(N*5).padStart(4)} │ ${(totalTop6补漏UnionHit/(N*5)*100).toFixed(1).padStart(6)}%  │ ${(totalTop6补漏UnionHit/N).toFixed(2).padStart(6)}   │`);
  console.log(`   └─────────┴──────────┴──────────┴──────────┘`);

  // 最佳命中分布 (取每对 Top5+补漏6 中最佳)
  const bestHitDist = [0, 0, 0, 0, 0, 0];
  perPair.forEach((r) => {
    let best = r.bestHit;
    if (r.combo6补漏hits > best) best = r.combo6补漏hits;
    bestHitDist[best]++;
  });
  console.log(`\n   🎯 各对最佳命中分布:`);
  console.log(`      5球${bestHitDist[5]}对 | 4球${bestHitDist[4]}对 | 3球${bestHitDist[3]}对 | 2球${bestHitDist[2]}对 | 1球${bestHitDist[1]}对 | 0球${bestHitDist[0]}对`);
  const bestGe3 = bestHitDist[5] + bestHitDist[4] + bestHitDist[3];
  const bestGe4 = bestHitDist[5] + bestHitDist[4];
  console.log(`      最佳命中≥3球: ${bestGe3}/${N}对 (${(bestGe3 / N * 100).toFixed(1)}%)`);
  console.log(`      最佳命中≥4球: ${bestGe4}/${N}对 (${(bestGe4 / N * 100).toFixed(1)}%)`);

  // 各组合命中分布 (命中X球的对数)
  const comboHitDist = [];
  for (let ci = 0; ci < 6; ci++) {
    comboHitDist.push([0, 0, 0, 0, 0, 0]);
  }
  perPair.forEach((r) => {
    for (let ci = 0; ci < 5; ci++) {
      const h = r.top5Hits[ci] || 0;
      comboHitDist[ci][h]++;
    }
    comboHitDist[5][r.combo6补漏hits]++;
  });
  console.log(`\n   📊 各组合命中分布 (命中X球的对数):`);
  console.log(`   ┌──────┬────────┬────────┬────────┬────────┬────────┬────────┐`);
  console.log(`   │ 命中 │ Top1   │ Top2   │ Top3   │ Top4   │ Top5   │ 补漏6  │`);
  console.log(`   ├──────┼────────┼────────┼────────┼────────┼────────┼────────┤`);
  for (let h = 5; h >= 0; h--) {
    const cols = [String(h) + '球', comboHitDist[0][h], comboHitDist[1][h], comboHitDist[2][h], comboHitDist[3][h], comboHitDist[4][h], comboHitDist[5][h]];
    console.log(`   │ ${cols[0].padStart(4)} │ ${String(cols[1]).padStart(4)}对 │ ${String(cols[2]).padStart(4)}对 │ ${String(cols[3]).padStart(4)}对 │ ${String(cols[4]).padStart(4)}对 │ ${String(cols[5]).padStart(4)}对 │ ${String(cols[6]).padStart(4)}对 │`);
  }
  console.log(`   └──────┴────────┴────────┴────────┴────────┴────────┴────────┘`);

  // 联合覆盖分布 (Top5联合覆盖)
  const unionDist5 = [0, 0, 0, 0, 0, 0];
  perPair.forEach((r) => unionDist5[r.unionHits]++);
  console.log(`\n   联合覆盖分布: 5球${unionDist5[5]}对 | 4球${unionDist5[4]}对 | 3球${unionDist5[3]}对 | 2球${unionDist5[2]}对 | 1球${unionDist5[1]}对 | 0球${unionDist5[0]}对`);

  console.log(`\n   🎱 后区预测 (6选2):`);
  console.log(`      总命中: ${totalBackHits}/${N * 2} (${(totalBackHits / (N * 2) * 100).toFixed(1)}%)`);
  const backDist = [0, 0, 0];
  perPair.forEach((r) => backDist[r.backHits]++);
  console.log(`      命中2球:${backDist[2]}对 | 命中1球:${backDist[1]}对 | 命中0球:${backDist[0]}对`);

  console.log("\n" + "═".repeat(70));
}

// ===================== 运行入口 =====================
backtest();
