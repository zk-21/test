const fs = require('fs');
const path = require('path');

// 基线数据（从backtest_baseline.txt提取）
const baseline = {
  totalPeriods: 168,
  avgTop5MaxHit: 1.59,
  avgTop5Union: 2.76,
  avgBackup6Hit: 0.82,
  avgCombinedUnion: 3.07,
  avgPoolCover: 4.39,
  top5HitRate: 31.8,
  combinedCoverageRate: 61.4,
  poolCoverageRate: 87.9,
  top5HitDistribution: {
    hit3: 11, // 6.5%
    hit2: 79, // 47.0%
    hit1: 76, // 45.2%
    hit0: 2   // 1.2%
  },
  combinedDistribution: {
    cover5: 16, // 9.5%
    cover4: 41, // 24.4%
    cover3: 61, // 36.3%
    cover2: 40, // 23.8%
    cover1: 9,  // 5.4%
    cover0: 1   // 0.6%
  }
};

// 跨行尾号+组内规则数据（从backtest_cross_row_full.txt提取）
const crossRow = {
  totalPeriods: 168,
  avgTop5MaxHit: 1.59,
  avgTop5Union: 2.87,
  avgBackup6Hit: 0.87,
  avgCombinedUnion: 3.02,
  avgPoolCover: 4.40,
  top5HitRate: 31.8,
  combinedCoverageRate: 60.5,
  poolCoverageRate: 88.0,
  top5HitDistribution: {
    hit3: 13, // 7.7%
    hit2: 73, // 43.5%
    hit1: 82, // 48.8%
    hit0: 0   // 0.0%
  },
  combinedDistribution: {
    cover5: 16, // 9.5%
    cover4: 41, // 24.4%
    cover3: 58, // 34.5%
    cover2: 37, // 22.0%
    cover1: 16, // 9.5%
    cover0: 0   // 0.0%
  }
};

console.log('=== 跨行尾号+组内规则 vs 基线对比分析 ===\n');

// 1. 核心指标对比
console.log('1. 核心指标对比:');
console.log('指标'.padEnd(25) + '基线'.padEnd(10) + '跨行尾号'.padEnd(10) + '变化'.padEnd(10) + '变化率');
console.log('-'.repeat(65));

const metrics = [
  { name: 'Top5最高命中率', baseline: baseline.top5HitRate, crossRow: crossRow.top5HitRate, unit: '%' },
  { name: 'Top5+补漏6联合覆盖率', baseline: baseline.combinedCoverageRate, crossRow: crossRow.combinedCoverageRate, unit: '%' },
  { name: '候选池覆盖率', baseline: baseline.poolCoverageRate, crossRow: crossRow.poolCoverageRate, unit: '%' },
  { name: '平均Top5最高命中', baseline: baseline.avgTop5MaxHit, crossRow: crossRow.avgTop5MaxHit, unit: '个' },
  { name: '平均补漏6命中', baseline: baseline.avgBackup6Hit, crossRow: crossRow.avgBackup6Hit, unit: '个' },
  { name: '平均联合覆盖', baseline: baseline.avgCombinedUnion, crossRow: crossRow.avgCombinedUnion, unit: '个' },
  { name: '平均候选池覆盖', baseline: baseline.avgPoolCover, crossRow: crossRow.avgPoolCover, unit: '个' }
];

metrics.forEach(m => {
  const diff = m.crossRow - m.baseline;
  const diffRate = (diff / m.baseline * 100).toFixed(1);
  const diffStr = diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
  const diffRateStr = diff >= 0 ? `+${diffRate}%` : `${diffRate}%`;
  
  console.log(
    m.name.padEnd(25) + 
    `${m.baseline}${m.unit}`.padEnd(10) + 
    `${m.crossRow}${m.unit}`.padEnd(10) + 
    `${diffStr}${m.unit}`.padEnd(10) + 
    diffRateStr
  );
});

// 2. Top5命中分布对比
console.log('\n2. Top5最高命中分布对比:');
console.log('命中数'.padEnd(10) + '基线'.padEnd(15) + '跨行尾号'.padEnd(15) + '变化');
console.log('-'.repeat(55));

for (let i = 0; i <= 3; i++) {
  const key = `hit${i}`;
  const baseCount = baseline.top5HitDistribution[key];
  const crossCount = crossRow.top5HitDistribution[key];
  const basePercent = (baseCount / baseline.totalPeriods * 100).toFixed(1);
  const crossPercent = (crossCount / crossRow.totalPeriods * 100).toFixed(1);
  const diff = crossCount - baseCount;
  const diffStr = diff >= 0 ? `+${diff}` : `${diff}`;
  
  console.log(
    `命中${i}个`.padEnd(10) + 
    `${baseCount}期(${basePercent}%)`.padEnd(15) + 
    `${crossCount}期(${crossPercent}%)`.padEnd(15) + 
    `${diffStr}期`
  );
}

// 3. 联合覆盖分布对比
console.log('\n3. Top5+补漏6联合覆盖分布对比:');
console.log('覆盖数'.padEnd(10) + '基线'.padEnd(15) + '跨行尾号'.padEnd(15) + '变化');
console.log('-'.repeat(55));

for (let i = 0; i <= 5; i++) {
  const key = `cover${i}`;
  const baseCount = baseline.combinedDistribution[key];
  const crossCount = crossRow.combinedDistribution[key];
  const basePercent = (baseCount / baseline.totalPeriods * 100).toFixed(1);
  const crossPercent = (crossCount / crossRow.totalPeriods * 100).toFixed(1);
  const diff = crossCount - baseCount;
  const diffStr = diff >= 0 ? `+${diff}` : `${diff}`;
  
  console.log(
    `覆盖${i}个`.padEnd(10) + 
    `${baseCount}期(${basePercent}%)`.padEnd(15) + 
    `${crossCount}期(${crossPercent}%)`.padEnd(15) + 
    `${diffStr}期`
  );
}

// 4. 关键发现
console.log('\n4. 关键发现:');

// 检查是否有命中4个、5个的情况
const hasHit4 = crossRow.top5HitDistribution.hit4 > 0;
const hasHit5 = crossRow.top5HitDistribution.hit5 > 0;
const hasCover4 = crossRow.combinedDistribution.cover4 > 0;
const hasCover5 = crossRow.combinedDistribution.cover5 > 0;

console.log(`- Top5命中4个或5个: ${hasHit4 || hasHit5 ? '有' : '无'}`);
console.log(`- 联合覆盖4个或5个: ${hasCover4 || hasCover5 ? '有' : '无'}`);

// 检查提升情况
const improvements = [];
const declines = [];

if (crossRow.top5HitRate > baseline.top5HitRate) {
  improvements.push(`Top5命中率提升${(crossRow.top5HitRate - baseline.top5HitRate).toFixed(1)}%`);
} else if (crossRow.top5HitRate < baseline.top5HitRate) {
  declines.push(`Top5命中率下降${(baseline.top5HitRate - crossRow.top5HitRate).toFixed(1)}%`);
}

if (crossRow.combinedCoverageRate > baseline.combinedCoverageRate) {
  improvements.push(`联合覆盖率提升${(crossRow.combinedCoverageRate - baseline.combinedCoverageRate).toFixed(1)}%`);
} else if (crossRow.combinedCoverageRate < baseline.combinedCoverageRate) {
  declines.push(`联合覆盖率下降${(baseline.combinedCoverageRate - crossRow.combinedCoverageRate).toFixed(1)}%`);
}

if (crossRow.poolCoverageRate > baseline.poolCoverageRate) {
  improvements.push(`候选池覆盖率提升${(crossRow.poolCoverageRate - baseline.poolCoverageRate).toFixed(1)}%`);
} else if (crossRow.poolCoverageRate < baseline.poolCoverageRate) {
  declines.push(`候选池覆盖率下降${(baseline.poolCoverageRate - crossRow.poolCoverageRate).toFixed(1)}%`);
}

if (improvements.length > 0) {
  console.log('- 提升项:');
  improvements.forEach(item => console.log(`  * ${item}`));
}

if (declines.length > 0) {
  console.log('- 下降项:');
  declines.forEach(item => console.log(`  * ${item}`));
}

// 5. 总结
console.log('\n5. 总结:');
if (improvements.length > 0 && declines.length === 0) {
  console.log('跨行尾号+组内规则改进全面优于基线。');
} else if (improvements.length === 0 && declines.length > 0) {
  console.log('跨行尾号+组内规则改进未能超越基线，反而略有下降。');
} else if (improvements.length > 0 && declines.length > 0) {
  console.log('跨行尾号+组内规则改进有提升也有下降，整体效果不明显。');
} else {
  console.log('跨行尾号+组内规则改进与基线持平。');
}

// 保存对比结果
const comparisonResult = {
  baseline,
  crossRow,
  improvements,
  declines,
  summary: {
    top5HitImproved: crossRow.top5HitRate > baseline.top5HitRate,
    combinedCoverageImproved: crossRow.combinedCoverageRate > baseline.combinedCoverageRate,
    poolCoverageImproved: crossRow.poolCoverageRate > baseline.poolCoverageRate
  }
};

fs.writeFileSync(path.join(__dirname, 'comparison_analysis.json'), JSON.stringify(comparisonResult, null, 2), 'utf8');
console.log('\n对比分析结果已保存到 comparison_analysis.json');