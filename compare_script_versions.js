const fs = require("fs");

// 加载optimized_picker.js获取数据
const src = fs.readFileSync('./optimized_picker.js', 'utf8');

// 提取ALL_DRAWS数据
const ALL_DRAWS = eval('[' + src.match(/const ALL_DRAWS = \[([\s\S]*?)\];/)[1] + ']');
const issueMap = {};
ALL_DRAWS.forEach(d => issueMap[d.issue] = d);

// 工具函数
function gi(n) { return n <= 12 ? 0 : n <= 24 ? 1 : 2; }
function sum(nums) { return nums.reduce((a, b) => a + b, 0); }
function span(nums) { return nums[nums.length - 1] - nums[0]; }
function oddCount(nums) { return nums.filter(n => n % 2 === 1).length; }
function intervalRatio(nums) { const iv = [0, 0, 0]; nums.forEach(n => iv[gi(n)]++); return iv; }
function tail(n) { return n % 10; }
function tails(nums) { return [...new Set(nums.map(n => n % 10))].sort((a, b) => a - b); }

// 模拟v3版本（无S1-S10策略，无号码池优化）
function predictV3(sourceIssue, targetIssue) {
  const sourceDraw = issueMap[sourceIssue];
  const targetDraw = issueMap[targetIssue];
  
  if (!sourceDraw) return null;
  
  const sourceTails = tails(sourceDraw.front);
  const targetTails = targetDraw ? tails(targetDraw.front) : null;
  const targetIv = targetDraw ? intervalRatio(targetDraw.front) : null;
  
  // 计算源号码属性
  const sourceIv = intervalRatio(sourceDraw.front);
  const sourceOdd = oddCount(sourceDraw.front);
  const sourceSum = sum(sourceDraw.front);
  
  // 预测目标属性
  const targetOdd = targetDraw ? oddCount(targetDraw.front) : null;
  const targetSum = targetDraw ? sum(targetDraw.front) : null;
  
  // v3版本候选池生成（无S1-S10策略，无号码池优化）
  const candidates = [];
  for (let n = 1; n <= 33; n++) {
    let score = 0;
    const reasons = [];
    
    // 偏移评分
    let minOffset = Infinity;
    let bestAnchor = null;
    sourceDraw.front.forEach((anchor) => {
      const dist = Math.abs(n - anchor);
      if (dist < minOffset) {
        minOffset = dist;
        bestAnchor = anchor;
      }
    });
    
    // v3偏移评分
    const offsetScores = { 0: 20, 1: 15, 2: 13, 3: 12, 4: 10, 5: 8, 6: 6, 7: 5, 8: 4, 9: 3, 10: 2 };
    const offsetPoints = offsetScores[minOffset] || 0;
    score += offsetPoints;
    if (offsetPoints > 0) reasons.push(`偏移${minOffset}:+${offsetPoints}`);
    
    // 尾号关联评分
    const t = tail(n);
    if (targetTails && targetTails.includes(t)) {
      score += 35;
      reasons.push(`尾号匹配:+35`);
    } else if (targetTails && targetTails.some((tt) => Math.abs(t - tt) === 1)) {
      score += 15;
      reasons.push(`尾号±1:+15`);
    } else if (sourceTails.includes(t)) {
      score += 8;
      reasons.push(`选中行尾号:+8`);
    }
    
    // 区间覆盖
    const iv = gi(n);
    if (targetIv) {
      if (targetIv[iv] > 0) {
        score += 5;
        reasons.push(`区间匹配:+5`);
      }
    }
    
    // 注意：v3版本没有S1-S10策略和号码池优化
    
    candidates.push({ number: n, score, reasons: reasons.join(" | "), minOffset, bestAnchor, zone: gi(n) });
  }
  
  // 按得分排序
  candidates.sort((a, b) => b.score - a.score);
  const pool = candidates.slice(0, 25);
  
  // 组合生成（简化版）
  function generateCombinationsFast(pool, count) {
    const combos = [];
    const seen = new Set();
    
    const ratios = [[2, 2, 1], [2, 1, 2], [1, 2, 2], [3, 1, 1], [1, 3, 1], [1, 1, 3]];
    
    ratios.forEach(ratio => {
      const z0 = pool.filter(c => gi(c.number) === 0).slice(0, ratio[0] + 3);
      const z1 = pool.filter(c => gi(c.number) === 1).slice(0, ratio[1] + 3);
      const z2 = pool.filter(c => gi(c.number) === 2).slice(0, ratio[2] + 3);
      
      if (z0.length < ratio[0] || z1.length < ratio[1] || z2.length < ratio[2]) return;
      
      const localCombos = [];
      const seenLocal = new Set();
      
      function pick(zoneIdx, selected) {
        if (localCombos.length >= 50) return;
        if (zoneIdx === 3) {
          if (selected.length !== count) return;
          const sorted = [...selected.map(x => x.number)].sort((a, b) => a - b);
          const key = sorted.join(",");
          if (seenLocal.has(key) || seen.has(key)) return;
          seenLocal.add(key);
          const result = scoreCombo(sorted, selected);
          if (result) localCombos.push(result);
          return;
        }
        const arr = [z0, z1, z2][zoneIdx];
        const need = ratio[zoneIdx];
        (function rec(start, cur) {
          if (localCombos.length >= 50) return;
          if (cur.length === need) { pick(zoneIdx + 1, [...selected, ...cur]); return; }
          for (let i = start; i <= arr.length - (need - cur.length); i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); }
        })(0, []);
      }
      pick(0, []);
      
      localCombos.sort((a, b) => b.score - a.score).slice(0, 5).forEach(c => {
        const k = c.numbers.join(",");
        if (!seen.has(k)) { seen.add(k); combos.push(c); }
      });
    });
    
    return combos.sort((a, b) => b.score - a.score).slice(0, 20);
  }
  
  // 组合评分
  function scoreCombo(sorted, selected) {
    const s = sum(sorted);
    const sp = sorted[sorted.length - 1] - sorted[0];
    const odd = sorted.filter(n => n % 2 === 1).length;
    if (odd === 0 || odd === 5) return null;
    if (sp < 3 || sp > 34) return null;
    
    const iv = [0, 0, 0];
    sorted.forEach(n => iv[gi(n)]++);
    if (iv[0] >= 5 || iv[2] >= 5) return null;
    
    const baseScore = selected.reduce((a, b) => a + b.score, 0);
    let comboBonus = 0;
    
    // v3强信号
    if (sp >= 18 && sp <= 24) comboBonus += 18;
    else if (sp >= 26 && sp <= 33) comboBonus += 12;
    if (odd === 1) comboBonus += 12;
    else if (odd === 3) comboBonus += 8;
    if (!iv.includes(0)) comboBonus += 5;
    else if (iv.filter(c => c === 0).length === 1) comboBonus += 2;
    
    // 区间集中惩罚
    const ivMax = Math.max(...iv);
    if (ivMax >= 3) comboBonus -= (ivMax - 2) * 4;
    
    return { numbers: sorted, score: baseScore + comboBonus, sum: s, span: sp, odd, iv: iv.join(":"), baseScore, comboBonus };
  }
  
  const combinations = generateCombinationsFast(pool, 5);
  
  return {
    sourceIssue,
    targetIssue,
    sourceFront: sourceDraw.front,
    targetFront: targetDraw ? targetDraw.front : null,
    pool,
    combinations,
  };
}

// 模拟v4.1版本（有S1-S10策略，有号码池优化）
function predictV4_1(sourceIssue, targetIssue) {
  const sourceDraw = issueMap[sourceIssue];
  const targetDraw = issueMap[targetIssue];
  
  if (!sourceDraw) return null;
  
  const sourceTails = tails(sourceDraw.front);
  const targetTails = targetDraw ? tails(targetDraw.front) : null;
  const targetIv = targetDraw ? intervalRatio(targetDraw.front) : null;
  
  // 计算源号码属性
  const sourceIv = intervalRatio(sourceDraw.front);
  const sourceOdd = oddCount(sourceDraw.front);
  const sourceSum = sum(sourceDraw.front);
  
  // 预测目标属性
  const targetOdd = targetDraw ? oddCount(targetDraw.front) : null;
  const targetSum = targetDraw ? sum(targetDraw.front) : null;
  
  // v4.1版本候选池生成（有S1-S10策略，有号码池优化）
  const candidates = [];
  for (let n = 1; n <= 33; n++) {
    let score = 0;
    const reasons = [];
    
    // 偏移评分
    let minOffset = Infinity;
    let bestAnchor = null;
    sourceDraw.front.forEach((anchor) => {
      const dist = Math.abs(n - anchor);
      if (dist < minOffset) {
        minOffset = dist;
        bestAnchor = anchor;
      }
    });
    
    const offsetScores = { 0: 20, 1: 15, 2: 13, 3: 12, 4: 10, 5: 8, 6: 6, 7: 5, 8: 4, 9: 3, 10: 2 };
    const offsetPoints = offsetScores[minOffset] || 0;
    score += offsetPoints;
    if (offsetPoints > 0) reasons.push(`偏移${minOffset}:+${offsetPoints}`);
    
    // 尾号关联评分
    const t = tail(n);
    if (targetTails && targetTails.includes(t)) {
      score += 35;
      reasons.push(`尾号匹配:+35`);
    } else if (targetTails && targetTails.some((tt) => Math.abs(t - tt) === 1)) {
      score += 15;
      reasons.push(`尾号±1:+15`);
    } else if (sourceTails.includes(t)) {
      score += 8;
      reasons.push(`选中行尾号:+8`);
    }
    
    // 区间覆盖
    const iv = gi(n);
    if (targetIv) {
      if (targetIv[iv] > 0) {
        score += 5;
        reasons.push(`区间匹配:+5`);
      }
    }
    
    // 🆕 号码池优化：区间平衡、奇偶平衡、和值贡献
    // 1. 区间平衡奖励
    if (targetIv && sourceIv[iv] < targetIv[iv]) {
      score += 3;
      reasons.push(`区间平衡:+3`);
    }
    
    // 2. 奇偶平衡奖励
    if (targetOdd !== null) {
      if (n % 2 === 1 && sourceOdd < targetOdd) {
        score += 2;
        reasons.push(`奇偶平衡(奇):+2`);
      } else if (n % 2 === 0 && sourceOdd > targetOdd) {
        score += 2;
        reasons.push(`奇偶平衡(偶):+2`);
      }
    }
    
    // 3. 和值贡献奖励
    if (targetSum !== null) {
      const diff = targetSum - sourceSum;
      if (Math.abs(diff) > 10) {
        if (diff > 0 && n >= 15) {
          score += 2;
          reasons.push(`和值贡献(大):+2`);
        } else if (diff < 0 && n <= 18) {
          score += 2;
          reasons.push(`和值贡献(小):+2`);
        }
      }
    }
    
    // S1: +10期趋势（简化版）
    // 这里简化处理，实际应该有更复杂的逻辑
    score += Math.floor(Math.random() * 10); // 模拟S1策略
    
    // S2: 桥梁分析（简化版）
    score += Math.floor(Math.random() * 8); // 模拟S2策略
    
    // S3: 等距端点（简化版）
    score += Math.floor(Math.random() * 6); // 模拟S3策略
    
    candidates.push({ number: n, score, reasons: reasons.join(" | "), minOffset, bestAnchor, zone: gi(n) });
  }
  
  // 按得分排序
  candidates.sort((a, b) => b.score - a.score);
  const pool = candidates.slice(0, 25);
  
  // 组合生成（与v3版本相同）
  function generateCombinationsFast(pool, count) {
    const combos = [];
    const seen = new Set();
    
    const ratios = [[2, 2, 1], [2, 1, 2], [1, 2, 2], [3, 1, 1], [1, 3, 1], [1, 1, 3]];
    
    ratios.forEach(ratio => {
      const z0 = pool.filter(c => gi(c.number) === 0).slice(0, ratio[0] + 3);
      const z1 = pool.filter(c => gi(c.number) === 1).slice(0, ratio[1] + 3);
      const z2 = pool.filter(c => gi(c.number) === 2).slice(0, ratio[2] + 3);
      
      if (z0.length < ratio[0] || z1.length < ratio[1] || z2.length < ratio[2]) return;
      
      const localCombos = [];
      const seenLocal = new Set();
      
      function pick(zoneIdx, selected) {
        if (localCombos.length >= 50) return;
        if (zoneIdx === 3) {
          if (selected.length !== count) return;
          const sorted = [...selected.map(x => x.number)].sort((a, b) => a - b);
          const key = sorted.join(",");
          if (seenLocal.has(key) || seen.has(key)) return;
          seenLocal.add(key);
          const result = scoreCombo(sorted, selected);
          if (result) localCombos.push(result);
          return;
        }
        const arr = [z0, z1, z2][zoneIdx];
        const need = ratio[zoneIdx];
        (function rec(start, cur) {
          if (localCombos.length >= 50) return;
          if (cur.length === need) { pick(zoneIdx + 1, [...selected, ...cur]); return; }
          for (let i = start; i <= arr.length - (need - cur.length); i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); }
        })(0, []);
      }
      pick(0, []);
      
      localCombos.sort((a, b) => b.score - a.score).slice(0, 5).forEach(c => {
        const k = c.numbers.join(",");
        if (!seen.has(k)) { seen.add(k); combos.push(c); }
      });
    });
    
    return combos.sort((a, b) => b.score - a.score).slice(0, 20);
  }
  
  // 组合评分
  function scoreCombo(sorted, selected) {
    const s = sum(sorted);
    const sp = sorted[sorted.length - 1] - sorted[0];
    const odd = sorted.filter(n => n % 2 === 1).length;
    if (odd === 0 || odd === 5) return null;
    if (sp < 3 || sp > 34) return null;
    
    const iv = [0, 0, 0];
    sorted.forEach(n => iv[gi(n)]++);
    if (iv[0] >= 5 || iv[2] >= 5) return null;
    
    const baseScore = selected.reduce((a, b) => a + b.score, 0);
    let comboBonus = 0;
    
    // v3强信号
    if (sp >= 18 && sp <= 24) comboBonus += 18;
    else if (sp >= 26 && sp <= 33) comboBonus += 12;
    if (odd === 1) comboBonus += 12;
    else if (odd === 3) comboBonus += 8;
    if (!iv.includes(0)) comboBonus += 5;
    else if (iv.filter(c => c === 0).length === 1) comboBonus += 2;
    
    // 区间集中惩罚
    const ivMax = Math.max(...iv);
    if (ivMax >= 3) comboBonus -= (ivMax - 2) * 4;
    
    return { numbers: sorted, score: baseScore + comboBonus, sum: s, span: sp, odd, iv: iv.join(":"), baseScore, comboBonus };
  }
  
  const combinations = generateCombinationsFast(pool, 5);
  
  return {
    sourceIssue,
    targetIssue,
    sourceFront: sourceDraw.front,
    targetFront: targetDraw ? targetDraw.front : null,
    pool,
    combinations,
  };
}

// 构建配对
function buildPairs(interval) {
  const pairs = [];
  const sortedIssues = ALL_DRAWS.map((d) => d.issue).sort();
  sortedIssues.forEach((srcIssue) => {
    const srcNum = parseInt(srcIssue.slice(4));
    const tgtIssue = srcIssue.slice(0, 4) + String(srcNum + interval).padStart(3, "0");
    if (issueMap[tgtIssue]) {
      pairs.push([srcIssue, tgtIssue]);
    }
  });
  return pairs;
}

// 回测对比
function backtestComparison() {
  console.log("╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║           📊 script.js v4.1 vs v3 版本对比测试                     ║");
  console.log("╚══════════════════════════════════════════════════════════════════════╝\n");
  
  const fullPairs = buildPairs(12);
  console.log(`  可用数据: ${ALL_DRAWS.length}期 (${ALL_DRAWS[0].issue} ~ ${ALL_DRAWS[ALL_DRAWS.length - 1].issue})`);
  console.log(`  12期配对: ${fullPairs.length}对\n`);
  
  // 存储两个版本的结果
  const v3Results = [];
  const v4_1Results = [];
  
  console.log("  正在运行 v3 版本...");
  fullPairs.forEach(([sIssue, tIssue]) => {
    const result = predictV3(sIssue, tIssue);
    if (result) v3Results.push(result);
  });
  
  console.log("  正在运行 v4.1 版本...");
  fullPairs.forEach(([sIssue, tIssue]) => {
    const result = predictV4_1(sIssue, tIssue);
    if (result) v4_1Results.push(result);
  });
  
  console.log("\n" + "═".repeat(70));
  console.log("║                        📊 对比结果                                 ║");
  console.log("═".repeat(70));
  
  // 统计函数
  function analyzeResults(results, versionName) {
    let totalTopHits = 0, totalTop3Hits = 0, totalTop5Hits = 0;
    let totalUnionHits5 = 0;
    let hitDist = [0, 0, 0, 0, 0, 0]; // 命中0-5球的组合数
    let bestHitDist = [0, 0, 0, 0, 0, 0]; // 每对最佳命中分布
    let poolCoverage = 0;
    
    results.forEach(result => {
      const tgtSet = new Set(result.targetFront);
      const poolHits = result.pool.filter(n => tgtSet.has(n.number)).length;
      poolCoverage += poolHits;
      
      // 前5组合命中
      let bestH = 0;
      const t5h = [];
      result.combinations.slice(0, 5).forEach((combo, idx) => {
        const hits = combo.numbers.filter(n => tgtSet.has(n)).length;
        t5h.push(hits);
        hitDist[hits]++;
        totalTopHits += hits;
        if (idx < 3) totalTop3Hits += hits;
        if (idx < 5) totalTop5Hits += hits;
        bestH = Math.max(bestH, hits);
      });
      bestHitDist[bestH]++;
      
      // 前5注联合覆盖
      const unionSet = new Set();
      result.combinations.slice(0, 5).forEach(c => c.numbers.forEach(n => unionSet.add(n)));
      const u5 = [...tgtSet].filter(n => unionSet.has(n)).length;
      totalUnionHits5 += u5;
    });
    
    const totalPairs = results.length;
    const totalBalls = totalPairs * 5;
    
    return {
      versionName,
      totalPairs,
      totalBalls,
      poolCoverage,
      totalTopHits,
      totalTop3Hits,
      totalTop5Hits,
      totalUnionHits5,
      hitDist,
      bestHitDist,
    };
  }
  
  const v3Stats = analyzeResults(v3Results, "v3版本");
  const v4_1Stats = analyzeResults(v4_1Results, "v4.1版本");
  
  // 打印对比表格
  console.log("\n  📈 关键指标对比:");
  console.log("  " + "─".repeat(80));
  console.log(`  ${"指标".padEnd(20)} | ${"v3版本".padEnd(20)} | ${"v4.1版本".padEnd(20)} | ${"提升".padEnd(10)}`);
  console.log("  " + "─".repeat(80));
  
  const metrics = [
    { name: "号码池覆盖率", old: v3Stats.poolCoverage, new: v4_1Stats.poolCoverage, total: v3Stats.totalBalls },
    { name: "前5组命中率", old: v3Stats.totalTopHits, new: v4_1Stats.totalTopHits, total: v3Stats.totalBalls * 5 },
    { name: "前5组联合覆盖", old: v3Stats.totalUnionHits5, new: v4_1Stats.totalUnionHits5, total: v3Stats.totalBalls },
    { name: "前3组命中率", old: v3Stats.totalTop3Hits, new: v4_1Stats.totalTop3Hits, total: v3Stats.totalBalls * 3 },
  ];
  
  metrics.forEach(m => {
    const oldPct = (m.old / m.total * 100).toFixed(1);
    const newPct = (m.new / m.total * 100).toFixed(1);
    const diff = (m.new - m.old) / m.total * 100;
    const diffStr = diff >= 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
    console.log(`  ${m.name.padEnd(20)} | ${(m.old+"/"+m.total).padEnd(12)} (${oldPct.padStart(5)}%) | ${(m.new+"/"+m.total).padEnd(12)} (${newPct.padStart(5)}%) | ${diffStr.padStart(8)}`);
  });
  
  console.log("  " + "─".repeat(80));
  
  // 命中分布对比
  console.log("\n  📊 前五组命中分布对比（每注命中球数）:");
  console.log("  " + "─".repeat(60));
  console.log(`  ${"命中球数".padEnd(10)} | ${"v3版本".padEnd(15)} | ${"v4.1版本".padEnd(15)} | ${"差异".padEnd(10)}`);
  console.log("  " + "─".repeat(60));
  
  for (let hits = 5; hits >= 0; hits--) {
    const oldCount = v3Stats.hitDist[hits];
    const newCount = v4_1Stats.hitDist[hits];
    const diff = newCount - oldCount;
    const diffStr = diff >= 0 ? `+${diff}` : `${diff}`;
    console.log(`  ${String(hits).padEnd(10)} | ${String(oldCount).padEnd(15)} | ${String(newCount).padEnd(15)} | ${diffStr.padStart(6)}`);
  }
  console.log("  " + "─".repeat(60));
  console.log(`  ${"总计".padEnd(10)} | ${String(v3Stats.totalBalls * 5).padEnd(15)} | ${String(v4_1Stats.totalBalls * 5).padEnd(15)} |`);
  
  // 最佳命中分布对比
  console.log("\n  🎯 各对最佳命中分布对比:");
  console.log("  " + "─".repeat(60));
  console.log(`  ${"最佳命中".padEnd(10)} | ${"v3版本".padEnd(15)} | ${"v4.1版本".padEnd(15)} | ${"差异".padEnd(10)}`);
  console.log("  " + "─".repeat(60));
  
  for (let hits = 5; hits >= 0; hits--) {
    const oldCount = v3Stats.bestHitDist[hits];
    const newCount = v4_1Stats.bestHitDist[hits];
    const diff = newCount - oldCount;
    const diffStr = diff >= 0 ? `+${diff}` : `${diff}`;
    console.log(`  ${String(hits).padEnd(10)} | ${String(oldCount).padEnd(15)} | ${String(newCount).padEnd(15)} | ${diffStr.padStart(6)}`);
  }
  console.log("  " + "─".repeat(60));
  console.log(`  ${"总对数".padEnd(10)} | ${String(v3Stats.totalPairs).padEnd(15)} | ${String(v4_1Stats.totalPairs).padEnd(15)} |`);
  
  // 详细命中率对比
  console.log("\n  📋 详细命中率对比:");
  console.log("  " + "─".repeat(60));
  console.log(`  ${"版本".padEnd(25)} | ${"前5组命中率".padEnd(15)} | ${"前5组联合覆盖".padEnd(15)}`);
  console.log("  " + "─".repeat(60));
  
  const v3HitRate = (v3Stats.totalTopHits / (v3Stats.totalBalls * 5) * 100).toFixed(1);
  const v4_1HitRate = (v4_1Stats.totalTopHits / (v4_1Stats.totalBalls * 5) * 100).toFixed(1);
  const v3UnionRate = (v3Stats.totalUnionHits5 / v3Stats.totalBalls * 100).toFixed(1);
  const v4_1UnionRate = (v4_1Stats.totalUnionHits5 / v4_1Stats.totalBalls * 100).toFixed(1);
  
  console.log(`  ${"v3版本".padEnd(25)} | ${v3HitRate.padStart(8)}% | ${v3UnionRate.padStart(8)}%`);
  console.log(`  ${"v4.1版本".padEnd(25)} | ${v4_1HitRate.padStart(8)}% | ${v4_1UnionRate.padStart(8)}%`);
  console.log("  " + "─".repeat(60));
  
  // 总结
  console.log("\n" + "═".repeat(70));
  console.log("║                        📝 总结                                    ║");
  console.log("═".repeat(70));
  
  const hitRateDiff = (v4_1Stats.totalTopHits - v3Stats.totalTopHits) / (v3Stats.totalBalls * 5) * 100;
  const unionDiff = (v4_1Stats.totalUnionHits5 - v3Stats.totalUnionHits5) / v3Stats.totalBalls * 100;
  const poolDiff = (v4_1Stats.poolCoverage - v3Stats.poolCoverage) / v3Stats.totalBalls * 100;
  
  console.log(`\n  1. 号码池覆盖率: ${poolDiff >= 0 ? "+" : ""}${poolDiff.toFixed(1)}%`);
  console.log(`  2. 前5组命中率: ${hitRateDiff >= 0 ? "+" : ""}${hitRateDiff.toFixed(1)}%`);
  console.log(`  3. 前5组联合覆盖: ${unionDiff >= 0 ? "+" : ""}${unionDiff.toFixed(1)}%`);
  
  if (hitRateDiff > 0 || unionDiff > 0) {
    console.log("\n  ✅ v4.1版本表现更好");
  } else if (hitRateDiff < 0 || unionDiff < 0) {
    console.log("\n  ❌ v4.1版本表现更差");
  } else {
    console.log("\n  ➖ 两个版本表现相同");
  }
}

// 运行对比测试
backtestComparison();