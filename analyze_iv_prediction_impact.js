// 分析区间比例预测对二区的具体影响
const fs = require('fs');
const script = fs.readFileSync('script回测.js', 'utf8');

console.log('分析区间比例预测对二区的具体影响...\n');

// 修改脚本，添加详细的预测分析
let modified = script;

// 在回测循环中添加预测分析
const analysisCode = `
  // ═══ 区间比例预测影响分析 ═══
  console.log("\\n═══════════════════════════════════════════════════════════════");
  console.log("区间比例预测对二区的影响分析");
  console.log("═══════════════════════════════════════════════════════════════");
  
  // 分析预测的区间比例
  const predictionAnalysis = [];
  
  for (let r = 60; r <= drawRows; r++) {
    const sourceBalls = allBalls.filter(b => b.zone === "front" && b.row === r && ballHasColor(b, sampleRedColor));
    const sourceNums = [...new Set(sourceBalls.map(b => b.number))].sort((a, b) => a - b);
    
    if (sourceNums.length === 5) {
      const sourceIv = intervalRatio(sourceNums);
      const prediction = predictTargetIntervalRatio(r, sourceIv, allBalls);
      
      // 获取目标期的实际区间比
      const targetBalls = allBalls.filter(b => b.zone === "front" && b.row === r + 1 && ballHasColor(b, sampleRedColor));
      const targetNums = [...new Set(targetBalls.map(b => b.number))].sort((a, b) => a - b);
      
      if (targetNums.length === 5) {
        const targetIv = intervalRatio(targetNums);
        predictionAnalysis.push({
          row: r,
          sourceIv,
          predictedIv: prediction.predictedIv,
          actualIv: targetIv,
          predictedZone1: prediction.predictedIv[1], // 预测的二区数量
          actualZone1: targetIv[1], // 实际的二区数量
          diff: targetIv[1] - prediction.predictedIv[1] // 差值
        });
      }
    }
  }
  
  // 统计预测的二区数量分布
  console.log("\\n预测的二区(13-24)数量分布:");
  const predictedZone1Counts = {};
  predictionAnalysis.forEach(p => {
    predictedZone1Counts[p.predictedZone1] = (predictedZone1Counts[p.predictedZone1] || 0) + 1;
  });
  
  for (let count = 0; count <= 5; count++) {
    const times = predictedZone1Counts[count] || 0;
    const pct = (times / predictionAnalysis.length * 100).toFixed(1);
    console.log(\`  预测\${count}个: \${times}次 (\${pct}%)\`);
  }
  
  // 统计实际的二区数量分布
  console.log("\\n实际的二区(13-24)数量分布:");
  const actualZone1Counts = {};
  predictionAnalysis.forEach(p => {
    actualZone1Counts[p.actualZone1] = (actualZone1Counts[p.actualZone1] || 0) + 1;
  });
  
  for (let count = 0; count <= 5; count++) {
    const times = actualZone1Counts[count] || 0;
    const pct = (times / predictionAnalysis.length * 100).toFixed(1);
    console.log(\`  实际\${count}个: \${times}次 (\${pct}%)\`);
  }
  
  // 统计预测误差
  console.log("\\n预测误差分析:");
  let correct = 0, underPredict = 0, overPredict = 0;
  let totalAbsDiff = 0;
  
  predictionAnalysis.forEach(p => {
    const diff = p.diff;
    totalAbsDiff += Math.abs(diff);
    
    if (diff === 0) correct++;
    else if (diff > 0) underPredict++; // 实际比预测多
    else overPredict++; // 实际比预测少
  });
  
  console.log(\`  预测正确: \${correct}次 (\${(correct/predictionAnalysis.length*100).toFixed(1)}%)\`);
  console.log(\`  预测偏低（实际更多）: \${underPredict}次 (\${(underPredict/predictionAnalysis.length*100).toFixed(1)}%)\`);
  console.log(\`  预测偏高（实际更少）: \${overPredict}次 (\${(overPredict/predictionAnalysis.length*100).toFixed(1)}%)\`);
  console.log(\`  平均绝对误差: \${(totalAbsDiff/predictionAnalysis.length).toFixed(2)}个\`);
  
  // 分析预测偏低时的实际二区数量
  console.log("\\n预测偏低时（预测二区数量<实际）的实际二区数量:");
  const underPredictActual = predictionAnalysis.filter(p => p.diff > 0);
  const underPredictActualCounts = {};
  underPredictActual.forEach(p => {
    underPredictActualCounts[p.actualZone1] = (underPredictActualCounts[p.actualZone1] || 0) + 1;
  });
  
  for (let count = 0; count <= 5; count++) {
    const times = underPredictActualCounts[count] || 0;
    if (times > 0) {
      const pct = (times / underPredictActual.length * 100).toFixed(1);
      console.log(\`  实际\${count}个: \${times}次 (\${pct}%)\`);
    }
  }
`;

// 在输出结果之前添加分析代码
modified = modified.replace(
  'console.log("\\n完成!");',
  analysisCode + '\nconsole.log("\\n完成!");'
);

fs.writeFileSync('script回测_temp.js', modified);

const { execSync } = require('child_process');
try {
  const output = execSync('node script回测_temp.js 2>&1', { encoding: 'utf8', timeout: 180000 });
  console.log(output);
} catch (e) {
  console.error('测试失败:', e.message);
}

try { fs.unlinkSync('script回测_temp.js'); } catch(e) {}
