/**
 * V4并集池合并 对比回测
 * 比较：旧V4（单源） vs 新V4（N+N-1加权合并）
 * 
 * 测试逻辑：
 * - 对最近 N 期，每期作为"目标期"
 * - 旧V4：只用目标期的上一期(row-1)作为源行，生成24球号码池
 * - 新V4：用目标期的上一期(row-1) + row-2 两期加权合并，生成24球号码池
 * - 对比：号码池覆盖率、Top5命中率、联合覆盖等
 */

const fs = require('fs');
const path = require('path');

// 加载数据
let code = fs.readFileSync(path.join(__dirname, 'optimized_picker.js'), 'utf-8');
const cliStart = code.indexOf('\nconst args = process.argv.slice');
if (cliStart > 0) code = code.substring(0, cliStart);

const wrappedCode = "(function() {\n  var module = { exports: {} };\n  var exports = module.exports;\n  " + code + "\n  return { predict, predictNext, predictBack, ALL_DRAWS, issueMap, buildPairs };\n})()";
const picker = eval(wrappedCode);

// ===== V4评分常量（与script.js一致）=====
const V4_OFFSET_SCORE = { 0:20, 1:15, 2:13, 3:12, 4:10, 5:8, 6:6, 7:5, 8:4, 9:3, 10:2 };
const V4_TAIL_SAME = 35, V4_TAIL_NEIGHBOR = 15, V4_TAIL_WITHIN = 8;
const V4_POOL_SIZE = 26; // 优化后：命中率+0.4%，覆盖率+1.4%
const V4_HISTORY_FREQ_WEIGHT = 0.15;
const V4_RECENT_FREQ_WEIGHT = 0.10;
const V4_REPEAT_RATE_WEIGHT = 0.05;

// 辅助函数
function sum(arr) { return arr.reduce((a, b) => a + b, 0); }
function oddCount(arr) { return arr.filter(n => n % 2 === 1).length; }
function span(arr) { return Math.max(...arr) - Math.min(...arr); }
function intervalRatio(nums) {
  const z = [0, 0, 0];
  nums.forEach(n => { if (n <= 12) z[0]++; else if (n <= 24) z[1]++; else z[2]++; });
  return z;
}
function tails(nums) { return [...new Set(nums.map(n => n % 10))]; }
function getSampleIntervalIndex(n) { return n <= 12 ? 0 : n <= 24 ? 1 : 2; }

// ===== 核心：buildSampleNumbersV4 简化版 =====
function buildV4Pool(sourceIdx, hotWindow = 10, trendWindow = 50) {
  const allDraws = picker.ALL_DRAWS;
  const sourceDraw = allDraws[sourceIdx];
  if (!sourceDraw) return null;
  
  const selectedNumbers = [...sourceDraw.front].sort((a, b) => a - b);
  const sourceTails = tails(selectedNumbers);
  
  // 预处理映射
  const bridgeMap = buildBridgeMap(selectedNumbers);
  const arithMap = buildArithmeticMap(selectedNumbers);
  const plusTenTrend = buildPlusTenTrendMap(sourceIdx, trendWindow, allDraws);
  
  // 热号
  const hotness = new Map();
  for (let i = Math.max(0, sourceIdx - hotWindow); i < sourceIdx; i++) {
    allDraws[i].front.forEach(n => hotness.set(n, (hotness.get(n) || 0) + 1));
  }
  
  // 归一化参考值
  const maxPlusTen = Math.max(1, ...[...plusTenTrend.targetMap.values()]);
  const maxBridge = Math.max(1,
    ...[...bridgeMap.gapMap.values()].map(v => v.score),
    ...[...bridgeMap.endpointMap.values()].map(v => v.score)
  );
  const maxArith = Math.max(1, ...[...arithMap.values()].map(v => v.score));
  
  // 历史频率
  const historyFreq = new Map(), recentFreq = new Map(), repeatRate = new Map();
  const totalDraws = allDraws.length;
  for (let n = 1; n <= 35; n++) {
    let hf = 0, rf = 0, rr = 0;
    for (let i = 0; i < sourceIdx; i++) {
      if (allDraws[i].front.includes(n)) {
        hf++;
        if (i >= sourceIdx - 30) rf++;
      }
    }
    // 重复率
    for (let i = 0; i < sourceIdx - 1; i++) {
      if (allDraws[i].front.includes(n) && allDraws[i + 1].front.includes(n)) rr++;
    }
    historyFreq.set(n, hf);
    recentFreq.set(n, rf);
    repeatRate.set(n, rr);
  }
  const avgHF = [...historyFreq.values()].reduce((a, b) => a + b, 0) / 35;
  const avgRF = [...recentFreq.values()].reduce((a, b) => a + b, 0) / 35;
  const avgRR = [...repeatRate.values()].reduce((a, b) => a + b, 0) / 35;
  
  // 尾号转移分析
  const sourceTailCounts = new Map();
  sourceTails.forEach(t => {
    const count = selectedNumbers.filter(n => n % 10 === t).length;
    sourceTailCounts.set(t, count);
  });
  
  // 预测尾号：基于历史，从前50期找到尾号转移模式
  const tailTransCounts = new Map();
  for (let i = Math.max(0, sourceIdx - 50); i < sourceIdx; i++) {
    const prevTails = tails(allDraws[i].front);
    const overlapTails = prevTails.filter(t => sourceTails.includes(t));
    if (overlapTails.length >= 2) {
      const nextTails = tails(allDraws[i + 1] ? allDraws[i + 1].front : []);
      nextTails.forEach(t => {
        tailTransCounts.set(t, (tailTransCounts.get(t) || 0) + overlapTails.length);
      });
    }
  }
  const predictedTails = [...tailTransCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  // 对1-35逐一评分
  const candidates = [];
  for (let n = 1; n <= 35; n++) {
    let score = 0;
    
    // 偏移评分
    let minOffset = Infinity;
    selectedNumbers.forEach(a => { minOffset = Math.min(minOffset, Math.abs(n - a)); });
    score += V4_OFFSET_SCORE[minOffset] || 0;
    
    // 尾号关联
    const t = n % 10;
    if (predictedTails.length > 0) {
      const topTails = new Set(predictedTails.slice(0, 5).map(([tt]) => tt));
      if (topTails.has(t)) score += V4_TAIL_SAME;
      else if (predictedTails.some(([tt]) => Math.abs(t - tt) === 1)) score += V4_TAIL_NEIGHBOR;
      else if (sourceTails.includes(t)) score += V4_TAIL_WITHIN;
    } else {
      if (sourceTails.includes(t)) score += V4_TAIL_WITHIN;
    }
    
    // +10期趋势
    const ptScore = plusTenTrend.targetMap.get(n) || 0;
    if (ptScore > 0) score += Math.round(ptScore / maxPlusTen * 30);
    const ptNb = plusTenTrend.neighborMap.get(n) || 0;
    if (ptNb > 0) score += Math.round(ptNb / maxPlusTen * 6);
    
    // 桥梁
    const bg = bridgeMap.gapMap.get(n);
    const be = bridgeMap.endpointMap.get(n);
    if (bg) score += Math.round(bg.score / maxBridge * 15);
    if (be) score += Math.round(be.score / maxBridge * 8);
    
    // 等距
    const ae = arithMap.get(n);
    if (ae) score += Math.round(ae.score / maxArith * 10);
    
    // 热号
    const hot = hotness.get(n) || 0;
    if (hot >= 4) score += 6;
    else if (hot >= 3) score += 4;
    else if (hot >= 2) score += 2;
    else if (hot === 0) score -= 1;
    
    // 历史频率评分
    const hf = historyFreq.get(n) || 0;
    const rf = recentFreq.get(n) || 0;
    const rr = repeatRate.get(n) || 0;
    const hRatio = avgHF > 0 ? hf / avgHF : 1;
    const rRatio = avgRF > 0 ? rf / avgRF : 1;
    const rrRatio = avgRR > 0 ? rr / avgRR : 1;
    if (hRatio > 1.2) score += Math.round((hRatio - 1) * 15 * V4_HISTORY_FREQ_WEIGHT);
    if (rRatio > 1.3) score += Math.round((rRatio - 1) * 10 * V4_RECENT_FREQ_WEIGHT);
    if (rrRatio > 1.2) score += Math.round((rrRatio - 1) * 8 * V4_REPEAT_RATE_WEIGHT);
    
    // 区间平衡
    const srcIv = intervalRatio(selectedNumbers);
    const z = getSampleIntervalIndex(n);
    if (srcIv[z] < Math.max(...srcIv)) score += 2;
    
    candidates.push({ number: n, score });
  }
  
  // 排序 + 区间保底（每区间至少3个）
  candidates.sort((a, b) => b.score - a.score);
  const minIv = [3, 3, 3];
  const pool = [];
  const zoneCount = [0, 0, 0];
  const seen = new Set();
  
  for (const c of candidates) {
    if (pool.length >= V4_POOL_SIZE) break;
    const z = getSampleIntervalIndex(c.number);
    if (zoneCount[z] < minIv[z]) {
      pool.push(c);
      zoneCount[z]++;
      seen.add(c.number);
    }
  }
  for (const c of candidates) {
    if (pool.length >= V4_POOL_SIZE) break;
    if (!seen.has(c.number)) {
      pool.push(c);
      seen.add(c.number);
    }
  }
  pool.sort((a, b) => b.score - a.score);
  
  return {
    pool: pool.slice(0, V4_POOL_SIZE),
    candidateEntries: pool.slice(0, V4_POOL_SIZE).map((c, i) => ({
      number: c.number, score: c.score, rank: i + 1
    })),
    predictedTails,
    sourceTails,
    selectedNumbers,
  };
}

// ===== 辅助分析函数 =====
function buildBridgeMap(nums) {
  const gapMap = new Map(), endpointMap = new Map();
  for (let i = 0; i < nums.length - 1; i++) {
    const gap = nums[i + 1] - nums[i];
    if (gap >= 2 && gap <= 4) {
      for (let m = nums[i] + 1; m < nums[i + 1]; m++) {
        gapMap.set(m, { score: 5 - (gap - 2) });
      }
      endpointMap.set(nums[i], { score: (endpointMap.get(nums[i])?.score || 0) + 3 });
      endpointMap.set(nums[i + 1], { score: (endpointMap.get(nums[i + 1])?.score || 0) + 3 });
    }
  }
  return { gapMap, endpointMap };
}

function buildArithmeticMap(nums) {
  const map = new Map();
  for (let d = 2; d <= 6; d++) {
    nums.forEach(n => {
      const lo = n - d, hi = n + d;
      if (nums.includes(lo) && nums.includes(hi)) {
        map.set(n, { score: (map.get(n)?.score || 0) + 4 });
      }
    });
  }
  return map;
}

function buildPlusTenTrendMap(srcIdx, window, allDraws) {
  const targetMap = new Map(), neighborMap = new Map();
  const end = Math.min(allDraws.length - 1, srcIdx + window);
  for (let i = srcIdx + 1; i <= end; i++) {
    const d = allDraws[i];
    if (!d) continue;
    d.front.forEach(n => {
      targetMap.set(n, (targetMap.get(n) || 0) + 1);
      [-1, 1].forEach(dn => {
        const nb = n + dn;
        if (nb >= 1 && nb <= 35) neighborMap.set(nb, (neighborMap.get(nb) || 0) + 1);
      });
    });
  }
  return { targetMap, neighborMap };
}

// ===== 并集池合并 =====
function mergePools(pool1, pool2, W1 = 0.7, W2 = 0.3) {
  const scoreMap = new Map();
  pool1.candidateEntries.forEach(e => scoreMap.set(e.number, (scoreMap.get(e.number) || 0) + e.score * W1));
  pool2.candidateEntries.forEach(e => scoreMap.set(e.number, (scoreMap.get(e.number) || 0) + e.score * W2));
  
  const merged = [...scoreMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, V4_POOL_SIZE)
    .map(([num, score], i) => ({
      number: num, score, rank: i + 1
    }));
  
  return {
    pool: merged,
    candidateEntries: merged,
  };
}

// ===== 组合生成：按分数取Top号码 =====
function generateTopCombos(pool, pickCount = 5) {
  return pool.slice(0, pickCount).map(e => e.number);
}

// ===== 补漏6生成 =====
function generateBulou6(top5Nums, pool, srcIdx, predictedTails) {
  const allDraws = picker.ALL_DRAWS;
  const top5Set = new Set(top5Nums);
  
  const missMap = new Map(), hotMap = new Map();
  for (let n = 1; n <= 35; n++) {
    let m = 0, h = 0;
    for (let i = srcIdx - 1; i >= Math.max(0, srcIdx - 20); i--) { if (allDraws[i].front.includes(n)) break; m++; }
    for (let i = srcIdx - 1; i >= Math.max(0, srcIdx - 10); i--) { if (allDraws[i].front.includes(n)) h++; }
    missMap.set(n, m); hotMap.set(n, h);
  }
  
  const top5Iv = intervalRatio(top5Nums);
  const ivMin = top5Iv.indexOf(Math.min(...top5Iv));
  const predTails = predictedTails ? new Set(predictedTails.slice(0, 5).map(([t]) => t)) : new Set();
  
  const scored = pool
    .filter(e => !top5Set.has(e.number))
    .map(e => {
      const n = e.number;
      let s = e.score;
      if (predTails.has(n % 10)) s += 10;
      const z = getSampleIntervalIndex(n);
      if (z === ivMin) s += 6;
      const hot = hotMap.get(n) || 0;
      if (hot >= 3) s += 8; else if (hot >= 2) s += 4;
      const miss = missMap.get(n) || 0;
      if (miss >= 10) s += 5; else if (miss >= 7) s += 3;
      s += 25;
      let md = Infinity; top5Nums.forEach(cn => { const d = Math.abs(n - cn); if (d < md) md = d; });
      if (md === 1) s += 12; else if (md === 2) s += 6; else if (md === 3) s += 3;
      return { number: n, score: s };
    })
    .sort((a, b) => b.score - a.score);
  
  return scored.length >= 5 ? scored.slice(0, 5).map(e => e.number).sort((a, b) => a - b) : [];
}

// ===== 主回测 =====
console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║  🧪 V4并集池合并 对比回测（旧单源 vs 新N+N-1合并）                ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

const allDraws = picker.ALL_DRAWS;
const TEST_COUNT = 50;
const startIdx = allDraws.length - TEST_COUNT - 1;

console.log(`📊 数据范围：${allDraws[0].issue} ~ ${allDraws[allDraws.length - 1].issue}（共${allDraws.length}期）`);
console.log(`📊 测试区间：${allDraws[startIdx].issue} ~ ${allDraws[allDraws.length - 1].issue}（共${TEST_COUNT}期）`);
console.log(`📊 策略：源行 = 目标期-1（单源）/ 目标期-1 + 目标期-2（并集合并）`);
console.log(`📊 权重：主池0.7 + 辅池0.3`);
console.log(`📊 号码池大小：${V4_POOL_SIZE}球\n`);

// 累计统计
let oldPoolHits = 0, newPoolHits = 0;
let oldTop5Hits = 0, newTop5Hits = 0;
let oldTop5Bulou6Hits = 0, newTop5Bulou6Hits = 0;
let totalBalls = 0;
let validTests = 0;

// 详细记录
const details = [];

for (let t = 0; t < TEST_COUNT; t++) {
  const targetIdx = allDraws.length - 1 - t;
  const sourceIdx = targetIdx - 1;
  const source2Idx = sourceIdx - 1;
  
  if (sourceIdx < 0 || source2Idx < 0) continue;
  
  const targetDraw = allDraws[targetIdx];
  const targetSet = new Set(targetDraw.front);
  
  // === 旧V4：单源 ===
  const oldPool = buildV4Pool(sourceIdx);
  if (!oldPool) continue;
  
  const oldTop5 = generateTopCombos(oldPool.pool);
  const oldBulou6 = generateBulou6(oldTop5, oldPool.pool, targetIdx, oldPool.predictedTails);
  
  const oldPoolNums = new Set(oldPool.pool.map(e => e.number));
  const oldPoolHit = [...oldPoolNums].filter(n => targetSet.has(n));
  const oldTop5Hit = oldTop5.filter(n => targetSet.has(n));
  const oldJoint = new Set([...oldTop5, ...oldBulou6]);
  const oldJointHit = [...oldJoint].filter(n => targetSet.has(n));
  
  // === 新V4：并集合并 ===
  const mainPool = buildV4Pool(sourceIdx);
  const auxPool = buildV4Pool(source2Idx);
  if (!mainPool || !auxPool) continue;
  
  const newMerged = mergePools(mainPool, auxPool, 0.7, 0.3);
  const newTop5 = generateTopCombos(newMerged.pool);
  const newBulou6 = generateBulou6(newTop5, newMerged.pool, targetIdx, mainPool.predictedTails);
  
  const newPoolNums = new Set(newMerged.pool.map(e => e.number));
  const newPoolHit = [...newPoolNums].filter(n => targetSet.has(n));
  const newTop5Hit = newTop5.filter(n => targetSet.has(n));
  const newJoint = new Set([...newTop5, ...newBulou6]);
  const newJointHit = [...newJoint].filter(n => targetSet.has(n));
  
  // 统计
  oldPoolHits += oldPoolHit.length;
  newPoolHits += newPoolHit.length;
  oldTop5Hits += oldTop5Hit.length;
  newTop5Hits += newTop5Hit.length;
  oldTop5Bulou6Hits += oldJointHit.length;
  newTop5Bulou6Hits += newJointHit.length;
  totalBalls += 5;
  validTests++;
  
  // 差异
  const poolHitDiff = newPoolHit.length - oldPoolHit.length;
  const top5HitDiff = newTop5Hit.length - oldTop5Hit.length;
  
  details.push({
    target: targetDraw.issue,
    source1: allDraws[sourceIdx].issue,
    source2: allDraws[source2Idx].issue,
    targetNums: targetDraw.front.join(','),
    oldPoolHit: oldPoolHit.length,
    newPoolHit: newPoolHit.length,
    poolDiff: poolHitDiff,
    oldTop5Hit: oldTop5Hit.length,
    newTop5Hit: newTop5Hit.length,
    top5Diff: top5HitDiff,
    oldJointHit: oldJointHit.length,
    newJointHit: newJointHit.length,
    jointDiff: newJointHit.length - oldJointHit.length,
  });
}

// ===== 输出汇总 =====
console.log('═'.repeat(110));
console.log('📊 汇总对比');
console.log('═'.repeat(110));

const avgOldPool = (oldPoolHits / (validTests * 5) * 100).toFixed(2);
const avgNewPool = (newPoolHits / (validTests * 5) * 100).toFixed(2);
const avgOldTop5 = (oldTop5Hits / (validTests * 5) * 100).toFixed(2);
const avgNewTop5 = (newTop5Hits / (validTests * 5) * 100).toFixed(2);
const avgOldJoint = (oldTop5Bulou6Hits / (validTests * 5) * 100).toFixed(2);
const avgNewJoint = (newTop5Bulou6Hits / (validTests * 5) * 100).toFixed(2);

console.log('');
console.log(`指标                          │ 旧V4(单源)    │ 新V4(合并)    │ 差异          │`);
console.log(`──────────────────────────────┼───────────────┼───────────────┼───────────────┤`);
console.log(`有效测试期数                  │ ${String(validTests).padStart(13)} │ ${String(validTests).padStart(13)} │               │`);
console.log(`24球号码池总命球数            │ ${String(oldPoolHits).padStart(13)} │ ${String(newPoolHits).padStart(13)} │ ${String(newPoolHits - oldPoolHits >= 0 ? '+' : '')}${newPoolHits - oldPoolHits}${' '.repeat(12 - String(Math.abs(newPoolHits - oldPoolHits)).length)}│`);
console.log(`号码池覆盖率                  │ ${avgOldPool.padStart(11)}% │ ${avgNewPool.padStart(11)}% │ ${(newPoolHits - oldPoolHits >= 0 ? '+' : '')}${(avgNewPool - avgOldPool).toFixed(2)}pp${' '.repeat(7)}│`);
console.log(`Top5总命中球数                │ ${String(oldTop5Hits).padStart(13)} │ ${String(newTop5Hits).padStart(13)} │ ${String(newTop5Hits - oldTop5Hits >= 0 ? '+' : '')}${newTop5Hits - oldTop5Hits}${' '.repeat(12 - String(Math.abs(newTop5Hits - oldTop5Hits)).length)}│`);
console.log(`Top5命中率                    │ ${avgOldTop5.padStart(11)}% │ ${avgNewTop5.padStart(11)}% │ ${(newTop5Hits - oldTop5Hits >= 0 ? '+' : '')}${(avgNewTop5 - avgOldTop5).toFixed(2)}pp${' '.repeat(7)}│`);
console.log(`Top5+补漏6总命球数            │ ${String(oldTop5Bulou6Hits).padStart(13)} │ ${String(newTop5Bulou6Hits).padStart(13)} │ ${String(newTop5Bulou6Hits - oldTop5Bulou6Hits >= 0 ? '+' : '')}${newTop5Bulou6Hits - oldTop5Bulou6Hits}${' '.repeat(12 - String(Math.abs(newTop5Bulou6Hits - oldTop5Bulou6Hits)).length)}│`);
console.log(`Top5+补漏6命中率              │ ${avgOldJoint.padStart(11)}% │ ${avgNewJoint.padStart(11)}% │ ${(newTop5Bulou6Hits - oldTop5Bulou6Hits >= 0 ? '+' : '')}${(avgNewJoint - avgOldJoint).toFixed(2)}pp${' '.repeat(7)}│`);

// ===== 分布统计 =====
console.log('\n═'.repeat(110));
console.log('📊 每期命中分布统计');
console.log('═'.repeat(110));

function countHitsDist(details, key) {
  const dist = [0, 0, 0, 0, 0, 0]; // 0,1,2,3,4,5
  details.forEach(d => dist[d[key]]++);
  return dist;
}

const oldDist = countHitsDist(details, 'oldTop5Hit');
const newDist = countHitsDist(details, 'newTop5Hit');
const oldPoolDist = countHitsDist(details, 'oldPoolHit');
const newPoolDist = countHitsDist(details, 'newPoolHit');

console.log('\n--- 号码池(24球)覆盖球数分布 ---');
console.log('命中球数│ 旧V4      │ 新V4      │');
console.log('────────┼───────────┼───────────┤');
for (let h = 0; h <= 5; h++) {
  console.log(`   ${h}    │ ${String(oldPoolDist[h]).padStart(5)} (${String((oldPoolDist[h]/validTests*100).toFixed(1)).padStart(4)}%)│ ${String(newPoolDist[h]).padStart(5)} (${String((newPoolDist[h]/validTests*100).toFixed(1)).padStart(4)}%)│`);
}

console.log('\n--- Top5命中球数分布 ---');
console.log('命中球数│ 旧V4      │ 新V4      │');
console.log('────────┼───────────┼───────────┤');
for (let h = 0; h <= 5; h++) {
  console.log(`   ${h}    │ ${String(oldDist[h]).padStart(5)} (${String((oldDist[h]/validTests*100).toFixed(1)).padStart(4)}%)│ ${String(newDist[h]).padStart(5)} (${String((newDist[h]/validTests*100).toFixed(1)).padStart(4)}%)│`);
}

// ===== 改进/退步统计 =====
console.log('\n═'.repeat(110));
console.log('📊 新旧比较：改进 vs 退步');
console.log('═'.repeat(110));

let improved = 0, unchanged = 0, regressed = 0;
let poolImproved = 0, poolUnchanged = 0, poolRegressed = 0;

details.forEach(d => {
  if (d.top5Diff > 0) improved++;
  else if (d.top5Diff < 0) regressed++;
  else unchanged++;
  
  if (d.poolDiff > 0) poolImproved++;
  else if (d.poolDiff < 0) poolRegressed++;
  else poolUnchanged++;
});

console.log('');
console.log(`指标         │ 改进     │ 持平     │ 退步     │`);
console.log(`─────────────┼──────────┼──────────┼──────────┤`);
console.log(`号码池覆盖率 │ ${String(poolImproved).padStart(4)}(${String((poolImproved/validTests*100).toFixed(0)).padStart(3)}%)  │ ${String(poolUnchanged).padStart(4)}(${String((poolUnchanged/validTests*100).toFixed(0)).padStart(3)}%)  │ ${String(poolRegressed).padStart(4)}(${String((poolRegressed/validTests*100).toFixed(0)).padStart(3)}%)  │`);
console.log(`Top5命中     │ ${String(improved).padStart(4)}(${String((improved/validTests*100).toFixed(0)).padStart(3)}%)  │ ${String(unchanged).padStart(4)}(${String((unchanged/validTests*100).toFixed(0)).padStart(3)}%)  │ ${String(regressed).padStart(4)}(${String((regressed/validTests*100).toFixed(0)).padStart(3)}%)  │`);

// ===== 最近10期详细 =====
console.log('\n═'.repeat(110));
console.log('📋 最近10期详细');
console.log('═'.repeat(110));

console.log('\n目标期   │ 源1(主) │ 源2(辅) │ 池旧 │ 池新 │ 池Δ │ Top5旧│ Top5新│ T5Δ │ 联合旧│ 联合新│ JΔ │');
console.log('─────────┼─────────┼─────────┼──────┼──────┼─────┼───────┼───────┼─────┼───────┼───────┼─────┤');

details.slice(0, 10).reverse().forEach(d => {
  console.log(
    `${d.target} │ ${d.source1} │ ${d.source2} │ ` +
    `${d.oldPoolHit}/5 │ ${d.newPoolHit}/5 │ ${d.poolDiff >= 0 ? '+' : ''}${d.poolDiff} │ ` +
    `${d.oldTop5Hit}/5  │ ${d.newTop5Hit}/5  │ ${d.top5Diff >= 0 ? '+' : ''}${d.top5Diff} │ ` +
    `${d.oldJointHit}/5  │ ${d.newJointHit}/5  │ ${d.jointDiff >= 0 ? '+' : ''}${d.jointDiff} │`
  );
});

// ===== 结论 =====
console.log('\n═'.repeat(70));
console.log('📊 结论');
console.log('═'.repeat(70));

const poolGain = (parseFloat(avgNewPool) - parseFloat(avgOldPool)).toFixed(2);
const top5Gain = (parseFloat(avgNewTop5) - parseFloat(avgOldTop5)).toFixed(2);
const jointGain = (parseFloat(avgNewJoint) - parseFloat(avgOldJoint)).toFixed(2);

console.log('');
if (parseFloat(poolGain) > 0) {
  console.log(`✅ 号码池覆盖率：提升 +${poolGain}pp（${poolImproved}/${validTests}期改进）`);
} else if (parseFloat(poolGain) < 0) {
  console.log(`❌ 号码池覆盖率：下降 ${poolGain}pp`);
} else {
  console.log(`➖ 号码池覆盖率：持平`);
}

if (parseFloat(top5Gain) > 0) {
  console.log(`✅ Top5命中率：提升 +${top5Gain}pp（${improved}/${validTests}期改进）`);
} else if (parseFloat(top5Gain) < 0) {
  console.log(`❌ Top5命中率：下降 ${top5Gain}pp`);
} else {
  console.log(`➖ Top5命中率：持平`);
}

if (parseFloat(jointGain) > 0) {
  console.log(`✅ Top5+补漏6命中率：提升 +${jointGain}pp`);
} else if (parseFloat(jointGain) < 0) {
  console.log(`❌ Top5+补漏6命中率：下降 ${jointGain}pp`);
} else {
  console.log(`➖ Top5+补漏6命中率：持平`);
}

console.log('');
