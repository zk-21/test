/**
 * 对比不同组合转移权重下的效果
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
  draw.back.forEach((num) => {
    __allBalls.push({ row: rowNum, zone: "back", number: num });
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
function predictTailsFromComboTransfer(sourceTails, comboTransData, weight) {
  const { comboTransFreq, comboTargetFreq } = comboTransData;
  const srcKey = [...sourceTails].sort().join(',');
  
  const tailScores = new Map();
  for (let t = 0; t <= 9; t++) tailScores.set(t, 0);
  
  // 直接匹配
  for (const [key, count] of comboTransFreq) {
    const [src, tgt] = key.split('→');
    if (src === srcKey) {
      tgt.split(',').map(Number).forEach(t => {
        tailScores.set(t, tailScores.get(t) + count * weight);
      });
    }
  }
  
  // 部分匹配
  const srcSet = new Set(sourceTails);
  for (const [key, count] of comboTransFreq) {
    const [src, tgt] = key.split('→');
    const srcArr = src.split(',').map(Number);
    const matchCount = srcArr.filter(t => srcSet.has(t)).length;
    
    if (matchCount >= 3 && matchCount < srcArr.length) {
      const w = count * (matchCount / srcArr.length) * weight * 0.5;
      tgt.split(',').map(Number).forEach(t => {
        tailScores.set(t, tailScores.get(t) + w);
      });
    }
  }
  
  // 全局高频
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

// 测试不同权重
function testWeights() {
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
  
  const weights = [0, 5, 8, 10, 15, 20];
  const results = {};
  
  for (const weight of weights) {
    const stats = { tests: 0, hits: 0, totalHits: 0, poolHits: 0 };
    
    for (let r = testStartRow; r <= testEndRow; r++) {
      const srcNums = [...new Set(__allBalls.filter(b => b.row === r && b.zone === "front").map(b => b.number))];
      const tgtNums = [...new Set(__allBalls.filter(b => b.row === r + 1 && b.zone === "front").map(b => b.number))];
      
      if (srcNums.length !== 5 || tgtNums.length !== 5) continue;
      
      const srcTails = [...new Set(srcNums.map(n => n % 10))];
      const tgtTails = new Set(tgtNums.map(n => n % 10));
      
      // 组合转移预测
      const comboScores = predictTailsFromComboTransfer(srcTails, comboTransData, weight);
      const comboTop5 = new Set(comboScores.slice(0, 5).map(([t]) => t));
      
      // 单尾号转移预测
      const singleScores = predictTailsFromSingleTransfer(srcTails, singleTransFreq);
      const singleTop5 = new Set(singleScores.slice(0, 5).map(([t]) => t));
      
      // 合并（如果weight>0则融合组合转移）
      let finalTop5;
      if (weight > 0) {
        const combinedScores = new Map();
        for (let t = 0; t <= 9; t++) combinedScores.set(t, 0);
        comboScores.forEach(([t, s]) => combinedScores.set(t, combinedScores.get(t) + s));
        singleScores.forEach(([t, s]) => combinedScores.set(t, combinedScores.get(t) + s));
        const combinedSorted = [...combinedScores.entries()].sort((a, b) => b[1] - a[1]);
        finalTop5 = new Set(combinedSorted.slice(0, 5).map(([t]) => t));
      } else {
        finalTop5 = singleTop5;
      }
      
      // 计算命中
      let hits = 0;
      for (const t of tgtTails) {
        if (finalTop5.has(t)) hits++;
      }
      
      stats.tests++;
      stats.hits += hits > 0 ? 1 : 0;
      stats.totalHits += hits;
    }
    
    results[weight] = {
      hitRate: (stats.hits / stats.tests * 100).toFixed(1),
      coverage: (stats.totalHits / (stats.tests * 5) * 100).toFixed(1),
      avgHits: (stats.totalHits / stats.tests).toFixed(2)
    };
  }
  
  return results;
}

// 运行测试
console.log("\n" + "=".repeat(80));
console.log("不同组合转移权重对比");
console.log("=".repeat(80));

const results = testWeights();

console.log("\n权重  | 命中率  | 覆盖率  | 平均命中");
console.log("-".repeat(50));
for (const [weight, stats] of Object.entries(results)) {
  console.log(`${weight.padStart(5)} | ${stats.hitRate.padStart(6)}% | ${stats.coverage.padStart(6)}% | ${stats.avgHits}`);
}

console.log("\n" + "=".repeat(80));
console.log("结论：选择覆盖率最高的权重");
console.log("=".repeat(80));
