// 从回测结果中提取每期详细数据
const fs = require('fs');

const content = fs.readFileSync('backtest_result.txt', 'utf8');
const lines = content.split('\n');

const results = [];
let currentPeriod = null;
let periodData = {};

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  
  // 匹配期号行: "第 X 期验证  源期: XXXXX → 目标期: XXXXX"
  const periodMatch = line.match(/^第\s*(\d+)\s*期验证\s+源期:\s*\d+\s*→\s*目标期:\s*(\d+)/);
  if (periodMatch) {
    if (currentPeriod && periodData.targetNums) {
      results.push({ period: currentPeriod, ...periodData });
    }
    currentPeriod = periodMatch[1];
    periodData = { targetPeriod: periodMatch[2] };
    continue;
  }
  
  // 匹配目的号码
  if (line.includes('目的号码(下期开奖):')) {
    const match = line.match(/目的号码\(下期开奖\):\s*\[([^\]]+)\]/);
    if (match) periodData.targetNums = match[1].trim();
  }
  
  // 匹配Top5每注命中
  const topMatch = line.match(/Top(\d+):\s*\[([^\]]+)\]\s*→\s*命中\s*(\d+)/);
  if (topMatch) {
    const topNum = parseInt(topMatch[1]);
    const hitCount = parseInt(topMatch[3]);
    if (topNum === 1) periodData.top1Hit = hitCount;
    if (topNum === 2) periodData.top2Hit = hitCount;
    if (topNum === 3) periodData.top3Hit = hitCount;
    if (topNum === 4) periodData.top4Hit = hitCount;
    if (topNum === 5) periodData.top5Hit = hitCount;
  }
  
  // 匹配补漏6命中
  const suppMatch = line.match(/补漏6:\s*\[([^\]]+)\]\s*→\s*命中\s*(\d+)/);
  if (suppMatch) {
    periodData.supplement6Hit = parseInt(suppMatch[2]);
  }
  
  // 匹配Top5联合覆盖
  if (line.includes('Top5 联合覆盖:')) {
    const match = line.match(/Top5 联合覆盖:\s*(\d+)\s*\/\s*5/);
    if (match) periodData.top5Coverage = parseInt(match[1]);
  }
  
  // 匹配Top5+补漏6联合覆盖
  if (line.includes('Top5+补漏6 联合覆盖:')) {
    const match = line.match(/Top5\+补漏6 联合覆盖:\s*(\d+)\s*\/\s*5/);
    if (match) periodData.top5PlusSupp6Coverage = parseInt(match[1]);
  }
  
  // 匹配候选池覆盖
  if (line.includes('覆盖:') && line.includes('/ 5')) {
    const match = line.match(/覆盖:\s*(\d+)\s*\/\s*5/);
    if (match && !periodData.poolCoverage) {
      periodData.poolCoverage = parseInt(match[1]);
    }
  }
}

// 添加最后一期
if (currentPeriod && periodData.targetNums) {
  results.push({ period: currentPeriod, ...periodData });
}

// 生成报告
console.log('期号 | 目标号码       | Top1 | Top2 | Top3 | Top4 | Top5 | 补漏6 | Top5覆盖 | 联合覆盖 | 池覆盖');
console.log('-----|---------------|------|------|------|------|------|-------|----------|----------|-------');

let totalTop1 = 0, totalTop2 = 0, totalTop3 = 0, totalTop4 = 0, totalTop5 = 0;
let totalSupp6 = 0, totalTop5Coverage = 0, totalTop5Supp6Coverage = 0, totalPoolCoverage = 0;
let count = 0;

results.forEach(r => {
  const top1 = r.top1Hit || 0;
  const top2 = r.top2Hit || 0;
  const top3 = r.top3Hit || 0;
  const top4 = r.top4Hit || 0;
  const top5 = r.top5Hit || 0;
  const supp6 = r.supplement6Hit || 0;
  const top5Coverage = r.top5Coverage || 0;
  const top5Supp6Coverage = r.top5PlusSupp6Coverage || 0;
  const poolCoverage = r.poolCoverage || 0;
  
  totalTop1 += top1;
  totalTop2 += top2;
  totalTop3 += top3;
  totalTop4 += top4;
  totalTop5 += top5;
  totalSupp6 += supp6;
  totalTop5Coverage += top5Coverage;
  totalTop5Supp6Coverage += top5Supp6Coverage;
  totalPoolCoverage += poolCoverage;
  count++;
  
  const targetDisplay = (r.targetNums || '').substring(0, 15).padEnd(15);
  console.log(`${r.period.padEnd(6)}| ${targetDisplay}| ${top1.toString().padEnd(5)}| ${top2.toString().padEnd(5)}| ${top3.toString().padEnd(5)}| ${top4.toString().padEnd(5)}| ${top5.toString().padEnd(5)}| ${supp6.toString().padEnd(7)}| ${top5Coverage.toString().padEnd(10)}| ${top5Supp6Coverage.toString().padEnd(10)}| ${poolCoverage}`);
});

console.log('-----|---------------|------|------|------|------|------|-------|----------|----------|-------');
if (count > 0) {
  console.log(`平均 |               | ${(totalTop1/count).toFixed(2).padEnd(5)}| ${(totalTop2/count).toFixed(2).padEnd(5)}| ${(totalTop3/count).toFixed(2).padEnd(5)}| ${(totalTop4/count).toFixed(2).padEnd(5)}| ${(totalTop5/count).toFixed(2).padEnd(5)}| ${(totalSupp6/count).toFixed(2).padEnd(7)}| ${(totalTop5Coverage/count).toFixed(2).padEnd(10)}| ${(totalTop5Supp6Coverage/count).toFixed(2).padEnd(10)}| ${(totalPoolCoverage/count).toFixed(2)}`);
  console.log(`命中率|             | ${(totalTop1/count/5*100).toFixed(1)}%| ${(totalTop2/count/5*100).toFixed(1)}%| ${(totalTop3/count/5*100).toFixed(1)}%| ${(totalTop4/count/5*100).toFixed(1)}%| ${(totalTop5/count/5*100).toFixed(1)}%| ${(totalSupp6/count/5*100).toFixed(1)}%| ${(totalTop5Coverage/count/5*100).toFixed(1)}%| ${(totalTop5Supp6Coverage/count/5*100).toFixed(1)}%| ${(totalPoolCoverage/count/5*100).toFixed(1)}%`);
}

console.log(`\n总验证期数: ${count}`);
console.log(`\n汇总指标:`);
console.log(`  Top5最高命中率: ${(totalTop5/count/5*100).toFixed(1)}% (平均 ${(totalTop5/count).toFixed(2)}/5)`);
console.log(`  Top5联合覆盖率: ${(totalTop5Coverage/count/5*100).toFixed(1)}% (平均 ${(totalTop5Coverage/count).toFixed(2)}/5)`);
console.log(`  补漏6命中率: ${(totalSupp6/count/5*100).toFixed(1)}% (平均 ${(totalSupp6/count).toFixed(2)}/5)`);
console.log(`  Top5+补漏6联合覆盖率: ${(totalTop5Supp6Coverage/count/5*100).toFixed(1)}% (平均 ${(totalTop5Supp6Coverage/count).toFixed(2)}/5)`);
console.log(`  候选池覆盖率: ${(totalPoolCoverage/count/5*100).toFixed(1)}% (平均 ${(totalPoolCoverage/count).toFixed(2)}/5)`);
