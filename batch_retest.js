// batch_retest.js — 用 jsdom 加载完整 script.js 进行批量回测
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// 读取 script.js 和 verify_image_pair.html 的内容
const scriptJs = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf-8');
const htmlContent = fs.readFileSync(path.join(__dirname, 'verify_image_pair.html'), 'utf-8');

// 提取 verify_image_pair.html 中的内联脚本
const inlineScriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
const inlineScript = inlineScriptMatch ? inlineScriptMatch[1] : '';

// 创建 jsdom 环境
const dom = new JSDOM(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
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
  <h2 id="versionPreviewTitle"></h2>
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
</body>
</html>`, {
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  url: 'http://localhost/verify_image_pair.html?mode=batch&step=10'
});

const { window } = dom;

// 等待脚本执行完成
setTimeout(() => {
  const resultEl = window.document.getElementById('result');
  if (resultEl) {
    try {
      const result = JSON.parse(resultEl.textContent);
      console.log(JSON.stringify(result, null, 2));
    } catch (e) {
      console.log('Result text:', resultEl.textContent);
    }
  } else {
    console.log('No result element found');
  }
  dom.window.close();
}, 5000);
