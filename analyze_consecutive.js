// 分析历史数据中双连号、三连号出现概率
const fs = require('fs');

// 从 optimized_picker.js 提取数据
const src = fs.readFileSync('optimized_picker.js', 'utf-8');
const dataMatch = src.match(/const ALL_DRAWS = (\[[\s\S]*?\]);/);
if (!dataMatch) { console.log('无法提取ALL_DRAWS'); process.exit(1); }
const ALL_DRAWS = eval(dataMatch[1]);

console.log('═══════════════════════════════════════════════════════════');
console.log('  连号模式分析（双连号、三连号出现概率）');
console.log('═══════════════════════════════════════════════════════════');
console.log(`  数据: ${ALL_DRAWS.length}期\n`);

// 统计连号分布
const stats = {
  noConsecutive: 0,      // 无连号
  oneDouble: 0,          // 1组双连号
  twoDouble: 0,          // 2组双连号
  oneTriple: 0,          // 1组三连号
  doubleAndTriple: 0,    // 双连号+三连号
  moreThanTriple: 0,     // 四连号及以上
};

const consecutiveDetails = [];

ALL_DRAWS.forEach((draw, idx) => {
  const numbers = [...draw.front].sort((a, b) => a - b);
  
  // 找连号段
  const segments = [];
  let current = [numbers[0]];
  
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] === numbers[i-1] + 1) {
      current.push(numbers[i]);
    } else {
      if (current.length >= 2) segments.push(current);
      current = [numbers[i]];
    }
  }
  if (current.length >= 2) segments.push(current);
  
  // 分类
  const doubles = segments.filter(s => s.length === 2).length;
  const triples = segments.filter(s => s.length === 3).length;
  const quads = segments.filter(s => s.length >= 4).length;
  
  if (quads > 0) {
    stats.moreThanTriple++;
  } else if (triples > 0 && doubles > 0) {
    stats.doubleAndTriple++;
  } else if (triples > 0) {
    stats.oneTriple++;
  } else if (doubles === 2) {
    stats.twoDouble++;
  } else if (doubles === 1) {
    stats.oneDouble++;
  } else {
    stats.noConsecutive++;
  }
  
  consecutiveDetails.push({
    idx: idx + 1,
    numbers: numbers.join(','),
    segments: segments.map(s => s.join('-')).join(', '),
    doubles,
    triples,
    quads
  });
});

const total = ALL_DRAWS.length;

console.log('┌──────────────────────────────┬────────┬────────┐');
console.log('│ 连号模式                      │  期数  │  占比  │');
console.log('├──────────────────────────────┼────────┼────────┤');
console.log(`│ 无连号                        │   ${String(stats.noConsecutive).padStart(3)}   │  ${(stats.noConsecutive/total*100).toFixed(1).padStart(5)}% │`);
console.log(`│ 1组双连号                     │   ${String(stats.oneDouble).padStart(3)}   │  ${(stats.oneDouble/total*100).toFixed(1).padStart(5)}% │`);
console.log(`│ 2组双连号                     │   ${String(stats.twoDouble).padStart(3)}   │  ${(stats.twoDouble/total*100).toFixed(1).padStart(5)}% │`);
console.log(`│ 1组三连号                     │   ${String(stats.oneTriple).padStart(3)}   │  ${(stats.oneTriple/total*100).toFixed(1).padStart(5)}% │`);
console.log(`│ 双连号+三连号                 │   ${String(stats.doubleAndTriple).padStart(3)}   │  ${(stats.doubleAndTriple/total*100).toFixed(1).padStart(5)}% │`);
console.log(`│ 四连号及以上                  │   ${String(stats.moreThanTriple).padStart(3)}   │  ${(stats.moreThanTriple/total*100).toFixed(1).padStart(5)}% │`);
console.log('└──────────────────────────────┴────────┴────────┘\n');

// 统计连号对数
let totalPairs = 0;
const pairDistribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

consecutiveDetails.forEach(d => {
  const pairs = d.doubles + d.triples * 2 + d.quads * 3; // 三连号算2对，四连号算3对
  totalPairs += pairs;
  if (pairs <= 5) pairDistribution[pairs]++;
});

console.log('┌──────────────────────────────┬────────┬────────┐');
console.log('│ 连号对数分布                  │  期数  │  占比  │');
console.log('├──────────────────────────────┼────────┼────────┤');
for (let i = 0; i <= 5; i++) {
  const count = pairDistribution[i];
  console.log(`│ ${i}对连号                        │   ${String(count).padStart(3)}   │  ${(count/total*100).toFixed(1).padStart(5)}% │`);
}
console.log('└──────────────────────────────┴────────┴────────┘\n');

console.log(`平均连号对数: ${(totalPairs/total).toFixed(2)}\n`);

// 显示最近20期的连号情况
console.log('═══════════════════════════════════════════════════════════');
console.log('  最近20期连号详情');
console.log('═══════════════════════════════════════════════════════════');
const recent = consecutiveDetails.slice(-20);
recent.forEach(d => {
  const segStr = d.segments || '无';
  console.log(`第${String(d.idx).padStart(3)}期: ${d.numbers.padEnd(25)} | ${segStr.padEnd(20)} | 双${d.doubles} 三${d.triples}`);
});

// 分析连号与命中率的关系
console.log('\n═══════════════════════════════════════════════════════════');
console.log('  连号模式与下期关系分析');
console.log('═══════════════════════════════════════════════════════════');

let transitionStats = {
  '无→无': 0, '无→有': 0,
  '有→无': 0, '有→有': 0,
  '双→双': 0, '双→三': 0, '三→双': 0, '三→三': 0
};

for (let i = 0; i < consecutiveDetails.length - 1; i++) {
  const curr = consecutiveDetails[i];
  const next = consecutiveDetails[i + 1];
  
  const currHasDouble = curr.doubles > 0;
  const currHasTriple = curr.triples > 0;
  const nextHasDouble = next.doubles > 0;
  const nextHasTriple = next.triples > 0;
  
  if (!currHasDouble && !currHasTriple && !nextHasDouble && !nextHasTriple) {
    transitionStats['无→无']++;
  } else if (!currHasDouble && !currHasTriple && (nextHasDouble || nextHasTriple)) {
    transitionStats['无→有']++;
  } else if ((currHasDouble || currHasTriple) && !nextHasDouble && !nextHasTriple) {
    transitionStats['有→无']++;
  } else {
    transitionStats['有→有']++;
  }
  
  if (currHasDouble && nextHasDouble) transitionStats['双→双']++;
  if (currHasDouble && nextHasTriple) transitionStats['双→三']++;
  if (currHasTriple && nextHasDouble) transitionStats['三→双']++;
  if (currHasTriple && nextHasTriple) transitionStats['三→三']++;
}

console.log('┌──────────────────────────────┬────────┬────────┐');
console.log('│ 连号转移模式                  │  次数  │  占比  │');
console.log('├──────────────────────────────┼────────┼────────┤');
Object.entries(transitionStats).forEach(([key, count]) => {
  if (count > 0) {
    console.log(`│ ${key.padEnd(28)} │   ${String(count).padStart(3)}   │  ${(count/(total-1)*100).toFixed(1).padStart(5)}% │`);
  }
});
console.log('└──────────────────────────────┴────────┴────────┘\n');
