/**
 * 分析未覆盖球的尾号关联关系
 */

const fs = require('fs');
const path = require('path');

// 设置全局变量
global.__isNode = true;

// 加载回测脚本
require('./script回测.js');

// 获取内置数据
const draws = getBuiltInDrawData();

// 分析尾号关联关系
function analyzeTailRelation(testPeriods = 111) {
  const totalDraws = draws.length;
  const startIdx = Math.max(1, totalDraws - testPeriods - 1);
  
  const missedBalls = []; // 存储未覆盖的球
  const tailRelationStats = {}; // 统计尾号关联关系
  
  for (let sourceIdx = startIdx; sourceIdx <= totalDraws - 10 - 1; sourceIdx++) {
    const mainSourceIdx = sourceIdx + 9; // N+9期
    const auxSourceIdx = sourceIdx;       // N期
    const targetIdx = sourceIdx + 10;     // N+10期
    
    const sourceDraw = draws[mainSourceIdx];
    const targetDraw = draws[targetIdx];
    if (!sourceDraw || !targetDraw) continue;
    
    const sourceNums = [...sourceDraw.front].sort((a, b) => a - b);
    const targetNums = [...targetDraw.front].sort((a, b) => a - b);
    
    const sourceRow = mainSourceIdx + 1;
    
    try {
      // 生成候选池
      const ratioPlan = null;
      let frontSample = buildSampleNumbersV4(sourceRow, "front", ratioPlan);
      
      // 三源合并
      const secondSourceRow = auxSourceIdx + 1;
      const thirdSourceRow = auxSourceIdx;
      
      const sourceRows = [sourceRow];
      if (secondSourceRow >= 1 && secondSourceRow <= totalDraws && secondSourceRow !== sourceRow) {
        sourceRows.push(secondSourceRow);
      }
      if (thirdSourceRow >= 1 && thirdSourceRow <= totalDraws && thirdSourceRow !== sourceRow && thirdSourceRow !== secondSourceRow) {
        sourceRows.push(thirdSourceRow);
      }
      
      const allSamples = sourceRows.map(row => ({
        row,
        sample: buildSampleNumbersV4(row, "front", ratioPlan)
      }));
      
      const weights = [0.5, 0.3, 0.2];
      const scoreMap = new Map();
      allSamples.forEach((item, idx) => {
        const w = weights[idx] || 0.1;
        item.sample.candidateEntries.forEach(e => {
          scoreMap.set(e.number, (scoreMap.get(e.number) || 0) + e.score * w);
        });
      });
      
      const mergedEntries = [...scoreMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, V4_POOL_SIZE)
        .map(([num, score]) => ({ number: num, score }));
      
      const pool30 = new Set(mergedEntries.map(e => e.number));
      
      // 找出未覆盖的球
      const missed = targetNums.filter(n => !pool30.has(n));
      
      if (missed.length > 0) {
        missedBalls.push({
          sourceIssue: sourceDraw.issue,
          targetIssue: targetDraw.issue,
          sourceNums,
          targetNums,
          missed,
          poolCoverage: 5 - missed.length,
        });
        
        // 分析源号码的尾号
        const sourceTails = sourceNums.map(n => n % 10);
        const uniqueSourceTails = [...new Set(sourceTails)];
        
        // 分析未覆盖球的尾号
        missed.forEach(ball => {
          const ballTail = ball % 10;
          
          // 检查这个尾号是否与源号码尾号有关联
          const relatedTails = uniqueSourceTails.filter(t => {
            return Math.abs(t - ballTail) <= 2 || Math.abs(t - ballTail) >= 8; // 相邻尾号
          });
          
          relatedTails.forEach(srcTail => {
            const key = `${srcTail}->${ballTail}`;
            tailRelationStats[key] = (tailRelationStats[key] || 0) + 1;
          });
        });
      }
      
    } catch (err) {
      // 跳过错误
    }
  }
  
  return { missedBalls, tailRelationStats };
}

// 运行分析
const { missedBalls, tailRelationStats } = analyzeTailRelation(111);

console.log("=".repeat(80));
console.log("未覆盖球的尾号关联分析");
console.log("=".repeat(80));
console.log(`总回测期数: 111`);
console.log(`有未覆盖球的期数: ${missedBalls.length}`);
console.log("");

// 统计尾号关联关系
console.log("尾号关联关系统计（源尾号->未覆盖球尾号）:");
console.log("-".repeat(60));

const sortedRelations = Object.entries(tailRelationStats)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20);

sortedRelations.forEach(([key, count]) => {
  console.log(`  ${key}: ${count}次`);
});

console.log("");
console.log("=".repeat(80));
console.log("未覆盖球的尾号分布:");
console.log("=".repeat(80));

const missedTailCount = {};
missedBalls.forEach(r => {
  r.missed.forEach(ball => {
    const tail = ball % 10;
    missedTailCount[tail] = (missedTailCount[tail] || 0) + 1;
  });
});

for (let t = 0; t <= 9; t++) {
  console.log(`尾号${t}: ${missedTailCount[t] || 0}次`);
}

console.log("");
console.log("=".repeat(80));
console.log("源号码尾号分布:");
console.log("=".peat(80));

const sourceTailCount = {};
missedBalls.forEach(r => {
  r.sourceNums.forEach(num => {
    const tail = num % 10;
    sourceTailCount[tail] = (sourceTailCount[tail] || 0) + 1;
  });
});

for (let t = 0; t <= 9; t++) {
  console.log(`尾号${t}: ${sourceTailCount[t] || 0}次`);
}

console.log("");
console.log("=".repeat(80));
console.log("建议:");
console.log("=".repeat(80));
console.log("根据尾号关联分析，可以考虑以下策略:");
console.log("1. 对于源号码中高频出现的尾号，增加其相邻尾号的权重");
console.log("2. 对于未覆盖球中高频出现的尾号，增加其出现概率");
console.log("3. 建立尾号转移矩阵，预测下一期可能出现的尾号");