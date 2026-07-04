// 最终验证：对比原始 vs 优化后的 script.js 效果
const sampleAnchorOffsetWeights = new Map([
  [1, 8], [2, 8], [3, 8],
  [4, 11], [5, 12], [6, 6],
  [7, 11], [8, 5], [9, 4], [10, 3],
]);

function buildSampleConsecutiveSegments(numbers = []) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const segments = [];
  let current = [];
  sorted.forEach((n, i) => {
    if (i === 0 || n === sorted[i - 1] + 1) { current.push(n); }
    else { if (current.length >= 2) segments.push([...current]); current = [n]; }
  });
  if (current.length >= 2) segments.push([...current]);
  return segments;
}

// === 最终优化版 ===
function evaluateOptimized(numbers, anchors) {
  const comboNumbers = [...new Set(numbers)].sort((a, b) => a - b);
  const anchorSorted = [...new Set(anchors)].sort((a, b) => a - b);
  const anchorSet = new Set(anchorSorted);
  const supportedRunNumbers = new Set();
  const explainableNumbers = new Set();
  const explainedAnchors = new Map();
  const transformedNumbers = new Set();
  const farOffsetNumbers = new Set();
  let anchorTransformScore = 0, anchorKeepHits = 0, anchorRunSupportHits = 0;

  comboNumbers.forEach((number) => {
    if (anchorSet.has(number)) { anchorKeepHits += 1; anchorTransformScore += 6; explainableNumbers.add(number); explainedAnchors.set(number, (explainedAnchors.get(number) || 0) + 1); }
    anchorSorted.forEach((anchor) => {
      const diff = Math.abs(number - anchor);
      const offsetScore = sampleAnchorOffsetWeights.get(diff) || 0;
      if (offsetScore <= 0) return;
      anchorTransformScore += offsetScore; explainableNumbers.add(number);
      explainedAnchors.set(anchor, (explainedAnchors.get(anchor) || 0) + 1);
      if (!anchorSet.has(number)) transformedNumbers.add(number);
      if (diff >= 4 || diff === 7) farOffsetNumbers.add(number);
    });
  });

  buildSampleConsecutiveSegments(anchorSorted).forEach((segment) => {
    const start = segment[0], end = segment[segment.length - 1];
    comboNumbers.forEach((number) => {
      const extendsRun = number >= start - 4 && number <= end + 4 && !anchorSet.has(number);
      if (!extendsRun) return;
      const distance = number < start ? start - number : number - end;
      if (distance < 1 || distance > 4) return;
      anchorRunSupportHits += 1; anchorTransformScore += 16 - distance * 2;
      supportedRunNumbers.add(number); explainableNumbers.add(number);
    });
  });

  buildSampleConsecutiveSegments(comboNumbers).forEach((segment) => {
    const supportedCount = segment.filter((number) => {
      if (supportedRunNumbers.has(number)) return true;
      return anchorSorted.some((anchor) => Math.abs(number - anchor) <= 3);
    }).length;
    if (supportedCount >= Math.min(2, segment.length)) {
      segment.forEach((number) => supportedRunNumbers.add(number));
      segment.forEach((number) => explainableNumbers.add(number));
      anchorTransformScore += segment.length * 8; anchorRunSupportHits += supportedCount;
    }
  });

  const explainableCount = explainableNumbers.size;
  const transformedCount = transformedNumbers.size;
  const farOffsetCount = farOffsetNumbers.size;
  const anchorCoverageCount = explainedAnchors.size;

  const explainCoverageBonus = explainableCount >= comboNumbers.length ? comboNumbers.length * 14
    : explainableCount >= comboNumbers.length - 1 ? explainableCount * 10
    : explainableCount >= 3 ? explainableCount * 6 : explainableCount * 2;
  const transformDiversityBonus = transformedCount >= comboNumbers.length - 1 ? transformedCount * 16
    : transformedCount >= 3 ? transformedCount * 11 : transformedCount * 4;
  const farOffsetBonus = farOffsetCount >= 3 ? farOffsetCount * 14
    : farOffsetCount >= 2 ? farOffsetCount * 10 : farOffsetCount * 3;

  const anchorKeepPenalty = anchorKeepHits >= 4 ? (anchorKeepHits - 3) * 14 : 0;
  const anchorKeepBonus = anchorKeepHits >= 2 && anchorKeepHits <= 3 ? (anchorKeepHits - 1) * 14 : 0;
  const anchorCoverageBonus = anchorCoverageCount >= 4 ? anchorCoverageCount * 12
    : anchorCoverageCount >= 3 ? anchorCoverageCount * 7 : anchorCoverageCount * 2;

  // V3 智能拥挤惩罚
  const maxAnchorLoad = explainedAnchors.size > 0 ? Math.max(...explainedAnchors.values()) : 0;
  const loads = [...explainedAnchors.values()];
  const overloadedAnchors = loads.filter(l => l >= 3).length;
  const totalAnchors = anchorSorted.length;
  let crowdDiscount = 1.0;
  if (overloadedAnchors <= Math.ceil(totalAnchors * 0.4) && maxAnchorLoad <= 5) {
    crowdDiscount = 0.5;
  }
  const anchorCrowdPenalty = maxAnchorLoad >= 4
    ? Math.round((maxAnchorLoad - 3) * 12 * crowdDiscount)
    : (maxAnchorLoad >= 3 && overloadedAnchors >= Math.ceil(totalAnchors * 0.6)
      ? Math.round((maxAnchorLoad - 2) * 12 * 0.7) : 0);

  const runSegments = buildSampleConsecutiveSegments(comboNumbers);
  let runPenalty = 0, doubleRunCount = 0;
  runSegments.forEach((seg) => {
    const supportCount = seg.filter(n => supportedRunNumbers.has(n)).length;
    const supportRatio = seg.length > 0 ? supportCount / seg.length : 0;
    const supportDiscount = supportRatio >= 0.8 ? 0.45 : supportRatio >= 0.6 ? 0.75 : 1;
    if (seg.length === 2) { doubleRunCount += 1; runPenalty += Math.round(8 * supportDiscount); }
    else if (seg.length >= 4) runPenalty += Math.round((70 + (seg.length - 4) * 16) * supportDiscount);
    else if (seg.length === 3) runPenalty += Math.round(36 * supportDiscount);
  });
  if (doubleRunCount >= 2) runPenalty += (doubleRunCount - 1) * 6;

  const totalScore = anchorTransformScore + explainCoverageBonus + transformDiversityBonus
    + farOffsetBonus + anchorCoverageBonus + anchorKeepBonus
    - anchorCrowdPenalty - anchorKeepPenalty - runPenalty;

  return { totalScore, anchorKeepBonus, anchorKeepPenalty, anchorCrowdPenalty, maxAnchorLoad, crowdDiscount };
}

// === 原始版 ===
function evaluateOriginal(numbers, anchors) {
  const comboNumbers = [...new Set(numbers)].sort((a, b) => a - b);
  const anchorSorted = [...new Set(anchors)].sort((a, b) => a - b);
  const anchorSet = new Set(anchorSorted);
  const supportedRunNumbers = new Set();
  const explainableNumbers = new Set();
  const explainedAnchors = new Map();
  const transformedNumbers = new Set();
  const farOffsetNumbers = new Set();
  let anchorTransformScore = 0, anchorKeepHits = 0, anchorRunSupportHits = 0;

  comboNumbers.forEach((number) => {
    if (anchorSet.has(number)) { anchorKeepHits += 1; anchorTransformScore += 6; explainableNumbers.add(number); explainedAnchors.set(number, (explainedAnchors.get(number) || 0) + 1); }
    anchorSorted.forEach((anchor) => {
      const diff = Math.abs(number - anchor);
      const offsetScore = sampleAnchorOffsetWeights.get(diff) || 0;
      if (offsetScore <= 0) return;
      anchorTransformScore += offsetScore; explainableNumbers.add(number);
      explainedAnchors.set(anchor, (explainedAnchors.get(anchor) || 0) + 1);
      if (!anchorSet.has(number)) transformedNumbers.add(number);
      if (diff >= 4 || diff === 7) farOffsetNumbers.add(number);
    });
  });

  buildSampleConsecutiveSegments(anchorSorted).forEach((segment) => {
    const start = segment[0], end = segment[segment.length - 1];
    comboNumbers.forEach((number) => {
      const extendsRun = number >= start - 4 && number <= end + 4 && !anchorSet.has(number);
      if (!extendsRun) return;
      const distance = number < start ? start - number : number - end;
      if (distance < 1 || distance > 4) return;
      anchorRunSupportHits += 1; anchorTransformScore += 16 - distance * 2;
      supportedRunNumbers.add(number); explainableNumbers.add(number);
    });
  });

  buildSampleConsecutiveSegments(comboNumbers).forEach((segment) => {
    const supportedCount = segment.filter((number) => {
      if (supportedRunNumbers.has(number)) return true;
      return anchorSorted.some((anchor) => Math.abs(number - anchor) <= 3);
    }).length;
    if (supportedCount >= Math.min(2, segment.length)) {
      segment.forEach((number) => supportedRunNumbers.add(number));
      segment.forEach((number) => explainableNumbers.add(number));
      anchorTransformScore += segment.length * 8; anchorRunSupportHits += supportedCount;
    }
  });

  const explainableCount = explainableNumbers.size;
  const transformedCount = transformedNumbers.size;
  const farOffsetCount = farOffsetNumbers.size;
  const anchorCoverageCount = explainedAnchors.size;

  const explainCoverageBonus = explainableCount >= comboNumbers.length ? comboNumbers.length * 14
    : explainableCount >= comboNumbers.length - 1 ? explainableCount * 10
    : explainableCount >= 3 ? explainableCount * 6 : explainableCount * 2;
  const transformDiversityBonus = transformedCount >= comboNumbers.length - 1 ? transformedCount * 16
    : transformedCount >= 3 ? transformedCount * 11 : transformedCount * 4;
  const farOffsetBonus = farOffsetCount >= 3 ? farOffsetCount * 14
    : farOffsetCount >= 2 ? farOffsetCount * 10 : farOffsetCount * 3;

  const anchorKeepPenalty = anchorKeepHits >= 2 ? (anchorKeepHits - 1) * 14 : 0;
  const anchorCoverageBonus = anchorCoverageCount >= 4 ? anchorCoverageCount * 12
    : anchorCoverageCount >= 3 ? anchorCoverageCount * 7 : anchorCoverageCount * 2;
  const maxAnchorLoad = explainedAnchors.size > 0 ? Math.max(...explainedAnchors.values()) : 0;
  const anchorCrowdPenalty = maxAnchorLoad >= 3 ? (maxAnchorLoad - 2) * 12 : 0;

  const runSegments = buildSampleConsecutiveSegments(comboNumbers);
  let runPenalty = 0, doubleRunCount = 0;
  runSegments.forEach((seg) => {
    const supportCount = seg.filter(n => supportedRunNumbers.has(n)).length;
    const supportRatio = seg.length > 0 ? supportCount / seg.length : 0;
    const supportDiscount = supportRatio >= 0.8 ? 0.45 : supportRatio >= 0.6 ? 0.75 : 1;
    if (seg.length === 2) { doubleRunCount += 1; runPenalty += Math.round(8 * supportDiscount); }
    else if (seg.length >= 4) runPenalty += Math.round((70 + (seg.length - 4) * 16) * supportDiscount);
    else if (seg.length === 3) runPenalty += Math.round(36 * supportDiscount);
  });
  if (doubleRunCount >= 2) runPenalty += (doubleRunCount - 1) * 6;

  const totalScore = anchorTransformScore + explainCoverageBonus + transformDiversityBonus
    + farOffsetBonus + anchorCoverageBonus - anchorCrowdPenalty - anchorKeepPenalty - runPenalty;
  return { totalScore };
}

function generateCombos(anchors) {
  const allNums = new Set();
  anchors.forEach(anchor => {
    anchor.forEach(n => {
      for (let d = -8; d <= 8; d++) {
        const v = n + d; if (v >= 1 && v <= 35) allNums.add(v);
      }
    });
  });
  const pool = [...allNums].sort((a, b) => a - b);
  const combos = [];
  for (let i = 0; i < pool.length - 4; i++)
    for (let j = i + 1; j < pool.length - 3; j++)
      for (let k = j + 1; k < pool.length - 2; k++)
        for (let l = k + 1; l < pool.length - 1; l++)
          for (let m = l + 1; m < pool.length; m++)
            combos.push([pool[i], pool[j], pool[k], pool[l], pool[m]]);
  return combos;
}

const testCases = [
  { name: "第19期", anchors: [[9,10,20,33,35],[2,6,14,22,24],[2,9,14,20,31]], target: [4,11,12,13,25] },
  { name: "第20期", anchors: [[9,10,20,33,35],[6,7,18,21,30]], target: [10,13,19,21,30] },
];

console.log("╔══════════════════════════════════════════════════════════════════════════╗");
console.log("║                     最终优化验证报告                                    ║");
console.log("╚══════════════════════════════════════════════════════════════════════════╝");

testCases.forEach(({ name, anchors, target }) => {
  const allCombos = generateCombos(anchors);
  const targetStr = JSON.stringify(target);
  const total = allCombos.length;

  // 原始排名
  const origScored = allCombos.map(c => {
    let best = -Infinity;
    anchors.forEach(a => { const r = evaluateOriginal(c, a); if (r.totalScore > best) best = r.totalScore; });
    return { combo: c, score: best };
  });
  origScored.sort((a, b) => b.score - a.score);
  const origRank = origScored.findIndex(c => JSON.stringify(c.combo) === targetStr) + 1;

  // 优化排名
  const optScored = allCombos.map(c => {
    let best = -Infinity;
    anchors.forEach(a => { const r = evaluateOptimized(c, a); if (r.totalScore > best) best = r.totalScore; });
    return { combo: c, score: best };
  });
  optScored.sort((a, b) => b.score - a.score);
  const optRank = optScored.findIndex(c => JSON.stringify(c.combo) === targetStr) + 1;

  console.log(`\n┌── ${name} ─────────────────────────────────────────────────────┐`);
  console.log(`│ 目标: ${JSON.stringify(target)}`);
  console.log(`│ 锚点行数: ${anchors.length}`);
  console.log(`│ 候选组合数: ${total.toLocaleString()}`);
  console.log(`│`);
  console.log(`│ 原始排名: #${origRank.toLocaleString()}/${total.toLocaleString()} (前 ${(origRank/total*100).toFixed(3)}%)`);
  console.log(`│ 优化排名: #${optRank.toLocaleString()}/${total.toLocaleString()} (前 ${(optRank/total*100).toFixed(3)}%)`);
  const delta = origRank - optRank;
  const pctImprove = (delta / origRank * 100).toFixed(1);
  console.log(`│ 📈 提升: ${delta > 0 ? '+' : ''}${delta.toLocaleString()} 名 (${pctImprove > 0 ? '+' : ''}${pctImprove}%)`);

  // Top100命中
  const origTop100 = origScored.slice(0, 100);
  const optTop100 = optScored.slice(0, 100);
  const origTop100Hit = origTop100.some(c => JSON.stringify(c.combo) === targetStr);
  const optTop100Hit = optTop100.some(c => JSON.stringify(c.combo) === targetStr);

  let origOverlap = 0, optOverlap = 0;
  origTop100.forEach(c => c.combo.forEach(n => { if (target.includes(n)) origOverlap++; }));
  optTop100.forEach(c => c.combo.forEach(n => { if (target.includes(n)) optOverlap++; }));

  console.log(`│`);
  console.log(`│ Top100命中: ${origTop100Hit ? '原始✅' : '原始❌'} → ${optTop100Hit ? '优化✅' : '优化❌'}`);
  console.log(`│ Top100目标号码重合: ${origOverlap}个 → ${optOverlap}个`);
  console.log(`└──────────────────────────────────────────────────────────────┘`);
});

console.log(`\n╔══════════════════════════════════════════════════════════════════════════╗`);
console.log(`║  优化内容总结 (已应用到 script.js)                                     ║`);
console.log(`╠══════════════════════════════════════════════════════════════════════════╣`);
console.log(`║  1. 保留惩罚 → 奖励机制                                                ║`);
console.log(`║     keepHits=1: 无变化                                                 ║`);
console.log(`║     keepHits=2: +14 奖励 (原来-14惩罚)                                 ║`);
console.log(`║     keepHits=3: +28 奖励 (原来-28惩罚)                                 ║`);
console.log(`║     keepHits≥4: 每个超出3的-14惩罚                                     ║`);
console.log(`║                                                                        ║`);
console.log(`║  2. 智能拥挤惩罚折扣                                                   ║`);
console.log(`║     阈值从3→4 (maxAnchorLoad≥4才触发)                                  ║`);
console.log(`║     集中度折扣: ≤40%锚点超载+maxLoad≤5 → 惩罚打5折                    ║`);
console.log(`║     大量锚点超载(≥60%)且maxLoad=3 → 打7折轻度惩罚                     ║`);
console.log(`╚══════════════════════════════════════════════════════════════════════════╝`);
