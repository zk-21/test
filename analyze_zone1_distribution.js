// 分析候选池中二区号码的实际分布
const fs = require('fs');
const script = fs.readFileSync('script回测.js', 'utf8');

console.log('分析候选池中二区号码的实际分布...\n');

// 修改脚本，添加二区号码分布统计
let modified = script;

// 在回测循环中添加统计
const analysisCode = `
  // ═══ 候选池二区号码分布分析 ═══
  console.log("\\n═══════════════════════════════════════════════════════════════");
  console.log("候选池中二区(13-24)号码分布分析");
  console.log("═══════════════════════════════════════════════════════════════");
  
  // 统计每期候选池中二区号码的数量
  const zone1Counts = [];
  results.filter(r => r.poolNums).forEach(r => {
    const zone1Count = r.poolNums.filter(n => n >= 13 && n <= 24).length;
    zone1Counts.push(zone1Count);
  });
  
  // 统计分布
  const distribution = {};
  zone1Counts.forEach(count => {
    distribution[count] = (distribution[count] || 0) + 1;
  });
  
  console.log("\\n候选池中二区号码数量分布:");
  for (let count = 0; count <= 10; count++) {
    const times = distribution[count] || 0;
    if (times > 0) {
      const pct = (times / zone1Counts.length * 100).toFixed(1);
      console.log(\`  \${count}个: \${times}次 (\${pct}%)\`);
    }
  }
  
  // 计算平均值
  const avgZone1 = zone1Counts.reduce((a, b) => a + b, 0) / zone1Counts.length;
  console.log(\`\\n平均二区号码数量: \${avgZone1.toFixed(2)}个\`);
  
  // 统计二区号码少于4个的情况
  const lessThan4 = zone1Counts.filter(c => c < 4).length;
  console.log(\`二区号码少于4个的情况: \${lessThan4}次 (\${(lessThan4/zone1Counts.length*100).toFixed(1)}%)\`);
  
  // 统计二区号码等于4个或更多的情况
  const atLeast4 = zone1Counts.filter(c => c >= 4).length;
  console.log(\`二区号码>=4个的情况: \${atLeast4}次 (\${(atLeast4/zone1Counts.length*100).toFixed(1)}%)\`);
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
