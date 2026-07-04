// 运行script回测.js的诊断分析部分
// 直接执行回测脚本的诊断输出

const { execSync } = require('child_process');
const path = require('path');

console.log('🎯 运行script回测.js诊断分析...');
console.log('═'.repeat(70));

try {
  // 运行回测脚本，捕获输出
  const result = execSync('node script回测.js --backtest 2>&1', {
    cwd: __dirname,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024 // 10MB buffer
  });
  
  // 提取诊断部分
  const lines = result.split('\n');
  let diagStart = -1;
  let diagEnd = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('未覆盖球诊断分析')) {
      diagStart = i;
    }
    if (diagStart >= 0 && lines[i].includes('优化建议')) {
      diagEnd = i;
      break;
    }
  }
  
  if (diagStart >= 0 && diagEnd >= 0) {
    console.log('\n📊 未覆盖球诊断分析:');
    console.log('─'.repeat(70));
    for (let i = diagStart; i < diagEnd; i++) {
      console.log(lines[i]);
    }
  } else {
    console.log('未找到诊断分析部分');
    console.log('输出最后100行:');
    console.log(lines.slice(-100).join('\n'));
  }
  
} catch (err) {
  console.error('运行回测脚本出错:', err.message);
  if (err.stdout) {
    console.log('输出:', err.stdout.toString().slice(-2000));
  }
}