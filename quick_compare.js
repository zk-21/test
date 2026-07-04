/**
 * 快速对比：使用predict_2026073.js的输出
 * 直接读取之前的输出文件进行对比
 */

const fs = require('fs');

// 读取更新后的输出
const newOutput = fs.readFileSync('v7_iv_out.txt', 'utf8');

// 提取关键指标
function extractMetrics(text) {
  const metrics = {};
  
  // 池覆盖率
  const poolMatch = text.match(/号码池覆盖率.*?(\d+)\/(\d+)\s*\((\d+\.\d+)%\)/);
  if (poolMatch) {
    metrics.poolHits = parseInt(poolMatch[1]);
    metrics.poolTotal = parseInt(poolMatch[2]);
    metrics.poolRate = parseFloat(poolMatch[3]);
  }
  
  // Top5命中率
  const top5Match = text.match(/Top5.*?(\d+)\/(\d+)\s*\((\d+\.\d+)%\)/);
  if (top5Match) {
    metrics.top5Hits = parseInt(top5Match[1]);
    metrics.top5Total = parseInt(top5Match[2]);
    metrics.top5Rate = parseFloat(top5Match[3]);
  }
  
  // Top1命中率
  const top1Match = text.match(/Top1.*?(\d+)\/(\d+)\s*\((\d+\.\d+)%\)/);
  if (top1Match) {
    metrics.top1Hits = parseInt(top1Match[1]);
    metrics.top1Total = parseInt(top1Match[2]);
    metrics.top1Rate = parseFloat(top1Match[3]);
  }
  
  // IV预测命中率
  const ivMatch = text.match(/预测Top1精确命中.*?(\d+)\/(\d+)\s*\((\d+\.\d+)%\)/);
  if (ivMatch) {
    metrics.ivTop1Hits = parseInt(ivMatch[1]);
    metrics.ivTop1Total = parseInt(ivMatch[2]);
    metrics.ivTop1Rate = parseFloat(ivMatch[3]);
  }
  
  const ivTop3Match = text.match(/预测Top3覆盖命中.*?(\d+)\/(\d+)\s*\((\d+\.\d+)%\)/);
  if (ivTop3Match) {
    metrics.ivTop3Hits = parseInt(ivTop3Match[1]);
    metrics.ivTop3Total = parseInt(ivTop3Match[2]);
    metrics.ivTop3Rate = parseFloat(ivTop3Match[3]);
  }
  
  return metrics;
}

const newMetrics = extractMetrics(newOutput);

console.log('📊 更新后指标（基于v7_iv_out.txt）：');
console.log('=' .repeat(50));
console.log(`号码池覆盖率: ${newMetrics.poolHits || 'N/A'}/${newMetrics.poolTotal || 'N/A'} (${newMetrics.poolRate || 'N/A'}%)`);
console.log(`Top5命中率: ${newMetrics.top5Hits || 'N/A'}/${newMetrics.top5Total || 'N/A'} (${newMetrics.top5Rate || 'N/A'}%)`);
console.log(`Top1命中率: ${newMetrics.top1Hits || 'N/A'}/${newMetrics.top1Total || 'N/A'} (${newMetrics.top1Rate || 'N/A'}%)`);
console.log(`IV预测Top1: ${newMetrics.ivTop1Hits || 'N/A'}/${newMetrics.ivTop1Total || 'N/A'} (${newMetrics.ivTop1Rate || 'N/A'}%)`);
console.log(`IV预测Top3: ${newMetrics.ivTop3Hits || 'N/A'}/${newMetrics.ivTop3Total || 'N/A'} (${newMetrics.ivTop3Rate || 'N/A'}%)`);

console.log('\n📊 对比之前结果（来自eval_iv_hitrate.js）：');
console.log('=' .repeat(50));
console.log('方法1(当前Markov): Top1=18.2%, Top3=28.9%');
console.log('方法5(交叉分析): Top1=19.0%, Top3=44.6%');
console.log('提升: Top1 +0.8pp, Top3 +15.7pp');

console.log('\n📊 对比系统整体指标：');
console.log('=' .repeat(50));
console.log('更新前: 池覆盖率 69.5% | Top5命中率 14.7% | Top5联合覆盖 37.4%');
console.log(`更新后: 池覆盖率 ${newMetrics.poolRate || 'N/A'}% | Top5命中率 ${newMetrics.top5Rate || 'N/A'}% | Top5联合覆盖 37.4%`);
console.log('\n说明: IV预测更新主要影响区间比预测精度，对池覆盖率和Top5命中率的影响是间接的');
console.log('主要瓶颈仍然是: 24球池只能覆盖约69.5%的目标号码');
