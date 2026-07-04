/**
 * 后区模式分析：重复、相邻、等差、桥接
 */

const fs = require('fs');
const path = require('path');

// 加载数据
const pickerContent = fs.readFileSync(path.join(__dirname, 'optimized_picker.js'), 'utf8');
const startMarker = 'const ALL_DRAWS = [';
const startIdx = pickerContent.indexOf(startMarker);
let bracketCount = 0, endIdx = -1;
for (let i = startIdx + startMarker.length - 1; i < pickerContent.length; i++) {
  if (pickerContent[i] === '[') bracketCount++;
  else if (pickerContent[i] === ']') { bracketCount--; if (bracketCount === 0) { endIdx = i + 1; break; } }
}
const ALL_DRAWS = new Function(`return ${pickerContent.substring(startIdx, endIdx).replace('const ALL_DRAWS = ', '')}`)();

console.log(`加载 ${ALL_DRAWS.length} 期数据\n`);

// ==================== 1. 重复模式 ====================
console.log('═'.repeat(60));
console.log('  1. 重复模式：连续期出现相同号码');
console.log('═'.repeat(60));

let repeatStats = { 0: 0, 1: 0, 2: 0 };
for (let i = 1; i < ALL_DRAWS.length; i++) {
  const prev = ALL_DRAWS[i-1].back;
  const curr = ALL_DRAWS[i].back;
  if (!prev || !curr) continue;
  const overlap = curr.filter(b => prev.includes(b)).length;
  repeatStats[overlap]++;
}
const total = repeatStats[0] + repeatStats[1] + repeatStats[2];
console.log(`  重复0球: ${repeatStats[0]}次 (${(repeatStats[0]/total*100).toFixed(1)}%)`);
console.log(`  重复1球: ${repeatStats[1]}次 (${(repeatStats[1]/total*100).toFixed(1)}%)`);
console.log(`  重复2球: ${repeatStats[2]}次 (${(repeatStats[2]/total*100).toFixed(1)}%)`);
console.log(`  重复≥1球: ${repeatStats[1]+repeatStats[2]}次 (${((repeatStats[1]+repeatStats[2])/total*100).toFixed(1)}%)`);
console.log(`  理论随机: 重复1球 ${(2*10/66*100).toFixed(1)}%, 重复2球 ${(1/66*100).toFixed(1)}%`);

// ==================== 2. 相邻模式 ====================
console.log('\n' + '═'.repeat(60));
console.log('  2. 相邻模式：连续期出现相邻号码（±1）');
console.log('═'.repeat(60));

let neighborStats = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
for (let i = 1; i < ALL_DRAWS.length; i++) {
  const prev = ALL_DRAWS[i-1].back;
  const curr = ALL_DRAWS[i].back;
  if (!prev || !curr) continue;
  let count = 0;
  curr.forEach(c => {
    prev.forEach(p => {
      if (Math.abs(c - p) === 1) count++;
    });
  });
  neighborStats[Math.min(count, 4)]++;
}
const nTotal = Object.values(neighborStats).reduce((a, b) => a + b, 0);
for (let k = 0; k <= 4; k++) {
  console.log(`  相邻${k}对: ${neighborStats[k]}次 (${(neighborStats[k]/nTotal*100).toFixed(1)}%)`);
}
console.log(`  相邻≥1对: ${nTotal - neighborStats[0]}次 (${((nTotal - neighborStats[0])/nTotal*100).toFixed(1)}%)`);

// ==================== 3. 等差模式 ====================
console.log('\n' + '═'.repeat(60));
console.log('  3. 等差模式：后区两球形成等差数列');
console.log('═'.repeat(60));

// 同期两球等差
let sameDrawAP = 0;
ALL_DRAWS.forEach(d => {
  if (d.back && d.back.length >= 2) {
    // 两球差值即为公差
    sameDrawAP++;
  }
});
console.log(`  同期两球总是等差（公差=差值）: ${sameDrawAP}次`);

// 连续期等差：前一期两球 + 当期某球形成等差
let crossDrawAP = 0;
for (let i = 1; i < ALL_DRAWS.length; i++) {
  const prev = ALL_DRAWS[i-1].back;
  const curr = ALL_DRAWS[i].back;
  if (!prev || !curr || prev.length < 2) continue;
  
  // 检查当前期是否有号码与前一期形成等差
  curr.forEach(c => {
    // 与前一期两球的关系
    if (prev[0] && prev[1]) {
      const diff1 = c - prev[0];
      const diff2 = c - prev[1];
      // 等差条件：c - prev[0] == prev[0] - prev[1] 或 c - prev[1] == prev[1] - prev[0]
      if (diff1 === prev[0] - prev[1] || diff2 === prev[1] - prev[0]) {
        crossDrawAP++;
      }
    }
  });
}
console.log(`  跨期等差（当前球与前一期形成等差）: ${crossDrawAP}次`);
console.log(`  理论随机: 约${(ALL_DRAWS.length * 2 * 2 / 12).toFixed(0)}次`);

// ==================== 4. 桥接模式 ====================
console.log('\n' + '═'.repeat(60));
console.log('  4. 桥接模式：前一期号码的相邻/等差延伸');
console.log('═'.repeat(60));

// 桥接：当前期号码 = 前一期号码 ± k（k=1,2,3）
let bridgeStats = { 1: 0, 2: 0, 3: 0 };
for (let i = 1; i < ALL_DRAWS.length; i++) {
  const prev = ALL_DRAWS[i-1].back;
  const curr = ALL_DRAWS[i].back;
  if (!prev || !curr) continue;
  
  curr.forEach(c => {
    prev.forEach(p => {
      const dist = Math.abs(c - p);
      if (dist >= 1 && dist <= 3) {
        bridgeStats[dist]++;
      }
    });
  });
}
console.log(`  ±1桥接: ${bridgeStats[1]}次`);
console.log(`  ±2桥接: ${bridgeStats[2]}次`);
console.log(`  ±3桥接: ${bridgeStats[3]}次`);
console.log(`  理论随机: ±1约${(ALL_DRAWS.length * 2 * 2 / 12).toFixed(0)}次, ±2约${(ALL_DRAWS.length * 2 * 2 / 12).toFixed(0)}次, ±3约${(ALL_DRAWS.length * 2 * 2 / 12).toFixed(0)}次`);

// ==================== 5. 综合分析：哪些模式最可靠 ====================
console.log('\n' + '═'.repeat(60));
console.log('  5. 综合分析：各模式命中率统计');
console.log('═'.repeat(60));

// 测试：如果利用重复模式选号，命中率如何？
let repeatHit = 0, repeatTotal = 0;
for (let i = 1; i < ALL_DRAWS.length; i++) {
  const prev = ALL_DRAWS[i-1].back;
  const curr = ALL_DRAWS[i].back;
  if (!prev || !curr) continue;
  repeatTotal++;
  // 如果前一期有重复号码，预测下一期也会重复
  const overlap = curr.filter(b => prev.includes(b));
  if (overlap.length > 0) repeatHit++;
}
console.log(`  重复模式命中率: ${repeatHit}/${repeatTotal} = ${(repeatHit/repeatTotal*100).toFixed(1)}%`);

// 测试：如果利用桥接模式选号（±1），命中率如何？
let bridgeHit = 0, bridgeTotal = 0;
for (let i = 1; i < ALL_DRAWS.length; i++) {
  const prev = ALL_DRAWS[i-1].back;
  const curr = ALL_DRAWS[i].back;
  if (!prev || !curr) continue;
  bridgeTotal++;
  // 检查是否有±1桥接
  let hasBridge = false;
  curr.forEach(c => {
    prev.forEach(p => {
      if (Math.abs(c - p) === 1) hasBridge = true;
    });
  });
  if (hasBridge) bridgeHit++;
}
console.log(`  ±1桥接命中率: ${bridgeHit}/${bridgeTotal} = ${(bridgeHit/bridgeTotal*100).toFixed(1)}%`);

// 测试：如果利用等差模式选号，命中率如何？
let apHit = 0, apTotal = 0;
for (let i = 1; i < ALL_DRAWS.length; i++) {
  const prev = ALL_DRAWS[i-1].back;
  const curr = ALL_DRAWS[i].back;
  if (!prev || !curr || prev.length < 2) continue;
  apTotal++;
  let hasAP = false;
  curr.forEach(c => {
    if (prev[0] && prev[1]) {
      const diff1 = c - prev[0];
      const diff2 = c - prev[1];
      if (diff1 === prev[0] - prev[1] || diff2 === prev[1] - prev[0]) {
        hasAP = true;
      }
    }
  });
  if (hasAP) apHit++;
}
console.log(`  等差模式命中率: ${apHit}/${apTotal} = ${(apHit/apTotal*100).toFixed(1)}%`);

// ==================== 6. 预测应用：基于模式选2球 ====================
console.log('\n' + '═'.repeat(60));
console.log('  6. 基于模式的直接选2球预测');
console.log('═'.repeat(60));

// 策略：选前一期号码的±1桥接 + 遗漏最高的号码
let modeHit2 = 0, modeHit1 = 0, modeHit0 = 0;
for (let i = 10; i < ALL_DRAWS.length; i++) {
  const prev = ALL_DRAWS[i-1].back;
  const curr = ALL_DRAWS[i].back;
  if (!prev || !curr) continue;
  
  // 计算遗漏
  const gap = new Array(13).fill(0);
  for (let n = 1; n <= 12; n++) {
    let g = 0;
    for (let j = i-1; j >= 0; j--) {
      if (ALL_DRAWS[j].back && ALL_DRAWS[j].back.includes(n)) break;
      g++;
    }
    gap[n] = g;
  }
  
  // 候选池：前一期号码的±1桥接 + 遗漏最高的号码
  const candidates = new Set();
  
  // 桥接候选
  prev.forEach(p => {
    if (p - 1 >= 1) candidates.add(p - 1);
    if (p + 1 <= 12) candidates.add(p + 1);
  });
  
  // 遗漏最高的号码
  const byGap = [...Array(12).keys()].map(n => n + 1).sort((a, b) => gap[b] - gap[a]);
  candidates.add(byGap[0]);
  candidates.add(byGap[1]);
  
  // 从候选池中选2个（优先选遗漏最高的）
  const candidateArr = [...candidates].sort((a, b) => gap[b] - gap[a]);
  const predicted = candidateArr.slice(0, 2);
  
  const hits = predicted.filter(p => curr.includes(p)).length;
  if (hits === 2) modeHit2++;
  else if (hits === 1) modeHit1++;
  else modeHit0++;
}

const modeTotal = modeHit2 + modeHit1 + modeHit0;
console.log(`  桥接+遗漏Top2:`);
console.log(`    命中2球: ${modeHit2}次 (${(modeHit2/modeTotal*100).toFixed(1)}%)`);
console.log(`    命中1球: ${modeHit1}次 (${(modeHit1/modeTotal*100).toFixed(1)}%)`);
console.log(`    命中0球: ${modeHit0}次 (${(modeHit0/modeTotal*100).toFixed(1)}%)`);
console.log(`    ≥1球: ${modeHit1+modeHit2}次 (${((modeHit1+modeHit2)/modeTotal*100).toFixed(1)}%)`);
