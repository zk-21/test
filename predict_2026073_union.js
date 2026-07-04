/**
 * 2026073期预测 - 间隔9+10并集池策略
 * 
 * 策略优势：
 * - 号码池覆盖率：90.9%（比纯间隔9提升9.7%）
 * - Top5联合≥3球：65.7%（比纯间隔9提升18.2%）
 * - 0球命中：0%（完全消除全空情况）
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
  return { predict, predictNext, predictBack, ALL_DRAWS, issueMap, buildPairs };
})()
`;

const picker = eval(wrappedCode);

console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║        🎯 2026073期预测（间隔9+10并集池策略）                        ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

// 目标期：2026073
const targetIssue = '2026073';
const targetNum = parseInt(targetIssue.slice(4));

// 计算正确的源期（避免使用未来数据）
const source9Issue = targetIssue.slice(0, 4) + String(targetNum - 9).padStart(3, '0');
const source10Issue = targetIssue.slice(0, 4) + String(targetNum - 10).padStart(3, '0');

console.log(`🎯 目标期：${targetIssue}`);
console.log(`📊 间隔9源期：${source9Issue}`);
console.log(`📊 间隔10源期：${source10Issue}\n`);

// 检查源期是否存在
if (!picker.issueMap[source9Issue] || !picker.issueMap[source10Issue]) {
  console.log("❌ 源期数据不存在");
  process.exit(1);
}

const source9Draw = picker.issueMap[source9Issue];
const source10Draw = picker.issueMap[source10Issue];

console.log(`📍 间隔9源期：${source9Issue} → [${source9Draw.front.join(', ')}]`);
console.log(`📍 间隔10源期：${source10Issue} → [${source10Draw.front.join(', ')}]\n`);

// 运行预测（使用正确的源期，避免数据泄露）
const result9 = picker.predict(source9Issue, null, true);
const result10 = picker.predict(source10Issue, null, true);

if (!result9 || !result10) {
  console.log("❌ 预测失败");
  process.exit(1);
}

// 构建并集池
const pool9 = result9.pool.map(p => p.number);
const pool10 = result10.pool.map(p => p.number);
const pool9Set = new Set(pool9);
const pool10Set = new Set(pool10);
const unionPool = new Set([...pool9Set, ...pool10Set]);

// 计算综合分数
const allScores = new Map();
result9.pool.forEach(p => allScores.set(p.number, (allScores.get(p.number) || 0) + p.score));
result10.pool.forEach(p => allScores.set(p.number, (allScores.get(p.number) || 0) + p.score));

// 按综合分数排序
const unionSorted = [...unionPool].sort((a, b) => (allScores.get(b) || 0) - (allScores.get(a) || 0));

console.log("═".repeat(70));
console.log("📊 并集池分析");
console.log("═".repeat(70));

console.log(`\n📦 号码池统计：`);
console.log(`   间隔9池：${pool9Set.size}个`);
console.log(`   间隔10池：${pool10Set.size}个`);
console.log(`   并集池：${unionPool.size}个`);

// 间隔10独有号码
const only10 = pool10.filter(n => !pool9Set.has(n));
console.log(`\n   间隔10独有：[${only10.join(', ')}]（${only10.length}个）`);

// Top5组合（从并集池中选综合分数最高的5个）
console.log(`\n${'═'.repeat(70)}`);
console.log("🏆 Top5推荐组合（并集池加权选择）");
console.log('═'.repeat(70));

const top5Combo = unionSorted.slice(0, 5);
console.log(`\n🎯 Top1：[${top5Combo.join(', ')}]`);
console.log(`   综合分数：${top5Combo.map(n => allScores.get(n) || 0).reduce((a,b) => a+b, 0)}`);

// 间隔9的Top5组合
const top5_9 = result9.combinations.slice(0, 5);
console.log(`\n📊 间隔9 Top5组合：`);
top5_9.forEach((combo, i) => {
  console.log(`   Top${i+1}: [${combo.numbers.join(', ')}]`);
});

// 间隔10的Top5组合
const top5_10 = result10.combinations.slice(0, 5);
console.log(`\n📊 间隔10 Top5组合：`);
top5_10.forEach((combo, i) => {
  console.log(`   Top${i+1}: [${combo.numbers.join(', ')}]`);
});

// 联合Top5覆盖（两个间隔的Top5合并去重）
const union5 = new Set();
top5_9.forEach(c => c.numbers.forEach(n => union5.add(n)));
top5_10.forEach(c => c.numbers.forEach(n => union5.add(n)));

console.log(`\n🔗 联合Top5覆盖（9+10合并去重）：`);
console.log(`   覆盖号码：${[...union5].sort((a,b) => a-b).join(', ')}`);
console.log(`   覆盖数量：${union5.size}个`);

// 补漏6策略
console.log(`\n${'═'.repeat(70)}`);
console.log("🔍 补漏6策略（覆盖Top5未覆盖的池号码）");
console.log('═'.repeat(70));

const top5Covered = new Set(top5Combo);
const bulou6 = unionSorted.filter(n => !top5Covered.has(n)).slice(0, 6);
console.log(`\n补漏6：[${bulou6.join(', ')}]`);

// 综合推荐
console.log(`\n${'═'.repeat(70)}`);
console.log("💡 综合推荐");
console.log('═'.repeat(70));

console.log(`
🎯 前区推荐：
   Top1组合：[${top5Combo.join(', ')}]
   补漏6：[${bulou6.join(', ')}]
   联合覆盖：${union5.size}个号码

📊 策略说明：
   - 主策略：间隔9+10并集池（覆盖率90.9%）
   - Top5选择：并集池中综合分数最高的5个
   - 补漏6：覆盖Top5未覆盖的池号码
`);

// 后区预测
console.log("═".repeat(70));
console.log("🎱 后区预测");
console.log('═'.repeat(70));

const backResult = picker.predictBack(picker.ALL_DRAWS.length - 1);
if (backResult) {
  console.log(`\n   后区推荐：${backResult.slice(0, 2).join(', ')}`);
  console.log(`   备选：${backResult.slice(2, 4).join(', ')}`);
}

console.log(`\n${'═'.repeat(70)}`);
console.log("⚠️  免责声明：彩票预测仅供参考，投注需谨慎！");
console.log('═'.repeat(70));
