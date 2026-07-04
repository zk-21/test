// verify3.js — 快速抽样版：不同 pool size 下目标排名

const draws = {
  16: [2, 3, 14, 20, 28], 17: [2, 9, 14, 20, 31], 18: [2, 6, 14, 22, 24],
  19: [9, 10, 20, 33, 35], 20: [6, 7, 18, 21, 30], 21: [23, 25, 26, 27, 34],
  22: [7, 12, 13, 18, 34], 23: [6, 13, 17, 19, 26], 24: [22, 28, 30, 31, 34],
  25: [10, 12, 15, 26, 35], 26: [7, 15, 20, 24, 29], 27: [3, 15, 20, 29, 31],
  28: [3, 13, 15, 17, 21], 29: [4, 11, 12, 13, 25],
};
const targets = {
  19: [4, 11, 12, 13, 25], 20: [10, 13, 19, 21, 30],
  18: [3, 13, 15, 17, 21], 17: [3, 15, 20, 29, 31], 16: [7, 15, 20, 24, 29],
};

function uniqueSorted(nums) { return [...new Set(nums)].sort((a, b) => a - b); }

function fullScore(nums, freqMap, coldSet, hotSet) {
  let s = 0;
  nums.forEach((n) => { s += (freqMap.get(n) || 0) * 5; if (coldSet.has(n)) s += 20; if (hotSet.has(n)) s += 8; });
  const ivs = [0, 0, 0];
  nums.forEach((n) => { const idx = n <= 12 ? 0 : n <= 24 ? 1 : 2; ivs[idx]++; });
  const covered = ivs.filter((c) => c > 0).length;
  if (covered >= 3) s += 20; else if (covered >= 2) s += 10;
  const span = nums[4] - nums[0];
  if (span >= 15 && span <= 28) s += 16; else if (span >= 12 && span <= 32) s += 8;
  const maxIv = Math.max(...ivs);
  if (maxIv >= 4) s -= (maxIv - 3) * 10;
  let runPenalty = 0, cr = 0;
  for (let i = 0; i < nums.length; i++) {
    if (i === 0 || nums[i] !== nums[i - 1] + 1) cr = 1; else cr++;
    if (cr >= 2 && (i === nums.length - 1 || nums[i + 1] !== nums[i] + 1)) {
      if (cr === 2) runPenalty += 8; else if (cr === 3) runPenalty += 24; else runPenalty += 50;
    }
  }
  s -= runPenalty;
  for (let i = 0; i <= nums.length - 3; i++) { if (nums[i + 2] - nums[i] <= 8) s -= 6; }
  return s;
}

console.log("Pool扩大效果验证（抽样50000次）");
console.log("=".repeat(50));

for (const [row, targetNums] of Object.entries(targets)) {
  const rowNum = parseInt(row);
  const target = uniqueSorted(targetNums);

  const freqMap = new Map();
  for (let r = rowNum + 1; r <= rowNum + 10; r++) {
    if (!draws[r]) continue;
    draws[r].forEach((n) => freqMap.set(n, (freqMap.get(n) || 0) + 1));
  }
  const coldSet = new Set();
  for (let i = 1; i <= 35; i++) { if (!freqMap.has(i)) coldSet.add(i); }
  const hotSet = new Set();
  freqMap.forEach((c, n) => { if (c >= 2) hotSet.add(n); });

  const targetScore = fullScore(target, freqMap, coldSet, hotSet);

  const singles = Array.from({ length: 35 }, (_, i) => i + 1)
    .map((n) => ({ n, sc: (freqMap.get(n) || 0) * 5 + (coldSet.has(n) ? 20 : 0) + (hotSet.has(n) ? 8 : 0) }))
    .sort((a, b) => b.sc - a.sc || a.n - b.n);

  console.log(`\n第 ${rowNum} 期: 目标=${targetScore}分`);

  for (const PS of [22, 26, 30, 35]) {
    const poolSet = new Set();
    target.forEach((n) => poolSet.add(n));
    for (const s of singles) { if (poolSet.size >= PS) break; poolSet.add(s.n); }
    const pool = [...poolSet].sort((a, b) => a - b);

    const SAMPLES = 10000;
    let better = 0;
    const seen = new Set();
    seen.add(target.join(","));
    for (let k = 0; k < SAMPLES; k++) {
      const combo = [];
      const p = [...pool];
      for (let j = 0; j < 5; j++) { const idx = Math.floor(Math.random() * p.length); combo.push(p[idx]); p.splice(idx, 1); }
      combo.sort((a, b) => a - b);
      const key = combo.join(",");
      if (seen.has(key)) { k--; continue; }
      seen.add(key);
      if (fullScore(combo, freqMap, coldSet, hotSet) > targetScore) better++;
    }
    const totalCombos = (() => { let n = 1, d = 1; for (let i = 0; i < 5; i++) { n *= (PS - i); d *= (i + 1); } return Math.round(n / d); })();
    const estRank = Math.round(better / SAMPLES * totalCombos) + 1;
    const pct = (estRank / totalCombos * 100).toFixed(1);
    const flag = estRank <= 5 ? "★前五★" : estRank <= 10 ? "✓前十" : "";
    console.log(`  Pool=${PS}: ~${estRank}/${totalCombos} (前${pct}%) ${flag}`);
  }
}
