// 回测对比：不同间隔填充分数权重
const fs = require('fs');
const path = require('path');

const rawJs = fs.readFileSync(path.join(__dirname, 'all_draws.js'), 'utf8');
const match = rawJs.match(/window\.ALL_DRAWS_DATA\s*=\s*(\[[\s\S]*?\]);/);
const ALL_DRAWS_DATA = eval(match[1]);
const draws = ALL_DRAWS_DATA.sort((a, b) => parseInt(a.issue) - parseInt(b.issue));

console.log(`共${draws.length}期数据\n`);

// 转移概率分析
function analyzeTailTransitions(draws, sourceRow, lookback) {
  const transFreq = new Map();
  const tailFreq = new Map();
  for (let t = 0; t <= 9; t++) tailFreq.set(t, 0);
  
  const startRow = Math.max(1, sourceRow - lookback);
  for (let r = startRow; r < sourceRow; r++) {
    const prev = draws[r - 1];
    const curr = draws[r];
    if (!prev || !curr) continue;
    
    const prevTails = new Set(prev.front.map(n => n % 10));
    const currTails = curr.front.map(n => n % 10);
    currTails.forEach(t => tailFreq.set(t, tailFreq.get(t) + 1));
    
    for (const st of prevTails) {
      for (const tt of currTails) {
        const key = `${st}→${tt}`;
        transFreq.set(key, (transFreq.get(key) || 0) + 1);
      }
    }
  }
  
  return { transFreq, tailFreq };
}

// 预测函数（可调间隔填充分数权重）
function predictTails(draws, sourceRow, gapFillWeight) {
  const scores = new Map();
  for (let t = 0; t <= 9; t++) scores.set(t, 0);
  
  const sourceDraw = draws[sourceRow - 1];
  if (!sourceDraw) return [...scores.entries()];
  const sourceTails = new Set(sourceDraw.front.map(n => n % 10));
  
  // 1. 转移概率
  const transData = analyzeTailTransitions(draws, sourceRow, 30);
  for (const st of sourceTails) {
    for (let tt = 0; tt <= 9; tt++) {
      const key = `${st}→${tt}`;
      scores.set(tt, scores.get(tt) + (transData.transFreq.get(key) || 0));
    }
  }
  
  // 2. 全局高频
  const maxFreq = Math.max(1, ...transData.tailFreq.values());
  transData.tailFreq.forEach((count, tail) => {
    scores.set(tail, scores.get(tail) + (count / maxFreq) * 15);
  });
  
  // 3. 相同或相邻
  sourceTails.forEach(t => {
    scores.set(t, scores.get(t) + 15);
    scores.set((t + 1) % 10, scores.get((t + 1) % 10) + 7);
    scores.set((t - 1 + 10) % 10, scores.get((t - 1 + 10) % 10) + 7);
  });
  
  // 4. 等差延伸
  const sortedSrc = [...sourceTails].sort((a, b) => a - b);
  for (let i = 0; i < sortedSrc.length; i++) {
    for (let j = i + 1; j < sortedSrc.length; j++) {
      const diff = sortedSrc[j] - sortedSrc[i];
      if (diff >= 2 && diff <= 4) {
        scores.set((sortedSrc[i] - diff + 10) % 10, scores.get((sortedSrc[i] - diff + 10) % 10) + 6);
        scores.set((sortedSrc[j] + diff) % 10, scores.get((sortedSrc[j] + diff) % 10) + 6);
        for (let v = sortedSrc[i] + 1; v < sortedSrc[j]; v++) {
          scores.set(v, scores.get(v) + 4);
        }
      }
    }
  }
  
  // 5. 间隔填充模式（可调权重）
  if (gapFillWeight > 0) {
    const prevDraw = draws[sourceRow - 2];
    if (prevDraw) {
      const prevTails = [...new Set(prevDraw.front.map(n => n % 10))].sort((a, b) => a - b);
      
      for (let a = 0; a < prevTails.length; a++) {
        for (let b = a + 1; b < prevTails.length; b++) {
          const t1 = prevTails[a];
          const t2 = prevTails[b];
          const gap = t2 - t1;
          
          if (gap >= 2 && gap <= 4) {
            // 中间值
            for (let v = t1 + 1; v < t2; v++) {
              scores.set(v, scores.get(v) + 3 * gapFillWeight / 10);
            }
            // 延伸值
            scores.set((t1 - gap + 10) % 10, scores.get((t1 - gap + 10) % 10) + 2 * gapFillWeight / 10);
            scores.set((t2 + gap) % 10, scores.get((t2 + gap) % 10) + 2 * gapFillWeight / 10);
            // 邻号
            for (let v = t1 + 1; v < t2; v++) {
              scores.set((v - 1 + 10) % 10, scores.get((v - 1 + 10) % 10) + 4 * gapFillWeight / 10);
              scores.set((v + 1) % 10, scores.get((v + 1) % 10) + 4 * gapFillWeight / 10);
            }
          }
        }
      }
    }
  }
  
  return [...scores.entries()];
}

// 组合优化
function getBestCombo(scores, prevRowTails) {
  const sorted = scores.sort((a, b) => b[1] - a[1]);
  const top8 = sorted.slice(0, 8).map(([t]) => t);
  
  function getCombinations(arr, k) {
    if (k === 0) return [[]];
    if (arr.length === 0) return [];
    const [first, ...rest] = arr;
    return [...getCombinations(rest, k - 1).map(c => [first, ...c]), ...getCombinations(rest, k)];
  }
  
  const combos = getCombinations(top8, 5);
  const scoreMap = new Map(scores);
  
  let bestCombo = combos[0];
  let bestScore = -Infinity;
  
  for (const combo of combos) {
    let score = 0;
    const sorted = [...combo].sort((a, b) => a - b);
    const comboSet = new Set(combo);
    
    combo.forEach(t => { score += scoreMap.get(t) || 0; });
    
    // 连续性
    let maxCon = 1, curCon = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i-1] + 1) { curCon++; maxCon = Math.max(maxCon, curCon); } else curCon = 1;
    }
    if (maxCon >= 3) score += 20; else if (maxCon >= 2) score += 10;
    
    // 等差性
    for (let i = 0; i < sorted.length - 2; i++) {
      for (let j = i + 1; j < sorted.length - 1; j++) {
        for (let k = j + 1; k < sorted.length; k++) {
          if ((sorted[j] - sorted[i]) === (sorted[k] - sorted[j]) && (sorted[j] - sorted[i]) >= 1) { score += 15; break; }
        }
      }
    }
    
    // 跨行重复
    combo.forEach(t => { if (prevRowTails.has(t)) score += 8; });
    
    // 奇偶平衡
    if (combo.filter(t => t % 2 === 0).length >= 2 && combo.filter(t => t % 2 === 1).length >= 2) score += 5;
    
    if (score > bestScore) { bestScore = score; bestCombo = combo; }
  }
  
  return bestCombo;
}

// 回测
function backtest(gapFillWeight, startRow, endRow) {
  let top5Hits = 0, top5HitCount = 0, poolHits = 0, poolHitCount = 0, total = 0;
  
  for (let r = startRow; r <= endRow; r++) {
    const prevDraw = draws[r - 2];
    const currDraw = draws[r - 1];
    if (!prevDraw || !currDraw) continue;
    
    total++;
    const currTails = new Set(currDraw.front.map(n => n % 10));
    const prevRowTails = new Set(prevDraw.front.map(n => n % 10));
    
    const predictedScores = predictTails(draws, r, gapFillWeight);
    
    const top5 = getBestCombo(predictedScores, prevRowTails);
    const top5Hit = top5.filter(t => currTails.has(t)).length;
    if (top5Hit > 0) top5Hits++;
    top5HitCount += top5Hit;
    
    const sorted = predictedScores.sort((a, b) => b[1] - a[1]);
    const pool = sorted.slice(0, 8).map(([t]) => t);
    const poolHit = pool.filter(t => currTails.has(t)).length;
    if (poolHit > 0) poolHits++;
    poolHitCount += poolHit;
  }
  
  return {
    top5HitRate: (top5Hits / total * 100).toFixed(1),
    top5Avg: (top5HitCount / total).toFixed(2),
    union: (top5HitCount / (total * 5) * 100).toFixed(1),
    poolAvg: (poolHitCount / total).toFixed(2)
  };
}

// 测试不同权重
const startRow = 60;
const endRow = draws.length;

console.log('═══════════════════════════════════════════════════════');
console.log('    不同间隔填充分数权重的回测对比');
console.log('═══════════════════════════════════════════════════════\n');
console.log(`回测范围: 第${startRow}期 ~ 第${endRow}期\n`);

const weights = [0, 3, 5, 8, 10, 12, 15];
const results = [];

console.log('权重 | Top5命中率 | Top5均值 | 联合覆盖 | 池均值');
console.log('-----|-----------|---------|---------|-------');

for (const w of weights) {
  const r = backtest(w, startRow, endRow);
  results.push({ weight: w, ...r });
  console.log(`${String(w).padStart(4)} | ${r.top5HitRate.padStart(9)}% | ${r.top5Avg.padStart(7)} | ${r.union.padStart(7)}% | ${r.poolAvg}`);
}

// 找最佳权重
const best = results.reduce((a, b) => parseFloat(b.top5Avg) > parseFloat(a.top5Avg) ? b : a);
console.log(`\n最佳权重: ${best.weight} (Top5均值: ${best.top5Avg}, 联合覆盖: ${best.union}%)`);
