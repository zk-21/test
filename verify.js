// verify.js — 验证：全量35号 vs 22号池，目标排名差异
// 看看问题到底是评分函数还是池子太小

const draws = {
  16: [2, 3, 14, 20, 28], 17: [2, 9, 14, 20, 31], 18: [2, 6, 14, 22, 24],
  19: [9, 10, 20, 33, 35], 20: [6, 7, 18, 21, 30],
};
const targets = {
  19: [4, 11, 12, 13, 25], 20: [10, 13, 19, 21, 30],
  18: [3, 13, 15, 17, 21], 17: [3, 15, 20, 29, 31], 16: [7, 15, 20, 24, 29],
};

function uniqueSorted(nums) { return [...new Set(nums)].sort((a, b) => a - b); }
function combos(arr, pick) {
  const out = [];
  (function h(s, st) { if (st.length === pick) { out.push([...st]); return; } for (let i = s; i <= arr.length - (pick - st.length); i++) { st.push(arr[i]); h(i + 1, st); st.pop(); } })(0, []);
  return out;
}

const intervals = [{ min: 1, max: 12 }, { min: 13, max: 24 }, { min: 25, max: 35 }];

function simpleScore(nums, freqMap, coldSet, hotSet) {
  let s = 0;
  nums.forEach((n) => {
    s += (freqMap.get(n) || 0) * 5;
    if (coldSet.has(n)) s += 20;
    if (hotSet.has(n)) s += 8;
  });
  const ivCounts = intervals.map(() => 0);
  nums.forEach((n) => { const idx = intervals.findIndex((iv) => n >= iv.min && n <= iv.max); if (idx >= 0) ivCounts[idx]++; });
  const covered = ivCounts.filter((c) => c > 0).length;
  if (covered >= 3) s += 20; else if (covered >= 2) s += 10;
  const span = nums[4] - nums[0];
  if (span >= 15 && span <= 28) s += 16; else if (span >= 12 && span <= 32) s += 8;
  return s;
}

console.log("=".repeat(60));
console.log("验证：C(35,5)=324632 全量中目标排名");
console.log("=".repeat(60));

// 对每个 case，用全量 35 号生成 10000 个随机抽样估算排名
for (const [row, targetNums] of Object.entries(targets)) {
  const rowNum = parseInt(row);
  const anchor = draws[rowNum];
  const target = uniqueSorted(targetNums);

  // 频率
  const freqMap = new Map();
  for (let r = rowNum + 1; r <= rowNum + 10; r++) {
    if (!draws[r]) continue;
    draws[r].forEach((n) => freqMap.set(n, (freqMap.get(n) || 0) + 1));
  }
  const coldSet = new Set();
  for (let i = 1; i <= 35; i++) { if (!freqMap.has(i)) coldSet.add(i); }
  const hotSet = new Set();
  freqMap.forEach((c, n) => { if (c >= 2) hotSet.add(n); });

  const targetScore = simpleScore(target, freqMap, coldSet, hotSet);

  // 随机抽样 50000 个组合估算分布
  const allNums = Array.from({ length: 35 }, (_, i) => i + 1);
  let better = 0;
  const total = 50000;
  const seen = new Set();
  seen.add(target.join(","));

  for (let k = 0; k < total; k++) {
    const combo = [];
    const pool = [...allNums];
    for (let j = 0; j < 5; j++) {
      const idx = Math.floor(Math.random() * pool.length);
      combo.push(pool[idx]);
      pool.splice(idx, 1);
    }
    combo.sort((a, b) => a - b);
    const key = combo.join(",");
    if (seen.has(key)) { k--; continue; }
    seen.add(key);
    const cs = simpleScore(combo, freqMap, coldSet, hotSet);
    if (cs > targetScore) better++;
  }

  const estRank = Math.round(better / total * 324632) + 1;
  const pct = (better / total * 100).toFixed(1);

  console.log(`第 ${rowNum} 期: 目标=[${target.join(",")}]`);
  console.log(`  目标得分: ${targetScore}`);
  console.log(`  随机抽样中 ${pct}% 的组合得分高于目标`);
  console.log(`  估算全局排名: ~${estRank}/324632 (前 ${(estRank / 324632 * 100).toFixed(1)}%)`);

  // 也看22号池
  const singleScores = allNums.map((n) => ({ number: n, score: (freqMap.get(n) || 0) * 5 + (coldSet.has(n) ? 20 : 0) + (hotSet.has(n) ? 8 : 0) }))
    .sort((a, b) => b.score - a.score);
  const poolSet = new Set();
  target.forEach((n) => poolSet.add(n));
  for (const s of singleScores) { if (poolSet.size >= 22) break; poolSet.add(s.number); }
  const pool22 = [...poolSet].sort((a, b) => a - b);
  const all22 = combos(pool22, 5);
  const ranked22 = all22.map((c) => ({ nums: c, score: simpleScore(c, freqMap, coldSet, hotSet) }))
    .sort((a, b) => b.score - a.score);
  const rank22 = ranked22.findIndex((x) => x.nums.join(",") === target.join(",")) + 1;
  console.log(`  22号池排名: ${rank22}/${all22.length}`);
  console.log(`  pool22: [${pool22.join(",")}]`);
  console.log("");
}
