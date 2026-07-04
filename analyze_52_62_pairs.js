// 分析 52→62, 53→63, ... 59→69 的对应关系，寻找优化策略
const draws = [
  { issue: "2026052", front: [2, 3, 20, 28, 33] },
  { issue: "2026053", front: [2, 9, 14, 20, 31] },
  { issue: "2026054", front: [2, 6, 14, 22, 24] },
  { issue: "2026055", front: [9, 10, 20, 33, 35] },
  { issue: "2026056", front: [6, 7, 18, 21, 30] },
  { issue: "2026057", front: [23, 25, 26, 27, 34] },
  { issue: "2026058", front: [7, 12, 13, 18, 34] },
  { issue: "2026059", front: [6, 13, 17, 19, 26] },
  { issue: "2026062", front: [7, 15, 20, 24, 29] },
  { issue: "2026063", front: [3, 15, 20, 29, 31] },
  { issue: "2026064", front: [3, 13, 15, 17, 21] },
  { issue: "2026065", front: [4, 11, 12, 13, 25] },
  { issue: "2026066", front: [10, 13, 19, 21, 30] },
  { issue: "2026067", front: [6, 16, 18, 19, 28] },
  { issue: "2026068", front: [3, 11, 12, 21, 22] },
  { issue: "2026069", front: [12, 19, 21, 24, 29] },
];

const pairs = [
  ["2026052", "2026062"],
  ["2026053", "2026063"],
  ["2026054", "2026064"],
  ["2026055", "2026065"],
  ["2026056", "2026066"],
  ["2026057", "2026067"],
  ["2026058", "2026068"],
  ["2026059", "2026069"],
];

const dmap = {};
draws.forEach((d) => (dmap[d.issue] = d));

function gi(n) { if (n <= 12) return 0; if (n <= 24) return 1; return 2; }
function tails(nums) { return [...new Set(nums.map((x) => x % 10))].sort((a, b) => a - b); }

// ====== 逐对深度分析 ======
console.log("=".repeat(70));
console.log("逐对分析：052→062 ... 059→069");
console.log("=".repeat(70));

let allAnchors = []; // 所有选中行号码作为锚点的偏移统计
let allHitOffsets = []; // 命中的偏移距离

pairs.forEach(([sIssue, tIssue]) => {
  const s = dmap[sIssue].front;
  const t = dmap[tIssue].front;
  const tSet = new Set(t);
  const sSorted = [...s].sort((a, b) => a - b);
  const tSorted = [...t].sort((a, b) => a - b);

  // 锚点命中
  const anchorKeep = s.filter((n) => t.includes(n));
  // 每个锚点的最近偏移
  const bestOffsets = s.map((anchor) => {
    const diffs = t.map((tn) => tn - anchor);
    diffs.sort((a, b) => Math.abs(a) - Math.abs(b));
    return { anchor, bestDiff: diffs[0], allDiffs: diffs };
  });

  // 尾号分析
  const sTails = tails(s);
  const tTails = tails(t);
  const tailOverlap = sTails.filter((x) => tTails.includes(x));
  const tailNeighbor = sTails.filter((x) =>
    tTails.some((y) => Math.abs(x - y) === 1 || (x === 0 && y === 9) || (x === 9 && y === 0))
  );

  // 区间比
  const sIv = [0, 0, 0]; const tIv = [0, 0, 0];
  s.forEach((n) => sIv[gi(n)]++);
  t.forEach((n) => tIv[gi(n)]++);

  // 结构特征
  const sSum = s.reduce((a, b) => a + b, 0);
  const tSum = t.reduce((a, b) => a + b, 0);
  const sSpan = sSorted[4] - sSorted[0];
  const tSpan = tSorted[4] - tSorted[0];
  const sOdd = s.filter((n) => n % 2 === 1).length;
  const tOdd = t.filter((n) => n % 2 === 1).length;

  console.log(`\n${sIssue} → ${tIssue}:`);
  console.log(`  选中: [${s}]  目标: [${t}]`);
  console.log(`  锚点命中(${anchorKeep.length}个): [${anchorKeep}]`);
  bestOffsets.forEach((bo) => {
    const mark = tSet.has(bo.anchor) ? "✓锚点命中" : bo.allDiffs[0];
    console.log(`    锚点${bo.anchor} → 最近偏移: ${mark} | 全部: [${bo.allDiffs.join(",")}]`);
  });
  console.log(`  区间比: ${sIv.join(":")} → ${tIv.join(":")} ${sIv.join(":") === tIv.join(":") ? "MATCH!" : "变化"}`);
  console.log(`  尾号: [${sTails}] → [${tTails}] 重叠[${tailOverlap}] ±1邻[${tailNeighbor}]`);
  console.log(`  结构: 和值${sSum}→${tSum} 跨度${sSpan}→${tSpan} 奇${sOdd}→${tOdd}`);

  // 收集偏移统计（排除锚点命中的）
  bestOffsets.forEach((bo) => {
    allAnchors.push(bo.anchor);
    if (!tSet.has(bo.anchor)) {
      allHitOffsets.push(bo.bestDiff);
    }
  });
});

// ====== 偏移距离分布 ======
console.log("\n" + "=".repeat(70));
console.log("偏移距离分布统计（锚点→目标行最近号码距离）");
console.log("=".repeat(70));

const offsetDist = {};
allHitOffsets.forEach((d) => {
  const abs = Math.abs(d);
  offsetDist[abs] = (offsetDist[abs] || 0) + 1;
});
console.log("非命中偏移距离分布:");
Object.entries(offsetDist)
  .sort((a, b) => a[0] - b[0])
  .forEach(([d, c]) => {
    const bar = "#".repeat(c);
    console.log(`  距离${d.padStart(2)}: ${c}次 ${bar} (${(c / allHitOffsets.length * 100).toFixed(0)}%)`);
  });

// 小偏移(≤3) vs 中偏移(4-6) vs 大偏移(7+)
const small = allHitOffsets.filter((d) => Math.abs(d) <= 3).length;
const mid = allHitOffsets.filter((d) => Math.abs(d) >= 4 && Math.abs(d) <= 6).length;
const large = allHitOffsets.filter((d) => Math.abs(d) >= 7).length;
console.log(`\n偏移分组: 小(≤3):${small}次(${(small/allHitOffsets.length*100).toFixed(0)}%) 中(4-6):${mid}次(${(mid/allHitOffsets.length*100).toFixed(0)}%) 大(≥7):${large}次(${(large/allHitOffsets.length*100).toFixed(0)}%)`);

// ====== 综合命中率分析（各种策略） ======
console.log("\n" + "=".repeat(70));
console.log("多策略命中率对比");
console.log("=".repeat(70));

const strategies = {
  "策略A_锚点保底": { hits: 0, total: 0 },
  "策略B_锚点±1": { hits: 0, total: 0 },
  "策略C_锚点±3": { hits: 0, total: 0 },
  "策略D_锚点±5": { hits: 0, total: 0 },
  "策略E_锚点±10(全范围)": { hits: 0, total: 0 },
  "策略F_尾号匹配": { hits: 0, total: 0 },
  "策略G_区间比匹配": { hits: 0, total: 0 },
  "策略H_锚点±5+尾号过滤": { hits: 0, total: 0 },
  "策略I_锚点±5+区间比+尾号": { hits: 0, total: 0 },
  "策略J_加权偏移(小偏移优先)+尾号+区间比": { hits: 0, total: 0 },
};

pairs.forEach(([sIssue, tIssue]) => {
  const s = dmap[sIssue].front;
  const t = dmap[tIssue].front;
  const tSet = new Set(t);
  const sTails = tails(s);
  const tTails = tails(t);
  const sIv = [0, 0, 0]; s.forEach((n) => sIv[gi(n)]++);
  const tIv = [0, 0, 0]; t.forEach((n) => tIv[gi(n)]++);
  const tRatioStr = tIv.join(":");

  // A: 锚点保底
  const poolA = [...new Set(s)];
  const hitA = poolA.filter((n) => tSet.has(n)).length;
  strategies["策略A_锚点保底"].hits += hitA;

  // B: 锚点±1
  const poolB = new Set();
  s.forEach((n) => { for (let d = -1; d <= 1; d++) { const v = n + d; if (v >= 1 && v <= 35) poolB.add(v); } });
  const hitB = [...poolB].filter((n) => tSet.has(n)).length;
  strategies["策略B_锚点±1"].hits += hitB;

  // C: 锚点±3
  const poolC = new Set();
  s.forEach((n) => { for (let d = -3; d <= 3; d++) { const v = n + d; if (v >= 1 && v <= 35) poolC.add(v); } });
  const hitC = [...poolC].filter((n) => tSet.has(n)).length;
  strategies["策略C_锚点±3"].hits += hitC;

  // D: 锚点±5
  const poolD = new Set();
  s.forEach((n) => { for (let d = -5; d <= 5; d++) { const v = n + d; if (v >= 1 && v <= 35) poolD.add(v); } });
  const hitD = [...poolD].filter((n) => tSet.has(n)).length;
  strategies["策略D_锚点±5"].hits += hitD;

  // E: 全范围
  const poolE = new Set();
  s.forEach((n) => { for (let d = -10; d <= 10; d++) { const v = n + d; if (v >= 1 && v <= 35) poolE.add(v); } });
  const hitE = [...poolE].filter((n) => tSet.has(n)).length;
  strategies["策略E_锚点±10(全范围)"].hits += hitE;

  // F: 尾号匹配（只保留尾号重叠的号码）
  const poolF = new Set();
  s.forEach((n) => { for (let d = -5; d <= 5; d++) { const v = n + d; if (v >= 1 && v <= 35 && sTails.includes(v % 10)) poolF.add(v); } });
  const hitF = [...poolF].filter((n) => tSet.has(n)).length;
  strategies["策略F_尾号匹配"].hits += hitF;

  // G: 区间比匹配
  const poolG = new Set();
  s.forEach((n) => { for (let d = -5; d <= 5; d++) { const v = n + d; if (v >= 1 && v <= 35) { const ivG = gi(v); if (tIv[ivG] > 0 || sIv[ivG] > 0) poolG.add(v); } } });
  const hitG = [...poolG].filter((n) => tSet.has(n)).length;
  strategies["策略G_区间比匹配"].hits += hitG;

  // H: 锚点±5 + 尾号重叠>=1
  const poolH = new Set();
  s.forEach((n) => { for (let d = -5; d <= 5; d++) { const v = n + d; if (v >= 1 && v <= 35 && tTails.includes(v % 10)) poolH.add(v); } });
  const hitH = [...poolH].filter((n) => tSet.has(n)).length;
  strategies["策略H_锚点±5+尾号过滤"].hits += hitH;

  // I: 锚点±5 + 尾号+区间比
  const poolI = new Set();
  s.forEach((n) => {
    for (let d = -5; d <= 5; d++) {
      const v = n + d;
      if (v >= 1 && v <= 35 && tTails.includes(v % 10)) {
        const ivG = gi(v);
        if (tIv[ivG] > 0) poolI.add(v);
      }
    }
  });
  const hitI = [...poolI].filter((n) => tSet.has(n)).length;
  strategies["策略I_锚点±5+区间比+尾号"].hits += hitI;

  // J: 加权偏移（距离1权重高）+ 尾号
  const poolJ = new Set();
  s.forEach((n) => {
    // 偏好小偏移
    [-1, 1, -2, 2, -3, 3, -4, 4, -5, 5].forEach((d) => {
      const v = n + d;
      if (v >= 1 && v <= 35) {
        if (tTails.includes(v % 10)) poolJ.add(v);
      }
    });
  });
  const hitJ = [...poolJ].filter((n) => tSet.has(n)).length;
  strategies["策略J_加权偏移(小偏移优先)+尾号+区间比"].hits += hitJ;
});

// 所有策略总数
const totalPairs = pairs.length;
const totalBalls = totalPairs * 5;

console.log(`\n总分析对数: ${totalPairs}, 总目标球数: ${totalBalls}`);
console.log("-".repeat(50));
Object.entries(strategies).forEach(([name, s]) => {
  if (s.hits > 0) {
    console.log(`  ${name}: ${s.hits}/${totalBalls} (${(s.hits / totalBalls * 100).toFixed(1)}%)`);
  }
});

// ====== 最优组合策略探索 ======
console.log("\n" + "=".repeat(70));
console.log("最优偏移距离权重探索（基于历史数据反推）");
console.log("=".repeat(70));

// 收集所有(锚点, 目标号码)的差值
const allDiffs = [];
pairs.forEach(([sIssue, tIssue]) => {
  const s = dmap[sIssue].front;
  const t = dmap[tIssue].front;
  s.forEach((anchor) => {
    t.forEach((target) => {
      allDiffs.push(target - anchor);
    });
  });
});

// 差值的绝对值分布
const diffAbsDist = {};
allDiffs.forEach((d) => {
  const abs = Math.abs(d);
  diffAbsDist[abs] = (diffAbsDist[abs] || 0) + 1;
});

console.log("锚点→目标号码的差值分布:");
Object.entries(diffAbsDist)
  .sort((a, b) => a[0] - b[0])
  .forEach(([d, c]) => {
    const bar = "#".repeat(Math.round(c / 2));
    console.log(`  距离${d.toString().padStart(2)}: ${String(c).padStart(2)}次 ${bar}`);
  });

// 统计累计覆盖
const sortedDiffs = Object.entries(diffAbsDist)
  .sort((a, b) => a[0] - b[0])
  .map(([d, c]) => ({ dist: parseInt(d), count: c }));

let cumulative = 0;
const totalDiffs = allDiffs.length;
console.log("\n累计覆盖:");
sortedDiffs.forEach(({ dist, count }) => {
  cumulative += count;
  console.log(`  ≤${dist}: ${cumulative}/${totalDiffs} (${(cumulative / totalDiffs * 100).toFixed(1)}%)`);
});

// ====== 尾号模式分析 ======
console.log("\n" + "=".repeat(70));
console.log("尾号模式优化分析");
console.log("=".repeat(70));

let totalTailOverlap = 0;
let totalTailNeighbor = 0;
let totalCommonTail = 0;

pairs.forEach(([sIssue, tIssue]) => {
  const s = dmap[sIssue].front;
  const t = dmap[tIssue].front;
  const sTails = tails(s);
  const tTails = tails(t);
  const overlap = sTails.filter((x) => tTails.includes(x)).length;
  const neighbor = sTails.filter((x) =>
    tTails.some((y) => Math.abs(x - y) === 1 || (x === 0 && y === 9) || (x === 9 && y === 0))
  ).length;
  totalTailOverlap += overlap;
  totalTailNeighbor += neighbor;

  // 只要尾号重叠>=1 或 尾号±1>=1，任一满足即算"关联"
  if (overlap + neighbor > 0) totalCommonTail++;
});

console.log(`尾号重叠总数: ${totalTailOverlap} (最多${totalPairs*5})`);
console.log(`尾号±1总数: ${totalTailNeighbor}`);
console.log(`至少有关联尾号的期数: ${totalCommonTail}/${totalPairs}`);

// ====== 推荐优化策略 ======
console.log("\n" + "=".repeat(70));
console.log("🎯 推荐优化策略总结");
console.log("=".repeat(70));

// 计算各距离段的实际命中效率
const ranges = [
  { name: "偏移0(锚点保留)", min: 0, max: 0 },
  { name: "偏移1", min: 1, max: 1 },
  { name: "偏移2-3", min: 2, max: 3 },
  { name: "偏移4-5", min: 4, max: 5 },
  { name: "偏移6-7", min: 6, max: 7 },
  { name: "偏移8-10", min: 8, max: 10 },
  { name: "偏移11+", min: 11, max: 999 },
];

// 针对偏移的每期命中数
ranges.forEach((r) => {
  let hitsInRange = 0;
  pairs.forEach(([sIssue, tIssue]) => {
    const s = dmap[sIssue].front;
    const t = dmap[tIssue].front;
    const tSet = new Set(t);
    const pool = new Set();
    s.forEach((n) => {
      for (let d = -r.max; d <= r.max; d++) {
        if (Math.abs(d) >= r.min) {
          const v = n + d;
          if (v >= 1 && v <= 35) pool.add(v);
        }
      }
    });
    hitsInRange += [...pool].filter((n) => tSet.has(n)).length;
  });
  console.log(`  ${r.name.padEnd(20)}: ${hitsInRange}/${totalBalls} 球覆盖 (${(hitsInRange / totalBalls * 100).toFixed(1)}%)`);
});

// 最优偏移范围
console.log("\n累积偏移覆盖:");
let cumHit = 0;
const cumRanges = [0, 1, 3, 5, 7, 10];
cumRanges.forEach((maxDist) => {
  let hits = 0;
  pairs.forEach(([sIssue, tIssue]) => {
    const s = dmap[sIssue].front;
    const t = dmap[tIssue].front;
    const tSet = new Set(t);
    const pool = new Set();
    s.forEach((n) => {
      for (let d = -maxDist; d <= maxDist; d++) {
        const v = n + d;
        if (v >= 1 && v <= 35) pool.add(v);
      }
    });
    // 加上锚点
    s.forEach((n) => pool.add(n));
    hits += [...pool].filter((n) => tSet.has(n)).length;
  });
  console.log(`  偏移≤${String(maxDist).padStart(2)}: ${hits}/${totalBalls} (${(hits / totalBalls * 100).toFixed(1)}%)`);
});
