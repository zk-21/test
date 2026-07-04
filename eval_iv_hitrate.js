/**
 * 区间比命中率评估脚本
 * 数据：2025101~2026072，共172期（171对相邻期）
 * 对比：当前Markov转移模型 vs 基于分析报告的策略优化
 */

// ====== 解析用户提供的分析报告数据 ======
const rawData = `2025101|5,7,18,26,32|2:1:2|2:3|88|-
2025102|3,9,10,13,26|3:1:1|3:2|61|1
2025103|5,8,19,32,34|2:1:2|2:3|98|0
2025104|2,6,9,22,34|3:1:1|1:4|73|1
2025105|15,16,26,28,34|0:2:3|1:4|119|1
2025106|5,6,11,26,29|3:0:2|3:2|77|1
2025107|5,7,8,15,33|3:1:1|4:1|68|1
2025108|14,18,21,24,29|0:3:2|1:4|106|0
2025109|4,8,10,13,26|3:1:1|1:4|61|0
2025110|1,15,22,30,31|1:2:2|3:2|99|0
2025111|2,9,14,21,26|2:2:1|2:3|72|0
2025112|3,4,21,23,24|2:2:1|3:2|75|1
2025113|1,14,18,28,35|1:2:2|2:3|96|0
2025114|3,8,9,12,15|4:1:0|3:2|47|0
2025115|3,12,14,21,35|2:2:1|3:2|85|1
2025116|2,6,16,22,29|2:2:1|1:4|75|0
2025117|5,10,18,21,29|2:2:1|3:2|83|1
2025118|2,8,9,12,21|4:1:0|2:3|52|0
2025119|8,15,27,29,31|1:1:3|4:1|110|1
2025120|11,13,22,26,35|1:2:2|3:2|107|0
2025121|2,3,8,13,21|3:2:0|3:2|47|0
2025122|2,3,6,16,17|3:2:0|2:3|44|2
2025123|8,13,24,25,31|1:1:3|3:2|101|0
2025124|6,9,14,26,27|2:1:2|2:3|82|0
2025125|10,11,13,19,35|2:2:1|3:2|88|0
2025126|1,8,18,27,30|2:1:2|2:3|84|0
2025127|4,5,19,28,29|2:1:2|3:2|85|0
2025128|3,6,26,30,33|2:0:3|2:3|98|0
2025129|3,9,14,28,35|2:1:2|3:2|89|1
2025130|1,13,16,27,29|1:2:2|4:1|86|0
2025131|3,8,25,29,32|2:0:3|3:2|97|1
2025132|1,9,10,12,19|4:1:0|3:2|51|0
2025133|4,11,23,27,35|2:1:2|3:2|100|0
2025134|7,12,18,27,33|2:1:2|3:2|97|1
2025135|2,10,16,28,32|2:1:2|0:5|88|0
2025136|7,11,15,16,23|2:3:0|4:1|72|1
2025137|7,8,9,11,22|4:1:0|3:2|57|2
2025138|1,3,18,21,23|2:3:0|4:1|66|0
2025139|8,16,22,30,35|1:2:2|1:4|111|0
2025140|4,5,13,18,34|2:2:1|2:3|74|0
2025141|4,9,24,28,29|2:0:3|2:3|94|1
2025142|6,10,14,27,29|2:1:2|2:3|86|1
2025143|3,4,18,24,29|2:1:2|2:3|78|1
2025144|2,5,13,15,28|2:2:1|3:2|63|0
2025145|6,7,20,22,25|2:2:1|2:3|80|0
2025146|6,11,13,16,22|2:3:0|2:3|68|1
2025147|6,18,21,25,33|1:2:2|3:2|103|1
2025148|3,4,14,30,32|2:1:2|1:4|83|0
2025149|24,26,30,31,32|0:0:5|1:4|143|2
2025150|13,14,15,28,31|0:3:2|3:2|101|1
2026001|7,9,23,27,32|2:1:2|4:1|98|0
2026002|4,8,15,20,31|2:2:1|2:3|78|0
2026003|2,9,11,15,16|3:2:0|3:2|53|1
2026004|5,18,23,25,32|1:2:2|3:2|103|0
2026005|2,4,16,23,35|2:2:1|2:3|80|1
2026006|5,12,18,23,35|2:2:1|3:2|93|2
2026007|1,3,13,20,26|2:2:1|2:3|63|0
2026008|3,6,17,21,33|2:2:1|4:1|80|1
2026009|5,12,13,14,33|2:2:1|3:2|77|1
2026010|2,3,13,18,26|2:2:1|2:3|62|1
2026011|14,21,23,29,33|0:3:2|3:2|120|0
2026012|1,2,9,22,25|3:1:1|3:2|59|0
2026013|3,5,6,23,26|3:1:1|3:2|63|0
2026014|16,18,23,34,35|0:3:2|2:3|126|1
2026015|1,4,10,13,17|3:2:0|3:2|45|0
2026016|8,9,12,19,24|3:1:1|2:3|72|0
2026017|4,5,10,23,31|3:1:1|3:2|73|1
2026018|9,11,19,30,35|2:1:2|4:1|104|0
2026019|12,13,14,16,31|1:3:1|2:3|86|0
2026020|1,10,21,23,29|2:2:1|4:1|84|0
2026021|5,8,12,14,17|3:2:0|2:3|56|0
2026022|5,9,10,18,26|3:1:1|2:3|68|1
2026023|9,25,26,27,28|1:0:4|3:2|115|1
2026024|2,4,8,10,21|4:1:0|1:4|45|0
2026025|3,15,24,28,29|1:1:3|3:2|99|0
2026026|10,11,22,26,32|2:1:2|1:4|101|0
2026027|9,10,11,12,16|4:1:0|2:3|58|2
2026028|15,27,29,30,34|0:1:4|3:2|135|0
2026029|3,5,17,33,35|2:1:2|5:0|93|0
2026030|2,13,22,28,34|1:2:2|1:4|99|0
2026031|6,8,22,29,34|2:1:2|1:4|99|1
2026032|3,4,19,26,32|2:1:2|2:3|84|0
2026033|3,5,7,9,18|4:1:0|4:1|42|1
2026034|11,12,25,26,27|2:0:3|3:2|101|0
2026035|2,22,30,33,34|1:1:3|1:4|121|0
2026036|4,7,16,26,32|2:1:2|1:4|85|0
2026037|7,12,13,28,32|2:1:2|2:3|92|2
2026038|8,17,21,33,35|1:2:2|4:1|114|0
2026039|9,11,20,26,27|2:1:2|3:2|93|0
2026040|6,12,13,21,34|2:2:1|2:3|86|0
2026041|24,25,27,29,34|0:0:5|3:2|139|1
2026042|2,7,13,19,24|2:2:1|3:2|65|1
2026043|8,12,14,19,22|2:3:0|1:4|75|1
2026044|3,8,22,26,29|2:1:2|2:3|88|1
2026045|1,15,21,26,33|1:2:2|4:1|96|1
2026046|1,13,18,27,33|1:2:2|3:2|92|2
2026047|9,20,21,23,28|1:3:1|3:2|101|0
2026048|11,17,20,23,35|1:3:1|4:1|106|2
2026049|1,6,14,15,17|2:3:0|3:2|53|0
2026050|6,10,14,23,33|2:2:1|2:3|86|2
2026051|13,18,28,32,33|0:2:3|2:3|124|1
2026052|2,3,20,28,33|2:1:2|2:3|86|2
2026053|2,9,14,20,31|2:2:1|2:3|76|2
2026054|2,6,14,22,24|2:2:1|0:5|68|1
2026055|9,10,20,33,35|2:1:2|3:2|107|0
2026056|6,7,18,21,30|2:2:1|2:3|82|0
2026057|23,25,26,27,34|0:1:4|3:2|135|0
2026058|7,12,13,18,34|2:2:1|2:3|84|1
2026059|6,13,17,19,26|1:3:1|3:2|81|1
2026060|22,28,30,31,34|0:1:4|1:4|145|0
2026061|10,12,26,31,35|2:0:3|2:3|114|1
2026062|7,15,20,24,29|1:2:2|3:2|95|0
2026063|3,15,20,29,31|1:2:2|4:1|98|3
2026064|3,13,15,17,21|1:4:0|5:0|69|2
2026065|4,11,12,13,25|3:1:1|3:2|65|1
2026066|10,13,19,21,30|1:3:1|3:2|93|1
2026067|6,16,18,19,28|1:3:1|1:4|87|1
2026068|3,11,12,21,22|3:2:0|3:2|69|0
2026069|12,19,21,24,29|1:2:2|3:2|105|2
2026070|4,5,15,21,32|2:2:1|3:2|77|1
2026071|5,13,22,26,32|2:1:2|2:3|98|2
2026072|1,13,26,29,30|1:1:3|3:2|99|2`;

// 解析数据
const draws = [];
const lines = rawData.trim().split('\n');
for (let i = 0; i < lines.length; i++) {
  const parts = lines[i].split('|');
  if (parts.length < 6) continue;
  const front = parts[1].split(',').map(Number);
  const iv = parts[2].split(':').map(Number);
  const oe = parts[3].split(':').map(Number);
  const sum = parseInt(parts[4]);
  const repeat = parts[5] === '-' ? 0 : parseInt(parts[5]);
  draws.push({ issue: parts[0], front, iv, ivKey: iv.join(':'), oe, oeKey: oe.join(':'), sum, repeat });
}

console.log(`总期数: ${draws.length}`);
console.log(`相邻配对: ${draws.length - 1}对\n`);

// ====== 方法1: 当前Markov转移模型 (predictTargetIntervalRatio) ======
console.log('='.repeat(70));
console.log('方法1: 当前Markov转移模型 (同源IV转移 + 时效权重 + 全局校准)');
console.log('='.repeat(70));

function getIvDist(iv1, iv2) {
  let d = 0;
  for (let i = 0; i < 3; i++) d += Math.abs((iv1[i] || 0) - (iv2[i] || 0));
  return d;
}

function predictIvCurrent(sourceIdx, sourceIv) {
  const sourceIvKey = sourceIv.join(':');
  const transitions = new Map(); // targetIvKey → { count, weight }
  const windowSize = Math.min(60, sourceIdx);
  let specificCount = 0;
  let globalDistSum = 0, globalDistCount = 0;

  for (let i = 0; i < sourceIdx; i++) {
    const sIv = draws[i].iv;
    const tIv = draws[i + 1].iv;
    const sKey = sIv.join(':');
    globalDistSum += getIvDist(sIv, tIv);
    globalDistCount++;
    if (sKey !== sourceIvKey) continue;
    specificCount++;
    const tKey = tIv.join(':');
    const recency = 1 + (i - Math.max(0, sourceIdx - windowSize)) / windowSize * 2;
    const entry = transitions.get(tKey) || { count: 0, weight: 0 };
    entry.count++;
    entry.weight += recency;
    transitions.set(tKey, entry);
  }

  const globalAvgDist = globalDistCount > 0 ? globalDistSum / globalDistCount : 3.0;
  const minSpecific = 4;
  const blendWeight = Math.min(1, specificCount / minSpecific);

  const maxWeight = Math.max(1, ...[...transitions.values()].map(d => d.weight));
  const sorted = [...transitions.entries()]
    .map(([ivKey, data]) => ({
      iv: ivKey.split(':').map(Number),
      ivKey,
      score: data.count * 0.7 + (data.weight / maxWeight) * 30,
      count: data.count,
      weight: data.weight
    }))
    .sort((a, b) => b.score - a.score);

  if (sorted.length === 0) {
    const neutralDist = Math.round(globalAvgDist);
    return { predictedIv: sourceIv, predictedIvKey: sourceIvKey, distance: neutralDist, confidence: 0, topCandidates: [], globalAvgDist };
  }

  const topCandidates = sorted.slice(0, 3);
  const predictedIv = topCandidates[0].iv;
  const rawDistance = getIvDist(sourceIv, predictedIv);
  const totalScore = topCandidates.reduce((s, c) => s + c.score, 0);
  const rawConfidence = topCandidates[0].score / Math.max(0.1, totalScore);
  const blendedDistance = Math.round(rawDistance * blendWeight + globalAvgDist * (1 - blendWeight));
  const confidence = rawConfidence * blendWeight;

  return { predictedIv, predictedIvKey: topCandidates[0].ivKey, distance: blendedDistance, confidence, topCandidates, globalAvgDist };
}

// 回测方法1：对每对相邻期，用前i期数据预测第i+1期
let correct1_top1 = 0, correct1_top3 = 0, total1 = 0;
const errors1 = [];

for (let i = 0; i < draws.length - 1; i++) {
  const src = draws[i];
  const tgt = draws[i + 1];
  const pred = predictIvCurrent(i, src.iv);
  total1++;
  
  if (pred.predictedIvKey === tgt.ivKey) correct1_top1++;
  if (pred.topCandidates.some(c => c.ivKey === tgt.ivKey)) correct1_top3++;
  
  if (pred.predictedIvKey !== tgt.ivKey) {
    errors1.push({
      from: src.issue + '→' + tgt.issue,
      srcIv: src.ivKey,
      pred: pred.predictedIvKey,
      actual: tgt.ivKey,
      dist: getIvDist(pred.predictedIv, tgt.iv),
      conf: pred.confidence.toFixed(2),
      top3: pred.topCandidates.map(c => c.ivKey + '(' + c.score.toFixed(1) + ')').join(', ')
    });
  }
}

console.log(`\nTop1命中率: ${correct1_top1}/${total1} = ${(correct1_top1/total1*100).toFixed(1)}%`);
console.log(`Top3命中率: ${correct1_top3}/${total1} = ${(correct1_top3/total1*100).toFixed(1)}%`);
console.log(`\n最近40个错误:`);
errors1.slice(-40).forEach(e => {
  console.log(`  ${e.from} | 源${e.srcIv} → 预测${e.pred} 实际${e.actual} | dist=${e.dist} conf=${e.conf} | Top3: ${e.top3}`);
});

// ====== 方法2: 全局频率Top3 (不做转移，直接取历史上最高频的区间比) ======
console.log('\n' + '='.repeat(70));
console.log('方法2: 全局频率Top3 (不看转移，只看历史全局频率)');
console.log('='.repeat(70));

const globalIvFreq = new Map();
for (const d of draws) {
  globalIvFreq.set(d.ivKey, (globalIvFreq.get(d.ivKey) || 0) + 1);
}
const globalTop3 = [...globalIvFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);

let correct2_top1 = 0, correct2_top3 = 0;

for (let i = 0; i < draws.length - 1; i++) {
  const tgt = draws[i + 1];
  if (tgt.ivKey === globalTop3[0]) correct2_top1++;
  if (globalTop3.includes(tgt.ivKey)) correct2_top3++;
}

console.log(`全局Top3区间比: ${globalTop3.join(', ')}`);
console.log(`Top1命中率: ${correct2_top1}/${total1} = ${(correct2_top1/total1*100).toFixed(1)}%`);
console.log(`Top3命中率: ${correct2_top3}/${total1} = ${(correct2_top3/total1*100).toFixed(1)}%`);

// ====== 方法3: 基于分析报告的"同源不变率"策略 ======
console.log('\n' + '='.repeat(70));
console.log('方法3: 同源不变率策略 (IV不变 > Markov转移 > 全局频率)');
console.log('='.repeat(70));

// 根据用户报告：49/171=28.7%的概率IV不变
function predictIvReportBased(sourceIdx, sourceIv) {
  const sourceIvKey = sourceIv.join(':');
  
  // ① 计算此IV在历史上的"不变率"
  let stayCount = 0, changeCount = 0;
  const changes = new Map();
  for (let i = 0; i < sourceIdx; i++) {
    if (draws[i].ivKey === sourceIvKey) {
      const nextIv = draws[i + 1].ivKey;
      if (nextIv === sourceIvKey) stayCount++;
      else {
        changeCount++;
        changes.set(nextIv, (changes.get(nextIv) || 0) + 1);
      }
    }
  }
  
  const total = stayCount + changeCount;
  const stayRate = total > 0 ? stayCount / total : 0.2; // 默认20%
  
  // ② 如果不变率>25%，直接预测不变
  if (stayRate > 0.25) {
    return { 
      predictedIv: sourceIv, 
      predictedIvKey: sourceIvKey, 
      reason: 'stay', 
      stayRate: stayRate.toFixed(2),
      candidates: [sourceIvKey, ...([...changes.entries()].sort((a,b)=>b[1]-a[1]).slice(0,2).map(e=>e[0]))]
    };
  }
  
  // ③ 否则取最常见的变化目标
  const sortedChanges = [...changes.entries()].sort((a, b) => b[1] - a[1]);
  const topChanges = sortedChanges.slice(0, 3).map(e => e[0]);
  
  // 补充全局高频
  const candidates = [...topChanges];
  for (const g of globalTop3) {
    if (!candidates.includes(g) && candidates.length < 3) candidates.push(g);
  }
  
  return {
    predictedIv: candidates[0] ? candidates[0].split(':').map(Number) : sourceIv,
    predictedIvKey: candidates[0] || sourceIvKey,
    reason: 'change', 
    stayRate: stayRate.toFixed(2),
    candidates
  };
}

let correct3 = 0, correct3_top3 = 0;

for (let i = 0; i < draws.length - 1; i++) {
  const src = draws[i];
  const tgt = draws[i + 1];
  const pred = predictIvReportBased(i, src.iv);
  if (pred.predictedIvKey === tgt.ivKey) correct3++;
  if (pred.candidates.includes(tgt.ivKey)) correct3_top3++;
}

console.log(`Top1命中率: ${correct3}/${total1} = ${(correct3/total1*100).toFixed(1)}%`);
console.log(`Top3命中率: ${correct3_top3}/${total1} = ${(correct3_top3/total1*100).toFixed(1)}%`);

// ====== 方法4: 增强Markov——加入近期趋势权重 ======
console.log('\n' + '='.repeat(70));
console.log('方法4: 增强Markov (同源转移 + 近期趋势 + 极端偏态检测)');
console.log('='.repeat(70));

function predictIvEnhanced(sourceIdx, sourceIv) {
  const sourceIvKey = sourceIv.join(':');
  const sourceZ0 = sourceIv[0]; // 一区数量
  
  // ① 常规Markov转移
  const transitions = new Map();
  let specificCount = 0;
  for (let i = 0; i < sourceIdx; i++) {
    if (draws[i].ivKey === sourceIvKey) {
      specificCount++;
      const tKey = draws[i + 1].ivKey;
      const recency = 1 + i / sourceIdx * 3; // 越近权重越高
      const entry = transitions.get(tKey) || { count: 0, weight: 0 };
      entry.count++;
      entry.weight += recency;
      transitions.set(tKey, entry);
    }
  }
  
  // ② 极端偏态检测：一区=0或一区=5
  const isExtreme = (sourceZ0 === 0 || sourceZ0 >= 4);
  
  if (isExtreme) {
    // 极端偏态后，回归主旋律概率极高（报告显示85.7%回归3:2/2:3）
    const mainIvCandidates = ['2:2:1', '2:1:2', '1:2:2'];
    // 但也要看具体转移历史
    const sorted = [...transitions.entries()].sort((a, b) => b[1].count - a[1].count);
    const histTop = sorted.slice(0, 2).map(e => e[0]);
    
    // 合并：历史转移优先，主旋律补充
    const candidates = [...new Set([...histTop, ...mainIvCandidates])].slice(0, 3);
    return {
      predictedIv: candidates[0].split(':').map(Number),
      predictedIvKey: candidates[0],
      reason: 'extreme_recovery',
      candidates,
      isExtreme: true
    };
  }
  
  // ③ 正常情况：Markov转移
  const sorted = [...transitions.entries()]
    .map(([ivKey, data]) => ({
      iv: ivKey.split(':').map(Number),
      ivKey,
      score: data.weight * 0.6 + data.count * 0.4,
      count: data.count,
      weight: data.weight
    }))
    .sort((a, b) => b.score - a.score);
  
  if (sorted.length === 0) {
    // 无历史数据，用全局Top3
    return {
      predictedIv: globalTop3[0].split(':').map(Number),
      predictedIvKey: globalTop3[0],
      reason: 'global_fallback',
      candidates: globalTop3.slice(0, 3)
    };
  }
  
  const topCandidates = sorted.slice(0, 3).map(s => s.ivKey);
  return {
    predictedIv: sorted[0].iv,
    predictedIvKey: sorted[0].ivKey,
    reason: 'markov_enhanced',
    candidates: topCandidates
  };
}

let correct4 = 0, correct4_top3 = 0;
const recentErrors4 = [];

for (let i = 0; i < draws.length - 1; i++) {
  const src = draws[i];
  const tgt = draws[i + 1];
  const pred = predictIvEnhanced(i, src.iv);
  if (pred.predictedIvKey === tgt.ivKey) correct4++;
  if (pred.candidates.includes(tgt.ivKey)) correct4_top3++;
  if (pred.predictedIvKey !== tgt.ivKey) {
    recentErrors4.push({ from: src.issue + '→' + tgt.issue, srcIv: src.ivKey, pred: pred.predictedIvKey, actual: tgt.ivKey, reason: pred.reason, cand: pred.candidates.join(', ') });
  }
}

console.log(`\nTop1命中率: ${correct4}/${total1} = ${(correct4/total1*100).toFixed(1)}%`);
console.log(`Top3命中率: ${correct4_top3}/${total1} = ${(correct4_top3/total1*100).toFixed(1)}%`);
console.log(`\n最近30个错误:`);
recentErrors4.slice(-30).forEach(e => {
  console.log(`  ${e.from} | 源${e.srcIv} → 预测${e.pred} 实际${e.actual} | ${e.reason} | 候选: ${e.cand}`);
});

// ====== 方法5: 基于报告交叉分析的精确策略 ======
console.log('\n' + '='.repeat(70));
console.log('方法5: 报告交叉分析策略 (不变率阈值 + 和值趋势 + 极端检测)');
console.log('='.repeat(70));

function predictIvCrossAnalysis(sourceIdx, sourceIv, sourceSum, sourceOeKey) {
  const sourceIvKey = sourceIv.join(':');
  const sourceZ0 = sourceIv[0];
  
  // 极端偏态检测
  const isExtreme = (sourceZ0 === 0 || sourceZ0 >= 4);
  
  if (sourceZ0 === 0) {
    // 报告：0:0:5/0:1:4出现后，平均和值~118, 回归主旋律85.7%
    // 回归3:2/2:3奇偶比
    const recoveryCandidates = ['2:2:1', '2:1:2', '1:2:2', '1:1:3', '3:1:1'];
    return {
      predictedIvKey: '2:2:1',
      iv: [2, 2, 1],
      reason: 'extreme_z0_recovery',
      candidates: recoveryCandidates
    };
  }
  
  if (sourceZ0 >= 4) {
    // 4:1:0出现后，和值偏低(~65), 重号率52.9%
    // 大概率回归2:2:1或3:1:1
    const recoveryCandidates = ['3:1:1', '2:2:1', '4:1:0', '2:1:2', '3:2:0'];
    return {
      predictedIvKey: '3:1:1',
      iv: [3, 1, 1],
      reason: 'extreme_z4_recovery',
      candidates: recoveryCandidates
    };
  }
  
  // 正常情况：使用转移数据
  const transitions = new Map();
  let stayCount = 0, totalInstances = 0;
  
  for (let i = 0; i < sourceIdx; i++) {
    if (draws[i].ivKey === sourceIvKey) {
      totalInstances++;
      const nextIv = draws[i + 1].ivKey;
      if (nextIv === sourceIvKey) stayCount++;
      const recency = 1 + i / sourceIdx * 3;
      const entry = transitions.get(nextIv) || { count: 0, weight: 0 };
      entry.count++;
      entry.weight += recency;
      transitions.set(nextIv, entry);
    }
  }
  
  const stayRate = totalInstances > 0 ? stayCount / totalInstances : 0;
  const sorted = [...transitions.entries()].sort((a, b) => b[1].weight - a[1].weight);
  
  // 高不变率(>30%)且非极端 → 直接预测不变
  if (stayRate > 0.30 && !isExtreme) {
    const candidates = [sourceIvKey, ...sorted.filter(e => e[0] !== sourceIvKey).slice(0, 2).map(e => e[0])];
    // 确保有3个候选
    while (candidates.length < 3) {
      const next = globalTop3.find(g => !candidates.includes(g));
      if (next) candidates.push(next); else break;
    }
    return {
      predictedIvKey: sourceIvKey,
      iv: sourceIv,
      reason: 'high_stay_rate_' + (stayRate*100).toFixed(0) + '%',
      candidates: candidates.slice(0, 3)
    };
  }
  
  // 否则：最常见变化目标 + 全局Top3补充
  const candidates = sorted.slice(0, 3).map(e => e[0]);
  for (const g of globalTop3) {
    if (!candidates.includes(g) && candidates.length < 3) candidates.push(g);
  }
  
  if (candidates.length === 0) {
    return {
      predictedIvKey: globalTop3[0],
      iv: globalTop3[0].split(':').map(Number),
      reason: 'fallback',
      candidates: globalTop3.slice(0, 3)
    };
  }
  
  return {
    predictedIvKey: candidates[0],
    iv: candidates[0].split(':').map(Number),
    reason: 'markov_change',
    candidates: candidates.slice(0, 3)
  };
}

let correct5 = 0, correct5_top3 = 0;
for (let i = 0; i < draws.length - 1; i++) {
  const src = draws[i];
  const tgt = draws[i + 1];
  const pred = predictIvCrossAnalysis(i, src.iv, src.sum, src.oeKey);
  if (pred.predictedIvKey === tgt.ivKey) correct5++;
  if (pred.candidates.includes(tgt.ivKey)) correct5_top3++;
}

console.log(`\nTop1命中率: ${correct5}/${total1} = ${(correct5/total1*100).toFixed(1)}%`);
console.log(`Top3命中率: ${correct5_top3}/${total1} = ${(correct5_top3/total1*100).toFixed(1)}%`);

// ====== 汇总对比 ======
console.log('\n' + '='.repeat(70));
console.log('汇总对比');
console.log('='.repeat(70));
console.log('方法                                       | Top1命中率 | Top3命中率');
console.log('-'.repeat(70));
console.log(`方法1: 当前Markov转移模型                     | ${(correct1_top1/total1*100).toFixed(1)}%    | ${(correct1_top3/total1*100).toFixed(1)}%`);
console.log(`方法2: 全局频率Top3(不看转移)                 | ${(correct2_top1/total1*100).toFixed(1)}%    | ${(correct2_top3/total1*100).toFixed(1)}%`);
console.log(`方法3: 同源不变率策略                          | ${(correct3/total1*100).toFixed(1)}%    | ${(correct3_top3/total1*100).toFixed(1)}%`);
console.log(`方法4: 增强Markov(趋势+极端)                  | ${(correct4/total1*100).toFixed(1)}%    | ${(correct4_top3/total1*100).toFixed(1)}%`);
console.log(`方法5: 报告交叉分析(不变阈值+和值+极端)       | ${(correct5/total1*100).toFixed(1)}%    | ${(correct5_top3/total1*100).toFixed(1)}%`);

// ====== 关键IV的转移矩阵 ======
console.log('\n' + '='.repeat(70));
console.log('关键区间比的转移矩阵');
console.log('='.repeat(70));

const keyIvs = ['2:2:1', '2:1:2', '1:2:2', '3:1:1', '4:1:0', '3:2:0', '2:3:0', '0:3:2', '1:1:3', '0:0:5', '0:1:4'];

for (const srcIv of keyIvs) {
  const map = new Map();
  let total = 0;
  for (let i = 0; i < draws.length - 1; i++) {
    if (draws[i].ivKey === srcIv) {
      total++;
      const tgt = draws[i + 1].ivKey;
      map.set(tgt, (map.get(tgt) || 0) + 1);
    }
  }
  if (total === 0) continue;
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const top5 = sorted.slice(0, 5).map(e => `${e[0]}(${e[1]}次/${(e[1]/total*100).toFixed(0)}%)`).join(', ');
  console.log(`  ${srcIv} → [${top5}] (共${total}次)`);
}

// ====== 近期IV走势 (最后10期) ======
console.log('\n' + '='.repeat(70));
console.log('近期IV走势 (最后12期)');
console.log('='.repeat(70));
for (let i = draws.length - 12; i < draws.length; i++) {
  const d = draws[i];
  console.log(`  ${d.issue} | ${d.ivKey} | 奇偶${d.oeKey} | 和值${d.sum} | 重号${d.repeat}`);
}

// ====== 2026073期区间比预测 ======
console.log('\n' + '='.repeat(70));
console.log('2026073期区间比预测 (基于2026072: 1:1:3)');
console.log('='.repeat(70));

const lastIdx = draws.length - 1;
const lastIv = draws[lastIdx].iv;
const lastIvKey = draws[lastIdx].ivKey;
const lastSum = draws[lastIdx].sum;
const lastOe = draws[lastIdx].oeKey;

console.log(`源区间比: ${lastIvKey} | 和值: ${lastSum} | 奇偶: ${lastOe}`);
console.log(`历史出现次数: ${draws.filter(d => d.ivKey === lastIvKey).length}`);
console.log('');

// 1:1:3的历史转移
console.log('1:1:3 历史转移:');
let tt = 0;
const tmap = new Map();
for (let i = 0; i < draws.length - 1; i++) {
  if (draws[i].ivKey === '1:1:3') {
    tt++;
    tmap.set(draws[i+1].ivKey, (tmap.get(draws[i+1].ivKey) || 0) + 1);
  }
}
console.log(`  共${tt}次出现，转移目标:`);
[...tmap.entries()].sort((a,b)=>b[1]-a[1]).forEach(e => {
  console.log(`    → ${e[0]}: ${e[1]}次 (${(e[1]/tt*100).toFixed(0)}%)`);
});

// 各方法预测
const pred1 = predictIvCurrent(lastIdx, lastIv);
const pred4 = predictIvEnhanced(lastIdx, lastIv);
const pred5 = predictIvCrossAnalysis(lastIdx, lastIv, lastSum, lastOe);

console.log('\n各方法对2026073的预测:');
console.log(`  方法1(当前Markov): ${pred1.predictedIvKey} | 候选: ${pred1.topCandidates.map(c=>c.ivKey).join(', ')}`);
console.log(`  方法4(增强Markov): ${pred4.predictedIvKey} | 候选: ${pred4.candidates.join(', ')} | 原因: ${pred4.reason}`);
console.log(`  方法5(交叉分析):   ${pred5.predictedIvKey} | 候选: ${pred5.candidates.join(', ')} | 原因: ${pred5.reason}`);
