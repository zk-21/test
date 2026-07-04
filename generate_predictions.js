/**
 * 生成所有期的前区top5组合和补漏6号码，输出JSON
 */

const fs = require('fs');
const path = require('path');

// 加载数据
const pickerContent = fs.readFileSync(path.join(__dirname, 'optimized_picker.js'), 'utf8');
const startMarker = 'const ALL_DRAWS = [';
const startIdx = pickerContent.indexOf(startMarker);
let bracketCount = 0, endIdx = -1;
for (let i = startIdx + startMarker.length - 1; i < pickerContent.length; i++) {
  if (pickerContent[i] === '[') bracketCount++;
  else if (pickerContent[i] === ']') { bracketCount--; if (bracketCount === 0) { endIdx = i + 1; break; } }
}
const ALL_DRAWS = new Function(`return ${pickerContent.substring(startIdx, endIdx).replace('const ALL_DRAWS = ', '')}`)();
console.log(`加载 ${ALL_DRAWS.length} 期数据`);

// 构建查询映射
const issueMap = {};
ALL_DRAWS.forEach((d) => (issueMap[d.issue] = d));

// 复制必要的函数（从optimized_picker.js中提取）
// 由于函数较多，我们直接使用eval来执行整个文件，但这样会覆盖当前作用域
// 更安全的方法是使用vm模块，但为了简单，我们直接复制关键函数

// 我们将使用optimized_picker.js中的函数，但需要确保它们可用
// 我们可以通过读取文件并提取函数代码来实现

// 提取predict函数
const predictFunctionMatch = pickerContent.match(/function predict\(sourceIssue, targetIssue, fastMode = false\) \{[\s\S]*?\n\}/);
if (!predictFunctionMatch) {
  console.error('无法提取predict函数');
  process.exit(1);
}
const predictFunctionCode = predictFunctionMatch[0];

// 提取predictBack函数
const predictBackFunctionMatch = pickerContent.match(/function predictBack\(sourceDrawIdx\) \{[\s\S]*?\n\}/);
if (!predictBackFunctionMatch) {
  console.error('无法提取predictBack函数');
  process.exit(1);
}
const predictBackFunctionCode = predictBackFunctionMatch[0];

// 提取buildPairs函数
const buildPairsFunctionMatch = pickerContent.match(/function buildPairs\(interval\) \{[\s\S]*?\n\}/);
if (!buildPairsFunctionMatch) {
  console.error('无法提取buildPairs函数');
  process.exit(1);
}
const buildPairsFunctionCode = buildPairsFunctionMatch[0];

// 提取其他依赖函数（简化：我们直接使用optimized_picker.js中的全局变量）
// 我们将创建一个新的上下文，包含所有必要的变量和函数

// 创建一个新的函数来执行预测
const predictionScript = `
  // 数据
  const ALL_DRAWS = ${JSON.stringify(ALL_DRAWS)};
  const issueMap = {};
  ALL_DRAWS.forEach((d) => (issueMap[d.issue] = d));
  
  // 配置
  const CONFIG = {
    frontMax: 35,
    backMax: 12,
    poolSize: 24,
    pickCount: 5,
    comboPoolTop: 20,
    comboSampleMax: 1000,
    tailPatternBonus: 10,
    offsetScore: { 0: 20, 1: 15, 2: 13, 3: 12, 4: 10, 5: 8, 6: 6, 7: 5, 8: 4, 9: 3, 10: 2 },
    recentFreqWeight: 0.10,
    repeatRateWeight: 0.05,
  };
  
  // 函数定义
  ${buildPairsFunctionCode}
  ${predictBackFunctionCode}
  ${predictFunctionCode}
  
  // 生成预测
  const predictions = [];
  const fullPairs = buildPairs(10);
  console.log('配对数量:', fullPairs.length);
  
  fullPairs.forEach(([sIssue, tIssue]) => {
    const result = predict(sIssue, tIssue, true);
    if (!result) return;
    
    const srcIdx = ALL_DRAWS.findIndex(d => d.issue === sIssue);
    const backPred = predictBack(srcIdx);
    
    // 提取前5组合
    const top5 = result.combinations.slice(0, 5).map(combo => combo.numbers);
    
    // 生成补漏6号码（使用backtest中的逻辑）
    const targetSet = new Set(result.targetFront);
    const top5CoveredNums = new Set();
    top5.forEach(nums => nums.forEach(n => top5CoveredNums.add(n)));
    
    // 计算遗漏期数（近20期）
    const missWindow = 20;
    const missMap = new Map();
    for (let n = 1; n <= 35; n++) {
      let gap = 0;
      for (let i = srcIdx - 1; i >= Math.max(0, srcIdx - missWindow); i--) {
        if (ALL_DRAWS[i].front.includes(n)) break;
        gap++;
      }
      missMap.set(n, gap);
    }
    
    // 计算热号频率（近10期）
    const hotWindow = 10;
    const hotMap = new Map();
    for (let n = 1; n <= 35; n++) {
      let cnt = 0;
      for (let i = srcIdx - 1; i >= Math.max(0, srcIdx - hotWindow); i--) {
        if (ALL_DRAWS[i].front.includes(n)) cnt++;
      }
      hotMap.set(n, cnt);
    }
    
    // 核心策略：只选Top5未覆盖的池号码（补漏=补Top5的盲区）
    const uncoveredPoolNums = result.pool
      .filter(e => !top5CoveredNums.has(e.number))
      .map(e => e.number);
    
    // 统计Top5区间分布，用于区间平衡加分
    const top5IvCounts = [0, 0, 0];
    top5.forEach(nums => {
      nums.forEach(n => { if (n <= 12) top5IvCounts[0]++; else if (n <= 24) top5IvCounts[1]++; else top5IvCounts[2]++; });
    });
    const top5IvMin = Math.min(...top5IvCounts);
    const top5IvMinIdx = top5IvCounts.indexOf(top5IvMin);
    
    // 尾号预测
    const predTails6 = result.predictedTails ? new Set(result.predictedTails.slice(0, 5).map(([t]) => t)) : new Set();
    
    // 混合策略：Top5未覆盖号码 + Top5高频号（≥3次）
    const top5Freq = new Map();
    top5.forEach(nums => nums.forEach(n => top5Freq.set(n, (top5Freq.get(n) || 0) + 1)));
    
    const candidate6Scored = result.pool
      .filter(e => {
        const n = e.number;
        const freq = top5Freq.get(n) || 0;
        return !top5CoveredNums.has(n) || freq >= 1;
      })
      .map(e => {
        const n = e.number;
        const freq = top5Freq.get(n) || 0;
        const miss = missMap.get(n) || 0;
        const hot = hotMap.get(n) || 0;
        let score6 = e.score;
        if (predTails6.has(n % 10)) score6 += 10;
        const zone = n <= 12 ? 0 : n <= 24 ? 1 : 2;
        if (zone === top5IvMinIdx) score6 += 6;
        if (hot >= 3) score6 += 8;
        else if (hot >= 2) score6 += 4;
        if (miss >= 10) score6 += 5;
        else if (miss >= 7) score6 += 3;
        if (freq >= 3) score6 += 30;
        else if (freq <= 1) score6 += 25;
        else if (freq >= 2) score6 += 15;
        let minDistToTop5 = Infinity;
        top5CoveredNums.forEach(cn => { const d = Math.abs(n - cn); if (d < minDistToTop5) minDistToTop5 = d; });
        if (minDistToTop5 === 1) score6 += 12;
        else if (minDistToTop5 === 2) score6 += 6;
        else if (minDistToTop5 === 3) score6 += 3;
        return { number: n, poolScore: e.score, freq, miss, hot, score6 };
      })
      .sort((a, b) => b.score6 - a.score6);
    
    // 生成补漏6组合
    let combo6补漏 = null;
    if (candidate6Scored.length >= 5) {
      // 贪心选择前5个
      const nums = candidate6Scored.slice(0, 5).map(e => e.number).sort((a, b) => a - b);
      combo6补漏 = { numbers: nums, score: candidate6Scored.slice(0, 5).reduce((s, e) => s + e.score6, 0) };
    } else if (candidate6Scored.length > 0) {
      // 不足5个时补充
      const supplement = result.pool
        .filter(e => !top5CoveredNums.has(e.number) && !candidate6Scored.some(c => c.number === e.number))
        .sort((a, b) => b.score - a.score);
      let all = [...candidate6Scored, ...supplement.map(e => ({ number: e.number, score6: e.score }))];
      if (all.length < 5) {
        const coveredPool = result.pool
          .filter(e => top5CoveredNums.has(e.number) && !all.some(c => c.number === e.number))
          .sort((a, b) => b.score - a.score);
        all = [...all, ...coveredPool.map(e => ({ number: e.number, score6: e.score * 0.5 }))];
      }
      all = all.slice(0, 5);
      const nums = all.map(e => e.number).sort((a, b) => a - b);
      combo6补漏 = { numbers: nums, score: all.reduce((s, e) => s + e.score6, 0) };
    }
    
    const buLou6 = combo6补漏 ? combo6补漏.numbers : [];
    
    // 实际开奖号码
    const targetDraw = issueMap[tIssue];
    const actualFront = targetDraw.front;
    const actualBack = targetDraw.back;
    
    predictions.push({
      sourceIssue: sIssue,
      targetIssue: tIssue,
      top5: top5,
      buLou6: buLou6,
      backPred: backPred,
      actualFront: actualFront,
      actualBack: actualBack
    });
  });
  
  predictions;
  this.predictions = predictions;
`;

// 执行预测脚本
const vm = require('vm');
const sandbox = { console, JSON, Math, Set, Map, Array, Number, String, Boolean, Date, RegExp, Error, TypeError, RangeError, SyntaxError, URIError, EvalError, ReferenceError, parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent, escape, unescape };
const context = vm.createContext(sandbox);
try {
  const script = new vm.Script(predictionScript, { filename: 'generate_predictions.js' });
  script.runInContext(context);
  const predictions = sandbox.predictions;
  
  // 保存到JSON文件
  const outputPath = path.join(__dirname, 'predictions_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(predictions, null, 2));
  console.log(`预测数据已保存到 ${outputPath}`);
  console.log(`共 ${predictions.length} 期预测`);
} catch (err) {
  console.error('执行预测脚本失败:', err);
  process.exit(1);
}