// batch_retest_v2.js — 用 jsdom 运行完整算法批量回测（改进版）
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

console.log('读取脚本文件...');
const xlsxPath = path.join(__dirname, 'vendor', 'xlsx.full.min.js');
const html2canvasPath = path.join(__dirname, 'vendor', 'html2canvas.min.js');
const scriptPath = path.join(__dirname, 'script.js');

const xlsxSrc = fs.existsSync(xlsxPath) ? fs.readFileSync(xlsxPath, 'utf-8') : '';
const html2canvasSrc = fs.existsSync(html2canvasPath) ? fs.readFileSync(html2canvasPath, 'utf-8') : '';
const scriptSrc = fs.readFileSync(scriptPath, 'utf-8');

console.log(`script.js: ${(scriptSrc.length / 1024).toFixed(0)}KB`);

// 构建完整 HTML，包含所有必要的 DOM 元素
const html = `<!doctype html>
<html><head><meta charset="UTF-8"></head>
<body>
<div id="appLock"></div>
<main id="appRoot">
<section id="agentHomePanel" data-agent-section></section>
<section id="agentControlPanel" data-agent-section></section>
<section id="agentPalettePanel" data-agent-section></section>
<section id="agentBoardPanel" data-agent-section>
  <div id="board" class="board">
    <div><div id="frontBoard"></div></div>
    <div><div id="backBoard"></div></div>
  </div>
</section>
<section id="agentVersionPanel" data-agent-section></section>
<section id="agentImportPanel" data-agent-section></section>
<div class="board-wrap"></div>
<input id="appPassword" />
<button id="toggleAppPasswordButton"></button>
<button id="unlockAppButton"></button>
<p id="appAuthMessage"></p>
<button id="installAppButton"></button>
<p id="installHint"></p>
<span id="displayModeBadge"></span>
<span id="networkStatusBadge"></span>
<input id="rowInput" type="number" value="1" />
<select id="zoneInput"><option value="front">front</option><option value="back">back</option></select>
<input id="numberInput" type="number" value="1" />
<input id="colorInput" type="color" value="#d6202a" />
<input id="sizeInput" type="range" value="25" />
<input id="zoomInput" type="range" value="100" />
<button id="addBallButton"></button>
<button id="eraseButton"></button>
<button id="deleteColorButton"></button>
<button id="addDividerButton"></button>
<button id="clearButton"></button>
<button id="sampleButton"></button>
<button id="clearSampleButton"></button>
<button id="saveHistoryButton"></button>
<button id="saveVersionButton"></button>
<button id="openComparePageButton"></button>
<button id="openComparePageFromHome"></button>
<button id="openCompare90PageButton"></button>
<button id="openCompare90PageFromHome"></button>
<button id="captureBoardButton"></button>
<button id="clearMainBoardButton"></button>
<button id="clearHistoryButton"></button>
<button id="clearVersionsButton"></button>
<strong id="ballCount"></strong>
<span id="currentBaseLabel"></span>
<div id="versionBanner"><span id="versionBannerText"></span></div>
<ol id="historyList"></ol>
<ol id="versionList"></ol>
<input id="versionSearch" />
<button id="downloadVersionsButton"></button>
<input id="importVersionsInput" type="file" />
<button id="compareVersionsButton"></button>
<input id="versionPassword" />
<button id="unlockVersionsButton"></button>
<button id="lockVersionsButton"></button>
<p id="versionAuthMessage"></p>
<div id="versionPreview"></div>
<h3 id="versionPreviewTitle"></h3>
<input id="drawDateInput" />
<textarea id="drawDataInput"></textarea>
<input id="drawFileInput" type="file" />
<button id="generateDrawVersionButton"></button>
<button id="cancelEditDrawVersionButton"></button>
<p id="drawImportMessage"></p>
<div id="versionModal"><h2 id="versionModalTitle"></h2><div id="versionModalBody"></div><button id="closeVersionModalButton"></button></div>
<div id="compareModal">
  <select id="compareVersionOne"></select>
  <select id="compareVersionTwo"></select>
  <select id="compareVersionThree"></select>
  <p id="compareHint"></p>
  <button id="applyCompareButton"></button>
  <button id="saveCompareButton"></button>
  <button id="closeCompareModalButton"></button>
</div>
<textarea id="descInput"></textarea>
<input id="descFileInput" type="file" />
<button id="descAddButton"></button>
<button id="descHelpButton"></button>
<div id="descHelpTip"></div>
<button class="swatch" data-color="#d6202a"></button>
<button class="swatch" data-color="#1768b7"></button>
<button class="swatch" data-color="#14a365"></button>
<button class="swatch" data-color="#f59e0b"></button>
<button class="swatch" data-color="#7c3aed"></button>
<button class="swatch" data-color="#111827"></button>
<pre id="result"></pre>
</main>
<script>
  window.matchMedia = window.matchMedia || function() {
    return { matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} };
  };
  window.alert = function(){};
  window.confirm = function(){ return true; };
  window.navigator.serviceWorker = { register: async () => ({}) };
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem("lottery-page-auth", "true");
</script>
<script>${xlsxSrc}</script>
<script>${html2canvasSrc}</script>
<script>${scriptSrc}</script>
<script>
(function run() {
  const originalRandom = Math.random;
  Math.random = () => 0;

  try {
    applyBalls(createBuiltInDrawBalls(), {
      baseTitle: "BuiltIn",
      rowIssues,
      protectBalls: true,
      persist: false,
    });
  } catch(e) {
    document.getElementById("result").textContent = JSON.stringify({error: "applyBalls failed: " + e.message});
    return;
  }

  // 构建期号到行的映射
  const issueToRow = Object.fromEntries(
    Object.entries(rowIssues).map(([row, issue]) => [issue, Number(row)])
  );
  const ballsByRow = new Map();
  collectBalls().forEach((ball) => {
    const row = Number(ball.row);
    const current = ballsByRow.get(row) || { front: [], back: [] };
    current[ball.zone].push(ball.number);
    ballsByRow.set(row, current);
  });

  function evaluatePair(sourceIssue, targetIssue) {
    const sourceRow = issueToRow[sourceIssue];
    const targetRow = issueToRow[targetIssue];
    if (!sourceRow || !targetRow) return null;

    try {
      const ratioPlan = getActiveSampleRatios();
      const frontRepeatTarget = 0;
      const backRepeatTarget = 0;
      const frontSample = buildSampleNumbers(sourceRow, "front", ratioPlan);
      const backSample = buildSampleNumbers(sourceRow, "back");
      const frontCombos = buildSampleFrontCombos(
        frontSample.candidateEntries, ratioPlan, samplePickCount, sampleIntervals,
        frontSample.ratioSupportMap, frontSample.referenceRows,
        frontRepeatTarget, frontSample.selectedNumbers, frontSample.selectedNumbers
      );
      const backCombos = buildSampleFreeCombos(
        backSample.candidateEntries, sampleBackPickCount, backRepeatTarget, backSample.selectedNumbers
      );
      const variants = buildSingleSamplePlan(frontCombos, backCombos, ratioPlan, 0);
      const target = ballsByRow.get(targetRow) || { front: [], back: [] };
      const targetFront = new Set(target.front);
      const targetBack = new Set(target.back);
      const rows = variants.slice(0, 5).map((variant, index) => {
        const front = variant.front?.numbers || [];
        const back = variant.back?.numbers || [];
        const frontHits = front.filter((n) => targetFront.has(n));
        const backHits = back.filter((n) => targetBack.has(n));
        const totalHits = frontHits.length + backHits.length;
        return {
          rank: index + 1, label: variant.label, front, back,
          frontHits, backHits,
          frontHitRate: Number(((frontHits.length / 5) * 100).toFixed(1)),
          backHitRate: Number(((backHits.length / 2) * 100).toFixed(1)),
          totalHitRate: Number(((totalHits / 7) * 100).toFixed(1)),
          totalHits,
        };
      });
      const totalHitRates = rows.map((row) => row.totalHitRate);
      return {
        sourceIssue, sourceRow, targetIssue, targetRow,
        targetFront: [...target.front].sort((a, b) => a - b),
        targetBack: [...target.back].sort((a, b) => a - b),
        rows,
        summary: {
          top1TotalHitRate: rows[0]?.totalHitRate || 0,
          bestOfTop5TotalHitRate: totalHitRates.length ? Math.max(...totalHitRates) : 0,
          avgTop5TotalHitRate: totalHitRates.length
            ? Number((totalHitRates.reduce((sum, value) => sum + value, 0) / totalHitRates.length).toFixed(2))
            : 0,
        },
      };
    } catch(e) {
      return { sourceIssue, targetIssue, error: e.message };
    }
  }

  function evaluateBatch(step) {
    const issues = Object.keys(issueToRow).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    const pairs = issues
      .map((issue) => [String(issue), String(issue + step)])
      .filter(([si, ti]) => issueToRow[si] && issueToRow[ti])
      .map(([si, ti]) => evaluatePair(si, ti))
      .filter(Boolean);

    const top1Rates = pairs.map(p => p.summary?.top1TotalHitRate || 0);
    const bestRates = pairs.map(p => p.summary?.bestOfTop5TotalHitRate || 0);
    const avgRates = pairs.map(p => p.summary?.avgTop5TotalHitRate || 0);

    return {
      mode: "batch", step, pairCount: pairs.length,
      availableIssueRange: { min: issues[0] || null, max: issues[issues.length - 1] || null },
      summary: {
        avgTop1TotalHitRate: top1Rates.length ? Number((top1Rates.reduce((s, v) => s + v, 0) / top1Rates.length).toFixed(2)) : 0,
        avgBestOfTop5TotalHitRate: bestRates.length ? Number((bestRates.reduce((s, v) => s + v, 0) / bestRates.length).toFixed(2)) : 0,
        avgTop5TotalHitRate: avgRates.length ? Number((avgRates.reduce((s, v) => s + v, 0) / avgRates.length).toFixed(2)) : 0,
        minTop1TotalHitRate: top1Rates.length ? Math.min(...top1Rates) : 0,
        minBestOfTop5TotalHitRate: bestRates.length ? Math.min(...bestRates) : 0,
      },
      pairs,
    };
  }

  // 执行批量回测 step=10
  const result = evaluateBatch(10);
  document.getElementById("result").textContent = JSON.stringify(result, null, 2);
  Math.random = originalRandom;
})();
</script>
</body></html>`;

console.log('创建 jsdom 环境...');
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'http://localhost/batch.html'
});

const { window } = dom;

// 等待执行完成（最多60秒）
let checkCount = 0;
const maxChecks = 600; // 60秒

function checkResult() {
  checkCount++;
  const resultEl = window.document.getElementById('result');
  
  if (resultEl && resultEl.textContent && resultEl.textContent.length > 50) {
    try {
      const result = JSON.parse(resultEl.textContent);
      
      // 输出汇总信息
      console.log('\n' + '='.repeat(70));
      console.log('完整算法批量回测结果（跨10期，step=10）');
      console.log('='.repeat(70));
      console.log(`配对数: ${result.pairCount}`);
      console.log(`期号范围: ${result.availableIssueRange?.min} ~ ${result.availableIssueRange?.max}`);
      console.log(`\n汇总:`);
      console.log(`  平均 Top1 命中率: ${result.summary?.avgTop1TotalHitRate}%`);
      console.log(`  平均 BestOf5 命中率: ${result.summary?.avgBestOfTop5TotalHitRate}%`);
      console.log(`  平均 Top5 命中率: ${result.summary?.avgTop5TotalHitRate}%`);
      console.log(`  最低 Top1 命中率: ${result.summary?.minTop1TotalHitRate}%`);
      console.log(`  最低 BestOf5 命中率: ${result.summary?.minBestOfTop5TotalHitRate}%`);
      
      // 输出每对详情
      console.log('\n' + '-'.repeat(70));
      console.log('各期详情:');
      console.log('-'.repeat(70));
      if (result.pairs) {
        result.pairs.forEach(pair => {
          if (pair.error) {
            console.log(`[${pair.sourceIssue}→${pair.targetIssue}] 错误: ${pair.error}`);
            return;
          }
          const s = pair.summary || {};
          console.log(`[${pair.sourceIssue} R${pair.sourceRow} → ${pair.targetIssue} R${pair.targetRow}] ` +
            `目标前区:[${pair.targetFront?.join(',')}] 后区:[${pair.targetBack?.join(',')}] ` +
            `Top1:${s.top1TotalHitRate}% Best5:${s.bestOfTop5TotalHitRate}% Avg5:${s.avgTop5TotalHitRate}%`);
          if (pair.rows) {
            pair.rows.forEach(r => {
              const fHits = r.frontHits?.join(',') || '无';
              const bHits = r.backHits?.join(',') || '无';
              console.log(`  #${r.rank} 前区[${r.front.join(',')}] 后区[${r.back.join(',')}] ` +
                `前区命中${r.frontHits?.length||0}(${fHits}) 后区命中${r.backHits?.length||0}(${bHits}) ` +
                `总命中率${r.totalHitRate}%`);
            });
          }
        });
      }
      
      console.log('\n' + '='.repeat(70));
    } catch (e) {
      console.log('解析结果失败:', e.message);
      console.log('原始内容:', resultEl.textContent.substring(0, 1000));
    }
    dom.window.close();
    process.exit(0);
  }
  
  if (checkCount >= maxChecks) {
    console.log('超时：等待脚本执行完成（60秒）');
    if (resultEl) {
      console.log('当前结果内容:', resultEl.textContent.substring(0, 500));
    }
    dom.window.close();
    process.exit(1);
  }
  
  if (checkCount % 50 === 0) {
    console.log(`  等待中... ${checkCount / 10}秒`);
  }
  
  setTimeout(checkResult, 100);
}

setTimeout(checkResult, 1000);
