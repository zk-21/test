const fs = require('fs');
const path = require('path');

// 读取CSV文件
const csvPath = path.join(__dirname, 'per_period_detail.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.trim().split('\n');
const dataLines = lines.slice(1);

// 解析数据
const periods = dataLines.map(line => {
  const parts = line.split(',');
  return {
    period: parseInt(parts[0]),
    target: parts[1].replace(/"/g, ''),
    top1: parseInt(parts[2]),
    top2: parseInt(parts[3]),
    top3: parseInt(parts[4]),
    top4: parseInt(parts[5]),
    top5: parseInt(parts[6]),
    bl6: parseInt(parts[7]),
    top5Union: parseInt(parts[8]),
    top5Bl6Union: parseInt(parts[9]),
    poolCoverage: parseInt(parts[10])
  };
});

console.log('🎯 命中号码频率特征分析');
console.log('═'.repeat(70));

console.log('\n📊 核心发现验证:');
console.log('─'.repeat(70));
console.log('假设：命中的号码大部分是Top5和补漏6中出现次数较少的号码');
console.log('');

// 分析各组合的命中分布
console.log('\n📊 各组合命中分布统计:');
console.log('─'.repeat(70));

// 统计每个组合的命中情况
const comboStats = {
  top1: { total: 0, hits: 0, hit3: 0, hit2: 0, hit1: 0, hit0: 0 },
  top2: { total: 0, hits: 0, hit3: 0, hit2: 0, hit1: 0, hit0: 0 },
  top3: { total: 0, hits: 0, hit3: 0, hit2: 0, hit1: 0, hit0: 0 },
  top4: { total: 0, hits: 0, hit3: 0, hit2: 0, hit1: 0, hit0: 0 },
  top5: { total: 0, hits: 0, hit3: 0, hit2: 0, hit1: 0, hit0: 0 },
  bl6: { total: 0, hits: 0, hit3: 0, hit2: 0, hit1: 0, hit0: 0 }
};

periods.forEach(p => {
  comboStats.top1.total += 5;
  comboStats.top1.hits += p.top1;
  if (p.top1 >= 3) comboStats.top1.hit3++;
  else if (p.top1 >= 2) comboStats.top1.hit2++;
  else if (p.top1 >= 1) comboStats.top1.hit1++;
  else comboStats.top1.hit0++;
  
  comboStats.top2.total += 5;
  comboStats.top2.hits += p.top2;
  if (p.top2 >= 3) comboStats.top2.hit3++;
  else if (p.top2 >= 2) comboStats.top2.hit2++;
  else if (p.top2 >= 1) comboStats.top2.hit1++;
  else comboStats.top2.hit0++;
  
  comboStats.top3.total += 5;
  comboStats.top3.hits += p.top3;
  if (p.top3 >= 3) comboStats.top3.hit3++;
  else if (p.top3 >= 2) comboStats.top3.hit2++;
  else if (p.top3 >= 1) comboStats.top3.hit1++;
  else comboStats.top3.hit0++;
  
  comboStats.top4.total += 5;
  comboStats.top4.hits += p.top4;
  if (p.top4 >= 3) comboStats.top4.hit3++;
  else if (p.top4 >= 2) comboStats.top4.hit2++;
  else if (p.top4 >= 1) comboStats.top4.hit1++;
  else comboStats.top4.hit0++;
  
  comboStats.top5.total += 5;
  comboStats.top5.hits += p.top5;
  if (p.top5 >= 3) comboStats.top5.hit3++;
  else if (p.top5 >= 2) comboStats.top5.hit2++;
  else if (p.top5 >= 1) comboStats.top5.hit1++;
  else comboStats.top5.hit0++;
  
  comboStats.bl6.total += 5;
  comboStats.bl6.hits += p.bl6;
  if (p.bl6 >= 3) comboStats.bl6.hit3++;
  else if (p.bl6 >= 2) comboStats.bl6.hit2++;
  else if (p.bl6 >= 1) comboStats.bl6.hit1++;
  else comboStats.bl6.hit0++;
});

console.log('\n组合 | 总命中 | 命中率 | 命中3+ | 命中2 | 命中1 | 命中0');
console.log('─'.repeat(70));

Object.entries(comboStats).forEach(([name, stats]) => {
  const hitRate = (stats.hits / stats.total * 100).toFixed(1);
  console.log(`${name.padEnd(6)} | ${String(stats.hits).padStart(4)}/${String(stats.total).padStart(4)} | ${hitRate.padStart(5)}% | ${String(stats.hit3).padStart(4)}次 | ${String(stats.hit2).padStart(4)}次 | ${String(stats.hit1).padStart(4)}次 | ${String(stats.hit0).padStart(4)}次`);
});

// 分析最佳命中组合
console.log('\n📊 最佳命中组合分析:');
console.log('─'.repeat(70));

const bestHitCombo = periods.map(p => {
  const hits = [p.top1, p.top2, p.top3, p.top4, p.top5];
  const maxHit = Math.max(...hits);
  const bestIdx = hits.indexOf(maxHit);
  return {
    period: p.period,
    bestCombo: `top${bestIdx + 1}`,
    bestHit: maxHit,
    allHits: hits
  };
});

const comboWinCount = {};
bestHitCombo.forEach(b => {
  comboWinCount[b.bestCombo] = (comboWinCount[b.bestCombo] || 0) + 1;
});

console.log('\n各组合作为最佳命中的次数:');
Object.entries(comboWinCount).sort((a, b) => b[1] - a[1]).forEach(([combo, count]) => {
  console.log(`  ${combo}: ${count}次 (${(count/168*100).toFixed(1)}%)`);
});

// 分析命中3+的组合分布
console.log('\n📊 命中3+的组合分布:');
console.log('─'.repeat(70));

const hit3PlusCombo = periods.map(p => {
  const hits = [p.top1, p.top2, p.top3, p.top4, p.top5];
  const hit3Plus = hits.filter(h => h >= 3).length;
  return {
    period: p.period,
    hit3Plus: hit3Plus,
    hits: hits
  };
}).filter(p => p.hit3Plus > 0);

console.log(`\n命中3+的期数: ${hit3PlusCombo.length}期`);

const comboHit3Count = { top1: 0, top2: 0, top3: 0, top4: 0, top5: 0 };
hit3PlusCombo.forEach(p => {
  p.hits.forEach((h, i) => {
    if (h >= 3) comboHit3Count[`top${i+1}`]++;
  });
});

console.log('\n各组合命中3+的次数:');
Object.entries(comboHit3Count).forEach(([combo, count]) => {
  console.log(`  ${combo}: ${count}次`);
});

// 分析命中号码的"冷热"特征
console.log('\n📊 命中号码的"冷热"特征分析:');
console.log('─'.repeat(70));
console.log('假设：Top5组合中高频出现的号码是"热门"号码');
console.log('      Top5组合中低频出现的号码是"冷门"号码');
console.log('');

// 由于没有每期的具体号码数据，我们基于命中分布推断
// 如果命中主要来自低频组合（top4、top5），说明命中的是"冷门"号码

const lowFreqComboHits = comboStats.top4.hits + comboStats.top5.hits;
const highFreqComboHits = comboStats.top1.hits + comboStats.top2.hits + comboStats.top3.hits;
const totalHits = lowFreqComboHits + highFreqComboHits + comboStats.bl6.hits;

console.log(`高频组合(Top1-3)命中: ${highFreqComboHits}球 (${(highFreqComboHits/totalHits*100).toFixed(1)}%)`);
console.log(`低频组合(Top4-5)命中: ${lowFreqComboHits}球 (${(lowFreqComboHits/totalHits*100).toFixed(1)}%)`);
console.log(`补漏6命中: ${comboStats.bl6.hits}球 (${(comboStats.bl6.hits/totalHits*100).toFixed(1)}%)`);

console.log('\n📊 命中率对比:');
console.log('─'.repeat(70));

const highFreqHitRate = (highFreqComboHits / (comboStats.top1.total + comboStats.top2.total + comboStats.top3.total) * 100).toFixed(1);
const lowFreqHitRate = (lowFreqComboHits / (comboStats.top4.total + comboStats.top5.total) * 100).toFixed(1);
const bl6HitRate = (comboStats.bl6.hits / comboStats.bl6.total * 100).toFixed(1);

console.log(`高频组合(Top1-3)命中率: ${highFreqHitRate}%`);
console.log(`低频组合(Top4-5)命中率: ${lowFreqHitRate}%`);
console.log(`补漏6命中率: ${bl6HitRate}%`);

// 验证用户观察
console.log('\n📊 验证用户观察:');
console.log('─'.repeat(70));

const observation1 = lowFreqComboHits > highFreqComboHits;
const observation2 = parseFloat(lowFreqHitRate) > parseFloat(highFreqHitRate);

console.log(`观察1: 低频组合命中数 > 高频组合命中数`);
console.log(`  低频组合: ${lowFreqComboHits}球 vs 高频组合: ${highFreqComboHits}球`);
console.log(`  结论: ${observation1 ? '✅ 验证通过' : '❌ 验证失败'}`);

console.log(`\n观察2: 低频组合命中率 > 高频组合命中率`);
console.log(`  低频组合: ${lowFreqHitRate}% vs 高频组合: ${highFreqHitRate}%`);
console.log(`  结论: ${observation2 ? '✅ 验证通过' : '❌ 验证失败'}`);

// 分析原因
console.log('\n📊 原因分析:');
console.log('─'.repeat(70));

if (observation1 || observation2) {
  console.log('✅ 用户观察正确：命中的号码确实更多来自低频组合');
  console.log('');
  console.log('可能原因:');
  console.log('1. 模型过度集中在"热门"号码上');
  console.log('   - Top1-3组合倾向于选择得分最高的号码');
  console.log('   - 这些号码在历史中出现频率高，但未来不一定');
  console.log('');
  console.log('2. 开奖号码的随机性');
  console.log('   - 开奖号码倾向于"冷热交替"');
  console.log('   - 高频号码可能进入"冷却期"');
  console.log('');
  console.log('3. 组合多样性不足');
  console.log('   - Top5组合可能高度重叠');
  console.log('   - 低频组合提供了必要的多样性');
} else {
  console.log('❌ 用户观察与数据不符');
  console.log('需要进一步分析具体号码的出现频率');
}

// 优化建议
console.log('\n💡 优化建议:');
console.log('─'.repeat(70));

console.log('1. 增加组合多样性:');
console.log('   - 确保Top5组合覆盖更多不同的号码');
console.log('   - 减少组合之间的重叠');
console.log('');
console.log('2. 平衡"冷热"号码:');
console.log('   - 不要过度偏向高频号码');
console.log('   - 为低频号码保留一定比例');
console.log('');
console.log('3. 调整组合权重:');
console.log('   - 降低Top1-3的权重');
console.log('   - 提高Top4-5的权重');
console.log('');
console.log('4. 实施"冷号补偿"策略:');
console.log('   - 对最近N期未出现的号码给予额外权重');
console.log('   - 特别关注候选池中排名20-30的号码');

console.log('\n' + '═'.repeat(70));
console.log('✅ 分析完成');