const fs = require('fs');
const path = require('path');

// 读取UTF-16 LE编码的文件
const filePath = path.join(__dirname, 'backtest_cross_row_full.txt');
const buf = fs.readFileSync(filePath);
const content = buf.toString('utf16le');

// 解析每期数据
const lines = content.split('\n');
let currentPeriod = null;
let periodData = {};

// 存储所有期数据
const allPeriods = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  
  // 匹配期号
  const periodMatch = line.match(/期\s*(\d+)/);
  if (periodMatch) {
    if (currentPeriod && periodData.period) {
      allPeriods.push({...periodData});
    }
    currentPeriod = periodMatch[1];
    periodData = {
      period: currentPeriod,
      top5Hits: [],
      backup6Hits: [],
      combinedHits: 0,
      poolHits: 0,
      totalTarget: 0
    };
  }
  
  // 匹配Top5命中
  const top5Match = line.match(/Top5.*?(\d+)/);
  if (top5Match && line.includes('命中')) {
    periodData.top5Hits.push(parseInt(top5Match[1]));
  }
  
  // 匹配补漏6命中
  const backup6Match = line.match(/补漏6.*?(\d+)/);
  if (backup6Match && line.includes('命中')) {
    periodData.backup6Hits.push(parseInt(backup6Match[1]));
  }
  
  // 匹配联合覆盖
  const combinedMatch = line.match(/联合覆盖.*?(\d+)/);
  if (combinedMatch) {
    periodData.combinedHits = parseInt(combinedMatch[1]);
  }
  
  // 匹配候选池覆盖
  const poolMatch = line.match(/候选池.*?(\d+)/);
  if (poolMatch) {
    periodData.poolHits = parseInt(poolMatch[1]);
  }
  
  // 匹配目标号码总数
  const targetMatch = line.match(/目标号码.*?(\d+)/);
  if (targetMatch) {
    periodData.totalTarget = parseInt(targetMatch[1]);
  }
}

// 添加最后一期
if (currentPeriod && periodData.period) {
  allPeriods.push({...periodData});
}

console.log(`解析完成，共 ${allPeriods.length} 期数据`);

// 分析Top5命中情况
console.log('\n=== Top5命中分析 ===');
const top5HitCounts = [0, 0, 0, 0, 0, 0]; // 0,1,2,3,4,5
allPeriods.forEach(p => {
  if (p.top5Hits.length > 0) {
    const maxHit = Math.max(...p.top5Hits);
    if (maxHit >= 0 && maxHit <= 5) {
      top5HitCounts[maxHit]++;
    }
  }
});

console.log('Top5最高命中分布:');
top5HitCounts.forEach((count, i) => {
  console.log(`  命中${i}个: ${count}期 (${(count/allPeriods.length*100).toFixed(1)}%)`);
});

// 分析补漏6命中情况
console.log('\n=== 补漏6命中分析 ===');
const backup6HitCounts = [0, 0, 0, 0, 0, 0, 0]; // 0,1,2,3,4,5,6
allPeriods.forEach(p => {
  if (p.backup6Hits.length > 0) {
    const maxHit = Math.max(...p.backup6Hits);
    if (maxHit >= 0 && maxHit <= 6) {
      backup6HitCounts[maxHit]++;
    }
  }
});

console.log('补漏6最高命中分布:');
backup6HitCounts.forEach((count, i) => {
  console.log(`  命中${i}个: ${count}期 (${(count/allPeriods.length*100).toFixed(1)}%)`);
});

// 分析联合覆盖情况
console.log('\n=== 联合覆盖分析 ===');
const combinedHitCounts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // 0-10
allPeriods.forEach(p => {
  if (p.combinedHits >= 0 && p.combinedHits <= 10) {
    combinedHitCounts[p.combinedHits]++;
  }
});

console.log('联合覆盖命中分布:');
combinedHitCounts.forEach((count, i) => {
  if (count > 0) {
    console.log(`  命中${i}个: ${count}期 (${(count/allPeriods.length*100).toFixed(1)}%)`);
  }
});

// 分析候选池覆盖情况
console.log('\n=== 候选池覆盖分析 ===');
const poolHitCounts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // 0-15
allPeriods.forEach(p => {
  if (p.poolHits >= 0 && p.poolHits <= 15) {
    poolHitCounts[p.poolHits]++;
  }
});

console.log('候选池覆盖命中分布:');
poolHitCounts.forEach((count, i) => {
  if (count > 0) {
    console.log(`  命中${i}个: ${count}期 (${(count/allPeriods.length*100).toFixed(1)}%)`);
  }
});

// 找出命中4个、5个的期数
console.log('\n=== 高命中期数详情 ===');
const highHitPeriods = allPeriods.filter(p => {
  const maxTop5 = Math.max(...(p.top5Hits || [0]));
  const maxBackup6 = Math.max(...(p.backup6Hits || [0]));
  return maxTop5 >= 4 || maxBackup6 >= 4;
});

if (highHitPeriods.length > 0) {
  console.log('命中4个或5个的期数:');
  highHitPeriods.forEach(p => {
    const maxTop5 = Math.max(...(p.top5Hits || [0]));
    const maxBackup6 = Math.max(...(p.backup6Hits || [0]));
    console.log(`  第${p.period}期: Top5最高命中${maxTop5}个, 补漏6最高命中${maxBackup6}个`);
  });
} else {
  console.log('没有命中4个或5个的期数');
}

// 计算平均命中率
console.log('\n=== 平均命中率 ===');
let totalTop5Hits = 0;
let totalBackup6Hits = 0;
let totalCombinedHits = 0;
let totalPoolHits = 0;
let totalTarget = 0;

allPeriods.forEach(p => {
  if (p.top5Hits.length > 0) {
    totalTop5Hits += Math.max(...p.top5Hits);
  }
  if (p.backup6Hits.length > 0) {
    totalBackup6Hits += Math.max(...p.backup6Hits);
  }
  totalCombinedHits += p.combinedHits;
  totalPoolHits += p.poolHits;
  totalTarget += p.totalTarget;
});

console.log(`平均Top5最高命中: ${(totalTop5Hits/allPeriods.length).toFixed(2)}个`);
console.log(`平均补漏6最高命中: ${(totalBackup6Hits/allPeriods.length).toFixed(2)}个`);
console.log(`平均联合覆盖: ${(totalCombinedHits/allPeriods.length).toFixed(2)}个`);
console.log(`平均候选池覆盖: ${(totalPoolHits/allPeriods.length).toFixed(2)}个`);
console.log(`平均目标号码数: ${(totalTarget/allPeriods.length).toFixed(2)}个`);

// 保存详细数据到CSV
const csvHeader = '期号,Top5最高命中,补漏6最高命中,联合覆盖,候选池覆盖,目标号码数\n';
const csvRows = allPeriods.map(p => {
  const maxTop5 = p.top5Hits.length > 0 ? Math.max(...p.top5Hits) : 0;
  const maxBackup6 = p.backup6Hits.length > 0 ? Math.max(...p.backup6Hits) : 0;
  return `${p.period},${maxTop5},${maxBackup6},${p.combinedHits},${p.poolHits},${p.totalTarget}`;
}).join('\n');

const csvContent = csvHeader + csvRows;
fs.writeFileSync(path.join(__dirname, 'high_hits_analysis.csv'), csvContent, 'utf8');
console.log('\n详细数据已保存到 high_hits_analysis.csv');
