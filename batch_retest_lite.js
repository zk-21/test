// batch_retest_lite.js — 轻量级批量回测（提取核心算法）
const fs = require('fs');
const path = require('path');

// 读取 script.js 提取关键函数
const scriptContent = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf-8');

// 提取 rowIssues 映射（从 createBuiltInDrawBalls 函数）
const drawsMatch = scriptContent.match(/const draws = \[([\s\S]*?)\];/);
if (!drawsMatch) {
  console.log('无法找到 draws 数据');
  process.exit(1);
}

// 解析 draws 数据
const drawsLines = drawsMatch[1].split('\n').filter(l => l.includes('issue:'));
const draws = [];
drawsLines.forEach(line => {
  const issueMatch = line.match(/issue:\s*"(\d+)"/);
  const frontMatch = line.match(/front:\s*\[([\d,\s]+)\]/);
  const backMatch = line.match(/back:\s*\[([\d,\s]+)\]/);
  if (issueMatch && frontMatch && backMatch) {
    draws.push({
      issue: issueMatch[1],
      front: frontMatch[1].split(',').map(s => parseInt(s.trim())),
      back: backMatch[1].split(',').map(s => parseInt(s.trim()))
    });
  }
});

console.log(`解析到 ${draws.length} 期数据`);
console.log(`期号范围: ${draws[0]?.issue} ~ ${draws[draws.length-1]?.issue}`);

// 构建 rowIssues 映射
const rowIssues = {};
draws.forEach((d, i) => {
  rowIssues[i + 1] = d.issue;
});

// 构建期号到行号的映射
const issueToRow = {};
Object.entries(rowIssues).forEach(([row, issue]) => {
  issueToRow[issue] = Number(row);
});

// 构建每行的号码数据
const ballsByRow = new Map();
draws.forEach((d, i) => {
  const row = i + 1;
  ballsByRow.set(row, { front: d.front, back: d.back });
});

console.log(`\n数据覆盖:`);
console.log(`  行号: 1 ~ ${draws.length}`);
console.log(`  期号: ${rowIssues[1]} ~ ${rowIssues[draws.length]}`);

// 生成跨10期的配对
const step = 10;
const pairs = [];
const issues = Object.keys(issueToRow).map(Number).sort((a, b) => a - b);
issues.forEach(issue => {
  const targetIssue = String(Number(issue) + step);
  if (issueToRow[targetIssue]) {
    pairs.push([issue, targetIssue]);
  }
});

console.log(`\n可回测配对数: ${pairs.length}`);
console.log(`配对范围: ${pairs[0]?.[0]}→${pairs[0]?.[1]} 到 ${pairs[pairs.length-1]?.[0]}→${pairs[pairs.length-1]?.[1]}`);

// 输出前5对供验证
console.log(`\n前5对配对:`);
pairs.slice(0, 5).forEach(([src, tgt]) => {
  const srcRow = issueToRow[src];
  const tgtRow = issueToRow[tgt];
  const srcData = ballsByRow.get(srcRow);
  const tgtData = ballsByRow.get(tgtRow);
  console.log(`  ${src}(row${srcRow}) [${srcData.front.join(',')}] → ${tgt}(row${tgtRow}) [${tgtData.front.join(',')}]`);
});

console.log(`\n提示: 完整算法回测需要在浏览器中打开 verify_image_pair.html?mode=batch&step=10`);
