// 回测对比：间隔填充模式前后效果
const fs = require('fs');
const path = require('path');

// 加载数据
const rawJs = fs.readFileSync(path.join(__dirname, 'all_draws.js'), 'utf8');
const match = rawJs.match(/window\.ALL_DRAWS_DATA\s*=\s*(\[[\s\S]*?\]);/);
const ALL_DRAWS_DATA = eval(match[1]);

// 按期号升序排列
const draws = ALL_DRAWS_DATA.sort((a, b) => parseInt(a.issue) - parseInt(b.issue));

console.log(`共${draws.length}期数据，范围: ${draws[0].issue} ~ ${draws[draws.length-1].issue}\n`);

// ============ 尾号预测函数（简化版） ============

// 1. 转移概率分析
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

// 2. 预测尾号（不含间隔填充）
function predictTailsWithoutGapFill(draws, sourceRow) {
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
  
  // 3. 相同或相邻尾号
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
        const ext1 = (sortedSrc[i] - diff + 10) % 10;
        const ext2 = (sortedSrc[j] + diff) % 10;
        scores.set(ext1, scores.get(ext1) + 6);
        scores.set(ext2, scores.get(ext2) + 6);
        // 中间值
        for (let v = sortedSrc[i] + 1; v < sortedSrc[j]; v++) {
          scores.set(v, scores.get(v) + 4);
        }
      }
    }
  }
  
  return [...scores.entries()];
}

// 3. 预测尾号（含间隔填充）
function predictTailsWithGapFill(draws, sourceRow) {
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
  
  // 3. 相同或相邻尾号
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
        const ext1 = (sortedSrc[i] - diff + 10) % 10;
        const ext2 = (sortedSrc[j] + diff) % 10;
        scores.set(ext1, scores.get(ext1) + 6);
        scores.set(ext2, scores.get(ext2) + 6);
        // 中间值
        for (let v = sortedSrc[i] + 1; v < sortedSrc[j]; v++) {
          scores.set(v, scores.get(v) + 4);
        }
      }
    }
  }
  
  // 5. 🆕 间隔填充模式（98.3%命中率）
  const prevDraw = draws[sourceRow - 2]; // 上一期
  if (prevDraw) {
    const prevTails = [...new Set(prevDraw.front.map(n => n % 10))].sort((a, b) => a - b);
    
    for (let a = 0; a < prevTails.length; a++) {
      for (let b = a + 1; b < prevTails.length; b++) {
        const t1 = prevTails[a];
        const t2 = prevTails[b];
        const gap = t2 - t1;
        
        if (gap >= 2 && gap <= 4) {
          // 中间值 +3
          for (let v = t1 + 1; v < t2; v++) {
            scores.set(v, scores.get(v) + 3 * 15 / 10);
          }
          // 延伸值 +2
          const ext1 = (t1 - gap + 10) % 10;
          const ext2 = (t2 + gap) % 10;
          scores.set(ext1, scores.get(ext1) + 2 * 15 / 10);
          scores.set(ext2, scores.get(ext2) + 2 * 15 / 10);
          // 邻号 +4（命中率最高）
          for (let v = t1 + 1; v < t2; v++) {
            const n1 = (v - 1 + 10) % 10;
            const n2 = (v + 1) % 10;
            scores.set(n1, scores.get(n1) + 4 * 15 / 10);
            scores.set(n2, scores.get(n2) + 4 * 15 / 10);
          }
        }
      }
    }
  }
  
  return [...scores.entries()];
}

// 4. 组合优化（简化版：从top8选5）
function getBestCombo(scores, prevRowTails) {
  const sorted = scores.sort((a, b) => b[1] - a[1]);
  const top8 = sorted.slice(0, 8).map(([t]) => t);
  
  // 生成C(8,5)=56种组合
  function getCombinations(arr, k) {
    if (k === 0) return [[]];
    if (arr.length === 0) return [];
    const [first, ...rest] = arr;
    const withFirst = getCombinations(rest, k - 1).map(c => [first, ...c]);
    const withoutFirst = getCombinations(rest, k);
    return [...withFirst, ...withoutFirst];
  }
  
  const combos = getCombinations(top8, 5);
  const scoreMap = new Map(scores);
  
  let bestCombo = combos[0];
  let bestScore = -Infinity;
  
  for (const combo of combos) {
    let score = 0;
    const sorted = [...combo].sort((a, b) => a - b);
    const comboSet = new Set(combo);
    
    // 基础分
    combo.forEach(t => { score += scoreMap.get(t) || 0; });
    
    // 连续性
    let maxCon = 1, curCon = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i-1] + 1 || (sorted[i-1] === 9 && sorted[i] === 0)) {
        curCon++;
        maxCon = Math.max(maxCon, curCon);
      } else {
        curCon = 1;
      }
    }
    if (maxCon >= 3) score += 20;
    else if (maxCon >= 2) score += 10;
    
    // 等差性
    for (let i = 0; i < sorted.length - 2; i++) {
      for (let j = i + 1; j < sorted.length - 1; j++) {
        for (let k = j + 1; k < sorted.length; k++) {
          const d1 = (sorted[j] - sorted[i] + 10) % 10;
          const d2 = (sorted[k] - sorted[j] + 10) % 10;
          if (d1 === d2 && d1 >= 1 && d1 <= 4) { score += 15; break; }
        }
      }
    }
    
    // 跨行重复
    combo.forEach(t => { if (prevRowTails.has(t)) score += 8; });
    
    // 奇偶平衡
    const even = combo.filter(t => t % 2 === 0).length;
    const odd = combo.filter(t => t % 2 === 1).length;
    if (even >= 2 && odd >= 2) score += 5;
    
    // 组内间隔填充
    for (let a = 0; a < sorted.length; a++) {
      for (let b = a + 1; b < sorted.length; b++) {
        const gap = sorted[b] - sorted[a];
        if (gap >= 2 && gap <= 4) {
          for (let v = sorted[a] + 1; v < sorted[b]; v++) {
            if (comboSet.has(v)) score += 5;
            const n1 = (v - 1 + 10) % 10;
            const n2 = (v + 1) % 10;
            if (comboSet.has(n1)) score += 3;
            if (comboSet.has(n2)) score += 3;
          }
        }
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestCombo = combo;
    }
  }
  
  return bestCombo;
}

// ============ 回测主逻辑 ============

function backtest(predictFunc, startRow, endRow) {
  let totalDraws = 0;
  let top5Hits = 0;      // Top5中命中≥1个的期数
  let top5HitCount = 0;  // Top5总命中数
  let poolHits = 0;      // 候选池命中≥1个的期数
  let poolHitCount = 0;  // 候选池总命中数
  
  for (let r = startRow; r <= endRow; r++) {
    const prevDraw = draws[r - 2];
    const currDraw = draws[r - 1];
    if (!prevDraw || !currDraw) continue;
    
    totalDraws++;
    
    const currTails = new Set(currDraw.front.map(n => n % 10));
    const prevRowTails = new Set(prevDraw.front.map(n => n % 10));
    
    // 预测
    const predictedScores = predictFunc(draws, r);
    
    // Top5
    const top5 = getBestCombo(predictedScores, prevRowTails);
    const top5Hit = top5.filter(t => currTails.has(t)).length;
    if (top5Hit > 0) top5Hits++;
    top5HitCount += top5Hit;
    
    // 候选池（top8）
    const sorted = predictedScores.sort((a, b) => b[1] - a[1]);
    const pool = sorted.slice(0, 8).map(([t]) => t);
    const poolHit = pool.filter(t => currTails.has(t)).length;
    if (poolHit > 0) poolHits++;
    poolHitCount += poolHit;
  }
  
  return {
    totalDraws,
    top5HitRate: (top5Hits / totalDraws * 100).toFixed(1),
    top5AvgHits: (top5HitCount / totalDraws).toFixed(2),
    poolHitRate: (poolHits / totalDraws * 100).toFixed(1),
    poolAvgHits: (poolHitCount / totalDraws).toFixed(2),
    unionCoverage: (top5HitCount / (totalDraws * 5) * 100).toFixed(1)
  };
}

// 运行回测
const startRow = 60;  // 从第60期开始（需要足够历史数据）
const endRow = draws.length;

console.log('═══════════════════════════════════════════════════════');
console.log('        间隔填充模式回测对比');
console.log('═══════════════════════════════════════════════════════\n');
console.log(`回测范围: 第${startRow}期 ~ 第${endRow}期 (共${endRow - startRow + 1}期)\n`);

console.log('【不含间隔填充模式】');
const resultWithout = backtest(predictTailsWithoutGapFill, startRow, endRow);
console.log(`  Top5命中率: ${resultWithout.top5HitRate}%`);
console.log(`  Top5平均命中: ${resultWithout.top5AvgHits}个/期`);
console.log(`  联合覆盖率: ${resultWithout.unionCoverage}%`);
console.log(`  候选池命中率: ${resultWithout.poolHitRate}%`);
console.log(`  候选池平均命中: ${resultWithout.poolAvgHits}个/期`);

console.log('\n【含间隔填充模式】');
const resultWith = backtest(predictTailsWithGapFill, startRow, endRow);
console.log(`  Top5命中率: ${resultWith.top5HitRate}%`);
console.log(`  Top5平均命中: ${resultWith.top5AvgHits}个/期`);
console.log(`  联合覆盖率: ${resultWith.unionCoverage}%`);
console.log(`  候选池命中率: ${resultWith.poolHitRate}%`);
console.log(`  候选池平均命中: ${resultWith.poolAvgHits}个/期`);

console.log('\n【提升幅度】');
const top5Diff = (parseFloat(resultWith.top5HitRate) - parseFloat(resultWithout.top5HitRate)).toFixed(1);
const unionDiff = (parseFloat(resultWith.unionCoverage) - parseFloat(resultWithout.unionCoverage)).toFixed(1);
const poolDiff = (parseFloat(resultWith.poolHitRate) - parseFloat(resultWithout.poolHitRate)).toFixed(1);
console.log(`  Top5命中率: ${top5Diff > 0 ? '+' : ''}${top5Diff}个百分点`);
console.log(`  联合覆盖率: ${unionDiff > 0 ? '+' : ''}${unionDiff}个百分点`);
console.log(`  候选池命中率: ${poolDiff > 0 ? '+' : ''}${poolDiff}个百分点`);

console.log('\n═══════════════════════════════════════════════════════');
