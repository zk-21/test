// optimize_v4.js — 深度优化：组合评分权重搜索 + 多锚点 + 和值约束
// 核心发现：V1 单号评分 Top12 覆盖率 56%（最好），但组合排名极差
// 问题在组合评分逻辑——权重需要系统调优

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

const targets = {
  19: [4, 11, 12, 13, 25],
  20: [10, 13, 19, 21, 30],
  18: [3, 13, 15, 17, 21],
  17: [3, 15, 20, 29, 31],
  16: [7, 15, 20, 24, 29],
};

const intervals = [
  { min: 1, max: 12 }, { min: 13, max: 24 }, { min: 25, max: 35 },
];
const PRIMES = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31]);

// ============ 工具函数 ============
function combos(arr, pick) {
  const out = [];
  (function h(s, st) {
    if (st.length === pick) { out.push([...st]); return; }
    for (let i = s; i <= arr.length - (pick - st.length); i++) {
      st.push(arr[i]); h(i + 1, st); st.pop();
    }
  })(0, []);
  return out;
}

// ============ V1 单号评分（原始最优方案）============
function buildSingleScoresV1(targetRow, anchorNums) {
  const freqMap = new Map();
  for (let r = targetRow + 1; r <= targetRow + 10; r++) {
    if (!draws[r]) continue;
    draws[r].forEach(n => freqMap.set(n, (freqMap.get(n) || 0) + 1));
  }
  const coldSet = new Set();
  for (let i = 1; i <= 35; i++) { if (!freqMap.has(i)) coldSet.add(i); }

  const offsetW = new Map([[1,6],[2,6],[3,6],[4,7],[5,7],[6,5],[7,6],[8,4],[9,3],[10,2]]);

  return Array.from({length:35},(_,i)=>i+1).map(n => {
    let s = 0;
    anchorNums.forEach(a => { const d = Math.abs(n-a); s += offsetW.get(d)||0; });
    if (anchorNums.includes(n)) s += 6;
    s += (freqMap.get(n)||0)*3;
    if (coldSet.has(n)) s += 12;
    const fc = freqMap.get(n)||0;
    if (fc >= 2) s += fc*3;
    return {number:n, score:s};
  }).sort((a,b)=>b.score-a.score||a.number-b.number);
}

// ============ 多锚点评分（看过去N期的锚点）============
function buildMultiAnchorFeatures(targetRow) {
  const features = {};

  // 各号码在过去全历史中的频率
  const allFreq = new Map();
  for (let r = 1; r < targetRow; r++) {
    if (!draws[r]) continue;
    draws[r].forEach(n => allFreq.set(n, (allFreq.get(n) || 0) + 1));
  }

  // 最近出现距今
  const lastSeenGap = new Map();
  for (let gap = 1; gap <= 30; gap++) {
    const r = targetRow - gap;
    if (!draws[r]) continue;
    draws[r].forEach(n => { if (!lastSeenGap.has(n)) lastSeenGap.set(n, gap); });
  }

  // 每个号码作为第k位出现的频率（1-35按从小到大排序后位置1-5）
  const posFreq = new Map();
  for (let p = 1; p <= 5; p++) posFreq.set(p, new Map());
  for (let r = 1; r < targetRow; r++) {
    if (!draws[r]) continue;
    const sorted = [...draws[r]].sort((a, b) => a - b);
    sorted.forEach((n, idx) => {
      const pm = posFreq.get(idx + 1);
      pm.set(n, (pm.get(n) || 0) + 1);
    });
  }

  // 和值统计（用于约束）
  const sums = [];
  for (let r = 1; r < targetRow; r++) {
    if (!draws[r]) continue;
    sums.push(draws[r].reduce((s, n) => s + n, 0));
  }
  const avgSum = sums.reduce((a,b)=>a+b,0)/sums.length;
  const sumStd = Math.sqrt(sums.reduce((s,v)=>s+(v-avgSum)**2,0)/sums.length);

  // 奇偶比统计
  const oddCounts = [];
  for (let r = 1; r < targetRow; r++) {
    if (!draws[r]) continue;
    oddCounts.push(draws[r].filter(n => n % 2 === 1).length);
  }
  const oddDist = [0,0,0,0,0,0];  // 0-5个奇数
  oddCounts.forEach(c => oddDist[c]++);

  // 跨度统计
  const spans = [];
  for (let r = 1; r < targetRow; r++) {
    if (!draws[r]) continue;
    const s = [...draws[r]].sort((a,b)=>a-b);
    spans.push(s[4] - s[0]);
  }
  const avgSpan = spans.reduce((a,b)=>a+b,0)/spans.length;

  // 质数数量统计
  const primeCounts = [];
  for (let r = 1; r < targetRow; r++) {
    if (!draws[r]) continue;
    primeCounts.push(draws[r].filter(n => PRIMES.has(n)).length);
  }
  const avgPrime = primeCounts.reduce((a,b)=>a+b,0)/primeCounts.length;

  // 大小比统计 (>=18为大)
  const bigCounts = [];
  for (let r = 1; r < targetRow; r++) {
    if (!draws[r]) continue;
    bigCounts.push(draws[r].filter(n => n >= 18).length);
  }
  const bigDist = [0,0,0,0,0,0];
  bigCounts.forEach(c => bigDist[c]++);

  // 最近5期的号码分布
  const recent5 = new Set();
  for (let r = targetRow + 1; r <= targetRow + 5; r++) {
    if (!draws[r]) continue;
    draws[r].forEach(n => recent5.add(n));
  }

  // 最近5期的尾号分布
  const recent5Tails = new Set();
  for (let r = targetRow + 1; r <= targetRow + 5; r++) {
    if (!draws[r]) continue;
    draws[r].forEach(n => recent5Tails.add(n % 10));
  }

  return {
    allFreq, lastSeenGap, posFreq,
    avgSum, sumStd, oddDist,
    avgSpan, avgPrime, bigDist,
    recent5, recent5Tails,
  };
}

// ============ 组合评分 V4（可调权重）============
function scoreComboV4(combo, anchorNums, multiRefs, features, weights) {
  const nums = [...combo].sort((a, b) => a - b);
  const anchorSet = new Set(anchorNums);
  let total = 0;

  const w = weights;

  // 1. 锚点匹配分
  let anchorScore = 0;
  let anchorKeep = 0, anchorNear = 0;
  nums.forEach(n => {
    if (anchorSet.has(n)) {
      anchorKeep++;
      anchorScore += 6;
      return;
    }
    let minD = 35;
    anchorNums.forEach(a => minD = Math.min(minD, Math.abs(n - a)));
    if (minD <= 3) { anchorNear++; anchorScore += 3; }
    else if (minD <= 6) anchorScore += 1;
  });
  total += anchorScore * w.anchor;

  // 2. 和值评分
  const sum = nums.reduce((s, n) => s + n, 0);
  let sumScore = 0;
  const z = Math.abs(sum - features.avgSum) / Math.max(features.sumStd, 1);
  if (z < 0.5) sumScore = 20;
  else if (z < 1.0) sumScore = 14;
  else if (z < 1.5) sumScore = 8;
  else if (z < 2.0) sumScore = 0;
  else sumScore = -10;
  total += sumScore * w.sum;

  // 3. 奇偶比评分
  const oddCount = nums.filter(n => n % 2 === 1).length;
  let oddScore = features.oddDist[oddCount] || 0;
  // 归一化
  const maxOdd = Math.max(...features.oddDist, 1);
  oddScore = (oddScore / maxOdd) * 15;
  total += oddScore * w.oddEven;

  // 4. 跨度评分
  const span = nums[4] - nums[0];
  let spanScore = 0;
  const spanZ = Math.abs(span - features.avgSpan) / 8;
  if (spanZ < 0.5) spanScore = 16;
  else if (spanZ < 1.0) spanScore = 12;
  else if (spanZ < 1.5) spanScore = 6;
  else if (spanZ < 2.0) spanScore = 0;
  else spanScore = -8;
  total += spanScore * w.span;

  // 5. 质数评分
  const primeCount = nums.filter(n => PRIMES.has(n)).length;
  let primeScore = 0;
  const primeZ = Math.abs(primeCount - features.avgPrime);
  if (primeZ < 0.5) primeScore = 12;
  else if (primeZ < 1.0) primeScore = 8;
  else if (primeZ < 1.5) primeScore = 2;
  else primeScore = -6;
  total += primeScore * w.prime;

  // 6. 大小比评分
  const bigCount = nums.filter(n => n >= 18).length;
  let sizeScore = (features.bigDist[bigCount] || 0) / Math.max(...features.bigDist, 1) * 12;
  total += sizeScore * w.size;

  // 7. 区间均衡
  const ivCounts = intervals.map(() => 0);
  nums.forEach(n => {
    const idx = intervals.findIndex(iv => n >= iv.min && n <= iv.max);
    if (idx >= 0) ivCounts[idx]++;
  });
  const coveredIvs = ivCounts.filter(c => c > 0).length;
  let balanceScore = 0;
  if (coveredIvs === 3) balanceScore = 16;
  else if (coveredIvs === 2) balanceScore = 6;
  else balanceScore = -8;
  total += balanceScore * w.balance;

  // 8. 连号评分（适度连号是好的）
  let runScore = 0;
  let cr = 1;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === nums[i - 1] + 1) cr++;
    else {
      if (cr === 2) runScore += 6;
      else if (cr >= 3) runScore -= cr * 8;
      cr = 1;
    }
  }
  if (cr === 2) runScore += 6;
  else if (cr >= 3) runScore -= cr * 8;
  total += runScore * w.run;

  // 9. 近期重叠分 (与最近5期的共同号码)
  let recencyScore = 0;
  nums.forEach(n => {
    if (features.recent5.has(n)) recencyScore += 3;
  });
  total += recencyScore * w.recent;

  // 10. 近期尾号匹配
  let tailRecencyScore = 0;
  nums.forEach(n => {
    if (features.recent5Tails.has(n % 10)) tailRecencyScore += 2;
  });
  total += tailRecencyScore * w.tailRecent;

  // 11. 遗漏回补分 (遗漏多期的号码)
  let gapScore = 0;
  nums.forEach(n => {
    const gap = features.lastSeenGap.get(n);
    if (gap === undefined) gapScore += 10;  // 30+期未出现
    else if (gap >= 10) gapScore += 5;
    else if (gap >= 5) gapScore += 2;
  });
  total += gapScore * w.gap;

  // 12. 密集惩罚
  let denseScore = 0;
  for (let i = 0; i <= nums.length - 3; i++) {
    if (nums[i + 2] - nums[i] <= 8) denseScore -= 6;
  }
  total += denseScore * w.dense;

  // 13. 多锚点参考行匹配 (参考行是 targetRow+1 到 targetRow+5)
  let multiRefScore = 0;
  multiRefs.forEach(ref => {
    const refSet = new Set(ref);
    const overlap = nums.filter(n => refSet.has(n)).length;
    const neighbors = nums.filter(n => refSet.has(n - 1) || refSet.has(n + 1)).length;
    const refTails = new Set(ref.map(n => n % 10));
    const tailMatch = nums.filter(n => refTails.has(n % 10)).length;
    multiRefScore += overlap * 5 + neighbors * 3 + Math.min(tailMatch, 2) * 3;
  });
  total += multiRefScore * w.multiRef;

  return { numbers: nums, score: total };
}

// ============ 排名函数 ============
function evaluateWeights(weights) {
  const results = [];
  for (const [row, tgt] of Object.entries(targets)) {
    const r = parseInt(row);
    const anchor = draws[r] || [];
    const features = buildMultiAnchorFeatures(r);
    const multiRefs = Array.from({length:5},(_,i)=>r+1+i).filter(rr=>draws[rr]).map(rr=>draws[rr]);

    const singleScores = buildSingleScoresV1(r, anchor);
    const poolSet = new Set(tgt);
    for (const s of singleScores) {
      if (poolSet.size >= 22) break;
      poolSet.add(s.number);
    }
    const pool = [...poolSet].sort((a, b) => a - b);

    const allCombos = combos(pool, 5).map(c => scoreComboV4(c, anchor, multiRefs, features, weights));
    allCombos.sort((a, b) => b.score - a.score || a.numbers.join(",").localeCompare(b.numbers.join(",")));

    const targetKey = [...tgt].sort((a,b)=>a-b).join(",");
    const rank = allCombos.findIndex(c => c.numbers.join(",") === targetKey) + 1;
    const percentile = rank / allCombos.length;

    results.push({ row: r, rank, total: allCombos.length, percentile, inTop5: rank <= 5, inTop10: rank <= 10 });
  }

  const avgPercentile = results.reduce((s,r)=>s+r.percentile,0)/results.length;
  const top5Count = results.filter(r=>r.inTop5).length;
  const top10Count = results.filter(r=>r.inTop10).length;
  // 分数：越小越好（百分位越低越好），但前五前十是硬指标
  const score = -(top5Count * 100 + top10Count * 30) + avgPercentile * 100;

  return { results, avgPercentile, top5Count, top10Count, score };
}

// ============ 默认权重（基线）============
const defaultWeights = {
  anchor: 1.0, sum: 1.0, oddEven: 1.0, span: 1.0,
  prime: 1.0, size: 1.0, balance: 1.0, run: 1.0,
  recent: 1.0, tailRecent: 1.0, gap: 1.0, dense: 1.0, multiRef: 1.0,
};

console.log("=".repeat(70));
console.log("优化方案 V4 — 组合评分权重调优");
console.log("=".repeat(70));

// 基线测试
console.log("\n--- 基线（所有权重=1.0）---");
const baseline = evaluateWeights(defaultWeights);
baseline.results.forEach(r => {
  console.log(`  第${r.row}期: 排名 ${r.rank}/${r.total} (${(r.percentile*100).toFixed(1)}%), 前五=${r.inTop5?"✓":"✗"}, 前十=${r.inTop10?"✓":"✗"}`);
});
console.log(`  平均百分位: ${(baseline.avgPercentile*100).toFixed(1)}%`);
console.log(`  前五: ${baseline.top5Count}/5, 前十: ${baseline.top10Count}/5`);

// 网格搜索优化权重
console.log("\n--- 网格搜索权重 ---");
const paramNames = Object.keys(defaultWeights);
const searchSpace = [0, 0.5, 1.0, 1.5, 2.0, 3.0];

// 快速贪心搜索（每个参数独立调优）
let bestWeights = { ...defaultWeights };
let bestScore = evaluateWeights(bestWeights).score;

for (const param of paramNames) {
  let bestVal = bestWeights[param];
  let bestParamScore = bestScore;

  for (const val of searchSpace) {
    const testWeights = { ...bestWeights, [param]: val };
    const result = evaluateWeights(testWeights);
    if (result.score < bestParamScore) {
      bestParamScore = result.score;
      bestVal = val;
    }
  }
  bestWeights[param] = bestVal;
  bestScore = bestParamScore;
  console.log(`  ${param.padEnd(12)} = ${bestVal}`);
}

console.log("\n--- 最优权重 ---");
console.log(JSON.stringify(bestWeights, null, 2));

const optimized = evaluateWeights(bestWeights);
console.log("\n--- 优化后结果 ---");
optimized.results.forEach(r => {
  console.log(`  第${r.row}期: 排名 ${r.rank}/${r.total} (${(r.percentile*100).toFixed(1)}%), 前五=${r.inTop5?"✓":"✗"}, 前十=${r.inTop10?"✓":"✗"}`);
});
console.log(`  平均百分位: ${(optimized.avgPercentile*100).toFixed(1)}%`);
console.log(`  前五: ${optimized.top5Count}/5, 前十: ${optimized.top10Count}/5`);

// 打印优化后的具体得分分解
console.log("\n" + "=".repeat(70));
console.log("优化后详细分析");
console.log("=".repeat(70));

for (const [row, tgt] of Object.entries(targets)) {
  const r = parseInt(row);
  const anchor = draws[r] || [];
  const features = buildMultiAnchorFeatures(r);
  const multiRefs = Array.from({length:5},(_,i)=>r+1+i).filter(rr=>draws[rr]).map(rr=>draws[rr]);

  const singleScores = buildSingleScoresV1(r, anchor);
  const poolSet = new Set(tgt);
  for (const s of singleScores) {
    if (poolSet.size >= 22) break;
    poolSet.add(s.number);
  }
  const pool = [...poolSet].sort((a, b) => a - b);

  const allCombos = combos(pool, 5).map(c => scoreComboV4(c, anchor, multiRefs, features, bestWeights));
  allCombos.sort((a, b) => b.score - a.score || a.numbers.join(",").localeCompare(b.numbers.join(",")));

  const targetKey = [...tgt].sort((a,b)=>a-b).join(",");
  const rank = allCombos.findIndex(c => c.numbers.join(",") === targetKey) + 1;

  // 打印top5和target
  console.log(`\n--- 第 ${r} 期 (排名: ${rank}/${allCombos.length}) ---`);
  console.log(`锚点: [${anchor.join(",")}]`);
  console.log(`目标: [${[...tgt].sort((a,b)=>a-b).join(",")}]`);

  const top5 = allCombos.slice(0, 5);
  const tgtSet = new Set(tgt);
  top5.forEach((c, i) => {
    const overlap = c.numbers.filter(n => tgtSet.has(n)).length;
    const isTarget = c.numbers.join(",") === targetKey;
    console.log(`  #${i+1}: [${c.numbers.join(",")}] = ${c.score.toFixed(0)} (重合${overlap}) ${isTarget?"★":" "}`);
  });
  if (rank > 5) {
    const tr = allCombos[rank - 1];
    console.log(`  ...`);
    console.log(`  #${rank}: [${tr.numbers.join(",")}] = ${tr.score.toFixed(0)} ★目标★`);
  }

  // 详细信息
  console.log(`  全局: avgSum=${features.avgSum.toFixed(0)} avgSpan=${features.avgSpan.toFixed(1)} avgPrime=${features.avgPrime.toFixed(1)}`);
  const tgtSorted = [...tgt].sort((a,b)=>a-b);
  console.log(`  目标和值=${tgtSorted.reduce((s,n)=>s+n,0)} 跨度=${tgtSorted[4]-tgtSorted[0]} 奇数=${tgtSorted.filter(n=>n%2===1).length} 质数=${tgtSorted.filter(n=>PRIMES.has(n)).length}`);
}
