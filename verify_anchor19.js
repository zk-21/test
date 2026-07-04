// 检查行19的锚点选择
const draws={17:[2,9,14,20,31],18:[2,6,14,22,24],19:[9,10,20,33,35],20:[6,7,18,21,30],27:[3,15,20,29,31],28:[3,13,15,17,21],29:[4,11,12,13,25],30:[10,13,19,21,30]};
const dr=35,fr=30;

function gu(n=[]){return[...new Set((Array.isArray(n)?n:[]).map(Number).filter(x=>Number.isInteger(x)&&x>0))].sort((a,b)=>a-b)}
function gsw(sel,rad){const s=Math.min(Math.max(Number(sel)||1,1),dr);const st=Math.max(1,s-rad);const ed=Math.min(dr,s+rad);const ref=[];for(let r=st;r<=ed;r++)ref.push(r);if(fr>=1&&fr<=dr&&!ref.includes(fr))ref.push(fr);ref.sort((a,b)=>a-b);return ref}
function ga(ref){return[...new Set(ref.flatMap(r=>draws[r]||[]))].sort((a,b)=>a-b)}

const selRow=19;
const selNums=draws[selRow];
const refs=gsw(selRow,1);
const allAnchors=ga(refs).filter(n=>!selNums.includes(n));

console.log(`选中行${selRow}: [${selNums.join(",")}]`);
console.log(`参考行: ${refs.join(",")}`);
console.log(`所有锚点(${allAnchors.length}个): [${allAnchors.join(",")}]`);
console.log(`目标29期: [${draws[29].join(",")}]`);
console.log();

// 计算每个锚点的单号得分
const ow=new Map([[1,5],[2,5],[3,5],[4,11],[5,12],[6,6],[7,11],[8,5],[9,3],[10,2]]);
function esat_simple(n,anchors){
  const anchorSet=new Set(anchors);
  let score=0;
  if(anchorSet.has(n))score+=35;
  anchors.forEach(a=>{
    const d=Math.abs(n-a);
    const w=ow.get(d)||0;
    score+=w;
  });
  return score;
}

console.log("锚点单号得分排名:");
const anchorScores=allAnchors.map(n=>({n,sc:esat_simple(n,allAnchors)})).sort((a,b)=>b.sc-a.sc);
anchorScores.forEach((item,i)=>{
  const marker=i<7?'✓':'✗';
  console.log(`  ${marker} ${item.n}: ${item.sc}分`);
});

console.log();
console.log("限制后保留的7个锚点:");
const top7=anchorScores.slice(0,7).map(x=>x.n).sort((a,b)=>a-b);
console.log(`[${top7.join(",")}]`);

console.log();
console.log("目标号码与锚点的关系:");
const target=draws[29];
const top7Set=new Set(top7);
target.forEach(n=>{
  const inAnchor=top7Set.has(n);
  const dists=top7.map(a=>Math.abs(n-a)).sort((a,b)=>a-b);
  console.log(`  ${n}: 是锚点=${inAnchor}, 最近锚点距离=${dists[0]}`);
});
