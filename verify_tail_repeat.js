// 验证：尾号重复 + 尾号等差 + 尾号相邻 + 尾号重复相连 综合对比
// 新增：第30期测试，重点分析尾号重复相连模式

const ow=new Map([[1,8],[2,8],[3,8],[4,11],[5,12],[6,6],[7,11],[8,5],[9,4],[10,3]]);
function segs(a){const s=[...a].sort((x,y)=>x-y);const o=[];let c=[s[0]];for(let i=1;i<s.length;i++){if(s[i]===s[i-1]+1)c.push(s[i]);else{if(c.length>=2)o.push(c);c=[s[i]];}}if(c.length>=2)o.push(c);return o;}
function gus(a){return [...new Set(a)].sort((x,y)=>x-y);}
function primaryAdjacent(n,as,ans){const as2=gus(as);const ans2=ans||new Set(as2);if(ans2.has(n))return 0;let sc=0;for(let i=0;i<as2.length;i++){if(Math.abs(n-as2[i])===1)sc+=4;}return sc;}
function adjacentFreq(n,as,ans){const as2=gus(as);const ans2=ans||new Set(as2);if(ans2.has(n))return 0;let f=0;for(let i=0;i<as2.length;i++){if(Math.abs(n-as2[i])===1)f+=1;}return f*2;}

// === 尾号信号函数 ===

// 尾号重复：奖励1-3个重叠
function tailRepeat(cn, as) {
  const aTails = new Set(as.map(n => n % 10));
  const matchCount = cn.filter(n => aTails.has(n % 10)).length;
  if (matchCount >= 1 && matchCount <= 3) return matchCount * 5;
  return 0;
}

// 尾号等差
function tailArithmetic(cn, as) {
  const aTails = [...new Set(as.map(n => n % 10))].sort((a, b) => a - b);
  const cTails = [...new Set(cn.map(n => n % 10))].sort((a, b) => a - b);
  if (aTails.length < 2 || cTails.length < 2) return 0;
  const aDiffs = [];
  for (let i = 1; i < aTails.length; i++) aDiffs.push(aTails[i] - aTails[i - 1]);
  if (aDiffs.length === 0) return 0;
  const diffCount = {};
  aDiffs.forEach(d => { diffCount[d] = (diffCount[d] || 0) + 1; });
  const modeDiff = Object.entries(diffCount).sort((a, b) => b[1] - a[1])[0];
  if (!modeDiff || modeDiff[1] < 2) return 0;
  const step = parseInt(modeDiff[0]);
  let score = 0;
  for (let i = 1; i < cTails.length; i++) {
    if (cTails[i] - cTails[i - 1] === step) score += 3;
  }
  let chainLen = 1, maxChain = 1;
  for (let i = 1; i < cTails.length; i++) {
    if (cTails[i] - cTails[i - 1] === step) { chainLen++; maxChain = Math.max(maxChain, chainLen); }
    else chainLen = 1;
  }
  if (maxChain >= 3) score += 6;
  const allTails = [...new Set([...aTails, ...cTails])].sort((a, b) => a - b);
  let crossArithmetic = 0;
  for (let i = 1; i < allTails.length; i++) {
    if (allTails[i] - allTails[i - 1] === step) {
      const hasAnchor = aTails.includes(allTails[i - 1]) || aTails.includes(allTails[i]);
      const hasCandidate = cTails.includes(allTails[i - 1]) || cTails.includes(allTails[i]);
      if (hasAnchor && hasCandidate) crossArithmetic++;
    }
  }
  score += crossArithmetic * 2;
  return score;
}

// 尾号相邻
function tailAdjacent(cn, as) {
  const aTails = [...new Set(as.map(n => n % 10))];
  const cTails = [...new Set(cn.map(n => n % 10))];
  let score = 0;
  const usedPairs = new Set();
  cTails.forEach(ct => {
    aTails.forEach(at => {
      const rawDiff = Math.abs(ct - at);
      const isAdj = rawDiff === 1 || rawDiff === 9;
      if (!isAdj) return;
      const pairKey = `${Math.min(ct, at)}-${Math.max(ct, at)}`;
      if (usedPairs.has(pairKey)) return;
      usedPairs.add(pairKey);
      score += 2;
      const adjCount = aTails.filter(at2 => { const d = Math.abs(ct - at2); return d === 1 || d === 9; }).length;
      if (adjCount >= 2) score += 1;
    });
  });
  const cAdjPairs = [];
  for (let i = 0; i < cTails.length; i++) for (let j = i + 1; j < cTails.length; j++) {
    const d = Math.abs(cTails[i] - cTails[j]);
    if (d === 1 || d === 9) cAdjPairs.push([cTails[i], cTails[j]]);
  }
  const aAdjPairs = [];
  for (let i = 0; i < aTails.length; i++) for (let j = i + 1; j < aTails.length; j++) {
    const d = Math.abs(aTails[i] - aTails[j]);
    if (d === 1 || d === 9) aAdjPairs.push([aTails[i], aTails[j]]);
  }
  if (cAdjPairs.length > 0 && aAdjPairs.length > 0) {
    score += Math.min(cAdjPairs.length, aAdjPairs.length) * 3;
  }
  return score;
}

// === 新增：尾号重复相连 ===
// 核心思想：如果锚点尾号自身有重复（如0,0）或相连（如0,1或9,0），
// 那么候选组合也应该有类似的"重复相连"模式
function tailRepeatConnect(cn, as) {
  const aTails = as.map(n => n % 10); // 保留重复
  const cTails = cn.map(n => n % 10); // 保留重复
  
  // 统计锚点尾号的重复次数
  const aTailCount = {};
  aTails.forEach(t => { aTailCount[t] = (aTailCount[t] || 0) + 1; });
  
  // 统计候选尾号的重复次数
  const cTailCount = {};
  cTails.forEach(t => { cTailCount[t] = (cTailCount[t] || 0) + 1; });
  
  let score = 0;
  
  // 1. 锚点有重复尾号 → 候选也应有重复尾号
  const aRepeated = Object.entries(aTailCount).filter(([t, c]) => c >= 2).map(([t]) => parseInt(t));
  const cRepeated = Object.entries(cTailCount).filter(([t, c]) => c >= 2).map(([t]) => parseInt(t));
  
  // 锚点有N个重复尾号，候选有M个重复尾号
  if (aRepeated.length > 0) {
    // 候选也有重复尾号（匹配）
    score += cRepeated.length * 6;
    // 如果重复的尾号相同，额外加分
    const matchedRepeat = aRepeated.filter(t => cRepeated.includes(t)).length;
    score += matchedRepeat * 8;
    // 如果候选重复尾号与锚点重复尾号相邻（如锚点重复0，候选重复1），也加分
    aRepeated.forEach(at => {
      cRepeated.forEach(ct => {
        const d = Math.abs(at - ct);
        if (d === 1 || d === 9) score += 4;
      });
    });
  }
  
  // 2. 锚点有相连尾号 → 候选也应有相连尾号
  const aUniqueTails = [...new Set(aTails)].sort((a, b) => a - b);
  const cUniqueTails = [...new Set(cTails)].sort((a, b) => a - b);
  
  // 锚点相连对
  const aConnectPairs = [];
  for (let i = 0; i < aUniqueTails.length; i++) {
    for (let j = i + 1; j < aUniqueTails.length; j++) {
      const d = aUniqueTails[j] - aUniqueTails[i];
      if (d === 1 || d === 9) aConnectPairs.push([aUniqueTails[i], aUniqueTails[j]]);
    }
  }
  
  // 候选相连对
  const cConnectPairs = [];
  for (let i = 0; i < cUniqueTails.length; i++) {
    for (let j = i + 1; j < cUniqueTails.length; j++) {
      const d = cUniqueTails[j] - cUniqueTails[i];
      if (d === 1 || d === 9) cConnectPairs.push([cUniqueTails[i], cUniqueTails[j]]);
    }
  }
  
  // 锚点有相连 → 候选也有相连
  if (aConnectPairs.length > 0 && cConnectPairs.length > 0) {
    score += Math.min(aConnectPairs.length, cConnectPairs.length) * 5;
    // 相连对完全匹配（如锚点0-1相连，候选也有0-1相连）
    const exactMatch = aConnectPairs.filter(([a1, a2]) => 
      cConnectPairs.some(([c1, c2]) => a1 === c1 && a2 === c2)
    ).length;
    score += exactMatch * 6;
  }
  
  // 3. 重复+相连组合模式（如锚点有0,0,1 → 重复0且0-1相连）
  // 检查候选是否也有类似组合
  aRepeated.forEach(rt => {
    const hasConnect = aConnectPairs.some(([a, b]) => a === rt || b === rt);
    if (hasConnect) {
      // 锚点有"重复+相连"组合
      const cHasRepeat = cRepeated.includes(rt);
      const cHasConnect = cConnectPairs.some(([a, b]) => a === rt || b === rt);
      if (cHasRepeat && cHasConnect) score += 10; // 完全匹配
      else if (cHasRepeat || cHasConnect) score += 4; // 部分匹配
    }
  });
  
  return score;
}

// === 基础评分函数 ===
function evalBaseV2(numbers,anchors){const cn=gus(numbers),as=gus(anchors),aSet=new Set(as);const srn=new Set(),en=new Set(),ea=new Map(),tn=new Set(),fon=new Set();let ats=0,akh=0;cn.forEach(n=>{if(aSet.has(n)){akh++;ats+=6;en.add(n);ea.set(n,(ea.get(n)||0)+1);}as.forEach(a=>{const d=Math.abs(n-a);const w=ow.get(d)||0;if(w<=0)return;ats+=w;en.add(n);ea.set(a,(ea.get(a)||0)+1);if(!aSet.has(n))tn.add(n);if(d>=4||d===7)fon.add(n);});});segs(as).forEach(sg=>{const st=sg[0],ed=sg[sg.length-1];cn.forEach(n=>{if(n>=st-4&&n<=ed+4&&!aSet.has(n)){const dist=n<st?st-n:n-ed;if(dist>=1&&dist<=4){ats+=16-dist*2;srn.add(n);en.add(n);}}});});segs(cn).forEach(sg=>{const sc=sg.filter(n=>srn.has(n)||as.some(a=>Math.abs(n-a)<=3)).length;if(sc>=Math.min(2,sg.length)){sg.forEach(n=>srn.add(n));sg.forEach(n=>en.add(n));ats+=sg.length*8;}});const ec=en.size,tc=tn.size,fc=fon.size,ac=ea.size;const ecb=ec>=cn.length?cn.length*14:ec>=cn.length-1?ec*10:ec>=3?ec*6:ec*2;const tdb=tc>=cn.length-1?tc*16:tc>=3?tc*11:tc*4;const fob=fc>=3?fc*14:fc>=2?fc*10:fc*3;const akp=akh>=4?(akh-3)*14:0,akb=akh>=2&&akh<=3?(akh-1)*14:0;const acb=ac>=4?ac*12:ac>=3?ac*7:ac*2;const mal=ea.size>0?Math.max(...ea.values()):0;const lds=[...ea.values()],oa=lds.filter(l=>l>=3).length,ta=as.length;let cd=1.0;if(oa<=Math.ceil(ta*0.4)&&mal<=5)cd=0.5;const acp=mal>=4?Math.round((mal-3)*12*cd):(mal>=3&&oa>=Math.ceil(ta*0.6)?Math.round((mal-2)*12*0.7):0);const rgs=segs(cn);let rp=0,drc=0;rgs.forEach(sg=>{const spc=sg.filter(n=>srn.has(n)).length;const sr=sg.length>0?spc/sg.length:0;const sd=sr>=0.8?0.45:sr>=0.6?0.75:1;if(sg.length===2){drc++;rp+=Math.round(8*sd);}else if(sg.length>=4)rp+=Math.round((70+(sg.length-4)*16)*sd);else if(sg.length===3)rp+=Math.round(36*sd);});if(drc>=2)rp+=(drc-1)*6;return ats+ecb+tdb+fob+acb+akb-acp-akp-rp;}

function evalBaseV4(numbers,anchors){const cn=gus(numbers),as=gus(anchors),aSet=new Set(as);const srn=new Set(),en=new Set(),ea=new Map(),tn=new Set(),fon=new Set();let ats=0,akh=0,fourBonus=0;cn.forEach(n=>{if(aSet.has(n)){akh++;ats+=6;en.add(n);ea.set(n,(ea.get(n)||0)+1);}as.forEach(a=>{const d=Math.abs(n-a);const w=ow.get(d)||0;if(w<=0)return;ats+=w;en.add(n);ea.set(a,(ea.get(a)||0)+1);if(!aSet.has(n))tn.add(n);if(d>=4||d===7)fon.add(n);});fourBonus+=primaryAdjacent(n,as,aSet);fourBonus+=adjacentFreq(n,as,aSet);});segs(as).forEach(sg=>{const st=sg[0],ed=sg[sg.length-1];cn.forEach(n=>{if(n>=st-4&&n<=ed+4&&!aSet.has(n)){const dist=n<st?st-n:n-ed;if(dist>=1&&dist<=4){ats+=16-dist*2;srn.add(n);en.add(n);}}});});segs(cn).forEach(sg=>{const sc=sg.filter(n=>srn.has(n)||as.some(a=>Math.abs(n-a)<=3)).length;if(sc>=Math.min(2,sg.length)){sg.forEach(n=>srn.add(n));sg.forEach(n=>en.add(n));ats+=sg.length*8;}});const ec=en.size,tc=tn.size,fc=fon.size,ac=ea.size;const ecb=ec>=cn.length?cn.length*14:ec>=cn.length-1?ec*10:ec>=3?ec*6:ec*2;const tdb=tc>=cn.length-1?tc*16:tc>=3?tc*11:tc*4;const fob=fc>=3?fc*14:fc>=2?fc*10:fc*3;const akp=akh>=4?(akh-3)*14:0,akb=akh>=2&&akh<=3?(akh-1)*14:0;const acb=ac>=4?ac*12:ac>=3?ac*7:ac*2;const mal=ea.size>0?Math.max(...ea.values()):0;const lds=[...ea.values()],oa=lds.filter(l=>l>=3).length,ta=as.length;let cd=1.0;if(oa<=Math.ceil(ta*0.4)&&mal<=5)cd=0.5;const acp=mal>=4?Math.round((mal-3)*12*cd):(mal>=3&&oa>=Math.ceil(ta*0.6)?Math.round((mal-2)*12*0.7):0);const rgs=segs(cn);let rp=0,drc=0;rgs.forEach(sg=>{const spc=sg.filter(n=>srn.has(n)).length;const sr=sg.length>0?spc/sg.length:0;const sd=sr>=0.8?0.45:sr>=0.6?0.75:1;if(sg.length===2){drc++;rp+=Math.round(8*sd);}else if(sg.length>=4)rp+=Math.round((70+(sg.length-4)*16)*sd);else if(sg.length===3)rp+=Math.round(36*sd);});if(drc>=2)rp+=(drc-1)*6;return ats+ecb+tdb+fob+acb+akb+fourBonus-acp-akp-rp;}

function gen(al){const all=new Set();al.forEach(a=>a.forEach(n=>{for(let d=-8;d<=8;d++){const v=n+d;if(v>=1&&v<=35)all.add(v);}}));const p=[...all].sort((a,b)=>a-b);const c=[];for(let i=0;i<p.length-4;i++)for(let j=i+1;j<p.length-3;j++)for(let k=j+1;k<p.length-2;k++)for(let l=k+1;l<p.length-1;l++)for(let m=l+1;m<p.length;m++)c.push([p[i],p[j],p[k],p[l],p[m]]);return c;}

// 包含第30期
const draws = {
  17: [2,9,14,20,31], 18: [2,6,14,22,24], 19: [9,10,20,33,35],
  20: [6,7,18,21,30], 21: [23,25,26,27,34], 22: [7,12,13,18,34],
  23: [6,13,17,19,26], 24: [22,28,30,31,34], 25: [10,12,15,26,35],
  26: [7,15,20,24,29], 27: [3,15,20,29,31], 28: [3,13,15,17,21],
  29: [4,11,12,13,25], 30: [10,13,19,21,30],
};

const tests = [
  {n:"第19期",a:[[9,10,20,33,35],[2,6,14,22,24],[2,9,14,20,31]],t:[4,11,12,13,25]},
  {n:"第20期",a:[[9,10,20,33,35],[6,7,18,21,30]],t:[10,13,19,21,30]},
  {n:"第30期",a:[[10,13,19,21,30],[4,11,12,13,25],[3,13,15,17,21]],t:[7,15,20,24,29]},
];

// === 尾号模式分析 ===
console.log("=== 尾号模式深度分析 ===\n");
tests.forEach(({n,a,t}) => {
  console.log(`【${n}】`);
  a.forEach((row,i) => {
    const tails = row.map(n => n % 10);
    const tailCount = {};
    tails.forEach(t => { tailCount[t] = (tailCount[t] || 0) + 1; });
    const repeated = Object.entries(tailCount).filter(([t,c]) => c >= 2);
    const uTails = [...new Set(tails)].sort((a,b)=>a-b);
    const connectPairs = [];
    for(let j=0;j<uTails.length;j++) for(let k=j+1;k<uTails.length;k++) {
      if(uTails[k]-uTails[j]===1||uTails[k]-uTails[j]===9) connectPairs.push([uTails[j],uTails[k]]);
    }
    console.log(`  锚点${i+1}: ${row} → 尾号[${tails}]  重复:${repeated.length>0?repeated.map(([t,c])=>`${t}x${c}`).join(','):'无'}  相连:${connectPairs.length>0?JSON.stringify(connectPairs):'无'}`);
  });
  const tTails = t.map(n=>n%10);
  const tTailCount = {};
  tTails.forEach(t => { tTailCount[t] = (tTailCount[t] || 0) + 1; });
  const tRepeated = Object.entries(tTailCount).filter(([t,c]) => c >= 2);
  const tUTails = [...new Set(tTails)].sort((a,b)=>a-b);
  const tConnect = [];
  for(let j=0;j<tUTails.length;j++) for(let k=j+1;k<tUTails.length;k++) {
    if(tUTails[k]-tUTails[j]===1||tUTails[k]-tUTails[j]===9) tConnect.push([tUTails[j],tUTails[k]]);
  }
  console.log(`  目标: ${t} → 尾号[${tTails}]  重复:${tRepeated.length>0?tRepeated.map(([t,c])=>`${t}x${c}`).join(','):'无'}  相连:${tConnect.length>0?JSON.stringify(tConnect):'无'}`);
  console.log();
});

console.log("=".repeat(85));

// 预计算所有组合
const allCombos = {};
tests.forEach(({n,a}) => { allCombos[n] = gen(a); });

console.log("\n=== 综合信号对比（含尾号重复相连） ===\n");
console.log("=".repeat(85));

tests.forEach(({n,a,t}) => {
  const all = allCombos[n], ts = JSON.stringify(t), tot = all.length;
  
  const rV2 = rank(all, a, t, evalBaseV2);
  const rV4 = rank(all, a, t, evalBaseV4);
  
  console.log(`\n【${n}】目标: ${t}  总组合: ${tot.toLocaleString()}`);
  console.log(`  V2基线:       #${rV2.toLocaleString()} (${(rV2/tot*100).toFixed(2)}%)`);
  console.log(`  V4邻号:       #${rV4.toLocaleString()} (${(rV4/tot*100).toFixed(2)}%)  Δ=${rV2-rV4>0?'+':''}${rV2-rV4}`);
  
  const strategies = [
    // 单独信号
    {name:'+尾号重复',     fn:(c,as)=>evalBaseV4(c,as)+tailRepeat(c,as)},
    {name:'+尾号等差',     fn:(c,as)=>evalBaseV4(c,as)+tailArithmetic(c,as)},
    {name:'+尾号相邻',     fn:(c,as)=>evalBaseV4(c,as)+tailAdjacent(c,as)},
    {name:'+尾号重复相连', fn:(c,as)=>evalBaseV4(c,as)+tailRepeatConnect(c,as)},
    // 最佳组合（不含等差，因为等差单独效果差）
    {name:'+重+相+重连',   fn:(c,as)=>evalBaseV4(c,as)+tailRepeat(c,as)+tailAdjacent(c,as)+tailRepeatConnect(c,as)},
    // 三合一（之前的最佳）
    {name:'+三重尾号x1.5', fn:(c,as)=>evalBaseV4(c,as)+(tailRepeat(c,as)+tailArithmetic(c,as)+tailAdjacent(c,as))*1.5},
    // 四合一
    {name:'+四合一x1.0',   fn:(c,as)=>evalBaseV4(c,as)+(tailRepeat(c,as)+tailArithmetic(c,as)+tailAdjacent(c,as)+tailRepeatConnect(c,as))},
    {name:'+四合一x1.5',   fn:(c,as)=>evalBaseV4(c,as)+(tailRepeat(c,as)+tailArithmetic(c,as)+tailAdjacent(c,as)+tailRepeatConnect(c,as))*1.5},
    // 不含等差的四合一
    {name:'+重+相+重连x1.5',fn:(c,as)=>evalBaseV4(c,as)+(tailRepeat(c,as)+tailAdjacent(c,as)+tailRepeatConnect(c,as))*1.5},
    {name:'+重+相+重连x2.0',fn:(c,as)=>evalBaseV4(c,as)+(tailRepeat(c,as)+tailAdjacent(c,as)+tailRepeatConnect(c,as))*2.0},
  ];
  
  strategies.forEach(({name, fn}) => {
    const r = rank(all, a, t, fn);
    const d = rV4 - r;
    const symbol = d > 0 ? '+' : (d < 0 ? '' : ' ');
    console.log(`  ${name.padEnd(18)} #${r.toLocaleString()} (${(r/tot*100).toFixed(2)}%)  vsV4 Δ=${symbol}${d}`);
  });
});

function rank(all, a, t, evalFn) {
  const scored = all.map(c => {
    let best = -Infinity;
    a.forEach(an => { const r = evalFn(c, an); if (r > best) best = r; });
    return { c, s: best };
  });
  scored.sort((x, y) => y.s - x.s);
  return scored.findIndex(c => JSON.stringify(c.c) === JSON.stringify(t)) + 1;
}

console.log("\n" + "=".repeat(85));
