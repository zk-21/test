// 混合模式回测脚本：多段连续 + 覆盖优先
// Top5 = 2个（或3个）多段连续 + 3个（或2个）覆盖优先

const fs = require('fs');

// 读取原始脚本
const originalCode = fs.readFileSync('script回测.js', 'utf8');

// 替换选择逻辑
const oldSelectionCode = `      const selectedFront = poolNumbers.length > 0
        ? selectCoverageOptimalCombos(allCombos, poolNumbers, 5, tailRelationData)
        : allCombos.slice(0, 5);`;

const newSelectionCode = `      // ═══ 混合模式选择Top5 = 多段连续(2) + 覆盖优先(3) ═══
      const tailCorrelationForMS = analyzeTailCorrelation(__allBalls, sourceRow, 100);
      const msPatterns = [...tailCorrelationForMS.multiSegmentFreq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      let selectedFront = [];
      const usedKeys = new Set();
      
      // 第一步：从多段连续模式选2个最优组合
      if (msPatterns.length > 0) {
        const allTails = [0,1,2,3,4,5,6,7,8,9];
        
        for (const [pattern, count] of msPatterns) {
          if (selectedFront.length >= 2) break;
          
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
          
          const msTailsSet = new Set(result);
          
          // 从候选组合中选出最匹配的
          const scored = allCombos.map(combo => {
            const nums = combo.numbers || [];
            let matchScore = 0;
            nums.forEach(n => { if (msTailsSet.has(n % 10)) matchScore += 10; });
            matchScore += count * 0.5;
            return { ...combo, msScore: matchScore + (combo.weightedScore || combo.score || 0) * 0.1 };
          });
          
          scored.sort((a, b) => b.msScore - a.msScore);
          
          for (const c of scored) {
            if (selectedFront.length >= 2) break;
            const key = c.numbers ? c.numbers.join(',') : c.key;
            if (!usedKeys.has(key)) {
              selectedFront.push(c);
              usedKeys.add(key);
              break; // 每个模式只取1个最优
            }
          }
        }
      }
      
      // 第二步：用覆盖优先策略补充剩余3个
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
      
      // 第三步：如果仍然不足，取剩余高分组合
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
  console.error('替换失败：未找到目标代码段');
  process.exit(1);
}

fs.writeFileSync('script回测_hybrid.js', modifiedCode, 'utf8');
console.log('已生成 script回测_hybrid.js');
console.log('修改内容：Top5 = 2个多段连续 + 3个覆盖优先');
