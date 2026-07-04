/**
 * backtest_v5_optimization_test.js — 优化参数测试
 * 
 * 基于C方案(8维精简)，测试3个优化参数：
 * 1. 跨维度去重阈值: dedupThreshold (3, 4, 5)
 * 2. 多样性评分权重: diversityWeight (0.65, 0.75, 0.85)
 * 3. 补盲区策略: bulouStrategy ('original', 'hybrid')
 * 
 * 运行：node backtest_v5_optimization_test.js
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

function isValidCombo(nums) {
  if (new Set(nums).size !== 5) return false;
  const sorted = [...nums].sort((a, b) => a - b);
  const sp = sorted[4] - sorted[0], odd = oddCount(sorted);
  if (odd === 0 || odd === 5 || sp < 8 || sp > 34) return false;
  const iv = [0, 0, 0]; sorted.forEach(v => { const i = getSampleIntervalIndex(v); if (i >= 0) iv[i]++; });
  if (Math.max(...iv) >= 5) return false;
  let run = 1, mc = 1;
  for (let i = 1; i < sorted.length; i++) { if (sorted[i] - sorted[i - 1] === 1) { run++; mc = Math.max(mc, run); } else run = 1; }
  if (mc > 3) return false;
  const s = sum(sorted);
  if (s < 40 || s > 160) return false;
  return true;
}

// ======================== 4. 桥接 + 等差 ========================
function buildV4BridgeMap(anchorNumbers, supportNumbers) {
  const gapMap = new Map(), endpointMap = new Map();
  const anchors = [...anchorNumbers].sort((a, b) => a - b);
  for (let i = 0; i < anchors.length - 1; i++) {
    const gap = anchors[i + 1] - anchors[i];
    if (gap >= 2 && gap <= 5) {
      for (let n = anchors[i] + 1; n < anchors[i + 1]; n++) {
        if (n >= 1 && n <= 35) {
          const prev = gapMap.get(n) || { hits: 0, score: 0, count: 0 };
          prev.hits++;
          const d1 = n - anchors[i], d2 = anchors[i + 1] - n;
          prev.score += Math.max(0, 10 - Math.abs(d1 - 2) * 3) + Math.max(0, 10 - Math.abs(d2 - 2) * 3);
          prev.count++;
          gapMap.set(n, prev);
        }
      }
    }
  }
  anchors.forEach(a => {
    for (let d = 1; d <= 4; d++) {
      [a - d, a + d].forEach(n => {
        if (n >= 1 && n <= 35 && !anchors.some(x => Math.abs(x - n) <= 0)) {
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
        const prev = map.get(next) || { hits: 0, score: 0 };
        prev.hits++; prev.score += 10; map.set(next, prev);
      }
      const prev2 = anchors[i] - diff;
      if (prev2 >= 1 && prev2 <= 35 && !anchors.includes(prev2)) {
        const p = map.get(prev2) || { hits: 0, score: 0 };
        p.hits++; p.score += 8; map.set(prev2, p);
      }
    }
  }
  return map;
}

// ======================== 5. +10期趋势 ========================
function buildV4PlusTenTrendMap(sourceRow, sourceNums, allDraws) {
  const targetMap = new Map(), neighborMap = new Map();
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
  const explainedAnchors = new Map(), explainable = new Set(), supportedRunNumbers = new Set();

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
        const ratio = seg.length > 0 ? sc / seg.length : 0;
        const disc = ratio >= 0.8 ? 0.45 : ratio >= 0.6 ? 0.75 : 1;
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

// ======================== 7. 单号评分 ========================
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
  } else {
    if (sourceTails.includes(t)) score += V4_TAIL_WITHIN;
  }

  if (plusTenTrend && plusTenTrend.max > 0) {
    const ptScore = plusTenTrend.targetMap.get(n) || 0;
    if (ptScore > 0) score += Math.round(ptScore / plusTenTrend.max * 30);
    const ptNb = plusTenTrend.neighborMap.get(n) || 0;
    if (ptNb > 0) score += Math.round(ptNb / plusTenTrend.max * 6);
  }

  const maxBridge = 50;
  const bg = bridgeMap.gapMap.get(n), be = bridgeMap.endpointMap.get(n);
  if (bg) score += Math.round(Math.min(bg.score, maxBridge) / maxBridge * 15);
  if (be) score += Math.round(Math.min(be.score, maxBridge) / maxBridge * 8);

  const maxArith = 50;
  const ae = arithMap.get(n);
  if (ae) score += Math.round(Math.min(ae.score, maxArith) / maxArith * 10);

  const hot = hotness.get(n) || 0;
  if (hot >= 4) score += 6; else if (hot >= 3) score += 4; else if (hot >= 2) score += 2; else if (hot === 0) score -= 1;

  const iv = getSampleIntervalIndex(n);
  if (ivPrediction) { if (sourceIv[iv] < ivPrediction[iv]) score += 3; }
  if (n % 2 === 1 && sourceOdd < targetOdd) score += 2;
  else if (n % 2 === 0 && sourceOdd > targetOdd) score += 2;
  const sumDiff = targetSum - sourceSum;
  if (Math.abs(sumDiff) > 10) {
    if (sumDiff > 0 && n >= 15) score += 2;
    else if (sumDiff < 0 && n <= 18) score += 2;
  }

  if (historyMetrics && historyMetrics.avgHistoryFreq > 0) {
    const hf = (historyMetrics.historyFreq[n] || 0), rf = (historyMetrics.recentFreq[n] || 0);
    const hr = hf / historyMetrics.avgHistoryFreq, rr = rf / Math.max(0.001, historyMetrics.avgRecentFreq);
    if (hr > 1.2) score += Math.round((hr - 1) * 15);
    if (rr > 1.3) score += Math.round((rr - 1) * 10);
  }

  if (sourceNums.some(a => Math.abs(a - n) === 1)) score += 12;
  return score;
}

// ======================== 8. 尾号预测 ========================
function predictTails(sourceRow, sourceTails, allDraws) {
  const tailFreq = new Map(); let cnt = 0;
  for (let i = 0; i < allDraws.length - 1; i++) {
    const row = allDraws[i], next = allDraws[i + 1];
    if (!row || !next) continue;
    const rowTails = tails(row.front);
    const overlap = rowTails.filter(t => sourceTails.includes(t)).length;
    if (overlap >= 2) {
      cnt++;
      next.front.forEach(n => { const t = n % 10; tailFreq.set(t, (tailFreq.get(t) || 0) + 1); });
    }
  }
  return [...tailFreq.entries()].sort((a, b) => b[1] - a[1]);
}

function calcHistoryMetrics(allDraws, sourceIdx) {
  const historyFreq = new Array(36).fill(0), recentFreq = new Array(36).fill(0);
  let totalBalls = 0;
  const histStart = Math.max(0, sourceIdx - 50);
  for (let i = histStart; i < sourceIdx; i++) { const d = allDraws[i]; if (!d) continue; d.front.forEach(n => { historyFreq[n]++; totalBalls++; }); }
  const recentStart = Math.max(0, sourceIdx - 5);
  for (let i = recentStart; i < sourceIdx; i++) { const d = allDraws[i]; if (!d) continue; d.front.forEach(n => recentFreq[n]++); }
  const recentTotal = Math.max(1, allDraws.slice(recentStart, sourceIdx).length * 5);
  return { historyFreq, recentFreq, avgHistoryFreq: totalBalls > 0 ? totalBalls / 35 : 5, avgRecentFreq: recentTotal / 35 };
}

function predictTargetIv(sourceIv) { return sourceIv; }
function predictTargetOdd(sourceOdd) { return sourceOdd === 5 ? 3 : sourceOdd === 0 ? 2 : sourceOdd; }
function predictTargetSum(sourceSum) { return Math.round(sourceSum * 0.3 + 90 * 0.7); }

// ======================== 9. 从维度池生成组合（通用，支持参数化去重） ========================
function genCombosFromPool(pool, count, maxPool = 13, innerDedupThreshold = 3) {
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
            const key = nums.join('-');
            if (seen.has(key)) continue;
            seen.add(key);
            const sp = nums[4] - nums[0], odd = oddCount(nums);
            const iv = [0, 0, 0]; nums.forEach(v => { const i = getSampleIntervalIndex(v); if (i >= 0) iv[i]++; });
            const sc = nums.reduce((s, n) => s + (topN.find(x => x.number === n)?.score || 0), 0);
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
      if (o >= innerDedupThreshold) { sim = true; break; }
    }
    if (!sim) { sel.push(c); dk.add(c.key); }
  }
  return sel;
}

// ======================== 10. 组合重评分 ========================
function rescoreCombos(combos, sourceNums, predictedTails) {
  return combos.map(c => {
    let bonus = c.score || 0;
    const nums = c.numbers || [];
    const s = sum(nums), sp = nums[4] - nums[0], odd = oddCount(nums);
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

// ======================== 11. 方案A：6维独立（原版对照） ========================
function buildCombosIndependent6(dimData, sourceNums, predictedTails) {
  const { nTail, nOff, nHot, nFreq, nBr, nAr } = dimData;

  const toArr = (m) => {
    const arr = [];
    for (let n = 1; n <= 35; n++) arr.push({ number: n, score: m.get(n) || 0 });
    return arr.sort((a, b) => b.score - a.score);
  };

  const dims = [
    { name: 'tail',  arr: toArr(nTail), count: 2, maxPool: 10 },
    { name: 'off',   arr: toArr(nOff),  count: 2, maxPool: 10 },
    { name: 'hot',   arr: toArr(nHot),  count: 1, maxPool: 10 },
    { name: 'freq',  arr: toArr(nFreq), count: 1, maxPool: 10 },
    { name: 'bridge',arr: toArr(nBr),   count: 1, maxPool: 10 },
    { name: 'arith', arr: toArr(nAr),   count: 1, maxPool: 10 },
  ];

  let allCombos = []; const usedKeys = new Set();
  dims.forEach(d => {
    genCombosFromPool(d.arr, d.count, d.maxPool).forEach(c => {
      if (!usedKeys.has(c.key)) { allCombos.push(c); usedKeys.add(c.key); }
    });
  });

  if (allCombos.length < 8) {
    const suppPool = new Map();
    dims.forEach(d => {
      d.arr.slice(0, 12).forEach((c, i) => {
        const k = c.number;
        if (!suppPool.has(k) || suppPool.get(k).score < c.score + 10 - i)
          suppPool.set(k, { number: k, score: c.score + 10 - i });
      });
    });
    const suppArr = [...suppPool.values()].sort((a, b) => b.score - a.score);
    genCombosFromPool(suppArr, 8 - allCombos.length, 13).forEach(c => {
      if (!usedKeys.has(c.key)) { allCombos.push(c); usedKeys.add(c.key); }
    });
  }

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

// ======================== 12. 方案B：10维独立（原6维+4新维度） ========================
function buildCombosEnhanced(dimData, sourceNums, predictedTails) {
  const { nTail, nOff, nHot, nFreq, nBr, nAr, nRepeat, nRun, nArithSelf, nCross } = dimData;

  const toArr = (m) => {
    const arr = [];
    for (let n = 1; n <= 35; n++) arr.push({ number: n, score: m.get(n) || 0 });
    return arr.sort((a, b) => b.score - a.score);
  };

  const dims = [
    { name: 'tail',   arr: toArr(nTail),   count: 2, maxPool: 10 },
    { name: 'off',    arr: toArr(nOff),    count: 2, maxPool: 10 },
    { name: 'hot',    arr: toArr(nHot),    count: 1, maxPool: 10 },
    { name: 'freq',   arr: toArr(nFreq),   count: 1, maxPool: 10 },
    { name: 'bridge', arr: toArr(nBr),     count: 1, maxPool: 10 },
    { name: 'arith',  arr: toArr(nAr),     count: 1, maxPool: 10 },
    { name: 'repeat', arr: toArr(nRepeat), count: 1, maxPool: 10 },
    { name: 'run',    arr: toArr(nRun),    count: 1, maxPool: 10 },
    { name: 'arithS', arr: toArr(nArithSelf), count: 1, maxPool: 10 },
    { name: 'cross',  arr: toArr(nCross),  count: 1, maxPool: 10 },
  ];

  let allCombos = []; const usedKeys = new Set();
  dims.forEach(d => {
    genCombosFromPool(d.arr, d.count, d.maxPool).forEach(c => {
      if (!usedKeys.has(c.key)) { allCombos.push(c); usedKeys.add(c.key); }
    });
  });

  // 补满至少8注
  if (allCombos.length < 8) {
    const suppPool = new Map();
    dims.forEach(d => {
      d.arr.slice(0, 12).forEach((c, i) => {
        const k = c.number;
        if (!suppPool.has(k) || suppPool.get(k).score < c.score + 10 - i)
          suppPool.set(k, { number: k, score: c.score + 10 - i });
      });
    });
    const suppArr = [...suppPool.values()].sort((a, b) => b.score - a.score);
    genCombosFromPool(suppArr, 8 - allCombos.length, 13).forEach(c => {
      if (!usedKeys.has(c.key)) { allCombos.push(c); usedKeys.add(c.key); }
    });
  }

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

// ======================== 12b. 方案C：8维精简（参数化版本） ========================
function buildCombosOptimized(dimData, sourceNums, predictedTails, dedupThreshold = 4, diversityWeight = 0.75) {
  const { nTail, nOff, nHot, nFreq, nBr, nAr, nRepeat, nCross } = dimData;

  const toArr = (m) => {
    const arr = [];
    for (let n = 1; n <= 35; n++) arr.push({ number: n, score: m.get(n) || 0 });
    return arr.sort((a, b) => b.score - a.score);
  };

  const dims = [
    { name: 'tail',   arr: toArr(nTail),   count: 2, maxPool: 10 },
    { name: 'off',    arr: toArr(nOff),    count: 2, maxPool: 10 },
    { name: 'hot',    arr: toArr(nHot),    count: 1, maxPool: 10 },
    { name: 'freq',   arr: toArr(nFreq),   count: 1, maxPool: 10 },
    { name: 'bridge', arr: toArr(nBr),     count: 1, maxPool: 10 },
    { name: 'arith',  arr: toArr(nAr),     count: 1, maxPool: 10 },
    { name: 'repeat', arr: toArr(nRepeat), count: 2, maxPool: 10 },
    { name: 'cross',  arr: toArr(nCross),  count: 2, maxPool: 10 },
  ];

  let allCombos = []; const usedKeys = new Set();
  dims.forEach(d => {
    genCombosFromPool(d.arr, d.count, d.maxPool).forEach(c => {
      if (!usedKeys.has(c.key)) { allCombos.push(c); usedKeys.add(c.key); }
    });
  });

  if (allCombos.length < 8) {
    const suppPool = new Map();
    dims.forEach(d => {
      d.arr.slice(0, 12).forEach((c, i) => {
        const k = c.number;
        if (!suppPool.has(k) || suppPool.get(k).score < c.score + 10 - i)
          suppPool.set(k, { number: k, score: c.score + 10 - i });
      });
    });
    const suppArr = [...suppPool.values()].sort((a, b) => b.score - a.score);
    genCombosFromPool(suppArr, 8 - allCombos.length, 13).forEach(c => {
      if (!usedKeys.has(c.key)) { allCombos.push(c); usedKeys.add(c.key); }
    });
  }

  allCombos = rescoreCombos(allCombos, sourceNums, predictedTails);
  allCombos.sort((a, b) => b.score - a.score);

  // 参数化去重：使用 dedupThreshold + diversityWeight
  const final = [], fk = new Set();
  const allSelectedNums = new Set();

  for (const c of allCombos) {
    if (final.length >= 20) break;
    if (fk.has(c.key)) continue;
    let maxOverlap = 0;
    for (const f of final) {
      const fs = new Set(f.numbers); let o = 0;
      c.numbers.forEach(n => { if (fs.has(n)) o++; });
      maxOverlap = Math.max(maxOverlap, o);
    }
    if (maxOverlap >= dedupThreshold) continue;

    // 多样性评分：新号码越多，diversityBonus越高
    const uniqueCount = c.numbers.filter(n => !allSelectedNums.has(n)).length;
    const diversityBonus = uniqueCount * (1 - diversityWeight) * 50;
    const adjustedScore = c.score * diversityWeight + diversityBonus;

    // 贪心选择：在所有通过去重的候选中，选adjustedScore最高的
    // 为了效率，直接按顺序选第一个通过的（allCombos已按score排序）
    // 但加入多样性权重后需要重新排序，所以我们用一个简单的贪心
    final.push({ ...c, adjustedScore });
    fk.add(c.key);
    c.numbers.forEach(n => allSelectedNums.add(n));
  }

  // 按adjustedScore重新排序Top20
  final.sort((a, b) => (b.adjustedScore || b.score) - (a.adjustedScore || a.score));
  return final;
}

// 原版buildCombosSlim（基线对照）
function buildCombosSlim(dimData, sourceNums, predictedTails) {
  return buildCombosOptimized(dimData, sourceNums, predictedTails, 4, 0.75);
}

// ======================== 13. 补漏6（参数化版本） ========================
function generate补漏6Optimized(allCombos, sourceNums, predictedTails, firstBallPreds, candidatePool, strategy = 'original') {
  const top5 = allCombos.slice(0, 5);
  const coveredSet = new Set();
  const numberFreq = new Map(); // 号码在Top5中出现次数
  top5.forEach(c => c.numbers.forEach(n => {
    coveredSet.add(n);
    numberFreq.set(n, (numberFreq.get(n) || 0) + 1);
  }));

  const top5IvCounts = [0, 0, 0];
  top5.forEach(c => c.numbers.forEach(n => { const i = getSampleIntervalIndex(n); if (i >= 0) top5IvCounts[i]++; }));
  const nonZeroIv = top5IvCounts.filter(c => c > 0);
  const minIvI = nonZeroIv.length > 0 ? top5IvCounts.indexOf(Math.min(...nonZeroIv)) : 0;

  const topTails = predictedTails && predictedTails.length > 0
    ? new Set(predictedTails.slice(0, 5).map(p => p[0] || p)) : new Set();

  const candidates = [];
  for (const entry of candidatePool) {
    const n = entry.number;
    const freq = numberFreq.get(n) || 0;

    if (strategy === 'original') {
      // 原版：只选Top5未覆盖的号码
      if (coveredSet.has(n)) continue;
    } else if (strategy === 'hybrid') {
      // 混合策略：选Top5未覆盖 或 在Top5中出现≥2次的高频号码
      if (coveredSet.has(n) && freq < 2) continue;
    }

    let s = 0;
    if (!coveredSet.has(n)) {
      // 未覆盖号码：补盲区加分
      s += 25;
    } else if (freq >= 2) {
      // 高频覆盖号码：一致性加分
      s += freq * 8;
    }

    if (topTails.has(n % 10)) s += 10;
    else if (predictedTails && predictedTails.some(p => Math.abs((n % 10) - (p[0] || p)) === 1)) s += 5;
    const nIv = getSampleIntervalIndex(n);
    if (nIv === minIvI) s += 6;
    s += (entry.freqScore || 0) * 0.3;
    if (sourceNums.some(a => Math.abs(a - n) === 1)) s += 4;
    candidates.push({ number: n, score: s, iv: nIv });
  }
  candidates.sort((a, b) => b.score - a.score);

  const topCandidates = candidates.slice(0, Math.min(15, candidates.length));
  const candidateCombos = []; const comboSeen = new Set();
  let tries = 0;
  while (candidateCombos.length < 4 && tries < 100) {
    tries++;
    const nums = new Set();
    if (tries <= 4) { topCandidates.slice(0, 5).forEach(c => nums.add(c.number)); }
    else if (tries <= 10) {
      const ivPicked = [0, 0, 0];
      for (const c of topCandidates) {
        if (nums.size >= 5) break;
        if (nums.has(c.number)) continue;
        if (tries <= 7) { if (ivPicked[c.iv] >= 2) continue; }
        nums.add(c.number); ivPicked[c.iv]++;
      }
    } else {
      const pool = [...topCandidates];
      for (let j = pool.length - 1; j > 0; j--) { const ri = Math.floor(Math.random() * (j + 1)); [pool[j], pool[ri]] = [pool[ri], pool[j]]; }
      pool.slice(0, 5).forEach(c => nums.add(c.number));
    }
    if (nums.size < 5) continue;
    const sorted = [...nums].sort((a, b) => a - b);
    if (sorted.length !== 5) continue;
    const s = sum(sorted), sp = sorted[4] - sorted[0], odd = oddCount(sorted);
    const iv = [0, 0, 0]; sorted.forEach(v => { const i = getSampleIntervalIndex(v); if (i >= 0) iv[i]++; });
    const cv = iv.filter(c => c > 0).length;
    if (s < 55 || s > 135) continue;
    if (sp < 8 || sp > 34) continue;
    if (odd === 0 || odd === 5) continue;
    if (cv === 1) continue;
    const key = sorted.join('-');
    if (comboSeen.has(key)) continue;
    comboSeen.add(key);
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

// 原版补漏6（基线对照）
function generate补漏6(allCombos, sourceNums, predictedTails, firstBallPreds, candidatePool) {
  return generate补漏6Optimized(allCombos, sourceNums, predictedTails, firstBallPreds, candidatePool, 'original');
}

// ======================== 14. 准备维度数据 ========================
function prepareDimData(candidates, sourceNums, predictedTails) {
  const src = [...sourceNums].sort((a, b) => a - b);
  const srcSet = new Set(src);
  const srcTailSet = new Set(src.map(n => n % 10));
  const dimTail = [], dimOff = [], dimHot = [], dimFreq = [], dimBr = [], dimAr = [];
  const dimRepeat = [], dimRun = [], dimArithSelf = [], dimCross = [];

  // Top15候选号码（用于连号/等差分析）
  const topCands = candidates.slice(0, 15).map(c => c.number);
  const topCandSet = new Set(topCands);

  for (let n = 1; n <= 35; n++) {
    const t = n % 10; let sTail = 0;
    if (predictedTails && predictedTails.length > 0) {
      const topT = new Set(predictedTails.slice(0, 5).map(p => p[0] || p));
      if (topT.has(t)) sTail = 35;
      else if (predictedTails.some(p => Math.abs(t - (p[0] || p)) === 1)) sTail = 15;
      else if (srcTailSet.has(t)) sTail = 8;
    }
    dimTail.push({ number: n, score: sTail });

    let minO = Infinity; src.forEach(a => { minO = Math.min(minO, Math.abs(n - a)); });
    dimOff.push({ number: n, score: V4_OFFSET_SCORE[minO] || 0 });

    const c = candidates.find(x => x.number === n);
    dimHot.push({ number: n, score: c ? Math.min(c.hot || 0, 6) : 0 });
    dimFreq.push({ number: n, score: c ? c.freqScore || 0 : 0 });
    dimBr.push({ number: n, score: c ? c.bridgeScore || 0 : 0 });
    dimAr.push({ number: n, score: c ? c.arithScore || 0 : 0 });

    // ===== 新维度7：重复号码 =====
    // 上期号码重号概率约47%，重号有统计优势
    let sRepeat = 0;
    if (srcSet.has(n)) sRepeat += 30;          // 本身就是上期号码
    else if (srcTailSet.has(t)) sRepeat += 8;  // 尾号相同但号码不同
    dimRepeat.push({ number: n, score: sRepeat });

    // ===== 新维度8：连号邻接 =====
    // 候选号与Top15候选能组成连号的程度
    let sRun = 0;
    let neighborCount = 0;
    for (const tc of topCands) {
      const d = Math.abs(tc - n);
      if (d === 1) neighborCount++;
    }
    sRun += neighborCount * 10;
    // 检查能否组成3连号（n-1和n+1都在topCands中，或n-2和n-1，或n+1和n+2）
    if (topCandSet.has(n - 1) && topCandSet.has(n + 1)) sRun += 15;   // n是中间
    if (topCandSet.has(n - 2) && topCandSet.has(n - 1)) sRun += 10;   // n是右端
    if (topCandSet.has(n + 1) && topCandSet.has(n + 2)) sRun += 10;   // n是左端
    dimRun.push({ number: n, score: sRun });

    // ===== 新维度9：等差延伸 =====
    // 候选号与Top15候选中的任意两个组成等差数列
    let sArith = 0;
    for (let i = 0; i < topCands.length; i++) {
      for (let j = i + 1; j < topCands.length; j++) {
        const a = Math.min(topCands[i], topCands[j], n);
        const b = Math.max(topCands[i], topCands[j], n);
        const mid = topCands[i] + topCands[j] + n - a - b;
        if (b - mid === mid - a && b - mid > 0 && b - mid <= 8) {
          sArith += 8;
        }
      }
    }
    dimArithSelf.push({ number: n, score: sArith });

    // ===== 新维度10：跨期关系 =====
    // 候选号与上期号码的尾号/邻号关系
    let sCross = 0;
    if (srcSet.has(n)) sCross += 12;                                       // 直接重号
    if (src.some(a => Math.abs(a - n) === 1)) sCross += 18;               // 邻号关系
    if (srcTailSet.has(t)) sCross += 10;                                   // 尾号匹配
    // 与上期号码等差延伸
    for (let i = 0; i < src.length; i++) {
      for (let j = i + 1; j < src.length; j++) {
        const a = Math.min(src[i], src[j], n);
        const b = Math.max(src[i], src[j], n);
        const mid2 = src[i] + src[j] + n - a - b;
        if (b - mid2 === mid2 - a && b - mid2 > 0 && b - mid2 <= 8) {
          sCross += 6;
          break;
        }
      }
    }
    dimCross.push({ number: n, score: sCross });
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

  return {
    nTail: normDim(dimTail), nOff: normDim(dimOff),
    nHot: normDim(dimHot), nFreq: normDim(dimFreq),
    nBr: normDim(dimBr), nAr: normDim(dimAr),
    nRepeat: normDim(dimRepeat), nRun: normDim(dimRun),
    nArithSelf: normDim(dimArithSelf), nCross: normDim(dimCross),
  };
}

// ======================== 15. 单期回测（参数化版本） ========================
function backtestSingle(sourceIdx, allDraws, dedupThreshold, diversityWeight, bulouStrategy) {
  const sourceDraw = allDraws[sourceIdx], targetDraw = allDraws[sourceIdx + 1];
  if (!sourceDraw || !targetDraw) return null;

  const sourceNums = [...sourceDraw.front].sort((a, b) => a - b);
  const targetNums = [...targetDraw.front].sort((a, b) => a - b);
  const targetSet = new Set(targetNums);
  const sourceTails = [...new Set(sourceNums.map(n => n % 10))];
  const sourceRow = sourceIdx;

  const hotness = new Map();
  for (let r = Math.max(0, sourceRow - 5); r < sourceRow; r++) {
    const d = allDraws[r]; if (!d) continue;
    d.front.forEach(n => hotness.set(n, (hotness.get(n) || 0) + 1));
  }

  const predictedTails = predictTails(sourceRow, sourceTails, allDraws);
  const sourceIv = intervalRatio(sourceNums);
  const ivPrediction = predictTargetIv(sourceIv);
  const sourceOdd = oddCount(sourceNums);
  const targetOdd = predictTargetOdd(sourceOdd);
  const sourceSum = sum(sourceNums);
  const targetSum = predictTargetSum(sourceSum);
  const firstBallPreds = [{ number: sourceNums[0] }, { number: sourceNums[0] - 1 }, { number: sourceNums[0] + 1 }];

  const bridgeMap = buildV4BridgeMap(sourceNums, sourceNums);
  const arithMap = buildV4ArithmeticMap(sourceNums, 17, sourceNums);
  const plusTenTrend = buildV4PlusTenTrendMap(sourceRow, sourceNums, allDraws);
  const historyMetrics = calcHistoryMetrics(allDraws, sourceRow);

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

  const dimData = prepareDimData(candidates, sourceNums, predictedTails);

  // 使用参数化组合生成
  const combos = buildCombosOptimized(dimData, sourceNums, predictedTails, dedupThreshold, diversityWeight);

  const top5 = combos.slice(0, 5);
  const top5Hits = top5.map(c => c.numbers.filter(n => targetSet.has(n)).length);
  const top5Union = new Set();
  top5.forEach(c => c.numbers.forEach(n => top5Union.add(n)));
  const top5UnionCoverage = targetNums.filter(n => top5Union.has(n)).length;

  const pool30 = new Set(candidates.slice(0, 30).map(c => c.number));
  const poolCoverage = targetNums.filter(n => pool30.has(n)).length;

  // 使用参数化补漏6
  const bl6 = generate补漏6Optimized(combos, sourceNums, predictedTails, firstBallPreds, candidates, bulouStrategy);
  let bl6Hits = 0, bl6UnionCoverage = 0;
  if (bl6) {
    bl6Hits = bl6.numbers.filter(n => targetSet.has(n)).length;
    const allUnion = new Set(top5Union);
    bl6.numbers.forEach(n => allUnion.add(n));
    bl6UnionCoverage = targetNums.filter(n => allUnion.has(n)).length;
  }

  return {
    top5Hits, top5UnionCoverage, bl6Hits, bl6UnionCoverage, poolCoverage,
    top5MaxHit: Math.max(...top5Hits),
    totalCombos: combos.length,
  };
}

// ======================== 16. 参数组合定义 ========================
const paramSets = [
  { name: '基线(C方案)',        dedup: 4,   divW: 0.75, bulou: 'original' },
  { name: '去重阈值=3',         dedup: 3,   divW: 0.75, bulou: 'original' },
  { name: '去重阈值=5',         dedup: 5,   divW: 0.75, bulou: 'original' },
  { name: '多样性权重=0.65',    dedup: 4,   divW: 0.65, bulou: 'original' },
  { name: '多样性权重=0.85',    dedup: 4,   divW: 0.85, bulou: 'original' },
  { name: '混合补盲区',         dedup: 4,   divW: 0.75, bulou: 'hybrid' },
  { name: '去重3+权重0.85',     dedup: 3,   divW: 0.85, bulou: 'original' },
  { name: '去重3+混合补盲',     dedup: 3,   divW: 0.75, bulou: 'hybrid' },
  { name: '全优化',             dedup: 3,   divW: 0.85, bulou: 'hybrid' },
];

// ======================== 17. 主运行 ========================
console.log('='.repeat(100));
console.log('优化参数网格测试（基于C方案8维精简）');
console.log('='.repeat(100));
console.log(`数据范围: ${DRAWS[0]?.issue} ~ ${DRAWS[DRAWS.length - 1]?.issue} (共${DRAWS.length}期)`);
console.log(`测试参数组合: ${paramSets.length}种`);
console.log('');

const allResults = [];

for (const ps of paramSets) {
  const stats = {
    sum_top5: 0, sum_union: 0, sum_bl6: 0, sum_total: 0, sum_pool: 0,
    dist: {}, cnt: 0,
  };

  for (let i = 0; i < DRAWS.length - 1; i++) {
    const r = backtestSingle(i, DRAWS, ps.dedup, ps.divW, ps.bulou);
    if (!r) continue;
    stats.cnt++;
    stats.sum_top5 += r.top5MaxHit;
    stats.sum_union += r.top5UnionCoverage;
    stats.sum_bl6 += r.bl6Hits;
    stats.sum_total += r.bl6UnionCoverage;
    stats.sum_pool += r.poolCoverage;
    stats.dist[r.top5MaxHit] = (stats.dist[r.top5MaxHit] || 0) + 1;
  }

  allResults.push({ name: ps.name, dedup: ps.dedup, divW: ps.divW, bulou: ps.bulou, stats });
}

// ======================== 18. 输出对比表格 ========================
console.log('');
console.log('='.repeat(120));
console.log('优化参数对比结果');
console.log('='.repeat(120));
console.log('');

const cnt = allResults[0].stats.cnt;

// 表头
const header = '参数方案'.padEnd(22) + '去重'.padEnd(6) + '权重'.padEnd(6) + '补盲'.padEnd(10)
  + '命中率'.padEnd(10) + '总覆盖率'.padEnd(10) + 'Top5覆盖'.padEnd(10)
  + '补漏6命中'.padEnd(10) + '≥3球'.padEnd(8) + '≥2球'.padEnd(8);
console.log(header);
console.log('-'.repeat(120));

// 找出基线数据
const baseline = allResults[0].stats;
const baseRate = baseline.sum_top5 / (cnt * 5) * 100;
const baseCov = baseline.sum_total / (cnt * 5) * 100;
const baseUnion = baseline.sum_union / (cnt * 5) * 100;
const baseBl6 = baseline.sum_bl6 / (cnt * 5) * 100;
const baseH3 = (baseline.dist[3] || 0) + (baseline.dist[4] || 0) + (baseline.dist[5] || 0);
const baseH2 = (baseline.dist[2] || 0) + baseH3;

for (const r of allResults) {
  const s = r.stats;
  const rate = (s.sum_top5 / (cnt * 5) * 100).toFixed(1);
  const cov = (s.sum_total / (cnt * 5) * 100).toFixed(1);
  const union = (s.sum_union / (cnt * 5) * 100).toFixed(1);
  const bl6 = (s.sum_bl6 / (cnt * 5) * 100).toFixed(1);
  const h3 = ((s.dist[3] || 0) + (s.dist[4] || 0) + (s.dist[5] || 0));
  const h2 = ((s.dist[2] || 0) + h3);

  const deltaRate = (parseFloat(rate) - baseRate).toFixed(1);
  const deltaCov = (parseFloat(cov) - baseCov).toFixed(1);

  const rateStr = `${rate}%` + (r.name !== allResults[0].name ? `(${deltaRate > 0 ? '+' : ''}${deltaRate})` : '');
  const covStr = `${cov}%` + (r.name !== allResults[0].name ? `(${deltaCov > 0 ? '+' : ''}${deltaCov})` : '');

  console.log(
    r.name.padEnd(22) + String(r.dedup).padEnd(6) + r.divW.toFixed(2).padEnd(6) + r.bulou.padEnd(10)
    + rateStr.padEnd(16) + covStr.padEnd(16) + `${union}%`.padEnd(10)
    + `${bl6}%`.padEnd(10) + String(h3).padEnd(8) + String(h2).padEnd(8)
  );
}

// 详细命中分布
console.log('');
console.log('='.repeat(80));
console.log('Top5最高命中分布');
console.log('='.repeat(80));
console.log('');

const distHeader = '命中数'.padEnd(10) + allResults.map(r => r.name.substring(0, 8).padEnd(10)).join('');
console.log(distHeader);
console.log('-'.repeat(10 + allResults.length * 10));

for (let h = 5; h >= 0; h--) {
  const row = `${h}个`.padEnd(10) + allResults.map(r => {
    const v = r.stats.dist[h] || 0;
    return String(v).padEnd(10);
  }).join('');
  console.log(row);
}

// 最优方案推荐
console.log('');
console.log('='.repeat(80));
console.log('推荐');
console.log('='.repeat(80));

let bestRate = allResults[0], bestCov = allResults[0];
for (const r of allResults) {
  const rate = r.stats.sum_top5 / (cnt * 5) * 100;
  const cov = r.stats.sum_total / (cnt * 5) * 100;
  if (rate > bestRate.stats.sum_top5 / (cnt * 5) * 100) bestRate = r;
  if (cov > bestCov.stats.sum_total / (cnt * 5) * 100) bestCov = r;
}

console.log(`  最高命中率: ${bestRate.name} (${(bestRate.stats.sum_top5 / (cnt * 5) * 100).toFixed(1)}%)`);
console.log(`  最高覆盖率: ${bestCov.name} (${(bestCov.stats.sum_total / (cnt * 5) * 100).toFixed(1)}%)`);

console.log('');
console.log('完成!');
