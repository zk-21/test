/**
 * 快速验证组合阶段融合（前5期）
 */
const fs = require('fs');
const content = fs.readFileSync('./script回测.js', 'utf8');

// 检查代码中是否有明显的变量顺序问题
const lines = content.split('\n');
let predictedTailsLine = -1;
let frontSampleLine = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const predictedTails = [...tailScores.entries()]')) {
    predictedTailsLine = i + 1;
  }
  if (lines[i].includes('const frontSample = {')) {
    frontSampleLine = i + 1;
  }
}

console.log('=== 代码顺序检查 ===');
console.log(`predictedTails 定义行: ${predictedTailsLine}`);
console.log(`frontSample 定义行: ${frontSampleLine}`);

if (predictedTailsLine < frontSampleLine) {
  console.log('✓ 顺序正确: predictedTails 在 frontSample 之前定义');
} else {
  console.log('✗ 顺序错误: predictedTails 在 frontSample 之后定义');
}

// 检查关键变量引用
const hasPredictionRef = content.includes('predictedTails: predictedTails,');
console.log(`\nfrontSample 引用 predictedTails: ${hasPredictionRef ? '✓' : '✗'}`);
