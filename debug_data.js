/**
 * 调试数据加载
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
console.log(`总球数: ${__allBalls.length}`);

// 检查数据
console.log("\n检查前5期数据:");
for (let r = 1; r <= 5; r++) {
  const balls = __allBalls.filter(b => b.row === r && b.zone === "front");
  const nums = balls.map(b => b.number);
  console.log(`行${r}: ${nums.join(',')}`);
}

// 测试组合转移分析
function analyzeTailComboTransitions(sourceRow, lookback) {
  const comboTransFreq = new Map();
  const comboTargetFreq = new Map();
  
  const start = Math.max(1, sourceRow - lookback);
  console.log(`\n分析范围: ${start} 到 ${sourceRow - 1}`);
  
  let validPairs = 0;
  
  for (let r = start; r < sourceRow - 1; r++) {
    const srcNums = [...new Set(__allBalls.filter(b => b.row === r && b.zone === "front").map(b => b.number))];
    const tgtNums = [...new Set(__allBalls.filter(b => b.row === r + 1 && b.zone === "front").map(b => b.number))];
    
    if (srcNums.length !== 5 || tgtNums.length !== 5) {
      if (r <= start + 2) {
        console.log(`行${r}: srcNums.length=${srcNums.length}, tgtNums.length=${tgtNums.length}`);
      }
      continue;
    }
    
    const srcTails = [...new Set(srcNums.map(n => n % 10))].sort().join(',');
    const tgtTails = [...new Set(tgtNums.map(n => n % 10))].sort().join(',');
    
    comboTransFreq.set(`${srcTails}→${tgtTails}`, (comboTransFreq.get(`${srcTails}→${tgtTails}`) || 0) + 1);
    comboTargetFreq.set(tgtTails, (comboTargetFreq.get(tgtTails) || 0) + 1);
    
    validPairs++;
    
    if (r <= start + 2) {
      console.log(`行${r}: src=${srcTails}, tgt=${tgtTails}`);
    }
  }
  
  console.log(`有效配对: ${validPairs}`);
  console.log(`comboTransFreq大小: ${comboTransFreq.size}`);
  console.log(`comboTargetFreq大小: ${comboTargetFreq.size}`);
  
  return { comboTransFreq, comboTargetFreq };
}

// 测试
console.log("\n" + "=".repeat(80));
console.log("测试组合转移分析");
console.log("=".repeat(80));

const result = analyzeTailComboTransitions(draws.length, 100);

console.log("\n前5个comboTransFreq:");
let count = 0;
for (const [key, freq] of result.comboTransFreq) {
  if (count >= 5) break;
  console.log(`  ${key}: ${freq}`);
  count++;
}

console.log("\n前5个comboTargetFreq:");
count = 0;
for (const [combo, freq] of result.comboTargetFreq) {
  if (count >= 5) break;
  console.log(`  ${combo}: ${freq}`);
  count++;
}
