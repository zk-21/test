// 验证：目标行上一行的尾号与目标行的尾号重叠规律
const fs = require('fs');
const src = fs.readFileSync('optimized_picker.js', 'utf-8');
const dataMatch = src.match(/const ALL_DRAWS = (\[[\s\S]*?\]);/);
if (!dataMatch) { console.log('无法提取ALL_DRAWS'); process.exit(1); }
const ALL_DRAWS = eval(dataMatch[1]);

console.log('═══════════════════════════════════════════════════════════');
console.log('  尾号重叠规律分析：目标行 vs 目标行上一行');
console.log('═══════════════════════════════════════════════════════════');
console.log(`  数据: ${ALL_DRAWS.length}期`);
console.log('');

// 分析所有相邻期的尾号重叠
const overlapStats = {}; // overlapCount → count
let totalPairs = 0;
const details = [];

for (let i = 0; i < ALL_DRAWS.length - 2; i++) {
  const prevDraw = ALL_DRAWS[i];      // 上一行
  const targetDraw = ALL_DRAWS[i + 1]; // 目标行

  const prevTails = [...new Set(prevDraw.front.map(n => n % 10))].sort((a,b)=>a-b);
  const targetTails = [...new Set(targetDraw.front.map(n => n % 10))].sort((a,b)=>a-b);

  // 计算尾号重叠数
  const overlap = prevTails.filter(t => targetTails.includes(t)).length;
  overlapStats[overlap] = (overlapStats[overlap] || 0) + 1;
  totalPairs++;

  details.push({
    period: prevDraw.period,
    prevTails: prevTails.join(','),
    targetTails: targetTails.join(','),
    overlap,
    prevNums: prevDraw.front.sort((a,b)=>a-b).join(','),
    targetNums: targetDraw.front.sort((a,b)=>a-b).join(','),
  });
}

console.log('  尾号重叠分布（相邻两期）:');
console.log('  ┌──────────┬────────┬────────┐');
console.log('  │ 重叠尾号数 │  次数  │  占比  │');
console.log('  ├──────────┼────────┼────────┤');
for (let k = 0; k <= 7; k++) {
  const cnt = overlapStats[k] || 0;
  const pct = (cnt / totalPairs * 100).toFixed(1);
  const bar = '█'.repeat(Math.round(cnt / totalPairs * 100));
  console.log(`  │    ${k}      │ ${String(cnt).padStart(4)}   │ ${pct.padStart(5)}% │ ${bar}`);
}
console.log('  └──────────┴────────┴────────┘');
console.log(`  总配对: ${totalPairs}`);

// 累计分布
console.log('\n  累计分布:');
let cum = 0;
for (let k = 0; k <= 7; k++) {
  cum += (overlapStats[k] || 0);
  console.log(`  ≤${k}个重叠: ${cum}/${totalPairs} (${(cum/totalPairs*100).toFixed(1)}%)`);
}

// 分析：如果预测尾号包含1-3个上一行尾号，命中率如何？
console.log('\n═══════════════════════════════════════════════════════════');
console.log('  应用验证：预测尾号与目标上一行尾号重叠1-3个时的命中率');
console.log('═══════════════════════════════════════════════════════════');

// 模拟：用sourceIdx预测sourceIdx+10期
// 目标行 = sourceIdx+10, 目标上一行 = sourceIdx+9
let matchCount = 0, total = 0;
let hitWithConstraint = 0, totalWithConstraint = 0;
let hitWithoutConstraint = 0, totalWithoutConstraint = 0;

for (let sourceIdx = 12; sourceIdx < ALL_DRAWS.length - 10; sourceIdx++) {
  const targetIdx = sourceIdx + 10;
  if (targetIdx >= ALL_DRAWS.length) continue;
  const prevTargetIdx = targetIdx - 1; // 目标行上一行

  const targetDraw = ALL_DRAWS[targetIdx];
  const prevTargetDraw = ALL_DRAWS[prevTargetIdx];
  const targetNumbers = new Set(targetDraw.front);
  const prevTargetTails = [...new Set(prevTargetDraw.front.map(n => n % 10))];

  // 用基线趋势映射
  const sourceDraw = ALL_DRAWS[sourceIdx];
  const sourceNumbers = [...sourceDraw.front].sort((a,b)=>a-b);
  const sourceTails = new Set(sourceNumbers.map(n => n%10));

  // 简单趋势映射
  const targetMap = new Map();
  const end = sourceIdx - 12;
  const start = Math.max(0, end - 50);
  for (let i = start; i <= end; i++) {
    const histSrc = ALL_DRAWS[i];
    const histTgt = ALL_DRAWS[i + 12];
    if (!histSrc || !histTgt) continue;
    const histNumbers = [...histSrc.front].sort((a,b)=>a-b);
    const histSet = new Set(histNumbers);
    const exactOverlap = sourceNumbers.filter(n => histSet.has(n)).length;
    const neighborOverlap = sourceNumbers.filter(n => histSet.has(n-1) || histSet.has(n+1)).length;
    const weight = exactOverlap * 18 + neighborOverlap * 10;
    if (weight <= 0) continue;
    [...histTgt.front].forEach(n => {
      targetMap.set(n, (targetMap.get(n)||0) + weight);
    });
  }

  const sorted = [...targetMap.entries()].sort((a,b) => b[1]-a[1]);
  const top15 = sorted.slice(0, 15).map(([n]) => n);

  // 检查：top15号码的尾号与prevTargetTails的重叠
  const top15Tails = [...new Set(top15.map(n => n % 10))];
  const tailOverlapWithPrev = top15Tails.filter(t => prevTargetTails.includes(t)).length;

  // 目标行实际尾号
  const actualTargetTails = [...new Set(targetDraw.front.map(n => n % 10))];
  const actualOverlap = actualTargetTails.filter(t => prevTargetTails.includes(t)).length;

  total++;

  // 统计：当实际重叠在1-3时
  if (actualOverlap >= 1 && actualOverlap <= 3) {
    totalWithConstraint++;
    let hit = 0;
    top15.forEach(n => { if (targetNumbers.has(n)) hit++; });
    if (hit >= 3) hitWithConstraint++;
  }

  // 无约束
  let hit = 0;
  top15.forEach(n => { if (targetNumbers.has(n)) hit++; });
  if (hit >= 3) hitWithoutConstraint++;
  totalWithoutConstraint++;
}

console.log(`  实际尾号重叠1-3个的情况: ${totalWithConstraint}/${total} (${(totalWithConstraint/total*100).toFixed(1)}%)`);
console.log(`  有约束时Top15≥3球: ${hitWithConstraint}/${totalWithConstraint} (${(hitWithConstraint/totalWithConstraint*100).toFixed(1)}%)`);
console.log(`  无约束时Top15≥3球: ${hitWithoutConstraint}/${totalWithoutConstraint} (${(hitWithoutConstraint/totalWithoutConstraint*100).toFixed(1)}%)`);

// 更细致的分析：不同重叠数下的命中率
console.log('\n  按实际重叠数分组的命中率:');
for (let ov = 0; ov <= 5; ov++) {
  let cnt = 0, hit3 = 0;
  for (let sourceIdx = 12; sourceIdx < ALL_DRAWS.length - 10; sourceIdx++) {
    const targetIdx = sourceIdx + 10;
    if (targetIdx >= ALL_DRAWS.length) continue;
    const prevTargetIdx = targetIdx - 1;
    const targetDraw = ALL_DRAWS[targetIdx];
    const prevTargetDraw = ALL_DRAWS[prevTargetIdx];
    const targetNumbers = new Set(targetDraw.front);
    const prevTargetTails = [...new Set(prevTargetDraw.front.map(n => n % 10))];
    const actualTargetTails = [...new Set(targetDraw.front.map(n => n % 10))];
    const actualOverlap = actualTargetTails.filter(t => prevTargetTails.includes(t)).length;
    if (actualOverlap !== ov) continue;
    cnt++;

    // 趋势映射
    const sourceDraw = ALL_DRAWS[sourceIdx];
    const sourceNumbers = [...sourceDraw.front].sort((a,b)=>a-b);
    const targetMap = new Map();
    const end = sourceIdx - 12;
    const start = Math.max(0, end - 50);
    for (let i = start; i <= end; i++) {
      const histSrc = ALL_DRAWS[i];
      const histTgt = ALL_DRAWS[i + 12];
      if (!histSrc || !histTgt) continue;
      const histNumbers = [...histSrc.front].sort((a,b)=>a-b);
      const histSet = new Set(histNumbers);
      const exactOverlap = sourceNumbers.filter(n => histSet.has(n)).length;
      const neighborOverlap = sourceNumbers.filter(n => histSet.has(n-1) || histSet.has(n+1)).length;
      const weight = exactOverlap * 18 + neighborOverlap * 10;
      if (weight <= 0) continue;
      [...histTgt.front].forEach(n => { targetMap.set(n, (targetMap.get(n)||0) + weight); });
    }
    const sorted = [...targetMap.entries()].sort((a,b) => b[1]-a[1]);
    const top15 = sorted.slice(0, 15).map(([n]) => n);
    let hit = 0;
    top15.forEach(n => { if (targetNumbers.has(n)) hit++; });
    if (hit >= 3) hit3++;
  }
  if (cnt > 0) {
    console.log(`  重叠=${ov}: ${cnt}次, Top15≥3球: ${hit3}/${cnt} (${(hit3/cnt*100).toFixed(1)}%)`);
  }
}

// 关键验证：如果我们在选号时强制保留1-3个上一行尾号，效果如何？
console.log('\n═══════════════════════════════════════════════════════════');
console.log('  强制尾号约束验证：选号时保留1-3个目标上一行尾号');
console.log('═══════════════════════════════════════════════════════════');

let constrainedHits = 0, unconstrainedHits = 0, cnt2 = 0;
for (let sourceIdx = 12; sourceIdx < ALL_DRAWS.length - 10; sourceIdx++) {
  const targetIdx = sourceIdx + 10;
  if (targetIdx >= ALL_DRAWS.length) continue;
  const prevTargetIdx = targetIdx - 1;
  const targetDraw = ALL_DRAWS[targetIdx];
  const prevTargetDraw = ALL_DRAWS[prevTargetIdx];
  const targetNumbers = new Set(targetDraw.front);
  const prevTargetTails = new Set(prevTargetDraw.front.map(n => n % 10));

  // 趋势映射
  const sourceDraw = ALL_DRAWS[sourceIdx];
  const sourceNumbers = [...sourceDraw.front].sort((a,b)=>a-b);
  const targetMap = new Map();
  const end = sourceIdx - 12;
  const start = Math.max(0, end - 50);
  for (let i = start; i <= end; i++) {
    const histSrc = ALL_DRAWS[i];
    const histTgt = ALL_DRAWS[i + 12];
    if (!histSrc || !histTgt) continue;
    const histNumbers = [...histSrc.front].sort((a,b)=>a-b);
    const histSet = new Set(histNumbers);
    const exactOverlap = sourceNumbers.filter(n => histSet.has(n)).length;
    const neighborOverlap = sourceNumbers.filter(n => histSet.has(n-1) || histSet.has(n+1)).length;
    const weight = exactOverlap * 18 + neighborOverlap * 10;
    if (weight <= 0) continue;
    [...histTgt.front].forEach(n => { targetMap.set(n, (targetMap.get(n)||0) + weight); });
  }

  const sorted = [...targetMap.entries()].sort((a,b) => b[1]-a[1]);

  // 无约束：取top5
  const top5 = sorted.slice(0, 5).map(([n]) => n);
  let hit0 = 0;
  top5.forEach(n => { if (targetNumbers.has(n)) hit0++; });
  unconstrainedHits += hit0;

  // 有约束：确保top5中至少有1个尾号来自prevTargetTails
  // 方法：从sorted中取，优先取prevTargetTails尾号的号码，但至少1个最多3个
  const withPrevTail = [];
  const withoutPrevTail = [];
  for (const [n] of sorted) {
    if (prevTargetTails.has(n % 10)) withPrevTail.push(n);
    else withoutPrevTail.push(n);
  }
  // 取1-3个prevTail尾号的号码 + 其余从without补
  const takePrev = Math.min(2, withPrevTail.length); // 取2个
  const constrained5 = [...withPrevTail.slice(0, takePrev), ...withoutPrevTail].slice(0, 5);
  let hit1 = 0;
  constrained5.forEach(n => { if (targetNumbers.has(n)) hit1++; });
  constrainedHits += hit1;

  cnt2++;
}

console.log(`  无约束Top5命中: ${(unconstrainedHits/(cnt2*5)*100).toFixed(1)}%`);
console.log(`  有约束Top5命中(保留2个上一行尾号): ${(constrainedHits/(cnt2*5)*100).toFixed(1)}%`);
console.log(`  配对数: ${cnt2}`);
