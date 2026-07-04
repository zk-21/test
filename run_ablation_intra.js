// 组内尾号信号消融测试
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const scriptPath = path.join(__dirname, 'script回测.js');
const originalCode = fs.readFileSync(scriptPath, 'utf8');

// 5个信号的评分代码块
const signals = {
  diversity: `  diversityFreq.forEach((count, tail) => {
    const score = (count / maxDiversity) * 4;
    tailScores.set(tail, tailScores.get(tail) + score);
  });`,
  
  consecutive: `  consecutiveFreq.forEach((count, tail) => {
    const score = (count / maxConsecutive) * 3;
    tailScores.set(tail, tailScores.get(tail) + score);
  });`,
  
  arithmetic: `  arithmeticFreq.forEach((count, tail) => {
    const score = (count / maxArithmetic) * 3;
    tailScores.set(tail, tailScores.get(tail) + score);
  });`,
  
  multiSegAnchor: `  // 🆕 多段连续+连接点
  multiSegWithAnchorFreq.forEach((count, tail) => {
    const score = (count / maxMultiSeg) * 8;
    tailScores.set(tail, tailScores.get(tail) + score);
  });`,
  
  arithConsecAnchor: `  // 🆕 等差+连续+连接点
  arithConsecWithAnchorFreq.forEach((count, tail) => {
    const score = (count / maxArithConsec) * 9;
    tailScores.set(tail, tailScores.get(tail) + score);
  });`,
};

// 测试配置
const tests = [
  { name: '基线(全信号)', disable: [] },
  { name: '禁用-多样性', disable: ['diversity'] },
  { name: '禁用-连续', disable: ['consecutive'] },
  { name: '禁用-等差', disable: ['arithmetic'] },
  { name: '禁用-多段连续+连接点', disable: ['multiSegAnchor'] },
  { name: '禁用-等差+连续+连接点', disable: ['arithConsecAnchor'] },
  { name: '仅-多段连续+连接点', disable: ['diversity', 'consecutive', 'arithmetic', 'arithConsecAnchor'] },
  { name: '仅-等差+连续+连接点', disable: ['diversity', 'consecutive', 'arithmetic', 'multiSegAnchor'] },
  { name: '禁用-多样性+连续', disable: ['diversity', 'consecutive'] },
  { name: '禁用-多样性+等差', disable: ['diversity', 'arithmetic'] },
  { name: '禁用-连续+等差', disable: ['consecutive', 'arithmetic'] },
];

function runTest(disableList) {
  let code = originalCode;
  for (const sig of disableList) {
    code = code.replace(signals[sig], `  // [DISABLED] ${sig}`);
  }
  fs.writeFileSync(scriptPath, code);
  
  try {
    // 先运行回测生成CSV，再读取结果
    execSync('node script回测.js', { cwd: __dirname, encoding: 'utf8', timeout: 120000, stdio: 'pipe' });
    const output = execSync('node check_results.js', { cwd: __dirname, encoding: 'utf8', timeout: 30000 });
    const match5 = output.match(/Top5平均命中率: ([\d.]+)%/);
    const matchCov = output.match(/Top5联合覆盖平均: ([\d.]+)球/);
    const matchComb = output.match(/Top5\+补漏6联合覆盖平均: ([\d.]+)球/);
    return {
      top5: match5 ? parseFloat(match5[1]) : 0,
      coverage: matchCov ? parseFloat(matchCov[1]) : 0,
      combined: matchComb ? parseFloat(matchComb[1]) : 0,
    };
  } catch (e) {
    return { top5: 0, coverage: 0, combined: 0, error: e.message.slice(0, 80) };
  }
}

console.log('=== 组内尾号信号消融测试 ===\n');
console.log('测试配置'.padEnd(30) + 'Top5命中率  联合覆盖  联合覆盖(含补漏)');
console.log('-'.repeat(70));

const results = [];
for (const test of tests) {
  const r = runTest(test.disable);
  results.push({ ...test, ...r });
  const indicator = test.name === '基线(全信号)' ? '  基线' : (r.top5 > 76.1 ? '  ↑' : (r.top5 < 76.1 ? '  ↓' : '  ='));
  console.log(
    test.name.padEnd(30) +
    (r.top5.toFixed(1) + '%').padStart(10) +
    (r.coverage.toFixed(2) + '球').padStart(10) +
    (r.combined.toFixed(2) + '球').padStart(12) +
    indicator
  );
}

// 恢复原代码
fs.writeFileSync(scriptPath, originalCode);
console.log('\n已恢复原代码');

// 找出最佳配置
const best = results.filter(r => !r.error).sort((a, b) => b.top5 - a.top5)[0];
console.log(`\n最佳配置: ${best.name} (Top5: ${best.top5}%)`);
