// 完整回测脚本 - 将结果保存到文件
const fs = require('fs');

// 重定向console.log到文件
const originalLog = console.log;
const logFile = fs.createWriteStream('backtest_full_result.txt', { flags: 'w' });
console.log = function(...args) {
  logFile.write(args.join(' ') + '\n');
  originalLog.apply(console, args);
};

// 执行optimized_picker.js
process.argv = ['node', 'optimized_picker.js', '--backtest'];
require('./optimized_picker.js');

// 恢复console.log
console.log = originalLog;
logFile.end();
originalLog('回测完成，结果已保存到 backtest_full_result.txt');
