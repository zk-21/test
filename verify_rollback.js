/**
 * 验证回退配置
 */

const fs = require('fs');

console.log('=== 验证回退配置 ===\n');

// 读取script回测.js文件
const content = fs.readFileSync('./script回测.js', 'utf8');

// 检查间隔配置
const intervalMatch = content.match(/const SECOND_INTERVAL = (\d+);.*const THIRD_INTERVAL = (-?\d+);.*const FOURTH_INTERVAL = (-?\d+);/s);
if (intervalMatch) {
  const second = parseInt(intervalMatch[1]);
  const third = parseInt(intervalMatch[2]);
  const fourth = parseInt(intervalMatch[3]);
  
  console.log('间隔配置:');
  console.log(`  SECOND_INTERVAL = ${second} (N+${second})`);
  console.log(`  THIRD_INTERVAL = ${third} (N${third >= 0 ? '+' : ''}${third})`);
  console.log(`  FOURTH_INTERVAL = ${fourth} (N${fourth >= 0 ? '+' : ''}${fourth})`);
  
  if (second === 9 && third === 0 && fourth === -1) {
    console.log('  ✓ 配置正确: N+9/N/N-1');
  } else {
    console.log('  ✗ 配置错误');
  }
}

// 检查尾号融合策略
if (content.includes('简单加权合并：尾号融合')) {
  console.log('\n尾号融合策略: ✓ 简单加权合并');
} else if (content.includes('尾号转移模式融合')) {
  console.log('\n尾号融合策略: ✗ 仍然是尾号转移模式融合');
} else {
  console.log('\n尾号融合策略: 未知');
}

// 检查源描述
if (content.includes('3源融合：主源N+9期，辅源N期，辅源N-1期')) {
  console.log('源描述: ✓ N+9/N/N-1');
} else {
  console.log('源描述: 需要检查');
}

console.log('\n=== 验证完成 ===');