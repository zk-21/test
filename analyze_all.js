const fs = require('fs');

const files = [
  { name: '覆盖优先(原版)', csv: 'per_period_detail.csv' },
  { name: '多段连续(纯)', csv: 'per_period_detail_ms.csv' },
  { name: '混合(2多段+3覆盖)', csv: 'per_period_detail_hybrid23.csv' },
  { name: '混合(3多段+2覆盖)', csv: 'per_period_detail_hybrid32.csv' },
  { name: '多模式组合', csv: 'per_period_detail_multimode.csv' },
];

// 先保存当前的hybrid32和multimode结果
const currentCSV = 'per_period_detail.csv';
if (fs.existsSync(currentCSV)) {
  // 当前是multimode的结果（最后运行的）
  fs.copyFileSync(currentCSV, 'per_period_detail_multimode.csv');
}

console.log('═'.repeat(100));
console.log('所有策略回测结果对比');
console.log('═'.repeat(100));

const results = [];

for (const f of files) {
  if (!fs.existsSync(f.csv)) {
    console.log(`${f.name}: 文件不存在 (${f.csv})`);
    continue;
  }
  
  const lines = fs.readFileSync(f.csv, 'utf8').trim().split('\n').slice(1);
  let sumTop1=0,sumTop2=0,sumTop3=0,sumTop4=0,sumTop5=0,sumBl6=0;
  let sumTop5Union=0,sumUnion=0,sumPool=0;
  let cnt=0;
  let bestDist={};
  
  lines.forEach(line => {
    const parts = line.split(',');
    if(parts.length < 11) return;
    cnt++;
    const t1=+parts[2],t2=+parts[3],t3=+parts[4],t4=+parts[5],t5=+parts[6],bl6=+parts[7];
    const t5u=+parts[8],union=+parts[9],pool=+parts[10];
    
    sumTop1+=t1; sumTop2+=t2; sumTop3+=t3; sumTop4+=t4; sumTop5+=t5; sumBl6+=bl6;
    sumTop5Union+=t5u; sumUnion+=union; sumPool+=pool;
    
    const maxT = Math.max(t1,t2,t3,t4,t5);
    bestDist[maxT]=(bestDist[maxT]||0)+1;
  });
  
  if (cnt === 0) continue;
  
  const top5Total = sumTop1+sumTop2+sumTop3+sumTop4+sumTop5;
  const top5Avg = top5Total / cnt;
  const bl6Avg = sumBl6 / cnt;
  const totalAvg = (top5Total + sumBl6) / cnt;
  const top5UnionRate = sumTop5Union / (cnt * 5) * 100;
  const unionRate = sumUnion / (cnt * 5) * 100;
  const poolRate = sumPool / (cnt * 5) * 100;
  const top5HitRate = top5Total / (cnt * 5) * 100;
  const zeroCount = bestDist[0] || 0;
  
  results.push({
    name: f.name,
    top5Avg: top5Avg.toFixed(2),
    bl6Avg: bl6Avg.toFixed(2),
    totalAvg: totalAvg.toFixed(2),
    top5UnionRate: top5UnionRate.toFixed(1),
    unionRate: unionRate.toFixed(1),
    poolRate: poolRate.toFixed(1),
    top5HitRate: top5HitRate.toFixed(1),
    zeroCount,
    cnt
  });
}

// 打印对比表
console.log('');
console.log('策略'.padEnd(22) + '| Top5命中 | 补漏6 | 合计  | Top5联合 | 联合覆盖 | 池覆盖 | 命中率  | 命中0');
console.log('─'.repeat(100));

for (const r of results) {
  console.log(
    `${r.name.padEnd(20)} | ${r.top5Avg.padStart(6)} | ${r.bl6Avg.padStart(5)} | ${r.totalAvg.padStart(5)} | ${r.top5UnionRate.padStart(6)}% | ${r.unionRate.padStart(6)}% | ${r.poolRate.padStart(5)}% | ${r.top5HitRate.padStart(5)}% | ${r.zeroCount}`
  );
}

// 找出各指标最优
console.log('');
console.log('各指标最优策略:');
const bestHit = results.reduce((a, b) => +a.top5Avg > +b.top5Avg ? a : b);
const bestUnion = results.reduce((a, b) => +a.unionRate > +b.unionRate ? a : b);
const bestPool = results.reduce((a, b) => +a.poolRate > +b.poolRate ? a : b);
const bestTotal = results.reduce((a, b) => +a.totalAvg > +b.totalAvg ? a : b);

console.log(`  最高Top5命中: ${bestHit.name} (${bestHit.top5Avg}/注)`);
console.log(`  最高联合覆盖: ${bestUnion.name} (${bestUnion.unionRate}%)`);
console.log(`  最高池覆盖: ${bestPool.name} (${bestPool.poolRate}%)`);
console.log(`  最高总命中: ${bestTotal.name} (${bestTotal.totalAvg}/注)`);
