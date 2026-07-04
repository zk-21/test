/**
 * 快速验证三源融合优化效果
 * 只测试前30期，快速验证优化效果
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
    name: "基线: N+9/N/N-1",
    mainOffset: 9,
    auxOffsets: [0, -1],
    weights: [0.5, 0.3, 0.2]
  },
  {
    name: "优化: N+9/N+6/N+3",
    mainOffset: 9,
    auxOffsets: [6, 3],
    weights: [0.5, 0.3, 0.2]
  }
];

// 回测函数
function runBacktest(config, draws) {
  const PREDICT_INTERVAL = 10;
  const V4_POOL_SIZE = 30;
  
  let sumTop5Max = 0, sumUnion = 0, sumPool = 0;
  let cnt = 0;
  
  // 测试前30期
  const testLimit = Math.min(30, draws.length - PREDICT_INTERVAL - 1);
  
  for (let sourceIdx = 1; sourceIdx <= testLimit; sourceIdx++) {
    const targetIdx = sourceIdx + PREDICT_INTERVAL;
    const targetDraw = draws[targetIdx];
    if (!targetDraw) continue;
    
    const targetNums = [...targetDraw.front].sort((a, b) => a - b);
    const targetSet = new Set(targetNums);
    
    // 计算源索引
    const mainSourceIdx = sourceIdx + config.mainOffset;
    const auxSourceIdx1 = sourceIdx + config.auxOffsets[0];
    const auxSourceIdx2 = sourceIdx + config.auxOffsets[1];
    
    // 检查索引有效性
    if (mainSourceIdx < 0 || mainSourceIdx >= draws.length) continue;
    if (auxSourceIdx1 < 0 || auxSourceIdx1 >= draws.length) continue;
    if (auxSourceIdx2 < 0 || auxSourceIdx2 >= draws.length) continue;
    
    // 获取源数据
    const mainDraw = draws[mainSourceIdx];
    const auxDraw1 = draws[auxSourceIdx1];
    const auxDraw2 = draws[auxSourceIdx2];
    
    if (!mainDraw || !auxDraw1 || !auxDraw2) continue;
    
    // 候选池生成（加权合并）
    const scoreMap = new Map();
    
    // 主源
    mainDraw.front.forEach(n => {
      scoreMap.set(n, (scoreMap.get(n) || 0) + 100 * config.weights[0]);
    });
    
    // 辅源1
    auxDraw1.front.forEach(n => {
      scoreMap.set(n, (scoreMap.get(n) || 0) + 80 * config.weights[1]);
    });
    
    // 辅源2
    auxDraw2.front.forEach(n => {
      scoreMap.set(n, (scoreMap.get(n) || 0) + 60 * config.weights[2]);
    });
    
    // 扩展候选池（添加邻号和尾号）
    const allSourceNums = [...mainDraw.front, ...auxDraw1.front, ...auxDraw2.front];
    const expanded = new Set(allSourceNums);
    allSourceNums.forEach(n => {
      if (n > 1) expanded.add(n - 1);
      if (n < 35) expanded.add(n + 1);
    });
    
    // 截断到Top30
    const poolNums = [...expanded].slice(0, V4_POOL_SIZE);
    const poolSet = new Set(poolNums);
    
    // Top5生成（简化版）
    const top5 = [];
    const sortedPool = poolNums.sort((a, b) => (scoreMap.get(b) || 0) - (scoreMap.get(a) || 0));
    
    // Top1: 取分数最高的5个号码
    const top1 = sortedPool.slice(0, 5).sort((a, b) => a - b);
    top5.push({ numbers: top1 });
    
    // Top2-5: 生成变体
    const usedNums = new Set(top1);
    for (let t = 0; t < 4; t++) {
      const variant = [...top1];
      // 替换1-2个号码
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
    
    // 计算指标
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
console.log("快速验证三源融合优化效果（前30期）");
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

fs.writeFileSync('./quick_optimization_test.json', JSON.stringify(output, null, 2));
console.log("\n结果已保存到 quick_optimization_test.json");
