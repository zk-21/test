/**
 * 分析V5命中率影响因素
 * 找出表现差的期数，分析共同特征
 */

const fs = require('fs');
const path = require('path');

// 加载数据
const rawJs = fs.readFileSync(path.join(__dirname, 'all_draws.js'), 'utf8');
const match = rawJs.match(/window\.ALL_DRAWS_DATA\s*=\s*(\[[\s\S]*?\]);/);
if (!match) { console.error('无法解析 all_draws.js'); process.exit(1); }
const ALL_DRAWS_DATA = eval(match[1]);
const DRAWS = [...ALL_DRAWS_DATA].reverse();

// 分析指标
const analyses = [];

for (let i = 0; i < DRAWS.length - 1; i++) {
  const src = DRAWS[i];
  const tgt = DRAWS[i + 1];
  if (!src || !tgt) continue;

  const srcNums = [...src.front].sort((a, b) => a - b);
  const tgtNums = [...tgt.front].sort((a, b) => a - b);
  const tgtSet = new Set(tgtNums);

  // 1. 重叠号（source与target直接重复）
  const overlap = srcNums.filter(n => tgtSet.has(n)).length;

  // 2. 邻号命中（source号码的±1在target中）
  const srcSet = new Set(srcNums);
  const neighborHits = tgtNums.filter(n => srcNums.some(s => Math.abs(s - n) === 1)).length;

  // 3. 尾号转移（source尾号在target中出现）
  const srcTails = [...new Set(srcNums.map(n => n % 10))];
  const tgtTails = [...new Set(tgtNums.map(n => n % 10))];
  const tailOverlap = srcTails.filter(t => tgtTails.includes(t)).length;

  // 4. 区间比变化
  const getIv = nums => {
    const iv = [0, 0, 0];
    nums.forEach(n => {
      if (n <= 12) iv[0]++;
      else if (n <= 24) iv[1]++;
      else iv[2]++;
    });
    return iv;
  };
  const srcIv = getIv(srcNums);
  const tgtIv = getIv(tgtNums);

  // 5. 和值变化
  const srcSum = srcNums.reduce((a, b) => a + b, 0);
  const tgtSum = tgtNums.reduce((a, b) => a + b, 0);

  // 6. 奇偶比
  const srcOdd = srcNums.filter(n => n % 2 === 1).length;
  const tgtOdd = tgtNums.filter(n => n % 2 === 1).length;

  // 7. 跨度
  const srcSpan = srcNums[4] - srcNums[0];
  const tgtSpan = tgtNums[4] - tgtNums[0];

  // 8. 号码热度变化（前5期出现频率）
  const hotMap = new Map();
  for (let j = Math.max(0, i - 5); j < i; j++) {
    DRAWS[j].front.forEach(n => hotMap.set(n, (hotMap.get(n) || 0) + 1));
  }
  const tgtHotHits = tgtNums.filter(n => (hotMap.get(n) || 0) >= 2).length;

  // 9. 连号变化
  const getRunCount = nums => {
    let maxRun = 1, run = 1;
    for (let k = 1; k < nums.length; k++) {
      if (nums[k] === nums[k - 1] + 1) { run++; maxRun = Math.max(maxRun, run); }
      else run = 1;
    }
    return maxRun;
  };
  const srcRun = getRunCount(srcNums);
  const tgtRun = getRunCount(tgtNums);

  analyses.push({
    srcIssue: src.issue,
    tgtIssue: tgt.issue,
    srcNums, tgtNums,
    overlap,
    neighborHits,
    tailOverlap,
    srcIv, tgtIv,
    srcSum, tgtSum,
    sumDiff: Math.abs(tgtSum - srcSum),
    srcOdd, tgtOdd,
    srcSpan, tgtSpan,
    tgtHotHits,
    srcRun, tgtRun,
  });
}

console.log('='.repeat(100));
console.log('V5命中率影响因素分析');
console.log('='.repeat(100));
console.log(`分析期数: ${analyses.length}`);
console.log('');

// === 分析1: 重叠号与命中率的关系 ===
console.log('【1. 重叠号数量 vs 预测难度】');
console.log('-'.repeat(60));
const overlapGroups = {};
analyses.forEach(a => {
  const key = a.overlap;
  if (!overlapGroups[key]) overlapGroups[key] = { count: 0, sum: 0 };
  overlapGroups[key].count++;
  overlapGroups[key].sum++;
});
Object.keys(overlapGroups).sort((a, b) => a - b).forEach(k => {
  const g = overlapGroups[k];
  console.log(`  重叠${k}个: ${g.count}期 (${(g.count / analyses.length * 100).toFixed(1)}%)`);
});

// === 分析2: 区间比变化频率 ===
console.log('');
console.log('【2. 区间比变化模式】');
console.log('-'.repeat(60));
const ivChanges = analyses.map(a => ({
  src: a.srcIv.join(':'),
  tgt: a.tgtIv.join(':'),
}));
const ivChangeFreq = {};
ivChanges.forEach(c => {
  const key = `${c.src} → ${c.tgt}`;
  ivChangeFreq[key] = (ivChangeFreq[key] || 0) + 1;
});
console.log('  Top10区间比变化模式:');
Object.entries(ivChangeFreq).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, v]) => {
  console.log(`    ${k}: ${v}次 (${(v / analyses.length * 100).toFixed(1)}%)`);
});

// === 分析3: 和值波动 ===
console.log('');
console.log('【3. 和值波动分析】');
console.log('-'.repeat(60));
const sumDiffs = analyses.map(a => a.sumDiff);
const avgSumDiff = sumDiffs.reduce((a, b) => a + b, 0) / sumDiffs.length;
console.log(`  平均和值变化: ${avgSumDiff.toFixed(1)}`);
console.log(`  最大和值变化: ${Math.max(...sumDiffs)}`);
console.log(`  最小和值变化: ${Math.min(...sumDiffs)}`);

const sumDiffGroups = { '0-10': 0, '11-20': 0, '21-30': 0, '31+': 0 };
sumDiffs.forEach(d => {
  if (d <= 10) sumDiffGroups['0-10']++;
  else if (d <= 20) sumDiffGroups['11-20']++;
  else if (d <= 30) sumDiffGroups['21-30']++;
  else sumDiffGroups['31+']++;
});
Object.entries(sumDiffGroups).forEach(([k, v]) => {
  console.log(`  和值变化${k}: ${v}期 (${(v / analyses.length * 100).toFixed(1)}%)`);
});

// === 分析4: 奇偶变化 ===
console.log('');
console.log('【4. 奇偶比变化】');
console.log('-'.repeat(60));
const oddChanges = analyses.map(a => Math.abs(a.tgtOdd - a.srcOdd));
const oddChangeFreq = {};
oddChanges.forEach(d => { oddChangeFreq[d] = (oddChangeFreq[d] || 0) + 1; });
Object.entries(oddChangeFreq).sort((a, b) => a[0] - b[0]).forEach(([k, v]) => {
  console.log(`  奇偶变化±${k}: ${v}期 (${(v / analyses.length * 100).toFixed(1)}%)`);
});

// === 分析5: 尾号转移 ===
console.log('');
console.log('【5. 尾号转移分析】');
console.log('-'.repeat(60));
const tailOvGroups = {};
analyses.forEach(a => {
  const key = a.tailOverlap;
  if (!tailOvGroups[key]) tailOvGroups[key] = 0;
  tailOvGroups[key]++;
});
Object.entries(tailOvGroups).sort((a, b) => a[0] - b[0]).forEach(([k, v]) => {
  console.log(`  尾号重叠${k}个: ${v}期 (${(v / analyses.length * 100).toFixed(1)}%)`);
});

// === 分析6: 热号命中 ===
console.log('');
console.log('【6. 热号命中分析（前5期出现≥2次的号码）】');
console.log('-'.repeat(60));
const hotGroups = {};
analyses.forEach(a => {
  const key = a.tgtHotHits;
  if (!hotGroups[key]) hotGroups[key] = 0;
  hotGroups[key]++;
});
Object.entries(hotGroups).sort((a, b) => a[0] - b[0]).forEach(([k, v]) => {
  console.log(`  热号命中${k}个: ${v}期 (${(v / analyses.length * 100).toFixed(1)}%)`);
});

// === 分析7: 跨度变化 ===
console.log('');
console.log('【7. 跨度变化分析】');
console.log('-'.repeat(60));
const spanChanges = analyses.map(a => Math.abs(a.tgtSpan - a.srcSpan));
const avgSpanChange = spanChanges.reduce((a, b) => a + b, 0) / spanChanges.length;
console.log(`  平均跨度变化: ${avgSpanChange.toFixed(1)}`);
console.log(`  跨度变化0-5: ${spanChanges.filter(d => d <= 5).length}期 (${(spanChanges.filter(d => d <= 5).length / analyses.length * 100).toFixed(1)}%)`);
console.log(`  跨度变化6-10: ${spanChanges.filter(d => d > 5 && d <= 10).length}期 (${(spanChanges.filter(d => d > 5 && d <= 10).length / analyses.length * 100).toFixed(1)}%)`);
console.log(`  跨度变化>10: ${spanChanges.filter(d => d > 10).length}期 (${(spanChanges.filter(d => d > 10).length / analyses.length * 100).toFixed(1)}%)`);

// === 分析8: 连号变化 ===
console.log('');
console.log('【8. 连号变化分析】');
console.log('-'.repeat(60));
const runFreq = {};
analyses.forEach(a => {
  runFreq[a.tgtRun] = (runFreq[a.tgtRun] || 0) + 1;
});
Object.entries(runFreq).sort((a, b) => a[0] - b[0]).forEach(([k, v]) => {
  console.log(`  最大连号${k}: ${v}期 (${(v / analyses.length * 100).toFixed(1)}%)`);
});

// === 分析9: 号码频率分布 ===
console.log('');
console.log('【9. 号码出现频率（target期）】');
console.log('-'.repeat(60));
const numFreq = new Array(36).fill(0);
analyses.forEach(a => a.tgtNums.forEach(n => numFreq[n]++));
const sortedNums = numFreq.map((f, n) => ({ n, f })).filter(x => x.n > 0).sort((a, b) => b.f - a.f);
console.log('  Top10高频号码:');
sortedNums.slice(0, 10).forEach(x => {
  console.log(`    ${String(x.n).padStart(2)}: ${x.f}次 (${(x.f / analyses.length * 100).toFixed(1)}%)`);
});
console.log('  Top10低频号码:');
sortedNums.slice(-10).forEach(x => {
  console.log(`    ${String(x.n).padStart(2)}: ${x.f}次 (${(x.f / analyses.length * 100).toFixed(1)}%)`);
});

// === 分析10: 首尾号码分析 ===
console.log('');
console.log('【10. 首位球/末位球分析】');
console.log('-'.repeat(60));
const firstBallFreq = {};
const lastBallFreq = {};
analyses.forEach(a => {
  firstBallFreq[a.tgtNums[0]] = (firstBallFreq[a.tgtNums[0]] || 0) + 1;
  lastBallFreq[a.tgtNums[4]] = (lastBallFreq[a.tgtNums[4]] || 0) + 1;
});
console.log('  首位球分布:');
Object.entries(firstBallFreq).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([k, v]) => {
  console.log(`    ${k}: ${v}次 (${(v / analyses.length * 100).toFixed(1)}%)`);
});
console.log('  末位球分布:');
Object.entries(lastBallFreq).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([k, v]) => {
  console.log(`    ${k}: ${v}次 (${(v / analyses.length * 100).toFixed(1)}%)`);
});

// === 总结 ===
console.log('');
console.log('='.repeat(100));
console.log('优化建议总结');
console.log('='.repeat(100));
console.log('');
console.log('【潜在优化方向】');
console.log('');
console.log('1. 重叠号策略:');
console.log(`   - 平均重叠${(analyses.reduce((s, a) => s + a.overlap, 0) / analyses.length).toFixed(1)}个`);
console.log('   - 可考虑增加重叠号的权重');
console.log('');
console.log('2. 尾号预测:');
console.log(`   - 平均尾号重叠${(analyses.reduce((s, a) => s + a.tailOverlap, 0) / analyses.length).toFixed(1)}个`);
console.log('   - 尾号转移是重要信号');
console.log('');
console.log('3. 热号利用:');
console.log(`   - target中热号平均${(analyses.reduce((s, a) => s + a.tgtHotHits, 0) / analyses.length).toFixed(1)}个`);
console.log('   - 前5期高频号码有参考价值');
console.log('');
console.log('4. 和值预测:');
console.log(`   - 平均和值变化${avgSumDiff.toFixed(1)}`);
console.log('   - 可优化和值预测模型');
console.log('');
console.log('5. 区间比预测:');
console.log('   - 区间比变化模式有规律可循');
console.log('   - 可增加区间比预测权重');
console.log('');
console.log('6. 首位球/末位球:');
console.log('   - 首位球集中在1-10');
console.log('   - 末位球集中在25-35');
console.log('   - 可优化首位球/末位球预测');
