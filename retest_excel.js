const fs = require('fs');
const { JSDOM } = require('jsdom');

// Excel数据（26040-2026069，30期）
const excelDraws = [
  { issue: "2026040", front: [6, 12, 13, 21, 34], back: [8, 9] },
  { issue: "2026041", front: [24, 25, 27, 29, 34], back: [2, 6] },
  { issue: "2026042", front: [2, 7, 13, 19, 24], back: [3, 8] },
  { issue: "2026043", front: [8, 12, 14, 19, 22], back: [11, 12] },
  { issue: "2026044", front: [3, 8, 22, 26, 29], back: [7, 10] },
  { issue: "2026045", front: [1, 15, 21, 26, 33], back: [4, 7] },
  { issue: "2026046", front: [1, 13, 18, 27, 33], back: [4, 7] },
  { issue: "2026047", front: [9, 20, 21, 23, 28], back: [6, 11] },
  { issue: "2026048", front: [11, 17, 20, 23, 35], back: [1, 10] },
  { issue: "2026049", front: [1, 6, 14, 15, 17], back: [2, 3] },
  { issue: "2026050", front: [6, 10, 14, 23, 33], back: [8, 10] },
  { issue: "2026051", front: [13, 18, 28, 32, 33], back: [2, 11] },
  { issue: "2026052", front: [2, 3, 20, 28, 33], back: [2, 12] },
  { issue: "2026053", front: [2, 9, 14, 20, 31], back: [5, 9] },
  { issue: "2026054", front: [2, 6, 14, 22, 24], back: [8, 11] },
  { issue: "2026055", front: [9, 10, 20, 33, 35], back: [4, 11] },
  { issue: "2026056", front: [6, 7, 18, 21, 30], back: [1, 5] },
  { issue: "2026057", front: [23, 25, 26, 27, 34], back: [4, 10] },
  { issue: "2026058", front: [7, 12, 13, 18, 34], back: [1, 5] },
  { issue: "2026059", front: [6, 13, 17, 19, 26], back: [7, 8] },
  { issue: "2026060", front: [22, 28, 30, 31, 34], back: [1, 5] },
  { issue: "2026061", front: [10, 12, 26, 31, 35], back: [2, 12] },
  { issue: "2026062", front: [7, 15, 20, 24, 29], back: [4, 10] },
  { issue: "2026063", front: [3, 15, 20, 29, 31], back: [1, 12] },
  { issue: "2026064", front: [3, 13, 15, 17, 21], back: [2, 7] },
  { issue: "2026065", front: [4, 11, 12, 13, 25], back: [4, 8] },
  { issue: "2026066", front: [10, 13, 19, 21, 30], back: [4, 5] },
  { issue: "2026067", front: [6, 16, 18, 19, 28], back: [7, 11] },
  { issue: "2026068", front: [3, 11, 12, 21, 22], back: [6, 10] },
  { issue: "2026069", front: [12, 19, 21, 24, 29], back: [3, 10] },
];

// 构建完整数据集：script.js原有50期 + Excel新增18期（2026052-2026069）
// 原有数据到2026051，Excel从2026040开始，重叠12期，新增18期
const allDraws = [
  // script.js原有50期（2026002-2026051）
  { issue: "2026002", front: [4, 8, 15, 20, 31], back: [7, 8] },
  { issue: "2026003", front: [2, 9, 11, 15, 16], back: [2, 4] },
  { issue: "2026004", front: [5, 18, 23, 25, 32], back: [5, 9] },
  { issue: "2026005", front: [2, 4, 16, 23, 35], back: [6, 11] },
  { issue: "2026006", front: [5, 12, 18, 23, 35], back: [6, 12] },
  { issue: "2026007", front: [1, 3, 13, 20, 26], back: [3, 10] },
  { issue: "2026008", front: [3, 6, 17, 21, 33], back: [5, 11] },
  { issue: "2026009", front: [5, 12, 13, 14, 33], back: [5, 8] },
  { issue: "2026010", front: [2, 3, 13, 18, 26], back: [2, 9] },
  { issue: "2026011", front: [14, 21, 23, 29, 33], back: [2, 10] },
  { issue: "2026012", front: [1, 2, 9, 22, 25], back: [1, 6] },
  { issue: "2026013", front: [3, 5, 6, 23, 26], back: [1, 4] },
  { issue: "2026014", front: [16, 18, 23, 34, 35], back: [1, 6] },
  { issue: "2026015", front: [1, 4, 10, 13, 17], back: [3, 11] },
  { issue: "2026016", front: [8, 9, 12, 19, 24], back: [1, 6] },
  { issue: "2026017", front: [4, 5, 10, 23, 31], back: [7, 12] },
  { issue: "2026018", front: [9, 11, 19, 30, 35], back: [1, 12] },
  { issue: "2026019", front: [12, 13, 14, 16, 31], back: [4, 12] },
  { issue: "2026020", front: [1, 10, 21, 23, 29], back: [10, 12] },
  { issue: "2026021", front: [5, 8, 12, 14, 17], back: [4, 5] },
  { issue: "2026022", front: [5, 9, 10, 18, 26], back: [5, 6] },
  { issue: "2026023", front: [9, 25, 26, 27, 28], back: [1, 8] },
  { issue: "2026024", front: [2, 4, 8, 10, 21], back: [9, 12] },
  { issue: "2026025", front: [3, 15, 24, 28, 29], back: [3, 7] },
  { issue: "2026026", front: [10, 11, 22, 26, 32], back: [1, 8] },
  { issue: "2026027", front: [9, 10, 11, 12, 16], back: [1, 11] },
  { issue: "2026028", front: [15, 27, 29, 30, 34], back: [1, 10] },
  { issue: "2026029", front: [3, 5, 17, 33, 35], back: [5, 7] },
  { issue: "2026030", front: [2, 13, 22, 28, 34], back: [5, 12] },
  { issue: "2026031", front: [6, 8, 22, 29, 34], back: [5, 7] },
  { issue: "2026032", front: [3, 4, 19, 26, 32], back: [1, 12] },
  { issue: "2026033", front: [3, 5, 7, 9, 18], back: [2, 10] },
  { issue: "2026034", front: [11, 12, 25, 26, 27], back: [8, 11] },
  { issue: "2026035", front: [2, 22, 30, 33, 34], back: [8, 12] },
  { issue: "2026036", front: [4, 7, 16, 26, 32], back: [5, 8] },
  { issue: "2026037", front: [7, 12, 13, 28, 32], back: [6, 8] },
  { issue: "2026038", front: [8, 17, 21, 33, 35], back: [6, 7] },
  { issue: "2026039", front: [9, 11, 20, 26, 27], back: [6, 9] },
  { issue: "2026040", front: [6, 12, 13, 21, 34], back: [8, 9] },
  { issue: "2026041", front: [24, 25, 27, 29, 34], back: [2, 6] },
  { issue: "2026042", front: [2, 7, 13, 19, 24], back: [3, 8] },
  { issue: "2026043", front: [8, 12, 14, 19, 22], back: [11, 12] },
  { issue: "2026044", front: [3, 8, 22, 26, 29], back: [7, 10] },
  { issue: "2026045", front: [1, 15, 21, 26, 33], back: [4, 7] },
  { issue: "2026046", front: [1, 13, 18, 27, 33], back: [4, 7] },
  { issue: "2026047", front: [9, 20, 21, 23, 28], back: [6, 11] },
  { issue: "2026048", front: [11, 17, 20, 23, 35], back: [1, 10] },
  { issue: "2026049", front: [1, 6, 14, 15, 17], back: [2, 3] },
  { issue: "2026050", front: [6, 10, 14, 23, 33], back: [8, 10] },
  { issue: "2026051", front: [13, 18, 28, 32, 33], back: [2, 11] },
  // Excel新增18期（2026052-2026069）
  { issue: "2026052", front: [2, 3, 20, 28, 33], back: [2, 12] },
  { issue: "2026053", front: [2, 9, 14, 20, 31], back: [5, 9] },
  { issue: "2026054", front: [2, 6, 14, 22, 24], back: [8, 11] },
  { issue: "2026055", front: [9, 10, 20, 33, 35], back: [4, 11] },
  { issue: "2026056", front: [6, 7, 18, 21, 30], back: [1, 5] },
  { issue: "2026057", front: [23, 25, 26, 27, 34], back: [4, 10] },
  { issue: "2026058", front: [7, 12, 13, 18, 34], back: [1, 5] },
  { issue: "2026059", front: [6, 13, 17, 19, 26], back: [7, 8] },
  { issue: "2026060", front: [22, 28, 30, 31, 34], back: [1, 5] },
  { issue: "2026061", front: [10, 12, 26, 31, 35], back: [2, 12] },
  { issue: "2026062", front: [7, 15, 20, 24, 29], back: [4, 10] },
  { issue: "2026063", front: [3, 15, 20, 29, 31], back: [1, 12] },
  { issue: "2026064", front: [3, 13, 15, 17, 21], back: [2, 7] },
  { issue: "2026065", front: [4, 11, 12, 13, 25], back: [4, 8] },
  { issue: "2026066", front: [10, 13, 19, 21, 30], back: [4, 5] },
  { issue: "2026067", front: [6, 16, 18, 19, 28], back: [7, 11] },
  { issue: "2026068", front: [3, 11, 12, 21, 22], back: [6, 10] },
  { issue: "2026069", front: [12, 19, 21, 24, 29], back: [3, 10] },
];

// 按issue排序
allDraws.sort((a, b) => a.issue.localeCompare(b.issue));

console.log(`总数据量: ${allDraws.length} 期`);
console.log(`数据范围: ${allDraws[0].issue} - ${allDraws[allDraws.length-1].issue}`);

// 构建期号到数据的映射
const issueMap = {};
allDraws.forEach(d => issueMap[d.issue] = d);

// 回测：对2026052-2026069（18期），用前10期数据预测
const testIssues = allDraws.filter(d => d.issue >= "2026052" && d.issue <= "2026069");
console.log(`\n回测期数: ${testIssues.length} 期 (${testIssues[0].issue} - ${testIssues[testIssues.length-1].issue})`);

let totalHits = 0;
let totalTests = 0;
const results = [];

testIssues.forEach(target => {
  const targetIssue = target.issue;
  // 找到target前10期作为数据源
  const targetIdx = allDraws.findIndex(d => d.issue === targetIssue);
  if (targetIdx < 10) return;
  
  // 取前10期数据
  const sourceDraws = allDraws.slice(targetIdx - 10, targetIdx);
  
  // 简单预测：统计前10期每个号码出现频率，取前5个
  const frontFreq = {};
  const backFreq = {};
  
  sourceDraws.forEach(d => {
    d.front.forEach(n => frontFreq[n] = (frontFreq[n] || 0) + 1);
    d.back.forEach(n => backFreq[n] = (backFreq[n] || 0) + 1);
  });
  
  // 按频率排序取前5
  const predictedFront = Object.entries(frontFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(e => parseInt(e[0]))
    .sort((a, b) => a - b);
  
  const predictedBack = Object.entries(backFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(e => parseInt(e[0]))
    .sort((a, b) => a - b);
  
  // 计算命中
  const frontHits = predictedFront.filter(n => target.front.includes(n)).length;
  const backHits = predictedBack.filter(n => target.back.includes(n)).length;
  
  totalHits += frontHits + backHits;
  totalTests++;
  
  results.push({
    issue: targetIssue,
    actual: { front: target.front, back: target.back },
    predicted: { front: predictedFront, back: predictedBack },
    frontHits,
    backHits,
    totalHits: frontHits + backHits
  });
});

// 输出结果
console.log('\n=== 回测结果 ===');
results.forEach(r => {
  console.log(`${r.issue}: 实际[${r.actual.front}]+[${r.actual.back}] 预测[${r.predicted.front}]+[${r.predicted.back}] 命中: 前区${r.frontHits} 后区${r.backHits} 总计${r.totalHits}`);
});

console.log('\n=== 统计 ===');
console.log(`总测试期数: ${totalTests}`);
console.log(`总命中球数: ${totalHits}`);
console.log(`平均每期命中: ${(totalHits / totalTests).toFixed(2)} 球`);

// 命中分布
const hitDist = {};
results.forEach(r => {
  const h = r.totalHits;
  hitDist[h] = (hitDist[h] || 0) + 1;
});
console.log('\n命中分布:');
Object.entries(hitDist).sort((a,b) => a[0]-b[0]).forEach(([hits, count]) => {
  console.log(`  ${hits}球: ${count}期 (${(count/results.length*100).toFixed(1)}%)`);
});
