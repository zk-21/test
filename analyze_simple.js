// 轻量分析：只看数据特征，不加载评分逻辑
const draws={17:[2,9,14,20,31],18:[2,6,14,22,24],19:[9,10,20,33,35],20:[6,7,18,21,30],27:[3,15,20,29,31],28:[3,13,15,17,21],29:[4,11,12,13,25],30:[10,13,19,21,30]};

// 分析实际目标行的结构特征
console.log("=== 目标行结构特征 ===");
for(const [r,nums] of Object.entries(draws)){
  const sorted=[...nums].sort((a,b)=>a-b);
  const sum=sorted.reduce((a,b)=>a+b,0);
  const span=sorted[4]-sorted[0];
  const odd=sorted.filter(n=>n%2===1).length;
  const tails=[...new Set(sorted.map(x=>x%10))];
  let cp=0;
  for(let i=0;i<4;i++) if(sorted[i+1]===sorted[i]+1) cp++;
  const ivc=[0,0,0];
  sorted.forEach(x=>{if(x<=12)ivc[0]++;else if(x<=24)ivc[1]++;else ivc[2]++});
  console.log(`行${r}: [${sorted}] 和值${sum} 跨度${span} 奇${odd} 尾号[${tails}] 连号${cp}对 区间${ivc.join(":")}`);
}

// 选中行→目标行变化
console.log("\n=== 选中行→目标行特征变化 ===");
const tests=[{sel:19,tgt:29},{sel:20,tgt:30},{sel:18,tgt:28},{sel:17,tgt:27}];
for(const {sel,tgt} of tests){
  const s=draws[sel], t=draws[tgt];
  const sSum=s.reduce((a,b)=>a+b,0), tSum=t.reduce((a,b)=>a+b,0);
  const sOdd=s.filter(n=>n%2===1).length, tOdd=t.filter(n=>n%2===1).length;
  const sTails=[...new Set(s.map(x=>x%10))], tTails=[...new Set(t.map(x=>x%10))];
  const tailExact=sTails.filter(t=>tTails.includes(t)).length;
  const tailNb=sTails.filter(t=>tTails.some(tt=>Math.abs(tt-t)===1||(t===0&&tt===9)||(t===9&&tt===0))).length;
  console.log(`${sel}→${tgt}: 和值${sSum}→${tSum}(差${tSum-sSum}) 奇${sOdd}→${tOdd} 尾精确${tailExact} ±1${tailNb}`);
}

// 分析所有相邻行的特征变化
console.log("\n=== 所有相邻行特征变化 ===");
for(let sel=17;sel<=29;sel++){
  if(!draws[sel]||!draws[sel+1]) continue;
  const s=draws[sel], t=draws[sel+1];
  const sSum=s.reduce((a,b)=>a+b,0), tSum=t.reduce((a,b)=>a+b,0);
  const sOdd=s.filter(n=>n%2===1).length, tOdd=t.filter(n=>n%2===1).length;
  const sSpan=Math.max(...s)-Math.min(...s), tSpan=Math.max(...t)-Math.min(...t);
  const sTails=[...new Set(s.map(x=>x%10))], tTails=[...new Set(t.map(x=>x%10))];
  const tailExact=sTails.filter(t=>tTails.includes(t)).length;
  const tailNb=sTails.filter(t=>tTails.some(tt=>Math.abs(tt-t)===1||(t===0&&tt===9)||(t===9&&tt===0))).length;
  const sIv=[0,0,0],tIv=[0,0,0];
  s.forEach(x=>{if(x<=12)sIv[0]++;else if(x<=24)sIv[1]++;else sIv[2]++});
  t.forEach(x=>{if(x<=12)tIv[0]++;else if(x<=24)tIv[1]++;else tIv[2]++});
  console.log(`${sel}→${sel+1}: 和值差${tSum-sSum>0?'+':''}${tSum-sSum} 奇${sOdd}→${tOdd} 跨度${sSpan}→${tSpan} 尾精确${tailExact} ±1${tailNb} 区间${sIv.join(":")}→${tIv.join(":")}`);
}

// 关键问题：18→28为什么难？
console.log("\n=== 18→28深度分析 ===");
const r18=draws[18], r28=draws[28];
console.log(`行18: [${r18}] 全偶数!`);
console.log(`行28: [${r28}] 全奇数!`);
console.log(`完全奇偶翻转`);
console.log(`行18尾号: [${[...new Set(r18.map(x=>x%10))]}]`);
console.log(`行28尾号: [${[...new Set(r28.map(x=>x%10))]}]`);
console.log(`精确重复: ${[...new Set(r18.map(x=>x%10))].filter(t=>[...new Set(r28.map(x=>x%10))].includes(t)).length}个`);
console.log(`行18号码: 2,6,14,22,24 → 行28号码: 3,13,15,17,21`);
console.log(`号码交集: ${r18.filter(n=>r28.includes(n))}`);
console.log(`±1邻号: ${r18.filter(n=>r28.some(m=>Math.abs(m-n)===1)).length}个`);
console.log(`±2邻号: ${r18.filter(n=>r28.some(m=>Math.abs(m-n)===2)).length}个`);
// 分析号码间的差值关系
console.log(`差值矩阵:`);
r28.forEach(t=>{
  const diffs=r18.map(s=>t-s);
  console.log(`  ${t}: ${r18.map((s,i)=>`${s}(${diffs[i]>0?'+':''}${diffs[i]})`).join(" ")}`);
});
