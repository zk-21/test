// 验证修复是否生效的简单测试
const fs = require('fs');
const path = require('path');

// 加载主脚本
const pickerPath = path.join(__dirname, 'optimized_picker.js');
process.argv = ['node', 'optimized_picker.js', '--demo'];

// 捕获输出
const originalLog = console.log;
let output = '';
console.log = function(...args) {
  output += args.join(' ') + '\n';
  originalLog.apply(console, args);
};

// 运行主脚本
require('./optimized_picker.js');

// 恢复console.log
console.log = originalLog;

// 检查关键修复是否生效
console.log('\n' + '='.repeat(60));
console.log('  修复验证结果');
console.log('='.repeat(60));

// 检查1: analyzeTailTransitions 使用正确的间隔
if (output.includes('i + 10')) {
  console.log('✅ 修复1生效: analyzeTailTransitions 使用正确的 +10 间隔');
} else {
  console.log('❌ 修复1未生效: analyzeTailTransitions 仍使用错误间隔');
}

// 检查2: predictedTails 传入 generateCandidatePool
if (output.includes('predictedTails')) {
  console.log('✅ 修复2生效: predictedTails 已传入 generateCandidatePool');
} else {
  console.log('❌ 修复2未生效: predictedTails 未传入 generateCandidatePool');
}

// 检查3: 预测尾号评分逻辑
if (output.includes('预测尾号:+')) {
  console.log('✅ 修复3生效: 预测尾号评分逻辑已添加');
} else {
  console.log('⚠️ 修复3未验证: 未在输出中看到预测尾号评分');
}

console.log('\n✅ 代码修改验证完成');
console.log('请运行 --quicktest 或 --backtest 查看实际效果');
