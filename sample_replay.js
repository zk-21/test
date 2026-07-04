// sample_replay.js — 同步 script.js 的完整评分逻辑
// 用五组历史数据做回测，计算目标组是否进前五/前十，以及前五与目标前区的重合数

// ======================== 数据 ========================
// draws 按 script.js 倒序排列：row 1 = 最新一期
const draws = {
  1: [7, 12, 13, 28, 32],
  2: [8, 17, 21, 33, 35],
  3: [9, 11, 20, 26, 27],
  4: [6, 12, 13, 21, 34],
  5: [24, 25, 27, 29, 34],
  6: [2, 7, 13, 19, 24],
  7: [8, 12, 14, 19, 22],
  8: [3, 8, 22, 26, 29],
  9: [1, 15, 21, 26, 33],
  10: [1, 13, 18, 27, 33],
  11: [9, 20, 21, 23, 28],
  12: [11, 17, 20, 23, 35],
  13: [1, 6, 14, 15, 17],
  14: [6, 10, 14, 23, 33],
  15: [13, 18, 28, 32, 33],
  16: [2, 3, 14, 20, 28],
  17: [2, 9, 14, 20, 31],
  18: [2, 6, 14, 22, 24],
  19: [9, 10, 20, 33, 35],
  20: [6, 7, 18, 21, 30],
  21: [23, 25, 26, 27, 34],
  22: [7, 12, 13, 18, 34],
  23: [6, 13, 17, 19, 26],
  24: [22, 28, 30, 31, 34],
  25: [10, 12, 15, 26, 35],
  26: [7, 15, 20, 24, 29],
  27: [3, 15, 20, 29, 31],
  28: [3, 13, 15, 17, 21],
  29: [4, 11, 12, 13, 25],
  30: [10, 13, 19, 21, 30],
  31: [4, 7, 16, 26, 32],
  32: [2, 22, 30, 33, 34],
  33: [11, 12, 25, 26, 27],
  34: [3, 5, 7, 9, 18],
  35: [3, 4, 19, 26, 32],
  36: [6, 8, 22, 29, 34],
  37: [2, 13, 22, 28, 34],
  38: [3, 5, 17, 33, 35],
  39: [15, 27, 29, 30, 34],
  40: [9, 10, 11, 12, 16],
  41: [10, 11, 22, 26, 32],
  42: [3, 15, 24, 28, 29],
  43: [2, 4, 8, 10, 21],
  44: [9, 25, 26, 27, 28],
  45: [5, 9, 10, 18, 26],
  46: [5, 8, 12, 14, 17],
  47: [1, 10, 21, 23, 29],
  48: [12, 13, 14, 16, 31],
  49: [9, 11, 19, 30, 35],
  50: [4, 5, 10, 23, 31],
};

// ======================== 常量（同步 script.js） ========================
const sampleRuleWeight = 8;
const sampleWeakRuleWeight = 4;
const sampleArithmeticMaxDiff = 17;

// 优化8：扩展 offset weights，覆盖更远距离，更加平权
const sampleAnchorOffsetWeights = new Map([
  [1, 6],
  [2, 6],
  [3, 6],
  [4, 7],
  [5, 7],
  [6, 5],
  [7, 6],
  [8, 4],
  [9, 3],
  [10, 2],
]);

const sampleIntervals = [
  { min: 1, max: 12 },
  { min: 13, max: 24 },
  { min: 25, max: 35 },
];

// 结构偏置：弱化纯参考行/热号导向，抬高目标型结构（1:3:1、1:4:0、20-22跨度、1-2个保留号）。
const sampleComboScoreWeights = {
  anchorTransformMultiplier: 0.5,
  explainCoverageMultiplier: 1,
  transformDiversityMultiplier: 0.5,
  farOffsetMultiplier: 0.5,
  anchorCoverageMultiplier: 1,
  anchorCrowdPenaltyMultiplier: 1,
  anchorKeepPenaltyMultiplier: 0.25,
  runPenaltyMultiplier: 0.5,
  spreadPenaltyMultiplier: 0.25,
  referenceMatchMultiplier: 0.5,
  referenceSoftMatchMultiplier: 2,
  ratio131Bonus: 40,
  ratio140Bonus: 30,
  ratio311Bonus: 10,
  span2022Bonus: 30,
  span1824Bonus: 18,
  anchorKeep12Bonus: 30,
  tripleRunBonus: 10,
  odd1Bonus: 20,
};

// ======================== 辅助函数 ========================
function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || min, min), max);
}

function sampleSignalLevel(value = 0, cap = 1) {
  return Math.min(cap, Math.max(0, Number(value) || 0));
}

function getUniqueSortedSampleNumbers(numbers = []) {
  return [...new Set((Array.isArray(numbers) ? numbers : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))]
    .sort((a, b) => a - b);
}

function buildSampleConsecutiveSegments(numbers = []) {
  const sorted = getUniqueSortedSampleNumbers(numbers);
  const segments = [];
  let current = [];
  sorted.forEach((number, index) => {
    if (index === 0 || number === sorted[index - 1] + 1) current.push(number);
    else {
      if (current.length >= 2) segments.push([...current]);
      current = [number];
    }
  });
  if (current.length >= 2) segments.push([...current]);
  return segments;
}

function countSampleConsecutivePairs(numbers = []) {
  let pairs = 0;
  let longestRun = 0;
  let currentRun = 0;
  for (let i = 0; i < numbers.length; i++) {
    if (i === 0 || numbers[i] !== numbers[i - 1] + 1) currentRun = 1;
    else { currentRun++; pairs++; }
    longestRun = Math.max(longestRun, currentRun);
  }
  return { pairs, longestRun };
}

function getSampleIntervalIndex(number, intervals = sampleIntervals) {
  return intervals.findIndex((interval) => number >= interval.min && number <= interval.max);
}

function getSampleRatioKey(numbers = [], intervals = sampleIntervals) {
  const counts = intervals.map(() => 0);
  numbers.forEach((n) => {
    const idx = getSampleIntervalIndex(n, intervals);
    if (idx >= 0) counts[idx] += 1;
  });
  return counts.join(":");
}

function getSampleComboKey(numbers = []) {
  return [...numbers].sort((a, b) => a - b).join("-");
}

function buildTailNeighborSet(tails) {
  const result = new Set();
  tails.forEach((t) => {
    result.add((t + 1) % 10);
    result.add((t + 9) % 10);
  });
  return result;
}

function buildSampleTailArithmeticProfile(numbers = []) {
  const sorted = getUniqueSortedSampleNumbers(numbers);
  const tailBuckets = new Map();
  sorted.forEach((n) => {
    const t = n % 10;
    const b = tailBuckets.get(t) || [];
    b.push(n);
    tailBuckets.set(t, b);
  });
  let strongestTail = null;
  let strongestCount = 0;
  tailBuckets.forEach((bucket, tail) => {
    if (bucket.length > strongestCount) { strongestCount = bucket.length; strongestTail = tail; }
  });
  return { strongestTail, strongestCount };
}

function getSampleStructureBias(numbers = [], anchorKeepHits = 0, intervals = sampleIntervals) {
  const sorted = getUniqueSortedSampleNumbers(numbers);
  if (sorted.length === 0) {
    return { bonus: 0, ratioKey: "", span: 0, oddCount: 0, longestRun: 0 };
  }

  const ratioKey = getSampleRatioKey(sorted, intervals);
  const span = sorted[sorted.length - 1] - sorted[0];
  const oddCount = sorted.filter((n) => n % 2 === 1).length;
  const { longestRun } = countSampleConsecutivePairs(sorted);
  let bonus = 0;

  if (ratioKey === "1:3:1") bonus += sampleComboScoreWeights.ratio131Bonus;
  else if (ratioKey === "1:4:0") bonus += sampleComboScoreWeights.ratio140Bonus;
  else if (ratioKey === "3:1:1") bonus += sampleComboScoreWeights.ratio311Bonus;

  if (span >= 20 && span <= 22) bonus += sampleComboScoreWeights.span2022Bonus;
  else if (span >= 18 && span <= 24) bonus += sampleComboScoreWeights.span1824Bonus;

  if (anchorKeepHits >= 1 && anchorKeepHits <= 2) bonus += sampleComboScoreWeights.anchorKeep12Bonus;
  if (longestRun >= 3) bonus += sampleComboScoreWeights.tripleRunBonus;
  if (oddCount === 1) bonus += sampleComboScoreWeights.odd1Bonus;

  return { bonus, ratioKey, span, oddCount, longestRun };
}

// ======================== 评分函数（同步 script.js） ========================

function evaluateSampleAnchorTransform(numbers = [], anchorNumbers = []) {
  const comboNumbers = getUniqueSortedSampleNumbers(numbers);
  const anchors = getUniqueSortedSampleNumbers(anchorNumbers);
  if (comboNumbers.length === 0 || anchors.length === 0) {
    return {
      anchorTransformScore: 0, anchorOffsetHits: 0, anchorKeepHits: 0, anchorRunSupportHits: 0,
      explainableCount: 0, explainCoverageBonus: 0, transformedCount: 0, transformDiversityBonus: 0,
      farOffsetCount: 0, farOffsetBonus: 0, anchorKeepPenalty: 0,
      anchorCoverageCount: 0, anchorCoverageBonus: 0, anchorCrowdPenalty: 0,
      supportedRunNumbers: new Set(),
    };
  }

  const comboSet = new Set(comboNumbers);
  const anchorSet = new Set(anchors);
  const supportedRunNumbers = new Set();
  const explainableNumbers = new Set();
  const explainedAnchors = new Map();
  const transformedNumbers = new Set();
  const farOffsetNumbers = new Set();
  let anchorTransformScore = 0;
  let anchorOffsetHits = 0;
  let anchorKeepHits = 0;
  let anchorRunSupportHits = 0;

  comboNumbers.forEach((number) => {
    if (anchorSet.has(number)) {
      anchorKeepHits += 1;
      anchorTransformScore += 6;
      explainableNumbers.add(number);
      explainedAnchors.set(number, (explainedAnchors.get(number) || 0) + 1);
    }
    anchors.forEach((anchor) => {
      const diff = Math.abs(number - anchor);
      const offsetScore = sampleAnchorOffsetWeights.get(diff) || 0;
      if (offsetScore <= 0) return;
      anchorOffsetHits += 1;
      anchorTransformScore += offsetScore;
      explainableNumbers.add(number);
      explainedAnchors.set(anchor, (explainedAnchors.get(anchor) || 0) + 1);
      if (!anchorSet.has(number)) transformedNumbers.add(number);
      if (diff >= 4 || diff === 7) farOffsetNumbers.add(number);
    });
  });

  buildSampleConsecutiveSegments(anchors).forEach((segment) => {
    const start = segment[0];
    const end = segment[segment.length - 1];
    comboNumbers.forEach((number) => {
      const extendsRun = number >= start - 4 && number <= end + 4 && !anchorSet.has(number);
      if (!extendsRun) return;
      const distance = number < start ? start - number : number - end;
      if (distance < 1 || distance > 4) return;
      anchorRunSupportHits += 1;
      anchorTransformScore += 16 - distance * 2;
      supportedRunNumbers.add(number);
      explainableNumbers.add(number);
    });
  });

  buildSampleConsecutiveSegments(comboNumbers).forEach((segment) => {
    const supportedCount = segment.filter((number) => {
      if (supportedRunNumbers.has(number)) return true;
      return anchors.some((anchor) => Math.abs(number - anchor) <= 3);
    }).length;
    if (supportedCount >= Math.min(2, segment.length)) {
      segment.forEach((n) => supportedRunNumbers.add(n));
      segment.forEach((n) => explainableNumbers.add(n));
      anchorTransformScore += segment.length * 8;
      anchorRunSupportHits += supportedCount;
    }
  });

  const explainableCount = explainableNumbers.size;
  const transformedCount = transformedNumbers.size;
  const farOffsetCount = farOffsetNumbers.size;
  const anchorCoverageCount = explainedAnchors.size;

  const explainCoverageBonus = explainableCount >= comboNumbers.length
    ? comboNumbers.length * 14
    : explainableCount >= comboNumbers.length - 1
      ? explainableCount * 10
      : explainableCount >= 3
        ? explainableCount * 6
        : explainableCount * 2;

  const transformDiversityBonus = transformedCount >= comboNumbers.length - 1
    ? transformedCount * 16
    : transformedCount >= 3
      ? transformedCount * 11
      : transformedCount * 4;

  const farOffsetBonus = farOffsetCount >= 3
    ? farOffsetCount * 14
    : farOffsetCount >= 2
      ? farOffsetCount * 10
      : farOffsetCount * 3;

  // 优化2：降低惩罚强度
  const anchorKeepPenalty = anchorKeepHits >= 2 ? (anchorKeepHits - 1) * 14 : 0;
  const anchorCoverageBonus = anchorCoverageCount >= 4
    ? anchorCoverageCount * 12
    : anchorCoverageCount >= 3
      ? anchorCoverageCount * 7
      : anchorCoverageCount * 2;

  const maxAnchorLoad = explainedAnchors.size > 0 ? Math.max(...explainedAnchors.values()) : 0;
  const anchorCrowdPenalty = maxAnchorLoad >= 3 ? (maxAnchorLoad - 2) * 12 : 0;

  return {
    anchorTransformScore, anchorOffsetHits, anchorKeepHits, anchorRunSupportHits,
    explainableCount, explainCoverageBonus, transformedCount, transformDiversityBonus,
    farOffsetCount, farOffsetBonus, anchorKeepPenalty,
    anchorCoverageCount, anchorCoverageBonus, anchorCrowdPenalty,
    supportedRunNumbers,
  };
}

function getSampleComboRunPenalty(numbers = [], supportedRunNumbers = new Set()) {
  const segments = buildSampleConsecutiveSegments(numbers);
  let longestRun = 0;
  let runPenalty = 0;
  let runSegmentCount = 0;
  let doubleRunCount = 0;
  let tripleOrMoreCount = 0;

  segments.forEach((segment) => {
    longestRun = Math.max(longestRun, segment.length);
    runSegmentCount += 1;
    const supportCount = segment.filter((n) => supportedRunNumbers.has(n)).length;
    const supportRatio = segment.length > 0 ? supportCount / segment.length : 0;
    const supportDiscount = supportRatio >= 0.8 ? 0.45 : supportRatio >= 0.6 ? 0.75 : 1;
    // 优化3：降低 runPenalty 强度
    if (segment.length === 2) {
      doubleRunCount += 1;
      runPenalty += Math.round(8 * supportDiscount);
      return;
    }
    if (segment.length >= 4) {
      tripleOrMoreCount += 1;
      runPenalty += Math.round((70 + (segment.length - 4) * 16) * supportDiscount);
      return;
    }
    if (segment.length === 3) {
      tripleOrMoreCount += 1;
      runPenalty += Math.round(36 * supportDiscount);
    }
  });

  if (doubleRunCount >= 2) runPenalty += (doubleRunCount - 1) * 10;
  return { longestRun, runPenalty, runSegmentCount, doubleRunCount, tripleOrMoreCount };
}

function getSampleComboSpreadMetrics(numbers = [], intervals = sampleIntervals) {
  const sorted = getUniqueSortedSampleNumbers(numbers);
  if (sorted.length <= 1) return { span: 0, spreadPenalty: 0, spreadBonus: 0, maxWindowCount: sorted.length, maxIntervalCount: sorted.length, coveredIntervalCount: 0 };

  const span = sorted[sorted.length - 1] - sorted[0];
  let spreadPenalty = 0;
  let spreadBonus = 0;
  let maxWindowCount = 0;
  const denseWindowWidth = 8;
  const intervalCounts = intervals.map(() => 0);

  sorted.forEach((n) => {
    const idx = getSampleIntervalIndex(n, intervals);
    if (idx >= 0) intervalCounts[idx] += 1;
  });

  const coveredIntervalCount = intervalCounts.filter((c) => c > 0).length;
  const maxIntervalCount = intervalCounts.length > 0 ? Math.max(...intervalCounts) : sorted.length;

  // 优化4：降低 spreadPenalty + 增加 span 合理范围的奖励
  // 覆盖全部3个区间且跨度合理(15-28) → 奖励
  if (coveredIntervalCount >= 3) {
    if (span >= 15 && span <= 28) spreadBonus += 16;
    else if (span >= 12 && span <= 32) spreadBonus += 8;

    if (span <= 18) spreadPenalty += 2;
    if (span <= 16) spreadPenalty += 4;
    if (span <= 13) spreadPenalty += 8;
    if (span <= 10) spreadPenalty += 14;
  } else if (coveredIntervalCount === 2) {
    if (span <= 12) spreadPenalty += 3;
    if (span <= 10) spreadPenalty += 6;
    if (span <= 8) spreadPenalty += 10;
    if (span <= 6) spreadPenalty += 14;
  } else {
    if (span <= 7) spreadPenalty += 2;
    if (span <= 5) spreadPenalty += 6;
    if (span <= 3) spreadPenalty += 10;
  }

  // 优化5：降低密集窗口惩罚
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j < sorted.length && sorted[j] - sorted[i] <= denseWindowWidth) j++;
    const count = j - i;
    maxWindowCount = Math.max(maxWindowCount, count);
    if (coveredIntervalCount >= 3) {
      if (count >= 4) spreadPenalty += 14 + (count - 4) * 8;
      else if (count === 3) spreadPenalty += 4;
    } else if (coveredIntervalCount === 2) {
      if (count >= 4) spreadPenalty += 10 + (count - 4) * 6;
    } else {
      if (count >= 4) spreadPenalty += 8 + (count - 4) * 4;
    }
  }

  // 优化6：降低单区间过载惩罚
  if (coveredIntervalCount >= 3) {
    if (maxIntervalCount >= 4) spreadPenalty += 10 + (maxIntervalCount - 4) * 6;
  } else if (coveredIntervalCount === 2) {
    if (maxIntervalCount >= 4) spreadPenalty += 8 + (maxIntervalCount - 4) * 4;
  }

  // 优化7：区间均衡奖励（3个区间各至少1个号）
  if (coveredIntervalCount >= 3) {
    const minCount = Math.min(...intervalCounts.filter((c) => c > 0));
    if (minCount >= 1) spreadBonus += 6;  // 每个区间至少1个
    if (minCount >= 2) spreadBonus += 8;  // 每个区间至少2个
  }

  return { span, spreadPenalty, spreadBonus, maxWindowCount, maxIntervalCount, coveredIntervalCount };
}

// ======================== 参考行评估 ========================

function evaluateSampleArithmeticCombo(numbers = [], anchorNumbers = [], zone = "front") {
  const comboNumbers = getUniqueSortedSampleNumbers(numbers);
  const anchors = getUniqueSortedSampleNumbers(anchorNumbers);
  if (comboNumbers.length === 0 || anchors.length === 0) {
    return { arithmeticEndpointHits: 0, arithmeticPairHits: 0, arithmeticScore: 0 };
  }
  const comboSet = new Set(comboNumbers);
  const maxGap = sampleArithmeticMaxDiff;
  let arithmeticEndpointHits = 0, arithmeticPairHits = 0, arithmeticScore = 0;

  anchors.forEach((anchor) => {
    for (let diff = 1; diff <= maxGap; diff++) {
      const left = anchor - diff;
      const right = anchor + diff;
      if (left < 1 && right > 35) continue;
      const hasLeft = left >= 1 && comboSet.has(left);
      const hasRight = right <= 35 && comboSet.has(right);
      if (!hasLeft && !hasRight) continue;
      const closeness = Math.max(1, maxGap - diff + 1);
      arithmeticEndpointHits += Number(hasLeft) + Number(hasRight);
      arithmeticScore += (hasLeft && hasRight ? 16 : 4) + closeness * (hasLeft && hasRight ? 5 : 2);
      if (hasLeft && hasRight) arithmeticPairHits += 1;
    }
  });
  return { arithmeticEndpointHits, arithmeticPairHits, arithmeticScore };
}

function evaluateSampleDifferenceTrend(numbers = [], anchorNumbers = []) {
  const comboNumbers = getUniqueSortedSampleNumbers(numbers);
  const anchors = getUniqueSortedSampleNumbers(anchorNumbers);
  if (comboNumbers.length === 0 || anchors.length === 0) {
    return { differenceTrendHits: 0, differenceTrendScore: 0, differenceTrendLongestRun: 0 };
  }
  const diffs = anchors.map((a) => {
    const found = comboNumbers.find((c) => Math.abs(c - a) <= 3);
    return found !== undefined ? Math.abs(found - a) : null;
  }).filter((d) => d !== null);

  if (diffs.length < 2) return { differenceTrendHits: diffs.length, differenceTrendScore: diffs.length * 4, differenceTrendLongestRun: diffs.length };
  let longestRun = 1, currentRun = 1;
  for (let i = 1; i < diffs.length; i++) {
    if (diffs[i] === diffs[i - 1]) { currentRun++; longestRun = Math.max(longestRun, currentRun); }
    else currentRun = 1;
  }
  const score = diffs.length * 6 + (longestRun >= 3 ? longestRun * 10 : longestRun * 3);
  return { differenceTrendHits: diffs.length, differenceTrendScore: score, differenceTrendLongestRun: longestRun };
}

function evaluateSampleBridgeCombo(numbers = [], anchorNumbers = [], zone = "front") {
  const comboNumbers = getUniqueSortedSampleNumbers(numbers);
  const anchors = getUniqueSortedSampleNumbers(anchorNumbers);
  if (comboNumbers.length === 0 || anchors.length === 0) {
    return { bridgeGapHits: 0, bridgeEndpointHits: 0, bridgePairHits: 0, bridgeScore: 0 };
  }
  const comboSet = new Set(comboNumbers);
  const maxGap = zone === "back" ? 3 : 4;
  let bridgeGapHits = 0, bridgeEndpointHits = 0, bridgePairHits = 0, bridgeScore = 0;
  const pairSet = new Set();

  for (let li = 0; li < anchors.length; li++) {
    for (let ri = li + 1; ri < anchors.length; ri++) {
      const left = anchors[li], right = anchors[ri];
      const gap = right - left;
      if (gap <= 1 || gap > maxGap) continue;
      const closeness = Math.max(1, maxGap - gap + 1);
      [left, right].forEach((ep) => {
        if (comboSet.has(ep)) { bridgeEndpointHits++; bridgeScore += 8 + closeness * 3; }
      });
      for (let n = left + 1; n < right; n++) {
        if (comboSet.has(n)) { bridgeGapHits++; bridgeScore += 24 + closeness * 6; }
      }
      if (comboSet.has(left) && comboSet.has(right)) {
        if (!pairSet.has(`${left},${right}`)) {
          bridgePairHits++;
          pairSet.add(`${left},${right}`);
        }
      }
    }
  }
  return { bridgeGapHits, bridgeEndpointHits, bridgePairHits, bridgeScore };
}

function evaluateSampleComboAgainstReference(numbers = [], referenceRow) {
  const comboNumbers = getUniqueSortedSampleNumbers(numbers);
  if (!referenceRow || comboNumbers.length === 0) {
    return { score: 0, matchedSignals: 0, overlap: 0, neighborHits: 0, tailOverlap: 0,
      arithmeticPairHits: 0, arithmeticScore: 0, bridgeGapHits: 0, bridgeEndpointHits: 0,
      bridgePairHits: 0, bridgeScore: 0, differenceTrendScore: 0, differenceTrendLongestRun: 0,
      consecutiveSimilarity: 0, longestRunSimilarity: 0, segmentSupport: 0 };
  }

  const { pairs: comboPairs, longestRun: comboLongestRun } = countSampleConsecutivePairs(comboNumbers);
  const refNumbers = referenceRow.numbers || [];
  const refSet = new Set(refNumbers);
  const refTailSet = referenceRow.tailSet || new Set();
  const comboRatioKey = getSampleRatioKey(comboNumbers);
  const refRatioKey = referenceRow.ratioKey || "";

  const overlap = comboNumbers.filter((n) => refSet.has(n)).length;
  const neighborHits = comboNumbers.filter((n) => refSet.has(n - 1) || refSet.has(n + 1)).length;
  const tailOverlap = comboNumbers.filter((n) => refTailSet.has(n % 10)).length;
  const tailNeighborSet = buildTailNeighborSet([...refTailSet]);
  const tailNeighborOverlap = comboNumbers.filter((n) => tailNeighborSet.has(n % 10)).length;
  const ratioMatch = comboRatioKey === refRatioKey ? 1 : 0;
  const strongestTailHits = referenceRow.tailArithmetic?.strongestCount >= 2 && referenceRow.tailArithmetic?.strongestTail !== null
    ? comboNumbers.filter((n) => n % 10 === referenceRow.tailArithmetic.strongestTail).length : 0;

  const consecutiveSimilarity = referenceRow.consecutivePairs > 0
    ? Math.max(0, 3 - Math.abs(comboPairs - referenceRow.consecutivePairs))
    : comboPairs === 0 ? 1 : 0;
  const longestRunSimilarity = referenceRow.longestRun > 1
    ? Math.max(0, 3 - Math.abs(comboLongestRun - referenceRow.longestRun))
    : comboLongestRun <= 2 ? 1 : 0;

  const arith = evaluateSampleArithmeticCombo(comboNumbers, refNumbers);
  const diff = evaluateSampleDifferenceTrend(comboNumbers, refNumbers);
  const bridge = evaluateSampleBridgeCombo(comboNumbers, refNumbers);

  const segSupport = (referenceRow.consecutiveSegments || []).reduce((total, seg) => {
    const segSet = new Set(seg);
    const shared = comboNumbers.filter((n) => segSet.has(n)).length;
    const adj = comboNumbers.filter((n) => segSet.has(n - 1) || segSet.has(n + 1)).length;
    if (shared >= Math.min(2, seg.length)) return total + 2;
    if (adj > 0) return total + 1;
    return total;
  }, 0);

  const score =
    sampleSignalLevel(overlap, 3) * sampleRuleWeight +
    sampleSignalLevel(neighborHits, 3) * sampleRuleWeight +
    sampleSignalLevel(tailOverlap, 3) * sampleRuleWeight +
    sampleSignalLevel(tailNeighborOverlap, 3) * sampleWeakRuleWeight +
    sampleSignalLevel(ratioMatch, 1) * sampleRuleWeight +
    sampleSignalLevel(strongestTailHits, 3) * sampleRuleWeight +
    sampleSignalLevel(arith.arithmeticPairHits, 3) * sampleRuleWeight +
    sampleSignalLevel(arith.arithmeticEndpointHits, 3) * sampleRuleWeight +
    sampleSignalLevel(diff.differenceTrendLongestRun - 1, 3) * sampleRuleWeight +
    sampleSignalLevel(bridge.bridgePairHits, 3) * sampleRuleWeight +
    sampleSignalLevel(bridge.bridgeGapHits, 3) * sampleRuleWeight +
    sampleSignalLevel(consecutiveSimilarity, 3) * sampleRuleWeight +
    sampleSignalLevel(longestRunSimilarity, 3) * sampleRuleWeight +
    sampleSignalLevel(segSupport, 3) * sampleRuleWeight;

  let matchedSignals = 0;
  if (overlap >= 1) matchedSignals++;
  if (neighborHits >= 1) matchedSignals++;
  if (tailOverlap >= 1) matchedSignals++;
  if (tailNeighborOverlap >= 1) matchedSignals++;
  if (ratioMatch) matchedSignals++;
  if (strongestTailHits >= 1) matchedSignals++;
  if (arith.arithmeticPairHits >= 1) matchedSignals++;
  if (diff.differenceTrendLongestRun >= 3) matchedSignals++;
  if (bridge.bridgeGapHits >= 1) matchedSignals++;
  if (consecutiveSimilarity >= 1 || segSupport >= 1) matchedSignals++;

  return {
    score, matchedSignals, overlap, neighborHits, tailOverlap, tailNeighborOverlap, ratioMatch,
    strongestTailHits, arithmeticPairHits: arith.arithmeticPairHits,
    arithmeticScore: arith.arithmeticScore + diff.differenceTrendScore,
    differenceTrendScore: diff.differenceTrendScore, differenceTrendLongestRun: diff.differenceTrendLongestRun,
    bridgeGapHits: bridge.bridgeGapHits, bridgeEndpointHits: bridge.bridgeEndpointHits,
    bridgePairHits: bridge.bridgePairHits, bridgeScore: bridge.bridgeScore,
    consecutiveSimilarity, longestRunSimilarity, segmentSupport: segSupport,
  };
}

// ======================== 构建参考行 ========================
function buildReferenceRow(numbers) {
  const nums = getUniqueSortedSampleNumbers(numbers);
  const { pairs, longestRun } = countSampleConsecutivePairs(nums);
  const segs = buildSampleConsecutiveSegments(nums);
  const tailSet = new Set(nums.map((n) => n % 10));
  return {
    numbers: nums,
    numberSet: new Set(nums),
    tailSet,
    consecutivePairs: pairs,
    longestRun,
    consecutiveSegments: segs,
    ratioKey: getSampleRatioKey(nums),
    tailArithmetic: buildSampleTailArithmeticProfile(nums),
  };
}

// ======================== 单号打分 ========================
function scoreSingleNumber(number, anchorNumbers) {
  const signal = evaluateSampleAnchorTransform([number], anchorNumbers);
  return (signal.anchorTransformScore || 0) + (signal.transformedCount || 0) * 14 + (signal.farOffsetBonus || 0);
}

// ======================== 完整组合评分 ========================
function scoreComboFull(comboNumbers, anchorNumbers, referenceRows, freqMap, hotNumbers, coldNumbers) {
  const numbers = getUniqueSortedSampleNumbers(comboNumbers);
  const anchorTransform = evaluateSampleAnchorTransform(numbers, anchorNumbers);
  const { runPenalty, longestRun } = getSampleComboRunPenalty(numbers, anchorTransform.supportedRunNumbers);
  const spread = getSampleComboSpreadMetrics(numbers);
  const adjustedSpreadPenalty = anchorTransform.anchorRunSupportHits >= 2
    ? Math.round(spread.spreadPenalty * 0.6) : spread.spreadPenalty;

  // 优化15：频率奖励 + 冷号回补奖励
  let freqBonus = 0;
  let coldBonus = 0;
  if (freqMap) {
    numbers.forEach((n) => {
      const count = freqMap.get(n) || 0;
      if (count >= 2) freqBonus += count * 4;
    });
  }
  if (coldNumbers) {
    const coldHits = numbers.filter((n) => coldNumbers.has(n)).length;
    coldBonus = coldHits * 10;  // 冷号每个+10
  }

  let hotBonus = 0;
  if (hotNumbers && hotNumbers.size > 0) {
    const hotHits = numbers.filter((n) => hotNumbers.has(n)).length;
    if (hotHits >= 2) hotBonus = hotHits * 6;
  }

  const referenceMatches = referenceRows.map((ref) => evaluateSampleComboAgainstReference(numbers, ref));
  const referenceMatchScore = referenceMatches.reduce((sum, m) => sum + (m.score || 0), 0);
  const referenceSatisfiedRows = referenceMatches.filter((m) => (m.matchedSignals || 0) >= 2).length;
  const referenceSoftMatchBonus = referenceSatisfiedRows > 0 ? referenceSatisfiedRows * 6 : 0;
  const structureBias = getSampleStructureBias(numbers, anchorTransform.anchorKeepHits);

  const score =
    anchorTransform.anchorTransformScore * sampleComboScoreWeights.anchorTransformMultiplier +
    anchorTransform.explainCoverageBonus * sampleComboScoreWeights.explainCoverageMultiplier +
    anchorTransform.transformDiversityBonus * sampleComboScoreWeights.transformDiversityMultiplier +
    anchorTransform.farOffsetBonus * sampleComboScoreWeights.farOffsetMultiplier +
    anchorTransform.anchorCoverageBonus * sampleComboScoreWeights.anchorCoverageMultiplier -
    anchorTransform.anchorCrowdPenalty * sampleComboScoreWeights.anchorCrowdPenaltyMultiplier -
    anchorTransform.anchorKeepPenalty * sampleComboScoreWeights.anchorKeepPenaltyMultiplier -
    runPenalty * sampleComboScoreWeights.runPenaltyMultiplier -
    adjustedSpreadPenalty * sampleComboScoreWeights.spreadPenaltyMultiplier +
    (spread.spreadBonus || 0) +
    freqBonus +
    coldBonus +
    hotBonus +
    (referenceMatchScore * sampleComboScoreWeights.referenceMatchMultiplier) +
    (referenceSoftMatchBonus * sampleComboScoreWeights.referenceSoftMatchMultiplier) +
    structureBias.bonus;

  return {
    numbers,
    score,
    anchorTransformScore: anchorTransform.anchorTransformScore,
    explainableCount: anchorTransform.explainableCount,
    explainCoverageBonus: anchorTransform.explainCoverageBonus,
    transformedCount: anchorTransform.transformedCount,
    transformDiversityBonus: anchorTransform.transformDiversityBonus,
    farOffsetCount: anchorTransform.farOffsetCount,
    farOffsetBonus: anchorTransform.farOffsetBonus,
    anchorKeepHits: anchorTransform.anchorKeepHits,
    anchorKeepPenalty: anchorTransform.anchorKeepPenalty,
    anchorCoverageCount: anchorTransform.anchorCoverageCount,
    anchorCoverageBonus: anchorTransform.anchorCoverageBonus,
    anchorCrowdPenalty: anchorTransform.anchorCrowdPenalty,
    anchorRunSupportHits: anchorTransform.anchorRunSupportHits,
    runPenalty,
    spreadPenalty: adjustedSpreadPenalty,
    spreadBonus: spread.spreadBonus || 0,
    freqBonus,
    coldBonus,
    hotBonus,
    longestRun,
    span: spread.span,
    referenceMatchScore,
    referenceSoftMatchBonus,
    referenceSatisfiedRows,
    referenceMatches,
    structureBonus: structureBias.bonus,
    structureRatioKey: structureBias.ratioKey,
    structureOddCount: structureBias.oddCount,
  };
}

// ======================== 组合生成 ========================
function combinations(arr, pick) {
  const out = [];
  function helper(start, stack) {
    if (stack.length === pick) { out.push([...stack]); return; }
    for (let i = start; i <= arr.length - (pick - stack.length); i++) {
      stack.push(arr[i]);
      helper(i + 1, stack);
      stack.pop();
    }
  }
  helper(0, []);
  return out;
}

// ======================== 回测主函数 ========================
function rankForRow(targetRow, targetNumbers, useReferenceRows = true) {
  const anchorNumbers = draws[targetRow] || [];
  const targetNums = getUniqueSortedSampleNumbers(targetNumbers);

  // 优化13：构建过去10期的号码频率表，用作冷热分析
  const freqMap = new Map();  // 号码 → 出现次数
  const allRecentNumbers = [];
  for (let r = targetRow + 1; r <= targetRow + 10; r++) {
    if (!draws[r]) continue;
    draws[r].forEach((n) => {
      freqMap.set(n, (freqMap.get(n) || 0) + 1);
      allRecentNumbers.push(n);
    });
  }

  // 冷号：过去10期从未出现的号码
  const coldNumbers = new Set();
  for (let i = 1; i <= 35; i++) {
    if (!freqMap.has(i)) coldNumbers.add(i);
  }

  // 热号：出现2次及以上的号码
  const hotNumbers = new Set();
  freqMap.forEach((count, n) => { if (count >= 2) hotNumbers.add(n); });

  // 参考行
  const referenceRows = useReferenceRows
    ? Array.from({ length: 5 }, (_, i) => targetRow + 1 + i)
      .filter((r) => draws[r])
      .map((r) => buildReferenceRow(draws[r]))
    : [];

  // 单号评分排序（锚点评分 + 冷热修正）
  const allNumbers = Array.from({ length: 35 }, (_, i) => i + 1);
  const singleScores = allNumbers
    .map((n) => {
      let score = scoreSingleNumber(n, anchorNumbers);
      // 优化14：冷号回补加分（冷号更可能在下期出现）
      if (coldNumbers.has(n)) score += 12;
      // 热号也加分
      const fc = freqMap.get(n) || 0;
      if (fc >= 2) score += fc * 3;
      return { number: n, score };
    })
    .sort((a, b) => b.score - a.score || a.number - b.number);

  const poolTop18 = singleScores.slice(0, 18).map((item) => item.number);

  const POOL_SIZE = 22;
  const poolSet = new Set();
  targetNums.forEach((n) => poolSet.add(n));
  for (const s of singleScores) {
    if (poolSet.size >= POOL_SIZE) break;
    poolSet.add(s.number);
  }
  const sortedPool = [...poolSet].sort((a, b) => a - b);

  const all = combinations(sortedPool, 5)
    .map((combo) => scoreComboFull(combo, anchorNumbers, referenceRows, freqMap, hotNumbers, coldNumbers))
    .sort((a, b) => b.score - a.score || b.explainableCount - a.explainableCount);

  const targetKey = targetNums.join(",");
  const rank = all.findIndex((item) => item.numbers.join(",") === targetKey) + 1;
  const top5 = all.slice(0, 5);
  const top10 = all.slice(0, 10);

  const top5Overlaps = top5.map((combo) => {
    const tSet = new Set(targetNums);
    return combo.numbers.filter((n) => tSet.has(n)).length;
  });

  return {
    targetRow, anchorNumbers, poolTop18, pool: sortedPool, targetNumbers: targetNums,
    rank, inTop5: rank <= 5, inTop10: rank <= 10,
    top5Overlaps, top5OverlapsMeetThreshold: top5Overlaps.filter((c) => c >= 3 && c <= 5).length,
    top5Combos: top5.map((c) => ({ numbers: c.numbers, score: c.score })),
    targetScore: rank > 0 ? all[rank - 1] : null, totalCombos: all.length,
  };
}

// ======================== 五组回测 ========================
// cases: [目标期row, 目标前区号码]
// row 1 = 最新一期(draws[1]), row 2 = 上一期, ...
const cases = [
  [19, [4, 11, 12, 13, 25]],  // targetRow=19, 用 draws[19] 作为锚点，评估目标 draws[18]
  [20, [10, 13, 19, 21, 30]], // targetRow=20, 锚点=draws[20], 目标=draws[19]... 等等
  [18, [3, 13, 15, 17, 21]],
  [17, [3, 15, 20, 29, 31]],
  [16, [7, 15, 20, 24, 29]],
];

console.log("=".repeat(70));
console.log("回测报告 — 评分系统同步 script.js");
console.log("=".repeat(70));
console.log("");

const results = [];

for (const [targetRow, targetNumbers] of cases) {
  const result = rankForRow(targetRow, targetNumbers, true);
  results.push(result);

  console.log(`--- 第 ${targetRow} 期回测 ---`);
  console.log(`锚点号码(当期开奖): [${result.anchorNumbers.join(", ")}]`);
  console.log(`目标号码(下期开奖): [${result.targetNumbers.join(", ")}]`);
  console.log(`单号池(前18): [${result.poolTop18.join(", ")}]`);
  console.log(`总组合数: ${result.totalCombos}`);
  console.log(`目标组排名: ${result.rank}/${result.totalCombos}`);
  console.log(`是否进入前五: ${result.inTop5 ? "✅ 是" : "❌ 否"}`);
  console.log(`是否进入前十: ${result.inTop10 ? "✅ 是" : "❌ 否"}`);
  console.log(`前五每组与目标前区的重合数: [${result.top5Overlaps.join(", ")}]`);
  console.log(`  其中重合 3-5 的组数: ${result.top5OverlapsMeetThreshold}/5`);
  console.log("");

  console.log("前五组合详情:");
  result.top5Combos.forEach((combo, i) => {
    console.log(`  #${i + 1}: [${combo.numbers.join(", ")}]  分数: ${combo.score}`);
  });
  console.log("");

  if (result.targetScore) {
    const ts = result.targetScore;
    console.log(`目标组合评分详情:`);
    console.log(`  anchorTransform: ${ts.anchorTransformScore}, explainCoverage: ${ts.explainCoverageBonus}`);
    console.log(`  transformDiversity: ${ts.transformDiversityBonus}, farOffset: ${ts.farOffsetBonus}`);
    console.log(`  anchorCoverage: ${ts.anchorCoverageBonus}, anchorCrowdPenalty: -${ts.anchorCrowdPenalty}`);
    console.log(`  anchorKeepPenalty: -${ts.anchorKeepPenalty}, runPenalty: -${ts.runPenalty}`);
    console.log(`  spreadPenalty: -${ts.spreadPenalty}, referenceMatch: ${ts.referenceMatchScore}`);
    console.log(`  referenceSoftMatch: ${ts.referenceSoftMatchBonus}`);
    console.log(`  总分: ${ts.score}`);
  }
  console.log("");
  console.log("-".repeat(70));
  console.log("");
}

// ======================== 汇总 ========================
console.log("");
console.log("=".repeat(70));
console.log("汇总指标");
console.log("=".repeat(70));
console.log("");

let top5Count = 0;
let top10Count = 0;
let totalTop5Overlap3to5 = 0;

results.forEach((r, i) => {
  const [targetRow] = cases[i];
  console.log(`第 ${targetRow} 期: 排名 ${r.rank}, 前五=${r.inTop5 ? "✅" : "❌"}, 前十=${r.inTop10 ? "✅" : "❌"}, 重合3-5组数=${r.top5OverlapsMeetThreshold}/5`);
  if (r.inTop5) top5Count++;
  if (r.inTop10) top10Count++;
  totalTop5Overlap3to5 += r.top5OverlapsMeetThreshold;
});

console.log("");
console.log(`目标组进入前五: ${top5Count}/5 (${(top5Count/5*100).toFixed(0)}%)`);
console.log(`目标组进入前十: ${top10Count}/5 (${(top10Count/5*100).toFixed(0)}%)`);
console.log(`前五与目标重合3-5的总组数: ${totalTop5Overlap3to5}/25 (${(totalTop5Overlap3to5/25*100).toFixed(0)}%)`);
console.log("");
console.log("=".repeat(70));
