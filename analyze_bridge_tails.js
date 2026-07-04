const fs = require('fs');
const allDraws = JSON.parse(fs.readFileSync('all_draws.json', 'utf8'));

const tails = (nums) => [...new Set(nums.map(n => n % 10))].sort((a, b) => a - b);

// 获取桥接号
function getBridgeNumbers(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const bridges = new Set();
  
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    for (let n = start + 1; n < end; n++) {
      bridges.add(n);
    }
  }
  
  // 循环桥接
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  for (let n = last + 1; n <= 35; n++) {
    bridges.add(n);
  }
  for (let n = 1; n < first; n++) {
    bridges.add(n);
  }
  
  return [...bridges];
}

// 分析前5期
console.log('=== 桥接号分析 ===\n');

for (let i = 0; i < 5; i++) {
  const srcNums = allDraws[i].front;
  const srcTails = tails(srcNums);
  const bridgeNumbers = getBridgeNumbers(srcNums);
  const bridgeTails = tails(bridgeNumbers);
  
  console.log(`期号: ${allDraws[i].issue}`);
  console.log(`上期开奖: ${srcNums.join(', ')}`);
  console.log(`上期尾号: ${srcTails.join(', ')}`);
  console.log(`桥接号数量: ${bridgeNumbers.length}`);
  console.log(`桥接号尾号: ${bridgeTails.join(', ')}`);
  
  // 检查尾号重叠
  const overlap = srcTails.filter(t => bridgeTails.includes(t));
  console.log(`尾号重叠: ${overlap.join(', ')}`);
  console.log(`桥接号尾号覆盖: ${bridgeTails.length}/10个尾号`);
  console.log('');
}