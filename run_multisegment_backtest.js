// 多段连续模式回测脚本
// 基于 script回测.js，将Top5选择策略从覆盖优先改为多段连续模式

const fs = require('fs');

// 读取原始脚本
const originalCode = fs.readFileSync('script回测.js', 'utf8');

// 在 selectCoverageOptimalCombos 调用后插入多段连续模式选择逻辑
// 找到关键代码段并替换

const oldSelectionCode = `      const selectedFront = poolNumbers.length > 0
        ? selectCoverageOptimalCombos(allCombos, poolNumbers, 5, tailRelationData)
        : allCombos.slice(0, 5);`;

const newSelectionCode = `      // ═══ 多段连续模式选择Top5 ═══
      // 分析尾号关联性，找出多段连续模式
      const tailCorrelationForMS = analyzeTailCorrelation(__allBalls, sourceRow, 100);
      const msPatterns = [...tailCorrelationForMS.multiSegmentFreq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      let selectedFront = [];
      
      if (msPatterns.length > 0) {
        // 从多段连续模式生成尾号组合
        const allTails = [0,1,2,3,4,5,6,7,8,9];
        const msCombos = [];
        
        for (const [pattern, count] of msPatterns) {
          const segments = pattern.split('|');
          let baseTails = segments.flatMap(seg => seg.split(',').map(Number));
          baseTails = [...new Set(baseTails)].sort((a,b) => a-b);
          
          // 补充到5个尾号
          const result = [...baseTails];
          const used = new Set(baseTails);
          const target = 5;
          
          // 从预测尾号补充
          for (const [tail] of predictedTails) {
            if (result.length >= target) break;
            if (!used.has(tail)) { result.push(tail); used.add(tail); }
          }
          // 从所有尾号补充
          for (const tail of allTails) {
            if (result.length >= target) break;
            if (!used.has(tail)) { result.push(tail); used.add(tail); }
          }
          
          msCombos.push({ tails: result.sort((a,b)=>a-b), pattern, count });
        }
        
        // 从候选组合中选出最匹配多段尾号的组合
        const msTailsSet = new Set(msCombos.flatMap(c => c.tails));
        
        const scored = allCombos.map(combo => {
          const nums = combo.numbers || [];
          let matchScore = 0;
          nums.forEach(n => { if (msTailsSet.has(n % 10)) matchScore += 10; });
          // 额外加权：匹配高频多段模式的尾号
          msCombos.forEach(mc => {
            mc.tails.forEach(t => {
              if (nums.some(n => n % 10 === t)) matchScore += mc.count * 0.5;
            });
          });
          return { ...combo, msScore: matchScore + (combo.weightedScore || combo.score || 0) * 0.1 };
        });
        
        scored.sort((a, b) => b.msScore - a.msScore);
        
        // 选Top5，去重
        const usedKeys = new Set();
        for (const c of scored) {
          if (selectedFront.length >= 5) break;
          const key = c.numbers ? c.numbers.join(',') : c.key;
          if (!usedKeys.has(key)) {
            selectedFront.push(c);
            usedKeys.add(key);
          }
        }
      }
      
      // 如果多段连续模式不足5个，用覆盖优先补充
      if (selectedFront.length < 5) {
        const coverageSelected = poolNumbers.length > 0
          ? selectCoverageOptimalCombos(allCombos, poolNumbers, 5, tailRelationData)
          : allCombos.slice(0, 5);
        const existKeys = new Set(selectedFront.map(c => c.numbers ? c.numbers.join(',') : c.key));
        for (const c of coverageSelected) {
          if (selectedFront.length >= 5) break;
          const key = c.numbers ? c.numbers.join(',') : c.key;
          if (!existKeys.has(key)) {
            selectedFront.push(c);
            existKeys.add(key);
          }
        }
      }
      
      // 如果仍然不足，直接取前5
      if (selectedFront.length < 5) {
        const existKeys = new Set(selectedFront.map(c => c.numbers ? c.numbers.join(',') : c.key));
        for (const c of allCombos) {
          if (selectedFront.length >= 5) break;
          const key = c.numbers ? c.numbers.join(',') : c.key;
          if (!existKeys.has(key)) {
            selectedFront.push(c);
            existKeys.add(key);
          }
        }
      }`;

// 替换代码
const modifiedCode = originalCode.replace(oldSelectionCode, newSelectionCode);

// 验证替换是否成功
if (modifiedCode === originalCode) {
  console.error('替换失败：未找到目标代码段');
  process.exit(1);
}

// 写入新文件
fs.writeFileSync('script回测_multisegment.js', modifiedCode, 'utf8');
console.log('已生成 script回测_multisegment.js');
console.log('修改内容：将Top5选择策略从覆盖优先改为多段连续模式优先');
console.log('');
console.log('运行命令：');
console.log('  node script回测_multisegment.js');
