const fs = require("fs");

const code = fs.readFileSync("sample_replay.js", "utf8");
const cut = code.indexOf("const cases = [");

if (cut < 0) {
  throw new Error("Failed to locate sample_replay.js cases block.");
}

const api = new Function(
  code.slice(0, cut) + "; return { rankForRow };"
)();

const cases = [
  { row: 1, target: [6, 16, 18, 19, 28], label: "row1-new" },
  { row: 19, target: [4, 11, 12, 13, 25], label: "row19" },
  { row: 20, target: [10, 13, 19, 21, 30], label: "row20" },
  { row: 18, target: [3, 13, 15, 17, 21], label: "row18" },
  { row: 17, target: [3, 15, 20, 29, 31], label: "row17" },
  { row: 16, target: [7, 15, 20, 24, 29], label: "row16" },
];

console.log("=== verify_target_cases ===");

cases.forEach((item) => {
  const result = api.rankForRow(item.row, item.target, true);
  console.log(
    `${item.label}: rank ${result.rank}/${result.totalCombos}, top5 overlaps [${result.top5Overlaps.join(", ")}]`
  );
  result.top5Combos.forEach((combo, index) => {
    console.log(`  #${index + 1}: [${combo.numbers.join(", ")}] score=${combo.score}`);
  });
});
