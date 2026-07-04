// 分析区间比例预测对二区的影响
const fs = require('fs');
const script = fs.readFileSync('script回测.js', 'utf8');

console.log('分析区间比例预测对二区的影响...\n');

// 修改脚本，添加区间比例预测分析
let modified = script;

// 在回测循环中添加区间比例预测分析
const analysisCode = `
  // ═══ 区间比例预测分析 ═══
  console.log("\\n═══════════════════════════════════════════════════════════════");
  console.log("区间比例预测分析");
  console.log("═══════════════════════════════════════════════════════════════");
  
  // 收集预测的区间比例
  const predictedIvs = [];
  const actualIvs = [];
  
  // 遍历回测结果，收集预测和实际的区间比例
  results.filter(r => r.sourceNums && r.targetNums).forEach(r => {
    const sourceIv = intervalRatio(r.sourceNums);
    const targetIv = intervalRatio(r.targetNums);
    
    // 这里需要获取预测的区间比例，但当前脚本没有存储
    // 我们需要分析预测逻辑
  });
  
  // 分析历史区间比例分布
  console.log("\\n历史区间比例分布:");
  const ivDistribution = {};
  for (let r = 1; r <= drawRows; r++) {
    const balls = allBalls.filter(b => b.zone === "front" && b.row === r && ballHasColor(b, sampleRedColor));
    const nums = [...new Set(balls.map(b => b.number))].sort((a, b) => a - b);
    if (nums.length === 5) {
      const iv = intervalRatio(nums);
      const key = iv.join(":");
      ivDistribution[key] = (ivDistribution[key] || 0) + 1;
    }
  }
  
  // 按频率排序
  const sortedIvs = Object.entries(ivDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  sortedIvs.forEach(([iv, count]) => {
    const pct = (count / drawRows * 100).toFixed(1);
    const [a, b, c] = iv.split(":").map(Number);
    console.log(\`  \${iv} (一区\${a}个,二区\${b}个,三区\${c}个): \${count}次 (\${pct}%)\`);
  });
  
  // 分析二区数量分布
  console.log("\\n二区(13-24)数量分布:");
  const zone1Counts = {};
  for (let r = 1; r <= drawRows; r++) {
    const balls = allBalls.filter(b => b.zone === "front" && b.row === r && ballHasColor(b, sampleRedColor));
    const nums = [...new Set(balls.map(b => b.number))].sort((a, b) => a - b);
    if (nums.length === 5) {
      const iv = intervalRatio(nums);
      const count = iv[1]; // 二区数量
      zone1Counts[count] = (zone1Counts[count] || 0) + 1;
    }
  }
  
  for (let count = 0; count <= 5; count++) {
    const times = zone1Counts[count] || 0;
    const pct = (times / drawRows * 100).toFixed(1);
    console.log(\`  \${count}个: \${times}次 (\${pct}%)\`);
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
