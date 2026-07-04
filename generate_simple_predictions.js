/**
 * 简化版预测生成：基于频率和遗漏生成前区top5组合和补漏6号码
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
console.log(`加载 ${ALL_DRAWS.length} 期数据`);

// 为每一期生成预测
const predictions = [];
for (let i = 10; i < ALL_DRAWS.length; i++) {
  const targetDraw = ALL_DRAWS[i];
  const sourceDrawIdx = i - 10; // 使用10期前的数据作为源
  
  // 计算历史频率（近20期）
  const freqWindow = 20;
  const freq = new Array(36).fill(0);
  for (let j = Math.max(0, sourceDrawIdx - freqWindow); j <= sourceDrawIdx; j++) {
    const draw = ALL_DRAWS[j];
    if (draw && draw.front) {
      draw.front.forEach(n => freq[n]++);
    }
  }
  
  // 计算遗漏期数（近20期）
  const miss = new Array(36).fill(0);
  for (let n = 1; n <= 35; n++) {
    let gap = 0;
    for (let j = sourceDrawIdx; j >= Math.max(0, sourceDrawIdx - 20); j--) {
      if (ALL_DRAWS[j].front.includes(n)) break;
      gap++;
    }
    miss[n] = gap;
  }
  
  // 生成前区top5组合：选择频率高且遗漏适中的号码
  const candidates = [];
  for (let n = 1; n <= 35; n++) {
    const score = freq[n] * 2 + miss[n] * 0.5; // 频率权重高，遗漏权重低
    candidates.push({ number: n, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  
  // 选择前5个，但确保区间平衡
  const selected = [];
  const zones = [0, 0, 0]; // 三个区间
  for (const cand of candidates) {
    if (selected.length >= 5) break;
    const n = cand.number;
    const zone = n <= 12 ? 0 : n <= 24 ? 1 : 2;
    // 如果某个区间已经选了2个，跳过
    if (zones[zone] >= 2) continue;
    selected.push(n);
    zones[zone]++;
  }
  // 如果不足5个，从剩余候选中补充
  if (selected.length < 5) {
    for (const cand of candidates) {
      if (selected.length >= 5) break;
      if (!selected.includes(cand.number)) {
        selected.push(cand.number);
      }
    }
  }
  const top5 = selected.sort((a, b) => a - b);
  
  // 生成补漏6号码：选择top5未覆盖的池号码中分数最高的
  const top5Set = new Set(top5);
  const buLouCandidates = candidates.filter(c => !top5Set.has(c.number));
  const buLou6 = buLouCandidates.slice(0, 6).map(c => c.number).sort((a, b) => a - b);
  
  // 后区预测：使用桥接效应
  const backPred = [];
  const prevDraw = ALL_DRAWS[i - 1];
  if (prevDraw && prevDraw.back) {
    const bridgeScore = new Array(13).fill(0);
    prevDraw.back.forEach(p => {
      bridgeScore[p] += 2;
      for (let offset = -3; offset <= 3; offset++) {
        if (offset === 0) continue;
        const nb = p + offset;
        if (nb >= 1 && nb <= 12) {
          bridgeScore[nb] += Math.max(0, 4 - Math.abs(offset));
        }
      }
    });
    // 选择得分最高的6个
    const backCandidates = [];
    for (let n = 1; n <= 12; n++) {
      backCandidates.push({ number: n, score: bridgeScore[n] });
    }
    backCandidates.sort((a, b) => b.score - a.score);
    backPred.push(...backCandidates.slice(0, 6).map(c => c.number).sort((a, b) => a - b));
  }
  
  predictions.push({
    issue: targetDraw.issue,
    top5: top5,
    buLou6: buLou6,
    backPred: backPred,
    actualFront: targetDraw.front,
    actualBack: targetDraw.back
  });
}

// 保存到JSON
const outputPath = path.join(__dirname, 'simple_predictions_data.json');
fs.writeFileSync(outputPath, JSON.stringify(predictions, null, 2));
console.log(`预测数据已保存到 ${outputPath}`);
console.log(`共 ${predictions.length} 期预测`);

// 输出前几期预览
console.log('\n前3期预览:');
predictions.slice(0, 3).forEach(p => {
  console.log(`期号: ${p.issue}`);
  console.log(`  前区top5: ${p.top5.join(',')}`);
  console.log(`  补漏6: ${p.buLou6.join(',')}`);
  console.log(`  后区预测: ${p.backPred.join(',')}`);
  console.log(`  实际前区: ${p.actualFront.join(',')}`);
  console.log(`  实际后区: ${p.actualBack.join(',')}`);
});

// 保存ALL_DRAWS数据
fs.writeFileSync('all_draws.json', JSON.stringify(ALL_DRAWS, null, 2));
console.log('ALL_DRAWS数据已保存到 all_draws.json');