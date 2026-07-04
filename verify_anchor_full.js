// 修正版：包含完整的 supportedRunNumbers 逻辑
const draws = {
  1: [7,12,13,28,32], 2: [8,17,21,33,35], 3: [9,11,20,26,27],
  4: [6,12,13,21,34], 5: [24,25,27,29,34], 6: [2,7,13,19,24],
  7: [8,12,14,19,22], 8: [3,8,22,26,29], 9: [1,15,21,26,33],
  10: [1,13,18,27,33], 11: [9,20,21,23,28], 12: [11,17,20,23,35],
  13: [1,6,14,15,17], 14: [6,10,14,23,33], 15: [13,18,28,32,33],
  16: [2,3,14,20,28], 17: [2,9,14,20,31], 18: [2,6,14,22,24],
  19: [9,10,20,33,35], 20: [6,7,18,21,30], 21: [23,25,26,27,34],
  22: [7,12,13,18,34], 23: [6,13,17,19,26], 24: [22,28,30,31,34],
  25: [10,12,15,26,35], 26: [7,15,20,24,29], 27: [3,15,20,29,31],
  28: [3,13,15,17,21], 29: [4,11,12,13,25], 30: [10,13,19,21,30],
};
const anchor19 = draws[19]; // [9,10,20,33,35]
const target19 = [4,11,12,13,25];
const offsetWeights = new Map([[1,6],[2,6],[3,6],[4,7],[5,7],[6,5],[7,6],[8,4],[9,3],[10,2]]);

function combos(arr, pick) {
  const out=[];
  (function h(s,st){if(st.length===pick){out.push([...st]);return;}for(let i=s;i<=arr.length-(pick-st.length);i++){st.push(arr[i]);h(i+1,st);st.pop();}})(0,[]);
  return out;
}

function consecutiveSegments(arr) {
  if (!arr.length) return [];
  const sorted = [...arr].sort((a,b)=>a-b);
  const segs = [];
  let seg = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i-1] + 1) seg.push(sorted[i]);
    else { if (seg.length >= 2) segs.push(seg); seg = [sorted[i]]; }
  }
  if (seg.length >= 2) segs.push(seg);
  return segs;
}

// 完整复刻 evaluateSampleAnchorTransform（包含 supportedRunNumbers）
function fullAnchorTransform(comboNumbers, anchors) {
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

  // 1. 锚点直接命中+偏移评分
  comboNumbers.forEach((number) => {
    if (anchorSet.has(number)) {
      anchorKeepHits += 1;
      anchorTransformScore += 6;
      explainableNumbers.add(number);
      explainedAnchors.set(number, (explainedAnchors.get(number) || 0) + 1);
      return;
    }
    anchors.forEach((anchor) => {
      const diff = Math.abs(number - anchor);
      const offsetScore = offsetWeights.get(diff) || 0;
      if (offsetScore <= 0) return;
      anchorOffsetHits += 1;
      anchorTransformScore += offsetScore;
      explainableNumbers.add(number);
      explainedAnchors.set(anchor, (explainedAnchors.get(anchor) || 0) + 1);
      if (!anchorSet.has(number)) transformedNumbers.add(number);
      if (diff >= 4 || diff === 7) farOffsetNumbers.add(number);
    });
  });

  // 2. 锚点连号延伸支持
  consecutiveSegments(anchors).forEach((segment) => {
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

  // 3. 组合自身连号段支持
  consecutiveSegments(comboNumbers).forEach((segment) => {
    const supportedCount = segment.filter((number) => {
      if (supportedRunNumbers.has(number)) return true;
      return anchors.some((anchor) => Math.abs(number - anchor) <= 3);
    }).length;
    if (supportedCount >= Math.min(2, segment.length)) {
      segment.forEach((number) => supportedRunNumbers.add(number));
      segment.forEach((number) => explainableNumbers.add(number));
      anchorTransformScore += segment.length * 8;
      anchorRunSupportHits += supportedCount;
    }
  });

  // 计算各种 bonus/penalty
  const explainableCount = explainableNumbers.size;
  const transformedCount = transformedNumbers.size;
  const farOffsetCount = farOffsetNumbers.size;
  const anchorCoverageCount = new Set(explainedAnchors.keys()).size;

  const explainCoverageBonus = explainableCount >= comboNumbers.length - 1
    ? explainableCount * 6 : explainableCount >= 3 ? explainableCount * 4 : explainableCount * 2;
  const transformDiversityBonus = transformedCount >= comboNumbers.length - 1
    ? transformedCount * 16 : transformedCount >= 3 ? transformedCount * 11 : transformedCount * 4;
  const farOffsetBonus = farOffsetCount >= 3 ? farOffsetCount * 14
    : farOffsetCount >= 2 ? farOffsetCount * 10 : farOffsetCount * 3;
  const anchorKeepPenalty = anchorKeepHits >= 2 ? (anchorKeepHits - 1) * 14 : 0;
  const anchorCoverageBonus = anchorCoverageCount >= 4 ? anchorCoverageCount * 12
    : anchorCoverageCount >= 3 ? anchorCoverageCount * 7 : anchorCoverageCount * 2;
  const maxAnchorLoad = explainedAnchors.size > 0 ? Math.max(...explainedAnchors.values()) : 0;
  const anchorCrowdPenalty = maxAnchorLoad >= 3 ? (maxAnchorLoad - 2) * 12 : 0;

  // 连号惩罚（带 supportDiscount）
  let runPenalty = 0;
  consecutiveSegments(comboNumbers).forEach((segment) => {
    const supportCount = segment.filter((number) => supportedRunNumbers.has(number)).length;
    const supportRatio = segment.length > 0 ? supportCount / segment.length : 0;
    const supportDiscount = supportRatio >= 0.8 ? 0.45 : supportRatio >= 0.6 ? 0.75 : 1;
    if (segment.length === 2) runPenalty += Math.round(8 * supportDiscount);
    else if (segment.length === 3) runPenalty += Math.round(36 * supportDiscount);
    else if (segment.length >= 4) runPenalty += Math.round((70 + (segment.length - 4) * 16) * supportDiscount);
  });

  let doubleRunCount = 0;
  consecutiveSegments(comboNumbers).forEach(s => { if (s.length === 2) doubleRunCount++; });
  if (doubleRunCount >= 2) runPenalty += (doubleRunCount - 1) * 6;

  // 跨度惩罚
  const span = comboNumbers[4] - comboNumbers[0];
  let coveredIntervals = 0;
  const intervals = [{min:1,max:12},{min:13,max:24},{min:25,max:35}];
  intervals.forEach(iv => { if (comboNumbers.some(n => n >= iv.min && n <= iv.max)) coveredIntervals++; });
  let spreadPenalty = 0;
  if (coveredIntervals >= 3) {
    if (span <= 18) spreadPenalty += 2; if (span <= 16) spreadPenalty += 6;
    if (span <= 13) spreadPenalty += 10; if (span <= 10) spreadPenalty += 16;
  } else if (coveredIntervals === 2) {
    if (span <= 12) spreadPenalty += 3; if (span <= 10) spreadPenalty += 7;
    if (span <= 8) spreadPenalty += 12; if (span <= 6) spreadPenalty += 16;
  } else {
    if (span <= 7) spreadPenalty += 2; if (span <= 5) spreadPenalty += 6; if (span <= 3) spreadPenalty += 10;
  }
  intervals.forEach(iv => {
    const count = comboNumbers.filter(n => n >= iv.min && n <= iv.max).length;
    if (coveredIntervals >= 3) {
      if (count >= 4) spreadPenalty += 14 + (count-4)*8; else if (count === 3) spreadPenalty += 4;
    } else if (coveredIntervals === 2) {
      if (count >= 4) spreadPenalty += 10 + (count-4)*6;
    } else { if (count >= 4) spreadPenalty += 8 + (count-4)*4; }
  });
  const maxIntervalCount = Math.max(...intervals.map(iv => comboNumbers.filter(n => n>=iv.min && n<=iv.max).length));
  if (coveredIntervals >= 3) { if (maxIntervalCount >= 4) spreadPenalty += 10 + (maxIntervalCount-4)*6; }
  else if (coveredIntervals === 2) { if (maxIntervalCount >= 4) spreadPenalty += 8 + (maxIntervalCount-4)*4; }

  const finalScore = anchorTransformScore + explainCoverageBonus + transformDiversityBonus
    + farOffsetBonus + anchorCoverageBonus - anchorCrowdPenalty - anchorKeepPenalty - runPenalty - spreadPenalty;

  return {
    anchorTransformScore, explainCoverageBonus, transformDiversityBonus, farOffsetBonus,
    anchorCoverageBonus, anchorCrowdPenalty, anchorKeepPenalty, runPenalty, spreadPenalty, finalScore,
    explainableCount, transformedCount, farOffsetCount, anchorCoverageCount,
    maxAnchorLoad, keepHits: anchorKeepHits,
    supportedRunNumbers: [...supportedRunNumbers],
    supportDiscountForRun: consecutiveSegments(comboNumbers).map(seg => {
      const sc = seg.filter(n => supportedRunNumbers.has(n)).length;
      const sr = seg.length > 0 ? sc / seg.length : 0;
      return { seg, supportedCount: sc, supportRatio: sr, discount: sr >= 0.8 ? 0.45 : sr >= 0.6 ? 0.75 : 1 };
    }),
  };
}

console.log('=== 完整评分分解（含 supportedRunNumbers） ===\n');
const result = fullAnchorTransform(target19, anchor19);
console.log(JSON.stringify(result, null, 2));
console.log('\n目标最终评分: ' + result.finalScore);

// 全量排名
console.log('\n=== 全量排名 ===');
let allCombos = combos([...Array(35).keys()].map(x=>x+1), 5);
let comboScores = allCombos.map(c => ({combo: c, score: fullAnchorTransform(c, anchor19).finalScore}));
comboScores.sort((a,b) => b.score - a.score);

let targetIdx = comboScores.findIndex(c => JSON.stringify(c.combo) === JSON.stringify(target19));
console.log('目标排名: ' + (targetIdx+1) + '/' + comboScores.length + ' (前' + ((targetIdx+1)/comboScores.length*100).toFixed(2) + '%)');
console.log('第一名: ' + JSON.stringify(comboScores[0].combo) + ' 评分=' + comboScores[0].score);

// 前100重合
let maxOv = 0;
comboScores.slice(0,100).forEach((c,i) => {
  let ov = c.combo.filter(n => target19.includes(n)).length;
  if (ov > maxOv) maxOv = ov;
});
console.log('前100最高重合: ' + maxOv + '个');
