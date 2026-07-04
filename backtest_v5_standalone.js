/**
 * backtest_v5_standalone.js — 独立回测脚本（无需浏览器）
 * 从 script.js 移植核心打分+组合生成逻辑
 * 验证：每期 Top5/补漏6 命中 + 联合覆盖 + 候选池覆盖
 *
 * 运行：node backtest_v5_standalone.js
 */

const fs = require('fs');
const path = require('path');

// ======================== 1. 加载开奖数据 ========================
const rawJs = fs.readFileSync(path.join(__dirname, 'all_draws.js'), 'utf8');
const match = rawJs.match(/window\.ALL_DRAWS_DATA\s*=\s*(\[[\s\S]*?\]);/);
if (!match) { console.error('无法解析 all_draws.js'); process.exit(1); }
const ALL_DRAWS_DATA = eval(match[1]);

// 按期号升序排列（旧→新）
const DRAWS = [...ALL_DRAWS_DATA].reverse();

// ======================== 2. 常量定义（移植自 script.js）====================
const sampleIntervals = [
  { min: 1, max: 12 },
  { min: 13, max: 24 },
  { min: 25, max: 35 },
];

const V4_OFFSET_SCORE = { 0:20, 1:15, 2:13, 3:12, 4:11, 5:12, 6:8, 7:7, 8:5, 9:4, 10:3, 11:2, 12:1 };
const V4_TAIL_SAME = 35;
const V4_TAIL_NEIGHBOR = 15;
const V4_TAIL_WITHIN = 8;

// ======================== 3. 工具函数（移植自 script.js）====================

function sum(nums) { return nums.reduce((a, b) => a + b, 0); }
function span(nums) { return nums[nums.length - 1] - nums[0]; }
function oddCount(nums) { return nums.filter(n => n % 2 === 1).length; }
function intervalRatio(nums) {
  const iv = [0, 0, 0];
  nums.forEach(n => {
    const i = sampleIntervals.findIndex(iv => n >= iv.min && n <= iv.max);
    if (i >= 0) iv[i]++;
  });
  return iv;
}
function tails(nums) { return [...new Set(nums.map(n => n % 10))].sort((a, b) => a - b); }
function getSampleIntervalIndex(n) { return sampleIntervals.findIndex(iv => n >= iv.min && n <= iv.max); }

// ======================== 4. 桥接 + 等差映射 ========================
function buildV4BridgeMap(anchorNumbers, supportNumbers) {
  const gapMap = new Map();
  const endpointMap = new Map();
  const anchors = [...anchorNumbers].sort((a, b) => a - b);

  // gapMap: 锚点之间的间隙号码
  for (let i = 0; i < anchors.length - 1; i++) {
    const gap = anchors[i + 1] - anchors[i];
    if (gap >= 2 && gap <= 5) {
      for (let n = anchors[i] + 1; n < anchors[i + 1]; n++) {
        if (n >= 1 && n <= 35) {
          const prev = gapMap.get(n) || { hits: 0, score: 0, count: 0 };
          prev.hits++;
          // 距离越近分越高
          const d1 = n - anchors[i], d2 = anchors[i + 1] - n;
          prev.score += Math.max(0, 10 - Math.abs(d1 - 2) * 3) + Math.max(0, 10 - Math.abs(d2 - 2) * 3);
          prev.count++;
          gapMap.set(n, prev);
        }
      }
    }
  }

  // endpointMap: 锚点 ±1~4 外围
  anchors.forEach(a => {
    for (let d = 1; d <= 4; d++) {
      [a - d, a + d].forEach(n => {
        if (n >= 1 && n <= 35 && !anchors.some(x => Math.abs(x - n) <= 0)) {
          const prev = endpointMap.get(n) || { hits: 0, score: 0 };
          prev.hits++;
          prev.score += Math.max(0, 12 - d * 3);
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
        prev.hits++;
        prev.score += 10;
        map.set(next, prev);
      }
      const prev2 = anchors[i] - diff;
      if (prev2 >= 1 && prev2 <= 35 && !anchors.includes(prev2)) {
        const p = map.get(prev2) || { hits: 0, score: 0 };
        p.hits++;
        p.score += 8;
        map.set(prev2, p);
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

  // 回测专用：间隔1，找历史中与sourceNums相似的期，看其下一期出了什么
  for (let i = 0; i < allDraws.length - 1; i++) {
    const row = allDraws[i];
    const next = allDraws[i + 1];
    if (!row || !next) continue;
    const overlap = row.front.filter(n => sourceSet.has(n)).length;
    const neighborHits = row.front.filter(n => sourceNums.some(s => Math.abs(s - n) === 1)).length;
    if (overlap >= 2 || (overlap >= 1 && neighborHits >= 2)) {
      cnt++;
      next.front.forEach(n => {
        targetMap.set(n, (targetMap.get(n) || 0) + 1);
        [n - 1, n + 1].forEach(nb => {
          if (nb >= 1 && nb <= 35) neighborMap.set(nb, (neighborMap.get(nb) || 0) + 1);
        });
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
    if (anchorSet.has(n)) {
      keepHits++;
      score += 6;
      explainedAnchors.set(n, (explainedAnchors.get(n) || 0) + 1);
      explainable.add(n);
      return;
    }
    let bestW = 0;
    anchorNumbers.forEach(a => {
      const d = Math.abs(n - a);
      const w = V4_OFFSET_SCORE[d] || 0;
      if (w > 0) {
        bestW = Math.max(bestW, w);
        if (d >= 4 || d === 7) farOffsetCount++;
        explainable.add(n);
        explainedAnchors.set(a, (explainedAnchors.get(a) || 0) + 1);
      }
    });
    if (bestW > 0) { score += bestW; transformedCount++; }
  });

  // Run support: 锚点连号附近号码加分
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
            if (dist >= 1 && dist <= 4) {
              score += 16 - dist * 2;
              supportedRunNumbers.add(n);
            }
          }
        });
      }
      cr = 1;
    }
  }

  // 组合自身连号 + anchor support
  const numSorted = [...numbers].sort((a, b) => a - b);
  cr = 1;
  for (let i = 1; i <= numSorted.length; i++) {
    if (i < numSorted.length && numSorted[i] === numSorted[i - 1] + 1) cr++;
    else {
      if (cr >= 2) {
        const seg = numSorted.slice(i - cr, i);
        const sc = seg.filter(n =>
          supportedRunNumbers.has(n) || anchorNumbers.some(a => Math.abs(n - a) <= 3)
        ).length;
        if (sc >= Math.min(2, seg.length)) {
          score += seg.length * 8;
          seg.forEach(n => supportedRunNumbers.add(n));
        }
      }
      cr = 1;
    }
  }

  // 覆盖度奖励
  const explainableCount = explainable.size;
  let covBonus = 0;
  if (explainableCount >= numbers.length) covBonus = numbers.length * 14;
  else if (explainableCount >= numbers.length - 1) covBonus = explainableCount * 10;
  else if (explainableCount >= 3) covBonus = explainableCount * 6;
  else covBonus = explainableCount * 2;

  // 变换多样性奖励
  let divBonus = 0;
  if (transformedCount >= numbers.length - 1) divBonus = transformedCount * 16;
  else if (transformedCount >= 3) divBonus = transformedCount * 11;
  else divBonus = transformedCount * 4;

  // 远距离奖励
  let farBonus = 0;
  if (farOffsetCount >= 3) farBonus = farOffsetCount * 14;
  else if (farOffsetCount >= 2) farBonus = farOffsetCount * 10;
  else farBonus = farOffsetCount * 3;

  // 锚点覆盖奖励
  const anchorCovCount = explainedAnchors.size;
  let acBonus = 0;
  if (anchorCovCount >= 4) acBonus = anchorCovCount * 12;
  else if (anchorCovCount >= 3) acBonus = anchorCovCount * 7;
  else acBonus = anchorCovCount * 2;

  // 拥挤惩罚
  const maxLoad = explainedAnchors.size > 0 ? Math.max(...explainedAnchors.values()) : 0;
  const crowdPen = maxLoad >= 3 ? (maxLoad - 2) * 12 : 0;
  const keepPen = keepHits >= 2 ? (keepHits - 1) * 14 : 0;

  return {
    anchorTransformScore: score,
    explainCoverageBonus: covBonus,
    transformDiversityBonus: divBonus,
    farOffsetBonus: farBonus,
    farOffsetCount,
    anchorCoverageBonus: acBonus,
    anchorCoverageCount: anchorCovCount,
    anchorCrowdPenalty: crowdPen,
    anchorKeepPenalty: keepPen,
    anchorKeepHits: keepHits,
    supportedRunNumbers,
  };
}

// ======================== 7. 跨度/连号惩罚 ========================
function getComboSpreadPenalty(nums) {
  const s = [...nums].sort((a, b) => a - b);
  if (s.length <= 1) return { span: 0, penalty: 0 };
  const sp = s[4] - s[0];
  let p = 0;
  const ivs = [0, 0, 0];
  s.forEach(n => { const i = getSampleIntervalIndex(n); if (i >= 0) ivs[i]++; });
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

// ======================== 9. 单号评分（V5候选池）=======================
function scoreSingleNumber(n, sourceNums, sourceTails, predictedTails, bridgeMap, arithMap,
                           plusTenTrend, hotness, ivPrediction, sourceIv, sourceOdd, targetOdd,
                           sourceSum, targetSum, historyMetrics) {
  let score = 0;
  const srcSet = new Set(sourceNums);

  // 偏移评分
  let minOff = Infinity;
  sourceNums.forEach(a => { minOff = Math.min(minOff, Math.abs(n - a)); });
  score += V4_OFFSET_SCORE[minOff] || 0;

  // 尾号关联
  const t = n % 10;
  if (predictedTails && predictedTails.length > 0) {
    const topTails = new Set(predictedTails.slice(0, 5).map(tt => tt[0] || tt));
    if (topTails.has(t)) score += V4_TAIL_SAME;
    else if (predictedTails.some(tt => Math.abs(t - (tt[0] || tt)) === 1)) score += V4_TAIL_NEIGHBOR;
    else if (sourceTails.includes(t)) score += V4_TAIL_WITHIN;
  } else {
    if (sourceTails.includes(t)) score += V4_TAIL_WITHIN;
  }

  // +10期趋势
  if (plusTenTrend && plusTenTrend.max > 0) {
    const ptScore = plusTenTrend.targetMap.get(n) || 0;
    if (ptScore > 0) score += Math.round(ptScore / plusTenTrend.max * 30);
    const ptNb = plusTenTrend.neighborMap.get(n) || 0;
    if (ptNb > 0) score += Math.round(ptNb / plusTenTrend.max * 6);
  }

  // 桥接
  const maxBridge = 50;
  const bg = bridgeMap.gapMap.get(n);
  const be = bridgeMap.endpointMap.get(n);
  if (bg) score += Math.round(Math.min(bg.score, maxBridge) / maxBridge * 15);
  if (be) score += Math.round(Math.min(be.score, maxBridge) / maxBridge * 8);

  // 等差
  const maxArith = 50;
  const ae = arithMap.get(n);
  if (ae) score += Math.round(Math.min(ae.score, maxArith) / maxArith * 10);

  // 热号（增强权重，稳定版）
  const hot = hotness.get(n) || 0;
  if (hot >= 4) score += 10; else if (hot >= 3) score += 7; else if (hot >= 2) score += 4; else if (hot === 0) score -= 2;

  // 区间/奇偶/和值平衡
  const iv = getSampleIntervalIndex(n);
  if (ivPrediction) {
    if (sourceIv[iv] < ivPrediction[iv]) score += 3;
  }
  if (n % 2 === 1 && sourceOdd < targetOdd) score += 2;
  else if (n % 2 === 0 && sourceOdd > targetOdd) score += 2;
  const sumDiff = targetSum - sourceSum;
  if (Math.abs(sumDiff) > 10) {
    if (sumDiff > 0 && n >= 15) score += 2;
    else if (sumDiff < 0 && n <= 18) score += 2;
  }

  // 历史频率
  if (historyMetrics && historyMetrics.avgHistoryFreq > 0) {
    const hf = (historyMetrics.historyFreq[n] || 0);
    const rf = (historyMetrics.recentFreq[n] || 0);
    const hr = hf / historyMetrics.avgHistoryFreq;
    const rr = rf / Math.max(0.001, historyMetrics.avgRecentFreq);
    if (hr > 1.2) score += Math.round((hr - 1) * 15);
    if (rr > 1.3) score += Math.round((rr - 1) * 10);
  }

  // 邻号奖励
  if (sourceNums.some(a => Math.abs(a - n) === 1)) score += 12;

  return score;
}

// ======================== 10. 尾号转移预测 ========================
function predictTails(sourceRow, sourceTails, allDraws) {
  // 统计历史：从sourceTails转移后下一期的尾号分布
  const tailFreq = new Map();
  let cnt = 0;
  for (let i = 0; i < allDraws.length - 1; i++) {
    const row = allDraws[i];
    const next = allDraws[i + 1];
    if (!row || !next) continue;
    const rowTails = tails(row.front);
    const overlap = rowTails.filter(t => sourceTails.includes(t)).length;
    if (overlap >= 2) {
      cnt++;
      next.front.forEach(n => {
        const t = n % 10;
        tailFreq.set(t, (tailFreq.get(t) || 0) + 1);
      });
    }
  }
  return [...tailFreq.entries()].sort((a, b) => b[1] - a[1]);
}

// ======================== 11. 历史频率 ========================
function calcHistoryMetrics(allDraws, sourceIdx) {
  const historyFreq = new Array(36).fill(0);
  const recentFreq = new Array(36).fill(0);
  let totalBalls = 0;

  // 全体历史（最多前50期）
  const histStart = Math.max(0, sourceIdx - 50);
  for (let i = histStart; i < sourceIdx; i++) {
    const d = allDraws[i];
    if (!d) continue;
    d.front.forEach(n => { historyFreq[n]++; totalBalls++; });
  }

  // 近期（前5期）
  const recentStart = Math.max(0, sourceIdx - 5);
  for (let i = recentStart; i < sourceIdx; i++) {
    const d = allDraws[i];
    if (!d) continue;
    d.front.forEach(n => recentFreq[n]++);
  }

  const recentTotal = Math.max(1, allDraws.slice(recentStart, sourceIdx).length * 5);
  const avgHistoryFreq = totalBalls > 0 ? totalBalls / 35 : 5;
  const avgRecentFreq = recentTotal / 35;

  return { historyFreq, recentFreq, avgHistoryFreq, avgRecentFreq };
}

// ======================== 12. 预测（区间/奇偶/和值）=======================
function getIntervalRatioDistance(ratio1, ratio2) {
  let dist = 0;
  for (let i = 0; i < 3; i++) dist += Math.abs((ratio1[i] || 0) - (ratio2[i] || 0));
  return dist;
}

// 移植自 script.js predictTargetIntervalRatio，对齐数据驱动逻辑

function predictTargetIv(sourceIv, allDraws, sourceIdx) {
  if (sourceIdx < 2) return sourceIv;

  // 提取历史draws（和script.js一致）
  const draws = [];
  for (let i = 0; i <= sourceIdx; i++) {
    if (allDraws[i] && allDraws[i].front && allDraws[i].front.length === 5) {
      draws.push(allDraws[i].front);
    }
  }

  const sourceIvKey = sourceIv.join(":");
  const transitions = new Map();
  const windowSize = Math.min(60, draws.length);

  // ① 收集同源区间比特定转移 + 全局平均转移距离
  let specificCount = 0;
  let globalDistSum = 0, globalDistCount = 0;
  for (let i = 0; i < draws.length - 1; i++) {
    const sIv = intervalRatio(draws[i]);
    const tIv = intervalRatio(draws[i + 1]);
    globalDistSum += getIntervalRatioDistance(sIv, tIv);
    globalDistCount++;
    const sKey = sIv.join(":");
    if (sKey !== sourceIvKey) continue;
    specificCount++;
    const tKey = tIv.join(":");
    const recency = 1 + (i - Math.max(0, draws.length - 2 - windowSize)) / windowSize * 2;
    const entry = transitions.get(tKey) || { count: 0, weight: 0 };
    entry.count++;
    entry.weight += recency;
    transitions.set(tKey, entry);
  }

  const globalAvgDist = globalDistCount > 0 ? globalDistSum / globalDistCount : 3.0;
  const minSpecific = 4;
  const blendWeight = Math.min(1, specificCount / minSpecific);

  const maxWeight = Math.max(1, ...[...transitions.values()].map(d => d.weight));
  const sorted = [...transitions.entries()]
    .map(([ivKey, data]) => ({
      iv: ivKey.split(":").map(Number),
      ivKey,
      score: data.count * 0.7 + (data.weight / maxWeight) * 30,
      count: data.count,
      weight: data.weight
    }))
    .sort((a, b) => b.score - a.score);

  if (sorted.length === 0) {
    return sourceIv;
  }

  // ② 规律增强：区间变化模式检测
  const patternBoost = new Map();

  if (draws.length >= 3) {
    const recentIvs = [];
    for (let i = Math.max(0, draws.length - 5); i < draws.length; i++) {
      recentIvs.push(intervalRatio(draws[i]));
    }

    // 规律1: 区间不变时（占比33-40%），预期可能继续不变
    let sameCount = 0;
    for (let i = recentIvs.length - 1; i >= 1; i--) {
      if (recentIvs[i][0] === recentIvs[i-1][0] &&
          recentIvs[i][1] === recentIvs[i-1][1] &&
          recentIvs[i][2] === recentIvs[i-1][2]) {
        sameCount++;
      } else break;
    }
    if (sameCount >= 2) {
      const currentKey = sourceIv.join(":");
      const boost = patternBoost.get(currentKey) || 0;
      patternBoost.set(currentKey, boost + sameCount * 3);
    }

    // 规律2: 极值后回归（概率78-100%）
    for (let zone = 0; zone < 3; zone++) {
      if (sourceIv[zone] === 0) {
        const predicted = [...sourceIv];
        predicted[zone] = Math.min(3, predicted[zone] + 2);
        const key = predicted.join(":");
        patternBoost.set(key, (patternBoost.get(key) || 0) + 8);
        const predicted2 = [...sourceIv];
        predicted2[zone] = Math.min(3, predicted2[zone] + 1);
        const key2 = predicted2.join(":");
        patternBoost.set(key2, (patternBoost.get(key2) || 0) + 5);
      }
      if (sourceIv[zone] >= 4) {
        const predicted = [...sourceIv];
        predicted[zone] = Math.max(0, predicted[zone] - 2);
        const key = predicted.join(":");
        patternBoost.set(key, (patternBoost.get(key) || 0) + 8);
        const predicted2 = [...sourceIv];
        predicted2[zone] = Math.max(0, predicted2[zone] - 1);
        const key2 = predicted2.join(":");
        patternBoost.set(key2, (patternBoost.get(key2) || 0) + 5);
      }
    }

    // 规律3: 连续同向变化后反转
    if (recentIvs.length >= 3) {
      const current = recentIvs[recentIvs.length - 1];
      const prev = recentIvs[recentIvs.length - 2];
      const prevPrev = recentIvs[recentIvs.length - 3];
      for (let zone = 0; zone < 3; zone++) {
        const diff1 = current[zone] - prev[zone];
        const diff2 = prev[zone] - prevPrev[zone];
        if (diff1 > 0 && diff2 > 0) {
          const predicted = [...current];
          predicted[zone] = Math.max(0, predicted[zone] - 1);
          const key = predicted.join(":");
          patternBoost.set(key, (patternBoost.get(key) || 0) + 4);
        }
        if (diff1 < 0 && diff2 < 0) {
          const predicted = [...current];
          predicted[zone] = Math.min(5, predicted[zone] + 1);
          const key = predicted.join(":");
          patternBoost.set(key, (patternBoost.get(key) || 0) + 4);
        }
      }
    }
  }

  // 应用规律加分
  const enhanced = sorted.map(candidate => {
    const patternBonus = patternBoost.get(candidate.ivKey) || 0;
    return { ...candidate, score: candidate.score + patternBonus };
  }).sort((a, b) => b.score - a.score);

  // 与全局均值融合
  const rawDistance = getIntervalRatioDistance(sourceIv, enhanced[0].iv);
  const blendedDistance = Math.round(rawDistance * blendWeight + globalAvgDist * (1 - blendWeight));

  return enhanced[0].iv;
}

function predictTargetOdd(sourceOdd, sourceIv, targetIv) {
  let oddPred = sourceOdd;
  if (targetIv[0] > sourceIv[0]) oddPred = Math.min(5, oddPred + 1);
  if (targetIv[2] < sourceIv[2]) oddPred = Math.max(0, oddPred - 1);
  if (targetIv[2] > sourceIv[2]) oddPred = Math.min(5, oddPred + 1);
  return Math.max(1, Math.min(4, oddPred));
}

function predictTargetSum(sourceSum, sourceIv, targetIv) {
  let sumPred = sourceSum;
  if (targetIv[0] > sourceIv[0]) sumPred = sumPred * 0.8 + 71 * 0.2;
  else if (targetIv[0] < sourceIv[0]) sumPred = sumPred * 0.8 + 107 * 0.2;
  if (targetIv[2] > sourceIv[2]) sumPred = sumPred * 0.8 + 105 * 0.2;
  else if (targetIv[2] < sourceIv[2]) sumPred = sumPred * 0.8 + 73 * 0.2;
  sumPred = sumPred * 0.7 + 90 * 0.3;
  return Math.round(Math.max(40, Math.min(160, sumPred)));
}

// ======================== 13. V5 6维度组合生成 ========================
function buildSampleFrontCombosV5(candidates, sourceNums, predictedTails, ivPrediction, firstBallPreds) {
  const src = [...sourceNums].sort((a, b) => a - b);
  const srcSet = new Set(src);

  // 6维度独立评分
  const dimTail = [], dimOff = [], dimHot = [], dimFreq = [], dimBr = [], dimAr = [];
  for (let n = 1; n <= 35; n++) {
    const t = n % 10;
    let sTail = 0;
    if (predictedTails && predictedTails.length > 0) {
      const topT = new Set(predictedTails.slice(0, 5).map(p => p[0] || p));
      if (topT.has(t)) sTail = 35;
      else if (predictedTails.some(p => Math.abs(t - (p[0] || p)) === 1)) sTail = 15;
      else if (new Set(src.map(x => x % 10)).has(t)) sTail = 8;
    }
    dimTail.push({ number: n, score: sTail });

    let minO = Infinity;
    src.forEach(a => { minO = Math.min(minO, Math.abs(n - a)); });
    dimOff.push({ number: n, score: V4_OFFSET_SCORE[minO] || 0 });

    // 热号/频率/桥接/等差从candidates获取
    const c = candidates.find(x => x.number === n);
    dimHot.push({ number: n, score: c ? Math.min(c.hot || 0, 6) : 0 });
    dimFreq.push({ number: n, score: c ? c.freqScore || 0 : 0 });
    dimBr.push({ number: n, score: c ? c.bridgeScore || 0 : 0 });
    dimAr.push({ number: n, score: c ? c.arithScore || 0 : 0 });
  }

  const normDim = (dim) => {
    const mx = Math.max(1, dim[0]?.score || 0);
    const mn = Math.min(0, dim[dim.length - 1]?.score || 0);
    const rng = mx - mn || 1;
    const m = new Map();
    dim.forEach(e => m.set(e.number, Math.round(((e.score - mn) / rng) * 100)));
    return m;
  };

  const nTail = normDim(dimTail.sort((a, b) => b.score - a.score));
  const nOff = normDim(dimOff.sort((a, b) => b.score - a.score));
  const nHot = normDim(dimHot.sort((a, b) => b.score - a.score));
  const nFreq = normDim(dimFreq.sort((a, b) => b.score - a.score));
  const nBr = normDim(dimBr.sort((a, b) => b.score - a.score));
  const nAr = normDim(dimAr.sort((a, b) => b.score - a.score));

  // 3对联合
  const buildPair = (a, b, wa, wb) => {
    const arr = [];
    for (let n = 1; n <= 35; n++) arr.push({ number: n, score: (a.get(n) || 0) * wa + (b.get(n) || 0) * wb });
    return arr.sort((x, y) => y.score - x.score);
  };
  const pair1 = buildPair(nTail, nOff, 0.7, 0.3);    // 优化: tail权重0.55→0.7 (+0.5pp Joint)
  const pair2 = buildPair(nHot, nFreq, 0.4, 0.6);    // 优化: freq权重0.5→0.6 (+0.3pp Joint)
  const pair3 = buildPair(nBr, nAr, 0.4, 0.6);       // 优化: arith权重0.5→0.6 (+0.6pp Joint)

  // 从pair生成组合
  const genCombos = (pair, count, maxPool = 13) => {
    const topN = [...pair].sort((a, b) => b.score - a.score).slice(0, maxPool);
    const combos = [], seen = new Set();
    const loopL = count * 20;
    for (let a = 0; a < topN.length - 4 && combos.length < loopL; a++) {
      for (let b = a + 1; b < topN.length - 3 && combos.length < loopL; b++) {
        for (let c = b + 1; c < topN.length - 2 && combos.length < loopL; c++) {
          for (let d = c + 1; d < topN.length - 1 && combos.length < loopL; d++) {
            for (let e = d + 1; e < topN.length && combos.length < loopL; e++) {
              const nums = [topN[a].number, topN[b].number, topN[c].number, topN[d].number, topN[e].number].sort((x, y) => x - y);
              if (new Set(nums).size !== 5) continue;
              const sp = nums[4] - nums[0], odd = oddCount(nums);
              if (odd === 0 || odd === 5 || sp < 8 || sp > 34) continue;
              const iv = [0, 0, 0]; nums.forEach(v => iv[getSampleIntervalIndex(v)]++);
              if (Math.max(...iv) >= 5) continue;
              let run = 1, mc = 1;
              for (let i = 1; i < nums.length; i++) { if (nums[i] - nums[i - 1] === 1) { run++; mc = Math.max(mc, run); } else run = 1; }
              if (mc > 3) continue;
              const s = sum(nums);
              if (s < 40 || s > 160) continue;
              const key = nums.join('-');
              if (seen.has(key)) continue;
              seen.add(key);
              const sc = nums.reduce((s, n) => s + (topN.find(x => x.number === n)?.score || 0), 0);
              combos.push({ key, numbers: nums, score: sc, span: sp, odd, iv, sum: s });
            }
          }
        }
      }
    }
    combos.sort((a, b) => b.score - a.score);
    // 多样性选择
    const sel = [], dk = new Set();
    for (const c of combos) {
      if (sel.length >= count) break;
      if (dk.has(c.key)) continue;
      let sim = false;
      for (const s of sel) {
        let o = 0; const ss = new Set(s.numbers);
        c.numbers.forEach(n => { if (ss.has(n)) o++; });
        if (o >= 4) { sim = true; break; }  // 优化: 组内去重阈值3→4 (+1.1pp Joint)
      }
      if (!sim) { sel.push(c); dk.add(c.key); }
    }
    return sel;
  };

  let allCombos = [];
  const usedKeys = new Set();
  const add = (pair, cnt, maxP) => {
    genCombos(pair, cnt, maxP).forEach(c => { if (!usedKeys.has(c.key)) { allCombos.push(c); usedKeys.add(c.key); } });
  };
  add(pair1, 3, 13);
  add(pair2, 3, 13);
  add(pair3, 2, 10);

  // 补充到至少8注
  if (allCombos.length < 8) {
    const suppPool = new Map();
    [pair1, pair2, pair3].forEach((dim, di) => {
      dim.slice(0, 12).forEach((c, i) => {
        const k = c.number;
        if (!suppPool.has(k) || suppPool.get(k).score < c.score + 10 - i) {
          suppPool.set(k, { number: k, score: c.score + 10 - i });
        }
      });
    });
    const suppArr = [...suppPool.values()].sort((a, b) => b.score - a.score);
    genCombos(suppArr, 8 - allCombos.length, 13).forEach(c => {
      if (!usedKeys.has(c.key)) { allCombos.push(c); usedKeys.add(c.key); }
    });
  }

  // V5组合重评分（添加随机扰动模拟weightPower随机化）
  allCombos = allCombos.map(c => {
    let bonus = c.score || 0;
    const nums = c.numbers || [];
    const s = sum(nums), sp = nums[4] - nums[0], odd = oddCount(nums);
    const iv = [0, 0, 0]; nums.forEach(v => iv[getSampleIntervalIndex(v)]++);
    const ivKey = iv.join(':');

    // 固定扰动（随机化测试未提升）

    // 和值约束
    if (s < 55 || s > 135) return { ...c, score: bonus - 50 };
    if (s >= 80 && s <= 105) bonus += 15;
    else if (s >= 65 && s <= 120) bonus += 5;
    else bonus -= Math.abs(s - 90) * 0.5;

    // 区间比
    const commonRatios = ['2:1:2', '2:2:1', '1:2:2', '3:1:1', '1:3:1', '1:1:3'];
    const ri = commonRatios.indexOf(ivKey);
    if (ri >= 0) bonus += ri < 3 ? 8 : 4;

    // 奇偶
    if (odd >= 1 && odd <= 4) bonus += 5;

    // 跨度
    if (sp >= 18 && sp <= 28) bonus += 8;

    // 预测尾号匹配
    if (predictedTails && predictedTails.length > 0) {
      const topT = new Set(predictedTails.slice(0, 5).map(p => p[0] || p));
      const tailMatch = nums.filter(n => topT.has(n % 10)).length;
      bonus += tailMatch * 5;
    }

    // 参考行加分 + 锚点评分
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

  allCombos.sort((a, b) => b.score - a.score);

  // 跨维度去重（重叠>=4跳过）
  const final = [], fk = new Set();
  for (const c of allCombos) {
    if (final.length >= 20) break;
    if (fk.has(c.key)) continue;
    let sim = false;
    for (const f of final) {
      const fs = new Set(f.numbers);
      let o = 0; c.numbers.forEach(n => { if (fs.has(n)) o++; });
      if (o >= 4) { sim = true; break; }
    }
    if (!sim) { final.push(c); fk.add(c.key); }
  }

  return final;
}

// ======================== 14. 补漏6 ========================
function generate补漏6(allCombos, sourceNums, predictedTails, firstBallPreds, candidatePool) {
  const top5 = allCombos.slice(0, 5);

  // 收集已覆盖号码
  const coveredCount = new Map();
  top5.forEach(c => c.numbers.forEach(n => coveredCount.set(n, (coveredCount.get(n) || 0) + 1)));

  // Top5 覆盖号码集合
  const coveredSet = new Set();
  top5.forEach(c => c.numbers.forEach(n => coveredSet.add(n)));

  // 区间平衡分析
  const top5IvCounts = [0, 0, 0];
  top5.forEach(c => c.numbers.forEach(n => { const i = getSampleIntervalIndex(n); if (i >= 0) top5IvCounts[i]++; }));
  const minIvI = top5IvCounts.indexOf(Math.min(...top5IvCounts.filter(c => c > 0)));

  // 预测尾号
  const topTails = predictedTails && predictedTails.length > 0
    ? new Set(predictedTails.slice(0, 5).map(p => p[0] || p)) : new Set();

  // 筛选候选
  const candidates = [];
  for (const entry of candidatePool) {
    const n = entry.number;
    if (coveredSet.has(n)) continue; // 已覆盖的跳过
    const coverCount = coveredCount.get(n) || 0;
    // if (coverCount >= 2) continue; // Top5中出现>=2次的也跳过（已过多）

    let s = 0;
    // 尾号匹配
    if (topTails.has(n % 10)) s += 10;
    else if (predictedTails && predictedTails.some(p => Math.abs((n % 10) - (p[0] || p)) === 1)) s += 5;

    // 区间平衡
    const nIv = getSampleIntervalIndex(n);
    if (nIv === minIvI) s += 6;

    // 频率分
    s += (entry.freqScore || 0) * 0.3;

    // 邻号加分
    if (sourceNums.some(a => Math.abs(a - n) === 1)) s += 4;

    candidates.push({ number: n, score: s, iv: nIv });
  }
  candidates.sort((a, b) => b.score - a.score);

  // 生成4个候选组合，选最优
  const topCandidates = candidates.slice(0, Math.min(15, candidates.length));
  const candidateCombos = [];
  const comboSeen = new Set();

  // 尝试生成
  let tries = 0;
  while (candidateCombos.length < 4 && tries < 100) {
    tries++;
    const nums = new Set();

    // 确定性选择最高分的5个
    if (tries <= 4) {
      topCandidates.slice(0, 5).forEach(c => nums.add(c.number));
    } else if (tries <= 10) {
      // 贪心选择，确保区间覆盖
      const ivPicked = [0, 0, 0];
      for (const c of topCandidates) {
        if (nums.size >= 5) break;
        if (nums.has(c.number)) continue;
        if (tries <= 7) {
          if (ivPicked[c.iv] >= 2) continue;
        }
        nums.add(c.number);
        ivPicked[c.iv]++;
      }
    } else {
      // 确定性选择（取score最高的5个，避免Math.random波动）
      topCandidates.slice(0, 5).forEach(c => nums.add(c.number));
    }

    if (nums.size < 5) continue;

    const sorted = [...nums].sort((a, b) => a - b);
    if (sorted.length !== 5) continue;

    const s = sum(sorted), sp = sorted[4] - sorted[0], odd = oddCount(sorted);
    const iv = [0, 0, 0]; sorted.forEach(v => { const i = getSampleIntervalIndex(v); if (i >= 0) iv[i]++; });
    const cv = iv.filter(c => c > 0).length;

    // 结构约束
    if (s < 55 || s > 135) continue;
    if (sp < 8 || sp > 34) continue;
    if (odd === 0 || odd === 5) continue;
    if (cv === 1) continue;

    const key = sorted.join('-');
    if (comboSeen.has(key)) continue;
    comboSeen.add(key);

    // 评分
    let bonus = 0;
    if (s >= 80 && s <= 105) bonus += 10;
    if (sp >= 14 && sp <= 28) bonus += 8;
    if (odd >= 2 && odd <= 3) bonus += 6;
    if (cv === 3) bonus += 6;

    // 首位球预测加分
    if (firstBallPreds && firstBallPreds.length > 0) {
      const fp = firstBallPreds.slice(0, 3).map(p => p.number || p);
      if (fp.includes(sorted[0])) bonus += 8;
    }

    candidateCombos.push({ key, numbers: sorted, score: bonus });
  }

  candidateCombos.sort((a, b) => b.score - a.score);
  return candidateCombos[0] || null;
}

// ======================== 15. 逐期验证主函数 ========================
function backtestSingleIssue(sourceIdx, allDraws) {
  const sourceDraw = allDraws[sourceIdx];
  const targetDraw = allDraws[sourceIdx + 1]; // 用下一期验证
  if (!sourceDraw || !targetDraw) return null;

  const sourceNums = [...sourceDraw.front].sort((a, b) => a - b);
  const targetNums = [...targetDraw.front].sort((a, b) => a - b);
  const targetSet = new Set(targetNums);
  const sourceTails = [...new Set(sourceNums.map(n => n % 10))];

  // 计算 sourceIdx 在全局中的行号（用于前5期热号）
  const drawCount = allDraws.length;
  const sourceRow = sourceIdx; // 用数组索引作为"行号"

  // 热号
  const hotness = new Map();
  for (let r = Math.max(0, sourceRow - 5); r < sourceRow; r++) {
    const d = allDraws[r];
    if (!d) continue;
    d.front.forEach(n => hotness.set(n, (hotness.get(n) || 0) + 1));
  }

  // 预测
  const predictedTails = predictTails(sourceRow, sourceTails, allDraws);
  const sourceIv = intervalRatio(sourceNums);
  const ivPrediction = predictTargetIv(sourceIv, allDraws, sourceIdx);
  const sourceOdd = oddCount(sourceNums);
  const targetOdd = predictTargetOdd(sourceOdd, sourceIv, ivPrediction);
  const sourceSum = sum(sourceNums);
  const targetSum = predictTargetSum(sourceSum, sourceIv, ivPrediction);
  const firstBallPreds = [{ number: sourceNums[0] }, { number: sourceNums[0] - 1 }, { number: sourceNums[0] + 1 }];

  // 桥接/等差
  const bridgeMap = buildV4BridgeMap(sourceNums, sourceNums);
  const arithMap = buildV4ArithmeticMap(sourceNums, 17, sourceNums);
  const plusTenTrend = buildV4PlusTenTrendMap(sourceRow, sourceNums, allDraws);
  const historyMetrics = calcHistoryMetrics(allDraws, sourceRow);

  // 候选池：对1-35逐一评分
  const candidates = [];
  for (let n = 1; n <= 35; n++) {
    const s = scoreSingleNumber(n, sourceNums, sourceTails, predictedTails, bridgeMap, arithMap,
      plusTenTrend, hotness, ivPrediction, sourceIv, sourceOdd, targetOdd,
      sourceSum, targetSum, historyMetrics);
    candidates.push({
      number: n,
      score: s,
      hot: hotness.get(n) || 0,
      freqScore: (historyMetrics.historyFreq[n] || 0) / Math.max(0.001, historyMetrics.avgHistoryFreq) * 10
        + (historyMetrics.recentFreq[n] || 0) / Math.max(0.001, historyMetrics.avgRecentFreq) * 8,
      bridgeScore: bridgeMap.gapMap.get(n)?.score || 0 + bridgeMap.endpointMap.get(n)?.score || 0,
      arithScore: arithMap.get(n)?.score || 0,
    });
  }
  candidates.sort((a, b) => b.score - a.score);

  // V5 6维度组合生成
  const allCombos = buildSampleFrontCombosV5(candidates, sourceNums, predictedTails, ivPrediction, firstBallPreds);

  // Top5
  const top5 = allCombos.slice(0, 5);

  // 补漏6
  const bl6 = generate补漏6(allCombos, sourceNums, predictedTails, firstBallPreds, candidates);

  // ============ 计算指标 ============
  // 候选号码池覆盖（Top30个号码）
  const pool30 = new Set(candidates.slice(0, 30).map(c => c.number));
  const poolCoverage = targetNums.filter(n => pool30.has(n)).length;

  // Top5 每注命中
  const top5Hits = top5.map(c => c.numbers.filter(n => targetSet.has(n)).length);

  // Top5联合覆盖
  const top5Union = new Set();
  top5.forEach(c => c.numbers.forEach(n => top5Union.add(n)));
  const top5UnionCoverage = targetNums.filter(n => top5Union.has(n)).length;

  // 补漏6命中
  let bl6Hits = 0, bl6UnionCoverage = 0;
  if (bl6) {
    bl6Hits = bl6.numbers.filter(n => targetSet.has(n)).length;
    // Top5+补漏6联合覆盖
    const allUnion = new Set(top5Union);
    bl6.numbers.forEach(n => allUnion.add(n));
    bl6UnionCoverage = targetNums.filter(n => allUnion.has(n)).length;
  }

  // Top5 每注详细信息（含号码 + 命中号码）
  const top5Details = top5.map((c, idx) => {
    const hitNums = c.numbers.filter(n => targetSet.has(n));
    return { numbers: c.numbers, hitCount: hitNums.length, hitNumbers: hitNums };
  });
  // 补漏6 详细信息
  let bl6Detail = null;
  if (bl6) {
    const hitNums = bl6.numbers.filter(n => targetSet.has(n));
    bl6Detail = { numbers: bl6.numbers, hitCount: hitNums.length, hitNumbers: hitNums };
  }
  // 候选池号码列表
  const pool30Nums = candidates.slice(0, 30).map(c => c.number);
  const poolHitNums = targetNums.filter(n => pool30.has(n));

  return {
    sourceIssue: sourceDraw.issue,
    targetIssue: targetDraw.issue,
    sourceNums,
    targetNums,
    top5Hits,
    top5UnionCoverage,
    bl6Hits,
    bl6UnionCoverage,
    poolCoverage,
    poolSize: pool30.size,
    totalCombos: allCombos.length,
    top5Details,
    bl6Detail,
    pool30Nums,
    poolHitNums,
  };
}

// ======================== 16. 主运行 ========================
console.log('='.repeat(90));
console.log('独立回测 — V5 6维度 Top5 + 补漏6 逐期验证');
console.log('='.repeat(90));
console.log(`数据范围: ${DRAWS[0]?.issue} ~ ${DRAWS[DRAWS.length - 1]?.issue} (共${DRAWS.length}期)`);
console.log(`可验证期数: ${DRAWS.length - 1}期 (第1期作为源，第2期作为目标)`);
console.log('');

const results = [];
for (let i = 0; i < DRAWS.length - 1; i++) {
  const r = backtestSingleIssue(i, DRAWS);
  if (r) results.push(r);
}

// ======================== 17. 逐期详细输出 ========================
function fmtNums(nums, hitSet) {
  return nums.map(n => hitSet.has(n) ? `[${n}]` : ` ${n} `).join(',');
}

let sumTop5Max = 0, sumTop5Union = 0, sumBl6Hits = 0, sumUnion = 0, sumPool = 0;
let cnt = 0;

results.forEach(r => {
  cnt++;
  const targetSet = new Set(r.targetNums);
  const maxTop5Hit = Math.max(...r.top5Hits);
  sumTop5Max += maxTop5Hit;
  sumTop5Union += r.top5UnionCoverage;
  sumBl6Hits += r.bl6Hits;
  sumUnion += r.bl6UnionCoverage;
  sumPool += r.poolCoverage;

  console.log('─'.repeat(80));
  console.log(`第 ${cnt} 期验证  源期: ${r.sourceIssue} → 目标期: ${r.targetIssue}`);
  console.log(`  目的号码(下期开奖): [${r.targetNums.join(', ')}]`);
  console.log('');

  // 指标1: Top5 每注命中
  console.log('  【指标1】Top5 每注命中目的号码:');
  r.top5Details.forEach((t, idx) => {
    const mark = t.numbers.map(n => t.hitNumbers.includes(n) ? `*${n}*` : String(n).padStart(2)).join(', ');
    console.log(`    Top${idx + 1}: [${mark}] → 命中 ${t.hitCount} 个`);
  });

  // 补漏6 命中
  if (r.bl6Detail) {
    const mark = r.bl6Detail.numbers.map(n => r.bl6Detail.hitNumbers.includes(n) ? `*${n}*` : String(n).padStart(2)).join(', ');
    console.log(`    补漏6: [${mark}] → 命中 ${r.bl6Detail.hitCount} 个`);
  }
  console.log('');

  // 指标2: 联合覆盖
  console.log('  【指标2】Top5 与补漏6 联合覆盖:');
  console.log(`    Top5 联合覆盖:       ${r.top5UnionCoverage} / 5`);
  if (r.bl6Detail) {
    console.log(`    Top5+补漏6 联合覆盖: ${r.bl6UnionCoverage} / 5`);
    const allUnion = new Set();
    r.top5Details.forEach(t => t.numbers.forEach(n => allUnion.add(n)));
    r.bl6Detail.numbers.forEach(n => allUnion.add(n));
    const unionHit = r.targetNums.filter(n => allUnion.has(n));
    if (unionHit.length > 0) console.log(`    覆盖到的目的号码: [${unionHit.join(', ')}]`);
  }
  console.log('');

  // 指标3: 候选池覆盖
  console.log('  【指标3】候选号码池覆盖 (Top30):');
  console.log(`    候选池: [${r.pool30Nums.join(', ')}]`);
  console.log(`    覆盖: ${r.poolCoverage} / 5，命中号码: [${r.poolHitNums.join(', ')}]`);
  console.log('');
});

// ======================== 18. 汇总统计 ========================
console.log('═'.repeat(80));
console.log('汇总统计');
console.log('═'.repeat(80));
console.log(`  总验证期数: ${cnt}`);
console.log(`  平均 Top5 最高命中: ${(sumTop5Max / cnt).toFixed(2)} / 5`);
console.log(`  平均 Top5 联合覆盖: ${(sumTop5Union / cnt).toFixed(2)} / 5`);
console.log(`  平均 补漏6 命中: ${(sumBl6Hits / cnt).toFixed(2)} / 5`);
console.log(`  平均 Top5+补漏6 联合覆盖: ${(sumUnion / cnt).toFixed(2)} / 5`);
console.log(`  平均 候选池覆盖 (Top30): ${(sumPool / cnt).toFixed(2)} / 5`);

const top5HitRate = (sumTop5Max / (cnt * 5) * 100).toFixed(1);
const unionRate = (sumUnion / (cnt * 5) * 100).toFixed(1);
const poolRate = (sumPool / (cnt * 5) * 100).toFixed(1);
console.log('');
console.log(`  Top5最高命中率: ${top5HitRate}%`);
console.log(`  Top5+补漏6 联合覆盖率: ${unionRate}%`);
console.log(`  候选池覆盖率 (Top30): ${poolRate}%`);

// 命中分布
const bestDist = {}, unionDist = {};
results.forEach(r => {
  const maxH = Math.max(...r.top5Hits);
  bestDist[maxH] = (bestDist[maxH] || 0) + 1;
  unionDist[r.bl6UnionCoverage] = (unionDist[r.bl6UnionCoverage] || 0) + 1;
});

console.log('');
console.log('  Top5 最高命中分布:');
for (let h = 5; h >= 0; h--) {
  if (bestDist[h]) console.log(`    命中${h}个: ${bestDist[h]}次 (${(bestDist[h] / cnt * 100).toFixed(1)}%)`);
}

console.log('');
console.log('  Top5+补漏6 联合覆盖分布:');
for (let h = 5; h >= 0; h--) {
  if (unionDist[h]) console.log(`    覆盖${h}个: ${unionDist[h]}次 (${(unionDist[h] / cnt * 100).toFixed(1)}%)`);
}

console.log('');
console.log('完成!');
