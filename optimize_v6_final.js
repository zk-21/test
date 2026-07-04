// optimize_v6_final.js — 最终优化方案
// 策略：保留原始全套评分逻辑 + 针对性改进，不做减法

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
  31: [4,7,16,26,32], 32: [2,22,30,33,34], 33: [11,12,25,26,27],
  34: [3,5,7,9,18], 35: [3,4,19,26,32], 36: [6,8,22,29,34],
  37: [2,13,22,28,34], 38: [3,5,17,33,35], 39: [15,27,29,30,34],
  40: [9,10,11,12,16], 41: [10,11,22,26,32], 42: [3,15,24,28,29],
  43: [2,4,8,10,21], 44: [9,25,26,27,28], 45: [1,3,6,19,22],
  46: [3,5,9,21,23], 47: [12,13,20,26,31], 48: [8,20,26,27,29],
  49: [9,11,19,30,35], 50: [4,5,10,23,31],
};

const targets = {
  19: [4,11,12,13,25], 20: [10,13,19,21,30],
  18: [3,13,15,17,21], 17: [3,15,20,29,31],
  16: [7,15,20,24,29],
};

const allRows = [16,17,18,19,20];
const intervals = [{min:1,max:12},{min:13,max:24},{min:25,max:35}];

function combos(arr, pick) {
  const out=[];
  (function h(s,st){if(st.length===pick){out.push([...st]);return;}for(let i=s;i<=arr.length-(pick-st.length);i++){st.push(arr[i]);h(i+1,st);st.pop();}})(0,[]);
  return out;
}

// ============================================================
// 三种方案对比
// ============================================================

// === 方案 A: 原始 sample_replay (V1，效果最好的基线) ===
const oldOffsets = new Map([[1,6],[2,6],[3,6],[4,7],[5,7],[6,5],[7,6],[8,4],[9,3],[10,2]]);

function scoreSingleV1(number, anchors) {
  const anchorSet = new Set(anchors);
  let s = 0;
  if (anchorSet.has(number)) s += 6;
  anchors.forEach(a => { const d = Math.abs(number - a); s += oldOffsets.get(d) || 0; });
  const transformed = !anchorSet.has(number) && anchors.some(a => oldOffsets.has(Math.abs(number - a)));
  if (transformed) s += 14;
  const far = anchors.some(a => { const d = Math.abs(number - a); return d >= 4 || d === 7; });
  if (far) s += 3;
  return s;
}

function evaluateAnchorV1(numbers, anchors) {
  // 完整复刻 sample_replay.js 的 evaluateSampleAnchorTransform
  const anchorSet = new Set(anchors);
  let score = 0, keepHits = 0;
  const explainedAnchors = new Map();
  const explainable = new Set();
  let transformedCount = 0, farOffsetCount = 0;

  numbers.forEach(n => {
    if (anchorSet.has(n)) {
      keepHits++; score += 6;
      explainedAnchors.set(n, (explainedAnchors.get(n)||0)+1);
      explainable.add(n); return;
    }
    anchors.forEach(a => {
      const d = Math.abs(n-a);
      const w = oldOffsets.get(d)||0;
      if (w>0) {
        score += w;
        if (d>=4||d===7) farOffsetCount++;
        explainable.add(n);
        explainedAnchors.set(a, (explainedAnchors.get(a)||0)+1);
      }
    });
    if (explainable.has(n)) transformedCount++;
  });

  // Run support
  const supportedRunNumbers = new Set();
  const anchorSorted = [...anchors].sort((a,b)=>a-b);
  let cr=1;
  for(let i=1;i<=anchorSorted.length;i++){
    if(i<anchorSorted.length && anchorSorted[i]===anchorSorted[i-1]+1) cr++;
    else {
      if(cr>=2){
        const start=anchorSorted[i-cr], end=anchorSorted[i-1];
        numbers.forEach(n=>{
          if(anchorSet.has(n)) return;
          if(n>=start-4 && n<=end+4){
            const dist = n<start ? start-n : n-end;
            if(dist>=1 && dist<=4) { score += 16-dist*2; supportedRunNumbers.add(n); }
          }
        });
      }
      cr=1;
    }
  }

  // 自身的连号 anchor support
  const numSorted = [...numbers].sort((a,b)=>a-b);
  cr=1;
  for(let i=1;i<=numSorted.length;i++){
    if(i<numSorted.length && numSorted[i]===numSorted[i-1]+1) cr++;
    else {
      if(cr>=2){
        const seg = numSorted.slice(i-cr,i);
        const sc = seg.filter(n=>supportedRunNumbers.has(n)||anchors.some(a=>Math.abs(n-a)<=3)).length;
        if(sc>=Math.min(2,seg.length)) { score+=seg.length*8; seg.forEach(n=>supportedRunNumbers.add(n)); }
      }
      cr=1;
    }
  }

  const explainableCount = explainable.size;
  let covBonus=0;
  if(explainableCount>=numbers.length) covBonus=numbers.length*14;
  else if(explainableCount>=numbers.length-1) covBonus=explainableCount*10;
  else if(explainableCount>=3) covBonus=explainableCount*6;
  else covBonus=explainableCount*2;

  let divBonus=0;
  if(transformedCount>=numbers.length-1) divBonus=transformedCount*16;
  else if(transformedCount>=3) divBonus=transformedCount*11;
  else divBonus=transformedCount*4;

  let farBonus=0;
  if(farOffsetCount>=3) farBonus=farOffsetCount*14;
  else if(farOffsetCount>=2) farBonus=farOffsetCount*10;
  else farBonus=farOffsetCount*3;

  const anchorCovCount = explainedAnchors.size;
  let acBonus=0;
  if(anchorCovCount>=4) acBonus=anchorCovCount*12;
  else if(anchorCovCount>=3) acBonus=anchorCovCount*7;
  else acBonus=anchorCovCount*2;

  const maxLoad = explainedAnchors.size>0?Math.max(...explainedAnchors.values()):0;
  const crowdPen = maxLoad>=3?(maxLoad-2)*12:0;
  const keepPen = keepHits>=2?(keepHits-1)*14:0;

  return {
    anchorTransformScore: score, explainCoverageBonus: covBonus,
    transformDiversityBonus: divBonus, farOffsetBonus: farBonus,
    farOffsetCount, anchorCoverageBonus: acBonus, anchorCoverageCount: anchorCovCount,
    anchorCrowdPenalty: crowdPen, anchorKeepPenalty: keepPen,
    anchorKeepHits: keepHits, supportedRunNumbers,
  };
}

function getSpreadV1(nums) {
  const s=[...nums].sort((a,b)=>a-b);
  if(s.length<=1) return {span:0,penalty:0};
  const span=s[4]-s[0];
  let p=0;
  const ivs=[0,0,0];
  s.forEach(n=>{const i=intervals.findIndex(iv=>n>=iv.min&&n<=iv.max);if(i>=0)ivs[i]++;});
  const cv=ivs.filter(c=>c>0).length;

  if(cv>=3){ if(span<=18)p+=2; if(span<=16)p+=6; if(span<=13)p+=10; if(span<=10)p+=16; }
  else if(cv===2){ if(span<=12)p+=3; if(span<=10)p+=7; if(span<=8)p+=12; if(span<=6)p+=16; }
  else { if(span<=7)p+=2; if(span<=5)p+=6; if(span<=3)p+=10; }

  for(let i=0;i<=s.length-3;i++) for(let j=i+2;j<s.length;j++) {
    if(s[j]-s[i]<=8) { let c=j-i+1;
      if(cv>=3){if(c>=4)p+=14+(c-4)*8;else if(c===3)p+=4;}
      else if(cv===2){if(c>=4)p+=10+(c-4)*6;}
      else{if(c>=4)p+=8+(c-4)*4;}
      break; }
  }

  const mi=Math.max(...ivs);
  if(cv>=3&&mi>=4)p+=10+(mi-4)*6;
  else if(cv===2&&mi>=4)p+=8+(mi-4)*4;

  return {span,penalty:p,cv};
}

function getRunV1(nums, supportedRunNumbers) {
  const s=[...nums].sort((a,b)=>a-b);
  let p=0,dc=0,cr=1;
  for(let i=1;i<=s.length;i++){
    if(i<s.length&&s[i]===s[i-1]+1)cr++;
    else{
      if(cr>=2){
        const seg=s.slice(i-cr,i);
        const sc=seg.filter(n=>supportedRunNumbers.has(n)).length;
        const ratio=seg.length>0?sc/seg.length:0;
        const disc=ratio>=0.8?0.45:ratio>=0.6?0.75:1;
        if(cr===2){dc++;p+=Math.round(8*disc);}
        else if(cr===3)p+=Math.round(36*disc);
        else p+=Math.round((70+(cr-4)*16)*disc);
      }
      cr=1;
    }
  }
  if(dc>=2)p+=(dc-1)*6;
  return p;
}

function referenceMatchV1(nums, refRows) {
  let total=0;
  refRows.forEach(ref=>{
    const rs=new Set(ref);
    const ol=nums.filter(n=>rs.has(n)).length;
    const nb=nums.filter(n=>rs.has(n-1)||rs.has(n+1)).length;
    const tl=new Set(ref.map(n=>n%10));
    const tm=nums.filter(n=>tl.has(n%10)).length;
    const st=new Set(ref.map(n=>n%10));
    const sh=nums.filter(n=>st.has(n%10)).length;
    // 简化版参考行匹配
    const overlap = Math.min(ol,3)*8;
    const neighbor = Math.min(nb,3)*8;
    const tail = Math.min(tm,3)*8;
    const tailN = Math.min(sh,3)*4;
    const ratioMatch = 0; // 简化
    const strongTail = Math.min(sh,3)*8;
    // 总和
    total += overlap + neighbor + tail + tailN + ratioMatch + strongTail;
  });
  return total;
}

function scoreComboV1(combo, anchors, refRows) {
  const nums=[...combo].sort((a,b)=>a-b);
  const at=evaluateAnchorV1(nums,anchors);
  const {penalty:sp} = getSpreadV1(nums);
  const rp=getRunV1(nums,at.supportedRunNumbers);
  const rm=referenceMatchV1(nums,refRows);

  // 锚点支撑折扣 → spread penalty 折扣
  const adjSp = at.supportedRunNumbers.size >= 2 ? Math.round(sp*0.6) : sp;

  const total = at.anchorTransformScore + at.explainCoverageBonus
    + at.transformDiversityBonus + at.farOffsetBonus
    + at.anchorCoverageBonus - at.anchorCrowdPenalty
    - at.anchorKeepPenalty - rp - adjSp
    + rm * 2; // 参考行 ×2（与sample_replay一致）

  return {score:total, numbers:nums};
}

// === 方案 B: 优化版（扩大锚点覆盖 + 软化惩罚 + 统计奖励） ===
const newOffsets = new Map([[1,8],[2,8],[3,8],[4,11],[5,12],[6,6],[7,11],[8,5],[9,4],[10,3]]);

function scoreSingleV2(number, anchors, targetRow) {
  const anchorSet = new Set(anchors);
  let s = 0;
  if (anchorSet.has(number)) s += 6;
  anchors.forEach(a => { const d = Math.abs(number - a); s += newOffsets.get(d) || 0; });
  const transformed = !anchorSet.has(number) && anchors.some(a => newOffsets.has(Math.abs(number - a)));
  if (transformed) s += 14;
  const far = anchors.some(a => { const d = Math.abs(number - a); return d >= 4 || d === 7; });
  if (far) s += 3;

  // + 频率分
  const freqMap = new Map();
  for(let r=targetRow+1;r<=targetRow+10;r++){if(!draws[r])continue;draws[r].forEach(n=>freqMap.set(n,(freqMap.get(n)||0)+1));}
  s += (freqMap.get(number)||0)*3;
  const cold = !freqMap.has(number);
  if(cold) s += 12;
  const fc = freqMap.get(number)||0;
  if(fc>=2) s += fc*3;

  return s;
}

function evaluateAnchorV2(numbers, anchors) {
  return evaluateAnchorV1(numbers, anchors); // 锚点逻辑相同，权重不同在外部
}

// 单号池从 V1 切换为 V2（带频率增强）
function buildPoolV2(row, anchors) {
  const tgt=targets[row];
  const singles=Array.from({length:35},(_,i)=>i+1)
    .map(n=>({number:n,score:scoreSingleV2(n,anchors,row)}))
    .sort((a,b)=>b.score-a.score||a.number-b.number);
  const pool=new Set(tgt);
  for(const s of singles){if(pool.size>=22)break;pool.add(s.number);}
  return [...pool].sort((a,b)=>a-b);
}

// 统计奖励：加到组合总分里
function statBonus(nums, targetRow) {
  let bonus = 0;
  const s=[...nums].sort((a,b)=>a-b);
  const sum=s.reduce((a,n)=>a+n,0);
  const span=s[4]-s[0];
  const odd=s.filter(n=>n%2===1).length;
  const ivs=[0,0,0]; s.forEach(n=>{const i=intervals.findIndex(iv=>n>=iv.min&&n<=iv.max); if(i>=0)ivs[i]++;});
  const cv=ivs.filter(c=>c>0).length;

  // 和值：期望 90, sigma 22
  const zsum=Math.abs(sum-90)/22;
  if(zsum<0.5) bonus+=30; else if(zsum<1.0) bonus+=18; else if(zsum<1.5) bonus+=8;

  // 跨度：期望 24, sigma 7
  const zspan=Math.abs(span-24)/7;
  if(zspan<0.5) bonus+=24; else if(zspan<1.0) bonus+=14; else if(zspan<1.5) bonus+=6;

  // 奇数
  if(odd===2||odd===3) bonus+=16; else if(odd===1||odd===4) bonus+=6;

  // 区间
  if(cv===3) bonus+=14; else if(cv===2) bonus+=4;

  // 连号
  let cr=1, maxRun=0;
  for(let i=1;i<s.length;i++){if(s[i]===s[i-1]+1)cr++; else{maxRun=Math.max(maxRun,cr);cr=1;}}
  maxRun=Math.max(maxRun,cr);
  if(maxRun===1) bonus+=10; // 2连是好的
  else if(maxRun===0) bonus+=4;

  return bonus;
}

function scoreComboV2(combo, anchors, refRows, targetRow) {
  const nums=[...combo].sort((a,b)=>a-b);
  const at=evaluateAnchorV2(nums,anchors);
  const {penalty:sp}=getSpreadV1(nums);
  const rp=getRunV1(nums,at.supportedRunNumbers);
  const rm=referenceMatchV1(nums,refRows);
  const adjSp = at.supportedRunNumbers.size>=2?Math.round(sp*0.6):sp;
  const sb = statBonus(nums, targetRow);

  const total = at.anchorTransformScore + at.explainCoverageBonus
    + at.transformDiversityBonus + at.farOffsetBonus
    + at.anchorCoverageBonus - at.anchorCrowdPenalty
    - at.anchorKeepPenalty - rp - adjSp
    + rm * 1.5  // 参考行权重从 2x → 1.5x
    + sb;        // 统计奖励

  return {score:total, numbers:nums};
}

// === 方案 C: 混合方案（统计约束过滤 + 最佳评分） ===
function hardFilter(combo, targetRow) {
  const s=[...combo].sort((a,b)=>a-b);
  const sum=s.reduce((a,n)=>a+n,0);
  const span=s[4]-s[0];
  const odd=s.filter(n=>n%2===1).length;
  const ivs=[0,0,0]; s.forEach(n=>{const i=intervals.findIndex(iv=>n>=iv.min&&n<=iv.max); if(i>=0)ivs[i]++;});
  const cv=ivs.filter(c=>c>0).length;

  // 宽松阈值（不会过滤掉真实中奖组合）
  if(sum<50||sum>135) return false;
  if(span<6||span>34) return false;
  if(odd===0||odd===5) return false;
  if(cv===1) return false; // 只在1个区间→过滤

  return true;
}

// ============================================================
// 测试
// ============================================================
console.log("=".repeat(70));
console.log("最终优化方案对比");
console.log("=".repeat(70));

const results = {A:[],B:[],C:[]};

for(const row of allRows) {
  const anchor=draws[row]||[];
  const tgt=targets[row];
  const refRows=Array.from({length:5},(_,i)=>row+1+i).filter(r=>draws[r]).map(r=>draws[r]);
  const targetKey=[...tgt].sort((a,b)=>a-b).join(",");
  const tgtSet=new Set(tgt);

  // 方案 A: 原始（V1 单号池 + V1 评分）
  const poolA=[];
  { const poolSet=new Set(tgt);
    const ss=Array.from({length:35},(_,i)=>i+1).map(n=>({number:n,score:scoreSingleV1(n,anchor)})).sort((a,b)=>b.score-a.score||a.number-b.number);
    for(const s of ss){if(poolSet.size>=22)break;poolSet.add(s.number);}
    poolA.push(...[...poolSet].sort((a,b)=>a-b));
  }
  const combosA=combos(poolA,5).map(c=>scoreComboV1(c,anchor,refRows));
  combosA.sort((a,b)=>b.score-a.score||a.numbers.join(",").localeCompare(b.numbers.join(",")));
  const rankA=combosA.findIndex(c=>c.numbers.join(",")===targetKey)+1;
  const topA=combosA.slice(0,5).map(c=>c.numbers.filter(n=>tgtSet.has(n)).length);
  results.A.push({row,rank:rankA,total:combosA.length,topOv:Math.max(...topA),ov:topA});

  // 方案 B: 优化（V2 单号池 + V2 评分）
  const poolB=buildPoolV2(row,anchor);
  const combosB=combos(poolB,5).map(c=>scoreComboV2(c,anchor,refRows,row));
  combosB.sort((a,b)=>b.score-a.score||a.numbers.join(",").localeCompare(b.numbers.join(",")));
  const rankB=combosB.findIndex(c=>c.numbers.join(",")===targetKey)+1;
  const topB=combosB.slice(0,5).map(c=>c.numbers.filter(n=>tgtSet.has(n)).length);
  results.B.push({row,rank:rankB,total:combosB.length,topOv:Math.max(...topB),ov:topB});

  // 方案 C: 混合（统计过滤 + 优化评分）
  const poolC=buildPoolV2(row,anchor);
  let combosC=combos(poolC,5);
  const preFilter=combosC.length;
  combosC=combosC.filter(c=>hardFilter(c,row));
  const scoredC=combosC.map(c=>scoreComboV2(c,anchor,refRows,row));
  scoredC.sort((a,b)=>b.score-a.score||a.numbers.join(",").localeCompare(b.numbers.join(",")));
  const rankC=scoredC.findIndex(c=>c.numbers.join(",")===targetKey)+1;
  const topC=scoredC.slice(0,5).map(c=>c.numbers.filter(n=>tgtSet.has(n)).length);
  results.C.push({row,rank:rankC>0?rankC:-1,total:scoredC.length,topOv:Math.max(...topC),ov:topC,filtered:preFilter-combosC.length});

  console.log(`\n第${row}期 锚点[${anchor.join(",")}] → 目标[${targetKey}]`);
  console.log(`  A(原始): 排名 ${rankA}/${combosA.length} (前${(rankA/combosA.length*100).toFixed(1)}%), 最高重合=${results.A.at(-1).topOv} [${topA}]`);
  console.log(`  B(优化): 排名 ${rankB}/${combosB.length} (前${(rankB/combosB.length*100).toFixed(1)}%), 最高重合=${results.B.at(-1).topOv} [${topB}]`);
  if(rankC>0) console.log(`  C(过滤): 排名 ${rankC}/${scoredC.length} (前${(rankC/scoredC.length*100).toFixed(1)}%), 最高重合=${results.C.at(-1).topOv} [${topC}], 过滤${preFilter-combosC.length}`);
  else console.log(`  C(过滤): ❌ 目标被过滤排除`);
}

// 汇总
console.log("\n" + "=".repeat(70));
console.log("汇总对比");
console.log("-".repeat(50));

const header="方案   | 16期排名  | 17期排名  | 18期排名  | 19期排名  | 20期排名  | 最高重合";
console.log(header);
console.log("-".repeat(header.length));

for(const [name,res] of [["A(原始)",results.A],["B(优化)",results.B],["C(过滤)",results.C]]) {
  const ranks=res.map(r=>`${r.rank}/${r.total}`);
  const ovs=res.map(r=>r.topOv);
  const avgOv=(ovs.reduce((a,b)=>a+b,0)/ovs.length).toFixed(1);
  console.log(`${name.padEnd(8)}| ${ranks[0].padEnd(10)}| ${ranks[1].padEnd(10)}| ${ranks[2].padEnd(10)}| ${ranks[3].padEnd(10)}| ${ranks[4].padEnd(10)}| 平均${avgOv}`);
}

// 计算总得分（排名越低越好，重合越高越好）
function calcScore(res) {
  const avgPct=res.reduce((s,r)=>s+r.rank/r.total,0)/res.length*100;
  const avgOv=res.reduce((s,r)=>s+r.topOv,0)/res.length;
  return {avgPct, avgOv};
}

console.log("\n得分分析:");
for(const [name,res] of [["A(原始)",results.A],["B(优化)",results.B]]) {
  const {avgPct,avgOv}=calcScore(res);
  console.log(`  ${name}: 平均排名前${avgPct.toFixed(1)}%, 平均重合${avgOv.toFixed(1)}个`);
}
