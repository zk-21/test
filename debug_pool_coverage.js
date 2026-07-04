const fs = require('fs');
const allDraws = JSON.parse(fs.readFileSync('all_draws.json', 'utf8'));
const N = allDraws.length;
console.log(`总期数: ${N}, 范围: ${allDraws[0].issue} - ${allDraws[N-1].issue}`);

// === 核心工具函数 ===
const sampleIntervals = [[1,12],[13,24],[25,35]];
const getIvIdx = (n) => n<=12?0:n<=24?1:2;
const ivRatio = (nums) => { const iv=[0,0,0]; nums.forEach(n=>iv[getIvIdx(n)]++); return iv; };
const tails = (nums) => [...new Set(nums.map(n=>n%10))].sort((a,b)=>a-b);
const sum = (nums) => nums.reduce((a,b)=>a+b,0);

const V4_OFFSET_SCORE = {0:20,1:15,2:13,3:12,4:10,5:8,6:6,7:5,8:4,9:3,10:2};

// === 预测尾号 ===
function predictTails(srcRow, srcNums) {
  const srcTails = tails(srcNums);
  const scores = new Map(); for(let t=0;t<=9;t++) scores.set(t,0);
  
  // 1. 转移概率（12期窗口）
  for(let r=Math.max(1,srcRow-12);r<srcRow;r++) {
    const dt = tails(allDraws[r-1].front), nt = tails(allDraws[r].front);
    dt.forEach(st => { if(srcTails.includes(st)) nt.forEach(tt => scores.set(tt, scores.get(tt)+1)); });
  }
  
  // 2. 全局高频尾号（权重28）
  const gf = new Map(); for(let t=0;t<=9;t++) gf.set(t,0);
  for(let r=Math.max(1,srcRow-50);r<srcRow;r++) tails(allDraws[r-1].front).forEach(t=>gf.set(t,gf.get(t)+1));
  const mx = Math.max(1,...gf.values()); gf.forEach((c,t)=>scores.set(t,scores.get(t)+(c/mx)*28));
  
  // 3. 参考行1（上一期）重叠尾号（权重6）
  if(srcRow>1) { const r1=tails(allDraws[srcRow-2].front); r1.forEach(t=>scores.set(t,scores.get(t)+6)); }
  
  // 4. 参考行10（上10期）重叠尾号（权重10）
  if(srcRow>10) { const r10=tails(allDraws[srcRow-11].front); r10.forEach(t=>scores.set(t,scores.get(t)+10)); }
  
  return [...scores.entries()].sort((a,b)=>b[1]-a[1]);
}

// === 构建候选池 (24球) ===
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
    s += V4_OFFSET_SCORE[Math.min(minOff,10)]||0;
    const t=n%10;
    if(top5Tails.has(t)) s+=35;
    else if(predTails.some(([tt])=>Math.abs(t-tt)===1)) s+=15;
    else if(srcTails.includes(t)) s+=8;
    const h=hot.get(n)||0; s+=h>=4?6:h>=3?4:h>=2?2:h===0?-1:0;
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

// === 调试分析 ===
function debugCoverage() {
  const startRow = 20;
  const endRow = N;
  
  console.log('\n开始调试分析候选池覆盖率...');
  console.log('=' .repeat(80));
  
  // 统计信息
  let totalTests = 0;
  let cover5Count = 0;
  let cover4Count = 0;
  let cover3Count = 0;
  let cover2Count = 0;
  let cover1Count = 0;
  let cover0Count = 0;
  
  // 分析前10期的具体情况
  const sampleCases = [];
  
  for (let srcRow = startRow; srcRow <= endRow; srcRow++) {
    const srcNums = allDraws[srcRow-1].front;
    const actualNext = allDraws[srcRow] ? allDraws[srcRow].front : null;
    
    if (!actualNext || srcNums.length !== 5 || actualNext.length !== 5) continue;
    
    // 1. 构建候选池
    const pool = buildPool(srcRow);
    const poolNumbers = new Set(pool.map(c => c.number));
    
    // 2. 计算覆盖率
    const covered = actualNext.filter(n => poolNumbers.has(n));
    const notCovered = actualNext.filter(n => !poolNumbers.has(n));
    
    // 统计
    if (covered.length === 5) cover5Count++;
    else if (covered.length === 4) cover4Count++;
    else if (covered.length === 3) cover3Count++;
    else if (covered.length === 2) cover2Count++;
    else if (covered.length === 1) cover1Count++;
    else cover0Count++;
    
    // 收集样本案例（覆盖率低的情况）
    if (covered.length <= 2 && sampleCases.length < 10) {
      sampleCases.push({
        issue: allDraws[srcRow].issue,
        srcRow,
        srcNums,
        actualNext,
        pool: pool.map(c => c.number).sort((a,b)=>a-b),
        covered,
        notCovered,
        coverage: covered.length
      });
    }
    
    totalTests++;
  }
  
  // 输出统计结果
  console.log(`\n【候选池覆盖率统计】`);
  console.log(`测试期数: ${totalTests}`);
  console.log(`覆盖5个号码: ${cover5Count}期 (${(cover5Count/totalTests*100).toFixed(2)}%)`);
  console.log(`覆盖4个号码: ${cover4Count}期 (${(cover4Count/totalTests*100).toFixed(2)}%)`);
  console.log(`覆盖3个号码: ${cover3Count}期 (${(cover3Count/totalTests*100).toFixed(2)}%)`);
  console.log(`覆盖2个号码: ${cover2Count}期 (${(cover2Count/totalTests*100).toFixed(2)}%)`);
  console.log(`覆盖1个号码: ${cover1Count}期 (${(cover1Count/totalTests*100).toFixed(2)}%)`);
  console.log(`覆盖0个号码: ${cover0Count}期 (${(cover0Count/totalTests*100).toFixed(2)}%)`);
  
  // 输出样本案例
  console.log('\n' + '=' .repeat(80));
  console.log('【覆盖率低的样本案例分析】');
  console.log('=' .repeat(80));
  
  sampleCases.forEach((caseData, idx) => {
    console.log(`\n案例${idx+1}: 期号 ${caseData.issue}`);
    console.log(`  开奖号码: ${caseData.actualNext.join(', ')}`);
    console.log(`  候选池(24球): ${caseData.pool.join(', ')}`);
    console.log(`  覆盖的号码: ${caseData.covered.join(', ')}`);
    console.log(`  未覆盖的号码: ${caseData.notCovered.join(', ')}`);
    console.log(`  覆盖率: ${caseData.coverage}/5 = ${(caseData.coverage/5*100).toFixed(0)}%`);
    
    // 分析未覆盖号码的原因
    if (caseData.notCovered.length > 0) {
      console.log(`\n  未覆盖号码分析:`);
      caseData.notCovered.forEach(n => {
        const tail = n % 10;
        const ivIdx = getIvIdx(n);
        const ivName = ['一区(1-12)', '二区(13-24)', '三区(25-35)'][ivIdx];
        
        // 检查是否在候选池中
        const inPool = caseData.pool.includes(n);
        
        // 检查尾号是否在预测尾号中
        const predTails = predictTails(caseData.srcRow, caseData.srcNums);
        const top5Tails = new Set(predTails.slice(0,5).map(([t])=>t));
        const tailInTop5 = top5Tails.has(tail);
        
        // 检查热号情况
        const hot = new Map();
        for(let r=Math.max(1,caseData.srcRow-10);r<caseData.srcRow;r++) {
          allDraws[r-1].front.forEach(nn=>hot.set(nn,(hot.get(nn)||0)+1));
        }
        const hotCount = hot.get(n) || 0;
        
        console.log(`    号码${n}: 尾号${tail}, 区间${ivName}, 热号${hotCount}次, 预测尾号Top5: ${tailInTop5 ? '是' : '否'}`);
      });
    }
  });
  
  // 分析尾号预测的影响
  console.log('\n' + '=' .repeat(80));
  console.log('【尾号预测对覆盖率的影响分析】');
  console.log('=' .repeat(80));
  
  let tailMatchCount = 0;
  let tailMismatchCount = 0;
  
  for (let srcRow = startRow; srcRow <= endRow; srcRow++) {
    const srcNums = allDraws[srcRow-1].front;
    const actualNext = allDraws[srcRow] ? allDraws[srcRow].front : null;
    
    if (!actualNext || srcNums.length !== 5 || actualNext.length !== 5) continue;
    
    const predTails = predictTails(srcRow, srcNums);
    const top5Tails = new Set(predTails.slice(0,5).map(([t])=>t));
    const actualTails = tails(actualNext);
    
    // 检查开奖号码的尾号是否在预测尾号Top5中
    const matchedTails = actualTails.filter(t => top5Tails.has(t));
    
    if (matchedTails.length >= 3) tailMatchCount++;
    else tailMismatchCount++;
  }
  
  console.log(`开奖号码尾号与预测尾号Top5匹配情况:`);
  console.log(`  匹配≥3个尾号: ${tailMatchCount}期 (${(tailMatchCount/totalTests*100).toFixed(2)}%)`);
  console.log(`  匹配<3个尾号: ${tailMismatchCount}期 (${(tailMismatchCount/totalTests*100).toFixed(2)}%)`);
  
  // 分析区间分布
  console.log('\n' + '=' .repeat(80));
  console.log('【区间分布对覆盖率的影响分析】');
  console.log('=' .repeat(80));
  
  let ivMatchCount = 0;
  let ivMismatchCount = 0;
  
  for (let srcRow = startRow; srcRow <= endRow; srcRow++) {
    const srcNums = allDraws[srcRow-1].front;
    const actualNext = allDraws[srcRow] ? allDraws[srcRow].front : null;
    
    if (!actualNext || srcNums.length !== 5 || actualNext.length !== 5) continue;
    
    const pool = buildPool(srcRow);
    const poolNumbers = new Set(pool.map(c => c.number));
    
    // 检查开奖号码是否都在候选池的区间内
    const actualIv = ivRatio(actualNext);
    const poolIv = ivRatio([...poolNumbers]);
    
    // 检查每个区间的开奖号码是否都能被候选池覆盖
    let allCovered = true;
    for (let i = 0; i < 3; i++) {
      const actualInZone = actualNext.filter(n => getIvIdx(n) === i).length;
      const poolInZone = pool.filter(c => getIvIdx(c.number) === i).length;
      if (actualInZone > poolInZone) {
        allCovered = false;
        break;
      }
    }
    
    if (allCovered) ivMatchCount++;
    else ivMismatchCount++;
  }
  
  console.log(`区间分布匹配情况:`);
  console.log(`  区间分布可覆盖: ${ivMatchCount}期 (${(ivMatchCount/totalTests*100).toFixed(2)}%)`);
  console.log(`  区间分布不可覆盖: ${ivMismatchCount}期 (${(ivMismatchCount/totalTests*100).toFixed(2)}%)`);
  
  return {
    totalTests,
    cover5: cover5Count,
    cover4: cover4Count,
    cover3: cover3Count,
    cover2: cover2Count,
    cover1: cover1Count,
    cover0: cover0Count
  };
}

// 执行调试分析
console.log('开始调试分析候选池覆盖率...');
const results = debugCoverage();
console.log('\n调试分析完成！');
