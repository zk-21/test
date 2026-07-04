const fs = require('fs');

// 读取per_period_detail.csv
const csv = fs.readFileSync('per_period_detail.csv', 'utf8').trim().split('\n');
const header = csv[0].split(',');
const rows = csv.slice(1).map(line => {
  // 解析CSV（注意目标号码有引号）
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

console.log('=== 重新验证：每期Top5/补漏6/候选池 覆盖率详情 ===\n');
console.log(`总期数: ${rows.length}\n`);

// ===== 1. 每期Top5每注命中个数 =====
console.log('═══════════════════════════════════════════════════════════════');
console.log('  1. 每期Top5每注命中个数');
console.log('═══════════════════════════════════════════════════════════════\n');

// 逐期展示
console.log('期数  | T1 T2 T3 T4 T5 | Top5总命中 | 命中≥3注');
console.log('──────┼────────────────┼────────────┼─────────');

let top5TotalHits = 0;
let top5HitDist = [0,0,0,0,0,0]; // 命中0,1,2,3,4,5注
let perComboHits = [0,0,0,0,0]; // Top1-5各自总命中
let periodsWithAtLeast3 = 0;

rows.forEach(r => {
  const hits = [r.top1, r.top2, r.top3, r.top4, r.top5];
  const total = hits.reduce((a,b) => a+b, 0);
  top5TotalHits += total;
  hits.forEach((h, i) => perComboHits[i] += h);
  
  // 统计命中3+的注数
  const hits3plus = hits.filter(h => h >= 3).length;
  if (total >= 3) periodsWithAtLeast3++;
  
  const hit3plusMark = hits3plus > 0 ? `  ★${hits3plus}注` : '';
  console.log(`  ${String(r.period).padStart(3)} | ${hits.map(h => h >= 3 ? `[${h}]` : ` ${h} `).join(' ')} |    ${String(total).padStart(2)}      |${hit3plusMark}`);
});

console.log('\n--- Top5各注汇总 ---');
perComboHits.forEach((h, i) => {
  console.log(`  Top${i+1}: 总命中${h}球, 平均${(h/rows.length).toFixed(2)}球/期, 命中率${(h/(rows.length*5)*100).toFixed(1)}%`);
});
console.log(`  Top5合计: 总命中${top5TotalHits}球, 平均${(top5TotalHits/rows.length).toFixed(2)}球/期, 命中率${(top5TotalHits/(rows.length*5)*100).toFixed(1)}%`);
console.log(`  命中≥3球期数: ${periodsWithAtLeast3}/${rows.length} (${(periodsWithAtLeast3/rows.length*100).toFixed(1)}%)`);

// ===== 2. 每期补漏6命中个数 =====
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  2. 每期补漏6命中个数');
console.log('═══════════════════════════════════════════════════════════════\n');

let bl6Total = 0;
let bl6Dist = [0,0,0,0,0,0]; // 命中0,1,2,3,4,5

rows.forEach(r => {
  bl6Total += r.bl6;
  bl6Dist[r.bl6]++;
});

console.log('补漏6命中分布:');
bl6Dist.forEach((c, i) => {
  console.log(`  命中${i}球: ${c}期 (${(c/rows.length*100).toFixed(1)}%)`);
});
console.log(`  补漏6总命中: ${bl6Total}球, 平均${(bl6Total/rows.length).toFixed(2)}球/期`);

// ===== 3. 每期Top5+补漏6组合覆盖目的号码个数 =====
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  3. 每期Top5/补漏6/联合 覆盖目的号码个数');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('期数  | 目标    | Top5联合覆盖 | T1-6联合覆盖 | 候选池覆盖 | Top5覆盖% | T1-6覆盖% | 池覆盖%');
console.log('──────┼─────────┼──────────────┼──────────────┼────────────┼───────────┼───────────┼────────');

let sumTop5 = 0, sumBl6 = 0, sumPool = 0;
let coverageDist = {}; // Top5覆盖率分布

rows.forEach(r => {
  const top5Pct = (r.top5Union / 5 * 100).toFixed(0);
  const bl6Pct = (r.top5Bl6Union / 5 * 100).toFixed(0);
  const poolPct = (r.poolCoverage / 5 * 100).toFixed(0);
  
  sumTop5 += r.top5Union;
  sumBl6 += r.top5Bl6Union;
  sumPool += r.poolCoverage;
  
  const key = r.top5Union;
  coverageDist[key] = (coverageDist[key] || 0) + 1;
  
  console.log(`  ${String(r.period).padStart(3)} | ${r.targets.join(',').padEnd(7)} |     ${String(r.top5Union).padStart(2)}       |     ${String(r.top5Bl6Union).padStart(2)}       |    ${String(r.poolCoverage).padStart(2)}      |   ${String(top5Pct).padStart(3)}%   |   ${String(bl6Pct).padStart(3)}%   |  ${String(poolPct).padStart(3)}%`);
});

console.log('\n--- 汇总 ---');
console.log(`  Top5联合覆盖: ${sumTop5}/${rows.length*5} (${(sumTop5/(rows.length*5)*100).toFixed(1)}%)`);
console.log(`  T1-6联合覆盖: ${sumBl6}/${rows.length*5} (${(sumBl6/(rows.length*5)*100).toFixed(1)}%)`);
console.log(`  候选池覆盖:   ${sumPool}/${rows.length*5} (${(sumPool/(rows.length*5)*100).toFixed(1)}%)`);

console.log('\n--- Top5联合覆盖分布 ---');
[5,4,3,2,1,0].forEach(n => {
  const c = coverageDist[n] || 0;
  console.log(`  覆盖${n}球: ${c}期 (${(c/rows.length*100).toFixed(1)}%)`);
});

// ===== 4. 对比基线 =====
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  4. 策略对比：当前"取中端不取最高分段" vs 历史基线');
console.log('═══════════════════════════════════════════════════════════════\n');

// 计算命中3+、4+指标
let hit3plus = 0, hit4plus = 0;
let totalTargetBalls = 0;
rows.forEach(r => {
  const total = r.top1 + r.top2 + r.top3 + r.top4 + r.top5;
  if (total >= 3) hit3plus++;
  if (total >= 4) hit4plus++;
  totalTargetBalls += 5;
});

console.log('指标                    | 当前策略("取中端") | 历史基线(168期)');
console.log('────────────────────────┼───────────────────┼────────────────');
console.log(`总期数                  |       ${String(rows.length).padStart(3)}        |      168`);
console.log(`Top5联合覆盖率          |   ${(sumTop5/totalTargetBalls*100).toFixed(1)}%         |    65.7%`);
console.log(`T1-6联合覆盖率          |   ${(sumBl6/totalTargetBalls*100).toFixed(1)}%         |    87.9%`);
console.log(`候选池覆盖率            |   ${(sumPool/totalTargetBalls*100).toFixed(1)}%         |    87.9%`);
console.log(`命中3+期数              |    ${String(hit3plus).padStart(3)}/${String(rows.length).padStart(3)}(${(hit3plus/rows.length*100).toFixed(1)}%)  |   14/168(8.3%)`);
console.log(`命中4+期数              |    ${String(hit4plus).padStart(3)}/${String(rows.length).padStart(3)}(${(hit4plus/rows.length*100).toFixed(1)}%)  |    0/168(0.0%)`);
console.log(`平均命中球数            |     ${(top5TotalHits/rows.length).toFixed(2)}        |     3.61`);
console.log(`补漏6平均命中           |     ${(bl6Total/rows.length).toFixed(2)}        |     ~1.04`);

console.log('\n✅ 验证完成');
