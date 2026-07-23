/**
 * 快速回测10期，验证新架构
 */
const fs = require('fs');
const path = require('path');

// 1. 加载 all_draws.js 数据
global.window = {};
require('./all_draws.js');
const RAW = window.ALL_DRAWS_DATA;
// 转为升序，并转换为 { issue, front, numbers } 格式（front 和 numbers 指向同一个数组）
const ALL_DRAWS = RAW.slice().reverse().map(d => ({ issue: d.issue, front: d.front, numbers: d.front }));
console.log(`数据源: all_draws.js | ${ALL_DRAWS.length}期 (${ALL_DRAWS[0].issue} ~ ${ALL_DRAWS[ALL_DRAWS.length-1].issue})`);

// 2. 加载 optimized_picker.js
let code = fs.readFileSync(path.join(__dirname, 'optimized_picker.js'), 'utf-8');
const cliStart = code.indexOf('\nconst args = process.argv.slice');
if (cliStart > 0) code = code.substring(0, cliStart);

// 替换内嵌 ALL_DRAWS 为 all_draws.js 的数据
const allDrawsStart = code.indexOf('const ALL_DRAWS = [');
const allDrawsEnd = code.indexOf('\n];', allDrawsStart) + 3;
if (allDrawsStart > 0 && allDrawsEnd > 3) {
  const newDataStr = 'const ALL_DRAWS = ' + JSON.stringify(ALL_DRAWS) + ';';
  code = code.substring(0, allDrawsStart) + newDataStr + code.substring(allDrawsEnd);
}

const wrappedCode = "(function() {\n  var module = { exports: {} };\n  var exports = module.exports;\n  " + code + "\n  return { predict, ALL_DRAWS };\n})()";
const picker = eval(wrappedCode);
const predict = picker.predict;

// 3. 回测10期
const total = ALL_DRAWS.length;
const N = 10;
const startIdx = 10;
console.log(`回测${N}期: ${ALL_DRAWS[startIdx].issue} -> ${ALL_DRAWS[startIdx+N-1].issue}\n`);

let comboCount = 0;
let comboHit2Plus = 0;
let periodHit1Plus = 0;
let periodHit2Plus = 0;
let periodHit3Plus = 0;
let maxHit3Plus = 0;
let totalMaxHit = 0;
let totalUnique = 0;
const maxHitDist = {0:0, 1:0, 2:0, 3:0, 4:0, 5:0};
const comboHitDist = {0:0, 1:0, 2:0, 3:0, 4:0, 5:0};
let comboHit3Plus = 0, comboHit4Plus = 0, comboHit5Plus = 0;

for (let i = startIdx; i < startIdx + N; i++) {
  const srcIssue = ALL_DRAWS[i-1].issue;
  const targetDraw = ALL_DRAWS[i];
  const targetNums = new Set(targetDraw.numbers);
  
  try {
    const result = predict(srcIssue, null, true);
    const combos = result.combinations;
    comboCount += combos.length;
    
    let periodMaxHit = 0;
    const periodHit2PlusCombos = new Set();
    const periodHit3PlusCombos = new Set();
    
    for (let ci = 0; ci < combos.length; ci++) {
      const combo = combos[ci];
      const hit = combo.numbers.filter(n => targetNums.has(n)).length;
      comboHitDist[hit] = (comboHitDist[hit] || 0) + 1;
      if (hit >= 2) {
        comboHit2Plus++;
        periodHit2PlusCombos.add(ci);
      }
      if (hit >= 3) {
        comboHit3Plus++;
        periodHit3PlusCombos.add(ci);
      }
      if (hit >= 4) comboHit4Plus++;
      if (hit >= 5) comboHit5Plus++;
      if (hit > periodMaxHit) periodMaxHit = hit;
    }
    
    maxHitDist[periodMaxHit] = (maxHitDist[periodMaxHit] || 0) + 1;
    if (periodMaxHit >= 3) maxHit3Plus++;
    totalMaxHit += periodMaxHit;
    
    // 计算去重号码数
    const uniqueNums = new Set();
    for (const combo of combos) {
      for (const n of combo.numbers) uniqueNums.add(n);
    }
    totalUnique += uniqueNums.size;
    
    if (periodHit2PlusCombos.size >= 1) periodHit1Plus++;
    if (periodHit2PlusCombos.size >= 2) periodHit2Plus++;
    if (periodHit3PlusCombos.size >= 1) periodHit3Plus++;
    
    // 输出每期详情
    const hitStr = combos.map((c, ci) => {
      const hit = c.numbers.filter(n => targetNums.has(n)).length;
      return `${hit}`;
    }).join(',');
    console.log(`${targetDraw.issue}: ${targetDraw.numbers.join(',')} | 命中: [${hitStr}] | maxHit=${periodMaxHit} | 去重=${uniqueNums.size}`);
    
  } catch(e) {
    console.error(`期号${srcIssue}预测错误:`, e.message);
    console.error(e.stack);
  }
}

console.log('\n=== 回测结果 ===');
console.log(`总组合数: ${comboCount}`);
console.log(`每注≥2命中率: ${(comboHit2Plus/comboCount*100).toFixed(1)}% (${comboHit2Plus}/${comboCount})`);
console.log(`每期≥1注≥2: ${(periodHit1Plus/N*100).toFixed(1)}% (${periodHit1Plus}/${N})`);
console.log(`每期≥2注≥2: ${(periodHit2Plus/N*100).toFixed(1)}% (${periodHit2Plus}/${N})`);
console.log(`每期≥3注≥2: ${(periodHit3Plus/N*100).toFixed(1)}% (${periodHit3Plus}/${N})`);
console.log(`平均每期最高命中: ${(totalMaxHit/N).toFixed(2)}`);
console.log(`平均去重号码数: ${(totalUnique/N).toFixed(1)}`);
console.log(`每期≥3注命中: ${(maxHit3Plus/N*100).toFixed(1)}% (${maxHit3Plus}/${N})`);
console.log(`\n命中分布:`, comboHitDist);
console.log(`最高命中分布:`, maxHitDist);
console.log(`单注≥3率: ${(comboHit3Plus/comboCount*100).toFixed(2)}% (${comboHit3Plus}/${comboCount})`);
console.log(`单注≥4率: ${(comboHit4Plus/comboCount*100).toFixed(2)}% (${comboHit4Plus}/${comboCount})`);
console.log(`单注≥5率: ${(comboHit5Plus/comboCount*100).toFixed(2)}% (${comboHit5Plus}/${comboCount})`);
console.log(`\n0命中期数: ${maxHitDist[0] || 0}`);
console.log(`1命中期数: ${maxHitDist[1] || 0}`);
console.log(`2命中期数: ${maxHitDist[2] || 0}`);
console.log(`3命中期数: ${maxHitDist[3] || 0}`);
console.log(`4命中期数: ${maxHitDist[4] || 0}`);
console.log(`5命中期数: ${maxHitDist[5] || 0}`);