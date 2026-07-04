// 混合模式回测脚本：多段连续(3) + 覆盖优先(2)
const fs = require('fs');
const originalCode = fs.readFileSync('script回测.js', 'utf8');

const oldSelectionCode = `      const selectedFront = poolNumbers.length > 0
        ? selectCoverageOptimalCombos(allCombos, poolNumbers, 5, tailRelationData)
        : allCombos.slice(0, 5);`;

const newSelectionCode = `      // ═══ 混合模式选择Top5 = 多段连续(3) + 覆盖优先(2) ═══
      const tailCorrelationForMS = analyzeTailCorrelation(__allBalls, sourceRow, 100);
      const msPatterns = [...tailCorrelationForMS.multiSegmentFreq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
      
      let selectedFront = [];
      const usedKeys = new Set();
      
      // 第一步：从多段连续模式选3个最优组合
      if (msPatterns.length > 0) {
        const allTails = [0,1,2,3,4,5,6,7,8,9];
        const usedTailSets = new Set(); // 避免重复尾号组合
        
        for (const [pattern, count] of msPatterns) {
          if (selectedFront.length >= 3) break;
          
          const segments = pattern.split('|');
          let baseTails = segments.flatMap(seg => seg.split(',').map(Number));
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
          
          const msTailsSet = new Set(result);
          
          const scored = allCombos.map(combo => {
            const nums = combo.numbers || [];
            let matchScore = 0;
            nums.forEach(n => { if (msTailsSet.has(n % 10)) matchScore += 10; });
            matchScore += count * 0.5;
            return { ...combo, msScore: matchScore + (combo.weightedScore || combo.score || 0) * 0.1 };
          });
          
          scored.sort((a, b) => b.msScore - a.msScore);
          
          for (const c of scored) {
            if (selectedFront.length >= 3) break;
            const key = c.numbers ? c.numbers.join(',') : c.key;
            if (!usedKeys.has(key)) {
              selectedFront.push(c);
              usedKeys.add(key);
              break;
            }
          }
        }
      }
      
      // 第二步：用覆盖优先策略补充剩余2个
      const remaining = 5 - selectedFront.length;
      if (remaining > 0) {
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
      
      // 第三步：如果仍然不足
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
fs.writeFileSync('script回测_hybrid3.js', modifiedCode, 'utf8');
console.log('已生成 script回测_hybrid3.js (3个多段连续 + 2个覆盖优先)');
