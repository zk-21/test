// 最终验证：V2基线 vs V4(仅首选邻号) vs V2+V4独立加分
const ow=new Map([[1,8],[2,8],[3,8],[4,11],[5,12],[6,6],[7,11],[8,5],[9,4],[10,3]]);
function segs(a){const s=[...a].sort((x,y)=>x-y);const o=[];let c=[s[0]];for(let i=1;i<s.length;i++){if(s[i]===s[i-1]+1)c.push(s[i]);else{if(c.length>=2)o.push(c);c=[s[i]];}}if(c.length>=2)o.push(c);return o;}
function gus(a){return [...new Set(a)].sort((x,y)=>x-y);}

function primaryAdjacent(n,as,ans){const as2=gus(as);const ans2=ans||new Set(as2);if(ans2.has(n))return 0;let sc=0;for(let i=0;i<as2.length;i++){if(Math.abs(n-as2[i])===1)sc+=4;}return sc;}
function adjacentFreq(n,as,ans){const as2=gus(as);const ans2=ans||new Set(as2);if(ans2.has(n))return 0;let f=0;for(let i=0;i<as2.length;i++){if(Math.abs(n-as2[i])===1)f+=1;}return f*2;}

function evalBase(numbers,anchors,extraBonus=0){
  const cn=gus(numbers),as=gus(anchors),aSet=new Set(as);
  const srn=new Set(),en=new Set(),ea=new Map(),tn=new Set(),fon=new Set();
  let ats=0,akh=0,fourBonus=0;
  cn.forEach(n=>{
    if(aSet.has(n)){akh++;ats+=6;en.add(n);ea.set(n,(ea.get(n)||0)+1);}
    as.forEach(a=>{const d=Math.abs(n-a);const w=ow.get(d)||0;if(w<=0)return;ats+=w;en.add(n);ea.set(a,(ea.get(a)||0)+1);if(!aSet.has(n))tn.add(n);if(d>=4||d===7)fon.add(n);});
    if(extraBonus){fourBonus+=primaryAdjacent(n,as,aSet);fourBonus+=adjacentFreq(n,as,aSet);}
  });
  segs(as).forEach(sg=>{const st=sg[0],ed=sg[sg.length-1];cn.forEach(n=>{if(n>=st-4&&n<=ed+4&&!aSet.has(n)){const dist=n<st?st-n:n-ed;if(dist>=1&&dist<=4){ats+=16-dist*2;srn.add(n);en.add(n);}}});});
  segs(cn).forEach(sg=>{const sc=sg.filter(n=>srn.has(n)||as.some(a=>Math.abs(n-a)<=3)).length;if(sc>=Math.min(2,sg.length)){sg.forEach(n=>srn.add(n));sg.forEach(n=>en.add(n));ats+=sg.length*8;}});
  const ec=en.size,tc=tn.size,fc=fon.size,ac=ea.size;
  const ecb=ec>=cn.length?cn.length*14:ec>=cn.length-1?ec*10:ec>=3?ec*6:ec*2;
  const tdb=tc>=cn.length-1?tc*16:tc>=3?tc*11:tc*4;
  const fob=fc>=3?fc*14:fc>=2?fc*10:fc*3;
  const akp=akh>=4?(akh-3)*14:0,akb=akh>=2&&akh<=3?(akh-1)*14:0;
  const acb=ac>=4?ac*12:ac>=3?ac*7:ac*2;
  const mal=ea.size>0?Math.max(...ea.values()):0;
  const lds=[...ea.values()],oa=lds.filter(l=>l>=3).length,ta=as.length;
  let cd=1.0;if(oa<=Math.ceil(ta*0.4)&&mal<=5)cd=0.5;
  const acp=mal>=4?Math.round((mal-3)*12*cd):(mal>=3&&oa>=Math.ceil(ta*0.6)?Math.round((mal-2)*12*0.7):0);
  const rgs=segs(cn);let rp=0,drc=0;
  rgs.forEach(sg=>{const spc=sg.filter(n=>srn.has(n)).length;const sr=sg.length>0?spc/sg.length:0;const sd=sr>=0.8?0.45:sr>=0.6?0.75:1;if(sg.length===2){drc++;rp+=Math.round(8*sd);}else if(sg.length>=4)rp+=Math.round((70+(sg.length-4)*16)*sd);else if(sg.length===3)rp+=Math.round(36*sd);});
  if(drc>=2)rp+=(drc-1)*6;
  return ats+ecb+tdb+fob+acb+akb+fourBonus-acp-akp-rp;
}

function gen(al){const all=new Set();al.forEach(a=>a.forEach(n=>{for(let d=-8;d<=8;d++){const v=n+d;if(v>=1&&v<=35)all.add(v);}}));const p=[...all].sort((a,b)=>a-b);const c=[];for(let i=0;i<p.length-4;i++)for(let j=i+1;j<p.length-3;j++)for(let k=j+1;k<p.length-2;k++)for(let l=k+1;l<p.length-1;l++)for(let m=l+1;m<p.length;m++)c.push([p[i],p[j],p[k],p[l],p[m]]);return c;}

const tests=[
  {n:"第19期",a:[[9,10,20,33,35],[2,6,14,22,24],[2,9,14,20,31]],t:[4,11,12,13,25]},
  {n:"第20期",a:[[9,10,20,33,35],[6,7,18,21,30]],t:[10,13,19,21,30]},
];

console.log("最终对比: V2基线 vs V4(首选邻号独立加分)\n");
let sum2=0,sum4=0;
tests.forEach(({n,a,t})=>{
  const all=gen(a),ts=JSON.stringify(t),tot=all.length;
  const v2s=all.map(c=>{let b=-Infinity;a.forEach(an=>{const r=evalBase(c,an,0);if(r>b)b=r;});return{c,s:b};});
  v2s.sort((x,y)=>y.s-x.s);
  const v4s=all.map(c=>{let b=-Infinity;a.forEach(an=>{const r=evalBase(c,an,1);if(r>b)b=r;});return{c,s:b};});
  v4s.sort((x,y)=>y.s-x.s);
  const r2=v2s.findIndex(c=>JSON.stringify(c.c)===ts)+1;
  const r4=v4s.findIndex(c=>JSON.stringify(c.c)===ts)+1;
  const d=r2-r4;
  sum2+=r2;sum4+=r4;

  // Top100重合
  let ov2=0,ov4=0;
  v2s.slice(0,100).forEach(c=>{const o=c.c.filter(n=>t.includes(n)).length;if(o>ov2)ov2=o;});
  v4s.slice(0,100).forEach(c=>{const o=c.c.filter(n=>t.includes(n)).length;if(o>ov4)ov4=o;});

  const inT5_2=r2<=5,inT10_2=r2<=10,inT100_2=r2<=100;
  const inT5_4=r4<=5,inT10_4=r4<=10,inT100_4=r4<=100;

  console.log(`${n}: 目标${ts}`);
  console.log(`  V2基线: #${r2.toLocaleString()}/${tot.toLocaleString()}(${(r2/tot*100).toFixed(2)}%) Top5:${inT5_2?'✅':'❌'} Top10:${inT10_2?'✅':'❌'} Top100:${inT100_2?'✅':'❌'} 最高重合:${ov2}`);
  console.log(`  V4邻号: #${r4.toLocaleString()}/${tot.toLocaleString()}(${(r4/tot*100).toFixed(2)}%) Top5:${inT5_4?'✅':'❌'} Top10:${inT10_4?'✅':'❌'} Top100:${inT100_4?'✅':'❌'} 最高重合:${ov4}`);
  console.log(`  ${d>0?'提升':'下降'}: ${d>0?'+':''}${d}名 (${(d/r2*100).toFixed(1)}%)`);
  console.log();
});

console.log(`综合: V2=${sum2.toLocaleString()} → V4=${sum4.toLocaleString()} (${((sum2-sum4)/sum2*100).toFixed(1)}%)`);
