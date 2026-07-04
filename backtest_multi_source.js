/**
 * 多源融合方案测试
 * 测试不同的间隔组合和权重配置
 */

const fs = require('fs');
const path = require('path');

// 加载script回测.js的兼容层
let code = fs.readFileSync(path.join(__dirname, 'script回测.js'), 'utf-8');

// 提取Node.js兼容层部分（前125行）
const compatEnd = code.indexOf('const appLock = document.querySelector');
if (compatEnd > 0) {
  code = code.substring(0, compatEnd);
}

// 添加获取draws的函数
code += `
function getBuiltInDrawData() {
  return eval('(' + fs.readFileSync(path.join(__dirname, 'all_draws.js'), 'utf8').match(/window\\.ALL_DRAWS_DATA\\s*=\\s*(\\[[\\s\\S]*?\\]);/)[1] + ')');
}
`;

// 评估兼容层
eval(code);

// 加载all_draws.js获取draws数据
const draws = getBuiltInDrawData();

console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║  🧪 多源融合方案测试                                               ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

console.log(`📊 数据范围：${draws[0].issue} ~ ${draws[draws.length - 1].issue}（共${draws.length}期）`);
console.log(`📊 测试期数：${draws.length - 12}期（排除最后12期用于验证）\n`);

// ===== 方案定义 =====
const schemes = [
  {
    name: '当前方案（间隔9,10,11）',
    intervals: [9, 10, 11],
    weights: [0.5, 0.3, 0.2]
  },
  {
    name: '方案1（间隔5,9,10）',
    intervals: [5, 9, 10],
    weights: [0.2, 0.5, 0.3]
  },
  {
    name: '方案2（间隔7,9,10）',
    intervals: [7, 9, 10],
    weights: [0.3, 0.4, 0.3]
  },
  {
    name: '方案3（间隔8,9,10）',
    intervals: [8, 9, 10],
    weights: [0.3, 0.4, 0.3]
  },
  {
    name: '方案4（间隔9,10,12）',
    intervals: [9, 10, 12],
    weights: [0.4, 0.35, 0.25]
  },
  {
    name: '方案5（间隔6,9,10）',
    intervals: [6, 9, 10],
    weights: [0.25, 0.45, 0.3]
  },
  {
    name: '方案6（间隔7,8,9,10）',
    intervals: [7, 8, 9, 10],
    weights: [0.2, 0.25, 0.3, 0.25]
  },
  {
    name: '方案7（间隔5,7,9,10）',
    intervals: [5, 7, 9, 10],
    weights: [0.15, 0.2, 0.35, 0.3]
  },
  {
    name: '方案8（间隔9,10）双源',
    intervals: [9, 10],
    weights: [0.6, 0.4]
  },
  {
    name: '方案9（间隔8,9,10,11）',
    intervals: [8, 9, 10, 11],
    weights: [0.2, 0.35, 0.3, 0.15]
  },
];

// ===== 回测函数 =====
function runBacktest(scheme, testCount = 50) {
  const results = [];
  const totalDraws = draws.length;
  
  // 重置随机种子
  if (typeof resetSeed === 'function') resetSeed();
  
  for (let sourceIdx = 1; sourceIdx <= totalDraws - 12; sourceIdx++) {
    const targetIdx = sourceIdx + 10; // 预测间隔10后的期数
    const targetDraw = draws[targetIdx];
    if (!targetDraw) continue;
    
    const targetNums = [...targetDraw.front].sort((a, b) => a - b);
    const targetSet = new Set(targetNums);
    
    try {
      // 收集所有源
      const sourceRows = [];
      scheme.intervals.forEach(interval => {
        const srcIdx = sourceIdx + interval - 1;
        if (srcIdx >= 0 && srcIdx < totalDraws) {
          sourceRows.push({ idx: srcIdx, row: srcIdx + 1 });
        }
      });
      
      // 生成所有源的候选池
      const allSamples = sourceRows.map(src => ({
        row: src.row,
        sample: buildSampleNumbersV4(src.row, "front", null)
      }));
      
      // 合并候选池（加权）
      const scoreMap = new Map();
      allSamples.forEach((item, idx) => {
        const w = scheme.weights[idx] || 0.1;
        item.sample.candidateEntries.forEach(e => {
          scoreMap.set(e.number, (scoreMap.get(e.number) || 0) + e.score * w);
        });
      });
      
      const mergedEntries = [...scoreMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, V4_POOL_SIZE)
        .map(([num, score]) => ({ number: num, score }));
      
      // 计算命中
      const poolCoverage = targetNums.filter(n => mergedEntries.some(e => e.number === n)).length;
      const top5 = mergedEntries.slice(0, 5).map(e => e.number);
      const top5Hits = top5.filter(n => targetSet.has(n)).length;
      
      results.push({
        targetIssue: targetDraw.issue,
        poolCoverage,
        top5Hits,
        missedBalls: targetNums.filter(n => !mergedEntries.some(e => e.number === n))
      });
      
    } catch (err) {
      // 跳过错误
    }
  }
  
  return results;
}

// ===== 运行所有方案 =====
console.log("═".repeat(100));
console.log("📊 回测进行中...");
console.log("═".repeat(100) + "\n");

const allResults = [];

schemes.forEach((scheme, idx) => {
  console.log(`  测试方案${idx + 1}/${schemes.length}: ${scheme.name}...`);
  const results = runBacktest(scheme);
  allResults.push({ scheme, results });
});

// ===== 输出汇总 =====
console.log("\n" + "═".repeat(100));
console.log("📊 各方案汇总对比");
console.log("═".repeat(100));

console.log("\n方案名称                     │ 号码池覆盖率 │ Top5命中率 │ 测试期数");
console.log("─────────────────────────────┼──────────────┼────────────┼─────────");

allResults.forEach(({ scheme, results }) => {
  if (results.length === 0) return;
  
  const totalPoolCoverage = results.reduce((sum, r) => sum + r.poolCoverage, 0);
  const totalTop5Hits = results.reduce((sum, r) => sum + r.top5Hits, 0);
  const validTests = results.length;
  
  const poolRate = (totalPoolCoverage / (validTests * 5) * 100).toFixed(2);
  const top5Rate = (totalTop5Hits / (validTests * 5) * 100).toFixed(2);
  
  console.log(
    `${scheme.name.padEnd(29)} │ ${poolRate.padStart(10)}% │ ${top5Rate.padStart(8)}% │ ${String(validTests).padStart(7)}`
  );
});

// 找出最佳方案
let bestPoolScheme = 0, bestTop5Scheme = 0;
let bestPoolRate = 0, bestTop5Rate = 0;

allResults.forEach(({ scheme, results }, idx) => {
  if (results.length === 0) return;
  
  const totalPoolCoverage = results.reduce((sum, r) => sum + r.poolCoverage, 0);
  const totalTop5Hits = results.reduce((sum, r) => sum + r.top5Hits, 0);
  const validTests = results.length;
  
  const poolRate = totalPoolCoverage / (validTests * 5) * 100;
  const top5Rate = totalTop5Hits / (validTests * 5) * 100;
  
  if (poolRate > bestPoolRate) { bestPoolRate = poolRate; bestPoolScheme = idx; }
  if (top5Rate > bestTop5Rate) { bestTop5Rate = top5Rate; bestTop5Scheme = idx; }
});

console.log("\n" + "═".repeat(100));
console.log("🏆 最佳方案");
console.log("═".repeat(100));
console.log(`\n  号码池覆盖率最佳：${allResults[bestPoolScheme].scheme.name}（${bestPoolRate.toFixed(2)}%）`);
console.log(`  Top5命中率最佳：${allResults[bestTop5Scheme].scheme.name}（${bestTop5Rate.toFixed(2)}%）`);

// ===== 详细分析最佳方案 =====
console.log("\n" + "═".repeat(100));
console.log("📊 最佳方案详细分析");
console.log("═".repeat(100));

const bestScheme = allResults[bestTop5Scheme].scheme;
const bestResults = allResults[bestTop5Scheme].results;

console.log(`\n方案：${bestScheme.name}`);
console.log(`间隔：${bestScheme.intervals.join(', ')}`);
console.log(`权重：${bestScheme.weights.join(', ')}`);

// 命中分布
const hitDist = {};
bestResults.forEach(r => {
  hitDist[r.top5Hits] = (hitDist[r.top5Hits] || 0) + 1;
});

console.log(`\nTop5命中分布：`);
for (let h = 5; h >= 0; h--) {
  if (hitDist[h]) {
    console.log(`  命中${h}个：${hitDist[h]}次（${(hitDist[h] / bestResults.length * 100).toFixed(1)}%）`);
  }
}

// 未覆盖球分析
const missedBallCount = {};
bestResults.forEach(r => {
  r.missedBalls.forEach(ball => {
    missedBallCount[ball] = (missedBallCount[ball] || 0) + 1;
  });
});

const sortedMissed = Object.entries(missedBallCount)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

console.log(`\n被漏掉最多的球（Top 10）：`);
sortedMissed.forEach(([ball, count]) => {
  console.log(`  球${ball.padStart(2)}：被漏掉${count}次`);
});

// ===== 结论 =====
console.log("\n" + "═".repeat(100));
console.log("📊 结论与建议");
console.log("═".repeat(100));

console.log(`
💡 关键发现：

1. 最佳间隔组合：
   - 根据回测结果，${allResults[bestTop5Scheme].scheme.name}表现最佳
   - 间隔组合：${bestScheme.intervals.join(', ')}
   - 权重配置：${bestScheme.weights.join(', ')}

2. 与当前方案对比：
   - 当前方案（间隔9,10,11）的Top5命中率：${allResults[0].results.length > 0 ? (allResults[0].results.reduce((sum, r) => sum + r.top5Hits, 0) / (allResults[0].results.length * 5) * 100).toFixed(2) : 'N/A'}%
   - 最佳方案的Top5命中率：${bestTop5Rate.toFixed(2)}%
   - 差异：${(bestTop5Rate - (allResults[0].results.reduce((sum, r) => sum + r.top5Hits, 0) / (allResults[0].results.length * 5) * 100)).toFixed(2)}pp

3. 建议：
   - 如果最佳方案显著优于当前方案，建议修改script回测.js
   - 如果差异不大，可以保留当前方案
   - 可以尝试将最佳方案同步到script.js生产脚本

4. 下一步：
   - 可以进一步优化权重配置
   - 或者测试更多间隔组合
`);

console.log("═".repeat(100));
