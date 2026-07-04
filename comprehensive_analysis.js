const fs = require('fs');
const allDraws = JSON.parse(fs.readFileSync('all_draws.json', 'utf8'));
const N = allDraws.length;
console.log(`总期数: ${N}, 范围: ${allDraws[0].issue} - ${allDraws[N-1].issue}`);

// 核心工具函数
const getIvIdx = (n) => n<=12?0:n<=24?1:2;
const tails = (nums) => [...new Set(nums.map(n=>n%10))].sort((a,b)=>a-b);

// 分析未覆盖号码的详细特征
function analyzeUncoveredCharacteristics() {
  const startRow = 20;
  const characteristics = {
    totalUncovered: 0,
    byTail: {},
    byInterval: {},
    byHot: {},
    byOffset: {},
    byScore: {},
    byRank: {},
    patterns: []
  };
  
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
      
      let minOff=Infinity; srcNums.forEach(a=>{minOff=Math.min(minOff,Math.abs(n-a));});
      s += V4_OFFSET_SCORE[Math.min(minOff,10)]||0;
      
      const h=hot.get(n)||0;
      s += h>=4 ? 20 : h>=3 ? 15 : h>=2 ? 10 : h===1 ? 5 : 0;
      
      const iv=getIvIdx(n); 
      const ivCount = srcNums.filter(num => getIvIdx(num) === iv).length;
      if(ivCount<2) s+=8;
      
      candidates.push({number: n, score: s, hot: h, iv: iv, offset: minOff});
    }
    
    candidates.sort((a,b)=>b.score-a.score);
    
    // 找出未覆盖号码
    const uncoveredNumbers = actualNext.filter(n => !candidates.slice(0, 24).map(c => c.number).includes(n));
    
    uncoveredNumbers.forEach(n => {
      characteristics.totalUncovered++;
      
      const cand = candidates.find(c => c.number === n);
      const rank = candidates.indexOf(cand) + 1;
      const tail = n % 10;
      const iv = getIvIdx(n);
      const hotCount = hot.get(n) || 0;
      
      // 按尾号统计
      characteristics.byTail[tail] = (characteristics.byTail[tail] || 0) + 1;
      
      // 按区间统计
      characteristics.byInterval[iv] = (characteristics.byInterval[iv] || 0) + 1;
      
      // 按热号统计
      characteristics.byHot[hotCount] = (characteristics.byHot[hotCount] || 0) + 1;
      
      // 按偏移距离统计
      characteristics.byOffset[cand.offset] = (characteristics.byOffset[cand.offset] || 0) + 1;
      
      // 按分数统计
      const scoreBucket = Math.floor(cand.score / 5) * 5;
      characteristics.byScore[scoreBucket] = (characteristics.byScore[scoreBucket] || 0) + 1;
      
      // 按排名统计
      const rankBucket = Math.ceil(rank / 5) * 5;
      characteristics.byRank[rankBucket] = (characteristics.byRank[rankBucket] || 0) + 1;
      
      // 记录模式
      characteristics.patterns.push({
        number: n,
        tail: tail,
        interval: iv,
        hot: hotCount,
        score: cand.score,
        rank: rank,
        offset: cand.offset,
        srcNums: srcNums,
        actualNext: actualNext
      });
    });
  }
  
  return characteristics;
}

// 分析改进空间
function analyzeImprovementPotential() {
  const startRow = 20;
  const improvements = {
    potentialGains: 0,
    currentCoverage: 0,
    scenarios: []
  };
  
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
    
    // 当前覆盖情况
    const currentPool = candidates.slice(0, 24);
    const currentCovered = actualNext.filter(n => currentPool.map(c => c.number).includes(n)).length;
    improvements.currentCoverage += currentCovered;
    
    // 理想情况：如果我们可以完美选择
    const idealPool = actualNext.map(n => candidates.find(c => c.number === n));
    const idealCovered = actualNext.filter(n => idealPool.map(c => c.number).includes(n)).length;
    
    // 潜在增益
    const potentialGain = idealCovered - currentCovered;
    improvements.potentialGains += potentialGain;
    
    if (potentialGain > 0) {
      improvements.scenarios.push({
        srcRow: srcRow,
        srcNums: srcNums,
        actualNext: actualNext,
        currentCovered: currentCovered,
        idealCovered: idealCovered,
        potentialGain: potentialGain,
        uncoveredNumbers: actualNext.filter(n => !currentPool.map(c => c.number).includes(n))
      });
    }
  }
  
  return improvements;
}

// 执行分析
console.log('开始综合分析...');

console.log('\n【未覆盖号码特征分析】');
console.log('=' .repeat(60));
const characteristics = analyzeUncoveredCharacteristics();

console.log(`总未覆盖号码数: ${characteristics.totalUncovered}`);

console.log('\n按尾号分布:');
Object.entries(characteristics.byTail).sort((a,b) => b[1] - a[1]).forEach(([tail, count]) => {
  console.log(`  尾号${tail}: ${count}次 (${(count/characteristics.totalUncovered*100).toFixed(2)}%)`);
});

console.log('\n按区间分布:');
Object.entries(characteristics.byInterval).forEach(([iv, count]) => {
  const intervalNames = ['区间1 (1-12)', '区间2 (13-24)', '区间3 (25-35)'];
  console.log(`  ${intervalNames[iv]}: ${count}次 (${(count/characteristics.totalUncovered*100).toFixed(2)}%)`);
});

console.log('\n按热号次数分布:');
Object.entries(characteristics.byHot).sort((a,b) => a[0] - b[0]).forEach(([hot, count]) => {
  console.log(`  热号${hot}次: ${count}次 (${(count/characteristics.totalUncovered*100).toFixed(2)}%)`);
});

console.log('\n按偏移距离分布:');
Object.entries(characteristics.byOffset).sort((a,b) => a[0] - b[0]).forEach(([offset, count]) => {
  console.log(`  偏移${offset}: ${count}次 (${(count/characteristics.totalUncovered*100).toFixed(2)}%)`);
});

console.log('\n按分数分布:');
Object.entries(characteristics.byScore).sort((a,b) => b[0] - a[0]).forEach(([score, count]) => {
  console.log(`  分数${score}-${parseInt(score)+4}: ${count}次 (${(count/characteristics.totalUncovered*100).toFixed(2)}%)`);
});

console.log('\n按排名分布:');
Object.entries(characteristics.byRank).sort((a,b) => a[0] - b[0]).forEach(([rank, count]) => {
  console.log(`  排名${rank-4}-${rank}: ${count}次 (${(count/characteristics.totalUncovered*100).toFixed(2)}%)`);
});

console.log('\n【改进潜力分析】');
console.log('=' .repeat(60));
const improvements = analyzeImprovementPotential();

console.log(`当前总覆盖号码数: ${improvements.currentCoverage}`);
console.log(`潜在总增益: ${improvements.potentialGains}个号码`);
console.log(`平均每期潜在增益: ${(improvements.potentialGains / improvements.scenarios.length).toFixed(2)}个`);
console.log(`有改进空间的期数: ${improvements.scenarios.length}期`);

// 分析改进场景
if (improvements.scenarios.length > 0) {
  console.log('\n【改进场景分析】');
  console.log('=' .repeat(60));
  
  // 统计未覆盖号码的特征
  const uncoveredStats = {
    byTail: {},
    byHot: {},
    byInterval: {}
  };
  
  improvements.scenarios.forEach(scenario => {
    scenario.uncoveredNumbers.forEach(n => {
      const tail = n % 10;
      const iv = getIvIdx(n);
      const hotCount = allDraws.slice(Math.max(0, scenario.srcRow - 10), scenario.srcRow)
        .some(draw => draw.front.includes(n)) ? 1 : 0;
      
      uncoveredStats.byTail[tail] = (uncoveredStats.byTail[tail] || 0) + 1;
      uncoveredStats.byHot[hotCount] = (uncoveredStats.byHot[hotCount] || 0) + 1;
      uncoveredStats.byInterval[iv] = (uncoveredStats.byInterval[iv] || 0) + 1;
    });
  });
  
  console.log('\n未覆盖号码特征:');
  console.log('按尾号:');
  Object.entries(uncoveredStats.byTail).sort((a,b) => b[1] - a[1]).forEach(([tail, count]) => {
    console.log(`  尾号${tail}: ${count}次`);
  });
  
  console.log('\n按热号:');
  Object.entries(uncoveredStats.byHot).sort((a,b) => a[0] - b[0]).forEach(([hot, count]) => {
    console.log(`  热号${hot}次: ${count}次`);
  });
  
  console.log('\n按区间:');
  Object.entries(uncoveredStats.byInterval).forEach(([iv, count]) => {
    const intervalNames = ['区间1 (1-12)', '区间2 (13-24)', '区间3 (25-35)'];
    console.log(`  ${intervalNames[iv]}: ${count}次`);
  });
}

// 保存分析结果
const analysisReport = {
  analysisDate: new Date().toISOString(),
  totalPeriods: N,
  characteristics: characteristics,
  improvements: improvements,
  keyFindings: [
    `总未覆盖号码数: ${characteristics.totalUncovered}`,
    `平均每期未覆盖: ${(characteristics.totalUncovered / improvements.scenarios.length).toFixed(2)}个`,
    `潜在总增益: ${improvements.potentialGains}个号码`,
    `有改进空间的期数: ${improvements.scenarios.length}期`
  ]
};

fs.writeFileSync('analysis_output/comprehensive_analysis.json', JSON.stringify(analysisReport, null, 2));
console.log('\n综合分析结果已保存到: analysis_output/comprehensive_analysis.json');