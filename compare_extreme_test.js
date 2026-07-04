const fs = require('fs');
const allDraws = JSON.parse(fs.readFileSync('all_draws.json', 'utf8'));
const N = allDraws.length;

const sampleIntervals = [[1,12],[13,24],[25,35]];
const getIvIdx = (n) => n<=12?0:n<=24?1:2;
const ivRatio = (nums) => { const iv=[0,0,0]; nums.forEach(n=>iv[getIvIdx(n)]++); return iv; };
const tails = (nums) => [...new Set(nums.map(n=>n%10))].sort((a,b)=>a-b);
const sum = (nums) => nums.reduce((a,b)=>a+b,0);
const odd = (nums) => nums.filter(n=>n%2===1).length;

function getArithTails(tails) {
  const s = new Set(); const sorted = [...tails].sort((a,b)=>a-b);
  for(let i=0;i<sorted.length;i++) for(let j=i+1;j<sorted.length;j++) {
    const d=sorted[j]-sorted[i]; if(d===2||d===3||d===4) { s.add(sorted[i]);s.add(sorted[j]);s.add((sorted[j]+d)%10);s.add((sorted[i]-d+10)%10); }
  } return [...s];
}

const OFFSET_SCORE = {0:20,1:15,2:13,3:12,4:10,5:8,6:6,7:5,8:4,9:3,10:2};

function detectExtremeFlags(srcRow, srcNums) {
  const flags = { sumCrash: false, parityFlip: false, narrowRange: false };
  const srcSpan = srcNums[srcNums.length - 1] - srcNums[0];
  if (srcSpan <= 12) flags.narrowRange = true;
  const neighborDraws = [];
  for (let r = srcRow - 1; r >= Math.max(1, srcRow - 3); r--) {
    const nbNums = allDraws[r-1].front;
    if (nbNums.length === 5) neighborDraws.push(nbNums);
    if (neighborDraws.length >= 2) break;
  }
  if (neighborDraws.length >= 2) {
    const srcSum = sum(srcNums);
    const avgPrevSum = (sum(neighborDraws[0]) + sum(neighborDraws[1])) / 2;
    if (Math.abs(srcSum - avgPrevSum) > 30) flags.sumCrash = true;
  }
  if (neighborDraws.length >= 1) {
    const srcOdd = srcNums.filter(n => n % 2 === 1).length;
    const nbOdd = neighborDraws[0].filter(n => n % 2 === 1).length;
    if (Math.abs(srcOdd - nbOdd) >= 4) flags.parityFlip = true;
  }
  return flags;
}

function predictTails(srcRow, srcNums) {
  const srcTails = tails(srcNums);
  const scores = new Map(); for(let t=0;t<=9;t++) scores.set(t,0);
  const w = {o1:6,a1:2,o10:4,a10:10,ob:2,gf:28};
  for(let r=Math.max(1,srcRow-12);r<srcRow;r++) {
    const dt = tails(allDraws[r-1].front), nt = tails(allDraws[r].front);
    dt.forEach(st => { if(srcTails.includes(st)) nt.forEach(tt => scores.set(tt, scores.get(tt)+1)); });
  }
  const gf = new Map(); for(let t=0;t<=9;t++) gf.set(t,0);
  for(let r=Math.max(1,srcRow-50);r<srcRow;r++) tails(allDraws[r-1].front).forEach(t=>gf.set(t,gf.get(t)+1));
  const mx = Math.max(1,...gf.values()); gf.forEach((c,t)=>scores.set(t,scores.get(t)+(c/mx)*w.gf));
  if(srcRow>1) { const r1=tails(allDraws[srcRow-2].front); r1.forEach(t=>scores.set(t,scores.get(t)+w.o1));
    getArithTails(r1).forEach(t=>{if(!r1.includes(t))scores.set(t,scores.get(t)+w.a1);}); }
  if(srcRow>10) { const r10=tails(allDraws[srcRow-11].front); r10.forEach(t=>scores.set(t,scores.get(t)+w.o10));
    getArithTails(r10).forEach(t=>{if(!r10.includes(t))scores.set(t,scores.get(t)+w.a10);}); }
  if(srcRow>10) { const r1=tails(allDraws[srcRow-2].front),r10=tails(allDraws[srcRow-11].front);
    r1.filter(t=>r10.includes(t)).forEach(t=>scores.set(t,scores.get(t)+w.ob)); }
  return [...scores.entries()].sort((a,b)=>b[1]-a[1]);
}

function buildPool(srcRow) {
  const srcNums = allDraws[srcRow-1].front;
  const srcTails = tails(srcNums);
  const predTails = predictTails(srcRow, srcNums);
  const top5Tails = new Set(predTails.slice(0,5).map(([t])=>t));
  const hot = new Map();
  for(let r=Math.max(1,srcRow-10);r<srcRow;r++) allDraws[r-1].front.forEach(n=>hot.set(n,(hot.get(n)||0)+1));
  const cands = [];
  for(let n=1;n<=35;n++) {
    let s=0;
    let minOff=Infinity; srcNums.forEach(a=>{minOff=Math.min(minOff,Math.abs(n-a));});
    s += OFFSET_SCORE[Math.min(minOff,10)]||0;
    const t=n%10;
    if(top5Tails.has(t)) s+=35;
    else if(predTails.some(([tt])=>Math.abs(t-tt)===1)) s+=15;
    else if(srcTails.includes(t)) s+=8;
    const h=hot.get(n)||0; s+=h>=4?6:h>=3?4:h>=2?2:h===0?-1:0;
    const nearC=srcNums.some(a=>{const o=srcNums.filter(x=>x!==a);return o.some(x=>Math.abs(x-a)===1)&&Math.abs(n-a)<=4;});
    if(nearC) s+=7;
    const iv=ivRatio(srcNums), nIv=getIvIdx(n); if(iv[nIv]<2) s+=4;
    cands.push({number:n,score:s});
  }
  cands.sort((a,b)=>b.score-a.score);
  const pool=[]; const ivC=[0,0,0]; const minIv=[2,2,2];
  for(const c of cands) { const i=getIvIdx(c.number);
    if(pool.length>=24) break;
    if(ivC[i]<minIv[i]||pool.length<24) { pool.push(c); ivC[i]++; }
  }
  return pool;
}

function buildCombos(pool, extremeFlags) {
  if(pool.length<5) return [];
  const combos=[], seen=new Set();
  const top20=pool.slice(0,20);
  function bt(start,chosen,ep) {
    if(combos.length>=100) return;
    if(chosen.length===5) {
      const nums=[...chosen].sort((a,b)=>a-b);
      const key=nums.join('-');
      if(!seen.has(key)) { seen.add(key);
        let baseScore = ep.reduce((s,e)=>s+e.score,0);
        if (extremeFlags) {
          const sp = nums[4] - nums[0];
          const s = sum(nums);
          const oddCount = nums.filter(n => n % 2 === 1).length;
          if (extremeFlags.narrowRange && sp <= 12) baseScore += 8;
          if (extremeFlags.sumCrash) {
            const avgSum = 90;
            const sumDeviation = Math.abs(s - avgSum);
            if (sumDeviation <= 15) baseScore += 6;
            else if (sumDeviation <= 25) baseScore += 3;
          }
          if (extremeFlags.parityFlip) {
            if (oddCount >= 2 && oddCount <= 3) baseScore += 6;
          }
        }
        combos.push({numbers:nums,score:baseScore,key,sum:sum(nums),span:nums[4]-nums[0],odd:odd(nums),iv:ivRatio(nums).join(':')}); }
      return;
    }
    for(let i=start;i<top20.length;i++) { chosen.push(top20[i].number);ep.push(top20[i]);bt(i+1,chosen,ep);chosen.pop();ep.pop(); }
  }
  bt(0,[],[]);
  combos.sort((a,b)=>b.score-a.score);
  return combos.slice(0,20);
}

function selectTop5(combos) {
  if(combos.length<=5) return combos;
  const sel=[combos[0]]; const used=new Set([combos[0].key]);
  for(let r=1;r<5;r++) {
    const covered=new Set(); sel.forEach(c=>c.numbers.forEach(n=>covered.add(n)));
    let bestI=-1,bestS=-Infinity;
    for(let i=1;i<combos.length;i++) { if(used.has(combos[i].key)) continue;
      const newC=combos[i].numbers.filter(n=>!covered.has(n)).length;
      const s=newC*50+combos[i].score; if(s>bestS){bestS=s;bestI=i;}
    }
    if(bestI>=0){sel.push(combos[bestI]);used.add(combos[bestI].key);}
  }
  return sel;
}

console.log('=== 对比测试：无极端期检测 vs 有极端期检测 ===');
const testStart = Math.max(11, N-100);
const testEnd = N-1;

// 测试1: 无极端期检测
let maxHitsTotal1=0, avgHitsTotal1=0, covTotal1=0, cnt1=0;
let h3_1=0,h2_1=0,h1_1=0;

for(let srcRow=testStart;srcRow<=testEnd;srcRow++) {
  const nextRow=srcRow+1; if(nextRow>N) continue;
  try {
    const pool=buildPool(srcRow);
    const combos=buildCombos(pool, null); // 无极端期检测
    const top5=selectTop5(combos);
    if(top5.length<5) continue;
    const actual=new Set(allDraws[nextRow-1].front);
    const hits=top5.map(c=>c.numbers.filter(n=>actual.has(n)));
    const maxH=Math.max(...hits.map(h=>h.length));
    const avgH=hits.reduce((s,h)=>s+h.length,0)/5;
    const allPred=new Set(); top5.forEach(c=>c.numbers.forEach(n=>allPred.add(n)));
    const cov=[...actual].filter(n=>allPred.has(n)).length/5;
    maxHitsTotal1+=maxH; avgHitsTotal1+=avgH; covTotal1+=cov; cnt1++;
    if(maxH>=3)h3_1++; if(maxH>=2)h2_1++; if(maxH>=1)h1_1++;
  } catch(e) { }
}

// 测试2: 有极端期检测
let maxHitsTotal2=0, avgHitsTotal2=0, covTotal2=0, cnt2=0;
let h3_2=0,h2_2=0,h1_2=0;

for(let srcRow=testStart;srcRow<=testEnd;srcRow++) {
  const nextRow=srcRow+1; if(nextRow>N) continue;
  try {
    const pool=buildPool(srcRow);
    const srcNums = allDraws[srcRow-1].front;
    const extremeFlags = detectExtremeFlags(srcRow, srcNums);
    const combos=buildCombos(pool, extremeFlags); // 有极端期检测
    const top5=selectTop5(combos);
    if(top5.length<5) continue;
    const actual=new Set(allDraws[nextRow-1].front);
    const hits=top5.map(c=>c.numbers.filter(n=>actual.has(n)));
    const maxH=Math.max(...hits.map(h=>h.length));
    const avgH=hits.reduce((s,h)=>s+h.length,0)/5;
    const allPred=new Set(); top5.forEach(c=>c.numbers.forEach(n=>allPred.add(n)));
    const cov=[...actual].filter(n=>allPred.has(n)).length/5;
    maxHitsTotal2+=maxH; avgHitsTotal2+=avgH; covTotal2+=cov; cnt2++;
    if(maxH>=3)h3_2++; if(maxH>=2)h2_2++; if(maxH>=1)h1_2++;
  } catch(e) { }
}

console.log('\n=== 指标对比 ===');
console.log('指标                | 无极端期检测 | 有极端期检测 | 提升');
console.log('--------------------|-------------|-------------|--------');
console.log('最大命中平均        | '+(maxHitsTotal1/cnt1).toFixed(2)+'       | '+(maxHitsTotal2/cnt2).toFixed(2)+'       | +'+((maxHitsTotal2/cnt2-maxHitsTotal1/cnt1)/(maxHitsTotal1/cnt1)*100).toFixed(1)+'%');
console.log('≥2球命中率          | '+(h2_1/cnt1*100).toFixed(1)+'%       | '+(h2_2/cnt2*100).toFixed(1)+'%       | +'+((h2_2/cnt2-h2_1/cnt1)/(h2_1/cnt1)*100).toFixed(1)+'%');
console.log('≥1球命中率          | '+(h1_1/cnt1*100).toFixed(1)+'%       | '+(h1_2/cnt2*100).toFixed(1)+'%       | +'+((h1_2/cnt2-h1_1/cnt1)/(h1_1/cnt1)*100).toFixed(1)+'%');
console.log('覆盖率              | '+(covTotal1/cnt1*100).toFixed(1)+'%       | '+(covTotal2/cnt2*100).toFixed(1)+'%       | +'+((covTotal2/cnt2-covTotal1/cnt1)/(covTotal1/cnt1)*100).toFixed(1)+'%');
