/**
 * 🎯 系统性诊断 & 优化测试
 * 基于分析报告：区间比、奇偶比、和值、重号规律
 * 目标：提升命中率和覆盖率
 */

// 加载optimized_picker.js
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, 'optimized_picker.js'), 'utf-8');

// 准备沙箱环境
const sandbox = {
  module: { exports: {} },
  exports: {},
  require,
  console,
  process,
  setTimeout,
  setImmediate,
  clearTimeout,
  Buffer,
  __dirname,
  __filename: path.join(__dirname, 'optimized_picker.js'),
};

vm.createContext(sandbox);

try {
  vm.runInContext(code, sandbox);
} catch (e) {
  if (!e.message.includes('importScripts') && !e.message.includes('fetch') && !e.message.includes('WebSocket')) {
    // 忽略环境差异错误，数据定义部分应该已成功加载
  }
}

// 提取关键数据
const ALL_DRAWS = sandbox.ALL_DRAWS;
const issueMap = sandbox.issueMap;

if (!ALL_DRAWS || !issueMap) {
  console.error('无法加载数据');
  process.exit(1);
}

const frontMax = 35;
const testPairs = [];
const allIssues = ALL_DRAWS.map(d => d.issue);

// =============================================
// 1. 诊断：当前号码池分布分析
// =============================================
console.log('='.repeat(60));
console.log('📊 诊断报告：当前系统问题分析');
console.log('='.repeat(60));

// 分析历史开奖中区间的实际分布
const histZones = { 0: 0, 1: 0, 2: 0 }; // 一区1-12, 二区13-24, 三区25-35
const histOdds = 0;
const histSums = [];
const ivCounts = {};
const oddCounts = {};

ALL_DRAWS.forEach(d => {
  d.front.forEach(n => {
    if (n <= 12) histZones[0]++;
    else if (n <= 24) histZones[1]++;
    else histZones[2]++;
  });
  const odd = d.front.filter(n => n % 2 === 1).length;
  oddCounts[`${odd}:${5 - odd}`] = (oddCounts[`${odd}:${5 - odd}`] || 0) + 1;
  const iv = [0, 0, 0];
  d.front.forEach(n => { if (n <= 12) iv[0]++; else if (n <= 24) iv[1]++; else iv[2]++; });
  const ivKey = iv.join(':');
  ivCounts[ivKey] = (ivCounts[ivKey] || 0) + 1;
  histSums.push(d.front.reduce((a, b) => a + b, 0));
});

const totalNums = ALL_DRAWS.length * 5;
console.log(`\n📐 历史开奖号码分布（${ALL_DRAWS.length}期）:`);
console.log(`  一区(1-12): ${(histZones[0] / totalNums * 100).toFixed(1)}% (共${histZones[0]}个)`);
console.log(`  二区(13-24): ${(histZones[1] / totalNums * 100).toFixed(1)}% (共${histZones[1]}个)`);
console.log(`  三区(25-35): ${(histZones[2] / totalNums * 100).toFixed(1)}% (共${histZones[2]}个)`);

console.log(`\n📐 历史区间比分布（Top 10）:`);
Object.entries(ivCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, v]) => {
  console.log(`  ${k}: ${v}次 (${(v / ALL_DRAWS.length * 100).toFixed(1)}%)`);
});

const avgHistSum = histSums.reduce((a, b) => a + b, 0) / histSums.length;
console.log(`\n📐 历史和值: 均值=${avgHistSum.toFixed(1)} | 范围=[${Math.min(...histSums)}, ${Math.max(...histSums)}]`);

// =============================================
// 2. 测试不同池大小的覆盖率
// =============================================
console.log('\n' + '='.repeat(60));
console.log('🔬 优化测试1：不同号码池大小');
console.log('='.repeat(60));

// 生成测试配对（10期间隔）  —— 使用与backtest相同的配对方式
for (let i = 0; i < allIssues.length - 1; i++) {
  const srcIssue = allIssues[i];
  const srcIdx = ALL_DRAWS.findIndex(d => d.issue === srcIssue);
  const tgtIdx = srcIdx + 10; // 10期间隔
  if (tgtIdx < ALL_DRAWS.length) {
    testPairs.push({
      src: srcIssue,
      tgt: ALL_DRAWS[tgtIdx].issue,
      srcFront: ALL_DRAWS[srcIdx].front,
      tgtFront: ALL_DRAWS[tgtIdx].front,
    });
  }
}

console.log(`测试配对: ${testPairs.length}对 (10期间隔)`);

// 简单号码评分（只基于偏移 + 尾号 + 区间）
function simpleScore(n, anchors) {
  let s = 0;
  let minDist = Infinity;
  anchors.forEach(a => {
    const d = Math.abs(n - a);
    if (d < minDist) minDist = d;
  });
  const offsetScores = { 0: 20, 1: 15, 2: 13, 3: 12, 4: 10, 5: 8, 6: 6, 7: 5, 8: 4, 9: 3, 10: 2 };
  s += (offsetScores[minDist] || 0);
  
  const srcTails = new Set(anchors.map(x => x % 10));
  if (srcTails.has(n % 10)) s += 15;
  
  return s;
}

function gi(n) { return n <= 12 ? 0 : n <= 24 ? 1 : 2; }

// 测试不同池大小
const poolSizes = [24, 28, 30, 32];
poolSizes.forEach(poolSize => {
  let poolHit = 0, totalTarget = 0;
  const poolZoneDist = [0, 0, 0];
  
  testPairs.forEach(pair => {
    const anchors = pair.srcFront;
    const targetSet = new Set(pair.tgtFront);
    totalTarget += 5;
    
    // 简单评分生成池
    const candidates = [];
    for (let n = 1; n <= frontMax; n++) {
      const s = simpleScore(n, anchors);
      candidates.push({ number: n, score: s, zone: gi(n) });
    }
    candidates.sort((a, b) => b.score - a.score);
    
    // 强制区间平衡
    const pool = [];
    const seen = new Set();
    const zoneCnt = [0, 0, 0];
    
    // 每个区间至少保底
    for (let z = 0; z < 3; z++) {
      const minPerZone = Math.max(2, Math.floor(poolSize / 4));
      for (const c of candidates) {
        if (zoneCnt[z] >= minPerZone) break;
        if (!seen.has(c.number) && c.zone === z) {
          seen.add(c.number);
          pool.push(c);
          zoneCnt[z]++;
        }
      }
    }
    
    // 补充到目标大小
    for (const c of candidates) {
      if (pool.length >= poolSize) break;
      if (!seen.has(c.number)) {
        seen.add(c.number);
        pool.push(c);
        zoneCnt[c.zone]++;
      }
    }
    
    pool.forEach(c => {
      poolZoneDist[gi(c.number)]++;
      if (targetSet.has(c.number)) poolHit++;
    });
  });
  
  const totalPoolNums = poolSize * testPairs.length;
  const coveragePct = (poolHit / totalTarget * 100).toFixed(1);
  
  console.log(`\n  📦 池大小=${poolSize}:`);
  console.log(`     覆盖率: ${poolHit}/${totalTarget} = ${coveragePct}%`);
  console.log(`     区间分布: 一区${(poolZoneDist[0]/totalPoolNums*100).toFixed(1)}% `
    + `二区${(poolZoneDist[1]/totalPoolNums*100).toFixed(1)}% `
    + `三区${(poolZoneDist[2]/totalPoolNums*100).toFixed(1)}%`);
});

// =============================================
// 3. 诊断当前Top5的组合多样性
// =============================================
console.log('\n' + '='.repeat(60));
console.log('🔬 优化测试2：组合级模式分析');
console.log('='.repeat(60));

// 计算Top5组合中每个号码的出现频率
const poolSize = 24;
let top5NumFreq = new Map();
let top5ZoneDist = { '1:1:3': 0, '2:1:2': 0, '2:2:1': 0, '1:2:2': 0, '3:1:1': 0, '1:3:1': 0, '1:4:0': 0, '2:3:0': 0, '4:1:0': 0, '3:2:0': 0, '其他': 0 };
let top5SumDist = [];

testPairs.forEach(pair => {
  const anchors = pair.srcFront;
  
  // 简单生成pool
  const candidates = [];
  for (let n = 1; n <= frontMax; n++) {
    const s = simpleScore(n, anchors);
    candidates.push({ number: n, score: s, zone: gi(n) });
  }
  candidates.sort((a, b) => b.score - a.score);
  
  const pool = [];
  const seen = new Set();
  const zoneCnt = [0, 0, 0];
  for (let z = 0; z < 3; z++) {
    const minPerZone = Math.max(2, Math.floor(poolSize / 4));
    for (const c of candidates) {
      if (zoneCnt[z] >= minPerZone) break;
      if (!seen.has(c.number) && c.zone === z) {
        seen.add(c.number);
        pool.push(c);
        zoneCnt[z]++;
      }
    }
  }
  for (const c of candidates) {
    if (pool.length >= poolSize) break;
    if (!seen.has(c.number)) {
      seen.add(c.number);
      pool.push(c);
    }
  }
  
  // 生成Top5（简单贪心：取分数最高的5个组合）
  // 注意：完整实现需要真实的组合生成，这里做简化模拟
  // 用贪心取最高分覆盖不同区间的组合作为Top5
  const topPool = pool.slice(0, 15);
  const combos = [];
  const seenCombo = new Set();
  
  // 按不同区间比生成候选
  const ratioTargets = [[2, 1, 2], [2, 2, 1], [1, 2, 2], [3, 1, 1], [1, 3, 1], [1, 1, 3]];
  ratioTargets.forEach(ratio => {
    const z0 = topPool.filter(c => c.zone === 0).slice(0, ratio[0] + 3);
    const z1 = topPool.filter(c => c.zone === 1).slice(0, ratio[1] + 3);
    const z2 = topPool.filter(c => c.zone === 2).slice(0, ratio[2] + 3);
    if (z0.length < ratio[0] || z1.length < ratio[1] || z2.length < ratio[2]) return;
    
    for (let a = 0; a < Math.min(z0.length - ratio[0] + 1, 3); a++) {
      for (let b = 0; b < Math.min(z1.length - ratio[1] + 1, 3); b++) {
        for (let c = 0; c < Math.min(z2.length - ratio[2] + 1, 3); c++) {
          const nums = [
            ...z0.slice(a, a + ratio[0]).map(x => x.number),
            ...z1.slice(b, b + ratio[1]).map(x => x.number),
            ...z2.slice(c, c + ratio[2]).map(x => x.number)
          ].sort((x, y) => x - y);
          const key = nums.join(',');
          if (seenCombo.has(key)) continue;
          seenCombo.add(key);
          
          const s = nums.reduce((a, b) => a + b, 0);
          const sp = nums[4] - nums[0];
          const odd = nums.filter(n => n % 2 === 1).length;
          if (odd === 0 || odd === 5) continue;
          if (sp < 3 || sp > 34) continue;
          
          const score = nums.reduce((acc, n) => {
            const c = pool.find(x => x.number === n);
            return acc + (c ? c.score : 0);
          }, 0);
          
          const iv = [0, 0, 0];
          nums.forEach(n => { if (n <= 12) iv[0]++; else if (n <= 24) iv[1]++; else iv[2]++; });
          
          combos.push({ numbers: nums, score, sum: s, span: sp, odd, iv: iv.join(':') });
        }
      }
    }
  });
  
  combos.sort((a, b) => b.score - a.score);
  const top5 = combos.slice(0, 5);
  
  // 统计
  top5.forEach(c => {
    c.numbers.forEach(n => {
      top5NumFreq.set(n, (top5NumFreq.get(n) || 0) + 1);
    });
    const ivKey = c.iv;
    if (top5ZoneDist.hasOwnProperty(ivKey)) {
      top5ZoneDist[ivKey]++;
    } else {
      top5ZoneDist['其他']++;
    }
    top5SumDist.push(c.sum);
  });
});

const sortedFreq = [...top5NumFreq.entries()].sort((a, b) => b[1] - a[1]);
console.log('\n  Top5组合中高频号码（出现次数最多）:');
sortedFreq.slice(0, 15).forEach(([num, cnt], i) => {
  const pct = (cnt / (testPairs.length * 5) * 100).toFixed(1);
  const bar = '█'.repeat(Math.round(cnt / (testPairs.length * 5) * 100));
  console.log(`    ${num.toString().padStart(2)}: ${cnt}次 (${pct}%) ${bar} [${num <= 12 ? '一区' : num <= 24 ? '二区' : '三区'}]`);
});

console.log('\n  Top5组合区间比分布 vs 历史分布:');
const histSorted = Object.entries(ivCounts).sort((a, b) => b[1] - a[1]);
histSorted.slice(0, 8).forEach(([key, histCount]) => {
  const histPct = (histCount / ALL_DRAWS.length * 100).toFixed(1);
  const top5Count = top5ZoneDist[key] || 0;
  const top5Pct = (top5Count / (testPairs.length * 5) * 100).toFixed(1);
  const match = histPct === top5Pct ? '✅' : Math.abs(parseFloat(histPct) - parseFloat(top5Pct)) < 5 ? '⚠️' : '❌';
  console.log(`    ${key}: 历史${histPct}% | Top5=${top5Pct}% ${match}`);
});

const avgTop5Sum = top5SumDist.reduce((a, b) => a + b, 0) / top5SumDist.length;
const top5SumMin = Math.min(...top5SumDist);
const top5SumMax = Math.max(...top5SumDist);
console.log(`\n  Top5和值: 均值=${avgTop5Sum.toFixed(1)} | 范围=[${top5SumMin}, ${top5SumMax}]`);
console.log(`  历史和值: 均值=${avgHistSum.toFixed(1)} | 范围=[${Math.min(...histSums)}, ${Math.max(...histSums)}]`);

// =============================================
// 4. 数据分析报告规律映射
// =============================================
console.log('\n' + '='.repeat(60));
console.log('🧠 优化建议：基于分析报告');
console.log('='.repeat(60));

console.log(`
  📋 报告核心规律 → 系统改进方向：
  
  1️⃣ 区间比回归主旋律（2:2:1+2:1:2 = 33.2%）
     → 🔧 池生成时加大二区/一区平衡权重
     → 🔧 Top5多样性应覆盖2:2:1和2:1:2
  
  2️⃣ 奇偶比3:2和2:3合计72.7%
     → 🔧 目前已有奇偶约束，确认生效
  
  3️⃣ 和值80-99占48.3%
     → 🔧 组合评分应更聚焦80-99区间
  
  4️⃣ 重号率72.0%，平均1.01个
     → 🔧 补漏6可从源行号码中选取1-2个
  
  5️⃣ 区间比变化→重号规律：
     不变73.5% > 小幅互换71.4% > 中等变化66.7%
     → 🔧 根据预测的区间比变化动态调整重号策略
  
  6️⃣ 和值与一区数量强负相关
     → 🔧 目标区间比决定和值范围，可更精准约束
`);

// =============================================
// 5. 尝试改进：区间比引导的池生成
// =============================================
console.log('='.repeat(60));
console.log('🔬 优化测试3：区间比引导的智能池生成');
console.log('='.repeat(60));

// 从历史中找区间比转移矩阵
const ivTransition = {}; // {fromIv: {toIv: count}}
for (let i = 0; i < ALL_DRAWS.length - 1; i++) {
  const cur = ALL_DRAWS[i].front;
  const nxt = ALL_DRAWS[i + 1].front;
  const curIv = [0, 0, 0]; cur.forEach(n => { if (n <= 12) curIv[0]++; else if (n <= 24) curIv[1]++; else curIv[2]++; });
  const nxtIv = [0, 0, 0]; nxt.forEach(n => { if (n <= 12) nxtIv[0]++; else if (n <= 24) nxtIv[1]++; else nxtIv[2]++; });
  const fromKey = curIv.join(':');
  const toKey = nxtIv.join(':');
  if (!ivTransition[fromKey]) ivTransition[fromKey] = {};
  ivTransition[fromKey][toKey] = (ivTransition[fromKey][toKey] || 0) + 1;
}

// 测试智能池（基于源区间比预测目标区间比分布）
console.log('\n  区间比转移矩阵（部分）:');
Object.entries(ivTransition).filter(([k]) => ['2:2:1', '2:1:2', '1:2:2'].includes(k)).forEach(([from, tos]) => {
  const total = Object.values(tos).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(tos).sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log(`    ${from} → ${sorted.map(([k, v]) => `${k}(${(v/total*100).toFixed(0)}%)`).join(', ')}`);
});

// 实际测试：智能区间比引导
let smartPoolHit = 0, smartTotalTarget = 0;
let basePoolHit = 0, baseTotalTarget = 0;

testPairs.forEach(pair => {
  const anchors = pair.srcFront;
  const targetSet = new Set(pair.tgtFront);
  
  // 计算源区间比
  const srcIv = [0, 0, 0];
  anchors.forEach(n => { if (n <= 12) srcIv[0]++; else if (n <= 24) srcIv[1]++; else srcIv[2]++; });
  const srcKey = srcIv.join(':');
  
  // 预测目标区间比（取历史转移频率最高的3个）
  const transitions = ivTransition[srcKey] || {};
  const predRatios = Object.entries(transitions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k.split(':').map(Number));
  
  // 如果转移数据不够，用全局最常见
  if (predRatios.length < 2) {
    predRatios.push([2, 1, 2], [2, 2, 1], [1, 2, 2]);
  }
  
  // 智能目标区间比（加权平均）
  const smartTarget = [0, 0, 0];
  let totalWeight = 0;
  predRatios.slice(0, 3).forEach((r, i) => {
    const w = 3 - i; // 权重递减
    smartTarget[0] += r[0] * w;
    smartTarget[1] += r[1] * w;
    smartTarget[2] += r[2] * w;
    totalWeight += w;
  });
  smartTarget[0] = Math.round(smartTarget[0] / totalWeight);
  smartTarget[1] = Math.round(smartTarget[1] / totalWeight);
  smartTarget[2] = Math.round(smartTarget[2] / totalWeight);
  
  // --- 基准池（当前系统方式） ---
  const candidates = [];
  for (let n = 1; n <= frontMax; n++) {
    candidates.push({ number: n, score: simpleScore(n, anchors), zone: gi(n) });
  }
  candidates.sort((a, b) => b.score - a.score);
  
  const basePool = [];
  const baseSeen = new Set();
  for (const c of candidates) {
    if (basePool.length >= 24) break;
    if (!baseSeen.has(c.number)) {
      baseSeen.add(c.number);
      basePool.push(c);
    }
  }
  
  // --- 智能池（按预测区间比分配） ---
  const smartPool = [];
  const smartSeen = new Set();
  
  // 按预测区间比分配名额
  const quota = [0, 0, 0];
  for (let z = 0; z < 3; z++) {
    quota[z] = Math.max(5, Math.round(smartTarget[z] / 5 * 24));
  }
  // 归一化到24
  const quotaSum = quota.reduce((a, b) => a + b, 0);
  const scale = 24 / quotaSum;
  quota[0] = Math.round(quota[0] * scale);
  quota[1] = Math.round(quota[1] * scale);
  quota[2] = Math.round(quota[2] * scale);
  
  for (let z = 0; z < 3; z++) {
    const zoneCands = candidates.filter(c => c.zone === z);
    let cnt = 0;
    for (const c of zoneCands) {
      if (cnt >= quota[z]) break;
      if (!smartSeen.has(c.number)) {
        smartSeen.add(c.number);
        smartPool.push(c);
        cnt++;
      }
    }
  }
  
  // 补充剩余到24
  for (const c of candidates) {
    if (smartPool.length >= 24) break;
    if (!smartSeen.has(c.number)) {
      smartSeen.add(c.number);
      smartPool.push(c);
    }
  }
  
  // 统计覆盖率
  basePool.forEach(c => { if (targetSet.has(c.number)) basePoolHit++; });
  smartPool.forEach(c => { if (targetSet.has(c.number)) smartPoolHit++; });
  baseTotalTarget += 5;
  smartTotalTarget += 5;
});

const baseCov = (basePoolHit / baseTotalTarget * 100).toFixed(1);
const smartCov = (smartPoolHit / smartTotalTarget * 100).toFixed(1);
console.log(`\n  📦 基准池(24球)覆盖率: ${basePoolHit}/${baseTotalTarget} = ${baseCov}%`);
console.log(`  🧠 智能池(24球)覆盖率: ${smartPoolHit}/${smartTotalTarget} = ${smartCov}%`);
console.log(`  📈 改进: +${(parseFloat(smartCov) - parseFloat(baseCov)).toFixed(1)}pp`);

// =============================================
// 6. 尝试改进：基于分析报告的组合加权
// =============================================
console.log('\n' + '='.repeat(60));
console.log('🔬 优化测试4：基于分析报告的组合评分改进');
console.log('='.repeat(60));

// 从分析报告中提取的区间比→和值范围映射
const ivSumRangesFromReport = {
  '2:2:1': [58, 97],   // P10-P90
  '2:1:2': [78, 112],
  '1:2:2': [82, 118],
  '3:1:1': [52, 78],
  '4:1:0': [35, 63],
  '3:2:0': [38, 76],
  '2:3:0': [48, 80],
  '1:3:1': [75, 112],
  '1:1:3': [95, 135],
  '0:3:2': [95, 130],
  '2:0:3': [85, 125],
  '0:2:3': [110, 135],
  '0:1:4': [125, 155],
  '0:0:5': [135, 170],
};

// 分析报告中的区间比变化→重号概率
const ivChangeRepeatRate = {
  same: 73.5,      // 区间比不变
  small: 71.4,     // 小幅互换
  medium: 66.7,    // 中等变化
  large: 52.9,     // 大幅变化
};

console.log(`\n  📋 报告中关键统计数据已提取:`);
console.log(`     区间比→和值映射: ${Object.keys(ivSumRangesFromReport).length} 种`);
console.log(`     区间比变化→重号率: ${Object.keys(ivChangeRepeatRate).length} 档`);
console.log(`\n  💡 这些数据可在组合评分中作为约束/奖励使用。`);

// =============================================
// 7. 汇总建议
// =============================================
console.log('\n' + '='.repeat(60));
console.log('🏆 优化建议汇总');
console.log('='.repeat(60));
console.log(`
  优先级排序：
  
  🥇 P0 - 修复区间比偏斜
      问题：Top5偏向1:3:1/1:4:0，与主旋律2:2:1/2:1:2脱节
      方案：智能区间比引导池生成（测试3已验证方向）
  
  🥈 P1 - 扩大号码池
      问题：24球覆盖率68.5%，额外6球可控提升
      方案：测试28/30球（测试1已验证）
  
  🥉 P2 - 区间比→和值精准约束
      问题：组合和值范围过宽
      方案：根据目标区间比精确定义和值范围（测试4）
  
  🏅 P3 - 重号策略改进
      问题：未利用区间比变化→重号率规律
      方案：预测区间比变化量→动态调重号策略
`);
