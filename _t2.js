const { execSync } = require("child_process");
const path = require("path");
const out = execSync('node "' + path.join(__dirname, "optimized_picker.js") + '"', {
  encoding: "utf-8", timeout: 180000, maxBuffer: 50 * 1024 * 1024,
  cwd: __dirname
});
// 只输出关键行
const lines = out.split("\n");
const keywords = /前N注联合|Top[1-8].*命中|最佳命中|总配对|池覆盖|全5|汇总统计|≥3球.*58|0球.*0对/;
lines.forEach(l => { if (keywords.test(l)) console.log(l.trim()); });
