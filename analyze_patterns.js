/**
 * 分析尾号组合转移模式
 * 寻找更多历史数据中的模式
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

// 分析尾号组合转移模式
function analyzeTailComboPatterns() {
  const patterns = {
    exactMatch: 0,      // 完全匹配
    overlap3: 0,        // 重叠3个
    overlap4: 0,        // 重叠4个
    overlap5: 0,        // 重叠5个
    newTail1: 0,        // 新增1个尾号
    newTail2: 0,        // 新增2个尾号
    arithmetic: 0,      // 等差模式
    geometric: 0,       // 等比模式
    total: 0
  };
  
  const comboTransitions = new Map();
  const overlapPatterns = new Map();
  
  for (let r = 1; r < draws.length - 1; r++) {
    const srcNums = [...new Set(__allBalls.filter(b => b.row === r && b.zone === "front").map(b => b.number))];
    const tgtNums = [...new Set(__allBalls.filter(b => b.row === r + 1 && b.zone === "front").map(b => b.number))];
    
    if (srcNums.length !== 5 || tgtNums.length !== 5) continue;
    
    const srcTails = [...new Set(srcNums.map(n => n % 10))].sort();
    const tgtTails = [...new Set(tgtNums.map(n => n % 10))].sort();
    
    patterns.total++;
    
    // 统计重叠
    const overlap = srcTails.filter(t => tgtTails.includes(t));
    const newTails = tgtTails.filter(t => !srcTails.includes(t));
    const disappearTails = srcTails.filter(t => !tgtTails.includes(t));
    
    if (overlap.length === 5) patterns.exactMatch++;
    if (overlap.length === 4) patterns.overlap4++;
    if (overlap.length === 3) patterns.overlap3++;
    if (newTails.length === 1) patterns.newTail1++;
    if (newTails.length === 2) patterns.newTail2++;
    
    // 统计组合转移
    const srcKey = srcTails.join(',');
    const tgtKey = tgtTails.join(',');
    const transKey = `${srcKey}→${tgtKey}`;
    comboTransitions.set(transKey, (comboTransitions.get(transKey) || 0) + 1);
    
    // 统计重叠模式
    const overlapKey = `${overlap.length},${newTails.length},${disappearTails.length}`;
    overlapPatterns.set(overlapKey, (overlapPatterns.get(overlapKey) || 0) + 1);
    
    // 检查等差模式
    const srcDiff = srcTails.map((t, i) => i > 0 ? t - srcTails[i-1] : null).filter(d => d !== null);
    const tgtDiff = tgtTails.map((t, i) => i > 0 ? t - tgtTails[i-1] : null).filter(d => d !== null);
    
    if (srcDiff.every(d => d === srcDiff[0])) patterns.arithmetic++;
    if (tgtDiff.every(d => d === tgtDiff[0])) patterns.arithmetic++;
  }
  
  return { patterns, comboTransitions, overlapPatterns };
}

// 分析用户提供的例子
function analyzeUserExample() {
  console.log("\n" + "=".repeat(80));
  console.log("分析用户提供的例子");
  console.log("=".repeat(80));
  
  // 例子1：9,10,20,33,35 → 2,6,14,22,24
  console.log("\n例子1：9,10,20,33,35 → 2,6,14,22,24");
  console.log("源尾号：0,3,5,9");
  console.log("目标尾号：2,4,6");
  console.log("模式：0,3,5,9 → 2,4,6");
  
  // 例子2：12,19,21,24,29 → 4,5,15,21,32
  console.log("\n例子2：12,19,21,24,29 → 4,5,15,21,32");
  console.log("源尾号：1,2,4,9");
  console.log("目标尾号：1,2,4,5");
  console.log("模式：1,2,4,9 → 1,2,4,5");
  
  // 例子3：4,11,12,13,25 → 10,13,19,21,30
  console.log("\n例子3：4,11,12,13,25 → 10,13,19,21,30");
  console.log("源尾号：0,1,2,3,4,5");
  console.log("目标尾号：1,5,9");
  console.log("模式：0,1,2,3,4,5 → 1,5,9");
  
  // 搜索类似模式
  console.log("\n搜索类似模式...");
  
  const similarPatterns = [];
  
  for (let r = 1; r < draws.length - 1; r++) {
    const srcNums = [...new Set(__allBalls.filter(b => b.row === r && b.zone === "front").map(b => b.number))];
    const tgtNums = [...new Set(__allBalls.filter(b => b.row === r + 1 && b.zone === "front").map(b => b.number))];
    
    if (srcNums.length !== 5 || tgtNums.length !== 5) continue;
    
    const srcTails = [...new Set(srcNums.map(n => n % 10))].sort();
    const tgtTails = [...new Set(tgtNums.map(n => n % 10))].sort();
    
    const srcKey = srcTails.join(',');
    const tgtKey = tgtTails.join(',');
    
    // 检查类似模式1：包含0,3,5,9
    if (srcTails.includes(0) && srcTails.includes(3) && srcTails.includes(5) && srcTails.includes(9)) {
      similarPatterns.push({
        row: r,
        srcTails,
        tgtTails,
        pattern: "0,3,5,9 → " + tgtKey
      });
    }
    
    // 检查类似模式2：包含1,2,4,9
    if (srcTails.includes(1) && srcTails.includes(2) && srcTails.includes(4) && srcTails.includes(9)) {
      similarPatterns.push({
        row: r,
        srcTails,
        tgtTails,
        pattern: "1,2,4,9 → " + tgtKey
      });
    }
    
    // 检查类似模式3：包含0,1,2,3,4,5中的至少4个
    const srcSet = new Set(srcTails);
    const matchCount = [0,1,2,3,4,5].filter(t => srcSet.has(t)).length;
    if (matchCount >= 4) {
      similarPatterns.push({
        row: r,
        srcTails,
        tgtTails,
        pattern: srcKey + " → " + tgtKey
      });
    }
  }
  
  console.log(`找到 ${similarPatterns.length} 个类似模式`);
  
  // 显示前10个
  similarPatterns.slice(0, 10).forEach((p, i) => {
    console.log(`\n${i + 1}. 行${p.row}:`);
    console.log(`   源尾号：${p.srcTails.join(',')}`);
    console.log(`   目标尾号：${p.tgtTails.join(',')}`);
    console.log(`   模式：${p.pattern}`);
  });
}

// 分析重叠模式
function analyzeOverlapPatterns() {
  console.log("\n" + "=".repeat(80));
  console.log("分析重叠模式");
  console.log("=".repeat(80));
  
  const overlapStats = new Map();
  
  for (let r = 1; r < draws.length - 1; r++) {
    const srcNums = [...new Set(__allBalls.filter(b => b.row === r && b.zone === "front").map(b => b.number))];
    const tgtNums = [...new Set(__allBalls.filter(b => b.row === r + 1 && b.zone === "front").map(b => b.number))];
    
    if (srcNums.length !== 5 || tgtNums.length !== 5) continue;
    
    const srcTails = [...new Set(srcNums.map(n => n % 10))].sort();
    const tgtTails = [...new Set(tgtNums.map(n => n % 10))].sort();
    
    const overlap = srcTails.filter(t => tgtTails.includes(t));
    const newTails = tgtTails.filter(t => !srcTails.includes(t));
    
    const key = `${overlap.length}重叠,${newTails.length}新增`;
    overlapStats.set(key, (overlapStats.get(key) || 0) + 1);
  }
  
  console.log("\n重叠模式统计:");
  const sortedStats = [...overlapStats.entries()].sort((a, b) => b[1] - a[1]);
  sortedStats.forEach(([pattern, count]) => {
    console.log(`  ${pattern}: ${count}次 (${(count / draws.length * 100).toFixed(1)}%)`);
  });
}

// 分析等差模式
function analyzeArithmeticPatterns() {
  console.log("\n" + "=".repeat(80));
  console.log("分析等差模式");
  console.log("=".repeat(80));
  
  let arithmeticCount = 0;
  let total = 0;
  
  for (let r = 1; r < draws.length; r++) {
    const nums = [...new Set(__allBalls.filter(b => b.row === r && b.zone === "front").map(b => b.number))];
    if (nums.length !== 5) continue;
    
    const tails = [...new Set(nums.map(n => n % 10))].sort();
    if (tails.length < 3) continue;
    
    total++;
    
    // 检查是否等差
    let isArithmetic = true;
    const diff = tails[1] - tails[0];
    for (let i = 2; i < tails.length; i++) {
      if (tails[i] - tails[i-1] !== diff) {
        isArithmetic = false;
        break;
      }
    }
    
    if (isArithmetic) arithmeticCount++;
  }
  
  console.log(`等差模式: ${arithmeticCount}/${total} = ${(arithmeticCount / total * 100).toFixed(1)}%`);
}

// 主函数
function main() {
  console.log("\n" + "=".repeat(80));
  console.log("尾号组合转移模式分析");
  console.log("=".repeat(80));
  
  analyzeUserExample();
  analyzeOverlapPatterns();
  analyzeArithmeticPatterns();
  
  // 分析组合转移
  console.log("\n" + "=".repeat(80));
  console.log("组合转移统计");
  console.log("=".repeat(80));
  
  const { patterns, comboTransitions, overlapPatterns } = analyzeTailComboPatterns();
  
  console.log("\n总体统计:");
  console.log(`  总期数: ${patterns.total}`);
  console.log(`  完全匹配: ${patterns.exactMatch} (${(patterns.exactMatch / patterns.total * 100).toFixed(1)}%)`);
  console.log(`  重叠4个: ${patterns.overlap4} (${(patterns.overlap4 / patterns.total * 100).toFixed(1)}%)`);
  console.log(`  重叠3个: ${patterns.overlap3} (${(patterns.overlap3 / patterns.total * 100).toFixed(1)}%)`);
  console.log(`  新增1个尾号: ${patterns.newTail1} (${(patterns.newTail1 / patterns.total * 100).toFixed(1)}%)`);
  console.log(`  新增2个尾号: ${patterns.newTail2} (${(patterns.newTail2 / patterns.total * 100).toFixed(1)}%)`);
  console.log(`  等差模式: ${patterns.arithmetic} (${(patterns.arithmetic / patterns.total * 100).toFixed(1)}%)`);
  
  // 显示最常见的组合转移
  console.log("\n最常见的组合转移Top10:");
  const sortedTransitions = [...comboTransitions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  sortedTransitions.forEach(([key, count]) => {
    console.log(`  ${key}: ${count}次`);
  });
  
  // 显示最常见的重叠模式
  console.log("\n最常见的重叠模式Top10:");
  const sortedOverlap = [...overlapPatterns.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  sortedOverlap.forEach(([key, count]) => {
    console.log(`  ${key}: ${count}次`);
  });
}

main();
