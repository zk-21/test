/**
 * 验证回测：对比旧配置(3源,主源N) vs 新配置(5源,主源N-1)
 * 运行: node backtest_verify_fusion.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

console.log('=== 多源融合验证回测 ===\n');

const xlsxPath = path.join(__dirname, 'vendor', 'xlsx.full.min.js');
const html2canvasPath = path.join(__dirname, 'vendor', 'html2canvas.min.js');
const scriptPath = path.join(__dirname, 'script.js');
const allDrawsPath = path.join(__dirname, 'all_draws.js');

const xlsxSrc = fs.existsSync(xlsxPath) ? fs.readFileSync(xlsxPath, 'utf-8') : '';
const html2canvasSrc = fs.existsSync(html2canvasPath) ? fs.readFileSync(html2canvasPath, 'utf-8') : '';
const scriptSrc = fs.readFileSync(scriptPath, 'utf-8');
const allDrawsSrc = fs.existsSync(allDrawsPath) ? fs.readFileSync(allDrawsPath, 'utf-8') : '';

const runScript = `
(function run() {
  var originalRandom = Math.random;
  Math.random = function() { return 0; };

  try {
    applyBalls(createBuiltInDrawBalls(), {
      baseTitle: "BuiltIn", rowIssues: rowIssues, protectBalls: true, persist: false,
    });
  } catch(e) {
    document.getElementById("result").textContent = JSON.stringify({error: "applyBalls: " + e.message});
    return;
  }

  var issueToRow = {};
  Object.keys(rowIssues).forEach(function(row) { issueToRow[rowIssues[row]] = Number(row); });
  var allBalls = collectBalls();
  var drawRows = 0;
  allBalls.forEach(function(b) { if (b.row > drawRows) drawRows = b.row; });
  
  function getFrontNumbers(row) {
    var nums = [], seen = {};
    allBalls.forEach(function(b) {
      if (b.row === row && b.zone === "front" && !seen[b.number]) { seen[b.number] = true; nums.push(b.number); }
    });
    return nums.sort(function(a, b) { return a - b; });
  }

  // Test configs
  var configs = [
    { name: "旧:3源_主源N_fixed", offsets: [0, 9, -1], weights: [0.5, 0.3, 0.2] },
    { name: "新:5源_主源N-1_decay", offsets: [-1, 0, 9, -2, 10], useDecay: true },
    { name: "新:5源_主源N-1_equal", offsets: [-1, 0, 9, -2, 10], weights: [0.2, 0.2, 0.2, 0.2, 0.2] },
    { name: "新:7源_主源N-1_decay", offsets: [-1, 0, 9, -2, 10, -3, 8], useDecay: true },
    { name: "新:10源_主源N-1_decay", offsets: [-1, 0, 9, -2, 10, -3, 8, -4, 7, -5], useDecay: true },
    { name: "新:5源_主源N+9_decay", offsets: [9, -1, 0, 10, -2], useDecay: true },
    { name: "新:5源_主源N_decay", offsets: [0, -1, 9, -2, 10], useDecay: true },
  ];

  var issues = Object.keys(issueToRow).map(Number).filter(Number.isFinite).sort(function(a, b) { return a - b; });
  var testPairs = [];
  issues.forEach(function(issue) {
    var ti = issue + 10;
    if (issueToRow[issue] && issueToRow[ti]) testPairs.push([issue, ti]);
  });

  var results = [];
  
  configs.forEach(function(config) {
    var sourceRows = [];
    config.offsets.forEach(function(off) {
      var r; 
      // For the "new" configs, we need a reference source row
      // Use the first test pair's source row pattern
      // Actually, we need to compute this per-pair
      sourceRows.push(off);
    });
    
    var stats = { name: config.name, total: 0, best3: 0, best4: 0, union3: 0, avgBest: 0, avgUnion: 0, avgPool: 0, errors: 0 };
    
    testPairs.forEach(function(pair) {
      var sourceRow = issueToRow[pair[0]];
      var targetRow = issueToRow[pair[1]];
      if (!sourceRow || !targetRow) return;
      
      var targetNums = getFrontNumbers(targetRow);
      if (targetNums.length !== 5) return;
      var targetSet = {};
      targetNums.forEach(function(n) { targetSet[n] = true; });
      
      try {
        // Build sources
        var rows = [];
        config.offsets.forEach(function(off) {
          var r = sourceRow + off;
          if (r >= 1 && r <= drawRows && rows.indexOf(r) === -1) rows.push(r);
        });
        
        // Weights
        var w;
        if (config.useDecay) {
          var raw = rows.map(function(_, i) { return Math.pow(0.7, i); });
          var total = raw.reduce(function(s, v) { return s + v; }, 0);
          w = raw.map(function(v) { return v / total; });
        } else {
          w = config.weights || rows.map(function() { return 1 / rows.length; });
        }
        
        // Generate samples
        var samples = rows.map(function(row) {
          return { row: row, sample: buildSampleNumbersV4(row, "front", getActiveSampleRatios()) };
        });
        
        // Merge
        var scoreMap = new Map();
        samples.forEach(function(item, idx) {
          var weight = w[idx] || 0.1;
          item.sample.candidateEntries.forEach(function(e) {
            scoreMap.set(e.number, (scoreMap.get(e.number) || 0) + e.score * weight);
          });
        });
        
        var merged = [];
        scoreMap.forEach(function(v, k) { merged.push({ number: k, score: v }); });
        merged.sort(function(a, b) { return b.score - a.score; });
        merged = merged.slice(0, 24);
        
        // Build merged entries with full attributes
        var mergedEntries = merged.map(function(e) {
          var o = {};
          for (var i = 0; i < samples.length; i++) {
            var found = null;
            samples[i].sample.candidateEntries.forEach(function(ce) { if (ce.number === e.number) found = ce; });
            if (found) { o = found; break; }
          }
          return {
            number: e.number, score: e.score, baseScore: e.score, rank: 0,
            selectedTailHits: o.selectedTailHits || 0, selectedTailNeighborHits: o.selectedTailNeighborHits || 0,
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
        
        var refs = [];
        samples.forEach(function(s) {
          (s.sample.referenceRows || []).forEach(function(r) { if (refs.indexOf(r) === -1) refs.push(r); });
        });
        refs.sort(function(a, b) { return a - b; });
        
        var mainSample = samples[0].sample;
        
        // Generate combos
        var combos = buildSampleFrontCombosV5(
          mergedEntries, refs,
          mainSample.selectedNumbers, mainSample.selectedNumbers,
          mainSample.predictedTails || null, mainSample.ivPrediction || null,
          null, null, getActiveSampleRatios(), sourceRow
        );
        
        var top5 = combos.slice(0, 5);
        var hits = top5.map(function(c) {
          return (c.numbers || c).filter(function(n) { return targetSet[n]; }).length;
        });
        
        var union = {};
        top5.forEach(function(c) { (c.numbers || c).forEach(function(n) { union[n] = true; }); });
        var unionHit = targetNums.filter(function(n) { return union[n]; }).length;
        
        var poolNums = mergedEntries.map(function(e) { return e.number; });
        var poolHit = poolNums.filter(function(n) { return targetSet[n]; }).length;
        
        stats.total++;
        var best = Math.max.apply(null, hits);
        stats.avgBest += best;
        stats.avgUnion += unionHit;
        stats.avgPool += poolHit;
        if (best >= 3) stats.best3++;
        if (best >= 4) stats.best4++;
        if (unionHit >= 3) stats.union3++;
      } catch(e) {
        stats.errors++;
      }
    });
    
    if (stats.total > 0) {
      stats.avgBest = (stats.avgBest / stats.total).toFixed(2);
      stats.avgUnion = (stats.avgUnion / stats.total).toFixed(2);
      stats.avgPool = (stats.avgPool / stats.total).toFixed(2);
      stats.best3Rate = (stats.best3 / stats.total * 100).toFixed(1) + '%';
      stats.best4Rate = (stats.best4 / stats.total * 100).toFixed(1) + '%';
      stats.union3Rate = (stats.union3 / stats.total * 100).toFixed(1) + '%';
    }
    results.push(stats);
    process.stdout.write('.');
  });

  document.getElementById("result").textContent = JSON.stringify({ total: testPairs.length, results: results }, null, 2);
  Math.random = originalRandom;
})();
`;

// Build HTML
var parts = [];
parts.push('<!doctype html><html><head><meta charset="UTF-8"></head><body>');
parts.push('<div id="appLock"></div><main id="appRoot">');
parts.push('<section id="agentHomePanel" data-agent-section></section>');
parts.push('<section id="agentControlPanel" data-agent-section></section>');
parts.push('<section id="agentPalettePanel" data-agent-section></section>');
parts.push('<section id="agentBoardPanel" data-agent-section>');
parts.push('  <div id="board" class="board"><div><div id="frontBoard"></div></div><div><div id="backBoard"></div></div></div>');
parts.push('</section>');
parts.push('<section id="agentVersionPanel" data-agent-section></section>');
parts.push('<section id="agentImportPanel" data-agent-section></section>');
parts.push('<div class="board-wrap"></div>');
parts.push('<input id="appPassword" /><button id="toggleAppPasswordButton"></button><button id="unlockAppButton"></button>');
parts.push('<p id="appAuthMessage"></p><button id="installAppButton"></button><p id="installHint"></p>');
parts.push('<span id="displayModeBadge"></span><span id="networkStatusBadge"></span>');
parts.push('<input id="rowInput" type="number" value="1" />');
parts.push('<select id="zoneInput"><option value="front">front</option><option value="back">back</option></select>');
parts.push('<input id="numberInput" type="number" value="1" /><input id="colorInput" type="color" value="#d6202a" />');
parts.push('<input id="sizeInput" type="range" value="25" /><input id="zoomInput" type="range" value="100" />');
parts.push('<button id="addBallButton"></button><button id="eraseButton"></button><button id="deleteColorButton"></button>');
parts.push('<button id="addDividerButton"></button><button id="clearButton"></button><button id="sampleButton"></button>');
parts.push('<button id="clearSampleButton"></button><button id="saveHistoryButton"></button><button id="saveVersionButton"></button>');
parts.push('<button id="openComparePageButton"></button><button id="openComparePageFromHome"></button>');
parts.push('<button id="openCompare90PageButton"></button><button id="openCompare90PageFromHome"></button>');
parts.push('<button id="captureBoardButton"></button><button id="clearMainBoardButton"></button>');
parts.push('<button id="clearHistoryButton"></button><button id="clearVersionsButton"></button>');
parts.push('<strong id="ballCount"></strong><span id="currentBaseLabel"></span>');
parts.push('<div id="versionBanner"><span id="versionBannerText"></span></div>');
parts.push('<ol id="historyList"></ol>');
parts.push('<div class="version-shell"><ol id="versionList"></ol></div>');
parts.push('<input id="versionSearch" /><button id="downloadVersionsButton"></button>');
parts.push('<input id="importVersionsInput" type="file" /><button id="compareVersionsButton"></button>');
parts.push('<input id="versionPassword" /><button id="unlockVersionsButton"></button><button id="lockVersionsButton"></button>');
parts.push('<p id="versionAuthMessage"></p><div id="versionPreview"></div><h3 id="versionPreviewTitle"></h3>');
parts.push('<input id="drawDateInput" /><textarea id="drawDataInput"></textarea>');
parts.push('<input id="drawFileInput" type="file" /><button id="generateDrawVersionButton"></button>');
parts.push('<button id="cancelEditDrawVersionButton"></button><p id="drawImportMessage"></p>');
parts.push('<div id="versionModal"><h2 id="versionModalTitle"></h2><div id="versionModalBody"></div><button id="closeVersionModalButton"></button></div>');
parts.push('<div id="compareModal"><select id="compareVersionOne"></select><select id="compareVersionTwo"></select><select id="compareVersionThree"></select><p id="compareHint"></p><button id="applyCompareButton"></button><button id="saveCompareButton"></button><button id="closeCompareModalButton"></button></div>');
parts.push('<textarea id="descInput"></textarea><input id="descFileInput" type="file" />');
parts.push('<button id="descAddButton"></button><button id="descHelpButton"></button><div id="descHelpTip"></div>');
parts.push('<button class="swatch" data-color="#d6202a"></button><button class="swatch" data-color="#1768b7"></button>');
parts.push('<button class="swatch" data-color="#14a365"></button><button class="swatch" data-color="#f59e0b"></button>');
parts.push('<button class="swatch" data-color="#7c3aed"></button><button class="swatch" data-color="#111827"></button>');
parts.push('<div id="tailModeBacktest"></div>');
parts.push('<pre id="result"></pre></main>');

var html = parts.join('\n') + '\n' +
  '<script>window.matchMedia=window.matchMedia||function(){return{matches:false,addEventListener:function(){},removeEventListener:function(){},addListener:function(){},removeListener:function(){}}};window.alert=function(){};window.confirm=function(){return true};window.navigator.serviceWorker={register:function(){return Promise.resolve({})}};localStorage.clear();sessionStorage.clear();sessionStorage.setItem("lottery-page-auth","true");</script>\n' +
  (xlsxSrc ? '<script>' + xlsxSrc + '</script>\n' : '') +
  (html2canvasSrc ? '<script>' + html2canvasSrc + '</script>\n' : '') +
  (allDrawsSrc ? '<script>' + allDrawsSrc + '</script>\n' : '') +
  '<script>' + scriptSrc + '</script>\n' +
  '<script>' + runScript + '</script>\n</body></html>';

console.log('Creating jsdom...');
var dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/verify.html' });
var window = dom.window;
var checkCount = 0;

function checkResult() {
  checkCount++;
  var el = window.document.getElementById('result');
  if (el && el.textContent && el.textContent.length > 50) {
    try {
      var result = JSON.parse(el.textContent);
      if (result.error) { console.error('Error:', result.error); dom.window.close(); process.exit(1); }
      
      console.log('\n' + '='.repeat(90));
      console.log('多源融合配置对比回测 (测试' + result.total + '对, 间隔10期)');
      console.log('='.repeat(90));
      console.log('配置'.padEnd(30) + ' | 最佳>=3 | 最佳>=4 | 联合>=3 | 平均最佳 | 平均联合 | 平均池覆盖 | 错误');
      console.log('-'.repeat(100));
      
      result.results.forEach(function(r) {
        var name = r.name.padEnd(30);
        console.log(name + ' | ' + (r.best3Rate||'N/A').padStart(7) + ' | ' + (r.best4Rate||'N/A').padStart(7) + ' | ' + (r.union3Rate||'N/A').padStart(7) + ' | ' + (r.avgBest||'N/A').padStart(8) + ' | ' + (r.avgUnion||'N/A').padStart(8) + ' | ' + (r.avgPool||'N/A').padStart(9) + ' | ' + r.errors);
      });
      
      console.log('\n排名:');
      var ranked = result.results.filter(function(r) { return r.total > 0; }).sort(function(a, b) {
        return (b.best3 / b.total) - (a.best3 / a.total);
      });
      ranked.forEach(function(r, i) {
        console.log('  #' + (i+1) + ' ' + r.name + ': 最佳>=' + '3=' + r.best3Rate + ' 联合>=3=' + r.union3Rate + ' 平均最佳=' + r.avgBest);
      });
    } catch(e) {
      console.log('Parse error:', e.message);
    }
    dom.window.close();
    process.exit(0);
  }
  if (checkCount >= 1200) { console.log('Timeout'); dom.window.close(); process.exit(1); }
  if (checkCount % 100 === 0) console.log('  Waiting... ' + (checkCount/10) + 's');
  setTimeout(checkResult, 100);
}

setTimeout(checkResult, 2000);
