/**
 * 快速验证尾号融合优化效果
 */

const fs = require('fs');
const vm = require('vm');

// 加载开奖数据
const allDrawsCode = fs.readFileSync('./all_draws.js', 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(allDrawsCode, sandbox);
const ALL_DRAWS_DATA = sandbox.window.ALL_DRAWS_DATA;

// 按期号升序排列（旧→新）
const draws = [...ALL_DRAWS_DATA].sort((a, b) => {
  const numA = parseInt(a.issue);
  const numB = parseInt(b.issue);
  return numA - numB;
}).filter(d => d.front && d.front.length === 5);

console.log(`数据范围: ${draws[0].issue} ~ ${draws[draws.length - 1].issue} (共${draws.length}期)`);

// 测试配置
const configs = [
  {
    name: "基线: 简单加权合并",
    tailFusion: (samples, weights) => {
      const tailMap = new Map();
      samples.forEach((sample, idx) => {
        const w = weights[idx] || 0.1;
        (sample.predictedTails || []).forEach(([t, s]) => {
          tailMap.set(t, (tailMap.get(t) || 0) + s * w);
        });
      });
      return [...tailMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    }
  },
  {
    name: "优化: 尾号转移模式融合",
    tailFusion: (samples, weights) => {
      const tailScores = new Map();
      for (let t = 0; t <= 9; t++) tailScores.set(t, 0);
      
      const allSourceTails = [];
      samples.forEach((sample, idx) => {
        const w = weights[idx] || 0.1;
        const sourceTails = sample.selectedNumbers ? [...new Set(sample.selectedNumbers.map(n => n % 10))] : [];
        allSourceTails.push({ tails: sourceTails, weight: w });
        
        sourceTails.forEach(t => {
          tailScores.set(t, tailScores.get(t) + 10 * w);
        });
        
        (sample.predictedTails || []).forEach(([t, s]) => {
          tailScores.set(t, tailScores.get(t) + s * w * 0.3);
        });
      });
      
      allSourceTails.forEach(({ tails, weight }) => {
        tails.forEach(t => {
          tailScores.set(t, tailScores.get(t) + 8 * weight);
          tailScores.set((t + 1) % 10, tailScores.get((t + 1) % 10) + 6 * weight);
          tailScores.set((t + 9) % 10, tailScores.get((t + 9) % 10) + 6 * weight);
          tailScores.set((t + 2) % 10, tailScores.get((t + 2) % 10) + 4 * weight);
          tailScores.set((t + 8) % 10, tailScores.get((t + 8) % 10) + 4 * weight);
          tailScores.set((t + 3) % 10, tailScores.get((t + 3) % 10) + 2 * weight);
          tailScores.set((t + 7) % 10, tailScores.get((t + 7) % 10) + 2 * weight);
        });
      });
      
      const tailConsistency = new Map();
      for (let t = 0; t <= 9; t++) tailConsistency.set(t, 0);
      allSourceTails.forEach(({ tails }) => {
        tails.forEach(t => tailConsistency.set(t, tailConsistency.get(t) + 1));
      });
      
      tailConsistency.forEach((count, t) => {
        if (count >= 2) {
          tailScores.set(t, tailScores.get(t) + 6 * count);
        }
      });
      
      return [...tailScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    }
  }
];

// 回测函数
function runBacktest(config, draws) {
  const PREDICT_INTERVAL = 10;
  const V4_POOL_SIZE = 30;
  const weights = [0.5, 0.3, 0.2];
  const sourceConfig = { mainOffset: 9, auxOffsets: [6, 3] };
  
  let sumTop5Max = 0, sumUnion = 0, sumPool = 0;
  let cnt = 0;
  
  const testLimit = Math.min(30, draws.length - PREDICT_INTERVAL - 1);
  
  for (let sourceIdx = 1; sourceIdx <= testLimit; sourceIdx++) {
    const targetIdx = sourceIdx + PREDICT_INTERVAL;
    const targetDraw = draws[targetIdx];
    if (!targetDraw) continue;
    
    const targetNums = [...targetDraw.front].sort((a, b) => a - b);
    const targetSet = new Set(targetNums);
    
    const mainSourceIdx = sourceIdx + sourceConfig.mainOffset;
    const auxSourceIdx1 = sourceIdx + sourceConfig.auxOffsets[0];
    const auxSourceIdx2 = sourceIdx + sourceConfig.auxOffsets[1];
    
    if (mainSourceIdx < 0 || mainSourceIdx >= draws.length) continue;
    if (auxSourceIdx1 < 0 || auxSourceIdx1 >= draws.length) continue;
    if (auxSourceIdx2 < 0 || auxSourceIdx2 >= draws.length) continue;
    
    const mainDraw = draws[mainSourceIdx];
    const auxDraw1 = draws[auxSourceIdx1];
    const auxDraw2 = draws[auxSourceIdx2];
    
    if (!mainDraw || !auxDraw1 || !auxDraw2) continue;
    
    const samples = [
      { selectedNumbers: mainDraw.front, predictedTails: mainDraw.front.map(n => [n % 10, 10]) },
      { selectedNumbers: auxDraw1.front, predictedTails: auxDraw1.front.map(n => [n % 10, 8]) },
      { selectedNumbers: auxDraw2.front, predictedTails: auxDraw2.front.map(n => [n % 10, 6]) }
    ];
    
    const fusedTails = config.tailFusion(samples, weights);
    const top5Tails = new Set(fusedTails.slice(0, 5).map(([t]) => t));
    
    const scoreMap = new Map();
    
    mainDraw.front.forEach(n => {
      const tail = n % 10;
      const tailBonus = top5Tails.has(tail) ? 20 : 0;
      scoreMap.set(n, (scoreMap.get(n) || 0) + 100 * weights[0] + tailBonus);
    });
    
    auxDraw1.front.forEach(n => {
      const tail = n % 10;
      const tailBonus = top5Tails.has(tail) ? 15 : 0;
      scoreMap.set(n, (scoreMap.get(n) || 0) + 80 * weights[1] + tailBonus);
    });
    
    auxDraw2.front.forEach(n => {
      const tail = n % 10;
      const tailBonus = top5Tails.has(tail) ? 10 : 0;
      scoreMap.set(n, (scoreMap.get(n) || 0) + 60 * weights[2] + tailBonus);
    });
    
    for (let n = 1; n <= 35; n++) {
      const tail = n % 10;
      if (top5Tails.has(tail) && !scoreMap.has(n)) {
        scoreMap.set(n, 30);
      }
    }
    
    const poolNums = [...scoreMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, V4_POOL_SIZE)
      .map(([num]) => num);
    const poolSet = new Set(poolNums);
    
    const top5 = [];
    const sortedPool = poolNums.sort((a, b) => (scoreMap.get(b) || 0) - (scoreMap.get(a) || 0));
    
    const top1 = sortedPool.slice(0, 5).sort((a, b) => a - b);
    top5.push({ numbers: top1 });
    
    const usedNums = new Set(top1);
    for (let t = 0; t < 4; t++) {
      const variant = [...top1];
      const replaceCount = Math.random() < 0.5 ? 1 : 2;
      for (let r = 0; r < replaceCount; r++) {
        const replaceIdx = Math.floor(Math.random() * 5);
        for (const num of sortedPool) {
          if (!variant.includes(num) && !usedNums.has(num)) {
            variant[replaceIdx] = num;
            usedNums.add(num);
            break;
          }
        }
      }
      top5.push({ numbers: variant.sort((a, b) => a - b) });
    }
    
    const top5Hits = top5.map(c => c.numbers.filter(n => targetSet.has(n)).length);
    const maxTop5Hit = Math.max(...top5Hits);
    
    const top5Union = new Set();
    top5.forEach(c => c.numbers.forEach(n => top5Union.add(n)));
    const top5UnionCoverage = targetNums.filter(n => top5Union.has(n)).length;
    
    const poolCoverage = targetNums.filter(n => poolSet.has(n)).length;
    
    sumTop5Max += maxTop5Hit;
    sumUnion += top5UnionCoverage;
    sumPool += poolCoverage;
    cnt++;
  }
  
  if (cnt === 0) return null;
  
  return {
    cnt,
    top5Rate: (sumTop5Max / (cnt * 5) * 100).toFixed(1),
    unionRate: (sumUnion / (cnt * 5) * 100).toFixed(1),
    poolRate: (sumPool / (cnt * 5) * 100).toFixed(1)
  };
}

// 运行测试
console.log("\n" + "=".repeat(80));
console.log("快速验证尾号融合优化效果（前30期）");
console.log("=".repeat(80));
console.log("");

const results = [];

for (const config of configs) {
  console.log(`测试: ${config.name}`);
  const result = runBacktest(config, draws);
  
  if (result) {
    results.push({
      config: config.name,
      ...result
    });
    console.log(`  结果: Top5=${result.top5Rate}%, 联合=${result.unionRate}%, 池=${result.poolRate}%`);
  }
}

// 对比结果
if (results.length === 2) {
  const baseline = results[0];
  const optimized = results[1];
  
  console.log("\n" + "=".repeat(80));
  console.log("优化效果对比");
  console.log("=".repeat(80));
  console.log("");
  console.log(`指标 | 基线 | 优化后 | 变化`);
  console.log("-".repeat(50));
  console.log(`Top5命中率 | ${baseline.top5Rate}% | ${optimized.top5Rate}% | ${(parseFloat(optimized.top5Rate) - parseFloat(baseline.top5Rate)).toFixed(1)}pp`);
  console.log(`联合覆盖率 | ${baseline.unionRate}% | ${optimized.unionRate}% | ${(parseFloat(optimized.unionRate) - parseFloat(baseline.unionRate)).toFixed(1)}pp`);
  console.log(`池覆盖率 | ${baseline.poolRate}% | ${optimized.poolRate}% | ${(parseFloat(optimized.poolRate) - parseFloat(baseline.poolRate)).toFixed(1)}pp`);
}

// 保存结果
const output = {
  timestamp: new Date().toISOString(),
  results: results
};

fs.writeFileSync('./quick_tail_fusion_test.json', JSON.stringify(output, null, 2));
console.log("\n结果已保存到 quick_tail_fusion_test.json");
