/**
 * 2026043期预测 - V4模式（间隔9+10并集池策略）
 * 
 * 对齐 script.js buildSampleNumbersV4 的 V4 评分管线：
 * - 间隔9+10并集池趋势映射（权重0.7:0.3）
 * - 多维度号码评分（S1-S10）
 * - 补漏6（补盲区策略）
 * 
 * 源期数据：
 * - 2026043: [8, 12, 14, 19, 22]  后区 [11, 12]
 */

const fs = require('fs');
const path = require('path');

let code = fs.readFileSync(path.join(__dirname, 'optimized_picker.js'), 'utf-8');
const cliStart = code.indexOf('\nconst args = process.argv.slice');
if (cliStart > 0) code = code.substring(0, cliStart);

const wrappedCode = "(function() {\n  var module = { exports: {} };\n  var exports = module.exports;\n  " + code + "\n  return { predict, predictNext, predictBack, ALL_DRAWS, issueMap, buildPairs };\n})()";

const picker = eval(wrappedCode);

// ===== 辅助函数 =====
function intervalRatio(nums) {
  const z = [0, 0, 0];
  nums.forEach(n => {
    if (n <= 12) z[0]++;
    else if (n <= 24) z[1]++;
    else z[2]++;
  });
  return z;
}

function oddCount(nums) { return nums.filter(n => n % 2 === 1).length; }
function sum(nums) { return nums.reduce((a, b) => a + b, 0); }
function span(nums) { return nums.length > 0 ? Math.max(...nums) - Math.min(...nums) : 0; }

console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║        🎯 2026043期预测（V4模式：间隔9+10并集池策略）               ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

// 目标期：2026043
const targetIssue = '2026043';
const targetNum = parseInt(targetIssue.slice(4));

// 间隔9源期和间隔10源期
const source9Issue = targetIssue.slice(0, 4) + String(targetNum - 9).padStart(3, '0');
const source10Issue = targetIssue.slice(0, 4) + String(targetNum - 10).padStart(3, '0');

console.log(`🎯 目标期：${targetIssue}`);
console.log(`📊 间隔9源期：${source9Issue}`);
console.log(`📊 间隔10源期：${source10Issue}\n`);

// 检查源期是否存在
if (!picker.issueMap[source9Issue] || !picker.issueMap[source10Issue]) {
  console.log("❌ 源期数据不存在，无法预测");
  process.exit(1);
}

const source9Draw = picker.issueMap[source9Issue];
const source10Draw = picker.issueMap[source10Issue];
const targetDraw = picker.issueMap[targetIssue]; // 实际开奖号码（用于验证）

console.log(`📍 间隔9源期：${source9Issue} → [${source9Draw.front.join(', ')}]  后区 [${source9Draw.back.join(', ')}]`);
console.log(`📍 间隔10源期：${source10Issue} → [${source10Draw.front.join(', ')}]  后区 [${source10Draw.back.join(', ')}]`);
console.log(`📍 目标期：${targetIssue} → [${targetDraw.front.join(', ')}]  后区 [${targetDraw.back.join(', ')}]\n`);

// 运行预测
const result9 = picker.predict(source9Issue, null, true);
const result10 = picker.predict(source10Issue, null, true);

if (!result9 || !result10) {
  console.log("❌ 预测失败");
  process.exit(1);
}

// ===== 并集池构建 =====
const pool9 = new Set(result9.pool.map(p => p.number));
const pool10 = new Set(result10.pool.map(p => p.number));
const unionPool = new Set([...pool9, ...pool10]);

// 综合分数（加权：间隔9=0.7, 间隔10=0.3）
const allScores = new Map();
result9.pool.forEach(p => allScores.set(p.number, (allScores.get(p.number) || 0) + p.score * 0.7));
result10.pool.forEach(p => allScores.set(p.number, (allScores.get(p.number) || 0) + p.score * 0.3));

// 按综合分数排序
const unionSorted = [...unionPool].sort((a, b) => (allScores.get(b) || 0) - (allScores.get(a) || 0));

console.log("═".repeat(70));
console.log("📊 并集池分析");
console.log("═".repeat(70));

console.log(`\n📦 号码池统计：`);
console.log(`   间隔9池：${pool9.size}个`);
console.log(`   间隔10池：${pool10.size}个`);
console.log(`   并集池大小：${unionPool.size}个`);

// 间隔10独有号码
const only10 = [...pool10].filter(n => !pool9.has(n));
const only9 = [...pool9].filter(n => !pool10.has(n));
console.log(`   间隔9独有：[${only9.join(', ')}]（${only9.length}个）`);
console.log(`   间隔10独有：[${only10.join(', ')}]（${only10.length}个）`);
console.log(`   重叠号码：${[...pool9].filter(n => pool10.has(n)).length}个`);

// 实际覆盖率（如果有目标期数据）
if (targetDraw) {
  const targetSet = new Set(targetDraw.front);
  const pool9Hit = [...pool9].filter(n => targetSet.has(n));
  const pool10Hit = [...pool10].filter(n => targetSet.has(n));
  const unionHit = [...unionPool].filter(n => targetSet.has(n));
  console.log(`\n🎯 实际覆盖率（目标期 [${targetDraw.front.join(', ')}]）：`);
  console.log(`   间隔9池：${pool9Hit.length}/5 (${pool9Hit.length * 20}%) → [${pool9Hit.join(', ')}]`);
  console.log(`   间隔10池：${pool10Hit.length}/5 (${pool10Hit.length * 20}%) → [${pool10Hit.join(', ')}]`);
  console.log(`   并集池：${unionHit.length}/5 (${unionHit.length * 20}%) → [${unionHit.join(', ')}]`);
}

// ===== Top5组合生成 =====
console.log(`\n${'═'.repeat(70)}`);
console.log("🏆 Top5组合（并集池综合分数最高选择）");
console.log('═'.repeat(70));

// 从并集池中按分数选Top5
const top5Numbers = unionSorted.slice(0, 5);
console.log(`\n🎯 Top1：[${top5Numbers.join(', ')}]`);
console.log(`   综合分数：${top5Numbers.map(n => Math.round((allScores.get(n) || 0) * 10) / 10).join(' + ')} = ${Math.round(top5Numbers.reduce((s, n) => s + (allScores.get(n) || 0), 0) * 10) / 10}`);
console.log(`   和值：${sum(top5Numbers)}  跨度：${span(top5Numbers)}  奇偶：${oddCount(top5Numbers)}:${5 - oddCount(top5Numbers)}  区间比：${intervalRatio(top5Numbers).join(':')}`);
console.log(`   尾号：[${top5Numbers.map(n => n % 10).join(', ')}]`);

// 间隔9的Top5组合
const top5_9 = result9.combinations.slice(0, 5);
console.log(`\n📊 间隔9 Top5组合：`);
top5_9.forEach((combo, i) => {
  const s = sum(combo.numbers);
  console.log(`   Top${i+1}: [${combo.numbers.join(', ')}] 和值=${s} ${combo.score ? '分数=' + Math.round(combo.score) : ''}`);
});

// 间隔10的Top5组合
const top5_10 = result10.combinations.slice(0, 5);
console.log(`\n📊 间隔10 Top5组合：`);
top5_10.forEach((combo, i) => {
  const s = sum(combo.numbers);
  console.log(`   Top${i+1}: [${combo.numbers.join(', ')}] 和值=${s} ${combo.score ? '分数=' + Math.round(combo.score) : ''}`);
});

// ===== 联合Top5覆盖分析 =====
const top5UnionCovered = new Set();
top5_9.forEach(c => c.numbers.forEach(n => top5UnionCovered.add(n)));
top5_10.forEach(c => c.numbers.forEach(n => top5UnionCovered.add(n)));

console.log(`\n🔗 联合Top5覆盖（9+10各5组去重）：`);
console.log(`   覆盖号码：[${[...top5UnionCovered].sort((a, b) => a - b).join(', ')}]`);
console.log(`   覆盖数量：${top5UnionCovered.size}个`);

if (targetDraw) {
  const targetSet = new Set(targetDraw.front);
  const jointHit = [...top5UnionCovered].filter(n => targetSet.has(n));
  const jointHitSet = new Set(jointHit);
  console.log(`   实际命中：${jointHit.length}/5 → 覆盖${jointHit.map(n => `✓${n}`).join(', ')}`);
  
  // Top1组合单独命中
  const top1Hit = top5Numbers.filter(n => targetSet.has(n));
  console.log(`\n🎯 Top1命中检测：[${top5Numbers.join(', ')}]`);
  console.log(`   命中号码：${top1Hit.length}/5 → [${top1Hit.join(', ')}]（${top1Hit.length > 0 ? '✓' : '✗'}）`);
  
  // 各Top组合命中数
  console.log(`\n📊 各组合命中统计：`);
  const allTopCombos = [...top5_9, ...top5_10];
  const comboHits = [];
  top5_9.forEach((combo, i) => {
    const hits = combo.numbers.filter(n => targetSet.has(n));
    comboHits.push({ label: `间隔9-Top${i+1}`, numbers: combo.numbers, hits: hits.length, hitNums: hits });
  });
  top5_10.forEach((combo, i) => {
    const hits = combo.numbers.filter(n => targetSet.has(n));
    comboHits.push({ label: `间隔10-Top${i+1}`, numbers: combo.numbers, hits: hits.length, hitNums: hits });
  });
  comboHits.sort((a, b) => b.hits - a.hits);
  comboHits.forEach(c => {
    const mark = c.hits >= 3 ? '★★★' : c.hits >= 2 ? '★★' : c.hits >= 1 ? '★' : '  ';
    console.log(`   ${mark} ${c.label}: [${c.numbers.join(', ')}] → 命中${c.hits}球 [${c.hitNums.join(', ')}]`);
  });
}

// ===== 补漏6（补盲区策略） =====
console.log(`\n${'═'.repeat(70)}`);
console.log("🔍 补漏6（补盲区策略 - 覆盖Top5未覆盖的并集池号码）");
console.log('═'.repeat(70));

// 构建已覆盖集合（并集池Top5）
const top5Covered = new Set(top5Numbers);

// 热度分析
const TOP5_FREQ = new Map();
top5Numbers.forEach(n => TOP5_FREQ.set(n, 1));

// 遗漏/热号
const srcIdx = picker.ALL_DRAWS.map(d => d.issue).indexOf(targetIssue);
const missMap = new Map(), hotMap = new Map();
for (let n = 1; n <= 35; n++) {
  let m = 0, h = 0;
  for (let i = srcIdx - 1; i >= Math.max(0, srcIdx - 20); i--) { if (picker.ALL_DRAWS[i].front.includes(n)) break; m++; }
  for (let i = srcIdx - 1; i >= Math.max(0, srcIdx - 10); i--) { if (picker.ALL_DRAWS[i].front.includes(n)) h++; }
  missMap.set(n, m); hotMap.set(n, h);
}

// 区间平衡
const top5Iv = [0, 0, 0];
top5Numbers.forEach(n => { if (n <= 12) top5Iv[0]++; else if (n <= 24) top5Iv[1]++; else top5Iv[2]++; });
const ivMin = top5Iv.indexOf(Math.min(...top5Iv));

// 预测尾号
const predictedTails = new Set(result9.predictedTails ? result9.predictedTails.slice(0, 5).map(([t]) => t) : []);

// 补漏6评分
const c6Scored = unionSorted
  .filter(n => !top5Covered.has(n))
  .map(n => {
    let s = allScores.get(n) || 0;
    const miss = missMap.get(n) || 0, hot = hotMap.get(n) || 0;
    if (predictedTails.has(n % 10)) s += 10;
    const zone = n <= 12 ? 0 : n <= 24 ? 1 : 2;
    if (zone === ivMin) s += 6;
    if (hot >= 3) s += 8; else if (hot >= 2) s += 4;
    if (miss >= 10) s += 5; else if (miss >= 7) s += 3;
    s += 25; // 补盲区核心加分
    let md = Infinity; top5Numbers.forEach(cn => { const d = Math.abs(n - cn); if (d < md) md = d; });
    if (md === 1) s += 12; else if (md === 2) s += 6; else if (md === 3) s += 3;
    return { number: n, score6: s };
  })
  .sort((a, b) => b.score6 - a.score6);

const bulou6 = c6Scored.length >= 5 ? c6Scored.slice(0, 5).map(e => e.number).sort((a, b) => a - b) : [];

console.log(`\n📋 补漏6号码：[${bulou6.join(', ')}]`);
console.log(`   和值：${sum(bulou6)}  跨度：${span(bulou6)}  区间比：${intervalRatio(bulou6).join(':')}`);
console.log(`   尾号分布：[${bulou6.map(n => n % 10).join(', ')}]`);

console.log(`\n📊 补漏6评分详情：`);
c6Scored.slice(0, 10).forEach((e, i) => {
  const mark = i < 5 ? '✓' : '  ';
  console.log(`   ${mark} #${i+1}: ${String(e.number).padStart(2)}  分数=${Math.round(e.score6 * 10) / 10}`);
});

// 联合覆盖（Top1 + 补漏6）
const allSelected = new Set([...top5Numbers, ...bulou6]);
console.log(`\n📊 联合覆盖（Top1 + 补漏6）：`);
console.log(`   覆盖号码：[${[...allSelected].sort((a, b) => a - b).join(', ')}]`);
console.log(`   覆盖数量：${allSelected.size}个`);

if (targetDraw) {
  const targetSet = new Set(targetDraw.front);
  const allHit = [...allSelected].filter(n => targetSet.has(n));
  console.log(`   实际命中：${allHit.length}/5 → [${allHit.join(', ')}]`);
  
  const top1Hit = top5Numbers.filter(n => targetSet.has(n));
  const bulou6Hit = bulou6.filter(n => targetSet.has(n));
  console.log(`   Top1贡献：${top1Hit.length}球  +  补漏6贡献：${bulou6Hit.length}球`);
  if (bulou6Hit.length > 0) console.log(`   ✨ 补漏6新增覆盖：[${bulou6Hit.join(', ')}]`);
}

// ===== 后区预测 =====
console.log(`\n${'═'.repeat(70)}`);
console.log("🎱 后区预测");
console.log('═'.repeat(70));

const backResult = picker.predictBack(srcIdx);
if (backResult) {
  console.log(`\n   后区推荐：[${backResult.slice(0, 2).join(', ')}]`);
  console.log(`   备选：[${backResult.slice(2, 4).join(', ')}]`);
  console.log(`   完整排序：[${backResult.join(', ')}]`);
  
  if (targetDraw) {
    const backHit = backResult.slice(0, 4).filter(n => targetDraw.back.includes(n));
    console.log(`   实际命中：${backHit.length}/2 → [${backHit.join(', ')}]${backHit.length >= 1 ? ' ✓' : ' ✗'}`);
  }
}

// ===== 综合推荐 =====
console.log(`\n${'═'.repeat(70)}`);
console.log("💡 V4模式综合推荐");
console.log('═'.repeat(70));

console.log(`
🎯 前区推荐（间隔9+10并集池 V4模式）：
   源期：${source9Issue} + ${source10Issue}
   主组合：[${top5Numbers.join(', ')}]
   补漏6：[${bulou6.join(', ')}]
   联合覆盖：${allSelected.size}个号码
   
📊 策略配置：
   - 趋势映射：间隔9+10并集池（权重0.7:0.3）
   - 号码池：${unionPool.size}球
   - 评分体系：V4多维度（S1-S10）
   - 补漏6：补盲区策略

⚠️  免责声明：彩票预测仅供参考，投注需谨慎！
`);

// ===== 结果汇总表 =====
console.log("═".repeat(70));
console.log("📋 对比基准");
console.log('═'.repeat(70));

// 纯间隔9对比
const pool9HitCompare = [...pool9].filter(n => new Set(targetDraw.front).has(n));
const pool10HitCompare = [...pool10].filter(n => new Set(targetDraw.front).has(n));
const unionHitCompare = [...unionPool].filter(n => new Set(targetDraw.front).has(n));

console.log(`
指标                    | 间隔9    | 间隔10   | 并集池   
------------------------|----------|----------|----------
号码池大小              | ${String(pool9.size).padStart(8)} | ${String(pool10.size).padStart(8)} | ${String(unionPool.size).padStart(8)}
命中目标期              | ${String(pool9HitCompare.length).padStart(6)}/5  | ${String(pool10HitCompare.length).padStart(6)}/5  | ${String(unionHitCompare.length).padStart(6)}/5
命中率                  | ${String(Math.round(pool9HitCompare.length / 5 * 100)).padStart(7)}% | ${String(Math.round(pool10HitCompare.length / 5 * 100)).padStart(7)}% | ${String(Math.round(unionHitCompare.length / 5 * 100)).padStart(7)}%
`);
