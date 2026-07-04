// 分析区间比的转移规律：选中行区间比 → 目标行区间比
const draws={1:[],2:[],3:[],4:[],5:[],6:[],7:[],8:[],9:[],10:[],11:[],12:[],13:[],14:[],15:[],16:[],17:[2,9,14,20,31],18:[2,6,14,22,24],19:[9,10,20,33,35],20:[6,7,18,21,30],21:[],22:[],23:[],24:[],25:[],26:[],27:[3,15,20,29,31],28:[3,13,15,17,21],29:[4,11,12,13,25],30:[10,13,19,21,30]};
const iv=[{min:1,max:12},{min:13,max:24},{min:25,max:35}];

function gi(n){return iv.findIndex(t=>n>=t.min&&n<=t.max)}
function ratio(n){const c=[0,0,0];n.forEach(x=>{const i=gi(x);if(i>=0)c[i]++});return c.join(":")}

// 收集所有有数据的行
const validRows=[];
for(let r=1;r<=30;r++){
  if(draws[r]&&draws[r].length===5){
    validRows.push({row:r,ratio:ratio(draws[r]),nums:draws[r]});
  }
}

console.log("=== 所有有效行的区间比 ===");
validRows.forEach(v=>console.log(`  第${v.row}期: ${v.ratio} [${v.nums.join(",")}]`));

// 分析相邻行的区间比转移
console.log("\n=== 相邻行区间比转移矩阵 ===");
const transMap=new Map();
for(let i=0;i<validRows.length-1;i++){
  const from=validRows[i].ratio;
  const to=validRows[i+1].ratio;
  const key=`${from}→${to}`;
  transMap.set(key,(transMap.get(key)||0)+1);
}
[...transMap.entries()].sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>{
  console.log(`  ${k}: ${v}次`);
});

// 按来源区间比分组，看目标分布
console.log("\n=== 按选中行区间比分组，目标区间比分布 ===");
const fromGroups=new Map();
for(let i=0;i<validRows.length-1;i++){
  const from=validRows[i].ratio;
  const to=validRows[i+1].ratio;
  if(!fromGroups.has(from))fromGroups.set(from,[]);
  fromGroups.get(from).push(to);
}
fromGroups.forEach((targets,from)=>{
  const freq=new Map();
  targets.forEach(t=>freq.set(t,(freq.get(t)||0)+1));
  const sorted=[...freq.entries()].sort((a,b)=>b[1]-a[1]);
  console.log(`\n  选中行区间比 ${from} (${targets.length}次转移):`);
  sorted.forEach(([t,c])=>console.log(`    → ${t}: ${c}次 (${(c/targets.length*100).toFixed(0)}%)`));
});

// 分析间隔1行的转移（radius=1的情况）
console.log("\n=== 间隔1行转移（选中行→下下行，模拟radius=1） ===");
const transMap2=new Map();
for(let i=0;i<validRows.length-2;i++){
  const from=validRows[i].ratio;
  const to=validRows[i+2].ratio;
  const key=`${from}→${to}`;
  transMap2.set(key,(transMap2.get(key)||0)+1);
}
[...transMap2.entries()].sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>{
  console.log(`  ${k}: ${v}次`);
});

// 按来源分组
const fromGroups2=new Map();
for(let i=0;i<validRows.length-2;i++){
  const from=validRows[i].ratio;
  const to=validRows[i+2].ratio;
  if(!fromGroups2.has(from))fromGroups2.set(from,[]);
  fromGroups2.get(from).push(to);
}
fromGroups2.forEach((targets,from)=>{
  const freq=new Map();
  targets.forEach(t=>freq.set(t,(freq.get(t)||0)+1));
  const sorted=[...freq.entries()].sort((a,b)=>b[1]-a[1]);
  console.log(`\n  选中行区间比 ${from} (${targets.length}次转移):`);
  sorted.forEach(([t,c])=>console.log(`    → ${t}: ${c}次 (${(c/targets.length*100).toFixed(0)}%)`));
});

// 分析选中行区间比与目标行区间比的关系（所有有效对）
console.log("\n=== 选中行区间比 vs 目标区间比（所有配对） ===");
const allPairs=new Map();
validRows.forEach((v,i)=>{
  validRows.forEach((w,j)=>{
    if(i===j)return;
    const key=`${v.ratio}→${w.ratio}`;
    allPairs.set(key,(allPairs.get(key)||0)+1);
  });
});
// 按来源分组
const allFromGroups=new Map();
validRows.forEach((v,i)=>{
  validRows.forEach((w,j)=>{
    if(i===j)return;
    if(!allFromGroups.has(v.ratio))allFromGroups.set(v.ratio,[]);
    allFromGroups.get(v.ratio).push(w.ratio);
  });
});
allFromGroups.forEach((targets,from)=>{
  const freq=new Map();
  targets.forEach(t=>freq.set(t,(freq.get(t)||0)+1));
  const sorted=[...freq.entries()].sort((a,b)=>b[1]-a[1]);
  console.log(`\n  选中行区间比 ${from} (共${targets.length}个目标):`);
  sorted.forEach(([t,c])=>console.log(`    → ${t}: ${c}次 (${(c/targets.length*100).toFixed(0)}%)`));
});
