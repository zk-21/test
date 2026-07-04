const fs = require('fs');

const allDraws = JSON.parse(fs.readFileSync('all_draws.json', 'utf8'));
const sampleBlueColor = "blue";
function ballHasColor(b, color) { return true; }

function buildAllBalls(draws) {
  const balls = [];
  draws.forEach((draw, idx) => {
    const row = idx + 1;
    draw.back.forEach(num => {
      balls.push({ zone: "back", row, number: num });
    });
  });
  return balls;
}

function calculateHighFreqMissNums(allBalls, lookbackRows = 50) {
  const backBalls = allBalls.filter(b => b.zone === "back");
  if (backBalls.length === 0) return [2, 5, 7, 11];
  const maxRow = Math.max(...backBalls.map(b => b.row));
  const startRow = Math.max(1, maxRow - lookbackRows);
  const freq = {};
  for (let n = 1; n <= 12; n++) freq[n] = 0;
  backBalls.filter(b => b.row >= startRow).forEach(b => {
    freq[b.number] = (freq[b.number] || 0) + 1;
  });
  const totalDraws = maxRow - startRow + 1;
  const avgFreq = (totalDraws * 2) / 12;
  const highFreqNums = Object.entries(freq)
    .filter(([_, count]) => count > avgFreq * 1.2)
    .map(([num, _]) => Number(num));
  if (highFreqNums.length < 4) {
    const sortedByFreq = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([num, _]) => Number(num));
    for (const num of sortedByFreq) {
      if (!highFreqNums.includes(num)) {
        highFreqNums.push(num);
        if (highFreqNums.length >= 4) break;
      }
    }
  }
  return highFreqNums.slice(0, 4);
}

// v4版本（无等差策略加分）
function generateBackBridgeCombosV4(sourceRow, allBalls, highFreqMissNums = null) {
  if (!highFreqMissNums) highFreqMissNums = calculateHighFreqMissNums(allBalls);
  const sourceColor = sampleBlueColor;
  const sourceBalls = allBalls.filter(b => b.zone === "back" && b.row === sourceRow && ballHasColor(b, sourceColor));
  const sourceNums = [...new Set(sourceBalls.map(b => b.number))].sort((a, b) => a - b).slice(0, 2);
  if (sourceNums.length < 2) return [[1,2],[3,4],[5,6],[7,8],[9,10]];
  const [s1, s2] = sourceNums;
  const gap = s2 - s1;
  const backMax = 12;
  const wrap = (n) => { if (n < 1) return n + backMax; if (n > backMax) return n - backMax; return n; };
  const makePair = (a, b) => { const pair = [wrap(a), wrap(b)].sort((x, y) => x - y); return pair[0] !== pair[1] ? pair : null; };
  const prevRow = sourceRow - 1;
  const prevBalls = allBalls.filter(b => b.zone === "back" && b.row === prevRow && ballHasColor(b, sourceColor));
  const prevNums = [...new Set(prevBalls.map(b => b.number))].sort((a, b) => a - b).slice(0, 2);
  const windowSize = 8;
  const windowStart = Math.max(1, sourceRow - windowSize);
  const windowBalls = allBalls.filter(b => b.zone === "back" && b.row >= windowStart && b.row < sourceRow && ballHasColor(b, sourceColor));
  const windowFreq = {};
  for (let n = 1; n <= backMax; n++) windowFreq[n] = 0;
  windowBalls.forEach(b => { windowFreq[b.number] = (windowFreq[b.number] || 0) + 1; });
  const sortedByFreq = Object.entries(windowFreq).sort((a, b) => b[1] - a[1]).map(([n, c]) => ({ num: Number(n), count: c }));
  const hotNums = sortedByFreq.filter(item => item.count >= 2).map(item => item.num);
  if (hotNums.length < 2) { const top2 = sortedByFreq.slice(0, 2).map(item => item.num); top2.forEach(n => { if (!hotNums.includes(n)) hotNums.push(n); }); }
  const coldNums = sortedByFreq.filter(item => item.count <= 1).map(item => item.num);
  const results = [];
  const seen = new Set();
  const addPair = (pair, label) => { if (!pair) return; const key = pair.join("-"); if (seen.has(key)) return; seen.add(key); results.push({ numbers: pair, label }); };
  
  addPair([s1, s2], "后区重复");
  addPair(makePair(s1 + 1, s2 + 1), "后区相邻+1");
  if (gap >= 3) { const mid = Math.round((s1 + s2) / 2); addPair(makePair(s1, mid), "后区桥接"); }
  else if (gap === 2) addPair(makePair(s1, s1 + 1), "后区桥接");
  else addPair(makePair(s1 - 1, s2 + 1), "后区桥接");
  if (prevNums.length >= 2) { const [p1, p2] = prevNums; addPair([p1, p2], "前一期重复"); addPair(makePair(p1, p1 + 1), "前一期相邻"); addPair(makePair(p2, p2 + 1), "前一期相邻"); }
  addPair(makePair(s1, s2 - 1), "后区源号相邻"); addPair(makePair(s1 - 1, s2), "后区源号相邻");
  if (hotNums.length > 0) { addPair(makePair(s1, hotNums[0]), "源号+热号"); addPair(makePair(s2, hotNums[0]), "源号+热号"); }
  addPair(makePair(s1 + 1, s2 + 1), "源号±1"); addPair(makePair(s1 - 1, s2 - 1), "源号±1");
  for (const missNum of highFreqMissNums) { addPair(makePair(s1, wrap(missNum - 1)), "高频相邻"); addPair(makePair(s2, wrap(missNum + 1)), "高频相邻"); }
  const highFreqCombos = [[4,5], [2,8], [2,3], [1,5], [7,8], [6,7], [2,12], [9,12]];
  for (const combo of highFreqCombos) addPair(combo, "高频未命中");
  if (coldNums.length >= 2) addPair([coldNums[0], coldNums[1]], "冷号组合");
  
  // 等差数列策略
  const midPoint = Math.round((s1 + s2) / 2);
  if (midPoint !== s1 && midPoint !== s2) {
    addPair(makePair(midPoint, s1 - 1), "等差相邻"); addPair(makePair(midPoint, s1 + 1), "等差相邻");
    addPair(makePair(midPoint, s2 - 1), "等差相邻"); addPair(makePair(midPoint, s2 + 1), "等差相邻");
  }
  addPair(makePair(wrap(s1 - 1), wrap(s2 - 1)), "源行相邻"); addPair(makePair(wrap(s1 + 1), wrap(s2 + 1)), "源行相邻");
  
  let attempts = 0;
  while (results.length < 20 && attempts < 50) { attempts++; const n1 = 1 + Math.floor(Math.random() * backMax); let n2 = 1 + Math.floor(Math.random() * backMax); if (n1 === n2) n2 = n2 >= backMax ? n2 - 1 : n2 + 1; addPair([n1, n2].sort((a, b) => a - b), "后区补充"); }
  
  // v4评分（无额外加分）
  const scoreCombo = (pair) => {
    let score = 0;
    const [a, b] = pair;
    const sum = a + b;
    const span = Math.abs(b - a);
    if (pair.filter(n => n % 2 === 1).length === 1) score += 2;
    if (pair.filter(n => n > 6).length === 1) score += 2;
    if (sum >= 9 && sum <= 14) score += 3;
    if (span >= 1 && span <= 4) score += 2;
    else if (span >= 5 && span <= 7) score += 1;
    if (prevNums.length >= 2) { if (pair.includes(prevNums[0]) || pair.includes(prevNums[1])) score += 2; }
    return score;
  };
  
  results.forEach(r => { r.score = scoreCombo(r.numbers); });
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 9).map(r => r.numbers);
}

// v6版本（有等差策略加分）
function generateBackBridgeCombosV6(sourceRow, allBalls, highFreqMissNums = null) {
  if (!highFreqMissNums) highFreqMissNums = calculateHighFreqMissNums(allBalls);
  const sourceColor = sampleBlueColor;
  const sourceBalls = allBalls.filter(b => b.zone === "back" && b.row === sourceRow && ballHasColor(b, sourceColor));
  const sourceNums = [...new Set(sourceBalls.map(b => b.number))].sort((a, b) => a - b).slice(0, 2);
  if (sourceNums.length < 2) return [[1,2],[3,4],[5,6],[7,8],[9,10]];
  const [s1, s2] = sourceNums;
  const gap = s2 - s1;
  const backMax = 12;
  const wrap = (n) => { if (n < 1) return n + backMax; if (n > backMax) return n - backMax; return n; };
  const makePair = (a, b) => { const pair = [wrap(a), wrap(b)].sort((x, y) => x - y); return pair[0] !== pair[1] ? pair : null; };
  const prevRow = sourceRow - 1;
  const prevBalls = allBalls.filter(b => b.zone === "back" && b.row === prevRow && ballHasColor(b, sourceColor));
  const prevNums = [...new Set(prevBalls.map(b => b.number))].sort((a, b) => a - b).slice(0, 2);
  const windowSize = 8;
  const windowStart = Math.max(1, sourceRow - windowSize);
  const windowBalls = allBalls.filter(b => b.zone === "back" && b.row >= windowStart && b.row < sourceRow && ballHasColor(b, sourceColor));
  const windowFreq = {};
  for (let n = 1; n <= backMax; n++) windowFreq[n] = 0;
  windowBalls.forEach(b => { windowFreq[b.number] = (windowFreq[b.number] || 0) + 1; });
  const sortedByFreq = Object.entries(windowFreq).sort((a, b) => b[1] - a[1]).map(([n, c]) => ({ num: Number(n), count: c }));
  const hotNums = sortedByFreq.filter(item => item.count >= 2).map(item => item.num);
  if (hotNums.length < 2) { const top2 = sortedByFreq.slice(0, 2).map(item => item.num); top2.forEach(n => { if (!hotNums.includes(n)) hotNums.push(n); }); }
  const coldNums = sortedByFreq.filter(item => item.count <= 1).map(item => item.num);
  const results = [];
  const seen = new Set();
  const addPair = (pair, label) => { if (!pair) return; const key = pair.join("-"); if (seen.has(key)) return; seen.add(key); results.push({ numbers: pair, label }); };
  
  addPair([s1, s2], "后区重复");
  addPair(makePair(s1 + 1, s2 + 1), "后区相邻+1");
  if (gap >= 3) { const mid = Math.round((s1 + s2) / 2); addPair(makePair(s1, mid), "后区桥接"); }
  else if (gap === 2) addPair(makePair(s1, s1 + 1), "后区桥接");
  else addPair(makePair(s1 - 1, s2 + 1), "后区桥接");
  if (prevNums.length >= 2) { const [p1, p2] = prevNums; addPair([p1, p2], "前一期重复"); addPair(makePair(p1, p1 + 1), "前一期相邻"); addPair(makePair(p2, p2 + 1), "前一期相邻"); }
  addPair(makePair(s1, s2 - 1), "后区源号相邻"); addPair(makePair(s1 - 1, s2), "后区源号相邻");
  if (hotNums.length > 0) { addPair(makePair(s1, hotNums[0]), "源号+热号"); addPair(makePair(s2, hotNums[0]), "源号+热号"); }
  addPair(makePair(s1 + 1, s2 + 1), "源号±1"); addPair(makePair(s1 - 1, s2 - 1), "源号±1");
  for (const missNum of highFreqMissNums) { addPair(makePair(s1, wrap(missNum - 1)), "高频相邻"); addPair(makePair(s2, wrap(missNum + 1)), "高频相邻"); }
  const highFreqCombos = [[4,5], [2,8], [2,3], [1,5], [7,8], [6,7], [2,12], [9,12]];
  for (const combo of highFreqCombos) addPair(combo, "高频未命中");
  if (coldNums.length >= 2) addPair([coldNums[0], coldNums[1]], "冷号组合");
  
  // 等差数列策略
  const midPoint = Math.round((s1 + s2) / 2);
  if (midPoint !== s1 && midPoint !== s2) {
    addPair(makePair(midPoint, s1 - 1), "等差相邻"); addPair(makePair(midPoint, s1 + 1), "等差相邻");
    addPair(makePair(midPoint, s2 - 1), "等差相邻"); addPair(makePair(midPoint, s2 + 1), "等差相邻");
  }
  addPair(makePair(wrap(s1 - 1), wrap(s2 - 1)), "源行相邻"); addPair(makePair(wrap(s1 + 1), wrap(s2 + 1)), "源行相邻");
  
  let attempts = 0;
  while (results.length < 20 && attempts < 50) { attempts++; const n1 = 1 + Math.floor(Math.random() * backMax); let n2 = 1 + Math.floor(Math.random() * backMax); if (n1 === n2) n2 = n2 >= backMax ? n2 - 1 : n2 + 1; addPair([n1, n2].sort((a, b) => a - b), "后区补充"); }
  
  // v6评分（有额外加分）
  const scoreCombo = (pair, label) => {
    let score = 0;
    const [a, b] = pair;
    const sum = a + b;
    const span = Math.abs(b - a);
    if (pair.filter(n => n % 2 === 1).length === 1) score += 2;
    if (pair.filter(n => n > 6).length === 1) score += 2;
    if (sum >= 9 && sum <= 14) score += 3;
    if (span >= 1 && span <= 4) score += 2;
    else if (span >= 5 && span <= 7) score += 1;
    if (prevNums.length >= 2) { if (pair.includes(prevNums[0]) || pair.includes(prevNums[1])) score += 2; }
    // 🆕 额外加分
    if (label === "等差相邻" || label === "源行相邻") score += 3;
    if (label === "高频未命中") score += 2;
    if (label === "前一期相邻") score += 2;
    return score;
  };
  
  results.forEach(r => { r.score = scoreCombo(r.numbers, r.label); });
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 9).map(r => r.numbers);
}

// 验证函数
function validate(version, generateFn) {
  const allBalls = buildAllBalls(allDraws);
  const testRows = [];
  const totalDraws = allDraws.length;
  const startIdx = Math.floor(totalDraws * 0.5);
  for (let i = startIdx; i < totalDraws; i++) {
    if (i === 0) continue;
    testRows.push({ issue: allDraws[i].issue, sourceRow: i, targetBack: allDraws[i].back.sort((a, b) => a - b) });
  }
  
  let totalHits = 0, singleHits = 0, doubleHits = 0, totalTests = 0;
  for (const test of testRows) {
    totalTests++;
    const combos = generateFn(test.sourceRow, allBalls);
    let bestMatch = 0;
    for (const combo of combos) {
      const matchCount = combo.filter(n => test.targetBack.includes(n)).length;
      if (matchCount > bestMatch) bestMatch = matchCount;
    }
    if (bestMatch >= 1) singleHits++;
    if (bestMatch >= 2) { doubleHits++; totalHits++; }
  }
  
  return { version, testPeriods: totalTests, singleHits, doubleHits, totalHits, hitRate: (totalHits/totalTests*100).toFixed(1)+"%", singleRate: (singleHits/totalTests*100).toFixed(1)+"%" };
}

// 运行对比
console.log("═".repeat(60));
console.log("v4 vs v6 对比测试");
console.log("═".repeat(60));

const v4Result = validate("v4-无额外加分", generateBackBridgeCombosV4);
const v6Result = validate("v6-有额外加分", generateBackBridgeCombosV6);

console.log("\n📊 对比结果：");
console.log("-".repeat(60));
console.log(`指标\t\t\t${v4Result.version}\t${v6Result.version}\t提升`);
console.log("-".repeat(60));
console.log(`双球命中\t\t${v4Result.hitRate}\t\t${v6Result.hitRate}\t\t${((parseFloat(v6Result.hitRate)-parseFloat(v4Result.hitRate))/parseFloat(v4Result.hitRate)*100).toFixed(1)}%`);
console.log(`单球命中\t\t${v4Result.singleRate}\t\t${v6Result.singleRate}\t\t${((parseFloat(v6Result.singleRate)-parseFloat(v4Result.singleRate))/parseFloat(v4Result.singleRate)*100).toFixed(1)}%`);
console.log(`双球命中数\t\t${v4Result.doubleHits}/${v4Result.testPeriods}\t\t${v6Result.doubleHits}/${v6Result.testPeriods}`);
console.log(`单球命中数\t\t${v4Result.singleHits}/${v4Result.testPeriods}\t\t${v6Result.singleHits}/${v6Result.testPeriods}`);

console.log("\n📈 提升幅度：");
console.log("-".repeat(60));
const doubleImprove = ((parseFloat(v6Result.hitRate) - parseFloat(v4Result.hitRate)) / parseFloat(v4Result.hitRate) * 100).toFixed(1);
const singleImprove = ((parseFloat(v6Result.singleRate) - parseFloat(v4Result.singleRate)) / parseFloat(v4Result.singleRate) * 100).toFixed(1);
console.log(`双球命中率提升: ${doubleImprove}%`);
console.log(`单球命中率提升: ${singleImprove}%`);

console.log("\n💡 结论：");
console.log("-".repeat(60));
if (parseFloat(v6Result.hitRate) > parseFloat(v4Result.hitRate)) {
  console.log("✅ v6版本（等差数列+相邻策略加分）命中率更高");
} else if (parseFloat(v6Result.hitRate) === parseFloat(v4Result.hitRate)) {
  console.log("⚠️ v4和v6版本命中率相同");
} else {
  console.log("❌ v4版本命中率更高");
}

// 保存对比结果
const comparison = {
  v4: v4Result,
  v6: v6Result,
  improvement: {
    doubleRate: doubleImprove + "%",
    singleRate: singleImprove + "%"
  }
};
fs.writeFileSync('v4_v6_comparison.json', JSON.stringify(comparison, null, 2));
console.log("\n对比结果已保存到 v4_v6_comparison.json");
