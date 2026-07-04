// analyze_pool_coverage.js - 分析候选池覆盖率低的原因
// 运行: node analyze_pool_coverage.js

const fs = require('fs');
const path = require('path');

// 加载开奖数据
const rawJs = fs.readFileSync(path.join(__dirname, 'all_draws.js'), 'utf8');
const match = rawJs.match(/window\.ALL_DRAWS_DATA\s*=\s*(\[[\s\S]*?\]);/);
if (!match) { console.error('无法解析 all_draws.js'); process.exit(1); }
const ALL_DRAWS_DATA = eval(match[1]);
const draws = [...ALL_DRAWS_DATA].reverse(); // 旧→新

console.log('='.repeat(80));
console.log('候选池覆盖率分析');
console.log('='.repeat(80));
console.log(`数据范围: ${draws[0].issue} ~ ${draws[draws.length - 1].issue} (共${draws.length}期)`);
console.log('');

// 模拟 allBalls 格式
const allBalls = [];
draws.forEach((draw, idx) => {
  const rowNum = idx + 1;
  draw.front.forEach((num) => {
    allBalls.push({
      row: rowNum,
      zone: "front",
      number: num,
      label: String(num),
      color: "#d6202a",
      colors: null,
      protected: false,
    });
  });
  draw.back.forEach((num) => {
    allBalls.push({
      row: rowNum,
      zone: "back",
      number: num,
      label: String(num),
      color: "#3b82f6",
      colors: null,
      protected: false,
    });
  });
});

// 分析每期候选池的生成情况
const poolStats = [];
const numberExclusionCount = new Array(36).fill(0); // 号码被排除次数
const numberInclusionCount = new Array(36).fill(0); // 号码被选中次数
const totalPeriods = draws.length - 10; // 留出足够历史窗口

// 简化的候选池生成逻辑（模拟 script.js 的 buildSampleNumbersV4）
function buildSimplePool(sourceRow) {
  const V4_POOL_SIZE = 26;
  const selectedNumbers = allBalls
    .filter(b => b.zone === "front" && b.row === sourceRow)
    .map(b => b.number)
    .sort((a, b) => a - b);
  
  if (selectedNumbers.length !== 5) return null;
  
  // 计算每个号码的得分（简化版）
  const candidates = [];
  for (let n = 1; n <= 35; n++) {
    let score = 0;
    
    // 1. 偏移评分
    let minOffset = Infinity;
    selectedNumbers.forEach(a => { minOffset = Math.min(minOffset, Math.abs(n - a)); });
    // 偏移越小，得分越高
    if (minOffset === 0) score += 15; // 重号
    else if (minOffset === 1) score += 10; // 邻号
    else if (minOffset === 2) score += 6;
    else if (minOffset === 3) score += 3;
    else if (minOffset <= 5) score += 1;
    
    // 2. 尾号匹配
    const sourceTails = [...new Set(selectedNumbers.map(n => n % 10))];
    if (sourceTails.includes(n % 10)) score += 8;
    
    // 3. 热号（5期窗口）
    let hot = 0;
    for (let r = Math.max(1, sourceRow - 5); r < sourceRow; r++) {
      const rowBalls = allBalls.filter(b => b.zone === "front" && b.row === r);
      if (rowBalls.some(b => b.number === n)) hot++;
    }
    if (hot >= 4) score += 10;
    else if (hot >= 3) score += 7;
    else if (hot >= 2) score += 4;
    else if (hot === 0) score -= 2;
    
    // 4. +10期趋势
    const plusTenRow = sourceRow - 10;
    if (plusTenRow >= 1) {
      const plusTenBalls = allBalls.filter(b => b.zone === "front" && b.row === plusTenRow);
      if (plusTenBalls.some(b => b.number === n)) score += 5;
    }
    
    // 5. 区间平衡
    const iv = n <= 12 ? 0 : (n <= 24 ? 1 : 2);
    const currentIv = [0, 0, 0];
    selectedNumbers.forEach(num => {
      if (num <= 12) currentIv[0]++;
      else if (num <= 24) currentIv[1]++;
      else currentIv[2]++;
    });
    
    // 6. 历史频率（全局）
    let globalFreq = 0;
    for (let r = Math.max(1, sourceRow - 50); r < sourceRow; r++) {
      const rowBalls = allBalls.filter(b => b.zone === "front" && b.row === r);
      if (rowBalls.some(b => b.number === n)) globalFreq++;
    }
    const avgFreq = 50 * 5 / 35; // 平均频率
    if (globalFreq > avgFreq * 1.2) score += Math.round((globalFreq - avgFreq) * 0.3);
    
    candidates.push({ number: n, score });
  }
  
  // 排序 + 区间保底
  candidates.sort((a, b) => b.score - a.score);
  
  const minIv = [3, 3, 3]; // 每个区间至少3个
  const pool = [];
  const zoneCount = [0, 0, 0];
  const seen = new Set();
  
  // 第一轮：按分数排序添加，同时检查区间保底
  for (const c of candidates) {
    if (pool.length >= V4_POOL_SIZE) break;
    const z = c.number <= 12 ? 0 : (c.number <= 24 ? 1 : 2);
    if (zoneCount[z] < minIv[z]) {
      pool.push(c);
      zoneCount[z]++;
      seen.add(c.number);
    }
  }
  
  // 第二轮：填充剩余位置
  for (const c of candidates) {
    if (pool.length >= V4_POOL_SIZE) break;
    if (!seen.has(c.number)) {
      pool.push(c);
      seen.add(c.number);
    }
  }
  
  return pool.slice(0, V4_POOL_SIZE).map(c => c.number);
}

// 分析每期的候选池覆盖情况
console.log('正在分析每期候选池覆盖情况...');
let totalCoverage = 0;
let totalTarget = 0;
let coverageDistribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

for (let sourceIdx = 10; sourceIdx < draws.length - 1; sourceIdx++) {
  const sourceDraw = draws[sourceIdx];
  const targetDraw = draws[sourceIdx + 1];
  
  const sourceRow = sourceIdx + 1;
  const targetNums = targetDraw.front.sort((a, b) => a - b);
  const targetSet = new Set(targetNums);
  
  const pool = buildSimplePool(sourceRow);
  if (!pool) continue;
  
  const poolSet = new Set(pool);
  const coverage = targetNums.filter(n => poolSet.has(n)).length;
  
  // 统计每个号码的选中/排除情况
  for (let n = 1; n <= 35; n++) {
    if (targetSet.has(n)) {
      if (poolSet.has(n)) {
        numberInclusionCount[n]++;
      } else {
        numberExclusionCount[n]++;
      }
    }
  }
  
  totalCoverage += coverage;
  totalTarget += 5;
  coverageDistribution[coverage]++;
  
  poolStats.push({
    sourceIssue: sourceDraw.issue,
    targetIssue: targetDraw.issue,
    sourceNums: sourceDraw.front,
    targetNums,
    pool,
    coverage,
    missedNums: targetNums.filter(n => !poolSet.has(n))
  });
}

// 输出统计结果
console.log('');
console.log('='.repeat(80));
console.log('总体统计');
console.log('='.repeat(80));
console.log(`总验证期数: ${poolStats.length}`);
console.log(`平均候选池覆盖率: ${(totalCoverage / poolStats.length).toFixed(2)} / 5 (${(totalCoverage / totalTarget * 100).toFixed(1)}%)`);
console.log('');

console.log('覆盖分布:');
for (let i = 0; i <= 5; i++) {
  const count = coverageDistribution[i];
  const pct = (count / poolStats.length * 100).toFixed(1);
  console.log(`  ${i}/5: ${count} 期 (${pct}%)`);
}

console.log('');
console.log('='.repeat(80));
console.log('号码分析：被排除的高频目标号码');
console.log('='.repeat(80));

// 计算每个号码的排除率
const numberStats = [];
for (let n = 1; n <= 35; n++) {
  const totalHits = numberInclusionCount[n] + numberExclusionCount[n];
  if (totalHits > 0) {
    const exclusionRate = (numberExclusionCount[n] / totalHits * 100).toFixed(1);
    numberStats.push({
      number: n,
      inclusion: numberInclusionCount[n],
      exclusion: numberExclusionCount[n],
      totalHits,
      exclusionRate: parseFloat(exclusionRate)
    });
  }
}

// 按排除率排序
numberStats.sort((a, b) => b.exclusionRate - a.exclusionRate);

console.log('号码 | 选中次数 | 排除次数 | 总命中 | 排除率');
console.log('-'.repeat(60));
numberStats.forEach(s => {
  console.log(`${String(s.number).padStart(2)} | ${String(s.inclusion).padStart(8)} | ${String(s.exclusion).padStart(8)} | ${String(s.totalHits).padStart(6)} | ${s.exclusionRate}%`);
});

console.log('');
console.log('='.repeat(80));
console.log('排除率最高的号码（经常被错过的号码）');
console.log('='.repeat(80));
const highExclusion = numberStats.filter(s => s.exclusionRate > 50 && s.totalHits >= 5);
if (highExclusion.length > 0) {
  highExclusion.forEach(s => {
    console.log(`  号码 ${s.number}: 排除率 ${s.exclusionRate}% (${s.exclusion}/${s.totalHits})`);
  });
} else {
  console.log('  没有排除率超过50%的号码');
}

console.log('');
console.log('='.repeat(80));
console.log('覆盖率最低的10期');
console.log('='.repeat(80));
poolStats.sort((a, b) => a.coverage - b.coverage);
for (let i = 0; i < Math.min(10, poolStats.length); i++) {
  const s = poolStats[i];
  console.log(`${s.sourceIssue} → ${s.targetIssue}: ${s.coverage}/5 | 目标: ${s.targetNums.join(',')} | 错过: ${s.missedNums.join(',')}`);
}

console.log('');
console.log('='.repeat(80));
console.log('错失号码的特征分析');
console.log('='.repeat(80));

// 分析错失号码的特征
const missedAnalysis = {
  byZone: [0, 0, 0],
  byTail: new Array(10).fill(0),
  byHotness: { hot: 0, warm: 0, cold: 0 },
  byOffset: { near: 0, mid: 0, far: 0 }
};

poolStats.forEach(s => {
  s.missedNums.forEach(n => {
    // 区间分布
    if (n <= 12) missedAnalysis.byZone[0]++;
    else if (n <= 24) missedAnalysis.byZone[1]++;
    else missedAnalysis.byZone[2]++;
    
    // 尾号分布
    missedAnalysis.byTail[n % 10]++;
    
    // 热度分析
    const sourceRow = draws.findIndex(d => d.issue === s.sourceIssue) + 1;
    let hot = 0;
    for (let r = Math.max(1, sourceRow - 5); r < sourceRow; r++) {
      const rowBalls = allBalls.filter(b => b.zone === "front" && b.row === r);
      if (rowBalls.some(b => b.number === n)) hot++;
    }
    if (hot >= 3) missedAnalysis.byHotness.hot++;
    else if (hot >= 1) missedAnalysis.byHotness.warm++;
    else missedAnalysis.byHotness.cold++;
    
    // 与源号码的偏移
    const sourceNums = s.sourceNums;
    const minOffset = Math.min(...sourceNums.map(a => Math.abs(n - a)));
    if (minOffset <= 2) missedAnalysis.byOffset.near++;
    else if (minOffset <= 5) missedAnalysis.byOffset.mid++;
    else missedAnalysis.byOffset.far++;
  });
});

console.log('错失号码的区间分布:');
console.log(`  区间1 (1-12): ${missedAnalysis.byZone[0]} 个`);
console.log(`  区间2 (13-24): ${missedAnalysis.byZone[1]} 个`);
console.log(`  区间3 (25-35): ${missedAnalysis.byZone[2]} 个`);

console.log('');
console.log('错失号码的热度分布:');
console.log(`  热号 (近5期出现≥3次): ${missedAnalysis.byHotness.hot} 个`);
console.log(`  温号 (近5期出现1-2次): ${missedAnalysis.byHotness.warm} 个`);
console.log(`  冷号 (近5期未出现): ${missedAnalysis.byHotness.cold} 个`);

console.log('');
console.log('错失号码与源号码的偏移分布:');
console.log(`  近距 (偏移≤2): ${missedAnalysis.byOffset.near} 个`);
console.log(`  中距 (偏移3-5): ${missedAnalysis.byOffset.mid} 个`);
console.log(`  远距 (偏移>5): ${missedAnalysis.byOffset.far} 个`);

console.log('');
console.log('='.repeat(80));
console.log('优化建议');
console.log('='.repeat(80));
console.log('基于以上分析，候选池覆盖率低的主要原因可能是:');
console.log('');

// 根据数据给出建议
const avgCoverage = totalCoverage / poolStats.length;
if (avgCoverage < 4) {
  console.log('1. 池大小不足: V4_POOL_SIZE=26 可能太小，建议增加到30-32');
  console.log('2. 评分权重偏差: 某些特征权重过高导致冷门号码被过度排除');
  console.log('3. 区间保底策略: minIv=[3,3,3] 可能限制了灵活性');
  console.log('4. 历史频率依赖过重: 可能导致近期冷号被过度惩罚');
}

// 分析具体哪些号码经常被错过
const highExclusionNumbers = numberStats.filter(s => s.exclusionRate > 40 && s.totalHits >= 3);
if (highExclusionNumbers.length > 0) {
  console.log('');
  console.log('经常被错过的号码:');
  highExclusionNumbers.forEach(s => {
    console.log(`  号码 ${s.number}: 排除率 ${s.exclusionRate}% - 需要检查其评分逻辑`);
  });
}

console.log('');
console.log('='.repeat(80));
console.log('分析完成');
console.log('='.repeat(80));
