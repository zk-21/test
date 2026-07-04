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

console.log('🔍 漏掉号码与选中号码临近度精确分析');
console.log('═'.repeat(70));

// 关键洞察：
// 1. poolCoverage = 候选池覆盖的目标号码数（0-5）
// 2. top5Union = Top5组合覆盖的目标号码数（0-5）
// 3. 漏掉的号码 =目标 - Top5联合覆盖
// 4. 但漏掉的号码可能在候选池中（poolCoverage > top5Union）

console.log('\n📊 关键指标分析:');
console.log('─'.repeat(70));

// 分析"池内漏掉"（在候选池中但未被Top5覆盖）
const poolMissed = periods.map(p => {
  const best = Math.max(p.top1, p.top2, p.top3, p.top4, p.top5);
  const missed = 5 - best;
  const poolMissed = p.poolCoverage - p.top5Union; // 在池中但未被Top5覆盖
  
  return {
    period: p.period,
    target: p.target,
    best: best,
    missed: missed,
    poolCoverage: p.poolCoverage,
    top5Union: p.top5Union,
    poolMissed: Math.max(0, poolMissed), // 池内漏掉
    outOfPoolMissed: missed - Math.max(0, poolMissed) // 池外漏掉
  };
});

// 统计池内漏掉
const poolMissedTotal = poolMissed.reduce((a, b) => a + b.poolMissed, 0);
const outOfPoolMissedTotal = poolMissed.reduce((a, b) => a + b.outOfPoolMissed, 0);
const totalMissed = poolMissedTotal + outOfPoolMissedTotal;

console.log(`总漏球数: ${totalMissed}球`);
console.log(`池内漏掉: ${poolMissedTotal}球 (${(poolMissedTotal/totalMissed*100).toFixed(1)}%)`);
console.log(`池外漏掉: ${outOfPoolMissedTotal}球 (${(outOfPoolMissedTotal/totalMissed*100).toFixed(1)}%)`);

console.log('\n📊 池内漏掉 vs 池外漏掉:');
console.log('─'.repeat(70));

// 分析池内漏掉的特征
const poolMissed0 = poolMissed.filter(p => p.poolMissed === 0).length;
const poolMissed1 = poolMissed.filter(p => p.poolMissed === 1).length;
const poolMissed2 = poolMissed.filter(p => p.poolMissed === 2).length;
const poolMissed3Plus = poolMissed.filter(p => p.poolMissed >= 3).length;

console.log(`池内漏0球: ${poolMissed0}期 (${(poolMissed0/168*100).toFixed(1)}%)`);
console.log(`池内漏1球: ${poolMissed1}期 (${(poolMissed1/168*100).toFixed(1)}%)`);
console.log(`池内漏2球: ${poolMissed2}期 (${(poolMissed2/168*100).toFixed(1)}%)`);
console.log(`池内漏3+球: ${poolMissed3Plus}期 (${(poolMissed3Plus/168*100).toFixed(1)}%)`);

console.log('\n📊 池内漏掉号码的"临近"概率分析:');
console.log('─'.repeat(70));
console.log('假设：池内漏掉的号码在候选池中排名28-30（边缘位置）');
console.log('这些号码与Top5选中的号码（排名1-27）在数值上可能临近');

// 池内漏掉的号码更可能是"临近漏掉"
// 因为它们在候选池中，说明得分较高，只是没有被Top5选中
const poolMissedNearProb = 0.6; // 假设60%的池内漏掉是临近漏掉
const outOfPoolMissedNearProb = 0.1; // 假设10%的池外漏掉是临近漏掉

const nearMissFromPool = poolMissedTotal * poolMissedNearProb;
const nearMissFromOut = outOfPoolMissedTotal * outOfPoolMissedNearProb;
const totalNearMiss = nearMissFromPool + nearMissFromOut;

console.log(`\n池内漏掉临近概率: ${poolMissedNearProb*100}% → 预期临近漏掉: ${nearMissFromPool.toFixed(1)}球`);
console.log(`池外漏掉临近概率: ${outOfPoolMissedNearProb*100}% → 预期临近漏掉: ${nearMissFromOut.toFixed(1)}球`);
console.log(`\n总预期临近漏掉: ${totalNearMiss.toFixed(1)}球`);
console.log(`平均每期临近漏掉: ${(totalNearMiss/168).toFixed(2)}球`);

console.log('\n📊 扩大候选池的效果模拟:');
console.log('─'.repeat(70));

const currentTotalHits = periods.reduce((a, p) => a + Math.max(p.top1, p.top2, p.top3, p.top4, p.top5), 0);

// 场景1：扩大±1，捕获50%的临近漏掉
const captureRate1 = 0.5;
const additionalHits1 = totalNearMiss * captureRate1;
const newTotalHits1 = currentTotalHits + additionalHits1;

console.log('\n场景1: 扩大候选池±1');
console.log(`  当前总命中: ${currentTotalHits}球`);
console.log(`  预期新增命中: +${additionalHits1.toFixed(1)}球`);
console.log(`  新总命中: ${newTotalHits1.toFixed(1)}球`);
console.log(`  命中提升: +${(additionalHits1/currentTotalHits*100).toFixed(1)}%`);

// 场景2：扩大±2，捕获70%的临近漏掉
const captureRate2 = 0.7;
const additionalHits2 = totalNearMiss * captureRate2;
const newTotalHits2 = currentTotalHits + additionalHits2;

console.log('\n场景2: 扩大候选池±2');
console.log(`  当前总命中: ${currentTotalHits}球`);
console.log(`  预期新增命中: +${additionalHits2.toFixed(1)}球`);
console.log(`  新总命中: ${newTotalHits2.toFixed(1)}球`);
console.log(`  命中提升: +${(additionalHits2/currentTotalHits*100).toFixed(1)}%`);

// 场景3：只优化池内漏掉（通过改进Top5选择策略）
const improveTop5CaptureRate = 0.3; // 假设30%的池内漏掉可以通过改进Top5选择捕获
const additionalHits3 = poolMissedTotal * improveTop5CaptureRate;
const newTotalHits3 = currentTotalHits + additionalHits3;

console.log('\n场景3: 改进Top5选择策略（捕获30%池内漏掉）');
console.log(`  当前总命中: ${currentTotalHits}球`);
console.log(`  预期新增命中: +${additionalHits3.toFixed(1)}球`);
console.log(`  新总命中: ${newTotalHits3.toFixed(1)}球`);
console.log(`  命中提升: +${(additionalHits3/currentTotalHits*100).toFixed(1)}%`);

console.log('\n📊 各时段池内漏掉分析:');
console.log('─'.repeat(70));

const earlyPeriods = poolMissed.slice(0, 56);
const midPeriods = poolMissed.slice(56, 112);
const latePeriods = poolMissed.slice(112);

function analyzePeriodSlice(slice, label) {
  const poolMissedCount = slice.reduce((a, b) => a + b.poolMissed, 0);
  const outOfPoolMissedCount = slice.reduce((a, b) => a + b.outOfPoolMissed, 0);
  const totalMissedCount = poolMissedCount + outOfPoolMissedCount;
  
  console.log(`\n${label}:`);
  console.log(`  总漏球: ${totalMissedCount} | 池内漏掉: ${poolMissedCount}(${(poolMissedCount/totalMissedCount*100).toFixed(1)}%) | 池外漏掉: ${outOfPoolMissedCount}(${(outOfPoolMissedCount/totalMissedCount*100).toFixed(1)}%)`);
}

analyzePeriodSlice(earlyPeriods, '早期 (1-56期)');
analyzePeriodSlice(midPeriods, '中期 (57-112期)');
analyzePeriodSlice(latePeriods, '近期 (113-168期)');

console.log('\n📊 关键发现:');
console.log('─'.repeat(70));
console.log('1. 池内漏掉占比:', `${(poolMissedTotal/totalMissed*100).toFixed(1)}%`);
console.log('   - 这些号码在候选池中但未被Top5选中');
console.log('   - 说明Top5选择策略有优化空间');
console.log('');
console.log('2. 池外漏掉占比:', `${(outOfPoolMissedTotal/totalMissed*100).toFixed(1)}%`);
console.log('   - 这些号码不在候选池中');
console.log('   - 说明候选池覆盖有优化空间');
console.log('');
console.log('3. 临近漏掉主要来自池内漏掉:');
console.log(`   - 池内漏掉 ${poolMissedTotal}球 × ${poolMissedNearProb*100}% = ${nearMissFromPool.toFixed(1)}球`);
console.log(`   - 池外漏掉 ${outOfPoolMissedTotal}球 × ${outOfPoolMissedNearProb*100}% = ${nearMissFromOut.toFixed(1)}球`);

console.log('\n' + '═'.repeat(70));
console.log('💡 优化建议:');
console.log('─'.repeat(70));
console.log('1. 优先改进Top5选择策略:');
console.log(`   - 池内漏掉 ${poolMissedTotal}球，改进后可新增 +${additionalHits3.toFixed(1)}球命中`);
console.log('   - 具体方法：对候选池边缘号码(排名28-30)给予更高权重');
console.log('');
console.log('2. 其次扩大候选池范围:');
console.log(`   - 池外漏掉 ${outOfPoolMissedTotal}球，扩大±1后可新增 +${(outOfPoolMissedTotal*0.5).toFixed(1)}球命中`);
console.log('   - 具体方法：将池大小从30扩大到33');
console.log('');
console.log('3. 综合优化效果:');
console.log(`   - 当前命中: ${currentTotalHits}球`);
console.log(`   - 改进Top5选择: +${additionalHits3.toFixed(1)}球`);
console.log(`   - 扩大候选池±1: +${(outOfPoolMissedTotal*0.5).toFixed(1)}球`);
console.log(`   - 预期总命中: ${(currentTotalHits + additionalHits3 + outOfPoolMissedTotal*0.5).toFixed(1)}球`);
console.log(`   - 总命中提升: +${((additionalHits3 + outOfPoolMissedTotal*0.5)/currentTotalHits*100).toFixed(1)}%`);

console.log('\n' + '═'.repeat(70));
console.log('✅ 分析完成');