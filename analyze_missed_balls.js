// 分析被漏掉最多的球（球5、球35、球27、球30）的目的行及前一行尾号

const fs = require('fs');
const path = require('path');

// 数据加载 - 从 all_draws.js
const rawJs = fs.readFileSync(path.join(__dirname, 'all_draws.js'), 'utf8');
const match = rawJs.match(/window\.ALL_DRAWS_DATA\s*=\s*(\[[\s\S]*?\]);/);
if (!match) { console.error('无法解析 all_draws.js'); process.exit(1); }
const ALL_DRAWS_DATA = eval(match[1]);

const __allBalls = [];
const draws = [...ALL_DRAWS_DATA].reverse(); // 旧→新

draws.forEach((draw, idx) => {
  const rowNum = idx + 1;
  draw.front.forEach(n => {
    __allBalls.push({ row: rowNum, zone: "front", number: n });
  });
  draw.back.forEach(n => {
    __allBalls.push({ row: rowNum, zone: "back", number: n });
  });
  draw.row = rowNum;
});

console.log(`总数据: ${draws.length}期\n`);

// 要分析的球
const targetBalls = [5, 35, 27, 30];

// 分析每个目标球
targetBalls.forEach(ball => {
  console.log("=".repeat(80));
  console.log(`分析球 ${ball} 出现时的尾号模式`);
  console.log("=".repeat(80));
  
  // 找到球出现的所有期数
  const appearances = draws.filter(d => d.front.includes(ball));
  console.log(`球${ball}出现次数: ${appearances.length}\n`);
  
  if (appearances.length === 0) return;
  
  // 统计前一行和当前行的尾号
  const prevTailFreq = new Map();
  const currTailFreq = new Map();
  const prevCurrPairs = [];
  
  appearances.forEach(draw => {
    const row = draw.row;
    const prevDraw = draws.find(d => d.row === row - 1);
    
    if (prevDraw) {
      const prevTails = [...new Set(prevDraw.front.map(n => n % 10))].sort();
      const currTails = [...new Set(draw.front.map(n => n % 10))].sort();
      
      // 统计前一行尾号频率
      prevTails.forEach(t => {
        prevTailFreq.set(t, (prevTailFreq.get(t) || 0) + 1);
      });
      
      // 统计当前行尾号频率
      currTails.forEach(t => {
        currTailFreq.set(t, (currTailFreq.get(t) || 0) + 1);
      });
      
      // 记录配对
      prevCurrPairs.push({
        row,
        prevRow: row - 1,
        prevNums: prevDraw.front,
        currNums: draw.front,
        prevTails,
        currTails,
        ballTail: ball % 10
      });
    }
  });
  
  // 输出前一行尾号频率
  console.log(`\n球${ball}出现时，前一行尾号频率:`);
  const sortedPrevTails = [...prevTailFreq.entries()].sort((a, b) => b[1] - a[1]);
  sortedPrevTails.forEach(([tail, count]) => {
    const pct = (count / appearances.length * 100).toFixed(1);
    console.log(`  尾号${tail}: ${count}次 (${pct}%)`);
  });
  
  // 输出当前行尾号频率
  console.log(`\n球${ball}出现时，当前行尾号频率:`);
  const sortedCurrTails = [...currTailFreq.entries()].sort((a, b) => b[1] - a[1]);
  sortedCurrTails.forEach(([tail, count]) => {
    const pct = (count / appearances.length * 100).toFixed(1);
    console.log(`  尾号${tail}: ${count}次 (${pct}%)`);
  });
  
  // 输出最近10期的详细数据
  console.log(`\n球${ball}出现的最近10期详细数据:`);
  console.log("-".repeat(80));
  console.log("当前期 | 前一期号码 | 前一尾号 | 当期号码 | 当期尾号");
  console.log("-".repeat(80));
  
  prevCurrPairs.slice(-10).forEach(p => {
    console.log(`${String(p.row).padEnd(6)} | ${p.prevNums.join(',').padEnd(10)} | ${p.prevTails.join(',').padEnd(8)} | ${p.currNums.join(',').padEnd(10)} | ${p.currTails.join(',')}`);
  });
  
  // 分析尾号转移模式
  console.log(`\n尾号转移模式分析:`);
  const transferPatterns = new Map();
  
  prevCurrPairs.forEach(p => {
    const prevKey = p.prevTails.join(',');
    const currKey = p.currTails.join(',');
    const pattern = `${prevKey} → ${currKey}`;
    transferPatterns.set(pattern, (transferPatterns.get(pattern) || 0) + 1);
  });
  
  const sortedPatterns = [...transferPatterns.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  sortedPatterns.forEach(([pattern, count]) => {
    console.log(`  ${pattern}: ${count}次`);
  });
  
  console.log("\n");
});

// 综合分析：球5、35、27、30同时出现时的模式
console.log("=".repeat(80));
console.log("综合分析：球5、35、27、30的共同特征");
console.log("=".repeat(80));

// 找到包含至少2个目标球的期数
const multiTargetDraws = draws.filter(d => {
  const matchCount = targetBalls.filter(b => d.front.includes(b)).length;
  return matchCount >= 2;
});

console.log(`\n包含至少2个目标球的期数: ${multiTargetDraws.length}`);

if (multiTargetDraws.length > 0) {
  console.log("\n这些期数的详细数据:");
  console.log("-".repeat(80));
  
  multiTargetDraws.slice(-10).forEach(draw => {
    const prevDraw = draws.find(d => d.row === draw.row - 1);
    if (prevDraw) {
      const prevTails = [...new Set(prevDraw.front.map(n => n % 10))].sort();
      const currTails = [...new Set(draw.front.map(n => n % 10))].sort();
      const matchedBalls = targetBalls.filter(b => draw.front.includes(b));
      
      console.log(`行${draw.row}: ${draw.front.join(',')} (尾号${currTails.join(',')}) | 包含球: ${matchedBalls.join(',')} | 前一行尾号: ${prevTails.join(',')}`);
    }
  });
}

// 分析球5的特殊模式（被漏最多）
console.log("\n" + "=".repeat(80));
console.log("球5特殊分析（被漏最多21次）");
console.log("=".repeat(80));

const ball5Appearances = draws.filter(d => d.front.includes(5));
console.log(`球5出现次数: ${ball5Appearances.length}`);

// 分析球5出现时的区间分布
const ball5ZoneStats = { zone1: 0, zone2: 0, zone3: 0 };

ball5Appearances.forEach(draw => {
  draw.front.forEach(n => {
    if (n >= 1 && n <= 12) ball5ZoneStats.zone1++;
    else if (n >= 13 && n <= 24) ball5ZoneStats.zone2++;
    else if (n >= 25 && n <= 35) ball5ZoneStats.zone3++;
  });
});

console.log(`\n球5出现时的区间分布:`);
console.log(`  一区(1-12): ${ball5ZoneStats.zone1}次`);
console.log(`  二区(13-24): ${ball5ZoneStats.zone2}次`);
console.log(`  三区(25-35): ${ball5ZoneStats.zone3}次`);

// 分析球5出现时的尾号组合
const ball5TailCombos = new Map();

ball5Appearances.forEach(draw => {
  const tails = [...new Set(draw.front.map(n => n % 10))].sort().join(',');
  ball5TailCombos.set(tails, (ball5TailCombos.get(tails) || 0) + 1);
});

console.log(`\n球5出现时的尾号组合Top10:`);
const sortedBall5Combos = [...ball5TailCombos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
sortedBall5Combos.forEach(([combo, count]) => {
  console.log(`  ${combo}: ${count}次`);
});

console.log("\n完成!");
