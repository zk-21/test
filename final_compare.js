/**
 * 最终对比：组合转移 vs 单尾号转移
 */

const fs = require('fs');
const path = require('path');

// 加载开奖数据
const rawJs = fs.readFileSync(path.join(__dirname, 'all_draws.js'), 'utf8');
const match = rawJs.match(/window\.ALL_DRAWS_DATA\s*=\s*(\[[\s\S]*?\]);/);
if (!match) { console.error('无法解析 all_draws.js'); process.exit(1); }
const ALL_DRAWS_DATA = eval(match[1]);

// 转换为 allBalls 格式
const draws = [...ALL_DRAWS_DATA].reverse();
const __allBalls = [];
draws.forEach((draw, idx) => {
  const rowNum = idx + 1;
  draw.front.forEach((num) => {
    __allBalls.push({ row: rowNum, zone: "front", number: num });
  });
});

console.log(`总数据: ${draws.length}期`);

// 尾号组合转移分析
function analyzeTailComboTransitions(sourceRow, lookback) {
  const comboTransFreq = new Map();
  const comboTargetFreq = new Map();
  
  const start = Math.max(1, sourceRow - lookback);
  
  for (let r = start; r < sourceRow - 1; r++) {
    const srcNums = [...new Set(__allBalls.filter(b => b.row === r && b.zone === "front").map(b => b.number))];
    const tgtNums = [...new Set(__allBalls.filter(b => b.row === r + 1 && b.zone === "front").map(b => b.number))];
    
    if (srcNums.length !== 5 || tgtNums.length !== 5) continue;
    
    const srcTails = [...new Set(srcNums.map(n => n % 10))].sort().join(',');
    const tgtTails = [...new Set(tgtNums.map(n => n % 10))].sort().join(',');
    
    comboTransFreq.set(`${srcTails}→${tgtTails}`, (comboTransFreq.get(`${srcTails}→${tgtTails}`) || 0) + 1);
    comboTargetFreq.set(tgtTails, (comboTargetFreq.get(tgtTails) || 0) + 1);
  }
  
  return { comboTransFreq, comboTargetFreq };
}

// 预测函数
function predictTailsFromComboTransfer(sourceTails, comboTransData) {
  const { comboTransFreq, comboTargetFreq } = comboTransData;
  const srcKey = [...sourceTails].sort().join(',');
  
  const tailScores = new Map();
  for (let t = 0; t <= 9; t++) tailScores.set(t, 0);
  
  // 1. 直接匹配
  for (const [key, count] of comboTransFreq) {
    const [src, tgt] = key.split('→');
    if (src === srcKey) {
      const targetTails = tgt.split(',').map(Number);
      targetTails.forEach(t => {
        tailScores.set(t, tailScores.get(t) + count * 10);
      });
    }
  }
  
  // 2. 部分匹配
  const srcSet = new Set(sourceTails);
  for (const [key, count] of comboTransFreq) {
    const [src, tgt] = key.split('→');
    const srcArr = src.split(',').map(Number);
    const matchCount = srcArr.filter(t => srcSet.has(t)).length;
    
    if (matchCount >= 3 && matchCount < srcArr.length) {
      const targetTails = tgt.split(',').map(Number);
      const weight = count * (matchCount / srcArr.length) * 5;
      targetTails.forEach(t => {
        tailScores.set(t, tailScores.get(t) + weight);
      });
    }
  }
  
  // 3. 全局高频目标尾号组合
  const maxFreq = Math.max(1, ...comboTargetFreq.values());
  for (const [combo, count] of comboTargetFreq) {
    const normalizedFreq = count / maxFreq;
    combo.split(',').map(Number).forEach(t => {
      tailScores.set(t, tailScores.get(t) + normalizedFreq * 2);
    });
  }
  
  return [...tailScores.entries()].sort((a, b) => b[1] - a[1]);
}

// 单尾号转移预测
function predictTailsFromSingleTransfer(sourceTails, singleTransFreq) {
  const tailScores = new Map();
  for (let t = 0; t <= 9; t++) tailScores.set(t, 0);
  
  sourceTails.forEach(st => {
    for (let tt = 0; tt <= 9; tt++) {
      const key = `${st}→${tt}`;
      tailScores.set(tt, tailScores.get(tt) + (singleTransFreq.get(key) || 0));
    }
  });
  
  return [...tailScores.entries()].sort((a, b) => b[1] - a[1]);
}

// 测试
function runTest() {
  const lookback = 100;
  const testStartRow = lookback + 10;
  const testEndRow = draws.length - 1;
  
  // 预先计算数据
  const comboTransData = analyzeTailComboTransitions(1, draws.length - 1);
  
  // 单尾号转移统计
  const singleTransFreq = new Map();
  for (let r = 1; r < draws.length - 1; r++) {
    const srcNums = [...new Set(__allBalls.filter(b => b.row === r && b.zone === "front").map(b => b.number))];
    const tgtNums = [...new Set(__allBalls.filter(b => b.row === r + 1 && b.zone === "front").map(b => b.number))];
    
    if (srcNums.length !== 5 || tgtNums.length !== 5) continue;
    
    srcNums.map(n => n % 10).forEach(st => {
      tgtNums.map(n => n % 10).forEach(tt => {
        singleTransFreq.set(`${st}→${tt}`, (singleTransFreq.get(`${st}→${tt}`) || 0) + 1);
      });
    });
  }
  
  let sameCount = 0;
  let diffCount = 0;
  let comboBetter = 0;
  let singleBetter = 0;
  
  const examples = [];
  
  for (let r = testStartRow; r <= testEndRow; r++) {
    const srcNums = [...new Set(__allBalls.filter(b => b.row === r && b.zone === "front").map(b => b.number))];
    const tgtNums = [...new Set(__allBalls.filter(b => b.row === r + 1 && b.zone === "front").map(b => b.number))];
    
    if (srcNums.length !== 5 || tgtNums.length !== 5) continue;
    
    const srcTails = [...new Set(srcNums.map(n => n % 10))];
    const tgtTails = new Set(tgtNums.map(n => n % 10));
    
    // 组合转移预测
    const comboScores = predictTailsFromComboTransfer(srcTails, comboTransData);
    const comboTop5 = comboScores.slice(0, 5).map(([t]) => t);
    
    // 单尾号转移预测
    const singleScores = predictTailsFromSingleTransfer(srcTails, singleTransFreq);
    const singleTop5 = singleScores.slice(0, 5).map(([t]) => t);
    
    // 比较
    const comboSet = new Set(comboTop5);
    const singleSet = new Set(singleTop5);
    
    const isSame = comboTop5.every(t => singleSet.has(t)) && singleTop5.every(t => comboSet.has(t));
    
    if (isSame) {
      sameCount++;
    } else {
      diffCount++;
      
      // 计算命中
      let comboHits = 0, singleHits = 0;
      for (const t of tgtTails) {
        if (comboSet.has(t)) comboHits++;
        if (singleSet.has(t)) singleHits++;
      }
      
      if (comboHits > singleHits) comboBetter++;
      if (singleHits > comboHits) singleBetter++;
      
      // 记录差异示例
      if (examples.length < 5) {
        examples.push({
          row: r,
          srcTails,
          tgtTails: [...tgtTails],
          comboTop5,
          singleTop5,
          comboHits,
          singleHits
        });
      }
    }
  }
  
  console.log("\n" + "=".repeat(80));
  console.log("详细对比结果");
  console.log("=".repeat(80));
  
  console.log(`\n总测试期数: ${sameCount + diffCount}`);
  console.log(`相同预测: ${sameCount} (${(sameCount / (sameCount + diffCount) * 100).toFixed(1)}%)`);
  console.log(`不同预测: ${diffCount} (${(diffCount / (sameCount + diffCount) * 100).toFixed(1)}%)`);
  
  if (diffCount > 0) {
    console.log(`\n组合转移更好: ${comboBetter}次`);
    console.log(`单尾号转移更好: ${singleBetter}次`);
  }
  
  if (examples.length > 0) {
    console.log("\n差异示例:");
    examples.forEach((ex, i) => {
      console.log(`\n  示例${i + 1} (行${ex.row}):`);
      console.log(`    源尾号: ${ex.srcTails.join(',')}`);
      console.log(`    目标尾号: ${ex.tgtTails.join(',')}`);
      console.log(`    组合转移Top5: ${ex.comboTop5.join(',')}`);
      console.log(`    单尾号转移Top5: ${ex.singleTop5.join(',')}`);
      console.log(`    组合命中: ${ex.comboHits}, 单尾号命中: ${ex.singleHits}`);
    });
  }
}

runTest();
