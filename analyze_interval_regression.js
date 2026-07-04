// 分析各区间的极值回归情况
const fs = require('fs');
const script = fs.readFileSync('script回测.js', 'utf8');

console.log('分析各区间的极值回归情况...\n');

// 修改脚本，添加区间回归分析
let modified = script;

// 在回测循环之前添加区间回归分析
const analysisCode = `
  // ═══ 区间回归分析 ═══
  console.log("\\n═══════════════════════════════════════════════════════════════");
  console.log("区间极值回归分析");
  console.log("═══════════════════════════════════════════════════════════════");
  
  // 收集历史区间数据
  const intervalHistory = [];
  for (let r = 1; r <= drawRows; r++) {
    const balls = allBalls.filter(b => b.zone === "front" && b.row === r && ballHasColor(b, sampleRedColor));
    const nums = [...new Set(balls.map(b => b.number))].sort((a, b) => a - b);
    if (nums.length === 5) {
      const iv = intervalRatio(nums);
      intervalHistory.push({ row: r, iv, nums });
    }
  }
  
  // 分析极值回归
  const regressionStats = {
    low0: { count: 0, regressed: 0, avgIncrease: 0 }, // 一区极低(=0)
    low1: { count: 0, regressed: 0, avgIncrease: 0 }, // 二区极低(=0)
    low2: { count: 0, regressed: 0, avgIncrease: 0 }, // 三区极低(=0)
    high0: { count: 0, regressed: 0, avgDecrease: 0 }, // 一区极高(>=4)
    high1: { count: 0, regressed: 0, avgDecrease: 0 }, // 二区极高(>=4)
    high2: { count: 0, regressed: 0, avgDecrease: 0 }, // 三区极高(>=4)
  };
  
  for (let i = 1; i < intervalHistory.length; i++) {
    const prev = intervalHistory[i - 1];
    const curr = intervalHistory[i];
    
    for (let z = 0; z < 3; z++) {
      // 极低值(=0)
      if (prev.iv[z] === 0) {
        regressionStats[\`low\${z}\`].count++;
        if (curr.iv[z] > 0) {
          regressionStats[\`low\${z}\`].regressed++;
          regressionStats[\`low\${z}\`].avgIncrease += curr.iv[z];
        }
      }
      
      // 极高值(>=4)
      if (prev.iv[z] >= 4) {
        regressionStats[\`high\${z}\`].count++;
        if (curr.iv[z] < 4) {
          regressionStats[\`high\${z}\`].regressed++;
          regressionStats[\`high\${z}\`].avgDecrease += (prev.iv[z] - curr.iv[z]);
        }
      }
    }
  }
  
  console.log("\\n极值回归统计:");
  const zoneNames = ['一区(1-12)', '二区(13-24)', '三区(25-35)'];
  
  for (let z = 0; z < 3; z++) {
    const low = regressionStats[\`low\${z}\`];
    const high = regressionStats[\`high\${z}\`];
    
    console.log(\`\\n\${zoneNames[z]}:\`);
    
    if (low.count > 0) {
      const regRate = (low.regressed / low.count * 100).toFixed(1);
      const avgInc = low.regressed > 0 ? (low.avgIncrease / low.regressed).toFixed(2) : 0;
      console.log(\`  极低值(=0): \${low.count}次，回归\${low.regressed}次 (\${regRate}%)，平均增加\${avgInc}个\`);
    } else {
      console.log(\`  极低值(=0): 无数据\`);
    }
    
    if (high.count > 0) {
      const regRate = (high.regressed / high.count * 100).toFixed(1);
      const avgDec = high.regressed > 0 ? (high.avgDecrease / high.regressed).toFixed(2) : 0;
      console.log(\`  极高值(>=4): \${high.count}次，回归\${high.regressed}次 (\${regRate}%)，平均减少\${avgDec}个\`);
    } else {
      console.log(\`  极高值(>=4): 无数据\`);
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
