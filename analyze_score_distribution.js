// 分析未覆盖号码的分值分布
const fs = require('fs');
const script = fs.readFileSync('script回测.js', 'utf8');

console.log('分析未覆盖号码的分值分布...\n');

// 修改脚本，添加分值统计
let modified = script;

// 在候选池生成部分添加分值统计
const scoreAnalysisCode = `
  // ═══ 分值分布分析 ═══
  console.log("\\n═══════════════════════════════════════════════════════════════");
  console.log("候选号码分值分布分析");
  console.log("═══════════════════════════════════════════════════════════════");
  
  // 获取所有候选号码的分值
  const allCandidates = frontSample.candidates || [];
  const candidateScores = frontSample.candidateScores || [];
  
  // 分析未覆盖号码的分值
  const missedScores = [];
  const coveredScores = [];
  
  results.filter(r => r.missedBalls && r.poolNums).forEach(r => {
    const poolSet = new Set(r.poolNums);
    const missedSet = new Set(r.missedBalls);
    
    // 这里需要获取每个号码的分值，但当前脚本没有存储
    // 我们需要修改主脚本来记录分值
  });
  
  console.log("\\n注意：需要修改主脚本来记录每个候选号码的具体分值");
  console.log("当前只能看到候选池号码，无法看到具体分值");
`;

// 实际上，我们需要修改主脚本来记录分值
// 让我创建一个更简单的分析：查看哪些号码容易进入候选池

const simpleAnalysisCode = `
  // ═══ 候选池号码频率分析 ═══
  console.log("\\n═══════════════════════════════════════════════════════════════");
  console.log("候选池号码频率分析（33球池）");
  console.log("═══════════════════════════════════════════════════════════════");
  
  // 统计每个号码进入候选池的频率
  const poolFreq = {};
  for (let i = 1; i <= 35; i++) poolFreq[i] = 0;
  
  results.filter(r => r.poolNums).forEach(r => {
    r.poolNums.forEach(n => poolFreq[n]++);
  });
  
  // 按频率排序
  const poolFreqSorted = Object.entries(poolFreq)
    .sort((a, b) => b[1] - a[1]);
  
  console.log("\\n号码进入候选池频率（从高到低）:");
  poolFreqSorted.forEach(([num, count]) => {
    const pct = (count / cnt * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / cnt * 20));
    console.log(\`  号码\${num.padStart(2)}: \${count}次 (\${pct}%) \${bar}\`);
  });
  
  // 分析未覆盖号码的候选池频率
  console.log("\\n未覆盖号码的候选池进入频率:");
  const missedPoolFreq = {};
  results.filter(r => r.missedBalls && r.poolNums).forEach(r => {
    const poolSet = new Set(r.poolNums);
    r.missedBalls.forEach(missed => {
      if (!missedPoolFreq[missed]) missedPoolFreq[missed] = { total: 0, inPool: 0 };
      missedPoolFreq[missed].total++;
      if (poolSet.has(missed)) missedPoolFreq[missed].inPool++;
    });
  });
  
  Object.entries(missedPoolFreq)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([num, data]) => {
      const rate = (data.inPool / data.total * 100).toFixed(1);
      console.log(\`  号码\${num.padStart(2)}: 被漏\${data.total}次，其中\${data.inPool}次在候选池中 (\${rate}%)\`);
    });
`;

// 替换分析代码
modified = modified.replace(
  'console.log("\\n完成!");',
  simpleAnalysisCode + '\nconsole.log("\\n完成!");'
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
