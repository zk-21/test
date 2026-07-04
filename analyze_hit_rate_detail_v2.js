/**
 * 分析 Top1-Top5 + 补漏6 前后区每注命中率 & 号码池覆盖率
 * 输出 JSON + CSV + Excel，用于后续参数优化对比
 * v2: 补盲区策略，直接使用 predict() 返回的 bulou6
 */
const fs = require('fs');

// ═══ 用 eval 加载 optimized_picker.js ═══
process.argv = ['node', 'optimized_picker.js', '--skip-all'];
var code = fs.readFileSync('./optimized_picker.js', 'utf8');
code = code.replace(/args\.includes\("--backtest"\)/g, 'false');
code = code.replace(/args\.includes\("--validate"\)/g, 'false');
code = code.replace(/args\.includes\("--sensitivity"\)/g, 'false');
code = code.replace(/args\.includes\("--quicktest"\)/g, 'false');
code = code.replace(/args\.includes\("--demo"\)/g, 'false');
code = code.replace(/args\.includes\("--predict"\)/g, 'false');
code = code.replace(/args\.includes\("--ideal"\)/g, 'false');
code = code.replace(/args\.includes\("--single"\)/g, 'false');
code = code.replace(/args\.length === 0/g, 'false');
code = code.replace(/\bconst\b/g, 'var');
code = code.replace(/\blet\b/g, 'var');
eval(code);

// ═══ 分析 ═══
console.log("═".repeat(70));
console.log("  📊 Top1-Top5 + 补漏6(补盲区) 前后区命中率 & 号码池覆盖率");
console.log("═".repeat(70));

const fp = buildPairs(10);
const iss = ALL_DRAWS.map(d => d.issue);
console.log(`  总配对: ${fp.length}\n`);

const res = [];

fp.forEach(([sI, tI]) => {
  const si = iss.indexOf(sI);
  if (si + 9 >= ALL_DRAWS.length) return;

  const r = predict(sI, null, true);
  if (!r) return;

  const t = issueMap[tI];
  if (!t) return;

  const ts = new Set(t.front);
  const pn = r.pool.map(e => e.number);

  // 前区 Top1-Top5
  const t5 = r.combinations.slice(0, 5).map((c, i) => {
    const h = c.numbers.filter(n => ts.has(n)).length;
    return { rank: i+1, numbers: c.numbers, hitCount: h, hitNumbers: c.numbers.filter(n => ts.has(n)) };
  });

  // 补漏6（直接从 predict 返回）
  const c6n = r.bulou6 || null;
  const c6h = c6n ? c6n.filter(n => ts.has(n)).length : 0;

  // 后区
  const bp = predictBack(si);
  const bh = t.back.filter(b => bp.includes(b)).length;

  // 号码池
  const ph = pn.filter(n => ts.has(n)).length;

  // 联合覆盖
  const u5s = new Set();
  r.combinations.slice(0,5).forEach(c => c.numbers.forEach(n => u5s.add(n)));
  const u5h = [...ts].filter(n => u5s.has(n)).length;
  if (c6n) c6n.forEach(n => u5s.add(n));
  const u56h = [...ts].filter(n => u5s.has(n)).length;

  res.push({
    sI, tI,
    targetFront: t.front, targetBack: t.back,
    poolHit: ph, poolRate: (ph/5*100).toFixed(1)+'%',
    top5: t5,
    bulou6: c6n ? { numbers:c6n, hitCount:c6h, hitNumbers:c6n.filter(n=>ts.has(n)) } : null,
    backPred: bp, backHit: bh,
    top5Union: u5h, top5b6Union: u56h,
  });
});

// ═══ 汇总 ═══
const N = res.length;
const sm = { totalPeriods: N, strategy: "补盲区优先" };

for (let r=1; r<=5; r++) {
  const t = res.reduce((s,x)=>s+x.top5[r-1].hitCount,0);
  sm[`Top${r}_front`] = { totalHits:t, totalBalls:N*5, hitRate:(t/(N*5)*100).toFixed(2)+'%' };
}
const bv = res.filter(r=>r.bulou6!==null);
const b6t = bv.reduce((s,r)=>s+r.bulou6.hitCount,0);
sm.bulou6 = { totalHits:b6t, totalBalls:bv.length*5, hitRate:bv.length>0?(b6t/(bv.length*5)*100).toFixed(2)+'%':'N/A' };

const bkt = res.reduce((s,r)=>s+r.backHit,0);
sm.back = { totalHits:bkt, totalBalls:N*2, hitRate:(bkt/(N*2)*100).toFixed(2)+'%' };

const plt = res.reduce((s,r)=>s+r.poolHit,0);
sm.pool = { totalHits:plt, totalBalls:N*5, hitRate:(plt/(N*5)*100).toFixed(2)+'%' };

const u5t = res.reduce((s,r)=>s+r.top5Union,0);
const u56t = res.reduce((s,r)=>s+r.top5b6Union,0);
sm.top5Union = { totalHits:u5t, hitRate:(u5t/(N*5)*100).toFixed(2)+'%' };
sm.top5b6Union = { totalHits:u56t, hitRate:(u56t/(N*5)*100).toFixed(2)+'%' };

// 补漏6增补覆盖
const supplementGain = u56t - u5t;
sm.supplementGain = { gain: supplementGain, gainPct: (supplementGain/(N*5)*100).toFixed(2)+'%' };

// ═══ 写入 JSON ═══
const out = { generatedAt:new Date().toISOString(), config:{poolSize:CONFIG.poolSize,interval:10}, strategy:"补盲区优先", summary:sm, perPeriod:res };
fs.writeFileSync('./hit_rate_detail_v2.json', JSON.stringify(out,null,2), 'utf8');

// ═══ 写入 CSV ═══
const hdr = '期号_源,期号_目标,Top1_命中,Top2_命中,Top3_命中,Top4_命中,Top5_命中,补漏6_命中,后区_命中,号码池_命中数,号码池_命中率,Top5_联合覆盖,Top5+补漏6_联合覆盖,补漏6_增补,Top1_号码,Top2_号码,Top3_号码,Top4_号码,Top5_号码,补漏6_号码,目标前区,目标后区';
const csv = res.map(r=>[
  r.sI, r.tI,
  r.top5[0].hitCount, r.top5[1].hitCount, r.top5[2].hitCount, r.top5[3].hitCount, r.top5[4].hitCount,
  r.bulou6?r.bulou6.hitCount:'', r.backHit,
  r.poolHit, r.poolRate,
  r.top5Union, r.top5b6Union,
  r.top5b6Union - r.top5Union,
  '"'+r.top5[0].numbers.join(' ')+'"', '"'+r.top5[1].numbers.join(' ')+'"',
  '"'+r.top5[2].numbers.join(' ')+'"', '"'+r.top5[3].numbers.join(' ')+'"',
  '"'+r.top5[4].numbers.join(' ')+'"',
  r.bulou6?'"'+r.bulou6.numbers.join(' ')+'"':'',
  '"'+r.targetFront.join(' ')+'"', '"'+r.targetBack.join(' ')+'"',
].join(','));
fs.writeFileSync('./hit_rate_detail_v2.csv', [hdr,...csv].join('\n'), 'utf8');

// ═══ 控制台输出 ═══
console.log("\n  ─── 前区每注命中率（补盲区策略） ───");
for(let r=1;r<=5;r++){const h=sm[`Top${r}_front`];console.log(`    Top${r}: ${h.totalHits}/${h.totalBalls} = ${h.hitRate}`);}
console.log(`    补漏6: ${sm.bulou6.totalHits}/${sm.bulou6.totalBalls} = ${sm.bulou6.hitRate}`);

console.log("\n  ─── 后区命中率 ───");
console.log(`    后区: ${sm.back.totalHits}/${sm.back.totalBalls} = ${sm.back.hitRate}`);
const bkd=[0,0,0];res.forEach(r=>bkd[r.backHit]++);
console.log(`    分布: 2球=${bkd[2]} | 1球=${bkd[1]} | 0球=${bkd[0]}`);

console.log("\n  ─── 号码池覆盖率 ───");
console.log(`    池覆盖: ${sm.pool.totalHits}/${sm.pool.totalBalls} = ${sm.pool.hitRate}`);
const pd=[0,0,0,0,0,0];res.forEach(r=>pd[r.poolHit]++);
console.log(`    分布: 5球=${pd[5]} | 4球=${pd[4]} | 3球=${pd[3]} | 2球=${pd[2]} | 1球=${pd[1]} | 0球=${pd[0]}`);

console.log("\n  ─── 联合覆盖（核心指标） ───");
console.log(`    Top5联合:      ${sm.top5Union.totalHits}/${N*5} = ${sm.top5Union.hitRate}`);
console.log(`    Top5+补漏6:    ${sm.top5b6Union.totalHits}/${N*5} = ${sm.top5b6Union.hitRate}`);
console.log(`    补漏6增补覆盖: +${supplementGain}球 (+${sm.supplementGain.gainPct})`);

console.log("\n  ─── 每注命中分布 ───");
for(let c=0;c<5;c++){const d=[0,0,0,0,0,0];res.forEach(r=>d[r.top5[c].hitCount]++);console.log(`    Top${c+1}: 5球=${d[5]} | 4球=${d[4]} | 3球=${d[3]} | 2球=${d[2]} | 1球=${d[1]} | 0球=${d[0]}`);}
{const d=[0,0,0,0,0,0];bv.forEach(r=>d[r.bulou6.hitCount]++);console.log(`    补漏6: 5球=${d[5]} | 4球=${d[4]} | 3球=${d[3]} | 2球=${d[2]} | 1球=${d[1]} | 0球=${d[0]}`);}

console.log("\n  ─── 联合覆盖分布 ───");
const ud=[0,0,0,0,0,0];res.forEach(r=>ud[r.top5b6Union]++);
console.log(`    5球=${ud[5]} | 4球=${ud[4]} | 3球=${ud[3]} | 2球=${ud[2]} | 1球=${ud[1]} | 0球=${ud[0]}`);
console.log(`    ≥3球覆盖: ${res.filter(r=>r.top5b6Union>=3).length}/${N} (${(res.filter(r=>r.top5b6Union>=3).length/N*100).toFixed(1)}%)`);
console.log(`    ≥4球覆盖: ${res.filter(r=>r.top5b6Union>=4).length}/${N} (${(res.filter(r=>r.top5b6Union>=4).length/N*100).toFixed(1)}%)`);

console.log(`\n✅ 结果已写入:`);
console.log(`   📄 hit_rate_detail_v2.json`);
console.log(`   📄 hit_rate_detail_v2.csv`);
