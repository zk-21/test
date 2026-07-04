/**
 * 分析 Top1-Top5 + 补漏6 前后区每注命中率 & 号码池覆盖率
 * 输出 JSON + CSV 文件，用于后续参数优化对比
 */
const fs = require('fs');

// ═══ 用 eval 加载 optimized_picker.js ═══
process.argv = ['node', 'optimized_picker.js', '--skip-all'];
var code = fs.readFileSync('./optimized_picker.js', 'utf8');
// 替换 CLI handler 条件，防止自动执行
code = code.replace(/args\.includes\("--backtest"\)/g, 'false');
code = code.replace(/args\.includes\("--validate"\)/g, 'false');
code = code.replace(/args\.includes\("--sensitivity"\)/g, 'false');
code = code.replace(/args\.includes\("--quicktest"\)/g, 'false');
code = code.replace(/args\.includes\("--demo"\)/g, 'false');
code = code.replace(/args\.includes\("--predict"\)/g, 'false');
code = code.replace(/args\.includes\("--ideal"\)/g, 'false');
code = code.replace(/args\.includes\("--single"\)/g, 'false');
code = code.replace(/args\.length === 0/g, 'false');
// 将 const/let 替换为 var 以确保变量提升
code = code.replace(/\bconst\b/g, 'var');
code = code.replace(/\blet\b/g, 'var');
eval(code);
console.log("✅ optimized_picker.js 加载成功");
console.log("ALL_DRAWS length:", ALL_DRAWS.length);
console.log("issueMap keys:", Object.keys(issueMap).length);
console.log("buildPairs type:", typeof buildPairs);

// ═══ 分析 ═══
console.log("═".repeat(70));
console.log("  📊 Top1-Top5 + 补漏6 前后区命中率 & 号码池覆盖率分析");
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

  // 补漏6
  const cov = new Set();
  r.combinations.slice(0, 5).forEach(c => c.numbers.forEach(n => cov.add(n)));
  const freq = new Map();
  r.combinations.slice(0, 5).forEach(c => c.numbers.forEach(n => freq.set(n, (freq.get(n)||0)+1)));

  const missM = new Map(), hotM = new Map();
  for (let n = 1; n <= 35; n++) {
    let m = 0, h = 0;
    for (let i = si-1; i >= Math.max(0,si-20); i--) { if (ALL_DRAWS[i].front.includes(n)) break; m++; }
    for (let i = si-1; i >= Math.max(0,si-10); i--) { if (ALL_DRAWS[i].front.includes(n)) h++; }
    missM.set(n,m); hotM.set(n,h);
  }

  const ivC = [0,0,0];
  r.combinations.slice(0,5).forEach(c => c.numbers.forEach(n => { if(n<=12)ivC[0]++;else if(n<=24)ivC[1]++;else ivC[2]++; }));
  const ivMin = ivC.indexOf(Math.min(...ivC));
  const pt = r.predictedTails ? new Set(r.predictedTails.slice(0,5).map(([t])=>t)) : new Set();

  const c6sc = r.pool
    .filter(e => !cov.has(e.number) || (freq.get(e.number)||0) >= 3)
    .map(e => {
      const n=e.number, f=freq.get(n)||0, m=missM.get(n)||0, h=hotM.get(n)||0;
      let s = e.score;
      if(pt.has(n%10))s+=10;
      if((n<=12?0:n<=24?1:2)===ivMin)s+=6;
      if(h>=3)s+=8;else if(h>=2)s+=4;
      if(m>=10)s+=5;else if(m>=7)s+=3;
      if(!cov.has(n))s+=25;else if(f>=3)s+=8;else s-=5;
      let md=Infinity;cov.forEach(cn=>{const d=Math.abs(n-cn);if(d<md)md=d;});
      if(md===1)s+=12;else if(md===2)s+=6;else if(md===3)s+=3;
      return{number:n,score6:s};
    })
    .sort((a,b)=>b.score6-a.score6);

  const c6n = c6sc.length>=5 ? c6sc.slice(0,5).map(e=>e.number).sort((a,b)=>a-b) : null;
  const c6h = c6n ? c6n.filter(n=>ts.has(n)).length : 0;

  // 后区
  const bp = predictBack(si);
  const bh = t.back.filter(b=>bp.includes(b)).length;

  // 号码池
  const ph = pn.filter(n=>ts.has(n)).length;

  // 联合覆盖
  const u5s = new Set();
  r.combinations.slice(0,5).forEach(c=>c.numbers.forEach(n=>u5s.add(n)));
  const u5h = [...ts].filter(n=>u5s.has(n)).length;
  if(c6n)c6n.forEach(n=>u5s.add(n));
  const u56h = [...ts].filter(n=>u5s.has(n)).length;

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
const sm = { totalPeriods: N };

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

// ═══ 写入 JSON ═══
const out = { generatedAt:new Date().toISOString(), config:{poolSize:24,interval:10}, summary:sm, perPeriod:res };
fs.writeFileSync('./hit_rate_detail.json', JSON.stringify(out,null,2), 'utf8');

// ═══ 写入 CSV ═══
const hdr = '期号_源,期号_目标,Top1_命中,Top2_命中,Top3_命中,Top4_命中,Top5_命中,补漏6_命中,后区_命中,号码池_命中数,号码池_命中率,Top5_联合覆盖,Top5+补漏6_联合覆盖,Top1_号码,Top2_号码,Top3_号码,Top4_号码,Top5_号码,补漏6_号码,目标前区,目标后区';
const csv = res.map(r=>[
  r.sI, r.tI,
  r.top5[0].hitCount, r.top5[1].hitCount, r.top5[2].hitCount, r.top5[3].hitCount, r.top5[4].hitCount,
  r.bulou6?r.bulou6.hitCount:'', r.backHit,
  r.poolHit, r.poolRate,
  r.top5Union, r.top5b6Union,
  '"'+r.top5[0].numbers.join(' ')+'"', '"'+r.top5[1].numbers.join(' ')+'"',
  '"'+r.top5[2].numbers.join(' ')+'"', '"'+r.top5[3].numbers.join(' ')+'"',
  '"'+r.top5[4].numbers.join(' ')+'"',
  r.bulou6?'"'+r.bulou6.numbers.join(' ')+'"':'',
  '"'+r.targetFront.join(' ')+'"', '"'+r.targetBack.join(' ')+'"',
].join(','));
fs.writeFileSync('./hit_rate_detail.csv', [hdr,...csv].join('\n'), 'utf8');

// ═══ 控制台输出 ═══
console.log("\n  ─── 前区每注命中率 ───");
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

console.log("\n  ─── 联合覆盖 ───");
console.log(`    Top5联合: ${sm.top5Union.totalHits}/${N*5} = ${sm.top5Union.hitRate}`);
console.log(`    Top5+补漏6: ${sm.top5b6Union.totalHits}/${N*5} = ${sm.top5b6Union.hitRate}`);

console.log("\n  ─── 每注命中分布 ───");
for(let c=0;c<5;c++){const d=[0,0,0,0,0,0];res.forEach(r=>d[r.top5[c].hitCount]++);console.log(`    Top${c+1}: 5球=${d[5]} | 4球=${d[4]} | 3球=${d[3]} | 2球=${d[2]} | 1球=${d[1]} | 0球=${d[0]}`);}
{const d=[0,0,0,0,0,0];bv.forEach(r=>d[r.bulou6.hitCount]++);console.log(`    补漏6: 5球=${d[5]} | 4球=${d[4]} | 3球=${d[3]} | 2球=${d[2]} | 1球=${d[1]} | 0球=${d[0]}`);}

console.log(`\n✅ 结果已写入:`);
console.log(`   📄 hit_rate_detail.json (完整数据，用于程序化对比)`);
console.log(`   📄 hit_rate_detail.csv  (Excel 可直接打开分析)`);
