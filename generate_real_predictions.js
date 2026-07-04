/**
 * 使用真实预测算法生成2025101到2025111期的预测
 */

const fs = require('fs');
const path = require('path');

// 加载预测引擎
console.log('加载预测引擎...');
const engine = require('./prediction_engine.js');

const { predict, predictBack, ALL_DRAWS, issueMap } = engine;

console.log(`✅ 成功加载预测引擎`);
console.log(`   - 历史数据: ${ALL_DRAWS.length} 期`);
console.log(`   - 预测函数: predict(), predictBack()`);

// 间隔10期配对：2025101→2025111, 2025102→2025112, ...
const predictions = [];
const INTERVAL = 10;

// 构建间隔10期的配对列表
const filteredPairs = [];
for (let i = 0; i < ALL_DRAWS.length; i++) {
  const srcIssue = ALL_DRAWS[i].issue;
  const srcNum = parseInt(srcIssue.slice(4));
  const tgtNum = srcNum + INTERVAL;
  const tgtIssue = srcIssue.slice(0, 4) + String(tgtNum).padStart(3, "0");
  
  if (issueMap[tgtIssue]) {
    filteredPairs.push({ srcIssue, tgtIssue, srcIdx: i });
  }
}

console.log(`\n📊 准备生成 ${filteredPairs.length} 期预测 (间隔${INTERVAL}期)...`);

// 对每个期号对生成预测
for (const { srcIssue, tgtIssue, srcIdx } of filteredPairs) {
  console.log(`\n处理 ${srcIssue} → ${tgtIssue}...`);
  
  try {
    // 调用真实预测函数
    const result = predict(srcIssue, tgtIssue, true); // fastMode=true
    
    if (!result) {
      console.log(`  ⚠️ 预测失败: ${srcIssue} → ${tgtIssue}`);
      continue;
    }
    
    // 获取后区预测
    const backPred = predictBack(srcIdx);
    
    // 获取目标期实际号码（用于验证）
    const targetDraw = issueMap[tgtIssue];
    
    // 提取前5个组合，每个组合使用不同的后区对
    const backPairs = [];
    // 从6个后区预测中生成不同的2号码组合
    for (let i = 0; i < backPred.length; i++) {
      for (let j = i + 1; j < backPred.length; j++) {
        backPairs.push([backPred[i], backPred[j]]);
      }
    }
    // 取前5个不同的后区对
    const top5 = result.combinations.slice(0, 5).map((combo, idx) => ({
      rank: idx + 1,
      numbers: combo.numbers.sort((a, b) => a - b),
      back: backPairs[idx % backPairs.length]
    }));
    
    // 生成补漏6：从池中选择Top5未覆盖的号码
    const top5Covered = new Set();
    top5.forEach(t => t.numbers.forEach(n => top5Covered.add(n)));
    
    // 从池中选择未覆盖的高分号码
    const poolNumbers = result.pool
      .filter(e => !top5Covered.has(e.number))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(e => e.number)
      .sort((a, b) => a - b);
    
    // 如果不够6个，从池中补充
    while (poolNumbers.length < 6) {
      const remaining = result.pool
        .filter(e => !poolNumbers.includes(e.number))
        .sort((a, b) => b.score - a.score);
      if (remaining.length > 0) {
        poolNumbers.push(remaining[0].number);
      } else {
        break;
      }
    }
    
    // 补漏6使用第6个后区对（如果有的话）
    const buLou6BackPair = backPairs.length > 5 ? backPairs[5] : backPairs[0];
    const buLou6 = {
      rank: '补漏6',
      numbers: poolNumbers.slice(0, 6),
      back: buLou6BackPair
    };
    
    // 构建预测结果
    const prediction = {
      srcIssue,
      tgtIssue,
      srcFront: result.sourceFront,
      tgtFront: targetDraw ? targetDraw.front : null,
      tgtBack: targetDraw ? targetDraw.back : null,
      top5,
      buLou6,
      backPred
    };
    
    predictions.push(prediction);
    
    // 显示简要信息
    console.log(`  ✅ Top1: ${top5[0].numbers.join(',')} | 后区: ${backPred.join(',')}`);
    console.log(`  ✅ 补漏6: ${buLou6.numbers.join(',')}`);
    
  } catch (err) {
    console.error(`  ❌ 错误: ${err.message}`);
    console.error(err.stack);
  }
}

// 保存预测结果到JSON文件
const outputPath = path.join(__dirname, 'real_predictions_2025101_2025111.json');
fs.writeFileSync(outputPath, JSON.stringify(predictions, null, 2), 'utf8');

console.log(`\n✅ 预测完成！结果已保存到: ${outputPath}`);
console.log(`   - 共生成 ${predictions.length} 期预测`);
console.log(`   - 每期包含 Top1-5 + 补漏6 + 后区预测`);

// 显示样例
if (predictions.length > 0) {
  const sample = predictions[0];
  console.log(`\n📋 样例 (${sample.srcIssue} → ${sample.tgtIssue}):`);
  console.log(`   源号码: ${sample.srcFront.join(',')}`);
  console.log(`   目标号码: ${sample.tgtFront ? sample.tgtFront.join(',') : '未知'}`);
  console.log(`   Top1: ${sample.top5[0].numbers.join(',')}`);
  console.log(`   Top2: ${sample.top5[1].numbers.join(',')}`);
  console.log(`   Top3: ${sample.top5[2].numbers.join(',')}`);
  console.log(`   Top4: ${sample.top5[3].numbers.join(',')}`);
  console.log(`   Top5: ${sample.top5[4].numbers.join(',')}`);
  console.log(`   补漏6: ${sample.buLou6.numbers.join(',')}`);
  console.log(`   后区: ${sample.backPred.join(',')}`);
}