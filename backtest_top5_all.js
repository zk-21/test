/**
 * 全量回测：每一期Top5号码命中测试
 * 策略：间隔9（最优单间隔，Top1命中21.0%）
 * 数据：all_draws.json 全量数据
 */

const fs = require('fs');
const path = require('path');

// 加载optimized_picker.js
const code = fs.readFileSync(path.join(__dirname, 'optimized_picker.js'), 'utf-8');
const wrappedCode = `
(function() {
  var module = { exports: {} };
  var exports = module.exports;
  ${code}
  return { 
    predict: predict, 
    ALL_DRAWS: ALL_DRAWS, 
    issueMap: issueMap,
    buildPairs: buildPairs
  };
})()
`;

const picker = eval(wrappedCode);

console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║        📊 全量回测：每一期Top5号码命中测试（间隔9策略）              ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

// 构建间隔9配对
const pairs = picker.buildPairs(9);
console.log(`📊 数据总量：${picker.ALL_DRAWS.length}期`);
console.log(`📊 间隔9配对数：${pairs.length}对\n`);

// 统计变量
const stats = {
  totalPairs: 0,
  // Top5每注命中分布（0-5球）
  top5HitDist: [
    [0, 0, 0, 0, 0, 0],  // Top1
    [0, 0, 0, 0, 0, 0],  // Top2
    [0, 0, 0, 0, 0, 0],  // Top3
    [0, 0, 0, 0, 0, 0],  // Top4
    [0, 0, 0, 0, 0, 0],  // Top5
  ],
  // Top5联合覆盖
  unionHits: [0, 0, 0, 0, 0, 0],  // 0-5球
  // 号码池覆盖
  poolHits: 0,
  totalBalls: 0,
  // 每期详情
  details: [],
  // ≥3球统计
  best3plus: 0,
  best4plus: 0,
  best5: 0,
};

console.log("🔄 开始回测...\n");

// 逐对测试
pairs.forEach(([sIssue, tIssue], idx) => {
  const result = picker.predict(sIssue, null, true);
  if (!result) return;
  
  const targetDraw = picker.issueMap[tIssue];
  if (!targetDraw) return;
  
  const targetSet = new Set(targetDraw.front);
  
  stats.totalPairs++;
  stats.totalBalls += 5;
  
  // 号码池覆盖
  const poolNums = result.pool.map(p => p.number);
  stats.poolHits += poolNums.filter(n => targetSet.has(n)).length;
  
  // Top5每注命中
  const top5 = result.combinations.slice(0, 5);
  const hitCounts = [];
  
  top5.forEach((combo, i) => {
    const hits = combo.numbers.filter(n => targetSet.has(n)).length;
    hitCounts.push(hits);
    stats.top5HitDist[i][hits]++;
  });
  
  // Top5联合覆盖
  const union = new Set();
  top5.forEach(c => c.numbers.forEach(n => union.add(n)));
  const unionHit = [...targetSet].filter(n => union.has(n)).length;
  stats.unionHits[unionHit]++;
  
  // 最佳命中
  const bestHit = Math.max(...hitCounts);
  if (bestHit >= 3) stats.best3plus++;
  if (bestHit >= 4) stats.best4plus++;
  if (bestHit >= 5) stats.best5++;
  
  // 保存详情
  stats.details.push({
    sIssue,
    tIssue,
    target: targetDraw.front,
    top5Hits: hitCounts,
    unionHit,
    poolHit: poolNums.filter(n => targetSet.has(n)).length,
    bestHit
  });
  
  // 进度显示
  if ((idx + 1) % 20 === 0) {
    process.stdout.write(`\r   已测试 ${idx + 1}/${pairs.length} 对...`);
  }
});

console.log(`\r   ✅ 测试完成：${stats.totalPairs}对                    \n`);

// ===================== 输出结果 =====================
console.log("═".repeat(70));
console.log("📊 回测结果汇总");
console.log("═".repeat(70));

// 号码池覆盖率
console.log(`\n📦 号码池覆盖率（24球池）：`);
console.log(`   命中：${stats.poolHits}/${stats.totalBalls} (${(stats.poolHits / stats.totalBalls * 100).toFixed(1)}%)`);

// Top5每注命中率
console.log(`\n🎯 Top5每注命中率：`);
console.log(`   注号  |  0球  |  1球  |  2球  |  3球  |  4球  |  5球  | 平均命中`);
console.log(`   ${'─'.repeat(65)}`);

for (let i = 0; i < 5; i++) {
  const dist = stats.top5HitDist[i];
  const total = dist.reduce((a, b) => a + b, 0);
  const avgHit = dist.reduce((sum, count, idx) => sum + count * idx, 0) / total;
  const row = dist.map(c => `${(c / total * 100).toFixed(1)}%`.padStart(6)).join(' | ');
  console.log(`   Top${i+1} | ${row} | ${avgHit.toFixed(2)}`);
}

// Top5联合覆盖率
console.log(`\n🔗 Top5联合覆盖率（5注去重）：`);
const unionTotal = stats.unionHits.reduce((a, b) => a + b, 0);
for (let i = 0; i <= 5; i++) {
  const pct = (stats.unionHits[i] / unionTotal * 100).toFixed(1);
  console.log(`   ${i}球命中：${stats.unionHits[i]}期 (${pct}%)`);
}

// ≥3球统计
console.log(`\n⭐ 最佳命中统计：`);
console.log(`   ≥3球：${stats.best3plus}期 (${(stats.best3plus / stats.totalPairs * 100).toFixed(1)}%)`);
console.log(`   ≥4球：${stats.best4plus}期 (${(stats.best4plus / stats.totalPairs * 100).toFixed(1)}%)`);
console.log(`   全5球：${stats.best5}期 (${(stats.best5 / stats.totalPairs * 100).toFixed(1)}%)`);

// Top5命中详情表
console.log(`\n${'═'.repeat(70)}`);
console.log("📋 每期Top5命中详情（前30期示例）");
console.log('═'.repeat(70));
console.log(`选中→目标   | T1 T2 T3 T4 T5 | 联合 | 池覆盖 | 最佳`);
console.log(`${'─'.repeat(65)}`);

stats.details.slice(0, 30).forEach(d => {
  const hits = d.top5Hits.map(h => h >= 3 ? `[${h}]` : ` ${h} `).join(' ');
  console.log(`${d.sIssue}→${d.tIssue} | ${hits} |  ${d.unionHit}   |   ${d.poolHit}    |  ${d.bestHit}`);
});

if (stats.details.length > 30) {
  console.log(`   ... 共${stats.details.length}期，仅显示前30期`);
}

// 高命中期次汇总
console.log(`\n${'═'.repeat(70)}`);
console.log("🏆 高命中期次（≥3球）");
console.log('═'.repeat(70));

const highHitDetails = stats.details.filter(d => d.bestHit >= 3);
if (highHitDetails.length > 0) {
  console.log(`共 ${highHitDetails.length} 期命中≥3球：\n`);
  highHitDetails.forEach(d => {
    const hits = d.top5Hits.map(h => h >= 3 ? `[${h}]` : ` ${h} `).join(' ');
    console.log(`   ${d.sIssue}→${d.tIssue} | 目标: [${d.target.join(',')}] | ${hits} | 最佳: ${d.bestHit}球`);
  });
} else {
  console.log("   无命中≥3球的期次");
}

// 分段统计
console.log(`\n${'═'.repeat(70)}`);
console.log("📊 分段命中率统计");
console.log('═'.repeat(70));

const segments = [
  { name: '前期 (0-30对)', start: 0, end: 30 },
  { name: '中期 (30-60对)', start: 30, end: 60 },
  { name: '后期 (60+对)', start: 60, end: Infinity },
];

segments.forEach(seg => {
  const segDetails = stats.details.slice(seg.start, Math.min(seg.end, stats.details.length));
  if (segDetails.length === 0) return;
  
  const segBest3plus = segDetails.filter(d => d.bestHit >= 3).length;
  const segUnion3plus = segDetails.filter(d => d.unionHit >= 3).length;
  const segAvgUnion = segDetails.reduce((s, d) => s + d.unionHit, 0) / segDetails.length;
  
  console.log(`\n   ${seg.name} (${segDetails.length}对):`);
  console.log(`      最佳≥3球: ${segBest3plus}期 (${(segBest3plus / segDetails.length * 100).toFixed(1)}%)`);
  console.log(`      联合≥3球: ${segUnion3plus}期 (${(segUnion3plus / segDetails.length * 100).toFixed(1)}%)`);
  console.log(`      平均联合命中: ${segAvgUnion.toFixed(2)}球`);
});

console.log(`\n${'═'.repeat(70)}`);
console.log("✅ 回测完成");
console.log('═'.repeat(70));
