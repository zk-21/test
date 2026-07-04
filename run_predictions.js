/**
 * 运行optimized_picker.js的真实预测算法
 * 从2025101到2025111期生成预测结果
 */

const fs = require('fs');
const path = require('path');

// 加载optimized_picker.js的内容
const pickerPath = path.join(__dirname, 'optimized_picker.js');
let pickerCode = fs.readFileSync(pickerPath, 'utf8');

// 移除命令行参数处理部分，避免自动执行
pickerCode = pickerCode.replace(/if \(args\.includes\("--backtest"\)[\s\S]*?console\.log\("\\n✅ 分析完成\\n"\);/, '');

// 使用vm模块安全执行
const vm = require('vm');
const sandbox = { 
  console: { 
    log: () => {}, // 静默日志
    error: () => {}
  },
  process: { argv: [] },
  args: [],
  require: require,
  module: module,
  __dirname: __dirname
};

// 执行代码，获取函数
vm.createContext(sandbox);
vm.runInContext(pickerCode, sandbox);

// 获取关键函数和数据
const { predict, predictBack, ALL_DRAWS, issueMap } = sandbox;

if (!predict || !predictBack || !ALL_DRAWS) {
  console.error('无法加载预测函数');
  process.exit(1);
}

console.log(`✅ 成功加载预测引擎`);
console.log(`   - 历史数据: ${ALL_DRAWS.length} 期`);
console.log(`   - 预测函数: predict(), predictBack()`);

// 生成从2025101到2025111的预测
const predictions = [];

// 源期号列表（前一期作为源，下一期作为目标）
const sourceIssues = [];
for (let i = 0; i < ALL_DRAWS.length - 1; i++) {
  const srcIssue = ALL_DRAWS[i].issue;
  const tgtIssue = ALL_DRAWS[i + 1].issue;
  
  // 只处理2025101到2025111范围
  const srcNum = parseInt(srcIssue.slice(4));
  const tgtNum = parseInt(tgtIssue.slice(4));
  
  if (srcNum >= 101 && srcNum <= 110 && tgtNum >= 102 && tgtNum <= 111) {
    sourceIssues.push({ srcIssue, tgtIssue, srcIdx: i });
  }
}

console.log(`\n📊 准备生成 ${sourceIssues.length} 期预测...`);

// 对每个期号对生成预测
for (const { srcIssue, tgtIssue, srcIdx } of sourceIssues) {
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
    
    // 提取前5个组合
    const top5 = result.combinations.slice(0, 5).map((combo, idx) => ({
      rank: idx + 1,
      numbers: combo.numbers.sort((a, b) => a - b),
      back: backPred
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
    
    const buLou6 = {
      rank: '补漏6',
      numbers: poolNumbers.slice(0, 6),
      back: backPred
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