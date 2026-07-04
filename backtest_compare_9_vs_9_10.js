/**
 * 对比回测：间隔9 vs 间隔9+10并集池策略
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
console.log("║        📊 对比回测：间隔9 vs 间隔9+10并集池                         ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

// 构建配对
const pairs9 = picker.buildPairs(9);
const pairs10 = picker.buildPairs(10);

const targetMap9 = new Map();
pairs9.forEach(([s, t]) => targetMap9.set(t, s));
const targetMap10 = new Map();
pairs10.forEach(([s, t]) => targetMap10.set(t, s));

const commonTargets = [...targetMap9.keys()].filter(t => targetMap10.has(t)).sort();

console.log(`📊 共同期数：${commonTargets.length}对\n`);

// 统计
const s9 = { poolHits: 0, union5Hits: [0,0,0,0,0,0], best3: 0, best4: 0 };
const sUnion = { poolHits: 0, union5Hits: [0,0,0,0,0,0], best3: 0, best4: 0 };
let totalBalls = 0;

console.log("🔄 回测中...\n");

commonTargets.forEach((targetIssue, idx) => {
  const source9 = targetMap9.get(targetIssue);
  const source10 = targetMap10.get(targetIssue);
  
  const result9 = picker.predict(source9, null, true);
  const result10 = picker.predict(source10, null, true);
  if (!result9 || !result10) return;
  
  const targetDraw = picker.issueMap[targetIssue];
  if (!targetDraw) return;
  const targetSet = new Set(targetDraw.front);
  
  totalBalls += 5;
  
  // 间隔9单独
  const pool9 = new Set(result9.pool.map(p => p.number));
  s9.poolHits += [...pool9].filter(n => targetSet.has(n)).length;
  
  const u5_9 = new Set();
  result9.combinations.slice(0, 5).forEach(c => c.numbers.forEach(n => u5_9.add(n)));
  const union9Hit = [...targetSet].filter(n => u5_9.has(n)).length;
  s9.union5Hits[union9Hit]++;
  
  let best9 = 0;
  result9.combinations.slice(0, 5).forEach(c => {
    const h = c.numbers.filter(n => targetSet.has(n)).length;
    best9 = Math.max(best9, h);
  });
  if (best9 >= 3) s9.best3++;
  if (best9 >= 4) s9.best4++;
  
  // 间隔9+10并集池
  const pool10 = new Set(result10.pool.map(p => p.number));
  const unionPool = new Set([...pool9, ...pool10]);
  sUnion.poolHits += [...unionPool].filter(n => targetSet.has(n)).length;
  
  // 并集Top5：从并集池中选综合分数最高的5个
  const allScores = new Map();
  result9.pool.forEach(p => allScores.set(p.number, (allScores.get(p.number) || 0) + p.score));
  result10.pool.forEach(p => allScores.set(p.number, (allScores.get(p.number) || 0) + p.score));
  
  const unionSorted = [...unionPool].sort((a, b) => (allScores.get(b) || 0) - (allScores.get(a) || 0));
  const unionTop5 = unionSorted.slice(0, 5);
  const unionTop5Hit = unionTop5.filter(n => targetSet.has(n)).length;
  sUnion.union5Hits[unionTop5Hit]++;
  
  // 并集Top5联合覆盖（两个间隔的Top5合并）
  const u5_10 = new Set();
  result10.combinations.slice(0, 5).forEach(c => c.numbers.forEach(n => u5_10.add(n)));
  const u5_union = new Set([...u5_9, ...u5_10]);
  const unionHit = [...targetSet].filter(n => u5_union.has(n)).length;
  
  // 重新统计并集策略的联合覆盖
  sUnion.union5Hits[unionTop5Hit]--; // 先减掉
  sUnion.union5Hits[Math.min(unionHit, 5)]++;
  
  let bestUnion = Math.max(best9, ...result10.combinations.slice(0, 5).map(c => 
    c.numbers.filter(n => targetSet.has(n)).length
  ));
  if (bestUnion >= 3) sUnion.best3++;
  if (bestUnion >= 4) sUnion.best4++;
  
  if ((idx + 1) % 20 === 0) {
    process.stdout.write(`\r   已测试 ${idx + 1}/${commonTargets.length}...`);
  }
});

console.log(`\r   ✅ 完成：${commonTargets.length}对                    \n`);

// 输出对比
console.log("═".repeat(70));
console.log("📊 对比结果");
console.log("═".repeat(70));

console.log(`\n📦 号码池覆盖率（24球池）：`);
console.log(`   间隔9:       ${s9.poolHits}/${totalBalls} (${(s9.poolHits/totalBalls*100).toFixed(1)}%)`);
console.log(`   间隔9+10并集: ${sUnion.poolHits}/${totalBalls} (${(sUnion.poolHits/totalBalls*100).toFixed(1)}%)`);
console.log(`   提升: +${((sUnion.poolHits - s9.poolHits)/totalBalls*100).toFixed(1)}%`);

console.log(`\n🔗 Top5联合覆盖率：`);
console.log(`   命中数 | 间隔9  | 9+10并集`);
console.log(`   ${'─'.repeat(35)}`);
for (let i = 0; i <= 5; i++) {
  const p9 = (s9.union5Hits[i]/commonTargets.length*100).toFixed(1);
  const pU = (sUnion.union5Hits[i]/commonTargets.length*100).toFixed(1);
  const marker = sUnion.union5Hits[i] > s9.union5Hits[i] ? ' ↑' : '';
  console.log(`   ${i}球    | ${p9.padStart(5)}% | ${pU.padStart(5)}%${marker}`);
}

console.log(`\n⭐ 最佳命中统计：`);
console.log(`   指标      | 间隔9  | 9+10并集`);
console.log(`   ${'─'.repeat(35)}`);
console.log(`   ≥3球      | ${(s9.best3/commonTargets.length*100).toFixed(1)}%  | ${(sUnion.best3/commonTargets.length*100).toFixed(1)}%`);
console.log(`   ≥4球      | ${(s9.best4/commonTargets.length*100).toFixed(1)}%  | ${(sUnion.best4/commonTargets.length*100).toFixed(1)}%`);

// 联合覆盖≥3球统计
const union3_9 = s9.union5Hits.slice(3).reduce((a,b) => a+b, 0);
const union3_union = sUnion.union5Hits.slice(3).reduce((a,b) => a+b, 0);
console.log(`   联合≥3球  | ${(union3_9/commonTargets.length*100).toFixed(1)}%  | ${(union3_union/commonTargets.length*100).toFixed(1)}%`);

console.log(`\n${'═'.repeat(70)}`);
console.log("✅ 对比回测完成");
console.log('═'.repeat(70));
