const fs = require('fs');
const s = fs.readFileSync('./backtest_full.txt', 'utf8');
const lines = s.split(/\r?\n/);

console.log("Total lines:", lines.length);
console.log("File size:", s.length, "bytes");
console.log("First 100 chars:", JSON.stringify(s.substring(0, 100)));

// 搜索包含 |5| 的行
let found = 0;
for (let idx = 0; idx < lines.length; idx++) {
  const line = lines[idx];
  if (line.includes('|5|')) {
    found++;
    if (found <= 3) {
      console.log(`Found line ${idx}: ${JSON.stringify(line.substring(0, 80))}`);
    }
  }
}
console.log("Lines with |5|:", found);
