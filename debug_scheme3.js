// debug_scheme3.js — 调试方案三测试
const fs = require('fs');
const path = require('path');

const scriptPath = path.join(__dirname, 'script回测.js');
const script = fs.readFileSync(scriptPath, 'utf8');

// 检查方案三修改是否存在
const scheme3Match = script.match(/if\s*\(ivIdx\s*===\s*1\)[\s\S]*?candidate\.score\s*\+=\s*5/);
if (scheme3Match) {
  console.log('✓ 方案三修改已存在 (+5分二区boost)');
  console.log('匹配代码:', scheme3Match[0].slice(0, 100));
} else {
  console.log('✗ 方案三修改未找到');
}

// 检查循环替换是否可行
const loopRegex = /for\s*\(\s*let\s+sourceIdx\s*=\s*1\s*;\s*sourceIdx\s*<=\s*totalDraws\s*-\s*PREDICT_INTERVAL\s*-\s*1\s*;\s*sourceIdx\+\+\s*\)/;
const loopMatch = script.match(loopRegex);
if (loopMatch) {
  console.log('\n✓ 找到主循环:', loopMatch[0].slice(0, 80));
} else {
  console.log('\n✗ 未找到主循环模式');
}

// 检查输出部分的正则
const headerRegex = /console\.log\(header\);[\s\S]*?console\.log\("-"\.repeat\(header\.length\)\);/;
const headerMatch = script.match(headerRegex);
if (headerMatch) {
  console.log('\n✓ 找到输出header部分');
} else {
  console.log('\n✗ 未找到输出header部分');
}
