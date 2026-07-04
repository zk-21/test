// 测试尾号等差、重复、互补约束对命中率的影响
const draws={17:[2,9,14,20,31],18:[2,6,14,22,24],19:[9,10,20,33,35],20:[6,7,18,21,30],27:[3,15,20,29,31],28:[3,13,15,17,21],29:[4,11,12,13,25],30:[10,13,19,21,30]};

function tails(n){return n.map(x=>x%10)}
function tailSet(n){return new Set(n.map(x=>x%10))}

// 尾号模式评分函数
function scoreTailPattern(comboTails, selTails){
  let score=0;
  const comboSet=new Set(comboTails);
  const selSet=new Set(selTails);
  
  // 1. 共同尾号加分（相邻行尾号延续）
  const common=[...comboSet].filter(t=>selSet.has(t));
  score+=common.length*10;
  
  // 2. 重复尾号加分（50%出现率）
  const tailCount=new Map();
  comboTails.forEach(t=>tailCount.set(t,(tailCount.get(t)||0)+1));
  const repeats=[...tailCount.entries()].filter(([t,c])=>c>=2);
  if(repeats.length>0)score+=repeats.length*8;
  
  // 3. 等差尾号加分（100%出现率，最强信号）
  // 检查d=1,2,3的等差序列
  const uniqueTails=[...comboSet].sort((a,b)=>a-b);
  for(let d=1;d<=3;d++){
    for(let start=0;start<=9;start++){
      const seq=[];
      for(let v=start;v<=9;v+=d)seq.push(v);
      const matched=seq.filter(v=>comboSet.has(v));
      if(matched.length>=3)score+=matched.length*5;
    }
  }
  
  // 4. 互补尾号加分（100%出现率）
  const compPairs=[[1,9],[2,8],[3,7],[4,6]];
  compPairs.forEach(([a,b])=>{
    if(comboSet.has(a)&&comboSet.has(b))score+=8;
  });
  if(comboSet.has(0)&&comboSet.has(0))score+=4; // 0+0=10
  
  return score;
}

// 测试：用尾号约束重新评分现有组合
const tests=[
  {sel:19,target:29,combos:[[11,12,16,19,20],[8,12,19,20,21],[11,12,15,19,20],[8,11,17,19,20],[11,12,17,19,20]]},
  {sel:20,target:30,combos:[[10,16,19,20,34],[10,14,19,20,34],[9,14,19,20,34],[10,18,19,20,34],[10,11,19,20,34]]},
  {sel:18,target:28,combos:[[11,12,20,21,32],[11,12,21,23,32],[10,12,20,21,32],[11,12,19,21,32],[11,12,15,21,32]]},
  {sel:17,target:27,combos:[[11,12,20,21,23],[11,12,20,22,23],[10,12,20,21,23],[12,20,21,23,29],[12,20,21,23,30]]},
];

console.log("=== 尾号约束评分测试 ===\n");
tests.forEach(t=>{
  const selT=tails(draws[t.sel]);
  const tgtT=tails(draws[t.target]);
  const tgtSet=tailSet(draws[t.target]);
  
  console.log(`选中行${t.sel}尾[${selT.join(",")}] → 目标行${t.target}尾[${tgtT.join(",")}]`);
  
  const scored=t.combos.map(c=>{
    const cT=tails(c);
    const ts=scoreTailPattern(cT,selT);
    const hits=c.filter(n=>tgtSet.has(n)).length;
    return{combo:c,tailScore:ts,hits};
  }).sort((a,b)=>b.tailScore-a.tailScore);
  
  console.log(`  按尾号评分排序:`);
  scored.forEach((s,i)=>{
    const match=s.hits>0?`命中${s.hits}球`:"0球";
    console.log(`    #${i+1} [${s.combo.join(",")}] 尾号评分:${s.tailScore} ${match}`);
  });
  console.log();
});

// 统计：尾号评分与命中率的相关性
console.log("=== 尾号评分 vs 命中率相关性 ===");
let allCombos=[];
tests.forEach(t=>{
  const selT=tails(draws[t.sel]);
  const tgtSet=tailSet(draws[t.target]);
  t.combos.forEach(c=>{
    const cT=tails(c);
    const ts=scoreTailPattern(cT,selT);
    const hits=c.filter(n=>tgtSet.has(n)).length;
    allCombos.push({tailScore:ts,hits});
  });
});

// 按尾号评分分组统计
const groups=new Map();
allCombos.forEach(c=>{
  const bucket=Math.floor(c.tailScore/10)*10;
  if(!groups.has(bucket))groups.set(bucket,[]);
  groups.get(bucket).push(c.hits);
});

[...groups.entries()].sort((a,b)=>a[0]-b[0]).forEach(([score,hits])=>{
  const avg=hits.reduce((a,b)=>a+b,0)/hits.length;
  console.log(`  尾号评分${score}-${score+9}: ${hits.length}组, 平均命中${avg.toFixed(2)}球`);
});
