const fs = require('fs');

const output = fs.readFileSync('backtest_final.txt', 'utf16le');
const lines = output.split('\n');

const periods = [];
let periodData = null;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r/g, '');
    
    const periodMatch = line.match(/第 (\d+) 期验证  源期: (\d+) → 目标期: (\d+)/);
    if (periodMatch) {
        if (periodData && periodData.target) {
            periods.push(periodData);
        }
        periodData = { period: parseInt(periodMatch[1]), hits: [], top6Hits: [] };
        continue;
    }
    
    if (!periodData) continue;
    
    const targetMatch = line.match(/目的号码.*: \[([^\]]+)\]/);
    if (targetMatch) {
        periodData.target = targetMatch[1].split(',').map(s => parseInt(s.trim().replace(/\*/g, '')));
        continue;
    }
    
    const poolMatch = line.match(/候选池覆盖: (\d+) \/ (\d+)/);
    if (poolMatch) {
        periodData.poolCover = parseInt(poolMatch[1]);
        periodData.poolTotal = parseInt(poolMatch[2]);
        continue;
    }
    
    const top5Match = line.match(/Top5 联合覆盖.*: (\d+) \/ (\d+)/);
    if (top5Match) {
        periodData.top5Cover = parseInt(top5Match[1]);
        periodData.top5Total = parseInt(top5Match[2]);
        continue;
    }
    
    const top6Match = line.match(/Top6 联合覆盖.*: (\d+) \/ (\d+)/);
    if (top6Match) {
        periodData.top6Cover = parseInt(top6Match[1]);
        periodData.top6Total = parseInt(top6Match[2]);
        continue;
    }
    
    const hit1M = line.match(/等差①:.*→ 命中 (\d+) 个/);
    if (hit1M) periodData.hits[0] = parseInt(hit1M[1]);
    const hit2M = line.match(/等差②:.*→ 命中 (\d+) 个/);
    if (hit2M) periodData.hits[1] = parseInt(hit2M[1]);
    const hit3M = line.match(/等差③:.*→ 命中 (\d+) 个/);
    if (hit3M) periodData.hits[2] = parseInt(hit3M[1]);
    
    const t6m1 = line.match(/多段①:.*→ 命中 (\d+) 个/);
    if (t6m1) periodData.top6Hits[0] = parseInt(t6m1[1]);
    const t6m2 = line.match(/多段②:.*→ 命中 (\d+) 个/);
    if (t6m2) periodData.top6Hits[1] = parseInt(t6m2[1]);
    const t6m3 = line.match(/多段③:.*→ 命中 (\d+) 个/);
    if (t6m3) periodData.top6Hits[2] = parseInt(t6m3[1]);
    
    const tailMatch = line.match(/尾号命中率:.*?(\d+)\/(\d+)/);
    if (tailMatch) {
        periodData.tailHit = parseInt(tailMatch[1]);
        periodData.tailTotal = parseInt(tailMatch[2]);
    }
}
if (periodData && periodData.target) periods.push(periodData);

console.log(`\n${'='.repeat(70)}`);
console.log(`回测深度分析 — 解析到 ${periods.length} 期数据`);
console.log(`${'='.repeat(70)}\n`);

// 1. 候选池覆盖分布
console.log('【1】候选池覆盖分布');
console.log('-'.repeat(60));
const poolDist = {};
let totalPool = 0, poolCnt = 0;
periods.forEach(p => {
    if (p.poolCover !== undefined) {
        poolDist[p.poolCover] = (poolDist[p.poolCover] || 0) + 1;
        totalPool += p.poolCover;
        poolCnt++;
    }
});
console.log(`平均: ${(totalPool/poolCnt).toFixed(2)} / 5 (${(totalPool/poolCnt/5*100).toFixed(1)}%)`);
for (let i = 5; i >= 0; i--) {
    const c = poolDist[i] || 0;
    const pct = (c / poolCnt * 100).toFixed(1);
    console.log(`  ${i}个: ${String(c).padStart(4)}期 (${pct.padStart(5)}%) ${'█'.repeat(Math.round(c/1.2))}`);
}

// 2. Top5联合覆盖
console.log('\n【2】Top5联合覆盖分布');
console.log('-'.repeat(60));
const top5Dist = {};
let totalTop5 = 0, top5Cnt = 0;
periods.forEach(p => {
    if (p.top5Cover !== undefined) {
        top5Dist[p.top5Cover] = (top5Dist[p.top5Cover] || 0) + 1;
        totalTop5 += p.top5Cover;
        top5Cnt++;
    }
});
console.log(`平均: ${(totalTop5/top5Cnt).toFixed(2)} / 5 (${(totalTop5/top5Cnt/5*100).toFixed(1)}%)`);
for (let i = 5; i >= 0; i--) {
    const c = top5Dist[i] || 0;
    const pct = (c / top5Cnt * 100).toFixed(1);
    console.log(`  ${i}个: ${String(c).padStart(4)}期 (${pct.padStart(5)}%) ${'█'.repeat(Math.round(c/1.2))}`);
}

// 3. Top6联合覆盖
console.log('\n【3】Top6联合覆盖分布');
console.log('-'.repeat(60));
const top6Dist = {};
let totalTop6 = 0, top6Cnt = 0;
periods.forEach(p => {
    if (p.top6Cover !== undefined) {
        top6Dist[p.top6Cover] = (top6Dist[p.top6Cover] || 0) + 1;
        totalTop6 += p.top6Cover;
        top6Cnt++;
    }
});
console.log(`平均: ${(totalTop6/top6Cnt).toFixed(2)} / 5 (${(totalTop6/top6Cnt/5*100).toFixed(1)}%)`);
for (let i = 5; i >= 0; i--) {
    const c = top6Dist[i] || 0;
    const pct = (c / top6Cnt * 100).toFixed(1);
    console.log(`  ${i}个: ${String(c).padStart(4)}期 (${pct.padStart(5)}%) ${'█'.repeat(Math.round(c/1.2))}`);
}

// 4. Top5每注命中分布
console.log('\n【4】Top5每注命中分布(等差①②③)');
console.log('-'.repeat(60));
const hitDist = {};
let totalHits = 0, totalCombos = 0;
periods.forEach(p => {
    p.hits.forEach(h => {
        if (h !== undefined) {
            hitDist[h] = (hitDist[h] || 0) + 1;
            totalHits += h;
            totalCombos++;
        }
    });
});
console.log(`总注数: ${totalCombos}, 总命中: ${totalHits}, 平均: ${(totalHits/totalCombos).toFixed(3)}`);
for (let i = 5; i >= 0; i--) {
    const c = hitDist[i] || 0;
    const pct = (c / totalCombos * 100).toFixed(1);
    console.log(`  ${i}球: ${String(c).padStart(4)}注 (${pct.padStart(5)}%) ${'█'.repeat(Math.round(c/2))}`);
}

// 5. Top6每注命中分布
console.log('\n【5】Top6每注命中分布(多段(多段①②③)');
console.log('-'.repeat(60));
const hit6Dist = {};
let total6Hits = 0, total6Combos = 0;
periods.forEach(p => {
    p.top6Hits.forEach(h => {
        if (h !== undefined) {
            hit6Dist[h] = (hit6Dist[h] || 0) + 1;
            total6Hits += h;
            total6Combos++;
        }
    });
});
console.log(`总注数: ${total6Combos}, 总命中: ${total6Hits}, 平均: ${(total6Hits/total6Combos).toFixed(3)}`);
for (let i = 5; i >= 0; i--) {
    const c = hit6Dist[i] || 0;
    const pct = (c / total6Combos * 100).toFixed(1);
    console.log(`  ${i}球: ${String(c).padStart(4)}注 (${pct.padStart(5)}%) ${'█'.repeat(Math.round(c/2))}`);
}

// 6. 池覆盖→Top5转化
console.log('\n【6】池覆盖→Top5/T6转化分析');
console.log('-'.repeat(60));
for (let pc = 5; pc >= 0; pc--) {
    const group = periods.filter(p => p.poolCover === pc);
    if (group.length === 0) continue;
    const avgT5 = group.reduce((s, p) => s + (p.top5Cover || 0), 0) / group.length;
    const avgT6 = group.reduce((s, p) => s + (p.top6Cover || 0), 0) / group.length;
    const avgMaxHit = group.reduce((s, p) => s + Math.max(...p.hits.filter(h => h !== undefined)), 0) / group.length;
    console.log(`  池=${pc} (${group.length}期): Top5=${avgT5.toFixed(2)}, T6=${avgT6.toFixed(2)}, 单注最高=${avgMaxHit.toFixed(2)}`);
}

// 7. 低覆盖期
console.log('\n【7】低覆盖期(池覆盖 <= 2)');
console.log('-'.repeat(60));
const lowPeriods = periods.filter(p => p.poolCover <= 2);
console.log(`期数: ${lowPeriods.length}/${periods.length} (${(lowPeriods.length/periods.length*100).toFixed(1)}%)`);
const lowTargetNums = {};
lowPeriods.forEach(p => {
    p.target.forEach(n => { lowTargetNums[n] = (lowTargetNums[n] || 0) + 1; });
});
const sortedLow = Object.entries(lowTargetNums).sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log('低覆盖期中高频目标号码:');
sortedLow.forEach(([num, cnt]) => {
    console.log(`  号码${num.padStart(2)}: ${cnt}次`);
});

// 8. 池好Top5差
console.log('\n【8】池好(>=4)但Top5差(<3)的期');
console.log('-'.repeat(60));
const poolGoodT5Bad = periods.filter(p => p.poolCover >= 4 && p.top5Cover < 3);
console.log(`期数: ${poolGoodT5Bad.length}/${periods.length} (${(poolGoodT5Bad.length/periods.length*100).toFixed(1)}%)`);
poolGoodT5Bad.slice(0, 8).forEach(p => {
    console.log(`  第${p.period}期: 池${p.poolCover}/5, T5=${p.top5Cover}/5, T6=${p.top6Cover}/5, 目标${JSON.stringify(p.target)}`);
});

// 9. 尾号命中率
console.log('\n【9】尾号预测命中率');
console.log('-'.repeat(60));
let tailHitSum = 0, tailTotalSum = 0, tailCnt = 0;
periods.forEach(p => {
    if (p.tailHit !== undefined) {
        tailHitSum += p.tailHit;
        tailTotalSum += p.tailTotal;
        tailCnt++;
    }
});
console.log(`平均: ${tailHitSum}/${tailTotalSum} = ${(tailHitSum/tailTotalSum*100).toFixed(1)}% (覆盖${tailCnt}期)`);

// 10. 号码频次
console.log('\n【10】目标号码频次');
console.log('-'.repeat(60));
const numFreq = {};
periods.forEach(p => {
    p.target.forEach(n => { numFreq[n] = (numFreq[n] || 0) + 1; });
});
const sortedFreq = Object.entries(numFreq).sort((a, b) => b[1] - a[1]);
console.log('Top10高频:');
sortedFreq.slice(0, 10).forEach(([num, cnt]) => {
    console.log(`  号码${num.padStart(2)}: ${cnt}次 (${(cnt/periods.length*100).toFixed(1)}%)`);
});
console.log('Top10低频:');
sortedFreq.slice(-10).forEach(([num, cnt]) => {
    console.log(`  号码${num.padStart(2)}: ${cnt}次 (${(cnt/periods.length*100).toFixed(1)}%)`);
});

// 11. 趋势
console.log('\n【11】覆盖率趋势（4段）');
console.log('-'.repeat(60));
const segSize = Math.ceil(periods.length / 4);
for (let seg = 0; seg < 4; seg++) {
    const start = seg * segSize;
    const end = Math.min((seg + 1) * segSize, periods.length);
    const slice = periods.slice(start, end);
    if (slice.length === 0) continue;
    const avgP = slice.reduce((s, p) => s + (p.poolCover || 0), 0) / slice.length;
    const avgT5 = slice.reduce((s, p) => s + (p.top5Cover || 0), 0) / slice.length;
    const avgT6 = slice.reduce((s, p) => s + (p.top6Cover || 0), 0) / slice.length;
    console.log(`  第${slice[0].period}-${slice[slice.length-1].period}期: 池=${avgP.toFixed(2)}/5, T5=${avgT5.toFixed(2)}/5, T6=${avgT6.toFixed(2)}/5`);
}

// 综合结论
const avgP = totalPool/poolCnt;
const avgT5 = totalTop5/top5Cnt;
const avgT6 = totalTop6/top6Cnt;
const bothGood = periods.filter(p => p.poolCover >= 4 && p.top5Cover >= 3).length;
const poolBad = periods.filter(p => p.poolCover < 4).length;

console.log('\n' + '='.repeat(70));
console.log('综合诊断');
console.log('='.repeat(70));
console.log(`\n核心指标:`);
console.log(`  候选池覆盖: ${avgP.toFixed(2)}/5 = ${(avgP/5*100).toFixed(1)}%`);
console.log(`  Top5联合覆盖: ${avgT5.toFixed(2)}/5 = ${(avgT5/5*100).toFixed(1)}%`);
console.log(`  Top6联合覆盖: ${avgT6.toFixed(2)}/5 = ${(avgT6/5*100).toFixed(1)}%`);
console.log(`  尾号命中率: ${(tailHitSum/tailTotalSum*100).toFixed(1)}%`);
console.log(`\n分层诊断:`);
console.log(`  正常: ${bothGood}期 (${(bothGood/periods.length*100).toFixed(1)}%)`);
console.log(`  组合选择效率低(池>=4,T5<3): ${poolGoodT5Bad.length}期 (${(poolGoodT5Bad.length/periods.length*100).toFixed(1)}%)`);
console.log(`  候选池质量差(池<4): ${poolBad}期 (${(poolBad/periods.length*100).toFixed(1)}%)`);
console.log(`\n转化效率:`);
console.log(`  池→Top5: ${(avgT5/avgP*100).toFixed(1)}%`);
console.log(`  池→T6: ${(avgT6/avgP*100).toFixed(1)}%`);
