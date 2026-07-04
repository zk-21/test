// 多模式组合回测脚本：多段连续 + 其他关联性模式（尾号对/三元组/连续/等差/混合）
const fs = require('fs');
const originalCode = fs.readFileSync('script回测.js', 'utf8');

const oldSelectionCode = `      const selectedFront = poolNumbers.length > 0
        ? selectCoverageOptimalCombos(allCombos, poolNumbers, 5, tailRelationData)
        : allCombos.slice(0, 5);`;

const newSelectionCode = `      // ═══ 多模式组合选择Top5 = 多段连续(2) + 其他关联性模式(3) ═══
      const tailCorrelationForMM = analyzeTailCorrelation(__allBalls, sourceRow, 100);
      
      // 获取所有关联性模式
      const allModes = [];
      
      // 多段连续模式（优先）
      const msPatterns = [...tailCorrelationForMM.multiSegmentFreq.entries()]
        .sort((a, b) => b[1] - a[1]).slice(0, 3);
      for (const [pattern, count] of msPatterns) {
        allModes.push({ type: 'multiSegment', pattern, count, priority: 3 });
      }
      
      // 连续三元组模式
      const consecPatterns = [...tailCorrelationForMM.consecutiveTripletFreq.entries()]
        .sort((a, b) => b[1] - a[1]).slice(0, 3);
      for (const [pattern, count] of consecPatterns) {
        allModes.push({ type: 'consecutive', pattern, count, priority: 2 });
      }
      
      // 等差三元组模式
      const arithPatterns = [...tailCorrelationForMM.arithmeticTripletFreq.entries()]
        .sort((a, b) => b[1] - a[1]).slice(0, 3);
      for (const [pattern, count] of arithPatterns) {
        allModes.push({ type: 'arithmetic', pattern, count, priority: 2 });
      }
      
      // 尾号对模式
      const pairPatterns = [...tailCorrelationForMM.tailPairFreq.entries()]
        .sort((a, b) => b[1] - a[1]).slice(0, 3);
      for (const [pattern, count] of pairPatterns) {
        allModes.push({ type: 'pair', pattern, count, priority: 1 });
      }
      
      // 混合模式
      const mixedPatterns = [...tailCorrelationForMM.mixedPatternFreq.entries()]
        .sort((a, b) => b[1] - a[1]).slice(0, 3);
      for (const [pattern, count] of mixedPatterns) {
        allModes.push({ type: 'mixed', pattern, count, priority: 2 });
      }
      
      // 按优先级和频率排序
      allModes.sort((a, b) => b.priority - a.priority || b.count - a.count);
      
      let selectedFront = [];
      const usedKeys = new Set();
      const usedTailSets = new Set();
      
      // 从每种模式中选1个最优组合，优先多段连续
      const allTails = [0,1,2,3,4,5,6,7,8,9];
      
      for (const mode of allModes) {
        if (selectedFront.length >= 5) break;
        
        let baseTails;
        if (mode.type === 'multiSegment') {
          const segments = mode.pattern.split('|');
          baseTails = segments.flatMap(seg => seg.split(',').map(Number));
        } else {
          baseTails = mode.pattern.split(',').map(Number);
        }
        baseTails = [...new Set(baseTails)].sort((a,b) => a-b);
        
        // 补充到5个尾号
        const result = [...baseTails];
        const used = new Set(baseTails);
        const target = 5;
        
        for (const [tail] of predictedTails) {
          if (result.length >= target) break;
          if (!used.has(tail)) { result.push(tail); used.add(tail); }
        }
        for (const tail of allTails) {
          if (result.length >= target) break;
          if (!used.has(tail)) { result.push(tail); used.add(tail); }
        }
        
        const tailKey = result.sort((a,b)=>a-b).join(',');
        if (usedTailSets.has(tailKey)) continue;
        usedTailSets.add(tailKey);
        
        const modeTailsSet = new Set(result);
        
        const scored = allCombos.map(combo => {
          const nums = combo.numbers || [];
          let matchScore = 0;
          nums.forEach(n => { if (modeTailsSet.has(n % 10)) matchScore += 10; });
          matchScore += mode.count * 0.5;
          return { ...combo, modeScore: matchScore + (combo.weightedScore || combo.score || 0) * 0.1 };
        });
        
        scored.sort((a, b) => b.modeScore - a.modeScore);
        
        for (const c of scored) {
          const key = c.numbers ? c.numbers.join(',') : c.key;
          if (!usedKeys.has(key)) {
            selectedFront.push(c);
            usedKeys.add(key);
            break;
          }
        }
      }
      
      // 如果不足5个，用覆盖优先补充
      if (selectedFront.length < 5) {
        const coverageSelected = poolNumbers.length > 0
          ? selectCoverageOptimalCombos(allCombos, poolNumbers, 5, tailRelationData)
          : allCombos.slice(0, 5);
        
        for (const c of coverageSelected) {
          if (selectedFront.length >= 5) break;
          const key = c.numbers ? c.numbers.join(',') : c.key;
          if (!usedKeys.has(key)) {
            selectedFront.push(c);
            usedKeys.add(key);
          }
        }
      }
      
      // 最后补充
      if (selectedFront.length < 5) {
        for (const c of allCombos) {
          if (selectedFront.length >= 5) break;
          const key = c.numbers ? c.numbers.join(',') : c.key;
          if (!usedKeys.has(key)) {
            selectedFront.push(c);
            usedKeys.add(key);
          }
        }
      }`;

const modifiedCode = originalCode.replace(oldSelectionCode, newSelectionCode);
if (modifiedCode === originalCode) {
  console.error('替换失败'); process.exit(1);
}
fs.writeFileSync('script回测_multimode.js', modifiedCode, 'utf8');
console.log('已生成 script回测_multimode.js');
console.log('Top5 = 多段连续(2) + 连续(1) + 等差(1) + 混合(1)');
