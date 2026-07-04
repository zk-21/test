// 验证：前100名重合分析 + 5期综合优化方案
const draws = {
  1: [7,12,13,28,32], 2: [8,17,21,33,35], 3: [9,11,20,26,27],
  4: [6,12,13,21,34], 5: [24,25,27,29,34], 6: [2,7,13,19,24],
  7: [8,12,14,19,22], 8: [3,8,22,26,29], 9: [1,15,21,26,33],
  10: [1,13,18,27,33], 11: [9,20,21,23,28], 12: [11,17,20,23,35],
  13: [1,6,14,15,17], 14: [6,10,14,23,33], 15: [13,18,28,32,33],
  16: [2,3,14,20,28], 17: [2,9,14,20,31], 18: [2,6,14,22,24],
  19: [9,10,20,33,35], 20: [6,7,18,21,30], 21: [23,25,26,27,34],
  22: [7,12,13,18,34], 23: [6,13,17,19,26], 24: [22,28,30,31,34],
  25: [10,12,15,26,35], 26: [7,15,20,24,29], 27: [3,15,20,29,31],
  28: [3,13,15,17,21], 29: [4,11,12,13,25], 30: [10,13,19,21,30],
};
const offsetWeights = new Map([[1,6],[2,6],[3,6],[4,7],[5,7],[6,5],[7,6],[8,4],[9,3],[10,2]]);
const targets = {
  16: [7,15,20,24,29], 17: [3,15,20,29,31],
  18: [3,13,15,17,21], 19: [4,11,12,13,25], 20: [10,13,19,21,30],
};

function combos(arr, pick) {
  const out=[];
  (function h(s,st){if(st.length===pick){out.push([...st]);return;}for(let i=s;i<=arr.length-(pick-st.length);i++){st.push(arr[i]);h(i+1,st);st.pop();}})(0,[]);
  return out;
}
function segs(arr) {
  if (!arr.length) return [];
  const sorted = [...arr].sort((a,b)=>a-b);
  const out = []; let s = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i-1] + 1) s.push(sorted[i]);
    else { if (s.length >= 2) out.push(s); s = [sorted[i]]; }
  }
  if (s.length >= 2) out.push(s);
  return out;
}

function scoreCombo(combo, anchors) {
  const anchorSet = new Set(anchors);
  const supportedRun = new Set();
  const explainable = new Set();
  const explainedA = new Map();
  const transformed = new Set();
  const farOffset = new Set();
  let baseScore = 0, keepHits = 0;

  combo.forEach(n => {
    if (anchorSet.has(n)) { keepHits++; baseScore += 6; explainable.add(n); explainedA.set(n,(explainedA.get(n)||0)+1); return; }
    anchors.forEach(a => {
      const d = Math.abs(n-a);
      const w = offsetWeights.get(d)||0;
      if (w>0) {
        baseScore += w;
        explainable.add(n);
        explainedA.set(a,(explainedA.get(a)||0)+1);
        if (!anchorSet.has(n)) transformed.add(n);
        if (d>=4||d===7) farOffset.add(n);
      }
    });
  });

  segs(anchors).forEach(seg => {
    const start = seg[0], end = seg[seg.length-1];
    combo.forEach(n => {
      if (n >= start-4 && n <= end+4 && !anchorSet.has(n)) {
        const dist = n < start ? start-n : n-end;
        if (dist>=1 && dist<=4) {
          baseScore += 16 - dist*2;
          supportedRun.add(n);
          explainable.add(n);
        }
      }
    });
  });

  segs(combo).forEach(seg => {
    const supCnt = seg.filter(n => supportedRun.has(n) || anchors.some(a => Math.abs(n-a)<=3)).length;
    if (supCnt >= Math.min(2, seg.length)) {
      seg.forEach(n => supportedRun.add(n));
      seg.forEach(n => explainable.add(n));
      baseScore += seg.length * 8;
    }
  });

  const ec = explainable.size, tc = transformed.size, fc = farOffset.size;
  const ecBonus = ec >= combo.length-1 ? ec*6 : ec>=3 ? ec*4 : ec*2;
  const tdBonus = tc >= combo.length-1 ? tc*16 : tc>=3 ? tc*11 : tc*4;
  const foBonus = fc >= 3 ? fc*14 : fc>=2 ? fc*10 : fc*3;
  const kpPenalty = keepHits >= 2 ? (keepHits-1)*14 : 0;
  const ac = new Set(explainedA.keys()).size;
  const acBonus = ac >= 4 ? ac*12 : ac>=3 ? ac*7 : ac*2;
  const maxLoad = explainedA.size>0 ? Math.max(...explainedA.values()) : 0;
  const crowdPenalty = maxLoad >= 3 ? (maxLoad-2)*12 : 0;

  let runPenalty = 0;
  segs(combo).forEach(seg => {
    const sc = seg.filter(n => supportedRun.has(n)).length;
    const sr = seg.length>0 ? sc/seg.length : 0;
    const disc = sr>=0.8 ? 0.45 : sr>=0.6 ? 0.75 : 1;
    if (seg.length===2) runPenalty += Math.round(8*disc);
    else if (seg.length===3) runPenalty += Math.round(36*disc);
    else if (seg.length>=4) runPenalty += Math.round((70+(seg.length-4)*16)*disc);
  });
  let dblCnt = 0; segs(combo).forEach(s=>{if(s.length===2)dblCnt++;});
  if (dblCnt>=2) runPenalty += (dblCnt-1)*6;

  const span = combo[4]-combo[0];
  let covInt = 0;
  const ints = [{min:1,max:12},{min:13,max:24},{min:25,max:35}];
  ints.forEach(iv=>{if(combo.some(n=>n>=iv.min&&n<=iv.max))covInt++;});
  let spPenalty = 0;
  if (covInt>=3){if(span<=18)spPenalty+=2;if(span<=16)spPenalty+=6;if(span<=13)spPenalty+=10;if(span<=10)spPenalty+=16;}
  else if(covInt===2){if(span<=12)spPenalty+=3;if(span<=10)spPenalty+=7;if(span<=8)spPenalty+=12;if(span<=6)spPenalty+=16;}
  else{if(span<=7)spPenalty+=2;if(span<=5)spPenalty+=6;if(span<=3)spPenalty+=10;}
  ints.forEach(iv=>{
    const cnt = combo.filter(n=>n>=iv.min&&n<=iv.max).length;
    if(covInt>=3){if(cnt>=4)spPenalty+=14+(cnt-4)*8;else if(cnt===3)spPenalty+=4;}
    else if(covInt===2){if(cnt>=4)spPenalty+=10+(cnt-4)*6;}
    else{if(cnt>=4)spPenalty+=8+(cnt-4)*4;}
  });
  const maxIc = Math.max(...ints.map(iv=>combo.filter(n=>n>=iv.min&&n<=iv.max).length));
  if(covInt>=3){if(maxIc>=4)spPenalty+=10+(maxIc-4)*6;}
  else if(covInt===2){if(maxIc>=4)spPenalty+=8+(maxIc-4)*4;}

  return baseScore+ecBonus+tdBonus+foBonus+acBonus-crowdPenalty-kpPenalty-runPenalty-spPenalty;
}

// 第19期 Top20 重合分析
console.log('=== 第19期 Top20 重合分析 ===\n');
let all = combos([...Array(35).keys()].map(x=>x+1),5);
let scored = all.map(c=>({c, s: scoreCombo(c, draws[19])}));
scored.sort((a,b)=>b.s-a.s);

scored.slice(0,20).forEach((x,i)=>{
  let ov = x.c.filter(n=>targets[19].includes(n)).length;
  console.log('  #'+(i+1)+' '+JSON.stringify(x.c)+' 评分='+x.s+' 重合='+ov+ (ov>=3?' ✅':''));
});

// 5期综合排名
console.log('\n=== 5期综合排名 ===');
[16,17,18,19,20].forEach(row => {
  let target = targets[row];
  let anchors = draws[row];
  let allC = combos([...Array(35).keys()].map(x=>x+1),5);
  let sc = allC.map(c=>({c, s: scoreCombo(c, anchors)}));
  sc.sort((a,b)=>b.s-a.s);
  let idx = sc.findIndex(x=>JSON.stringify(x.c)===JSON.stringify(target));
  
  // 前100重合
  let maxOv = 0, top100OvDist = {0:0,1:0,2:0,3:0,4:0,5:0};
  sc.slice(0,100).forEach(x=>{
    let ov = x.c.filter(n=>target.includes(n)).length;
    if(ov>maxOv) maxOv=ov;
    top100OvDist[ov] = (top100OvDist[ov]||0)+1;
  });
  
  console.log('第' + row + '期 目标排名: #' + (idx+1) + '/' + sc.length + 
    ' (前' + ((idx+1)/sc.length*100).toFixed(2) + '%)' +
    ' 前100最高重合: ' + maxOv + '个' +
    ' 重合分布: ' + JSON.stringify(top100OvDist));
});

// 优化方案：加频率加权
console.log('\n=== 优化方案：频率增强单号评分 ===');
[16,17,18,19,20].forEach(row => {
  let target = targets[row];
  let anchors = draws[row];
  
  // 历史频率
  let allHist = [];
  for (let r = 1; r <= row; r++) allHist = allHist.concat(draws[r]);
  let freq = {};
  for (let n=1; n<=35; n++) freq[n]=0;
  allHist.forEach(n=>freq[n]++);
  
  // 单号评分（原始 + 频率加成）
  let singleRaw = [];
  for (let n=1; n<=35; n++) {
    let s = 0;
    if (anchors.includes(n)) s += 6;
    anchors.forEach(a => { let d=Math.abs(n-a); s += offsetWeights.get(d)||0; });
    let far = anchors.some(a=>{let d=Math.abs(n-a); return d>=4||d===7;});
    if (far) s += 3;
    let trans = !anchors.includes(n) && anchors.some(a=>offsetWeights.has(Math.abs(n-a)));
    if (trans) s += 14;
    singleRaw.push({n, s, f: freq[n]});
  }
  
  // 选Top12（原始 vs 频率增强）
  let top12Raw = [...singleRaw].sort((a,b)=>b.s-a.s).slice(0,12);
  let top12Freq = [...singleRaw].sort((a,b)=>(b.s + b.f*2) - (a.s + a.f*2)).slice(0,12);
  
  let rawCov = top12Raw.filter(x=>target.includes(x.n)).length;
  let freqCov = top12Freq.filter(x=>target.includes(x.n)).length;
  
  console.log('第' + row + '期: 原始Top12重合=' + rawCov + 
    ' 频率增强Top12重合=' + freqCov +
    (freqCov > rawCov ? ' ↑+' + (freqCov-rawCov) : ''));
});

// 优化方案：加"冷号反弹"奖励
console.log('\n=== 优化方案：冷号反弹奖励 ===');
[16,17,18,19,20].forEach(row => {
  let target = targets[row];
  let anchors = draws[row];
  
  let allHist = [];
  for (let r=1; r<=row; r++) allHist = allHist.concat(draws[r]);
  let freq = {};
  for (let n=1; n<=35; n++) freq[n]=0;
  allHist.forEach(n=>freq[n]++);
  
  // 冷号：最近10期内未出现
  let recent10 = new Set();
  for (let r=Math.max(1,row-9); r<=row; r++) draws[r].forEach(n=>recent10.add(n));
  let coldNums = [];
  for (let n=1; n<=35; n++) if (!recent10.has(n)) coldNums.push(n);
  
  let coldInTarget = target.filter(n=>!recent10.has(n));
  console.log('第' + row + '期: 冷号=' + JSON.stringify(coldNums) + 
    ' 目标中冷号=' + JSON.stringify(coldInTarget) + 
    ' (' + coldInTarget.length + '/' + target.length + '个)');
});

// 最终优化方案：组合评分中加"冷号反弹"和"频率加权"
console.log('\n=== 最终优化：组合评分加冷热加权 ===');
function scoreComboV2(combo, anchors, rowNum) {
  let base = scoreCombo(combo, anchors);
  
  // 历史频率
  let allHist = [];
  for (let r=1; r<=rowNum; r++) allHist = allHist.concat(draws[r]);
  let freq = {};
  for (let n=1; n<=35; n++) freq[n]=0;
  allHist.forEach(n=>freq[n]++);
  
  // 最近10期未出现的冷号
  let recent10 = new Set();
  for (let r=Math.max(1,rowNum-9); r<=rowNum; r++) draws[r].forEach(n=>recent10.add(n));
  
  // 频率奖励：高频号 +2/次
  combo.forEach(n => {
    if (freq[n] >= 5) base += 10;
    else if (freq[n] >= 3) base += 4;
  });
  
  // 冷号反弹奖励
  combo.forEach(n => {
    if (!recent10.has(n) && freq[n] <= 1) base += 12;
    else if (!recent10.has(n)) base += 6;
  });
  
  return base;
}

console.log('5期综合排名（加冷热加权后）:');
[16,17,18,19,20].forEach(row => {
  let target = targets[row];
  let anchors = draws[row];
  let allC = combos([...Array(35).keys()].map(x=>x+1),5);
  let sc = allC.map(c=>({c, s: scoreComboV2(c, anchors, row)}));
  sc.sort((a,b)=>b.s-a.s);
  let idx = sc.findIndex(x=>JSON.stringify(x.c)===JSON.stringify(target));
  
  let maxOv = 0;
  sc.slice(0,100).forEach(x=>{
    let ov = x.c.filter(n=>target.includes(n)).length;
    if(ov>maxOv) maxOv=ov;
  });
  
  console.log('第' + row + '期: 排名 #' + (idx+1) + '/' + sc.length +
    ' (前' + ((idx+1)/sc.length*100).toFixed(2) + '%)' +
    ' 前100重合: ' + maxOv + '个');
});
