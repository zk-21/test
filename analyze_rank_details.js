const fs = require('fs');
const allDraws = JSON.parse(fs.readFileSync('all_draws.json', 'utf8'));
const N = allDraws.length;
console.log(`总期数: ${N}, 范围: ${allDraws[0].issue} - ${allDraws[N-1].issue}`);

// 核心工具函数
const getIvIdx = (n) => n<=12?0:n<=24?1:2;
const tails = (nums) => [...new Set(nums.map(n=>n%10))].sort((a,b)=>a-b);

// 分析未覆盖号码的排名情况
function analyzeUncoveredRanks() {
  const startRow = 20;
  const uncoveredRanks = [];
  const uncoveredScores = [];
  const coveredRanks = [];
  
  for (let srcRow = startRow; srcRow <= N; srcRow++) {
    const srcNums = allDraws[srcRow-1].front;
    const actualNext = allDraws[srcRow] ? allDraws[srcRow].front : null;
    if (!actualNext || srcNums.length !== 5 || actualNext.length !== 5) continue;
    
    const hot = new Map();
    for(let r=Math.max(1,srcRow-10);r<srcRow;r++) allDraws[r-1].front.forEach(n=>hot.set(n,(hot.get(n)||0)+1));
    
    // 计算所有候选号码的分数
    const candidates = [];
    for(let n=1;n<=35;n++) {
      const V4_OFFSET_SCORE = {0:20,1:15,2:13,3:12,4:10,5:8,6:6,7:5,8:4,9:3,10:2};
      let s=0;
      
      // 1. 偏移分数
      let minOff=Infinity; srcNums.forEach(a=>{minOff=Math.min(minOff,Math.abs(n-a));});
      s += V4_OFFSET_SCORE[Math.min(minOff,10)]||0;
      
      // 2. 热号分数
      const h=hot.get(n)||0;
      s += h>=4 ? 20 : h>=3 ? 15 : h>=2 ? 10 : h===1 ? 5 : 0;
      
      // 3. 区间补充分数
      const iv=getIvIdx(n); 
      const ivCount = srcNums.filter(num => getIvIdx(num) === iv).length;
      if(ivCount<2) s+=8;
      
      candidates.push({number: n, score: s, hot: h, iv: iv});
    }
    
    // 按分数排序
    candidates.sort((a,b)=>b.score-a.score);
    
    // 找出未覆盖号码
    const uncoveredNumbers = actualNext.filter(n => !candidates.slice(0, 24).map(c => c.number).includes(n));
    
    // 记录未覆盖号码的排名
    uncoveredNumbers.forEach(n => {
      const rank = candidates.findIndex(c => c.number === n) + 1;
      const score = candidates.find(c => c.number === n).score;
      uncoveredRanks.push(rank);
      uncoveredScores.push(score);
    });
    
    // 记录覆盖号码的排名
    const coveredNumbers = actualNext.filter(n => candidates.slice(0, 24).map(c => c.number).includes(n));
    coveredNumbers.forEach(n => {
      const rank = candidates.findIndex(c => c.number === n) + 1;
      coveredRanks.push(rank);
    });
  }
  
  // 统计排名分布
  const rankDistribution = {};
  uncoveredRanks.forEach(rank => {
    const bucket = Math.ceil(rank / 5) * 5;
    rankDistribution[bucket] = (rankDistribution[bucket] || 0) + 1;
  });
  
  console.log('\n【未覆盖号码排名分析】');
  console.log('=' .repeat(60));
  console.log(`总未覆盖号码数: ${uncoveredRanks.length}`);
  console.log(`平均排名: ${(uncoveredRanks.reduce((a,b)=>a+b,0)/uncoveredRanks.length).toFixed(2)}`);
  console.log(`排名中位数: ${uncoveredRanks.sort((a,b)=>a-b)[Math.floor(uncoveredRanks.length/2)]}`);
  
  console.log('\n排名分布:');
  Object.entries(rankDistribution).sort((a,b)=>a[0]-b[0]).forEach(([bucket, count]) => {
    console.log(`  排名${bucket-4}-${bucket}: ${count}次 (${(count/uncoveredRanks.length*100).toFixed(2)}%)`);
  });
  
  console.log('\n【覆盖号码排名分析】');
  console.log('=' .repeat(60));
  console.log(`总覆盖号码数: ${coveredRanks.length}`);
  console.log(`平均排名: ${(coveredRanks.reduce((a,b)=>a+b,0)/coveredRanks.length).toFixed(2)}`);
  
  // 分析分数分布
  const scoreDistribution = {};
  uncoveredScores.forEach(score => {
    const bucket = Math.floor(score / 5) * 5;
    scoreDistribution[bucket] = (scoreDistribution[bucket] || 0) + 1;
  });
  
  console.log('\n【未覆盖号码分数分布】');
  console.log('=' .repeat(60));
  Object.entries(scoreDistribution).sort((a,b)=>b[0]-a[0]).forEach(([bucket, count]) => {
    console.log(`  分数${bucket}-${parseInt(bucket)+4}: ${count}次 (${(count/uncoveredScores.length*100).toFixed(2)}%)`);
  });
  
  // 找出排名靠前但未覆盖的号码
  const highRankUncovered = uncoveredRanks.filter(rank => rank <= 30);
  console.log(`\n排名前30但未覆盖的号码: ${highRankUncovered.length}次 (${(highRankUncovered.length/uncoveredRanks.length*100).toFixed(2)}%)`);
  
  return { uncoveredRanks, uncoveredScores, coveredRanks };
}

// 分析具体案例
function analyzeSpecificCases() {
  const startRow = 20;
  const cases = [];
  
  for (let srcRow = startRow; srcRow <= Math.min(startRow + 10, N); srcRow++) {
    const srcNums = allDraws[srcRow-1].front;
    const actualNext = allDraws[srcRow] ? allDraws[srcRow].front : null;
    if (!actualNext || srcNums.length !== 5 || actualNext.length !== 5) continue;
    
    const hot = new Map();
    for(let r=Math.max(1,srcRow-10);r<srcRow;r++) allDraws[r-1].front.forEach(n=>hot.set(n,(hot.get(n)||0)+1));
    
    // 计算所有候选号码的分数
    const candidates = [];
    for(let n=1;n<=35;n++) {
      const V4_OFFSET_SCORE = {0:20,1:15,2:13,3:12,4:10,5:8,6:6,7:5,8:4,9:3,10:2};
      let s=0;
      
      let minOff=Infinity; srcNums.forEach(a=>{minOff=Math.min(minOff,Math.abs(n-a));});
      s += V4_OFFSET_SCORE[Math.min(minOff,10)]||0;
      
      const h=hot.get(n)||0;
      s += h>=4 ? 20 : h>=3 ? 15 : h>=2 ? 10 : h===1 ? 5 : 0;
      
      const iv=getIvIdx(n); 
      const ivCount = srcNums.filter(num => getIvIdx(num) === iv).length;
      if(ivCount<2) s+=8;
      
      candidates.push({number: n, score: s, hot: h, iv: iv});
    }
    
    candidates.sort((a,b)=>b.score-a.score);
    
    // 找出未覆盖号码
    const uncoveredNumbers = actualNext.filter(n => !candidates.slice(0, 24).map(c => c.number).includes(n));
    
    if (uncoveredNumbers.length > 0) {
      console.log(`\n【第${allDraws[srcRow-1].issue}期 -> 第${allDraws[srcRow].issue}期】`);
      console.log(`源号码: ${srcNums.join(', ')}`);
      console.log(`开奖号码: ${actualNext.join(', ')}`);
      console.log(`未覆盖号码: ${uncoveredNumbers.join(', ')}`);
      
      uncoveredNumbers.forEach(n => {
        const rank = candidates.findIndex(c => c.number === n) + 1;
        const score = candidates.find(c => c.number === n).score;
        const hotCount = hot.get(n) || 0;
        const iv = getIvIdx(n);
        const ivCount = srcNums.filter(num => getIvIdx(num) === iv).length;
        
        console.log(`  号码${n}: 排名${rank}, 分数${score}, 热号${hotCount}次, 区间${iv}(${ivCount}个)`);
      });
      
      // 显示排名前24的号码
      console.log('前24名号码:');
      candidates.slice(0, 24).forEach((c, i) => {
        const isInDraw = actualNext.includes(c.number);
        console.log(`  ${i+1}. 号码${c.number}: 分数${c.score}, 热号${c.hot}次 ${isInDraw ? '✓' : ''}`);
      });
    }
  }
}

console.log('开始分析未覆盖号码排名情况...');
const { uncoveredRanks, uncoveredScores, coveredRanks } = analyzeUncoveredRanks();

console.log('\n\n开始分析具体案例...');
analyzeSpecificCases();