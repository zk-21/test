const fs = require('fs');

// 读取CSV文件
const csv = fs.readFileSync('per_period_detail.csv', 'utf-8');
const lines = csv.trim().split('\n');
const header = lines[0].split(',');
const data = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  // 解析CSV行（处理带引号的目标号码）
  const match = line.match(/^(\d+),"([^"]+)",(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)$/);
  if (match) {
    data.push({
      period: parseInt(match[1]),
      targetNums: match[2].split(' ').map(Number),
      top5: [parseInt(match[3]), parseInt(match[4]), parseInt(match[5]), parseInt(match[6]), parseInt(match[7])],
      top6: [parseInt(match[8]), parseInt(match[9]), parseInt(match[10]), parseInt(match[11]), parseInt(match[12]), parseInt(match[13])],
      top5Union: parseInt(match[14]),
      top6Union: parseInt(match[15]),
      poolCoverage: parseInt(match[16])
    });
  }
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('双模式预测回测详细验证');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`总期数: ${data.length}期\n`);

// 1. 每注命中个数统计
console.log('【指标1】每注命中个数分布');
console.log('───────────────────────────────────────────────────────────────');

// Top5每注命中分布
console.log('\nTop5 每注命中分布（等差①②③ + 多段多段①②③）:');
const top5HitDist = {};
for (let h = 0; h <= 5; h++) top5HitDist[h] = 0;
data.forEach(r => {
  r.top5.forEach(h => top5HitDist[h]++);
});
const totalTop5 = data.length * 5;
console.log(`  总注数: ${totalTop5}`);
for (let h = 5; h >= 0; h--) {
  const count = top5HitDist[h];
  const pct = (count / totalTop5 * 100).toFixed(1);
  console.log(`  命中${h}个: ${count}次 (${pct}%)`);
}

// Top6每注命中分布
console.log('\nTop6 每注命中分布（等差①②③ + 多段多段①②③）:');
const top6HitDist = {};
for (let h = 0; h <= 5; h++) top6HitDist[h] = 0;
data.forEach(r => {
  r.top6.forEach(h => top6HitDist[h]++);
});
const totalTop6 = data.length * 6;
console.log(`  总注数: ${totalTop6}`);
for (let h = 5; h >= 0; h--) {
  const count = top6HitDist[h];
  const pct = (count / totalTop6 * 100).toFixed(1);
  console.log(`  命中${h}个: ${count}次 (${pct}%)`);
}

// 每个位置的平均命中
console.log('\n每个位置平均命中:');
const top5Avg = [0, 0, 0, 0, 0];
const top6Avg = [0, 0, 0, 0, 0, 0];
data.forEach(r => {
  r.top5.forEach((h, i) => top5Avg[i] += h);
  r.top6.forEach((h, i) => top6Avg[i] += h);
});
console.log('  Top5: ' + top5Avg.map((s, i) => `位置${i+1}=${(s/data.length).toFixed(2)}`).join(', '));
console.log('  Top6: ' + top6Avg.map((s, i) => `位置${i+1}=${(s/data.length).toFixed(2)}`).join(', '));

// 2. 组合覆盖目标号码个数
console.log('\n\n【指标2】组合覆盖目标号码个数');
console.log('───────────────────────────────────────────────────────────────');

const top5UnionDist = {};
const top6UnionDist = {};
for (let c = 0; c <= 5; c++) {
  top5UnionDist[c] = 0;
  top6UnionDist[c] = 0;
}

data.forEach(r => {
  top5UnionDist[r.top5Union]++;
  top6UnionDist[r.top6Union]++;
});

console.log('\nTop5 联合覆盖分布（等差3组+多段3组取前5）:');
let sumTop5Union = 0;
for (let c = 5; c >= 0; c--) {
  const count = top5UnionDist[c];
  const pct = (count / data.length * 100).toFixed(1);
  console.log(`  覆盖${c}个: ${count}次 (${pct}%)`);
  sumTop5Union += c * count;
}
console.log(`  平均覆盖: ${(sumTop5Union / data.length).toFixed(2)} / 5 (${(sumTop5Union / data.length / 5 * 100).toFixed(1)}%)`);

console.log('\nTop6 联合覆盖分布（等差3组+多段3组全部6组）:');
let sumTop6Union = 0;
for (let c = 5; c >= 0; c--) {
  const count = top6UnionDist[c];
  const pct = (count / data.length * 100).toFixed(1);
  console.log(`  覆盖${c}个: ${count}次 (${pct}%)`);
  sumTop6Union += c * count;
}
console.log(`  平均覆盖: ${(sumTop6Union / data.length).toFixed(2)} / 5 (${(sumTop6Union / data.length / 5 * 100).toFixed(1)}%)`);

// 3. 候选池覆盖
console.log('\n\n【指标3】候选号码池覆盖目标号码个数');
console.log('───────────────────────────────────────────────────────────────');

const poolDist = {};
for (let c = 0; c <= 5; c++) poolDist[c] = 0;
data.forEach(r => {
  poolDist[r.poolCoverage]++;
});

let sumPool = 0;
console.log('\n候选池覆盖分布:');
for (let c = 5; c >= 0; c--) {
  const count = poolDist[c];
  const pct = (count / data.length * 100).toFixed(1);
  console.log(`  覆盖${c}个: ${count}次 (${pct}%)`);
  sumPool += c * count;
}
console.log(`  平均覆盖: ${(sumPool / data.length).toFixed(2)} / 5 (${(sumPool / data.length / 5 * 100).toFixed(1)}%)`);

// 4. 等差 vs 多段 对比
console.log('\n\n【指标4】等差模式 vs 多段模式 对比');
console.log('───────────────────────────────────────────────────────────────');

let arithTotal = 0, multiTotal = 0;
let arithCount = 0, multiCount = 0;
data.forEach(r => {
  // 等差①②③ = top6[0], top6[1], top6[2]
  // 多段多段①②③ = top6[3], top6[4], top6[5]
  arithTotal += r.top6[0] + r.top6[1] + r.top6[2];
  multiTotal += r.top6[3] + r.top6[4] + r.top6[5];
  arithCount += 3;
  multiCount += 3;
});

console.log(`  等差模式（3组）总命中: ${arithTotal} / ${arithCount} = ${(arithTotal / arithCount * 100).toFixed(1)}%`);
console.log(`  多段模式（3组）总命中: ${multiTotal} / ${multiCount} = ${(multiTotal / multiCount * 100).toFixed(1)}%`);
console.log(`  差异: ${((arithTotal / arithCount - multiTotal / multiCount) * 100).toFixed(1)}%`);

// 5. 最佳/最差期数
console.log('\n\n【指标5】最佳/最差期数');
console.log('───────────────────────────────────────────────────────────────');

const sortedByTop6 = [...data].sort((a, b) => b.top6Union - a.top6Union);
console.log('\nTop6联合覆盖最高期数:');
for (let i = 0; i < Math.min(5, sortedByTop6.length); i++) {
  const r = sortedByTop6[i];
  console.log(`  第${r.period}期: 目标${r.targetNums.join(' ')} | Top6覆盖=${r.top6Union}/5 | 候选池=${r.poolCoverage}/5`);
}

console.log('\nTop6联合覆盖最低期数:');
for (let i = sortedByTop6.length - 1; i >= Math.max(0, sortedByTop6.length - 5); i--) {
  const r = sortedByTop6[i];
  console.log(`  第${r.period}期: 目标${r.targetNums.join(' ')} | Top6覆盖=${r.top6Union}/5 | 候选池=${r.poolCoverage}/5`);
}

// 6. 汇总
console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log('汇总统计');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  总验证期数: ${data.length}`);
console.log(`  平均Top5联合覆盖: ${(sumTop5Union / data.length).toFixed(2)} / 5 (${(sumTop5Union / data.length / 5 * 100).toFixed(1)}%)`);
console.log(`  平均Top6联合覆盖: ${(sumTop6Union / data.length).toFixed(2)} / 5 (${(sumTop6Union / data.length / 5 * 100).toFixed(1)}%)`);
console.log(`  平均候选池覆盖: ${(sumPool / data.length).toFixed(2)} / 5 (${(sumPool / data.length / 5 * 100).toFixed(1)}%)`);
console.log(`  Top6 vs Top5提升: ${((sumTop6Union - sumTop5Union) / data.length).toFixed(2)} / 5 (+${((sumTop6Union - sumTop5Union) / data.length / 5 * 100).toFixed(1)}%)`);
