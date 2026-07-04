// 轻量诊断：直接内嵌最小数据
const fs = require('fs');
const draws = [];

// 从optimized_picker.js提取数据
const code = fs.readFileSync(__dirname + '/optimized_picker.js', 'utf-8');
const dataMatch = code.match(/const ALL_DRAWS = \[([\s\S]*?)\];/);
if (!dataMatch) { console.log('No data found'); process.exit(1); }

const arrStr = '[' + dataMatch[1] + ']';
const ALL_DRAWS = eval(arrStr);
console.log('加载了 ' + ALL_DRAWS.length + ' 期数据');

function gi(n) { return n <= 12 ? 0 : n <= 24 ? 1 : 2; }
function sum(arr) { return arr.reduce((a, b) => a + b, 0); }

// ===== 1. 号码池覆盖率分析 =====
console.log('\n=== 1. 历史号码分布 ===');
const zHist = [0, 0, 0];
ALL_DRAWS.forEach(d => d.front.forEach(n => zHist[gi(n)]++));
const totalN = ALL_DRAWS.length * 5;
console.log('一区(1-12): ' + (zHist[0]/totalN*100).toFixed(1) + '%');
console.log('二区(13-24): ' + (zHist[1]/totalN*100).toFixed(1) + '%');
console.log('三区(25-35): ' + (zHist[2]/totalN*100).toFixed(1) + '%');

// 区间比分布
const ivMap = {};
ALL_DRAWS.forEach(d => {
  const iv = [0, 0, 0];
  d.front.forEach(n => iv[gi(n)]++);
  const k = iv.join(':');
  ivMap[k] = (ivMap[k] || 0) + 1;
});
console.log('\n区间比分布 Top 8:');
Object.entries(ivMap).sort((a, b) => b[1] - a[1]).slice(0, 8)
  .forEach(([k, v]) => console.log('  ' + k + ': ' + v + '次 (' + (v/ALL_DRAWS.length*100).toFixed(1) + '%)'));

// ===== 2. 模拟不同池大小 =====
console.log('\n=== 2. 不同池大小覆盖测试 ===');
const testPairs = [];
const issues = ALL_DRAWS.map(d => d.issue);
for (let i = 0; i < ALL_DRAWS.length; i++) {
  const tgt = i + 10;
  if (tgt < ALL_DRAWS.length) testPairs.push({ s: ALL_DRAWS[i].front, t: ALL_DRAWS[tgt].front });
}
console.log('测试配对: ' + testPairs.length + ' 对');

function simpleScore(n, anchors) {
  let minD = Infinity;
  anchors.forEach(a => { const d = Math.abs(n - a); if (d < minD) minD = d; });
  const os = { 0: 20, 1: 15, 2: 13, 3: 12, 4: 10, 5: 8, 6: 6, 7: 5, 8: 4, 9: 3, 10: 2 };
  let s = os[minD] || 0;
  if (new Set(anchors.map(x => x % 10)).has(n % 10)) s += 15;
  return s;
}

[24, 28, 30, 32].forEach(ps => {
  let hit = 0, tgt = 0;
  const zd = [0, 0, 0];
  testPairs.forEach(p => {
    const cs = [];
    for (let n = 1; n <= 35; n++) cs.push({ n, s: simpleScore(n, p.s), z: gi(n) });
    cs.sort((a, b) => b.s - a.s);
    const pool = [], seen = new Set(), zc = [0, 0, 0];
    // 区间保底
    for (let z = 0; z < 3; z++) {
      const minZ = Math.max(2, Math.floor(ps / 5));
      for (const c of cs) { if (zc[z] >= minZ) break; if (!seen.has(c.n) && c.z === z) { seen.add(c.n); pool.push(c); zc[z]++; } }
    }
    for (const c of cs) { if (pool.length >= ps) break; if (!seen.has(c.n)) { seen.add(c.n); pool.push(c); zc[c.z]++; } }
    const ts = new Set(p.t);
    pool.forEach(c => { zd[c.z]++; if (ts.has(c.n)) hit++; });
    tgt += 5;
  });
  const totalPoolN = ps * testPairs.length;
  console.log('池=' + ps + ': 覆盖=' + hit + '/' + tgt + '=' + (hit/tgt*100).toFixed(1) + '% | '
    + '一区' + (zd[0]/totalPoolN*100).toFixed(0) + '% 二区' + (zd[1]/totalPoolN*100).toFixed(0)
    + '% 三区' + (zd[2]/totalPoolN*100).toFixed(0) + '%');
});

// ===== 3. Top5 模拟对比 ====
console.log('\n=== 3. Top5 模式分析 ===');
let top5Freq = {}, top5Iv = {};
testPairs.forEach(p => {
  const cs = [];
  for (let n = 1; n <= 35; n++) cs.push({ n, s: simpleScore(n, p.s), z: gi(n) });
  cs.sort((a, b) => b.s - a.s);
  const pool = [], seen = new Set(), zc = [0, 0, 0];
  for (let z = 0; z < 3; z++) {
    const minZ = Math.max(2, Math.floor(24 / 5));
    for (const c of cs) { if (zc[z] >= minZ) break; if (!seen.has(c.n) && c.z === z) { seen.add(c.n); pool.push(c); zc[z]++; } }
  }
  for (const c of cs) { if (pool.length >= 24) break; if (!seen.has(c.n)) { seen.add(c.n); pool.push(c); zc[c.z]++; } }
  
  const top15 = pool.slice(0, 15);
  const combos = [], sc = new Set();
  [[2, 1, 2], [2, 2, 1], [1, 2, 2], [3, 1, 1], [1, 3, 1], [1, 1, 3]].forEach(r => {
    const zz = [0, 1, 2].map(z => top15.filter(c => c.z === z).slice(0, r[z] + 3));
    if (zz.some((a, i) => a.length < r[i])) return;
    for (let a = 0; a < Math.min(zz[0].length - r[0] + 1, 3); a++)
      for (let b = 0; b < Math.min(zz[1].length - r[1] + 1, 3); b++)
        for (let c = 0; c < Math.min(zz[2].length - r[2] + 1, 3); c++) {
          const ns = [...zz[0].slice(a, a + r[0]), ...zz[1].slice(b, b + r[1]), ...zz[2].slice(c, c + r[2])]
            .map(x => x.n).sort((x, y) => x - y);
          const k = ns.join(',');
          if (sc.has(k)) continue; sc.add(k);
          const odd = ns.filter(n => n % 2 === 1).length;
          if (odd === 0 || odd === 5) continue;
          const sp = ns[4] - ns[0];
          if (sp < 3 || sp > 34) continue;
          const iv = [0, 0, 0]; ns.forEach(n => iv[gi(n)]++);
          const score = ns.reduce((acc, n) => acc + (pool.find(x => x.n === n)?.s || 0), 0);
          combos.push({ ns, score, iv: iv.join(':'), odd, sum: sum(ns), span: sp });
        }
  });
  combos.sort((a, b) => b.score - a.score);
  combos.slice(0, 5).forEach(c => {
    c.ns.forEach(n => top5Freq[n] = (top5Freq[n] || 0) + 1);
    top5Iv[c.iv] = (top5Iv[c.iv] || 0) + 1;
  });
});

console.log('\nTop5高频号码:');
Object.entries(top5Freq).sort((a, b) => b[1] - a[1]).slice(0, 15)
  .forEach(([n, c]) => {
    const z = gi(parseInt(n));
    console.log('  ' + n.padStart(2) + ': ' + String(c).padStart(3) + '次 ('
      + (c/(testPairs.length*5)*100).toFixed(1) + '%) [' + ['一区', '二区', '三区'][z] + ']');
  });

console.log('\nTop5区间比 vs 历史:');
const topIvEntries = Object.entries(top5Iv).sort((a, b) => b[1] - a[1]);
topIvEntries.slice(0, 8).forEach(([k, v]) => {
  const histC = ivMap[k] || 0;
  const top5Pct = (v / (testPairs.length * 5) * 100).toFixed(1);
  const histPct = (histC / ALL_DRAWS.length * 100).toFixed(1);
  const diff = Math.abs(parseFloat(top5Pct) - parseFloat(histPct));
  console.log('  ' + k + ': Top5=' + top5Pct + '% | 历史=' + histPct + '% '
    + (diff < 3 ? '✅' : diff < 7 ? '⚠️' : '❌'));
});

// ===== 4. 区间比转移矩阵 ====
console.log('\n=== 4. 区间比转移矩阵 ===');
const trans = {};
for (let i = 0; i < ALL_DRAWS.length - 1; i++) {
  const a = ALL_DRAWS[i].front, b = ALL_DRAWS[i + 1].front;
  const ai = [0, 0, 0], bi = [0, 0, 0];
  a.forEach(n => ai[gi(n)]++); b.forEach(n => bi[gi(n)]++);
  const fk = ai.join(':'), tk = bi.join(':');
  if (!trans[fk]) trans[fk] = {};
  trans[fk][tk] = (trans[fk][tk] || 0) + 1;
}
['2:2:1', '2:1:2', '1:2:2', '1:3:1', '3:1:1'].forEach(fk => {
  if (!trans[fk]) return;
  const items = Object.entries(trans[fk]).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const total = items.reduce((a, b) => a + b[1], 0);
  console.log(fk + ' → ' + items.map(([k, v]) => k + '(' + (v/total*100).toFixed(0) + '%)').join(', '));
});

// ===== 5. 智能池覆盖测试 =====
console.log('\n=== 5. 智能区间比引导池 ===');
let baseH = 0, smartH = 0, baseT = 0, smartT = 0;
testPairs.forEach(p => {
  const srcIv = [0, 0, 0]; p.s.forEach(n => srcIv[gi(n)]++);
  const srcKey = srcIv.join(':');
  const tr = trans[srcKey] || {};
  const preds = Object.entries(tr).sort((a, b) => b[1] - a[1]).slice(0, 3);
  
  const smartTar = [0, 0, 0]; let tw = 0;
  preds.forEach(([k, v], i) => {
    const r = k.split(':').map(Number);
    const w = (3 - i) * v;
    smartTar[0] += r[0] * w; smartTar[1] += r[1] * w; smartTar[2] += r[2] * w;
    tw += w;
  });
  if (tw > 0) { smartTar[0] /= tw; smartTar[1] /= tw; smartTar[2] /= tw; }
  else { smartTar[0] = 2; smartTar[1] = 2; smartTar[2] = 1; }
  
  const cs = [];
  for (let n = 1; n <= 35; n++) cs.push({ n, s: simpleScore(n, p.s), z: gi(n) });
  cs.sort((a, b) => b.s - a.s);
  
  // 基准池
  const bp = [], bs = new Set();
  for (const c of cs) { if (bp.length >= 24) break; if (!bs.has(c.n)) { bs.add(c.n); bp.push(c); } }
  
  // 智能池
  const sp = [], ss = new Set();
  const quota = [Math.max(4, Math.round(smartTar[0] / 5 * 24)), Math.max(4, Math.round(smartTar[1] / 5 * 24)), Math.max(4, Math.round(smartTar[2] / 5 * 24))];
  const qsum = quota[0] + quota[1] + quota[2];
  quota[0] = Math.round(quota[0] * 24 / qsum); quota[1] = Math.round(quota[1] * 24 / qsum);
  quota[2] = 24 - quota[0] - quota[1];
  
  for (let z = 0; z < 3; z++) {
    const zc = cs.filter(c => c.z === z);
    let cnt = 0;
    for (const c of zc) { if (cnt >= quota[z]) break; if (!ss.has(c.n)) { ss.add(c.n); sp.push(c); cnt++; } }
  }
  for (const c of cs) { if (sp.length >= 24) break; if (!ss.has(c.n)) { ss.add(c.n); sp.push(c); } }
  
  const ts = new Set(p.t);
  bp.forEach(c => { if (ts.has(c.n)) baseH++; });
  sp.forEach(c => { if (ts.has(c.n)) smartH++; });
  baseT += 5; smartT += 5;
});

console.log('基准池(24球): ' + baseH + '/' + baseT + ' = ' + (baseH/baseT*100).toFixed(1) + '%');
console.log('智能池(24球): ' + smartH + '/' + smartT + ' = ' + (smartH/smartT*100).toFixed(1) + '%');
console.log('改进: +' + ((smartH/smartT - baseH/baseT)*100).toFixed(2) + 'pp');

// ===== 6. 测试智能池 28/30 球 =====
console.log('\n=== 6. 智能池+扩大组合测试 ===');
[28, 30, 32].forEach(ps => {
  let hit = 0, tgt = 0;
  testPairs.forEach(p => {
    const srcIv = [0, 0, 0]; p.s.forEach(n => srcIv[gi(n)]++);
    const tr = trans[srcIv.join(':')] || {};
    const preds = Object.entries(tr).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const smartTar = [0, 0, 0]; let tw = 0;
    preds.forEach(([k, v], i) => {
      const r = k.split(':').map(Number);
      const w = (3 - i) * v;
      smartTar[0] += r[0] * w; smartTar[1] += r[1] * w; smartTar[2] += r[2] * w;
      tw += w;
    });
    if (tw > 0) { smartTar[0] /= tw; smartTar[1] /= tw; smartTar[2] /= tw; }
    else { smartTar[0] = 2; smartTar[1] = 2; smartTar[2] = 1; }
    
    const cs = [];
    for (let n = 1; n <= 35; n++) cs.push({ n, s: simpleScore(n, p.s), z: gi(n) });
    cs.sort((a, b) => b.s - a.s);
    
    const pool = [], seen = new Set();
    const quota = [Math.max(4, Math.round(smartTar[0] / 5 * ps)), Math.max(4, Math.round(smartTar[1] / 5 * ps)), Math.max(4, Math.round(smartTar[2] / 5 * ps))];
    const qsum = quota[0] + quota[1] + quota[2];
    quota[0] = Math.round(quota[0] * ps / qsum); quota[1] = Math.round(quota[1] * ps / qsum);
    quota[2] = ps - quota[0] - quota[1];
    
    for (let z = 0; z < 3; z++) {
      const zc = cs.filter(c => c.z === z);
      let cnt = 0;
      for (const c of zc) { if (cnt >= quota[z]) break; if (!seen.has(c.n)) { seen.add(c.n); pool.push(c); cnt++; } }
    }
    for (const c of cs) { if (pool.length >= ps) break; if (!seen.has(c.n)) { seen.add(c.n); pool.push(c); } }
    
    const ts = new Set(p.t);
    pool.forEach(c => { if (ts.has(c.n)) hit++; });
    tgt += 5;
  });
  console.log('智能池(' + ps + '球): ' + hit + '/' + tgt + ' = ' + (hit/tgt*100).toFixed(1) + '%');
});

console.log('\n=== 完成 ===');
