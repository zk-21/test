// 最小化测试 - 直接加载script回测.js并运行快速回测
// 设置命令行参数
process.argv.push('--compare-seeds', '--quick');

// 加载并执行script回测.js
require('./script回测.js');
