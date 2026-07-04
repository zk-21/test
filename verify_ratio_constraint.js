// 基于选中行区间比，用转移规则缩小目标区间比范围
const draws={17:[2,9,14,20,31],18:[2,6,14,22,24],19:[9,10,20,33,35],20:[6,7,18,21,30],27:[3,15,20,29,31],28:[3,13,15,17,21],29:[4,11,12,13,25],30:[10,13,19,21,30]};
const iv=[{min:1,max:12},{min:13,max:24},{min:25,max:35}];

function gi(n){return iv.findIndex(t=>n>=t.min&&n<=t.max)}
function ratio(n){const c=[0,0,0];n.forEach(x=>{const i=gi(x);if(i>=0)c[i]++});return c}
function ratioStr(n){return ratio(n).join(":")}

// 根据选中行区间比，生成允许的目标区间比范围及评分
function getTargetRatioConstraints(selRatio){
  const [a,b,c]=selRatio;
  const constraints=[];
  
  // 生成所有可能的5球区间比
  for(let i=0;i<=5;i++){
    for(let j=0;j<=5-i;j++){
      const k=5-i-j;
      const target=[i,j,k];
      
      // 检查硬约束
      let valid=true;
      let score=0;
      
      // 硬约束1: 极值回归 - 某区间≥4则目标≤3
      for(let x=0;x<3;x++){
        if(selRatio[x]>=4 && target[x]>=4) valid=false;
      }
      
      // 硬约束2: 单分量变化≤2
      for(let x=0;x<3;x++){
        if(Math.abs(target[x]-selRatio[x])>2) valid=false;
      }
      
      // 硬约束3: 不允许5:0:0或0:5:0或0:0:5
      if(target.includes(5)) valid=false;
      
      if(!valid) continue;
      
      // 软约束评分
      // 评分1: 零区间回补 (+15分)
      for(let x=0;x<3;x++){
        if(selRatio[x]===0 && target[x]>=1) score+=15;
      }
      
      // 评分2: 极值回归 (+10分)
      for(let x=0;x<3;x++){
        if(selRatio[x]>=4 && target[x]<=3) score+=10;
      }
      
      // 评分3: 均衡奖励 (+5分)
      const maxT=Math.max(...target);
      const minT=Math.min(...target);
      if(maxT-minT<=2) score+=5;
      
      constraints.push({ratio:target,score});
    }
  }
  // 按评分排序
  constraints.sort((a,b)=>b.score-a.score);
  return constraints;
}

// 测试4组
const tests=[
  {sel:19,target:29},
  {sel:20,target:30},
  {sel:18,target:28},
  {sel:17,target:27},
];

console.log("=== 基于选中行区间比的目标区间比约束 ===\n");
for(const t of tests){
  const selR=ratio(draws[t.sel]);
  const tgtR=ratio(draws[t.target]);
  const allowed=getTargetRatioConstraints(selR);
  const match=allowed.some(({ratio:r})=>r[0]===tgtR[0]&&r[1]===tgtR[1]&&r[2]===tgtR[2]);
  
  console.log(`选中行${t.sel} 区间比:${selR.join(":")} → 目标行${t.target} 区间比:${tgtR.join(":")}`);
  console.log(`  允许的目标区间比(${allowed.length}种，按评分排序):`);
  allowed.forEach(({ratio:r,score})=>{
    const isTarget=r[0]===tgtR[0]&&r[1]===tgtR[1]&&r[2]===tgtR[2];
    console.log(`    ${r.join(":")} (评分:${score})${isTarget?" ← 实际目标":""}`);
  });
  console.log(`  目标是否在允许范围内: ${match?"✓":"✗"}`);
  console.log();
}

// 统计：所有可能区间比 vs 约束后的区间比
console.log("=== 区间比空间缩减统计 ===");
const allRatios=[];
for(let i=0;i<=5;i++)for(let j=0;j<=5-i;j++)allRatios.push([i,j,5-i-j]);
console.log(`全部可能区间比: ${allRatios.length}种`);

const uniqueSelRatios=[...new Set([17,18,19,20,27,28,29,30].map(r=>ratioStr(draws[r])))];
uniqueSelRatios.forEach(sr=>{
  const selR=sr.split(":").map(Number);
  const allowed=getTargetRatioConstraints(selR);
  console.log(`选中行区间比 ${sr} → 允许${allowed.length}种 (缩减${((1-allowed.length/allRatios.length)*100).toFixed(0)}%)`);
  // 显示前5名
  console.log(`  前5名: ${allowed.slice(0,5).map(({ratio:r,score})=>`${r.join(":")}(${score})`).join(", ")}`);
});
