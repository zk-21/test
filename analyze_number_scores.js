// analyze_number_scores.js - 分析特定号码的评分细节
// 运行: node analyze_number_scores.js

const fs = require('fs');
const path = require('path');

// 加载开奖数据
const rawJs = fs.readFileSync(path.join(__dirname, 'all_draws.js'), 'utf8');
const match = rawJs.match(/window\.ALL_DRAWS_DATA\s*=\s*(\[[\s\S]*?\]);/);
if (!match) { console.error('无法解析 all_draws.js'); process.exit(1); }
const ALL_DRAWS_DATA = eval(match[1]);
const draws = [...ALL_DRAWS_DATA].reverse(); // 旧→新

// 模拟 allBalls 格式
const allBalls = [];
draws.forEach((draw, idx) => {
  const rowNum = idx + 1;
  draw.front.forEach((num) => {
    allBalls.push({
      row: rowNum,
      zone: "front",
      number: num,
      label: String(num),
      color: "#d6202a",
      colors: null,
      protected: false,
    });
  });
  draw.back.forEach((num) => {
    allBalls.push({
      row: rowNum,
      zone: "back",
      number: num,
      label: String(num),
      color: "#3b82f6",
      colors: null,
      protected: false,
    });
  });
});

console.log('='.repeat(80));
console.log('号码评分详细分析');
console.log('='.repeat(80));

// 分析号码25在不同期数中的评分
const targetNumber = 25;
const analysisPeriods = [];

// 选择一些覆盖率低的期数进行分析
const lowCoveragePeriods = [
  { source: '2026059', target: '2026060' },
  { source: '2025130', target: '2025131' },
  { source: '2025132', target: '2025133' },
  { source: '2026040', target: '2026041' },
  { source: '2026049', target: '2026050' },
];

console.log(`\n分析号码 ${targetNumber} 在低覆盖率期数中的评分:`);
console.log('-'.repeat(80));

lowCoveragePeriods.forEach(({ source, target }) => {
  const sourceDraw = draws.find(d => d.issue === source);
  const targetDraw = draws.find(d => d.issue === target);
  if (!sourceDraw || !targetDraw) return;
  
  const sourceRow = draws.indexOf(sourceDraw) + 1;
  const selectedNumbers = sourceDraw.front.sort((a, b) => a - b);
  
  // 计算号码25的得分
  let score = 0;
  const scoreBreakdown = [];
  
  // 1. 偏移评分
  let minOffset = Infinity;
  selectedNumbers.forEach(a => { minOffset = Math.min(minOffset, Math.abs(targetNumber - a)); });
  let offsetScore = 0;
  if (minOffset === 0) offsetScore = 15;
  else if (minOffset === 1) offsetScore = 10;
  else if (minOffset === 2) offsetScore = 6;
  else if (minOffset === 3) offsetScore = 3;
  else if (minOffset <= 5) offsetScore = 1;
  score += offsetScore;
  scoreBreakdown.push(`偏移${minOffset}=${offsetScore}`);
  
  // 2. 尾号匹配
  const sourceTails = [...new Set(selectedNumbers.map(n => n % 10))];
  const tailScore = sourceTails.includes(targetNumber % 10) ? 8 : 0;
  score += tailScore;
  if (tailScore > 0) scoreBreakdown.push(`尾号匹配=${tailScore}`);
  
  // 3. 热号（5期窗口）
  let hot = 0;
  for (let r = Math.max(1, sourceRow - 5); r < sourceRow; r++) {
    const rowBalls = allBalls.filter(b => b.zone === "front" && b.row === r);
    if (rowBalls.some(b => b.number === targetNumber)) hot++;
  }
  let hotScore = 0;
  if (hot >= 4) hotScore = 10;
  else if (hot >= 3) hotScore = 7;
  else if (hot >= 2) hotScore = 4;
  else if (hot === 0) hotScore = -2;
  score += hotScore;
  scoreBreakdown.push(`热号${hot}次=${hotScore}`);
  
  // 4. +10期趋势
  const plusTenRow = sourceRow - 10;
  let plusTenScore = 0;
  if (plusTenRow >= 1) {
    const plusTenBalls = allBalls.filter(b => b.zone === "front" && b.row === plusTenRow);
    if (plusTenBalls.some(b => b.number === targetNumber)) {
      plusTenScore = 5;
      score += plusTenScore;
      scoreBreakdown.push(`+10期趋势=${plusTenScore}`);
    }
  }
  
  // 5. 区间平衡
  const iv = targetNumber <= 12 ? 0 : (targetNumber <= 24 ? 1 : 2);
  const currentIv = [0, 0, 0];
  selectedNumbers.forEach(num => {
    if (num <= 12) currentIv[0]++;
    else if (num <= 24) currentIv[1]++;
    else currentIv[2]++;
  });
  
  // 6. 历史频率（全局）
  let globalFreq = 0;
  for (let r = Math.max(1, sourceRow - 50); r < sourceRow; r++) {
    const rowBalls = allBalls.filter(b => b.zone === "front" && b.row === r);
    if (rowBalls.some(b => b.number === targetNumber)) globalFreq++;
  }
  const avgFreq = 50 * 5 / 35; // 平均频率
  let freqScore = 0;
  if (globalFreq > avgFreq * 1.2) {
    freqScore = Math.round((globalFreq - avgFreq) * 0.3);
    score += freqScore;
    scoreBreakdown.push(`历史频率=${freqScore}`);
  }
  
  // 检查是否在目标中
  const isInTarget = targetDraw.front.includes(targetNumber);
  const inPool = score >= 0; // 简化判断
  
  console.log(`\n${source} → ${target}:`);
  console.log(`  源号码: ${selectedNumbers.join(',')}`);
  console.log(`  号码${targetNumber}评分: ${score}分 (${scoreBreakdown.join(', ')})`);
  console.log(`  是否在目标中: ${isInTarget ? '是' : '否'}`);
  console.log(`  热度: ${hot}次, 历史频率: ${globalFreq}次`);
  
  analysisPeriods.push({
    source, target, selectedNumbers, score, scoreBreakdown,
    isInTarget, hot, globalFreq, minOffset
  });
});

console.log('\n' + '='.repeat(80));
console.log('号码25的特征分析');
console.log('='.repeat(80));

// 分析号码25的总体特征
const number25Stats = {
  totalAppearances: 0,
  asTarget: 0,
  inPoolWhenTarget: 0,
  avgOffset: 0,
  avgHot: 0,
  avgFreq: 0
};

let totalOffset = 0;
let totalHot = 0;
let totalFreq = 0;
let count = 0;

for (let sourceIdx = 10; sourceIdx < draws.length - 1; sourceIdx++) {
  const sourceDraw = draws[sourceIdx];
  const targetDraw = draws[sourceIdx + 1];
  
  const sourceRow = sourceIdx + 1;
  const selectedNumbers = sourceDraw.front;
  
  // 检查25是否在目标中
  if (targetDraw.front.includes(25)) {
    number25Stats.asTarget++;
    
    // 计算偏移
    const minOffset = Math.min(...selectedNumbers.map(a => Math.abs(25 - a)));
    totalOffset += minOffset;
    
    // 计算热度
    let hot = 0;
    for (let r = Math.max(1, sourceRow - 5); r < sourceRow; r++) {
      const rowBalls = allBalls.filter(b => b.zone === "front" && b.row === r);
      if (rowBalls.some(b => b.number === 25)) hot++;
    }
    totalHot += hot;
    
    // 计算历史频率
    let globalFreq = 0;
    for (let r = Math.max(1, sourceRow - 50); r < sourceRow; r++) {
      const rowBalls = allBalls.filter(b => b.zone === "front" && b.row === r);
      if (rowBalls.some(b => b.number === 25)) globalFreq++;
    }
    totalFreq += globalFreq;
    
    count++;
  }
}

number25Stats.avgOffset = (totalOffset / count).toFixed(1);
number25Stats.avgHot = (totalHot / count).toFixed(1);
number25Stats.avgFreq = (totalFreq / count).toFixed(1);

console.log(`号码25作为目标号码的次数: ${number25Stats.asTarget}`);
console.log(`平均偏移距离: ${number25Stats.avgOffset}`);
console.log(`平均热度(近5期): ${number25Stats.avgHot}`);
console.log(`平均历史频率(近50期): ${number25Stats.avgFreq}`);

console.log('\n' + '='.repeat(80));
console.log('排除率高的号码对比分析');
console.log('='.repeat(80));

// 对比分析排除率高的号码
const highExclusionNumbers = [25, 17, 15, 34, 29, 35, 7, 30];

highExclusionNumbers.forEach(num => {
  let asTarget = 0;
  let totalOffset = 0;
  let totalHot = 0;
  let totalFreq = 0;
  let count = 0;
  
  for (let sourceIdx = 10; sourceIdx < draws.length - 1; sourceIdx++) {
    const sourceDraw = draws[sourceIdx];
    const targetDraw = draws[sourceIdx + 1];
    
    if (targetDraw.front.includes(num)) {
      asTarget++;
      const sourceRow = sourceIdx + 1;
      const selectedNumbers = sourceDraw.front;
      
      const minOffset = Math.min(...selectedNumbers.map(a => Math.abs(num - a)));
      totalOffset += minOffset;
      
      let hot = 0;
      for (let r = Math.max(1, sourceRow - 5); r < sourceRow; r++) {
        const rowBalls = allBalls.filter(b => b.zone === "front" && b.row === r);
        if (rowBalls.some(b => b.number === num)) hot++;
      }
      totalHot += hot;
      
      let globalFreq = 0;
      for (let r = Math.max(1, sourceRow - 50); r < sourceRow; r++) {
        const rowBalls = allBalls.filter(b => b.zone === "front" && b.row === r);
        if (rowBalls.some(b => b.number === num)) globalFreq++;
      }
      totalFreq += globalFreq;
      
      count++;
    }
  }
  
  console.log(`\n号码${num}:`);
  console.log(`  作为目标次数: ${asTarget}`);
  console.log(`  平均偏移: ${(totalOffset / count).toFixed(1)}`);
  console.log(`  平均热度: ${(totalHot / count).toFixed(1)}`);
  console.log(`  平均历史频率: ${(totalFreq / count).toFixed(1)}`);
});

console.log('\n' + '='.repeat(80));
console.log('优化建议');
console.log('='.repeat(80));

console.log('基于以上分析，号码25排除率高的原因可能是:');
console.log('1. 偏移距离较大: 号码25经常距离源号码较远，导致偏移评分低');
console.log('2. 热度较低: 号码25在近5期出现频率不高，热号评分低');
console.log('3. 历史频率一般: 没有特别高的历史频率加成');
console.log('4. 区间竞争激烈: 区间3（25-35）有很多竞争号码');

console.log('\n建议优化方向:');
console.log('1. 调整偏移评分权重: 对于中等距离（3-5）给予更多分数');
console.log('2. 增加冷号保护: 对于近期未出现的号码给予一定补偿');
console.log('3. 优化区间平衡: 允许区间有更多灵活性');
console.log('4. 考虑号码特性: 某些号码本身出现频率就低，需要特殊处理');
