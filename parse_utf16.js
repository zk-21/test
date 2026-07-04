const fs = require('fs');

// Read as UTF-16 LE
const buf = fs.readFileSync('backtest_cross_row_full.txt');
const text = buf.toString('utf16le');
const lines = text.split(/\r?\n/);
console.log('Total lines:', lines.length);

const results = [];
let period = 0;
let target = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Period - look for "第N期" pattern (garbled as "绗?N 鏈")
  // Actually let's find it by the source/target issue numbers
  const issueMatch = line.match(/婧愭湡:\s*(\d+)\s*.*?鐩?爣鏈?:\s*(\d+)/);
  if (issueMatch) {
    // Count periods sequentially
    period = results.length + 1;
  }
  
  // Target numbers - line with "鐩" and 5 numbers in brackets
  if (line.includes('鐩') && line.includes('鍙风爜')) {
    const targetMatch = line.match(/\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\]/);
    if (targetMatch) {
      target = `${targetMatch[1]} ${targetMatch[2]} ${targetMatch[3]} ${targetMatch[4]} ${targetMatch[5]}`;
    }
  }
  
  // Top5 hit line - contains Top1, Top5, and hit counts
  if (line.includes('Top1') && line.includes('Top5') && line.includes('Top2')) {
    const hits = [];
    const regex = /鍛戒腑\s*(\d+)/g;
    let match;
    while ((match = regex.exec(line)) !== null) {
      hits.push(parseInt(match[1]));
    }
    
    if (hits.length >= 6) {
      results.push({
        period,
        target,
        top1: hits[0],
        top2: hits[1],
        top3: hits[2],
        top4: hits[3],
        top5: hits[4],
        bulou: hits[5],
        top5Union: 0,
        top5BulouUnion: 0,
        poolCover: 0
      });
    }
  }
  
  // Top5 union coverage (without 补漏6)
  if (line.includes('Top5') && line.includes('鑱斿悎瑕嗙洊') && !line.includes('琛ユ紡6') && !line.includes('+')) {
    const unionMatch = line.match(/鑱斿悎瑕嗙洊:\s+(\d+)/);
    if (unionMatch && results.length > 0) {
      results[results.length - 1].top5Union = parseInt(unionMatch[1]);
    }
  }
  
  // Top5+补漏6 union coverage
  if (line.includes('琛ユ紡6') && line.includes('鑱斿悎瑕嗙洊')) {
    const bulouUnionMatch = line.match(/鑱斿悎瑕嗙洊:\s+(\d+)/);
    if (bulouUnionMatch && results.length > 0) {
      results[results.length - 1].top5BulouUnion = parseInt(bulouUnionMatch[1]);
    }
  }
  
  // Pool coverage - look for "瑕嗙洊: X / 5" near "鍊欓€夋睜" or "30"
  if (line.includes('瑕嗙洊') && line.includes('/ 5') && line.includes('鍙风爜')) {
    const poolMatch = line.match(/瑕嗙洊:\s*(\d+)\s*\/\s*5/);
    if (poolMatch && results.length > 0) {
      results[results.length - 1].poolCover = parseInt(poolMatch[1]);
    }
  }
}

console.log(`Parsed ${results.length} periods`);

if (results.length > 0) {
  // Write CSV
  const csvHeader = '期数,目标号码,Top1命中,Top2命中,Top3命中,Top4命中,Top5命中,补漏6命中,Top5联合覆盖,Top5+补漏6联合覆盖,候选池覆盖';
  const csvLines = [csvHeader];
  results.forEach(r => {
    csvLines.push(`${r.period},"${r.target}",${r.top1},${r.top2},${r.top3},${r.top4},${r.top5},${r.bulou},${r.top5Union},${r.top5BulouUnion},${r.poolCover}`);
  });
  fs.writeFileSync('per_period_detail.csv', csvLines.join('\n'), 'utf-8');
  console.log('Saved per_period_detail.csv');
  
  // Summary
  const n = results.length;
  const avg = (arr, key) => arr.reduce((s, r) => s + r[key], 0) / n;
  
  console.log(`\n========== 汇总统计 (${n}期) ==========`);
  console.log(`Top1 平均命中: ${avg(results, 'top1').toFixed(2)}`);
  console.log(`Top2 平均命中: ${avg(results, 'top2').toFixed(2)}`);
  console.log(`Top3 平均命中: ${avg(results, 'top3').toFixed(2)}`);
  console.log(`Top4 平均命中: ${avg(results, 'top4').toFixed(2)}`);
  console.log(`Top5 平均命中: ${avg(results, 'top5').toFixed(2)}`);
  console.log(`补漏6 平均命中: ${avg(results, 'bulou').toFixed(2)}`);
  console.log(`Top5 联合覆盖平均: ${avg(results, 'top5Union').toFixed(2)}`);
  console.log(`Top5+补漏6 联合覆盖平均: ${avg(results, 'top5BulouUnion').toFixed(2)}`);
  console.log(`候选池覆盖平均: ${avg(results, 'poolCover').toFixed(2)}`);
  
  // Per-period detail
  console.log('\n========== 全部期数详情 ==========');
  console.log('期数  | 目标号码        | T1 T2 T3 T4 T5 | 漏6 | T5联 | T5+漏联 | 池覆盖');
  console.log('-'.repeat(80));
  results.forEach(r => {
    const t = (r.target + '              ').substring(0, 14);
    console.log(`${String(r.period).padStart(4)}  | ${t} | ${r.top1}  ${r.top2}  ${r.top3}  ${r.top4}  ${r.top5}  |  ${r.bulou}  |   ${r.top5Union}  |    ${r.top5BulouUnion}    |   ${r.poolCover}`);
  });
}
