// 诊断选号池组成
const draws={17:[2,9,14,20,31],18:[2,6,14,22,24],19:[9,10,20,33,35],20:[6,7,18,21,30],27:[3,15,20,29,31],28:[3,13,15,17,21],29:[4,11,12,13,25],30:[10,13,19,21,30]};
const dr=35,fr=30;

function gu(n=[]){return[...new Set((Array.isArray(n)?n:[]).map(Number).filter(x=>Number.isInteger(x)&&x>0))].sort((a,b)=>a-b)}
function gsw(sel,rad){const s=Math.min(Math.max(Number(sel)||1,1),dr);const st=Math.max(1,s-rad);const ed=Math.min(dr,s+rad);const ref=[];for(let r=st;r<=ed;r++)ref.push(r);if(fr>=1&&fr<=dr&&!ref.includes(fr))ref.push(fr);ref.sort((a,b)=>a-b);return ref}
function ga(ref){return[...new Set(ref.flatMap(r=>draws[r]||[]))].sort((a,b)=>a-b)}

const rw=8,wrw=4;
const ow=new Map([[1,5],[2,5],[3,5],[4,11],[5,12],[6,6],[7,11],[8,5],[9,3],[10,2]]);
const iv=[{min:1,max:12},{min:13,max:24},{min:25,max:35}];
const amd=17;

function cm(v,min,max){return Math.min(Math.max(Number(v)||min,min),max)}
function sl(v=0,c=1){return Math.min(c,Math.max(0,Number(v)||0))}
function bcs(n=[]){const s=gu(n),r=[];let c=[];s.forEach((x,i)=>{if(i===0||x===s[i-1]+1)c.push(x);else{if(c.length>=2)r.push([...c]);c=[x]}});if(c.length>=2)r.push([...c]);return r}
function ccp(n=[]){let p=0,lr=0,cr=0;for(let i=0;i<n.length;i++){if(i===0||n[i]!==n[i-1]+1)cr=1;else{cr++;p++}lr=Math.max(lr,cr)}return{pairs:p,longestRun:lr}}
function gi(n,i=iv){return i.findIndex(t=>n>=t.min&&n<=t.max)}
function grk(n=[],i=iv){const c=i.map(()=>0);n.forEach(x=>{const d=gi(x,i);if(d>=0)c[d]++});return c.join(":")}
function bta(n=[]){const s=gu(n),m=new Map();s.forEach(x=>{const t=x%10;const b=m.get(t)||[];b.push(x);m.set(t,b)});let st=null,sc=0;m.forEach((b,t)=>{if(b.length>sc){sc=b.length;st=t}});return{strongestTail:st,strongestCount:sc}}
function btn(tails){const r=new Set();tails.forEach(t=>{r.add((t+1)%10);r.add((t+9)%10)});return r}
function epa(n,a=[],as=null){const s=gu(a),sn=as||new Set(s);if(sn.has(n)){let sc=0;for(let i=0;i<s.length;i++)if(s[i]!==n&&Math.abs(n-s[i])===1)sc+=2;return sc}let sc=0;for(let i=0;i<s.length;i++)if(Math.abs(n-s[i])===1)sc+=4;return sc}
function epb(c=[],a=[]){const s=gu(a),cs=new Set(c);let sc=0;for(let li=0;li<s.length;li++){for(let ri=li+1;ri<s.length;ri++){const l=s[li],r2=s[ri],g=r2-l;if(g<=1||g>4)continue;const bw=[];for(let n=l+1;n<r2;n++)if(cs.has(n))bw.push(n);if(bw.length===0)continue;const cl=Math.max(1,5-g);if(bw.length===g-1)sc+=28+cl*8;else sc+=bw.length*(6+cl*2);if(cs.has(l))sc+=4;if(cs.has(r2))sc+=4}}return sc}
function eaf(n,a=[],as=null){const s=gu(a),sn=as||new Set(s);let f=0;for(let i=0;i<s.length;i++)if(s[i]!==n&&Math.abs(n-s[i])===1)f++;if(sn.has(n))return f;return f*2}
function eat(c=[],a=[]){const s=gu(a),cs=new Set(c);let ap=0;for(let i=0;i<s.length;i++){const an=s[i];for(let d=1;d<=8;d++){const l=an-d,r2=an+d;if(l>=1&&r2<=35&&cs.has(l)&&cs.has(r2))ap++}for(let d=1;d<=6;d++){const s2=an+d;if(s2<=35&&cs.has(s2)){const t=s2+d;if(t<=35&&cs.has(t))ap++}}for(let d=1;d<=6;d++){const f=an-2*d;if(f>=1&&cs.has(f)){const s2=an-d;if(s2>=1&&cs.has(s2))ap++}}}if(ap<2)return 0;let sc=0;for(let i=0;i<s.length;i++){const an=s[i];for(let d=1;d<=8;d++){const l=an-d,r2=an+d;if(l>=1&&r2<=35&&cs.has(l)&&cs.has(r2))sc+=4+Math.max(1,8-d)}for(let d=1;d<=6;d++){const s2=an+d;if(s2<=35&&cs.has(s2)){const t=s2+d;if(t<=35&&cs.has(t))sc+=3+Math.max(1,6-d)}}for(let d=1;d<=6;d++){const f=an-2*d;if(f>=1&&cs.has(f)){const s2=an-d;if(s2>=1&&cs.has(s2))sc+=3+Math.max(1,6-d)}}}return sc}
function cts(cn2,an2){const at2=an2.map(n=>n%10),ct=cn2.map(n=>n%10);let sc=0;const as2=new Set(at2);const mc=cn2.filter(n=>as2.has(n%10)).length;if(mc>=1&&mc<=3)sc+=mc*5;const au=[...new Set(at2)],cu=[...new Set(ct)];const up=new Set();cu.forEach(ct2=>{au.forEach(at3=>{const d=Math.abs(ct2-at3);const ia=d===1||d===9;if(!ia)return;const pk=`${Math.min(ct2,at3)}-${Math.max(ct2,at3)}`;if(up.has(pk))return;up.add(pk);sc+=2;const ac=au.filter(at4=>{const d2=Math.abs(ct2-at4);return d2===1||d2===9}).length;if(ac>=2)sc+=1})});const ca=[];for(let i=0;i<cu.length;i++)for(let j=i+1;j<cu.length;j++){const d=Math.abs(cu[i]-cu[j]);if(d===1||d===9)ca.push([cu[i],cu[j]])}const aa=[];for(let i=0;i<au.length;i++)for(let j=i+1;j<au.length;j++){const d=Math.abs(au[i]-au[j]);if(d===1||d===9)aa.push([au[i],au[j]])}if(ca.length>0&&aa.length>0)sc+=Math.min(ca.length,aa.length)*3;const atc={};at2.forEach(t=>{atc[t]=(atc[t]||0)+1});const ctc={};ct.forEach(t=>{ctc[t]=(ctc[t]||0)+1});const ar2=Object.entries(atc).filter(([,c])=>c>=2).map(([t])=>parseInt(t));const cr=Object.entries(ctc).filter(([,c])=>c>=2).map(([t])=>parseInt(t));if(ar2.length>0){sc+=cr.length*6;const mr=ar2.filter(t=>cr.includes(t)).length;sc+=mr*8;ar2.forEach(at3=>cr.forEach(ct2=>{const d=Math.abs(at3-ct2);if(d===1||d===9)sc+=4}))}const ast=[...new Set(at2)].sort((a,b)=>a-b);const cst=[...new Set(ct)].sort((a,b)=>a-b);const acp=[];for(let i=0;i<ast.length;i++)for(let j=i+1;j<ast.length;j++){const d=ast[j]-ast[i];if(d===1||d===9)acp.push([ast[i],ast[j]])}const ccp3=[];for(let i=0;i<cst.length;i++)for(let j=i+1;j<cst.length;j++){const d=cst[j]-cst[i];if(d===1||d===9)ccp3.push([cst[i],cst[j]])}if(acp.length>0&&ccp3.length>0){sc+=Math.min(acp.length,ccp3.length)*5;const em=acp.filter(([a1,a2])=>ccp3.some(([c1,c2])=>a1===c1&&a2===c2)).length;sc+=em*6}ar2.forEach(rt=>{const hc=acp.some(([a,b])=>a===rt||b===rt);if(hc){const ch=cr.includes(rt);const cc=ccp3.some(([a,b])=>a===rt||b===rt);if(ch&&cc)sc+=10;else if(ch||cc)sc+=4}});return sc*3.5}
function esat(n3=[],a3=[]){const cn=gu(n3),an=gu(a3);if(cn.length===0||an.length===0)return{ats:0,aoh:0,akh:0,arsh:0,ec:0,ecb:0,tc:0,tdb:0,fc:0,fob:0,akp:0,akb:0,acc:0,acb:0,acp2:0,fmb:0,tsb:0,srn:new Set()};const cs=new Set(cn),as2=new Set(an),srn=new Set(),en2=new Set(),ea=new Map(),tn=new Set(),fon=new Set();let ats=0,aoh=0,akh=0,arsh=0,fmb=0;cn.forEach(n=>{if(as2.has(n)){akh++;ats+=35;en2.add(n);ea.set(n,(ea.get(n)||0)+1)}an.forEach(a=>{const d=Math.abs(n-a);const os=ow.get(d)||0;if(os<=0)return;aoh++;ats+=os;en2.add(n);ea.set(a,(ea.get(a)||0)+1);if(!as2.has(n))tn.add(n);if(d>=4||d===7)fon.add(n)});fmb+=epa(n,an,as2);fmb+=eaf(n,an,as2)});bcs(an).forEach(seg=>{const st=seg[0],ed=seg[seg.length-1];cn.forEach(n=>{const er=n>=st-4&&n<=ed+4&&!as2.has(n);if(!er)return;const dist=n<st?st-n:n-ed;if(dist<1||dist>4)return;arsh++;ats+=16-dist*2;srn.add(n);en2.add(n)})});bcs(cn).forEach(seg=>{const sc=seg.filter(n=>{if(srn.has(n))return true;return an.some(a=>Math.abs(n-a)<=3)}).length;if(sc>=Math.min(2,seg.length)){seg.forEach(n=>srn.add(n));seg.forEach(n=>en2.add(n));ats+=seg.length*8;arsh+=sc}});fmb+=epb(cn,an);fmb+=eat(cn,an);const ec=en2.size,tc=tn.size,fc=fon.size,acc=ea.size;const ecb=ec>=cn.length?cn.length*14:ec>=cn.length-1?ec*10:ec>=3?ec*6:ec*2;const tdb=tc>=cn.length-1?tc*16:tc>=3?tc*11:tc*4;const fob=fc>=3?fc*14:fc>=2?fc*10:fc*3;const akp=akh>=4?(akh-3)*14:0;const akb=akh>=2&&akh<=3?(akh-1)*14:0;const acb=acc>=4?acc*12:acc>=3?acc*7:acc*2;const mal=ea.size>0?Math.max(...ea.values()):0;const lds=[...ea.values()];const oa=lds.filter(l=>l>=3).length;const ta=an.length;let cd=1.0;if(oa<=Math.ceil(ta*0.4)&&mal<=5)cd=0.5;const acp2=mal>=4?Math.round((mal-3)*12*cd):(mal>=3&&oa>=Math.ceil(ta*0.6)?Math.round((mal-2)*12*0.7):0);const tsb=cts(cn,an);return{ats,aoh,akh,arsh,ec,ecb,tc,tdb,fc,fob,akp,akb,acc,acb,acp2,fmb,tsb,srn}}

const tests=[
  {sel:18,target:28},
  {sel:20,target:30},
];

for(const t of tests){
  const selRow=t.sel, targetPeriod=t.target;
  const targetNums=draws[targetPeriod];
  const selNums=draws[selRow];
  const refs=gsw(selRow,1);
  const anchorNums=ga(refs).filter(n=>!selNums.includes(n));
  const anchorSet=new Set(anchorNums);
  
  const fm2=new Map();
  for(let r=selRow+1;r<=selRow+10;r++){if(!draws[r])continue;draws[r].forEach(x=>fm2.set(x,(fm2.get(x)||0)+1))}
  const cld2=new Set();for(let i=1;i<=35;i++){if(!fm2.has(i))cld2.add(i)}
  
  const all=Array.from({length:35},(_,i)=>i+1);
  const ss2=all.map(n=>{
    const sg=esat([n],anchorNums);
    let s=(sg.ats||0)+(sg.tc||0)*14+(sg.fob||0)+(sg.akb||0)+(sg.fmb||0)+(sg.tsb||0)-(sg.akp||0);
    if(cld2.has(n))s+=12;
    const fc=fm2.get(n)||0;
    if(fc>=2)s+=fc*3;
    // 远距离补偿
    if(!anchorSet.has(n)){
      const dists=anchorNums.map(a=>Math.abs(n-a)).sort((a,b)=>a-b);
      const minDist=dists[0]||99;
      if(minDist>=4&&minDist<=8)s+=Math.max(0,(9-minDist)*3);
    }
    return{n,sc:s}
  }).sort((a,b)=>b.sc-a.sc||a.n-b.n);
  
  console.log(`\n━━━ 选中行${selRow} → 第${targetPeriod}期 [${targetNums.join(",")}] ━━━`);
  console.log(`锚点: [${anchorNums.join(",")}]`);
  
  // 显示前30名的单号得分
  console.log(`\n单号得分排名(前30):`);
  ss2.slice(0,30).forEach((item,i)=>{
    const isTarget=targetNums.includes(item.n);
    const isAnchor=anchorSet.has(item.n);
    const marker=isTarget?'★':' ';
    const anchorMark=isAnchor?'[锚]':'   ';
    console.log(`  #${(i+1).toString().padStart(2)} ${item.n.toString().padStart(2)} ${marker} ${anchorMark} 分=${item.sc.toString().padStart(3)}`);
  });
  
  // 显示目标号码的排名
  console.log(`\n目标号码排名:`);
  targetNums.forEach(n=>{
    const rank=ss2.findIndex(s=>s.n===n)+1;
    const item=ss2.find(s=>s.n===n);
    const inPool=rank<=25;
    console.log(`  ${n}: 排名#${rank}, 分=${item?.sc||0}, 在池=${inPool?'✓':'✗'}`);
  });
}
