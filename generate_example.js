// ═══ v4.1 策略示例生成器 ═══
// 使用当前script回测.js的完整生成管线，为最新一期生成号码

// 加载主脚本的所有函数
const fs = require('fs');
const path = require('path');

// 读取script回测.js并执行（获取所有函数定义）
const scriptPath = path.join(__dirname, 'script回测.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf-8');

// 在全局作用域执行脚本（获取所有函数）
eval(scriptContent);

// 获取开奖数据
const draws = getBuiltInDrawData();
if (!draws || draws.length < 3) {
  console.error("数据不足");
  process.exit(1);
}

console.log("=".repeat(80));
console.log("v4.1 策略示例生成");
console.log("=".repeat(80));

// 使用最后一期作为源
const totalDraws = draws.length;
const sourceIdx = totalDraws - 11; // 倒数第11期作为源（预测最后一期）
const sourceDraw = draws[sourceIdx];

console.log(`\n源期号: ${sourceDraw.issue}`);
console.log(`源号码: ${[...sourceDraw.front].sort((a, b) => a - b).join(', ')}`);
console.log(`源后区: ${sourceDraw.back.join(', ')}`);

// 生成候选池
const sourceRow = sourceIdx + 1;
const ratioPlan = null;

try {
  // 1. 生成V4候选池
  const frontSample = buildSampleNumbersV4(sourceRow, "front", ratioPlan);
  
  console.log("\n" + "=".repeat(80));
  console.log("候选池信息");
  console.log("=".repeat(80));
  console.log(`候选池大小: ${frontSample.candidates.length}球`);
  console.log(`候选池号码: ${frontSample.candidates.sort((a, b) => a - b).join(', ')}`);
  
  // 显示Top10评分
  console.log("\nTop10评分:");
  frontSample.candidateEntries.slice(0, 10).forEach((e, i) => {
    console.log(`  ${i + 1}. 球${e.number.toString().padStart(2)} - 分数: ${e.score.toFixed(1)}`);
  });
  
  // 2. 生成组合
  console.log("\n" + "=".repeat(80));
  console.log("v4.1 组合生成");
  console.log("=".repeat(80));
  
  const combos = buildSampleFrontCombosV4(
    frontSample.candidateEntries,
    frontSample.referenceRows || [],
    [],
    frontSample.candidates,
    frontSample.predictedTails,
    frontSample.ivPrediction,
    frontSample.firstBallPredictions,
    frontSample.extremeFlags
  );
  
  if (combos && combos.length > 0) {
    console.log(`\n生成${combos.length}组组合:`);
    
    // 调试：显示第一个combo的结构
    if (combos.length > 0) {
      const firstCombo = combos[0];
      console.log("\n[调试] 第一个combo的keys:", Object.keys(firstCombo));
      if (firstCombo.front) console.log("[调试] firstCombo.front的keys:", Object.keys(firstCombo.front));
    }
    
    // 显示前5组作为Top5
    console.log("\nTop5 推荐:");
    for (let i = 0; i < Math.min(5, combos.length); i++) {
      const combo = combos[i];
      // 组合结构：combo.numbers 或 combo.front?.numbers
      const nums = combo.numbers || (combo.front ? combo.front.numbers : []);
      const sortedNums = nums.slice(0, 5).sort((a, b) => a - b);
      console.log(`  第${i + 1}组: ${sortedNums.join(', ')}`);
    }
    
    // 显示补漏6
    if (combos.length > 5) {
      const bl6 = combos[5];
      const bl6Nums = bl6.numbers || (bl6.front ? bl6.front.numbers : []);
      const sortedBl6 = bl6Nums.slice(0, 5).sort((a, b) => a - b);
      console.log(`\n补漏6: ${sortedBl6.join(', ')}`);
    }
    
    // 生成后区
    console.log("\n" + "=".repeat(80));
    console.log("后区推荐");
    console.log("=".repeat(80));
    
    const backSample = buildSampleNumbersV4(sourceRow, "back", ratioPlan);
    if (backSample && backSample.numbers) {
      console.log(`后区号码: ${backSample.numbers.join(', ')}`);
    }
  } else {
    console.log("未能生成组合");
  }
  
  // 显示区间比预测
  if (frontSample.ivPrediction) {
    console.log("\n" + "=".repeat(80));
    console.log("区间比预测");
    console.log("=".repeat(80));
    const pred = frontSample.ivPrediction.predictedIv;
    if (pred) {
      console.log(`预测区间比: ${pred[0]}:${pred[1]}:${pred[2]}`);
    }
  }
  
  // 显示尾号预测
  if (frontSample.predictedTails && frontSample.predictedTails.length > 0) {
    console.log("\n" + "=".repeat(80));
    console.log("尾号预测");
    console.log("=".repeat(80));
    console.log("Top5尾号:");
    frontSample.predictedTails.slice(0, 5).forEach(([tail, score], i) => {
      console.log(`  ${i + 1}. 尾号${tail} (分数: ${score.toFixed(1)})`);
    });
  }
  
} catch (err) {
  console.error("生成失败:", err.message);
  console.error(err.stack);
}

console.log("\n" + "=".repeat(80));
console.log("生成完成");
console.log("=".repeat(80));
