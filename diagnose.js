// diagnose.js — 分析目标组合 vs Top5 组合的得分差异
// 找出为什么目标组合排名低

const sampleIntervals = [
  { min: 1, max: 5 }, { min: 6, max: 10 }, { min: 11, max: 15 },
  { min: 16, max: 20 }, { min: 21, max: 25 }, { min: 26, max: 30 },
  { min: 31, max: 35 },
];

const sampleAnchorOffsetWeights = new Map([
  [1, 8], [2, 8], [3, 8], [4, 10], [5, 10], [6, 7], [7, 9], [8, 6], [9, 5],
]);

const sampleRuleWeight = 8;
const sampleWeakRuleWeight = 4;

// ============ 工具函数 ============
function getUniqueSortedSampleNumbers(numbers) {
  return [...new Set(numbers)].sort((a, b) => a - b);
}

function buildSampleConsecutiveSegments(numbers) {
  const sorted = getUniqueSortedSampleNumbers(numbers);
  if (sorted.length === 0) return [];
  const segments = [];
  let current = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) { current.push(sorted[i]); }
    else {
      if (current.length >= 2) segments.push([...current]);
      current = [sorted[i]];
    }
  }
  if (current.length >= 2) segments.push([...current]);
  return segments;
}

function countSampleConsecutivePairs(numbers) {
  let pairs = 0, longestRun = 0, currentRun = 0;
  for (let i = 0; i < numbers.length; i++) {
    if (i === 0 || numbers[i] !== numbers[i - 1] + 1) currentRun = 1;
    else { currentRun++; pairs++; }
    longestRun = Math.max(longestRun, currentRun);
  }
  return { pairs, longestRun };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function sampleSignalLevel(v, maxLvl) { return Math.max(0, Math.min(maxLvl, v)); }

function getSampleIntervalIndex(number, intervals = sampleIntervals) {
  return intervals.findIndex((i) => number >= i.min && number <= i.max);
}
function getSampleRatioKey(numbers) {
  const counts = Array(sampleIntervals.length).fill(0);
  numbers.forEach((n) => {
    const idx = getSampleIntervalIndex(n);
    if (idx >= 0) counts[idx]++;
  });
  return counts.join(":");
}

function buildTailNeighborSet(tails) {
  const result = new Set();
  tails.forEach((t) => { result.add((t + 1) % 10); result.add((t + 9) % 10); });
  return result;
}

function buildSampleTailArithmeticProfile(numbers) {
  const sorted = getUniqueSortedSampleNumbers(numbers);
  const tailBuckets = new Map();
  sorted.forEach((n) => {
    const t = n % 10;
    const b = tailBuckets.get(t) || [];
    b.push(n);
    tailBuckets.set(t, b);
  });
  let strongestTail = null, strongestCount = 0;
  tailBuckets.forEach((bucket, tail) => {
    if (bucket.length > strongestCount) { strongestCount = bucket.length; strongestTail = tail; }
  });
  return { strongestTail, strongestCount };
}

// ============ 核心评分函数（与 sample_replay.js 完全一致）============
function evaluateSampleAnchorTransform(numbers, anchorNumbers) {
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
  let anchorTransformScore = 0, anchorOffsetHits = 0, anchorKeepHits = 0, anchorRunSupportHits = 0;

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
    const start = segment[0], end = segment[segment.length - 1];
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
    const supportedCount = segment.filter((n) => {
      if (supportedRunNumbers.has(n)) return true;
      return anchors.some((a) => Math.abs(n - a) <= 3);
    }).length;
    if (supportedCount >= Math.min(2, segment.length)) {
      segment.forEach((n) => { supportedRunNumbers.add(n); explainableNumbers.add(n); });
      anchorTransformScore += segment.length * 8;
      anchorRunSupportHits += supportedCount;
    }
  });

  const explainableCount = explainableNumbers.size;
  const transformedCount = transformedNumbers.size;
  const farOffsetCount = farOffsetNumbers.size;
  const anchorCoverageCount = explainedAnchors.size;

  const explainCoverageBonus = explainableCount >= comboNumbers.length
    ? comboNumbers.length * 14 : explainableCount >= comboNumbers.length - 1
    ? explainableCount * 10 : explainableCount >= 3 ? explainableCount * 6 : explainableCount * 2;

  const transformDiversityBonus = transformedCount >= comboNumbers.length - 1
    ? transformedCount * 16 : transformedCount >= 3 ? transformedCount * 11 : transformedCount * 4;

  const farOffsetBonus = farOffsetCount >= 3 ? farOffsetCount * 14
    : farOffsetCount >= 2 ? farOffsetCount * 10 : farOffsetCount * 3;

  const anchorKeepPenalty = anchorKeepHits >= 2 ? (anchorKeepHits - 1) * 14 : 0;
  const anchorCoverageBonus = anchorCoverageCount >= 4 ? anchorCoverageCount * 12
    : anchorCoverageCount >= 3 ? anchorCoverageCount * 7 : anchorCoverageCount * 2;

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

function getSampleComboRunPenalty(numbers, supportedRunNumbers) {
  const segments = buildSampleConsecutiveSegments(numbers);
  let longestRun = 0, runPenalty = 0, runSegmentCount = 0, doubleRunCount = 0, tripleOrMoreCount = 0;
  segments.forEach((segment) => {
    longestRun = Math.max(longestRun, segment.length);
    runSegmentCount += 1;
    const supportCount = segment.filter((n) => supportedRunNumbers.has(n)).length;
    const supportRatio = segment.length > 0 ? supportCount / segment.length : 0;
    const supportDiscount = supportRatio >= 0.8 ? 0.45 : supportRatio >= 0.6 ? 0.75 : 1;
    if (segment.length === 2) { doubleRunCount++; runPenalty += Math.round(8 * supportDiscount); return; }
    if (segment.length >= 4) { tripleOrMoreCount++; runPenalty += Math.round((70 + (segment.length - 4) * 16) * supportDiscount); return; }
    if (segment.length === 3) { tripleOrMoreCount++; runPenalty += Math.round(36 * supportDiscount); }
  });
  if (doubleRunCount >= 2) runPenalty += (doubleRunCount - 1) * 10;
  return { longestRun, runPenalty, runSegmentCount, doubleRunCount, tripleOrMoreCount };
}

function getSampleComboSpreadMetrics(numbers) {
  const sorted = getUniqueSortedSampleNumbers(numbers);
  const intervals = sampleIntervals;
  if (sorted.length < 2) return { span: 0, spreadPenalty: 0, spreadBonus: 0, maxWindowCount: 0, maxIntervalCount: 0, coveredIntervalCount: 0 };

  const span = sorted[sorted.length - 1] - sorted[0];
  const intervalCounts = intervals.map(() => 0);
  sorted.forEach((n) => {
    const idx = getSampleIntervalIndex(n, intervals);
    if (idx >= 0) intervalCounts[idx]++;
  });
  const coveredIntervalCount = intervalCounts.filter((c) => c > 0).length;
  const maxIntervalCount = Math.max(...intervalCounts);

  let maxWindowCount = 0;
  const denseWindowWidth = 8;
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j < sorted.length && sorted[j] - sorted[i] <= denseWindowWidth) j++;
    maxWindowCount = Math.max(maxWindowCount, j - i);
  }

  let spreadPenalty = 0;
  let spreadBonus = 0;

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

  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j < sorted.length && sorted[j] - sorted[i] <= denseWindowWidth) j++;
    const count = j - i;
    if (coveredIntervalCount >= 3) {
      if (count >= 4) spreadPenalty += 14 + (count - 4) * 8;
      else if (count === 3) spreadPenalty += 4;
    } else if (coveredIntervalCount === 2) {
      if (count >= 4) spreadPenalty += 10 + (count - 4) * 6;
    } else {
      if (count >= 4) spreadPenalty += 8 + (count - 4) * 4;
    }
  }

  if (coveredIntervalCount >= 3) {
    if (maxIntervalCount >= 4) spreadPenalty += 10 + (maxIntervalCount - 4) * 6;
  } else if (coveredIntervalCount === 2) {
    if (maxIntervalCount >= 4) spreadPenalty += 8 + (maxIntervalCount - 4) * 4;
  }

  if (coveredIntervalCount >= 3) {
    const minCount = Math.min(...intervalCounts.filter((c) => c > 0));
    if (minCount >= 1) spreadBonus += 6;
    if (minCount >= 2) spreadBonus += 8;
  }

  return { span, spreadPenalty, spreadBonus, maxWindowCount, maxIntervalCount, coveredIntervalCount };
}

// ============ 参考行匹配（简化版，无算术/桥接）============
function evaluateSampleArithmeticCombo(combo, ref) { return { arithmeticScore: 0, arithmeticPairHits: 0, arithmeticEndpointHits: 0 }; }
function evaluateSampleDifferenceTrend(combo, ref) { return { differenceTrendScore: 0, differenceTrendLongestRun: 0 }; }
function evaluateSampleBridgeCombo(combo, ref) { return { bridgeScore: 0, bridgeGapHits: 0, bridgeEndpointHits: 0, bridgePairHits: 0 }; }

function evaluateSampleComboAgainstReference(numbers, referenceRow) {
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
    ? Math.max(0, 3 - Math.abs(comboPairs - referenceRow.consecutivePairs)) : comboPairs === 0 ? 1 : 0;
  const longestRunSimilarity = referenceRow.longestRun > 1
    ? Math.max(0, 3 - Math.abs(comboLongestRun - referenceRow.longestRun)) : comboLongestRun <= 2 ? 1 : 0;
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
  if (consecutiveSimilarity >= 1 || segSupport >= 1) matchedSignals++;
  return {
    score, matchedSignals, overlap, neighborHits, tailOverlap, tailNeighborOverlap, ratioMatch,
    strongestTailHits, consecutiveSimilarity, longestRunSimilarity, segmentSupport: segSupport,
    arithmeticPairHits: 0, arithmeticScore: 0, bridgeGapHits: 0, bridgeEndpointHits: 0,
    bridgePairHits: 0, bridgeScore: 0, differenceTrendScore: 0, differenceTrendLongestRun: 0,
  };
}

function buildReferenceRow(numbers) {
  const nums = getUniqueSortedSampleNumbers(numbers);
  const { pairs, longestRun } = countSampleConsecutivePairs(nums);
  const segs = buildSampleConsecutiveSegments(nums);
  const tailSet = new Set(nums.map((n) => n % 10));
  return { numbers: nums, numberSet: new Set(nums), tailSet, consecutivePairs: pairs, longestRun, consecutiveSegments: segs, ratioKey: getSampleRatioKey(nums), tailArithmetic: buildSampleTailArithmeticProfile(nums) };
}

function scoreComboFull(comboNumbers, anchorNumbers, referenceRows) {
  const numbers = getUniqueSortedSampleNumbers(comboNumbers);
  const anchorTransform = evaluateSampleAnchorTransform(numbers, anchorNumbers);
  const { runPenalty, longestRun } = getSampleComboRunPenalty(numbers, anchorTransform.supportedRunNumbers);
  const spread = getSampleComboSpreadMetrics(numbers);
  const adjustedSpreadPenalty = anchorTransform.anchorRunSupportHits >= 2
    ? Math.round(spread.spreadPenalty * 0.6) : spread.spreadPenalty;
  const referenceMatches = referenceRows.map((ref) => evaluateSampleComboAgainstReference(numbers, ref));
  const referenceMatchScore = referenceMatches.reduce((sum, m) => sum + (m.score || 0), 0);
  const referenceSatisfiedRows = referenceMatches.filter((m) => (m.matchedSignals || 0) >= 2).length;
  const referenceSoftMatchBonus = referenceSatisfiedRows > 0 ? referenceSatisfiedRows * 6 : 0;
  const score =
    anchorTransform.anchorTransformScore + anchorTransform.explainCoverageBonus +
    anchorTransform.transformDiversityBonus + anchorTransform.farOffsetBonus +
    anchorTransform.anchorCoverageBonus - anchorTransform.anchorCrowdPenalty -
    anchorTransform.anchorKeepPenalty - runPenalty - adjustedSpreadPenalty +
    (spread.spreadBonus || 0) +
    referenceMatchScore + referenceSoftMatchBonus;

  return {
    numbers, score,
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
    runPenalty, spreadPenalty: adjustedSpreadPenalty, longestRun,
    referenceMatchScore, referenceSoftMatchBonus,
  };
}

// ============ 数据 ============
const draws = {
  16: [2, 3, 14, 20, 28],
  17: [2, 9, 14, 20, 31],
  18: [2, 6, 14, 22, 24],
  19: [9, 10, 20, 33, 35],
  20: [6, 7, 18, 21, 30],
};

const targets = {
  19: [4, 11, 12, 13, 25],
  20: [10, 13, 19, 21, 30],
  18: [3, 13, 15, 17, 21],
  17: [3, 15, 20, 29, 31],
  16: [7, 15, 20, 24, 29],
};

// ============ 诊断：打印目标组合的详细得分 ============
for (const [row, targetNums] of Object.entries(targets)) {
  const rowNum = parseInt(row);
  const anchor = draws[rowNum] || [];
  const refRows = Array.from({ length: 5 }, (_, i) => rowNum + 1 + i)
    .filter((r) => draws[r])
    .map((r) => buildReferenceRow(draws[r]));

  const result = scoreComboFull(targetNums, anchor, refRows);

  console.log(`\n======== 第 ${rowNum} 期 ========`);
  console.log(`锚点: [${anchor.join(", ")}]`);
  console.log(`目标: [${getUniqueSortedSampleNumbers(targetNums).join(", ")}]`);
  console.log(`--- 得分分解 ---`);
  console.log(`  anchorTransformScore:    ${result.anchorTransformScore}`);
  console.log(`  explainCoverageBonus:    ${result.explainCoverageBonus}`);
  console.log(`  transformDiversityBonus: ${result.transformDiversityBonus}`);
  console.log(`  farOffsetBonus:          ${result.farOffsetBonus}`);
  console.log(`  anchorCoverageBonus:     ${result.anchorCoverageBonus}`);
  console.log(`  anchorCrowdPenalty:      -${result.anchorCrowdPenalty}`);
  console.log(`  anchorKeepPenalty:       -${result.anchorKeepPenalty}`);
  console.log(`  runPenalty:              -${result.runPenalty}`);
  console.log(`  spreadPenalty:           -${result.spreadPenalty}`);
  console.log(`  referenceMatchScore:     ${result.referenceMatchScore}`);
  console.log(`  referenceSoftMatchBonus: ${result.referenceSoftMatchBonus}`);
  console.log(`  【总分】: ${result.score}`);
  console.log(`  explainableCount: ${result.explainableCount}/5`);
  console.log(`  anchorKeepHits: ${result.anchorKeepHits}`);
  console.log(`  anchorRunSupportHits: ${result.anchorRunSupportHits}`);
  console.log(`  transformedCount: ${result.transformedCount}`);
  console.log(`  farOffsetCount: ${result.farOffsetCount}`);
  console.log(`  anchorCoverageCount: ${result.anchorCoverageCount}`);
  console.log(`  longestRun: ${result.longestRun}`);
}

// ============ 打印每期 Top5 的得分 ============
console.log(`\n\n======== Top5 得分（22号池）========`);
function combinations(arr, pick) {
  const out = [];
  function helper(start, stack) {
    if (stack.length === pick) { out.push([...stack]); return; }
    for (let i = start; i <= arr.length - (pick - stack.length); i++) { stack.push(arr[i]); helper(i + 1, stack); stack.pop(); }
  }
  helper(0, []);
  return out;
}

for (const [row, targetNums] of Object.entries(targets)) {
  const rowNum = parseInt(row);
  const anchor = draws[rowNum] || [];
  const refRows = Array.from({ length: 5 }, (_, i) => rowNum + 1 + i)
    .filter((r) => draws[r])
    .map((r) => buildReferenceRow(draws[r]));
  const targetKey = getUniqueSortedSampleNumbers(targetNums).join(",");

  // 22号池
  const singleScores = Array.from({ length: 35 }, (_, i) => i + 1)
    .map((n) => ({ number: n, score: evaluateSampleAnchorTransform([n], anchor).anchorTransformScore + evaluateSampleAnchorTransform([n], anchor).transformedCount * 14 + evaluateSampleAnchorTransform([n], anchor).farOffsetBonus }))
    .sort((a, b) => b.score - a.score);
  const poolSet = new Set();
  getUniqueSortedSampleNumbers(targetNums).forEach((n) => poolSet.add(n));
  for (const s of singleScores) { if (poolSet.size >= 22) break; poolSet.add(s.number); }
  const sortedPool = [...poolSet].sort((a, b) => a - b);

  const all = combinations(sortedPool, 5)
    .map((combo) => scoreComboFull(combo, anchor, refRows))
    .sort((a, b) => b.score - a.score);

  const rank = all.findIndex((item) => item.numbers.join(",") === targetKey) + 1;
  console.log(`\n--- 第 ${rowNum} 期 (目标排名: ${rank}/${all.length}) ---`);
  console.log(`锚点: [${anchor.join(", ")}] | 目标: [${getUniqueSortedSampleNumbers(targetNums).join(", ")}]`);
  all.slice(0, 5).forEach((c, i) => {
    const isTarget = c.numbers.join(",") === targetKey;
    console.log(`  #${i + 1}: [${c.numbers.join(", ")}] = ${c.score} ${isTarget ? "★目标★" : ""}`);
  });
  // 如果目标不在前五
  if (rank > 5 && rank > 0) {
    console.log(`  ...`);
    console.log(`  #${rank}: [${all[rank - 1].numbers.join(", ")}] = ${all[rank - 1].score} ★目标★`);
  }
}

// ============ 关键差异分析 ============
console.log(`\n\n======== 关键差异分析 ========`);
for (const [row, targetNums] of Object.entries(targets)) {
  const rowNum = parseInt(row);
  const anchor = draws[rowNum] || [];
  const refRows = Array.from({ length: 5 }, (_, i) => rowNum + 1 + i)
    .filter((r) => draws[r])
    .map((r) => buildReferenceRow(draws[r]));
  const targetKey = getUniqueSortedSampleNumbers(targetNums).join(",");

  const singleScores = Array.from({ length: 35 }, (_, i) => i + 1)
    .map((n) => ({ number: n, score: evaluateSampleAnchorTransform([n], anchor).anchorTransformScore + evaluateSampleAnchorTransform([n], anchor).transformedCount * 14 + evaluateSampleAnchorTransform([n], anchor).farOffsetBonus }))
    .sort((a, b) => b.score - a.score);
  const poolSet = new Set();
  getUniqueSortedSampleNumbers(targetNums).forEach((n) => poolSet.add(n));
  for (const s of singleScores) { if (poolSet.size >= 22) break; poolSet.add(s.number); }
  const sortedPool = [...poolSet].sort((a, b) => a - b);

  const all = combinations(sortedPool, 5)
    .map((combo) => scoreComboFull(combo, anchor, refRows))
    .sort((a, b) => b.score - a.score);

  const targetResult = all.find((item) => item.numbers.join(",") === targetKey);
  const top5 = all.slice(0, 5);

  // 统计 top5 中各维度均值 vs target
  console.log(`\n--- 第 ${rowNum} 期 Top5均值 vs 目标 ---`);
  const dims = [
    "anchorTransformScore", "explainCoverageBonus", "transformDiversityBonus", "farOffsetBonus",
    "anchorCoverageBonus", "anchorCrowdPenalty", "anchorKeepPenalty", "runPenalty", "spreadPenalty",
    "referenceMatchScore", "referenceSoftMatchBonus",
  ];
  dims.forEach((dim) => {
    const avg = top5.reduce((s, c) => s + (c[dim] || 0), 0) / top5.length;
    const tv = targetResult?.[dim] || 0;
    const diff = tv - avg;
    const flag = dim.includes("Penalty") ? (diff < 0 ? "✓惩罚更低" : "✗惩罚更高") : (diff > 0 ? "✓更高" : diff < 0 ? "✗更低" : "≈持平");
    console.log(`  ${dim.padEnd(25)}: avg=${avg.toFixed(1)}, target=${tv}, diff=${diff.toFixed(1)} ${flag}`);
  });
}
