/**
 * backtest_tail_prediction_accuracy.js — 尾号预测准确率分析
 * 
 * 分析当前尾号预测的准确率，找出优化方向：
 * 1. Top5尾号命中率（预测的前5个尾号是否出现在开奖号码中）
 * 2. 不同预测模式的准确率对比
 * 3. 预测窗口期优化
 * 
 * 运行：node backtest_tail_prediction_accuracy.js
 */

const fs = require('fs');
const path = require('path');

// 加载数据
let code = fs.readFileSync(path.join(__dirname, 'optimized_picker.js'), 'utf-8');
const cliStart = code.indexOf('\nconst args = process.argv.slice');
if (cliStart > 0) code = code.substring(0, cliStart);

const wrappedCode = "(function() {\n  var module = { exports: {} };\n  var exports = module.exports;\n  " + code + "\n  return { predict, predictNext, predictBack, ALL_DRAWS, issueMap, buildPairs };\n})()";
const picker = eval(wrappedCode);

// 辅助函数
function tails(nums) { return [...new Set(nums.map(n => n % 10))]; }

// ===== 尾号预测函数（不同模式）=====
function predictTailsMode1(sourceTails, sourceIdx, allDraws, window = 50) {
  // 模式1：简单转移频率（当前主要方法）
  const tailTransCounts = new Map();
  for (let i = Math.max(0, sourceIdx - window); i < sourceIdx; i++) {
    const prevTails = tails(allDraws[i].front);
    const overlapTails = prevTails.filter(t => sourceTails.includes(t));
    if (overlapTails.length >= 1) {
      const nextTails = tails(allDraws[i + 1] ? allDraws[i + 1].front : []);
      nextTails.forEach(t => {
        tailTransCounts.set(t, (tailTransCounts.get(t) || 0) + overlapTails.length);
      });
    }
  }
  return [...tailTransCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

function predictTailsMode2(sourceTails, sourceIdx, allDraws, window = 50) {
  // 模式2：全局高频尾号
  const globalTailFreq = new Map();
  for (let t = 0; t <= 9; t++) globalTailFreq.set(t, 0);
  
  for (let i = Math.max(0, sourceIdx - window); i < sourceIdx; i++) {
    tails(allDraws[i].front).forEach(t => {
      globalTailFreq.set(t, globalTailFreq.get(t) + 1);
    });
  }
  
  return [...globalTailFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

function predictTailsMode3(sourceTails, sourceIdx, allDraws, window = 30) {
  // 模式3：近期高频尾号（近30期）
  const recentTailFreq = new Map();
  for (let t = 0; t <= 9; t++) recentTailFreq.set(t, 0);
  
  for (let i = Math.max(0, sourceIdx - window); i < sourceIdx; i++) {
    tails(allDraws[i].front).forEach(t => {
      recentTailFreq.set(t, recentTailFreq.get(t) + 1);
    });
  }
  
  return [...recentTailFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

function predictTailsMode4(sourceTails, sourceIdx, allDraws) {
  // 模式4：上一期尾号 + 等差延伸
  const refTails = sourceIdx > 0 ? tails(allDraws[sourceIdx - 1].front) : [];
  const extendedTails = new Set(refTails);
  
  // 等差延伸
  for (let i = 0; i < refTails.length; i++) {
    for (let j = i + 1; j < refTails.length; j++) {
      const diff = Math.abs(refTails[i] - refTails[j]);
      if (diff <= 3 || diff >= 7) {
        const mid = (refTails[i] + refTails[j]) / 2;
        if (Number.isInteger(mid)) extendedTails.add(mid % 10);
      }
    }
  }
  
  // 转成带分数的格式
  const result = [];
  extendedTails.forEach(t => {
    result.push([t, refTails.includes(t) ? 10 : 5]);
  });
  
  return result.sort((a, b) => b[1] - a[1]).slice(0, 10);
}

function predictTailsMode5(sourceTails, sourceIdx, allDraws) {
  // 模式5：混合模式（转移 + 全局高频 + 近期高频）
  const scores = new Map();
  for (let t = 0; t <= 9; t++) scores.set(t, 0);
  
  // 转移频率（权重6）
  const mode1 = predictTailsMode1(sourceTails, sourceIdx, allDraws, 50);
  mode1.forEach(([t, s]) => scores.set(t, scores.get(t) + s * 6));
  
  // 全局高频（权重28）
  const mode2 = predictTailsMode2(sourceTails, sourceIdx, allDraws, 50);
  const maxGlobal = Math.max(1, ...mode2.map(([_, s]) => s));
  mode2.forEach(([t, s]) => scores.set(t, scores.get(t) + (s / maxGlobal) * 28));
  
  // 上一期重叠（权重6）
  if (sourceIdx > 0) {
    const refTails = tails(allDraws[sourceIdx - 1].front);
    refTails.forEach(t => scores.set(t, scores.get(t) + 6));
  }
  
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

// ===== 主回测 =====
console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║  🧪 尾号预测准确率分析（5种预测模式对比）                          ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

const allDraws = picker.ALL_DRAWS;
const TEST_COUNT = 80;
const startIdx = allDraws.length - TEST_COUNT - 1;

console.log(`📊 数据范围：${allDraws[0].issue} ~ ${allDraws[allDraws.length - 1].issue}（共${allDraws.length}期）`);
console.log(`📊 测试区间：${allDraws[startIdx].issue} ~ ${allDraws[allDraws.length - 1].issue}（共${TEST_COUNT}期）\n`);

// 5种预测模式
const modes = [
  { name: "转移频率", fn: predictTailsMode1 },
  { name: "全局高频", fn: predictTailsMode2 },
  { name: "近期高频", fn: predictTailsMode3 },
  { name: "上期+等差", fn: predictTailsMode4 },
  { name: "混合模式", fn: predictTailsMode5 },
];

// 统计每种模式的准确率
const modeStats = modes.map(() => ({
  top1Hit: 0, top3Hit: 0, top5Hit: 0,
  top1Total: 0, top3Total: 0, top5Total: 0,
  tailCoverage: 0, // 预测的尾号覆盖了开奖号码多少个尾号
}));

for (let t = 0; t < TEST_COUNT; t++) {
  const targetIdx = allDraws.length - 1 - t;
  const sourceIdx = targetIdx - 1;
  
  if (sourceIdx < 0) continue;
  
  const targetTails = tails(allDraws[targetIdx].front);
  const sourceTails = tails(allDraws[sourceIdx].front);
  
  modes.forEach((mode, mi) => {
    const predicted = mode.fn(sourceTails, sourceIdx, allDraws);
    const predTailsTop1 = new Set(predicted.slice(0, 1).map(([t]) => t));
    const predTailsTop3 = new Set(predicted.slice(0, 3).map(([t]) => t));
    const predTailsTop5 = new Set(predicted.slice(0, 5).map(([t]) => t));
    
    // Top1命中：开奖号码的尾号是否在预测Top1中
    const hit1 = targetTails.some(t => predTailsTop1.has(t));
    const hit3 = targetTails.some(t => predTailsTop3.has(t));
    const hit5 = targetTails.some(t => predTailsTop5.has(t));
    
    modeStats[mi].top1Hit += hit1 ? 1 : 0;
    modeStats[mi].top3Hit += hit3 ? 1 : 0;
    modeStats[mi].top5Hit += hit5 ? 1 : 0;
    modeStats[mi].top1Total++;
    modeStats[mi].top3Total++;
    modeStats[mi].top5Total++;
    
    // 尾号覆盖率：预测Top5覆盖了开奖号码的几个尾号
    const coverage = targetTails.filter(t => predTailsTop5.has(t)).length;
    modeStats[mi].tailCoverage += coverage;
  });
}

// 输出结果
console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║                        📊 预测准确率对比                            ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

console.log("预测模式      | Top1命中率 | Top3命中率 | Top5命中率 | 平均覆盖数");
console.log("─".repeat(70));

modes.forEach((mode, mi) => {
  const stats = modeStats[mi];
  const top1Rate = (stats.top1Hit / stats.top1Total * 100).toFixed(1);
  const top3Rate = (stats.top3Hit / stats.top3Total * 100).toFixed(1);
  const top5Rate = (stats.top5Hit / stats.top5Total * 100).toFixed(1);
  const avgCoverage = (stats.tailCoverage / stats.top5Total).toFixed(2);
  
  console.log(
    `${mode.name.padEnd(12)} | ${top1Rate.padStart(8)}% | ${top3Rate.padStart(8)}% | ${top5Rate.padStart(8)}% | ${avgCoverage.padStart(8)}`
  );
});

// 找出最佳模式
const bestModeIdx = modeStats.reduce((bestIdx, stats, idx) => {
  const bestRate = modeStats[bestIdx].top5Hit / modeStats[bestIdx].top5Total;
  const currentRate = stats.top5Hit / stats.top5Total;
  return currentRate > bestRate ? idx : bestIdx;
}, 0);

console.log("\n" + "═".repeat(70));
console.log(`🏆 最佳预测模式: ${modes[bestModeIdx].name}`);
console.log(`   Top5命中率: ${(modeStats[bestModeIdx].top5Hit / modeStats[bestModeIdx].top5Total * 100).toFixed(1)}%`);
console.log(`   平均覆盖数: ${(modeStats[bestModeIdx].tailCoverage / modeStats[bestModeIdx].top5Total).toFixed(2)}`);

// 分析各尾号的预测准确率
console.log("\n" + "═".repeat(70));
console.log("📊 各尾号预测准确率（使用最佳模式）：");

const tailAccuracy = new Map();
for (let t = 0; t <= 9; t++) tailAccuracy.set(t, { predicted: 0, hit: 0 });

for (let t = 0; t < TEST_COUNT; t++) {
  const targetIdx = allDraws.length - 1 - t;
  const sourceIdx = targetIdx - 1;
  if (sourceIdx < 0) continue;
  
  const targetTails = tails(allDraws[targetIdx].front);
  const sourceTails = tails(allDraws[sourceIdx].front);
  
  const predicted = modes[bestModeIdx].fn(sourceTails, sourceIdx, allDraws);
  const predTop5 = predicted.slice(0, 5).map(([t]) => t);
  
  predTop5.forEach(t => {
    tailAccuracy.get(t).predicted++;
    if (targetTails.includes(t)) {
      tailAccuracy.get(t).hit++;
    }
  });
}

console.log("\n尾号 | 预测次数 | 命中次数 | 命中率");
console.log("─".repeat(40));

const tailAccArray = [...tailAccuracy.entries()].sort((a, b) => b[1].hit - a[1].hit);
tailAccArray.forEach(([tail, stats]) => {
  const rate = stats.predicted > 0 ? (stats.hit / stats.predicted * 100).toFixed(1) : "N/A";
  console.log(`  ${tail}  | ${String(stats.predicted).padStart(6)}   | ${String(stats.hit).padStart(6)}   | ${rate.padStart(5)}%`);
});

// 优化建议
console.log("\n" + "═".repeat(70));
console.log("📋 优化建议：");

const currentMode = modes[4]; // 当前使用混合模式
const bestMode = modes[bestModeIdx];

if (bestModeIdx !== 4) {
  console.log(`1. 预测模式：考虑切换到「${bestMode.name}」模式，Top5命中率提升 ${(modeStats[bestModeIdx].top5Hit / modeStats[bestModeIdx].top5Total * 100 - modeStats[4].top5Hit / modeStats[4].top5Total * 100).toFixed(1)}pp`);
}

// 分析高命中尾号
const highHitTails = tailAccArray.filter(([_, stats]) => stats.predicted >= 10 && stats.hit / stats.predicted > 0.5);
if (highHitTails.length > 0) {
  console.log(`2. 高命中尾号：${highHitTails.map(([t]) => t).join(', ')}，可适当增加权重`);
}

const lowHitTails = tailAccArray.filter(([_, stats]) => stats.predicted >= 10 && stats.hit / stats.predicted < 0.3);
if (lowHitTails.length > 0) {
  console.log(`3. 低命中尾号：${lowHitTails.map(([t]) => t).join(', ')}，可适当降低权重`);
}

// 输出JSON报告
const report = {
  timestamp: new Date().toISOString(),
  testConfig: {
    testCount: TEST_COUNT,
    dataRange: `${allDraws[0].issue} ~ ${allDraws[allDraws.length - 1].issue}`,
  },
  modeResults: modes.map((mode, mi) => ({
    name: mode.name,
    top1HitRate: parseFloat((modeStats[mi].top1Hit / modeStats[mi].top1Total * 100).toFixed(1)),
    top3HitRate: parseFloat((modeStats[mi].top3Hit / modeStats[mi].top3Total * 100).toFixed(1)),
    top5HitRate: parseFloat((modeStats[mi].top5Hit / modeStats[mi].top5Total * 100).toFixed(1)),
    avgCoverage: parseFloat((modeStats[mi].tailCoverage / modeStats[mi].top5Total).toFixed(2)),
  })),
  bestMode: modes[bestModeIdx].name,
  tailAccuracy: Object.fromEntries(tailAccArray.map(([t, stats]) => [t, {
    predicted: stats.predicted,
    hit: stats.hit,
    hitRate: stats.predicted > 0 ? parseFloat((stats.hit / stats.predicted * 100).toFixed(1)) : null,
  }])),
};

fs.writeFileSync(
  path.join(__dirname, 'analysis_output', 'tail_prediction_accuracy_report.json'),
  JSON.stringify(report, null, 2)
);

console.log("\n📁 报告已保存: analysis_output/tail_prediction_accuracy_report.json");
