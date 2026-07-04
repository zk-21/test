// 最终验证：轻量级完整回测（无eval依赖）
var fs = require('fs');

// 直接从文件提取数据，避免eval整个3400行文件
var code = fs.readFileSync('optimized_picker.js', 'utf-8');
var dm = code.match(/const ALL_DRAWS = \[([\s\S]*?)\];/);
if (!dm) { console.log('NO DATA'); process.exit(1); }
var ALL_DRAWS = eval('[' + dm[1] + ']');

function gi(n) { return n <= 12 ? 0 : n <= 24 ? 1 : 2; }
function sum(a) { return a.reduce(function(x,y){return x+y}, 0); }
function oddCount(a) { return a.filter(function(n){return n%2===1}).length; }

// 完整评分函数（模拟optimized_picker核心逻辑）
function scoreNumber(n, anchors) {
  var s = 0;
  var minD = Infinity;
  anchors.forEach(function(a) { var d = Math.abs(n-a); if(d<minD) minD=d; });
  var os = {0:20,1:15,2:13,3:12,4:10,5:8,6:6,7:5,8:4,9:3,10:2};
  s += (os[minD] || 0);
  var srcTails = new Set(anchors.map(function(x){return x%10}));
  if (srcTails.has(n%10)) s += 15;
  // 连号支撑
  var nearConsec = anchors.some(function(a) {
    return anchors.some(function(x) { return x!==a && Math.abs(x-a)===1 && Math.abs(n-a)<=4; });
  });
  if (nearConsec) s += 7;
  return s;
}

// 区间比转移矩阵
var trans = {};
for (var i = 0; i < ALL_DRAWS.length - 1; i++) {
  var a = ALL_DRAWS[i].front, b = ALL_DRAWS[i+1].front;
  var ai = [0,0,0], bi = [0,0,0];
  a.forEach(function(n){ai[gi(n)]++}); b.forEach(function(n){bi[gi(n)]++});
  var fk = ai.join(':'), tk = bi.join(':');
  if (!trans[fk]) trans[fk] = {};
  trans[fk][tk] = (trans[fk][tk] || 0) + 1;
}

// 测试配对
var tps = [];
for (var i = 0; i < ALL_DRAWS.length; i++) {
  if (i + 10 < ALL_DRAWS.length) {
    tps.push({s:ALL_DRAWS[i].front, t:ALL_DRAWS[i+10].front, si:i, ti:i+10});
  }
}

// ===== 对比测试：24球 vs 28球+智能 =====
function testPool(poolSize, useSmart) {
  var pHit=0, pTot=0, t5U=0, t1H=0, t3H=0, t5H=0, b6H=0, u6H=0;
  var n = tps.length;
  var zDist = [0,0,0];
  var ivHitCount = 0;
  
  tps.forEach(function(p) {
    var anchors = p.s;
    var targetSet = new Set(p.t);
    pTot += 5;
    
    // 评分
    var cs = [];
    for (var n2 = 1; n2 <= 35; n2++) cs.push({n:n2, s:scoreNumber(n2, anchors), z:gi(n2)});
    cs.sort(function(a,b){return b.s-a.s});
    
    // 池生成
    var pool = [], seen = new Set(), zc = [0,0,0];
    
    if (useSmart) {
      // 智能区间比引导
      var srcIv = [0,0,0]; anchors.forEach(function(n){srcIv[gi(n)]++});
      var tr = trans[srcIv.join(':')] || {};
      var preds = Object.entries(tr).sort(function(a,b){return b[1]-a[1]}).slice(0,3);
      var smartTar = [0,0,0], tw = 0;
      preds.forEach(function(e,i) {
        var r = e[0].split(':').map(Number);
        var w = (3-i) * e[1];
        smartTar[0]+=r[0]*w; smartTar[1]+=r[1]*w; smartTar[2]+=r[2]*w;
        tw += w;
      });
      if (tw > 0) { smartTar[0]/=tw; smartTar[1]/=tw; smartTar[2]/=tw; }
      else { smartTar[0]=2; smartTar[1]=2; smartTar[2]=1; }
      
      var quota = [Math.max(4,Math.round(smartTar[0]/5*poolSize)), Math.max(4,Math.round(smartTar[1]/5*poolSize)), Math.max(4,Math.round(smartTar[2]/5*poolSize))];
      var qsum = quota[0]+quota[1]+quota[2];
      quota[0]=Math.round(quota[0]*poolSize/qsum); quota[1]=Math.round(quota[1]*poolSize/qsum);
      quota[2]=poolSize-quota[0]-quota[1];
      
      for (var z=0;z<3;z++) {
        var zc2 = cs.filter(function(c){return c.z===z});
        var cnt=0;
        for (var k=0;k<zc2.length&&cnt<quota[z];k++) {
          if (!seen.has(zc2[k].n)) { seen.add(zc2[k].n); pool.push(zc2[k]); zc[z]++; cnt++; }
        }
      }
    }
    
    // 补充剩余
    for (var j=0;j<cs.length&&pool.length<poolSize;j++) {
      if (!seen.has(cs[j].n)) { seen.add(cs[j].n); pool.push(cs[j]); zc[cs[j].z]++; }
    }
    
    // 统计池
    pool.forEach(function(c){ zDist[c.z]++; if(targetSet.has(c.n)) pHit++; });
    
    // 生成组合（按区间比 + 贪心）
    var combos = [], sc = new Set();
    var topPool = pool.slice(0, 18);
    var ratios = [[2,1,2],[2,2,1],[1,2,2],[3,1,1],[1,3,1],[1,1,3],[0,2,3],[2,0,3]];
    ratios.forEach(function(r) {
      var zz = [0,1,2].map(function(z){return topPool.filter(function(c){return c.z===z}).slice(0,r[z]+4)});
      if (zz.some(function(a,i){return a.length<r[i]})) return;
      for (var a=0;a<Math.min(zz[0].length-r[0]+1,4);a++)
        for (var b=0;b<Math.min(zz[1].length-r[1]+1,4);b++)
          for (var c=0;c<Math.min(zz[2].length-r[2]+1,4);c++) {
            var ns = [].concat(zz[0].slice(a,a+r[0]), zz[1].slice(b,b+r[1]), zz[2].slice(c,c+r[2]))
              .map(function(x){return x.n}).sort(function(x,y){return x-y});
            var k = ns.join(',');
            if (sc.has(k)) continue; sc.add(k);
            var odd = oddCount(ns);
            if (odd===0||odd===5) continue;
            var sp = ns[4]-ns[0];
            if (sp<3||sp>34) continue;
            // 和值约束
            var s = sum(ns);
            if (s<35||s>170) continue;
            
            var iv = [0,0,0]; ns.forEach(function(n){iv[gi(n)]++});
            var score = ns.reduce(function(acc,n){
              var f = pool.find(function(x){return x.n===n});
              return acc + (f?f.s:0);
            },0);
            // span bonus
            if (sp>=18&&sp<=24) score+=18; else if (sp>=26&&sp<=33) score+=12;
            if (odd===1) score+=12; else if (odd===3) score+=8;
            // IV bonus
            var ivk = iv.join(':');
            var commonIV = ['2:1:2','2:2:1','1:2:2'];
            if (commonIV.indexOf(ivk)>=0) score+=8;
            else if (commonIV.indexOf(ivk)>=0) score+=4;
            
            combos.push({ns:ns, score:score, iv:ivk});
          }
    });
    combos.sort(function(a,b){return b.score-a.score});
    
    if (combos.length === 0) {
      // 无有效组合，用贪心
      var greedy = pool.slice(0,5).map(function(c){return c.n}).sort(function(a,b){return a-b});
      combos.push({ns:greedy, score:sum(greedy.map(function(n){var f=pool.find(function(x){return x.n===n});return f?f.s:0})), iv:'0:0:0'});
    }
    
    // 多样性选择Top5
    var top5 = [combos[0]];
    var rest = combos.slice(1);
    while (top5.length<5 && rest.length>0) {
      var bestI=0, bestS=-Infinity;
      for (var i2=0;i2<rest.length;i2++) {
        var div=0;
        top5.forEach(function(sl) {
          if (rest[i2].iv!==sl.iv) div+=20;
          var ov=0;
          var sls = new Set(sl.ns);
          rest[i2].ns.forEach(function(n){if(sls.has(n))ov++});
          div+=(5-ov)*8;
          var sDiff = Math.abs(sum(rest[i2].ns)-sum(sl.ns));
          if (sDiff>15) div+=12;
        });
        var cb = rest[i2].score*0.75 + div;
        if (cb>bestS) { bestS=cb; bestI=i2; }
      }
      top5.push(rest[bestI]);
      rest.splice(bestI,1);
    }
    
    // 统计Top5
    var t5s = new Set();
    top5.forEach(function(c,i) {
      c.ns.forEach(function(n){t5s.add(n)});
      var h = c.ns.filter(function(n){return targetSet.has(n)}).length;
      if (i===0) t1H += h;
      if (i<3) t3H += h;
      t5H += h;
    });
    targetSet.forEach(function(n){ if(t5s.has(n)) t5U++; });
    
    // 补漏6（补盲区策略：选Top5未覆盖的池中高分号）
    var uncovered = pool.filter(function(c){return !t5s.has(c.n)});
    uncovered.sort(function(a,b){return b.s-a.s});
    var b6Nums = uncovered.slice(0,5).map(function(c){return c.n});
    var bh = b6Nums.filter(function(n){return targetSet.has(n)}).length;
    b6H += bh;
    var un = new Set(t5s);
    b6Nums.forEach(function(n){un.add(n)});
    targetSet.forEach(function(n){if(un.has(n)) u6H++;});
  });
  
  var T = n * 5;
  return {
    poolSize: poolSize, smart: useSmart, n: n,
    poolCov: (pHit/T*100).toFixed(1),
    zDist: [Math.round(zDist[0]/(n*poolSize)*100), Math.round(zDist[1]/(n*poolSize)*100), Math.round(zDist[2]/(n*poolSize)*100)],
    t1: (t1H/T*100).toFixed(1),
    t3: (t3H/(n*15)*100).toFixed(1),
    t5: (t5H/(n*25)*100).toFixed(1),
    t5u: (t5U/T*100).toFixed(1),
    b6: (b6H/T*100).toFixed(1),
    u6: (u6H/T*100).toFixed(1),
  };
}

console.log('===== 完整回测对比 =====');
console.log('配对: ' + tps.length + ' 对\n');

var r24 = testPool(24, false);
var r28s = testPool(28, true);

var rows = [
  ['指标', '24球(旧)', '28球+智能(新)', '变化'],
  ['池覆盖率', r24.poolCov+'%', r28s.poolCov+'%', '+'+(parseFloat(r28s.poolCov)-parseFloat(r24.poolCov)).toFixed(1)+'pp'],
  ['区间分布', r24.zDist.join('/'), r28s.zDist.join('/'), '-'],
  ['Top1命中率', r24.t1+'%', r28s.t1+'%', '+'+(parseFloat(r28s.t1)-parseFloat(r24.t1)).toFixed(1)+'pp'],
  ['Top3命中率', r24.t3+'%', r28s.t3+'%', '+'+(parseFloat(r28s.t3)-parseFloat(r24.t3)).toFixed(1)+'pp'],
  ['Top5命中率', r24.t5+'%', r28s.t5+'%', '+'+(parseFloat(r28s.t5)-parseFloat(r24.t5)).toFixed(1)+'pp'],
  ['Top5联合覆盖', r24.t5u+'%', r28s.t5u+'%', '+'+(parseFloat(r28s.t5u)-parseFloat(r24.t5u)).toFixed(1)+'pp'],
  ['补漏6命中率', r24.b6+'%', r28s.b6+'%', '+'+(parseFloat(r28s.b6)-parseFloat(r24.b6)).toFixed(1)+'pp'],
  ['Top5+补漏6联合', r24.u6+'%', r28s.u6+'%', '+'+(parseFloat(r28s.u6)-parseFloat(r24.u6)).toFixed(1)+'pp'],
];

rows.forEach(function(r) {
  console.log(r[0].padEnd(16) + r[1].padEnd(14) + r[2].padEnd(18) + r[3]);
});

// 额外：测试 30球+智能
var r30s = testPool(30, true);
console.log('\n===== 30球+智能 (参考) =====');
console.log('池覆盖率: ' + r30s.poolCov + '%');
console.log('Top5联合覆盖: ' + r30s.t5u + '%');
console.log('Top5+补漏6联合: ' + r30s.u6 + '%');
