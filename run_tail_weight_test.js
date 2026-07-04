/**
 * 尾号预测权重平衡实验
 * 运行: node run_tail_weight_test.js
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log("开始运行尾号预测权重平衡实验...");
console.log("修改内容:");
console.log("  1. sameOrNeighbor权重: 35 → 20");
console.log("  2. 启用crossRowTail信号");
console.log("  3. 启用globalFreq信号");
console.log("  4. 启用partialMatch信号");
console.log("  5. 启用highFreqMiss信号");
console.log("");

try {
  const output = execSync('node script回测.js 2>&1', { 
    encoding: 'utf8', 
    timeout: 300000,
    cwd: __dirname
  });
  
  // 保存输出
  const outputFile = 'backtest_tail_weight_balanced.txt';
  fs.writeFileSync(path.join(__dirname, outputFile), output, 'utf-8');
  console.log(`回测完成，结果已保存到: ${outputFile}`);
  
  // 提取关键指标
  const lines = output.split('\n');
  console.log("\n=== 关键指标 ===");
  for (const line of lines) {
    if (line.includes('池覆盖') || line.includes('联合覆盖') || line.includes('命中率') || 
        line.includes('≥3球') || line.includes('≥4球') || line.includes('全5')) {
      console.log(line.trim());
    }
  }
  
} catch (error) {
  console.error("运行出错:", error.message);
  if (error.stdout) {
    console.log("部分输出:", error.stdout.slice(-2000));
  }
}
