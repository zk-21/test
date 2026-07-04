const fs = require('fs');

const files = [
  { name: '覆盖优先(原版)', csv: 'per_period_detail.csv' },
  { name: '混合(3多段+2覆盖)', csv: 'per_period_detail_hybrid32.csv' },
  { name: '多模式组合', csv: 'per_period_detail_multimode.csv' },
];

console.log('策略 | Top5命中/注 | 补漏6 | 合计 | Top5联合覆盖 | 联合覆盖率 | 池覆盖率 | 命中率 | 命中0次数');
console.log('─'.repeat(100));

for (const f of files) {
  if (!fs.existsSync(f.csv)) { console.log(f.name + ': 文件不存在'); continue; }
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
    bestDist[maxT] = (bestDist[maxT] || 0) + 1;
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
  
  console.log(
    f.name.padEnd(20) + ' | ' +
    top5Avg.toFixed(2).padStart(5) + ' | ' +
    bl6Avg.toFixed(2).padStart(5) + ' | ' +
    totalAvg.toFixed(2).padStart(5) + ' | ' +
    top5UnionRate.toFixed(1).padStart(5) + '% | ' +
    unionRate.toFixed(1).padStart(5) + '% | ' +
    poolRate.toFixed(1).padStart(5) + '% | ' +
    top5HitRate.toFixed(1).padStart(5) + '% | ' +
    zeroCount
  );
  
  // 分布
  console.log('  命中分布: ' + JSON.stringify(bestDist));
}
