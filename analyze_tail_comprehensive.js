/**
 * 综合尾号规律分析：重叠+相邻+相邻延伸+高频
 * 分析尾号与参考行和参考行+9的关系
 */
const fs = require('fs');
const allDraws = JSON.parse(fs.readFileSync('./all_draws.json', 'utf8'));

console.log("═".repeat(80));
console.log("        📊 综合尾号规律深度分析");
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
  // 移除自身
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

// ═══ 分析1: 基础统计 ═══
console.log("═".repeat(80));
console.log("1️⃣  基础尾号统计");
console.log("═".repeat(80));

const tailFrequency = new Array(10).fill(0);
const tailAppearInDraw = new Array(6).fill(0); // 0-5个不同尾号

for (let i = 0; i < allDraws.length; i++) {
  const tails = getUniqueTails(allDraws[i].front);
  tails.forEach(t => tailFrequency[t]++);
  tailAppearInDraw[tails.length]++;
}

console.log("\n尾号出现频率:");
console.log("┌──────┬────────┬────────┐");
console.log("│ 尾号 │ 出现次数│ 频率(%) │");
console.log("├──────┼────────┼────────┤");
for (let t = 0; t <= 9; t++) {
  const pct = (tailFrequency[t] / allDraws.length * 100).toFixed(1);
  console.log(`│  ${t}   │  ${String(tailFrequency[t]).padStart(4)}   │  ${pct.padStart(5)}%  │`);
}
console.log("└──────┴────────┴────────┘");

console.log("\n每期不同尾号数分布:");
console.log("┌──────┬────────┬────────┐");
console.log("│ 尾号数│  出现次数│ 频率(%) │");
console.log("├──────┼────────┼────────┤");
for (let n = 0; n <= 5; n++) {
  const pct = (tailAppearInDraw[n] / allDraws.length * 100).toFixed(1);
  console.log(`│  ${n}   │  ${String(tailAppearInDraw[n]).padStart(4)}   │  ${pct.padStart(5)}%  │`);
}
console.log("└──────┴────────┴────────┘");

// ═══ 分析2: 参考行重叠分析 ═══
console.log("\n" + "═".repeat(80));
console.log("2️⃣  参考行重叠分析");
console.log("═".repeat(80));

let totalOverlap1 = 0, totalOverlap10 = 0;
let overlap1Dist = [0, 0, 0, 0, 0, 0];
let overlap10Dist = [0, 0, 0, 0, 0, 0];
let hit1Dist = [0, 0, 0, 0, 0, 0, 0]; // 0-6个命中
let hit10Dist = [0, 0, 0, 0, 0, 0, 0];

for (let i = 10; i < allDraws.length; i++) {
  const current = getUniqueTails(allDraws[i].front);
  const ref1 = getUniqueTails(allDraws[i - 1].front);
  const ref10 = getUniqueTails(allDraws[i - 10].front);
  
  const overlap1 = current.filter(t => ref1.includes(t)).length;
  const overlap10 = current.filter(t => ref10.includes(t)).length;
  
  totalOverlap1 += overlap1;
  totalOverlap10 += overlap10;
  
  if (overlap1 <= 5) overlap1Dist[overlap1]++;
  if (overlap10 <= 5) overlap10Dist[overlap10]++;
  
  // 号码命中（不是尾号命中）
  const ref1Nums = allDraws[i - 1].front;
  const ref10Nums = allDraws[i - 10].front;
  const hit1 = allDraws[i].front.filter(n => ref1Nums.includes(n)).length;
  const hit10 = allDraws[i].front.filter(n => ref10Nums.includes(n)).length;
  
  if (hit1 <= 6) hit1Dist[hit1]++;
  if (hit10 <= 6) hit10Dist[hit10]++;
}

const periods = allDraws.length - 10;
console.log(`\n┌─────────────────────────────────────────────────────────────┐`);
console.log(`│  指标                    │  vs上一期(参考行)  │ vs上10期(参考行+9) │`);
console.log(`├─────────────────────────────────────────────────────────────┤`);
console.log(`│  平均尾号重叠数          │    ${(totalOverlap1 / periods).toFixed(2)}           │    ${(totalOverlap10 / periods).toFixed(2)}           │`);
console.log(`└─────────────────────────────────────────────────────────────┘`);

console.log(`\n尾号重叠数分布:`);
console.log(`┌──────────┬──────────────┬──────────────┬──────────────┬──────────────┐`);
console.log(`│  重叠数  │ vs上一期(次) │ vs上一期(%)  │ vs上10期(次) │ vs上10期(%)  │`);
console.log(`├──────────┼──────────────┼──────────────┼──────────────┼──────────────┤`);
for (let i = 0; i <= 5; i++) {
  const pct1 = (overlap1Dist[i] / periods * 100).toFixed(1);
  const pct10 = (overlap10Dist[i] / periods * 100).toFixed(1);
  console.log(`│    ${i}     │    ${String(overlap1Dist[i]).padStart(5)}     │    ${pct1.padStart(5)}%    │    ${String(overlap10Dist[i]).padStart(5)}     │    ${pct10.padStart(5)}%    │`);
}
console.log(`└──────────┴──────────────┴──────────────┴──────────────┴──────────────┘`);

// ═══ 分析3: 相邻尾号分析 ═══
console.log("\n" + "═".repeat(80));
console.log("3️⃣  相邻尾号分析");
console.log("═".repeat(80));

let neighbor1Dist = [0, 0, 0, 0, 0, 0];
let neighbor10Dist = [0, 0, 0, 0, 0, 0];
let totalNeighbor1 = 0, totalNeighbor10 = 0;

for (let i = 10; i < allDraws.length; i++) {
  const current = getUniqueTails(allDraws[i].front);
  const ref1 = getUniqueTails(allDraws[i - 1].front);
  const ref10 = getUniqueTails(allDraws[i - 10].front);
  
  const ref1Neighbors = getNeighborTails(ref1);
  const ref10Neighbors = getNeighborTails(ref10);
  
  const neighbor1 = current.filter(t => ref1Neighbors.includes(t)).length;
  const neighbor10 = current.filter(t => ref10Neighbors.includes(t)).length;
  
  totalNeighbor1 += neighbor1;
  totalNeighbor10 += neighbor10;
  
  if (neighbor1 <= 5) neighbor1Dist[neighbor1]++;
  if (neighbor10 <= 5) neighbor10Dist[neighbor10]++;
}

console.log(`\n┌─────────────────────────────────────────────────────────────┐`);
console.log(`│  指标                    │  vs上一期(参考行)  │ vs上10期(参考行+9) │`);
console.log(`├─────────────────────────────────────────────────────────────┤`);
console.log(`│  平均相邻尾号命中        │    ${(totalNeighbor1 / periods).toFixed(2)}           │    ${(totalNeighbor10 / periods).toFixed(2)}           │`);
console.log(`└─────────────────────────────────────────────────────────────┘`);

console.log(`\n相邻尾号命中分布:`);
console.log(`┌──────────┬──────────────┬──────────────┬──────────────┬──────────────┐`);
console.log(`│  命中数  │ vs上一期(次) │ vs上一期(%)  │ vs上10期(次) │ vs上10期(%)  │`);
console.log(`├──────────┼──────────────┼──────────────┼──────────────┼──────────────┤`);
for (let i = 0; i <= 5; i++) {
  const pct1 = (neighbor1Dist[i] / periods * 100).toFixed(1);
  const pct10 = (neighbor10Dist[i] / periods * 100).toFixed(1);
  console.log(`│    ${i}     │    ${String(neighbor1Dist[i]).padStart(5)}     │    ${pct1.padStart(5)}%    │    ${String(neighbor10Dist[i]).padStart(5)}     │    ${pct10.padStart(5)}%    │`);
}
console.log(`└──────────┴──────────────┴──────────────┴──────────────┴──────────────┘`);

// ═══ 分析4: 相邻延伸分析 ═══
console.log("\n" + "═".repeat(80));
console.log("4️⃣  相邻延伸分析（深度2）");
console.log("═".repeat(80));

let extended1Dist = [0, 0, 0, 0, 0, 0, 0, 0];
let extended10Dist = [0, 0, 0, 0, 0, 0, 0, 0];
let totalExtended1 = 0, totalExtended10 = 0;

for (let i = 10; i < allDraws.length; i++) {
  const current = getUniqueTails(allDraws[i].front);
  const ref1 = getUniqueTails(allDraws[i - 1].front);
  const ref10 = getUniqueTails(allDraws[i - 10].front);
  
  const extended1 = getExtendedNeighbors(ref1, 2);
  const extended10 = getExtendedNeighbors(ref10, 2);
  
  const extHit1 = current.filter(t => extended1.includes(t)).length;
  const extHit10 = current.filter(t => extended10.includes(t)).length;
  
  totalExtended1 += extHit1;
  totalExtended10 += extHit10;
  
  if (extHit1 <= 7) extended1Dist[extHit1]++;
  if (extHit10 <= 7) extended10Dist[extHit10]++;
}

console.log(`\n┌─────────────────────────────────────────────────────────────┐`);
console.log(`│  指标                    │  vs上一期(参考行)  │ vs上10期(参考行+9) │`);
console.log(`├─────────────────────────────────────────────────────────────┤`);
console.log(`│  平均延伸尾号命中        │    ${(totalExtended1 / periods).toFixed(2)}           │    ${(totalExtended10 / periods).toFixed(2)}           │`);
console.log(`└─────────────────────────────────────────────────────────────┘`);

// ═══ 分析5: 高频尾号分析 ═══
console.log("\n" + "═".repeat(80));
console.log("5️⃣  高频尾号分析（近15期）");
console.log("═".repeat(80));

let highFreqHitDist = [0, 0, 0, 0, 0, 0];
let totalHighFreqHit = 0;

for (let i = 15; i < allDraws.length; i++) {
  const current = getUniqueTails(allDraws[i].front);
  
  // 统计近15期尾号频率
  const freq = new Array(10).fill(0);
  for (let j = i - 15; j < i; j++) {
    getUniqueTails(allDraws[j].front).forEach(t => freq[t]++);
  }
  
  // 选择高频尾号（出现>=3次）
  const highFreqTails = freq.map((count, tail) => ({ tail, count }))
    .filter(item => item.count >= 3)
    .sort((a, b) => b.count - a.count)
    .map(item => item.tail);
  
  const hit = current.filter(t => highFreqTails.includes(t)).length;
  totalHighFreqHit += hit;
  
  if (hit <= 5) highFreqHitDist[hit]++;
}

const highFreqPeriods = allDraws.length - 15;
console.log(`\n高频尾号（近15期出现>=3次）命中统计:`);
console.log(`平均命中: ${(totalHighFreqHit / highFreqPeriods).toFixed(2)}`);
console.log(`\n命中分布:`);
console.log(`┌──────────┬──────────────┬──────────────┐`);
console.log(`│  命中数  │    出现次数   │    频率(%)   │`);
console.log(`├──────────┼──────────────┼──────────────┤`);
for (let i = 0; i <= 5; i++) {
  const pct = (highFreqHitDist[i] / highFreqPeriods * 100).toFixed(1);
  console.log(`│    ${i}     │    ${String(highFreqHitDist[i]).padStart(5)}     │    ${pct.padStart(5)}%    │`);
}
console.log(`└──────────┴──────────────┴──────────────┘`);

// ═══ 分析6: 综合策略分析 ═══
console.log("\n" + "═".repeat(80));
console.log("6️⃣  综合策略分析（重叠+相邻+延伸+高频）");
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
  
  // 3. 延伸尾号（深度2）
  getExtendedNeighbors(ref1, 2).forEach(t => combinedTails.add(t));
  getExtendedNeighbors(ref10, 2).forEach(t => combinedTails.add(t));
  
  // 4. 高频尾号
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
console.log(`\n综合策略（重叠+相邻+延伸+高频）:`);
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

// ═══ 分析7: 各策略贡献度分析 ═══
console.log("\n" + "═".repeat(80));
console.log("7️⃣  各策略贡献度分析");
console.log("═".repeat(80));

let onlyOverlapHit = 0, onlyNeighborHit = 0, onlyExtendedHit = 0, onlyHighFreqHit = 0;
let overlapAndNeighborHit = 0, allStrategyHit = 0;

for (let i = 15; i < allDraws.length; i++) {
  const currentTails = getUniqueTails(allDraws[i].front);
  
  const ref1 = getUniqueTails(allDraws[i - 1].front);
  const ref10 = getUniqueTails(allDraws[i - 10].front);
  
  // 各策略尾号池
  const overlapTails = new Set([...ref1, ...ref10]);
  const neighborTails = new Set([...getNeighborTails(ref1), ...getNeighborTails(ref10)]);
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
  onlyExtendedHit += currentTails.filter(t => extendedTails.has(t)).length;
  onlyHighFreqHit += currentTails.filter(t => highFreqTails.has(t)).length;
  
  // 组合策略命中
  const overlapAndNeighbor = new Set([...overlapTails, ...neighborTails]);
  overlapAndNeighborHit += currentTails.filter(t => overlapAndNeighbor.has(t)).length;
  
  const allStrategy = new Set([...overlapTails, ...neighborTails, ...extendedTails, ...highFreqTails]);
  allStrategyHit += currentTails.filter(t => allStrategy.has(t)).length;
}

console.log(`\n各策略平均尾号命中:`);
console.log(`┌─────────────────────────────────────────────────────────────┐`);
console.log(`│  策略                          │    平均命中尾号数         │`);
console.log(`├─────────────────────────────────────────────────────────────┤`);
console.log(`│  仅重叠                        │    ${(onlyOverlapHit / combinedPeriods).toFixed(2)}                 │`);
console.log(`│  仅相邻                        │    ${(onlyNeighborHit / combinedPeriods).toFixed(2)}                 │`);
console.log(`│  仅延伸                        │    ${(onlyExtendedHit / combinedPeriods).toFixed(2)}                 │`);
console.log(`│  仅高频                        │    ${(onlyHighFreqHit / combinedPeriods).toFixed(2)}                 │`);
console.log(`│  重叠+相邻                     │    ${(overlapAndNeighborHit / combinedPeriods).toFixed(2)}                 │`);
console.log(`│  综合策略                      │    ${(allStrategyHit / combinedPeriods).toFixed(2)}                 │`);
console.log(`└─────────────────────────────────────────────────────────────┘`);

// ═══ 分析8: 策略覆盖率分析 ═══
console.log("\n" + "═".repeat(80));
console.log("8️⃣  策略覆盖率分析");
console.log("═".repeat(80));

console.log(`\n综合策略尾号覆盖率: ${(totalCombinedHit / combinedPeriods / 5 * 100).toFixed(1)}%`);
console.log(`综合策略号码覆盖率: ${(totalCombinedNumberHit / combinedPeriods / 5 * 100).toFixed(1)}%`);
console.log(`\n这意味着:`);
console.log(`- 每期平均覆盖 ${(totalCombinedHit / combinedPeriods).toFixed(2)} 个尾号（共5个）`);
console.log(`- 每期平均命中 ${(totalCombinedNumberHit / combinedPeriods).toFixed(2)} 个号码（共5个）`);
console.log(`- 命中≥2球的概率: ${(ge2Count / combinedPeriods * 100).toFixed(1)}%`);
console.log(`- 命中≥3球的概率: ${(ge3Count / combinedPeriods * 100).toFixed(1)}%`);

console.log(`\n⏱️  完成时间: ${new Date().toLocaleString()}`);
