// batch_retest_quick.js — 快速测试几对关键数据
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// 读取 HTML 文件
const htmlPath = path.join(__dirname, 'verify_image_pair.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

// 修改为单对测试模式
const testPairs = [
  ['2026020', '2026030'],
  ['2026021', '2026031'],
  ['2026022', '2026032'],
];

let currentPairIndex = 0;
const results = [];

function runNextPair() {
  if (currentPairIndex >= testPairs.length) {
    console.log('\n========== 汇总结果 ==========');
    results.forEach((r, i) => {
      console.log(`\n配对 ${i + 1}: ${r.sourceIssue} → ${r.targetIssue}`);
      console.log(`  源行 ${r.sourceRow} [${r.sourceFront}] → 目标行 ${r.targetRow} [${r.targetFront}]`);
      console.log(`  Top1 命中率: ${r.summary.top1TotalHitRate}%`);
      console.log(`  Top5 最佳命中率: ${r.summary.bestOfTop5TotalHitRate}%`);
      console.log(`  Top5 平均命中率: ${r.summary.avgTop5TotalHitRate}%`);
      r.rows.forEach((row, j) => {
        console.log(`    #${j + 1} [${row.front.join(',')}] + [${row.back.join(',')}] 命中 ${row.totalHits}球 (${row.totalHitRate}%)`);
      });
    });
    process.exit(0);
    return;
  }

  const [sourceIssue, targetIssue] = testPairs[currentPairIndex];
  console.log(`\n测试配对 ${currentPairIndex + 1}: ${sourceIssue} → ${targetIssue}`);

  // 修改 HTML 中的参数
  const modifiedHtml = htmlContent
    .replace('const mode = params.get("mode") || "single";', 'const mode = "single";')
    .replace('params.get("sourceIssue") || "2026020"', `"${sourceIssue}"`)
    .replace('params.get("targetIssue") || "2026030"', `"${targetIssue}"`);

  const dom = new JSDOM(modifiedHtml, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    url: 'http://localhost/verify_image_pair.html'
  });

  const { window } = dom;

  let checkCount = 0;
  function checkResult() {
    checkCount++;
    const resultEl = window.document.getElementById('result');
    
    if (resultEl && resultEl.textContent && resultEl.textContent.length > 50) {
      try {
        const result = JSON.parse(resultEl.textContent);
        results.push({
          ...result,
          sourceFront: ballsByRowGet(result.sourceRow, 'front'),
          targetFront: ballsByRowGet(result.targetRow, 'front'),
        });
        dom.window.close();
        currentPairIndex++;
        setTimeout(runNextPair, 100);
      } catch (e) {
        console.log('解析失败:', e.message);
        dom.window.close();
        currentPairIndex++;
        setTimeout(runNextPair, 100);
      }
      return;
    }
    
    if (checkCount >= 50) {
      console.log('超时');
      dom.window.close();
      currentPairIndex++;
      setTimeout(runNextPair, 100);
      return;
    }
    
    setTimeout(checkResult, 100);
  }

  // 辅助函数获取号码
  function ballsByRowGet(row, zone) {
    const issueToRow = window.issueToRow || {};
    const ballsByRow = window.ballsByRow || new Map();
    const data = ballsByRow.get(row);
    return data ? data[zone] : [];
  }

  setTimeout(checkResult, 300);
}

runNextPair();
