// 分析目标球尾号与前一行尾号的关系（相邻/重复）

const fs = require('fs');
const path = require('path');

// 数据加载
const rawJs = fs.readFileSync(path.join(__dirname, 'all_draws.js'), 'utf8');
const match = rawJs.match(/window\.ALL_DRAWS_DATA\s*=\s*(\[[\s\S]*?\]);/);
if (!match) { console.error('无法解析 all_draws.js'); process.exit(1); }
const ALL_DRAWS_DATA = eval(match[1]);

const draws = [...ALL_DRAWS_DATA].reverse();
const __allBalls = [];

draws.forEach((draw, idx) => {
  const row = idx + 1;
  draw.row = row;
  draw.front.forEach(n => __allBalls.push({ row, zone: "front", number: n }));
  draw.back.forEach(n => __allBalls.push({ row, zone: "back", number: n }));
});

console.log(`总数据: ${draws.length}期\n`);

// 要分析的球
const targetBalls = [5, 35, 27, 30];

console.log("=".repeat(80));
console.log("分析目标球尾号与前一行尾号的关系");
console.log("=".repeat(80));

targetBalls.forEach(ball => {
  const ballTail = ball % 10;
  console.log(`\n${"─".repeat(60)}`);
  console.log(`球${ball}（尾号${ballTail}）`);
  console.log(`${"─".repeat(60)}`);
  
  // 找到球出现的所有期数
  const appearances = draws.filter(d => d.front.includes(ball));
  console.log(`出现次数: ${appearances.length}`);
  
  // 统计前一行尾号
  const prevTailFreq = new Map();
  let repeatCount = 0;  // 前一行有相同尾号
  let neighborCount = 0; // 前一行有相邻尾号
  let bothCount = 0;    // 前一行有相同和相邻尾号
  
  appearances.forEach(draw => {
    const prevDraw = draws.find(d => d.row === draw.row - 1);
    if (!prevDraw) return;
    
    const prevTails = new Set(prevDraw.front.map(n => n % 10));
    
    // 统计每个前一行尾号
    prevTails.forEach(t => {
      prevTailFreq.set(t, (prevTailFreq.get(t) || 0) + 1);
    });
    
    // 检查是否有相同尾号
    const hasRepeat = prevTails.has(ballTail);
    
    // 检查是否有相邻尾号（差1或9）
    const neighbors = [(ballTail + 1) % 10, (ballTail + 9) % 10];
    const hasNeighbor = neighbors.some(n => prevTails.has(n));
    
    if (hasRepeat) repeatCount++;
    if (hasNeighbor) neighborCount++;
    if (hasRepeat && hasNeighbor) bothCount++;
  });
  
  console.log(`\n前一行包含相同尾号${ballTail}: ${repeatCount}次 (${(repeatCount / appearances.length * 100).toFixed(1)}%)`);
  console.log(`前一行包含相邻尾号: ${neighborCount}次 (${(neighborCount / appearances.length * 100).toFixed(1)}%)`);
  console.log(`前一行同时包含相同+相邻: ${bothCount}次 (${(bothCount / appearances.length * 100).toFixed(1)}%)`);
  
  // 计算包含相同或相邻尾号的比例
  const eitherCount = appearances.filter(draw => {
    const prevDraw = draws.find(d => d.row === draw.row - 1);
    if (!prevDraw) return false;
    const prevTails = new Set(prevDraw.front.map(n => n % 10));
    const neighbors = [(ballTail + 1) % 10, (ballTail + 9) % 10];
    return prevTails.has(ballTail) || neighbors.some(n => prevTails.has(n));
  }).length;
  
  console.log(`前一行包含相同或相邻尾号: ${eitherCount}次 (${(eitherCount / appearances.length * 100).toFixed(1)}%)`);
  
  // 显示前一行高频尾号
  console.log(`\n前一行尾号频率:`);
  const sortedTails = [...prevTailFreq.entries()].sort((a, b) => b[1] - a[1]);
  sortedTails.forEach(([tail, count]) => {
    const pct = (count / appearances.length * 100).toFixed(1);
    const isRepeat = tail === ballTail ? " ← 相同" : "";
    const isNeighbor = [(ballTail + 1) % 10, (ballTail + 9) % 10].includes(tail) ? " ← 相邻" : "";
    console.log(`  尾号${tail}: ${count}次 (${pct}%)${isRepeat}${isNeighbor}`);
  });
});

// 综合分析：所有球的规律
console.log("\n" + "=".repeat(80));
console.log("综合分析：目标球尾号与前一行尾号的关系");
console.log("=".repeat(80));

// 统计所有期数中，下一期号码尾号与前一期的关系
let totalPairs = 0;
let repeatPairs = 0;    // 前一期有相同尾号
let neighborPairs = 0;  // 前一期有相邻尾号
let eitherPairs = 0;    // 前一期有相同或相邻尾号

for (let r = 1; r < draws.length - 1; r++) {
  const prevDraw = draws.find(d => d.row === r);
  const currDraw = draws.find(d => d.row === r + 1);
  
  if (!prevDraw || !currDraw) continue;
  if (prevDraw.front.length !== 5 || currDraw.front.length !== 5) continue;
  
  const prevTails = new Set(prevDraw.front.map(n => n % 10));
  const currTails = currDraw.front.map(n => n % 10);
  
  currTails.forEach(tail => {
    totalPairs++;
    
    const hasRepeat = prevTails.has(tail);
    const neighbors = [(tail + 1) % 10, (tail + 9) % 10];
    const hasNeighbor = neighbors.some(n => prevTails.has(n));
    
    if (hasRepeat) repeatPairs++;
    if (hasNeighbor) neighborPairs++;
    if (hasRepeat || hasNeighbor) eitherPairs++;
  });
}

console.log(`\n总号码对数: ${totalPairs}`);
console.log(`前一期有相同尾号: ${repeatPairs}次 (${(repeatPairs / totalPairs * 100).toFixed(1)}%)`);
console.log(`前一期有相邻尾号: ${neighborPairs}次 (${(neighborPairs / totalPairs * 100).toFixed(1)}%)`);
console.log(`前一期有相同或相邻尾号: ${eitherPairs}次 (${(eitherPairs / totalPairs * 100).toFixed(1)}%)`);

// 分析每个尾号作为目标时的规律
console.log("\n" + "=".repeat(80));
console.log("每个尾号作为目标时，前一期包含相同或相邻尾号的比例");
console.log("=".repeat(80));

for (let targetTail = 0; targetTail <= 9; targetTail++) {
  let count = 0;
  let matchCount = 0;
  
  for (let r = 1; r < draws.length - 1; r++) {
    const prevDraw = draws.find(d => d.row === r);
    const currDraw = draws.find(d => d.row === r + 1);
    
    if (!prevDraw || !currDraw) continue;
    if (prevDraw.front.length !== 5 || currDraw.front.length !== 5) continue;
    
    const prevTails = new Set(prevDraw.front.map(n => n % 10));
    const currTails = new Set(currDraw.front.map(n => n % 10));
    
    if (!currTails.has(targetTail)) continue;
    
    count++;
    
    const neighbors = [(targetTail + 1) % 10, (targetTail + 9) % 10];
    if (prevTails.has(targetTail) || neighbors.some(n => prevTails.has(n))) {
      matchCount++;
    }
  }
  
  console.log(`尾号${targetTail}: ${matchCount}/${count} = ${(matchCount / count * 100).toFixed(1)}%`);
}

console.log("\n完成!");
