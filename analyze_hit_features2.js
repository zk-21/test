// 简化版命中特征分析
const draws={17:[2,9,14,20,31],18:[2,6,14,22,24],19:[9,10,20,33,35],20:[6,7,18,21,30],27:[3,15,20,29,31],28:[3,13,15,17,21],29:[4,11,12,13,25],30:[10,13,19,21,30]};
const fs = require('fs');
const code = fs.readFileSync('verify_top5.js','utf8');
const funcEnd = code.indexOf('// 测试4组');
eval(code.substring(0, funcEnd));

const tests=[{sel:19,target:29},{sel:20,target:30},{sel:18,target:28},{sel:17,target:27}];

console.log("=== Top5组合特征 vs 命中 ===\n");
const allData={hit0:[],hit1:[],hit2:[],hit3:[]};

for(const t of tests){
  const selNums=draws[t.sel];
  const selTails=[...new Set(selNums.map(x=>x%10))];
  const targetNums=draws[t.target];
  const targetSet=new Set(targetNums);
  
  const top5=rr(t.sel,1);
  console.log(`行${t.sel}→${t.target}:`);
  
  top5.forEach((c,i)=>{
    const hits=c.nums.filter(n=>targetSet.has(n)).length;
    const sorted=[...c.nums].sort((a,b)=>a-b);
    const sum=sorted.reduce((a,b)=>a+b,0);
    const span=sorted[4]-sorted[0];
    const odd=sorted.filter(n=>n%2===1).length;
    const tails=[...new Set(sorted.map(x=>x%10))];
    const tailOv=tails.filter(t=>selTails.includes(t)).length;
    let cp=0;
    for(let j=0;j<4;j++) if(sorted[j+1]===sorted[j]+1) cp++;
    const ivc=[0,0,0];
    sorted.forEach(x=>{if(x<=12)ivc[0]++;else if(x<=24)ivc[1]++;else ivc[2]++});
    
    const d={sum,span,odd,tailOv,cp,ratio:ivc.join(":"),tps:c.tps||0,hits};
    const key=hits>=3?'hit3':`hit${hits}`;
    allData[key].push(d);
    
    console.log(`  #${i+1} 命中${hits} 和值${sum} 跨度${span} 奇${odd} 尾重${tailOv} 连号${cp} 区间${ivc.join(":")} tps=${c.tps||0}`);
  });
  console.log();
}

console.log("=== 按命中分组的特征均值 ===");
for(const [key,data] of Object.entries(allData)){
  if(data.length===0){console.log(`${key}: 无数据`);continue;}
  const avg=(fn)=>(data.reduce((s,x)=>s+fn(x),0)/data.length).toFixed(1);
  console.log(`${key}(n=${data.length}): 和值${avg(x=>x.sum)} 跨度${avg(x=>x.span)} 奇数${avg(x=>x.odd)} 尾重${avg(x=>x.tailOv)} 连号${avg(x=>x.cp)} tps${avg(x=>x.tps)}`);
}
