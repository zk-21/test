// 分析区间比对命中率的影响
const draws={17:[2,9,14,20,31],18:[2,6,14,22,24],19:[9,10,20,33,35],20:[6,7,18,21,30],27:[3,15,20,29,31],28:[3,13,15,17,21],29:[4,11,12,13,25],30:[10,13,19,21,30]};
const iv=[{min:1,max:12},{min:13,max:24},{min:25,max:35}];

function gi(n){return iv.findIndex(t=>n>=t.min&&n<=t.max)}
function ratio(n){const c=[0,0,0];n.forEach(x=>{const i=gi(x);if(i>=0)c[i]++});return c.join(":")}

console.log("=== 目标号码区间比 ===");
[27,28,29,30].forEach(r=>{
  console.log(`第${r}期 [${draws[r].join(",")}] → 区间比 ${ratio(draws[r])}`);
});

console.log("\n=== 当前输出区间比 ===");
const outputs={
  19:[[16,17,19,20,21],[15,17,19,20,21],[17,18,19,20,21],[16,17,18,19,20],[15,18,19,20,21]],
  20:[[10,16,19,20,34],[10,14,19,20,34],[10,11,12,19,20],[9,14,19,20,34],[10,18,19,20,34]],
  18:[[11,12,20,21,32],[11,12,21,23,32],[11,12,21,30,32],[10,12,20,21,32],[11,12,19,21,32]],
  17:[[19,20,21,22,23],[14,20,21,22,23],[17,20,21,22,23],[18,20,21,22,23],[16,20,21,22,23]],
};
const targets={19:29,20:30,18:28,17:27};
Object.entries(outputs).forEach(([sel,combos])=>{
  const tr=targets[sel];
  const targetRatio=ratio(draws[tr]);
  console.log(`\n选中行${sel} → 第${tr}期 (目标区间比 ${targetRatio})`);
  combos.forEach((c,i)=>{
    const r=ratio(c);
    const match=r===targetRatio?"✓":"✗";
    console.log(`  #${i+1} [${c.join(",")}] 区间比 ${r} ${match}`);
  });
});

// 分析：如果只保留区间比匹配的组合，命中率会怎样？
console.log("\n=== 如果限制区间比匹配，命中率变化 ===");
// 用verify_top5的结果手动分析
const allCombos={
  19:{target:draws[29],combos:outputs[19]},
  20:{target:draws[30],combos:outputs[20]},
  18:{target:draws[28],combos:outputs[18]},
  17:{target:draws[27],combos:outputs[17]},
};

let totalHit=0,totalCount=0,matchHit=0,matchCount=0;
Object.entries(allCombos).forEach(([sel,{target,combos}])=>{
  const tr=targets[sel];
  const targetSet=new Set(target);
  const targetR=ratio(target);
  combos.forEach(c=>{
    const hit=c.filter(n=>targetSet.has(n)).length;
    totalHit+=hit;totalCount++;
    if(ratio(c)===targetR){matchHit+=hit;matchCount++;}
  });
});
console.log(`全部组合: ${totalCount}组, 总命中${totalHit}球, 平均${(totalHit/totalCount).toFixed(2)}球`);
console.log(`区间比匹配: ${matchCount}组, 总命中${matchHit}球, 平均${matchCount>0?(matchHit/matchCount).toFixed(2):0}球`);

// 分析常见区间比
console.log("\n=== 历史区间比统计 ===");
for(let r=1;r<=30;r++){
  if(!draws[r])continue;
  // 只打印有数据的
}
// 统计所有已知期的区间比
const ratioCount={};
Object.values(draws).forEach(d=>{
  const r=ratio(d);
  ratioCount[r]=(ratioCount[r]||0)+1;
});
Object.entries(ratioCount).sort((a,b)=>b[1]-a[1]).forEach(([r,c])=>{
  console.log(`  ${r}: ${c}次`);
});
