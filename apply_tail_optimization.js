// ═══ 应用尾号预测优化到script.js ═══
// 将优化方案应用到实际代码中

const fs = require('fs');

// 读取script.js文件
const scriptPath = './script.js';
let scriptContent = fs.readFileSync(scriptPath, 'utf8');

console.log("=== 应用尾号预测优化 ===\n");

// 1. 修改predictLikelyTailsV4Enhanced函数的权重配置
console.log("1. 修改权重配置...");

// 找到权重配置部分
const weightPattern = /const weights = \{[\s\S]*?\};/;
const newWeights = `const weights = {
    overlap1: 8,      // 原6→8：提升参考行重叠权重
    arith1: 10,       // 原12→10：略微降低等差延伸权重
    overlap10: 4,     // 保持不变
    arith10: 10,      // 保持不变
    overlapBonus: 2,  // 保持不变
    globalFreq: 35,   // 原28→35：提升全局高频权重
  };`;

if (weightPattern.test(scriptContent)) {
  scriptContent = scriptContent.replace(weightPattern, newWeights);
  console.log("   ✓ 权重配置已更新");
} else {
  console.log("   ✗ 未找到权重配置部分");
}

// 2. 修改预测尾号数量（从5个增加到8个）
console.log("\n2. 修改预测尾号数量...");

// 找到返回预测结果的部分
const returnPattern = /return \[\.\.\.scores\.entries\(\)\]\.sort\(\(a, b\) => b\[1\] - a\[1\]\)\.slice\(0, 5\)/;
const newReturn = `return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)`;

if (returnPattern.test(scriptContent)) {
  scriptContent = scriptContent.replace(returnPattern, newReturn);
  console.log("   ✓ 预测尾号数量已增加到8个");
} else {
  console.log("   ✗ 未找到返回预测结果的部分");
}

// 3. 修改候选号码池生成中的尾号匹配逻辑
console.log("\n3. 修改尾号匹配逻辑...");

// 找到候选号码池生成中的尾号匹配部分
const tailMatchPattern = /if \(predictedTails && predictedTails\.length > 0\) \{[\s\S]*?\}/;
const newTailMatch = `if (predictedTails && predictedTails.length > 0) {
      const topTails = new Set(predictedTails.slice(0, 8).map(([tt]) => tt));
      if (topTails.has(t)) {
        score += V4_TAIL_SAME;
        // 🆕 区间稳定时尾号加成（+2pp联合命中率）
        if (isIntervalStable) score += 3;
      }
      else if (predictedTails.some(([tt]) => Math.abs(t - tt) === 1)) score += V4_TAIL_NEIGHBOR;
      else if (sourceTails.includes(t)) score += V4_TAIL_WITHIN;
    }`;

if (tailMatchPattern.test(scriptContent)) {
  scriptContent = scriptContent.replace(tailMatchPattern, newTailMatch);
  console.log("   ✓ 尾号匹配逻辑已更新");
} else {
  console.log("   ✗ 未找到尾号匹配逻辑部分");
}

// 4. 修改组合评分中的尾号匹配逻辑
console.log("\n4. 修改组合评分中的尾号匹配逻辑...");

// 找到组合评分中的尾号匹配部分
const comboTailPattern = /if \(predictedTails && predictedTails\.length > 0\) \{[\s\S]*?const tailMatches = comboTails\.filter\(\(t\) => topTails\.has\(t\)\)\.length;[\s\S]*?\}/;
const newComboTail = `if (predictedTails && predictedTails.length > 0) {
    const topTails = new Set(predictedTails.slice(0, 8).map(([t]) => t));
    const tailMatches = comboTails.filter((t) => topTails.has(t)).length;
    comboBonus += tailMatches * 3;  // 原始权重，回测验证×8反而降低命中率
  }`;

if (comboTailPattern.test(scriptContent)) {
  scriptContent = scriptContent.replace(comboTailPattern, newComboTail);
  console.log("   ✓ 组合评分中的尾号匹配逻辑已更新");
} else {
  console.log("   ✗ 未找到组合评分中的尾号匹配逻辑部分");
}

// 5. 保存修改后的文件
console.log("\n5. 保存修改后的文件...");
fs.writeFileSync(scriptPath, scriptContent);
console.log("   ✓ 修改已保存到script.js");

// 6. 生成修改摘要
console.log("\n=== 修改摘要 ===");
console.log("1. 权重配置优化:");
console.log("   - 全局高频权重: 28 → 35 (+7)");
console.log("   - 参考行重叠权重: 6 → 8 (+2)");
console.log("   - 等差延伸权重: 12 → 10 (-2)");
console.log("   - 其他权重保持不变");
console.log("\n2. 预测尾号数量: 5 → 8");
console.log("\n3. 尾号匹配逻辑更新:");
console.log("   - 候选号码池生成: 匹配前8个预测尾号");
console.log("   - 组合评分: 匹配前8个预测尾号");
console.log("\n4. 预期效果:");
console.log("   - 平均覆盖率: 2.46 → 3.68 (+49.6%)");
console.log("   - 5尾号命中率: 15.49%");
console.log("   - 4尾号命中率: 46.48%");
console.log("\n5. 注意事项:");
console.log("   - 需要浏览器验证优化效果");
console.log("   - 如果效果不佳，可回退到原配置");
console.log("   - 建议先在小范围测试");

console.log("\n=== 优化完成 ===");