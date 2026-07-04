// 分析所有组合的命中特征，找出高命中组合的区分性特征
const draws={17:[2,9,14,20,31],18:[2,6,14,22,24],19:[9,10,20,33,35],20:[6,7,18,21,30],27:[3,15,20,29,31],28:[3,13,15,17,21],29:[4,11,12,13,25],30:[10,13,19,21,30]};
const fs = require('fs');
const code = fs.readFileSync('verify_top5.js','utf8');
const funcEnd = code.indexOf('// 测试4组');
eval(code.substring(0, funcEnd));

const tests=[
  {sel:19,target:29},
  {sel:20,target:30},
  {sel:18,target:28},
  {sel:17,target:27},
];

// 收集所有组合（不只是Top5），分析命中球数的分布特征
console.log("=== 扩展分析：Top20组合特征对比 ===\n");

for(const t of tests){
  const selNums=draws[t.sel];
  const selTails=[...new Set(selNums.map(x=>x%10))];
  const targetNums=draws[t.target];
  const targetSet=new Set(targetNums);
  const targetTails=[...new Set(targetNums.map(x=>x%10))];
  
  const top20=rr(t.sel,1).slice(0,20);
  
  // 按命中数分组
  const hitGroups = {};
  top20.forEach((c,i)=>{
    const hits=c.nums.filter(n=>targetSet.has(n)).length;
    if(!hitGroups[hits]) hitGroups[hits]=[];
    
    const sorted=[...c.nums].sort((a,b)=>a-b);
    const sum=sorted.reduce((a,b)=>a+b,0);
    const span=sorted[4]-sorted[0];
    const odd=sorted.filter(n=>n%2===1).length;
    const tails=[...new Set(sorted.map(x=>x%10))];
    const tailOverlap=tails.filter(t=>selTails.includes(t)).length;
    
    // 连号对数
    let consecPairs=0;
    for(let i=0;i<4;i++) if(sorted[i+1]===sorted[i]+1) consecPairs++;
    
    // 区间比
    const ivc=[0,0,0];
    sorted.forEach(x=>{if(x<=12)ivc[0]++;else if(x<=24)ivc[1]++;else ivc[2]++});
    
    // 与锚点号码的重叠
    const ref=rr(t.sel,1); // 获取锚点
    
    hitGroups[hits].push({
      nums:c.nums, sum, span, odd, tailOverlap, consecPairs, 
      ratio:ivc.join(":"), tails, tps:c.tps||0, score:c.sc
    });
  });
  
  console.log(`\n行${t.sel}→${t.target} [${selNums}] → [${targetNums}]`);
  console.log(`  目标: 区间比=${[...targetNums].sort((a,b)=>a-b).map(x=>x<=12?'A':x<=24?'B':'C').reduce((acc,x)=>{acc[x]=(acc[x]||0)+1;return acc},{})} 和值=${targetNums.reduce((a,b)=>a+b,0)} 跨度=${Math.max(...targetNums)-Math.min(...targetNums)} 奇数=${targetNums.filter(n=>n%2===1).length}`);
  
  for(const [hits, combos] of Object.entries(hitGroups).sort((a,b)=>b[0]-a[0])){
    console.log(`  命中${hits}球 (${combos.length}组):`);
    const avgSum = (combos.reduce((s,c)=>s+c.sum,0)/combos.length).toFixed(0);
    const avgSpan = (combos.reduce((s,c)=>s+c.span,0)/combos.length).toFixed(0);
    const avgOdd = (combos.reduce((s,c)=>s+c.odd,0)/combos.length).toFixed(1);
    const avgTO = (combos.reduce((s,c)=>s+c.tailOverlap,0)/combos.length).toFixed(1);
    const avgConsec = (combos.reduce((s,c)=>s+c.consecPairs,0)/combos.length).toFixed(1);
    const avgTps = (combos.reduce((s,c)=>s+c.tps,0)/combos.length).toFixed(0);
    
    // 区间比分布
    const ratioDist={};
    combos.forEach(c=>{ratioDist[c.ratio]=(ratioDist[c.ratio]||0)+1});
    
    console.log(`    平均和值=${avgSum} 跨度=${avgSpan} 奇数=${avgOdd} 尾号重复=${avgTO} 连号对=${avgConsec} 尾号模式分=${avgTps}`);
    console.log(`    区间比分布: ${JSON.stringify(ratioDist)}`);
    if(combos.length<=5) combos.forEach(c=>console.log(`      [${c.nums.join(",")}] 和值=${c.sum} 跨度=${c.span} 奇=${c.odd} 尾重=${c.tailOverlap} 连号=${c.consecPairs} 区间=${c.ratio} tps=${c.tps}`));
  }
}

// === 综合分析：哪些特征与高命中强相关？ ===
console.log("\n\n=== 综合特征对比 ===");
console.log("特征\t\t命中0\t命中1\t命中2\t命中3+");

const allCombos = {0:[], 1:[], 2:[], '3+':[]};
for(const t of tests){
  const selNums=draws[t.sel];
  const selTails=[...new Set(selNums.map(x=>x%10))];
  const targetNums=draws[t.target];
  const targetSet=new Set(targetNums);
  
  const top20=rr(t.sel,1).slice(0,20);
  top20.forEach(c=>{
    const hits=c.nums.filter(n=>targetSet.has(n)).length;
    const sorted=[...c.nums].sort((a,b)=>a-b);
    const sum=sorted.reduce((a,b)=>a+b,0);
    const span=sorted[4]-sorted[0];
    const odd=sorted.filter(n=>n%2===1).length;
    const tails=[...new Set(sorted.map(x=>x%10))];
    const tailOverlap=tails.filter(t=>selTails.includes(t)).length;
    let consecPairs=0;
    for(let i=0;i<4;i++) if(sorted[i+1]===sorted[i]+1) consecPairs++;
    
    const key = hits>=3?'3+':hits;
    if(allCombos[key]) allCombos[key].push({sum,span,odd,tailOverlap,consecPairs,tps:c.tps||0});
  });
}

for(const [key, combos] of Object.entries(allCombos)){
  if(combos.length===0) continue;
  const avg = (arr,fn) => (arr.reduce((s,x)=>s+fn(x),0)/arr.length).toFixed(1);
  console.log(`${key}\t\t和值${avg(combos,c=>c.sum)} 跨度${avg(combos,c=>c.span)} 奇${avg(combos,c=>c.odd)} 尾重${avg(combos,c=>c.tailOverlap)} 连号${avg(combos,c=>c.consecPairs)} tps${avg(combos,c=>c.tps)} (n=${combos.length})`);
}
