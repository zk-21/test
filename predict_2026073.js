/**
 * 基于分析报告的2026073期预测
 * 数据：2025101~2026072，共172期
 * 
 * 核心规律：
 * 1. 区间比主旋律：2:2:1和2:1:2合计33.2%
 * 2. 奇偶比：3:2和2:3合计72.7%
 * 3. 和值：主要区间70-109占72.1%，峰值80-99占48.3%
 * 4. 重号：有重号率72.0%，平均1.01个
 * 5. 近期走势：区间比回归主旋律，和值80-95，奇偶3:2为主
 */

// 加载优化选号系统
const fs = require('fs');
const path = require('path');

// 使用IIFE模式加载optimized_picker.js，避免CLI处理器
const code = fs.readFileSync(path.join(__dirname, 'optimized_picker.js'), 'utf-8');
const wrappedCode = `
(function() {
  var module = { exports: {} };
  var exports = module.exports;
  ${code}
  return { predict: predict, predictNext: predictNext, predictBack: predictBack, ALL_DRAWS: ALL_DRAWS, issueMap: issueMap };
})()
`;

const picker = eval(wrappedCode);

console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║        🎯 大乐透2026073期预测（基于172期数据分析）                  ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

// 获取最后一期数据
const lastDraw = picker.ALL_DRAWS[picker.ALL_DRAWS.length - 1];
console.log(`📍 基准期：${lastDraw.issue} → 前区：[${lastDraw.front.join(', ')}] 后区：[${lastDraw.back.join(', ')}]`);
console.log(`   区间比：${intervalRatio(lastDraw.front).join(':')} | 奇偶比：${oddCount(lastDraw.front)}:${5 - oddCount(lastDraw.front)} | 和值：${sum(lastDraw.front)}\n`);

// 运行预测
console.log("🔮 生成预测...\n");
const result = picker.predictNext(lastDraw.issue);

if (result) {
  console.log("\n" + "═".repeat(70));
  console.log("📊 基于分析报告的选号建议");
  console.log("═".repeat(70));
  
  // 分析报告核心规律应用
  console.log("\n🎯 核心规律应用：");
  console.log("   1. 区间比回归主旋律：2:2:1或2:1:2概率最高（合计33.2%）");
  console.log("   2. 奇偶比：3:2或2:3（合计72.7%），奇数略偏多（54.1%）");
  console.log("   3. 和值：80-95区间概率最高（峰值80-99占48.3%）");
  console.log("   4. 重号：1-2个概率最高（有重号率72.0%）");
  console.log("   5. 近期走势：区间比回归，和值稳定，奇偶3:2为主\n");
  
  // 分析Top5组合
  const top5 = result.combinations.slice(0, 5);
  console.log("🏆 Top5组合分析：");
  top5.forEach((combo, i) => {
    const iv = intervalRatio(combo.numbers);
    const odd = oddCount(combo.numbers);
    const s = sum(combo.numbers);
    const ivMatch = (iv.join(':') === '2:2:1' || iv.join(':') === '2:1:2');
    const oddMatch = (odd === 3 || odd === 2);
    const sumMatch = (s >= 70 && s <= 105);
    
    console.log(`   Top${i+1}: [${combo.numbers.join(', ')}]`);
    console.log(`         区间比：${iv.join(':')} ${ivMatch ? '✅' : '⚠️'} | 奇偶：${odd}:${5-odd} ${oddMatch ? '✅' : '⚠️'} | 和值：${s} ${sumMatch ? '✅' : '⚠️'}`);
  });
  
  // 补漏6分析
  if (result.bulou6) {
    console.log(`\n🔍 补漏6（补盲区策略）：[${result.bulou6.join(', ')}]`);
    console.log("   策略：选择Top5未覆盖的池号码，最大化覆盖盲区");
  }
  
  // 号码池分析
  console.log(`\n📦 号码池分析（${result.pool.length}个号码）：`);
  const poolNumbers = result.pool.map(n => n.number);
  const ivDist = intervalRatio(poolNumbers);
  console.log(`   区间分布：${ivDist.join(':')}`);
  console.log(`   覆盖号码：${poolNumbers.sort((a,b)=>a-b).join(', ')}`);
  
  // 综合推荐
  console.log("\n" + "═".repeat(70));
  console.log("💡 综合推荐（基于分析报告规律）");
  console.log("═".repeat(70));
  
  // 选择最符合规律的组合
  const bestCombo = top5.reduce((best, combo) => {
    const iv = intervalRatio(combo.numbers);
    const odd = oddCount(combo.numbers);
    const s = sum(combo.numbers);
    
    let score = 0;
    // 区间比匹配
    if (iv.join(':') === '2:2:1' || iv.join(':') === '2:1:2') score += 30;
    // 奇偶比匹配
    if (odd === 3 || odd === 2) score += 20;
    // 和值匹配
    if (s >= 80 && s <= 95) score += 25;
    else if (s >= 70 && s <= 105) score += 15;
    // 组合本身分数
    score += combo.score / 10;
    
    return score > best.score ? { combo, score } : best;
  }, { combo: top5[0], score: 0 });
  
  console.log(`\n🎯 首选组合：[${bestCombo.combo.numbers.join(', ')}]`);
  console.log(`   区间比：${intervalRatio(bestCombo.combo.numbers).join(':')}`);
  console.log(`   奇偶比：${oddCount(bestCombo.combo.numbers)}:${5 - oddCount(bestCombo.combo.numbers)}`);
  console.log(`   和值：${sum(bestCombo.combo.numbers)}`);
  console.log(`   跨度：${span(bestCombo.combo.numbers)}`);
  
  // 后区预测
  const backResult = picker.predictBack(picker.ALL_DRAWS.length - 1);
  if (backResult) {
    console.log(`\n🎱 后区预测：${backResult.slice(0, 2).join(', ')}`);
  }
  
  console.log("\n" + "═".repeat(70));
  console.log("⚠️  免责声明：彩票预测仅供参考，投注需谨慎！");
  console.log("═".repeat(70));
}

// 辅助函数
function intervalRatio(nums) {
  const iv = [0, 0, 0];
  nums.forEach(n => {
    if (n <= 12) iv[0]++;
    else if (n <= 23) iv[1]++;
    else iv[2]++;
  });
  return iv;
}

function oddCount(nums) {
  return nums.filter(n => n % 2 === 1).length;
}

function sum(nums) {
  return nums.reduce((a, b) => a + b, 0);
}

function span(nums) {
  return Math.max(...nums) - Math.min(...nums);
}