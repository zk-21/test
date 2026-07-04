// 分析"间隔填充"模式：上期尾号的等差间隔中，下期出现中间值的规律
const fs = require('fs');
const path = require('path');

// 加载数据
const rawJs = fs.readFileSync(path.join(__dirname, 'all_draws.js'), 'utf8');
const match = rawJs.match(/window\.ALL_DRAWS_DATA\s*=\s*(\[[\s\S]*?\]);/);
const ALL_DRAWS_DATA = eval(match[1]);

// 按期号升序排列（从旧到新）
const draws = ALL_DRAWS_DATA.sort((a, b) => parseInt(a.issue) - parseInt(b.issue));

console.log(`共${draws.length}期数据`);
console.log(`数据范围: ${draws[0].issue} ~ ${draws[draws.length-1].issue}\n`);

// 分析函数
function analyzeGapFillPattern() {
  // 统计结构
  const stats = {
    totalPairs: 0,           // 总等差对数
    gapSize: {},             // 按间隔大小统计
    hitByGap: {},            // 按间隔大小的命中数
    middleValueHit: 0,       // 中间值命中次数
    extendedValueHit: 0,     // 延伸值命中次数
    neighborHit: 0,          // 邻号命中次数
    totalDraws: 0,           // 分析的期数
    hitDraws: 0,             // 命中的期数（至少命中一个）
    examples: [],            // 命中示例
    missExamples: [],        // 未命中示例
  };

  // 详细统计：按间隔大小分类
  for (let gap = 1; gap <= 8; gap++) {
    stats.gapSize[gap] = 0;
    stats.hitByGap[gap] = 0;
  }

  // 逐期分析
  for (let i = 1; i < draws.length; i++) {
    const prevDraw = draws[i - 1];
    const currDraw = draws[i];
    
    const prevTails = [...new Set(prevDraw.front.map(n => n % 10))].sort((a, b) => a - b);
    const currTails = [...new Set(currDraw.front.map(n => n % 10))];
    const currTailSet = new Set(currTails);
    
    stats.totalDraws++;
    let drawHit = false;
    const drawPairs = [];
    const drawHits = [];
    
    // 找出上期尾号中的所有等差对
    for (let a = 0; a < prevTails.length; a++) {
      for (let b = a + 1; b < prevTails.length; b++) {
        const t1 = prevTails[a];
        const t2 = prevTails[b];
        const gap = t2 - t1;
        
        // 只考虑间隔2-4的等差对（间隔1太密集，间隔5+太稀疏）
        if (gap >= 2 && gap <= 4) {
          stats.totalPairs++;
          stats.gapSize[gap] = (stats.gapSize[gap] || 0) + 1;
          
          // 计算中间值和延伸值
          const middleValues = [];
          const extendedValues = [];
          const neighborValues = [];
          
          // 中间值：等差对之间的值
          for (let v = t1 + 1; v < t2; v++) {
            middleValues.push(v);
          }
          
          // 延伸值：等差对外推的值
          const ext1 = (t1 - gap + 10) % 10;  // 向左延伸
          const ext2 = (t2 + gap) % 10;        // 向右延伸
          extendedValues.push(ext1, ext2);
          
          // 邻号：中间值的±1
          for (const mv of middleValues) {
            neighborValues.push((mv - 1 + 10) % 10);
            neighborValues.push((mv + 1) % 10);
          }
          
          // 检查命中
          let pairHit = false;
          
          // 1. 中间值命中
          for (const mv of middleValues) {
            if (currTailSet.has(mv)) {
              stats.middleValueHit++;
              pairHit = true;
              drawHits.push({ type: '中间值', value: mv, pair: [t1, t2], gap });
            }
          }
          
          // 2. 延伸值命中
          for (const ev of extendedValues) {
            if (currTailSet.has(ev)) {
              stats.extendedValueHit++;
              pairHit = true;
              drawHits.push({ type: '延伸值', value: ev, pair: [t1, t2], gap });
            }
          }
          
          // 3. 邻号命中
          for (const nv of neighborValues) {
            if (currTailSet.has(nv)) {
              stats.neighborHit++;
              pairHit = true;
              drawHits.push({ type: '邻号', value: nv, pair: [t1, t2], gap });
            }
          }
          
          if (pairHit) {
            stats.hitByGap[gap] = (stats.hitByGap[gap] || 0) + 1;
            drawHit = true;
          }
          
          drawPairs.push({ pair: [t1, t2], gap, hit: pairHit });
        }
      }
    }
    
    if (drawHit) {
      stats.hitDraws++;
      if (stats.examples.length < 20) {
        stats.examples.push({
          issue: currDraw.issue,
          prevTails: prevTails.join(','),
          currTails: currTails.join(','),
          hits: drawHits,
          pairs: drawPairs.filter(p => p.hit)
        });
      }
    } else if (drawPairs.length > 0 && stats.missExamples.length < 10) {
      stats.missExamples.push({
        issue: currDraw.issue,
        prevTails: prevTails.join(','),
        currTails: currTails.join(','),
        pairs: drawPairs
      });
    }
  }
  
  return stats;
}

// 运行分析
const stats = analyzeGapFillPattern();

console.log('═══════════════════════════════════════════════════════');
console.log('        间隔填充模式分析结果');
console.log('═══════════════════════════════════════════════════════\n');

console.log(`分析期数: ${stats.totalDraws}`);
console.log(`总等差对数: ${stats.totalPairs}`);
console.log(`命中期数: ${stats.hitDraws} (${(stats.hitDraws/stats.totalDraws*100).toFixed(1)}%)`);
console.log();

console.log('【按间隔大小统计】');
for (let gap = 2; gap <= 4; gap++) {
  const total = stats.gapSize[gap] || 0;
  const hit = stats.hitByGap[gap] || 0;
  const rate = total > 0 ? (hit / total * 100).toFixed(1) : '0.0';
  console.log(`间隔${gap}: ${total}对, 命中${hit}对 (${rate}%)`);
}

console.log('\n【命中类型统计】');
const totalHits = stats.middleValueHit + stats.extendedValueHit + stats.neighborHit;
console.log(`中间值命中: ${stats.middleValueHit}次 (${(stats.middleValueHit/totalHits*100).toFixed(1)}%)`);
console.log(`延伸值命中: ${stats.extendedValueHit}次 (${(stats.extendedValueHit/totalHits*100).toFixed(1)}%)`);
console.log(`邻号命中: ${stats.neighborHit}次 (${(stats.neighborHit/totalHits*100).toFixed(1)}%)`);

console.log('\n═══════════════════════════════════════════════════════');
console.log('        命中示例（前10个）');
console.log('═══════════════════════════════════════════════════════\n');

stats.examples.slice(0, 10).forEach((ex, idx) => {
  console.log(`${idx+1}. 期号${ex.issue}:`);
  console.log(`   上期尾号: [${ex.prevTails}]`);
  console.log(`   下期尾号: [${ex.currTails}]`);
  console.log(`   命中:`);
  ex.hits.forEach(h => {
    console.log(`     - ${h.type} ${h.value} (来自等差对 ${h.pair[0]},${h.pair[1]} 间隔${h.gap})`);
  });
  console.log();
});

console.log('═══════════════════════════════════════════════════════');
console.log('        未命中示例（前5个）');
console.log('═══════════════════════════════════════════════════════\n');

stats.missExamples.slice(0, 5).forEach((ex, idx) => {
  console.log(`${idx+1}. 期号${ex.issue}:`);
  console.log(`   上期尾号: [${ex.prevTails}]`);
  console.log(`   下期尾号: [${ex.currTails}]`);
  console.log(`   等差对: ${ex.pairs.map(p => `[${p.pair}] 间隔${p.gap}`).join(', ')}`);
  console.log();
});

// 进一步分析：中间值的出现概率
console.log('═══════════════════════════════════════════════════════');
console.log('        中间值出现概率详细分析');
console.log('═══════════════════════════════════════════════════════\n');

// 重新分析，只关注间隔2的等差对（最常见）
function analyzeGap2Pattern() {
  let totalGap2Pairs = 0;
  let middleHit = 0;
  let middle1Hit = 0;  // 中间值是1个（间隔2）
  let middle2Hit = 0;  // 中间值命中至少1个（间隔3）
  let allMiddleHit = 0; // 所有中间值都命中
  
  const gap2Examples = [];
  
  for (let i = 1; i < draws.length; i++) {
    const prevDraw = draws[i - 1];
    const currDraw = draws[i];
    
    const prevTails = [...new Set(prevDraw.front.map(n => n % 10))].sort((a, b) => a - b);
    const currTailSet = new Set(currDraw.front.map(n => n % 10));
    
    for (let a = 0; a < prevTails.length; a++) {
      for (let b = a + 1; b < prevTails.length; b++) {
        const t1 = prevTails[a];
        const t2 = prevTails[b];
        const gap = t2 - t1;
        
        if (gap === 2) {
          totalGap2Pairs++;
          const middle = (t1 + t2) / 2; // 间隔2时，中间值 = (t1+t2)/2
          
          if (currTailSet.has(middle)) {
            middleHit++;
            if (gap2Examples.length < 15) {
              gap2Examples.push({
                issue: currDraw.issue,
                pair: [t1, t2],
                middle: middle,
                prevTails: prevTails.join(','),
                currTails: [...currDraw.front.map(n => n % 10)].sort((a,b)=>a-b).join(',')
              });
            }
          }
        } else if (gap === 3) {
          totalGap2Pairs++;
          const mid1 = t1 + 1;
          const mid2 = t1 + 2;
          
          let hit = false;
          if (currTailSet.has(mid1)) { middle1Hit++; hit = true; }
          if (currTailSet.has(mid2)) { middle2Hit++; hit = true; }
          if (currTailSet.has(mid1) && currTailSet.has(mid2)) allMiddleHit++;
          
          if (hit && gap2Examples.length < 15) {
            gap2Examples.push({
              issue: currDraw.issue,
              pair: [t1, t2],
              middle: `${mid1},${mid2}`,
              prevTails: prevTails.join(','),
              currTails: [...currDraw.front.map(n => n % 10)].sort((a,b)=>a-b).join(',')
            });
          }
        }
      }
    }
  }
  
  return { totalGap2Pairs, middleHit, middle1Hit, middle2Hit, allMiddleHit, examples: gap2Examples };
}

const gap2Stats = analyzeGap2Pattern();

console.log(`间隔2等差对总数: ${gap2Stats.totalGap2Pairs}`);
console.log(`中间值命中: ${gap2Stats.middleHit} (${(gap2Stats.middleHit/gap2Stats.totalGap2Pairs*100).toFixed(1)}%)`);
console.log();

console.log('【间隔2的中间值命中示例】');
gap2Stats.examples.slice(0, 10).forEach((ex, idx) => {
  console.log(`${idx+1}. 期号${ex.issue}: 等差对[${ex.pair}] → 中间值${ex.middle}`);
  console.log(`   上期: [${ex.prevTails}] → 下期: [${ex.currTails}]`);
});
