/**
 * 对比两个文件的最高命中球数分布
 */
const fs = require('fs');

// 读取两个输出文件
const optOut = fs.readFileSync('opt_out.txt', 'utf8');
const scriptOut = fs.readFileSync('script_out.txt', 'utf8');

// 提取最佳命中分布
function extractBestHitDistribution(text) {
  const lines = text.split('\n');
  const result = {};
  for (const line of lines) {
    // 匹配 "5球0对 | 4球6对 | 3球32对" 等模式
    const match = line.match(/最佳命中分布:\s*(.+)/);
    if (match) {
      const parts = match[1].split('|').map(s => s.trim());
      for (const part of parts) {
        const m = part.match(/(\d+)球(\d+)对/);
        if (m) result[m[1]] = parseInt(m[2]);
      }
    }
  }
  return result;
}

// 提取池覆盖分布
function extractPoolDistribution(text) {
  const lines = text.split('\n');
  const result = {};
  for (const line of lines) {
    const match = line.match(/池覆盖分布:\s*(.+)/);
    if (match) {
      const parts = match[1].split('|').map(s => s.trim());
      for (const part of parts) {
        const m = part.match(/(\d+)球(\d+)对/);
        if (m) result[m[1]] = parseInt(m[2]);
      }
      // 匹配 ≤2球
      const m2 = match[1].match(/≤2球(\d+)对/);
      if (m2) result['≤2'] = parseInt(m2[1]);
    }
  }
  return result;
}

// 提取补漏6命中分布
function extractBulouDistribution(text) {
  const lines = text.split('\n');
  const result = {};
  for (const line of lines) {
    const match = line.match(/补漏6命中分布:\s*(.+)/);
    if (match) {
      const parts = match[1].split('|').map(s => s.trim());
      for (const part of parts) {
        const m = part.match(/(\d+)球(\d+)/);
        if (m) result[m[1]] = parseInt(m[2]);
      }
    }
  }
  return result;
}

// 提取联合覆盖分布
function extractUnionDistribution(text) {
  const lines = text.split('\n');
  const result = {};
  for (const line of lines) {
    const match = line.match(/联合覆盖分布:\s*(.+)/);
    if (match) {
      const parts = match[1].split('|').map(s => s.trim());
      for (const part of parts) {
        const m = part.match(/(\d+)球(\d+)对/);
        if (m) result[m[1]] = parseInt(m[2]);
      }
    }
  }
  return result;
}

console.log("=== 最佳命中分布对比 ===");
const optBest = extractBestHitDistribution(optOut);
const scriptBest = extractBestHitDistribution(scriptOut);
console.log("optimized_picker.js:", JSON.stringify(optBest));
console.log("script_js_predictor.js:", JSON.stringify(scriptBest));

console.log("\n=== 池覆盖分布对比 ===");
const optPool = extractPoolDistribution(optOut);
const scriptPool = extractPoolDistribution(scriptOut);
console.log("optimized_picker.js:", JSON.stringify(optPool));
console.log("script_js_predictor.js:", JSON.stringify(scriptPool));

console.log("\n=== 补漏6命中分布对比 ===");
const optBulou = extractBulouDistribution(optOut);
const scriptBulou = extractBulouDistribution(scriptOut);
console.log("optimized_picker.js:", JSON.stringify(optBulou));
console.log("script_js_predictor.js:", JSON.stringify(scriptBulou));

console.log("\n=== 联合覆盖分布对比 ===");
const optUnion = extractUnionDistribution(optOut);
const scriptUnion = extractUnionDistribution(scriptOut);
console.log("optimized_picker.js:", JSON.stringify(optUnion));
console.log("script_js_predictor.js:", JSON.stringify(scriptUnion));
