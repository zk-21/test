// 分析选号池构成
const draws={17:[2,9,14,20,31],18:[2,6,14,22,24],19:[9,10,20,33,35],20:[6,7,18,21,30],27:[3,15,20,29,31],28:[3,13,15,17,21],29:[4,11,12,13,25],30:[10,13,19,21,30]};

function gu(n=[]){return[...new Set((Array.isArray(n)?n:[]).map(Number).filter(x=>Number.isInteger(x)&&x>0))].sort((a,b)=>a-b)}
function cm(v,min,max){return Math.min(Math.max(Number(v)||min,min),max)}
const dr=35,fr=30;
function gsw(sel,rad){const s=cm(sel,1,dr);const st=Math.max(1,s-rad);const ed=Math.min(dr,s+rad);const ref=[];for(let r=st;r<=ed;r++)ref.push(r);if(fr>=1&&fr<=dr&&!ref.includes(ref))ref.push(fr);ref.sort((a,b)=>a-b);return ref}
function ga(ref){return[...new Set(ref.flatMap(r=>draws[r]||[]))].sort((a,b)=>a-b)}

const tests=[{sel:19,target:29},{sel:20,target:30},{sel:18,target:28},{sel:17,target:27}];

console.log("=== 选号池分析 ===\n");
for(const t of tests){
  const refs=gsw(t.sel,1);
  const refNums=ga(refs);
  const targetNums=draws[t.target];
  const selNums=draws[t.sel];
  
  // 锚点 = refNums - selNums
  const anchors=refNums.filter(n=>!selNums.includes(n));
  
  // 频率图（后续10行）
  const fm=new Map();
  for(let r=t.sel+1;r<=t.sel+10;r++){if(!draws[r])continue;draws[r].forEach(x=>fm.set(x,(fm.get(x)||0)+1))}
  const hotNums=[];fm.forEach((c,n)=>{if(c>=2)hotNums.push(n)});
  const coldNums=[];for(let i=1;i<=35;i++){if(!fm.has(i))coldNums.push(i)}
  
  // 选号池 = selNums + anchors + 区间保底 + 按得分填充
  // 简化：先看sel+anchors中有多少目标号码
  const poolBase=[...new Set([...selNums,...anchors])];
  const targetInPool=targetNums.filter(n=>poolBase.includes(n));
  const targetNotInPool=targetNums.filter(n=>!poolBase.includes(n));
  
  console.log(`行${t.sel}→${t.target}:`);
  console.log(`  参考行: [${refs}] 参考号码(${refNums.length}个): [${refNums}]`);
  console.log(`  选中行: [${selNums}]`);
  console.log(`  锚点号(${anchors.length}个): [${anchors}]`);
  console.log(`  基础池(${poolBase.length}个): [${poolBase.sort((a,b)=>a-b)}]`);
  console.log(`  目标行: [${targetNums}]`);
  console.log(`  目标在池中: ${targetInPool.length}/${targetNums.length}个 [${targetInPool}]`);
  console.log(`  目标不在池: [${targetNotInPool}]`);
  console.log(`  热号(>=2次): [${hotNums.sort((a,b)=>a-b)}] 冷号: [${coldNums.sort((a,b)=>a-b)}]`);
  
  // 分析不在池中的目标号码的特征
  targetNotInPool.forEach(n=>{
    const tail=n%10;
    const selTails=[...new Set(selNums.map(x=>x%10))];
    const isTailNeighbor=selTails.some(t=>Math.abs(t-tail)===1||(t===0&&tail===9)||(t===9&&tail===0));
    const isHot=hotNums.includes(n);
    const isCold=coldNums.includes(n);
    const nearAnchor=anchors.some(a=>Math.abs(a-n)<=3);
    console.log(`    ${n}: 尾号${tail} 尾号±1=${isTailNeighbor} 热号=${isHot} 冷号=${isCold} 近锚点=${nearAnchor}`);
  });
  console.log();
}

// 扩大参考窗口能否改善？
console.log("=== 扩大参考窗口(rad=2) ===\n");
for(const t of tests){
  const refs1=gsw(t.sel,1);
  const refs2=gsw(t.sel,2);
  const pool1=ga(refs1);
  const pool2=ga(refs2);
  const targetNums=draws[t.target];
  
  const in1=targetNums.filter(n=>pool1.includes(n)).length;
  const in2=targetNums.filter(n=>pool2.includes(n)).length;
  
  console.log(`行${t.sel}→${t.target}: rad=1覆盖${in1}/${targetNums.length} rad=2覆盖${in2}/${targetNums.length} 新增=[${pool2.filter(n=>!pool1.includes(n)).sort((a,b)=>a-b)}]`);
}
