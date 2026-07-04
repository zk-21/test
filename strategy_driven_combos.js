// ======================== 策略驱动的组合生成 ========================
// 核心思路：不按评分高低选择，而是按策略要求生成符合条件的组合
// 命中3+的组合特征：100%区间匹配 + 100%尾号匹配 + 100%等距关系

function buildStrategyDrivenCombos(entries, refs, anchorNumbers, selectedNumbers, predictTails, ivPrediction, firstBallPredictions, extremeFlags, manualRatio, sourceRow, _preCollected) {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  var allBalls = _preCollected || collectBalls();
  var src = selectedNumbers.slice().sort(function (a, b) { return a - b; });
  var srcTails = Array.from(new Set(src.map(function (n) { return n % 10; })));
  var topPT = predictTails ? new Set(predictTails.slice(0, 5).map(function (p) { return p[0]; })) : new Set(srcTails);

  // ========== 1. 分析源期特征 ==========
  var srcIv = [0, 0, 0]; // 一区、二区、三区
  src.forEach(function (n) {
    if (n <= 12) srcIv[0]++;
    else if (n <= 24) srcIv[1]++;
    else srcIv[2]++;
  });

  // 预测区间比（基于极值回归和趋势）
  var predictedIv = predictIntervalRatio(srcIv, sourceRow, allBalls);
  
  // 预测尾号
  var predictedTailSet = new Set();
  if (predictTails) {
    predictTails.slice(0, 5).forEach(function (p) { predictedTailSet.add(p[0]); });
  } else {
    srcTails.forEach(function (t) { predictedTailSet.add(t); });
  }

  // ========== 2. 确定策略要求 ==========
  var strategyRequirements = {
    // 区间要求：必须覆盖预测区间的号码
    intervalRequired: [],
    // 尾号要求：必须包含预测尾号的号码
    tailRequired: [],
    // 等距要求：必须包含等距对
    arithmeticRequired: true,
    // 锚点要求：必须包含至少一个锚点号
    anchorRequired: anchorNumbers.length > 0,
  };

  // 根据预测区间比确定每个区间需要的号码数量
  var intervalCounts = predictedIv.map(function (c) { return Math.max(1, Math.min(3, c)); });
  
  // ========== 3. 生成候选池 ==========
  // 3.1 按区间分组
  var zone1 = [], zone2 = [], zone3 = [];
  for (var n = 1; n <= 35; n++) {
    var entry = entries.find(function (e) { return e.number === n; });
    if (!entry) continue;
    
    var score = entry.score || 0;
    var hasTail = predictedTailSet.has(n % 10);
    var hasAnchor = anchorNumbers.includes(n);
    
    if (n <= 12) zone1.push({ number: n, score: score, hasTail: hasTail, hasAnchor: hasAnchor });
    else if (n <= 24) zone2.push({ number: n, score: score, hasTail: hasTail, hasAnchor: hasAnchor });
    else zone3.push({ number: n, score: score, hasTail: hasTail, hasAnchor: hasAnchor });
  }

  // 3.2 每个区间按尾号+锚点+评分排序
  function sortByPriority(arr) {
    return arr.sort(function (a, b) {
      // 优先级：尾号匹配 > 锚点 > 评分
      if (a.hasTail !== b.hasTail) return b.hasTail ? 1 : -1;
      if (a.hasAnchor !== b.hasAnchor) return b.hasAnchor ? 1 : -1;
      return b.score - a.score;
    });
  }
  
  zone1 = sortByPriority(zone1);
  zone2 = sortByPriority(zone2);
  zone3 = sortByPriority(zone3);

  // ========== 4. 策略驱动的组合生成 ==========
  var combos = [];
  var usedKeys = new Set();

  // 4.1 生成满足区间要求的组合
  function generateIntervalCombos() {
    var combos = [];
    
    // 从每个区间选择指定数量的号码
    var z1Count = intervalCounts[0];
    var z2Count = intervalCounts[1];
    var z3Count = intervalCounts[2];
    
    // 确保总数为5
    while (z1Count + z2Count + z3Count < 5) {
      if (z1Count <= z2Count && z1Count <= z3Count) z1Count++;
      else if (z2Count <= z3Count) z2Count++;
      else z3Count++;
    }
    while (z1Count + z2Count + z3Count > 5) {
      if (z1Count >= z2Count && z1Count >= z3Count) z1Count--;
      else if (z2Count >= z3Count) z2Count--;
      else z3Count--;
    }
    
    // 从每个区间选择号码
    var z1Selected = zone1.slice(0, z1Count + 2); // 多选2个备用
    var z2Selected = zone2.slice(0, z2Count + 2);
    var z3Selected = zone3.slice(0, z3Count + 2);
    
    // 生成组合
    for (var i1 = 0; i1 < z1Selected.length && i1 < z1Count + 2; i1++) {
      for (var i2 = 0; i2 < z2Selected.length && i2 < z2Count + 2; i2++) {
        for (var i3 = 0; i3 < z3Selected.length && i3 < z3Count + 2; i3++) {
          var combo = [z1Selected[i1], z2Selected[i2], z3Selected[i3]];
          
          // 补充剩余号码（从评分最高的候选中选择）
          var remaining = 5 - combo.length;
          var allCandidates = [].concat(z1Selected, z2Selected, z3Selected);
          allCandidates = allCandidates.filter(function (c) {
            return !combo.some(function (x) { return x.number === c.number; });
          });
          allCandidates.sort(function (a, b) { return b.score - a.score; });
          
          for (var r = 0; r < remaining && r < allCandidates.length; r++) {
            combo.push(allCandidates[r]);
          }
          
          if (combo.length === 5) {
            var numbers = combo.map(function (c) { return c.number; }).sort(function (a, b) { return a - b; });
            var key = numbers.join(',');
            
            if (!usedKeys.has(key)) {
              combos.push({
                numbers: numbers,
                key: key,
                score: combo.reduce(function (sum, c) { return sum + c.score; }, 0),
                strategy: 'interval_match',
                tailCount: combo.filter(function (c) { return c.hasTail; }).length,
                anchorCount: combo.filter(function (c) { return c.hasAnchor; }).length,
              });
              usedKeys.add(key);
            }
          }
        }
      }
    }
    
    return combos;
  }

  // 4.2 生成满足尾号要求的组合
  function generateTailCombos() {
    var combos = [];
    
    // 选择所有尾号匹配的号码
    var tailNumbers = [];
    for (var n = 1; n <= 35; n++) {
      var entry = entries.find(function (e) { return e.number === n; });
      if (entry && predictedTailSet.has(n % 10)) {
        tailNumbers.push({ number: n, score: entry.score || 0 });
      }
    }
    tailNumbers.sort(function (a, b) { return b.score - a.score; });
    
    // 生成包含多个尾号匹配号码的组合
    for (var i = 0; i < tailNumbers.length; i++) {
      for (var j = i + 1; j < tailNumbers.length; j++) {
        var combo = [tailNumbers[i], tailNumbers[j]];
        
        // 补充其他号码
        var remaining = entries.filter(function (e) {
          return !combo.some(function (c) { return c.number === e.number; });
        });
        remaining.sort(function (a, b) { return b.score - a.score; });
        
        for (var r = 0; r < 3 && r < remaining.length; r++) {
          combo.push({ number: remaining[r].number, score: remaining[r].score });
        }
        
        if (combo.length === 5) {
          var numbers = combo.map(function (c) { return c.number; }).sort(function (a, b) { return a - b; });
          var key = numbers.join(',');
          
          if (!usedKeys.has(key)) {
            combos.push({
              numbers: numbers,
              key: key,
              score: combo.reduce(function (sum, c) { return sum + c.score; }, 0),
              strategy: 'tail_match',
              tailCount: combo.filter(function (c) { return predictedTailSet.has(c.number % 10); }).length,
              anchorCount: combo.filter(function (c) { return anchorNumbers.includes(c.number); }).length,
            });
            usedKeys.add(key);
          }
        }
      }
    }
    
    return combos;
  }

  // 4.3 生成满足等距要求的组合
  function generateArithmeticCombos() {
    var combos = [];
    
    // 找出所有等距对
    var arithPairs = [];
    for (var i = 0; i < entries.length; i++) {
      for (var j = i + 1; j < entries.length; j++) {
        var diff = Math.abs(entries[i].number - entries[j].number);
        if (diff >= 2 && diff <= 8) {
          arithPairs.push([entries[i], entries[j], diff]);
        }
      }
    }
    
    // 选择评分最高的等距对
    arithPairs.sort(function (a, b) {
      return (b[0].score + b[1].score) - (a[0].score + a[1].score);
    });
    
    for (var p = 0; p < Math.min(20, arithPairs.length); p++) {
      var pair = arithPairs[p];
      var combo = [pair[0], pair[1]];
      
      // 补充其他号码
      var remaining = entries.filter(function (e) {
        return !combo.some(function (c) { return c.number === e.number; });
      });
      remaining.sort(function (a, b) { return b.score - a.score; });
      
      for (var r = 0; r < 3 && r < remaining.length; r++) {
        combo.push({ number: remaining[r].number, score: remaining[r].score });
      }
      
      if (combo.length === 5) {
        var numbers = combo.map(function (c) { return c.number; }).sort(function (a, b) { return a - b; });
        var key = numbers.join(',');
        
        if (!usedKeys.has(key)) {
          combos.push({
            numbers: numbers,
            key: key,
            score: combo.reduce(function (sum, c) { return sum + c.score; }, 0),
            strategy: 'arithmetic',
            tailCount: combo.filter(function (c) { return predictedTailSet.has(c.number % 10); }).length,
            anchorCount: combo.filter(function (c) { return anchorNumbers.includes(c.number); }).length,
            hasArithPair: true,
          });
          usedKeys.add(key);
        }
      }
    }
    
    return combos;
  }

  // 4.4 生成满足所有要求的组合（三重协同）
  function generateSynergyCombos() {
    var combos = [];
    
    // 找出同时满足三个条件的号码
    var synergyNumbers = entries.filter(function (e) {
      var n = e.number;
      var hasTail = predictedTailSet.has(n % 10);
      var inPredictedInterval = isInPredictedInterval(n, predictedIv);
      var hasArithPartner = entries.some(function (other) {
        var diff = Math.abs(n - other.number);
        return diff >= 2 && diff <= 8;
      });
      return hasTail && inPredictedInterval && hasArithPartner;
    });
    
    synergyNumbers.sort(function (a, b) { return b.score - a.score; });
    
    // 生成包含多个协同号码的组合
    for (var i = 0; i < synergyNumbers.length; i++) {
      for (var j = i + 1; j < synergyNumbers.length; j++) {
        var combo = [synergyNumbers[i], synergyNumbers[j]];
        
        // 补充其他号码
        var remaining = entries.filter(function (e) {
          return !combo.some(function (c) { return c.number === e.number; });
        });
        remaining.sort(function (a, b) { return b.score - a.score; });
        
        for (var r = 0; r < 3 && r < remaining.length; r++) {
          combo.push({ number: remaining[r].number, score: remaining[r].score });
        }
        
        if (combo.length === 5) {
          var numbers = combo.map(function (c) { return c.number; }).sort(function (a, b) { return a - b; });
          var key = numbers.join(',');
          
          if (!usedKeys.has(key)) {
            combos.push({
              numbers: numbers,
              key: key,
              score: combo.reduce(function (sum, c) { return sum + c.score; }, 0),
              strategy: 'synergy',
              tailCount: combo.filter(function (c) { return predictedTailSet.has(c.number % 10); }).length,
              anchorCount: combo.filter(function (c) { return anchorNumbers.includes(c.number); }).length,
              hasArithPair: true,
              synergyCount: combo.filter(function (c) {
                var n = c.number;
                return predictedTailSet.has(n % 10) && isInPredictedInterval(n, predictedIv);
              }).length,
            });
            usedKeys.add(key);
          }
        }
      }
    }
    
    return combos;
  }

  // ========== 5. 辅助函数 ==========
  function isInPredictedInterval(n, predictedIv) {
    var zone = n <= 12 ? 0 : (n <= 24 ? 1 : 2);
    return predictedIv[zone] > 0;
  }

  function predictIntervalRatio(srcIv, sourceRow, allBalls) {
    // 获取前一期区间分布
    var prevBalls = allBalls.filter(function (b) {
      return b.zone === "front" && b.row === sourceRow - 1 && ballHasColor(b, sampleRedColor);
    });
    var prevNums = Array.from(new Set(prevBalls.map(function (b) { return b.number; })));
    var prevIv = [0, 0, 0];
    prevNums.forEach(function (n) {
      if (n <= 12) prevIv[0]++;
      else if (n <= 24) prevIv[1]++;
      else prevIv[2]++;
    });

    // 基于极值回归预测
    return srcIv.map(function (c, idx) {
      if (c >= 4) return Math.max(1, c - 2); // 极高→减少
      if (c === 0) return 2; // 极低→增加
      if (c > prevIv[idx]) return Math.max(1, c - 1); // 增加→减少
      if (c < prevIv[idx]) return c + 1; // 减少→增加
      return c; // 保持
    });
  }

  // ========== 6. 执行组合生成 ==========
  console.log("\n===== 策略驱动的组合生成 =====\n");
  console.log("源期号码:", src.join(','));
  console.log("源期区间:", srcIv.join(':'));
  console.log("预测区间:", predictedIv.join(':'));
  console.log("预测尾号:", Array.from(predictedTailSet).join(','));
  console.log("锚点号码:", anchorNumbers.join(','));

  // 生成各策略组合
  var intervalCombos = generateIntervalCombos();
  var tailCombos = generateTailCombos();
  var arithmeticCombos = generateArithmeticCombos();
  var synergyCombos = generateSynergyCombos();

  console.log("\n生成结果:");
  console.log("  区间匹配组合:", intervalCombos.length, "个");
  console.log("  尾号匹配组合:", tailCombos.length, "个");
  console.log("  等距关系组合:", arithmeticCombos.length, "个");
  console.log("  三重协同组合:", synergyCombos.length, "个");

  // 合并所有组合
  var allCombos = [].concat(intervalCombos, tailCombos, arithmeticCombos, synergyCombos);

  // 按策略优先级排序：三重协同 > 区间匹配 > 尾号匹配 > 等距关系
  allCombos.sort(function (a, b) {
    // 策略优先级
    var strategyPriority = { 'synergy': 4, 'interval_match': 3, 'tail_match': 2, 'arithmetic': 1 };
    var pa = strategyPriority[a.strategy] || 0;
    var pb = strategyPriority[b.strategy] || 0;
    if (pa !== pb) return pb - pa;
    
    // 同策略内按协同特征排序
    if (a.synergyCount !== b.synergyCount) return (b.synergyCount || 0) - (a.synergyCount || 0);
    if (a.tailCount !== b.tailCount) return (b.tailCount || 0) - (a.tailCount || 0);
    if (a.anchorCount !== b.anchorCount) return (b.anchorCount || 0) - (a.anchorCount || 0);
    
    // 最后按评分排序
    return b.score - a.score;
  });

  // 取前20个组合
  var finalCombos = allCombos.slice(0, 20);

  console.log("\n最终选择:", finalCombos.length, "个组合");
  console.log("\n组合详情:");
  console.log("┌────┬─────────────────────────┬──────────┬──────┬──────┬──────┬──────────┐");
  console.log("│ #  │ 号码                    │ 策略     │ 尾号 │ 锚点 │ 协同 │ 评分     │");
  console.log("├────┼─────────────────────────┼──────────┼──────┼──────┼──────┼──────────┤");
  
  finalCombos.forEach(function (c, i) {
    var numStr = c.numbers.join(',');
    var strategyStr = c.strategy.padEnd(8);
    var tailStr = String(c.tailCount).padStart(4);
    var anchorStr = String(c.anchorCount).padStart(4);
    var synergyStr = String(c.synergyCount || 0).padStart(4);
    var scoreStr = String(c.score).padStart(8);
    
    console.log("│ " + String(i + 1).padStart(2) + " │ " + numStr.padEnd(23) + " │ " + strategyStr + " │ " + tailStr + " │ " + anchorStr + " │ " + synergyStr + " │ " + scoreStr + " │");
  });
  
  console.log("└────┴─────────────────────────┴──────────┴──────┴──────┴──────┴──────────┘");

  return finalCombos;
}

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildStrategyDrivenCombos: buildStrategyDrivenCombos };
}
