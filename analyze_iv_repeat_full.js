// 全量历史数据：区间比 + 重号 规律挖掘
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'optimized_picker.js'), 'utf-8');

// 提取 ALL_DRAWS 数据
const match = src.match(/const ALL_DRAWS\s*=\s*\[([\s\S]*?)\];/);
if (!match) { console.log("找不到ALL_DRAWS"); process.exit(1); }
let text = match[1];
const draws = [];
const re = /\{\s*issue:\s*"(\d+)",\s*front:\s*\[([\d,\s]+)\]/g;
let m;
while ((m = re.exec(text)) !== null) {
  draws.push({
    issue: m[1],
    front: m[2].split(',').map(s => parseInt(s.trim()))
  });
}
console.log(`总历史期数: ${draws.length}`);

function gi(n) { return n <= 12 ? 0 : n <= 24 ? 1 : 2; }
function iv(nums) { const r = [0,0,0]; nums.forEach(n => r[gi(n)]++); return r; }
function ivDist(a, b) { return Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]); }

// === 1. 整体统计：重号分布 ===
console.log("\n" + "=".repeat(65));
console.log("1. 全量历史 重号数量分布");
console.log("=".repeat(65));
const repeatCounts = {0:0,1:0,2:0,3:0,4:0,5:0};
let totalRepeats = 0, totalTransitions = 0;
for (let i = 0; i < draws.length - 1; i++) {
  const src = draws[i].front, tgt = draws[i+1].front;
  const cnt = src.filter(n => tgt.includes(n)).length;
  repeatCounts[cnt] = (repeatCounts[cnt] || 0) + 1;
  totalRepeats += cnt;
  totalTransitions++;
}
console.log("重号数 | 次数 | 占比");
Object.entries(repeatCounts).forEach(([k, v]) => {
  console.log(`  ${k}个    | ${String(v).padStart(3)} | ${(v/totalTransitions*100).toFixed(1)}%`);
});
console.log(`平均重号: ${(totalRepeats/totalTransitions).toFixed(2)}个/期`);

// === 2. IV变动幅度 vs 重号 ===
console.log("\n" + "=".repeat(65));
console.log("2. IV距离(dist) vs 重号数量");
console.log("=".repeat(65));
const distGroups = {};
for (let i = 0; i < draws.length - 1; i++) {
  const src = draws[i].front, tgt = draws[i+1].front;
  const d = ivDist(iv(src), iv(tgt));
  const cnt = src.filter(n => tgt.includes(n)).length;
  if (!distGroups[d]) distGroups[d] = { count:0, totalRepeats:0, repeatDist:[] };
  distGroups[d].count++;
  distGroups[d].totalRepeats += cnt;
  distGroups[d].repeatDist.push(cnt);
}
console.log("dist | 次数 | 平均重号 | 0重 1重 2重 ≥3重");
Object.entries(distGroups).sort((a,b) => +a[0] - +b[0]).forEach(([d, g]) => {
  const r0 = g.repeatDist.filter(x=>x===0).length;
  const r1 = g.repeatDist.filter(x=>x===1).length;
  const r2 = g.repeatDist.filter(x=>x===2).length;
  const r3 = g.repeatDist.filter(x=>x>=3).length;
  console.log(`  ${d.padStart(2)}  | ${String(g.count).padStart(4)} | ${(g.totalRepeats/g.count).toFixed(2).padStart(6)} | ${String(r0).padStart(3)} ${String(r1).padStart(3)} ${String(r2).padStart(3)} ${String(r3).padStart(3)}`);
});

// 归类: 小变动(≤2), 中变动(3-4), 大变动(5+)
const catGroups = { '小≤2': {count:0, r:[]}, '中3-4': {count:0, r:[]}, '大≥5': {count:0, r:[]} };
for (let i = 0; i < draws.length - 1; i++) {
  const src = draws[i].front, tgt = draws[i+1].front;
  const d = ivDist(iv(src), iv(tgt));
  const cnt = src.filter(n => tgt.includes(n)).length;
  const cat = d <= 2 ? '小≤2' : d >= 5 ? '大≥5' : '中3-4';
  catGroups[cat].count++;
  catGroups[cat].r.push(cnt);
}
console.log("\n归类汇总:");
Object.entries(catGroups).forEach(([cat, g]) => {
  const avg = (g.r.reduce((a,b)=>a+b,0)/g.count).toFixed(2);
  const r0 = g.r.filter(x=>x===0).length;
  const r1 = g.r.filter(x=>x===1).length;
  const r2 = g.r.filter(x=>x===2).length;
  const r3 = g.r.filter(x=>x>=3).length;
  console.log(`  ${cat}: ${g.count}次 | 平均${avg}重号 | 0:${r0} 1:${r1} 2:${r2} ≥3:${r3} | 0重占比${(r0/g.count*100).toFixed(0)}%`);
});

// === 3. 重号落在各区间 ===
console.log("\n" + "=".repeat(65));
console.log("3. 重号落在哪个区");
console.log("=".repeat(65));
const zoneRepeats = [0,0,0];
for (let i = 0; i < draws.length - 1; i++) {
  const src = draws[i].front, tgt = draws[i+1].front;
  const repeats = src.filter(n => tgt.includes(n));
  repeats.forEach(n => zoneRepeats[gi(n)]++);
}
const totalR = zoneRepeats.reduce((a,b)=>a+b,0);
console.log(`  Zone1 (1-12):  ${zoneRepeats[0]}/${totalR} (${(zoneRepeats[0]/totalR*100).toFixed(1)}%)`);
console.log(`  Zone2 (13-24): ${zoneRepeats[1]}/${totalR} (${(zoneRepeats[1]/totalR*100).toFixed(1)}%)`);
console.log(`  Zone3 (25-35): ${zoneRepeats[2]}/${totalR} (${(zoneRepeats[2]/totalR*100).toFixed(1)}%)`);

// === 4. Zone归零反弹 ===
console.log("\n" + "=".repeat(65));
console.log("4. 源期某区=0 → 下期该区是否有球");
console.log("=".repeat(65));
let zeroEvents = 0, reboundEvents = 0, noReboundEvents = 0;
const noReboundCases = [];
for (let i = 0; i < draws.length - 1; i++) {
  const sIv = iv(draws[i].front);
  const tIv = iv(draws[i+1].front);
  [0,1,2].forEach(z => {
    if (sIv[z] === 0) {
      zeroEvents++;
      if (tIv[z] > 0) reboundEvents++;
      else { noReboundEvents++; noReboundCases.push(`${draws[i].issue}→${draws[i+1].issue} Z${z+1}`); }
    }
  });
}
console.log(`  归零总次数: ${zeroEvents}`);
console.log(`  下期反弹(≥1球): ${reboundEvents} (${(reboundEvents/zeroEvents*100).toFixed(1)}%)`);
console.log(`  下期持续归零: ${noReboundEvents} (${(noReboundEvents/zeroEvents*100).toFixed(1)}%)`);
if (noReboundCases.length > 0) {
  console.log(`  持续归零案例: ${noReboundCases.join(', ')}`);
}

// === 5. 源IV → 目标IV转移矩阵 ===
console.log("\n" + "=".repeat(65));
console.log("5. 源区间比 → 目标区间比 Top转移 (按频次)");
console.log("=".repeat(65));
const transitions = {};
for (let i = 0; i < draws.length - 1; i++) {
  const sKey = iv(draws[i].front).join(":");
  const tKey = iv(draws[i+1].front).join(":");
  if (!transitions[sKey]) transitions[sKey] = {};
  transitions[sKey][tKey] = (transitions[sKey][tKey] || 0) + 1;
}
const srcKeys = Object.keys(transitions).sort((a,b) => {
  const totalA = Object.values(transitions[a]).reduce((x,y)=>x+y,0);
  const totalB = Object.values(transitions[b]).reduce((x,y)=>x+y,0);
  return totalB - totalA;
});
srcKeys.forEach(sKey => {
  const total = Object.values(transitions[sKey]).reduce((x,y)=>x+y,0);
  const top3 = Object.entries(transitions[sKey])
    .sort((a,b) => b[1] - a[1]).slice(0, 3);
  const dists = top3.map(([tKey]) => ivDist(sKey.split(":").map(Number), tKey.split(":").map(Number)));
  console.log(`  ${sKey} (${total}次) → ${top3.map(([t,c],i) => `${t}(${c}次,d=${dists[i]})`).join(' | ')}`);
});

// === 6. 大变动(dist≥5)特征 ===
console.log("\n" + "=".repeat(65));
console.log("6. 大变动(dist≥5)案例详情");
console.log("=".repeat(65));
let bigMoveCount = 0;
for (let i = 0; i < draws.length - 1; i++) {
  const src = draws[i].front, tgt = draws[i+1].front;
  const sIv = iv(src), tIv = iv(tgt);
  const d = ivDist(sIv, tIv);
  if (d >= 5) {
    bigMoveCount++;
    const rpts = src.filter(n => tgt.includes(n));
    console.log(`  ${draws[i].issue}→${draws[i+1].issue} | ${sIv.join(":")}→${tIv.join(":")} | d=${d} | 重号:${rpts.length}个 [${rpts}]`);
  }
}
console.log(`  大变动总计: ${bigMoveCount}次`);

// === 7. 小变动(dist≤2)特征 ===
console.log("\n" + "=".repeat(65));
console.log("7. 小变动(dist≤2)重号特征");
console.log("=".repeat(65));
let smallData = [];
for (let i = 0; i < draws.length - 1; i++) {
  const src = draws[i].front, tgt = draws[i+1].front;
  const sIv = iv(src), tIv = iv(tgt);
  const d = ivDist(sIv, tIv);
  if (d <= 2) {
    const rpts = src.filter(n => tgt.includes(n));
    smallData.push({ transition: `${draws[i].issue}→${draws[i+1].issue}`, d, repeats: rpts, repCnt: rpts.length });
  }
}
const smallByRep = {0:[],1:[],2:[],3:[]};
smallData.forEach(x => { if (smallByRep[x.repCnt]) smallByRep[x.repCnt].push(x); else smallByRep[3].push(x); });
console.log(`  小变动总次数: ${smallData.length}`);
Object.entries(smallByRep).forEach(([k, v]) => {
  console.log(`    ${k}重号: ${v.length}次 (${(v.length/smallData.length*100).toFixed(0)}%)`);
});
console.log("  最近10次小变动案例:");
smallData.slice(-10).forEach(x => {
  console.log(`    ${x.transition} d=${x.d} 重号${x.repCnt}个 [${x.repeats}]`);
});
