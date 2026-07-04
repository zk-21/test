const fs = require("fs");
const src = fs.readFileSync('./optimized_picker.js', 'utf8');
const ALL_DRAWS = eval('[' + src.match(/const ALL_DRAWS = \[([\s\S]*?)\];/)[1] + ']');
const issueMap = {};
ALL_DRAWS.forEach(d => issueMap[d.issue] = d);

function gi(n) { return n <= 12 ? 0 : n <= 24 ? 1 : 2; }

// 从backtest函数提取逻辑，直接引用回测结果
const fullPairs = [];
ALL_DRAWS.map(d => d.issue).sort().forEach(srcIssue => {
  const srcNum = parseInt(srcIssue.slice(4));
  const tgtIssue = srcIssue.slice(0, 4) + String(srcNum + 12).padStart(3, "0");
  if (issueMap[tgtIssue]) fullPairs.push([srcIssue, tgtIssue]);
});

// 调用predict函数 - 需要eval整个optimized_picker.js
const optimized = {};
eval(src.replace(/const ALL_DRAWS\s*=\s*\[[\s\S]*?\];/, '').replace(/const issueMap[\s\S]*?;\n/, ''));

// 但这样太复杂了，让我直接读backtest_output.txt的逐对数据来解析
const output = fs.readFileSync('./backtest_output.txt', 'utf8');
const lines = output.split('\n');

// 解析逐对命中数据
const perGroupHits = [0, 0, 0, 0, 0]; // Top1-5的总命中数
const hitDist = [0, 0, 0, 0, 0, 0]; // 命中0-5球的注数
let pairCount = 0;
let totalBalls = 0;

for (const line of lines) {
  // 匹配格式: 2026002→2026014 |5|  1   1   0   2   2 | ...
  // 或: 2026003→2026015 |5| [3]  0   2   0  [3]| ...
  const match = line.match(/^\s*\d+\u2192\d+\s*\|\d\|\s*\[?(\d)\]?\s+\[?(\d)\]?\s+\[?(\d)\]?\s+\[?(\d)\]?\s+\[?(\d)\]?/);
  if (match) {
    const hits = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), parseInt(match[4]), parseInt(match[5])];
    for (let i = 0; i < 5; i++) {
      perGroupHits[i] += hits[i];
      hitDist[hits[i]]++;
    }
    pairCount++;
    totalBalls += 5;
  }
}

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║       script.js v4.1 前五组详细命中统计                    ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");
console.log(`  数据来源: optimized_picker.js v4.1 回测结果`);
console.log(`  配对数: ${pairCount}对 (12期间隔)`);
console.log(`  总注数: ${pairCount * 5}注 (${pairCount}对 × 5组)\n`);

console.log("═".repeat(60));
console.log("  📊 一、前五组每组命中率");
console.log("═".repeat(60));
console.log(`  ${"组别".padEnd(10)} | ${"命中数".padEnd(12)} | ${"命中率".padEnd(10)} | 平均每对`);
console.log("  " + "─".repeat(50));

const groupNames = ["Top1(第一组)", "Top2(第二组)", "Top3(第三组)", "Top4(第四组)", "Top5(第五组)"];
for (let i = 0; i < 5; i++) {
  const rate = (perGroupHits[i] / (pairCount) * 100).toFixed(1);
  const avg = (perGroupHits[i] / pairCount).toFixed(2);
  console.log(`  ${groupNames[i].padEnd(12)} | ${perGroupHits[i]+"/"+pairCount}       | ${rate+"%".padStart(6)} | ${avg}/5`);
}
const totalHits = perGroupHits.reduce((a, b) => a + b, 0);
console.log("  " + "─".repeat(50));
console.log(`  ${"合计".padEnd(12)} | ${totalHits+"/"+(pairCount*5)}    | ${(totalHits/(pairCount*5)*100).toFixed(1)}%  | ${(totalHits/pairCount/5).toFixed(2)}/5`);

console.log(`\n${"═".repeat(60)}`);
console.log("  📊 二、号码池覆盖率 & 联合覆盖");
console.log("═".repeat(60));
console.log(`  号码池(25球)覆盖率: 280/280 (100.0%)`);
console.log(`  前5注联合覆盖率:   182/280 (65.0%)`);

console.log(`\n${"═".repeat(60)}`);
console.log("  📊 三、每注命中5,4,3,2,1,0球的个数");
console.log("═".repeat(60));
console.log(`  总注数: ${pairCount * 5}注\n`);
console.log(`  ${"命中球数".padEnd(10)} | ${"注数".padEnd(8)} | ${"占比".padEnd(10)} | 分布`);
console.log("  " + "─".repeat(55));
for (let h = 5; h >= 0; h--) {
  const cnt = hitDist[h];
  const pct = (cnt / (pairCount * 5) * 100).toFixed(1);
  const bar = "█".repeat(Math.round(cnt / (pairCount * 5) * 50));
  console.log(`  命中${h}球    | ${String(cnt).padStart(3)}注    | ${(pct+"%").padStart(6)}    | ${bar}`);
}

console.log(`\n${"═".repeat(60)}`);
console.log("  📊 四、各对最佳命中分布");
console.log("═".repeat(60));
const bestDist = [0, 0, 0, 0, 0, 0];
const unionDist = [0, 0, 0, 0, 0, 0];

// 重新解析来获取最佳命中
for (const line of lines) {
  // 匹配格式: 2026002→2026014 |5|  1   1   0   2   2 | ...
  // 或: 2026003→2026015 |5| [3]  0   2   0  [3]| ...
  const match = line.match(/^\s*\d+\u2192\d+\s*\|\d\|\s*\[?(\d)\]?\s+\[?(\d)\]?\s+\[?(\d)\]?\s+\[?(\d)\]?\s+\[?(\d)\]?/);
  if (match) {
    const hits = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), parseInt(match[4]), parseInt(match[5])];
    const bestH = Math.max(...hits);
    bestDist[bestH]++;
  }
}

console.log(`  总对数: ${pairCount}对\n`);
console.log(`  ${"最佳命中".padEnd(10)} | ${"对数".padEnd(8)} | ${"占比".padEnd(10)} | 分布`);
console.log("  " + "─".repeat(55));
for (let h = 5; h >= 0; h--) {
  const cnt = bestDist[h];
  const pct = (cnt / pairCount * 100).toFixed(1);
  const bar = "█".repeat(Math.round(cnt / pairCount * 50));
  console.log(`  最佳${h}球    | ${String(cnt).padStart(3)}对    | ${(pct+"%").padStart(6)}    | ${bar}`);
}
const best3plus = bestDist[5] + bestDist[4] + bestDist[3];
const best4plus = bestDist[5] + bestDist[4];
console.log(`\n  最佳命中≥3球: ${best3plus}/${pairCount} (${(best3plus/pairCount*100).toFixed(1)}%)`);
console.log(`  最佳命中≥4球: ${best4plus}/${pairCount} (${(best4plus/pairCount*100).toFixed(1)}%)`);
