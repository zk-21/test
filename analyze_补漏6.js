// 分析补漏6命中特征
process.argv = ['node', 'optimized_picker.js', '--backtest'];
require('./optimized_picker.js');

// 重新运行回测，收集补漏6的详细数据
function analyze_补漏6() {
  const fullPairs = buildPairs(10);
  const allIssues = ALL_DRAWS.map(d => d.issue);
  
  const results = [];
  
  fullPairs.forEach(([sIssue, tIssue]) => {
    const result = predict(sIssue, tIssue, true);
    if (!result) return;
    
    const srcIdx = allIssues.indexOf(sIssue);
    const targetSet = new Set(result.targetFront);
    
    // Top5覆盖的号码
    const top5CoveredNums = new Set();
    result.combinations.slice(0, 5).forEach(c => c.numbers.forEach(n => top5CoveredNums.add(n)));
    
    // Top5频率
    const top5Freq = new Map();
    result.combinations.slice(0, 5).forEach(c => c.numbers.forEach(n => top5Freq.set(n, (top5Freq.get(n) || 0) + 1)));
    
    // 计算补漏6（当前策略）
    const candidate6Scored = result.pool
      .map(e => {
        const n = e.number;
        const freq = top5Freq.get(n) || 0;
        let score6 = e.score;
        if (freq >= 3) score6 += 50;
        else if (freq >= 2) score6 += 30;
        else if (freq >= 1) score6 += 15;
        return { number: n, score6 };
      })
      .sort((a, b) => b.score6 - a.score6);
    
    const combo6 = candidate6Scored.slice(0, 5).map(e => e.number);
    const hits6 = combo6.filter(n => targetSet.has(n)).length;
    
    // 分析特征
    const srcDraw = issueMap[sIssue];
    const tgtDraw = issueMap[tIssue];
    const srcSum = srcDraw.front.reduce((a, b) => a + b, 0);
    const tgtSum = tgtDraw.front.reduce((a, b) => a + b, 0);
    const srcSpan = Math.max(...srcDraw.front) - Math.min(...srcDraw.front);
    const tgtSpan = Math.max(...tgtDraw.front) - Math.min(...tgtDraw.front);
    const srcOdd = srcDraw.front.filter(n => n % 2 === 1).length;
    const tgtOdd = tgtDraw.front.filter(n => n % 2 === 1).length;
    
    // 区间分布
    const srcIv = [0, 0, 0];
    srcDraw.front.forEach(n => { if (n <= 12) srcIv[0]++; else if (n <= 24) srcIv[1]++; else srcIv[2]++; });
    const tgtIv = [0, 0, 0];
    tgtDraw.front.forEach(n => { if (n <= 12) tgtIv[0]++; else if (n <= 24) tgtIv[1]++; else tgtIv[2]++; });
    
    // 补漏6的区间分布
    const combo6Iv = [0, 0, 0];
    combo6.forEach(n => { if (n <= 12) combo6Iv[0]++; else if (n <= 24) combo6Iv[1]++; else combo6Iv[2]++; });
    
    // Top5的区间分布
    const top5Iv = [0, 0, 0];
    result.combinations.slice(0, 5).forEach(c => {
      c.numbers.forEach(n => { if (n <= 12) top5Iv[0]++; else if (n <= 24) top5Iv[1]++; else top5Iv[2]++; });
    });
    
    results.push({
      sIssue, tIssue,
      hits6,
      combo6,
      targetFront: tgtDraw.front,
      srcSum, tgtSum, srcSpan, tgtSpan, srcOdd, tgtOdd,
      srcIv, tgtIv, combo6Iv, top5Iv,
      // 高频号信息
      highFreqNums: [...top5Freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n]) => n),
      highFreqHits: [...top5Freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n]) => n).filter(n => targetSet.has(n)).length
    });
  });
  
  // 分析命中高的对和命中低的对的特征
  const highHit = results.filter(r => r.hits6 >= 3);
  const lowHit = results.filter(r => r.hits6 <= 1);
  const zeroHit = results.filter(r => r.hits6 === 0);
  
  console.log("\n" + "═".repeat(70));
  console.log("║                    📊 补漏6命中特征分析                            ║");
  console.log("═".repeat(70));
  
  console.log(`\n   总配对: ${results.length}`);
  console.log(`   命中3+球: ${highHit.length}对 (${(highHit.length / results.length * 100).toFixed(1)}%)`);
  console.log(`   命中≤1球: ${lowHit.length}对 (${(lowHit.length / results.length * 100).toFixed(1)}%)`);
  console.log(`   命中0球: ${zeroHit.length}对 (${(zeroHit.length / results.length * 100).toFixed(1)}%)`);
  
  // 分析特征
  console.log("\n   📊 特征对比 (命中高 vs 命中低):");
  
  // 和值变化
  const avgSumDiffHigh = highHit.reduce((s, r) => s + Math.abs(r.tgtSum - r.srcSum), 0) / highHit.length;
  const avgSumDiffLow = lowHit.reduce((s, r) => s + Math.abs(r.tgtSum - r.srcSum), 0) / lowHit.length;
  console.log(`      平均和值变化幅度: 高命中=${avgSumDiffHigh.toFixed(1)} | 低命中=${avgSumDiffLow.toFixed(1)}`);
  
  // 跨度变化
  const avgSpanDiffHigh = highHit.reduce((s, r) => s + Math.abs(r.tgtSpan - r.srcSpan), 0) / highHit.length;
  const avgSpanDiffLow = lowHit.reduce((s, r) => s + Math.abs(r.tgtSpan - r.srcSpan), 0) / lowHit.length;
  console.log(`      平均跨度变化幅度: 高命中=${avgSpanDiffHigh.toFixed(1)} | 低命中=${avgSpanDiffLow.toFixed(1)}`);
  
  // 奇偶变化
  const avgOddDiffHigh = highHit.reduce((s, r) => s + Math.abs(r.tgtOdd - r.srcOdd), 0) / highHit.length;
  const avgOddDiffLow = lowHit.reduce((s, r) => s + Math.abs(r.tgtOdd - r.srcOdd), 0) / lowHit.length;
  console.log(`      平均奇偶变化幅度: 高命中=${avgOddDiffHigh.toFixed(1)} | 低命中=${avgOddDiffLow.toFixed(1)}`);
  
  // 区间分布
  console.log("\n   📊 区间分布对比:");
  console.log("      高命中对 - 补漏6区间分布:");
  const highIv = [0, 0, 0];
  highHit.forEach(r => { highIv[0] += r.combo6Iv[0]; highIv[1] += r.combo6Iv[1]; highIv[2] += r.combo6Iv[2]; });
  console.log(`        I区(1-12): ${highIv[0]}球 | II区(13-24): ${highIv[1]}球 | III区(25-35): ${highIv[2]}球`);
  
  console.log("      低命中对 - 补漏6区间分布:");
  const lowIv = [0, 0, 0];
  lowHit.forEach(r => { lowIv[0] += r.combo6Iv[0]; lowIv[1] += r.combo6Iv[1]; lowIv[2] += r.combo6Iv[2]; });
  console.log(`        I区(1-12): ${lowIv[0]}球 | II区(13-24): ${lowIv[1]}球 | III区(25-35): ${lowIv[2]}球`);
  
  // 高频号命中率
  const avgHighFreqHits = results.reduce((s, r) => s + r.highFreqHits, 0) / results.length;
  console.log(`\n   📊 高频号命中率: 平均每对命中${avgHighFreqHits.toFixed(2)}球`);
  
  // 分析补漏6和高频号的关系
  console.log("\n   📊 补漏6 vs 高频号对比:");
  let sameCount = 0, diffCount = 0;
  results.forEach(r => {
    const combo6Set = new Set(r.combo6);
    const highFreqSet = new Set(r.highFreqNums);
    const same = [...combo6Set].filter(n => highFreqSet.has(n)).length;
    sameCount += same;
    diffCount += 5 - same;
  });
  console.log(`      补漏6与高频号重叠: ${sameCount}球 (${(sameCount / (results.length * 5) * 100).toFixed(1)}%)`);
  console.log(`      补漏6独有号码: ${diffCount}球 (${(diffCount / (results.length * 5) * 100).toFixed(1)}%)`);
  
  // 展示高命中对的详细信息
  console.log("\n   📊 高命中对 (命中3+球) 详细:");
  highHit.slice(0, 10).forEach(r => {
    console.log(`      ${r.sIssue}→${r.tIssue}: 补漏6=${r.combo6.join(",")} | 命中${r.hits6}/5 | 目标=${r.targetFront.join(",")}`);
  });
  
  // 展示低命中对的详细信息
  console.log("\n   📊 低命中对 (命中≤1球) 详细:");
  lowHit.slice(0, 10).forEach(r => {
    console.log(`      ${r.sIssue}→${r.tIssue}: 补漏6=${r.combo6.join(",")} | 命中${r.hits6}/5 | 目标=${r.targetFront.join(",")}`);
  });
  
  return results;
}

// 执行分析
const analysisResults = analyze_补漏6();
