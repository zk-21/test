/**
 * backtest_v5_batch_opt.js — V5 参数批量优化测试
 * 对 backtest_v5_standalone.js 做参数替换，批量运行，找到最优组合
 * 
 * 运行：node backtest_v5_batch_opt.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC = path.join(__dirname, 'backtest_v5_standalone.js');
const srcCode = fs.readFileSync(SRC, 'utf8');

// 从输出中提取3个关键指标
function parseMetrics(stdout) {
  const m1 = stdout.match(/Top5最高命中率:\s*([\d.]+)%/);
  const m2 = stdout.match(/Top5\+补漏6 联合覆盖率:\s*([\d.]+)%/);
  const m3 = stdout.match(/候选池覆盖率\s*\(Top30\):\s*([\d.]+)%/);
  return {
    top5: m1 ? parseFloat(m1[1]) : 0,
    joint: m2 ? parseFloat(m2[1]) : 0,
    pool: m3 ? parseFloat(m3[1]) : 0,
  };
}

// 替换参数并运行一次回测
function runTest(params, label) {
  let code = srcCode;
  
  // 1. 配对权重
  if (params.pair1W !== undefined) {
    code = code.replace(
      /const pair1 = buildPair\(nTail, nOff, [\d.]+, [\d.]+\);/,
      `const pair1 = buildPair(nTail, nOff, ${params.pair1W[0]}, ${params.pair1W[1]});`
    );
  }
  if (params.pair2W !== undefined) {
    code = code.replace(
      /const pair2 = buildPair\(nHot, nFreq, [\d.]+, [\d.]+\);/,
      `const pair2 = buildPair(nHot, nFreq, ${params.pair2W[0]}, ${params.pair2W[1]});`
    );
  }
  if (params.pair3W !== undefined) {
    code = code.replace(
      /const pair3 = buildPair\(nBr, nAr, [\d.]+, [\d.]+\);/,
      `const pair3 = buildPair(nBr, nAr, ${params.pair3W[0]}, ${params.pair3W[1]});`
    );
  }
  
  // 2. 候选池大小
  if (params.poolSize !== undefined) {
    code = code.replace(
      /const pool30 = new Set\(candidates\.slice\(0, \d+\)/,
      `const pool30 = new Set(candidates.slice(0, ${params.poolSize})`
    );
  }
  
  // 3. 去重阈值 - 组内
  if (params.dedupWithin !== undefined) {
    // 第一个出现的 o >= 3 (组内多样性)
    code = code.replace(
      /if \(o >= \d+\) \{ sim = true; break; \}/,
      `if (o >= ${params.dedupWithin}) { sim = true; break; }`
    );
  }
  
  // 4. 跨维度去重阈值
  if (params.dedupCross !== undefined) {
    // 第二个出现的 o >= 4 (跨维度去重)
    // 需要更精确的替换 - 使用上下文
    code = code.replace(
      /const final = \[\], fk = new Set\(\);[\s\S]*?if \(o >= \d+\) \{ sim = true; break; \}/,
      (m) => m.replace(/if \(o >= \d+\)/, `if (o >= ${params.dedupCross})`)
    );
  }
  
  // 5. 尾号权重
  if (params.tailSame !== undefined) {
    code = code.replace(/const V4_TAIL_SAME = \d+;/, `const V4_TAIL_SAME = ${params.tailSame};`);
  }
  if (params.tailNeighbor !== undefined) {
    code = code.replace(/const V4_TAIL_NEIGHBOR = \d+;/, `const V4_TAIL_NEIGHBOR = ${params.tailNeighbor};`);
  }
  
  // 写入临时文件并运行
  const tmpFile = path.join(__dirname, '_tmp_v5_test.js');
  fs.writeFileSync(tmpFile, code);
  
  try {
    const stdout = execSync(`node "${tmpFile}"`, { 
      encoding: 'utf8', 
      timeout: 120000,
      cwd: __dirname 
    });
    const metrics = parseMetrics(stdout);
    fs.unlinkSync(tmpFile);
    return metrics;
  } catch (e) {
    try { fs.unlinkSync(tmpFile); } catch(_){}
    return { top5: 0, joint: 0, pool: 0, error: e.message.substring(0, 100) };
  }
}

// ======================== 基准测试 ========================
console.log('='.repeat(80));
console.log('V5 参数批量优化测试');
console.log('='.repeat(80));

const baseline = runTest({}, 'BASELINE');
console.log(`\n[BASELINE] Top5: ${baseline.top5}% | Joint: ${baseline.joint}% | Pool: ${baseline.pool}%`);

const results = [{ label: 'BASELINE', ...baseline }];

// ======================== 1. 配对权重测试 ========================
console.log('\n--- 1. 配对权重优化 ---');

const pairTests = [
  { label: 'P1: tail0.6/offset0.4', pair1W: [0.6, 0.4] },
  { label: 'P1: tail0.7/offset0.3', pair1W: [0.7, 0.3] },
  { label: 'P1: tail0.5/offset0.5', pair1W: [0.5, 0.5] },
  { label: 'P1: tail0.65/offset0.35', pair1W: [0.65, 0.35] },
  { label: 'P2: hot0.6/freq0.4', pair2W: [0.6, 0.4] },
  { label: 'P2: hot0.4/freq0.6', pair2W: [0.4, 0.6] },
  { label: 'P3: br0.6/ar0.4', pair3W: [0.6, 0.4] },
  { label: 'P3: br0.4/ar0.6', pair3W: [0.4, 0.6] },
];

for (const t of pairTests) {
  const r = runTest(t, t.label);
  const deltaT5 = (r.top5 - baseline.top5).toFixed(1);
  const deltaJ = (r.joint - baseline.joint).toFixed(1);
  const deltaP = (r.pool - baseline.pool).toFixed(1);
  const mark = (r.top5 > baseline.top5 || r.joint > baseline.joint) ? ' ***' : '';
  console.log(`  ${t.label.padEnd(30)} Top5: ${r.top5}%(${deltaT5>0?'+':''}${deltaT5}) Joint: ${r.joint}%(${deltaJ>0?'+':''}${deltaJ}) Pool: ${r.pool}%${mark}`);
  results.push({ label: t.label, ...r });
}

// ======================== 2. 候选池大小测试 ========================
console.log('\n--- 2. 候选池大小优化 ---');

const poolTests = [
  { label: 'Pool25', poolSize: 25 },
  { label: 'Pool28', poolSize: 28 },
  { label: 'Pool32', poolSize: 32 },
  { label: 'Pool35', poolSize: 35 },
  { label: 'Pool20', poolSize: 20 },
];

for (const t of poolTests) {
  const r = runTest(t, t.label);
  const deltaT5 = (r.top5 - baseline.top5).toFixed(1);
  const deltaJ = (r.joint - baseline.joint).toFixed(1);
  const mark = (r.top5 > baseline.top5 || r.joint > baseline.joint) ? ' ***' : '';
  console.log(`  ${t.label.padEnd(30)} Top5: ${r.top5}%(${deltaT5>0?'+':''}${deltaT5}) Joint: ${r.joint}%(${deltaJ>0?'+':''}${deltaJ}) Pool: ${r.pool}%${mark}`);
  results.push({ label: t.label, ...r });
}

// ======================== 3. 去重阈值测试 ========================
console.log('\n--- 3. 去重阈值优化 ---');

const dedupTests = [
  { label: 'DedupWithin=2', dedupWithin: 2 },
  { label: 'DedupWithin=4', dedupWithin: 4 },
  { label: 'DedupCross=3', dedupCross: 3 },
  { label: 'DedupCross=5', dedupCross: 5 },
];

for (const t of dedupTests) {
  const r = runTest(t, t.label);
  const deltaT5 = (r.top5 - baseline.top5).toFixed(1);
  const deltaJ = (r.joint - baseline.joint).toFixed(1);
  const mark = (r.top5 > baseline.top5 || r.joint > baseline.joint) ? ' ***' : '';
  console.log(`  ${t.label.padEnd(30)} Top5: ${r.top5}%(${deltaT5>0?'+':''}${deltaT5}) Joint: ${r.joint}%(${deltaJ>0?'+':''}${deltaJ}) Pool: ${r.pool}%${mark}`);
  results.push({ label: t.label, ...r });
}

// ======================== 4. 尾号权重测试 ========================
console.log('\n--- 4. 尾号权重优化 ---');

const tailTests = [
  { label: 'TailSame=40', tailSame: 40 },
  { label: 'TailSame=30', tailSame: 30 },
  { label: 'TailSame=45', tailSame: 45 },
  { label: 'TailNeighbor=20', tailNeighbor: 20 },
  { label: 'TailNeighbor=10', tailNeighbor: 10 },
];

for (const t of tailTests) {
  const r = runTest(t, t.label);
  const deltaT5 = (r.top5 - baseline.top5).toFixed(1);
  const deltaJ = (r.joint - baseline.joint).toFixed(1);
  const mark = (r.top5 > baseline.top5 || r.joint > baseline.joint) ? ' ***' : '';
  console.log(`  ${t.label.padEnd(30)} Top5: ${r.top5}%(${deltaT5>0?'+':''}${deltaT5}) Joint: ${r.joint}%(${deltaJ>0?'+':''}${deltaJ}) Pool: ${r.pool}%${mark}`);
  results.push({ label: t.label, ...r });
}

// ======================== 汇总排名 ========================
console.log('\n' + '='.repeat(80));
console.log('汇总排名（按联合覆盖率降序）');
console.log('='.repeat(80));

results.sort((a, b) => b.joint - a.joint || b.top5 - a.top5);

console.log('  ' + '排名'.padEnd(4) + '方案'.padEnd(32) + 'Top5%'.padEnd(8) + 'Joint%'.padEnd(9) + 'Pool%');
console.log('  ' + '-'.repeat(65));
results.forEach((r, i) => {
  const deltaJ = (r.joint - baseline.joint).toFixed(1);
  const mark = r.label === 'BASELINE' ? ' [基准]' : (r.joint > baseline.joint ? ' ↑' : '');
  console.log(`  ${(i+1).toString().padEnd(4)}${r.label.padEnd(32)}${r.top5.toFixed(1).padEnd(8)}${r.joint.toFixed(1).padEnd(9)}${r.pool.toFixed(1)}${mark}`);
});

// 输出最优组合
const best = results[0];
console.log(`\n最优方案: ${best.label}`);
console.log(`  Top5: ${best.top5}% | Joint: ${best.joint}% | Pool: ${best.pool}%`);
console.log(`  相对基准: Top5 ${(best.top5-baseline.top5).toFixed(1)}pp | Joint ${(best.joint-baseline.joint).toFixed(1)}pp | Pool ${(best.pool-baseline.pool).toFixed(1)}pp`);
