// 运行所有回测并保存结果
const fs = require('fs');
const { execSync } = require('child_process');

const scripts = [
  { name: '覆盖优先(原版)', file: 'script回测.js', csv: 'per_period_detail_original.csv' },
  { name: '多段连续(纯)', file: 'script回测_multisegment.js', csv: 'per_period_detail_ms.csv' },
  { name: '混合(2多段+3覆盖)', file: 'script回测_hybrid.js', csv: 'per_period_detail_hybrid23.csv' },
  { name: '混合(3多段+2覆盖)', file: 'script回测_hybrid3.js', csv: 'per_period_detail_hybrid32.csv' },
  { name: '多模式组合', file: 'script回测_multimode.js', csv: 'per_period_detail_multimode.csv' },
];

console.log('开始运行所有回测...\n');

for (const s of scripts) {
  console.log(`正在运行: ${s.name} (${s.file})`);
  try {
    // 运行回测（会覆盖per_period_detail.csv）
    execSync(`node "${s.file}"`, { cwd: __dirname, stdio: 'pipe' });
    
    // 复制CSV到指定文件名
    if (fs.existsSync('per_period_detail.csv')) {
      fs.copyFileSync('per_period_detail.csv', s.csv);
      console.log(`  完成，结果保存到: ${s.csv}`);
    }
  } catch (err) {
    console.error(`  错误: ${err.message}`);
  }
  console.log('');
}

// 分析所有结果
console.log('='.repeat(90));
console.log('所有回测结果对比');
console.log('='.repeat(90));

const results = [];

for (const s of scripts) {
  if (!fs.existsSync(s.csv)) {
    console.log(`${s.name}: 文件不存在`);
    continue;
  }
  
  const lines = fs.readFileSync(s.csv, 'utf8').trim().split('\n').slice(1);
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
    name: s.name,
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
console.log('策略 | Top5命中/注 | 补漏6 | 合计 | Top5联合覆盖 | 联合覆盖率 | 池覆盖率 | 命中率 | 命中0次数');
console.log('─'.repeat(100));

for (const r of results) {
  console.log(`${r.name.padEnd(20)} | ${r.top5Avg.padStart(5)} | ${r.bl6Avg.padStart(5)} | ${r.totalAvg.padStart(5)} | ${r.top5UnionRate.padStart(5)}% | ${r.unionRate.padStart(5)}% | ${r.poolRate.padStart(5)}% | ${r.top5HitRate.padStart(5)}% | ${r.zeroCount}`);
}

// 找出最优策略
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
