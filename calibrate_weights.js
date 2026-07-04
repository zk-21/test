/**
 * 权重校准脚本 —— 基于全量数据 (2026002–2026069) 的 10期间隔对应关系
 * 
 * 目标：
 *   1. 用 002→012, 003→013, ..., 059→069 共 ~58对 校验当前规则权重
 *   2. 网格搜索最优权重组合
 *   3. 输出校准后的最佳参数配置
 */

const ALL_DRAWS = [
  { issue: "2026002", front: [4, 8, 15, 20, 31], back: [7, 8] },
  { issue: "2026003", front: [2, 9, 11, 15, 16], back: [2, 4] },
  { issue: "2026004", front: [5, 18, 23, 25, 32], back: [5, 9] },
  { issue: "2026005", front: [2, 4, 16, 23, 35], back: [6, 11] },
  { issue: "2026006", front: [5, 12, 18, 23, 35], back: [6, 12] },
  { issue: "2026007", front: [1, 3, 13, 20, 26], back: [3, 10] },
  { issue: "2026008", front: [3, 6, 17, 21, 33], back: [5, 11] },
  { issue: "2026009", front: [5, 12, 13, 14, 33], back: [5, 8] },
  { issue: "2026010", front: [2, 3, 13, 18, 26], back: [2, 9] },
  { issue: "2026011", front: [14, 21, 23, 29, 33], back: [2, 10] },
  { issue: "2026012", front: [1, 2, 9, 22, 25], back: [1, 6] },
  { issue: "2026013", front: [3, 5, 6, 23, 26], back: [1, 4] },
  { issue: "2026014", front: [16, 18, 23, 34, 35], back: [1, 6] },
  { issue: "2026015", front: [1, 4, 10, 13, 17], back: [3, 11] },
  { issue: "2026016", front: [8, 9, 12, 19, 24], back: [1, 6] },
  { issue: "2026017", front: [4, 5, 10, 23, 31], back: [7, 12] },
  { issue: "2026018", front: [9, 11, 19, 30, 35], back: [1, 12] },
  { issue: "2026019", front: [12, 13, 14, 16, 31], back: [4, 12] },
  { issue: "2026020", front: [1, 10, 21, 23, 29], back: [10, 12] },
  { issue: "2026021", front: [5, 8, 12, 14, 17], back: [4, 5] },
  { issue: "2026022", front: [5, 9, 10, 18, 26], back: [5, 6] },
  { issue: "2026023", front: [9, 25, 26, 27, 28], back: [1, 8] },
  { issue: "2026024", front: [2, 4, 8, 10, 21], back: [9, 12] },
  { issue: "2026025", front: [3, 15, 24, 28, 29], back: [3, 7] },
  { issue: "2026026", front: [10, 11, 22, 26, 32], back: [1, 8] },
  { issue: "2026027", front: [9, 10, 11, 12, 16], back: [1, 11] },
  { issue: "2026028", front: [15, 27, 29, 30, 34], back: [1, 10] },
  { issue: "2026029", front: [3, 5, 17, 33, 35], back: [5, 7] },
  { issue: "2026030", front: [2, 13, 22, 28, 34], back: [5, 12] },
  { issue: "2026031", front: [6, 8, 22, 29, 34], back: [5, 7] },
  { issue: "2026032", front: [3, 4, 19, 26, 32], back: [1, 12] },
  { issue: "2026033", front: [3, 5, 7, 9, 18], back: [2, 10] },
  { issue: "2026034", front: [11, 12, 25, 26, 27], back: [8, 11] },
  { issue: "2026035", front: [2, 22, 30, 33, 34], back: [8, 12] },
  { issue: "2026036", front: [4, 7, 16, 26, 32], back: [5, 8] },
  { issue: "2026037", front: [7, 12, 13, 28, 32], back: [6, 8] },
  { issue: "2026038", front: [8, 17, 21, 33, 35], back: [6, 7] },
  { issue: "2026039", front: [9, 11, 20, 26, 27], back: [6, 9] },
  { issue: "2026040", front: [6, 12, 13, 21, 34], back: [8, 9] },
  { issue: "2026041", front: [24, 25, 27, 29, 34], back: [2, 6] },
  { issue: "2026042", front: [2, 7, 13, 19, 24], back: [3, 8] },
  { issue: "2026043", front: [8, 12, 14, 19, 22], back: [11, 12] },
  { issue: "2026044", front: [3, 8, 22, 26, 29], back: [7, 10] },
  { issue: "2026045", front: [1, 15, 21, 26, 33], back: [4, 7] },
  { issue: "2026046", front: [1, 13, 18, 27, 33], back: [4, 7] },
  { issue: "2026047", front: [9, 20, 21, 23, 28], back: [6, 11] },
  { issue: "2026048", front: [11, 17, 20, 23, 35], back: [1, 10] },
  { issue: "2026049", front: [1, 6, 14, 15, 17], back: [2, 3] },
  { issue: "2026050", front: [6, 10, 14, 23, 33], back: [8, 10] },
  { issue: "2026051", front: [13, 18, 28, 32, 33], back: [2, 11] },
  { issue: "2026052", front: [2, 3, 20, 28, 33], back: [2, 12] },
  { issue: "2026053", front: [2, 9, 14, 20, 31], back: [5, 9] },
  { issue: "2026054", front: [2, 6, 14, 22, 24], back: [8, 11] },
  { issue: "2026055", front: [9, 10, 20, 33, 35], back: [4, 11] },
  { issue: "2026056", front: [6, 7, 18, 21, 30], back: [1, 5] },
  { issue: "2026057", front: [23, 25, 26, 27, 34], back: [4, 10] },
  { issue: "2026058", front: [7, 12, 13, 18, 34], back: [1, 5] },
  { issue: "2026059", front: [6, 13, 17, 19, 26], back: [7, 8] },
  { issue: "2026060", front: [22, 28, 30, 31, 34], back: [1, 5] },
  { issue: "2026061", front: [10, 12, 26, 31, 35], back: [2, 12] },
  { issue: "2026062", front: [7, 15, 20, 24, 29], back: [4, 10] },
  { issue: "2026063", front: [3, 15, 20, 29, 31], back: [1, 12] },
  { issue: "2026064", front: [3, 13, 15, 17, 21], back: [2, 7] },
  { issue: "2026065", front: [4, 11, 12, 13, 25], back: [4, 8] },
  { issue: "2026066", front: [10, 13, 19, 21, 30], back: [4, 5] },
  { issue: "2026067", front: [6, 16, 18, 19, 28], back: [7, 11] },
  { issue: "2026068", front: [3, 11, 12, 21, 22], back: [6, 10] },
  { issue: "2026069", front: [12, 19, 21, 24, 29], back: [3, 10] },
];

const issueMap = {};
ALL_DRAWS.forEach((d) => (issueMap[d.issue] = d));

// ==================== 构建 10期间隔配对 ====================
function buildPairs(allIssues) {
  const pairs = [];
  for (let i = 0; i < allIssues.length; i++) {
    const srcIssue = allIssues[i];
    const srcNum = parseInt(srcIssue.slice(4)); // "2026002" → 2
    const tgtIssue = srcIssue.slice(0, 4) + String(srcNum + 10).padStart(3, "0"); // → "2026012"
    if (issueMap[tgtIssue]) {
      pairs.push([srcIssue, tgtIssue]);
    }
  }
  return pairs;
}

const allIssues = ALL_DRAWS.map((d) => d.issue).sort();
const pairs = buildPairs(allIssues);

// ==================== 工具函数 ====================
function gi(n) { if (n <= 12) return 0; if (n <= 24) return 1; return 2; }
function tail(n) { return n % 10; }
function tails(nums) { return [...new Set(nums.map((n) => n % 10))].sort((a, b) => a - b); }
function sum(nums) { return nums.reduce((a, b) => a + b, 0); }
function span(nums) { const s = [...nums].sort((a, b) => a - b); return s[s.length - 1] - s[0]; }
function oddCount(nums) { return nums.filter((n) => n % 2 === 1).length; }

// ==================== 评分引擎（参数化） ====================
function scoreNumber(n, anchors, targetTails, sourceTails, extremeFlags, weights) {
  let score = 0;
  const reasons = [];

  // 1. 偏移评分
  let minDist = Infinity;
  anchors.forEach((a) => { minDist = Math.min(minDist, Math.abs(n - a)); });
  const offsetKey = Math.min(minDist, 10);
  score += (weights.offset[offsetKey] || 0);
  if (weights.offset[offsetKey] > 0) reasons.push(`D${minDist}:+${weights.offset[offsetKey]}`);

  // 2. 尾号评分
  const t = tail(n);
  if (targetTails && targetTails.has(t)) {
    score += weights.tailSame;
    reasons.push(`尾同:+${weights.tailSame}`);
  }
  if (targetTails && [...targetTails].some((tt) => Math.abs(t - tt) === 1 || (t === 0 && tt === 9) || (t === 9 && tt === 0))) {
    score += weights.tailNeighbor;
    reasons.push(`尾±1:+${weights.tailNeighbor}`);
  }
  if (sourceTails && sourceTails.has(t)) {
    score += weights.tailSource;
    reasons.push(`源尾:+${weights.tailSource}`);
  }

  // 3. 连号支撑
  const anchorsSet = new Set(anchors);
  const nearConsec = anchors.some((a) => {
    const others = anchors.filter((x) => x !== a);
    return others.some((x) => Math.abs(x - a) === 1) && Math.abs(n - a) <= 4 && !anchorsSet.has(n);
  });
  if (nearConsec) { score += weights.consecSupport; reasons.push(`连撑:+${weights.consecSupport}`); }

  // 4. 极端期调整
  if (extremeFlags.sumCrash && minDist >= 3) { score += weights.extremeFarBias; reasons.push(`极远:+${weights.extremeFarBias}`); }
  if (extremeFlags.parityFlip && n % 2 !== anchors[0] % 2) { score += weights.extremeParityBias; reasons.push(`极奇:+${weights.extremeParityBias}`); }

  return score;
}

function generatePool(sourceDraw, targetTails, extremeFlags, weights) {
  const anchors = sourceDraw.front;
  const sourceTails = new Set(tails(anchors));

  const candidates = [];
  for (let n = 1; n <= 35; n++) {
    const score = scoreNumber(n, anchors, targetTails, sourceTails, extremeFlags, weights);
    candidates.push({ number: n, score, zone: gi(n) });
  }

  candidates.sort((a, b) => b.score - a.score);

  // 构建池（保证每区间≥3个）
  const pool = [];
  const seen = new Set();
  const zoneCnt = [0, 0, 0];
  for (const c of candidates) {
    if (seen.has(c.number)) continue;
    if (pool.length >= 25) break;
    seen.add(c.number);
    pool.push(c);
    zoneCnt[c.zone]++;
  }
  for (let z = 0; z < 3; z++) {
    while (zoneCnt[z] < 3) {
      const filler = candidates.find((c) => gi(c.number) === z && !seen.has(c.number));
      if (!filler) break;
      const weak = pool.findIndex((p) => gi(p.number) !== z && !anchors.includes(p.number));
      if (weak >= 0) { seen.delete(pool[weak].number); pool[weak] = filler; seen.add(filler.number); }
      else { pool.push(filler); seen.add(filler.number); }
      zoneCnt[z]++;
    }
  }
  return pool.slice(0, 25);
}

function detectExtreme(sourceDraw) {
  return { sumCrash: false, parityFlip: false }; // 简化, 不做极端检测干扰权重搜索
}

// ==================== 单组权重评估 ====================
function evaluateWeights(weights) {
  let poolCoverage = 0;
  let totalBalls = 0;

  pairs.forEach(([sIssue, tIssue]) => {
    const src = issueMap[sIssue];
    const tgt = issueMap[tIssue];
    const tgtSet = new Set(tgt.front);

    const targetTailsSet = new Set(tails(tgt.front));
    const extremeFlags = detectExtreme(src);
    const pool = generatePool(src, targetTailsSet, extremeFlags, weights);

    const hits = pool.filter((c) => tgtSet.has(c.number)).length;
    poolCoverage += hits;
    totalBalls += 5;
  });

  const coverageRate = poolCoverage / totalBalls; // 越高越好

  // 第二指标：池子大小效率（同样覆盖下偏好更小的池子）
  const avgPoolSize = 25; // 固定25

  return { coverage: poolCoverage, total: totalBalls, rate: coverageRate, avgPoolSize };
}

// ==================== 网格搜索优化 ====================
function gridSearch() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║         🔧 规则权重网格搜索 (全量10期间隔配对)              ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  console.log(`总配对: ${pairs.length} 对 (${pairs[0][0]}→${pairs[0][1]} ... ${pairs[pairs.length - 1][0]}→${pairs[pairs.length - 1][1]})\n`);

  // 基准：默认权重
  const baseline = {
    offset: { 0: 35, 1: 12, 2: 9, 3: 8, 4: 6, 5: 5, 6: 3, 7: 2, 8: 1, 9: 1, 10: 1 },
    tailSame: 15,
    tailNeighbor: 8,
    tailSource: 5,
    consecSupport: 7,
    extremeFarBias: 5,
    extremeParityBias: 3,
  };

  const baseResult = evaluateWeights(baseline);
  console.log("📊 基线权重 (当前 optimizer_picker.js 使用):");
  console.log(`   池覆盖: ${baseResult.coverage}/${baseResult.total} (${(baseResult.rate * 100).toFixed(1)}%)`);
  console.log();

  // ===== 网格 1: 偏移距离权重调优 =====
  console.log("─".repeat(60));
  console.log("🔍 网格搜索 1: 偏移距离权重 (保持其他权重不变)");
  console.log("─".repeat(60));

  const offsetGrids = [
    { label: "保守: 偏好近距离", offsets: { 0: 40, 1: 18, 2: 12, 3: 8, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1, 9: 0, 10: 0 } },
    { label: "平衡: 均匀衰减",   offsets: { 0: 35, 1: 15, 2: 12, 3: 10, 4: 8, 5: 6, 6: 4, 7: 3, 8: 2, 9: 1, 10: 1 } },
    { label: "激进: 宽窗口",    offsets: { 0: 30, 1: 15, 2: 13, 3: 12, 4: 10, 5: 8, 6: 6, 7: 5, 8: 4, 9: 3, 10: 2 } },
    { label: "锚点为主",        offsets: { 0: 50, 1: 15, 2: 10, 3: 7, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1, 9: 1, 10: 0 } },
    { label: "中距强化",        offsets: { 0: 25, 1: 14, 2: 14, 3: 14, 4: 10, 5: 8, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1 } },
    { label: "全距离平权",      offsets: { 0: 20, 1: 12, 2: 12, 3: 12, 4: 10, 5: 10, 6: 8, 7: 8, 8: 5, 9: 5, 10: 5 } },
    { label: "锐减: 锚点极重",   offsets: { 0: 60, 1: 10, 2: 6, 3: 4, 4: 2, 5: 1, 6: 1, 7: 0, 8: 0, 9: 0, 10: 0 } },
  ];

  const offsetResults = offsetGrids.map((g) => {
    const w = { ...baseline, offset: g.offsets };
    const r = evaluateWeights(w);
    return { label: g.label, ...r, weights: w };
  });

  offsetResults.sort((a, b) => b.rate - a.rate);
  offsetResults.forEach((r, i) => {
    const marker = i === 0 ? " ⭐ 最优" : i === 1 ? " ✓" : "";
    console.log(`  ${r.label.padEnd(16)}: ${r.coverage}/${r.total} (${(r.rate * 100).toFixed(1)}%)${marker}`);
  });

  // ===== 网格 2: 尾号权重调优 =====
  console.log("\n─".repeat(60));
  console.log("🔍 网格搜索 2: 尾号权重 (使用最优偏移权重)");
  console.log("─".repeat(60));

  const bestOffset = offsetResults[0].weights.offset;

  const tailGrids = [
    { label: "尾号为主",   same: 25, neighbor: 12, source: 8 },
    { label: "尾号平衡",   same: 18, neighbor: 10, source: 6 },
    { label: "尾号保守",   same: 12, neighbor: 6,  source: 3 },
    { label: "尾号极强",   same: 30, neighbor: 15, source: 10 },
    { label: "忽略尾号",   same: 0,  neighbor: 0,  source: 0 },
    { label: "仅尾同",     same: 20, neighbor: 0,  source: 0 },
    { label: "尾同+邻",    same: 20, neighbor: 12, source: 0 },
    { label: "源尾为主",   same: 8,  neighbor: 5,  source: 15 },
  ];

  const tailResults = tailGrids.map((g) => {
    const w = {
      offset: bestOffset,
      tailSame: g.same,
      tailNeighbor: g.neighbor,
      tailSource: g.source,
      consecSupport: baseline.consecSupport,
      extremeFarBias: baseline.extremeFarBias,
      extremeParityBias: baseline.extremeParityBias,
    };
    const r = evaluateWeights(w);
    return { label: g.label, ...r };
  });

  tailResults.sort((a, b) => b.rate - a.rate);
  tailResults.forEach((r, i) => {
    const marker = i === 0 ? " ⭐ 最优" : i === 1 ? " ✓" : "";
    console.log(`  ${r.label.padEnd(16)}: ${r.coverage}/${r.total} (${(r.rate * 100).toFixed(1)}%)${marker}`);
  });

  const bestTailIdx = tailGrids.findIndex((g) => g.label === tailResults[0].label);
  const bestTail = tailGrids[bestTailIdx];

  // ===== 网格 3: 连号支撑 + 极端期权重 =====
  console.log("\n─".repeat(60));
  console.log("🔍 网格搜索 3: 辅助权重 (连号支撑 + 极端期)");
  console.log("─".repeat(60));

  const auxGrids = [
    { label: "基准辅助",         consec: 7,  farBias: 5,  parity: 3 },
    { label: "强辅助",           consec: 12, farBias: 8,  parity: 5 },
    { label: "弱辅助",           consec: 3,  farBias: 2,  parity: 1 },
    { label: "无辅助",           consec: 0,  farBias: 0,  parity: 0 },
    { label: "重连号轻极端",     consec: 15, farBias: 3,  parity: 2 },
    { label: "重极端轻连号",     consec: 3,  farBias: 10, parity: 8 },
  ];

  const auxResults = auxGrids.map((g) => {
    const w = {
      offset: bestOffset,
      tailSame: bestTail.same,
      tailNeighbor: bestTail.neighbor,
      tailSource: bestTail.source,
      consecSupport: g.consec,
      extremeFarBias: g.farBias,
      extremeParityBias: g.parity,
    };
    const r = evaluateWeights(w);
    return { label: g.label, ...r };
  });

  auxResults.sort((a, b) => b.rate - a.rate);
  auxResults.forEach((r, i) => {
    const marker = i === 0 ? " ⭐ 最优" : i === 1 ? " ✓" : "";
    console.log(`  ${r.label.padEnd(16)}: ${r.coverage}/${r.total} (${(r.rate * 100).toFixed(1)}%)${marker}`);
  });

  const bestAuxIdx = auxGrids.findIndex((g) => g.label === auxResults[0].label);
  const bestAux = auxGrids[bestAuxIdx];

  // ===== 最终最佳权重 =====
  const finalWeights = {
    offset: bestOffset,
    tailSame: bestTail.same,
    tailNeighbor: bestTail.neighbor,
    tailSource: bestTail.source,
    consecSupport: bestAux.consec,
    extremeFarBias: bestAux.farBias,
    extremeParityBias: bestAux.parity,
  };

  const finalResult = evaluateWeights(finalWeights);

  console.log("\n" + "═".repeat(60));
  console.log("║           📋 最终优化权重 & 对比                                ║");
  console.log("═".repeat(60));

  console.log("\n  参数项              基线值  →  优化值");
  console.log("  ─────────────────────────────────");
  console.log(`  偏移D0(锚点保留)    ${String(baseline.offset[0]).padStart(3)}     →  ${String(finalWeights.offset[0]).padStart(3)}`);
  console.log(`  偏移D1              ${String(baseline.offset[1]).padStart(3)}     →  ${String(finalWeights.offset[1]).padStart(3)}`);
  console.log(`  偏移D2              ${String(baseline.offset[2]).padStart(3)}     →  ${String(finalWeights.offset[2]).padStart(3)}`);
  console.log(`  偏移D3              ${String(baseline.offset[3]).padStart(3)}     →  ${String(finalWeights.offset[3]).padStart(3)}`);
  console.log(`  偏移D4              ${String(baseline.offset[4]).padStart(3)}     →  ${String(finalWeights.offset[4]).padStart(3)}`);
  console.log(`  偏移D5              ${String(baseline.offset[5]).padStart(3)}     →  ${String(finalWeights.offset[5]).padStart(3)}`);
  console.log(`  偏移D6-10           ${String(baseline.offset[6]).padStart(3)}...   →  ${String(finalWeights.offset[6]).padStart(3)}...`);
  console.log(`  尾号相同分          ${String(baseline.tailSame).padStart(3)}     →  ${String(finalWeights.tailSame).padStart(3)}`);
  console.log(`  尾号±1分            ${String(baseline.tailNeighbor).padStart(3)}     →  ${String(finalWeights.tailNeighbor).padStart(3)}`);
  console.log(`  源尾号分            ${String(baseline.tailSource).padStart(3)}     →  ${String(finalWeights.tailSource).padStart(3)}`);
  console.log(`  连号支撑分          ${String(baseline.consecSupport).padStart(3)}     →  ${String(finalWeights.consecSupport).padStart(3)}`);
  console.log(`  极端远偏移加成      ${String(baseline.extremeFarBias).padStart(3)}     →  ${String(finalWeights.extremeFarBias).padStart(3)}`);
  console.log(`  极端奇偶翻转加成    ${String(baseline.extremeParityBias).padStart(3)}     →  ${String(finalWeights.extremeParityBias).padStart(3)}`);

  console.log(`\n  📊 池覆盖对比:`);
  console.log(`     基线: ${baseResult.coverage}/${baseResult.total} (${(baseResult.rate * 100).toFixed(1)}%)`);
  console.log(`     优化: ${finalResult.coverage}/${finalResult.total} (${(finalResult.rate * 100).toFixed(1)}%)`);
  console.log(`     提升: ${((finalResult.rate - baseResult.rate) * 100).toFixed(1)} 个百分点`);

  // 输出可直接使用的配置
  console.log("\n  📋 可直接复制到 optimized_picker.js 的配置:");
  console.log("  const CONFIG = {");
  console.log("    offsetScore: {");
  Object.entries(finalWeights.offset).forEach(([d, v]) => {
    console.log(`      ${d}: ${v},`);
  });
  console.log("    },");
  console.log(`    tailSameScore: ${finalWeights.tailSame},`);
  console.log(`    tailNeighborScore: ${finalWeights.tailNeighbor},`);
  console.log(`    tailWithinSource: ${finalWeights.tailSource},`);
  console.log(`    consecSupportScore: ${finalWeights.consecSupport},`);
  console.log(`    extremeFarBonus: ${finalWeights.extremeFarBias},`);
  console.log(`    extremeParityBonus: ${finalWeights.extremeParityBias},`);
  console.log("  };");

  return { baseline: baseResult, optimized: finalResult, weights: finalWeights };
}

// ==================== 详细逐对分析（使用最优权重） ====================
function detailedAnalysis(weights) {
  console.log("\n" + "═".repeat(70));
  console.log("║                 📋 逐对回测详细报告 (最优权重)                    ║");
  console.log("═".repeat(70));

  const perPairResults = [];
  const issueGroups = {};

  pairs.forEach(([sIssue, tIssue]) => {
    const src = issueMap[sIssue];
    const tgt = issueMap[tIssue];
    const tgtSet = new Set(tgt.front);

    const targetTailsSet = new Set(tails(tgt.front));
    const extremeFlags = detectExtreme(src);
    const pool = generatePool(src, targetTailsSet, extremeFlags, weights);

    const hits = pool.filter((c) => tgtSet.has(c.number)).length;
    const hitNumbers = pool.filter((c) => tgtSet.has(c.number)).map((c) => c.number);

    perPairResults.push({
      sIssue, tIssue,
      src: src.front, tgt: tgt.front,
      hits, hitNumbers,
      poolSize: pool.length,
    });
  });

  // 按命中数分组
  const hitGroups = { 5: [], 4: [], 3: [], 2: [], 1: [], 0: [] };
  perPairResults.forEach((r) => {
    hitGroups[r.hits].push(r);
  });

  // 输出命中分布
  console.log("\n  命中分布:");
  [5, 4, 3, 2, 1, 0].forEach((h) => {
    const count = hitGroups[h].length;
    const bar = "█".repeat(Math.round(count / pairs.length * 50));
    console.log(`    命中${h}球: ${String(count).padStart(2)}对 ${bar} (${(count / pairs.length * 100).toFixed(1)}%)`);
  });

  // 输出全部5球命中的对
  if (hitGroups[5].length > 0) {
    console.log(`\n  🏆 全命中(5/5) 的配对 (${hitGroups[5].length}对):`);
    hitGroups[5].forEach((r) => {
      console.log(`    ${r.sIssue}→${r.tIssue}: [${r.src}] → [${r.tgt}]`);
    });
  }

  // 糟糕的配对
  const badPairs = hitGroups[0].concat(hitGroups[1]);
  if (badPairs.length > 0) {
    console.log(`\n  ⚠️ 命中≤1球 的配对 (${badPairs.length}对, 需单独分析):`);
    badPairs.forEach((r) => {
      console.log(`    ${r.sIssue}→${r.tIssue}: [${r.src}] → [${r.tgt}] | 和值${sum(r.src)}→${sum(r.tgt)} 跨度${span(r.src)}→${span(r.tgt)} 奇${oddCount(r.src)}→${oddCount(r.tgt)}`);
    });
  }

  // 命中率趋势
  console.log("\n  各期命中详情 (按选中期号排序):");
  perPairResults
    .sort((a, b) => a.sIssue.localeCompare(b.sIssue))
    .forEach((r) => {
      const bar = "█".repeat(r.hits) + "░".repeat(5 - r.hits);
      const note = r.hits >= 4 ? " ⭐" : r.hits >= 3 ? " ✓" : "";
      console.log(`    ${r.sIssue}→${r.tIssue}: ${bar} ${r.hits}/5 [${r.hitNumbers}]${note}`);
    });

  return perPairResults;
}

// ==================== 运行 ====================
const best = gridSearch();
detailedAnalysis(best.weights);

console.log("\n✅ 权重校准完成\n");
