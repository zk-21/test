// all_draws.js 回测统计脚本
// 统计：1. 每期预测尾号命中个数 2. top5补漏6每注命中个数 3. 球命中3,4,5个的个数

const fs = require('fs');

// 读取all_draws.js数据（手动解析window.ALL_DRAWS_DATA格式）
const drawsContent = fs.readFileSync('./all_draws.js', 'utf8');
// 提取数组部分并用eval解析（JS对象字面量不是合法JSON）
const arrayMatch = drawsContent.match(/\[[\s\S]*\]/);
if (!arrayMatch) {
  console.error('无法解析all_draws.js文件');
  process.exit(1);
}
// 将window.X = [...] 转为纯数组
const arrayStr = arrayMatch[0];
// eslint-disable-next-line no-eval
const draws = eval(arrayStr);

console.log(`数据范围: ${draws[0]?.issue} ~ ${draws[draws.length-1]?.issue}`);
console.log(`总期数: ${draws.length}`);

// 尾号预测函数（简化版，基于script回测.js的逻辑）
function predictTailsForDraw(currentDraw, previousDraws, lookback = 10) {
  if (!previousDraws || previousDraws.length < 2) {
    return [0, 1, 2, 3, 4]; // 默认预测
  }
  
  // 获取前一期的尾号
  const prevDraw = previousDraws[previousDraws.length - 1];
  const prevTails = prevDraw.front.map(n => n % 10);
  const uniquePrevTails = [...new Set(prevTails)];
  
  // 简化预测逻辑：基于前一期尾号和历史频率
  const tailScores = new Map();
  for (let t = 0; t <= 9; t++) tailScores.set(t, 0);
  
  // 1. 前一期尾号及相邻尾号（最高权重）
  uniquePrevTails.forEach(t => {
    tailScores.set(t, tailScores.get(t) + 15); // 相同尾号
    tailScores.set((t + 1) % 10, tailScores.get((t + 1) % 10) + 8); // 相邻+1
    tailScores.set((t + 9) % 10, tailScores.get((t + 9) % 10) + 8); // 相邻-1
  });
  
  // 2. 全局频率统计（最近50期）
  const globalTailFreq = new Map();
  for (let t = 0; t <= 9; t++) globalTailFreq.set(t, 0);
  
  const start = Math.max(0, previousDraws.length - 50);
  for (let i = start; i < previousDraws.length; i++) {
    const draw = previousDraws[i];
    draw.front.forEach(n => {
      const tail = n % 10;
      globalTailFreq.set(tail, globalTailFreq.get(tail) + 1);
    });
  }
  
  const maxFreq = Math.max(1, ...globalTailFreq.values());
  globalTailFreq.forEach((count, tail) => {
    tailScores.set(tail, tailScores.get(tail) + (count / maxFreq) * 10);
  });
  
  // 3. 等差延伸规律
  if (uniquePrevTails.length >= 2) {
    for (let i = 0; i < uniquePrevTails.length; i++) {
      for (let j = i + 1; j < uniquePrevTails.length; j++) {
        const a = uniquePrevTails[i];
        const b = uniquePrevTails[j];
        const diff = Math.abs(b - a);
        
        if (diff === 2) { // 公差2的等差对
          const mid = (a + b) / 2;
          if (Number.isInteger(mid)) {
            tailScores.set(mid, tailScores.get(mid) + 3); // 延伸点
            tailScores.set((mid + 1) % 10, tailScores.get((mid + 1) % 10) + 5); // 邻号+1
            tailScores.set((mid + 9) % 10, tailScores.get((mid + 9) % 10) + 5); // 邻号-1
          }
        }
      }
    }
  }
  
  // 4. 奇偶平衡调整
  const sortedScores = [...tailScores.entries()].sort((a, b) => b[1] - a[1]);
  let top5Tails = sortedScores.slice(0, 5).map(([tail]) => tail);
  
  // 确保至少2个偶数尾号
  const evenTails = [0, 2, 4, 6, 8];
  const oddTails = [1, 3, 5, 7, 9];
  
  let evenCount = top5Tails.filter(t => evenTails.includes(t)).length;
  let oddCount = top5Tails.filter(t => oddTails.includes(t)).length;
  
  // 如果偶数不足2个，提升偶数尾号分数
  if (evenCount < 2) {
    const lowestOdd = top5Tails.filter(t => oddTails.includes(t)).reduce((lowest, tail) => {
      return tailScores.get(tail) < tailScores.get(lowest) ? tail : lowest;
    });
    
    const bestEven = evenTails.filter(t => !top5Tails.includes(t)).reduce((best, tail) => {
      return tailScores.get(tail) > tailScores.get(best) ? tail : best;
    });
    
    const boost = tailScores.get(lowestOdd) - tailScores.get(bestEven) + 10;
    tailScores.set(bestEven, tailScores.get(bestEven) + boost);
    
    // 重新排序
    const newSorted = [...tailScores.entries()].sort((a, b) => b[1] - a[1]);
    top5Tails = newSorted.slice(0, 5).map(([tail]) => tail);
  }
  
  // 补漏第6个尾号（选择分数最高但不在Top5中的尾号）
  const candidateTails = [...tailScores.entries()]
    .filter(([tail]) => !top5Tails.includes(tail))
    .sort((a, b) => b[1] - a[1]);
  
  const top6Tails = [...top5Tails, candidateTails[0]?.[0] ?? 0];
  
  return { top5: top5Tails, top6: top6Tails };
}

// 回测统计
function runBacktest() {
  const results = [];
  
  // 统计指标
  let totalTailHits = 0; // 总命中尾号数
  let totalPredictions = 0; // 总预测尾号数
  
  // Top5命中统计
  let top5HitCounts = [0, 0, 0, 0, 0, 0]; // 命中0,1,2,3,4,5个的期数
  
  // Top6命中统计
  let top6HitCounts = [0, 0, 0, 0, 0, 0, 0]; // 命中0,1,2,3,4,5,6个的期数
  
  // 球命中统计
  let ballHitCounts = [0, 0, 0, 0, 0, 0]; // 命中0,1,2,3,4,5个球的期数
  
  // 每期详细结果
  const periodDetails = [];
  
  // 从第11期开始（需要前10期作为参考）
  for (let i = 10; i < draws.length; i++) {
    const currentDraw = draws[i];
    const previousDraws = draws.slice(0, i);
    
    // 获取当前期实际尾号
    const actualTails = currentDraw.front.map(n => n % 10);
    const uniqueActualTails = [...new Set(actualTails)];
    
    // 预测尾号
    const predicted = predictTailsForDraw(currentDraw, previousDraws);
    
    // 计算命中
    const top5Hits = predicted.top5.filter(t => uniqueActualTails.includes(t));
    const top6Hits = predicted.top6.filter(t => uniqueActualTails.includes(t));
    
    // 球命中（前区5个球）
    const ballHits = currentDraw.front.filter(n => {
      const tail = n % 10;
      return predicted.top5.includes(tail);
    });
    
    // 统计
    top5HitCounts[top5Hits.length]++;
    top6HitCounts[top6Hits.length]++;
    ballHitCounts[ballHits.length]++;
    
    totalTailHits += top5Hits.length;
    totalPredictions += 5; // 每次预测5个尾号
    
    // 记录详细结果
    periodDetails.push({
      issue: currentDraw.issue,
      actualTails: uniqueActualTails,
      predictedTop5: predicted.top5,
      predictedTop6: predicted.top6,
      top5Hits: top5Hits,
      top6Hits: top6Hits,
      ballHits: ballHits,
      top5HitCount: top5Hits.length,
      top6HitCount: top6Hits.length,
      ballHitCount: ballHits.length
    });
  }
  
  // 计算统计指标
  const totalPeriods = draws.length - 10;
  const tailHitRate = totalTailHits / totalPredictions;
  
  // 计算平均命中数
  const avgTop5Hits = periodDetails.reduce((sum, p) => sum + p.top5HitCount, 0) / totalPeriods;
  const avgTop6Hits = periodDetails.reduce((sum, p) => sum + p.top6HitCount, 0) / totalPeriods;
  const avgBallHits = periodDetails.reduce((sum, p) => sum + p.ballHitCount, 0) / totalPeriods;
  
  // 输出结果
  console.log('\n=== 回测统计结果 ===');
  console.log(`回测期数: ${totalPeriods}`);
  console.log(`尾号命中率: ${(tailHitRate * 100).toFixed(2)}%`);
  console.log(`平均Top5命中数: ${avgTop5Hits.toFixed(2)}`);
  console.log(`平均Top6命中数: ${avgTop6Hits.toFixed(2)}`);
  console.log(`平均球命中数: ${avgBallHits.toFixed(2)}`);
  
  console.log('\n=== Top5命中分布 ===');
  for (let i = 0; i <= 5; i++) {
    const count = top5HitCounts[i];
    const percent = (count / totalPeriods * 100).toFixed(2);
    console.log(`命中${i}个: ${count}期 (${percent}%)`);
  }
  
  console.log('\n=== Top6命中分布 ===');
  for (let i = 0; i <= 6; i++) {
    const count = top6HitCounts[i];
    const percent = (count / totalPeriods * 100).toFixed(2);
    console.log(`命中${i}个: ${count}期 (${percent}%)`);
  }
  
  console.log('\n=== 球命中分布 ===');
  for (let i = 0; i <= 5; i++) {
    const count = ballHitCounts[i];
    const percent = (count / totalPeriods * 100).toFixed(2);
    console.log(`命中${i}个球: ${count}期 (${percent}%)`);
  }
  
  // 保存详细结果到文件
  const output = {
    summary: {
      totalPeriods,
      tailHitRate,
      avgTop5Hits,
      avgTop6Hits,
      avgBallHits,
      top5HitCounts,
      top6HitCounts,
      ballHitCounts
    },
    details: periodDetails
  };
  
  fs.writeFileSync('backtest_all_draws_result.json', JSON.stringify(output, null, 2), 'utf8');
  console.log('\n详细结果已保存到 backtest_all_draws_result.json');
  
  // 生成文本报告
  let report = `all_draws.js 回测统计报告\n`;
  report += `生成时间: ${new Date().toLocaleString()}\n\n`;
  report += `=== 统计摘要 ===\n`;
  report += `回测期数: ${totalPeriods}\n`;
  report += `数据范围: ${draws[10]?.issue} ~ ${draws[draws.length-1]?.issue}\n`;
  report += `尾号命中率: ${(tailHitRate * 100).toFixed(2)}%\n`;
  report += `平均Top5命中数: ${avgTop5Hits.toFixed(2)}\n`;
  report += `平均Top6命中数: ${avgTop6Hits.toFixed(2)}\n`;
  report += `平均球命中数: ${avgBallHits.toFixed(2)}\n\n`;
  
  report += `=== Top5命中分布 ===\n`;
  for (let i = 0; i <= 5; i++) {
    const count = top5HitCounts[i];
    const percent = (count / totalPeriods * 100).toFixed(2);
    report += `命中${i}个: ${count}期 (${percent}%)\n`;
  }
  
  report += `\n=== Top6命中分布 ===\n`;
  for (let i = 0; i <= 6; i++) {
    const count = top6HitCounts[i];
    const percent = (count / totalPeriods * 100).toFixed(2);
    report += `命中${i}个: ${count}期 (${percent}%)\n`;
  }
  
  report += `\n=== 球命中分布 ===\n`;
  for (let i = 0; i <= 5; i++) {
    const count = ballHitCounts[i];
    const percent = (count / totalPeriods * 100).toFixed(2);
    report += `命中${i}个球: ${count}期 (${percent}%)\n`;
  }
  
  report += `\n=== 每期详细结果 ===\n`;
  periodDetails.forEach(p => {
    report += `${p.issue}: 实际尾号[${p.actualTails.join(',')}] `;
    report += `Top5[${p.predictedTop5.join(',')}] `;
    report += `命中${p.top5HitCount}个 `;
    report += `球命中${p.ballHitCount}个\n`;
  });
  
  fs.writeFileSync('backtest_all_draws_report.txt', report, 'utf8');
  console.log('文本报告已保存到 backtest_all_draws_report.txt');
  
  return output;
}

// 运行回测
runBacktest();