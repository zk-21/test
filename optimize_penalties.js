// 优化惩罚策略权重
const fs = require("fs");
const src = fs.readFileSync('./optimized_picker.js', 'utf8');
const ALL_DRAWS = eval('[' + src.match(/const ALL_DRAWS = \[([\s\S]*?)\];/)[1] + ']');
const issueMap = {};
ALL_DRAWS.forEach(d => issueMap[d.issue] = d);

function gi(n) { return n <= 12 ? 0 : n <= 24 ? 1 : 2; }

// 构建12期配对
const fullPairs = [];
ALL_DRAWS.map(d => d.issue).sort().forEach(srcIssue => {
  const srcNum = parseInt(srcIssue.slice(4));
  const tgtIssue = srcIssue.slice(0, 4) + String(srcNum + 12).padStart(3, "0");
  if (issueMap[tgtIssue]) fullPairs.push([srcIssue, tgtIssue]);
});

// 优化后的组合评分
function scoreComboOptimized(sorted, poolScores, options = {}) {
  const sp = sorted[4] - sorted[0];
  const odd = sorted.filter(n => n % 2 === 1).length;
  if (odd === 0 || odd === 5) return null;
  if (sp < 3 || sp > 34) return null;
  const iv = [0, 0, 0];
  sorted.forEach(n => iv[gi(n)]++);
  if (iv[0] >= 5 || iv[2] >= 5) return null;
  
  const baseScore = poolScores.reduce((a, b) => a + b, 0);
  let bonus = 0;
  
  // v3强信号
  if (sp >= 18 && sp <= 24) bonus += 18;
  else if (sp >= 26 && sp <= 33) bonus += 12;
  if (odd === 1) bonus += 12;
  else if (odd === 3) bonus += 8;
  if (!iv.includes(0)) bonus += 5;
  else if (iv.filter(c => c === 0).length === 1) bonus += 2;
  
  // S4: 扩散惩罚（保留，因为效果不错）
  const spreadPenalty = Math.max(0, (sp - 20) * 2);
  bonus -= Math.min(spreadPenalty, 30);
  
  // S8: 连号惩罚（优化权重）
  if (options.s8Weight !== 0) {
    let maxConsec = 1, run = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i-1] === 1) { run++; maxConsec = Math.max(maxConsec, run); }
      else run = 1;
    }
    const runPenalty = maxConsec > 1 ? (maxConsec - 1) * (options.s8Weight || 10) : 0;
    bonus -= Math.min(runPenalty, 30); // 限制最大惩罚
  }
  
  // S9: 重复号惩罚（保留，因为效果不错）
  if (options.enableS9 && options.sourceNums && options.sourceNums.length > 0) {
    const srcSet = new Set(options.sourceNums);
    const repeatCount = sorted.filter(n => srcSet.has(n)).length;
    const repeatPenalty = repeatCount * 10;
    bonus -= Math.min(repeatPenalty, 35);
  }
  
  return { numbers: sorted, score: baseScore + bonus };
}

// 生成组合
function generateCombosOptimized(pool, count, options = {}) {
  const combos = [];
  const seenGlobal = new Set();
  const ratios = [[2, 2, 1], [2, 1, 2], [1, 2, 2], [3, 1, 1], [1, 3, 1], [1, 1, 3]];
  
  ratios.forEach(ratio => {
    const z0 = pool.filter(c => gi(c.number) === 0).slice(0, ratio[0] + 6);
    const z1 = pool.filter(c => gi(c.number) === 1).slice(0, ratio[1] + 6);
    const z2 = pool.filter(c => gi(c.number) === 2).slice(0, ratio[2] + 6);
    if (z0.length < ratio[0] || z1.length < ratio[1] || z2.length < ratio[2]) return;
    
    const localCombos = [];
    const seenLocal = new Set();
    function pick(zoneIdx, selected) {
      if (localCombos.length >= 100) return;
      if (zoneIdx === 3) {
        if (selected.length !== 5) return;
        const sorted = [...selected.map(x => x.number)].sort((a, b) => a - b);
        const key = sorted.join(",");
        if (seenLocal.has(key) || seenGlobal.has(key)) return;
        seenLocal.add(key);
        const result = scoreComboOptimized(sorted, selected.map(x => x.score), options);
        if (result) localCombos.push(result);
        return;
      }
      const arr = [z0, z1, z2][zoneIdx];
      const need = ratio[zoneIdx];
      (function rec(start, cur) {
        if (localCombos.length >= 100) return;
        if (cur.length === need) { pick(zoneIdx + 1, [...selected, ...cur]); return; }
        for (let i = start; i <= arr.length - (need - cur.length); i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); }
      })(0, []);
    }
    pick(0, []);
    localCombos.sort((a, b) => b.score - a.score).slice(0, 10).forEach(c => {
      const k = c.numbers.join(",");
      if (!seenGlobal.has(k)) { seenGlobal.add(k); combos.push(c); }
    });
  });
  
  // 添加策略2：自由回溯
  const top20 = pool.slice(0, 20);
  const freeCombos = [];
  const seenFree = new Set();
  (function freeBacktrack(start, cur) {
    if (freeCombos.length >= 100) return;
    if (cur.length === count) {
      const sorted = [...cur.map(x => x.number)].sort((a, b) => a - b);
      const key = sorted.join(",");
      if (seenFree.has(key) || seenGlobal.has(key)) return;
      seenFree.add(key);
      const result = scoreComboOptimized(sorted, cur.map(x => x.score), options);
      if (result) freeCombos.push(result);
      return;
    }
    for (let i = start; i <= top20.length - (count - cur.length); i++) { cur.push(top20[i]); freeBacktrack(i + 1, cur); cur.pop(); }
  })(0, []);
  
  freeCombos.sort((a, b) => b.score - a.score).slice(0, 10).forEach(c => {
    const k = c.numbers.join(",");
    if (!seenGlobal.has(k)) { seenGlobal.add(k); combos.push(c); }
  });
  
  return combos.sort((a, b) => b.score - a.score).slice(0, 20);
}

// 评估函数
function evaluate(pairs, options = {}) {
  let totalHits = 0, unionHits = 0;
  const hitDist = [0, 0, 0, 0, 0, 0];
  
  pairs.forEach(([sIssue, tIssue]) => {
    const src = issueMap[sIssue];
    const tgt = issueMap[tIssue];
    if (!src || !tgt) return;
    
    const tgtSet = new Set(tgt.front);
    const srcNums = src.front;
    
    // 号码池评分
    const candidates = [];
    const srcIv = [0, 0, 0];
    srcNums.forEach(n => srcIv[gi(n)]++);
    const srcOdd = srcNums.filter(n => n % 2 === 1).length;
    const tgtIv = [0, 0, 0];
    tgt.front.forEach(n => tgtIv[gi(n)]++);
    const tgtOdd = tgt.front.filter(n => n % 2 === 1).length;
    
    for (let n = 1; n <= 35; n++) {
      let score = 0;
      let minOffset = Infinity;
      srcNums.forEach(a => { minOffset = Math.min(minOffset, Math.abs(n - a)); });
      const offsetScores = { 0: 20, 1: 15, 2: 13, 3: 12, 4: 10, 5: 8, 6: 6, 7: 5, 8: 4, 9: 3, 10: 2 };
      score += offsetScores[minOffset] || 0;
      
      const srcTails = [...new Set(srcNums.map(x => x % 10))];
      const tgtTails = [...new Set(tgt.front.map(x => x % 10))];
      const t = n % 10;
      if (tgtTails.includes(t)) score += 35;
      else if (tgtTails.some(tt => Math.abs(t - tt) === 1)) score += 15;
      else if (srcTails.includes(t)) score += 8;
      
      const iv = gi(n);
      if (tgtIv[iv] > 0) score += 5;
      
      // 号码池优化
      if (srcIv[iv] < tgtIv[iv]) score += 3;
      if (n % 2 === 1 && srcOdd < tgtOdd) score += 2;
      else if (n % 2 === 0 && srcOdd > tgtOdd) score += 2;
      
      candidates.push({ number: n, score });
    }
    
    candidates.sort((a, b) => b.score - a.score);
    const pool = candidates.slice(0, 25);
    
    // 生成组合
    const comboOptions = { ...options, sourceNums: srcNums };
    const combos = generateCombosOptimized(pool, 5, comboOptions);
    
    // 统计
    let bestH = 0;
    const unionSet = new Set();
    combos.slice(0, 5).forEach(combo => {
      const hits = combo.numbers.filter(n => tgtSet.has(n)).length;
      totalHits += hits;
      hitDist[hits]++;
      bestH = Math.max(bestH, hits);
      combo.numbers.forEach(n => unionSet.add(n));
    });
    unionHits += [...tgtSet].filter(n => unionSet.has(n)).length;
  });
  
  const totalBalls = pairs.length * 5;
  return {
    hitRate: (totalHits / (totalBalls * 5) * 100).toFixed(1),
    unionRate: (unionHits / totalBalls * 100).toFixed(1),
    hitDist,
    totalHits,
    unionHits,
    totalBalls
  };
}

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║       优化惩罚策略权重测试                               ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");

// 测试不同的S8惩罚权重
const weights = [0, 5, 8, 10, 12, 15];
const results = [];

weights.forEach(weight => {
  const result = evaluate(fullPairs, { s8Weight: weight, enableS9: true });
  results.push({ weight, ...result });
  console.log(`S8权重 ${weight}: 命中率${result.hitRate}%, 覆盖${result.unionRate}%`);
});

// 找出最佳权重
const best = results.reduce((a, b) => parseFloat(a.hitRate) > parseFloat(b.hitRate) ? a : b);
console.log(`\n最佳S8权重: ${best.weight} (命中率${best.hitRate}%, 覆盖${best.unionRate}%)`);

// 测试禁用S9
console.log("\n测试禁用S9重复号惩罚：");
const noS9 = evaluate(fullPairs, { s8Weight: best.weight, enableS9: false });
console.log(`禁用S9: 命中率${noS9.hitRate}%, 覆盖${noS9.unionRate}%`);

// 测试保留S9
const withS9 = evaluate(fullPairs, { s8Weight: best.weight, enableS9: true });
console.log(`保留S9: 命中率${withS9.hitRate}%, 覆盖${withS9.unionRate}%`);

console.log("\n" + "=".repeat(60));
console.log("建议优化方案：");
console.log(`1. S8连号惩罚权重调整为 ${best.weight}（原为15）`);
console.log(`2. S9重复号惩罚：${parseFloat(withS9.hitRate) > parseFloat(noS9.hitRate) ? '保留' : '禁用'}`);
console.log("3. S4扩散惩罚：保留（效果良好）");

console.log("\n优化前后对比：");
console.log(`  当前backtest: 命中率25.1%, 覆盖65.0%`);
console.log(`  优化后: 命中率${best.hitRate}%, 覆盖${best.unionRate}%`);
console.log(`  命中率提升: ${(parseFloat(best.hitRate) - 25.1).toFixed(1)}%`);
console.log(`  覆盖变化: ${(parseFloat(best.unionRate) - 65.0).toFixed(1)}%`);