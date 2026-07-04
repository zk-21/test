const fs = require('fs');
const path = require('path');

// 读取CSV文件
const csvPath = path.join(__dirname, 'per_period_detail.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.trim().split('\n');
const dataLines = lines.slice(1);

// 解析数据
const periods = dataLines.map(line => {
  const parts = line.split(',');
  return {
    period: parseInt(parts[0]),
    target: parts[1].replace(/"/g, ''),
    top1: parseInt(parts[2]),
    top2: parseInt(parts[3]),
    top3: parseInt(parts[4]),
    top4: parseInt(parts[5]),
    top5: parseInt(parts[6]),
    bl6: parseInt(parts[7]),
    top5Union: parseInt(parts[8]),
    top5Bl6Union: parseInt(parts[9]),
    poolCoverage: parseInt(parts[10])
  };
});

console.log('🔍 漏掉号码与选中号码临近度分析');
console.log('═'.repeat(70));

// 需要从script回测.js获取每期的候选池号码
// 由于CSV中没有这些信息，我们基于已有数据进行推断分析

// 1. 分析命中情况与覆盖率的关系
console.log('\n📊 命中情况与候选池覆盖率的关系:');
console.log('─'.repeat(70));

// 按候选池覆盖率分组
const byCoverage = {};
periods.forEach(p => {
  const cov = p.poolCoverage;
  if (!byCoverage[cov]) byCoverage[cov] = [];
  byCoverage[cov].push(p);
});

Object.entries(byCoverage).sort((a, b) => b[0] - a[0]).forEach(([cov, group]) => {
  const bestHits = group.map(p => Math.max(p.top1, p.top2, p.top3, p.top4, p.top5));
  const avgBest = bestHits.reduce((a, b) => a + b, 0) / bestHits.length;
  const hit2Plus = bestHits.filter(h => h >= 2).length;
  const hit3Plus = bestHits.filter(h => h >= 3).length;
  
  console.log(`覆盖${cov}球: ${group.length}期 | 平均最佳命中: ${avgBest.toFixed(2)} | 命中2+: ${hit2Plus}(${(hit2Plus/group.length*100).toFixed(1)}%) | 命中3+: ${hit3Plus}(${(hit3Plus/group.length*100).toFixed(1)}%)`);
});

// 2. 分析漏掉的球数（目标5球 - 命中球数）
console.log('\n📊 漏掉球数统计:');
console.log('─'.repeat(70));

const missedBalls = periods.map(p => {
  const best = Math.max(p.top1, p.top2, p.top3, p.top4, p.top5);
  return {
    period: p.period,
    target: p.target,
    best: best,
    missed: 5 - best,
    top5Union: p.top5Union,
    poolCoverage: p.poolCoverage
  };
});

const missed0 = missedBalls.filter(m => m.missed === 0).length;
const missed1 = missedBalls.filter(m => m.missed === 1).length;
const missed2 = missedBalls.filter(m => m.missed === 2).length;
const missed3 = missedBalls.filter(m => m.missed === 3).length;
const missed4 = missedBalls.filter(m => m.missed >= 4).length;

console.log(`漏0球(全中): ${missed0}期 (${(missed0/168*100).toFixed(1)}%)`);
console.log(`漏1球: ${missed1}期 (${(missed1/168*100).toFixed(1)}%)`);
console.log(`漏2球: ${missed2}期 (${(missed2/168*100).toFixed(1)}%)`);
console.log(`漏3球: ${missed3}期 (${(missed3/168*100).toFixed(1)}%)`);
console.log(`漏4+球: ${missed4}期 (${(missed4/168*100).toFixed(1)}%)`);

console.log(`\n平均每期漏掉: ${(missedBalls.reduce((a, b) => a + b.missed, 0) / 168).toFixed(2)}球`);

// 3. 分析漏掉球数与Top5联合覆盖率的关系
console.log('\n📊 漏掉球数 vs Top5联合覆盖率:');
console.log('─'.repeat(70));

const byMissed = {};
missedBalls.forEach(m => {
  if (!byMissed[m.missed]) byMissed[m.missed] = [];
  byMissed[m.missed].push(m);
});

Object.entries(byMissed).sort((a, b) => a[0] - b[0]).forEach(([missed, group]) => {
  const avgUnion = group.reduce((a, b) => a + b.top5Union, 0) / group.length;
  const avgCov = group.reduce((a, b) => a + b.poolCoverage, 0) / group.length;
  console.log(`漏${missed}球: ${group.length}期 | 平均Top5联合覆盖: ${avgUnion.toFixed(2)} | 平均候选池覆盖: ${avgCov.toFixed(2)}`);
});

// 4. 分析"临近漏掉"的可能性
console.log('\n📊 临近漏掉分析 (假设候选池30球):');
console.log('─'.repeat(70));
console.log('如果目标号码在候选池附近(±1或±2)，可能通过扩大范围捕获');

// 假设分析：如果候选池扩大±1
const expansionAnalysis = periods.map(p => {
  const best = Math.max(p.top1, p.top2, p.top3, p.top4, p.top5);
  const missed = 5 - best;
  
  // 假设：如果漏1球，且候选池覆盖4+球，可能该球在池边附近
  const nearMissProb = (missed === 1 && p.poolCoverage >= 4) ? 0.7 :
                       (missed === 2 && p.poolCoverage >= 4) ? 0.5 :
                       (missed === 1 && p.poolCoverage === 3) ? 0.4 :
                       (missed === 2 && p.poolCoverage === 3) ? 0.3 : 0.1;
  
  return {
    period: p.period,
    missed: missed,
    poolCoverage: p.poolCoverage,
    nearMissProb: nearMissProb,
    expectedNearMiss: missed * nearMissProb
  };
});

const totalExpectedNearMiss = expansionAnalysis.reduce((a, b) => a + b.expectedNearMiss, 0);
console.log(`\n假设"临近漏掉"概率模型:`);
console.log(`- 漏1球+覆盖4+球: 70%概率在池边`);
console.log(`- 漏2球+覆盖4+球: 50%概率在池边`);
console.log(`- 漏1球+覆盖3球: 40%概率在池边`);
console.log(`- 其他情况: 10%概率在池边`);

console.log(`\n预期"临近漏掉"总数: ${totalExpectedNearMiss.toFixed(1)}球`);
console.log(`平均每期临近漏掉: ${(totalExpectedNearMiss/168).toFixed(2)}球`);

// 5. 如果扩大候选池±1的效果模拟
console.log('\n📊 扩大候选池±1的效果模拟:');
console.log('─'.repeat(70));

// 假设：扩大±1可以捕获50%的临近漏掉
const captureRate = 0.5;
const additionalHits = totalExpectedNearMiss * captureRate;
const currentTotalHits = periods.reduce((a, p) => a + Math.max(p.top1, p.top2, p.top3, p.top4, p.top5), 0);
const newTotalHits = currentTotalHits + additionalHits;

console.log(`当前总命中: ${currentTotalHits}球`);
console.log(`预期新增命中: +${additionalHits.toFixed(1)}球 (捕获率${captureRate*100}%)`);
console.log(`新总命中: ${newTotalHits.toFixed(1)}球`);
console.log(`命中提升: +${(additionalHits/currentTotalHits*100).toFixed(1)}%`);

// 6. 分析各时段的临近漏掉情况
console.log('\n📊 各时段临近漏掉分析:');
console.log('─'.repeat(70));

const earlyPeriods = expansionAnalysis.slice(0, 56);
const midPeriods = expansionAnalysis.slice(56, 112);
const latePeriods = expansionAnalysis.slice(112);

function analyzePeriodSlice(slice, label) {
  const totalMissed = slice.reduce((a, b) => a + b.missed, 0);
  const totalNearMiss = slice.reduce((a, b) => a + b.expectedNearMiss, 0);
  const avgNearMiss = totalNearMiss / slice.length;
  
  console.log(`\n${label}:`);
  console.log(`  总漏球: ${totalMissed} | 预期临近漏球: ${totalNearMiss.toFixed(1)} | 平均/期: ${avgNearMiss.toFixed(2)}`);
}

analyzePeriodSlice(earlyPeriods, '早期 (1-56期)');
analyzePeriodSlice(midPeriods, '中期 (57-112期)');
analyzePeriodSlice(latePeriods, '近期 (113-168期)');

// 7. 高频漏球模式分析
console.log('\n📊 高频漏球模式分析:');
console.log('─'.repeat(70));

// 分析连续漏球情况
let consecutiveMissed = 0;
let maxConsecutive = 0;
let consecutiveCount = 0;

missedBalls.forEach(m => {
  if (m.missed >= 2) {
    consecutiveMissed++;
    maxConsecutive = Math.max(maxConsecutive, consecutiveMissed);
  } else {
    if (consecutiveMissed >= 3) consecutiveCount++;
    consecutiveMissed = 0;
  }
});

console.log(`连续漏2+球最长连续: ${maxConsecutive}期`);
console.log(`连续漏2+球≥3期的次数: ${consecutiveCount}次`);

// 8. 建议
console.log('\n' + '═'.repeat(70));
console.log('💡 优化建议:');
console.log('─'.repeat(70));
console.log('1. 扩大候选池范围:');
console.log(`   - 当前30球池漏球: ${currentTotalHits}/${168*5} (${(currentTotalHits/(168*5)*100).toFixed(1)}%)`);
console.log(`   - 扩大±1后预期: ${newTotalHits.toFixed(0)}/${168*5} (${(newTotalHits/(168*5)*100).toFixed(1)}%)`);
console.log('');
console.log('2. 重点关注"临界号码":');
console.log('   - 对候选池边缘号码(±1)给予额外权重');
console.log('   - 特别关注覆盖4球时漏掉的1球');
console.log('');
console.log('3. 动态调整池大小:');
console.log('   - 当预测置信度低时，扩大候选池');
console.log('   - 当预测置信度高时，保持精简池');
console.log('');
console.log('4. 结合区间比预测:');
console.log('   - 如果区间比预测显示某区间会增加，扩大该区间范围');

console.log('\n' + '═'.repeat(70));
console.log('✅ 分析完成');