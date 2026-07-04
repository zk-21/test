/**
 * 高级尾号规律分析：重叠+等差+相邻+相邻延伸+高频
 * 分析尾号与参考行和参考行+9的关系
 * 分析开奖号码本身的尾号规律
 */
const fs = require('fs');
const allDraws = JSON.parse(fs.readFileSync('./all_draws.json', 'utf8'));

console.log("═".repeat(80));
console.log("        📊 高级尾号规律深度分析");
console.log("═".repeat(80));
console.log(`数据: ${allDraws.length} 期\n`);

// ═══ 工具函数 ═══
function getUniqueTails(numbers) {
  return [...new Set(numbers.map(n => n % 10))].sort((a, b) => a - b);
}

function getNeighborTails(tails) {
  const neighbors = new Set();
  tails.forEach(t => {
    neighbors.add((t + 1) % 10);
    neighbors.add((t + 9) % 10);
  });
  tails.forEach(t => neighbors.delete(t));
  return [...neighbors];
}

function getExtendedNeighbors(tails, depth = 2) {
  const extended = new Set();
  let current = [...tails];
  
  for (let d = 0; d < depth; d++) {
    const next = [];
    current.forEach(t => {
      const n1 = (t + 1) % 10;
      const n2 = (t + 9) % 10;
      if (!extended.has(n1) && !tails.includes(n1)) {
        extended.add(n1);
        next.push(n1);
      }
      if (!extended.has(n2) && !tails.includes(n2)) {
        extended.add(n2);
        next.push(n2);
      }
    });
    current = next;
  }
  
  return [...extended];
}

// 等差尾号分析（公差2,3,4）
function getArithmeticTails(tails) {
  const arithTails = new Set();
  const sorted = [...tails].sort((a, b) => a - b);
  
  // 检查现有尾号是否形成等差
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const diff = sorted[j] - sorted[i];
      if (diff === 2 || diff === 3 || diff === 4) {
        arithTails.add(sorted[i]);
        arithTails.add(sorted[j]);
        // 延伸等差
        const next = (sorted[j] + diff) % 10;
        const prev = (sorted[i] - diff + 10) % 10;
        arithTails.add(next);
        arithTails.add(prev);
      }
    }
  }
  
  return [...arithTails];
}

// 尾号等差分析（检查尾号序列中的等差关系）
function analyzeTailArithmetic(tails) {
  const sorted = [...tails].sort((a, b) => a - b);
  const results = [];
  
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const diff = sorted[j] - sorted[i];
      if (diff >= 2 && diff <= 4) {
        results.push({
          from: sorted[i],
          to: sorted[j],
          diff: diff,
          next: (sorted[j] + diff) % 10,
          prev: (sorted[i] - diff + 10) % 10
        });
      }
    }
  }
  
  return results;
}

// ═══ 分析1: 开奖号码本身的尾号规律 ═══
console.log("═".repeat(80));
console.log("1️⃣  开奖号码本身的尾号规律分析");
console.log("═".repeat(80));

// 统计每期尾号的重叠、相邻、等差关系
let selfOverlap = 0; // 同期尾号重复
let selfNeighbor = 0; // 同期尾号相邻
let selfArithmetic = 0; // 同期尾号等差
let selfExtended = 0; // 同期尾号延伸

for (let i = 0; i < allDraws.length; i++) {
  const tails = getUniqueTails(allDraws[i].front);
  
  // 尾号重复（如果有重复尾号的不同号码）
  const allTails = allDraws[i].front.map(n => n % 10);
  const uniqueTails = [...new Set(allTails)];
  if (allTails.length > uniqueTails.length) {
    selfOverlap++;
  }
  
  // 尾号相邻
  const neighbors = getNeighborTails(tails);
  const hasNeighbor = tails.some(t => neighbors.includes(t));
  if (hasNeighbor) selfNeighbor++;
  
  // 尾号等差
  const arith = analyzeTailArithmetic(tails);
  if (arith.length > 0) selfArithmetic++;
  
  // 尾号延伸
  const extended = getExtendedNeighbors(tails, 2);
  const hasExtended = tails.some(t => extended.includes(t));
  if (hasExtended) selfExtended++;
}

console.log(`\n开奖号码本身的尾号规律:`);
console.log(`┌─────────────────────────────────────────────────────────────┐`);
console.log(`│  规律类型                    │    出现次数    │    频率(%)   │`);
console.log(`├─────────────────────────────────────────────────────────────┤`);
console.log(`│  尾号重复（同尾号不同号码）  │    ${String(selfOverlap).padStart(5)}       │   ${(selfOverlap / allDraws.length * 100).toFixed(1).padStart(5)}%    │`);
console.log(`│  尾号相邻                    │    ${String(selfNeighbor).padStart(5)}       │   ${(selfNeighbor / allDraws.length * 100).toFixed(1).padStart(5)}%    │`);
console.log(`│  尾号等差（公差2-4）         │    ${String(selfArithmetic).padStart(5)}       │   ${(selfArithmetic / allDraws.length * 100).toFixed(1).padStart(5)}%    │`);
console.log(`│  尾号延伸（深度2）           │    ${String(selfExtended).padStart(5)}       │   ${(selfExtended / allDraws.length * 100).toFixed(1).padStart(5)}%    │`);
console.log(`└─────────────────────────────────────────────────────────────┘`);

// ═══ 分析2: 尾号等差详细分析 ═══
console.log("\n" + "═".repeat(80));
console.log("2️⃣  尾号等差详细分析");
console.log("═".repeat(80));

let arithDiffDist = { 2: 0, 3: 0, 4: 0 };
let arithCountDist = [0, 0, 0, 0, 0, 0]; // 0-5个等差关系

for (let i = 0; i < allDraws.length; i++) {
  const tails = getUniqueTails(allDraws[i].front);
  const arith = analyzeTailArithmetic(tails);
  
  arith.forEach(a => arithDiffDist[a.diff]++);
  if (arith.length <= 5) arithCountDist[arith.length]++;
}

console.log(`\n等差公差分布:`);
console.log(`┌──────────┬──────────────┬──────────────┐`);
console.log(`│   公差   │    出现次数   │    频率(%)   │`);
console.log(`├──────────┼──────────────┼──────────────┤`);
for (let diff = 2; diff <= 4; diff++) {
  const total = arithDiffDist[2] + arithDiffDist[3] + arithDiffDist[4];
  const pct = (arithDiffDist[diff] / total * 100).toFixed(1);
  console.log(`│    ${diff}     │    ${String(arithDiffDist[diff]).padStart(5)}     │    ${pct.padStart(5)}%    │`);
}
console.log(`└──────────┴──────────────┴──────────────┘`);

console.log(`\n每期等差关系数分布:`);
console.log(`┌──────────┬──────────────┬──────────────┐`);
console.log(`│ 等差关系数│    出现次数   │    频率(%)   │`);
console.log(`├──────────┼──────────────┼──────────────┤`);
for (let n = 0; n <= 5; n++) {
  const pct = (arithCountDist[n] / allDraws.length * 100).toFixed(1);
  console.log(`│    ${n}     │    ${String(arithCountDist[n]).padStart(5)}     │    ${pct.padStart(5)}%    │`);
}
console.log(`└──────────┴──────────────┴──────────────┘`);

// ═══ 分析3: 参考行等差延伸分析 ═══
console.log("\n" + "═".repeat(80));
console.log("3️⃣  参考行等差延伸分析");
console.log("═".repeat(80));

let arithExtend1Dist = [0, 0, 0, 0, 0, 0];
let arithExtend10Dist = [0, 0, 0, 0, 0, 0];
let totalArithExtend1 = 0, totalArithExtend10 = 0;

for (let i = 10; i < allDraws.length; i++) {
  const current = getUniqueTails(allDraws[i].front);
  const ref1 = getUniqueTails(allDraws[i - 1].front);
  const ref10 = getUniqueTails(allDraws[i - 10].front);
  
  // 参考行的等差延伸
  const arith1 = getArithmeticTails(ref1);
  const arith10 = getArithmeticTails(ref10);
  
  const hit1 = current.filter(t => arith1.includes(t)).length;
  const hit10 = current.filter(t => arith10.includes(t)).length;
  
  totalArithExtend1 += hit1;
  totalArithExtend10 += hit10;
  
  if (hit1 <= 5) arithExtend1Dist[hit1]++;
  if (hit10 <= 5) arithExtend10Dist[hit10]++;
}

const periods = allDraws.length - 10;
console.log(`\n参考行等差延伸命中:`);
console.log(`┌─────────────────────────────────────────────────────────────┐`);
console.log(`│  指标                    │  vs上一期(参考行)  │ vs上10期(参考行+9) │`);
console.log(`├─────────────────────────────────────────────────────────────┤`);
console.log(`│  平均等差延伸命中        │    ${(totalArithExtend1 / periods).toFixed(2)}           │    ${(totalArithExtend10 / periods).toFixed(2)}           │`);
console.log(`└─────────────────────────────────────────────────────────────┘`);

console.log(`\n等差延伸命中分布:`);
console.log(`┌──────────┬──────────────┬──────────────┬──────────────┬──────────────┐`);
console.log(`│  命中数  │ vs上一期(次) │ vs上一期(%)  │ vs上10期(次) │ vs上10期(%)  │`);
console.log(`├──────────┼──────────────┼──────────────┼──────────────┼──────────────┤`);
for (let i = 0; i <= 5; i++) {
  const pct1 = (arithExtend1Dist[i] / periods * 100).toFixed(1);
  const pct10 = (arithExtend10Dist[i] / periods * 100).toFixed(1);
  console.log(`│    ${i}     │    ${String(arithExtend1Dist[i]).padStart(5)}     │    ${pct1.padStart(5)}%    │    ${String(arithExtend10Dist[i]).padStart(5)}     │    ${pct10.padStart(5)}%    │`);
}
console.log(`└──────────┴──────────────┴──────────────┴──────────────┴──────────────┘`);

// ═══ 分析4: 综合策略分析（重叠+等差+相邻+延伸+高频）═══
console.log("\n" + "═".repeat(80));
console.log("4️⃣  综合策略分析（重叠+等差+相邻+延伸+高频）");
console.log("═".repeat(80));

let combinedHitDist = [0, 0, 0, 0, 0, 0, 0];
let combinedNumberHitDist = [0, 0, 0, 0, 0, 0, 0];
let totalCombinedHit = 0;
let totalCombinedNumberHit = 0;
let ge2Count = 0, ge3Count = 0;

for (let i = 15; i < allDraws.length; i++) {
  const currentTails = getUniqueTails(allDraws[i].front);
  const currentNums = allDraws[i].front;
  
  const ref1 = getUniqueTails(allDraws[i - 1].front);
  const ref10 = getUniqueTails(allDraws[i - 10].front);
  
  // 综合尾号池
  const combinedTails = new Set();
  
  // 1. 重叠尾号
  ref1.forEach(t => combinedTails.add(t));
  ref10.forEach(t => combinedTails.add(t));
  
  // 2. 相邻尾号
  getNeighborTails(ref1).forEach(t => combinedTails.add(t));
  getNeighborTails(ref10).forEach(t => combinedTails.add(t));
  
  // 3. 等差延伸
  getArithmeticTails(ref1).forEach(t => combinedTails.add(t));
  getArithmeticTails(ref10).forEach(t => combinedTails.add(t));
  
  // 4. 延伸尾号（深度2）
  getExtendedNeighbors(ref1, 2).forEach(t => combinedTails.add(t));
  getExtendedNeighbors(ref10, 2).forEach(t => combinedTails.add(t));
  
  // 5. 高频尾号
  const freq = new Array(10).fill(0);
  for (let j = i - 15; j < i; j++) {
    getUniqueTails(allDraws[j].front).forEach(t => freq[t]++);
  }
  freq.forEach((count, tail) => {
    if (count >= 3) combinedTails.add(tail);
  });
  
  // 尾号命中
  const tailHit = currentTails.filter(t => combinedTails.has(t)).length;
  totalCombinedHit += tailHit;
  if (tailHit <= 6) combinedHitDist[tailHit]++;
  
  // 号码命中（基于尾号池筛选号码）
  const candidateNums = [];
  for (let n = 1; n <= 35; n++) {
    if (combinedTails.has(n % 10)) candidateNums.push(n);
  }
  const numberHit = currentNums.filter(n => candidateNums.includes(n)).length;
  totalCombinedNumberHit += numberHit;
  if (numberHit <= 6) combinedNumberHitDist[numberHit]++;
  
  if (numberHit >= 2) ge2Count++;
  if (numberHit >= 3) ge3Count++;
}

const combinedPeriods = allDraws.length - 15;
console.log(`\n综合策略（重叠+等差+相邻+延伸+高频）:`);
console.log(`┌─────────────────────────────────────────────────────────────┐`);
console.log(`│  指标                          │           值              │`);
console.log(`├─────────────────────────────────────────────────────────────┤`);
console.log(`│  平均尾号命中                  │    ${(totalCombinedHit / combinedPeriods).toFixed(2)}                 │`);
console.log(`│  平均号码命中                  │    ${(totalCombinedNumberHit / combinedPeriods).toFixed(2)}                 │`);
console.log(`│  命中≥2球率                    │    ${(ge2Count / combinedPeriods * 100).toFixed(1)}%               │`);
console.log(`│  命中≥3球率                    │    ${(ge3Count / combinedPeriods * 100).toFixed(1)}%               │`);
console.log(`└─────────────────────────────────────────────────────────────┘`);

console.log(`\n尾号命中分布:`);
console.log(`┌──────────┬──────────────┬──────────────┐`);
console.log(`│  命中数  │    出现次数   │    频率(%)   │`);
console.log(`├──────────┼──────────────┼──────────────┤`);
for (let i = 0; i <= 6; i++) {
  const pct = (combinedHitDist[i] / combinedPeriods * 100).toFixed(1);
  console.log(`│    ${i}     │    ${String(combinedHitDist[i]).padStart(5)}     │    ${pct.padStart(5)}%    │`);
}
console.log(`└──────────┴──────────────┴──────────────┘`);

console.log(`\n号码命中分布:`);
console.log(`┌──────────┬──────────────┬──────────────┐`);
console.log(`│  命中数  │    出现次数   │    频率(%)   │`);
console.log(`├──────────┼──────────────┼──────────────┤`);
for (let i = 0; i <= 6; i++) {
  const pct = (combinedNumberHitDist[i] / combinedPeriods * 100).toFixed(1);
  console.log(`│    ${i}     │    ${String(combinedNumberHitDist[i]).padStart(5)}     │    ${pct.padStart(5)}%    │`);
}
console.log(`└──────────┴──────────────┴──────────────┘`);

// ═══ 分析5: 各策略贡献度分析 ═══
console.log("\n" + "═".repeat(80));
console.log("5️⃣  各策略贡献度分析");
console.log("═".repeat(80));

let onlyOverlapHit = 0, onlyNeighborHit = 0, onlyArithHit = 0, onlyExtendedHit = 0, onlyHighFreqHit = 0;
let overlapAndNeighborHit = 0, allStrategyHit = 0;

for (let i = 15; i < allDraws.length; i++) {
  const currentTails = getUniqueTails(allDraws[i].front);
  
  const ref1 = getUniqueTails(allDraws[i - 1].front);
  const ref10 = getUniqueTails(allDraws[i - 10].front);
  
  // 各策略尾号池
  const overlapTails = new Set([...ref1, ...ref10]);
  const neighborTails = new Set([...getNeighborTails(ref1), ...getNeighborTails(ref10)]);
  const arithTails = new Set([...getArithmeticTails(ref1), ...getArithmeticTails(ref10)]);
  const extendedTails = new Set([...getExtendedNeighbors(ref1, 2), ...getExtendedNeighbors(ref10, 2)]);
  
  const freq = new Array(10).fill(0);
  for (let j = i - 15; j < i; j++) {
    getUniqueTails(allDraws[j].front).forEach(t => freq[t]++);
  }
  const highFreqTails = new Set(freq.map((count, tail) => ({ tail, count }))
    .filter(item => item.count >= 3)
    .map(item => item.tail));
  
  // 各策略独立命中
  onlyOverlapHit += currentTails.filter(t => overlapTails.has(t)).length;
  onlyNeighborHit += currentTails.filter(t => neighborTails.has(t)).length;
  onlyArithHit += currentTails.filter(t => arithTails.has(t)).length;
  onlyExtendedHit += currentTails.filter(t => extendedTails.has(t)).length;
  onlyHighFreqHit += currentTails.filter(t => highFreqTails.has(t)).length;
  
  // 组合策略命中
  const overlapAndNeighbor = new Set([...overlapTails, ...neighborTails]);
  overlapAndNeighborHit += currentTails.filter(t => overlapAndNeighbor.has(t)).length;
  
  const allStrategy = new Set([...overlapTails, ...neighborTails, ...arithTails, ...extendedTails, ...highFreqTails]);
  allStrategyHit += currentTails.filter(t => allStrategy.has(t)).length;
}

console.log(`\n各策略平均尾号命中:`);
console.log(`┌─────────────────────────────────────────────────────────────┐`);
console.log(`│  策略                          │    平均命中尾号数         │`);
console.log(`├─────────────────────────────────────────────────────────────┤`);
console.log(`│  仅重叠                        │    ${(onlyOverlapHit / combinedPeriods).toFixed(2)}                 │`);
console.log(`│  仅相邻                        │    ${(onlyNeighborHit / combinedPeriods).toFixed(2)}                 │`);
console.log(`│  仅等差                        │    ${(onlyArithHit / combinedPeriods).toFixed(2)}                 │`);
console.log(`│  仅延伸                        │    ${(onlyExtendedHit / combinedPeriods).toFixed(2)}                 │`);
console.log(`│  仅高频                        │    ${(onlyHighFreqHit / combinedPeriods).toFixed(2)}                 │`);
console.log(`│  重叠+相邻                     │    ${(overlapAndNeighborHit / combinedPeriods).toFixed(2)}                 │`);
console.log(`│  综合策略                      │    ${(allStrategyHit / combinedPeriods).toFixed(2)}                 │`);
console.log(`└─────────────────────────────────────────────────────────────┘`);

// ═══ 分析6: 尾号转移规律 ═══
console.log("\n" + "═".repeat(80));
console.log("6️⃣  尾号转移规律分析");
console.log("═".repeat(80));

const transMatrix = new Array(10).fill(0).map(() => new Array(10).fill(0));
const transCount = new Array(10).fill(0);

for (let i = 1; i < allDraws.length; i++) {
  const prevTails = getUniqueTails(allDraws[i - 1].front);
  const currTails = getUniqueTails(allDraws[i].front);
  
  prevTails.forEach(pt => {
    transCount[pt]++;
    currTails.forEach(ct => {
      transMatrix[pt][ct]++;
    });
  });
}

console.log(`\n尾号转移概率矩阵（行=来源，列=目标）:`);
console.log(`┌──────┬────────────────────────────────────────────────────────┐`);
console.log(`│ 从\\到│    0     1     2     3     4     5     6     7     8     9  │`);
console.log(`├──────┼────────────────────────────────────────────────────────┤`);
for (let from = 0; from <= 9; from++) {
  let row = `│  ${from}   │`;
  for (let to = 0; to <= 9; to++) {
    const pct = transCount[from] > 0 ? (transMatrix[from][to] / transCount[from] * 100).toFixed(0) : 0;
    row += `  ${String(pct).padStart(3)}% `;
  }
  row += `│`;
  console.log(row);
}
console.log(`└──────┴────────────────────────────────────────────────────────┘`);

// 找出高概率转移
console.log(`\n高概率转移（>30%）:`);
for (let from = 0; from <= 9; from++) {
  for (let to = 0; to <= 9; to++) {
    const pct = transCount[from] > 0 ? (transMatrix[from][to] / transCount[from] * 100) : 0;
    if (pct > 30) {
      console.log(`  ${from} → ${to}: ${pct.toFixed(1)}%`);
    }
  }
}

// ═══ 分析7: 策略覆盖率分析 ═══
console.log("\n" + "═".repeat(80));
console.log("7️⃣  策略覆盖率分析");
console.log("═".repeat(80));

console.log(`\n综合策略尾号覆盖率: ${(totalCombinedHit / combinedPeriods / 5 * 100).toFixed(1)}%`);
console.log(`综合策略号码覆盖率: ${(totalCombinedNumberHit / combinedPeriods / 5 * 100).toFixed(1)}%`);
console.log(`\n这意味着:`);
console.log(`- 每期平均覆盖 ${(totalCombinedHit / combinedPeriods).toFixed(2)} 个尾号（共5个）`);
console.log(`- 每期平均命中 ${(totalCombinedNumberHit / combinedPeriods).toFixed(2)} 个号码（共5个）`);
console.log(`- 命中≥2球的概率: ${(ge2Count / combinedPeriods * 100).toFixed(1)}%`);
console.log(`- 命中≥3球的概率: ${(ge3Count / combinedPeriods * 100).toFixed(1)}%`);

// ═══ 分析8: 实际应用建议 ═══
console.log("\n" + "═".repeat(80));
console.log("8️⃣  实际应用建议");
console.log("═".repeat(80));

console.log(`\n基于分析结果，建议的尾号预测策略:`);
console.log(`1. 重叠尾号：参考行1和参考行+9的尾号（权重15/12）`);
console.log(`2. 相邻尾号：重叠尾号的±1尾号（权重8/5）`);
console.log(`3. 等差延伸：参考行尾号形成的等差关系延伸（权重6）`);
console.log(`4. 相邻延伸：相邻尾号的相邻尾号（深度2，权重4）`);
console.log(`5. 高频尾号：近15期出现>=3次的尾号（权重2）`);
console.log(`\n综合策略可以覆盖约${(totalCombinedHit / combinedPeriods).toFixed(1)}个尾号，命中约${(totalCombinedNumberHit / combinedPeriods).toFixed(1)}个号码`);

console.log(`\n⏱️  完成时间: ${new Date().toLocaleString()}`);
