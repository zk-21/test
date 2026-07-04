/**
 * 测试近期权重策略：给近30期数据更高权重
 * 对比不同权重方案的效果
 */

const fs = require('fs');
const path = require('path');

let code = fs.readFileSync(path.join(__dirname, 'optimized_picker.js'), 'utf-8');
const cliStart = code.indexOf('\nconst args = process.argv.slice');
if (cliStart > 0) code = code.substring(0, cliStart);

const wrappedCode = `
(function() {
  var module = { exports: {} };
  var exports = module.exports;
  ${code}
  return { predict, ALL_DRAWS, issueMap, buildPairs };
})()
`;

const picker = eval(wrappedCode);

console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║        📊 近期权重策略测试                                           ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

// 构建间隔9配对
const pairs9 = picker.buildPairs(9);
console.log(`📊 间隔9配对数：${pairs9.length}对\n`);

// 统计函数
function runBacktest(weightConfig) {
  const stats = {
    poolHits: 0,
    union5Hits: [0,0,0,0,0,0],
    best3: 0,
    best4: 0,
    totalPairs: 0,
    totalBalls: 0,
  };

  pairs9.forEach(([sIssue, tIssue]) => {
    const result = picker.predict(sIssue, null, true);
    if (!result) return;
    
    const targetDraw = picker.issueMap[tIssue];
    if (!targetDraw) return;
    const targetSet = new Set(targetDraw.front);
    
    stats.totalPairs++;
    stats.totalBalls += 5;
    
    // 应用近期权重到号码池分数
    const srcIdx = picker.ALL_DRAWS.map(d => d.issue).indexOf(sIssue);
    const pool = result.pool.map(p => {
      let weightedScore = p.score;
      
      // 检查该号码在近期出现的频率
      let recentAppearances = 0;
      for (let i = Math.max(0, srcIdx - 30); i < srcIdx; i++) {
        if (picker.ALL_DRAWS[i].front.includes(p.number)) {
          recentAppearances++;
        }
      }
      
      // 应用权重
      if (weightConfig.recent30 && recentAppearances > 0) {
        weightedScore *= (1 + weightConfig.recent30 * recentAppearances / 10);
      }
      
      return { ...p, weightedScore };
    });
    
    // 按加权分数重新排序
    pool.sort((a, b) => b.weightedScore - a.weightedScore);
    
    // 号码池覆盖
    const poolNums = pool.map(p => p.number);
    stats.poolHits += poolNums.filter(n => targetSet.has(n)).length;
    
    // Top5联合覆盖（使用原始组合，因为组合已经考虑了多种因素）
    const top5 = result.combinations.slice(0, 5);
    const union = new Set();
    top5.forEach(c => c.numbers.forEach(n => union.add(n)));
    const unionHit = [...targetSet].filter(n => union.has(n)).length;
    stats.union5Hits[Math.min(unionHit, 5)]++;
    
    // 最佳命中
    let bestHit = 0;
    top5.forEach(c => {
      const h = c.numbers.filter(n => targetSet.has(n)).length;
      bestHit = Math.max(bestHit, h);
    });
    if (bestHit >= 3) stats.best3++;
    if (bestHit >= 4) stats.best4++;
  });

  return stats;
}

// 测试不同权重配置
const configs = [
  { name: '基准（无权重）', recent30: 0 },
  { name: '近30期 +50%', recent30: 0.5 },
  { name: '近30期 +100%', recent30: 1.0 },
  { name: '近30期 +150%', recent30: 1.5 },
  { name: '近30期 +200%', recent30: 2.0 },
];

console.log("🔄 测试不同近期权重方案...\n");

const results = [];

configs.forEach(config => {
  const stats = runBacktest(config);
  const poolRate = (stats.poolHits / stats.totalBalls * 100).toFixed(1);
  const union3plus = stats.union5Hits.slice(3).reduce((a,b) => a+b, 0);
  const union3Rate = (union3plus / stats.totalPairs * 100).toFixed(1);
  const best3Rate = (stats.best3 / stats.totalPairs * 100).toFixed(1);
  
  results.push({
    name: config.name,
    poolRate: parseFloat(poolRate),
    union3Rate: parseFloat(union3Rate),
    best3Rate: parseFloat(best3Rate),
    stats
  });
});

// 输出对比表
console.log("═".repeat(70));
console.log("📊 近期权重策略对比");
console.log("═".repeat(70));

console.log(`\n配置              | 池覆盖率 | 联合≥3球 | 最佳≥3球`);
console.log(`${'─'.repeat(55)}`);

results.forEach(r => {
  console.log(`${r.name.padEnd(18)} | ${r.poolRate.toFixed(1).padStart(6)}% | ${r.union3Rate.toFixed(1).padStart(6)}% | ${r.best3Rate.toFixed(1).padStart(6)}%`);
});

// 找出最佳配置
results.sort((a, b) => b.union3Rate - a.union3Rate);
console.log(`\n🏆 最佳配置（按联合≥3球）：${results[0].name}`);
console.log(`   池覆盖率：${results[0].poolRate}%`);
console.log(`   联合≥3球：${results[0].union3Rate}%`);
console.log(`   最佳≥3球：${results[0].best3Rate}%`);

// 详细联合覆盖分布
console.log(`\n${'═'.repeat(70)}`);
console.log("📊 最佳配置的联合覆盖分布");
console.log('═'.repeat(70));

const bestStats = results[0].stats;
console.log(`\n命中数 | 期数 | 比例`);
console.log(`${'─'.repeat(25)}`);
for (let i = 0; i <= 5; i++) {
  const pct = (bestStats.union5Hits[i] / bestStats.totalPairs * 100).toFixed(1);
  console.log(`   ${i}   | ${String(bestStats.union5Hits[i]).padStart(3)}  | ${pct}%`);
}

console.log(`\n✅ 近期权重测试完成`);
