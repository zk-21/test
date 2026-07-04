const fs = require('fs');
const content = fs.readFileSync('./script回测.js', 'utf8');
const issues = [];

if (content.includes('frontCombos.length') && !content.includes('const frontCombos')) {
  issues.push('frontCombos 可能未定义');
}
if (content.includes('_diagMergedSorted') && !content.includes('const _diagMergedSorted')) {
  issues.push('_diagMergedSorted 可能未定义');
}
if (content.includes('_diagSourceAll35') && !content.includes('const _diagSourceAll35')) {
  issues.push('_diagSourceAll35 可能未定义');
}

if (issues.length === 0) {
  console.log('✓ 所有变量定义检查通过');
} else {
  console.log('✗ 发现问题:');
  issues.forEach(i => console.log('  - ' + i));
}
