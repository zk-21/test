// 全量回测：10种尾号模式命中率对比
const fs = require('fs');
const path = require('path');

const rawJs = fs.readFileSync(path.join(__dirname, 'all_draws.js'), 'utf8');
const match = rawJs.match(/window\.ALL_DRAWS_DATA\s*=\s*(\[[\s\S]*?\]);/);
const ALL_DRAWS_DATA = eval(match[1]);
const draws = ALL_DRAWS_DATA.sort((a, b) => parseInt(a.issue) - parseInt(b.issue));

console.log(`共${draws.length}期数据，范围: ${draws[0].issue} ~ ${draws[draws.length-1].issue}\n`);

// ============ 10种模式生成函数 ============

// 模式1: 尾号对（高频共现的2个尾号）
function modePairTails(draws, sourceRow) {
  const freq = new Map();
  for (let r = Math.max(1, sourceRow - 50); r < sourceRow; r++) {
    const d = draws[r - 1];
    if (!d) continue;
    const tails = [...new Set(d.front.map(n => n % 10))];
    for (let a = 0; a < tails.length; a++) {
      for (let b = a + 1; b < tails.length; b++) {
        const key = `${Math.min(tails[a], tails[b])},${Math.max(tails[a], tails[b])}`;
        freq.set(key, (freq.get(key) || 0) + 1);
      }
    }
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return [0, 1, 2, 3, 4];
  const topPair = sorted[0][0].split(',').map(Number);
  const result = [...topPair];
  // 补充到5个
  for (let t = 0; t <= 9 && result.length < 5; t++) {
    if (!result.includes(t)) result.push(t);
  }
  return result.slice(0, 5);
}

// 模式2: 三元组（高频共现的3个尾号）
function modeTripletTails(draws, sourceRow) {
  const freq = new Map();
  for (let r = Math.max(1, sourceRow - 50); r < sourceRow; r++) {
    const d = draws[r - 1];
    if (!d) continue;
    const tails = [...new Set(d.front.map(n => n % 10))].sort((a, b) => a - b);
    for (let a = 0; a < tails.length - 2; a++) {
      for (let b = a + 1; b < tails.length - 1; b++) {
        for (let c = b + 1; c < tails.length; c++) {
          const key = `${tails[a]},${tails[b]},${tails[c]}`;
          freq.set(key, (freq.get(key) || 0) + 1);
        }
      }
    }
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return [0, 1, 2, 3, 4];
  const topTriplet = sorted[0][0].split(',').map(Number);
  const result = [...topTriplet];
  for (let t = 0; t <= 9 && result.length < 5; t++) {
    if (!result.includes(t)) result.push(t);
  }
  return result.slice(0, 5);
}

// 模式3: 连续（连续尾号如1,2,3）
function modeConsecutiveTails(draws, sourceRow) {
  const freq = new Map();
  for (let r = Math.max(1, sourceRow - 50); r < sourceRow; r++) {
    const d = draws[r - 1];
    if (!d) continue;
    const tails = [...new Set(d.front.map(n => n % 10))].sort((a, b) => a - b);
    for (let len = 3; len <= 5; len++) {
      for (let i = 0; i <= tails.length - len; i++) {
        let isConsec = true;
        for (let j = 1; j < len; j++) {
          if (tails[i + j] !== tails[i + j - 1] + 1) { isConsec = false; break; }
        }
        if (isConsec) {
          const key = tails.slice(i, i + len).join(',');
          freq.set(key, (freq.get(key) || 0) + 1);
        }
      }
    }
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return [0, 1, 2, 3, 4];
  const result = sorted[0][0].split(',').map(Number);
  for (let t = 0; t <= 9 && result.length < 5; t++) {
    if (!result.includes(t)) result.push(t);
  }
  return result.slice(0, 5);
}

// 模式4: 等差（等差尾号如1,3,5）
function modeArithmeticTails(draws, sourceRow) {
  const freq = new Map();
  for (let r = Math.max(1, sourceRow - 50); r < sourceRow; r++) {
    const d = draws[r - 1];
    if (!d) continue;
    const tails = [...new Set(d.front.map(n => n % 10))].sort((a, b) => a - b);
    for (let a = 0; a < tails.length - 2; a++) {
      for (let b = a + 1; b < tails.length - 1; b++) {
        for (let c = b + 1; c < tails.length; c++) {
          if (tails[b] - tails[a] === tails[c] - tails[b]) {
            const key = `${tails[a]},${tails[b]},${tails[c]}`;
            freq.set(key, (freq.get(key) || 0) + 1);
          }
        }
      }
    }
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return [0, 1, 2, 3, 4];
  const result = sorted[0][0].split(',').map(Number);
  for (let t = 0; t <= 9 && result.length < 5; t++) {
    if (!result.includes(t)) result.push(t);
  }
  return result.slice(0, 5);
}

// 模式5: 多段连续
function modeMultiSegmentTails(draws, sourceRow) {
  const sourceDraw = draws[sourceRow - 1];
  if (!sourceDraw) return [0, 1, 2, 3, 4];
  const srcTails = [...new Set(sourceDraw.front.map(n => n % 10))].sort((a, b) => a - b);
  const result = [...srcTails];
  // 扩展连续段
  for (const t of srcTails) {
    if (!result.includes((t + 1) % 10) && result.length < 5) result.push((t + 1) % 10);
    if (!result.includes((t - 1 + 10) % 10) && result.length < 5) result.push((t - 1 + 10) % 10);
  }
  for (let t = 0; t <= 9 && result.length < 5; t++) {
    if (!result.includes(t)) result.push(t);
  }
  return result.slice(0, 5);
}

// 模式6: 混合模式
function modeMixedTails(draws, sourceRow) {
  const sourceDraw = draws[sourceRow - 1];
  if (!sourceDraw) return [0, 1, 2, 3, 4];
  const srcTails = new Set(sourceDraw.front.map(n => n % 10));
  const scores = new Map();
  for (let t = 0; t <= 9; t++) scores.set(t, 0);
  // 与源尾号相邻
  srcTails.forEach(t => {
    scores.set((t + 1) % 10, scores.get((t + 1) % 10) + 5);
    scores.set((t - 1 + 10) % 10, scores.get((t - 1 + 10) % 10) + 5);
  });
  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, 5).map(([t]) => t);
}

// 模式7: 转移+混合
function modeTransferTails(draws, sourceRow) {
  const scores = new Map();
  for (let t = 0; t <= 9; t++) scores.set(t, 0);
  const sourceDraw = draws[sourceRow - 1];
  if (!sourceDraw) return [0, 1, 2, 3, 4];
  const srcTails = new Set(sourceDraw.front.map(n => n % 10));
  
  // 转移频率
  for (let r = Math.max(1, sourceRow - 30); r < sourceRow; r++) {
    const prev = draws[r - 1];
    const curr = draws[r];
    if (!prev || !curr) continue;
    const prevTails = new Set(prev.front.map(n => n % 10));
    const currTails = curr.front.map(n => n % 10);
    for (const st of prevTails) {
      for (const tt of currTails) {
        if (srcTails.has(st)) {
          scores.set(tt, scores.get(tt) + 3);
        }
      }
    }
  }
  
  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, 5).map(([t]) => t);
}

// 模式8: 桥接（源尾号之间的间隔尾号）
function modeBridgeTails(draws, sourceRow) {
  const sourceDraw = draws[sourceRow - 1];
  if (!sourceDraw) return [0, 1, 2, 3, 4];
  const srcTails = [...new Set(sourceDraw.front.map(n => n % 10))].sort((a, b) => a - b);
  const bridgeSet = new Set();
  
  for (let a = 0; a < srcTails.length; a++) {
    for (let b = a + 1; b < srcTails.length; b++) {
      const gap = srcTails[b] - srcTails[a];
      if (gap >= 2 && gap <= 4) {
        for (let v = srcTails[a] + 1; v < srcTails[b]; v++) {
          bridgeSet.add(v);
        }
      }
    }
  }
  
  const result = [...bridgeSet];
  for (let t = 0; t <= 9 && result.length < 5; t++) {
    if (!result.includes(t)) result.push(t);
  }
  return result.slice(0, 5);
}

// 模式9: 等差延伸（公差2等差对的延伸点邻号）
function modeArithExtTails(draws, sourceRow) {
  const scores = new Map();
  for (let t = 0; t <= 9; t++) scores.set(t, 0);
  const sourceDraw = draws[sourceRow - 1];
  if (!sourceDraw) return [0, 1, 2, 3, 4];
  const srcTails = [...new Set(sourceDraw.front.map(n => n % 10))].sort((a, b) => a - b);
  
  for (let a = 0; a < srcTails.length; a++) {
    for (let b = a + 1; b < srcTails.length; b++) {
      const diff = srcTails[b] - srcTails[a];
      if (diff === 2) {
        const ext = (srcTails[a] + srcTails[b]) / 2;
        scores.set(ext, scores.get(ext) + 10);
        scores.set((ext - 1 + 10) % 10, scores.get((ext - 1 + 10) % 10) + 8);
        scores.set((ext + 1) % 10, scores.get((ext + 1) % 10) + 8);
      }
    }
  }
  
  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const result = sorted.filter(([, s]) => s > 0).slice(0, 5).map(([t]) => t);
  for (let t = 0; t <= 9 && result.length < 5; t++) {
    if (!result.includes(t)) result.push(t);
  }
  return result.slice(0, 5);
}

// 模式10: 间隔填充（上期等差对的中间值/延伸值/邻号）
function modeGapFillTails(draws, sourceRow) {
  const scores = new Map();
  for (let t = 0; t <= 9; t++) scores.set(t, 0);
  const prevDraw = draws[sourceRow - 2];
  if (!prevDraw) return [0, 1, 2, 3, 4];
  const prevTails = [...new Set(prevDraw.front.map(n => n % 10))].sort((a, b) => a - b);
  
  for (let a = 0; a < prevTails.length; a++) {
    for (let b = a + 1; b < prevTails.length; b++) {
      const t1 = prevTails[a], t2 = prevTails[b], gap = t2 - t1;
      if (gap >= 2 && gap <= 4) {
        for (let v = t1 + 1; v < t2; v++) {
          scores.set(v, scores.get(v) + 3); // 中间值
          scores.set((v - 1 + 10) % 10, scores.get((v - 1 + 10) % 10) + 4); // 邻号
          scores.set((v + 1) % 10, scores.get((v + 1) % 10) + 4);
        }
        scores.set((t1 - gap + 10) % 10, scores.get((t1 - gap + 10) % 10) + 2); // 延伸值
        scores.set((t2 + gap) % 10, scores.get((t2 + gap) % 10) + 2);
      }
    }
  }
  
  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const result = sorted.filter(([, s]) => s > 0).slice(0, 5).map(([t]) => t);
  for (let t = 0; t <= 9 && result.length < 5; t++) {
    if (!result.includes(t)) result.push(t);
  }
  return result.slice(0, 5);
}

// ============ 回测主逻辑 ============

const modeNames = ['尾号对', '三元组', '连续', '等差', '多段连续', '混合模式', '转移+混合', '桥接', '等差延伸', '间隔填充'];
const modeFuncs = [modePairTails, modeTripletTails, modeConsecutiveTails, modeArithmeticTails, modeMultiSegmentTails, modeMixedTails, modeTransferTails, modeBridgeTails, modeArithExtTails, modeGapFillTails];

const startRow = 60;
const endRow = draws.length;

console.log('═══════════════════════════════════════════════════════');
console.log('        10种尾号模式全量回测');
console.log('═══════════════════════════════════════════════════════\n');
console.log(`回测范围: 第${startRow}期 ~ 第${endRow}期 (共${endRow - startRow + 1}期)\n`);

// 统计每种模式
const stats = modeFuncs.map(() => ({
  hits: 0,       // 至少命中1个的期数
  totalHits: 0,  // 总命中数
  hit2Plus: 0,   // 命中2个及以上的期数
  hit3Plus: 0,   // 命中3个及以上的期数
}));

let totalDraws = 0;

for (let r = startRow; r <= endRow; r++) {
  const currDraw = draws[r - 1];
  if (!currDraw) continue;
  
  totalDraws++;
  const currTails = new Set(currDraw.front.map(n => n % 10));
  
  for (let m = 0; m < modeFuncs.length; m++) {
    const predictedTails = modeFuncs[m](draws, r);
    const hitCount = predictedTails.filter(t => currTails.has(t)).length;
    
    stats[m].totalHits += hitCount;
    if (hitCount >= 1) stats[m].hits++;
    if (hitCount >= 2) stats[m].hit2Plus++;
    if (hitCount >= 3) stats[m].hit3Plus++;
  }
}

// 输出结果
console.log('模式名称     | 命中率  | ≥2命中 | ≥3命中 | 平均命中');
console.log('-------------|---------|--------|--------|--------');

for (let m = 0; m < modeNames.length; m++) {
  const s = stats[m];
  const hitRate = (s.hits / totalDraws * 100).toFixed(1);
  const hit2Rate = (s.hit2Plus / totalDraws * 100).toFixed(1);
  const hit3Rate = (s.hit3Plus / totalDraws * 100).toFixed(1);
  const avgHit = (s.totalHits / totalDraws).toFixed(2);
  
  const isNew = m >= 9; // 间隔填充是新增的
  const marker = isNew ? ' 🆕' : '';
  console.log(`${modeNames[m].padEnd(12)} | ${hitRate.padStart(6)}% | ${hit2Rate.padStart(5)}% | ${hit3Rate.padStart(5)}% | ${avgHit.padStart(5)}${marker}`);
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('        排名（按平均命中数）');
console.log('═══════════════════════════════════════════════════════\n');

const ranked = modeNames.map((name, i) => ({
  name,
  avgHit: stats[i].totalHits / totalDraws,
  hitRate: stats[i].hits / totalDraws * 100,
  isNew: i >= 9
})).sort((a, b) => b.avgHit - a.avgHit);

ranked.forEach((r, i) => {
  const marker = r.isNew ? ' 🆕' : '';
  console.log(`${i + 1}. ${r.name.padEnd(12)} 平均${r.avgHit.toFixed(2)}个  命中率${r.hitRate.toFixed(1)}%${marker}`);
});
