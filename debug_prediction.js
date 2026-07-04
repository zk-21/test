/**
 * 调试预测过程
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

// 模拟 collectBalls
function collectBalls() {
  return __allBalls;
}

// 尾号组合转移分析
function analyzeTailComboTransitions(sourceRow, lookback, allBalls) {
  lookback = lookback || 100;
  const comboTransFreq = new Map();
  const comboTargetFreq = new Map();
  
  const balls = allBalls || collectBalls();
  
  const start = Math.max(1, sourceRow - lookback);
  console.log(`analyzeTailComboTransitions: sourceRow=${sourceRow}, lookback=${lookback}, start=${start}`);
  
  let validPairs = 0;
  
  for (let r = start; r < sourceRow - 1; r++) {
    const srcNums = [...new Set(balls.filter(b => b.row === r && b.zone === "front").map(b => b.number))];
    const tgtNums = [...new Set(balls.filter(b => b.row === r + 1 && b.zone === "front").map(b => b.number))];
    
    if (srcNums.length !== 5 || tgtNums.length !== 5) continue;
    
    const srcTails = [...new Set(srcNums.map(n => n % 10))].sort().join(',');
    const tgtTails = [...new Set(tgtNums.map(n => n % 10))].sort().join(',');
    
    comboTransFreq.set(`${srcTails}→${tgtTails}`, (comboTransFreq.get(`${srcTails}→${tgtTails}`) || 0) + 1);
    comboTargetFreq.set(tgtTails, (comboTargetFreq.get(tgtTails) || 0) + 1);
    
    validPairs++;
  }
  
  console.log(`有效配对: ${validPairs}, comboTransFreq大小: ${comboTransFreq.size}`);
  
  return { comboTransFreq, comboTargetFreq };
}

// 预测函数
function predictTailsFromComboTransfer(sourceTails, comboTransData) {
  const { comboTransFreq, comboTargetFreq } = comboTransData;
  const srcKey = [...sourceTails].sort().join(',');
  
  console.log(`predictTailsFromComboTransfer: srcKey=${srcKey}`);
  
  const tailScores = new Map();
  for (let t = 0; t <= 9; t++) tailScores.set(t, 0);
  
  // 1. 直接匹配
  let directMatchCount = 0;
  for (const [key, count] of comboTransFreq) {
    const [src, tgt] = key.split('→');
    if (src === srcKey) {
      directMatchCount++;
      const targetTails = tgt.split(',').map(Number);
      targetTails.forEach(t => {
        tailScores.set(t, tailScores.get(t) + count * 10);
      });
    }
  }
  console.log(`直接匹配: ${directMatchCount}次`);
  
  // 2. 部分匹配
  const srcSet = new Set(sourceTails);
  let partialMatchCount = 0;
  for (const [key, count] of comboTransFreq) {
    const [src, tgt] = key.split('→');
    const srcArr = src.split(',').map(Number);
    const matchCount = srcArr.filter(t => srcSet.has(t)).length;
    
    if (matchCount >= 3 && matchCount < srcArr.length) {
      partialMatchCount++;
      const targetTails = tgt.split(',').map(Number);
      const weight = count * (matchCount / srcArr.length) * 5;
      targetTails.forEach(t => {
        tailScores.set(t, tailScores.get(t) + weight);
      });
    }
  }
  console.log(`部分匹配: ${partialMatchCount}次`);
  
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

// 测试一个例子
const testRow = 110;
const srcNums = [...new Set(__allBalls.filter(b => b.row === testRow && b.zone === "front").map(b => b.number))];
const srcTails = [...new Set(srcNums.map(n => n % 10))];

console.log("\n" + "=".repeat(80));
console.log("测试预测过程");
console.log("=".repeat(80));

console.log(`\n测试行: ${testRow}`);
console.log(`源号码: ${srcNums.join(',')}`);
console.log(`源尾号: ${srcTails.join(',')}`);

const comboTransData = analyzeTailComboTransitions(testRow, 100, __allBalls);
const comboScores = predictTailsFromComboTransfer(srcTails, comboTransData);

console.log("\n组合转移预测Top5:");
comboScores.slice(0, 5).forEach(([tail, score], i) => {
  console.log(`  ${i + 1}. 尾号${tail}: ${score.toFixed(2)}`);
});

// 检查是否所有分数都相同
const allScores = comboScores.map(([_, s]) => s);
const allSame = allScores.every(s => s === allScores[0]);
console.log(`\n所有分数相同: ${allSame}`);
if (allSame) {
  console.log(`分数值: ${allScores[0]}`);
}
