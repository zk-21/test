/**
 * 多源融合回测脚本 — 测试不同源数量、主源选择、权重配置
 * 
 * 测试内容：
 * 1. 多源数量：3, 4, 5, 6, 7, 8, 9, 10
 * 2. 主源选择：sourceRow (N期), sourceRow+9, sourceRow-1, sourceRow-2, ...
 * 3. 区间比：取目的号码前一期的区间比（修复：不再用源行+9）
 * 4. 权重配置：等权 vs 递减 vs 主源增强
 * 
 * 运行: node backtest_multi_source_fusion.js
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

console.log('=== 多源融合回测 ===\n');
console.log('读取脚本文件...');

const xlsxPath = path.join(__dirname, 'vendor', 'xlsx.full.min.js');
const html2canvasPath = path.join(__dirname, 'vendor', 'html2canvas.min.js');
const scriptPath = path.join(__dirname, 'script.js');
const allDrawsPath = path.join(__dirname, 'all_draws.js');

const xlsxSrc = fs.existsSync(xlsxPath) ? fs.readFileSync(xlsxPath, 'utf-8') : '';
const html2canvasSrc = fs.existsSync(html2canvasPath) ? fs.readFileSync(html2canvasPath, 'utf-8') : '';
const scriptSrc = fs.readFileSync(scriptPath, 'utf-8');
const allDrawsSrc = fs.existsSync(allDrawsPath) ? fs.readFileSync(allDrawsPath, 'utf-8') : '';

console.log('script.js: ' + (scriptSrc.length / 1024).toFixed(0) + 'KB');

// Build HTML to temp file to avoid template literal issues with backticks
const runScript = `
(function run() {
  var originalRandom = Math.random;
  Math.random = function() { return 0; };

  try {
    applyBalls(createBuiltInDrawBalls(), {
      baseTitle: "BuiltIn",
      rowIssues: rowIssues,
      protectBalls: true,
      persist: false,
    });
  } catch(e) {
    document.getElementById("result").textContent = JSON.stringify({error: "applyBalls failed: " + e.message});
    return;
  }

  // Build base data
  var issueToRow = {};
  Object.keys(rowIssues).forEach(function(row) {
    issueToRow[rowIssues[row]] = Number(row);
  });
  var allBalls = collectBalls();
  var drawRows = 0;
  allBalls.forEach(function(b) { if (b.row > drawRows) drawRows = b.row; });
  
  function getFrontNumbers(row) {
    var nums = [];
    var seen = {};
    allBalls.forEach(function(b) {
      if (b.row === row && b.zone === "front" && !seen[b.number]) {
        seen[b.number] = true;
        nums.push(b.number);
      }
    });
    return nums.sort(function(a, b) { return a - b; });
  }
  
  function getIntervalRatioForRow(row) {
    var nums = getFrontNumbers(row);
    if (nums.length !== 5) return null;
    return intervalRatio(nums);
  }

  // Multi-source fusion prediction
  function multiSourcePredict(sourceRow, targetRow, config) {
    var sourceCount = config.sourceCount || 3;
    var mainSourceIdx = config.mainSourceIdx || 0;
    var weightScheme = config.weightScheme || 'decay';
    
    var offsets = [0];
    var validOffsets = [9, -1, 10, -2, 8, -3, 7, -4, 6, -5, 5, -6, 4, -7, 3, -8, 2, -9, 1, -10];
    for (var i = 0; i < validOffsets.length; i++) {
      if (offsets.length >= sourceCount) break;
      var off = validOffsets[i];
      if (offsets.indexOf(off) === -1) offsets.push(off);
    }
    offsets = offsets.slice(0, sourceCount);
    
    var sourceRows = [];
    offsets.forEach(function(off) {
      var r = sourceRow + off;
      if (r >= 1 && r <= drawRows && sourceRows.indexOf(r) === -1) sourceRows.push(r);
    });
    sourceRows = sourceRows.slice(0, sourceCount);
    
    var n = sourceRows.length;
    var weights = [];
    if (weightScheme === 'equal') {
      for (var i = 0; i < n; i++) weights.push(1 / n);
    } else if (weightScheme === 'decay') {
      var total = 0;
      for (var i = 0; i < n; i++) { var w = Math.pow(0.7, i); weights.push(w); total += w; }
      for (var i = 0; i < n; i++) weights[i] /= total;
    } else if (weightScheme === 'mainBoost') {
      for (var i = 0; i < n; i++) weights.push(i === 0 ? 0.5 : 0.5 / (n - 1));
    } else {
      for (var i = 0; i < n; i++) weights.push(1 / n);
    }
    
    // Reorder: move mainSourceIdx to front
    if (mainSourceIdx > 0 && mainSourceIdx < sourceRows.length) {
      var mainRow = sourceRows[mainSourceIdx];
      sourceRows.splice(mainSourceIdx, 1);
      sourceRows.unshift(mainRow);
      if (weightScheme === 'decay') {
        weights = [];
        var total = 0;
        for (var i = 0; i < n; i++) { var w = Math.pow(0.7, i); weights.push(w); total += w; }
        for (var i = 0; i < n; i++) weights[i] /= total;
      } else {
        var mainW = weights.splice(mainSourceIdx, 1)[0];
        weights.unshift(mainW);
      }
    }
    
    var allSamples = sourceRows.map(function(row) {
      return { row: row, sample: buildSampleNumbersV4(row, "front", getActiveSampleRatios()) };
    });
    
    var scoreMap = new Map();
    allSamples.forEach(function(item, idx) {
      var w = weights[idx] || 0.1;
      item.sample.candidateEntries.forEach(function(e) {
        scoreMap.set(e.number, (scoreMap.get(e.number) || 0) + e.score * w);
      });
    });
    
    // Interval ratio: use target's previous period
    var targetPrevRow = targetRow - 1;
    var targetPrevIv = getIntervalRatioForRow(targetPrevRow);
    
    // Merge tail predictions
    var tailMap = new Map();
    allSamples.forEach(function(item, idx) {
      var w = weights[idx] || 0.1;
      (item.sample.predictedTails || []).forEach(function(pair) {
        tailMap.set(pair[0], (tailMap.get(pair[0]) || 0) + pair[1] * w);
      });
    });
    var mergedTails = [];
    tailMap.forEach(function(v, k) { mergedTails.push([k, v]); });
    mergedTails.sort(function(a, b) { return b[1] - a[1]; });
    mergedTails = mergedTails.slice(0, 10);
    
    var mergedEntries = [];
    scoreMap.forEach(function(v, k) { mergedEntries.push({ number: k, score: v }); });
    mergedEntries.sort(function(a, b) { return b.score - a.score; });
    mergedEntries = mergedEntries.slice(0, 24);
    mergedEntries = mergedEntries.map(function(e) {
      var o = {};
      for (var i = 0; i < allSamples.length; i++) {
        var found = null;
        allSamples[i].sample.candidateEntries.forEach(function(ce) {
          if (ce.number === e.number) found = ce;
        });
        if (found) { o = found; break; }
      }
      return {
        number: e.number, score: e.score, baseScore: e.score, rank: 0,
        selectedTailHits: o.selectedTailHits || 0,
        selectedTailNeighborHits: o.selectedTailNeighborHits || 0,
        tailCount: o.tailCount || 0, lastRowTailHits: o.lastRowTailHits || 0,
        tailPatternScore: o.tailPatternScore || 0, upperColorHits: o.upperColorHits || 0,
        upperColorTailHits: o.upperColorTailHits || 0, upperColorTailNeighborHits: o.upperColorTailNeighborHits || 0,
        hits: o.hits || 0, bridgeEndpointHits: o.bridgeEndpointHits || 0,
        arithmeticEndpointHits: o.arithmeticEndpointHits || 0, arithmeticScore: o.arithmeticScore || 0,
        integrityBonus: o.integrityBonus || 0, templateHits: o.templateHits || 0,
        sameRowSupport: o.sameRowSupport || 0, plusTenScore: o.plusTenScore || 0,
        plusTenNeighborScore: o.plusTenNeighborScore || 0, farOffsetCount: o.farOffsetCount || 0,
        anchorKeepPenalty: o.anchorKeepPenalty || 0, transformedCount: o.transformedCount || 0,
      };
    });
    
    var mergedRefs = [];
    allSamples.forEach(function(s) {
      (s.sample.referenceRows || []).forEach(function(r) {
        if (mergedRefs.indexOf(r) === -1) mergedRefs.push(r);
      });
    });
    mergedRefs.sort(function(a, b) { return a - b; });
    
    var mainSample = allSamples[0].sample;
    return {
      candidateEntries: mergedEntries,
      candidates: mergedEntries.map(function(e) { return e.number; }),
      numbers: mergedEntries.slice(0, 5).map(function(e) { return e.number; }),
      referenceRows: mergedRefs,
      predictedTails: mergedTails,
      ivPrediction: targetPrevIv ? { predictedIv: targetPrevIv, predictedIvKey: targetPrevIv.join(":"), distance: 0, confidence: 1 } : mainSample.ivPrediction,
      selectedNumbers: mainSample.selectedNumbers,
      extremeFlags: mainSample.extremeFlags,
    };
  }

  // Evaluate
  function evaluateFusion(sourceRow, targetRow, config) {
    var targetNums = getFrontNumbers(targetRow);
    if (targetNums.length !== 5) return null;
    var targetFront = {};
    targetNums.forEach(function(n) { targetFront[n] = true; });
    
    try {
      var frontSample = multiSourcePredict(sourceRow, targetRow, config);
      var v4Refs = frontSample.referenceRows || [];
      
      var frontCombos = buildSampleFrontCombosV5(
        frontSample.candidateEntries, v4Refs,
        frontSample.selectedNumbers, frontSample.selectedNumbers,
        frontSample.predictedTails || null,
        frontSample.ivPrediction || null,
        null, null,
        getActiveSampleRatios(), sourceRow
      );
      
      var top5 = frontCombos.slice(0, 5);
      var hitCounts = top5.map(function(c) {
        var nums = c.numbers || c;
        return nums.filter(function(n) { return targetFront[n]; }).length;
      });
      
      var union = {};
      top5.forEach(function(c) { (c.numbers || c).forEach(function(n) { union[n] = true; }); });
      var unionHit = targetNums.filter(function(n) { return union[n]; }).length;
      
      var poolNums = frontSample.candidates || [];
      var poolHit = poolNums.filter(function(n) { return targetFront[n]; }).length;
      
      return {
        top5Hits: hitCounts,
        bestHit: Math.max.apply(null, hitCounts),
        unionHit: unionHit,
        poolHit: poolHit,
        avgHit: hitCounts.reduce(function(s, v) { return s + v; }, 0) / hitCounts.length,
      };
    } catch(e) {
      return null;
    }
  }

  // Build test pairs
  var issues = Object.keys(issueToRow).map(Number).filter(Number.isFinite).sort(function(a, b) { return a - b; });
  var STEP = 10;
  var testPairs = [];
  issues.forEach(function(issue) {
    var ti = issue + STEP;
    if (issueToRow[issue] && issueToRow[ti]) testPairs.push([issue, ti]);
  });
  testPairs = testPairs.slice(0, 60);

  // Config matrix
  var configs = [];
  
  // 1. Different source counts (3-10), main=N, decay
  for (var n = 3; n <= 10; n++) {
    configs.push({ name: n + "源_主源N_decay", sourceCount: n, mainSourceIdx: 0, weightScheme: 'decay' });
  }
  
  // 2. Different main sources (fixed 5 sources)
  var mainOpts = [
    { idx: 0, name: "N期" }, { idx: 1, name: "N+9期" }, { idx: 2, name: "N-1期" },
    { idx: 3, name: "N+10期" }, { idx: 4, name: "N-2期" },
  ];
  mainOpts.forEach(function(opt) {
    configs.push({ name: "5源_主源" + opt.name + "_decay", sourceCount: 5, mainSourceIdx: opt.idx, weightScheme: 'decay' });
  });
  
  // 3. Different weight schemes (fixed 5 sources, main=N)
  ['equal', 'decay', 'mainBoost'].forEach(function(scheme) {
    configs.push({ name: "5源_主源N_" + scheme, sourceCount: 5, mainSourceIdx: 0, weightScheme: scheme });
  });
  
  // 4. Best combinations
  configs.push({ name: "7源_主源N+9_decay", sourceCount: 7, mainSourceIdx: 1, weightScheme: 'decay' });
  configs.push({ name: "7源_主源N-1_decay", sourceCount: 7, mainSourceIdx: 2, weightScheme: 'decay' });
  configs.push({ name: "8源_主源N_decay", sourceCount: 8, mainSourceIdx: 0, weightScheme: 'decay' });
  configs.push({ name: "8源_主源N+9_decay", sourceCount: 8, mainSourceIdx: 1, weightScheme: 'decay' });
  configs.push({ name: "10源_主源N_equal", sourceCount: 10, mainSourceIdx: 0, weightScheme: 'equal' });
  configs.push({ name: "10源_主源N+9_mainBoost", sourceCount: 10, mainSourceIdx: 1, weightScheme: 'mainBoost' });

  // Run backtest
  var results = [];
  
  configs.forEach(function(config) {
    var stats = {
      name: config.name, sourceCount: config.sourceCount,
      mainSourceIdx: config.mainSourceIdx, weightScheme: config.weightScheme,
      totalPairs: 0, bestHits: [], unionHits: [], poolHits: [], avgHits: [],
      best3plus: 0, best4plus: 0, best5: 0, union3plus: 0, errors: 0,
    };
    
    testPairs.forEach(function(pair) {
      var sourceRow = issueToRow[pair[0]];
      var targetRow = issueToRow[pair[1]];
      if (!sourceRow || !targetRow) return;
      
      var result = evaluateFusion(sourceRow, targetRow, config);
      if (!result) { stats.errors++; return; }
      
      stats.totalPairs++;
      stats.bestHits.push(result.bestHit);
      stats.unionHits.push(result.unionHit);
      stats.poolHits.push(result.poolHit);
      stats.avgHits.push(result.avgHit);
      
      if (result.bestHit >= 3) stats.best3plus++;
      if (result.bestHit >= 4) stats.best4plus++;
      if (result.bestHit >= 5) stats.best5++;
      if (result.unionHit >= 3) stats.union3plus++;
    });
    
    var n = stats.totalPairs;
    if (n > 0) {
      stats.summary = {
        avgBestHit: (stats.bestHits.reduce(function(s, v) { return s + v; }, 0) / n).toFixed(2),
        avgUnionHit: (stats.unionHits.reduce(function(s, v) { return s + v; }, 0) / n).toFixed(2),
        avgPoolHit: (stats.poolHits.reduce(function(s, v) { return s + v; }, 0) / n).toFixed(2),
        avgAvgHit: (stats.avgHits.reduce(function(s, v) { return s + v; }, 0) / n).toFixed(2),
        best3plusRate: (stats.best3plus / n * 100).toFixed(1) + '%',
        best4plusRate: (stats.best4plus / n * 100).toFixed(1) + '%',
        best5Rate: (stats.best5 / n * 100).toFixed(1) + '%',
        union3plusRate: (stats.union3plus / n * 100).toFixed(1) + '%',
      };
    }
    results.push(stats);
    document.title = "Progress: " + results.length + "/" + configs.length;
  });

  document.getElementById("result").textContent = JSON.stringify({
    testPairs: testPairs.length,
    results: results.map(function(r) {
      return { name: r.name, totalPairs: r.totalPairs, errors: r.errors, summary: r.summary };
    })
  }, null, 2);

  Math.random = originalRandom;
})();
`;

// Build HTML parts
const htmlParts = [];
htmlParts.push('<!doctype html><html><head><meta charset="UTF-8"></head><body>');
htmlParts.push('<div id="appLock"></div>');
htmlParts.push('<main id="appRoot">');
htmlParts.push('<section id="agentHomePanel" data-agent-section></section>');
htmlParts.push('<section id="agentControlPanel" data-agent-section></section>');
htmlParts.push('<section id="agentPalettePanel" data-agent-section></section>');
htmlParts.push('<section id="agentBoardPanel" data-agent-section>');
htmlParts.push('  <div id="board" class="board"><div><div id="frontBoard"></div></div><div><div id="backBoard"></div></div></div>');
htmlParts.push('</section>');
htmlParts.push('<section id="agentVersionPanel" data-agent-section></section>');
htmlParts.push('<section id="agentImportPanel" data-agent-section></section>');
htmlParts.push('<div class="board-wrap"></div>');
htmlParts.push('<input id="appPassword" />');
htmlParts.push('<button id="toggleAppPasswordButton"></button>');
htmlParts.push('<button id="unlockAppButton"></button>');
htmlParts.push('<p id="appAuthMessage"></p>');
htmlParts.push('<button id="installAppButton"></button>');
htmlParts.push('<p id="installHint"></p>');
htmlParts.push('<span id="displayModeBadge"></span>');
htmlParts.push('<span id="networkStatusBadge"></span>');
htmlParts.push('<input id="rowInput" type="number" value="1" />');
htmlParts.push('<select id="zoneInput"><option value="front">front</option><option value="back">back</option></select>');
htmlParts.push('<input id="numberInput" type="number" value="1" />');
htmlParts.push('<input id="colorInput" type="color" value="#d6202a" />');
htmlParts.push('<input id="sizeInput" type="range" value="25" />');
htmlParts.push('<input id="zoomInput" type="range" value="100" />');
htmlParts.push('<button id="addBallButton"></button>');
htmlParts.push('<button id="eraseButton"></button>');
htmlParts.push('<button id="deleteColorButton"></button>');
htmlParts.push('<button id="addDividerButton"></button>');
htmlParts.push('<button id="clearButton"></button>');
htmlParts.push('<button id="sampleButton"></button>');
htmlParts.push('<button id="clearSampleButton"></button>');
htmlParts.push('<button id="saveHistoryButton"></button>');
htmlParts.push('<button id="saveVersionButton"></button>');
htmlParts.push('<button id="openComparePageButton"></button>');
htmlParts.push('<button id="openComparePageFromHome"></button>');
htmlParts.push('<button id="openCompare90PageButton"></button>');
htmlParts.push('<button id="openCompare90PageFromHome"></button>');
htmlParts.push('<button id="captureBoardButton"></button>');
htmlParts.push('<button id="clearMainBoardButton"></button>');
htmlParts.push('<button id="clearHistoryButton"></button>');
htmlParts.push('<button id="clearVersionsButton"></button>');
htmlParts.push('<strong id="ballCount"></strong>');
htmlParts.push('<span id="currentBaseLabel"></span>');
htmlParts.push('<div id="versionBanner"><span id="versionBannerText"></span></div>');
htmlParts.push('<ol id="historyList"></ol>');
htmlParts.push('<div class="version-shell"><ol id="versionList"></ol></div>');
htmlParts.push('<input id="versionSearch" />');
htmlParts.push('<button id="downloadVersionsButton"></button>');
htmlParts.push('<input id="importVersionsInput" type="file" />');
htmlParts.push('<button id="compareVersionsButton"></button>');
htmlParts.push('<input id="versionPassword" />');
htmlParts.push('<button id="unlockVersionsButton"></button>');
htmlParts.push('<button id="lockVersionsButton"></button>');
htmlParts.push('<p id="versionAuthMessage"></p>');
htmlParts.push('<div id="versionPreview"></div>');
htmlParts.push('<h3 id="versionPreviewTitle"></h3>');
htmlParts.push('<input id="drawDateInput" />');
htmlParts.push('<textarea id="drawDataInput"></textarea>');
htmlParts.push('<input id="drawFileInput" type="file" />');
htmlParts.push('<button id="generateDrawVersionButton"></button>');
htmlParts.push('<button id="cancelEditDrawVersionButton"></button>');
htmlParts.push('<p id="drawImportMessage"></p>');
htmlParts.push('<div id="versionModal"><h2 id="versionModalTitle"></h2><div id="versionModalBody"></div><button id="closeVersionModalButton"></button></div>');
htmlParts.push('<div id="compareModal"><select id="compareVersionOne"></select><select id="compareVersionTwo"></select><select id="compareVersionThree"></select><p id="compareHint"></p><button id="applyCompareButton"></button><button id="saveCompareButton"></button><button id="closeCompareModalButton"></button></div>');
htmlParts.push('<textarea id="descInput"></textarea>');
htmlParts.push('<input id="descFileInput" type="file" />');
htmlParts.push('<button id="descAddButton"></button>');
htmlParts.push('<button id="descHelpButton"></button>');
htmlParts.push('<div id="descHelpTip"></div>');
htmlParts.push('<button class="swatch" data-color="#d6202a"></button>');
htmlParts.push('<button class="swatch" data-color="#1768b7"></button>');
htmlParts.push('<button class="swatch" data-color="#14a365"></button>');
htmlParts.push('<button class="swatch" data-color="#f59e0b"></button>');
htmlParts.push('<button class="swatch" data-color="#7c3aed"></button>');
htmlParts.push('<button class="swatch" data-color="#111827"></button>');
htmlParts.push('<div id="tailModeBacktest"></div>');
htmlParts.push('<pre id="result"></pre>');
htmlParts.push('</main>');

// Write to temp file
const tmpPath = path.join(__dirname, '_backtest_tmp.html');
const htmlContent = htmlParts.join('\n') + '\n' +
  '<script>\n' +
  '  window.matchMedia = window.matchMedia || function() { return { matches: false, addEventListener:function(){}, removeEventListener:function(){}, addListener:function(){}, removeListener:function(){} }; };\n' +
  '  window.alert = function(){};\n' +
  '  window.confirm = function(){ return true; };\n' +
  '  window.navigator.serviceWorker = { register: function() { return Promise.resolve({}); } };\n' +
  '  localStorage.clear();\n' +
  '  sessionStorage.clear();\n' +
  '  sessionStorage.setItem("lottery-page-auth", "true");\n' +
  '</script>\n' +
  (xlsxSrc ? '<script>' + xlsxSrc + '</script>\n' : '') +
  (html2canvasSrc ? '<script>' + html2canvasSrc + '</script>\n' : '') +
  (allDrawsSrc ? '<script>' + allDrawsSrc + '</script>\n' : '') +
  '<script>' + scriptSrc + '</script>\n' +
  '<script>' + runScript + '</script>\n' +
  '</body></html>';

fs.writeFileSync(tmpPath, htmlContent, 'utf-8');
console.log('HTML written to temp file (' + (htmlContent.length / 1024).toFixed(0) + 'KB)');
console.log('Creating jsdom...');

const dom = new JSDOM(htmlContent, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'http://localhost/backtest.html'
});

const window = dom.window;

// Wait for result
var checkCount = 0;
var maxChecks = 1200; // 120s

function checkResult() {
  checkCount++;
  var resultEl = window.document.getElementById('result');
  
  if (resultEl && resultEl.textContent && resultEl.textContent.length > 50) {
    try {
      var result = JSON.parse(resultEl.textContent);
      
      if (result.error) {
        console.error('Error:', result.error);
        dom.window.close();
        process.exit(1);
      }
      
      console.log('\n' + '='.repeat(80));
      console.log('多源融合回测结果');
      console.log('='.repeat(80));
      console.log('测试期数: ' + result.testPairs + '对');
      console.log('');
      
      console.log('配置名称'.padEnd(35) + ' | 最佳>=3 | 最佳>=4 | 联合>=3 | 平均最佳 | 平均联合 | 平均池覆盖');
      console.log('-'.repeat(100));
      
      result.results.forEach(function(r) {
        var s = r.summary;
        if (!s) return;
        var name = r.name.padEnd(35);
        console.log(name + ' | ' + s.best3plusRate.padStart(7) + ' | ' + s.best4plusRate.padStart(7) + ' | ' + s.union3plusRate.padStart(7) + ' | ' + s.avgBestHit.padStart(8) + ' | ' + s.avgUnionHit.padStart(8) + ' | ' + s.avgPoolHit.padStart(8));
      });
      
      console.log('\n' + '='.repeat(80));
      console.log('排名（按最佳>=3球命中率降序）:');
      console.log('='.repeat(80));
      
      var ranked = result.results.filter(function(r) { return r.summary; }).sort(function(a, b) {
        return parseFloat(b.summary.best3plusRate) - parseFloat(a.summary.best3plusRate);
      });
      
      ranked.forEach(function(r, i) {
        console.log('  #' + (i+1) + ' ' + r.name + ': 最佳>=3=' + r.summary.best3plusRate + ', 联合>=3=' + r.summary.union3plusRate + ', 平均最佳=' + r.summary.avgBestHit);
      });
      
      if (ranked.length > 0) {
        console.log('\n' + '='.repeat(80));
        console.log('最优配置: ' + ranked[0].name);
        console.log('   最佳>=3球率: ' + ranked[0].summary.best3plusRate);
        console.log('   联合>=3球率: ' + ranked[0].summary.union3plusRate);
        console.log('   平均最佳命中: ' + ranked[0].summary.avgBestHit + '球');
        console.log('='.repeat(80));
      }
      
    } catch (e) {
      console.log('Parse error:', e.message);
      console.log('Raw:', resultEl.textContent.substring(0, 1000));
    }
    
    // Cleanup
    try { fs.unlinkSync(tmpPath); } catch(e) {}
    dom.window.close();
    process.exit(0);
  }
  
  if (checkCount >= maxChecks) {
    console.log('Timeout (120s)');
    if (resultEl) console.log('Current:', resultEl.textContent.substring(0, 500));
    try { fs.unlinkSync(tmpPath); } catch(e) {}
    dom.window.close();
    process.exit(1);
  }
  
  if (checkCount % 100 === 0) {
    console.log('  Waiting... ' + (checkCount / 10) + 's, title: ' + (window.document.title || ''));
  }
  
  setTimeout(checkResult, 100);
}

setTimeout(checkResult, 2000);
