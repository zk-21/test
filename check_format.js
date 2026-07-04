const fs = require('fs');
const path = require('path');

// 读取UTF-16 LE编码的文件
const filePath = path.join(__dirname, 'backtest_cross_row_full.txt');
const buf = fs.readFileSync(filePath);
const content = buf.toString('utf16le');

// 显示前50行
const lines = content.split('\n');
console.log('前50行内容:');
for (let i = 0; i < Math.min(50, lines.length); i++) {
  console.log(`${i+1}: ${lines[i]}`);
}

// 搜索关键词
console.log('\n搜索关键词:');
const keywords = ['命中', '覆盖', '期', 'Top5', '补漏6'];
keywords.forEach(keyword => {
  const matches = lines.filter(line => line.includes(keyword));
  console.log(`"${keyword}" 出现 ${matches.length} 次`);
  if (matches.length > 0) {
    console.log(`  示例: ${matches[0]}`);
  }
});