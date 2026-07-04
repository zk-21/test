const fs = require('fs');

// 读取per_period_detail.csv
const csv = fs.readFileSync('per_period_detail.csv', 'utf8').trim().split('\n');
const rows = csv.slice(1).map(line => {
  const match = line.match(/^(\d+),"(.+?)",(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)$/);
  if (!match) return null;
  return {
    period: parseInt(match[1]),
    targets: match[2].split(' ').map(Number),
    top1: parseInt(match[3]),
    top2: parseInt(match[4]),
    top3: parseInt(match[5]),
    top4: parseInt(match[6]),
    top5: parseInt(match[7]),
    bl6: parseInt(match[8]),
    top5Union: parseInt(match[9]),
    top5Bl6Union: parseInt(match[10]),
    poolCoverage: parseInt(match[11])
  };
}).filter(Boolean);

console.log('=== 尾号命中率分析 ===\n');
console.log(`总期数: ${rows.length}\n`);

// 分析尾号命中情况
// 尾号命中：目标号码的尾号是否出现在Top5组合中
let tailHitStats = {
  totalTargetTails: 0,
  top5TailHits: 0,
  bl6TailHits: 0,
  poolTailHits: 0,
  tailHitDistribution: [0, 0, 0, 0, 0, 0] // 命中0,1,2,3,4,5个尾号
};

// 分析每期尾号命中
rows.forEach(r => {
  const targetTails = [...new Set(r.targets.map(n => n % 10))];
  tailHitStats.totalTargetTails += targetTails.length;
  
  // 这里我们需要实际的Top5组合号码来计算尾号命中
  // 但CSV中只有命中个数，没有具体号码
  // 所以我们用命中个数来估算尾号命中
  
  // Top5联合覆盖可以近似为尾号命中的上界
  tailHitStats.top5TailHits += r.top5Union;
  tailHitStats.bl6TailHits += r.top5Bl6Union;
  tailHitStats.poolTailHits += r.poolCoverage;
  
  // 统计Top5联合覆盖分布
  if (r.top5Union <= 5) {
    tailHitStats.tailHitDistribution[r.top5Union]++;
  }
});

console.log('--- Top5联合覆盖分布（近似尾号命中） ---');
tailHitStats.tailHitDistribution.forEach((count, i) => {
  console.log(`  覆盖${i}球: ${count}期 (${(count/rows.length*100).toFixed(1)}%)`);
});

console.log(`\n--- 汇总 ---`);
console.log(`  Top5联合覆盖: ${tailHitStats.top5TailHits}/${rows.length*5} (${(tailHitStats.top5TailHits/(rows.length*5)*100).toFixed(1)}%)`);
console.log(`  T1-6联合覆盖: ${tailHitStats.bl6TailHits}/${rows.length*5} (${(tailHitStats.bl6TailHits/(rows.length*5)*100).toFixed(1)}%)`);
console.log(`  候选池覆盖: ${tailHitStats.poolTailHits}/${rows.length*5} (${(tailHitStats.poolTailHits/(rows.length*5)*100).toFixed(1)}%)`);

// 分析尾号命中率低的原因
console.log('\n=== 尾号命中率低的原因分析 ===\n');

// 1. 分析目标号码的尾号分布
console.log('1. 目标号码尾号分布分析:');
const targetTailFreq = new Map();
for (let t = 0; t <= 9; t++) targetTailFreq.set(t, 0);

rows.forEach(r => {
  r.targets.forEach(n => {
    const tail = n % 10;
    targetTailFreq.set(tail, targetTailFreq.get(tail) + 1);
  });
});

const totalTargetTails = rows.length * 5;
console.log(`  总目标尾号数: ${totalTargetTails}`);
console.log('  尾号分布:');
[...targetTailFreq.entries()].sort((a, b) => b[1] - a[1]).forEach(([tail, count]) => {
  console.log(`    尾号${tail}: ${count}次 (${(count/totalTargetTails*100).toFixed(1)}%)`);
});

// 2. 分析Top5组合的尾号覆盖能力
console.log('\n2. Top5组合尾号覆盖能力分析:');
console.log(`  平均每期Top5联合覆盖: ${(tailHitStats.top5TailHits/rows.length).toFixed(2)}球`);
console.log(`  平均每期目标号码数: 5球`);
console.log(`  覆盖率: ${(tailHitStats.top5TailHits/(rows.length*5)*100).toFixed(1)}%`);

// 3. 分析覆盖≥3球和<3球的期数
const cover3plus = rows.filter(r => r.top5Union >= 3).length;
const cover2minus = rows.filter(r => r.top5Union <= 2).length;
console.log(`\n3. 覆盖质量分析:`);
console.log(`  覆盖≥3球期数: ${cover3plus}期 (${(cover3plus/rows.length*100).toFixed(1)}%)`);
console.log(`  覆盖≤2球期数: ${cover2minus}期 (${(cover2minus/rows.length*100).toFixed(1)}%)`);

// 4. 分析低覆盖期数的特征
console.log('\n4. 低覆盖期数特征分析:');
const lowCoveragePeriods = rows.filter(r => r.top5Union <= 2);
console.log(`  低覆盖期数(≤2球): ${lowCoveragePeriods.length}期`);

if (lowCoveragePeriods.length > 0) {
  // 分析低覆盖期数的目标号码特征
  const lowCoverTargetTails = new Map();
  for (let t = 0; t <= 9; t++) lowCoverTargetTails.set(t, 0);
  
  lowCoveragePeriods.forEach(r => {
    r.targets.forEach(n => {
      const tail = n % 10;
      lowCoverTargetTails.set(tail, lowCoverTargetTails.get(tail) + 1);
    });
  });
  
  console.log('  低覆盖期数目标尾号分布:');
  [...lowCoverTargetTails.entries()].sort((a, b) => b[1] - a[1]).forEach(([tail, count]) => {
    console.log(`    尾号${tail}: ${count}次 (${(count/(lowCoveragePeriods.length*5)*100).toFixed(1)}%)`);
  });
}

// 5. 分析组合数量问题
console.log('\n5. 组合数量问题分析:');
console.log(`  当前配置: Top5组合 + 补漏6 = 6个组合`);
console.log(`  每个组合5个号码，共30个号码位置`);
console.log(`  但候选池只有25个号码，所以有重复`);

// 6. 建议
console.log('\n=== 改进建议 ===\n');
console.log('1. 尾号预测优化:');
console.log('   - 当前尾号预测基于转移概率，但可能过度依赖历史模式');
console.log('   - 建议增加实时性更强的尾号信号，如区间稳定性、热号尾号等');
console.log('   - 考虑增加尾号多样性，避免预测过于集中');

console.log('\n2. 组合生成优化:');
console.log('   - 当前Top5组合可能过于相似，导致覆盖范围有限');
console.log('   - 建议增加组合多样性，确保不同组合覆盖不同尾号');
console.log('   - 考虑调整组合选择策略，优先选择覆盖范围广的组合');

console.log('\n3. 候选池优化:');
console.log('   - 候选池25个号码，但目标只有5个，覆盖率87.4%已经很高');
console.log('   - 问题在于Top5组合的覆盖能力不足（55.4%）');
console.log('   - 建议优化组合选择算法，提高Top5的联合覆盖率');

console.log('\n✅ 分析完成');
