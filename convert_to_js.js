// 将 all_draws.json 转为 all_draws.js（带估算日期）
const fs = require('fs');

const jsonData = JSON.parse(fs.readFileSync(
  'c:/Users/61419/Downloads/cp-main/selectBall-main71/selectBall-main/all_draws.json', 'utf-8'
));

// 已知日期锚点（来自原 script.js getBuiltInDrawData）
const knownDates = {
  "2026002": "2026-01-17", "2026003": "2026-01-19", "2026004": "2026-01-21",
  "2026005": "2026-01-24", "2026006": "2026-01-26", "2026007": "2026-01-28",
  "2026008": "2026-01-31", "2026009": "2026-02-02", "2026010": "2026-02-04",
  "2026011": "2026-02-07", "2026012": "2026-02-09", "2026013": "2026-02-11",
  "2026014": "2026-02-14", "2026015": "2026-02-16", "2026016": "2026-02-18",
  "2026017": "2026-02-21", "2026018": "2026-02-23", "2026019": "2026-02-25",
  "2026020": "2026-02-28", "2026021": "2026-03-02", "2026022": "2026-03-04",
  "2026023": "2026-03-07", "2026024": "2026-03-09", "2026025": "2026-03-11",
  "2026026": "2026-03-14", "2026027": "2026-03-16", "2026028": "2026-03-18",
  "2026029": "2026-03-21", "2026030": "2026-03-23", "2026031": "2026-03-25",
  "2026032": "2026-03-28", "2026033": "2026-03-30", "2026034": "2026-04-01",
  "2026035": "2026-04-04", "2026036": "2026-04-06", "2026037": "2026-04-08",
  "2026038": "2026-04-11", "2026039": "2026-04-13", "2026040": "2026-04-15",
  "2026041": "2026-04-18", "2026042": "2026-04-20", "2026043": "2026-04-22",
  "2026044": "2026-04-25", "2026045": "2026-04-27", "2026046": "2026-04-29",
  "2026047": "2026-05-02", "2026048": "2026-05-04", "2026049": "2026-05-06",
  "2026050": "2026-05-09", "2026051": "2026-05-11", "2026052": "2026-05-13",
  "2026053": "2026-05-16", "2026054": "2026-05-18", "2026055": "2026-05-20",
  "2026056": "2026-05-23", "2026057": "2026-05-25", "2026058": "2026-05-27",
  "2026059": "2026-05-30", "2026060": "2026-06-01", "2026061": "2026-06-03",
  "2026062": "2026-06-06", "2026063": "2026-06-08", "2026064": "2026-06-10",
  "2026065": "2026-06-13", "2026066": "2026-06-15", "2026067": "2026-06-17",
  "2026068": "2026-06-20", "2026069": "2026-06-22", "2026070": "2026-06-24",
  "2026071": "2026-06-27", "2026072": "2026-06-29",
};

// 解析期号为 { year, seq }，如 "2025101" → { year: 2025, seq: 101 }
function parseIssue(issue) {
  const year = parseInt(issue.slice(0, 4));
  const seq = parseInt(issue.slice(4));
  return { year, seq };
}

// 计算两期之间隔了多少期（大乐透期号跨年连续：2025150 → 2026001）
function issueDistance(issueA, issueB) {
  const a = parseIssue(issueA);
  const b = parseIssue(issueB);
  if (a.year === b.year) return Math.abs(a.seq - b.seq);
  // 跨年：按年序排列
  if (a.year < b.year) {
    // 若 a 是上一年的末期附近，b 是下一年的初期
    // 假设每年约 150 期
    return (b.seq) + (150 - a.seq) + (b.year - a.year - 1) * 150;
  } else {
    return (a.seq) + (150 - b.seq) + (a.year - b.year - 1) * 150;
  }
}

function estimateDate(issue) {
  if (knownDates[issue]) return knownDates[issue];

  // 找最近的已知日期
  let bestIssue = null;
  let bestDist = Infinity;
  let bestDate = null;
  for (const [k, v] of Object.entries(knownDates)) {
    const dist = issueDistance(issue, k);
    if (dist < bestDist) {
      bestDist = dist;
      bestIssue = k;
      bestDate = v;
    }
  }

  if (!bestIssue) return "";

  const baseDate = new Date(bestDate);
  const baseNum = parseInt(bestIssue);
  const issueNum = parseInt(issue);
  
  // 用实际序列差（不是数字差）
  const seqDiff = issueDistance(issue, bestIssue);
  const direction = issueNum > baseNum ? 1 : -1;
  
  const d = new Date(baseDate);
  d.setDate(d.getDate() + direction * seqDiff * 3);
  return d.toISOString().slice(0, 10);
}

// 按 issue 降序排列（从新到旧）
const sorted = [...jsonData].sort((a, b) =>
  parseInt(b.issue) - parseInt(a.issue)
);

// 生成 all_draws.js
const lines = [];
lines.push('// 大乐透开奖数据 - 外部数据源');
lines.push('// 由 all_draws.json 自动生成，更新 JSON 后运行 convert_to_js.js 重新生成');
lines.push('// 最后更新: ' + new Date().toISOString().slice(0, 10));
lines.push('// 数据范围: ' + sorted[sorted.length - 1].issue + ' ~ ' + sorted[0].issue + ' (共' + sorted.length + '期)');
lines.push('');
lines.push('window.ALL_DRAWS_DATA = [');

sorted.forEach((d, idx) => {
  const date = estimateDate(d.issue);
  const comma = idx < sorted.length - 1 ? ',' : '';
  lines.push(`  { issue: "${d.issue}", date: "${date}", front: [${d.front.join(', ')}], back: [${d.back.join(', ')}] }${comma}`);
});

lines.push('];');

fs.writeFileSync(
  'c:/Users/61419/Downloads/cp-main/selectBall-main71/selectBall-main/all_draws.js',
  lines.join('\n'),
  'utf-8'
);

console.log('✅ all_draws.js 已生成！');
console.log(`   共 ${sorted.length} 期`);
console.log(`   范围: ${sorted[sorted.length - 1].issue} ~ ${sorted[0].issue}`);
