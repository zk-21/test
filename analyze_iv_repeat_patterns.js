// 分析走势图中的重号+区间比联动模式
const ALL_DRAWS = [
  { issue: "2026020", front: [4, 9, 17, 28, 30], back: [3, 7] },
  { issue: "2026021", front: [8, 17, 23, 25, 35], back: [3, 9] },
  { issue: "2026022", front: [3, 6, 13, 17, 22], back: [2, 8] },
  { issue: "2026023", front: [3, 12, 16, 18, 23], back: [2, 7] },
  { issue: "2026024", front: [5, 13, 15, 23, 31], back: [2, 7] },
  { issue: "2026025", front: [6, 12, 19, 20, 35], back: [1, 4] },
  { issue: "2026026", front: [8, 10, 19, 23, 28], back: [3, 9] },
  { issue: "2026027", front: [1, 3, 5, 14, 18], back: [4, 8] },
  { issue: "2026028", front: [12, 15, 21, 23, 33], back: [4, 5] },
  { issue: "2026029", front: [13, 17, 18, 24, 28], back: [3, 12] },
  { issue: "2026030", front: [2, 4, 16, 28, 34], back: [2, 12] },
  { issue: "2026031", front: [12, 16, 25, 29, 35], back: [1, 3] },
  { issue: "2026032", front: [4, 13, 15, 20, 22], back: [3, 10] },
  { issue: "2026033", front: [3, 10, 14, 20, 31], back: [2, 4] },
  { issue: "2026034", front: [1, 16, 23, 30, 35], back: [2, 8] },
  { issue: "2026035", front: [9, 14, 21, 28, 33], back: [5, 9] },
  { issue: "2026036", front: [8, 13, 23, 26, 29], back: [2, 7] },
  { issue: "2026037", front: [7, 18, 25, 28, 30], back: [1, 4] },
  { issue: "2026038", front: [1, 3, 17, 22, 31], back: [6, 8] },
  { issue: "2026039", front: [3, 19, 24, 29, 31], back: [6, 12] },
  { issue: "2026040", front: [1, 5, 11, 17, 25], back: [2, 7] },
  { issue: "2026041", front: [9, 19, 22, 28, 35], back: [1, 4] },
  { issue: "2026042", front: [1, 7, 12, 20, 25], back: [1, 5] },
  { issue: "2026043", front: [1, 10, 12, 25, 27], back: [6, 11] },
  { issue: "2026044", front: [2, 8, 13, 19, 33], back: [1, 12] },
  { issue: "2026045", front: [6, 14, 20, 24, 32], back: [1, 5] },
  { issue: "2026046", front: [6, 9, 12, 27, 28], back: [3, 9] },
  { issue: "2026047", front: [13, 14, 17, 22, 35], back: [3, 9] },
  { issue: "2026048", front: [9, 17, 27, 29, 32], back: [1, 2] },
  { issue: "2026049", front: [1, 4, 12, 19, 27], back: [7, 9] },
  { issue: "2026050", front: [7, 11, 13, 24, 31], back: [1, 3] },
  { issue: "2026051", front: [10, 11, 21, 22, 29], back: [1, 8] },
  { issue: "2026052", front: [7, 13, 19, 20, 27], back: [1, 3] },
  { issue: "2026053", front: [4, 14, 17, 23, 30], back: [1, 6] },
  { issue: "2026054", front: [3, 4, 16, 20, 25], back: [1, 10] },
  { issue: "2026055", front: [9, 16, 18, 22, 31], back: [4, 11] },
  { issue: "2026056", front: [2, 13, 20, 24, 25], back: [1, 10] },
  { issue: "2026057", front: [15, 16, 22, 23, 32], back: [1, 5] },
  { issue: "2026058", front: [1, 7, 9, 29, 35], back: [2, 12] },
  { issue: "2026059", front: [3, 16, 17, 22, 23], back: [1, 8] },
  { issue: "2026060", front: [24, 25, 26, 29, 35], back: [4, 9] },
  { issue: "2026061", front: [11, 19, 20, 21, 22], back: [1, 10] },
  { issue: "2026062", front: [6, 10, 16, 17, 35], back: [5, 7] },
  { issue: "2026063", front: [3, 13, 19, 23, 34], back: [2, 6] },
  { issue: "2026064", front: [4, 6, 9, 19, 24], back: [2, 9] },
  { issue: "2026065", front: [6, 11, 16, 21, 35], back: [1, 6] },
  { issue: "2026066", front: [7, 10, 16, 22, 28], back: [1, 5] },
  { issue: "2026067", front: [6, 16, 18, 19, 28], back: [7, 11] },
  { issue: "2026068", front: [3, 11, 12, 21, 22], back: [6, 10] },
  { issue: "2026069", front: [12, 19, 21, 24, 29], back: [3, 10] },
];

function gi(n) { return n <= 12 ? 0 : n <= 24 ? 1 : 2; }
function iv(nums) { const r = [0,0,0]; nums.forEach(n => r[gi(n)]++); return r; }
function ivDist(a, b) { return Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]); }

console.log("═".repeat(70));
console.log("  模式分析: 最近18期 (2026051-2026069) 重号+区间比联动");
console.log("═".repeat(70));

const startIdx = ALL_DRAWS.findIndex(d => d.issue === "2026051");
const pairs = [];

for (let i = startIdx; i < ALL_DRAWS.length - 1; i++) {
  const src = ALL_DRAWS[i].front;
  const tgt = ALL_DRAWS[i + 1].front;
  const sIv = iv(src);
  const tIv = iv(tgt);
  const dist = ivDist(sIv, tIv);
  const repeats = src.filter(n => tgt.includes(n));
  const srcZones = [0,1,2].map(z => src.filter(n => gi(n) === z));
  const tgtZones = [0,1,2].map(z => tgt.filter(n => gi(n) === z));
  const repeatZones = repeats.map(n => gi(n));

  pairs.push({
    transition: `${ALL_DRAWS[i].issue}→${ALL_DRAWS[i+1].issue}`,
    srcIv: sIv.join(":"), tgtIv: tIv.join(":"), dist,
    repeatCnt: repeats.length, repeatNums: repeats, repeatZones,
    srcZoneSizes: srcZones.map(z => z.length),
    tgtZoneSizes: tgtZones.map(z => z.length),
    zoneThatZeroed: [0,1,2].filter(z => sIv[z] > 0 && tIv[z] === 0),
    zoneThatRebounded: [0,1,2].filter(z => sIv[z] === 0 && tIv[z] > 0),
    hasConsec: (() => {
      const sorted = [...src].sort((a,b)=>a-b);
      for (let j = 1; j < sorted.length; j++) if (sorted[j]-sorted[j-1] === 1) return true;
      return false;
    })(),
    consecutivePairs: (() => {
      const sorted = [...src].sort((a,b)=>a-b);
      const pairs = [];
      for (let j = 1; j < sorted.length; j++) if (sorted[j]-sorted[j-1] === 1) pairs.push([sorted[j-1], sorted[j]]);
      return pairs;
    })(),
  });
}

// 1. 按IV距离分组统计重号
console.log("\n📊 按IV变动幅度分组统计重号:");
const byDist = {};
pairs.forEach(p => {
  const cat = p.dist <= 1 ? "极小(0-1)" : p.dist === 2 ? "小(2)" : p.dist <= 4 ? "中(3-4)" : "大(5+)";
  if (!byDist[cat]) byDist[cat] = { cnt: 0, totalRepeats: 0, repeatDist: [] };
  byDist[cat].cnt++;
  byDist[cat].totalRepeats += p.repeatCnt;
  byDist[cat].repeatDist.push(p.repeatCnt);
});
Object.entries(byDist).forEach(([cat, d]) => {
  const avg = (d.totalRepeats / d.cnt).toFixed(2);
  const dist0 = d.repeatDist.filter(x => x === 0).length;
  const dist1 = d.repeatDist.filter(x => x === 1).length;
  const dist2 = d.repeatDist.filter(x => x === 2).length;
  const dist3p = d.repeatDist.filter(x => x >= 3).length;
  console.log(`  ${cat}: ${d.cnt}对 | 平均${avg}个 | 0重号:${dist0} 1重号:${dist1} 2重号:${dist2} ≥3重号:${dist3p}`);
});

// 2. 重号落在哪个区
console.log("\n📊 重号的区间分布:");
const zoneRepeats = { 0: 0, 1: 0, 2: 0 };
pairs.forEach(p => p.repeatZones.forEach(z => zoneRepeats[z]++));
const totalRepeats = zoneRepeats[0] + zoneRepeats[1] + zoneRepeats[2];
Object.entries(zoneRepeats).forEach(([z, c]) => {
  console.log(`  Zone${+z+1} (${z==0?'1-12':z==1?'13-24':'25-35'}): ${c}/${totalRepeats} (${(c/totalRepeats*100).toFixed(1)}%)`);
});

// 3. 区间归零后是否反弹
console.log("\n📊 Zone归零反弹分析:");
let zeroEvents = 0, reboundEvents = 0;
pairs.forEach(p => {
  p.zoneThatZeroed.forEach(z => zeroEvents++);
  p.zoneThatRebounded.forEach(z => reboundEvents++);
});
console.log(`  区间归零事件: ${zeroEvents}次 | 下期反弹(≥1球): ${reboundEvents}次`);

// 4. 连续号对与重号的关系
console.log("\n📊 源号连号对 → 重号分析:");
pairs.filter(p => p.hasConsec).forEach(p => {
  const repeatsFromConsec = p.consecutivePairs.flat().filter(n => p.repeatNums.includes(n));
  const bothFromSame = p.consecutivePairs.filter(pair => 
    pair.every(n => p.repeatNums.includes(n))
  ).length;
  const oneFromEach = p.consecutivePairs.filter(pair => 
    pair.some(n => p.repeatNums.includes(n)) && !pair.every(n => p.repeatNums.includes(n))
  ).length;
  console.log(`  ${p.transition} dist=${p.dist} 连号对:${JSON.stringify(p.consecutivePairs)} | 重号:${p.repeatNums} | 来自连号对:${repeatsFromConsec} | 双边:${bothFromSame} 单边:${oneFromEach}`);
});

// 5. IV两期回摆模式
console.log("\n📊 IV两期回摆(摆回前前期的IV):");
for (let i = 2; i < pairs.length; i++) {
  if (pairs[i].tgtIv === pairs[i-2].srcIv) {
    console.log(`  ${pairs[i-2].transition} → ${pairs[i-1].transition} → ${pairs[i].transition}  回摆: ${pairs[i].tgtIv}`);
  }
}

// 6. 源IV主导区的重号概率
console.log("\n📊 源IV主导区(球数最多)的重号保留:");
pairs.forEach(p => {
  const maxZone = [0,1,2].sort((a,b) => p.srcZoneSizes[b] - p.srcZoneSizes[a])[0];
  const repeatsInMax = p.repeatZones.filter(z => z === maxZone).length;
  const totalInMax = p.srcZoneSizes[maxZone];
  console.log(`  ${p.transition} 主导区Z${maxZone+1}(${totalInMax}球) → 重号${repeatsInMax}个留在主导区 (${p.repeatCnt}总重号)`);
});
