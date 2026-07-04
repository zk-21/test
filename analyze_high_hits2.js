const fs = require('fs');
const path = require('path');

// 读取CSV文件
const csvPath = path.join(__dirname, 'per_period_detail.csv');
const csvContent = fs.readFileSync(csvPath, 'utf8');
const lines = csvContent.split('\n').filter(line => line.trim());

// 跳过标题行
const dataLines = lines.slice(1);

console.log(`共 ${dataLines.length} 期数据`);

// 解析数据
const periods = dataLines.map(line => {
  const parts = line.split(',');
  return {
    period: parseInt(parts[0]),
    target: parts[1],
    top1: parseInt(parts[2]),
    top2: parseInt(parts[3]),
    top3: parseInt(parts[4]),
    top4: parseInt(parts[5]),
    top5: parseInt(parts[6]),
    bulou: parseInt(parts[7]),
    top5Union: parseInt(parts[8]),
    top5BulouUnion: parseInt(parts[9]),
    poolCover: parseInt(parts[10])
  };
});

// 分析Top5命中情况
console.log('\n=== Top5命中分析 ===');
const top5HitCounts = [0, 0, 0, 0, 0, 0]; // 0,1,2,3,4,5
periods.forEach(p => {
  const maxTop5 = Math.max(p.top1, p.top2, p.top3, p.top4, p.top5);
  if (maxTop5 >= 0 && maxTop5 <= 5) {
    top5HitCounts[maxTop5]++;
  }
});

console.log('Top5最高命中分布:');
top5HitCounts.forEach((count, i) => {
  console.log(`  命中${i}个: ${count}期 (${(count/periods.length*100).toFixed(1)}%)`);
});

// 分析补漏6命中情况
console.log('\n=== 补漏6命中分析 ===');
const backup6HitCounts = [0, 0, 0, 0, 0, 0, 0]; // 0,1,2,3,4,5,6
periods.forEach(p => {
  if (p.bulou >= 0 && p.bulou <= 6) {
    backup6HitCounts[p.bulou]++;
  }
});

console.log('补漏6命中分布:');
backup6HitCounts.forEach((count, i) => {
  console.log(`  命中${i}个: ${count}期 (${(count/periods.length*100).toFixed(1)}%)`);
});

// 分析联合覆盖情况
console.log('\n=== 联合覆盖分析 ===');
const combinedHitCounts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // 0-10
periods.forEach(p => {
  if (p.top5BulouUnion >= 0 && p.top5BulouUnion <= 10) {
    combinedHitCounts[p.top5BulouUnion]++;
  }
});

console.log('Top5+补漏6联合覆盖分布:');
combinedHitCounts.forEach((count, i) => {
  if (count > 0) {
    console.log(`  命中${i}个: ${count}期 (${(count/periods.length*100).toFixed(1)}%)`);
  }
});

// 找出命中4个、5个的期数
console.log('\n=== 高命中期数详情 ===');
const highHitPeriods = periods.filter(p => {
  const maxTop5 = Math.max(p.top1, p.top2, p.top3, p.top4, p.top5);
  return maxTop5 >= 4 || p.bulou >= 4 || p.top5BulouUnion >= 4;
});

if (highHitPeriods.length > 0) {
  console.log('命中4个或5个的期数:');
  highHitPeriods.forEach(p => {
    const maxTop5 = Math.max(p.top1, p.top2, p.top3, p.top4, p.top5);
    console.log(`  第${p.period}期: Top5最高命中${maxTop5}个, 补漏6命中${p.bulou}个, 联合覆盖${p.top5BulouUnion}个`);
    console.log(`    目标号码: ${p.target}`);
  });
} else {
  console.log('没有命中4个或5个的期数');
}

// 统计联合覆盖>=4的期数
console.log('\n=== 联合覆盖>=4的期数 ===');
const highUnionPeriods = periods.filter(p => p.top5BulouUnion >= 4);
console.log(`联合覆盖>=4的期数: ${highUnionPeriods.length}期 (${(highUnionPeriods.length/periods.length*100).toFixed(1)}%)`);

if (highUnionPeriods.length > 0) {
  console.log('详细列表:');
  highUnionPeriods.forEach(p => {
    const maxTop5 = Math.max(p.top1, p.top2, p.top3, p.top4, p.top5);
    console.log(`  第${p.period}期: 联合覆盖${p.top5BulouUnion}个, Top5最高命中${maxTop5}个, 补漏6命中${p.bulou}个`);
  });
}

// 计算平均命中率
console.log('\n=== 平均命中率 ===');
let totalTop5Hits = 0;
let totalBackup6Hits = 0;
let totalCombinedHits = 0;

periods.forEach(p => {
  const maxTop5 = Math.max(p.top1, p.top2, p.top3, p.top4, p.top5);
  totalTop5Hits += maxTop5;
  totalBackup6Hits += p.bulou;
  totalCombinedHits += p.top5BulouUnion;
});

console.log(`平均Top5最高命中: ${(totalTop5Hits/periods.length).toFixed(2)}个`);
console.log(`平均补漏6命中: ${(totalBackup6Hits/periods.length).toFixed(2)}个`);
console.log(`平均联合覆盖: ${(totalCombinedHits/periods.length).toFixed(2)}个`);

// 保存分析结果
const analysisResult = {
  totalPeriods: periods.length,
  top5HitDistribution: top5HitCounts,
  backup6HitDistribution: backup6HitCounts,
  combinedHitDistribution: combinedHitCounts,
  highHitPeriods: highHitPeriods.length,
  highUnionPeriods: highUnionPeriods.length,
  averages: {
    top5: (totalTop5Hits/periods.length).toFixed(2),
    backup6: (totalBackup6Hits/periods.length).toFixed(2),
    combined: (totalCombinedHits/periods.length).toFixed(2)
  }
};

fs.writeFileSync(path.join(__dirname, 'high_hits_analysis.json'), JSON.stringify(analysisResult, null, 2), 'utf8');
console.log('\n分析结果已保存到 high_hits_analysis.json');