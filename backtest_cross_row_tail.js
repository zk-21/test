// 跨行尾号+组内规则改进回测脚本
const fs = require('fs');
const path = require('path');

// 导入主脚本中的函数
const scriptContent = fs.readFileSync(path.join(__dirname, 'script回测.js'), 'utf-8');

// 执行主脚本以加载函数定义
eval(scriptContent);

// 回测配置
const config = {
  startRow: 1,
  endRow: 179,
  testPeriods: 177, // 可验证期数
};

console.log('=== 跨行尾号+组内规则改进回测 ===');
console.log(`数据范围: 第${config.startRow}期 ~ 第${config.endRow}期`);
console.log(`可验证期数: ${config.testPeriods}期`);
console.log('');

// 运行回测
const results = runBacktest(config.startRow, config.endRow);

// 输出结果
console.log('=== 回测结果 ===');
console.log('');
console.log('基线结果 (原版本):');
console.log('  Top5最高命中率: 31.8%');
console.log('  Top5+补漏6 联合覆盖率: 61.4%');
console.log('  候选池覆盖率 (Top30): 87.9%');
console.log('');
console.log('改进后结果 (跨行尾号+组内规则):');
console.log(`  Top5最高命中率: ${results.top5HitRate}%`);
console.log(`  Top5+补漏6 联合覆盖率: ${results.unionRate}%`);
console.log(`  候选池覆盖率 (Top30): ${results.poolRate}%`);
console.log('');

// 计算提升
const top5Diff = (parseFloat(results.top5HitRate) - 31.8).toFixed(1);
const unionDiff = (parseFloat(results.unionRate) - 61.4).toFixed(1);
const poolDiff = (parseFloat(results.poolRate) - 87.9).toFixed(1);

console.log('提升幅度:');
console.log(`  Top5命中率: ${top5Diff > 0 ? '+' : ''}${top5Diff}个百分点`);
console.log(`  联合覆盖率: ${unionDiff > 0 ? '+' : ''}${unionDiff}个百分点`);
console.log(`  候选池覆盖率: ${poolDiff > 0 ? '+' : ''}${poolDiff}个百分点`);
console.log('');

// 保存结果到文件
const outputContent = `
==========================================================================================
跨行尾号+组内规则改进回测结果
==========================================================================================
数据范围: 第${config.startRow}期 ~ 第${config.endRow}期
可验证期数: ${config.testPeriods}期

基线结果 (原版本):
  Top5最高命中率: 31.8%
  Top5+补漏6 联合覆盖率: 61.4%
  候选池覆盖率 (Top30): 87.9%

改进后结果 (跨行尾号+组内规则):
  Top5最高命中率: ${results.top5HitRate}%
  Top5+补漏6 联合覆盖率: ${results.unionRate}%
  候选池覆盖率 (Top30): ${results.poolRate}%

提升幅度:
  Top5命中率: ${top5Diff > 0 ? '+' : ''}${top5Diff}个百分点
  联合覆盖率: ${unionDiff > 0 ? '+' : ''}${unionDiff}个百分点
  候选池覆盖率: ${poolDiff > 0 ? '+' : ''}${poolDiff}个百分点

==========================================================================================
`;

fs.writeFileSync(path.join(__dirname, 'backtest_cross_row_tail.txt'), outputContent, 'utf-8');
console.log('结果已保存到 backtest_cross_row_tail.txt');
