/**
 * backtest_v5_random.js — 6维度独立 + 随机出号码 vs 评分排序对比
 * 
 * 对比方案：
 *   A) 原版：6维度按评分高低取Top-N生成组合
 *   B) 随机：6维度从候选池加权随机抽取号码生成组合
 * 
 * 运行：node backtest_v5_random.js
 */

const fs = require('fs');
const path = require('path');

// ======================== 1. 加载开奖数据 ========================
const rawJs = fs.readFileSync(path.join(__dirname, 'all_draws.js'), 'utf8');
const match = rawJs.match(/window\.ALL_DRAWS_DATA\s*=\s*(\[[\s\S]*?\]);/);
if (!match) { console.error('无法解析 all_draws.js'); process.exit(1); }
const ALL_DRAWS_DATA = eval(match[1]);
const DRAWS = [...ALL_DRAWS_DATA].reverse();

// ======================== 2. 常量 ========================
const sampleIntervals = [
  { min: 1, max: 12 },
  { min: 13, max: 24 },
  { min: 25, max: 35 },
];
const V4_OFFSET_SCORE = { 0:20, 1:15, 2:13, 3:12, 4:11, 5:12, 6:8, 7:7, 8:5, 9:4, 10:3, 11:2, 12:1 };
const V4_TAIL_SAME = 35;
const V4_TAIL_NEIGHBOR = 15;
const V4_TAIL_WITHIN = 8;

// ======================== 3. 工具函数 ========================
function sum(nums) { return nums.reduce((a, b) => a + b, 0); }
function oddCount(nums) { return nums.filter(n => n % 2 === 1).length; }
function intervalRatio(nums) {
  const iv = [0, 0, 0];
  nums.forEach(n => { const i = sampleIntervals.findIndex(iv => n >= iv.min && n <= iv.max); if (i >= 0) iv[i]++; });
  return iv;
}
function tails(nums) { return [...new Set(nums.map(n => n % 10))].sort((a, b) => a - b); }
function getSampleIntervalIndex(n) { return sampleIntervals.findIndex(iv => n >= iv.min && n <= iv.max); }

// ======================== 4. 桥接 + 等差映射 ========================
function buildV4BridgeMap(anchorNumbers, supportNumbers) {
  const gapMap = new Map();
  const endpointMap = new Map();
  const anchors = [...anchorNumbers].sort((a, b) => a - b);
  for (let i = 0; i < anchors.length - 1; i++) {
    const gap = anchors[i + 1] - anchors[i];
    if (gap >= 2 && gap <= 5) {
      for (let n = anchors[i] + 1; n < anchors[i + 1]; n++) {
        if (n >= 1 && n <= 35) {
          const prev = gapMap.get(n) || { hits: 0, score: 0, count: 0 };
          prev.hits++; prev.score += Math.max(0, 10 - Math.abs(n - anchors[i] - 2) * 3) + Math.max(0, 10 - Math.abs(anchors[i + 1] - n - 2) * 3);
          prev.count++; gapMap.set(n, prev);
        }
      }
    }
  }
  anchors.forEach(a => {
    for (let d = 1; d <= 4; d++) {
      [a - d, a + d].forEach(n => {
        if (n >= 1 && n <= 35 && !anchors.some(x => x === n)) {
          const prev = endpointMap.get(n) || { hits: 0, score: 0 };
          prev.hits++; prev.score += Math.max(0, 12 - d * 3);
          endpointMap.set(n, prev);
        }
      });
    }
  });
  return { gapMap, endpointMap };
}

function buildV4ArithmeticMap(anchorNumbers, maxDiff, supportNumbers) {
  const map = new Map();
  const anchors = [...new Set(anchorNumbers)].sort((a, b) => a - b);
  maxDiff = maxDiff || 17;
  for (let i = 0; i < anchors.length; i++) {
    for (let j = i + 1; j < anchors.length; j++) {
      const diff = anchors[j] - anchors[i];
      if (diff <= 0 || diff > maxDiff) continue;
      const next = anchors[j] + diff;
      if (next >= 1 && next <= 35 && !anchors.includes(next)) {
        const prev = map.get(next) || { hits: 0, score: 0 }; prev.hits++; prev.score += 10; map.set(next, prev);
      }
      const prev2 = anchors[i] - diff;
      if (prev2 >= 1 && prev2 <= 35 && !anchors.includes(prev2)) {
        const p = map.get(prev2) || { hits: 0, score: 0 }; p.hits++; p.score += 8; map.set(prev2, p);
      }
    }
  }
  return map;
}

// ======================== 5. +10期历史模式 ========================
function buildV4FullReferenceRows(sourceRow, allDraws) {
  const rows = [];
  for (let r = sourceRow + 1; r <= Math.min(sourceRow + 5, allDraws.length - 1); r++) {
    if (allDraws[r]) rows.push(allDraws[r].front);
  }
  return rows;
}

function buildV4PlusTenTrendMap(sourceRow, sourceNums, allDraws) {
  const targetMap = new Map();
  const neighborMap = new Map();
  const sourceSet = new Set(sourceNums);
  let cnt = 0;
  for (let i = 0; i < allDraws.length - 10; i++) {
    const row = allDraws[i], next = allDraws[i + 1];
    if (!row || !next) continue;
    const overlap = row.front.filter(n => sourceSet.has(n)).length;
    const neighborHits = row.front.filter(n => sourceNums.some(s => Math.abs(s - n) === 1)).length;
    if (overlap >= 2 || (overlap >= 1 && neighborHits >= 2)) {
      cnt++;
      next.front.forEach(n => {
        targetMap.set(n, (targetMap.get(n) || 0) + 1);
        [n - 1, n + 1].forEach(nb => { if (nb >= 1 && nb <= 35) neighborMap.set(nb, (neighborMap.get(nb) || 0) + 1); });
      });
    }
  }
  const maxVal = Math.max(1, ...targetMap.values());
  return { targetMap, neighborMap, count: cnt, max: maxVal };
}

// ======================== 6. 锚点变换评分 ========================
function evaluateSampleAnchorTransform(numbers, anchorNumbers) {
  const anchorSet = new Set(anchorNumbers);
  let score = 0, keepHits = 0, transformedCount = 0, farOffsetCount = 0;
  const explainedAnchors = new Map();
  const explainable = new Set();
  const supportedRunNumbers = new Set();

  numbers.forEach(n => {
    if (anchorSet.has(n)) { keepHits++; score += 6; explainedAnchors.set(n, (explainedAnchors.get(n) || 0) + 1); explainable.add(n); return; }
    let bestW = 0;
    anchorNumbers.forEach(a => {
      const d = Math.abs(n - a), w = V4_OFFSET_SCORE[d] || 0;
      if (w > 0) { bestW = Math.max(bestW, w); if (d >= 4 || d === 7) farOffsetCount++; explainable.add(n); explainedAnchors.set(a, (explainedAnchors.get(a) || 0) + 1); }
    });
    if (bestW > 0) { score += bestW; transformedCount++; }
  });

  const anchorSorted = [...anchorNumbers].sort((a, b) => a - b);
  let cr = 1;
  for (let i = 1; i <= anchorSorted.length; i++) {
    if (i < anchorSorted.length && anchorSorted[i] === anchorSorted[i - 1] + 1) cr++;
    else {
      if (cr >= 2) {
        const segStart = anchorSorted[i - cr], segEnd = anchorSorted[i - 1];
        numbers.forEach(n => {
          if (anchorSet.has(n)) return;
          if (n >= segStart - 4 && n <= segEnd + 4) {
            const dist = n < segStart ? segStart - n : n - segEnd;
            if (dist >= 1 && dist <= 4) { score += 16 - dist * 2; supportedRunNumbers.add(n); }
          }
        });
      }
      cr = 1;
    }
  }

  const numSorted = [...numbers].sort((a, b) => a - b);
  cr = 1;
  for (let i = 1; i <= numSorted.length; i++) {
    if (i < numSorted.length && numSorted[i] === numSorted[i - 1] + 1) cr++;
    else {
      if (cr >= 2) {
        const seg = numSorted.slice(i - cr, i);
        const sc = seg.filter(n => supportedRunNumbers.has(n) || anchorNumbers.some(a => Math.abs(n - a) <= 3)).length;
        if (sc >= Math.min(2, seg.length)) { score += seg.length * 8; seg.forEach(n => supportedRunNumbers.add(n)); }
      }
      cr = 1;
    }
  }

  const explainableCount = explainable.size;
  let covBonus = 0;
  if (explainableCount >= numbers.length) covBonus = numbers.length * 14;
  else if (explainableCount >= numbers.length - 1) covBonus = explainableCount * 10;
  else if (explainableCount >= 3) covBonus = explainableCount * 6;
  else covBonus = explainableCount * 2;

  let divBonus = 0;
  if (transformedCount >= numbers.length - 1) divBonus = transformedCount * 16;
  else if (transformedCount >= 3) divBonus = transformedCount * 11;
  else divBonus = transformedCount * 4;

  let farBonus = 0;
  if (farOffsetCount >= 3) farBonus = farOffsetCount * 14;
  else if (farOffsetCount >= 2) farBonus = farOffsetCount * 10;
  else farBonus = farOffsetCount * 3;

  const anchorCovCount = explainedAnchors.size;
  let acBonus = 0;
  if (anchorCovCount >= 4) acBonus = anchorCovCount * 12;
  else if (anchorCovCount >= 3) acBonus = anchorCovCount * 7;
  else acBonus = anchorCovCount * 2;

  const maxLoad = explainedAnchors.size > 0 ? Math.max(...explainedAnchors.values()) : 0;
  const crowdPen = maxLoad >= 3 ? (maxLoad - 2) * 12 : 0;
  const keepPen = keepHits >= 2 ? (keepHits - 1) * 14 : 0;

  return {
    anchorTransformScore: score, explainCoverageBonus: covBonus, transformDiversityBonus: divBonus,
    farOffsetBonus: farBonus, farOffsetCount, anchorCoverageBonus: acBonus, anchorCoverageCount: anchorCovCount,
    anchorCrowdPenalty: crowdPen, anchorKeepPenalty: keepPen, anchorKeepHits: keepHits, supportedRunNumbers,
  };
}

// ======================== 7. 跨度/连号惩罚 ========================
function getComboSpreadPenalty(nums) {
  const s = [...nums].sort((a, b) => a - b);
  if (s.length <= 1) return { span: 0, penalty: 0 };
  const sp = s[4] - s[0]; let p = 0;
  const ivs = [0, 0, 0]; s.forEach(n => { const i = getSampleIntervalIndex(n); if (i >= 0) ivs[i]++; });
  const cv = ivs.filter(c => c > 0).length;
  if (cv >= 3) { if (sp <= 18) p += 2; if (sp <= 16) p += 6; if (sp <= 13) p += 10; if (sp <= 10) p += 16; }
  else if (cv === 2) { if (sp <= 12) p += 3; if (sp <= 10) p += 7; if (sp <= 8) p += 12; if (sp <= 6) p += 16; }
  else { if (sp <= 7) p += 2; if (sp <= 5) p += 6; if (sp <= 3) p += 10; }
  for (let i = 0; i <= s.length - 3; i++) {
    for (let j = i + 2; j < s.length; j++) {
      if (s[j] - s[i] <= 8) {
        const c = j - i + 1;
        if (cv >= 3) { if (c >= 4) p += 14 + (c - 4) * 8; else if (c === 3) p += 4; }
        else if (cv === 2) { if (c >= 4) p += 10 + (c - 4) * 6; }
        else { if (c >= 4) p += 8 + (c - 4) * 4; }
        break;
      }
    }
  }
  const mi = Math.max(...ivs);
  if (cv >= 3 && mi >= 4) p += 10 + (mi - 4) * 6;
  else if (cv === 2 && mi >= 4) p += 8 + (mi - 4) * 4;
  return { span: sp, penalty: p, cv };
}

function getComboRunPenalty(nums, supportedRunNumbers = new Set()) {
  const s = [...nums].sort((a, b) => a - b);
  let p = 0, dc = 0, cr = 1;
  for (let i = 1; i <= s.length; i++) {
    if (i < s.length && s[i] === s[i - 1] + 1) cr++;
    else {
      if (cr >= 2) {
        const seg = s.slice(i - cr, i);
        const sc = seg.filter(n => supportedRunNumbers.has(n)).length;
        const disc = seg.length > 0 && sc / seg.length >= 0.8 ? 0.45 : seg.length > 0 && sc / seg.length >= 0.6 ? 0.75 : 1;
        if (cr === 2) { dc++; p += Math.round(8 * disc); }
        else if (cr === 3) p += Math.round(36 * disc);
        else p += Math.round((70 + (cr - 4) * 16) * disc);
      }
      cr = 1;
    }
  }
  if (dc >= 2) p += (dc - 1) * 6;
  return p;
}

// ======================== 8. 参考行匹配 ========================
function computeReferenceMatch(nums, refRows) {
  let total = 0;
  refRows.forEach(ref => {
    const rs = new Set(ref);
    const ol = Math.min(nums.filter(n => rs.has(n)).length, 3);
    const nb = Math.min(nums.filter(n => rs.has(n - 1) || rs.has(n + 1)).length, 3);
    const tl = Math.min(nums.filter(n => rs.has(n % 10)).length, 3);
    const sh = Math.min(nums.filter(n => {
      const refTails = [...new Set(ref.map(r => r % 10))];
      return refTails.some(t => Math.abs((n % 10) - t) <= 1);
    }).length, 3);
    total += ol * 8 + nb * 8 + tl * 8 + sh * 4 + sh * 8;
  });
  return total;
}

// ======================== 9. 单号评分（候选池）=======================
function scoreSingleNumber(n, sourceNums, sourceTails, predictedTails, bridgeMap, arithMap,
  plusTenTrend, hotness, ivPrediction, sourceIv, sourceOdd, targetOdd,
  sourceSum, targetSum, historyMetrics) {
  let score = 0;
  let minOff = Infinity;
  sourceNums.forEach(a => { minOff = Math.min(minOff, Math.abs(n - a)); });
  score += V4_OFFSET_SCORE[minOff] || 0;
  const t = n % 10;
  if (predictedTails && predictedTails.length > 0) {
    const topTails = new Set(predictedTails.slice(0, 5).map(tt => tt[0] || tt));
    if (topTails.has(t)) score += V4_TAIL_SAME;
    else if (predictedTails.some(tt => Math.abs(t - (tt[0] || tt)) === 1)) score += V4_TAIL_NEIGHBOR;
    else if (sourceTails.includes(t)) score += V4_TAIL_WITHIN;
  } else { if (sourceTails.includes(t)) score += V4_TAIL_WITHIN; }
  if (plusTenTrend && plusTenTrend.max > 0) {
    const ptScore = plusTenTrend.targetMap.get(n) || 0;
    if (ptScore > 0) score += Math.round(ptScore / plusTenTrend.max * 30);
    const ptNb = plusTenTrend.neighborMap.get(n) || 0;
    if (ptNb > 0) score += Math.round(ptNb / plusTenTrend.max * 6);
  }
  const maxBridge = 50;
  const bg = bridgeMap.gapMap.get(n); const be = bridgeMap.endpointMap.get(n);
  if (bg) score += Math.round(Math.min(bg.score, maxBridge) / maxBridge * 15);
  if (be) score += Math.round(Math.min(be.score, maxBridge) / maxBridge * 8);
  const maxArith = 50;
  const ae = arithMap.get(n);
  if (ae) score += Math.round(Math.min(ae.score, maxArith) / maxArith * 10);
  const hot = hotness.get(n) || 0;
  if (hot >= 4) score += 6; else if (hot >= 3) score += 4; else if (hot >= 2) score += 2; else if (hot === 0) score -= 1;
  const iv = getSampleIntervalIndex(n);
  if (ivPrediction && sourceIv[iv] < ivPrediction[iv]) score += 3;
  if (n % 2 === 1 && sourceOdd < targetOdd) score += 2;
  else if (n % 2 === 0 && sourceOdd > targetOdd) score += 2;
  const sumDiff = targetSum - sourceSum;
  if (Math.abs(sumDiff) > 10) {
    if (sumDiff > 0 && n >= 15) score += 2; else if (sumDiff < 0 && n <= 18) score += 2;
  }
  if (historyMetrics && historyMetrics.avgHistoryFreq > 0) {
    const hf = (historyMetrics.historyFreq[n] || 0);
    const rf = (historyMetrics.recentFreq[n] || 0);
    const hr = hf / historyMetrics.avgHistoryFreq;
    const rr = rf / Math.max(0.001, historyMetrics.avgRecentFreq);
    if (hr > 1.2) score += Math.round((hr - 1) * 15);
    if (rr > 1.3) score += Math.round((rr - 1) * 10);
  }
  if (sourceNums.some(a => Math.abs(a - n) === 1)) score += 12;
  return score;
}

// ======================== 10. 尾号预测 ========================
function predictTails(sourceRow, sourceTails, allDraws) {
  const tailFreq = new Map(); let cnt = 0;
  for (let i = 0; i < allDraws.length - 1; i++) {
    const row = allDraws[i], next = allDraws[i + 1];
    if (!row || !next) continue;
    const rowTails = tails(row.front);
    const overlap = rowTails.filter(t => sourceTails.includes(t)).length;
    if (overlap >= 2) { cnt++; next.front.forEach(n => { const t = n % 10; tailFreq.set(t, (tailFreq.get(t) || 0) + 1); }); }
  }
  return [...tailFreq.entries()].sort((a, b) => b[1] - a[1]);
}

// ======================== 11. 历史频率 ========================
function calcHistoryMetrics(allDraws, sourceIdx) {
  const historyFreq = new Array(36).fill(0); const recentFreq = new Array(36).fill(0); let totalBalls = 0;
  const histStart = Math.max(0, sourceIdx - 50);
  for (let i = histStart; i < sourceIdx; i++) { const d = allDraws[i]; if (!d) continue; d.front.forEach(n => { historyFreq[n]++; totalBalls++; }); }
  const recentStart = Math.max(0, sourceIdx - 5);
  for (let i = recentStart; i < sourceIdx; i++) { const d = allDraws[i]; if (!d) continue; d.front.forEach(n => recentFreq[n]++); }
  const recentTotal = Math.max(1, allDraws.slice(recentStart, sourceIdx).length * 5);
  return { historyFreq, recentFreq, avgHistoryFreq: totalBalls > 0 ? totalBalls / 35 : 5, avgRecentFreq: recentTotal / 35 };
}

// ======================== 12. 预测 ========================
function predictTargetIv(sourceIv) { return sourceIv; }
function predictTargetOdd(sourceOdd) { return sourceOdd === 5 ? 3 : sourceOdd === 0 ? 2 : sourceOdd; }
function predictTargetSum(sourceSum) { return Math.round(sourceSum * 0.3 + 90 * 0.7); }

// ======================== 13. 硬过滤函数 ========================
function isValidCombo(nums) {
  if (nums.length !== 5) return false;
  if (new Set(nums).size !== 5) return false;
  const sorted = [...nums].sort((a, b) => a - b);
  const sp = sorted[4] - sorted[0];
  if (sp < 8 || sp > 34) return false;
  const odd = oddCount(sorted);
  if (odd === 0 || odd === 5) return false;
  const iv = [0, 0, 0]; sorted.forEach(v => { const i = getSampleIntervalIndex(v); if (i >= 0) iv[i]++; });
  if (Math.max(...iv) >= 5) return false;
  let run = 1, mc = 1;
  for (let i = 1; i < sorted.length; i++) { if (sorted[i] - sorted[i - 1] === 1) { run++; mc = Math.max(mc, run); } else run = 1; }
  if (mc > 3) return false;
  const s = sum(sorted);
  if (s < 40 || s > 160) return false;
  return true;
}

// ======================== 14. A) 原版：评分排序生成组合 ========================
function genCombosScore(pool, count, maxPool) {
  const topN = [...pool].sort((a, b) => b.score - a.score).slice(0, maxPool);
  const combos = [], seen = new Set();
  const loopL = count * 20;
  for (let a = 0; a < topN.length - 4 && combos.length < loopL; a++) {
    for (let b = a + 1; b < topN.length - 3 && combos.length < loopL; b++) {
      for (let c = b + 1; c < topN.length - 2 && combos.length < loopL; c++) {
        for (let d = c + 1; d < topN.length - 1 && combos.length < loopL; d++) {
          for (let e = d + 1; e < topN.length && combos.length < loopL; e++) {
            const nums = [topN[a].number, topN[b].number, topN[c].number, topN[d].number, topN[e].number].sort((x, y) => x - y);
            if (!isValidCombo(nums)) continue;
            const key = nums.join('-'); if (seen.has(key)) continue;
            seen.add(key);
            const sc = nums.reduce((s, n) => s + (topN.find(x => x.number === n)?.score || 0), 0);
            const sp = nums[4] - nums[0], odd = oddCount(nums);
            const iv = [0, 0, 0]; nums.forEach(v => { const i = getSampleIntervalIndex(v); if (i >= 0) iv[i]++; });
            combos.push({ key, numbers: nums, score: sc, span: sp, odd, iv, sum: sum(nums) });
          }
        }
      }
    }
  }
  combos.sort((a, b) => b.score - a.score);
  const sel = [], dk = new Set();
  for (const c of combos) {
    if (sel.length >= count) break;
    if (dk.has(c.key)) continue;
    let sim = false;
    for (const s of sel) {
      let o = 0; const ss = new Set(s.numbers);
      c.numbers.forEach(n => { if (ss.has(n)) o++; });
      if (o >= 3) { sim = true; break; }
    }
    if (!sim) { sel.push(c); dk.add(c.key); }
  }
  return sel;
}

function buildScoreCombos(candidates, sourceNums, predictedTails, ivPrediction, firstBallPreds) {
  const src = [...sourceNums].sort((a, b) => a - b);
  // 6维度独立评分
  const dimTail = [], dimOff = [], dimHot = [], dimFreq = [], dimBr = [], dimAr = [];
  for (let n = 1; n <= 35; n++) {
    const t = n % 10; let sTail = 0;
    if (predictedTails && predictedTails.length > 0) {
      const topT = new Set(predictedTails.slice(0, 5).map(p => p[0] || p));
      if (topT.has(t)) sTail = 35;
      else if (predictedTails.some(p => Math.abs(t - (p[0] || p)) === 1)) sTail = 15;
      else if (new Set(src.map(x => x % 10)).has(t)) sTail = 8;
    }
    dimTail.push({ number: n, score: sTail });
    let minO = Infinity; src.forEach(a => { minO = Math.min(minO, Math.abs(n - a)); });
    dimOff.push({ number: n, score: V4_OFFSET_SCORE[minO] || 0 });
    const c = candidates.find(x => x.number === n);
    dimHot.push({ number: n, score: c ? Math.min(c.hot || 0, 6) : 0 });
    dimFreq.push({ number: n, score: c ? c.freqScore || 0 : 0 });
    dimBr.push({ number: n, score: c ? c.bridgeScore || 0 : 0 });
    dimAr.push({ number: n, score: c ? c.arithScore || 0 : 0 });
  }

  const normDim = (dim) => {
    const sorted = [...dim].sort((a, b) => b.score - a.score);
    const mx = Math.max(1, sorted[0]?.score || 0);
    const mn = Math.min(0, sorted[sorted.length - 1]?.score || 0);
    const rng = mx - mn || 1;
    const m = new Map();
    dim.forEach(e => m.set(e.number, Math.round(((e.score - mn) / rng) * 100)));
    return m;
  };

  const nTail = normDim(dimTail), nOff = normDim(dimOff), nHot = normDim(dimHot),
    nFreq = normDim(dimFreq), nBr = normDim(dimBr), nAr = normDim(dimAr);

  const buildPair = (a, b, wa, wb) => {
    const arr = [];
    for (let n = 1; n <= 35; n++) arr.push({ number: n, score: (a.get(n) || 0) * wa + (b.get(n) || 0) * wb });
    return arr;
  };

  const pair1 = buildPair(nTail, nOff, 0.55, 0.45);
  const pair2 = buildPair(nHot, nFreq, 0.5, 0.5);
  const pair3 = buildPair(nBr, nAr, 0.5, 0.5);

  let allCombos = []; const usedKeys = new Set();
  genCombosScore(pair1, 3, 13).forEach(c => { if (!usedKeys.has(c.key)) { allCombos.push(c); usedKeys.add(c.key); } });
  genCombosScore(pair2, 3, 13).forEach(c => { if (!usedKeys.has(c.key)) { allCombos.push(c); usedKeys.add(c.key); } });
  genCombosScore(pair3, 2, 10).forEach(c => { if (!usedKeys.has(c.key)) { allCombos.push(c); usedKeys.add(c.key); } });

  // 重评分+去重
  allCombos = rescoreCombos(allCombos, sourceNums, predictedTails);
  allCombos.sort((a, b) => b.score - a.score);

  const final = [], fk = new Set();
  for (const c of allCombos) {
    if (final.length >= 20) break;
    if (fk.has(c.key)) continue;
    let sim = false;
    for (const f of final) {
      const fs = new Set(f.numbers); let o = 0;
      c.numbers.forEach(n => { if (fs.has(n)) o++; });
      if (o >= 4) { sim = true; break; }
    }
    if (!sim) { final.push(c); fk.add(c.key); }
  }
  return final;
}

function rescoreCombos(combos, sourceNums, predictedTails) {
  return combos.map(c => {
    let bonus = c.score || 0;
    const nums = c.numbers; const s = sum(nums), sp = nums[4] - nums[0], odd = oddCount(nums);
    const iv = [0, 0, 0]; nums.forEach(v => { const i = getSampleIntervalIndex(v); if (i >= 0) iv[i]++; });
    const ivKey = iv.join(':');
    if (s < 55 || s > 135) return { ...c, score: bonus - 50 };
    if (s >= 80 && s <= 105) bonus += 15;
    else if (s >= 65 && s <= 120) bonus += 5;
    else bonus -= Math.abs(s - 90) * 0.5;
    const commonRatios = ['2:1:2', '2:2:1', '1:2:2', '3:1:1', '1:3:1', '1:1:3'];
    const ri = commonRatios.indexOf(ivKey);
    if (ri >= 0) bonus += ri < 3 ? 8 : 4;
    if (odd >= 1 && odd <= 4) bonus += 5;
    if (sp >= 18 && sp <= 28) bonus += 8;
    if (predictedTails && predictedTails.length > 0) {
      const topT = new Set(predictedTails.slice(0, 5).map(p => p[0] || p));
      bonus += nums.filter(n => topT.has(n % 10)).length * 5;
    }
    const at = evaluateSampleAnchorTransform(nums, sourceNums);
    const rm = computeReferenceMatch(nums, [sourceNums]);
    const { penalty: spPen } = getComboSpreadPenalty(nums);
    const rp = getComboRunPenalty(nums, at.supportedRunNumbers);
    const adjSp = at.supportedRunNumbers.size >= 2 ? Math.round(spPen * 0.6) : spPen;
    bonus += at.anchorTransformScore * 0.5 + at.explainCoverageBonus + at.transformDiversityBonus * 0.5
      + at.farOffsetBonus * 0.5 + at.anchorCoverageBonus - at.anchorCrowdPenalty
      - at.anchorKeepPenalty * 0.25 - rp * 0.5 - adjSp * 0.25 + rm * 0.5;
    return { ...c, score: Math.round(bonus) };
  });
}

// ======================== 15. B) 随机版本：加权随机生成组合 ========================
/**
 * 从号码池中加权随机抽取号码
 * pool: [{number, score}, ...]
 * count: 要抽几个
 * weightPower: 分数幂次（1=线性，0=均匀随机，2=平方加权）
 */
function weightedRandomPick(pool, count, weightPower = 1) {
  const selected = new Set();
  const numbers = [];
  
  // 计算权重
  const poolCopy = pool.map(p => {
    const w = Math.max(0.01, p.score + 1);
    return { number: p.number, weight: Math.pow(w, weightPower) };
  });
  
  const totalWeight = poolCopy.reduce((s, p) => s + p.weight, 0);
  
  while (numbers.length < count) {
    let r = Math.random() * totalWeight;
    for (const p of poolCopy) {
      r -= p.weight;
      if (r <= 0 && !selected.has(p.number)) {
        selected.add(p.number);
        numbers.push(p.number);
        break;
      }
    }
    // 防止死循环：如果抽不到新号码，直接随机补充
    if (numbers.length < count && numbers.length > 0) {
      const remaining = poolCopy.filter(p => !selected.has(p.number));
      if (remaining.length > 0) {
        const idx = Math.floor(Math.random() * remaining.length);
        selected.add(remaining[idx].number);
        numbers.push(remaining[idx].number);
      }
    }
  }
  
  return numbers.sort((a, b) => a - b);
}

/**
 * 纯随机生成组合（无评分排序）
 */
function genCombosRandom(pool, count, maxPool) {
  const poolRange = [...pool].sort((a, b) => b.score - a.score).slice(0, maxPool);
  const combos = [], seen = new Set();
  const maxAttempts = count * 100;
  
  for (let attempt = 0; attempt < maxAttempts && combos.length < count * 10; attempt++) {
    const nums = weightedRandomPick(poolRange, 5, 0.5); // weightPower=0.5 弱化评分影响
    if (!isValidCombo(nums)) continue;
    const key = nums.join('-');
    if (seen.has(key)) continue;
    seen.add(key);
    const sp = nums[4] - nums[0], odd = oddCount(nums);
    const iv = [0, 0, 0]; nums.forEach(v => { const i = getSampleIntervalIndex(v); if (i >= 0) iv[i]++; });
    combos.push({ key, numbers: nums, score: 0, span: sp, odd, iv, sum: sum(nums) });
  }
  
  // 多样性选择
  const sel = [], dk = new Set();
  for (const c of combos) {
    if (sel.length >= count) break;
    if (dk.has(c.key)) continue;
    let sim = false;
    for (const s of sel) {
      let o = 0; const ss = new Set(s.numbers);
      c.numbers.forEach(n => { if (ss.has(n)) o++; });
      if (o >= 3) { sim = true; break; }
    }
    if (!sim) { sel.push(c); dk.add(c.key); }
  }
  return sel;
}

function buildRandomCombos(candidates, sourceNums, predictedTails, ivPrediction, firstBallPreds) {
  const src = [...sourceNums].sort((a, b) => a - b);
  
  // 6维度独立评分（复用相同逻辑）
  const dimTail = [], dimOff = [], dimHot = [], dimFreq = [], dimBr = [], dimAr = [];
  for (let n = 1; n <= 35; n++) {
    const t = n % 10; let sTail = 0;
    if (predictedTails && predictedTails.length > 0) {
      const topT = new Set(predictedTails.slice(0, 5).map(p => p[0] || p));
      if (topT.has(t)) sTail = 35;
      else if (predictedTails.some(p => Math.abs(t - (p[0] || p)) === 1)) sTail = 15;
      else if (new Set(src.map(x => x % 10)).has(t)) sTail = 8;
    }
    dimTail.push({ number: n, score: sTail });
    let minO = Infinity; src.forEach(a => { minO = Math.min(minO, Math.abs(n - a)); });
    dimOff.push({ number: n, score: V4_OFFSET_SCORE[minO] || 0 });
    const c = candidates.find(x => x.number === n);
    dimHot.push({ number: n, score: c ? Math.min(c.hot || 0, 6) : 0 });
    dimFreq.push({ number: n, score: c ? c.freqScore || 0 : 0 });
    dimBr.push({ number: n, score: c ? c.bridgeScore || 0 : 0 });
    dimAr.push({ number: n, score: c ? c.arithScore || 0 : 0 });
  }

  const normDim = (dim) => {
    const sorted = [...dim].sort((a, b) => b.score - a.score);
    const mx = Math.max(1, sorted[0]?.score || 0);
    const mn = Math.min(0, sorted[sorted.length - 1]?.score || 0);
    const rng = mx - mn || 1;
    const m = new Map();
    dim.forEach(e => m.set(e.number, e.score > 0 ? Math.round(((e.score - mn) / rng) * 100) : 0));
    return m;
  };

  const nTail = normDim(dimTail), nOff = normDim(dimOff), nHot = normDim(dimHot),
    nFreq = normDim(dimFreq), nBr = normDim(dimBr), nAr = normDim(dimAr);

  const buildPair = (a, b, wa, wb) => {
    const arr = [];
    for (let n = 1; n <= 35; n++) arr.push({ number: n, score: (a.get(n) || 0) * wa + (b.get(n) || 0) * wb });
    return arr;
  };

  const pair1 = buildPair(nTail, nOff, 0.55, 0.45);
  const pair2 = buildPair(nHot, nFreq, 0.5, 0.5);
  const pair3 = buildPair(nBr, nAr, 0.5, 0.5);

  // 随机生成组合
  let allCombos = []; const usedKeys = new Set();
  genCombosRandom(pair1, 3, 13).forEach(c => { if (!usedKeys.has(c.key)) { allCombos.push(c); usedKeys.add(c.key); } });
  genCombosRandom(pair2, 3, 13).forEach(c => { if (!usedKeys.has(c.key)) { allCombos.push(c); usedKeys.add(c.key); } });
  genCombosRandom(pair3, 2, 10).forEach(c => { if (!usedKeys.has(c.key)) { allCombos.push(c); usedKeys.add(c.key); } });

  // 补充（也随机）
  if (allCombos.length < 8) {
    const suppPool = [];
    [pair1, pair2, pair3].forEach(pair => {
      pair.sort((a, b) => b.score - a.score).slice(0, 12).forEach(c => suppPool.push(c));
    });
    genCombosRandom(suppPool, 8 - allCombos.length, 13).forEach(c => {
      if (!usedKeys.has(c.key)) { allCombos.push(c); usedKeys.add(c.key); }
    });
  }

  // 用相同的重评分函数排序
  allCombos = rescoreCombos(allCombos, sourceNums, predictedTails);
  allCombos.sort((a, b) => b.score - a.score);

  const final = [], fk = new Set();
  for (const c of allCombos) {
    if (final.length >= 20) break;
    if (fk.has(c.key)) continue;
    let sim = false;
    for (const f of final) {
      const fs = new Set(f.numbers); let o = 0;
      c.numbers.forEach(n => { if (fs.has(n)) o++; });
      if (o >= 4) { sim = true; break; }
    }
    if (!sim) { final.push(c); fk.add(c.key); }
  }
  return final;
}

// ======================== 16. 补漏6 ========================
function generate补漏6(allCombos, sourceNums, predictedTails, firstBallPreds, candidatePool, useRandom = false) {
  const top5 = allCombos.slice(0, 5);
  const coveredSet = new Set();
  top5.forEach(c => c.numbers.forEach(n => coveredSet.add(n)));

  const top5IvCounts = [0, 0, 0];
  top5.forEach(c => c.numbers.forEach(n => { const i = getSampleIntervalIndex(n); if (i >= 0) top5IvCounts[i]++; }));
  const nonZeroIv = top5IvCounts.filter(c => c > 0);
  const minIvI = nonZeroIv.length > 0 ? top5IvCounts.indexOf(Math.min(...nonZeroIv)) : 0;

  const topTails = predictedTails && predictedTails.length > 0
    ? new Set(predictedTails.slice(0, 5).map(p => p[0] || p)) : new Set();

  const candidates = [];
  for (const entry of candidatePool) {
    const n = entry.number;
    if (coveredSet.has(n)) continue;
    let s = 0;
    if (topTails.has(n % 10)) s += 10;
    else if (predictedTails && predictedTails.some(p => Math.abs((n % 10) - (p[0] || p)) === 1)) s += 5;
    const nIv = getSampleIntervalIndex(n);
    if (nIv === minIvI) s += 6;
    s += (entry.freqScore || 0) * 0.3;
    if (sourceNums.some(a => Math.abs(a - n) === 1)) s += 4;
    candidates.push({ number: n, score: s, iv: nIv });
  }
  candidates.sort((a, b) => b.score - a.score);

  if (useRandom) {
    // 随机补漏：从候选池加权随机选5个
    const topCandidates = candidates.slice(0, 15);
    for (let attempt = 0; attempt < 50; attempt++) {
      const nums = weightedRandomPick(topCandidates, 5, 0.3);
      if (isValidCombo(nums)) {
        const s = sum(nums), sp = nums[4] - nums[0], odd = oddCount(nums);
        const iv = [0, 0, 0]; nums.forEach(v => { const i = getSampleIntervalIndex(v); if (i >= 0) iv[i]++; });
        const cv = iv.filter(c => c > 0).length;
        if (cv === 1) continue;
        let bonus = 0;
        if (s >= 80 && s <= 105) bonus += 10;
        if (sp >= 14 && sp <= 28) bonus += 8;
        if (odd >= 2 && odd <= 3) bonus += 6;
        if (cv === 3) bonus += 6;
        return { key: nums.join('-'), numbers: nums, score: bonus };
      }
    }
    return null;
  }

  // 原版补漏逻辑
  const topCandidates = candidates.slice(0, Math.min(15, candidates.length));
  const candidateCombos = [];
  const comboSeen = new Set();
  let tries = 0;
  while (candidateCombos.length < 4 && tries < 100) {
    tries++;
    const nums = new Set();
    if (tries <= 4) {
      topCandidates.slice(0, 5).forEach(c => nums.add(c.number));
    } else if (tries <= 10) {
      const ivPicked = [0, 0, 0];
      for (const c of topCandidates) {
        if (nums.size >= 5) break;
        if (nums.has(c.number)) continue;
        if (tries <= 7 && ivPicked[c.iv] >= 2) continue;
        nums.add(c.number);
        ivPicked[c.iv]++;
      }
    } else {
      const pool = [...topCandidates];
      for (let j = pool.length - 1; j > 0; j--) { const ri = Math.floor(Math.random() * (j + 1)); [pool[j], pool[ri]] = [pool[ri], pool[j]]; }
      pool.slice(0, 5).forEach(c => nums.add(c.number));
    }
    if (nums.size < 5) continue;
    const sorted = [...nums].sort((a, b) => a - b);
    if (!isValidCombo(sorted)) continue;
    const key = sorted.join('-');
    if (comboSeen.has(key)) continue;
    comboSeen.add(key);
    const s = sum(sorted), sp = sorted[4] - sorted[0], odd = oddCount(sorted);
    const iv = [0, 0, 0]; sorted.forEach(v => { const i = getSampleIntervalIndex(v); if (i >= 0) iv[i]++; });
    const cv = iv.filter(c => c > 0).length;
    if (cv === 1) continue;
    let bonus = 0;
    if (s >= 80 && s <= 105) bonus += 10;
    if (sp >= 14 && sp <= 28) bonus += 8;
    if (odd >= 2 && odd <= 3) bonus += 6;
    if (cv === 3) bonus += 6;
    if (firstBallPreds && firstBallPreds.length > 0) {
      const fp = firstBallPreds.slice(0, 3).map(p => p.number || p);
      if (fp.includes(sorted[0])) bonus += 8;
    }
    candidateCombos.push({ key, numbers: sorted, score: bonus });
  }
  candidateCombos.sort((a, b) => b.score - a.score);
  return candidateCombos[0] || null;
}

// ======================== 17. 评测一期的两种方案 ========================
function evalIssue(sourceNums, targetNums, targetSet, allCombos, candidates) {
  const top5 = allCombos.slice(0, 5);
  const top5Hits = top5.map(c => c.numbers.filter(n => targetSet.has(n)).length);
  const top5Union = new Set();
  top5.forEach(c => c.numbers.forEach(n => top5Union.add(n)));
  const top5UnionCoverage = targetNums.filter(n => top5Union.has(n)).length;
  const pool30 = new Set(candidates.slice(0, 30).map(c => c.number));
  const poolCoverage = targetNums.filter(n => pool30.has(n)).length;
  return {
    top5Hits, top5UnionCoverage, poolCoverage,
    maxTop5Hit: Math.max(...top5Hits),
  };
}

function backtestSingleIssueCompare(sourceIdx, allDraws) {
  const sourceDraw = allDraws[sourceIdx];
  const targetDraw = allDraws[sourceIdx + 1];
  if (!sourceDraw || !targetDraw) return null;

  const sourceNums = [...sourceDraw.front].sort((a, b) => a - b);
  const targetNums = [...targetDraw.front].sort((a, b) => a - b);
  const targetSet = new Set(targetNums);
  const sourceTails = [...new Set(sourceNums.map(n => n % 10))];
  const sourceRow = sourceIdx;

  // 热号
  const hotness = new Map();
  for (let r = Math.max(0, sourceRow - 5); r < sourceRow; r++) {
    const d = allDraws[r]; if (!d) continue;
    d.front.forEach(n => hotness.set(n, (hotness.get(n) || 0) + 1));
  }

  // 预测
  const predictedTails = predictTails(sourceRow, sourceTails, allDraws);
  const sourceIv = intervalRatio(sourceNums);
  const ivPrediction = predictTargetIv(sourceIv);
  const sourceOdd = oddCount(sourceNums);
  const targetOdd = predictTargetOdd(sourceOdd);
  const sourceSum = sum(sourceNums);
  const targetSum = predictTargetSum(sourceSum);
  const firstBallPreds = [{ number: sourceNums[0] }, { number: sourceNums[0] - 1 }, { number: sourceNums[0] + 1 }];

  // 桥接/等差
  const bridgeMap = buildV4BridgeMap(sourceNums, sourceNums);
  const arithMap = buildV4ArithmeticMap(sourceNums, 17, sourceNums);
  const plusTenTrend = buildV4PlusTenTrendMap(sourceRow, sourceNums, allDraws);
  const historyMetrics = calcHistoryMetrics(allDraws, sourceRow);

  // 候选池
  const candidates = [];
  for (let n = 1; n <= 35; n++) {
    const s = scoreSingleNumber(n, sourceNums, sourceTails, predictedTails, bridgeMap, arithMap,
      plusTenTrend, hotness, ivPrediction, sourceIv, sourceOdd, targetOdd,
      sourceSum, targetSum, historyMetrics);
    candidates.push({
      number: n, score: s, hot: hotness.get(n) || 0,
      freqScore: (historyMetrics.historyFreq[n] || 0) / Math.max(0.001, historyMetrics.avgHistoryFreq) * 10
        + (historyMetrics.recentFreq[n] || 0) / Math.max(0.001, historyMetrics.avgRecentFreq) * 8,
      bridgeScore: (bridgeMap.gapMap.get(n)?.score || 0) + (bridgeMap.endpointMap.get(n)?.score || 0),
      arithScore: arithMap.get(n)?.score || 0,
    });
  }
  candidates.sort((a, b) => b.score - a.score);

  // A) 评分版
  const scoreCombos = buildScoreCombos(candidates, sourceNums, predictedTails, ivPrediction, firstBallPreds);
  const scoreResult = evalIssue(sourceNums, targetNums, targetSet, scoreCombos, candidates);
  const scoreBl6 = generate补漏6(scoreCombos, sourceNums, predictedTails, firstBallPreds, candidates, false);
  let scoreBl6Hit = 0, scoreUnionCov = scoreResult.top5UnionCoverage;
  if (scoreBl6) {
    scoreBl6Hit = scoreBl6.numbers.filter(n => targetSet.has(n)).length;
    const union = new Set();
    scoreCombos.slice(0, 5).forEach(c => c.numbers.forEach(n => union.add(n)));
    scoreBl6.numbers.forEach(n => union.add(n));
    scoreUnionCov = targetNums.filter(n => union.has(n)).length;
  }

  // B) 随机版（跑TRIALS次取平均）
  const TRIALS = 30;
  let randSumMaxHit = 0, randSumUnion = 0, randSumBl6Hit = 0, randSumUnionCov = 0;
  let randBestMaxHit = 0, randBestUnionCov = 0;

  for (let trial = 0; trial < TRIALS; trial++) {
    const randCombos = buildRandomCombos(candidates, sourceNums, predictedTails, ivPrediction, firstBallPreds);
    const randResult = evalIssue(sourceNums, targetNums, targetSet, randCombos, candidates);
    randSumMaxHit += randResult.maxTop5Hit;
    randSumUnion += randResult.top5UnionCoverage;

    const randBl6 = generate补漏6(randCombos, sourceNums, predictedTails, firstBallPreds, candidates, true);
    let bl6Hit = 0, unionCov = randResult.top5UnionCoverage;
    if (randBl6) {
      bl6Hit = randBl6.numbers.filter(n => targetSet.has(n)).length;
      const union = new Set();
      randCombos.slice(0, 5).forEach(c => c.numbers.forEach(n => union.add(n)));
      randBl6.numbers.forEach(n => union.add(n));
      unionCov = targetNums.filter(n => union.has(n)).length;
    }
    randSumBl6Hit += bl6Hit;
    randSumUnionCov += unionCov;

    if (randResult.maxTop5Hit > randBestMaxHit) randBestMaxHit = randResult.maxTop5Hit;
    if (unionCov > randBestUnionCov) randBestUnionCov = unionCov;
  }

  return {
    sourceIssue: sourceDraw.issue,
    targetIssue: targetDraw.issue,
    sourceNums, targetNums,
    // 评分版
    scoreMaxHit: scoreResult.maxTop5Hit,
    scoreUnion: scoreResult.top5UnionCoverage,
    scoreBl6Hit,
    scoreUnionCov,
    scorePoolCov: scoreResult.poolCoverage,
    // 随机版（平均）
    randAvgMaxHit: randSumMaxHit / TRIALS,
    randAvgUnion: randSumUnion / TRIALS,
    randAvgBl6Hit: randSumBl6Hit / TRIALS,
    randAvgUnionCov: randSumUnionCov / TRIALS,
    // 随机版（最优）
    randBestMaxHit,
    randBestUnionCov,
  };
}

// ======================== 18. 主运行 ========================
console.log('='.repeat(100));
console.log('对比测试：评分排序(A) vs 6维度独立+随机出号(B)');
console.log('='.repeat(100));
console.log(`数据范围: ${DRAWS[0]?.issue} ~ ${DRAWS[DRAWS.length - 1]?.issue} (${DRAWS.length}期)`);
console.log(`随机方案每期跑 30 次取平均`);
console.log('');

const results = [];
for (let i = 0; i < DRAWS.length - 1; i++) {
  const r = backtestSingleIssueCompare(i, DRAWS);
  if (r) results.push(r);
}

// 输出
const header = [
  '源期号'.padEnd(10),
  '目标期号'.padEnd(10),
  '【A评分】Top5max'.padEnd(14),
  '【A评分】Union/5'.padEnd(14),
  '【A评分】补漏6'.padEnd(12),
  '【A评分】联合/5'.padEnd(12),
  '【B随机】Top5avg'.padEnd(14),
  '【B随机】Union/5'.padEnd(14),
  '【B随机】补漏6'.padEnd(12),
  '【B随机】联合/5'.padEnd(12),
  '【B随机】BestTop5'.padEnd(14),
  '【B随机】BestUnion'.padEnd(14),
  'DeltaTop5'.padEnd(10),
  'DeltaUnion'.padEnd(10),
].join(' | ');

console.log(header);
console.log('-'.repeat(header.length));

let sumA_MaxHit = 0, sumA_Union = 0, sumA_Bl6 = 0, sumA_UnionCov = 0, sumA_Pool = 0;
let sumB_AvgMaxHit = 0, sumB_AvgUnion = 0, sumB_AvgBl6 = 0, sumB_AvgUnionCov = 0;
let sumB_BestMaxHit = 0, sumB_BestUnionCov = 0;
let cnt = 0;

results.forEach(r => {
  cnt++;
  sumA_MaxHit += r.scoreMaxHit; sumA_Union += r.scoreUnion;
  sumA_Bl6 += r.scoreBl6Hit; sumA_UnionCov += r.scoreUnionCov;
  sumB_AvgMaxHit += r.randAvgMaxHit; sumB_AvgUnion += r.randAvgUnion;
  sumB_AvgBl6 += r.randAvgBl6Hit; sumB_AvgUnionCov += r.randAvgUnionCov;
  sumB_BestMaxHit += r.randBestMaxHit; sumB_BestUnionCov += r.randBestUnionCov;

  const deltaTop5 = (r.randAvgMaxHit - r.scoreMaxHit).toFixed(2);
  const deltaUnion = (r.randAvgUnionCov - r.scoreUnionCov).toFixed(2);

  const row = [
    r.sourceIssue.padEnd(10),
    r.targetIssue.padEnd(10),
    `${r.scoreMaxHit}`.padEnd(14),
    `${r.scoreUnion}/5`.padEnd(14),
    `${r.scoreBl6Hit}`.padEnd(12),
    `${r.scoreUnionCov}/5`.padEnd(12),
    `${r.randAvgMaxHit.toFixed(2)}`.padEnd(14),
    `${r.randAvgUnion.toFixed(2)}/5`.padEnd(14),
    `${r.randAvgBl6Hit.toFixed(2)}`.padEnd(12),
    `${r.randAvgUnionCov.toFixed(2)}/5`.padEnd(12),
    `${r.randBestMaxHit}`.padEnd(14),
    `${r.randBestUnionCov}/5`.padEnd(14),
    `${deltaTop5}`.padEnd(10),
    `${deltaUnion}`.padEnd(10),
  ].join(' | ');
  console.log(row);
});

// 汇总
console.log('');
console.log('='.repeat(100));
console.log('汇总对比');
console.log('='.repeat(100));
const n = cnt || 1;

console.log('');
console.log('┌──────────────────┬──────────────┬──────────────┬──────────┐');
console.log('│      指标         │  A) 评分排序  │  B) 随机(平均) │  B) 最优  │');
console.log('├──────────────────┼──────────────┼──────────────┼──────────┤');
console.log(`│ Top5 平均最高命中  │     ${(sumA_MaxHit/n).toFixed(2)}/5     │     ${(sumB_AvgMaxHit/n).toFixed(2)}/5     │  ${(sumB_BestMaxHit/n).toFixed(2)}/5  │`);
console.log(`│ Top5 平均联合覆盖  │     ${(sumA_Union/n).toFixed(2)}/5     │     ${(sumB_AvgUnion/n).toFixed(2)}/5     │  ${(sumB_BestUnionCov/n).toFixed(2)}/5  │`);
console.log(`│ 补漏6 平均命中     │     ${(sumA_Bl6/n).toFixed(2)}/5     │     ${(sumB_AvgBl6/n).toFixed(2)}/5     │     -    │`);
console.log(`│ Top5+补漏6 联合覆盖 │     ${(sumA_UnionCov/n).toFixed(2)}/5     │     ${(sumB_AvgUnionCov/n).toFixed(2)}/5     │     -    │`);
console.log('└──────────────────┴──────────────┴──────────────┴──────────┘');

console.log('');
console.log(`命中率对比:`);
console.log(`  A) Top5最高命中率:  ${(sumA_MaxHit / (n * 5) * 100).toFixed(1)}%`);
console.log(`  B) Top5平均命中率:  ${(sumB_AvgMaxHit / (n * 5) * 100).toFixed(1)}%`);
console.log(`  B) Top5最优命中率:  ${(sumB_BestMaxHit / (n * 5) * 100).toFixed(1)}%`);
console.log('');
console.log(`覆盖率对比:`);
console.log(`  A) Top5+补漏6联合覆盖率:  ${(sumA_UnionCov / (n * 5) * 100).toFixed(1)}%`);
console.log(`  B) Top5+补漏6联合覆盖率:  ${(sumB_AvgUnionCov / (n * 5) * 100).toFixed(1)}%`);

// 胜负统计
let aWins = 0, bWins = 0, tie = 0;
let aWinsUnion = 0, bWinsUnion = 0, tieUnion = 0;
results.forEach(r => {
  if (r.scoreMaxHit > r.randAvgMaxHit) aWins++;
  else if (r.randAvgMaxHit > r.scoreMaxHit) bWins++;
  else tie++;
  if (r.scoreUnionCov > r.randAvgUnionCov) aWinsUnion++;
  else if (r.randAvgUnionCov > r.scoreUnionCov) bWinsUnion++;
  else tieUnion++;
});

console.log('');
console.log('逐期胜负（A 胜 / B 胜 / 平）:');
console.log(`  Top5最高命中:  A胜${aWins}期  B胜${bWins}期  平${tie}期`);
console.log(`  联合覆盖率:    A胜${aWinsUnion}期  B胜${bWinsUnion}期  平${tieUnion}期`);

// 命中分布对比
const aDist = {}, bDist = {};
results.forEach(r => {
  aDist[r.scoreMaxHit] = (aDist[r.scoreMaxHit] || 0) + 1;
  const bRound = Math.round(r.randAvgMaxHit);
  bDist[bRound] = (bDist[bRound] || 0) + 1;
});

console.log('');
console.log('Top5 最高命中分布对比:');
console.log('  命中数  │  A(评分)   │  B(随机平均)');
console.log('  ────────┼───────────┼─────────────');
for (let h = 5; h >= 0; h--) {
  const a = aDist[h] || 0, b = bDist[h] || 0;
  if (a > 0 || b > 0) {
    console.log(`    ${h}个    │  ${String(a).padEnd(9)} │  ${String(b).padEnd(11)}`);
  }
}

console.log('');
console.log('完成!');
