// Quick complement test runner
const fs = require('fs');
const vm = require('vm');

let content = fs.readFileSync('./optimized_picker.js', 'utf-8');
// Remove the run entry section
content = content.replace(/\/\/ ===================== 运行入口 =====================[\s\S]*$/, '');

// Create sandbox with all needed globals
const sandbox = {
  console,
  Math,
  parseInt,
  parseFloat,
  String,
  Number,
  Array,
  Object,
  Map,
  Set,
  Date,
  Infinity,
  NaN,
  undefined,
  isNaN,
  isFinite,
  JSON,
  process: { argv: [], env: {} },
  require,
};

vm.runInNewContext(content, sandbox);

// Access functions from sandbox
const predict = sandbox.predict;
const buildPairs = sandbox.buildPairs;
const issueMap = sandbox.issueMap;

console.log('Module loaded, predict:', typeof predict);

// Run complement test
function complementTest() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║           间隔10和间隔12互补策略测试 (+12趋势信号集成后)           ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  const pairs10 = buildPairs(10);
  const pairs12 = buildPairs(12);

  console.log(`间隔10配对数: ${pairs10.length}`);
  console.log(`间隔12配对数: ${pairs12.length}`);

  const targetMap10 = new Map();
  pairs10.forEach(([s, t]) => targetMap10.set(t, s));
  const targetMap12 = new Map();
  pairs12.forEach(([s, t]) => targetMap12.set(t, s));

  const commonTargets = [...targetMap10.keys()].filter(t => targetMap12.has(t));
  console.log(`共同目标期数: ${commonTargets.length}\n`);

  let totalPool10Hits = 0, totalPool12Hits = 0, totalUnionHits = 0;
  let totalTop1_10 = 0, totalTop1_12 = 0;
  let totalUnion5_10 = 0, totalUnion5_12 = 0, totalUnion5_comp = 0;
  let totalPairs = 0;
  let only10Better = 0, only12Better = 0, poolEqual = 0;
  let bestSum10 = 0, bestSum12 = 0, bestSumComp = 0;
  let b3plus10 = 0, b3plus12 = 0, b3plusComp = 0;

  commonTargets.forEach(targetIssue => {
    const source10 = targetMap10.get(targetIssue);
    const source12 = targetMap12.get(targetIssue);

    const r10 = predict(source10, null, true);
    const r12 = predict(source12, null, true);
    if (!r10 || !r12) return;

    const td = issueMap[targetIssue];
    if (!td) return;
    const ts = new Set(td.front);

    // Pool coverage
    const p10 = new Set(r10.pool.map(p => p.number));
    const p12 = new Set(r12.pool.map(p => p.number));
    const uni = new Set([...p10, ...p12]);

    const h10 = [...p10].filter(n => ts.has(n)).length;
    const h12 = [...p12].filter(n => ts.has(n)).length;
    const hu = [...uni].filter(n => ts.has(n)).length;

    totalPool10Hits += h10;
    totalPool12Hits += h12;
    totalUnionHits += hu;

    // Top1
    const t1_10 = (r10.combinations[0]?.numbers || []).filter(n => ts.has(n)).length;
    const t1_12 = (r12.combinations[0]?.numbers || []).filter(n => ts.has(n)).length;
    totalTop1_10 += t1_10;
    totalTop1_12 += t1_12;

    // Union Top5
    const u5_10 = new Set();
    r10.combinations.slice(0, 5).forEach(c => c.numbers.forEach(n => u5_10.add(n)));
    const u5_12 = new Set();
    r12.combinations.slice(0, 5).forEach(c => c.numbers.forEach(n => u5_12.add(n)));
    const u5c = new Set([...u5_10, ...u5_12]);

    totalUnion5_10 += [...u5_10].filter(n => ts.has(n)).length;
    totalUnion5_12 += [...u5_12].filter(n => ts.has(n)).length;
    totalUnion5_comp += [...u5c].filter(n => ts.has(n)).length;

    // Best combo
    let b10 = 0, b12 = 0;
    r10.combinations.slice(0, 5).forEach(c => { const h = c.numbers.filter(n => ts.has(n)).length; b10 = Math.max(b10, h); });
    r12.combinations.slice(0, 5).forEach(c => { const h = c.numbers.filter(n => ts.has(n)).length; b12 = Math.max(b12, h); });
    const bComp = Math.max(b10, b12);

    bestSum10 += b10; bestSum12 += b12; bestSumComp += bComp;
    if (b10 >= 3) b3plus10++; if (b12 >= 3) b3plus12++; if (bComp >= 3) b3plusComp++;

    if (h10 > h12) only10Better++;
    else if (h12 > h10) only12Better++;
    else poolEqual++;

    totalPairs++;
  });

  const B = totalPairs * 5;

  console.log('─'.repeat(70));
  console.log('  📊 互补策略汇总统计 (+12趋势信号集成后)');
  console.log('─'.repeat(70));
  console.log(`\n  总测试期数: ${totalPairs}`);

  console.log(`\n  📦 号码池覆盖率 (24球池):`);
  console.log(`     间隔10池: ${totalPool10Hits}/${B} (${(totalPool10Hits / B * 100).toFixed(1)}%)`);
  console.log(`     间隔12池: ${totalPool12Hits}/${B} (${(totalPool12Hits / B * 100).toFixed(1)}%)`);
  console.log(`     并集池:   ${totalUnionHits}/${B} (${(totalUnionHits / B * 100).toFixed(1)}%)`);
  console.log(`     提升:     +${totalUnionHits - Math.max(totalPool10Hits, totalPool12Hits)} 命中 (+${((totalUnionHits - Math.max(totalPool10Hits, totalPool12Hits)) / B * 100).toFixed(1)}%)`);

  console.log(`\n  🎯 Top1命中率:`);
  console.log(`     间隔10: ${totalTop1_10}/${B} (${(totalTop1_10 / B * 100).toFixed(1)}%)`);
  console.log(`     间隔12: ${totalTop1_12}/${B} (${(totalTop1_12 / B * 100).toFixed(1)}%)`);

  console.log(`\n  🏆 Top5联合覆盖率:`);
  console.log(`     间隔10: ${totalUnion5_10}/${B} (${(totalUnion5_10 / B * 100).toFixed(1)}%)`);
  console.log(`     间隔12: ${totalUnion5_12}/${B} (${(totalUnion5_12 / B * 100).toFixed(1)}%)`);
  console.log(`     互补:   ${totalUnion5_comp}/${B} (${(totalUnion5_comp / B * 100).toFixed(1)}%)`);
  console.log(`     提升:   +${totalUnion5_comp - Math.max(totalUnion5_10, totalUnion5_12)} (+${((totalUnion5_comp - Math.max(totalUnion5_10, totalUnion5_12)) / B * 100).toFixed(1)}%)`);

  console.log(`\n  ⭐ 最佳组合命中:`);
  console.log(`     间隔10: ${(bestSum10/totalPairs).toFixed(2)}球/对 | ≥3球:${b3plus10}/${totalPairs}(${(b3plus10/totalPairs*100).toFixed(1)}%)`);
  console.log(`     间隔12: ${(bestSum12/totalPairs).toFixed(2)}球/对 | ≥3球:${b3plus12}/${totalPairs}(${(b3plus12/totalPairs*100).toFixed(1)}%)`);
  console.log(`     互补:   ${(bestSumComp/totalPairs).toFixed(2)}球/对 | ≥3球:${b3plusComp}/${totalPairs}(${(b3plusComp/totalPairs*100).toFixed(1)}%)`);

  console.log(`\n  📊 互补分析:`);
  console.log(`     间隔10更好: ${only10Better}期 (${(only10Better/totalPairs*100).toFixed(1)}%)`);
  console.log(`     间隔12更好: ${only12Better}期 (${(only12Better/totalPairs*100).toFixed(1)}%)`);
  console.log(`     两者相同:   ${poolEqual}期 (${(poolEqual/totalPairs*100).toFixed(1)}%)`);
}

complementTest();
