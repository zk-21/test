/**
 * 多源融合方案测试 v2
 * 直接修改script回测.js的配置来测试不同的方案
 */

const fs = require('fs');
const path = require('path');

// 读取script回测.js
let scriptCode = fs.readFileSync(path.join(__dirname, 'script回测.js'), 'utf-8');

// 方案定义
const schemes = [
  {
    name: '当前方案（间隔9,10,11）',
    intervals: [9, 10, 11],
    weights: [0.5, 0.3, 0.2]
  },
  {
    name: '方案1（间隔5,9,10）',
    intervals: [5, 9, 10],
    weights: [0.2, 0.5, 0.3]
  },
  {
    name: '方案2（间隔7,9,10）',
    intervals: [7, 9, 10],
    weights: [0.3, 0.4, 0.3]
  },
  {
    name: '方案3（间隔8,9,10）',
    intervals: [8, 9, 10],
    weights: [0.3, 0.4, 0.3]
  },
  {
    name: '方案4（间隔9,10,12）',
    intervals: [9, 10, 12],
    weights: [0.4, 0.35, 0.25]
  },
  {
    name: '方案5（间隔6,9,10）',
    intervals: [6, 9, 10],
    weights: [0.25, 0.45, 0.3]
  },
  {
    name: '方案6（间隔7,8,9,10）',
    intervals: [7, 8, 9, 10],
    weights: [0.2, 0.25, 0.3, 0.25]
  },
  {
    name: '方案7（间隔5,7,9,10）',
    intervals: [5, 7, 9, 10],
    weights: [0.15, 0.2, 0.35, 0.3]
  },
  {
    name: '方案8（间隔9,10）双源',
    intervals: [9, 10],
    weights: [0.6, 0.4]
  },
  {
    name: '方案9（间隔8,9,10,11）',
    intervals: [8, 9, 10, 11],
    weights: [0.2, 0.35, 0.3, 0.15]
  },
];

console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║  🧪 多源融合方案测试 v2                                           ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

// 为每个方案生成修改后的脚本并运行
schemes.forEach((scheme, idx) => {
  console.log(`\n${"═".repeat(100)}`);
  console.log(`📊 测试方案${idx + 1}: ${scheme.name}`);
  console.log(`   间隔: ${scheme.intervals.join(', ')}`);
  console.log(`   权重: ${scheme.weights.join(', ')}`);
  console.log(`${"═".repeat(100)}`);
  
  // 修改脚本中的配置
  let modifiedCode = scriptCode;
  
  // 修改间隔配置
  const intervalsStr = scheme.intervals.join(', ');
  const weightsStr = scheme.weights.join(', ');
  
  // 找到并替换间隔配置
  modifiedCode = modifiedCode.replace(
    /const PREDICT_INTERVAL = \d+;/,
    `const PREDICT_INTERVAL = ${scheme.intervals[0]};`
  );
  modifiedCode = modifiedCode.replace(
    /const SECOND_INTERVAL = \d+;/,
    `const SECOND_INTERVAL = ${scheme.intervals[1] || 10};`
  );
  
  // 找到并替换权重配置
  modifiedCode = modifiedCode.replace(
    /const weights = \[[\d., ]+\];/,
    `const weights = [${weightsStr}];`
  );
  
  // 修改源行收集逻辑
  const sourceRowsCode = `
      // 收集所有候选源
      const sourceRows = [sourceRow]; // 主源
      ${scheme.intervals.slice(1).map((interval, i) => `
      // 间隔${interval}的源
      const auxSource${i + 1}Idx = sourceIdx + ${interval - 1};
      const auxSource${i + 1}Row = auxSource${i + 1}Idx + 1;
      if (auxSource${i + 1}Row >= 1 && auxSource${i + 1}Row <= totalDraws && auxSource${i + 1}Row !== sourceRow) {
        sourceRows.push(auxSource${i + 1}Row);
      }`).join('')}
  `;
  
  // 替换源行收集逻辑
  modifiedCode = modifiedCode.replace(
    /\/\/ 收集所有候选源[\s\S]*?sourceRows\.push\(thirdSourceRow\);[\s\S]*?\}/,
    sourceRowsCode
  );
  
  // 写入临时文件
  const tempFile = path.join(__dirname, `_temp_backtest_${idx}.js`);
  fs.writeFileSync(tempFile, modifiedCode);
  
  console.log(`   临时文件已创建: ${tempFile}`);
});

console.log(`\n${"═".repeat(100)}`);
console.log("📊 测试完成");
console.log(`${"═".repeat(100)}`);
console.log(`
💡 使用方法：

1. 每个方案都生成了一个临时脚本文件
2. 可以运行对应的临时脚本来测试该方案
3. 例如：node _temp_backtest_0.js（测试当前方案）
4. 例如：node _temp_backtest_1.js（测试方案1）

📊 建议：
- 先运行当前方案作为基准
- 然后运行其他方案对比
- 选择表现最好的方案同步到script.js
`);
