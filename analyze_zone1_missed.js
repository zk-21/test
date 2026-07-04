// 分析二区号码少于4个时的遗漏情况
const fs = require('fs');
const script = fs.readFileSync('script回测.js', 'utf8');

console.log('分析二区号码少于4个时的遗漏情况...\n');

// 修改脚本，添加详细分析
let modified = script;

// 在回测循环中添加分析
const analysisCode = `
  // ═══ 二区号码少于4个时的遗漏分析 ═══
  console.log("\\n═══════════════════════════════════════════════════════════════");
  console.log("二区号码少于4个时的遗漏分析");
  console.log("═══════════════════════════════════════════════════════════════");
  
  // 统计每期候选池中二区号码的数量
  const zone1Analysis = [];
  results.filter(r => r.poolNums && r.targetNums).forEach(r => {
    const zone1InPool = r.poolNums.filter(n => n >= 13 && n <= 24);
    const zone1InTarget = r.targetNums.filter(n => n >= 13 && n <= 24);
    const missedZone1 = zone1InTarget.filter(n => !r.poolNums.includes(n));
    
    zone1Analysis.push({
      zone1Count: zone1InPool.length,
      zone1InPool,
      zone1InTarget,
      missedZone1,
      hasMissed: missedZone1.length > 0
    });
  });
  
  // 统计二区号码少于4个的情况
  const lessThan4 = zone1Analysis.filter(a => a.zone1Count < 4);
  console.log(\`\\n二区号码少于4个的情况: \${lessThan4.length}次\`);
  
  if (lessThan4.length > 0) {
    // 统计这些情况下被遗漏的二区号码
    const missedFreq = {};
    for (let i = 13; i <= 24; i++) missedFreq[i] = 0;
    
    lessThan4.filter(a => a.hasMissed).forEach(a => {
      a.missedZone1.forEach(n => missedFreq[n]++);
    });
    
    console.log("\\n二区号码少于4个时被遗漏的号码频率:");
    Object.entries(missedFreq)
      .sort((a, b) => b[1] - a[1])
      .filter(([_, count]) => count > 0)
      .forEach(([num, count]) => {
        console.log(\`  号码\${num}: \${count}次\`);
      });
    
    // 统计这些情况下候选池中实际的二区号码
    console.log("\\n这些情况下候选池中的二区号码:");
    lessThan4.slice(0, 5).forEach((a, i) => {
      console.log(\`  例\${i+1}: 候选池二区[\${a.zone1InPool.join(',')}] 目标二区[\${a.zone1InTarget.join(',')}] 漏[\${a.missedZone1.join(',')}]\`);
    });
  }
  
  // 统计二区号码>=4个的情况
  const atLeast4 = zone1Analysis.filter(a => a.zone1Count >= 4);
  console.log(\`\\n二区号码>=4个的情况: \${atLeast4.length}次\`);
  
  if (atLeast4.length > 0) {
    const missedFreq2 = {};
    for (let i = 13; i <= 24; i++) missedFreq2[i] = 0;
    
    atLeast4.filter(a => a.hasMissed).forEach(a => {
      a.missedZone1.forEach(n => missedFreq2[n]++);
    });
    
    console.log("\\n二区号码>=4个时被遗漏的号码频率:");
    Object.entries(missedFreq2)
      .sort((a, b) => b[1] - a[1])
      .filter(([_, count]) => count > 0)
      .forEach(([num, count]) => {
        console.log(\`  号码\${num}: \${count}次\`);
      });
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
