// 分析结构性约束：奇偶比、和值范围、号码间距、连号模式
const draws={17:[2,9,14,20,31],18:[2,6,14,22,24],19:[9,10,20,33,35],20:[6,7,18,21,30],27:[3,15,20,29,31],28:[3,13,15,17,21],29:[4,11,12,13,25],30:[10,13,19,21,30]};

// === 1. 奇偶比分析 ===
console.log("=== 1. 奇偶比分析 ===");
const oeMap = {};
for(const [r, nums] of Object.entries(draws)){
  const odd = nums.filter(n=>n%2===1).length;
  const even = 5-odd;
  const key = `${odd}:${even}`;
  oeMap[key] = (oeMap[key]||0)+1;
}
console.log("所有行奇偶比分布:", oeMap);

// 选中行→目标行的奇偶比变化
const oeTests = [[19,29],[20,30],[18,28],[17,27]];
for(const [sel,target] of oeTests){
  const selOdd = draws[sel].filter(n=>n%2===1).length;
  const tgtOdd = draws[target].filter(n=>n%2===1).length;
  console.log(`  行${sel}(${selOdd}奇${5-selOdd}偶) → 行${target}(${tgtOdd}奇${5-tgtOdd}偶) 变化:${tgtOdd-selOdd>0?'+':''}${tgtOdd-selOdd}`);
}

// === 2. 和值分析 ===
console.log("\n=== 2. 和值分析 ===");
const sums = {};
for(const [r, nums] of Object.entries(draws)){
  const sum = nums.reduce((a,b)=>a+b,0);
  sums[r] = sum;
}
console.log("所有行和值:", sums);
for(const [sel,target] of oeTests){
  const selSum = draws[sel].reduce((a,b)=>a+b,0);
  const tgtSum = draws[target].reduce((a,b)=>a+b,0);
  console.log(`  行${sel}(和值${selSum}) → 行${target}(和值${tgtSum}) 差:${tgtSum-selSum}`);
}

// === 3. 号码间距（span）分析 ===
console.log("\n=== 3. 号码跨度分析 ===");
for(const [r, nums] of Object.entries(draws)){
  const sorted = [...nums].sort((a,b)=>a-b);
  const span = sorted[4]-sorted[0];
  const gaps = [];
  for(let i=1;i<5;i++) gaps.push(sorted[i]-sorted[i-1]);
  console.log(`  行${r}: [${sorted.join(",")}] 跨度=${span} 间距=[${gaps.join(",")}]`);
}

// === 4. 连号对分析 ===
console.log("\n=== 4. 连号对分析 ===");
for(const [r, nums] of Object.entries(draws)){
  const sorted = [...nums].sort((a,b)=>a-b);
  const pairs = [];
  for(let i=0;i<4;i++){
    if(sorted[i+1]===sorted[i]+1) pairs.push(`${sorted[i]},${sorted[i+1]}`);
  }
  console.log(`  行${r}: ${pairs.length}对连号 ${pairs.length>0?'['+pairs.join('; ')+']':''}`);
}

// === 5. 选中行→目标行的尾号±1转移 ===
console.log("\n=== 5. 尾号±1邻号转移分析 ===");
for(const [sel,target] of oeTests){
  const selTails = [...new Set(draws[sel].map(n=>n%10))];
  const tgtNums = draws[target];
  const tgtTails = [...new Set(tgtNums.map(n=>n%10))];
  
  // 精确匹配
  const exactMatch = selTails.filter(t=>tgtTails.includes(t));
  // ±1匹配
  const neighbor1 = selTails.filter(t=>{
    return tgtTails.some(tt=>Math.abs(tt-t)===1 || (t===0&&tt===9) || (t===9&&tt===0));
  });
  // ±2匹配
  const neighbor2 = selTails.filter(t=>{
    return tgtTails.some(tt=>Math.abs(tt-t)===2 || Math.abs(tt-t)===8);
  });
  
  console.log(`  行${sel}→${target}: 精确=${exactMatch.length}个[${exactMatch}] ±1=${neighbor1.length}个[${neighbor1}] ±2=${neighbor2.length}个[${neighbor2}]`);
}

// === 6. 选中行奇偶比 vs 目标行奇偶比匹配度 ===
console.log("\n=== 6. 奇偶比变化规律（扩展） ===");
const allPairs = [];
for(let sel=17;sel<=29;sel++){
  if(!draws[sel]||!draws[sel+1]) continue;
  const selOdd = draws[sel].filter(n=>n%2===1).length;
  const tgtOdd = draws[sel+1].filter(n=>n%2===1).length;
  allPairs.push({sel, selOdd, tgtOdd, diff: tgtOdd-selOdd});
}
console.log("相邻行奇数个数变化:");
allPairs.forEach(p=>console.log(`  行${p.sel}(${p.selOdd}奇) → 行${p.sel+1}(${p.tgtOdd}奇) 差:${p.diff>0?'+':''}${p.diff}`));
const avgOddChange = allPairs.reduce((s,p)=>s+Math.abs(p.diff),0)/allPairs.length;
console.log(`  平均变化幅度: ${avgOddChange.toFixed(1)}`);

// === 7. 和值范围与命中率关系 ===
console.log("\n=== 7. 和值变化规律 ===");
for(let sel=17;sel<=29;sel++){
  if(!draws[sel]||!draws[sel+1]) continue;
  const selSum = draws[sel].reduce((a,b)=>a+b,0);
  const tgtSum = draws[sel+1].reduce((a,b)=>a+b,0);
  console.log(`  行${sel}(和值${selSum}) → 行${sel+1}(和值${tgtSum}) 差:${tgtSum-selSum>0?'+':''}${tgtSum-selSum}`);
}

// === 8. 区间比转移规律 ===
console.log("\n=== 8. 区间比转移规律 ===");
const iv=[{min:1,max:12},{min:13,max:24},{min:25,max:35}];
function grk(nums){
  const c=[0,0,0];
  nums.forEach(n=>{
    const idx=iv.findIndex(i=>n>=i.min&&n<=i.max);
    if(idx>=0)c[idx]++;
  });
  return c.join(":");
}
for(let sel=17;sel<=29;sel++){
  if(!draws[sel]||!draws[sel+1]) continue;
  console.log(`  行${sel}[${grk(draws[sel])}] → 行${sel+1}[${grk(draws[sel+1])}]`);
}

// === 9. 分析Top5组合的奇偶比/和值是否与实际匹配 ===
console.log("\n=== 9. 当前Top5组合结构特征 ===");
// 加载verify_top5逻辑
const fs = require('fs');
// 直接内联简化版评分
function gu(n=[]){return[...new Set((Array.isArray(n)?n:[]).map(Number).filter(x=>Number.isInteger(x)&&x>0))].sort((a,b)=>a-b)}
function gi(n){return iv.findIndex(i=>n>=i.min&&n<=i.max)}
function grk2(n){const c=[0,0,0];n.forEach(x=>{const d=gi(x);if(d>=0)c[d]++});return c.join(":")}

// 统计所有可能组合的奇偶比和和值分布
console.log("5球组合的合理范围:");
console.log("  奇数个数: 0-5 (常见1-4)");
console.log("  和值范围: 最小=1+2+3+4+5=15, 最大=31+32+33+34+35=165");
console.log("  实际数据和值:", Object.entries(sums).map(([r,s])=>`行${r}=${s}`).join(", "));
const allSums = Object.values(sums);
console.log(`  和值均值: ${(allSums.reduce((a,b)=>a+b,0)/allSums.length).toFixed(0)}`);
console.log(`  和值范围: ${Math.min(...allSums)}-${Math.max(...allSums)}`);
