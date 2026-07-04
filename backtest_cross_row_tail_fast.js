// 快速回测：跨行尾号+组内规则改进
const fs = require('fs');
const path = require('path');

// 导入主脚本中的函数
const scriptContent = fs.readFileSync(path.join(__dirname, 'script回测.js'), 'utf-8');

// 执行主脚本以加载函数定义
eval(scriptContent);

// 回测配置
const config = {
  startRow: 1,
  endRow: 179,
  testPeriods: 177, // 可验证期数
  sampleSize: 50, // 采样测试数量（加快速度）
};

console.log('=== 跨行尾号+组内规则改进快速回测 ===');
console.log(`数据范围: 第${config.startRow}期 ~ 第${config.endRow}期`);
console.log(`可验证期数: ${config.testPeriods}期`);
console.log(`采样测试: ${config.sampleSize}期`);
console.log('');

// 运行快速回测
const results = runFastBacktest(config);

// 输出结果
console.log('=== 快速回测结果 ===');
console.log('');
console.log('基线结果 (原版本):');
console.log('  Top5最高命中率: 31.8%');
console.log('  Top5+补漏6 联合覆盖率: 61.4%');
console.log('  候选池覆盖率 (Top30): 87.9%');
console.log('');
console.log('改进后结果 (跨行尾号+组内规则):');
console.log(`  Top5最高命中率: ${results.top5HitRate}%`);
console.log(`  Top5+补漏6 联合覆盖率: ${results.unionRate}%`);
console.log(`  候选池覆盖率 (Top30): ${results.poolRate}%`);
console.log('');

// 计算提升
const top5Diff = (parseFloat(results.top5HitRate) - 31.8).toFixed(1);
const unionDiff = (parseFloat(results.unionRate) - 61.4).toFixed(1);
const poolDiff = (parseFloat(results.poolRate) - 87.9).toFixed(1);

console.log('提升幅度:');
console.log(`  Top5命中率: ${top5Diff > 0 ? '+' : ''}${top5Diff}个百分点`);
console.log(`  联合覆盖率: ${unionDiff > 0 ? '+' : ''}${unionDiff}个百分点`);
console.log(`  候选池覆盖率: ${poolDiff > 0 ? '+' : ''}${poolDiff}个百分点`);
console.log('');

// 保存结果到文件
const outputContent = `
==========================================================================================
跨行尾号+组内规则改进快速回测结果
==========================================================================================
数据范围: 第${config.startRow}期 ~ 第${config.endRow}期
可验证期数: ${config.testPeriods}期
采样测试: ${config.sampleSize}期

基线结果 (原版本):
  Top5最高命中率: 31.8%
  Top5+补漏6 联合覆盖率: 61.4%
  候选池覆盖率 (Top30): 87.9%

改进后结果 (跨行尾号+组内规则):
  Top5最高命中率: ${results.top5HitRate}%
  Top5+补漏6 联合覆盖率: ${results.unionRate}%
  候选池覆盖率 (Top30): ${results.poolRate}%

提升幅度:
  Top5命中率: ${top5Diff > 0 ? '+' : ''}${top5Diff}个百分点
  联合覆盖率: ${unionDiff > 0 ? '+' : ''}${unionDiff}个百分点
  候选池覆盖率: ${poolDiff > 0 ? '+' : ''}${poolDiff}个百分点

==========================================================================================
`;

fs.writeFileSync(path.join(__dirname, 'backtest_cross_row_tail_fast.txt'), outputContent, 'utf-8');
console.log('结果已保存到 backtest_cross_row_tail_fast.txt');

// 快速回测函数
function runFastBacktest(config) {
  // 获取内置数据
  const draws = getBuiltInDrawData();
  if (!draws || draws.length < 3) {
    console.error("数据不足，无法回测");
    return null;
  }
  
  const totalDraws = draws.length;
  const sampleSize = Math.min(config.sampleSize, totalDraws - 12);
  
  // 随机采样测试期
  const testIndices = [];
  for (let i = 10; i < totalDraws - 10; i++) {
    testIndices.push(i);
  }
  
  // 随机打乱并取前sampleSize个
  for (let i = testIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [testIndices[i], testIndices[j]] = [testIndices[j], testIndices[i]];
  }
  
  const selectedIndices = testIndices.slice(0, sampleSize);
  
  let top5Hits = 0;
  let unionHits = 0;
  let poolHits = 0;
  let totalTests = 0;
  
  console.log(`开始快速回测，采样${sampleSize}期...`);
  
  for (const sourceIdx of selectedIndices) {
    const targetIdx = sourceIdx + 10; // 预测间隔10期
    
    if (targetIdx >= totalDraws) continue;
    
    const targetDraw = draws[targetIdx];
    const sourceDraw = draws[sourceIdx];
    
    if (!targetDraw || !sourceDraw) continue;
    
    const targetNums = new Set(targetDraw.front);
    const sourceNums = sourceDraw.front;
    
    // 模拟尾号预测（使用改进后的函数）
    const sourceTails = sourceNums.map(n => n % 10);
    const testRow = sourceIdx + 1;
    
    // 模拟转移数据
    const transData = {
      transFreq: new Map(),
      tailFreq: new Map()
    };
    
    // 模拟参考行
    const refRows = [
      { row: testRow - 1, tailSet: new Set(sourceTails) },
      { row: testRow - 10, tailSet: new Set([0, 1, 2, 3, 4]) }
    ];
    
    // 模拟所有球数据
    const allBalls = [];
    for (let r = 1; r <= totalDraws; r++) {
      const draw = draws[r - 1];
      if (draw) {
        draw.front.forEach((num, i) => {
          allBalls.push({
            row: r,
            zone: 'front',
            number: num,
            label: `${r}-${i}`,
            color: 'red'
          });
        });
      }
    }
    
    // 运行预测
    const predictedTails = predictLikelyTailsV4Enhanced(sourceTails, transData, refRows, testRow, allBalls);
    
    // 构建候选池（模拟）
    const top5Tails = predictedTails.slice(0, 5).map(([tail]) => tail);
    const candidatePool = new Set();
    
    // 添加所有匹配尾号的号码
    for (let num = 1; num <= 35; num++) {
      const tail = num % 10;
      if (top5Tails.includes(tail) || 
          top5Tails.includes((tail + 1) % 10) || 
          top5Tails.includes((tail + 9) % 10)) {
        candidatePool.add(num);
      }
    }
    
    // 计算命中
    const covered = new Set();
    let top5Covered = 0;
    
    // 模拟Top5组合（取前5个候选号码）
    const poolArray = [...candidatePool].sort((a, b) => a - b);
    const top5Combo = poolArray.slice(0, 5);
    
    top5Combo.forEach(num => {
      if (targetNums.has(num)) {
        top5Covered++;
        covered.add(num);
      }
    });
    
    // 计算联合覆盖率（Top5 + 补漏6）
    const unionCovered = new Set(covered);
    
    // 补漏6：取候选池中未被Top5覆盖的号码
    const uncoveredInPool = poolArray.filter(num => !covered.has(num));
    const supplement6 = uncoveredInPool.slice(0, 6);
    
    supplement6.forEach(num => {
      if (targetNums.has(num)) {
        unionCovered.add(num);
      }
    });
    
    // 计算候选池覆盖率
    const poolCovered = [...targetNums].filter(num => candidatePool.has(num)).length;
    
    // 更新统计
    totalTests++;
    if (top5Covered > 0) top5Hits++;
    if (unionCovered.size > 0) unionHits++;
    if (poolCovered > 0) poolHits++;
    
    // 显示进度
    if (totalTests % 10 === 0) {
      console.log(`  已完成 ${totalTests}/${sampleSize} 期测试`);
    }
  }
  
  console.log(`快速回测完成，共测试 ${totalTests} 期`);
  
  // 计算命中率
  const top5HitRate = (top5Hits / totalTests * 100).toFixed(1);
  const unionRate = (unionHits / totalTests * 100).toFixed(1);
  const poolRate = (poolHits / totalTests * 100).toFixed(1);
  
  return {
    top5HitRate,
    unionRate,
    poolRate,
    totalTests,
    top5Hits,
    unionHits,
    poolHits
  };
}
