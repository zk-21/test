/**
 * V4（有区间约束）回测
 * 直接使用script.js的V4逻辑进行回测
 */

const fs = require('fs');
const path = require('path');

// 加载script.js
let scriptCode = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf-8');

// 提取V4相关函数
// 注意：script.js是浏览器脚本，需要模拟浏览器环境
const window = {};
const document = { getElementById: () => null };
const console = { log: () => {} };

// 包装script.js代码
const wrappedCode = `
(function() {
  ${scriptCode}
  return { buildSampleNumbersV4, intervalRatio, getSampleIntervalIndex, V4_POOL_SIZE };
})()
`;

// 评估代码
const scriptModule = eval(wrappedCode);

// 加载all_draws数据
let drawsCode = fs.readFileSync(path.join(__dirname, 'all_draws.js'), 'utf-8');
const drawsWrapped = `
(function() {
  ${drawsCode}
  return ALL_DRAWS;
})()
`;
const ALL_DRAWS = eval(drawsWrapped);

// 辅助函数
function tails(nums) { return [...new Set(nums.map(n => n % 10))]; }

// 主回测
console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║  🧪 V4（有区间约束）回测                                           ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

const TEST_COUNT = 50;
const startIdx = ALL_DRAWS.length - TEST_COUNT - 1;

console.log(`📊 数据范围：${ALL_DRAWS[0].issue} ~ ${ALL_DRAWS[ALL_DRAWS.length - 1].issue}（共${ALL_DRAWS.length}期）`);
console.log(`📊 测试区间：${ALL_DRAWS[startIdx].issue} ~ ${ALL_DRAWS[ALL_DRAWS.length - 1].issue}（共${TEST_COUNT}期）`);
console.log(`📊 策略池大小：${scriptModule.V4_POOL_SIZE}球`);
console.log(`📊 区间约束：有（使用script.js的V4逻辑）\n`);

// 累计统计
let poolHits = 0, top5Hits = 0, jointHits = 0, validTests = 0;

// 最近10期详细
const recentDetails = [];

console.log("═".repeat(100));
console.log("📊 回测进行中...");
console.log("═".repeat(100) + "\n");

for (let t = 0; t < TEST_COUNT; t++) {
  const targetIdx = ALL_DRAWS.length - 1 - t;
  const sourceIdx = targetIdx - 1;
  
  if (sourceIdx < 0) continue;
  
  const targetDraw = ALL_DRAWS[targetIdx];
  const targetSet = new Set(targetDraw.front);
  
  // 使用V4逻辑构建池
  // 注意：这里需要模拟allBalls和row参数
  const sourceDraw = ALL_DRAWS[sourceIdx];
  const selectedNumbers = [...sourceDraw.front].sort((a, b) => a - b);
  
  // 构建allBalls模拟数据
  const allBalls = [];
  for (let i = 0; i <= sourceIdx; i++) {
    const draw = ALL_DRAWS[i];
    draw.front.forEach(n => {
      allBalls.push({
        number: n,
        row: i,
        zone: 'front',
        color: 'red'
      });
    });
  }
  
  // 调用V4函数
  const result = scriptModule.buildSampleNumbersV4(
    allBalls,
    sourceIdx,
    'front',
    'red',
    null, // sampleIntervals
    null, // historyMetrics
    null, // firstBallPredictions
    null, // ivPrediction
    null  // extremeFlags
  );
  
  if (!result || !result.candidateEntries) continue;
  
  const pool = result.candidateEntries;
  const top5 = pool.slice(0, 5).map(e => e.number).sort((a, b) => a - b);
  
  // 生成补漏6
  const top5Set = new Set(top5);
  const bulou6 = pool
    .filter(e => !top5Set.has(e.number))
    .slice(0, 5)
    .map(e => e.number)
    .sort((a, b) => a - b);
  
  const joint = new Set([...top5, ...bulou6]);
  
  // 计算命中
  const poolHit = pool.filter(e => targetSet.has(e.number)).length;
  const top5Hit = top5.filter(n => targetSet.has(n)).length;
  const jointHit = [...joint].filter(n => targetSet.has(n)).length;
  
  // 累计统计
  poolHits += poolHit;
  top5Hits += top5Hit;
  jointHits += jointHit;
  validTests++;
  
  // 最近10期记录
  if (t < 10) {
    recentDetails.push({
      target: targetDraw.issue,
      targetNums: targetDraw.front.join(','),
      poolHit,
      top5Hit,
      jointHit,
      top5,
      bulou6
    });
  }
  
  if (t % 10 === 0) {
    console.log(`  已完成 ${t + 1}/${TEST_COUNT} 期...`);
  }
}

// 输出汇总
console.log("\n" + "═".repeat(100));
console.log("📊 V4（有区间约束）汇总");
console.log("═".repeat(100));

if (validTests > 0) {
  const poolRate = (poolHits / (validTests * 5) * 100).toFixed(2);
  const top5Rate = (top5Hits / (validTests * 5) * 100).toFixed(2);
  const jointRate = (jointHits / (validTests * 5) * 100).toFixed(2);
  
  console.log(`\n有效测试期数：${validTests}`);
  console.log(`号码池覆盖率：${poolRate}%`);
  console.log(`Top5命中率：${top5Rate}%`);
  console.log(`联合命中率：${jointRate}%`);
}

// 最近10期详细
console.log("\n" + "═".repeat(100));
console.log("📋 最近10期详细");
console.log("═".repeat(100));

recentDetails.reverse().forEach(detail => {
  console.log(`\n🎯 ${detail.target}：[${detail.targetNums}]`);
  console.log(`  号码池命中：${detail.poolHit}/5`);
  console.log(`  Top5命中：${detail.top5Hit}/5`);
  console.log(`  联合命中：${detail.jointHit}/5`);
  console.log(`  Top5组合：[${detail.top5.join(', ')}]`);
  console.log(`  补漏6：[${detail.bulou6.join(', ')}]`);
});

console.log("\n" + "═".repeat(100));
