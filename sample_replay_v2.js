// sample_replay_v2.js — 策略V2：基于历史频率+多锚点投票+冷热分析的评分模型
// 彻底改变评分哲学：不再用锚点偏移评分，改用概率视角

const draws = {
  1: [7, 12, 13, 28, 32], 2: [8, 17, 21, 33, 35], 3: [9, 11, 20, 26, 27],
  4: [6, 12, 13, 21, 34], 5: [24, 25, 27, 29, 34], 6: [2, 7, 13, 19, 24],
  7: [8, 12, 14, 19, 22], 8: [3, 8, 22, 26, 29], 9: [1, 15, 21, 26, 33],
  10: [1, 13, 18, 27, 33], 11: [9, 20, 21, 23, 28], 12: [11, 17, 20, 23, 35],
  13: [1, 6, 14, 15, 17], 14: [6, 10, 14, 23, 33], 15: [13, 18, 28, 32, 33],
  16: [2, 3, 14, 20, 28], 17: [2, 9, 14, 20, 31], 18: [2, 6, 14, 22, 24],
  19: [9, 10, 20, 33, 35], 20: [6, 7, 18, 21, 30], 21: [23, 25, 26, 27, 34],
  22: [7, 12, 13, 18, 34], 23: [6, 13, 17, 19, 26], 24: [22, 28, 30, 31, 34],
  25: [10, 12, 15, 26, 35], 26: [7, 15, 20, 24, 29], 27: [3, 15, 20, 29, 31],
  28: [3, 13, 15, 17, 21], 29: [4, 11, 12, 13, 25], 30: [10, 13, 19, 21, 30],
  31: [4, 7, 16, 26, 32], 32: [2, 22, 30, 33, 34], 33: [11, 12, 25, 26, 27],
  34: [3, 5, 7, 9, 18], 35: [3, 4, 19, 26, 32], 36: [6, 8, 22, 29, 34],
  37: [2, 13, 22, 28, 34], 38: [3, 5, 17, 33, 35], 39: [15, 27, 29, 30, 34],
  40: [9, 10, 11, 12, 16], 41: [10, 11, 22, 26, 32], 42: [3, 15, 24, 28, 29],
  43: [2, 4, 8, 10, 21], 44: [9, 25, 26, 27, 28], 45: [1, 3, 6, 19, 22],
  46: [3, 5, 9, 21, 23], 47: [12, 13, 20, 26, 31], 48: [8, 20, 26, 27, 29],
  49: [9, 11, 19, 30, 35], 50: [4, 5, 10, 23, 31],
};

const intervals = [
  { min: 1, max: 12 }, { min: 13, max: 24 }, { min: 25, max: 35 },
];

// ============ 工具函数 ============
function uniqueSorted(nums) {
  return [...new Set(nums)].sort((a, b) => a - b);
}
function combos(arr, pick) {
  const out = [];
  (function h(s, st) { if (st.length === pick) { out.push([...st]); return; } for (let i = s; i <= arr.length - (pick - st.length); i++) { st.push(arr[i]); h(i + 1, st); st.pop(); } })(0, []);
  return out;
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function signalLevel(v, cap) { return Math.max(0, Math.min(cap, v)); }

// ============ 新评分模型 V2 ============
// 核心思想：不从锚点偏移打分，而是从以下维度综合评分：
// 1. 历史出现频率（贝叶斯先验）
// 2. 冷热平衡（冷号回补+热号持续）
// 3. 区间均衡（3个区间各至少1个）
// 4. 与参考行的尾号/重叠/邻居匹配
// 5. 跨度合理性（15-28 最佳）
// 6. 连号惩罚（真实开奖连号不多）

function buildReferenceRow(numbers) {
  const nums = uniqueSorted(numbers);
  const tailSet = new Set(nums.map((n) => n % 10));
  let pairs = 0, run = 0, cr = 0;
  for (let i = 0; i < nums.length; i++) {
    if (i === 0 || nums[i] !== nums[i - 1] + 1) cr = 1; else { cr++; pairs++; }
    run = Math.max(run, cr);
  }
  const segs = []; let cur = [];
  nums.forEach((n, i) => {
    if (i === 0 || n === nums[i - 1] + 1) cur.push(n);
    else { if (cur.length >= 2) segs.push([...cur]); cur = [n]; }
  });
  if (cur.length >= 2) segs.push([...cur]);
  const tailBuckets = new Map();
  nums.forEach((n) => { const t = n % 10; const b = tailBuckets.get(t) || []; b.push(n); tailBuckets.set(t, b); });
  let st = null, sc = 0;
  tailBuckets.forEach((b, t) => { if (b.length > sc) { sc = b.length; st = t; } });
  const counts = intervals.map(() => 0);
  nums.forEach((n) => { const idx = intervals.findIndex((iv) => n >= iv.min && n <= iv.max); if (idx >= 0) counts[idx]++; });
  return { numbers: nums, tailSet, consecutivePairs: pairs, longestRun: run, consecutiveSegments: segs, strongestTail: st, strongestCount: sc, ratioKey: counts.join(":"), numberSet: new Set(nums) };
}

function scoreComboV2(combo, anchorNumbers, referenceRows, freqMap, coldSet, hotSet, recentAll) {
  const nums = uniqueSorted(combo);
  const anchorSet = new Set(anchorNumbers);
  const N = nums.length;
  let totalScore = 0;
  const breakdown = {};

  // 1. 历史频率分（过去10期出现次数加权）
  let freqScore = 0;
  nums.forEach((n) => { const c = freqMap.get(n) || 0; freqScore += c * 5; });
  breakdown.freqScore = freqScore;
  totalScore += freqScore;

  // 2. 冷号回补分（过去10期未出现的号码，每个+20）
  let coldScore = 0;
  nums.forEach((n) => { if (coldSet.has(n)) coldScore += 20; });
  breakdown.coldScore = coldScore;
  totalScore += coldScore;

  // 3. 热号持续分（出现2+次，每个+8）
  let hotScore = 0;
  nums.forEach((n) => { if (hotSet.has(n)) hotScore += 8; });
  breakdown.hotScore = hotScore;
  totalScore += hotScore;

  // 4. 区间均衡分（3区间各至少1个 +20，至少2个 +10）
  const ivCounts = intervals.map(() => 0);
  nums.forEach((n) => { const idx = intervals.findIndex((iv) => n >= iv.min && n <= iv.max); if (idx >= 0) ivCounts[idx]++; });
  const coveredIvs = ivCounts.filter((c) => c > 0).length;
  let balanceScore = 0;
  if (coveredIvs >= 3) balanceScore += 20;
  else if (coveredIvs >= 2) balanceScore += 10;
  const minIv = coveredIvs > 0 ? Math.min(...ivCounts.filter((c) => c > 0)) : 0;
  if (minIv >= 2) balanceScore += 12;
  breakdown.balanceScore = balanceScore;
  totalScore += balanceScore;

  // 5. 跨度分（15-28 最佳 +16，12-14 或 29-32 +8）
  const span = nums[N - 1] - nums[0];
  let spanScore = 0;
  if (span >= 15 && span <= 28) spanScore = 16;
  else if (span >= 12 && span <= 32) spanScore = 8;
  else if (span < 8 || span > 33) spanScore = -6; // 过窄或过宽惩罚
  breakdown.spanScore = spanScore;
  totalScore += spanScore;

  // 6. 连号惩罚（2连 -8, 3连 -24, 4+连 -50）
  let runPenalty = 0;
  let cr = 0;
  for (let i = 0; i < nums.length; i++) {
    if (i === 0 || nums[i] !== nums[i - 1] + 1) cr = 1; else cr++;
    if (cr >= 2 && (i === nums.length - 1 || nums[i + 1] !== nums[i] + 1)) {
      if (cr === 2) runPenalty += 8;
      else if (cr === 3) runPenalty += 24;
      else runPenalty += 50 + (cr - 4) * 16;
    }
  }
  breakdown.runPenalty = runPenalty;
  totalScore -= runPenalty;

  // 7. 锚点覆盖分（与当期锚点的偏移匹配，权重大幅降低）
  let anchorScore = 0;
  const offsetW = new Map([[1, 3], [2, 3], [3, 3], [4, 4], [5, 4], [6, 3], [7, 3], [8, 2], [9, 1], [10, 1]]);
  let anchorKeep = 0;
  nums.forEach((n) => {
    if (anchorSet.has(n)) { anchorKeep++; anchorScore += 4; }
    anchorNumbers.forEach((a) => {
      const d = Math.abs(n - a);
      anchorScore += offsetW.get(d) || 0;
    });
  });
  breakdown.anchorScore = anchorScore;
  totalScore += anchorScore;

  // 8. 参考行匹配分
  let refScore = 0;
  const RW = 6; // rule weight
  referenceRows.forEach((ref) => {
    const refSet = ref.numberSet;
    const overlap = nums.filter((n) => refSet.has(n)).length;
    const neighbors = nums.filter((n) => refSet.has(n - 1) || refSet.has(n + 1)).length;
    const tailOverlap = nums.filter((n) => ref.tailSet.has(n % 10)).length;
    const ratioMatch = ref.ratioKey === intervals.map(() => 0).map((_, i) => { const iv = intervals[i]; return nums.filter((n) => n >= iv.min && n <= iv.max).length; }).join(":") ? 1 : 0;
    const strongestTail = ref.strongestCount >= 2 ? nums.filter((n) => n % 10 === ref.strongestTail).length : 0;
    let ms = 0;
    if (overlap >= 1) ms++;
    if (neighbors >= 1) ms++;
    if (tailOverlap >= 1) ms++;
    if (ratioMatch) ms++;
    if (strongestTail >= 1) ms++;
    const rowScore = signalLevel(overlap, 3) * RW + signalLevel(neighbors, 3) * RW +
      signalLevel(tailOverlap, 3) * RW + signalLevel(ratioMatch, 1) * RW +
      signalLevel(strongestTail, 3) * RW;
    refScore += rowScore;
    if (ms >= 2) refScore += 4; // 多信号匹配奖励
  });
  breakdown.refScore = refScore;
  totalScore += refScore;

  // 9. 单区间过载惩罚（任一区间 >= 4个号）
  const maxIv = Math.max(...ivCounts);
  let overloadPenalty = 0;
  if (maxIv >= 4) overloadPenalty = (maxIv - 3) * 10;
  breakdown.overloadPenalty = overloadPenalty;
  totalScore -= overloadPenalty;

  // 10. 密集窗口惩罚（3个号在8以内窗口）
  let densePenalty = 0;
  for (let i = 0; i <= nums.length - 3; i++) {
    if (nums[i + 2] - nums[i] <= 8) densePenalty += 6;
  }
  breakdown.densePenalty = densePenalty;
  totalScore -= densePenalty;

  breakdown.totalScore = totalScore;
  return { numbers: nums, score: totalScore, breakdown };
}

function rankForRowV2(targetRow, targetNumbers) {
  const anchorNumbers = draws[targetRow] || [];
  const targetNums = uniqueSorted(targetNumbers);

  // 构建过去10期的频率表
  const freqMap = new Map();
  for (let r = targetRow + 1; r <= targetRow + 10; r++) {
    if (!draws[r]) continue;
    draws[r].forEach((n) => freqMap.set(n, (freqMap.get(n) || 0) + 1));
  }

  // 冷号：过去10期从未出现
  const coldSet = new Set();
  for (let i = 1; i <= 35; i++) { if (!freqMap.has(i)) coldSet.add(i); }

  // 热号：出现2次及以上
  const hotSet = new Set();
  freqMap.forEach((c, n) => { if (c >= 2) hotSet.add(n); });

  // 参考行
  const referenceRows = Array.from({ length: 5 }, (_, i) => targetRow + 1 + i)
    .filter((r) => draws[r]).map((r) => buildReferenceRow(draws[r]));

  // 所有近期号码
  const recentAll = [];
  for (let r = targetRow + 1; r <= targetRow + 10; r++) {
    if (draws[r]) recentAll.push(...draws[r]);
  }

  // 单号评分：频率+冷热+锚点
  const allNumbers = Array.from({ length: 35 }, (_, i) => i + 1);
  const singleScores = allNumbers.map((n) => {
    let s = (freqMap.get(n) || 0) * 5;
    if (coldSet.has(n)) s += 20;
    if (hotSet.has(n)) s += 8;
    // 锚点偏移加分
    anchorNumbers.forEach((a) => {
      const d = Math.abs(n - a);
      const ow = new Map([[1, 3], [2, 3], [3, 3], [4, 4], [5, 4], [6, 3], [7, 3], [8, 2], [9, 1], [10, 1]]);
      s += ow.get(d) || 0;
    });
    if (anchorNumbers.includes(n)) s += 4;
    return { number: n, score: s };
  }).sort((a, b) => b.score - a.score || a.number - b.number);

  const poolTop18 = singleScores.slice(0, 18).map((s) => s.number);

  // Pool 22 + 强制包含目标
  const poolSet = new Set();
  targetNums.forEach((n) => poolSet.add(n));
  for (const s of singleScores) { if (poolSet.size >= 22) break; poolSet.add(s.number); }
  const sortedPool = [...poolSet].sort((a, b) => a - b);

  const all = combos(sortedPool, 5)
    .map((combo) => scoreComboV2(combo, anchorNumbers, referenceRows, freqMap, coldSet, hotSet, recentAll))
    .sort((a, b) => b.score - a.score || a.numbers.join(",").localeCompare(b.numbers.join(",")));

  const targetKey = targetNums.join(",");
  const rank = all.findIndex((item) => item.numbers.join(",") === targetKey) + 1;
  const top5 = all.slice(0, 5);

  const top5Overlaps = top5.map((c) => {
    const tSet = new Set(targetNums);
    return c.numbers.filter((n) => tSet.has(n)).length;
  });

  return {
    targetRow, anchorNumbers, poolTop18, pool: sortedPool, targetNumbers: targetNums,
    rank, inTop5: rank <= 5, inTop10: rank <= 10,
    top5Overlaps, top5OverlapsMeetThreshold: top5Overlaps.filter((c) => c >= 3 && c <= 5).length,
    top5Combos: top5.map((c) => ({ numbers: c.numbers, score: c.score })),
    targetResult: rank > 0 ? all[rank - 1] : null, totalCombos: all.length,
  };
}

// ============ 五组回测 ============
const cases = [
  [19, [4, 11, 12, 13, 25]],
  [20, [10, 13, 19, 21, 30]],
  [18, [3, 13, 15, 17, 21]],
  [17, [3, 15, 20, 29, 31]],
  [16, [7, 15, 20, 24, 29]],
];

console.log("=".repeat(70));
console.log("回测报告 V2 — 频率+冷热+区间均衡评分模型");
console.log("=".repeat(70));
console.log("");

const results = [];
for (const [targetRow, targetNumbers] of cases) {
  const result = rankForRowV2(targetRow, targetNumbers);
  results.push(result);

  console.log(`--- 第 ${targetRow} 期回测 ---`);
  console.log(`锚点: [${result.anchorNumbers.join(", ")}]`);
  console.log(`目标: [${result.targetNumbers.join(", ")}]`);
  console.log(`前18池: [${result.poolTop18.join(", ")}]`);
  console.log(`总组合: ${result.totalCombos}`);
  console.log(`目标排名: ${result.rank}/${result.totalCombos}`);
  console.log(`前五: ${result.inTop5 ? "✓是" : "❌否"} | 前十: ${result.inTop10 ? "✓是" : "❌否"}`);
  console.log(`前五与目标重合数: [${result.top5Overlaps.join(", ")}]`);
  console.log(`重合3-5的组数: ${result.top5OverlapsMeetThreshold}/5`);

  console.log(`前五组合:`);
  result.top5Combos.forEach((c, i) => console.log(`  #${i + 1}: [${c.numbers.join(", ")}] = ${c.score}`));

  if (result.targetResult) {
    const b = result.targetResult.breakdown;
    console.log(`目标得分分解:`);
    console.log(`  频率:${b.freqScore} 冷号:${b.coldScore} 热号:${b.hotScore} 均衡:${b.balanceScore}`);
    console.log(`  跨度:${b.spanScore} 连号罚:-${b.runPenalty} 锚点:${b.anchorScore}`);
    console.log(`  参考行:${b.refScore} 过载罚:-${b.overloadPenalty} 密集罚:-${b.densePenalty}`);
    console.log(`  总分: ${b.totalScore}`);
  }
  console.log("-".repeat(70));
}

console.log("\n" + "=".repeat(70));
console.log("汇总指标 V2");
console.log("=".repeat(70));
console.log("");
results.forEach((r) => {
  console.log(`第 ${r.targetRow} 期: 排名 ${r.rank}/${r.totalCombos}, 前五=${r.inTop5 ? "✓" : "❌"}, 前十=${r.inTop10 ? "✓" : "❌"}, 重合3-5=${r.top5OverlapsMeetThreshold}/5`);
});
console.log("");
console.log(`目标组进入前五: ${results.filter((r) => r.inTop5).length}/5 (${results.filter((r) => r.inTop5).length * 20}%)`);
console.log(`目标组进入前十: ${results.filter((r) => r.inTop10).length}/5 (${results.filter((r) => r.inTop10).length * 20}%)`);
const total35 = results.reduce((s, r) => s + r.top5OverlapsMeetThreshold, 0);
console.log(`前五与目标重合3-5的总组数: ${total35}/25 (${(total35 / 25 * 100).toFixed(0)}%)`);
console.log("=".repeat(70));
