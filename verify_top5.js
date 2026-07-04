// 轻量版：获取每组前5名组合及其命中球数
const draws={1:[13,18,28,32,33],2:[9,11,19,30,35],3:[4,5,10,23,31],4:[8,9,12,19,24],5:[1,10,21,23,29],6:[5,8,12,14,17],7:[5,9,10,18,26],8:[9,25,26,27,28],9:[2,4,8,10,21],10:[3,15,24,28,29],11:[10,11,22,26,32],12:[9,10,11,12,16],13:[15,27,29,30,34],14:[3,5,17,33,35],15:[6,8,22,29,34],16:[4,7,16,26,32],17:[2,22,30,33,34],18:[11,12,25,26,27],19:[3,5,7,9,18],20:[3,4,19,26,32],21:[6,8,22,29,34],22:[7,12,13,28,32],23:[8,17,21,33,35],24:[9,11,20,26,27],25:[6,12,13,21,34],26:[24,25,27,29,34],27:[2,7,13,19,24],28:[8,12,14,19,22],29:[3,8,22,26,29],30:[1,15,21,26,33],31:[1,13,18,27,33],32:[9,20,21,23,28],33:[11,17,20,23,35],34:[6,10,14,23,33],35:[13,18,28,32,33]};
const dr=35,fr=30;
const rw=8,wrw=4;
const ow=new Map([[1,5],[2,5],[3,5],[4,11],[5,12],[6,6],[7,11],[8,5],[9,3],[10,2]]);
const iv=[{min:1,max:12},{min:13,max:24},{min:25,max:35}];
const amd=17;

function cm(v,min,max){return Math.min(Math.max(Number(v)||min,min),max)}
function sl(v=0,c=1){return Math.min(c,Math.max(0,Number(v)||0))}
function gu(n=[]){return[...new Set((Array.isArray(n)?n:[]).map(Number).filter(x=>Number.isInteger(x)&&x>0))].sort((a,b)=>a-b)}
function bcs(n=[]){const s=gu(n),r=[];let c=[];s.forEach((x,i)=>{if(i===0||x===s[i-1]+1)c.push(x);else{if(c.length>=2)r.push([...c]);c=[x]}});if(c.length>=2)r.push([...c]);return r}
function ccp(n=[]){let p=0,lr=0,cr=0;for(let i=0;i<n.length;i++){if(i===0||n[i]!==n[i-1]+1)cr=1;else{cr++;p++}lr=Math.max(lr,cr)}return{pairs:p,longestRun:lr}}
function gi(n,i=iv){return i.findIndex(t=>n>=t.min&&n<=t.max)}
function grk(n=[],i=iv){const c=i.map(()=>0);n.forEach(x=>{const d=gi(x,i);if(d>=0)c[d]++});return c.join(":")}
function ratio(n=[],i=iv){const c=i.map(()=>0);n.forEach(x=>{const d=gi(x,i);if(d>=0)c[d]++});return c}
function bta(n=[]){const s=gu(n),m=new Map();s.forEach(x=>{const t=x%10;const b=m.get(t)||[];b.push(x);m.set(t,b)});let st=null,sc=0;m.forEach((b,t)=>{if(b.length>sc){sc=b.length;st=t}});return{strongestTail:st,strongestCount:sc}}
function btn(tails){const r=new Set();tails.forEach(t=>{r.add((t+1)%10);r.add((t+9)%10)});return r}
function gsw(sel,rad){const s=cm(sel,1,dr);const st=Math.max(1,s-rad);const ed=Math.min(dr,s+rad);const ref=[];for(let r=st;r<=ed;r++)ref.push(r);if(fr>=1&&fr<=dr&&!ref.includes(fr))ref.push(fr);ref.sort((a,b)=>a-b);return ref}
function ga(ref){return[...new Set(ref.flatMap(r=>draws[r]||[]))].sort((a,b)=>a-b)}
function epa(n,a=[],as=null){const s=gu(a),sn=as||new Set(s);if(sn.has(n)){let sc=0;for(let i=0;i<s.length;i++)if(s[i]!==n&&Math.abs(n-s[i])===1)sc+=2;return sc}let sc=0;for(let i=0;i<s.length;i++)if(Math.abs(n-s[i])===1)sc+=4;return sc}
function epb(c=[],a=[]){const s=gu(a),cs=new Set(c);let sc=0;for(let li=0;li<s.length;li++){for(let ri=li+1;ri<s.length;ri++){const l=s[li],r2=s[ri],g=r2-l;if(g<=1||g>10)continue;const bw=[];for(let n=l+1;n<r2;n++)if(cs.has(n))bw.push(n);if(bw.length===0)continue;const nr=g<=6;const cl=nr?Math.max(1,7-g):Math.max(1,11-g);const bf=nr?28:14;const bp=nr?6:3;if(bw.length===g-1)sc+=bf+cl*8;else sc+=bw.length*(bp+cl*2);if(cs.has(l))sc+=nr?4:2;if(cs.has(r2))sc+=nr?4:2}}return sc}
// 跨行桥接：选中行号码和锚点号码共同作为端点，中间号码加分
function epbx(c=[],a=[],sel=[]){const ep=[...new Set([...gu(a),...gu(sel)])].sort((a,b)=>a-b);const cs=new Set(c);let sc=0;for(let li=0;li<ep.length;li++){for(let ri=li+1;ri<ep.length;ri++){const l=ep[li],r=ep[ri],g=r-l;if(g<=1||g>10)continue;const bw=[];for(let n=l+1;n<r;n++)if(cs.has(n))bw.push(n);if(bw.length===0)continue;const nr=g<=6;const cl=nr?Math.max(1,7-g):Math.max(1,11-g);const bf=nr?20:10;const bp=nr?5:2;if(bw.length===g-1)sc+=bf+cl*6;else sc+=bw.length*(bp+cl*2)}}return sc}
function eaf(n,a=[],as=null){const s=gu(a),sn=as||new Set(s);let f=0;for(let i=0;i<s.length;i++)if(s[i]!==n&&Math.abs(n-s[i])===1)f++;if(sn.has(n))return f;return f*2}
function eat(c=[],a=[]){const s=gu(a),cs=new Set(c);let ap=0;for(let i=0;i<s.length;i++){const an=s[i];for(let d=1;d<=10;d++){const l=an-d,r2=an+d;if(l>=1&&r2<=35&&cs.has(l)&&cs.has(r2))ap++}for(let d=1;d<=10;d++){const s2=an+d;if(s2<=35&&cs.has(s2)){const t=s2+d;if(t<=35&&cs.has(t))ap++}}for(let d=1;d<=10;d++){const f=an-2*d;if(f>=1&&cs.has(f)){const s2=an-d;if(s2>=1&&cs.has(s2))ap++}}}if(ap<2)return 0;let sc=0;for(let i=0;i<s.length;i++){const an=s[i];for(let d=1;d<=10;d++){const l=an-d,r2=an+d;if(l>=1&&r2<=35&&cs.has(l)&&cs.has(r2)){const bs=d<=6?6:3;sc+=bs+Math.max(1,d<=6?8-d:11-d)}}for(let d=1;d<=10;d++){const s2=an+d;if(s2<=35&&cs.has(s2)){const t=s2+d;if(t<=35&&cs.has(t)){const bs=d<=6?5:2;sc+=bs+Math.max(1,d<=6?7-d:11-d)}}}for(let d=1;d<=10;d++){const f=an-2*d;if(f>=1&&cs.has(f)){const s2=an-d;if(s2>=1&&cs.has(s2)){const bs=d<=6?5:2;sc+=bs+Math.max(1,d<=6?7-d:11-d)}}}}return sc}
function cts(cn2,an2){const at2=an2.map(n=>n%10),ct=cn2.map(n=>n%10);let sc=0;const as2=new Set(at2);const mc=cn2.filter(n=>as2.has(n%10)).length;if(mc>=1&&mc<=3)sc+=mc*5;const au=[...new Set(at2)],cu=[...new Set(ct)];const up=new Set();cu.forEach(ct2=>{au.forEach(at3=>{const d=Math.abs(ct2-at3);const ia=d===1||d===9;if(!ia)return;const pk=`${Math.min(ct2,at3)}-${Math.max(ct2,at3)}`;if(up.has(pk))return;up.add(pk);sc+=2;const ac=au.filter(at4=>{const d2=Math.abs(ct2-at4);return d2===1||d2===9}).length;if(ac>=2)sc+=1})});const ca=[];for(let i=0;i<cu.length;i++)for(let j=i+1;j<cu.length;j++){const d=Math.abs(cu[i]-cu[j]);if(d===1||d===9)ca.push([cu[i],cu[j]])}const aa=[];for(let i=0;i<au.length;i++)for(let j=i+1;j<au.length;j++){const d=Math.abs(au[i]-au[j]);if(d===1||d===9)aa.push([au[i],au[j]])}if(ca.length>0&&aa.length>0)sc+=Math.min(ca.length,aa.length)*3;const atc={};at2.forEach(t=>{atc[t]=(atc[t]||0)+1});const ctc={};ct.forEach(t=>{ctc[t]=(ctc[t]||0)+1});const ar2=Object.entries(atc).filter(([,c])=>c>=2).map(([t])=>parseInt(t));const cr=Object.entries(ctc).filter(([,c])=>c>=2).map(([t])=>parseInt(t));if(ar2.length>0){sc+=cr.length*6;const mr=ar2.filter(t=>cr.includes(t)).length;sc+=mr*8;ar2.forEach(at3=>cr.forEach(ct2=>{const d=Math.abs(at3-ct2);if(d===1||d===9)sc+=4}))}const ast=[...new Set(at2)].sort((a,b)=>a-b);const cst=[...new Set(ct)].sort((a,b)=>a-b);const acp=[];for(let i=0;i<ast.length;i++)for(let j=i+1;j<ast.length;j++){const d=ast[j]-ast[i];if(d===1||d===9)acp.push([ast[i],ast[j]])}const ccp3=[];for(let i=0;i<cst.length;i++)for(let j=i+1;j<cst.length;j++){const d=cst[j]-cst[i];if(d===1||d===9)ccp3.push([cst[i],cst[j]])}if(acp.length>0&&ccp3.length>0){sc+=Math.min(acp.length,ccp3.length)*5;const em=acp.filter(([a1,a2])=>ccp3.some(([c1,c2])=>a1===c1&&a2===c2)).length;sc+=em*6}ar2.forEach(rt=>{const hc=acp.some(([a,b])=>a===rt||b===rt);if(hc){const ch=cr.includes(rt);const cc=ccp3.some(([a,b])=>a===rt||b===rt);if(ch&&cc)sc+=10;else if(ch||cc)sc+=4}});return sc*3.5}
function esat(n3=[],a3=[],sel=[]){const cn=gu(n3),an=gu(a3);if(cn.length===0||an.length===0)return{ats:0,aoh:0,akh:0,arsh:0,ec:0,ecb:0,tc:0,tdb:0,fc:0,fob:0,akp:0,akb:0,acc:0,acb:0,acp2:0,fmb:0,tsb:0,srn:new Set()};const cs=new Set(cn),as2=new Set(an),srn=new Set(),en2=new Set(),ea=new Map(),tn=new Set(),fon=new Set();let ats=0,aoh=0,akh=0,arsh=0,fmb=0;cn.forEach(n=>{if(as2.has(n)){akh++;ats+=35;en2.add(n);ea.set(n,(ea.get(n)||0)+1)}an.forEach(a=>{const d=Math.abs(n-a);const os=ow.get(d)||0;if(os<=0)return;aoh++;ats+=os;en2.add(n);ea.set(a,(ea.get(a)||0)+1);if(!as2.has(n))tn.add(n);if(d>=4||d===7)fon.add(n)});fmb+=epa(n,an,as2);fmb+=eaf(n,an,as2)});bcs(an).forEach(seg=>{const st=seg[0],ed=seg[seg.length-1];cn.forEach(n=>{const er=n>=st-4&&n<=ed+4&&!as2.has(n);if(!er)return;const dist=n<st?st-n:n-ed;if(dist<1||dist>4)return;arsh++;ats+=16-dist*2;srn.add(n);en2.add(n)})});bcs(cn).forEach(seg=>{const sc=seg.filter(n=>{if(srn.has(n))return true;return an.some(a=>Math.abs(n-a)<=3)}).length;if(sc>=Math.min(2,seg.length)){seg.forEach(n=>srn.add(n));seg.forEach(n=>en2.add(n));ats+=seg.length*8;arsh+=sc}});fmb+=epb(cn,an);fmb+=epbx(cn,an,sel);fmb+=eat(cn,an);const ec=en2.size,tc=tn.size,fc=fon.size,acc=ea.size;const ecb=ec>=cn.length?cn.length*14:ec>=cn.length-1?ec*10:ec>=3?ec*6:ec*2;const tdb=tc>=cn.length-1?tc*16:tc>=3?tc*11:tc*4;const fob=fc>=3?fc*14:fc>=2?fc*10:fc*3;const akp=akh>=4?(akh-3)*14:0;const akb=akh>=2&&akh<=3?(akh-1)*14:0;const acb=acc>=4?acc*12:acc>=3?acc*7:acc*2;const mal=ea.size>0?Math.max(...ea.values()):0;const lds=[...ea.values()];const oa=lds.filter(l=>l>=3).length;const ta=an.length;let cd=1.0;if(oa<=Math.ceil(ta*0.4)&&mal<=5)cd=0.5;const acp2=mal>=4?Math.round((mal-3)*12*cd):(mal>=3&&oa>=Math.ceil(ta*0.6)?Math.round((mal-2)*12*0.7):0);const tsb=cts(cn,an);return{ats,aoh,akh,arsh,ec,ecb,tc,tdb,fc,fob,akp,akb,acc,acb,acp2,fmb,tsb,srn}}
function eac2(n3=[],a3=[]){const cn=gu(n3),an2=gu(a3);if(cn.length===0||an2.length===0)return{aeh:0,aph:0,asc:0};const cs=new Set(cn);let aeh=0,aph=0,asc=0;an2.forEach(a=>{for(let d=1;d<=amd;d++){const l=a-d,r2=a+d;if(l<1&&r2>35)continue;const hl=l>=1&&cs.has(l),hr=r2<=35&&cs.has(r2);if(!hl&&!hr)continue;const cl=Math.max(1,amd-d+1);aeh+=Number(hl)+Number(hr);asc+=(hl&&hr?16:4)+cl*(hl&&hr?5:2);if(hl&&hr)aph++}});return{aeh,aph,asc}}
function edt2(n3=[],a3=[]){const cn=gu(n3),an2=gu(a3);if(cn.length===0||an2.length===0)return{dth:0,dts:0,dtlr:0};const dfs=an2.map(a=>{const f=cn.find(c=>Math.abs(c-a)<=3);return f!==undefined?Math.abs(f-a):null}).filter(d=>d!==null);if(dfs.length<2)return{dth:dfs.length,dts:dfs.length*4,dtlr:dfs.length};let lr=1,cr=1;for(let i=1;i<dfs.length;i++){if(dfs[i]===dfs[i-1]){cr++;lr=Math.max(lr,cr)}else cr=1}return{dth:dfs.length,dts:dfs.length*6+(lr>=3?lr*10:lr*3),dtlr:lr}}
function ebg2(n3=[],a3=[]){const cn=gu(n3),an2=gu(a3);if(cn.length===0||an2.length===0)return{bgh:0,beh:0,bph:0,bsc:0};const cs=new Set(cn);let bgh=0,beh=0,bph=0,bsc=0;const ps=new Set();for(let li=0;li<an2.length;li++){for(let ri=li+1;ri<an2.length;ri++){const l=an2[li],r2=an2[ri],g=r2-l;if(g<=1||g>10)continue;const nr=g<=6;const cl=nr?Math.max(1,7-g):Math.max(1,11-g);const be=nr?8:4;const bi=nr?24:12;[l,r2].forEach(ep=>{if(cs.has(ep)){beh++;bsc+=be+cl*3}});for(let x=l+1;x<r2;x++){if(cs.has(x)){bgh++;bsc+=bi+cl*6}}if(cs.has(l)&&cs.has(r2)&&!ps.has(`${l},${r2}`)){bph++;ps.add(`${l},${r2}`)}}}return{bgh,beh,bph,bsc}}
function escar2(n3=[],ref){const cn=gu(n3);if(!ref||cn.length===0)return{sc:0,ms:0,ol:0,nh:0,to:0,aph:0,asc:0,bgh:0,beh:0,bph:0,bsc:0,dts:0,dtlr:0,cs:0,lrs:0,ss:0};const{pars:cp2,lr:clr}=ccp(cn);const rn=ref.n||[],rs2=new Set(rn),rts=ref.t||new Set(),crk=grk(cn),rrk=ref.r||"";const ol=cn.filter(n=>rs2.has(n)).length;const nh=cn.filter(n=>rs2.has(n-1)||rs2.has(n+1)).length;const to=cn.filter(n=>rts.has(n%10)).length;const tns=btn([...rts]);const tno=cn.filter(n=>tns.has(n%10)).length;const rm=crk===rrk?1:0;const sth=ref.ta?.strongestCount>=2&&ref.ta?.strongestTail!==null?cn.filter(n=>n%10===ref.ta.strongestTail).length:0;const cs2=ref.cp>0?Math.max(0,3-Math.abs(cp2-ref.cp)):cp2===0?1:0;const lrs=ref.lr2>1?Math.max(0,3-Math.abs(clr-ref.lr2)):clr<=2?1:0;const ar=eac2(cn,rn);const df=edt2(cn,rn);const bg=ebg2(cn,rn);const ss=(ref.cs2||[]).reduce((t,seg)=>{const ss2=new Set(seg);const sh=cn.filter(n=>ss2.has(n)).length;const aj=cn.filter(n=>ss2.has(n-1)||ss2.has(n+1)).length;if(sh>=Math.min(2,seg.length))return t+2;if(aj>0)return t+1;return t},0);const sc2=sl(ol,3)*rw+sl(nh,3)*rw+sl(to,3)*rw+sl(tno,3)*wrw+sl(rm,1)*rw+sl(sth,3)*rw+sl(ar.aph,3)*rw+sl(ar.aeh,3)*rw+sl(df.dtlr-1,3)*rw+sl(bg.bph,3)*rw+sl(bg.bgh,3)*rw+sl(cs2,3)*rw+sl(lrs,3)*rw+sl(ss,3)*rw;let ms=0;if(ol>=1)ms++;if(nh>=1)ms++;if(to>=1)ms++;if(tno>=1)ms++;if(rm)ms++;if(sth>=1)ms++;if(ar.aph>=1)ms++;if(df.dtlr>=3)ms++;if(bg.bgh>=1)ms++;if(cs2>=1||ss>=1)ms++;return{sc:sc2,ms,ol,nh,to,tno,rm,sth,aph:ar.aph,asc:ar.asc+df.dts,dtlr:df.dtlr,bgh:bg.bgh,beh:bg.beh,bph:bg.bph,bsc:bg.bsc,cs:cs2,lrs,ss}}
function gcrp2(n3=[],srn=new Set()){const segs=bcs(n3);let lr=0,rp=0,drc=0;segs.forEach(seg=>{lr=Math.max(lr,seg.length);const sc2=seg.filter(n=>srn.has(n)).length;const sr=seg.length>0?sc2/seg.length:0;const sd=sr>=0.8?0.45:sr>=0.6?0.75:1;if(seg.length===2){drc++;rp+=Math.round(8*sd);return}if(seg.length>=4){rp+=Math.round((70+(seg.length-4)*16)*sd);return}if(seg.length===3){rp+=Math.round(36*sd)}});if(drc>=2)rp+=(drc-1)*10;return{lr,rp}}
function gcss2(n3=[],i=iv){const s=gu(n3);if(s.length<=1)return{sp:0,spn:0,spb:0,ci:0};const sp=s[s.length-1]-s[0];let spn=0,spb=0;const ics=i.map(()=>0);s.forEach(x=>{const d=gi(x,i);if(d>=0)ics[d]++});const cic=ics.filter(c=>c>0).length;const mic=ics.length>0?Math.max(...ics):s.length;if(cic>=3){if(sp>=15&&sp<=28)spb+=16;else if(sp>=12&&sp<=32)spb+=8;if(sp<=18)spn+=2;if(sp<=16)spn+=4;if(sp<=13)spn+=8;if(sp<=10)spn+=14}else if(cic===2){if(sp<=12)spn+=3;if(sp<=10)spn+=6;if(sp<=8)spn+=10;if(sp<=6)spn+=14}else{if(sp<=7)spn+=2;if(sp<=5)spn+=6;if(sp<=3)spn+=10}for(let i=0;i<s.length;i++){let j=i;while(j<s.length&&s[j]-s[i]<=8)j++;const c=j-i;if(cic>=3){if(c>=4)spn+=14+(c-4)*8;else if(c===3)spn+=4}else if(cic===2){if(c>=4)spn+=10+(c-4)*6}else{if(c>=4)spn+=8+(c-4)*4}}if(cic>=3){if(mic>=4)spn+=10+(mic-4)*6}else if(cic===2){if(mic>=4)spn+=8+(mic-4)*4}if(cic>=3){const mnc=Math.min(...ics.filter(c=>c>0));if(mnc>=1)spb+=6;if(mnc>=2)spb+=8}return{sp,spn,spb,ci:cic}}
function bbr2(n){const ns2=gu(n);const{pars,lr}=ccp(ns2);const ss2=bcs(ns2);const ts2=new Set(ns2.map(x=>x%10));return{n:ns2,t:ts2,cp:pars,lr2:lr,cs2:ss2,r:grk(ns2),ta:bta(ns2)}}
function scf2(cn2,an2,refs2,fm2,hn2,cld2,sel){const n3=gu(cn2);const at=esat(n3,an2,sel);const{rp,lr}=gcrp2(n3,at.srn);const sp3=gcss2(n3);const asp=at.arsh>=2?Math.round(sp3.spn*0.6):sp3.spn;let fb=0,cb=0;if(fm2)n3.forEach(x=>{const c=fm2.get(x)||0;if(c>=2)fb+=c*4});if(cld2){const ch=n3.filter(x=>cld2.has(x)).length;cb=ch*10}let hb=0;if(hn2&&hn2.size>0){const hh=n3.filter(x=>hn2.has(x)).length;if(hh>=2)hb=hh*6}const rms=refs2.map(ref=>escar2(n3,ref));const rmsc=rms.reduce((s,m)=>s+(m.sc||0),0);const rsr=rms.filter(m=>(m.ms||0)>=2).length;const rsmb=rsr>0?rsr*6:0;const ivc=[0,0,0];n3.forEach(x=>{if(x>=1&&x<=12)ivc[0]++;else if(x>=13&&x<=24)ivc[1]++;else if(x>=25&&x<=35)ivc[2]++});const covIntervals=ivc.filter(c=>c>0).length;const diversityBonus=covIntervals>=3?30:covIntervals>=2?10:0;let stmb=0;const aTailGrp=new Map();an2.forEach(a=>{const t=a%10;if(!aTailGrp.has(t))aTailGrp.set(t,[]);aTailGrp.get(t).push(a)});n3.forEach(n=>{const t=n%10;if(aTailGrp.has(t)&&aTailGrp.get(t).length>0){if(n>=10&&n<=33)stmb+=6;else if(n<10)stmb-=4}});const comboRatio=grk(n3);const refRatioFreq=new Map();refs2.forEach(ref=>{const selSet=new Set(sel);const isSel=ref.n&&ref.n.every(x=>selSet.has(x));if(isSel)return;const rk=ref.r||grk(ref.n||[]);refRatioFreq.set(rk,(refRatioFreq.get(rk)||0)+1)});let expRatio=null,expCount=0;refRatioFreq.forEach((c,r)=>{if(c>expCount){expCount=c;expRatio=r}});const rmb=expRatio&&comboRatio===expRatio?80:0;const mil=Math.max(...ivc);const erp=mil>=5?(mil-4)*200:mil>=4?(mil-3)*100:0;const selRatio=ratio(sel);const comboIv=[ivc[0],ivc[1],ivc[2]];let rcs=0;for(let x=0;x<3;x++){if(selRatio[x]===0&&comboIv[x]>=1)rcs+=15;if(selRatio[x]>=4&&comboIv[x]<=3)rcs+=10}const maxD=Math.max(...comboIv)-Math.min(...comboIv);if(maxD<=2)rcs+=10;if(maxD<=1)rcs+=20;
// 尾号连续/等差模式评分
const cTails=n3.map(x=>x%10).sort((a,b)=>a-b);
const uTails=[...new Set(cTails)];
let tps=0;
let lCon=1,cCon=1;
for(let i=1;i<uTails.length;i++){if(uTails[i]===uTails[i-1]+1){cCon++;lCon=Math.max(lCon,cCon)}else cCon=1}
if(lCon>=3)tps+=40;else if(lCon>=2)tps+=20;
let hAP3=false,hAP4=false;
for(let d=2;d<=4;d++){for(let st=0;st<=9-d*2;st++){let cnt=0;for(let v=st;v<=9;v+=d){if(uTails.includes(v))cnt++;else break}if(cnt>=4)hAP4=true;if(cnt>=3)hAP3=true}}
if(hAP4)tps+=30;else if(hAP3)tps+=15;
// 尾号重复评分：移除（分析显示对命中率提升有限）
const selTails=[...new Set(sel.map(x=>x%10))];
const toc=uTails.filter(t=>selTails.includes(t)).length;
const tos=0;
return{nums:n3,sc:at.ats+at.ecb+at.tdb+at.fob+at.acb+(at.akb||0)+(at.fmb||0)+(at.tsb||0)-at.acp2-at.akp-rp-asp+(sp3.spb||0)+fb+cb+hb+rmsc+rsmb+diversityBonus+stmb+rmb-erp+rcs*3+tps+tos,ratio:comboRatio,expRatio,rcs,tps,toc,tos}}
function cg2(arr,pk){const s=[];function h(st,d,cur){if(d===pk){s.push([...cur]);return}for(let i=st;i<=arr.length-(pk-d);i++){cur[d]=arr[i];h(i+1,d+1,cur)}}h(0,0,new Array(pk));return s}

function rr(tr,rad){
  const tn2=gu(draws[tr]||[]);
  const refs=gsw(tr,rad);
  let an2=ga(refs).filter(n=>!tn2.includes(n));
  // 限制锚点数量：当锚点>7时，只保留单号得分最高的7个
  if(an2.length>7){
    const all=Array.from({length:35},(_,i)=>i+1);
    const anchorScores=all.map(n=>{
      if(!an2.includes(n))return{n,sc:-1};
      const sg=esat([n],an2);
      let s=(sg.ats||0)+(sg.tc||0)*14+(sg.fob||0)+(sg.akb||0)+(sg.fmb||0)+(sg.tsb||0)-(sg.akp||0);
      return{n,sc:s};
    }).filter(x=>x.sc>=0).sort((a,b)=>b.sc-a.sc);
    an2=anchorScores.slice(0,7).map(x=>x.n).sort((a,b)=>a-b);
  }
  const fm2=new Map();
  for(let r=Math.max(1,tr-10);r<tr;r++){if(!draws[r])continue;draws[r].forEach(x=>fm2.set(x,(fm2.get(x)||0)+1))}
  const cld2=new Set();for(let i=1;i<=35;i++){if(!fm2.has(i))cld2.add(i)}
  const hn2=new Set();fm2.forEach((c,n)=>{if(c>=2)hn2.add(n)});
  const rob=refs.map(r=>bbr2(draws[r]));
  const all=Array.from({length:35},(_,i)=>i+1);
  const ss2=all.map(n=>{const sg=esat([n],an2);let s=(sg.ats||0)+(sg.tc||0)*14+(sg.fob||0)+(sg.akb||0)+(sg.fmb||0)+(sg.tsb||0)-(sg.akp||0);if(cld2.has(n))s+=12;const fc=fm2.get(n)||0;if(fc>=2)s+=fc*3;
  // 远距离补偿：距锚点4-8的号码获得合理得分
  const anchorSet=new Set(an2);
  if(!anchorSet.has(n)){
    const dists=an2.map(a=>Math.abs(n-a)).sort((a,b)=>a-b);
    const minDist=dists[0]||99;
    if(minDist>=4&&minDist<=8)s+=Math.max(0,(9-minDist)*3); // 距离4-8给3-15分补偿
  }
  // 同尾号中间优先：尾号相同时，优先13/23/33（中间号），弱化3（边缘号）
  const tail=n%10;
  const tailGroup=an2.filter(a=>a%10===tail);
  if(tailGroup.length>0){
    if(n>=10&&n<=33)s+=8;  // 中间号加分
    else if(n<10)s-=6;      // 边缘号减分
  }
  return{n,sc:s}}).sort((a,b)=>b.sc-a.sc||a.n-b.n);
  const PS=25;const pool=new Set();tn2.forEach(n=>pool.add(n));
  // 锚点号码保底：所有锚点号码优先进入选号池
  an2.forEach(n=>pool.add(n));
  // 区间感知选号：确保每个区间至少有代表
  // 先计算每个区间已有多少号码
  const ivCounts=[0,0,0];
  pool.forEach(n=>{if(n>=1&&n<=12)ivCounts[0]++;else if(n>=13&&n<=24)ivCounts[1]++;else if(n>=25&&n<=35)ivCounts[2]++});
  // 每个区间至少保证3个名额
  const minPerInterval=3;
  for(let iv=0;iv<3;iv++){
    const min=minPerInterval-ivCounts[iv];
    if(min<=0)continue;
    const range=iv===0?[1,12]:iv===1?[13,24]:[25,35];
    const candidates=ss2.filter(s=>s.n>=range[0]&&s.n<=range[1]&&!pool.has(s.n));
    for(let i=0;i<Math.min(min,candidates.length)&&pool.size<PS;i++){
      pool.add(candidates[i].n);
    }
  }
  // 剩余名额按得分填充
  for(const s of ss2){if(pool.size>=PS)break;pool.add(s.n)}
  const sp2=[...pool].sort((a,b)=>a-b);
  const allC=cg2(sp2,5).map(c=>scf2(c,an2,rob,fm2,hn2,cld2,tn2));
  allC.sort((a,b)=>b.sc-a.sc);
  return allC.slice(0,5).map(c=>({...c,sel:tn2}));
}

// 批量回测：跨10期，从row1→row11到row25→row35
console.log("=".repeat(70));
console.log("批量回测 — 跨10期回放（step=10）");
console.log("数据范围：row1(2026017) → row35(2026051)");
console.log("=".repeat(70));
console.log();

const batchResults = [];
for (let sourceRow = 1; sourceRow <= 25; sourceRow++) {
  const targetRow = sourceRow + 10;
  if (!draws[sourceRow] || !draws[targetRow]) continue;

  const target = draws[targetRow];
  const targetSet = new Set(target);
  const targetRatio = grk(target);
  const selNums = draws[sourceRow];
  const selTails = [...new Set(selNums.map(x => x % 10))];

  const top5 = rr(sourceRow, 1);
  const hits = top5.map(c => c.nums.filter(n => targetSet.has(n)).length);
  const maxHits = Math.max(...hits);
  const avgHits = hits.reduce((a, b) => a + b, 0) / hits.length;

  batchResults.push({
    sourceRow,
    targetRow,
    sourceIssue: `2026${String(16 + sourceRow).padStart(3, '0')}`,
    targetIssue: `2026${String(16 + targetRow).padStart(3, '0')}`,
    target,
    top5Hits: hits,
    maxHits,
    avgHits,
  });

  console.log(`[${sourceRow}→${targetRow}] ${selNums.join(",")} → [${target.join(",")}] 区间比:${targetRatio}`);
  top5.forEach((c, i) => {
    const hitNums = c.nums.filter(n => targetSet.has(n));
    const ratioStr = c.ratio || grk(c.nums);
    const match = ratioStr === targetRatio ? "✓" : "✗";
    console.log(`  #${i + 1} [${c.nums.join(",")}] 区间比${ratioStr} ${match} 命中${hitNums.length}球 (${hitNums.join(",") || "无"})`);
  });
  console.log(`  统计: 最多${maxHits}球, 平均${avgHits.toFixed(2)}球`);
  console.log();
}

// 汇总
console.log("=".repeat(70));
console.log("汇总统计");
console.log("=".repeat(70));
const totalPairs = batchResults.length;
const avgMaxHits = batchResults.reduce((s, r) => s + r.maxHits, 0) / totalPairs;
const avgAvgHits = batchResults.reduce((s, r) => s + r.avgHits, 0) / totalPairs;
const maxHitCounts = [0, 0, 0, 0, 0, 0];
batchResults.forEach(r => { maxHitCounts[r.maxHits]++; });

console.log(`总期数: ${totalPairs}`);
console.log(`平均最多命中: ${avgMaxHits.toFixed(2)}球`);
console.log(`平均Top5命中: ${avgAvgHits.toFixed(2)}球`);
console.log(`最多命中球数分布:`);
for (let i = 0; i <= 5; i++) {
  if (maxHitCounts[i] > 0) console.log(`  ${i}球: ${maxHitCounts[i]}期 (${(maxHitCounts[i] / totalPairs * 100).toFixed(1)}%)`);
}

// 找出最差的5期
const worst5 = batchResults.slice().sort((a, b) => a.maxHits - b.maxHits).slice(0, 5);
console.log(`\n最差的5期:`);
worst5.forEach(r => {
  console.log(`  [${r.sourceRow}→${r.targetRow}] ${r.sourceIssue}→${r.targetIssue} 最多${r.maxHits}球 平均${r.avgHits.toFixed(2)}球`);
});
console.log("=".repeat(70));
