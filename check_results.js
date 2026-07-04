const fs = require('fs');
const lines = fs.readFileSync('per_period_detail.csv', 'utf8').trim().split('\n');
let totalTop5Hits = 0, totalPeriods = 0;
let totalTop5Coverage = 0, totalCombinedCoverage = 0, totalPoolCoverage = 0;
let top5HitCount = 0;

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(',');
  if (cols.length < 8) continue;
  totalPeriods++;
  const top5Hit = (parseInt(cols[2]) || 0) + (parseInt(cols[3]) || 0) + (parseInt(cols[4]) || 0) + (parseInt(cols[5]) || 0) + (parseInt(cols[6]) || 0);
  totalTop5Hits += top5Hit;
  if (top5Hit > 0) top5HitCount++;
  totalTop5Coverage += parseFloat(cols[8]) || 0;
  totalCombinedCoverage += parseFloat(cols[9]) || 0;
  totalPoolCoverage += parseFloat(cols[10]) || 0;
}

console.log('=== 回测结果汇总 ===');
console.log('总期数:', totalPeriods);
console.log('Top5总命中球数:', totalTop5Hits);
console.log('Top5平均命中率:', (totalTop5Hits / totalPeriods / 5 * 100).toFixed(1) + '%');
console.log('Top5命中>0期数:', top5HitCount, '(' + (top5HitCount / totalPeriods * 100).toFixed(1) + '%)');
console.log('Top5联合覆盖平均:', (totalTop5Coverage / totalPeriods).toFixed(2) + '球');
console.log('Top5+补漏6联合覆盖平均:', (totalCombinedCoverage / totalPeriods).toFixed(2) + '球');
console.log('候选池覆盖平均:', (totalPoolCoverage / totalPeriods).toFixed(2) + '球');
