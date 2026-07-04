// 分析区间比变化趋势与尾号、重复、相邻、等差、和值、跨度的关系
const fs = require('fs');
const path = require('path');

// 加载数据
const rawJs = fs.readFileSync(path.join(__dirname, 'all_draws.js'), 'utf8');
const match = rawJs.match(/window\.ALL_DRAWS_DATA\s*=\s*(\[[\s\S]*?\]);/);
if (!match) { console.error('无法解析 all_draws.js'); process.exit(1); }
const ALL_DRAWS_DATA = eval(match[1]);
// 按时间顺序排列（从旧到新）
const DRAWS = [...ALL_DRAWS_DATA].reverse();
console.log(`总期数: ${DRAWS.length}`);

// 工具函数
function gi(n) { return n <= 12 ? 0 : n <= 24 ? 1 : 2; }
function iv(nums) { const r = [0,0,0]; nums.forEach(n => r[gi(n)]++); return r; }
function ivDist(a, b) { return Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]); }
function sum(nums) { return nums.reduce((a,b) => a+b, 0); }
function span(nums) { return nums[nums.length-1] - nums[0]; }

// 尾号：上一期尾号集合在下一期出现的个数
function tailRepeat(srcNums, tgtNums) {
  const srcTails = new Set(srcNums.map(n => n % 10));
  const tgtTails = new Set(tgtNums.map(n => n % 10));
  let count = 0;
  srcTails.forEach(t => { if (tgtTails.has(t)) count++; });
  return count;
}

// 重复号码个数
function repeatCount(srcNums, tgtNums) {
  const srcSet = new Set(srcNums);
  return tgtNums.filter(n => srcSet.has(n)).length;
}

// 相邻号码个数（上一期号码的±1在下一期出现）
function neighborCount(srcNums, tgtNums) {
  const srcSet = new Set(srcNums);
  let count = 0;
  tgtNums.forEach(n => {
    if (srcSet.has(n-1) || srcSet.has(n+1)) count++;
  });
  return count;
}

// 等差数列检测（尾号等差，步长为1或2或3等）
function hasArithmeticProgression(tails) {
  if (tails.length < 3) return false;
  // 检查所有可能的三元组
  for (let i = 0; i < tails.length-2; i++) {
    for (let j = i+1; j < tails.length-1; j++) {
      for (let k = j+1; k < tails.length; k++) {
        const a = tails[i], b = tails[j], c = tails[k];
        if ((b - a) === (c - b)) return true;
      }
    }
  }
  return false;
}

// 分析相邻期之间的变化
const results = [];
for (let i = 0; i < DRAWS.length - 1; i++) {
  const src = DRAWS[i];
  const tgt = DRAWS[i+1];
  const srcNums = [...src.front].sort((a,b) => a-b);
  const tgtNums = [...tgt.front].sort((a,b) => a-b);
  
  const srcIv = iv(srcNums);
  const tgtIv = iv(tgtNums);
  const dist = ivDist(srcIv, tgtIv);
  
  // 计算指标
  const tailRep = tailRepeat(srcNums, tgtNums);
  const repCnt = repeatCount(srcNums, tgtNums);
  const neighbor = neighborCount(srcNums, tgtNums);
  const tgtTails = tgtNums.map(n => n % 10).sort((a,b) => a-b);
  const hasArith = hasArithmeticProgression(tgtTails);
  const tgtSum = sum(tgtNums);
  const tgtSpan = span(tgtNums);
  
  results.push({
    srcIssue: src.issue,
    tgtIssue: tgt.issue,
    srcIv,
    tgtIv,
    dist,
    tailRep,
    repCnt,
    neighbor,
    hasArith,
    tgtSum,
    tgtSpan
  });
}

// 分类：根据dist分类
// 定义阈值：dist=0为不变，dist>=4为大变化，1-3为小变化
const categories = {
  '不变(dist=0)': [],
  '小变化(1-3)': [],
  '大变化(≥4)': []
};

results.forEach(r => {
  if (r.dist === 0) categories['不变(dist=0)'].push(r);
  else if (r.dist <= 3) categories['小变化(1-3)'].push(r);
  else categories['大变化(≥4)'].push(r);
});

// 输出统计
console.log('\n=== 区间比变化分类统计 ===');
Object.entries(categories).forEach(([cat, data]) => {
  console.log(`\n${cat}: ${data.length}次 (${(data.length/results.length*100).toFixed(1)}%)`);
  
  // 计算平均值
  const avg = (arr) => arr.reduce((a,b) => a+b, 0) / arr.length;
  
  if (data.length > 0) {
    const tailReps = data.map(r => r.tailRep);
    const repCnts = data.map(r => r.repCnt);
    const neighbors = data.map(r => r.neighbor);
    const sums = data.map(r => r.tgtSum);
    const spans = data.map(r => r.tgtSpan);
    const arithCount = data.filter(r => r.hasArith).length;
    
    console.log(`  尾号重复: 平均${avg(tailReps).toFixed(2)}个`);
    console.log(`  重复号码: 平均${avg(repCnts).toFixed(2)}个`);
    console.log(`  相邻号码: 平均${avg(neighbors).toFixed(2)}个`);
    console.log(`  等差数列: ${arithCount}次 (${(arithCount/data.length*100).toFixed(1)}%)`);
    console.log(`  和值: 平均${avg(sums).toFixed(1)}`);
    console.log(`  跨度: 平均${avg(spans).toFixed(1)}`);
    
    // 尾号重复分布
    console.log(`  尾号重复分布:`);
    const tailDist = {};
    tailReps.forEach(t => tailDist[t] = (tailDist[t] || 0) + 1);
    Object.entries(tailDist).sort((a,b) => a[0]-b[0]).forEach(([k,v]) => {
      console.log(`    ${k}个: ${v}次 (${(v/data.length*100).toFixed(1)}%)`);
    });
    
    // 重复号码分布
    console.log(`  重复号码分布:`);
    const repDist = {};
    repCnts.forEach(r => repDist[r] = (repDist[r] || 0) + 1);
    Object.entries(repDist).sort((a,b) => a[0]-b[0]).forEach(([k,v]) => {
      console.log(`    ${k}个: ${v}次 (${(v/data.length*100).toFixed(1)}%)`);
    });
  }
});

// 输出一些具体案例
console.log('\n=== 最近5次大变化案例 ===');
const recentBig = categories['大变化(≥4)'].slice(-5);
recentBig.forEach(r => {
  console.log(`${r.srcIssue}→${r.tgtIssue}: ${r.srcIv.join(':')}→${r.tgtIv.join(':')} dist=${r.dist}`);
  console.log(`  尾号重复:${r.tailRep} 重复:${r.repCnt} 相邻:${r.neighbor} 等差:${r.hasArith} 和值:${r.tgtSum} 跨度:${r.tgtSpan}`);
});

console.log('\n=== 最近5次不变案例 ===');
const recentSame = categories['不变(dist=0)'].slice(-5);
recentSame.forEach(r => {
  console.log(`${r.srcIssue}→${r.tgtIssue}: ${r.srcIv.join(':')}→${r.tgtIv.join(':')} dist=${r.dist}`);
  console.log(`  尾号重复:${r.tailRep} 重复:${r.repCnt} 相邻:${r.neighbor} 等差:${r.hasArith} 和值:${r.tgtSum} 跨度:${r.tgtSpan}`);
});