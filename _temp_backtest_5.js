// ======================== Node.js 兼容层 ========================
const __isNode = (typeof window === 'undefined');
let __allBalls = []; // Node.js 模式下的全局球数据

if (__isNode) {
  const fs = require('fs');
  const path = require('path');
  
  // 加载开奖数据
  const rawJs = fs.readFileSync(path.join(__dirname, 'all_draws.js'), 'utf8');
  const match = rawJs.match(/window\.ALL_DRAWS_DATA\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) { console.error('无法解析 all_draws.js'); process.exit(1); }
  const ALL_DRAWS_DATA = eval(match[1]);
  
  // 模拟浏览器 DOM 元素
  function mockEl() {
    return {
      querySelector: () => mockEl(),
      querySelectorAll: () => [],
      addEventListener: () => {},
      append: () => {},
      appendChild: () => {},
      remove: () => {},
      classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => false },
      dataset: {},
      textContent: "",
      innerHTML: "",
      style: new Proxy({}, { get: () => () => {} }),
      offsetWidth: 0, offsetHeight: 0,
      closest: () => null,
      getAttribute: () => null,
      setAttribute: () => {},
      matches: () => false,
    };
  }
  const mockDoc = mockEl();
  mockDoc.querySelector = () => mockEl();
  mockDoc.querySelectorAll = () => [];
  mockDoc.getElementById = () => mockEl();
  mockDoc.createElement = () => mockEl();
  mockDoc.createDocumentFragment = () => mockEl();
  mockDoc.body = mockEl();
  mockDoc.documentElement = mockEl();
  mockDoc.addEventListener = () => {};
  
  global.document = mockDoc;
  global.window = Object.assign(mockEl(), { ALL_DRAWS_DATA, addEventListener: () => {} });
  global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  global.XLSX = null;
  global.alert = () => {};
  global.URL = { createObjectURL: () => "", revokeObjectURL: () => {} };
  global.matchMedia = () => ({ matches: false });
  if (!global.navigator) global.navigator = { onLine: true, standalone: false };
  global.location = { href: "" };
  global.FileReader = class { readAsArrayBuffer() {} };
  // globalThis 也需要 addEventListener
  if (!globalThis.addEventListener) globalThis.addEventListener = () => {};
  
  // 补充更多浏览器 API
  global.getComputedStyle = () => ({ getPropertyValue: () => "0" });
  global.CSS = { supports: () => false };
  global.HTMLElement = class {};
  global.SVGElement = class {};
  global.Image = class {};
  global.MediaRecorder = class {};
  global.SpeechSynthesisUtterance = class {};
  global.URLSearchParams = class { constructor() {} get() { return null; } };
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
  global.Blob = class {};
  global.atob = (s) => Buffer.from(s, 'base64').toString('binary');
  global.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
  global.__allBalls = __allBalls;
  
  // ======================== 随机种子固定 ========================
  // 使用 mulberry32 算法实现可重现的随机数生成器
  const FIXED_SEED = 12345; // 固定种子值
  let _seed = FIXED_SEED;
  function seededRandom() {
    _seed |= 0;
    _seed = _seed + 0x6D2B79F5 | 0;
    var t = Math.imul(_seed ^ _seed >>> 15, 1 | _seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  // 保存原始 Math.random
  const _originalRandom = Math.random;
  // 替换 Math.random 为种子随机数
  Math.random = seededRandom;
  // 重置种子函数（用于多次运行保持一致）
  global.resetSeed = function() { _seed = FIXED_SEED; };
  
  // 将开奖数据转换为 allBalls 格式（与浏览器 collectBalls() 返回一致）
  // 格式: {row, zone, number, label, color, colors, protected}
  // DRAWS 按期号升序排列后，第1期=row1，第2期=row2...
  const draws = [...ALL_DRAWS_DATA].reverse(); // 旧→新
  draws.forEach((draw, idx) => {
    const rowNum = idx + 1; // 1-based row
    // 前区 5 个球
    draw.front.forEach((num) => {
      __allBalls.push({
        row: rowNum,
        zone: "front",
        number: num,
        label: String(num),
        color: "#d6202a",
        colors: null,
        protected: false,
      });
    });
    // 后区 2 个球
    draw.back.forEach((num) => {
      __allBalls.push({
        row: rowNum,
        zone: "back",
        number: num,
        label: String(num),
        color: "#1768b7",
        colors: null,
        protected: false,
      });
    });
  });
}

const appLock = document.querySelector("#appLock");
const appRoot = document.querySelector("#appRoot");
const appPassword = document.querySelector("#appPassword");
const toggleAppPasswordButton = document.querySelector("#toggleAppPasswordButton");
const unlockAppButton = document.querySelector("#unlockAppButton");
const appAuthMessage = document.querySelector("#appAuthMessage");
const installAppButton = document.querySelector("#installAppButton");
const installHint = document.querySelector("#installHint");
const displayModeBadge = document.querySelector("#displayModeBadge");
const networkStatusBadge = document.querySelector("#networkStatusBadge");
const dockButtons = [...document.querySelectorAll(".dock-item")];
const jumpButtons = [...document.querySelectorAll(".agent-jump")];
const agentSections = [...document.querySelectorAll("[data-agent-section]")];
const board = document.querySelector("#board");
const boardWrap = document.querySelector(".board-wrap");
const frontBoard = document.querySelector("#frontBoard");
const backBoard = document.querySelector("#backBoard");
const rowInput = document.querySelector("#rowInput");
const zoneInput = document.querySelector("#zoneInput");
const numberInput = document.querySelector("#numberInput");
const colorInput = document.querySelector("#colorInput");
const sizeInput = document.querySelector("#sizeInput");
const zoomInput = document.querySelector("#zoomInput");
const addBallButton = document.querySelector("#addBallButton");
const eraseButton = document.querySelector("#eraseButton");
const deleteColorButton = document.querySelector("#deleteColorButton");
const addDividerButton = document.querySelector("#addDividerButton");
const clearButton = document.querySelector("#clearButton");
const sampleButton = document.querySelector("#sampleButton");
const clearSampleButton = document.querySelector("#clearSampleButton");
const exportSampleExcelButton = document.querySelector("#exportSampleExcelButton");
const refreshPredictionButton = document.querySelector("#refreshPredictionButton");
let currentSampleData = null; // 存储当前生成的示例数据用于导出Excel
const sampleRatioModeInput = document.querySelector("#sampleRatioModeInput");
const sampleVersionInput = document.querySelector("#sampleVersionInput");
const sampleDisplayModeInput = document.querySelector("#sampleDisplayModeInput");

// 🆕 尾号选择器
const selectedTails = new Set();
const tailPoolInfo = document.querySelector("#tailPoolInfo");
document.querySelectorAll(".tail-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tail = parseInt(btn.dataset.tail, 10);
    if (selectedTails.has(tail)) {
      selectedTails.delete(tail);
      btn.classList.remove("active");
    } else {
      selectedTails.add(tail);
      btn.classList.add("active");
    }
    updateTailPoolInfo();
  });
});

function getTailFilteredPool() {
  if (selectedTails.size === 0) return [];
  const pool = [];
  for (let n = 1; n <= 35; n++) {
    if (selectedTails.has(n % 10)) pool.push(n);
  }
  return pool;
}

function updateTailPoolInfo() {
  if (!tailPoolInfo) return;
  if (selectedTails.size === 0) {
    tailPoolInfo.textContent = "";
  } else {
    const pool = getTailFilteredPool();
    tailPoolInfo.textContent = `候选池: ${pool.length}个号码`;
  }
}
const saveHistoryButton = document.querySelector("#saveHistoryButton");
const saveVersionButton = document.querySelector("#saveVersionButton");
const openComparePageButton = document.querySelector("#openComparePageButton");
const openComparePageFromHome = document.querySelector("#openComparePageFromHome");
const openCompare90PageButton = document.querySelector("#openCompare90PageButton");
const openCompare90PageFromHome = document.querySelector("#openCompare90PageFromHome");
const captureBoardButton = document.querySelector("#captureBoardButton");
const clearMainBoardButton = document.querySelector("#clearMainBoardButton");
const clearHistoryButton = document.querySelector("#clearHistoryButton");
const clearVersionsButton = document.querySelector("#clearVersionsButton");
const ballCount = document.querySelector("#ballCount");
const currentBaseLabel = document.querySelector("#currentBaseLabel");
const versionBanner = document.querySelector("#versionBanner");
const versionBannerText = document.querySelector("#versionBannerText");
const historyList = document.querySelector("#historyList");
const versionList = document.querySelector("#versionList");
const versionSearch = document.querySelector("#versionSearch");
const downloadVersionsButton = document.querySelector("#downloadVersionsButton");
const importVersionsInput = document.querySelector("#importVersionsInput");
const compareVersionsButton = document.querySelector("#compareVersionsButton");
const versionPassword = document.querySelector("#versionPassword");
const unlockVersionsButton = document.querySelector("#unlockVersionsButton");
const lockVersionsButton = document.querySelector("#lockVersionsButton");
const versionAuthMessage = document.querySelector("#versionAuthMessage");
const versionPreview = document.querySelector("#versionPreview");
const versionPreviewTitle = document.querySelector("#versionPreviewTitle");
const drawDateInput = document.querySelector("#drawDateInput");
const drawDataInput = document.querySelector("#drawDataInput");
const drawFileInput = document.querySelector("#drawFileInput");
const generateDrawVersionButton = document.querySelector("#generateDrawVersionButton");
const cancelEditDrawVersionButton = document.querySelector("#cancelEditDrawVersionButton");
const drawImportMessage = document.querySelector("#drawImportMessage");
const versionModal = document.querySelector("#versionModal");
const versionModalTitle = document.querySelector("#versionModalTitle");
const versionModalBody = document.querySelector("#versionModalBody");
const closeVersionModalButton = document.querySelector("#closeVersionModalButton");
const compareModal = document.querySelector("#compareModal");
const compareVersionOne = document.querySelector("#compareVersionOne");
const compareVersionTwo = document.querySelector("#compareVersionTwo");
const compareVersionThree = document.querySelector("#compareVersionThree");
const compareHint = document.querySelector("#compareHint");
const applyCompareButton = document.querySelector("#applyCompareButton");
const saveCompareButton = document.querySelector("#saveCompareButton");
const closeCompareModalButton = document.querySelector("#closeCompareModalButton");
const descInput = document.querySelector("#descInput");
const descFileInput = document.querySelector("#descFileInput");
const descAddButton = document.querySelector("#descAddButton");
const descHelpButton = document.querySelector("#descHelpButton");
const descHelpTip = document.querySelector("#descHelpTip");
const swatches = [...document.querySelectorAll(".swatch")];

const drawRows = 35;
const extraPickRows = 10;
const rows = drawRows + extraPickRows;
const sampleWindowRadius = 1;
const sampleFixedReferenceRow = 30;
const samplePickCount = 5;
const sampleBackPickCount = 2;
const sampleRedColor = "#d6202a";
const sampleBlueColor = "#1768b7";
const sampleGreenColor = "#14a365";
const sampleBlackColor = "#111827";
const samplePurpleColor = "#7c3aed";
const sampleRuleWeight = 8;
const sampleWeakRuleWeight = 4;
const sampleArithmeticMaxDiff = 17;
// 偏移权重表（v3优化：添加偏移0直接命中 + 全距离覆盖）
// 验证结论：锚点直接保留是最强信号，远距离也应有合理分数以保证池覆盖率
const sampleAnchorOffsetWeights = new Map([
  [0, 20],   // 🆕 锚点直接命中（v3核心：source号码在target中直接出现）
  [1, 15],   // ↑ 提升（v3对齐）
  [2, 13],   // ↑ 提升
  [3, 12],   // ↑ 提升
  [4, 11],
  [5, 12],
  [6, 8],    // ↑ 提升
  [7, 7],    // ↑ 提升
  [8, 5],
  [9, 4],
  [10, 3],
  [11, 2],   // 🆕 远距离补充覆盖
  [12, 1],   // 🆕 远距离补充覆盖
]);
const sampleIntervals = [
  { min: 1, max: 12 },
  { min: 13, max: 24 },
  { min: 25, max: 35 },
];
// 结构偏置：弱化纯参考行/热号导向，抬高目标型结构（1:3:1、1:4:0、20-22跨度、1-2个保留号）。
const sampleComboScoreWeights = {
  anchorTransformMultiplier: 0.5,
  explainCoverageMultiplier: 1,
  transformDiversityMultiplier: 0.5,
  farOffsetMultiplier: 0.5,
  anchorCoverageMultiplier: 1,
  anchorCrowdPenaltyMultiplier: 1,
  anchorKeepPenaltyMultiplier: 0.25,
  runPenaltyMultiplier: 0.5,
  spreadPenaltyMultiplier: 0.25,
  referenceMatchMultiplier: 0.5,
  referenceSoftMatchMultiplier: 2,
  ratio122Bonus: 42,
  ratio221Bonus: 16,
  ratio131Bonus: 32,
  ratio140Bonus: 24,
  ratio311Bonus: 10,
  span2022Bonus: 24,
  span1824Bonus: 18,  // 对齐optimized_picker v3强信号：16→18
  span2633Bonus: 12,  // 对齐optimized_picker v3强信号：26→12
  anchorKeep12Bonus: 30,
  tripleRunBonus: 10,
  odd1Bonus: 12,      // 对齐optimized_picker v3强信号：20→12
  odd3Bonus: 8,       // 新增：3个奇数奖励（optimized_picker v3信号）
};
const sampleRatioPresets = {
  "0-0-5": [[0, 0, 5]],
  "0-1-4": [[0, 1, 4]],
  "0-2-3": [[0, 2, 3]],
  "0-3-2": [[0, 3, 2]],
  "0-4-1": [[0, 4, 1]],
  "0-5-0": [[0, 5, 0]],
  "1-0-4": [[1, 0, 4]],
  "1-1-3": [[1, 1, 3]],
  "1-2-2": [[1, 2, 2]],
  "1-3-1": [[1, 3, 1]],
  "1-4-0": [[1, 4, 0]],
  "2-0-3": [[2, 0, 3]],
  "2-1-2": [[2, 1, 2]],
  "2-2-1": [[2, 2, 1]],
  "2-3-0": [[2, 3, 0]],
  "3-0-2": [[3, 0, 2]],
  "3-1-1": [[3, 1, 1]],
  "3-2-0": [[3, 2, 0]],
  "4-0-1": [[4, 0, 1]],
  "4-1-0": [[4, 1, 0]],
  "5-0-0": [[5, 0, 0]],
  break1: [
    [0, 1, 4],
    [0, 2, 3],
    [0, 3, 2],
    [0, 4, 1],
  ],
  break2: [
    [1, 0, 4],
    [2, 0, 3],
    [3, 0, 2],
    [4, 0, 1],
  ],
  break3: [
    [1, 4, 0],
    [2, 3, 0],
    [3, 2, 0],
    [4, 1, 0],
  ],
};
const sampleVariantModes = [
  { key: "best", label: "最优" },
  { key: "next", label: "次优" },
  { key: "backup", label: "备选" },
  { key: "rotate", label: "轮换" },
  { key: "random", label: "随机" },
];
const sampleComboPoolSize = 8;
const sampleComboLimit = 12;
const sampleFullComboPoolSize = 35;
const sampleRandomTopN = 5;
const sampleUsePlusTenTrend = true;
const pagePasswordValue = "zk@001";
const versionPasswordValue = "zk@001";
const pageAuthStorageKey = "lottery-page-auth";
const versionAuthStorageKey = "lottery-version-auth";
const historyStorageKey = "lottery-board-history";
const versionStorageKey = "lottery-board-versions";
const draftStorageKey = "lottery-board-current-draft";
const compareContextStorageKey = "lottery-board-compare-context";
const compare90ContextStorageKey = "lottery-board-compare90-context";
const browserOnlyStorage = globalThis.localStorage;
const localVersionNotice =
  "\u7248\u672c\u4fe1\u606f\u4f1a\u4fdd\u5b58\u5728\u5f53\u524d\u6d4f\u89c8\u5668\u672c\u673a\uff0c\u540c\u65f6\u4e0b\u8f7d\u5230\u4f60\u7684\u672c\u5730\u6587\u4ef6\u3002";
const zones = {
  front: { label: "前区", max: 35, element: frontBoard },
  back: { label: "后区", max: 12, element: backBoard },
};

let eraseMode = false;
let history = readStorage(historyStorageKey);
let versions = readStorage(versionStorageKey);
let versionsUnlocked = sessionStorage.getItem(versionAuthStorageKey) === "true";
let currentBaseTitle = "";
let userAdjustedZoom = false;
let editingDrawVersionId = "";
let rowIssues = {};
let activeCompareSelection = [];
let compareSourceVersionId = "";
let deferredInstallPrompt = null;
let compareSplitRows = [];
let customDividerRows = {};
let sampleSourceRow = 1;
let sampleRotationCursor = 0;
let sampleRowMeta = {};
let selectedRowValue = clamp(rowInput?.value, 1, rows);

function pad(value) {
  return String(value).padStart(2, "0");
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || min, min), max);
}

function setCompareSplitRows(splitRows = []) {
  compareSplitRows = [...new Set(splitRows.map((row) => Number(row)).filter((row) => row >= 1 && row < rows))].sort((a, b) => a - b);
  renderDividerRows();
}

function normalizeDividerRows(source = {}) {
  const normalized = {};
  Object.entries(source && typeof source === "object" ? source : {}).forEach(([rowKey, color]) => {
    const row = Number(rowKey);
    const cleanColor = normalizeColor(color);
    if (row >= 1 && row <= rows && cleanColor) normalized[row] = cleanColor;
  });
  return normalized;
}

function normalizeSampleRowMeta(source = {}) {
  const normalized = {};
  Object.entries(source && typeof source === "object" ? source : {}).forEach(([rowKey, value]) => {
    const row = Number(rowKey);
    const label = String(value?.label || "").trim();
    const title = String(value?.title || label).trim();
    if (row > drawRows && row <= rows && label) {
      normalized[row] = { label, title: title || label };
    }
  });
  return normalized;
}

function renderDividerRows() {
  board.querySelectorAll(".row-label, .cell").forEach((element) => {
    const row = Number(element.dataset.row);
    if (compareSplitRows.includes(row)) {
      element.dataset.compareSplit = "true";
    } else {
      delete element.dataset.compareSplit;
    }

    const dividerColor = customDividerRows[row];
    if (dividerColor) {
      element.dataset.customDivider = "true";
      element.style.setProperty("--divider-color", dividerColor);
    } else {
      delete element.dataset.customDivider;
      element.style.removeProperty("--divider-color");
    }
  });
}

function setCustomDividerRows(source = {}) {
  customDividerRows = normalizeDividerRows(source);
  renderDividerRows();
}

function addDividerRow(row, color = colorInput.value, shouldPersist = true) {
  const clampedRow = clamp(row, 1, rows);
  const cleanColor = normalizeColor(color);
  customDividerRows[clampedRow] = cleanColor;
  renderDividerRows();
  if (shouldPersist) {
    addHistory(`添加线条 第${clampedRow}行`, [{ row: clampedRow, zone: "front", number: 0, label: "线", color: cleanColor }]);
    persistDraft();
  }
}

function scrollToPanel(targetSelector) {
  if (!targetSelector) return;
  const target = document.querySelector(targetSelector);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setActiveDockBySelector(targetSelector = "") {
  dockButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.target === targetSelector);
  });
}

function detectStandaloneMode() {
  return globalThis.matchMedia?.("(display-mode: standalone)").matches || globalThis.navigator?.standalone === true;
}

function updateDisplayModeBadge() {
  const standalone = detectStandaloneMode();
  document.body.classList.toggle("is-standalone", standalone);
  if (displayModeBadge) {
    displayModeBadge.textContent = standalone ? "已安装模式" : "浏览器模式";
  }
}

function updateNetworkBadge() {
  if (!networkStatusBadge) return;
  const online = globalThis.navigator?.onLine !== false;
  networkStatusBadge.textContent = online ? "在线" : "离线";
  networkStatusBadge.classList.toggle("is-offline", !online);
}

function updateInstallUI() {
  if (!installAppButton || !installHint) return;
  if (detectStandaloneMode()) {
    installAppButton.hidden = true;
    installHint.textContent = "已安装到桌面，可像手机 App 一样直接打开。";
    return;
  }
  installAppButton.hidden = !deferredInstallPrompt;
  installHint.textContent = deferredInstallPrompt
    ? "可直接点击安装到手机桌面。"
    : "如果浏览器未显示安装按钮，可在菜单中选择“添加到主屏幕”。";
}

function syncVisiblePanel() {
  const viewportCenter = globalThis.innerHeight * 0.4;
  let activeSection = agentSections[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  agentSections.forEach((section) => {
    const rect = section.getBoundingClientRect();
    const distance = Math.abs(rect.top - viewportCenter);
    if (distance < bestDistance) {
      bestDistance = distance;
      activeSection = section;
    }
  });
  if (activeSection?.id) setActiveDockBySelector(`#${activeSection.id}`);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in globalThis.navigator)) return;
  try {
    await globalThis.navigator.serviceWorker.register("./sw.js");
  } catch (error) {
    console.warn("Service worker register failed:", error);
  }
}

function readStorage(key) {
  try {
    return JSON.parse(browserOnlyStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

function writeStorage(key, value) {
  browserOnlyStorage.setItem(key, JSON.stringify(value));
}

function makeId() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function formatTime(date = new Date()) {
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function normalizeColor(color) {
  return String(color || "").trim().toLowerCase();
}

function boostCaptureBallColor(color) {
  const normalized = normalizeColor(color);
  const boostMap = {
    "#d6202a": "#c91721",
    "#1768b7": "#0f5aa8",
    "#14a365": "#0f8f58",
    "#f59e0b": "#db8500",
    "#7c3aed": "#6b21d9",
    "#111827": "#111827",
  };
  return boostMap[normalized] || color;
}

function normalizePassword(value) {
  return String(value || "")
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, "");
}

function passwordMatches(value, expected) {
  return normalizePassword(value) === expected;
}

function getCell(row, zone, number) {
  return board.querySelector(`[data-row="${row}"][data-zone="${zone}"][data-number="${number}"]`);
}

function getBallData(ball) {
  const cell = ball.closest(".cell");
  const rawColors = ball.dataset.colors;
  const colors = rawColors ? rawColors.split(",").filter(Boolean).map(normalizeColor) : null;
  return {
    row: Number(cell.dataset.row),
    zone: cell.dataset.zone,
    number: Number(cell.dataset.number),
    label: ball.textContent,
    color: normalizeColor(ball.dataset.color),
    colors: colors && colors.length > 1 ? colors : null,
    protected: ball.dataset.protected === "true",
  };
}

function cloneBall(ball) {
  const number = Number(ball.number) || Number(ball.label) || 0;
  const result = {
    row: Number(ball.row) || 0,
    zone: ball.zone,
    number,
    label: String(ball.label || pad(number)),
    color: normalizeColor(ball.color) || "#999999",
  };
  if (ball.colors && Array.isArray(ball.colors) && ball.colors.length > 1) {
    result.colors = ball.colors.map(normalizeColor).filter(Boolean);
  }
  if (ball.protected) {
    result.protected = true;
  }
  return result;
}

function cloneBalls(balls) {
  return (Array.isArray(balls) ? balls : []).filter(Boolean).map(cloneBall);
}

function makeBall(row, zone, number, color) {
  return { row, zone, number, label: pad(number), color };
}

function parseBallDescription(text) {
  const normalized = String(text || "").replace(/\s+/g, "");
  const zone = normalized.includes("后区") ? "back" : normalized.includes("前区") ? "front" : "";
  if (!zone) return null;

  const colorMap = {
    红: "#d6202a",
    蓝: "#1768b7",
    绿: "#14a365",
    橙: "#f59e0b",
    紫: "#7c3aed",
    黑: "#111827",
  };
  const colorKey = Object.keys(colorMap).find((key) => normalized.includes(key));
  const color = colorKey ? colorMap[colorKey] : colorInput.value;

  const issueMatch = normalized.match(/\b(20?\d{5})\b/);
  const rowMatch = normalized.match(/(\d{1,2})行/);
  let row = rowMatch ? Number(rowMatch[1]) : 0;
  if (!row && issueMatch) {
    const issue = normalizeIssue(issueMatch[1]);
    const found = Object.entries(rowIssues).find(([, value]) => normalizeIssue(value) === issue);
    row = found ? Number(found[0]) : 0;
  }
  if (!row) return null;

  const numberPart = normalized
    .replace(/20?\d{5}/g, "")
    .replace(/\d{1,2}行/g, "")
    .replace(/[前后]区/g, "")
    .replace(/[红蓝绿橙紫黑]色?球?/g, "");
  const numbers = (numberPart.match(/\d{1,2}/g) || [])
    .map(Number)
    .filter((number) => number >= 1 && number <= zones[zone].max);
  return numbers.length > 0 ? { row: clamp(row, 1, rows), zone, numbers, color } : null;
}

function isDrawVersion(version) {
  const title = String(version?.title || "");
  const id = String(version?.id || "");
  return (
    version?.kind === "draw" ||
    id.startsWith("manual-draw-") ||
    id.startsWith("preset-latest-draw-") ||
    /^\d{4}-\d{2}-\d{2}/.test(title)
  );
}

function normalizeVersionRecord(version) {
  if (!version) return version;
  version.kind = isDrawVersion(version) ? "draw" : version.kind || "custom";
  return version;
}

function normalizeExistingVersions() {
  versions = versions.map(normalizeVersionRecord);
  writeStorage(versionStorageKey, versions);
}

function getDateFromVersion(version) {
  const fromDate = String(version?.drawDate || "").match(/\d{4}-\d{2}-\d{2}/)?.[0];
  const fromTitle = String(version?.title || "").match(/\d{4}-\d{2}-\d{2}/)?.[0];
  const fromTime = String(version?.time || "").match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return fromDate || fromTitle || fromTime || "";
}

function reconstructDrawText(version) {
  if (version?.sourceText) return version.sourceText;
  const grouped = new Map();
  cloneBalls(version?.balls).forEach((ball) => {
    if (!grouped.has(ball.row)) grouped.set(ball.row, { front: [], back: [] });
    grouped.get(ball.row)[ball.zone === "back" ? "back" : "front"].push(ball.number);
  });
  return [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, draw]) => [...draw.front, ...draw.back].map(pad).join(" "))
    .join("\n");
}

function clearDrawEditMode() {
  editingDrawVersionId = "";
  generateDrawVersionButton.textContent = "生成版本";
  cancelEditDrawVersionButton.hidden = true;
}

function startDrawEditMode(version) {
  editingDrawVersionId = version.id;
  drawDateInput.value = getDateFromVersion(version);
  drawDataInput.value = reconstructDrawText(version);
  generateDrawVersionButton.textContent = "保存修改";
  cancelEditDrawVersionButton.hidden = false;
  drawImportMessage.textContent = `正在修改 ${version.title || "开奖版本"}，保存后会覆盖这个版本。`;
  document.querySelector(".draw-import-shell")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function collectBalls() {
  if (__isNode) return __allBalls;
  return [...board.querySelectorAll(".ball")].map(getBallData);
}

function ballHasColor(ball, color) {
  const normalized = normalizeColor(color);
  if (normalizeColor(ball?.color) === normalized) return true;
  return Array.isArray(ball?.colors) && ball.colors.some((item) => normalizeColor(item) === normalized);
}

function getSampleSourceWindow(selectedRow) {
  const selected = clamp(selectedRow, 1, drawRows);
  const startRow = Math.max(1, selected - sampleWindowRadius);
  const endRow = Math.min(drawRows, selected + sampleWindowRadius);
  const referenceRows = [];
  for (let row = startRow; row <= endRow; row += 1) {
    referenceRows.push(row);
  }
  if (sampleFixedReferenceRow >= 1 && sampleFixedReferenceRow <= drawRows && !referenceRows.includes(sampleFixedReferenceRow)) {
    referenceRows.push(sampleFixedReferenceRow);
  }
  referenceRows.sort((left, right) => left - right);
  return {
    selectedRow: selected,
    startRow,
    endRow,
    referenceRows,
    fixedReferenceRow: sampleFixedReferenceRow,
  };
}

function makeCountMap(values = []) {
  const counter = new Map();
  values.forEach((value) => {
    counter.set(value, (counter.get(value) || 0) + 1);
  });
  return counter;
}

function sampleSignalLevel(value = 0, cap = 1) {
  const cleanValue = Math.max(0, Number(value) || 0);
  return Math.min(cap, cleanValue);
}

function rankSampleSource(left, right) {
  if ((right.tailCount || 0) !== (left.tailCount || 0)) return (right.tailCount || 0) - (left.tailCount || 0);
  if ((right.tailPatternScore || 0) !== (left.tailPatternScore || 0)) return (right.tailPatternScore || 0) - (left.tailPatternScore || 0);
  if ((right.lastRowTailHits || 0) !== (left.lastRowTailHits || 0)) return (right.lastRowTailHits || 0) - (left.lastRowTailHits || 0);
  if ((right.upperColorHits || 0) !== (left.upperColorHits || 0)) return (right.upperColorHits || 0) - (left.upperColorHits || 0);
  if ((right.upperColorTailHits || 0) !== (left.upperColorTailHits || 0)) return (right.upperColorTailHits || 0) - (left.upperColorTailHits || 0);
  if ((right.upperColorTailNeighborHits || 0) !== (left.upperColorTailNeighborHits || 0)) return (right.upperColorTailNeighborHits || 0) - (left.upperColorTailNeighborHits || 0);
  if ((right.arithmeticEndpointHits || 0) !== (left.arithmeticEndpointHits || 0)) return (right.arithmeticEndpointHits || 0) - (left.arithmeticEndpointHits || 0);
  if ((right.arithmeticScore || 0) !== (left.arithmeticScore || 0)) return (right.arithmeticScore || 0) - (left.arithmeticScore || 0);
  if ((right.bridgeEndpointHits || 0) !== (left.bridgeEndpointHits || 0)) return (right.bridgeEndpointHits || 0) - (left.bridgeEndpointHits || 0);
  if (right.lastRowHits !== left.lastRowHits) return right.lastRowHits - left.lastRowHits;
  if (right.hits !== left.hits) return right.hits - left.hits;
  return left.number - right.number;
}

function rankSampleTail(left, right) {
  if (right.tailCount !== left.tailCount) return right.tailCount - left.tailCount;
  return rankSampleSource(left, right);
}

function rankSampleRepeat(left, right) {
  const rightRepeat = (right.repeatCount || 0) >= 2 ? 1 : 0;
  const leftRepeat = (left.repeatCount || 0) >= 2 ? 1 : 0;
  if (rightRepeat !== leftRepeat) return rightRepeat - leftRepeat;
  return rankSampleSource(left, right);
}

function getUniqueSortedSampleNumbers(numbers = []) {
  return [...new Set((Array.isArray(numbers) ? numbers : []).map(Number).filter((number) => Number.isInteger(number) && number > 0))]
    .sort((left, right) => left - right);
}

function buildSampleRowEntries(sourceBalls = [], rowsInScope = []) {
  const rowMap = new Map();
  (Array.isArray(rowsInScope) ? rowsInScope : []).forEach((row) => rowMap.set(Number(row), []));

  (Array.isArray(sourceBalls) ? sourceBalls : []).forEach((ball) => {
    if (!ball || !Number.isInteger(ball.row)) return;
    const numbers = rowMap.get(ball.row) || [];
    numbers.push(ball.number);
    rowMap.set(ball.row, numbers);
  });

  return [...rowMap.entries()]
    .map(([row, numbers]) => {
      const uniqueNumbers = getUniqueSortedSampleNumbers(numbers);
      return {
        row: Number(row),
        numbers: uniqueNumbers,
        numberSet: new Set(uniqueNumbers),
      };
    })
    .filter((entry) => entry.numbers.length > 0)
    .sort((left, right) => left.row - right.row);
}

function countSampleConsecutivePairs(numbers = []) {
  let pairs = 0;
  let longestRun = 0;
  let currentRun = 0;

  for (let index = 0; index < numbers.length; index += 1) {
    if (index === 0 || numbers[index] !== numbers[index - 1] + 1) {
      currentRun = 1;
    } else {
      currentRun += 1;
      pairs += 1;
    }
    longestRun = Math.max(longestRun, currentRun);
  }

  return { pairs, longestRun };
}

function buildSampleTailArithmeticProfile(numbers = []) {
  const sortedNumbers = getUniqueSortedSampleNumbers(numbers);
  const tailBuckets = new Map();

  sortedNumbers.forEach((number) => {
    const tail = number % 10;
    const bucket = tailBuckets.get(tail) || [];
    bucket.push(number);
    tailBuckets.set(tail, bucket);
  });

  let strongestTail = null;
  let strongestCount = 0;
  let strongestSpan = 0;

  tailBuckets.forEach((bucket, tail) => {
    if (bucket.length < 2) return;
    const span = bucket[bucket.length - 1] - bucket[0];
    if (bucket.length > strongestCount || (bucket.length === strongestCount && span > strongestSpan)) {
      strongestTail = tail;
      strongestCount = bucket.length;
      strongestSpan = span;
    }
  });

  return {
    strongestTail,
    strongestCount,
    strongestSpan,
    tailBuckets,
  };
}

function getSampleStructureBias(numbers = [], anchorKeepHits = 0, intervals = sampleIntervals) {
  const sortedNumbers = getUniqueSortedSampleNumbers(numbers);
  if (sortedNumbers.length === 0) {
    return { bonus: 0, ratioKey: "", span: 0, oddCount: 0, longestRun: 0 };
  }

  const ratioKey = getSampleRatioKey(sortedNumbers, intervals);
  const span = sortedNumbers[sortedNumbers.length - 1] - sortedNumbers[0];
  const { longestRun } = countSampleConsecutivePairs(sortedNumbers);
  const oddCount = sortedNumbers.filter((number) => number % 2 === 1).length;
  let bonus = 0;

  if (ratioKey === "1:2:2") bonus += sampleComboScoreWeights.ratio122Bonus;
  else if (ratioKey === "2:2:1") bonus += sampleComboScoreWeights.ratio221Bonus;
  else if (ratioKey === "1:3:1") bonus += sampleComboScoreWeights.ratio131Bonus;
  else if (ratioKey === "1:4:0") bonus += sampleComboScoreWeights.ratio140Bonus;
  else if (ratioKey === "3:1:1") bonus += sampleComboScoreWeights.ratio311Bonus;

  if (span >= 20 && span <= 22) bonus += sampleComboScoreWeights.span2022Bonus;
  else if (span >= 18 && span <= 24) bonus += sampleComboScoreWeights.span1824Bonus;
  else if (span >= 26 && span <= 33) bonus += sampleComboScoreWeights.span2633Bonus;

  if (anchorKeepHits >= 1 && anchorKeepHits <= 2) bonus += sampleComboScoreWeights.anchorKeep12Bonus;
  if (longestRun >= 3) bonus += sampleComboScoreWeights.tripleRunBonus;
  if (oddCount === 1) bonus += sampleComboScoreWeights.odd1Bonus;
  else if (oddCount === 3) bonus += sampleComboScoreWeights.odd3Bonus;

  return { bonus, ratioKey, span, oddCount, longestRun };
}

function buildSampleConsecutiveSegments(numbers = []) {
  const sortedNumbers = getUniqueSortedSampleNumbers(numbers);
  const segments = [];
  let current = [];

  sortedNumbers.forEach((number, index) => {
    if (index === 0 || number === sortedNumbers[index - 1] + 1) {
      current.push(number);
    } else {
      if (current.length >= 2) segments.push([...current]);
      current = [number];
    }
  });

  if (current.length >= 2) segments.push([...current]);
  return segments;
}

function sampleRatioMatches(numbers = [], ratios = [], intervals = sampleIntervals) {
  if (!Array.isArray(ratios) || ratios.length === 0) return true;
  const ratioKey = getSampleRatioKey(numbers, intervals);
  return ratios.some((ratio) => Array.isArray(ratio) && ratio.join(":") === ratioKey);
}

function buildSampleBridgeMap(selectedNumbers = [], supportNumbers = [], lastRowNumbers = [], zone = "front") {
  const maxGap = zone === "back" ? 3 : 4;
  const anchorNumbers = getUniqueSortedSampleNumbers(selectedNumbers);
  const supportSet = new Set(getUniqueSortedSampleNumbers([...(supportNumbers || []), ...(lastRowNumbers || [])]));
  const supportTailSet = new Set([...supportSet].map((number) => number % 10));
  const gapMap = new Map();
  const endpointMap = new Map();

  for (let leftIndex = 0; leftIndex < anchorNumbers.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < anchorNumbers.length; rightIndex += 1) {
      const leftNumber = anchorNumbers[leftIndex];
      const rightNumber = anchorNumbers[rightIndex];
      const gap = rightNumber - leftNumber;
      if (gap <= 1 || gap > maxGap) continue;

      const closeness = Math.max(1, maxGap - gap + 1);
      [leftNumber, rightNumber].forEach((endpoint) => {
        const current = endpointMap.get(endpoint) || {
          number: endpoint,
          bridgeEndpointHits: 0,
          bridgeSupport: 0,
          bridgeScore: 0,
        };
        current.bridgeEndpointHits += 1;
        current.bridgeScore += 8 + closeness * 3;
        if (supportSet.has(endpoint)) {
          current.bridgeSupport += 1;
          current.bridgeScore += 6;
        }
        if (supportSet.has(endpoint - 1)) {
          current.bridgeSupport += 1;
          current.bridgeScore += 2;
        }
        if (supportSet.has(endpoint + 1)) {
          current.bridgeSupport += 1;
          current.bridgeScore += 2;
        }
        endpointMap.set(endpoint, current);
      });

      for (let number = leftNumber + 1; number < rightNumber; number += 1) {
        const current = gapMap.get(number) || {
          number,
          bridgeHits: 0,
          bridgeSupport: 0,
          bridgeScore: 0,
        };
        current.bridgeHits += 1;
        current.bridgeScore += 24 + closeness * 6;
        if (supportSet.has(number)) {
          current.bridgeSupport += 1;
          current.bridgeScore += 14;
        }
        const neighborSupport = [number - 1, number + 1].reduce((total, value) => total + (supportSet.has(value) ? 1 : 0), 0);
        if (neighborSupport > 0) {
          current.bridgeSupport += neighborSupport;
          current.bridgeScore += neighborSupport * 4;
        }
        if (supportTailSet.has(number % 10)) current.bridgeScore += 2;
        gapMap.set(number, current);
      }
    }
  }

  return {
    gapMap,
    endpointMap,
    gapSet: new Set(gapMap.keys()),
    endpointSet: new Set(endpointMap.keys()),
  };
}

function buildSampleArithmeticMap(selectedNumbers = [], supportNumbers = [], lastRowNumbers = [], zone = "front") {
  const maxGap = sampleArithmeticMaxDiff;
  const anchorNumbers = getUniqueSortedSampleNumbers(selectedNumbers);
  const supportSet = new Set(getUniqueSortedSampleNumbers([...(supportNumbers || []), ...(lastRowNumbers || [])]));
  const endpointMap = new Map();

  for (let anchorIndex = 0; anchorIndex < anchorNumbers.length; anchorIndex += 1) {
    const anchorNumber = anchorNumbers[anchorIndex];
    for (let diff = 1; diff <= maxGap; diff += 1) {
      const leftNumber = anchorNumber - diff;
      const rightNumber = anchorNumber + diff;
      if (leftNumber < 1 && rightNumber > zones[zone].max) continue;

      const closeness = Math.max(1, maxGap - diff + 1);
      [leftNumber, rightNumber].forEach((endpoint) => {
        if (endpoint < 1 || endpoint > zones[zone].max) return;
        const current = endpointMap.get(endpoint) || {
          number: endpoint,
          arithmeticEndpointHits: 0,
          arithmeticScore: 0,
        };
        current.arithmeticEndpointHits += 1;
        current.arithmeticScore += 10 + closeness * 4;
        if (supportSet.has(endpoint)) {
          current.arithmeticScore += 6;
        }
        if (supportSet.has(endpoint - 1) || supportSet.has(endpoint + 1)) {
          current.arithmeticScore += 2;
        }
        endpointMap.set(endpoint, current);
      });
    }
  }

  return {
    anchorNumbers,
    endpointMap,
  };
}

function evaluateSampleArithmeticCombo(numbers = [], anchorNumbers = [], zone = "front") {
  const comboNumbers = getUniqueSortedSampleNumbers(numbers);
  const anchors = getUniqueSortedSampleNumbers(anchorNumbers);
  if (comboNumbers.length === 0 || anchors.length === 0) {
    return {
      arithmeticEndpointHits: 0,
      arithmeticPairHits: 0,
      arithmeticScore: 0,
    };
  }

  const comboSet = new Set(comboNumbers);
  const maxGap = sampleArithmeticMaxDiff;
  let arithmeticEndpointHits = 0;
  let arithmeticPairHits = 0;
  let arithmeticScore = 0;

  anchors.forEach((anchorNumber) => {
    for (let diff = 1; diff <= maxGap; diff += 1) {
      const leftNumber = anchorNumber - diff;
      const rightNumber = anchorNumber + diff;
      if (leftNumber < 1 && rightNumber > zones[zone].max) continue;

      const hasLeft = leftNumber >= 1 && comboSet.has(leftNumber);
      const hasRight = rightNumber <= zones[zone].max && comboSet.has(rightNumber);
      if (!hasLeft && !hasRight) continue;

      const closeness = Math.max(1, maxGap - diff + 1);
      arithmeticEndpointHits += Number(hasLeft) + Number(hasRight);
      arithmeticScore += (hasLeft && hasRight ? 16 : 4) + closeness * (hasLeft && hasRight ? 5 : 2);
      if (hasLeft && hasRight) arithmeticPairHits += 1;
    }
  });

  return {
    arithmeticEndpointHits,
    arithmeticPairHits,
    arithmeticScore,
  };
}

function evaluateSampleDifferenceTrend(numbers = [], anchorNumbers = []) {
  const comboNumbers = getUniqueSortedSampleNumbers(numbers);
  const anchors = getUniqueSortedSampleNumbers(anchorNumbers);
  if (comboNumbers.length === 0 || anchors.length === 0) {
    return {
      differenceTrendHits: 0,
      differenceTrendScore: 0,
      differenceTrendLongestRun: 0,
    };
  }

  let differenceTrendHits = 0;
  let differenceTrendScore = 0;
  let differenceTrendLongestRun = 0;

  anchors.forEach((anchorNumber) => {
    const combinedNumbers = getUniqueSortedSampleNumbers([...comboNumbers, anchorNumber]);
    const anchorIndex = combinedNumbers.indexOf(anchorNumber);
    if (anchorIndex < 0 || combinedNumbers.length < 3) return;

    const gaps = [];
    for (let index = 1; index < combinedNumbers.length; index += 1) {
      const gap = combinedNumbers[index] - combinedNumbers[index - 1];
      gaps.push(gap >= 1 && gap <= sampleArithmeticMaxDiff ? gap : null);
    }

    for (let startIndex = 0; startIndex < gaps.length; startIndex += 1) {
      if (gaps[startIndex] === null) continue;
      [-1, 1].forEach((step) => {
        let endIndex = startIndex;
        while (
          endIndex + 1 < gaps.length &&
          gaps[endIndex + 1] !== null &&
          gaps[endIndex + 1] - gaps[endIndex] === step
        ) {
          endIndex += 1;
        }
        const runLength = endIndex - startIndex + 1;
        if (runLength < 2) return;
        const runTouchesAnchor = anchorIndex >= startIndex && anchorIndex <= endIndex + 1;
        if (!runTouchesAnchor) return;
        differenceTrendHits += runLength;
        differenceTrendLongestRun = Math.max(differenceTrendLongestRun, runLength);
        differenceTrendScore += runLength >= 3 ? runLength * 10 : runLength * 4;
      });
    }
  });

  return {
    differenceTrendHits,
    differenceTrendScore,
    differenceTrendLongestRun,
  };
}

function evaluateSampleBridgeCombo(numbers = [], anchorNumbers = [], zone = "front") {
  const comboNumbers = getUniqueSortedSampleNumbers(numbers);
  const anchors = getUniqueSortedSampleNumbers(anchorNumbers);
  if (comboNumbers.length === 0 || anchors.length < 2) {
    return {
      bridgeGapHits: 0,
      bridgeEndpointHits: 0,
      bridgePairHits: 0,
      bridgeScore: 0,
    };
  }

  const comboSet = new Set(comboNumbers);
  const maxGap = zone === "back" ? 3 : 4;
  let bridgeGapHits = 0;
  let bridgeEndpointHits = 0;
  let bridgePairHits = 0;
  let bridgeScore = 0;

  for (let leftIndex = 0; leftIndex < anchors.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < anchors.length; rightIndex += 1) {
      const leftNumber = anchors[leftIndex];
      const rightNumber = anchors[rightIndex];
      const gap = rightNumber - leftNumber;
      if (gap <= 1 || gap > maxGap) continue;

      const closeness = Math.max(1, maxGap - gap + 1);
      const betweenNumbers = comboNumbers.filter((number) => number > leftNumber && number < rightNumber);
      if (betweenNumbers.length === 0) continue;

      bridgePairHits += 1;
      bridgeGapHits += betweenNumbers.length;
      bridgeScore += betweenNumbers.length * (12 + closeness * 4);

      const endpointHits = Number(comboSet.has(leftNumber)) + Number(comboSet.has(rightNumber));
      bridgeEndpointHits += endpointHits;
      bridgeScore += endpointHits * (2 + closeness);

      if (betweenNumbers.length === gap - 1) {
        bridgeScore += 10 + closeness * 2;
      }
    }
  }

  return {
    bridgeGapHits,
    bridgeEndpointHits,
    bridgePairHits,
    bridgeScore,
  };
}

function buildSampleReferencePatternMaps(referenceRows = [], zone = "front") {
  const rows = (Array.isArray(referenceRows) ? referenceRows : []).filter((row) => Array.isArray(row?.numbers) && row.numbers.length > 0);
  const bridgeGapMap = new Map();
  const bridgeEndpointMap = new Map();
  const arithmeticEndpointMap = new Map();

  const mergeBridgeGapEntry = (number, entry) => {
    const current = bridgeGapMap.get(number) || {
      number,
      bridgeHits: 0,
      bridgeSupport: 0,
      bridgeScore: 0,
      bridgeReferenceHits: 0,
    };
    current.bridgeHits += entry.bridgeHits || 0;
    current.bridgeSupport += entry.bridgeSupport || 0;
    current.bridgeScore += entry.bridgeScore || 0;
    current.bridgeReferenceHits += 1;
    bridgeGapMap.set(number, current);
  };

  const mergeBridgeEndpointEntry = (number, entry) => {
    const current = bridgeEndpointMap.get(number) || {
      number,
      bridgeEndpointHits: 0,
      bridgeSupport: 0,
      bridgeScore: 0,
      bridgeReferenceHits: 0,
    };
    current.bridgeEndpointHits += entry.bridgeEndpointHits || 0;
    current.bridgeSupport += entry.bridgeSupport || 0;
    current.bridgeScore += entry.bridgeScore || 0;
    current.bridgeReferenceHits += 1;
    bridgeEndpointMap.set(number, current);
  };

  const mergeArithmeticEntry = (number, entry) => {
    const current = arithmeticEndpointMap.get(number) || {
      number,
      arithmeticEndpointHits: 0,
      arithmeticScore: 0,
      arithmeticReferenceHits: 0,
    };
    current.arithmeticEndpointHits += entry.arithmeticEndpointHits || 0;
    current.arithmeticScore += entry.arithmeticScore || 0;
    current.arithmeticReferenceHits += 1;
    arithmeticEndpointMap.set(number, current);
  };

  rows.forEach((referenceRow) => {
    const anchorNumbers = getUniqueSortedSampleNumbers(referenceRow.numbers);
    if (anchorNumbers.length === 0) return;
    const supportNumbers = getUniqueSortedSampleNumbers(
      rows
        .filter((row) => row.row !== referenceRow.row)
        .flatMap((row) => row.numbers)
    );

    const rowBridgeMap = buildSampleBridgeMap(anchorNumbers, supportNumbers, [], zone);
    rowBridgeMap.gapMap.forEach((entry, number) => mergeBridgeGapEntry(number, entry));
    rowBridgeMap.endpointMap.forEach((entry, number) => mergeBridgeEndpointEntry(number, entry));

    const rowArithmeticMap = buildSampleArithmeticMap(anchorNumbers, supportNumbers, [], zone);
    rowArithmeticMap.endpointMap.forEach((entry, number) => mergeArithmeticEntry(number, entry));
  });

  return {
    bridgeMap: {
      gapMap: bridgeGapMap,
      endpointMap: bridgeEndpointMap,
      gapSet: new Set(bridgeGapMap.keys()),
      endpointSet: new Set(bridgeEndpointMap.keys()),
    },
    arithmeticMap: {
      anchorNumbers: [],
      endpointMap: arithmeticEndpointMap,
      endpointSet: new Set(arithmeticEndpointMap.keys()),
    },
  };
}

const sampleDefaultRatios = [
  [1, 2, 2],
  [2, 1, 2],
  [2, 2, 1],
  [1, 1, 3],
  [1, 3, 1],
  [3, 1, 1],
];

function buildSampleTemplateRows(rowEntries = [], options = {}) {
  const selectedRow = Number(options.selectedRow) || 1;
  const selectedNumbers = getUniqueSortedSampleNumbers(options.selectedNumbers || []);
  const selectedSet = new Set(selectedNumbers);
  const lastRowNumbers = getUniqueSortedSampleNumbers(options.lastRowNumbers || []);
  const lastRowTailSet = new Set(lastRowNumbers.map((number) => number % 10));
  const lastRowTailNeighborSet = buildTailNeighborSet(lastRowNumbers.map((number) => number % 10));
  const lastRowSet = new Set(lastRowNumbers);
  const bridgeGapSet = options.bridgeGapSet instanceof Set ? options.bridgeGapSet : new Set();
  const bridgeEndpointSet = options.bridgeEndpointSet instanceof Set ? options.bridgeEndpointSet : new Set();
  const arithmeticEndpointSet = options.arithmeticEndpointSet instanceof Set ? options.arithmeticEndpointSet : new Set();
  const sourceMap = options.sourceMap instanceof Map ? options.sourceMap : new Map();
  const activeRatios = Array.isArray(options.ratios) ? options.ratios : [];
  const intervals = options.intervals || sampleIntervals;

  return (Array.isArray(rowEntries) ? rowEntries : []).map((entry) => {
    const numbers = getUniqueSortedSampleNumbers(entry.numbers);
    const distance = Math.max(0, Number(entry.row) - selectedRow);
    const { pairs: consecutivePairs, longestRun } = countSampleConsecutivePairs(numbers);
    const bridgeGapHits = numbers.filter((number) => bridgeGapSet.has(number)).length;
    const bridgeEndpointHits = numbers.filter((number) => bridgeEndpointSet.has(number)).length;
    const arithmeticEndpointHits = numbers.filter((number) => arithmeticEndpointSet.has(number)).length;
    const selectedOverlap = numbers.filter((number) => selectedSet.has(number)).length;
    const lastRowOverlap = numbers.filter((number) => lastRowSet.has(number)).length;

    let selectedNeighborHits = 0;
    let tailMatches = 0;
    let lastRowNeighborHits = 0;
    let repeatSupport = 0;
    let tailSupport = 0;
    const tailArithmetic = buildSampleTailArithmeticProfile(numbers);
    const consecutiveSegments = buildSampleConsecutiveSegments(numbers);

    numbers.forEach((number) => {
      if (selectedSet.has(number - 1) || selectedSet.has(number + 1)) selectedNeighborHits += 1;
      if (lastRowTailSet.has(number % 10)) tailMatches += 1;
      else if (lastRowTailNeighborSet.has(number % 10)) tailMatches += 0.5;
      if (lastRowSet.has(number - 1) || lastRowSet.has(number + 1)) lastRowNeighborHits += 1;
      repeatSupport += sourceMap.get(number)?.repeatCount || 0;
      tailSupport += Math.min(2, sourceMap.get(number)?.tailCount || 0);
    });

    const ratioKey = getSampleRatioKey(numbers, intervals);
    const ratioMatch = sampleRatioMatches(numbers, activeRatios, intervals);
    const distanceWeight = entry.row === selectedRow ? 1 : Math.max(1, 6 - distance);
    const templateScore =
      distanceWeight +
      sampleSignalLevel(tailMatches, 3) * (sampleRuleWeight + 2) +  // 对齐optimized_picker尾号权重：8→10
      sampleSignalLevel(tailArithmetic.strongestCount - 1, 3) * sampleRuleWeight +
      sampleSignalLevel(tailSupport, 2) * sampleRuleWeight +
      sampleSignalLevel(bridgeGapHits, 3) * sampleRuleWeight +
      sampleSignalLevel(bridgeEndpointHits, 3) * sampleRuleWeight +
      sampleSignalLevel(arithmeticEndpointHits, 3) * sampleRuleWeight +
      sampleSignalLevel(selectedOverlap, 3) * sampleRuleWeight +
      sampleSignalLevel(selectedNeighborHits, 3) * sampleRuleWeight +
      sampleSignalLevel(consecutivePairs, 3) * sampleRuleWeight +
      sampleSignalLevel(longestRun - 1, 3) * sampleRuleWeight +
      sampleSignalLevel(consecutiveSegments.filter((segment) => segment.length === 2).length, 3) * sampleRuleWeight +
      sampleSignalLevel(lastRowOverlap, 3) * sampleRuleWeight +
      sampleSignalLevel(lastRowNeighborHits, 3) * sampleRuleWeight +
      sampleSignalLevel(repeatSupport, 3) * sampleRuleWeight;
    const coreHits = bridgeGapHits + bridgeEndpointHits + arithmeticEndpointHits;

    return {
      row: Number(entry.row),
      numbers,
      numberSet: new Set(numbers),
      ratioKey,
      ratioMatch,
      bridgeGapHits,
      bridgeEndpointHits,
      arithmeticEndpointHits,
      coreHits,
      selectedOverlap,
      selectedNeighborHits,
      consecutivePairs,
      longestRun,
      tailArithmetic,
      consecutiveSegments,
      templateScore,
      integrityEligible: bridgeGapHits > 0 && coreHits >= 2 && templateScore >= 50 && ratioMatch,
    };
  }).sort((left, right) => {
    if (right.templateScore !== left.templateScore) return right.templateScore - left.templateScore;
    if (right.bridgeGapHits !== left.bridgeGapHits) return right.bridgeGapHits - left.bridgeGapHits;
    if (right.selectedOverlap !== left.selectedOverlap) return right.selectedOverlap - left.selectedOverlap;
    return left.row - right.row;
  });
}

function createSampleReferenceRow(row, numbers = [], options = {}) {
  const cleanNumbers = getUniqueSortedSampleNumbers(numbers);
  if (cleanNumbers.length === 0) return null;
  const intervals = options.intervals || sampleIntervals;
  const { pairs: consecutivePairs, longestRun } = countSampleConsecutivePairs(cleanNumbers);
  const consecutiveSegments = buildSampleConsecutiveSegments(cleanNumbers);
  const tailArithmetic = buildSampleTailArithmeticProfile(cleanNumbers);

  return {
    row: Number(row),
    numbers: cleanNumbers,
    numberSet: new Set(cleanNumbers),
    tailSet: new Set(cleanNumbers.map((number) => number % 10)),
    ratioKey: getSampleRatioKey(cleanNumbers, intervals),
    consecutivePairs,
    longestRun,
    consecutiveSegments,
    tailArithmetic,
    isSelectedRow: Number(row) === (Number(options.selectedRow) || 1),
    isLastRow: Number(row) === (Number(options.lastRow) || drawRows),
    isMarkerRow: Boolean(options.isMarkerRow),
    markerType: options.markerType || "",
  };
}

function buildSampleReferenceRows(rowEntries = [], options = {}) {
  const selectedRow = Number(options.selectedRow) || 1;
  const lastRow = Number(options.lastRow) || drawRows;
  const intervals = options.intervals || sampleIntervals;
  const lastRowNumbers = getUniqueSortedSampleNumbers(options.lastRowNumbers || []);
  const additionalRows = Array.isArray(options.additionalRows) ? options.additionalRows : [];
  const mergedEntries = Array.isArray(rowEntries) ? [...rowEntries] : [];

  if (lastRowNumbers.length > 0 && !mergedEntries.some((entry) => Number(entry?.row) === lastRow)) {
    mergedEntries.push({
      row: lastRow,
      numbers: lastRowNumbers,
      numberSet: new Set(lastRowNumbers),
    });
  }

  additionalRows.forEach((entry) => {
    if (!entry || !Array.isArray(entry.numbers) || entry.numbers.length === 0) return;
    mergedEntries.push(entry);
  });

  return mergedEntries
    .map((entry) => createSampleReferenceRow(entry.row, entry.numbers, {
      selectedRow,
      lastRow,
      intervals,
      isMarkerRow: Boolean(entry.isMarkerRow),
      markerType: entry.markerType || "",
    }))
    .filter(Boolean)
    .sort((left, right) => {
      return left.row - right.row;
    });
}

function evaluateSampleComboAgainstReference(numbers = [], referenceRow, options = {}) {
  const comboNumbers = getUniqueSortedSampleNumbers(numbers);
  if (!referenceRow || comboNumbers.length === 0) {
    return {
      score: 0,
      weightedScore: 0,
      matchedSignals: 0,
      arithmeticPairHits: 0,
      arithmeticScore: 0,
      bridgeGapHits: 0,
      bridgeEndpointHits: 0,
      bridgePairHits: 0,
      bridgeScore: 0,
    };
  }

  const comboRatioKey = getSampleRatioKey(comboNumbers, options.intervals || sampleIntervals);
  const { pairs: comboConsecutivePairs, longestRun: comboLongestRun } = countSampleConsecutivePairs(comboNumbers);

  const overlap = comboNumbers.filter((number) => referenceRow.numberSet.has(number)).length;
  const neighborHits = comboNumbers.filter((number) => referenceRow.numberSet.has(number - 1) || referenceRow.numberSet.has(number + 1)).length;
  const tailOverlap = comboNumbers.filter((number) => referenceRow.tailSet.has(number % 10)).length;
  const tailNeighborSet = buildTailNeighborSet([...referenceRow.tailSet]);
  const tailNeighborOverlap = comboNumbers.filter((number) => tailNeighborSet.has(number % 10)).length;
  const useRatioMatch = options.useRatioMatch !== false;
  const ratioMatch = useRatioMatch && comboRatioKey === referenceRow.ratioKey ? 1 : 0;
  const strongestTailHits = referenceRow.tailArithmetic?.strongestCount >= 2 && referenceRow.tailArithmetic.strongestTail !== null
    ? comboNumbers.filter((number) => number % 10 === referenceRow.tailArithmetic.strongestTail).length
    : 0;
  const consecutiveSimilarity = referenceRow.consecutivePairs > 0
    ? Math.max(0, 3 - Math.abs(comboConsecutivePairs - referenceRow.consecutivePairs))
    : comboConsecutivePairs === 0 ? 1 : 0;
  const longestRunSimilarity = referenceRow.longestRun > 1
    ? Math.max(0, 3 - Math.abs(comboLongestRun - referenceRow.longestRun))
    : comboLongestRun <= 2 ? 1 : 0;
  const arithmeticMetrics = evaluateSampleArithmeticCombo(comboNumbers, referenceRow.numbers, options.zone || "front");
  const differenceTrendMetrics = evaluateSampleDifferenceTrend(comboNumbers, referenceRow.numbers);
  const bridgeMetrics = evaluateSampleBridgeCombo(comboNumbers, referenceRow.numbers, options.zone || "front");
  const segmentSupport = (referenceRow.consecutiveSegments || []).reduce((total, segment) => {
    const segmentSet = new Set(segment);
    const shared = comboNumbers.filter((number) => segmentSet.has(number)).length;
    const adjacent = comboNumbers.filter((number) => segmentSet.has(number - 1) || segmentSet.has(number + 1)).length;
    if (shared >= Math.min(2, segment.length)) return total + 2;
    if (adjacent > 0) return total + 1;
    return total;
  }, 0);

  const score =
    sampleSignalLevel(overlap, 3) * sampleRuleWeight +
    sampleSignalLevel(neighborHits, 3) * sampleRuleWeight +
    sampleSignalLevel(tailOverlap, 3) * sampleRuleWeight +
    sampleSignalLevel(tailNeighborOverlap, 3) * sampleWeakRuleWeight +
    sampleSignalLevel(ratioMatch, 1) * sampleRuleWeight +
    sampleSignalLevel(strongestTailHits, 3) * sampleRuleWeight +
    sampleSignalLevel(arithmeticMetrics.arithmeticPairHits, 3) * sampleRuleWeight +
    sampleSignalLevel(arithmeticMetrics.arithmeticEndpointHits, 3) * sampleRuleWeight +
    sampleSignalLevel(differenceTrendMetrics.differenceTrendLongestRun - 1, 3) * sampleRuleWeight +
    sampleSignalLevel(bridgeMetrics.bridgePairHits, 3) * sampleRuleWeight +
    sampleSignalLevel(bridgeMetrics.bridgeGapHits, 3) * sampleRuleWeight +
    sampleSignalLevel(consecutiveSimilarity, 3) * sampleRuleWeight +
    sampleSignalLevel(longestRunSimilarity, 3) * sampleRuleWeight +
    sampleSignalLevel(segmentSupport, 3) * sampleRuleWeight;

  let matchedSignals = 0;
  if (overlap >= 1) matchedSignals += 1;
  if (neighborHits >= 1) matchedSignals += 1;
  if (tailOverlap >= 1) matchedSignals += 1;
  if (tailNeighborOverlap >= 1) matchedSignals += 1;
  if (useRatioMatch && ratioMatch) matchedSignals += 1;
  if (strongestTailHits >= 1) matchedSignals += 1;
  if (arithmeticMetrics.arithmeticPairHits >= 1) matchedSignals += 1;
  if (differenceTrendMetrics.differenceTrendLongestRun >= 3) matchedSignals += 1;
  if (bridgeMetrics.bridgeGapHits >= 1) matchedSignals += 1;
  if (consecutiveSimilarity >= 1 || segmentSupport >= 1) matchedSignals += 1;

  return {
    score,
    weightedScore: score,
    matchedSignals,
    overlap,
    neighborHits,
    tailOverlap,
    tailNeighborOverlap,
    ratioMatch,
    strongestTailHits,
    arithmeticPairHits: arithmeticMetrics.arithmeticPairHits,
    arithmeticScore: arithmeticMetrics.arithmeticScore + differenceTrendMetrics.differenceTrendScore,
    differenceTrendHits: differenceTrendMetrics.differenceTrendHits,
    differenceTrendScore: differenceTrendMetrics.differenceTrendScore,
    differenceTrendLongestRun: differenceTrendMetrics.differenceTrendLongestRun,
    bridgeGapHits: bridgeMetrics.bridgeGapHits,
    bridgeEndpointHits: bridgeMetrics.bridgeEndpointHits,
    bridgePairHits: bridgeMetrics.bridgePairHits,
    bridgeScore: bridgeMetrics.bridgeScore,
    consecutiveSimilarity,
    longestRunSimilarity,
    segmentSupport,
  };
}

function getOrCreateSampleCandidate(candidateMap, number, zone = "front") {
  if (number < 1 || number > zones[zone].max) return null;
  const existing = candidateMap.get(number);
  if (existing) return existing;

  const created = {
    number,
    score: 0,
    baseScore: 0,
    bridgeScore: 0,
    plusTenScore: 0,
    plusTenNeighborScore: 0,
    templateScore: 0,
    integrityBonus: 0,
    neighborHits: 0,
    fromRepeat: 0,
    fromTail: 0,
    selectedTailHits: 0,
    selectedTailNeighborHits: 0,
    repeatCount: 0,
    tailCount: 0,
    hits: 0,
    lastRowHits: 0,
    selectedRowHits: 0,
    supportHits: 0,
    anchorHits: 0,
    bridgeHits: 0,
    bridgeSupport: 0,
    bridgeEndpointHits: 0,
    arithmeticEndpointHits: 0,
    arithmeticScore: 0,
    templateHits: 0,
    templateCoreHits: 0,
    sameRowSupport: 0,
    upperColorHits: 0,
    upperColorTailHits: 0,
    upperColorTailNeighborHits: 0,
    anchorTransformScore: 0,
    transformedCount: 0,
    farOffsetCount: 0,
    anchorKeepPenalty: 0,
  };
  candidateMap.set(number, created);
  return created;
}

function getSampleSingleAnchorSignal(number, anchorNumbers = []) {
  const signal = evaluateSampleAnchorTransform([number], anchorNumbers);
  const singleScore =
    (signal.anchorTransformScore || 0) +
    (signal.transformedCount || 0) * 14 +
    (signal.farOffsetBonus || 0) +
    (signal.transformDiversityBonus || 0) +
    (signal.anchorKeepBonus || 0) +
    (signal.fourMechanismBonus || 0) +
    (signal.tailSignalBonus || 0) +
    (signal.sameTailMiddleBonus || 0) -
    (signal.anchorKeepPenalty || 0);
  return {
    ...signal,
    singleScore,
  };
}

function addSampleNeighbors(candidateMap, source, priorityBoost = 0, zone = "front") {
  [source.number - 1, source.number + 1].forEach((number) => {
    const current = getOrCreateSampleCandidate(candidateMap, number, zone);
    if (!current) return;
    const neighborScore =
      priorityBoost +
      source.repeatCount +
      source.tailCount +
      source.hits +
      (source.upperColorHits || 0) * 4 +
      (source.upperColorTailHits || 0) * 2 +
      (source.upperColorTailNeighborHits || 0) +
      (source.selectedRowHits || 0) * 2 +
      (source.bridgeEndpointHits || 0) * 6;
    current.score += neighborScore;
    current.baseScore += Math.max(0, Math.round(priorityBoost / 2));
    current.neighborHits += 1;
    current.anchorHits += Math.min(1, source.selectedRowHits || 0);
    if (source.repeatCount >= 2) current.fromRepeat += 1;
    if (source.tailCount >= 2 || source.lastRowTailHits > 0) current.fromTail += 1;
    candidateMap.set(number, current);
  });
}

function buildTailPatternScores(tails) {
  const tailSet = new Set((Array.isArray(tails) ? tails : []).filter((tail) => Number.isInteger(tail) && tail >= 0 && tail <= 9));
  const scores = new Map();

  for (let start = 0; start <= 9; start += 1) {
    for (let diff = 1; diff <= 9; diff += 1) {
      let run = [];
      for (let value = start; value <= 9; value += diff) {
        if (tailSet.has(value)) {
          run.push(value);
        } else {
          if (run.length >= 3) {
            run.forEach((tail) => {
              scores.set(tail, (scores.get(tail) || 0) + run.length);
            });
          }
          run = [];
        }
      }
      if (run.length >= 3) {
        run.forEach((tail) => {
          scores.set(tail, (scores.get(tail) || 0) + run.length);
        });
      }
    }
  }

  return scores;
}

function buildTailNeighborSet(tails = []) {
  const tailSet = new Set((Array.isArray(tails) ? tails : []).filter((tail) => Number.isInteger(tail) && tail >= 0 && tail <= 9));
  const neighborSet = new Set();

  tailSet.forEach((tail) => {
    if (tail > 0) neighborSet.add(tail - 1);
    if (tail < 9) neighborSet.add(tail + 1);
  });

  tailSet.forEach((tail) => neighborSet.delete(tail));
  return neighborSet;
}

function getSampleIntervalIndex(number, intervals = sampleIntervals) {
  return intervals.findIndex((interval) => number >= interval.min && number <= interval.max);
}

function canPlaceSampleNumber(row, zone, number) {
  const cell = getCell(row, zone, number);
  return Boolean(cell);
}

function pickSampleEntries(entries, limit, predicate, selectedMap, row, zone) {
  for (const entry of entries) {
    if (selectedMap.size >= limit) break;
    if (selectedMap.has(entry.number)) continue;
    if (!predicate(entry)) continue;
    if (!canPlaceSampleNumber(row, zone, entry.number)) continue;
    selectedMap.set(entry.number, entry);
  }
}

function selectSampleNumbersByRatio(entries, ratio, row, zone, pickCount = samplePickCount, intervals = sampleIntervals) {
  const selected = new Map();
  let remaining = pickCount;

  ratio.forEach((targetCount, intervalIndex) => {
    if (remaining <= 0) return;
    const nextLimit = selected.size + Math.min(Math.max(targetCount, 0), remaining);
    pickSampleEntries(entries, nextLimit, (entry) => getSampleIntervalIndex(entry.number, intervals) === intervalIndex, selected, row, zone);
    remaining = pickCount - selected.size;
  });

  if (selected.size < pickCount) {
    pickSampleEntries(entries, pickCount, () => true, selected, row, zone);
  }

  return [...selected.values()].map((entry) => entry.number);
}

function selectSampleNumbers(entries, row, zone, pickCount) {
  return selectSampleNumbersByRatio(entries, [], row, zone, pickCount, []);
}

function getActiveSampleRatios() {
  const presetKey = sampleRatioModeInput?.value || "";
  if (!presetKey) return [];
  return sampleRatioPresets[presetKey] || [];
}

function getSampleRatioText(ratio = []) {
  return Array.isArray(ratio) && ratio.length ? ratio.join(":") : "自由";
}

function getSampleRatioKey(numbers = [], intervals = sampleIntervals) {
  const counts = intervals.map(() => 0);
  (Array.isArray(numbers) ? numbers : []).forEach((number) => {
    const intervalIndex = getSampleIntervalIndex(number, intervals);
    if (intervalIndex >= 0) counts[intervalIndex] += 1;
  });
  return counts.join(":");
}

function buildSampleRatioSupportMap(sourceBalls = [], intervals = sampleIntervals) {
  const rowMap = new Map();
  (Array.isArray(sourceBalls) ? sourceBalls : []).forEach((ball) => {
    if (!ball || !Number.isInteger(ball.row)) return;
    const numbers = rowMap.get(ball.row) || [];
    numbers.push(ball.number);
    rowMap.set(ball.row, numbers);
  });

  const supportMap = new Map();
  rowMap.forEach((numbers) => {
    const ratioKey = getSampleRatioKey(numbers, intervals);
    supportMap.set(ratioKey, (supportMap.get(ratioKey) || 0) + 1);
  });
  return supportMap;
}

function buildSamplePlusTenTrendMap(selectedRow, zone = "front", sourceColor = sampleRedColor, intervals = sampleIntervals) {
  const rowMap = new Map();
  collectBalls()
    .filter((ball) => {
      return ball.zone === zone &&
        ball.row >= 1 &&
        ball.row <= drawRows &&
        ballHasColor(ball, sourceColor);
    })
    .forEach((ball) => {
      const numbers = rowMap.get(ball.row) || [];
      numbers.push(ball.number);
      rowMap.set(ball.row, numbers);
    });

  const selectedNumbers = getUniqueSortedSampleNumbers(rowMap.get(selectedRow) || []);
  if (selectedNumbers.length === 0) {
    return {
      targetMap: new Map(),
      neighborMap: new Map(),
    };
  }

  const selectedTails = new Set(selectedNumbers.map((number) => number % 10));
  const selectedTailNeighborSet = buildTailNeighborSet([...selectedTails]);
  const selectedRatioKey = zone === "front" ? getSampleRatioKey(selectedNumbers, intervals) : "";
  const selectedIntervalCounts = intervals.map(() => 0);
  if (zone === "front") {
    selectedNumbers.forEach((number) => {
      const idx = getSampleIntervalIndex(number, intervals);
      if (idx >= 0) selectedIntervalCounts[idx] += 1;
    });
  }

  const targetMap = new Map();
  const neighborMap = new Map();

  // 🆕 间隔9+10并集池策略（权重优化：0.7间隔9 + 0.3间隔10）
  const intervalConfigs = [{ interval: 9, weight: 0.7 }, { interval: 10, weight: 0.3 }];

  for (const config of intervalConfigs) {
    const { interval, weight: intervalWeight } = config;
    const maxSourceRow = drawRows - interval;

    for (let sourceRow = 1; sourceRow <= maxSourceRow; sourceRow += 1) {
      if (sourceRow === selectedRow) continue;

      const sourceNumbers = getUniqueSortedSampleNumbers(rowMap.get(sourceRow) || []);
      const targetNumbers = getUniqueSortedSampleNumbers(rowMap.get(sourceRow + interval) || []);
      if (sourceNumbers.length === 0 || targetNumbers.length === 0) continue;

      const sourceSet = new Set(sourceNumbers);
      const sourceTails = new Set(sourceNumbers.map((number) => number % 10));
      const sourceTailNeighborSet = buildTailNeighborSet([...sourceTails]);
      const exactOverlap = selectedNumbers.filter((number) => sourceSet.has(number)).length;
      const neighborOverlap = selectedNumbers.filter((number) => sourceSet.has(number - 1) || sourceSet.has(number + 1)).length;
      const tailOverlap = selectedNumbers.filter((number) => sourceTails.has(number % 10)).length;
      const tailNeighborOverlap = selectedNumbers.filter((number) => sourceTailNeighborSet.has(number % 10)).length;
      const selectedTailSignal = sourceNumbers.filter((number) => selectedTails.has(number % 10)).length;
      const selectedTailNeighborSignal = sourceNumbers.filter((number) => selectedTailNeighborSet.has(number % 10)).length;

      let intervalSimilarity = 0;
      let ratioMatch = 0;
      if (zone === "front") {
        const sourceRatioKey = getSampleRatioKey(sourceNumbers, intervals);
        if (sourceRatioKey === selectedRatioKey) ratioMatch = 1;
        const sourceIntervalCounts = intervals.map(() => 0);
        sourceNumbers.forEach((number) => {
          const idx = getSampleIntervalIndex(number, intervals);
          if (idx >= 0) sourceIntervalCounts[idx] += 1;
        });
        const intervalDiff = sourceIntervalCounts.reduce((total, count, index) => {
          return total + Math.abs(count - selectedIntervalCounts[index]);
        }, 0);
        intervalSimilarity = Math.max(0, 6 - intervalDiff);
      }

      const rowDistance = Math.abs(sourceRow - selectedRow);
      const proximityBonus = rowDistance <= 3 ? 10 : rowDistance <= 6 ? 6 : rowDistance <= 10 ? 3 : 0;
      const weight =
        (exactOverlap * 18 +
        neighborOverlap * 10 +
        tailOverlap * 12 +          // 对齐optimized_picker尾号权重：8→12
        tailNeighborOverlap * 5 +   // 对齐optimized_picker尾号权重：4→5
        selectedTailSignal * 8 +    // 对齐optimized_picker尾号权重：5→8
        selectedTailNeighborSignal * 3 + // 对齐optimized_picker尾号权重：2→3
        ratioMatch * 16 +
        intervalSimilarity * 3 +
        proximityBonus) * intervalWeight;

      if (weight <= 0) continue;

      targetNumbers.forEach((number) => {
        targetMap.set(number, (targetMap.get(number) || 0) + weight);
        for (let d = 1; d <= 3; d++) {
          [number - d, number + d].forEach((nb) => {
            if (nb < 1 || nb > zones[zone].max) return;
            const nbWeight = Math.max(1, Math.round(weight * 0.4 * (1 - d * 0.2)));
            neighborMap.set(nb, (neighborMap.get(nb) || 0) + nbWeight);
          });
        }
      });
    }
  }

  return {
    targetMap,
    neighborMap,
  };
}

function getSampleComboKey(numbers = []) {
  return [...numbers].sort((left, right) => left - right).map(pad).join("-");
}

function compareSampleCombos(left, right) {
  if ((right?.score || 0) !== (left?.score || 0)) return (right?.score || 0) - (left?.score || 0);
  if ((right?.explainableCount || 0) !== (left?.explainableCount || 0)) return (right?.explainableCount || 0) - (left?.explainableCount || 0);
  if ((right?.explainCoverageBonus || 0) !== (left?.explainCoverageBonus || 0)) return (right?.explainCoverageBonus || 0) - (left?.explainCoverageBonus || 0);
  if ((right?.transformedCount || 0) !== (left?.transformedCount || 0)) return (right?.transformedCount || 0) - (left?.transformedCount || 0);
  if ((right?.transformDiversityBonus || 0) !== (left?.transformDiversityBonus || 0)) return (right?.transformDiversityBonus || 0) - (left?.transformDiversityBonus || 0);
  if ((right?.farOffsetCount || 0) !== (left?.farOffsetCount || 0)) return (right?.farOffsetCount || 0) - (left?.farOffsetCount || 0);
  if ((right?.farOffsetBonus || 0) !== (left?.farOffsetBonus || 0)) return (right?.farOffsetBonus || 0) - (left?.farOffsetBonus || 0);
  if ((left?.anchorKeepPenalty || 0) !== (right?.anchorKeepPenalty || 0)) return (left?.anchorKeepPenalty || 0) - (right?.anchorKeepPenalty || 0);
  if ((right?.anchorCoverageCount || 0) !== (left?.anchorCoverageCount || 0)) return (right?.anchorCoverageCount || 0) - (left?.anchorCoverageCount || 0);
  if ((right?.anchorCoverageBonus || 0) !== (left?.anchorCoverageBonus || 0)) return (right?.anchorCoverageBonus || 0) - (left?.anchorCoverageBonus || 0);
  if ((right?.anchorTransformScore || 0) !== (left?.anchorTransformScore || 0)) return (right?.anchorTransformScore || 0) - (left?.anchorTransformScore || 0);
  if ((right?.anchorRunSupportHits || 0) !== (left?.anchorRunSupportHits || 0)) return (right?.anchorRunSupportHits || 0) - (left?.anchorRunSupportHits || 0);
  if ((right?.anchorKeepHits || 0) !== (left?.anchorKeepHits || 0)) return (right?.anchorKeepHits || 0) - (left?.anchorKeepHits || 0);
  if ((right?.referenceSatisfiedRows || 0) !== (left?.referenceSatisfiedRows || 0)) return (right?.referenceSatisfiedRows || 0) - (left?.referenceSatisfiedRows || 0);
  if ((right?.referenceMatchScore || 0) !== (left?.referenceMatchScore || 0)) return (right?.referenceMatchScore || 0) - (left?.referenceMatchScore || 0);
  if ((left?.spreadPenalty || 0) !== (right?.spreadPenalty || 0)) return (left?.spreadPenalty || 0) - (right?.spreadPenalty || 0);
  if ((left?.maxWindowCount || 0) !== (right?.maxWindowCount || 0)) return (left?.maxWindowCount || 0) - (right?.maxWindowCount || 0);
  if ((right?.span || 0) !== (left?.span || 0)) return (right?.span || 0) - (left?.span || 0);
  if ((left?.repeatPenalty || 0) !== (right?.repeatPenalty || 0)) return (left?.repeatPenalty || 0) - (right?.repeatPenalty || 0);
  if ((left?.repeatNumbersCount || 0) !== (right?.repeatNumbersCount || 0)) return (left?.repeatNumbersCount || 0) - (right?.repeatNumbersCount || 0);
  const leftNoRun = (left?.runSegmentCount || 0) === 0 ? 1 : 0;
  const rightNoRun = (right?.runSegmentCount || 0) === 0 ? 1 : 0;
  if (rightNoRun !== leftNoRun) return rightNoRun - leftNoRun;
  const leftWithinDouble = (left?.longestRun || 0) <= 2 ? 1 : 0;
  const rightWithinDouble = (right?.longestRun || 0) <= 2 ? 1 : 0;
  if (rightWithinDouble !== leftWithinDouble) return rightWithinDouble - leftWithinDouble;
  if ((left?.runSegmentCount || 0) !== (right?.runSegmentCount || 0)) return (left?.runSegmentCount || 0) - (right?.runSegmentCount || 0);
  if ((left?.doubleRunCount || 0) !== (right?.doubleRunCount || 0)) return (left?.doubleRunCount || 0) - (right?.doubleRunCount || 0);
  if ((left?.longestRun || 0) !== (right?.longestRun || 0)) return (left?.longestRun || 0) - (right?.longestRun || 0);
  if ((left?.runPenalty || 0) !== (right?.runPenalty || 0)) return (left?.runPenalty || 0) - (right?.runPenalty || 0);
  if ((right?.ratioSupport || 0) !== (left?.ratioSupport || 0)) return (right?.ratioSupport || 0) - (left?.ratioSupport || 0);
  return String(left?.key || "").localeCompare(String(right?.key || ""));
}

function getSampleComboSpreadMetrics(numbers = [], intervals = sampleIntervals) {
  const sortedNumbers = getUniqueSortedSampleNumbers(numbers);
  if (sortedNumbers.length <= 1) {
    return {
      span: 0,
      spreadPenalty: 0,
      maxWindowCount: sortedNumbers.length,
      maxIntervalCount: sortedNumbers.length,
    };
  }

  const span = sortedNumbers[sortedNumbers.length - 1] - sortedNumbers[0];
  let spreadPenalty = 0;
  let maxWindowCount = 0;
  const denseWindowWidth = 8;
  const intervalCounts = (Array.isArray(intervals) ? intervals : []).map(() => 0);

  sortedNumbers.forEach((number) => {
    const intervalIndex = getSampleIntervalIndex(number, intervals);
    if (intervalIndex >= 0) intervalCounts[intervalIndex] += 1;
  });

  const coveredIntervalCount = intervalCounts.filter((count) => count > 0).length;
  const maxIntervalCount = intervalCounts.length > 0 ? Math.max(...intervalCounts) : sortedNumbers.length;

  if (coveredIntervalCount >= 3) {
    if (span <= 18) spreadPenalty += 2;
    if (span <= 16) spreadPenalty += 6;
    if (span <= 13) spreadPenalty += 10;
    if (span <= 10) spreadPenalty += 16;
  } else if (coveredIntervalCount === 2) {
    if (span <= 12) spreadPenalty += 3;
    if (span <= 10) spreadPenalty += 7;
    if (span <= 8) spreadPenalty += 12;
    if (span <= 6) spreadPenalty += 16;
  } else {
    if (span <= 7) spreadPenalty += 2;
    if (span <= 5) spreadPenalty += 6;
    if (span <= 3) spreadPenalty += 10;
  }

  for (let startIndex = 0; startIndex < sortedNumbers.length; startIndex += 1) {
    let endIndex = startIndex;
    while (endIndex < sortedNumbers.length && sortedNumbers[endIndex] - sortedNumbers[startIndex] <= denseWindowWidth) {
      endIndex += 1;
    }
    const count = endIndex - startIndex;
    maxWindowCount = Math.max(maxWindowCount, count);
    if (coveredIntervalCount >= 3) {
      if (count >= 4) {
        spreadPenalty += 14 + (count - 4) * 8;
      } else if (count === 3) {
        spreadPenalty += 4;
      }
    } else if (coveredIntervalCount === 2) {
      if (count >= 4) {
        spreadPenalty += 10 + (count - 4) * 6;
      }
    } else {
      if (count >= 4) {
        spreadPenalty += 8 + (count - 4) * 4;
      }
    }
  }

  if (coveredIntervalCount >= 3) {
    if (maxIntervalCount >= 4) {
      spreadPenalty += 10 + (maxIntervalCount - 4) * 6;
    }
  } else if (coveredIntervalCount === 2) {
    if (maxIntervalCount >= 4) {
      spreadPenalty += 8 + (maxIntervalCount - 4) * 4;
    }
  }

  return { span, spreadPenalty, maxWindowCount, maxIntervalCount, coveredIntervalCount };
}

// ======================== 四个新评分机制 ========================

// 机制1: 首选邻号加分（与选中行首选号码±1的邻号获得优先奖励）
// 核心思想：锚点号码的±1邻号是"首选延伸"，在历史数据中高频出现
function evaluateSamplePrimaryAdjacent(number, anchors = [], anchorSet = null) {
  const anchorSorted = getUniqueSortedSampleNumbers(anchors);
  const anchorNumberSet = anchorSet || new Set(anchorSorted);
  let score = 0;
  // 锚点本身也检查是否与其他锚点相邻，但权重减半（避免完全归零导致锚点被挤出选号池）
  if (anchorNumberSet.has(number)) {
    let anchorNeighborScore = 0;
    for (let i = 0; i < anchorSorted.length; i++) {
      const anchor = anchorSorted[i];
      if (anchor === number) continue;
      if (Math.abs(number - anchor) === 1) {
        anchorNeighborScore += 2; // 锚点间相邻给半分(原4分的一半)
      }
    }
    return anchorNeighborScore;
  }
  for (let i = 0; i < anchorSorted.length; i++) {
    const anchor = anchorSorted[i];
    if (Math.abs(number - anchor) === 1) {
      score += 4;
    }
  }
  return score;
}

// 机制2b: 跨行桥接（选中行号码和锚点号码共同作为端点，中间号码加分）
// 例如：选中行有9,10，锚点有14，则11,12,13获得桥接加分
function evaluateSampleCrossRowBridging(comboNumbers = [], anchors = [], selectedNumbers = []) {
  const endpoints = [...new Set([...getUniqueSortedSampleNumbers(anchors), ...getUniqueSortedSampleNumbers(selectedNumbers)])].sort((a, b) => a - b);
  const comboSet = new Set(comboNumbers);
  let score = 0;

  for (let leftIndex = 0; leftIndex < endpoints.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < endpoints.length; rightIndex++) {
      const left = endpoints[leftIndex];
      const right = endpoints[rightIndex];
      const gap = right - left;
      if (gap <= 1 || gap > 10) continue;

      const betweenNumbers = [];
      for (let n = left + 1; n < right; n++) {
        if (comboSet.has(n)) betweenNumbers.push(n);
      }
      if (betweenNumbers.length === 0) continue;

      const isNear = gap <= 6;
      const closeness = isNear ? Math.max(1, 7 - gap) : Math.max(1, 11 - gap);
      const baseFull = isNear ? 20 : 10;
      const basePer = isNear ? 5 : 2;
      if (betweenNumbers.length === gap - 1) {
        score += baseFull + closeness * 6;
      } else {
        score += betweenNumbers.length * (basePer + closeness * 2);
      }
    }
  }
  return score;
}

// 机制2: 优先桥接加分（组合中号码在两个锚点之间，构成桥接结构）
// 完全填满间隙的组合获得高分，部分填充也获得奖励
// 桥接间距10以内，优先6以内（6以内加分更高）
function evaluateSamplePriorityBridging(comboNumbers = [], anchors = []) {
  const anchorSorted = getUniqueSortedSampleNumbers(anchors);
  const comboSet = new Set(comboNumbers);
  let score = 0;

  for (let leftIndex = 0; leftIndex < anchorSorted.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < anchorSorted.length; rightIndex++) {
      const left = anchorSorted[leftIndex];
      const right = anchorSorted[rightIndex];
      const gap = right - left;
      if (gap <= 1 || gap > 10) continue;

      // 统计组合中处于该间隙的号码
      const betweenNumbers = [];
      for (let n = left + 1; n < right; n++) {
        if (comboSet.has(n)) betweenNumbers.push(n);
      }
      if (betweenNumbers.length === 0) continue;

      // 间距6以内优先：基础分更高
      const isNear = gap <= 6;
      const closeness = isNear ? Math.max(1, 7 - gap) : Math.max(1, 11 - gap);
      const baseFull = isNear ? 28 : 14;
      const basePer = isNear ? 6 : 3;
      // 完全填满：组合号码完美桥接两个锚点
      if (betweenNumbers.length === gap - 1) {
        score += baseFull + closeness * 8;
      } else {
        score += betweenNumbers.length * (basePer + closeness * 2);
      }
      // 端点也在组合中额外奖励
      if (comboSet.has(left)) score += isNear ? 4 : 2;
      if (comboSet.has(right)) score += isNear ? 4 : 2;
    }
  }
  return score;
}

// 机制3: 邻号频次加分（锚点号码±1的邻号在支持窗口中出现越多，加分越高）
// 与首选邻号不同，这是基于窗口统计的频次加权
function evaluateSampleAdjacentFrequency(number, anchors = [], anchorSet = null) {
  const anchorSorted = getUniqueSortedSampleNumbers(anchors);
  const anchorNumberSet = anchorSet || new Set(anchorSorted);
  let freq = 0;
  for (let i = 0; i < anchorSorted.length; i++) {
    const anchor = anchorSorted[i];
    if (anchor === number) continue;
    if (Math.abs(number - anchor) === 1) {
      freq += 1;
    }
  }
  // 锚点本身如果是其他锚点的邻号，给减半的频次分
  if (anchorNumberSet.has(number)) {
    return freq; // 原为 freq*2，锚点减半为 freq*1
  }
  // freq: 该号码是多少个锚点的邻号（最大=锚点数量）
  return freq * 2;
}

// 机制4: 等差三元组检测（组合号码与锚点构成完整等差序列时加分）
// 三种模式：组合-锚点-组合 / 锚点-组合-组合 / 组合-组合-锚点
// 等差差值10以内，优先6以内（6以内加分更高）
function evaluateSampleArithmeticTriplets(comboNumbers = [], anchors = []) {
  const anchorSorted = getUniqueSortedSampleNumbers(anchors);
  const comboSet = new Set(comboNumbers);
  let arithPairCount = 0;
  let score = 0;

  // 先统计等差对数量（轻量检测）
  for (let i = 0; i < anchorSorted.length; i++) {
    const anchor = anchorSorted[i];
    // 模式1: 组合-锚点-组合 (锚点在中间)
    for (let d = 1; d <= 10; d++) {
      const left = anchor - d;
      const right = anchor + d;
      if (left >= 1 && right <= 35 && comboSet.has(left) && comboSet.has(right)) {
        arithPairCount++;
      }
    }
    // 模式2: 锚点-组合-组合 (锚点在左)
    for (let d = 1; d <= 10; d++) {
      const second = anchor + d;
      const third = second + d;
      if (second <= 35 && third <= 35 && comboSet.has(second) && comboSet.has(third)) {
        arithPairCount++;
      }
    }
    // 模式3: 组合-组合-锚点 (锚点在右)
    for (let d = 1; d <= 10; d++) {
      const first = anchor - 2 * d;
      const second = anchor - d;
      if (first >= 1 && second >= 1 && comboSet.has(first) && comboSet.has(second)) {
        arithPairCount++;
      }
    }
  }

  // 仅在等差对≥2时启用加分（避免无等差结构的组合被误判）
  if (arithPairCount < 2) return 0;

  for (let i = 0; i < anchorSorted.length; i++) {
    const anchor = anchorSorted[i];
    // 模式1: 锚点在中间（最稳定的等差结构）
    for (let d = 1; d <= 10; d++) {
      const left = anchor - d;
      const right = anchor + d;
      if (left >= 1 && right <= 35 && comboSet.has(left) && comboSet.has(right)) {
        // 差值6以内优先：d<=6给高分，d>6给较低分
        const baseScore = d <= 6 ? 6 : 3;
        const distBonus = d <= 6 ? Math.max(1, 8 - d) : Math.max(1, 11 - d);
        score += baseScore + distBonus;
      }
    }
    // 模式2: 锚点在左
    for (let d = 1; d <= 10; d++) {
      const second = anchor + d;
      const third = second + d;
      if (second <= 35 && third <= 35 && comboSet.has(second) && comboSet.has(third)) {
        // 差值6以内优先：d<=6给高分，d>6给较低分
        const baseScore = d <= 6 ? 5 : 2;
        const distBonus = d <= 6 ? Math.max(1, 7 - d) : Math.max(1, 11 - d);
        score += baseScore + distBonus;
      }
    }
    // 模式3: 锚点在右
    for (let d = 1; d <= 10; d++) {
      const first = anchor - 2 * d;
      const second = anchor - d;
      if (first >= 1 && second >= 1 && comboSet.has(first) && comboSet.has(second)) {
        // 差值6以内优先：d<=6给高分，d>6给较低分
        const baseScore = d <= 6 ? 5 : 2;
        const distBonus = d <= 6 ? Math.max(1, 7 - d) : Math.max(1, 11 - d);
        score += baseScore + distBonus;
      }
    }
  }
  return score;
}

// === 尾号信号函数（重复+相邻+重复相连） ===
function calculateSampleTailSignal(comboNumbers, anchors) {
  const aTails = anchors.map(n => n % 10);
  const cTails = comboNumbers.map(n => n % 10);
  
  let score = 0;
  
  // 1. 尾号重复：奖励1-3个重叠
  const aTailSet = new Set(aTails);
  const matchCount = comboNumbers.filter(n => aTailSet.has(n % 10)).length;
  if (matchCount >= 1 && matchCount <= 3) score += matchCount * 5;
  
  // 2. 尾号相邻：候选尾号与锚点尾号±1（模10）
  const aUniqueTails = [...new Set(aTails)];
  const cUniqueTails = [...new Set(cTails)];
  const usedPairs = new Set();
  
  cUniqueTails.forEach(ct => {
    aUniqueTails.forEach(at => {
      const rawDiff = Math.abs(ct - at);
      const isAdj = rawDiff === 1 || rawDiff === 9;
      if (!isAdj) return;
      const pairKey = `${Math.min(ct, at)}-${Math.max(ct, at)}`;
      if (usedPairs.has(pairKey)) return;
      usedPairs.add(pairKey);
      score += 2;
      const adjCount = aUniqueTails.filter(at2 => {
        const d = Math.abs(ct - at2);
        return d === 1 || d === 9;
      }).length;
      if (adjCount >= 2) score += 1;
    });
  });
  
  // 双方都有相邻模式加分
  const cAdjPairs = [];
  for (let i = 0; i < cUniqueTails.length; i++) {
    for (let j = i + 1; j < cUniqueTails.length; j++) {
      const d = Math.abs(cUniqueTails[i] - cUniqueTails[j]);
      if (d === 1 || d === 9) cAdjPairs.push([cUniqueTails[i], cUniqueTails[j]]);
    }
  }
  const aAdjPairs = [];
  for (let i = 0; i < aUniqueTails.length; i++) {
    for (let j = i + 1; j < aUniqueTails.length; j++) {
      const d = Math.abs(aUniqueTails[i] - aUniqueTails[j]);
      if (d === 1 || d === 9) aAdjPairs.push([aUniqueTails[i], aUniqueTails[j]]);
    }
  }
  if (cAdjPairs.length > 0 && aAdjPairs.length > 0) {
    score += Math.min(cAdjPairs.length, aAdjPairs.length) * 3;
  }
  
  // 3. 尾号重复相连：锚点有重复尾号或相连尾号时，候选也应有类似模式
  const aTailCount = {};
  aTails.forEach(t => { aTailCount[t] = (aTailCount[t] || 0) + 1; });
  const cTailCount = {};
  cTails.forEach(t => { cTailCount[t] = (cTailCount[t] || 0) + 1; });
  
  const aRepeated = Object.entries(aTailCount).filter(([t, c]) => c >= 2).map(([t]) => parseInt(t));
  const cRepeated = Object.entries(cTailCount).filter(([t, c]) => c >= 2).map(([t]) => parseInt(t));
  
  // 锚点有重复尾号 → 候选也应有重复尾号
  if (aRepeated.length > 0) {
    score += cRepeated.length * 6;
    const matchedRepeat = aRepeated.filter(t => cRepeated.includes(t)).length;
    score += matchedRepeat * 8;
    aRepeated.forEach(at => {
      cRepeated.forEach(ct => {
        const d = Math.abs(at - ct);
        if (d === 1 || d === 9) score += 4;
      });
    });
  }
  
  // 锚点有相连尾号 → 候选也应有相连尾号
  const aSortedTails = [...new Set(aTails)].sort((a, b) => a - b);
  const cSortedTails = [...new Set(cTails)].sort((a, b) => a - b);
  
  const aConnectPairs = [];
  for (let i = 0; i < aSortedTails.length; i++) {
    for (let j = i + 1; j < aSortedTails.length; j++) {
      const d = aSortedTails[j] - aSortedTails[i];
      if (d === 1 || d === 9) aConnectPairs.push([aSortedTails[i], aSortedTails[j]]);
    }
  }
  const cConnectPairs = [];
  for (let i = 0; i < cSortedTails.length; i++) {
    for (let j = i + 1; j < cSortedTails.length; j++) {
      const d = cSortedTails[j] - cSortedTails[i];
      if (d === 1 || d === 9) cConnectPairs.push([cSortedTails[i], cSortedTails[j]]);
    }
  }
  
  if (aConnectPairs.length > 0 && cConnectPairs.length > 0) {
    score += Math.min(aConnectPairs.length, cConnectPairs.length) * 5;
    const exactMatch = aConnectPairs.filter(([a1, a2]) =>
      cConnectPairs.some(([c1, c2]) => a1 === c1 && a2 === c2)
    ).length;
    score += exactMatch * 6;
  }
  
  // 重复+相连组合模式
  aRepeated.forEach(rt => {
    const hasConnect = aConnectPairs.some(([a, b]) => a === rt || b === rt);
    if (hasConnect) {
      const cHasRepeat = cRepeated.includes(rt);
      const cHasConnect = cConnectPairs.some(([a, b]) => a === rt || b === rt);
      if (cHasRepeat && cHasConnect) score += 10;
      else if (cHasRepeat || cHasConnect) score += 4;
    }
  });
  
  return score;
}

function evaluateSampleAnchorTransform(numbers = [], anchorNumbers = [], selectedNumbers = []) {
  const comboNumbers = getUniqueSortedSampleNumbers(numbers);
  let anchors = getUniqueSortedSampleNumbers(anchorNumbers);
  const selectedNums = getUniqueSortedSampleNumbers(selectedNumbers);
  if (comboNumbers.length === 0 || anchors.length === 0) {
    return {
      anchorTransformScore: 0,
      anchorOffsetHits: 0,
      anchorKeepHits: 0,
      anchorRunSupportHits: 0,
      explainableCount: 0,
      explainCoverageBonus: 0,
      transformedCount: 0,
      transformDiversityBonus: 0,
      farOffsetCount: 0,
      farOffsetBonus: 0,
      anchorKeepPenalty: 0,
      anchorCoverageCount: 0,
      anchorCoverageBonus: 0,
      anchorCrowdPenalty: 0,
      fourMechanismBonus: 0,
      tailSignalBonus: 0,
      supportedRunNumbers: new Set(),
    };
  }

  // 限制锚点数量：当锚点>7时，只保留与其他锚点距离分最高的7个
  if (anchors.length > 7) {
    const anchorScores = anchors.map(a => {
      let score = 35; // 基础分
      anchors.forEach(other => {
        if (other === a) return;
        const d = Math.abs(a - other);
        const w = sampleAnchorOffsetWeights.get(d) || 0;
        score += w;
      });
      return { n: a, sc: score };
    }).sort((a, b) => b.sc - a.sc);
    anchors = anchorScores.slice(0, 7).map(x => x.n).sort((a, b) => a - b);
  }

  const comboSet = new Set(comboNumbers);
  const anchorSet = new Set(anchors);
  const supportedRunNumbers = new Set();
  const explainableNumbers = new Set();
  const explainedAnchors = new Map();
  const transformedNumbers = new Set();
  const farOffsetNumbers = new Set();
  let anchorTransformScore = 0;
  let anchorOffsetHits = 0;
  let anchorKeepHits = 0;
  let anchorRunSupportHits = 0;

  // === 新增：首选邻号加分（独立于anchorTransformScore，避免干扰后续bonus计算） ===
  let fourMechanismBonus = 0;

  comboNumbers.forEach((number) => {
    if (anchorSet.has(number)) {
      anchorKeepHits += 1;
      anchorTransformScore += 35; // 锚点保留基础分从16提升到35，让锚点排名更靠前
      explainableNumbers.add(number);
      explainedAnchors.set(number, (explainedAnchors.get(number) || 0) + 1);
    }

    anchors.forEach((anchor) => {
      const diff = Math.abs(number - anchor);
      const offsetScore = sampleAnchorOffsetWeights.get(diff) || 0;
      if (offsetScore <= 0) return;
      anchorOffsetHits += 1;
      anchorTransformScore += offsetScore;
      explainableNumbers.add(number);
      explainedAnchors.set(anchor, (explainedAnchors.get(anchor) || 0) + 1);
      if (!anchorSet.has(number)) transformedNumbers.add(number);
      if (diff >= 4 || diff === 7) farOffsetNumbers.add(number);
    });

    // 机制1: 首选邻号加分 — 锚点±1邻号获得优先奖励
    fourMechanismBonus += evaluateSamplePrimaryAdjacent(number, anchors, anchorSet);
    // 机制3: 邻号频次加分 — 被多个锚点共享的邻号获得额外奖励
    fourMechanismBonus += evaluateSampleAdjacentFrequency(number, anchors, anchorSet);
  });

  // 机制2: 桥接加分 — 组合号码在两个锚点之间构成桥接
  fourMechanismBonus += evaluateSamplePriorityBridging(comboNumbers, anchors);
  // 机制2b: 跨行桥接 — 选中行号码和锚点号码共同作为端点
  if (selectedNums.length > 0) {
    fourMechanismBonus += evaluateSampleCrossRowBridging(comboNumbers, anchors, selectedNums);
  }

  buildSampleConsecutiveSegments(anchors).forEach((segment) => {
    const start = segment[0];
    const end = segment[segment.length - 1];
    comboNumbers.forEach((number) => {
      const extendsRun = number >= start - 4 && number <= end + 4 && !anchorSet.has(number);
      if (!extendsRun) return;
      const distance = number < start ? start - number : number - end;
      if (distance < 1 || distance > 4) return;
      anchorRunSupportHits += 1;
      anchorTransformScore += 16 - distance * 2;
      supportedRunNumbers.add(number);
      explainableNumbers.add(number);
    });
  });

  buildSampleConsecutiveSegments(comboNumbers).forEach((segment) => {
    const supportedCount = segment.filter((number) => {
      if (supportedRunNumbers.has(number)) return true;
      return anchors.some((anchor) => Math.abs(number - anchor) <= 3);
    }).length;
    if (supportedCount >= Math.min(2, segment.length)) {
      segment.forEach((number) => supportedRunNumbers.add(number));
      segment.forEach((number) => explainableNumbers.add(number));
      anchorTransformScore += segment.length * 8;
      anchorRunSupportHits += supportedCount;
    }
  });

  const explainableCount = explainableNumbers.size;
  const transformedCount = transformedNumbers.size;
  const farOffsetCount = farOffsetNumbers.size;
  const anchorCoverageCount = explainedAnchors.size;
  const explainCoverageBonus = explainableCount >= comboNumbers.length
    ? comboNumbers.length * 14
    : explainableCount >= comboNumbers.length - 1
      ? explainableCount * 10
      : explainableCount >= 3
        ? explainableCount * 6
        : explainableCount * 2;
  const transformDiversityBonus = transformedCount >= comboNumbers.length - 1
    ? transformedCount * 16
    : transformedCount >= 3
      ? transformedCount * 11
      : transformedCount * 4;
  const farOffsetBonus = farOffsetCount >= 3
    ? farOffsetCount * 14
    : farOffsetCount >= 2
      ? farOffsetCount * 10
      : farOffsetCount * 3;
  // 优化：锚点保留改为奖励而非惩罚（直接命中锚点是强信号）
  // 1个保留：无变化；2个保留：+14奖励；3个保留：+28奖励；超过3个才开始惩罚
  const anchorKeepPenalty = anchorKeepHits >= 4 ? (anchorKeepHits - 3) * 14 : 0;
  const anchorKeepBonus = anchorKeepHits >= 2 && anchorKeepHits <= 3 ? (anchorKeepHits - 1) * 14 : 0;
  const anchorCoverageBonus = anchorCoverageCount >= 4
    ? anchorCoverageCount * 12
    : anchorCoverageCount >= 3
      ? anchorCoverageCount * 7
      : anchorCoverageCount * 2;
  const maxAnchorLoad = explainedAnchors.size > 0 ? Math.max(...explainedAnchors.values()) : 0;
  // V3优化：智能拥挤惩罚——基于集中度质量的折扣
  // 核心思想：如果高负载集中在少数锚点上（≤40%锚点超载），说明是合理集中模式
  const loads = [...explainedAnchors.values()];
  const overloadedAnchors = loads.filter(l => l >= 3).length;
  const totalAnchors = anchors.length;

  // 集中度折扣：少数锚点承载大部分负载 = 合理模式
  let crowdDiscount = 1.0;
  if (overloadedAnchors <= Math.ceil(totalAnchors * 0.4) && maxAnchorLoad <= 5) {
    crowdDiscount = 0.5;
  }

  const anchorCrowdPenalty = maxAnchorLoad >= 4
    ? Math.round((maxAnchorLoad - 3) * 12 * crowdDiscount)
    : (maxAnchorLoad >= 3 && overloadedAnchors >= Math.ceil(totalAnchors * 0.6)
      ? Math.round((maxAnchorLoad - 2) * 12 * 0.7) // 大量锚点超载才轻度惩罚
      : 0);

  // === 尾号信号（重复+相邻+重复相连，权重x3.5） ===
  const tailSignalBonus = calculateSampleTailSignal(comboNumbers, anchors) * 3.5;

  // === 同尾号中间优先：尾号相同时，优先13/23/33（中间号），弱化3（边缘号） ===
  let sameTailMiddleBonus = 0;
  const anchorTailSet = new Set(anchors.map(a => a % 10));
  comboNumbers.forEach(n => {
    if (anchorTailSet.has(n % 10)) {
      if (n >= 10 && n <= 33) sameTailMiddleBonus += 3;
    }
  });

  return {
    anchorTransformScore,
    anchorOffsetHits,
    anchorKeepHits,
    anchorRunSupportHits,
    explainableCount,
    explainCoverageBonus,
    transformedCount,
    transformDiversityBonus,
    farOffsetCount,
    farOffsetBonus,
    anchorKeepPenalty,
    anchorKeepBonus,
    anchorCoverageCount,
    anchorCoverageBonus,
    anchorCrowdPenalty,
    fourMechanismBonus: fourMechanismBonus || 0,
    tailSignalBonus: tailSignalBonus || 0,
    sameTailMiddleBonus: sameTailMiddleBonus || 0,
    supportedRunNumbers,
  };
}

function getSampleComboRepeatMetrics(entries = [], repeatTarget = null) {
  const repeatNumbers = (Array.isArray(entries) ? entries : []).filter((entry) => (entry?.repeatCount || 0) >= 2);
  const repeatNumbersCount = repeatNumbers.length;
  const normalizedTarget = Number.isInteger(repeatTarget) ? clamp(repeatTarget, 0, 3) : null;
  let repeatPenalty = 0;
  let repeatTargetBonus = 0;
  let repeatTargetMiss = 0;

  if (normalizedTarget === null) {
    if (repeatNumbersCount >= 1) repeatPenalty += 4;
    if (repeatNumbersCount >= 2) repeatPenalty += 6;
    if (repeatNumbersCount >= 3) repeatPenalty += 18 + (repeatNumbersCount - 3) * 8;
  } else {
    repeatTargetMiss = Math.abs(repeatNumbersCount - normalizedTarget);
    repeatPenalty += repeatTargetMiss * 18;
    if (repeatNumbersCount > 3) repeatPenalty += (repeatNumbersCount - 3) * 12;
    if (repeatTargetMiss === 0) repeatTargetBonus = 18;
  }

  return { repeatNumbersCount, repeatPenalty, repeatTarget: normalizedTarget, repeatTargetBonus, repeatTargetMiss };
}

function getSampleComboRunPenalty(numbers = [], supportedRunNumbers = new Set()) {
  const segments = buildSampleConsecutiveSegments(numbers);
  let longestRun = 0;
  let runPenalty = 0;
  let runSegmentCount = 0;
  let doubleRunCount = 0;
  let tripleOrMoreCount = 0;

  segments.forEach((segment) => {
    longestRun = Math.max(longestRun, segment.length);
    runSegmentCount += 1;
    const supportCount = segment.filter((number) => supportedRunNumbers.has(number)).length;
    const supportRatio = segment.length > 0 ? supportCount / segment.length : 0;
    const supportDiscount = supportRatio >= 0.8 ? 0.45 : supportRatio >= 0.6 ? 0.75 : 1;
    if (segment.length === 2) {
      doubleRunCount += 1;
      runPenalty += Math.round(8 * supportDiscount);
      return;
    }
    if (segment.length >= 4) {
      tripleOrMoreCount += 1;
      runPenalty += Math.round((70 + (segment.length - 4) * 16) * supportDiscount);
      return;
    }
    if (segment.length === 3) {
      tripleOrMoreCount += 1;
      runPenalty += Math.round(36 * supportDiscount);
    }
  });

  if (doubleRunCount >= 2) {
    runPenalty += (doubleRunCount - 1) * 6;
  }

  return { longestRun, runPenalty, runSegmentCount, doubleRunCount, tripleOrMoreCount };
}

function buildSampleComboRecord(entries, ratio = [], options = {}) {
  const cleanEntries = (Array.isArray(entries) ? entries : []).filter(Boolean);
  const numbers = cleanEntries.map((entry) => entry.number).sort((left, right) => left - right);
  const ratioKey = Array.isArray(ratio) && ratio.length ? ratio.join(":") : getSampleRatioKey(numbers, options.intervals || sampleIntervals);
  const applyRunPenalty = options.applyRunPenalty !== false;
  const applySpreadPenalty = options.applySpreadPenalty === true;
  const anchorTransform = evaluateSampleAnchorTransform(numbers, options.anchorNumbers || [], options.selectedNumbers || []);
  const {
    longestRun,
    runPenalty,
    runSegmentCount,
    doubleRunCount,
    tripleOrMoreCount,
  } = applyRunPenalty
    ? getSampleComboRunPenalty(numbers, anchorTransform.supportedRunNumbers)
    : { longestRun: 0, runPenalty: 0, runSegmentCount: 0, doubleRunCount: 0, tripleOrMoreCount: 0 };
  const { repeatNumbersCount, repeatPenalty, repeatTarget, repeatTargetBonus, repeatTargetMiss } = getSampleComboRepeatMetrics(cleanEntries, options.repeatTarget);
  const {
    span,
    spreadPenalty,
    maxWindowCount,
    maxIntervalCount,
    coveredIntervalCount,
  } = applySpreadPenalty
    ? getSampleComboSpreadMetrics(numbers, options.intervals || sampleIntervals)
    : { span: 0, spreadPenalty: 0, maxWindowCount: 0, maxIntervalCount: 0, coveredIntervalCount: 0 };
  const adjustedSpreadPenalty = anchorTransform.anchorRunSupportHits >= 2
    ? Math.round(spreadPenalty * 0.6)
    : spreadPenalty;

  // 🆕 V3.1: V4-style 硬过滤 — 极端组合重度扣分（等效丢弃）
  const v3FilterSum = numbers.reduce((a, b) => a + b, 0);
  const v3FilterOdd = numbers.filter((n) => n % 2 === 1).length;
  const v3FilterIv = [0, 0, 0];
  numbers.forEach((n) => { const idx = getSampleIntervalIndex(n, sampleIntervals); if (idx >= 0) v3FilterIv[idx]++; });
  let v3HardFilterPenalty = 0;
  if (v3FilterOdd === 0 || v3FilterOdd === 5) v3HardFilterPenalty = 600;   // 全奇或全偶
  if (span < 3 || span > 34) v3HardFilterPenalty = 800;                    // 跨度极端
  if (v3FilterSum < 25 || v3FilterSum > 160) v3HardFilterPenalty = 800;    // 和值极端
  if (longestRun > 3) v3HardFilterPenalty = 800;                           // 超三连
  if (v3FilterIv[0] >= 5 || v3FilterIv[2] >= 5) v3HardFilterPenalty = 800; // 单区间≥5球

  const selectedTailOverlapCount = cleanEntries.reduce((total, entry) => total + (entry.selectedTailHits || 0), 0);
  const selectedTailDeviation = Math.abs(selectedTailOverlapCount - 2);
  const selectedTailOverlapScore = selectedTailOverlapCount >= 1 && selectedTailOverlapCount <= 3
    ? 12 - selectedTailDeviation * 4
    : -selectedTailDeviation * 4;
  const referenceRows = Array.isArray(options.referenceRows) ? options.referenceRows : [];
  const referenceMatches = referenceRows.map((referenceRow) => ({
    row: referenceRow.row,
    ...evaluateSampleComboAgainstReference(numbers, referenceRow, options),
  }));
  const bestTailReference = referenceMatches.reduce((best, item) => {
    const currentScore =
      sampleSignalLevel(item.tailOverlap, 3) * sampleRuleWeight +
      sampleSignalLevel(item.strongestTailHits, 3) * sampleRuleWeight +
      sampleSignalLevel(item.overlap, 3) * sampleRuleWeight +
      sampleSignalLevel(item.neighborHits, 3) * sampleWeakRuleWeight;
    const bestScore = best
      ? sampleSignalLevel(best.tailOverlap, 3) * sampleRuleWeight +
        sampleSignalLevel(best.strongestTailHits, 3) * sampleRuleWeight +
        sampleSignalLevel(best.overlap, 3) * sampleRuleWeight +
        sampleSignalLevel(best.neighborHits, 3) * sampleWeakRuleWeight
      : -Infinity;
    return currentScore > bestScore ? item : best;
  }, null);
  const bestArithmeticReference = referenceMatches.reduce((best, item) => {
    const currentScore =
      (item.arithmeticScore || 0) +
      (item.arithmeticPairHits || 0) * 10 +
      (item.differenceTrendScore || 0) +
      (item.differenceTrendLongestRun || 0) * 8;
    const bestScore = best
      ? (best.arithmeticScore || 0) +
        (best.arithmeticPairHits || 0) * 10 +
        (best.differenceTrendScore || 0) +
        (best.differenceTrendLongestRun || 0) * 8
      : -Infinity;
    return currentScore > bestScore ? item : best;
  }, null);
  const bestBridgeReference = referenceMatches.reduce((best, item) => {
    const currentScore = (item.bridgeScore || 0) + (item.bridgePairHits || 0) * 10;
    const bestScore = best ? (best.bridgeScore || 0) + (best.bridgePairHits || 0) * 10 : -Infinity;
    return currentScore > bestScore ? item : best;
  }, null);
  const tailReferenceScore = bestTailReference
    ? sampleSignalLevel(bestTailReference.tailOverlap, 3) * sampleRuleWeight +
      sampleSignalLevel(bestTailReference.strongestTailHits, 3) * sampleRuleWeight +
      sampleSignalLevel(bestTailReference.overlap, 3) * sampleRuleWeight +
      sampleSignalLevel(bestTailReference.neighborHits, 3) * sampleWeakRuleWeight
    : 0;
  const arithmeticScore = bestArithmeticReference?.arithmeticScore || 0;
  const differenceTrendScore = bestArithmeticReference?.differenceTrendScore || 0;
  const differenceTrendLongestRun = bestArithmeticReference?.differenceTrendLongestRun || 0;
  const arithmeticEndpointHits = bestArithmeticReference?.arithmeticEndpointHits || 0;
  const arithmeticPairHits = bestArithmeticReference?.arithmeticPairHits || 0;
  const bridgeScore = bestBridgeReference?.bridgeScore || 0;
  const bridgeGapHits = bestBridgeReference?.bridgeGapHits || 0;
  const bridgeEndpointHits = bestBridgeReference?.bridgeEndpointHits || 0;
  const bridgePairHits = bestBridgeReference?.bridgePairHits || 0;
  const structuralReferenceScore = referenceMatches.reduce((total, item) => total +
    sampleSignalLevel(item.consecutiveSimilarity, 3) * sampleRuleWeight +
    sampleSignalLevel(item.longestRunSimilarity, 3) * sampleRuleWeight +
    sampleSignalLevel(item.segmentSupport, 3) * sampleRuleWeight +
    sampleSignalLevel(item.ratioMatch, 1) * sampleRuleWeight, 0);
  const referenceMatchScore = tailReferenceScore + arithmeticScore + bridgeScore + structuralReferenceScore;
  const referenceSatisfiedRows = referenceMatches.filter((item) => (item.matchedSignals || 0) >= 2).length;
  const referenceSoftMatchBonus = referenceSatisfiedRows > 0 ? referenceSatisfiedRows * 6 : 0;
  const structureBias = getSampleStructureBias(numbers, anchorTransform.anchorKeepHits, options.intervals || sampleIntervals);

  // === 区间比匹配加分：组合区间比匹配参考行最常见的区间比时大幅加分 ===
  const comboRatioKey = getSampleRatioKey(numbers, options.intervals || sampleIntervals);
  const refRatioFreq = new Map();
  referenceRows.forEach(ref => {
    if (ref.isSelectedRow) return;
    const rk = ref.ratioKey || getSampleRatioKey(ref.numbers || [], options.intervals || sampleIntervals);
    if (rk) refRatioFreq.set(rk, (refRatioFreq.get(rk) || 0) + 1);
  });
  let expectedRatio = null, expectedRatioCount = 0;
  let expectedRatioSpread = Infinity;
  refRatioFreq.forEach((count, ratio) => {
    const counts = ratio.split(":").map((value) => Number(value) || 0);
    const spread = counts.length > 0 ? Math.max(...counts) - Math.min(...counts) : Infinity;
    if (
      count > expectedRatioCount ||
      (count === expectedRatioCount && spread < expectedRatioSpread) ||
      (count === expectedRatioCount && spread === expectedRatioSpread && (expectedRatio === null || ratio < expectedRatio))
    ) {
      expectedRatioCount = count;
      expectedRatio = ratio;
      expectedRatioSpread = spread;
    }
  });
  const ratioMatchBonus = expectedRatio && comboRatioKey === expectedRatio ? 180 : 0;
  const expectedCoveredIntervals = expectedRatio
    ? expectedRatio.split(":").filter((count) => (Number(count) || 0) > 0).length
    : 0;
  const ratioMismatchPenalty = expectedRatio && comboRatioKey !== expectedRatio ? 200 : 0;
  // 极端分布惩罚：某个区间集中4+个号，5个全在同一区间惩罚更重
  const comboIntervalCounts = (options.intervals || sampleIntervals).map(() => 0);
  numbers.forEach(n => {
    const idx = getSampleIntervalIndex(n, options.intervals || sampleIntervals);
    if (idx >= 0) comboIntervalCounts[idx]++;
  });
  const maxIntervalLoad = comboIntervalCounts.length > 0 ? Math.max(...comboIntervalCounts) : 0;
  const extremeRatioPenalty = maxIntervalLoad >= 5 ? (maxIntervalLoad - 4) * 200 : maxIntervalLoad >= 4 ? (maxIntervalLoad - 3) * 100 : 0;
  const intervalSkewPenalty = coveredIntervalCount <= 2 && maxIntervalLoad >= 3
    ? 80 + (maxIntervalLoad - 3) * 40 + (expectedCoveredIntervals >= 3 ? 60 : 0)
    : 0;

  // === 区间比约束评分：基于选中行区间比的转移规则 ===
  const selectedNumbers = Array.isArray(options.selectedNumbers) ? options.selectedNumbers : [];
  const selectedRatio = getSampleRatioKey(selectedNumbers, options.intervals || sampleIntervals);
  const selIv = (options.intervals || sampleIntervals).map(() => 0);
  selectedNumbers.forEach(n => {
    const idx = getSampleIntervalIndex(n, options.intervals || sampleIntervals);
    if (idx >= 0) selIv[idx]++;
  });
  // 恢复原版区间比约束
  let ratioConstraintScore = 0;
  for (let x = 0; x < 3; x++) {
    if (selIv[x] === 0 && comboIntervalCounts[x] >= 1) ratioConstraintScore += 15;
    if (selIv[x] <= 1 && comboIntervalCounts[x] >= 2) ratioConstraintScore += 8;
    if (selIv[x] >= 4 && comboIntervalCounts[x] <= 3) ratioConstraintScore += 10;
  }
  const maxDiff = Math.max(...comboIntervalCounts) - Math.min(...comboIntervalCounts);
  if (maxDiff <= 2) ratioConstraintScore += 5;

  // === 尾号连续/等差模式评分：目标行尾号几乎必然包含连续或等差序列 ===
  const comboTails = numbers.map(n => n % 10).sort((a, b) => a - b);
  const uniqueTails = [...new Set(comboTails)];
  let tailPatternScore = 0;
  // 连续尾号评分（差=1，长度>=2）
  let longestConsec = 1, currentConsec = 1;
  for (let i = 1; i < uniqueTails.length; i++) {
    if (uniqueTails[i] === uniqueTails[i - 1] + 1) {
      currentConsec++;
      longestConsec = Math.max(longestConsec, currentConsec);
    } else {
      currentConsec = 1;
    }
  }
  if (longestConsec >= 3) tailPatternScore += 40;
  else if (longestConsec >= 2) tailPatternScore += 20;
  // 等差尾号评分（差>=2，长度>=3）
  let hasAP3 = false, hasAP4 = false;
  for (let d = 2; d <= 4; d++) {
    for (let start = 0; start <= 9 - d * 2; start++) {
      let count = 0;
      for (let v = start; v <= 9; v += d) {
        if (uniqueTails.includes(v)) count++;
        else break;
      }
      if (count >= 4) hasAP4 = true;
      if (count >= 3) hasAP3 = true;
    }
  }
  if (hasAP4) tailPatternScore += 30;
  else if (hasAP3) tailPatternScore += 15;

  // === 尾号重复评分：移除（分析显示对命中率提升有限） ===
  const selectedTails = [...new Set(selectedNumbers.map(n => n % 10))];
  const tailOverlapCount = uniqueTails.filter(t => selectedTails.includes(t)).length;
  const tailOverlapScore = 0;
  const wideCoverageBonus = coveredIntervalCount >= 3
    ? span >= 26
      ? 60
      : span >= 23
        ? 24
        : 0
    : 0;

  const rawScore = cleanEntries.reduce((total, entry) => total + (entry.score || 0), 0);
  return {
    entries: cleanEntries,
    numbers,
    score: rawScore +
      referenceMatchScore * sampleComboScoreWeights.referenceMatchMultiplier +
      referenceSoftMatchBonus * sampleComboScoreWeights.referenceSoftMatchMultiplier +
      repeatTargetBonus +
      anchorTransform.anchorTransformScore * sampleComboScoreWeights.anchorTransformMultiplier +
      anchorTransform.explainCoverageBonus * sampleComboScoreWeights.explainCoverageMultiplier +
      anchorTransform.transformDiversityBonus * sampleComboScoreWeights.transformDiversityMultiplier +
      anchorTransform.farOffsetBonus * sampleComboScoreWeights.farOffsetMultiplier +
      anchorTransform.anchorCoverageBonus * sampleComboScoreWeights.anchorCoverageMultiplier +
      (anchorTransform.anchorKeepBonus || 0) +
      (anchorTransform.fourMechanismBonus || 0) +
      (anchorTransform.tailSignalBonus || 0) +
      (anchorTransform.sameTailMiddleBonus || 0) -
      anchorTransform.anchorCrowdPenalty * sampleComboScoreWeights.anchorCrowdPenaltyMultiplier -
      anchorTransform.anchorKeepPenalty * sampleComboScoreWeights.anchorKeepPenaltyMultiplier -
      runPenalty * sampleComboScoreWeights.runPenaltyMultiplier -
      repeatPenalty -
      adjustedSpreadPenalty * sampleComboScoreWeights.spreadPenaltyMultiplier +
      (coveredIntervalCount >= 3 ? 42 : coveredIntervalCount >= 2 ? 12 : 0) +
      wideCoverageBonus +
      ratioMatchBonus -
      ratioMismatchPenalty -
      extremeRatioPenalty -
      intervalSkewPenalty +
      ratioConstraintScore * 3 +
      tailPatternScore +
      structureBias.bonus +
      tailOverlapScore -
      v3HardFilterPenalty +  // 🆕 V3.1: V4式硬过滤惩罚
      // 🆕 连号概率奖励（基于历史分布：50%无连号, 38.2%双连号, 5.9%三连号）
      (doubleRunCount === 0 && tripleOrMoreCount === 0 ? 3 :   // 无连号：50%概率
       doubleRunCount === 1 && tripleOrMoreCount === 0 ? 5 :   // 1组双连号：38.2%概率
       doubleRunCount === 0 && tripleOrMoreCount === 1 ? 3 :   // 1组三连号：5.9%概率
       doubleRunCount === 1 && tripleOrMoreCount === 1 ? 2 :   // 双+三：1.5%概率
       0) +
      // 🆕 首位球规律加分（基于119期历史：95.8%首位球≤15，86.6%≤10）
      (numbers[0] <= 5 ? 12 : numbers[0] <= 10 ? 8 : numbers[0] <= 15 ? 4 : numbers[0] >= 18 ? -15 : 0),
    rawScore,
    anchorTransformScore: anchorTransform.anchorTransformScore,
    anchorOffsetHits: anchorTransform.anchorOffsetHits,
    anchorKeepHits: anchorTransform.anchorKeepHits,
    anchorRunSupportHits: anchorTransform.anchorRunSupportHits,
    explainableCount: anchorTransform.explainableCount,
    explainCoverageBonus: anchorTransform.explainCoverageBonus,
    transformedCount: anchorTransform.transformedCount,
    transformDiversityBonus: anchorTransform.transformDiversityBonus,
    farOffsetCount: anchorTransform.farOffsetCount,
    farOffsetBonus: anchorTransform.farOffsetBonus,
    anchorKeepPenalty: anchorTransform.anchorKeepPenalty,
    anchorCoverageCount: anchorTransform.anchorCoverageCount,
    anchorCoverageBonus: anchorTransform.anchorCoverageBonus,
    anchorCrowdPenalty: anchorTransform.anchorCrowdPenalty,
    arithmeticEndpointHits,
    arithmeticPairHits,
    arithmeticScore,
    differenceTrendScore,
    differenceTrendLongestRun,
    bridgeScore,
    bridgeGapHits,
    bridgeEndpointHits,
    bridgePairHits,
    bestTailReferenceRow: bestTailReference?.row || null,
    bestArithmeticReferenceRow: bestArithmeticReference?.row || null,
    bestBridgeReferenceRow: bestBridgeReference?.row || null,
    referenceMatchScore,
    referenceSoftMatchBonus,
    referenceSatisfiedRows,
    referenceMatches,
    longestRun,
    runPenalty,
    span,
    spreadPenalty: adjustedSpreadPenalty,
    rawSpreadPenalty: spreadPenalty,
    maxWindowCount,
    maxIntervalCount,
    coveredIntervalCount,
    ratioMatchBonus,
    ratioMismatchPenalty,
    extremeRatioPenalty,
    intervalSkewPenalty,
    ratioConstraintScore,
    wideCoverageBonus,
    expectedRatio,
    comboRatioKey,
    tailPatternScore,
    tailOverlapScore,
    tailOverlapCount,
    structureBonus: structureBias.bonus,
    structureRatioKey: structureBias.ratioKey,
    structureOddCount: structureBias.oddCount,
    repeatNumbersCount,
    repeatPenalty,
    repeatTarget,
    repeatTargetBonus,
    repeatTargetMiss,
    runSegmentCount,
    doubleRunCount,
    tripleOrMoreCount,
    bridgeScore: cleanEntries.reduce((total, entry) => total + (entry.bridgeScore || 0), 0),
    templateScore: cleanEntries.reduce((total, entry) => total + (entry.templateScore || 0), 0),
    integrityBonus: cleanEntries.reduce((total, entry) => total + (entry.integrityBonus || 0), 0),
    fromRepeat: cleanEntries.reduce((total, entry) => total + (entry.fromRepeat || 0), 0),
    fromTail: cleanEntries.reduce((total, entry) => total + (entry.fromTail || 0), 0),
    selectedTailOverlapCount,
    selectedTailOverlapScore,
    selectedTailDeviation,
    tailStrength: cleanEntries.reduce((total, entry) => total + (entry.tailCount || 0) + (entry.lastRowTailHits || 0) + (entry.tailPatternScore || 0), 0),
    bridgeHits: cleanEntries.reduce((total, entry) => total + (entry.bridgeHits || 0), 0),
    bridgeSupport: cleanEntries.reduce((total, entry) => total + (entry.bridgeSupport || 0), 0),
    templateHits: cleanEntries.reduce((total, entry) => total + (entry.templateHits || 0), 0),
    neighborHits: cleanEntries.reduce((total, entry) => total + (entry.neighborHits || 0), 0),
    ratio: Array.isArray(ratio) ? [...ratio] : [],
    ratioKey,
    ratioSupport: options.ratioSupportMap?.get(ratioKey) || 0,
  };
}

function buildSampleEntryCombinations(entries, pickCount, poolSize = sampleComboPoolSize, limit = sampleComboLimit, options = {}) {
  if (pickCount === 0) return [buildSampleComboRecord([], [], options)];
  const allEntries = (Array.isArray(entries) ? entries : []).slice(0, Math.max(pickCount, Math.min(poolSize, entries.length)));
  // 区间感知池构建：确保每个区间至少有代表号码
  const intervals = options.intervals || sampleIntervals;
  const minPerInterval = 3;
  const pool = [];
  const poolSet = new Set();
  if (options.intervalAware !== false && pickCount >= 5) {
    // 先统计已选号码（如选中行、锚点）在各区间的分布
    const intervalCounts = intervals.map(() => 0);
    allEntries.forEach(entry => {
      const idx = getSampleIntervalIndex(entry.number, intervals);
      if (idx >= 0) intervalCounts[idx]++;
    });
    // 每个区间至少保证minPerInterval个名额
    for (let iv = 0; iv < intervals.length; iv++) {
      const need = Math.max(0, minPerInterval - intervalCounts[iv]);
      if (need <= 0) continue;
      const candidates = allEntries.filter(e => !poolSet.has(e.number) && getSampleIntervalIndex(e.number, intervals) === iv);
      for (let i = 0; i < Math.min(need, candidates.length); i++) {
        pool.push(candidates[i]);
        poolSet.add(candidates[i].number);
      }
    }
  }
  // 剩余名额按得分填充
  allEntries.forEach(entry => {
    if (poolSet.has(entry.number)) return;
    if (pool.length >= Math.max(pickCount, Math.min(poolSize, allEntries.length))) return;
    pool.push(entry);
    poolSet.add(entry.number);
  });
  // 动态裁剪池大小：控制组合数 ≤ 5000，避免 C(35,5)=324632 穷举卡死
  // k=5 → pool≤14 (C(14,5)=2002), k=4 → pool≤17 (C(17,4)=2380), k=3 → pool≤28 (C(28,3)=3276), k=2 → pool≤35 (C(35,2)=595)
  const maxPoolByPick = pickCount <= 1 ? poolSize : pickCount === 2 ? 35 : pickCount === 3 ? 28 : pickCount === 4 ? 17 : 14;
  const cappedPool = pool.slice(0, Math.min(pool.length, maxPoolByPick));
  if (cappedPool.length < pickCount) return [];

  const combinations = [];
  const stack = [];
  const MAX_COMBOS = 3000; // 硬上限：超过即停，防止偶发组合爆炸

  function walk(startIndex) {
    if (combinations.length >= MAX_COMBOS) return;
    if (stack.length === pickCount) {
      combinations.push(buildSampleComboRecord(stack, [], options));
      return;
    }
    for (let index = startIndex; index <= cappedPool.length - (pickCount - stack.length); index += 1) {
      if (combinations.length >= MAX_COMBOS) break;
      stack.push(cappedPool[index]);
      walk(index + 1);
      stack.pop();
    }
  }

  walk(0);
  return combinations.sort(compareSampleCombos).slice(0, limit);
}

function buildSampleFrontCombos(entries, ratios, pickCount = samplePickCount, intervals = sampleIntervals, ratioSupportMap = new Map(), referenceRows = [], repeatTarget = null, anchorNumbers = [], selectedNumbers = []) {
  if (!Array.isArray(ratios) || ratios.length === 0) {
    return buildSampleEntryCombinations(entries, pickCount, sampleFullComboPoolSize, sampleComboLimit, { intervals, ratioSupportMap, applyRunPenalty: true, applySpreadPenalty: true, referenceRows, zone: "front", repeatTarget, anchorNumbers, selectedNumbers }).map((combo) => {
      const record = buildSampleComboRecord(combo.entries, [], { intervals, ratioSupportMap, applyRunPenalty: true, applySpreadPenalty: true, referenceRows, zone: "front", repeatTarget, anchorNumbers, selectedNumbers });
      record.key = getSampleComboKey(record.numbers);
      record.ratioText = record.ratioKey;
      return record;
    }).sort(compareSampleCombos);
  }

  const comboMap = new Map();

  (Array.isArray(ratios) ? ratios : []).forEach((ratio) => {
    if (!Array.isArray(ratio) || ratio.reduce((total, count) => total + (Number(count) || 0), 0) !== pickCount) return;
    const intervalCombos = ratio.map((count, intervalIndex) => {
      const bucketEntries = entries.filter((entry) => getSampleIntervalIndex(entry.number, intervals) === intervalIndex);
      return buildSampleEntryCombinations(bucketEntries, Number(count) || 0, sampleFullComboPoolSize, sampleComboLimit, { intervals, ratioSupportMap, applyRunPenalty: true, applySpreadPenalty: true, referenceRows, zone: "front", repeatTarget, anchorNumbers });
    });
    if (intervalCombos.some((list, intervalIndex) => (Number(ratio[intervalIndex]) || 0) > 0 && list.length === 0)) return;

    const stack = [];
    function mergeCombos(intervalIndex) {
      if (intervalIndex >= intervalCombos.length) {
        const mergedEntries = stack.flatMap((combo) => combo.entries);
        const record = buildSampleComboRecord(mergedEntries, ratio, { intervals, ratioSupportMap, applyRunPenalty: true, applySpreadPenalty: true, referenceRows, zone: "front", repeatTarget, anchorNumbers, selectedNumbers });
        record.key = getSampleComboKey(record.numbers);
        record.ratioText = getSampleRatioText(ratio);
        const existing = comboMap.get(record.key);
        if (existing && compareSampleCombos(record, existing) >= 0) return;
        comboMap.set(record.key, record);
        return;
      }
      intervalCombos[intervalIndex].forEach((combo) => {
        stack.push(combo);
        mergeCombos(intervalIndex + 1);
        stack.pop();
      });
    }

    mergeCombos(0);
  });

  const combos = [...comboMap.values()].sort(compareSampleCombos);
  if (combos.length > 0) return combos;

  const fallbackMap = new Map();
  (Array.isArray(ratios) ? ratios : []).forEach((ratio) => {
    const numbers = selectSampleNumbersByRatio(entries, ratio, 0, "front", pickCount, intervals);
    if (numbers.length !== pickCount) return;
    const pickedEntries = numbers.map((number) => entries.find((entry) => entry.number === number)).filter(Boolean);
    if (pickedEntries.length !== pickCount) return;
    const record = buildSampleComboRecord(pickedEntries, ratio, { intervals, ratioSupportMap, applyRunPenalty: true, applySpreadPenalty: true, referenceRows, zone: "front", repeatTarget, anchorNumbers, selectedNumbers });
    record.key = getSampleComboKey(record.numbers);
    record.ratioText = getSampleRatioText(ratio);
    const existing = fallbackMap.get(record.key);
    if (existing && compareSampleCombos(record, existing) >= 0) return;
    fallbackMap.set(record.key, record);
  });
  return [...fallbackMap.values()].sort(compareSampleCombos);
}

function buildSampleFreeCombos(entries, pickCount, repeatTarget = null, anchorNumbers = []) {
  const combos = buildSampleEntryCombinations(entries, pickCount, sampleFullComboPoolSize, sampleComboLimit).map((combo) => {
    const record = buildSampleComboRecord(combo.entries, [], { referenceRows: [], repeatTarget, anchorNumbers });
    record.key = getSampleComboKey(record.numbers);
    record.ratioText = getSampleRatioText();
    return record;
  });
  if (combos.length > 0) return combos.sort(compareSampleCombos);

  const fallbackNumbers = selectSampleNumbers(entries, 0, "back", pickCount);
  const fallbackEntries = fallbackNumbers.map((number) => entries.find((entry) => entry.number === number)).filter(Boolean);
  if (fallbackEntries.length !== pickCount) return [];
  const record = buildSampleComboRecord(fallbackEntries, [], { referenceRows: [], repeatTarget, anchorNumbers });
  record.key = getSampleComboKey(record.numbers);
  record.ratioText = getSampleRatioText();
  return [record];
}

// 🆕 计算高频未命中号码（基于历史数据）
function calculateHighFreqMissNums(allBalls, lookbackRows = 50) {
  // 获取所有后区号码
  const backBalls = allBalls.filter(b => b.zone === "back");
  if (backBalls.length === 0) return [2, 5, 7, 11]; // 默认值
  
  // 获取最大行号
  const maxRow = Math.max(...backBalls.map(b => b.row));
  const startRow = Math.max(1, maxRow - lookbackRows);
  
  // 统计号码频率
  const freq = {};
  for (let n = 1; n <= 12; n++) freq[n] = 0;
  
  backBalls.filter(b => b.row >= startRow).forEach(b => {
    freq[b.number] = (freq[b.number] || 0) + 1;
  });
  
  // 计算平均频率
  const totalDraws = maxRow - startRow + 1;
  const avgFreq = (totalDraws * 2) / 12; // 每期2个后区号码，12个可能号码
  
  // 找出高频号码（频率高于平均值的）
  const highFreqNums = Object.entries(freq)
    .filter(([_, count]) => count > avgFreq * 1.2) // 高于平均值20%
    .map(([num, _]) => Number(num));
  
  // 如果高频号码不足4个，补充频率最高的
  if (highFreqNums.length < 4) {
    const sortedByFreq = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([num, _]) => Number(num));
    
    for (const num of sortedByFreq) {
      if (!highFreqNums.includes(num)) {
        highFreqNums.push(num);
        if (highFreqNums.length >= 4) break;
      }
    }
  }
  
  console.log("[高频未命中计算] 历史期数:", totalDraws, "平均频率:", avgFreq.toFixed(1), "高频号码:", highFreqNums.slice(0, 4));
  
  return highFreqNums.slice(0, 4); // 返回前4个高频号码
}

// ═══ 后区桥接策略（热号融合优化版）：基于源行后区+8期窗口热号生成5组变体 ═══
function generateBackBridgeCombos(sourceRow, allBalls, highFreqMissNums = null) {
  // 如果没有传入高频未命中号码，则动态计算
  if (!highFreqMissNums) {
    highFreqMissNums = calculateHighFreqMissNums(allBalls);
  }
  
  const sourceColor = sampleBlueColor;
  const sourceBalls = allBalls.filter(b => b.zone === "back" && b.row === sourceRow && ballHasColor(b, sourceColor));
  const sourceNums = [...new Set(sourceBalls.map(b => b.number))].sort((a, b) => a - b).slice(0, 2);
  
  // 源行无后区号码时降级
  if (sourceNums.length < 2) {
    const fallback = [];
    for (let i = 0; i < 5; i++) {
      const n1 = 1 + Math.floor(Math.random() * 6);
      let n2 = 7 + Math.floor(Math.random() * 6);
      if (n1 === n2) n2 = n2 >= 12 ? n2 - 1 : n2 + 1;
      fallback.push([n1, n2].sort((a, b) => a - b));
    }
    return fallback;
  }
  
  const [s1, s2] = sourceNums;
  const gap = s2 - s1;
  const backMax = 12;
  
  const wrap = (n) => {
    if (n < 1) return n + backMax;
    if (n > backMax) return n - backMax;
    return n;
  };
  
  const makePair = (a, b) => {
    const pair = [wrap(a), wrap(b)].sort((x, y) => x - y);
    return pair[0] !== pair[1] ? pair : null;
  };
  
  // 🆕 计算8期窗口热号（扩大窗口以覆盖更多热号）
  const windowSize = 8;
  const windowStart = Math.max(1, sourceRow - windowSize);
  const windowBalls = allBalls.filter(b => 
    b.zone === "back" && 
    b.row >= windowStart && 
    b.row < sourceRow && 
    ballHasColor(b, sourceColor)
  );
  
  // 统计窗口内后区号码频率
  const windowFreq = {};
  for (let n = 1; n <= backMax; n++) windowFreq[n] = 0;
  windowBalls.forEach(b => { windowFreq[b.number] = (windowFreq[b.number] || 0) + 1; });
  
  // 获取热号（出现次数>=2的优先，否则取Top2）
  const sortedByFreq = Object.entries(windowFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([n, c]) => ({ num: Number(n), count: c }));
  
  const hotNums = sortedByFreq
    .filter(item => item.count >= 2)
    .map(item => item.num);
  
  // 如果热号不足2个，补充Top2
  if (hotNums.length < 2) {
    const top2 = sortedByFreq.slice(0, 2).map(item => item.num);
    top2.forEach(n => { if (!hotNums.includes(n)) hotNums.push(n); });
  }
  
  // 🆕 获取前一期后区号码（23.7%未命中有连续期重复）
  const prevRow = sourceRow - 1;
  const prevBalls = allBalls.filter(b => b.zone === "back" && b.row === prevRow && ballHasColor(b, sourceColor));
  const prevNums = [...new Set(prevBalls.map(b => b.number))].sort((a, b) => a - b).slice(0, 2);
  
  // 🆕 获取冷号（出现次数<=1，冷→冷占35.5%）
  const coldNums = sortedByFreq
    .filter(item => item.count <= 1)
    .map(item => item.num);
  
  const results = [];
  const seen = new Set();
  
  const addPair = (pair, label) => {
    if (!pair) return;
    const key = pair.join("-");
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ numbers: pair, label });
  };
  
  // 优先级1：源行重复（保留原版核心策略）
  addPair([s1, s2], "后区重复");
  
  // 优先级2：源行+1 相邻
  addPair(makePair(s1 + 1, s2 + 1), "后区相邻+1");
  
  // 优先级3：桥接（填补源行两数之间的间隔）
  if (gap >= 3) {
    const mid = Math.round((s1 + s2) / 2);
    addPair(makePair(s1, mid), "后区桥接");
  } else if (gap === 2) {
    addPair(makePair(s1, s1 + 1), "后区桥接");
  } else {
    addPair(makePair(s1 - 1, s2 + 1), "后区桥接");
  }
  
  // 🆕 优先级4：前一期号码策略（23.7%未命中有连续期重复）
  if (prevNums.length >= 2) {
    const [p1, p2] = prevNums;
    addPair([p1, p2], "前一期重复");
    addPair(makePair(p1, p1 + 1), "前一期相邻");
    addPair(makePair(p2, p2 + 1), "前一期相邻");
    addPair(makePair(p1, p1 - 1), "前一期相邻");
    addPair(makePair(p2, p2 - 1), "前一期相邻");
  }
  
  // 优先级5：源号+相邻（保证源行号码在多行出现）
  addPair(makePair(s1, s2 - 1), "后区源号相邻");
  addPair(makePair(s1 - 1, s2), "后区源号相邻");
  addPair(makePair(s1 + 1, s2), "后区源号相邻");
  addPair(makePair(s1, s2 + 1), "后区源号相邻");
  
  // 优先级5：源号+热号混合（热号融合核心）- 降低优先级，减少组合数
  // 只取1个热号，减少组合数
  if (hotNums.length > 0) {
    const hot = hotNums[0];
    addPair(makePair(s1, hot), "源号+热号");
    addPair(makePair(s2, hot), "源号+热号");
  }
  
  // 🆕 优先级6：补充策略（基于未命中分析）- 提升优先级
  // 策略4：源号±1的组合（源号相邻号码更容易命中）
  addPair(makePair(s1 + 1, s2 + 1), "源号±1");
  addPair(makePair(s1 - 1, s2 - 1), "源号±1");
  addPair(makePair(s1 + 1, s2 - 1), "源号±1");
  addPair(makePair(s1 - 1, s2 + 1), "源号±1");
  
  // 策略3：针对高频未命中号码，增加其相邻号码的组合
  for (const missNum of highFreqMissNums) {
    const adjacentNums = [wrap(missNum - 1), wrap(missNum + 1)];
    for (const adj of adjacentNums) {
      addPair(makePair(s1, adj), "高频相邻");
      addPair(makePair(s2, adj), "高频相邻");
    }
  }
  
  // 🆕 高频未命中组合直接生成（4-5×5次, 2-8×4次, 2-3×4次, 1-5×4次）
  const highFreqCombos = [[4,5], [2,8], [2,3], [1,5], [7,8], [6,7], [2,12], [9,12]];
  for (const combo of highFreqCombos) {
    addPair(combo, "高频未命中");
  }
  
  // 🆕 冷号策略（冷→冷占35.5%）
  if (coldNums.length >= 2) {
    addPair([coldNums[0], coldNums[1]], "冷号组合");
    if (coldNums.length >= 3) {
      addPair([coldNums[0], coldNums[2]], "冷号组合");
    }
  }
  
  // 🆕 等差数列+相邻组合策略（如2-10推导出1-6）
  // 源行两数之间的中点 + 相邻号码
  const midPoint = Math.round((s1 + s2) / 2);
  if (midPoint !== s1 && midPoint !== s2) {
    // 中点与源行两数的相邻号码组合
    addPair(makePair(midPoint, s1 - 1), "等差相邻");
    addPair(makePair(midPoint, s1 + 1), "等差相邻");
    addPair(makePair(midPoint, s2 - 1), "等差相邻");
    addPair(makePair(midPoint, s2 + 1), "等差相邻");
    
    // 中点与源行两数的组合（已包含桥接，但增加变体）
    addPair(makePair(midPoint, wrap(midPoint - 1)), "等差相邻");
    addPair(makePair(midPoint, wrap(midPoint + 1)), "等差相邻");
  }
  
  // 源行两数的相邻号码组合（如2的相邻1，10的相邻9）
  addPair(makePair(wrap(s1 - 1), wrap(s2 - 1)), "源行相邻");
  addPair(makePair(wrap(s1 + 1), wrap(s2 + 1)), "源行相邻");
  addPair(makePair(wrap(s1 - 1), wrap(s2 + 1)), "源行相邻");
  addPair(makePair(wrap(s1 + 1), wrap(s2 - 1)), "源行相邻");
  
  // 策略1：差值1的组合变体（对于已生成的组合，增加±1变体）
  // 注意：这会生成大量组合，我们只取前几个
  const existingCombos = results.map(r => r.numbers);
  for (const combo of existingCombos.slice(0, 3)) { // 只对前3个组合生成变体
    const [a, b] = combo;
    addPair(makePair(a + 1, b + 1), "差值1变体");
    addPair(makePair(a - 1, b - 1), "差值1变体");
    addPair(makePair(a + 1, b - 1), "差值1变体");
    addPair(makePair(a - 1, b + 1), "差值1变体");
  }
  
  // 🆕 策略2：差值2的组合变体（覆盖更多未命中情况）
  // 38%的未命中差值为1，±2变体可以覆盖更多情况
  for (const combo of existingCombos.slice(0, 2)) { // 只对前2个组合生成变体
    const [a, b] = combo;
    addPair(makePair(a + 2, b + 2), "差值2变体");
    addPair(makePair(a - 2, b - 2), "差值2变体");
    addPair(makePair(a + 2, b - 2), "差值2变体");
    addPair(makePair(a - 2, b + 2), "差值2变体");
  }
  
  // 优先级7：源行+2 大偏移（降低优先级）
  addPair(makePair(s1 + 2, s2 + 2), "后区偏移+2");
  addPair(makePair(s1 - 2, s2), "后区偏移-2");
  addPair(makePair(s1 + 1, s2), "后区混合");
  addPair(makePair(s1 - 1, s2), "后区混合");
  
  // 扩充候选池到20+（给评分系统更多选择）
  let attempts = 0;
  while (results.length < 20 && attempts < 50) {
    attempts++;
    const n1 = 1 + Math.floor(Math.random() * backMax);
    let n2 = 1 + Math.floor(Math.random() * backMax);
    if (n1 === n2) n2 = n2 >= backMax ? n2 - 1 : n2 + 1;
    addPair([n1, n2].sort((a, b) => a - b), "后区补充");
  }
  
  // 🆕 评分系统：基于7大优化策略对候选组合评分排序
  const scoreCombo = (pair) => {
    let score = 0;
    const [a, b] = pair;
    const sum = a + b;
    const span = Math.abs(b - a);
    const oddCount = pair.filter(n => n % 2 === 1).length;
    const bigCount = pair.filter(n => n > 6).length;
    
    // 奇偶比例：1奇1偶最常见(58.1%) → +2分
    if (oddCount === 1) score += 2;
    
    // 大小比例：1大1小最常见(53.8%) → +2分
    if (bigCount === 1) score += 2;
    
    // 和值范围：中和值(9-14)最常见(46.2%) → +3分
    if (sum >= 9 && sum <= 14) score += 3;
    
    // 跨度控制：跨度1-4占60%+ → +2分
    if (span >= 1 && span <= 4) score += 2;
    else if (span >= 5 && span <= 7) score += 1;
    
    // 前一期号码重复加分（23.7%连续期有重复）
    if (prevNums.length >= 2) {
      const [p1, p2] = prevNums;
      if (pair.includes(p1) || pair.includes(p2)) score += 2;
    }
    
    return score;
  };
  
  // 对所有组合评分并按分数降序排列
  results.forEach(r => { r.score = scoreCombo(r.numbers); });
  results.sort((a, b) => b.score - a.score);
  
  // 🆕 调试日志
  console.log("[后区优化v4] 源行:", sourceRow, "源号:", [s1, s2],
    "前一期:", prevNums, "热号:", hotNums.slice(0, 3),
    "冷号:", coldNums.slice(0, 3), "高频未命中:", highFreqMissNums,
    "最终9组:", results.slice(0, 9).map(r => `${r.numbers.join("-")}(${r.label},s${r.score})`));
  
  return results.slice(0, 9).map(r => r.numbers);
}

function shuffleSampleIndexes(indexes = []) {
  const result = [...indexes];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function rotateSampleIndexes(indexes = [], offset = 0) {
  if (!Array.isArray(indexes) || indexes.length === 0) return [];
  const shift = ((offset % indexes.length) + indexes.length) % indexes.length;
  return [...indexes.slice(shift), ...indexes.slice(0, shift)];
}

function getSampleTopComboIndexes(combos = [], limit = sampleComboLimit) {
  return combos
    .slice(0, Math.min(limit, combos.length))
    .map((_, index) => index);
}

function getSampleComboOverlapCount(left, right) {
  const leftSet = new Set(Array.isArray(left?.numbers) ? left.numbers : []);
  return (Array.isArray(right?.numbers) ? right.numbers : []).filter((number) => leftSet.has(number)).length;
}

function getSampleComboDisplaySelectionValue(combo, index, selectedCombos = [], bestScore = 0) {
  const numbers = Array.isArray(combo?.numbers) ? combo.numbers : [];
  const usedNumbers = new Set();
  selectedCombos.forEach((item) => {
    (Array.isArray(item?.numbers) ? item.numbers : []).forEach((number) => usedNumbers.add(number));
  });
  const freshCount = numbers.filter((number) => !usedNumbers.has(number)).length;
  const overlapPenalty = selectedCombos.reduce((total, item) => {
    const overlapCount = getSampleComboOverlapCount(combo, item);
    const overlapWeight = numbers.length <= 2 ? 26 : 18;
    return total + overlapCount * overlapCount * overlapWeight;
  }, 0);
  const ratioBonus = combo?.ratioKey && selectedCombos.every((item) => item?.ratioKey !== combo.ratioKey) ? 14 : 0;
  const intervalBonus = selectedCombos.every((item) => (item?.coveredIntervalCount || 0) !== (combo?.coveredIntervalCount || 0)) ? 10 : 0;
  const spanBonus = selectedCombos.every((item) => Math.abs((item?.span || 0) - (combo?.span || 0)) >= 5) ? 8 : 0;
  const rankBonus = Math.max(0, 18 - index) * 12;
  const scorePenalty = Math.max(0, Math.round(((bestScore || 0) - (combo?.score || 0)) * 0.12));
  return rankBonus + freshCount * 22 + ratioBonus + intervalBonus + spanBonus - overlapPenalty - scorePenalty;
}

function getSampleDisplayPool(combos = [], rotationCursor = 0, desiredCount = 5) {
  if (!Array.isArray(combos) || combos.length === 0) return [];
  const poolSize = Math.min(
    combos.length,
    Math.max(desiredCount * 4, sampleComboLimit, sampleRandomTopN + desiredCount)
  );
  const poolIndexes = getSampleTopComboIndexes(combos, poolSize);
  const orderedIndexes = [
    poolIndexes[0],
    ...rotateSampleIndexes(poolIndexes.slice(1), rotationCursor),
  ].filter((index) => Number.isInteger(index));
  const orderedPool = orderedIndexes
    .map((index) => combos[index])
    .filter(Boolean);
  if (orderedPool.length <= desiredCount) return orderedPool;
  const result = [];
  const used = new Set();
  const bestCombo = orderedPool[0];
  if (bestCombo) {
    result.push(bestCombo);
    used.add(bestCombo.key);
  }

  const bestScore = bestCombo?.score || 0;
  while (result.length < desiredCount) {
    let picked = null;
    let pickedValue = -Infinity;
    orderedPool.forEach((combo, index) => {
      if (!combo || used.has(combo.key)) return;
      const value = getSampleComboDisplaySelectionValue(combo, index, result, bestScore);
      if (value > pickedValue) {
        picked = combo;
        pickedValue = value;
      }
    });
    if (!picked) break;
    result.push(picked);
    used.add(picked.key);
  }

  if (result.length >= desiredCount) return result;

  orderedPool.forEach((combo) => {
    if (result.length >= desiredCount) return;
    if (!combo || used.has(combo.key)) return;
    result.push(combo);
    used.add(combo.key);
  });

  return result;
}

function getSampleComboPreferenceOrder(combos, strategyKey, rotationCursor = 0) {
  const indexes = combos.map((_, index) => index);
  if (indexes.length === 0) return [];

  const topIndexes = getSampleTopComboIndexes(combos);
  const remainder = indexes.filter((index) => !topIndexes.includes(index));
  const bestScore = combos[0]?.score;
  const tiedBest = topIndexes.filter((index) => combos[index]?.score === bestScore);

  if (strategyKey === "best") {
    if (tiedBest.length <= 1) return indexes;
    return [...rotateSampleIndexes(tiedBest, rotationCursor), ...indexes.filter((index) => !tiedBest.includes(index))];
  }

  if (strategyKey === "next") {
    const base = topIndexes.length > 1 ? topIndexes.slice(1) : indexes;
    return [...rotateSampleIndexes(base, rotationCursor), ...indexes.filter((index) => !base.includes(index))];
  }

  if (strategyKey === "backup") {
    const base = topIndexes.length > 2 ? topIndexes.slice(2) : topIndexes.slice(1);
    return [...rotateSampleIndexes(base, rotationCursor * 2 + 1), ...indexes.filter((index) => !base.includes(index))];
  }

  if (strategyKey === "random") {
    const top = shuffleSampleIndexes(topIndexes.slice(0, Math.min(sampleRandomTopN, topIndexes.length)));
    return [...top, ...indexes.filter((index) => !top.includes(index))];
  }

  const rotationGroup = tiedBest.length > 1 ? tiedBest : topIndexes;
  return [...rotateSampleIndexes(rotationGroup, rotationCursor), ...remainder, ...indexes.filter((index) => !rotationGroup.includes(index) && !remainder.includes(index))];
}

function pickSampleComboByStrategy(combos, strategyKey, usedKeys, rotationCursor = 0) {
  for (const index of getSampleComboPreferenceOrder(combos, strategyKey, rotationCursor)) {
    const combo = combos[index];
    if (!combo) continue;
    if (usedKeys.has(combo.key)) continue;
    usedKeys.add(combo.key);
    return combo;
  }
  return null;
}

function buildSampleVariantPlan(frontCombos, backCombos, rotationCursor = 0) {
  const frontUsed = new Set();
  const backUsed = new Set();
  const plan = sampleVariantModes
    .map((variant) => {
      const front = pickSampleComboByStrategy(frontCombos, variant.key, frontUsed, rotationCursor);
      const back = pickSampleComboByStrategy(backCombos, variant.key, backUsed, rotationCursor);
      if (!front && !back) return null;
      return {
        ...variant,
        front,
        back,
        title: [
          `${variant.label}候选`,
          front?.ratioText ? `前区 ${front.ratioText}` : "",
          back ? "后区自由" : "",
        ].filter(Boolean).join(" / "),
      };
    })
    .filter(Boolean);

  if (plan.length > 0) return plan;

  if (frontCombos[0] || backCombos[0]) {
    return [
      {
        key: "best",
        label: "最优",
        front: frontCombos[0] || null,
        back: backCombos[0] || null,
        title: "最优候选",
      },
    ];
  }

  return [];
}

function buildSingleSamplePlan(frontCombos, backCombos, ratioPlan, rotationCursor = 0) {
  const frontBase = frontCombos[0] || null;
  const backBase = backCombos[0] || null;
  if (!frontBase && !backBase) return [];

  const variants = [];
  const frontPool = frontCombos.length > 0 ? getSampleDisplayPool(frontCombos, rotationCursor, 5) : [frontBase];
  const backPool = backCombos.length > 0 ? getSampleDisplayPool(backCombos, rotationCursor + 1, 5) : [backBase];

  for (let offset = 0; offset < 5; offset += 1) {
    const front = frontPool[(rotationCursor + offset) % frontPool.length] || frontBase;
    const back = backPool[(rotationCursor + offset) % backPool.length] || backBase;
    variants.push({
      key: `single-${offset + 1}`,
      label: `第${offset + 1}行`,
      front,
      back,
      title: [
        "单组五行",
        front?.ratioText ? `前区 ${front.ratioText}` : "",
        back ? "后区自由" : "",
      ].filter(Boolean).join(" / "),
    });
  }

  return variants;
}

function compareSampleCandidateEntries(left, right) {
  if ((right?.score || 0) !== (left?.score || 0)) return (right?.score || 0) - (left?.score || 0);
  if ((right?.anchorTransformScore || 0) !== (left?.anchorTransformScore || 0)) return (right?.anchorTransformScore || 0) - (left?.anchorTransformScore || 0);
  if ((right?.transformedCount || 0) !== (left?.transformedCount || 0)) return (right?.transformedCount || 0) - (left?.transformedCount || 0);
  if ((right?.farOffsetCount || 0) !== (left?.farOffsetCount || 0)) return (right?.farOffsetCount || 0) - (left?.farOffsetCount || 0);
  if ((left?.anchorKeepPenalty || 0) !== (right?.anchorKeepPenalty || 0)) return (left?.anchorKeepPenalty || 0) - (right?.anchorKeepPenalty || 0);
  if ((right?.fromTail || 0) !== (left?.fromTail || 0)) return (right?.fromTail || 0) - (left?.fromTail || 0);
  if ((right?.selectedTailHits || 0) !== (left?.selectedTailHits || 0)) return (right?.selectedTailHits || 0) - (left?.selectedTailHits || 0);
  if ((right?.selectedTailNeighborHits || 0) !== (left?.selectedTailNeighborHits || 0)) return (right?.selectedTailNeighborHits || 0) - (left?.selectedTailNeighborHits || 0);
  if (((right?.tailCount || 0) + (right?.lastRowTailHits || 0) + (right?.tailPatternScore || 0)) !== ((left?.tailCount || 0) + (left?.lastRowTailHits || 0) + (left?.tailPatternScore || 0))) {
    return ((right?.tailCount || 0) + (right?.lastRowTailHits || 0) + (right?.tailPatternScore || 0)) - ((left?.tailCount || 0) + (left?.lastRowTailHits || 0) + (left?.tailPatternScore || 0));
  }
  if ((right?.arithmeticEndpointHits || 0) !== (left?.arithmeticEndpointHits || 0)) return (right?.arithmeticEndpointHits || 0) - (left?.arithmeticEndpointHits || 0);
  if ((right?.arithmeticScore || 0) !== (left?.arithmeticScore || 0)) return (right?.arithmeticScore || 0) - (left?.arithmeticScore || 0);
  if ((right?.plusTenScore || 0) !== (left?.plusTenScore || 0)) return (right?.plusTenScore || 0) - (left?.plusTenScore || 0);
  if ((right?.plusTenNeighborScore || 0) !== (left?.plusTenNeighborScore || 0)) return (right?.plusTenNeighborScore || 0) - (left?.plusTenNeighborScore || 0);
  if ((right?.bridgeScore || 0) !== (left?.bridgeScore || 0)) return (right?.bridgeScore || 0) - (left?.bridgeScore || 0);
  if ((right?.templateScore || 0) !== (left?.templateScore || 0)) return (right?.templateScore || 0) - (left?.templateScore || 0);
  if ((right?.integrityBonus || 0) !== (left?.integrityBonus || 0)) return (right?.integrityBonus || 0) - (left?.integrityBonus || 0);
  if ((right?.bridgeHits || 0) !== (left?.bridgeHits || 0)) return (right?.bridgeHits || 0) - (left?.bridgeHits || 0);
  if ((right?.templateHits || 0) !== (left?.templateHits || 0)) return (right?.templateHits || 0) - (left?.templateHits || 0);
  if ((right?.neighborHits || 0) !== (left?.neighborHits || 0)) return (right?.neighborHits || 0) - (left?.neighborHits || 0);
  return (left?.number || 0) - (right?.number || 0);
}

function buildSampleNumbers(selectedRow, zone = "front", ratios = []) {
  const { selectedRow: sourceRow, startRow, endRow, referenceRows: sourceReferenceRows, fixedReferenceRow } = getSampleSourceWindow(selectedRow);
  const isBackZone = zone === "back";
  const sourceColor = zone === "back" ? sampleBlueColor : sampleRedColor;
  const pickCount = zone === "back" ? sampleBackPickCount : samplePickCount;
  const referenceRowSet = new Set(sourceReferenceRows);
  const inScopeBalls = collectBalls().filter((ball) => {
    return ball.zone === zone && ballHasColor(ball, sourceColor);
  });
  const windowBalls = inScopeBalls.filter((ball) => {
    return ball.zone === zone && referenceRowSet.has(ball.row) && ballHasColor(ball, sourceColor);
  });
  const selectedRowBalls = windowBalls.filter((ball) => ball.row === sourceRow);
  const supportWindowBalls = windowBalls.filter((ball) => ball.row !== sourceRow);
  const lastRowBalls = inScopeBalls.filter((ball) => {
    return ball.row === fixedReferenceRow;
  });
  const upperReferenceStart = Math.max(1, sourceRow - sampleWindowRadius);
  const upperColorBalls = collectBalls().filter((ball) => {
    return ball.zone === zone &&
      ball.row >= upperReferenceStart &&
      ball.row < sourceRow &&
      (ballHasColor(ball, sampleGreenColor) || ballHasColor(ball, sampleBlackColor));
  });
  const sourceBalls = [
    ...windowBalls,
    ...lastRowBalls.filter((ball) => !referenceRowSet.has(ball.row)),
  ];

  const selectedNumbers = getUniqueSortedSampleNumbers(selectedRowBalls.map((ball) => ball.number));
  const supportNumbers = getUniqueSortedSampleNumbers(supportWindowBalls.map((ball) => ball.number));
  const lastRowNumbersList = getUniqueSortedSampleNumbers(lastRowBalls.map((ball) => ball.number));
  const upperColorNumbersList = getUniqueSortedSampleNumbers(upperColorBalls.map((ball) => ball.number));
  const numberCounts = makeCountMap(sourceBalls.map((ball) => ball.number));
  const tailCounts = makeCountMap(sourceBalls.map((ball) => ball.number % 10));
  const upperColorNumberCounts = makeCountMap(upperColorBalls.map((ball) => ball.number));
  const upperColorTailCounts = makeCountMap(upperColorBalls.map((ball) => ball.number % 10));
  const lastRowNumbers = new Set(lastRowNumbersList);
  const lastRowTails = new Set(lastRowBalls.map((ball) => ball.number % 10));
  const lastRowTailCounts = makeCountMap(lastRowNumbersList.map((number) => number % 10));
  const lastRowTailNeighborSet = buildTailNeighborSet(lastRowNumbersList.map((number) => number % 10));
  const upperColorTailNeighborSet = buildTailNeighborSet(upperColorNumbersList.map((number) => number % 10));
  const tailPatternScores = buildTailPatternScores(sourceBalls.map((ball) => ball.number % 10));
  const ratioSupportMap = buildSampleRatioSupportMap(sourceBalls, sampleIntervals);
  const sourceMap = new Map();
  const rowsInScope = [];
  sourceReferenceRows.forEach((row) => rowsInScope.push(row));
  const rowEntries = buildSampleRowEntries(windowBalls, rowsInScope);
  const additionalReferenceRows = upperColorNumbersList.length > 0
    ? [{
      row: upperReferenceStart,
      numbers: upperColorNumbersList,
      isMarkerRow: true,
      markerType: "upper-color",
    }]
    : [];
  const referenceRows = buildSampleReferenceRows(rowEntries, {
    selectedRow: sourceRow,
    lastRow: fixedReferenceRow,
    lastRowNumbers: lastRowNumbersList,
    intervals: sampleIntervals,
    additionalRows: additionalReferenceRows,
  });
  const referencePatternMaps = buildSampleReferencePatternMaps(referenceRows, zone);
  const bridgeMap = referencePatternMaps.bridgeMap;
  const arithmeticMap = referencePatternMaps.arithmeticMap;

  sourceBalls.forEach((ball) => {
    const current = sourceMap.get(ball.number) || {
      number: ball.number,
      repeatCount: 0,
      tailCount: 0,
      selectedTailHits: 0,
      selectedTailNeighborHits: 0,
      hits: 0,
      lastRowHits: 0,
      selectedRowHits: 0,
      supportHits: 0,
      lastRowTailHits: 0,
      tailPatternScore: 0,
      bridgeEndpointHits: 0,
      arithmeticEndpointHits: 0,
      arithmeticScore: 0,
      upperColorHits: 0,
      upperColorTailHits: 0,
      upperColorTailNeighborHits: 0,
    };
    current.selectedTailHits = lastRowTailCounts.get(ball.number % 10) || 0;
    current.selectedTailNeighborHits = lastRowTailNeighborSet.has(ball.number % 10) ? 1 : 0;
    current.repeatCount = numberCounts.get(ball.number) || 0;
    current.tailCount = tailCounts.get(ball.number % 10) || 0;
    current.upperColorHits = upperColorNumberCounts.get(ball.number) || current.upperColorHits || 0;
    current.upperColorTailHits = upperColorTailCounts.get(ball.number % 10) || current.upperColorTailHits || 0;
    current.upperColorTailNeighborHits = upperColorTailNeighborSet.has(ball.number % 10) ? 1 : current.upperColorTailNeighborHits || 0;
    current.selectedRowHits += ball.row === sourceRow ? 1 : 0;
    current.supportHits += ball.row !== sourceRow && ball.row >= startRow && ball.row <= endRow ? 1 : 0;
    current.lastRowHits += ball.row === fixedReferenceRow ? 1 : 0;
    current.lastRowTailHits = lastRowTails.has(ball.number % 10) ? 1 : current.lastRowTailHits;
    current.tailPatternScore = tailPatternScores.get(ball.number % 10) || 0;
    current.hits += 1;
    sourceMap.set(ball.number, current);
  });

  bridgeMap.endpointMap.forEach((bridgeEntry, number) => {
    const current = sourceMap.get(number) || {
      number,
      repeatCount: numberCounts.get(number) || 0,
      tailCount: tailCounts.get(number % 10) || 0,
      selectedTailHits: lastRowTailCounts.get(number % 10) || 0,
      selectedTailNeighborHits: lastRowTailNeighborSet.has(number % 10) ? 1 : 0,
      hits: 0,
      lastRowHits: lastRowNumbers.has(number) ? 1 : 0,
      selectedRowHits: selectedNumbers.includes(number) ? 1 : 0,
      supportHits: supportNumbers.includes(number) ? 1 : 0,
      lastRowTailHits: lastRowTails.has(number % 10) ? 1 : 0,
      tailPatternScore: tailPatternScores.get(number % 10) || 0,
      bridgeEndpointHits: 0,
      arithmeticEndpointHits: 0,
      arithmeticScore: 0,
      upperColorHits: upperColorNumberCounts.get(number) || 0,
      upperColorTailHits: upperColorTailCounts.get(number % 10) || 0,
      upperColorTailNeighborHits: upperColorTailNeighborSet.has(number % 10) ? 1 : 0,
    };
    current.selectedTailHits = lastRowTailCounts.get(number % 10) || current.selectedTailHits || 0;
    current.selectedTailNeighborHits = lastRowTailNeighborSet.has(number % 10) ? 1 : current.selectedTailNeighborHits || 0;
    current.upperColorHits = upperColorNumberCounts.get(number) || current.upperColorHits || 0;
    current.upperColorTailHits = upperColorTailCounts.get(number % 10) || current.upperColorTailHits || 0;
    current.upperColorTailNeighborHits = upperColorTailNeighborSet.has(number % 10) ? 1 : current.upperColorTailNeighborHits || 0;
    current.bridgeEndpointHits = bridgeEntry.bridgeEndpointHits;
    sourceMap.set(number, current);
  });

  arithmeticMap.endpointMap.forEach((arithmeticEntry, number) => {
    const current = sourceMap.get(number) || {
      number,
      repeatCount: numberCounts.get(number) || 0,
      tailCount: tailCounts.get(number % 10) || 0,
      selectedTailHits: lastRowTailCounts.get(number % 10) || 0,
      selectedTailNeighborHits: lastRowTailNeighborSet.has(number % 10) ? 1 : 0,
      hits: 0,
      lastRowHits: lastRowNumbers.has(number) ? 1 : 0,
      selectedRowHits: selectedNumbers.includes(number) ? 1 : 0,
      supportHits: supportNumbers.includes(number) ? 1 : 0,
      lastRowTailHits: lastRowTails.has(number % 10) ? 1 : 0,
      tailPatternScore: tailPatternScores.get(number % 10) || 0,
      bridgeEndpointHits: 0,
      arithmeticEndpointHits: 0,
      arithmeticScore: 0,
      upperColorHits: upperColorNumberCounts.get(number) || 0,
      upperColorTailHits: upperColorTailCounts.get(number % 10) || 0,
      upperColorTailNeighborHits: upperColorTailNeighborSet.has(number % 10) ? 1 : 0,
    };
    current.arithmeticEndpointHits = arithmeticEntry.arithmeticEndpointHits;
    current.arithmeticScore = arithmeticEntry.arithmeticScore;
    current.upperColorHits = upperColorNumberCounts.get(number) || current.upperColorHits || 0;
    current.upperColorTailHits = upperColorTailCounts.get(number % 10) || current.upperColorTailHits || 0;
    current.upperColorTailNeighborHits = upperColorTailNeighborSet.has(number % 10) ? 1 : current.upperColorTailNeighborHits || 0;
    sourceMap.set(number, current);
  });

  upperColorNumbersList.forEach((number) => {
    const current = sourceMap.get(number) || {
      number,
      repeatCount: numberCounts.get(number) || 0,
      tailCount: tailCounts.get(number % 10) || 0,
      selectedTailHits: lastRowTailCounts.get(number % 10) || 0,
      selectedTailNeighborHits: lastRowTailNeighborSet.has(number % 10) ? 1 : 0,
      hits: 0,
      lastRowHits: lastRowNumbers.has(number) ? 1 : 0,
      selectedRowHits: selectedNumbers.includes(number) ? 1 : 0,
      supportHits: supportNumbers.includes(number) ? 1 : 0,
      lastRowTailHits: lastRowTails.has(number % 10) ? 1 : 0,
      tailPatternScore: tailPatternScores.get(number % 10) || 0,
      bridgeEndpointHits: 0,
      arithmeticEndpointHits: 0,
      arithmeticScore: 0,
      upperColorHits: 0,
      upperColorTailHits: 0,
      upperColorTailNeighborHits: 0,
    };
    current.upperColorHits = upperColorNumberCounts.get(number) || current.upperColorHits || 0;
    current.upperColorTailHits = upperColorTailCounts.get(number % 10) || current.upperColorTailHits || 0;
    current.upperColorTailNeighborHits = upperColorTailNeighborSet.has(number % 10) ? 1 : current.upperColorTailNeighborHits || 0;
    sourceMap.set(number, current);
  });

  const allSources = [...sourceMap.values()].sort(rankSampleSource);
  const selectedSources = allSources.slice(0, Math.max(pickCount, Math.min(sampleComboPoolSize, allSources.length)));

  const candidateMap = new Map();
  for (let number = 1; number <= zones[zone].max; number += 1) {
    getOrCreateSampleCandidate(candidateMap, number, zone);
  }

  sourceMap.forEach((entry) => {
    const candidate = getOrCreateSampleCandidate(candidateMap, entry.number, zone);
    if (!candidate) return;
    const baseScore = isBackZone
      ? sampleSignalLevel(entry.selectedTailHits, 2) * sampleRuleWeight +
        sampleSignalLevel(entry.selectedTailNeighborHits, 1) * sampleWeakRuleWeight +
        sampleSignalLevel(entry.lastRowHits, 1) * sampleRuleWeight +
        sampleSignalLevel(entry.tailCount, 3) * sampleRuleWeight +
        sampleSignalLevel(entry.lastRowTailHits, 1) * sampleRuleWeight +
        sampleSignalLevel(entry.tailPatternScore, 3) * sampleRuleWeight +
        sampleSignalLevel(entry.upperColorHits, 2) * sampleRuleWeight +
        sampleSignalLevel(entry.upperColorTailHits, 2) * sampleRuleWeight +
        sampleSignalLevel(entry.upperColorTailNeighborHits, 1) * sampleWeakRuleWeight +
        sampleSignalLevel(entry.hits, 3) * sampleRuleWeight +
        sampleSignalLevel(entry.bridgeEndpointHits, 3) * sampleRuleWeight +
        sampleSignalLevel(entry.arithmeticEndpointHits, 3) * (sampleRuleWeight + 2) +
        sampleSignalLevel(entry.arithmeticScore, 3) * (sampleRuleWeight + 2)
      : sampleSignalLevel(entry.selectedTailHits, 2) * sampleRuleWeight +
        sampleSignalLevel(entry.selectedTailNeighborHits, 1) * sampleWeakRuleWeight +
        sampleSignalLevel(entry.tailCount, 3) * sampleRuleWeight +
        sampleSignalLevel(entry.lastRowTailHits, 1) * sampleRuleWeight +
        sampleSignalLevel(entry.tailPatternScore, 3) * sampleRuleWeight +
        sampleSignalLevel(entry.upperColorHits, 2) * sampleRuleWeight +
        sampleSignalLevel(entry.upperColorTailHits, 2) * sampleRuleWeight +
        sampleSignalLevel(entry.upperColorTailNeighborHits, 1) * sampleWeakRuleWeight +
        sampleSignalLevel(entry.lastRowHits, 1) * sampleRuleWeight +
        sampleSignalLevel(entry.hits, 3) * sampleRuleWeight +
        sampleSignalLevel(entry.bridgeEndpointHits, 3) * sampleRuleWeight +
        sampleSignalLevel(entry.arithmeticEndpointHits, 3) * (sampleRuleWeight + 2) +
        sampleSignalLevel(entry.arithmeticScore, 3) * (sampleRuleWeight + 2);
    candidate.score += baseScore;
    candidate.baseScore += baseScore;
    candidate.fromRepeat += entry.repeatCount >= 2 ? 1 : 0;
    candidate.fromTail += entry.selectedTailHits > 0 || entry.selectedTailNeighborHits > 0 ? 1 : 0;
    candidate.selectedTailHits = Math.max(candidate.selectedTailHits || 0, entry.selectedTailHits || 0);
    candidate.selectedTailNeighborHits = Math.max(candidate.selectedTailNeighborHits || 0, entry.selectedTailNeighborHits || 0);
    candidate.repeatCount = Math.max(candidate.repeatCount, entry.repeatCount || 0);
    candidate.tailCount = Math.max(candidate.tailCount, entry.tailCount || 0);
    candidate.hits += entry.hits || 0;
    candidate.lastRowHits += entry.lastRowHits || 0;
    candidate.selectedRowHits += entry.selectedRowHits || 0;
    candidate.supportHits += entry.supportHits || 0;
    candidate.anchorHits += Math.min(1, entry.selectedRowHits || 0) + (entry.supportHits || 0) + (entry.lastRowHits || 0);
    candidate.bridgeEndpointHits += entry.bridgeEndpointHits || 0;
    candidate.arithmeticEndpointHits = (candidate.arithmeticEndpointHits || 0) + (entry.arithmeticEndpointHits || 0);
    candidate.arithmeticScore = (candidate.arithmeticScore || 0) + (entry.arithmeticScore || 0);
    candidate.upperColorHits = Math.max(candidate.upperColorHits || 0, entry.upperColorHits || 0);
    candidate.upperColorTailHits = Math.max(candidate.upperColorTailHits || 0, entry.upperColorTailHits || 0);
    candidate.upperColorTailNeighborHits = Math.max(candidate.upperColorTailNeighborHits || 0, entry.upperColorTailNeighborHits || 0);
  });

  selectedSources.forEach((entry) => addSampleNeighbors(candidateMap, entry, isBackZone ? 24 : 20, zone));
  allSources.forEach((entry) => addSampleNeighbors(candidateMap, entry, isBackZone ? 14 : 8, zone));

  bridgeMap.gapMap.forEach((bridgeEntry, number) => {
    const candidate = getOrCreateSampleCandidate(candidateMap, number, zone);
    if (!candidate) return;
    const bridgeBoost = isBackZone ? Math.max(0, Math.floor(bridgeEntry.bridgeScore / 3)) : Math.round(bridgeEntry.bridgeScore * 0.82);
    candidate.score += bridgeBoost;
    candidate.bridgeScore += bridgeBoost;
    candidate.bridgeHits += bridgeEntry.bridgeHits;
    candidate.bridgeSupport += bridgeEntry.bridgeSupport;
    candidate.anchorHits += bridgeEntry.bridgeHits;
  });

  bridgeMap.endpointMap.forEach((bridgeEntry, number) => {
    const candidate = getOrCreateSampleCandidate(candidateMap, number, zone);
    if (!candidate) return;
    const bridgeBoost = isBackZone ? Math.max(0, Math.floor(bridgeEntry.bridgeScore / 2)) : Math.round(bridgeEntry.bridgeScore * 0.78);
    candidate.score += bridgeBoost;
    candidate.bridgeScore += bridgeBoost;
    candidate.bridgeEndpointHits += bridgeEntry.bridgeEndpointHits;
    candidate.bridgeSupport += bridgeEntry.bridgeSupport;
  });

  if (!isBackZone && selectedNumbers.length > 0) {
    const anchorSet = new Set(selectedNumbers);
    candidateMap.forEach((candidate) => {
      const anchorSignal = getSampleSingleAnchorSignal(candidate.number, selectedNumbers);
      if ((anchorSignal.singleScore || 0) === 0 && !anchorSet.has(candidate.number)) return;
      candidate.score += anchorSignal.singleScore;
      candidate.baseScore += Math.max(0, Math.round(anchorSignal.singleScore / 2));
      candidate.anchorTransformScore += anchorSignal.anchorTransformScore || 0;
      candidate.transformedCount = Math.max(candidate.transformedCount || 0, anchorSignal.transformedCount || 0);
      candidate.farOffsetCount = Math.max(candidate.farOffsetCount || 0, anchorSignal.farOffsetCount || 0);
      candidate.anchorKeepPenalty = Math.max(candidate.anchorKeepPenalty || 0, anchorSignal.anchorKeepPenalty || 0);
      // 远距离补偿：距锚点4-8的号码获得合理得分
      if (!anchorSet.has(candidate.number)) {
        const dists = selectedNumbers.map(a => Math.abs(candidate.number - a)).sort((a, b) => a - b);
        const minDist = dists[0] || 99;
        if (minDist >= 4 && minDist <= 8) {
          const farCompensation = Math.max(0, (9 - minDist) * 3);
          candidate.score += farCompensation;
          candidate.baseScore += Math.round(farCompensation / 2);
        }
      }
      // 同尾号中间优先：尾号相同时，优先13/23/33（中间号），弱化3（边缘号）
      const tailDigit = candidate.number % 10;
      const hasSameTailAnchor = selectedNumbers.some(a => a % 10 === tailDigit);
      if (hasSameTailAnchor) {
        if (candidate.number >= 10 && candidate.number <= 33) {
          candidate.score += 4;
          candidate.baseScore += 2;
        }
      }
    });
  }

  if (sampleUsePlusTenTrend) {
    const plusTenTrendMap = buildSamplePlusTenTrendMap(sourceRow, zone, sourceColor, sampleIntervals);
    plusTenTrendMap.targetMap.forEach((trendScore, number) => {
      const candidate = getOrCreateSampleCandidate(candidateMap, number, zone);
      if (!candidate) return;
      const trendBoost = isBackZone
        ? Math.min(36, Math.round(trendScore * 0.42))
        : Math.min(68, Math.round(trendScore * 0.38));
      candidate.score += trendBoost;
      candidate.baseScore += Math.max(0, Math.round(trendBoost / 3));
      candidate.plusTenScore += trendBoost;
    });
    plusTenTrendMap.neighborMap.forEach((trendScore, number) => {
      const candidate = getOrCreateSampleCandidate(candidateMap, number, zone);
      if (!candidate) return;
      const trendBoost = isBackZone
        ? Math.min(16, Math.round(trendScore * 0.35))
        : Math.min(28, Math.round(trendScore * 0.28));
      candidate.score += trendBoost;
      candidate.plusTenNeighborScore += trendBoost;
    });
  }

  // 🆕 v3优化：对所有35个号码进行锚点偏移评分（确保未在窗口中出现的号码也能得分）
  if (!isBackZone && selectedNumbers.length > 0) {
    for (let n = 1; n <= zones[zone].max; n += 1) {
      const candidate = getOrCreateSampleCandidate(candidateMap, n, zone);
      if (!candidate) continue;
      // 计算到最近锚点的最小偏移
      let minDist = Infinity;
      selectedNumbers.forEach((anchor) => {
        const dist = Math.abs(n - anchor);
        if (dist < minDist) minDist = dist;
      });
      // 应用偏移权重表
      const offsetPoints = sampleAnchorOffsetWeights.get(minDist) || 0;
      if (offsetPoints > 0) {
        candidate.score += offsetPoints;
        candidate.baseScore += Math.round(offsetPoints / 2);
      }
      // 🆕 尾号关联评分（v3核心：与选中行尾号相同或±1加分）
      const tailDigit = n % 10;
      const selTails = selectedNumbers.map(sn => sn % 10);
      if (selTails.includes(tailDigit)) {
        candidate.score += 15;  // 尾号相同
        candidate.baseScore += 7;
      } else if (selTails.some(t => Math.abs(t - tailDigit) === 1 || Math.abs(t - tailDigit) === 9)) {
        candidate.score += 8;   // 尾号±1
        candidate.baseScore += 4;
      }
      // 🆕 区间覆盖奖励（v3：保证号码池不空区）
      const ivIdx = getSampleIntervalIndex(n, sampleIntervals);
      if (ivIdx >= 0) {
        candidate.score += 3;
      }
    }
  }

  const templateRows = buildSampleTemplateRows(rowEntries, {
    selectedRow: startRow,
    selectedNumbers,
    lastRowNumbers: lastRowNumbersList,
    bridgeGapSet: bridgeMap.gapSet,
    bridgeEndpointSet: bridgeMap.endpointSet,
    arithmeticEndpointSet: arithmeticMap.endpointMap instanceof Map ? new Set(arithmeticMap.endpointMap.keys()) : new Set(),
    sourceMap,
    ratios: zone === "front" ? ratios : [],
    intervals: sampleIntervals,
  });

  templateRows.forEach((templateRow) => {
    templateRow.numbers.forEach((number) => {
      const candidate = getOrCreateSampleCandidate(candidateMap, number, zone);
      if (!candidate) return;
      const isBridgeGap = bridgeMap.gapSet.has(number);
      const isBridgeEndpoint = bridgeMap.endpointSet.has(number);
      const isArithmeticEndpoint = arithmeticMap.endpointMap.has(number);
      const templateBoost = isBackZone
        ? Math.max(1, Math.round(templateRow.templateScore / sampleRuleWeight))
        : Math.max(1, Math.round(templateRow.templateScore / sampleRuleWeight));
      candidate.score += templateBoost;
      candidate.templateScore += templateBoost;
      candidate.templateHits += 1;
      candidate.sameRowSupport += templateRow.row === startRow ? 0 : 1;
      if (isBridgeGap || isBridgeEndpoint || isArithmeticEndpoint) {
        const coreBoost = sampleRuleWeight;
        candidate.score += coreBoost;
        candidate.templateScore += coreBoost;
        candidate.templateCoreHits += 1;
      }
    });

    if (!templateRow.integrityEligible) return;
    const segmentNumberSet = new Set(templateRow.consecutiveSegments.flat());
    const integrityBase = isBackZone
      ? Math.max(1, Math.floor(templateRow.templateScore / sampleRuleWeight))
      : Math.max(1, Math.floor(templateRow.templateScore / sampleRuleWeight));
    templateRow.numbers
      .filter((number) => !bridgeMap.gapSet.has(number) && !bridgeMap.endpointSet.has(number))
      .forEach((number) => {
        const candidate = getOrCreateSampleCandidate(candidateMap, number, zone);
        if (!candidate) return;
        const integrityBoost = segmentNumberSet.has(number) ? Math.max(4, Math.floor(integrityBase / 2)) : integrityBase;
        candidate.score += integrityBoost;
        candidate.integrityBonus += integrityBoost;
        candidate.templateHits += 1;
        candidate.sameRowSupport += 1;
      });

    if (templateRow.tailArithmetic?.strongestCount >= 2) {
      const tailBonus = isBackZone
        ? Math.max(1, integrityBase)
        : integrityBase;
      const tailNumbers = templateRow.tailArithmetic.tailBuckets.get(templateRow.tailArithmetic.strongestTail) || [];
      tailNumbers.forEach((number) => {
        if (bridgeMap.gapSet.has(number) || bridgeMap.endpointSet.has(number)) return;
        const candidate = getOrCreateSampleCandidate(candidateMap, number, zone);
        if (!candidate) return;
        candidate.score += tailBonus;
        candidate.integrityBonus += tailBonus;
        candidate.templateHits += 1;
        candidate.sameRowSupport += 1;
      });
    }

    templateRow.consecutiveSegments.forEach((segment) => {
      if (segment.length >= 3) return;
      const completionNumbers = segment.filter((number) => {
        if (bridgeMap.gapSet.has(number) || bridgeMap.endpointSet.has(number)) return false;
        return (
          bridgeMap.gapSet.has(number - 1) ||
          bridgeMap.gapSet.has(number + 1) ||
          bridgeMap.endpointSet.has(number - 1) ||
          bridgeMap.endpointSet.has(number + 1)
        );
      });
      if (completionNumbers.length === 0) return;
      const segmentBonus = isBackZone
        ? Math.max(1, Math.floor(integrityBase / 2))
        : Math.max(1, Math.floor(integrityBase / 2));
      completionNumbers.forEach((number) => {
        const candidate = getOrCreateSampleCandidate(candidateMap, number, zone);
        if (!candidate) return;
        candidate.score += segmentBonus;
        candidate.integrityBonus += segmentBonus;
        candidate.templateHits += 1;
        candidate.sameRowSupport += 1;
      });
    });
  });

  // 🆕 v4: 后区桥接效应 — 前期号码的邻居优先（±1、±2、±3加分）
  if (isBackZone) {
    const allBackBalls = collectBalls().filter(b => b.zone === "back");
    
    // 遗漏加分（保留，作为辅助）
    for (let n = 1; n <= 12; n++) {
      let lastRow = 0;
      for (const b of allBackBalls) {
        if (b.number === n && b.row <= sourceRow && b.row > lastRow) lastRow = b.row;
      }
      const gap = lastRow > 0 ? sourceRow - lastRow : sourceRow;
      if (gap >= 6) {
        const candidate = candidateMap.get(n);
        if (candidate) candidate.score += Math.round(gap * 0.3);
      }
    }
    
    // 桥接效应：前一期号码的±1、±2、±3邻居加分（与optimized_picker.js同步）
    const prevRow = sourceRow - 1;
    const prevBackBalls = allBackBalls.filter(b => b.row === prevRow);
    if (prevBackBalls.length > 0) {
      const prevNumbers = prevBackBalls.map(b => b.number);
      for (const p of prevNumbers) {
        // 重复加分（比例 2:3:2:1）
        const repeatCandidate = candidateMap.get(p);
        if (repeatCandidate) repeatCandidate.score += 6;
        
        // ±1、±2、±3桥接加分
        for (let offset = -3; offset <= 3; offset++) {
          if (offset === 0) continue;
          const nb = p + offset;
          if (nb >= 1 && nb <= 12) {
            const candidate = candidateMap.get(nb);
            if (candidate) {
              // ±1:+9, ±2:+6, ±3:+3（比例 3:2:1）
              candidate.score += Math.max(0, 4 - Math.abs(offset)) * 3;
            }
          }
        }
      }
    }
  }

  let candidateEntries = [...candidateMap.values()].sort(compareSampleCandidateEntries);

  // 🆕 v3优化：区间保底（保证三个区间至少各有3个候选号码）
  if (!isBackZone && candidateEntries.length >= 12) {
    const zoneCount = [0, 0, 0];
    const topPool = [];
    const seen = new Set();
    // 先按得分取TopN
    for (const entry of candidateEntries) {
      if (seen.has(entry.number)) continue;
      const ivIdx = getSampleIntervalIndex(entry.number, sampleIntervals);
      if (ivIdx < 0) continue;
      if (zoneCount[ivIdx] < 3 || topPool.length < sampleComboPoolSize + 10) {
        seen.add(entry.number);
        topPool.push(entry);
        zoneCount[ivIdx]++;
      }
      if (topPool.length >= Math.max(25, sampleComboPoolSize + 10)) break;
    }
    // 如果某区间不足3个，从该区间补高分号码
    for (let z = 0; z < 3; z++) {
      while (zoneCount[z] < 3) {
        const filler = candidateEntries.find(e => getSampleIntervalIndex(e.number, sampleIntervals) === z && !seen.has(e.number));
        if (!filler) break;
        seen.add(filler.number);
        topPool.push(filler);
        zoneCount[z]++;
      }
    }
    // 剩余高分候补（去重后追加到末尾）
    for (const entry of candidateEntries) {
      if (!seen.has(entry.number)) {
        seen.add(entry.number);
        topPool.push(entry);
      }
    }
    candidateEntries = topPool;
  }

  return {
    startRow,
    endRow,
    ratioSupportMap,
    referenceRows,
    selectedNumbers,
    arithmeticMap,
    candidates: candidateEntries.map((entry) => entry.number),
    candidateEntries,
    numbers: candidateEntries.slice(0, pickCount).map((entry) => entry.number),
  };
}

// ===================== v4.1 选号引擎 (optimized_picker.js 全管线移植) =====================
// ═══ 移植 optimized_picker.js: 池生成 + 组合评分(S4/S7/S8/S9/S10/S5-S6) + 多样性选择 ═══

// ═══ 连号分析工具（optimized_picker 原版）═══
function v4BuildConsecutiveSegments(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const segments = [];
  let seg = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] === 1) { seg.push(sorted[i]); }
    else { if (seg.length >= 2) segments.push(seg); seg = [sorted[i]]; }
  }
  if (seg.length >= 2) segments.push(seg);
  return segments;
}

function v4CountConsecutivePairs(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  let pairs = 0, longestRun = 1, currentRun = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] === 1) { currentRun++; pairs++; longestRun = Math.max(longestRun, currentRun); }
    else currentRun = 1;
  }
  return { pairs, longestRun };
}

// ═══ S2: 桥梁分析 ═══
function buildV4BridgeMap(anchors, supportNumbers) {
  const sorted = [...anchors].sort((a, b) => a - b);
  const supportSet = supportNumbers ? new Set(supportNumbers) : new Set();
  const supportTailSet = new Set([...supportSet].map((n) => n % 10));
  const gapMap = new Map(), endpointMap = new Map();
  for (let li = 0; li < sorted.length; li++) {
    for (let ri = li + 1; ri < sorted.length; ri++) {
      const left = sorted[li], right = sorted[ri];
      const gap = right - left;
      if (gap <= 1 || gap > 4) continue;
      const closeness = Math.max(1, 4 - gap + 1);
      [left, right].forEach((ep) => {
        const cur = endpointMap.get(ep) || { score: 0, hits: 0 };
        cur.hits += 1; cur.score += 8 + closeness * 3;
        if (supportSet.has(ep)) cur.score += 6;
        if (supportSet.has(ep - 1)) cur.score += 2;
        if (supportSet.has(ep + 1)) cur.score += 2;
        endpointMap.set(ep, cur);
      });
      for (let n = left + 1; n < right; n++) {
        const cur = gapMap.get(n) || { score: 0, hits: 0 };
        cur.hits += 1; cur.score += 24 + closeness * 6;
        if (supportSet.has(n)) cur.score += 14;
        let nbSupport = 0;
        if (supportSet.has(n - 1)) nbSupport++;
        if (supportSet.has(n + 1)) nbSupport++;
        if (nbSupport > 0) cur.score += nbSupport * 4;
        if (supportTailSet.has(n % 10)) cur.score += 2;
        gapMap.set(n, cur);
      }
    }
  }
  return { gapMap, endpointMap };
}

// ═══ S3: 等距端点分析 ═══
function buildV4ArithmeticMap(anchors, maxGap, supportNumbers) {
  maxGap = maxGap || 6;
  const sorted = [...anchors].sort((a, b) => a - b);
  const supportSet = supportNumbers ? new Set(supportNumbers) : new Set();
  const map = new Map();
  sorted.forEach((a) => {
    for (let d = 1; d <= maxGap; d++) {
      const left = a - d, right = a + d;
      [left, right].forEach((ep) => {
        if (ep < 1 || ep > 35) return;
        const cur = map.get(ep) || { score: 0, hits: 0 };
        cur.hits += 1; cur.score += 10 + (maxGap - d + 1) * 4;
        if (supportSet.has(ep)) cur.score += 6;
        if (supportSet.has(ep - 1) || supportSet.has(ep + 1)) cur.score += 2;
        map.set(ep, cur);
      });
    }
  });
  return map;
}

// ═══ S1: 间隔9+10并集池趋势映射（回测最优：覆盖率90.9%，联合≥3球65.7%）═══
function buildV4PlusTenTrendMap(sourceRow, sourceNumbers, boardBalls) {
  const targetMap = new Map(), neighborMap = new Map();
  if (!sourceNumbers || sourceNumbers.length === 0) return { targetMap, neighborMap };
  const sourceIv = intervalRatio(sourceNumbers);
  const sourceIvKey = sourceIv.join(":");
  const sourceTails = new Set(sourceNumbers.map((n) => n % 10));
  const sourceTailNeighborSet = new Set();
  sourceTails.forEach((t) => {
    sourceTailNeighborSet.add(t);
    sourceTailNeighborSet.add((t + 1) % 10);
    sourceTailNeighborSet.add((t + 9) % 10);
  });
  const filledRows = [];
  for (let r = 1; r <= drawRows; r++) {
    const nums = [...new Set(boardBalls.filter(
      (b) => b.row === r && b.zone === "front" && ballHasColor(b, sampleRedColor)
    ).map((b) => b.number))].sort((a, b) => a - b);
    if (nums.length === 5) filledRows.push({ row: r, numbers: nums });
  }
  // 🆕 间隔9+10并集池策略（权重优化：0.7间隔9 + 0.3间隔10）
  const intervals = [9, 10];
  const weights = [0.25, 0.45, 0.3]; // 间隔9权重更高（回测最优配置）
  for (let idx = 0; idx < intervals.length; idx++) {
    const interval = intervals[idx];
    const intervalWeight = weights[idx];
    for (let i = 0; i < filledRows.length; i++) {
      const histSrc = filledRows[i];
      if (histSrc.row >= sourceRow) continue;
      const histTgt = filledRows.find((r) => r.row === histSrc.row + interval);
      if (!histTgt) continue;
      const histSet = new Set(histSrc.numbers);
      const histTails = new Set(histSrc.numbers.map((n) => n % 10));
      const histTailNeighborSet = new Set();
      histTails.forEach((t) => {
        histTailNeighborSet.add(t);
        histTailNeighborSet.add((t + 1) % 10);
        histTailNeighborSet.add((t + 9) % 10);
      });
      // 7维权重体系
      const exactOverlap = sourceNumbers.filter((n) => histSet.has(n)).length;
      const neighborOverlap = sourceNumbers.filter((n) => histSet.has(n - 1) || histSet.has(n + 1)).length;
      const tailOverlap = sourceNumbers.filter((n) => histTails.has(n % 10)).length;
      const tailNeighborOverlap = sourceNumbers.filter((n) => histTailNeighborSet.has(n % 10)).length;
      const selectedTailSignal = histSrc.numbers.filter((n) => sourceTails.has(n % 10)).length;
      const selectedTailNeighborSignal = histSrc.numbers.filter((n) => sourceTailNeighborSet.has(n % 10)).length;
      const histIv = intervalRatio(histSrc.numbers);
      const ratioMatch = (histIv.join(":") === sourceIvKey) ? 1 : 0;
      const intervalDiff = histIv.reduce((t, c, j) => t + Math.abs(c - sourceIv[j]), 0);
      const intervalSimilarity = Math.max(0, 6 - intervalDiff);
      const rowDistance = Math.abs(histSrc.row - sourceRow);
      const proximityBonus = rowDistance <= 3 ? 10 : rowDistance <= 6 ? 6 : rowDistance <= 10 ? 3 : 0;
      const weight =
        (exactOverlap * 18 + neighborOverlap * 10 +
        tailOverlap * 8 + tailNeighborOverlap * 4 +
        selectedTailSignal * 5 + selectedTailNeighborSignal * 2 +
        ratioMatch * 16 + intervalSimilarity * 3 + proximityBonus) * intervalWeight;
      if (weight <= 0) continue;
      histTgt.numbers.forEach((n) => { targetMap.set(n, (targetMap.get(n) || 0) + weight); });
      histTgt.numbers.forEach((n) => {
        for (let d = 1; d <= 3; d++) {
          [n - d, n + d].forEach((nb) => {
            if (nb < 1 || nb > 35) return;
            const nbWeight = Math.max(1, Math.round(weight * 0.4 * (1 - d * 0.2)));
            neighborMap.set(nb, (neighborMap.get(nb) || 0) + nbWeight);
          });
        }
      });
    }
  }
  return { targetMap, neighborMap };
}

// ═══ S5: 增强参考行（含等差端点/桥梁/最强尾号/连号结构）═══
function buildV4FullReferenceRows(sourceRow, boardBalls) {
  const rows = [];
  const seen = new Set();
  for (let r = Math.max(1, sourceRow - 6); r < sourceRow; r++) {
    const nums = [...new Set(boardBalls.filter(
      (b) => b.row === r && b.zone === "front" && ballHasColor(b, sampleRedColor)
    ).map((b) => b.number))].sort((a, b) => a - b);
    if (nums.length === 5 && !seen.has(r)) {
      seen.add(r);
      const tailSet = new Set(nums.map((n) => n % 10));
      const iv = intervalRatio(nums);
      const { pairs: consecutivePairs, longestRun } = v4CountConsecutivePairs(nums);
      const consecutiveSegments = v4BuildConsecutiveSegments(nums);
      const arithEndpoints = new Set();
      for (let diff = 2; diff <= 6; diff++) {
        nums.forEach((n) => {
          const a = n - diff, b = n + diff;
          if (a >= 1 && a <= 35 && nums.includes(a)) { arithEndpoints.add(n); arithEndpoints.add(a); }
          if (b >= 1 && b <= 35 && nums.includes(b)) { arithEndpoints.add(n); arithEndpoints.add(b); }
        });
      }
      const bridgeGaps = new Set(), bridgeEndpoints = new Set();
      for (let j = 0; j < nums.length - 1; j++) {
        const gap = nums[j + 1] - nums[j];
        if (gap >= 2 && gap <= 4) {
          for (let g = nums[j] + 1; g < nums[j + 1]; g++) bridgeGaps.add(g);
          bridgeEndpoints.add(nums[j]); bridgeEndpoints.add(nums[j + 1]);
        }
      }
      const tailCount = new Map();
      nums.forEach((n) => tailCount.set(n % 10, (tailCount.get(n % 10) || 0) + 1));
      let strongestTail = null, strongestCount = 0;
      tailCount.forEach((c, t) => { if (c > strongestCount) { strongestCount = c; strongestTail = t; } });
      rows.push({
        row: r, numbers: nums, numberSet: new Set(nums), tailSet,
        ivKey: iv.join(":"), iv, consecutivePairs, longestRun, consecutiveSegments,
        arithEndpoints, bridgeGaps, bridgeEndpoints, strongestTail, strongestCount,
      });
    }
  }
  // 加目标前一期 (sourceRow-1)
  if (sourceRow > 1) {
    const r = sourceRow - 1;
    const nums = [...new Set(boardBalls.filter(
      (b) => b.row === r && b.zone === "front" && ballHasColor(b, sampleRedColor)
    ).map((b) => b.number))].sort((a, b) => a - b);
    if (nums.length === 5 && !seen.has(r)) {
      seen.add(r);
      const tailSet = new Set(nums.map((n) => n % 10));
      const iv = intervalRatio(nums);
      const { pairs: consecutivePairs, longestRun } = v4CountConsecutivePairs(nums);
      const consecutiveSegments = v4BuildConsecutiveSegments(nums);
      const arithEndpoints = new Set();
      for (let diff = 2; diff <= 6; diff++) {
        nums.forEach((n) => {
          const a = n - diff, b = n + diff;
          if (a >= 1 && a <= 35 && nums.includes(a)) { arithEndpoints.add(n); arithEndpoints.add(a); }
          if (b >= 1 && b <= 35 && nums.includes(b)) { arithEndpoints.add(n); arithEndpoints.add(b); }
        });
      }
      const bridgeGaps = new Set(), bridgeEndpoints = new Set();
      for (let j = 0; j < nums.length - 1; j++) {
        const gap = nums[j + 1] - nums[j];
        if (gap >= 2 && gap <= 4) {
          for (let g = nums[j] + 1; g < nums[j + 1]; g++) bridgeGaps.add(g);
          bridgeEndpoints.add(nums[j]); bridgeEndpoints.add(nums[j + 1]);
        }
      }
      const tailCount = new Map();
      nums.forEach((n) => tailCount.set(n % 10, (tailCount.get(n % 10) || 0) + 1));
      let strongestTail = null, strongestCount = 0;
      tailCount.forEach((c, t) => { if (c > strongestCount) { strongestCount = c; strongestTail = t; } });
      rows.push({
        row: r, numbers: nums, numberSet: new Set(nums), tailSet,
        ivKey: iv.join(":"), iv, consecutivePairs, longestRun, consecutiveSegments,
        arithEndpoints, bridgeGaps, bridgeEndpoints, strongestTail, strongestCount,
      });
    }
  }
  return rows;
}

// ═══ S4: 扩散惩罚 ═══
function v4GetSpreadPenalty(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  if (sorted.length <= 1) return { penalty: 0, span: 0, maxWindowCount: sorted.length, coveredIntervals: 1, maxIntervalCount: 1 };
  const span = sorted[sorted.length - 1] - sorted[0];
  const iv = [0, 0, 0]; sorted.forEach((n) => iv[getSampleIntervalIndex(n, sampleIntervals)]++);
  const coveredIntervals = iv.filter((c) => c > 0).length;
  const maxIntervalCount = Math.max(...iv);
  let penalty = 0;
  const denseWidth = 8;
  if (coveredIntervals >= 3) {
    if (span <= 18) penalty += 2; if (span <= 16) penalty += 6;
    if (span <= 13) penalty += 10; if (span <= 10) penalty += 16;
  } else if (coveredIntervals === 2) {
    if (span <= 12) penalty += 3; if (span <= 10) penalty += 7;
    if (span <= 8) penalty += 12; if (span <= 6) penalty += 16;
  } else {
    if (span <= 7) penalty += 2; if (span <= 5) penalty += 6; if (span <= 3) penalty += 10;
  }
  let maxWindowCount = 0;
  for (let si = 0; si < sorted.length; si++) {
    let ei = si;
    while (ei < sorted.length && sorted[ei] - sorted[si] <= denseWidth) ei++;
    const count = ei - si;
    maxWindowCount = Math.max(maxWindowCount, count);
    if (coveredIntervals >= 3) {
      if (count >= 4) penalty += 14 + (count - 4) * 8;
      else if (count === 3) penalty += 4;
    } else if (coveredIntervals === 2) {
      if (count >= 4) penalty += 10 + (count - 4) * 6;
    } else {
      if (count >= 4) penalty += 8 + (count - 4) * 4;
    }
  }
  if (coveredIntervals >= 3 && maxIntervalCount >= 4) penalty += 10 + (maxIntervalCount - 4) * 6;
  else if (coveredIntervals === 2 && maxIntervalCount >= 4) penalty += 8 + (maxIntervalCount - 4) * 4;
  return { penalty, span, maxWindowCount, coveredIntervals, maxIntervalCount };
}

// ═══ S8: 连号惩罚 ═══
function v4GetRunPenalty(numbers, anchorNumbers = []) {
  const segments = v4BuildConsecutiveSegments(numbers);
  const anchorSet = new Set(anchorNumbers);
  let longestRun = 0, runPenalty = 0, doubleRunCount = 0;
  segments.forEach((seg) => {
    longestRun = Math.max(longestRun, seg.length);
    const supportCount = seg.filter((n) => anchorSet.has(n)).length;
    const supportRatio = seg.length > 0 ? supportCount / seg.length : 0;
    const discount = supportRatio >= 0.8 ? 0.45 : supportRatio >= 0.6 ? 0.75 : 1;
    if (seg.length === 2) { doubleRunCount++; runPenalty += Math.round(8 * discount); }
    else if (seg.length >= 4) { runPenalty += Math.round((70 + (seg.length - 4) * 16) * discount); }
    else if (seg.length === 3) { runPenalty += Math.round(36 * discount); }
  });
  if (doubleRunCount >= 2) runPenalty += (doubleRunCount - 1) * 6;
  return { longestRun, runPenalty, doubleRunCount, segmentCount: segments.length };
}

// ═══ S9: 重复号奖励（v8反转：回测验证1-2个重号是强信号，0个重号反而是弱信号） ═══
function v4GetRepeatPenalty(numbers, sourceNumbers = []) {
  const sourceSet = new Set(sourceNumbers);
  const repeatCount = numbers.filter((n) => sourceSet.has(n)).length;
  // v8反转逻辑：1个重号最理想（72%概率），0个重号反而降分
  // 正值=bouns奖励，负值=penalty惩罚
  let bonus = 0;
  if (repeatCount === 1) bonus = 8;      // 1个重号：强信号
  else if (repeatCount === 2) bonus = 3; // 2个重号：中性偏强
  else if (repeatCount === 0) bonus = -5;// 0个重号：弱信号，轻微惩罚
  else if (repeatCount >= 3) bonus = -12;// 3+个重号：过度重叠，较强惩罚
  // repeatPenalty 保留为负数兼容名（正值=扣分，负值=加分，调用方用减法）
  return { repeatCount, repeatPenalty: -bonus, repeatBonus: bonus };
}

// ═══ S10: 尾号模式评分 ═══
function v4ScoreTailPatterns(comboNumbers) {
  const tl = [...new Set(comboNumbers.map((n) => n % 10))].sort((a, b) => a - b);
  let score = 0;
  let longestConsec = 1, currentConsec = 1;
  for (let i = 1; i < tl.length; i++) {
    if (tl[i] === tl[i - 1] + 1) { currentConsec++; longestConsec = Math.max(longestConsec, currentConsec); }
    else currentConsec = 1;
  }
  if (tl.includes(0) && tl.includes(9)) {
    let wrapRun = 1;
    for (let i = tl.length - 1; i >= 0 && tl[i] >= 9; i--) wrapRun++;
    longestConsec = Math.max(longestConsec, wrapRun);
  }
  if (longestConsec >= 3) score += 40;  // 优化：30→40
  else if (longestConsec >= 2) score += 20;  // 优化：15→20
  for (let d = 2; d <= 4; d++) {
    for (let start = 0; start <= 9 - d * 2; start++) {
      let count = 0;
      for (let v = start; v <= 9; v += d) { if (tl.includes(v)) count++; else break; }
      if (count >= 4) score += 30;  // 优化：25→30
      else if (count >= 3) score += 15;  // 优化：12→15
    }
  }
  // 尾号多样性（新增）
  if (tl.length >= 5) score += 20;
  else if (tl.length >= 4) score += 10;
  return { score, longestConsec, tailCount: tl.length };
}

// ═══ S6: 组合 vs 参考行评分（移植 optimized_picker scoreComboAgainstReferences）═══
function v4ScoreComboAgainstRefs(comboNumbers, refs) {
  let totalScore = 0, satisfiedRows = 0;
  refs.forEach((ref) => {
    let rowScore = 0;
    const tailOverlap = comboNumbers.filter((n) => ref.tailSet.has(n % 10)).length;
    rowScore += Math.min(tailOverlap, 3) * 8;

    const tailNeighborSet = new Set();
    ref.tailSet.forEach((t) => { tailNeighborSet.add((t + 1) % 10); tailNeighborSet.add((t + 9) % 10); });
    const tailNeighbor = comboNumbers.filter((n) => tailNeighborSet.has(n % 10)).length;
    rowScore += Math.min(tailNeighbor, 3) * 4;

    const overlap = comboNumbers.filter((n) => ref.numberSet.has(n)).length;
    rowScore += Math.min(overlap, 3) * 8;

    const neighborHits = comboNumbers.filter((n) => ref.numberSet.has(n - 1) || ref.numberSet.has(n + 1)).length;
    rowScore += Math.min(neighborHits, 3) * 4;

    const comboIv = intervalRatio(comboNumbers);
    if (comboIv.join(":") === ref.ivKey) rowScore += 12;

    if (ref.strongestCount >= 2 && ref.strongestTail !== null) {
      rowScore += comboNumbers.filter((n) => n % 10 === ref.strongestTail).length * 6;
    }

    // 等距端点（移植 optimized_picker: arithHits*5, ≥2则+6 bonus）
    if (ref.arithEndpoints && ref.arithEndpoints.size > 0) {
      const arithHits = comboNumbers.filter((n) => ref.arithEndpoints.has(n)).length;
      rowScore += arithHits * 5;
      if (arithHits >= 2) rowScore += 6;
    }

    // 桥梁（移植 optimized_picker: gapHits*6 + endHits*4, 合计≥2则+5 bonus）
    if (ref.bridgeGaps && ref.bridgeGaps.size > 0) {
      const gapHits = comboNumbers.filter((n) => ref.bridgeGaps.has(n)).length;
      const endHits = comboNumbers.filter((n) => ref.bridgeEndpoints && ref.bridgeEndpoints.has(n)).length;
      rowScore += gapHits * 6 + endHits * 4;
      if (gapHits + endHits >= 2) rowScore += 5;
    }

    // 结构相似性（移植 optimized_picker: pairSim + runSim）
    const { pairs: cp, longestRun: clr } = v4CountConsecutivePairs(comboNumbers);
    const pairSim = ref.consecutivePairs > 0
      ? Math.max(0, 3 - Math.abs(cp - ref.consecutivePairs))
      : cp === 0 ? 1 : 0;
    const runSim = ref.longestRun > 1
      ? Math.max(0, 3 - Math.abs(clr - ref.longestRun))
      : clr <= 2 ? 1 : 0;
    rowScore += (pairSim + runSim) * 3;

    // 连续段匹配（移植 optimized_picker）
    if (ref.consecutiveSegments) {
      ref.consecutiveSegments.forEach((seg) => {
        const segSet = new Set(seg);
        const shared = comboNumbers.filter((n) => segSet.has(n)).length;
        const adj = comboNumbers.filter((n) => segSet.has(n - 1) || segSet.has(n + 1)).length;
        if (shared >= Math.min(2, seg.length)) rowScore += 8;
        else if (adj > 0) rowScore += 3;
      });
    }

    totalScore += rowScore;
    if (rowScore >= 20) satisfiedRows++;
  });
  return { score: totalScore, satisfiedRows };
}

// ═══ 组合综合评分（完整移植 optimized_picker scoreCombo）═══
const V4_OFFSET_SCORE = { 0:20, 1:15, 2:13, 3:12, 4:10, 5:8, 6:6, 7:5, 8:4, 9:3, 10:2 };
const V4_TAIL_SAME = 35, V4_TAIL_NEIGHBOR = 15, V4_TAIL_WITHIN = 8;

function v4ScoreCombo(sorted, selectedEntries, anchors, sourceNums, refs, predictedTails = null, ivPrediction = null, firstBallPredictions = null, extremeFlags = null) {
  const s = sum(sorted);
  const sp = sorted[sorted.length - 1] - sorted[0];
  const odd = oddCount(sorted);
  // 硬过滤
  if (odd === 0 || odd === 5) return null;
  if (sp < 3 || sp > 34) return null;
  if (s < 20 || s > 170) return null;  // 宽泛安全网，动态约束在下方
  let maxConsec = 1, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] === 1) { run++; maxConsec = Math.max(maxConsec, run); }
    else run = 1;
  }
  if (maxConsec > 3) return null;
  const iv = [0, 0, 0]; sorted.forEach((n) => iv[getSampleIntervalIndex(n, sampleIntervals)]++);
  if (iv[0] >= 5 || iv[2] >= 5) return null;

  const baseScore = selectedEntries.reduce((a, b) => a + b.score, 0);
  let comboBonus = 0;

  // === 🆕 动态区间比-和值约束（基于119期历史数据P10-P90范围） ===
  const ivKey = iv.join(":");
  const ivSumRanges = {
    // 断一区（和值偏高）
    "0:1:4": { lo: 125, hi: 155 },
    "0:2:3": { lo: 110, hi: 135 },
    "0:3:2": { lo: 95, hi: 130 },
    "0:4:1": { lo: 85, hi: 125 },
    // 断二区（和值两极分化）
    "1:0:4": { lo: 100, hi: 140 },
    "2:0:3": { lo: 85, hi: 125 },
    "3:0:2": { lo: 60, hi: 100 },
    "4:0:1": { lo: 35, hi: 77 },
    // 三区均衡（最常见）
    "1:1:3": { lo: 95, hi: 135 },
    "1:2:2": { lo: 82, hi: 118 },
    "1:3:1": { lo: 75, hi: 112 },
    "2:1:2": { lo: 78, hi: 112 },
    "2:2:1": { lo: 58, hi: 97 },
    "3:1:1": { lo: 52, hi: 78 },
    // 断三区（和值偏低）
    "1:4:0": { lo: 59, hi: 90 },
    "2:3:0": { lo: 48, hi: 80 },
    "3:2:0": { lo: 38, hi: 76 },
    "4:1:0": { lo: 35, hi: 63 },
  };
  const sumRange = ivSumRanges[ivKey];
  if (sumRange) {
    // 硬过滤：超出理论极限的组合直接淘汰
    const hardMargin = 20;
    if (s < sumRange.lo - hardMargin || s > sumRange.hi + hardMargin) return null;
    // 软惩罚：偏离P10-P90范围越多，惩罚越重
    if (s < sumRange.lo) {
      const deviation = sumRange.lo - s;
      comboBonus -= Math.min(deviation * 1.5, 25);
    } else if (s > sumRange.hi) {
      const deviation = s - sumRange.hi;
      comboBonus -= Math.min(deviation * 1.5, 25);
    } else {
      // 在和值范围内，给予加分
      const rangeSize = sumRange.hi - sumRange.lo;
      const center = (sumRange.lo + sumRange.hi) / 2;
      const distFromCenter = Math.abs(s - center) / (rangeSize / 2);
      comboBonus += Math.round((1 - distFromCenter) * 10);
    }
  }

  // 基础结构（对齐optimized_picker）
  if (sp >= 18 && sp <= 24) comboBonus += 18;
  else if (sp >= 26 && sp <= 33) comboBonus += 12;
  if (odd === 1) comboBonus += 12;
  else if (odd === 3) comboBonus += 8;
  if (!iv.includes(0)) comboBonus += 5;
  else if (iv.filter((c) => c === 0).length === 1) comboBonus += 2;

  // 常见区间比奖励（移植 optimized_picker）
  const commonRatios = ["2:1:2", "2:2:1", "1:2:2", "3:1:1", "1:3:1", "1:1:3"];
  const ratioIndex = commonRatios.indexOf(ivKey);
  if (ratioIndex >= 0) comboBonus += ratioIndex < 3 ? 8 : 4;

  // 🆕 S13: 预测区间比匹配加分（关键缺失项！直接影响命中率）
  // 注意：预测准确率约20%，使用保守权重避免预测错误时误导
  if (ivPrediction && ivPrediction.predictedIv) {
    const predIv = ivPrediction.predictedIv;
    const ivDist = getIntervalRatioDistance(iv, predIv);
    if (ivDist === 0) {
      comboBonus += 12;  // 精确匹配预测区间比
    } else if (ivDist === 1) {
      comboBonus += 6;   // 接近预测区间比
    }
    // 距离>1不加分（预测准确率有限，避免过度约束）
  }

  // S4: 扩散惩罚
  const spread = v4GetSpreadPenalty(sorted);
  comboBonus -= Math.min(spread.penalty, 30);
  if (spread.coveredIntervals === 3 && spread.maxWindowCount <= 3) comboBonus += 5;
  if (spread.maxIntervalCount <= 2) comboBonus += 3;

  // 尾号多样性
  const comboTails = tails(sorted);
  if (comboTails.length >= 5) comboBonus += 4;
  else if (comboTails.length >= 4) comboBonus += 2;

  // 区间集中惩罚
  const ivMax = Math.max(...iv);
  if (ivMax >= 3) comboBonus -= (ivMax - 2) * 4;

  // S7: 锚点变换评分（v5优化：上限50→35，避免锚点过度主导）
  if (anchors.length > 0) {
    const anchorSet = new Set(anchors);
    let anchorKeepHits = 0, anchorOffsetSum = 0;
    sorted.forEach((n) => {
      if (anchorSet.has(n)) { anchorKeepHits++; return; }
      let bestPts = 0;
      anchors.forEach((a) => { const pts = V4_OFFSET_SCORE[Math.abs(n - a)] || 0; if (pts > bestPts) bestPts = pts; });
      anchorOffsetSum += bestPts;
    });
    comboBonus += Math.min(anchorOffsetSum * 0.6 + anchorKeepHits * 18, 35);  // 优化：50→35
    if (anchorKeepHits >= 2 && anchorKeepHits <= 3) comboBonus += (anchorKeepHits - 1) * 10;
    else if (anchorKeepHits >= 4) comboBonus -= (anchorKeepHits - 3) * 8;
    const explainedAnchors = new Set();
    sorted.forEach((n) => {
      anchors.forEach((a) => { if ((V4_OFFSET_SCORE[Math.abs(n - a)] || 0) > 0) explainedAnchors.add(a); });
    });
    if (explainedAnchors.size >= 4) comboBonus += 8;
    else if (explainedAnchors.size >= 3) comboBonus += 4;
  }

  // S8: 连号惩罚（v5优化：0.7/45→0.3/20，S8是命中率下降主因-3.3%）
  const runResult = v4GetRunPenalty(sorted, anchors);
  comboBonus -= Math.min(runResult.runPenalty * 0.3, 20);  // 优化：0.7/45→0.3/20

  // 🆕 连号概率奖励（基于历史分布：50%无连号, 38.2%双连号, 5.9%三连号）
  const consecSegments = v4BuildConsecutiveSegments(sorted);
  const doubleCount = consecSegments.filter(s => s.length === 2).length;
  const tripleCount = consecSegments.filter(s => s.length === 3).length;
  const totalConsecPairs = doubleCount + tripleCount * 2;
  if (totalConsecPairs === 0) {
    comboBonus += 3;
  } else if (doubleCount === 1 && tripleCount === 0) {
    comboBonus += 5;
  } else if (tripleCount === 1 && doubleCount === 0) {
    comboBonus += 3;
  } else if (doubleCount === 1 && tripleCount === 1) {
    comboBonus += 2;
  }

  // S9: 重复号惩罚 ×0.8 上限35
  if (sourceNums.length > 0) {
    const repeatResult = v4GetRepeatPenalty(sorted, sourceNums);
    comboBonus -= Math.min(repeatResult.repeatPenalty * 0.8, 35);

    // 🆕 v5: 区间比重号微调（仅组合级，不污染候选池）
    //     预测小变动(≤2)时1-2个重号最合理；预测大变动(≥5)时0-1个重号最优
    if (ivPrediction) {
      const srcSet = new Set(sourceNums);
      const repeatCnt = sorted.filter((n) => srcSet.has(n)).length;
      const dist = ivPrediction.distance;
      if (dist <= 2 && repeatCnt >= 1 && repeatCnt <= 2) {
        comboBonus += 3;
      } else if (dist >= 5 && repeatCnt <= 1) {
        comboBonus += 3;
      }
    }
  }

  // S10: 尾号模式 ×0.6（v4.2优化：0.4→0.6）
  const tailPattern = v4ScoreTailPatterns(sorted);
  comboBonus += tailPattern.score * 0.6;

  // 🆕 S11: 首位球动态预测加分（融合predictFirstBallComprehensive + 静态规律）
  const firstBall = sorted[0];
  if (firstBallPredictions && firstBallPredictions.length > 0) {
    // 动态预测：基于首位球综合预测（±3范围、±1相邻、+9期、等差延伸、尾号转移）
    const rank = firstBallPredictions.findIndex(([num]) => num === firstBall);
    if (rank >= 0 && rank < 3) comboBonus += 15;       // Top3预测号码
    else if (rank >= 3 && rank < 6) comboBonus += 12;  // Top4-6
    else if (rank >= 6 && rank < 10) comboBonus += 8;  // Top7-10
    else if (rank >= 10 && rank < 15) comboBonus += 4; // Top11-15
    else if (rank >= 15) comboBonus += 1;              // 其他预测号码
    // 邻近预测号码加分
    const isNearFirstBall = firstBallPredictions.slice(0, 5).some(([num]) => Math.abs(num - firstBall) === 1);
    if (isNearFirstBall) comboBonus += 5;
    // 静态规律补充：极端位置惩罚
    if (firstBall >= 18) comboBonus -= 10;  // 18+作为首位球极罕见
    if (firstBall >= 25) comboBonus -= 10;  // 25+几乎不会作为首位球
  } else {
    // 降级：仅静态规则（基于119期历史：95.8%首位球≤15，86.6%≤10）
    if (firstBall <= 5) comboBonus += 12;
    else if (firstBall <= 10) comboBonus += 8;
    else if (firstBall <= 15) comboBonus += 4;
    else if (firstBall >= 18) comboBonus -= 15;
  }

  // 🆕 S12: 极端期检测加分（移植 optimized_picker detectExtreme 逻辑）
  if (extremeFlags) {
    // 窄范围期：鼓励跨度≤12的组合
    if (extremeFlags.narrowRange && sp <= 12) {
      comboBonus += 8;
    }
    // 和值崩溃期：鼓励接近历史平均和值的组合
    if (extremeFlags.sumCrash) {
      const avgSum = 90; // 大乐透前区平均和值约90
      const sumDeviation = Math.abs(s - avgSum);
      if (sumDeviation <= 15) comboBonus += 6;
      else if (sumDeviation <= 25) comboBonus += 3;
    }
    // 奇偶翻转期：鼓励平衡奇偶比（2:3或3:2）
    if (extremeFlags.parityFlip) {
      const oddCount = sorted.filter(n => n % 2 === 1).length;
      if (oddCount >= 2 && oddCount <= 3) comboBonus += 6;
    }
  }

  // S5/S6: 增强参考行匹配
  if (refs.length > 0) {
    const refResult = v4ScoreComboAgainstRefs(sorted, refs);
    comboBonus += Math.round(refResult.score / 14);
    if (refResult.satisfiedRows >= 2) comboBonus += 7;
    else if (refResult.satisfiedRows >= 1) comboBonus += 3;
  }

  const score = baseScore + comboBonus;
  return { numbers: sorted, score, sum: s, span: sp, odd, iv: iv.join(":"), baseScore, comboBonus };
}

// ═══ 多样性选择（移植 selectDiverseTopN）═══
function v4SelectDiverseTopN(combos, n) {
  if (combos.length <= n) return combos;
  const selected = [combos[0]];
  const remaining = [...combos.slice(1)];
  const fingerprint = (c) => ({
    iv: c.iv,
    sumBucket: Math.round(c.sum / 10) * 10,
    spanBucket: Math.round(c.span / 5) * 5,
    odd: c.odd,
    numberSet: new Set(c.numbers),
  });
  const fps = remaining.map(fingerprint);
  while (selected.length < n && remaining.length > 0) {
    const selFps = selected.map(fingerprint);
    let bestIdx = 0, bestCombined = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const fp = fps[i];
      let diversity = 0;
      selFps.forEach((sfp) => {
        if (fp.iv !== sfp.iv) diversity += 20;
        if (Math.abs(fp.sumBucket - sfp.sumBucket) > 10) diversity += 12;
        if (Math.abs(fp.spanBucket - sfp.spanBucket) > 5) diversity += 8;
        let overlap = 0;
        fp.numberSet.forEach((n) => { if (sfp.numberSet.has(n)) overlap++; });
        diversity += (5 - overlap) * 8;
      });
      const combined = remaining[i].score * 0.75 + diversity;  // 优化：0.65→0.75，提高分数权重避免排斥高命中组合
      if (combined > bestCombined) { bestCombined = combined; bestIdx = i; }
    }
    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
    fps.splice(bestIdx, 1);
  }
  return selected;
}

// ═══ 尾号工具函数 ═══
function tails(nums) {
  if (!Array.isArray(nums) || nums.length === 0) return [];
  return [...new Set(nums.map((n) => n % 10))].sort((a, b) => a - b);
}

// ═══ v5: 区间比+辅助函数 ═══
function gi(n) {
  if (n >= 1 && n <= 12) return 0;
  if (n >= 13 && n <= 24) return 1;
  return 2;
}
function intervalRatio(nums) {
  const iv = [0, 0, 0];
  nums.forEach((n) => iv[gi(n)]++);
  return iv;
}
function sum(nums) { return nums.reduce((a, b) => a + b, 0); }
function oddCount(nums) { return nums.filter((n) => n % 2 === 1).length; }

// ═══ v5: 区间比距离 ═══
function getIntervalRatioDistance(ratio1, ratio2) {
  let dist = 0;
  for (let i = 0; i < 3; i++) dist += Math.abs((ratio1[i] || 0) - (ratio2[i] || 0));
  return dist;
}

// ═══ v5: 预测目标奇数个数（基于历史平均值） ═══
function predictTargetOddCount(sourceRow, boardBalls) {
  const draws = [];
  const seenRows = new Set();
  for (let r = Math.max(1, sourceRow - 30); r < sourceRow; r++) {
    const nums = [...new Set(boardBalls.filter(
      (b) => b.row === r && b.zone === "front" && ballHasColor(b, sampleRedColor)
    ).map((b) => b.number))].sort((a, b) => a - b);
    if (nums.length === 5 && !seenRows.has(r)) {
      seenRows.add(r);
      draws.push(nums);
    }
  }
  
  if (draws.length === 0) return 2.5; // 默认值
  
  const oddCounts = draws.map(nums => oddCount(nums));
  const avgOdd = oddCounts.reduce((a, b) => a + b, 0) / oddCounts.length;
  return Math.round(avgOdd);
}

// ═══ v5: 预测目标和值（基于历史平均值） ═══
function predictTargetSum(sourceRow, boardBalls) {
  const draws = [];
  const seenRows = new Set();
  for (let r = Math.max(1, sourceRow - 30); r < sourceRow; r++) {
    const nums = [...new Set(boardBalls.filter(
      (b) => b.row === r && b.zone === "front" && ballHasColor(b, sampleRedColor)
    ).map((b) => b.number))].sort((a, b) => a - b);
    if (nums.length === 5 && !seenRows.has(r)) {
      seenRows.add(r);
      draws.push(nums);
    }
  }
  
  if (draws.length === 0) return 80; // 默认值
  
  const sums = draws.map(nums => sum(nums));
  const avgSum = sums.reduce((a, b) => a + b, 0) / sums.length;
  return Math.round(avgSum);
}

// ═══ v5: 预测目标区间比（基于历史转移模式 + 时效性权重 + 全局校准） ═══
function predictTargetIntervalRatio(sourceRow, sourceIv, boardBalls) {
  // 从 board 提取所有前区历史
  const draws = [];
  const seenRows = new Set();
  for (let r = 1; r <= sourceRow; r++) {
    const nums = [...new Set(boardBalls.filter(
      (b) => b.row === r && b.zone === "front" && ballHasColor(b, sampleRedColor)
    ).map((b) => b.number))].sort((a, b) => a - b);
    if (nums.length === 5 && !seenRows.has(r)) {
      seenRows.add(r);
      draws.push(nums);
    }
  }

  const sourceIvKey = sourceIv.join(":");
  const transitions = new Map();
  // 优化：窗口 60→70，利用更多区间转移样本
  const windowSize = Math.min(70, draws.length);

  // ① 收集同源区间比特定转移 + 全局平均转移距离
  let specificCount = 0;
  let globalDistSum = 0, globalDistCount = 0;
  for (let i = 0; i < draws.length - 1; i++) {
    const sIv = intervalRatio(draws[i]);
    const tIv = intervalRatio(draws[i + 1]);
    globalDistSum += getIntervalRatioDistance(sIv, tIv);
    globalDistCount++;
    const sKey = sIv.join(":");
    if (sKey !== sourceIvKey) continue;
    specificCount++;
    const tKey = tIv.join(":");
    const recency = 1 + (i - Math.max(0, draws.length - 2 - windowSize)) / windowSize * 2;
    const entry = transitions.get(tKey) || { count: 0, weight: 0 };
    entry.count++;
    entry.weight += recency;
    transitions.set(tKey, entry);
  }

  const globalAvgDist = globalDistCount > 0 ? globalDistSum / globalDistCount : 3.0;
  const minSpecific = 4;
  const blendWeight = Math.min(1, specificCount / minSpecific);

  const maxWeight = Math.max(1, ...[...transitions.values()].map((d) => d.weight));
  const sorted = [...transitions.entries()]
    .map(([ivKey, data]) => ({
      iv: ivKey.split(":").map(Number),
      ivKey,
      score: data.count * 0.7 + (data.weight / maxWeight) * 30,
      count: data.count,
      weight: data.weight
    }))
    .sort((a, b) => b.score - a.score);

  if (sorted.length === 0) {
    const neutralDist = Math.round(globalAvgDist);
    return { predictedIv: sourceIv, predictedIvKey: sourceIvKey, distance: neutralDist, confidence: 0, topCandidates: [], globalAvgDist };
  }

  // 🆕 规律增强：区间变化模式检测
  const patternBoost = new Map(); // 区间比 -> 额外加分
  
  if (draws.length >= 3) {
    const recentIvs = [];
    for (let i = Math.max(0, draws.length - 5); i < draws.length; i++) {
      recentIvs.push(intervalRatio(draws[i]));
    }
    
    // 规律1: 区间不变时（占比33-40%），预期可能继续不变
    // 检测最近几期区间比是否相同
    let sameCount = 0;
    for (let i = recentIvs.length - 1; i >= 1; i--) {
      if (recentIvs[i][0] === recentIvs[i-1][0] && 
          recentIvs[i][1] === recentIvs[i-1][1] && 
          recentIvs[i][2] === recentIvs[i-1][2]) {
        sameCount++;
      } else break;
    }
    if (sameCount >= 2) {
      // 连续3期以上相同，预期可能继续不变
      const currentKey = sourceIv.join(":");
      const boost = patternBoost.get(currentKey) || 0;
      patternBoost.set(currentKey, boost + sameCount * 3);
    }
    
    // 规律2: 极值后回归（概率78-100%）
    for (let zone = 0; zone < 3; zone++) {
      if (sourceIv[zone] === 0) {
        // 极低值，预期回归（+1或+2）
        const predicted = [...sourceIv];
        predicted[zone] = Math.min(3, predicted[zone] + 2);
        const key = predicted.join(":");
        const boost = patternBoost.get(key) || 0;
        patternBoost.set(key, boost + 8); // 高置信度
        
        // 也考虑+1的情况
        const predicted2 = [...sourceIv];
        predicted2[zone] = Math.min(3, predicted2[zone] + 1);
        const key2 = predicted2.join(":");
        const boost2 = patternBoost.get(key2) || 0;
        patternBoost.set(key2, boost2 + 5);
      }
      if (sourceIv[zone] >= 4) {
        // 极高值，预期回归（-1或-2）
        const predicted = [...sourceIv];
        predicted[zone] = Math.max(0, predicted[zone] - 2);
        const key = predicted.join(":");
        const boost = patternBoost.get(key) || 0;
        patternBoost.set(key, boost + 8);
        
        const predicted2 = [...sourceIv];
        predicted2[zone] = Math.max(0, predicted2[zone] - 1);
        const key2 = predicted2.join(":");
        const boost2 = patternBoost.get(key2) || 0;
        patternBoost.set(key2, boost2 + 5);
      }
    }
    
    // 规律3: 连续同向变化后反转（小样本，谨慎使用）
    if (recentIvs.length >= 3) {
      const current = recentIvs[recentIvs.length - 1];
      const prev = recentIvs[recentIvs.length - 2];
      const prevPrev = recentIvs[recentIvs.length - 3];
      
      for (let zone = 0; zone < 3; zone++) {
        const diff1 = current[zone] - prev[zone];
        const diff2 = prev[zone] - prevPrev[zone];
        
        // 连续2期增大后，预期减小
        if (diff1 > 0 && diff2 > 0) {
          const predicted = [...current];
          predicted[zone] = Math.max(0, predicted[zone] - 1);
          const key = predicted.join(":");
          const boost = patternBoost.get(key) || 0;
          patternBoost.set(key, boost + 4); // 中等置信度
        }
        // 连续2期减小后，预期增大
        if (diff1 < 0 && diff2 < 0) {
          const predicted = [...current];
          predicted[zone] = Math.min(5, predicted[zone] + 1);
          const key = predicted.join(":");
          const boost = patternBoost.get(key) || 0;
          patternBoost.set(key, boost + 4);
        }
      }
    }
  }
  
  // 应用规律加分到候选
  const enhanced = sorted.map(candidate => {
    const patternBonus = patternBoost.get(candidate.ivKey) || 0;
    return {
      ...candidate,
      score: candidate.score + patternBonus,
      patternBonus
    };
  }).sort((a, b) => b.score - a.score);

  const topCandidates = enhanced.slice(0, 3);
  const rawDistance = getIntervalRatioDistance(sourceIv, topCandidates[0].iv);
  const totalScore = topCandidates.reduce((s, c) => s + c.score, 0);
  const rawConfidence = topCandidates[0].score / Math.max(0.1, totalScore);

  // ② 与全局均值融合：防止小样本过拟合
  const blendedDistance = Math.round(rawDistance * blendWeight + globalAvgDist * (1 - blendWeight));
  const confidence = rawConfidence * blendWeight;

  return { 
    predictedIv: topCandidates[0].iv, 
    predictedIvKey: topCandidates[0].ivKey, 
    distance: blendedDistance, 
    confidence, 
    topCandidates: topCandidates.slice(0, 5), // 返回更多候选供参考
    globalAvgDist,
    patternBoost: Object.fromEntries(patternBoost) // 返回规律加分信息
  };
}

// ═══ 尾号转移模式分析 ═══
function analyzeTailTransitionsV4(sourceRow, lookback, allBalls) {
  lookback = lookback || 50;
  const transFreq = new Map(); // "sourceTail→targetTail" → count
  const tailFreq = new Map();  // 目标尾号出现频率
  for (let t = 0; t <= 9; t++) tailFreq.set(t, 0);

  const start = Math.max(1, sourceRow - lookback);
  for (let r = start; r < sourceRow - 1; r++) {
    // 尾号转移分析用全部前区号码（不限颜色），完整反映每期间5个号码的尾号演变
    const srcNums = [...new Set(allBalls.filter(
      (b) => b.row === r && b.zone === "front"
    ).map((b) => b.number))].sort((a, b) => a - b);
    const tgtNums = [...new Set(allBalls.filter(
      (b) => b.row === r + 1 && b.zone === "front"
    ).map((b) => b.number))].sort((a, b) => a - b);
    if (srcNums.length !== 5 || tgtNums.length !== 5) continue;
    const srcTails = tails(srcNums);
    const tgtTails = tails(tgtNums);
    tgtTails.forEach((tt) => tailFreq.set(tt, tailFreq.get(tt) + 1));
    srcTails.forEach((st) => {
      tgtTails.forEach((tt) => {
        const key = `${st}→${tt}`;
        transFreq.set(key, (transFreq.get(key) || 0) + 1);
      });
    });
  }
  return { transFreq, tailFreq };
}

// ═══ 开奖号码尾号关联性分析 ═══
// 分析开奖号码之间的尾号对、三元组等关联性模式
function analyzeTailCorrelation(allBalls, sourceRow, lookback = 100) {
  const tailPairFreq = new Map(); // 尾号对出现频率
  const tailTripletFreq = new Map(); // 尾号三元组出现频率
  const consecutiveTripletFreq = new Map(); // 连续尾号三元组（如9,0,1）
  const consecutiveQuadFreq = new Map(); // 🆕 连续尾号四元组（如1,2,3,4）
  const consecutiveQuintFreq = new Map(); // 🆕 连续尾号五元组（如1,2,3,4,5）
  const arithmeticTripletFreq = new Map(); // 等差尾号三元组（任意步长）
  const arithmeticQuadFreq = new Map(); // 等差尾号四元组（任意步长）
  const multiSegmentFreq = new Map(); // 多段连续模式（如2,3,4,7,8）
  const mixedPatternFreq = new Map(); // 混合模式（连续+等差、三连+等差等）
  
  const start = Math.max(1, sourceRow - lookback);
  for (let r = start; r < sourceRow; r++) {
    const nums = [...new Set(allBalls.filter(
      (b) => b.row === r && b.zone === "front"
    ).map((b) => b.number))].sort((a, b) => a - b);
    
    if (nums.length !== 5) continue;
    
    const drawTails = [...new Set(nums.map((n) => n % 10))].sort((a, b) => a - b);
    
    // 统计尾号对
    for (let i = 0; i < drawTails.length; i++) {
      for (let j = i + 1; j < drawTails.length; j++) {
        const pair = `${drawTails[i]},${drawTails[j]}`;
        tailPairFreq.set(pair, (tailPairFreq.get(pair) || 0) + 1);
      }
    }
    
    // 统计尾号三元组
    for (let i = 0; i < drawTails.length; i++) {
      for (let j = i + 1; j < drawTails.length; j++) {
        for (let k = j + 1; k < drawTails.length; k++) {
          const triplet = `${drawTails[i]},${drawTails[j]},${drawTails[k]}`;
          tailTripletFreq.set(triplet, (tailTripletFreq.get(triplet) || 0) + 1);
        }
      }
    }
    
    // 🆕 统计连续尾号三元组（如9,0,1）
    for (let i = 0; i < drawTails.length; i++) {
      for (let j = i + 1; j < drawTails.length; j++) {
        for (let k = j + 1; k < drawTails.length; k++) {
          const t1 = drawTails[i], t2 = drawTails[j], t3 = drawTails[k];
          const isConsecutive = (
            (t2 === (t1 + 1) % 10 && t3 === (t2 + 1) % 10) ||
            (t1 === (t2 + 1) % 10 && t2 === (t3 + 1) % 10)
          );
          if (isConsecutive) {
            const key = `${t1},${t2},${t3}`;
            consecutiveTripletFreq.set(key, (consecutiveTripletFreq.get(key) || 0) + 1);
          }
        }
      }
    }
    
    // 🆕 统计等差尾号三元组（任意步长1-4）
    for (let i = 0; i < drawTails.length; i++) {
      for (let j = i + 1; j < drawTails.length; j++) {
        for (let k = j + 1; k < drawTails.length; k++) {
          const t1 = drawTails[i], t2 = drawTails[j], t3 = drawTails[k];
          // 检查任意步长（1-4）
          for (let step = 1; step <= 4; step++) {
            const isArithmetic = (
              (t2 - t1 === step && t3 - t2 === step) ||
              (t1 - t2 === step && t2 - t3 === step)
            );
            if (isArithmetic) {
              const key = `${t1},${t2},${t3}`;
              arithmeticTripletFreq.set(key, (arithmeticTripletFreq.get(key) || 0) + 1);
            }
          }
        }
      }
    }
    
    // 🆕 统计等差尾号四元组（任意步长1-4）
    if (drawTails.length >= 4) {
      for (let i = 0; i < drawTails.length; i++) {
        for (let j = i + 1; j < drawTails.length; j++) {
          for (let k = j + 1; k < drawTails.length; k++) {
            for (let l = k + 1; l < drawTails.length; l++) {
              const t1 = drawTails[i], t2 = drawTails[j], t3 = drawTails[k], t4 = drawTails[l];
              for (let step = 1; step <= 4; step++) {
                const isArithmetic = (
                  (t2 - t1 === step && t3 - t2 === step && t4 - t3 === step) ||
                  (t1 - t2 === step && t2 - t3 === step && t3 - t4 === step)
                );
                if (isArithmetic) {
                  const key = `${t1},${t2},${t3},${t4}`;
                  arithmeticQuadFreq.set(key, (arithmeticQuadFreq.get(key) || 0) + 1);
                }
              }
            }
          }
        }
      }
    }
    
    // 🆕 统计4连尾号（如1,2,3,4）
    if (drawTails.length >= 4) {
      for (let i = 0; i < drawTails.length; i++) {
        for (let j = i + 1; j < drawTails.length; j++) {
          for (let k = j + 1; k < drawTails.length; k++) {
            for (let l = k + 1; l < drawTails.length; l++) {
              const t1 = drawTails[i], t2 = drawTails[j], t3 = drawTails[k], t4 = drawTails[l];
              const sorted = [t1, t2, t3, t4].sort((a, b) => a - b);
              // 检查4连（包括循环：如7,8,9,0）
              const isConsecutive4 = (
                (sorted[1] === (sorted[0] + 1) % 10 && 
                 sorted[2] === (sorted[1] + 1) % 10 && 
                 sorted[3] === (sorted[2] + 1) % 10) ||
                (sorted[0] === 7 && sorted[1] === 8 && sorted[2] === 9 && sorted[3] === 0) ||
                (sorted[0] === 8 && sorted[1] === 9 && sorted[2] === 0 && sorted[3] === 1) ||
                (sorted[0] === 9 && sorted[1] === 0 && sorted[2] === 1 && sorted[3] === 2)
              );
              if (isConsecutive4) {
                const key = `${sorted[0]},${sorted[1]},${sorted[2]},${sorted[3]}`;
                consecutiveQuadFreq.set(key, (consecutiveQuadFreq.get(key) || 0) + 1);
              }
            }
          }
        }
      }
    }
    
    // 🆕 统计5连尾号（如1,2,3,4,5）
    if (drawTails.length >= 5) {
      for (let i = 0; i < drawTails.length; i++) {
        for (let j = i + 1; j < drawTails.length; j++) {
          for (let k = j + 1; k < drawTails.length; k++) {
            for (let l = k + 1; l < drawTails.length; l++) {
              for (let m = l + 1; m < drawTails.length; m++) {
                const t1 = drawTails[i], t2 = drawTails[j], t3 = drawTails[k], t4 = drawTails[l], t5 = drawTails[m];
                const sorted = [t1, t2, t3, t4, t5].sort((a, b) => a - b);
                // 检查5连（包括循环：如6,7,8,9,0）
                const isConsecutive5 = (
                  (sorted[1] === (sorted[0] + 1) % 10 && 
                   sorted[2] === (sorted[1] + 1) % 10 && 
                   sorted[3] === (sorted[2] + 1) % 10 &&
                   sorted[4] === (sorted[3] + 1) % 10) ||
                  (sorted[0] === 6 && sorted[1] === 7 && sorted[2] === 8 && sorted[3] === 9 && sorted[4] === 0) ||
                  (sorted[0] === 7 && sorted[1] === 8 && sorted[2] === 9 && sorted[3] === 0 && sorted[4] === 1) ||
                  (sorted[0] === 8 && sorted[1] === 9 && sorted[2] === 0 && sorted[3] === 1 && sorted[4] === 2) ||
                  (sorted[0] === 9 && sorted[1] === 0 && sorted[2] === 1 && sorted[3] === 2 && sorted[4] === 3)
                );
                if (isConsecutive5) {
                  const key = `${sorted[0]},${sorted[1]},${sorted[2]},${sorted[3]},${sorted[4]}`;
                  consecutiveQuintFreq.set(key, (consecutiveQuintFreq.get(key) || 0) + 1);
                }
              }
            }
          }
        }
      }
    }
    
    // 🆕 统计多段连续模式（如2,3,4,7,8）
    // 检测drawTails中的连续段
    const segments = [];
    let currentSegment = [drawTails[0]];
    for (let i = 1; i < drawTails.length; i++) {
      if (drawTails[i] === (drawTails[i-1] + 1) % 10) {
        currentSegment.push(drawTails[i]);
      } else {
        if (currentSegment.length >= 2) {
          segments.push([...currentSegment]);
        }
        currentSegment = [drawTails[i]];
      }
    }
    if (currentSegment.length >= 2) {
      segments.push([...currentSegment]);
    }
    
    // 如果有多个连续段，记录模式
    if (segments.length >= 2) {
      const pattern = segments.map(s => s.join(',')).join('|');
      multiSegmentFreq.set(pattern, (multiSegmentFreq.get(pattern) || 0) + 1);
    }
    
    // 🆕 统计混合模式（连续段+等差段同时存在）
    // 检测5个尾号中是否同时包含连续段和等差段
    const hasConsecutiveSegment = (() => {
      // 检查是否有连续对（包括循环连续如9,0）
      for (let i = 0; i < drawTails.length; i++) {
        for (let j = i + 1; j < drawTails.length; j++) {
          const diff = Math.abs(drawTails[i] - drawTails[j]);
          if (diff === 1 || diff === 9) return true; // 连续（包括循环）
        }
      }
      return false;
    })();
    
    const hasArithmeticSegment = (() => {
      // 检查是否有等差三元组（步长2-4）
      for (let i = 0; i < drawTails.length; i++) {
        for (let j = i + 1; j < drawTails.length; j++) {
          for (let k = j + 1; k < drawTails.length; k++) {
            const sorted3 = [drawTails[i], drawTails[j], drawTails[k]].sort((a, b) => a - b);
            // 检查等差（步长2-4）
            if (sorted3[1] - sorted3[0] === sorted3[2] - sorted3[1] && 
                sorted3[1] - sorted3[0] >= 2 && sorted3[1] - sorted3[0] <= 4) {
              return true;
            }
          }
        }
      }
      return false;
    })();
    
    // 如果同时存在连续段和等差段，记录为混合模式
    if (hasConsecutiveSegment && hasArithmeticSegment) {
      const pattern = drawTails.join(',');
      mixedPatternFreq.set(pattern, (mixedPatternFreq.get(pattern) || 0) + 1);
    }
  }
  
  return { 
    tailPairFreq, tailTripletFreq, consecutiveTripletFreq, consecutiveQuadFreq, consecutiveQuintFreq,
    arithmeticTripletFreq, arithmeticQuadFreq, multiSegmentFreq, mixedPatternFreq 
  };
}

// ═══ 基于关联性分析生成六个尾号组合 ═══
function generateTailCorrelationBasedCombos(tailCorrelationData, predictedTails, allBalls, sourceRow, tailPool) {
  const combos = [];
  const allTails = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  
  // 辅助函数：从模式中提取尾号
  function extractTailsFromPattern(pattern) {
    return pattern.split(',').map(Number);
  }
  
  // 辅助函数：补充尾号到4-5个（不总是5个）
  function supplementTails(baseTails, predictedTails, allTails) {
    const result = [...baseTails];
    const used = new Set(baseTails);
    // 目标数量：4或5，基础尾号越多越倾向5
    const target = baseTails.length >= 4 ? 5 : (Math.random() < 0.5 ? 4 : 5);
    
    // 首先从预测的高频尾号中补充
    for (const [tail, score] of predictedTails) {
      if (result.length >= target) break;
      if (!used.has(tail)) {
        result.push(tail);
        used.add(tail);
      }
    }
    
    // 如果还不够，从所有尾号中补充
    for (const tail of allTails) {
      if (result.length >= target) break;
      if (!used.has(tail)) {
        result.push(tail);
        used.add(tail);
      }
    }
    
    return result.slice(0, target);
  }
  
  // 辅助函数：计算组合评分
  function scoreCombo(tails, predictedTails) {
    let score = 0;
    const predictedMap = new Map(predictedTails);
    for (const tail of tails) {
      score += predictedMap.get(tail) || 0;
    }
    return score;
  }
  
  // 1. 基于高频尾号对
  const topPairs = [...tailCorrelationData.tailPairFreq.entries()]
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  for (const [pair, count] of topPairs) {
    const baseTails = extractTailsFromPattern(pair);
    const comboTails = supplementTails(baseTails, predictedTails, allTails);
    combos.push({ tails: comboTails, source: 'pair', pattern: pair, count });
  }
  
  // 2. 基于高频三元组
  const topTriplets = [...tailCorrelationData.tailTripletFreq.entries()]
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  for (const [triplet, count] of topTriplets) {
    const baseTails = extractTailsFromPattern(triplet);
    const comboTails = supplementTails(baseTails, predictedTails, allTails);
    combos.push({ tails: comboTails, source: 'triplet', pattern: triplet, count });
  }
  
  // 3. 基于连续三元组
  const topConsecutive = [...tailCorrelationData.consecutiveTripletFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);
  
  for (const [pattern, count] of topConsecutive) {
    const baseTails = extractTailsFromPattern(pattern);
    const comboTails = supplementTails(baseTails, predictedTails, allTails);
    combos.push({ tails: comboTails, source: 'consecutive', pattern, count });
  }
  
  // 4. 基于等差三元组
  const topArithmetic = [...tailCorrelationData.arithmeticTripletFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);
  
  for (const [pattern, count] of topArithmetic) {
    const baseTails = extractTailsFromPattern(pattern);
    const comboTails = supplementTails(baseTails, predictedTails, allTails);
    combos.push({ tails: comboTails, source: 'arithmetic', pattern, count });
  }
  
  // 5. 基于多段连续模式
  const topMultiSegment = [...tailCorrelationData.multiSegmentFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);
  
  for (const [pattern, count] of topMultiSegment) {
    // 多段连续模式格式如 "2,3,4|7,8"
    const segments = pattern.split('|');
    const baseTails = segments.flatMap(segment => extractTailsFromPattern(segment));
    const comboTails = supplementTails(baseTails, predictedTails, allTails);
    combos.push({ tails: comboTails, source: 'multiSegment', pattern, count });
  }
  
  // 6. 基于混合模式
  const topMixed = [...tailCorrelationData.mixedPatternFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);
  
  for (const [pattern, count] of topMixed) {
    const baseTails = extractTailsFromPattern(pattern);
    const comboTails = supplementTails(baseTails, predictedTails, allTails);
    combos.push({ tails: comboTails, source: 'mixed', pattern, count });
  }
  
  // 为每个组合计算评分
  const scoredCombos = combos.map(combo => ({
    ...combo,
    score: scoreCombo(combo.tails, predictedTails)
  }));
  
  // 按评分排序，返回前6个
  scoredCombos.sort((a, b) => b.score - a.score);
  return scoredCombos.slice(0, 6);
}

// ═══ 获取桥接尾号 ═══
// 获取上期开奖号码尾号之间间隔在maxGap以内的尾号
function getBridgeTails(srcTails, maxGap = 3) {
  const sorted = [...srcTails].sort((a, b) => a - b);
  const bridgeTails = new Set();
  
  for (let i = 0; i < sorted.length; i++) {
    const next = (i + 1) % sorted.length;
    const t1 = sorted[i];
    const t2 = sorted[next];
    
    // 计算间隔
    let gap;
    if (i < sorted.length - 1) {
      gap = t2 - t1 - 1;
    } else {
      // 循环间隔
      gap = (10 - t1 - 1) + t2;
    }
    
    if (gap > 0 && gap <= maxGap) {
      if (i < sorted.length - 1) {
        for (let t = t1 + 1; t < t2; t++) {
          bridgeTails.add(t);
        }
      } else {
        // 循环：t1+1到9，0到t2-1
        for (let t = t1 + 1; t <= 9; t++) {
          bridgeTails.add(t);
        }
        for (let t = 0; t < t2; t++) {
          bridgeTails.add(t);
        }
      }
    }
  }
  
  return [...bridgeTails];
}

// ═══ 尾号关联性评分 ═══
// 基于开奖号码尾号关联性为候选号码评分（使用历史频率）
function getTailCorrelationScore(number, srcTails, correlationData) {
  if (!correlationData) return 0;
  
  const { tailPairFreq, tailTripletFreq, consecutiveTripletFreq, consecutiveQuadFreq, consecutiveQuintFreq,
          arithmeticTripletFreq, arithmeticQuadFreq, multiSegmentFreq, mixedPatternFreq } = correlationData;
  const nTail = number % 10;
  let score = 0;
  
  // 1. 检查尾号对：高频尾号对加分
  srcTails.forEach((srcTail) => {
    const pair = srcTail < nTail ? `${srcTail},${nTail}` : `${nTail},${srcTail}`;
    const pairFreq = tailPairFreq.get(pair) || 0;
    if (pairFreq > 5) { // 出现超过5次的尾号对
      score += pairFreq * 0.7; // 折中权重：0.5 → 0.7
    }
  });
  
  // 2. 检查尾号三元组：高频三元组加分
  if (srcTails.length >= 2) {
    for (let i = 0; i < srcTails.length; i++) {
      for (let j = i + 1; j < srcTails.length; j++) {
        const t1 = srcTails[i], t2 = srcTails[j];
        const triplet = [t1, t2, nTail].sort().join(',');
        const tripletFreq = tailTripletFreq.get(triplet) || 0;
        if (tripletFreq > 3) { // 出现超过3次的尾号三元组
          score += tripletFreq * 1.0; // 折中权重：0.8 → 1.0
        }
      }
    }
  }
  
  // 3. 检查连续尾号三元组（如9,0,1）
  if (srcTails.length >= 2) {
    for (let i = 0; i < srcTails.length; i++) {
      for (let j = i + 1; j < srcTails.length; j++) {
        const t1 = srcTails[i], t2 = srcTails[j];
        // 检查是否形成连续三元组
        const isConsecutive = (
          (t2 === (t1 + 1) % 10 && nTail === (t2 + 1) % 10) || // 正向连续
          (t1 === (t2 + 1) % 10 && t2 === (nTail + 1) % 10) || // 反向连续
          (nTail === (t1 + 1) % 10 && t1 === (t2 + 1) % 10)    // 循环连续
        );
        if (isConsecutive) {
          const key = `${t1},${t2},${nTail}`;
          const freq = consecutiveTripletFreq.get(key) || 0;
          if (freq > 1) { // 出现超过1次的连续三元组（降低阈值）
            score += freq * 2.5; // 折中权重：2.0 → 2.5
          }
        }
      }
    }
  }
  
  // 4. 检查等差尾号三元组（任意步长1-4）
  if (srcTails.length >= 2) {
    for (let i = 0; i < srcTails.length; i++) {
      for (let j = i + 1; j < srcTails.length; j++) {
        const t1 = srcTails[i], t2 = srcTails[j];
        for (let step = 1; step <= 4; step++) {
          const isArithmetic = (
            (t2 - t1 === step && nTail - t2 === step) || // 正向等差
            (t1 - t2 === step && t2 - nTail === step) || // 反向等差
            (nTail - t1 === step && t1 - t2 === step)    // 循环等差
          );
          if (isArithmetic) {
            const key = `${t1},${t2},${nTail}`;
            const freq = arithmeticTripletFreq.get(key) || 0;
            if (freq > 1) { // 出现超过1次的等差三元组（降低阈值）
              // 等差3关系命中率最高（93.75%），给予更高权重
              const stepWeight = step === 3 ? 1.8 : (step === 2 ? 1.5 : 1.2);
              score += freq * stepWeight;
            }
          }
        }
      }
    }
  }
  
  // 5. 检查等差尾号四元组（任意步长1-4）
  if (srcTails.length >= 3) {
    for (let i = 0; i < srcTails.length; i++) {
      for (let j = i + 1; j < srcTails.length; j++) {
        for (let k = j + 1; k < srcTails.length; k++) {
          const t1 = srcTails[i], t2 = srcTails[j], t3 = srcTails[k];
          for (let step = 1; step <= 4; step++) {
            const isArithmetic = (
              (t2 - t1 === step && t3 - t2 === step && nTail - t3 === step) || // 正向等差
              (t1 - t2 === step && t2 - t3 === step && t3 - nTail === step)    // 反向等差
            );
            if (isArithmetic) {
              const key = `${t1},${t2},${t3},${nTail}`;
              const freq = arithmeticQuadFreq.get(key) || 0;
              if (freq > 0) { // 出现超过0次的等差四元组（进一步降低阈值）
                score += freq * 1.8; // 折中权重：1.5 → 1.8
              }
            }
          }
        }
      }
    }
  }
  
  // 6. 检查等差尾号对（任意步长1-4）
  srcTails.forEach((srcTail) => {
    for (let step = 1; step <= 4; step++) {
      const diff = Math.abs(srcTail - nTail);
      if (diff === step || diff === 10 - step) { // 考虑循环
        const key = `${Math.min(srcTail,nTail)},${Math.max(srcTail,nTail)}`;
        const freq = arithmeticTripletFreq.get(key) || 0; // 复用三元组频率
        if (freq > 5) { // 出现超过5次的等差对
          score += freq * 0.4; // 折中权重：0.3 → 0.4
        }
      }
    }
  });
  
  // 7. 🆕 桥接尾号加分
  // 候选号码尾号与桥接尾号（间隔3以内的尾号）相同则加分
  const bridgeTails = getBridgeTails(srcTails, 3);
  if (bridgeTails.includes(nTail)) {
    score += 12; // 桥接权重保持12
  }
  
  // 8. 🆕 检查4连尾号（如1,2,3,4 → 延伸5或0）
  if (srcTails.length >= 3) {
    for (let i = 0; i < srcTails.length; i++) {
      for (let j = i + 1; j < srcTails.length; j++) {
        for (let k = j + 1; k < srcTails.length; k++) {
          const t1 = srcTails[i], t2 = srcTails[j], t3 = srcTails[k];
          const sorted3 = [t1, t2, t3].sort((a, b) => a - b);
          // 检查是否形成3连
          const isTripleConsecutive = (
            (sorted3[1] === (sorted3[0] + 1) % 10 && sorted3[2] === (sorted3[1] + 1) % 10) ||
            (sorted3[0] === 8 && sorted3[1] === 9 && sorted3[2] === 0) ||
            (sorted3[0] === 9 && sorted3[1] === 0 && sorted3[2] === 1)
          );
          if (isTripleConsecutive) {
            // 检查候选尾号是否形成4连
            const nextTail = (sorted3[2] + 1) % 10;
            const prevTail = (sorted3[0] + 9) % 10;
            if (nTail === nextTail || nTail === prevTail) {
              const key4 = nTail === nextTail 
                ? `${sorted3[0]},${sorted3[1]},${sorted3[2]},${nTail}`
                : `${nTail},${sorted3[0]},${sorted3[1]},${sorted3[2]}`;
              const freq4 = consecutiveQuadFreq.get(key4) || 0;
              if (freq4 > 0) {
                score += 0; // 4连完全移除
              } else {
                score += 0; // 4连完全移除
              }
            }
          }
        }
      }
    }
  }
  
  // 9. 🆕 检查5连尾号（如1,2,3,4,5 → 延伸6或0）
  if (srcTails.length >= 4) {
    for (let i = 0; i < srcTails.length; i++) {
      for (let j = i + 1; j < srcTails.length; j++) {
        for (let k = j + 1; k < srcTails.length; k++) {
          for (let l = k + 1; l < srcTails.length; l++) {
            const t1 = srcTails[i], t2 = srcTails[j], t3 = srcTails[k], t4 = srcTails[l];
            const sorted4 = [t1, t2, t3, t4].sort((a, b) => a - b);
            // 检查是否形成4连
            const isQuadConsecutive = (
              (sorted4[1] === (sorted4[0] + 1) % 10 && 
               sorted4[2] === (sorted4[1] + 1) % 10 && 
               sorted4[3] === (sorted4[2] + 1) % 10) ||
              (sorted4[0] === 7 && sorted4[1] === 8 && sorted4[2] === 9 && sorted4[3] === 0) ||
              (sorted4[0] === 8 && sorted4[1] === 9 && sorted4[2] === 0 && sorted4[3] === 1) ||
              (sorted4[0] === 9 && sorted4[1] === 0 && sorted4[2] === 1 && sorted4[3] === 2)
            );
            if (isQuadConsecutive) {
              // 检查候选尾号是否形成5连
              const nextTail = (sorted4[3] + 1) % 10;
              const prevTail = (sorted4[0] + 9) % 10;
              if (nTail === nextTail || nTail === prevTail) {
                const key5 = nTail === nextTail 
                  ? `${sorted4[0]},${sorted4[1]},${sorted4[2]},${sorted4[3]},${nTail}`
                  : `${nTail},${sorted4[0]},${sorted4[1]},${sorted4[2]},${sorted4[3]}`;
                const freq5 = consecutiveQuintFreq.get(key5) || 0;
                if (freq5 > 0) {
                  score += 0; // 5连完全移除
                } else {
                  score += 0; // 5连完全移除
                }
              }
            }
          }
        }
      }
    }
  }
  
  // 10. 🆕 检查混合模式（连续+等差、三连+等差等）
  if (srcTails.length >= 2) {
    for (let i = 0; i < srcTails.length; i++) {
      for (let j = i + 1; j < srcTails.length; j++) {
        const t1 = srcTails[i], t2 = srcTails[j];
        const sorted2 = [t1, t2].sort((a, b) => a - b);
        
        // 模式1: 连续对+等差延伸 (如1,2 → 候选4，因为2+2=4)
        const isConsecutivePair = (sorted2[1] === (sorted2[0] + 1) % 10);
        if (isConsecutivePair) {
          // 检查等差延伸
          const arithTargets = [
            (sorted2[1] + 2) % 10, // 等差2
            (sorted2[1] + 3) % 10, // 等差3
            (sorted2[0] + 8) % 10, // 等差2（反向）
            (sorted2[0] + 7) % 10  // 等差3（反向）
          ];
          if (arithTargets.includes(nTail)) {
            const key = `${sorted2[0]},${sorted2[1]},${nTail}`;
            const freq = mixedPatternFreq.get(key) || 0;
            if (freq > 0) {
              score += freq * 4.0; // 混合模式freq权重4.0
            } else {
              score += 6; // 基础分6（种子固定后最优）
            }
          }
        }
        
        // 模式2: 等差对+连续延伸 (如1,3 → 候选4，因为3+1=4)
        const diff = Math.abs(sorted2[1] - sorted2[0]);
        const minDiff = Math.min(diff, 10 - diff);
        if (minDiff === 2 || minDiff === 3) {
          // 检查连续延伸
          const consecTargets = [
            (sorted2[1] + 1) % 10,
            (sorted2[0] + 9) % 10
          ];
          if (consecTargets.includes(nTail)) {
            const key = `${sorted2[0]},${sorted2[1]},${nTail}`;
            const freq = mixedPatternFreq.get(key) || 0;
            if (freq > 0) {
              score += freq * 4.0; // 混合模式freq权重4.0
            } else {
              score += 6; // 基础分6（种子固定后最优）
            }
          }
        }
      }
    }
  }
  
  return score;
}

// ═══ 尾号模式预测 ═══
function predictLikelyTailsV4(sourceTails, transData) {
  const scores = new Map();
  for (let t = 0; t <= 9; t++) scores.set(t, 0);

  sourceTails.forEach((st) => {
    for (let tt = 0; tt <= 9; tt++) {
      const key = `${st}→${tt}`;
      const count = transData.transFreq.get(key) || 0;
      scores.set(tt, scores.get(tt) + count);
    }
  });

  // 加入全局频率作为先验
  transData.tailFreq.forEach((count, tail) => {
    scores.set(tail, scores.get(tail) + count * 0.5);
  });

  return [...scores.entries()].sort((a, b) => b[1] - a[1]);
}

// ═══ 等差延伸尾号计算 ═══
function getArithmeticTails(tails) {
  const arithTails = new Set();
  const sorted = [...tails].sort((a, b) => a - b);
  
  // 检查现有尾号是否形成等差
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const diff = sorted[j] - sorted[i];
      if (diff === 2 || diff === 3 || diff === 4) {
        arithTails.add(sorted[i]);
        arithTails.add(sorted[j]);
        // 延伸等差
        const next = (sorted[j] + diff) % 10;
        const prev = (sorted[i] - diff + 10) % 10;
        arithTails.add(next);
        arithTails.add(prev);
      }
    }
  }
  
  return [...arithTails];
}

// ═══ 增强版尾号预测（融合参考行关系+等差延伸）═══
function predictLikelyTailsV4Enhanced(sourceTails, transData, refRows, sourceRow, allBalls = null) {
  // 🆕 优化权重（基于100期回测：更高频+弱重叠配置）
  const weights = {
    overlap1: 6,
    arith1: 12,
    overlap10: 4,     // 保持不变
    arith10: 10,      // 保持不变
    overlapBonus: 2,  // 保持不变
    globalFreq: 28,
  };

  const scores = new Map();
  for (let t = 0; t <= 9; t++) scores.set(t, 0);

  // 1. 原始转移概率
  sourceTails.forEach((st) => {
    for (let tt = 0; tt <= 9; tt++) {
      const key = `${st}→${tt}`;
      const count = transData.transFreq.get(key) || 0;
      scores.set(tt, scores.get(tt) + count);
    }
  });

  // 2. 🆕 全局高频尾号（权重大幅提升：从0.5→28）
  if (allBalls && sourceRow > 0) {
    const globalTailFreq = new Map();
    for (let t = 0; t <= 9; t++) globalTailFreq.set(t, 0);
    const lookback = Math.min(50, sourceRow);
    for (let r = Math.max(1, sourceRow - lookback); r < sourceRow; r++) {
      const draw = allBalls.filter(b => b.row === r && b.zone === "front").map(b => b.number);
      if (draw.length === 5) {
        tails(draw).forEach(t => globalTailFreq.set(t, globalTailFreq.get(t) + 1));
      }
    }
    const maxGlobalFreq = Math.max(1, ...globalTailFreq.values());
    globalTailFreq.forEach((count, tail) => {
      scores.set(tail, scores.get(tail) + (count / maxGlobalFreq) * weights.globalFreq);
    });
  } else {
    // 降级：使用转移数据中的频率
    transData.tailFreq.forEach((count, tail) => {
      scores.set(tail, scores.get(tail) + count * 0.5);
    });
  }

  // 3. 参考行尾号重叠（参考行 = 上一期）
  if (refRows && refRows.length > 0) {
    const ref1 = refRows.find(r => r.row === sourceRow - 1);
    if (ref1) {
      // 重叠尾号
      ref1.tailSet.forEach(t => {
        scores.set(t, scores.get(t) + weights.overlap1);
      });
      
      // 等差延伸尾号（参考行1）
      const arith1 = getArithmeticTails([...ref1.tailSet]);
      arith1.forEach(t => {
        if (!ref1.tailSet.has(t)) {
          scores.set(t, scores.get(t) + weights.arith1);
        }
      });
    }

    // 参考行+9（上10期）
    const ref10 = refRows.find(r => r.row === sourceRow - 10);
    if (ref10) {
      // 重叠尾号
      ref10.tailSet.forEach(t => {
        scores.set(t, scores.get(t) + weights.overlap10);
      });
      
      // 等差延伸尾号（参考行+9）
      const arith10 = getArithmeticTails([...ref10.tailSet]);
      arith10.forEach(t => {
        if (!ref10.tailSet.has(t)) {
          scores.set(t, scores.get(t) + weights.arith10);
        }
      });
    }

    // 重叠尾号（上一期和上10期都有的）额外加分
    if (ref1 && ref10) {
      const overlap = [...ref1.tailSet].filter(t => ref10.tailSet.has(t));
      overlap.forEach(t => {
        scores.set(t, scores.get(t) + weights.overlapBonus);
      });
    }
  }

  return [...scores.entries()].sort((a, b) => b[1] - a[1]);
}

// ═══ 首位球尾号转移预测 ═══
// 分析历史数据中首位球（最小号）的尾号转移规律
function analyzeFirstBallTailTransitions(sourceRow, lookback, allBalls) {
  lookback = lookback || 20;
  const transFreq = new Map(); // "sourceTail→targetTail" → count
  const tailFreq = new Map();  // 首位球尾号出现频率
  for (let t = 0; t <= 9; t++) tailFreq.set(t, 0);

  const start = Math.max(1, sourceRow - lookback);
  for (let r = start; r < sourceRow; r++) {
    // 获取第r期的首位球（最小号）
    const srcNums = [...new Set(allBalls.filter(
      (b) => b.row === r && b.zone === "front" && ballHasColor(b, sampleRedColor)
    ).map((b) => b.number))].sort((a, b) => a - b);
    
    // 获取第r+1期的首位球
    const tgtNums = [...new Set(allBalls.filter(
      (b) => b.row === r + 1 && b.zone === "front" && ballHasColor(b, sampleRedColor)
    ).map((b) => b.number))].sort((a, b) => a - b);
    
    if (srcNums.length < 1 || tgtNums.length < 1) continue;
    
    const srcFirstTail = srcNums[0] % 10;
    const tgtFirstTail = tgtNums[0] % 10;
    
    // 记录转移
    const key = `${srcFirstTail}→${tgtFirstTail}`;
    transFreq.set(key, (transFreq.get(key) || 0) + 1);
    
    // 记录目标尾号频率
    tailFreq.set(tgtFirstTail, tailFreq.get(tgtFirstTail) + 1);
  }
  
  return { transFreq, tailFreq };
}

// 基于当前首位球尾号预测下期首位球尾号
function predictFirstBallTail(currentFirstBallTail, transData) {
  const scores = new Map();
  for (let t = 0; t <= 9; t++) scores.set(t, 0);

  // 基于转移概率
  for (let tt = 0; tt <= 9; tt++) {
    const key = `${currentFirstBallTail}→${tt}`;
    const count = transData.transFreq.get(key) || 0;
    scores.set(tt, scores.get(tt) + count * 2); // 转移概率权重×2
  }

  // 加入全局频率作为先验（权重较低）
  transData.tailFreq.forEach((count, tail) => {
    scores.set(tail, scores.get(tail) + count * 0.3);
  });

  return [...scores.entries()].sort((a, b) => b[1] - a[1]);
}

// ═══ 首位球综合动态预测（基于回测结果）═══
// 回测发现的规律：
// 1. 当期首位球±3范围覆盖54.2% - 最强规律
// 2. 当期号码的±1命中22.0% - 中强规律
// 3. +9期号码命中17.4% - 中等规律
// 4. 等差延伸命中9.3% - 弱规律
function predictFirstBallComprehensive(sourceRow, allBalls) {
  const scores = new Map();
  for (let n = 1; n <= 15; n++) scores.set(n, 0); // 首位球几乎不会超过15
  
  // 获取当前期号码
  const curNums = [...new Set(allBalls.filter(
    (b) => b.row === sourceRow && b.zone === "front" && ballHasColor(b, sampleRedColor)
  ).map((b) => b.number))].sort((a, b) => a - b);
  
  if (curNums.length < 1) return [...scores.entries()].sort((a, b) => b[1] - a[1]);
  
  const curFirst = curNums[0];
  
  // 规律A: 当期首位球±3范围（54.2%覆盖）- 高权重
  for (let delta = -3; delta <= 3; delta++) {
    const candidate = curFirst + delta;
    if (candidate >= 1 && candidate <= 15) {
      const weight = delta === 0 ? 8 : (Math.abs(delta) === 1 ? 10 : (Math.abs(delta) === 2 ? 6 : 4));
      scores.set(candidate, scores.get(candidate) + weight);
    }
  }
  
  // 规律B: 当期号码的±1（22.0%命中）- 中权重
  curNums.forEach(n => {
    [-1, 1].forEach(delta => {
      const candidate = n + delta;
      if (candidate >= 1 && candidate <= 15) {
        scores.set(candidate, scores.get(candidate) + 5);
      }
    });
  });
  
  // 规律C: +9期号码（17.4%命中）- 中权重
  if (sourceRow >= 10) {
    const plus9Nums = [...new Set(allBalls.filter(
      (b) => b.row === sourceRow - 9 && b.zone === "front" && ballHasColor(b, sampleRedColor)
    ).map((b) => b.number))];
    plus9Nums.forEach(n => {
      if (n >= 1 && n <= 15) {
        scores.set(n, scores.get(n) + 6);
      }
    });
  }
  
  // 规律D: 等差延伸（9.3%命中）- 低权重
  for (let i = 0; i < curNums.length; i++) {
    for (let j = i + 1; j < curNums.length; j++) {
      const diff = curNums[j] - curNums[i];
      if (diff >= 1 && diff <= 10) {
        const prevVal = curNums[i] - diff;
        if (prevVal >= 1 && prevVal <= 15) {
          scores.set(prevVal, scores.get(prevVal) + 3);
        }
      }
    }
  }
  
  // 规律E: 尾号转移预测（辅助）
  const curFirstTail = curFirst % 10;
  const tailTransData = analyzeFirstBallTailTransitions(sourceRow, 20, allBalls);
  const predictedTails = predictFirstBallTail(curFirstTail, tailTransData);
  const topTails = predictedTails.slice(0, 3).map(([t]) => t);
  topTails.forEach(t => {
    for (let n = 1; n <= 15; n++) {
      if (n % 10 === t) {
        scores.set(n, scores.get(n) + 4);
      }
    }
  });
  
  // 基础分：历史频率（近20期）
  for (let n = 1; n <= 15; n++) {
    const recentCount = allBalls.filter(
      b => b.zone === "front" && b.number === n && 
      b.row >= Math.max(1, sourceRow - 20) && b.row < sourceRow &&
      ballHasColor(b, sampleRedColor)
    ).length;
    scores.set(n, scores.get(n) + recentCount * 2);
  }
  
  return [...scores.entries()].sort((a, b) => b[1] - a[1]);
}

// ═══ v4.1 核心：生成候选号码池（25球，完整移植 generateCandidatePool）═══
// ═══ 历史频率分析（移植 optimized_picker calculateHistoryMetrics）═══
let v4HistoryMetrics = null;
function calculateHistoryMetricsForBoard() {
  if (v4HistoryMetrics) return v4HistoryMetrics;
  const allBalls = collectBalls();
  const seenRows = new Set();
  const draws = [];
  for (let r = 1; r <= drawRows; r++) {
    const nums = [...new Set(allBalls.filter(
      (b) => b.row === r && b.zone === "front" && ballHasColor(b, sampleRedColor)
    ).map((b) => b.number))].sort((a, b) => a - b);
    if (nums.length === 5 && !seenRows.has(r)) {
      seenRows.add(r);
      draws.push({ row: r, front: nums });
    }
  }
  if (draws.length === 0) return null;
  const totalDraws = draws.length;

  // 1. 历史频率
  const historyFreq = new Array(36).fill(0);
  draws.forEach(d => d.front.forEach(n => historyFreq[n]++));

  // 2. 近期频率
  const recentWindow = Math.min(20, draws.length);
  const recentFreq = new Array(36).fill(0);
  draws.slice(-recentWindow).forEach(d => d.front.forEach(n => recentFreq[n]++));

  // 3. 重复率（10期间隔）
  const repeatRate = new Array(36).fill(0);
  let repeatPairs = 0;
  for (let i = 0; i < draws.length - 10; i++) {
    const source = draws[i].front;
    const target = draws[i + 10].front;
    const targetSet = new Set(target);
    source.forEach(n => { if (targetSet.has(n)) repeatRate[n]++; });
    repeatPairs++;
  }
  const normalizedRepeatRate = repeatRate.map(count => repeatPairs > 0 ? count / repeatPairs : 0);

  const avgHistoryFreq = historyFreq.reduce((a, b) => a + b, 0) / 35;
  const avgRecentFreq = recentFreq.reduce((a, b) => a + b, 0) / 35;
  const avgRepeatRate = normalizedRepeatRate.reduce((a, b) => a + b, 0) / 35;

  v4HistoryMetrics = {
    historyFreq, recentFreq, normalizedRepeatRate,
    avgHistoryFreq, avgRecentFreq, avgRepeatRate,
    totalDraws, recentWindow, repeatPairs
  };
  return v4HistoryMetrics;
}

const V4_HISTORY_FREQ_WEIGHT = 0.15;
const V4_RECENT_FREQ_WEIGHT = 0.10;
const V4_REPEAT_RATE_WEIGHT = 0.05;

const V4_POOL_SIZE = 28; // 28球池：联合覆盖63.8%（最优），池覆盖82.1%
function buildSampleNumbersV4(selectedRow, zone, ratios) {
  zone = zone || "front";
  const sourceColor = sampleRedColor;
  const allBalls = collectBalls();
  const sourceWindow = getSampleSourceWindow(selectedRow);
  const sourceRow = sourceWindow.selectedRow;

  const selectedRowBalls = allBalls.filter(
    (b) => b.zone === zone && b.row === sourceRow && ballHasColor(b, sourceColor)
  );
  const selectedNumbers = getUniqueSortedSampleNumbers(selectedRowBalls.map((b) => b.number));
  if (selectedNumbers.length === 0) return buildSampleNumbers(selectedRow, zone);

  const sourceTails = [...new Set(selectedNumbers.map((n) => n % 10))];

  // 预处理映射
  const bridgeMap = buildV4BridgeMap(selectedNumbers, selectedNumbers);
  const arithMap = buildV4ArithmeticMap(selectedNumbers, 6, selectedNumbers);
  const plusTenTrend = buildV4PlusTenTrendMap(sourceRow, selectedNumbers, allBalls);
  const refRows = buildV4FullReferenceRows(sourceRow, allBalls);

  // S9: 尾号转移预测（增强版：融合参考行关系+全局高频）
  // 优化：lookback 50→70，利用更多历史数据（181期的39%）
  const tailTransData = analyzeTailTransitionsV4(sourceRow, 70, allBalls);
  const predictedTails = predictLikelyTailsV4Enhanced(sourceTails, tailTransData, refRows, sourceRow, allBalls);

  // 🆕 首位球综合动态预测（融合5种回测规律：±3范围、±1相邻、+9期、等差延伸、尾号转移）
  const firstBallPredictions = predictFirstBallComprehensive(sourceRow, allBalls);

  // 🆕 v5: 区间比预测（基于历史转移+时效加权）
  const sourceIv = intervalRatio(selectedNumbers);
  const ivPrediction = predictTargetIntervalRatio(sourceRow, sourceIv, allBalls);
  
  // 🆕 号码池优化：计算源号码属性和预测目标属性
  const sourceOdd = oddCount(selectedNumbers);
  const sourceSum = sum(selectedNumbers);
  const targetOdd = predictTargetOddCount(sourceRow, allBalls);
  const targetSum = predictTargetSum(sourceRow, allBalls);
  
  // 历史频率分析
  const historyMetrics = calculateHistoryMetricsForBoard();

  // 🆕 尾号关联性分析（基于开奖号码尾号对和三元组）
  // 优化：lookback 100→120，更多样本更稳定的关联性
  const tailCorrelationData = analyzeTailCorrelation(allBalls, sourceRow, 120);

  // 🆕 区间稳定性检测（区间不变时尾重率0.71-0.91，重号率0.73-0.83）
  let isIntervalStable = false;
  if (sourceRow >= 6) {
    const currentIv = intervalRatio(selectedNumbers);
    let sameCount = 0;
    for (let i = 1; i <= 5; i++) {
      const prevBalls = allBalls.filter((b) => b.zone === zone && b.row === sourceRow - i && ballHasColor(b, sourceColor));
      const prevNums = [...new Set(prevBalls.map((b) => b.number))].sort((a, b) => a - b);
      if (prevNums.length === 5) {
        const prevIv = intervalRatio(prevNums);
        if (currentIv[0] === prevIv[0] && currentIv[1] === prevIv[1] && currentIv[2] === prevIv[2]) {
          sameCount++;
        }
      }
    }
    isIntervalStable = sameCount / 5 >= 0.4; // 40%以上相同认为稳定
  }

  // 热号（优化：5期窗口命中率最高35.6%，比10期窗口31.3%更好）
  const hotness = new Map();
  for (let r = Math.max(1, sourceRow - 5); r < sourceRow; r++) {
    allBalls.filter((b) => b.zone === zone && b.row === r && ballHasColor(b, sourceColor))
      .forEach((b) => hotness.set(b.number, (hotness.get(b.number) || 0) + 1));
  }

  // 极端期检测（移植 optimized_picker detectExtreme）
  const extremeFlags = { sumCrash: false, parityFlip: false, narrowRange: false };
  const sourceSpan = selectedNumbers[selectedNumbers.length - 1] - selectedNumbers[0];
  if (sourceSpan <= 12) extremeFlags.narrowRange = true;
  // sumCrash: 和值与前2期平均差>30
  const neighborDraws = [];
  for (let r = sourceRow - 1; r >= Math.max(1, sourceRow - 3); r--) {
    const nb = allBalls.filter((b) => b.zone === "front" && b.row === r && ballHasColor(b, sourceColor));
    const nbNums = [...new Set(nb.map((b) => b.number))].sort((a, b) => a - b);
    if (nbNums.length === 5) neighborDraws.push(nbNums);
    if (neighborDraws.length >= 2) break;
  }
  if (neighborDraws.length >= 2) {
    const avgPrevSum = (neighborDraws[0].reduce((a, b) => a + b, 0) + neighborDraws[1].reduce((a, b) => a + b, 0)) / 2;
    if (Math.abs(sourceSum - avgPrevSum) > 30) extremeFlags.sumCrash = true;
  }
  // parityFlip: 奇偶数变化≥4
  if (neighborDraws.length >= 1) {
    const srcOdd = selectedNumbers.filter((n) => n % 2 === 1).length;
    const nbOdd = neighborDraws[0].filter((n) => n % 2 === 1).length;
    if (Math.abs(srcOdd - nbOdd) >= 4) extremeFlags.parityFlip = true;
  }

  // 归一化参考值
  const maxPlusTen = Math.max(1, ...[...plusTenTrend.targetMap.values()]);
  const maxBridge = Math.max(1,
    ...[...bridgeMap.gapMap.values()].map((v) => v.score),
    ...[...bridgeMap.endpointMap.values()].map((v) => v.score)
  );
  const maxArith = Math.max(1, ...[...arithMap.values()].map((v) => v.score));

  // 对1-35逐一评分
  const candidates = [];
  for (let n = 1; n <= 35; n++) {
    let score = 0;

    // 偏移评分
    let minOffset = Infinity;
    selectedNumbers.forEach((a) => { minOffset = Math.min(minOffset, Math.abs(n - a)); });
    score += V4_OFFSET_SCORE[minOffset] || 0;

    // 尾号关联（优先级：predictedTails匹配 > 邻号 > sourceTails）
    const t = n % 10;
    if (predictedTails && predictedTails.length > 0) {
      const topTails = new Set(predictedTails.slice(0, 5).map(([tt]) => tt));
      if (topTails.has(t)) {
        score += V4_TAIL_SAME;
        // 🆕 区间稳定时尾号加成（179期数据：区间不变时尾重率0.66-0.73，显著高于变化时）
        if (isIntervalStable) score += 10;
      }
      else if (predictedTails.some(([tt]) => Math.abs(t - tt) === 1)) score += V4_TAIL_NEIGHBOR;
      else if (sourceTails.includes(t)) score += V4_TAIL_WITHIN;
    } else {
      if (sourceTails.includes(t)) score += V4_TAIL_WITHIN;
    }

    // 🆕 尾号关联性加分（使用历史频率）
    const tailCorrelationBonus = getTailCorrelationScore(n, sourceTails, tailCorrelationData);
    if (tailCorrelationBonus > 0) {
      score += Math.round(tailCorrelationBonus * 1.0); // 提升权重：0.9 → 1.0
    }

    // S1: +10期趋势
    const ptScore = plusTenTrend.targetMap.get(n) || 0;
    if (ptScore > 0) score += Math.round(ptScore / maxPlusTen * 30);
    const ptNb = plusTenTrend.neighborMap.get(n) || 0;
    if (ptNb > 0) score += Math.round(ptNb / maxPlusTen * 6);

    // S2: 桥梁
    const bg = bridgeMap.gapMap.get(n);
    const be = bridgeMap.endpointMap.get(n);
    if (bg) score += Math.round(bg.score / maxBridge * 15);
    if (be) score += Math.round(be.score / maxBridge * 8);

    // S3: 等距
    const ae = arithMap.get(n);
    if (ae) score += Math.round(ae.score / maxArith * 10);

    // 热号（增强权重：Pool +0.5pp）
    const hot = hotness.get(n) || 0;
    if (hot >= 4) score += 10;
    else if (hot >= 3) score += 7;
    else if (hot >= 2) score += 4;
    else if (hot === 0) score -= 2;

    // 极端期加成（完整移植 optimized_picker）
    if (extremeFlags.narrowRange && minOffset >= 2) score += 4;
    if (extremeFlags.sumCrash && minOffset >= 3) score += 5;
    if (extremeFlags.parityFlip && n % 2 !== selectedNumbers[0] % 2) score += 3;

    // 连号附近奖励
    const nearConsec = selectedNumbers.some((a) => {
      const others = selectedNumbers.filter((x) => x !== a);
      return others.some((x) => Math.abs(x - a) === 1) && Math.abs(n - a) <= 4;
    });
    if (nearConsec) score += 7;
    
    // 🆕 号码池优化：区间平衡、奇偶平衡、和值贡献
    // 1. 区间平衡奖励：如果该区间需要补充
    const iv = getSampleIntervalIndex(n, sampleIntervals);
    const predictedIv = ivPrediction.predictedIv || sourceIv;
    if (sourceIv[iv] < predictedIv[iv]) {
      score += 3;
    }
    
    // 2. 奇偶平衡奖励：如果奇偶数需要调整
    if (n % 2 === 1 && sourceOdd < targetOdd) {
      score += 2;
    } else if (n % 2 === 0 && sourceOdd > targetOdd) {
      score += 2;
    }
    
    // 3. 和值贡献奖励：如果和值差异大，选择相应大小的号码
    const sumDiff = targetSum - sourceSum;
    if (Math.abs(sumDiff) > 10) {
      if (sumDiff > 0 && n >= 15) {
        score += 2;
      } else if (sumDiff < 0 && n <= 18) {
        score += 2;
      }
    }

    // 历史频率评分（移植 optimized_picker）
    if (historyMetrics) {
      const historyFreq = historyMetrics.historyFreq[n] || 0;
      const recentFreq = historyMetrics.recentFreq[n] || 0;
      const repeatRate = historyMetrics.normalizedRepeatRate[n] || 0;
      const historyRatio = historyFreq / historyMetrics.avgHistoryFreq;
      const recentRatio = recentFreq / historyMetrics.avgRecentFreq;
      const repeatRatio = repeatRate / historyMetrics.avgRepeatRate;
      if (historyRatio > 1.2) score += Math.round((historyRatio - 1) * 15 * V4_HISTORY_FREQ_WEIGHT);
      if (recentRatio > 1.3) score += Math.round((recentRatio - 1) * 10 * V4_RECENT_FREQ_WEIGHT);
      if (repeatRatio > 1.2) score += Math.round((repeatRatio - 1) * 8 * V4_REPEAT_RATE_WEIGHT);
    }

    // 🆕 首位球综合动态预测加分（融合±3范围、±1相邻、+9期、等差延伸、尾号转移）
    if (n <= 15) {
      const rank = firstBallPredictions.findIndex(([num]) => num === n);
      if (rank >= 0 && rank < 5) score += 12;       // Top5预测号码
      else if (rank >= 5 && rank < 10) score += 6;  // Top6-10
      else if (rank >= 10) score += 2;              // 其他1-15号码
      // 邻近预测号码轻微加分
      const isNear = firstBallPredictions.slice(0, 5).some(([num]) => Math.abs(num - n) === 1);
      if (isNear) score += 3;
    } else if (n >= 25) {
      score -= 3;  // 25+几乎不会作为首位球
    }

    // 🆕 球35和球30的特殊关联加分（179期数据分析）
    // 球35与一区号码（特别是11附近）有强关联
    if (n === 35) {
      const hasZone1Anchor = selectedNumbers.some(x => x >= 8 && x <= 14);
      if (hasZone1Anchor) score += 8;  // 有一区锚点时加分
    }
    // 球30与球29（连续号）有强关联
    if (n === 30) {
      if (selectedNumbers.includes(29)) score += 10;  // 有29时强加分
      if (selectedNumbers.includes(28) || selectedNumbers.includes(31)) score += 5;  // 有相邻号时加分
    }
    // 球31频率最低，需要额外加分
    if (n === 31) {
      if (selectedNumbers.includes(30) || selectedNumbers.includes(32)) score += 6;
    }
    // 球25频率偏低，需要额外加分
    if (n === 25) {
      if (selectedNumbers.includes(24) || selectedNumbers.includes(26)) score += 5;
    }

    // 方案三：提高二区号码基础分（+5分，覆盖率95.5%最优）
    if (n >= 13 && n <= 24) {
      score += 5;
    }

    candidates.push({ number: n, score });
  }

  // 排序 + 区间保底（每个区间至少3个）
  candidates.sort((a, b) => b.score - a.score);
  
  // 🆕 极值回归动态调整区间保底（分析数据：极值后回归概率78-100%）
  const minIv = [3, 3, 3]; // 默认每个区间至少3个
  if (sourceRow >= 3) {
    const prev1Balls = allBalls.filter((b) => b.zone === zone && b.row === sourceRow - 1 && ballHasColor(b, sourceColor));
    const prev1Nums = [...new Set(prev1Balls.map((b) => b.number))].sort((a, b) => a - b);
    const prev2Balls = allBalls.filter((b) => b.zone === zone && b.row === sourceRow - 2 && ballHasColor(b, sourceColor));
    const prev2Nums = [...new Set(prev2Balls.map((b) => b.number))].sort((a, b) => a - b);
    
    if (prev1Nums.length === 5) {
      const prev1Iv = intervalRatio(prev1Nums);
      
      // 极值回归规律（179期数据验证）：
      // 一区极低(=0)：94.1%回归，平均+2.12个
      if (prev1Iv[0] === 0) minIv[0] = 4;
      // 二区极低(=0)：94.1%回归，平均+1.76个
      if (prev1Iv[1] === 0) minIv[1] = 4;
      // 三区极低(=0)：80.0%回归，平均+1.49个
      if (prev1Iv[2] === 0) minIv[2] = 4;
      
      // 一区极高(>=4)：100%回归，平均-2.38个
      if (prev1Iv[0] >= 4) minIv[0] = 2;
      // 二区极高(>=4)：100%回归，平均-3.00个（回归幅度最大）
      if (prev1Iv[1] >= 4) minIv[1] = 2;
      // 三区极高(>=4)：100%回归，平均-2.50个
      if (prev1Iv[2] >= 4) minIv[2] = 2;
    }
    
    // 连续同向反转检测（179期数据验证）
    if (prev1Nums.length === 5 && prev2Nums.length === 5) {
      const prev1Iv = intervalRatio(prev1Nums);
      const prev2Iv = intervalRatio(prev2Nums);
      const currIv = intervalRatio(selectedNumbers);
      
      for (let z = 0; z < 3; z++) {
        const change1 = currIv[z] - prev1Iv[z];
        const change2 = prev1Iv[z] - prev2Iv[z];
        
        // 连续2期增大后反转概率：
        // 一区78%减小，二区100%减小，三区100%减小
        if (change1 > 0 && change2 > 0) {
          if (z === 1) {
            // 二区100%减小，强信号
            minIv[z] = Math.max(2, minIv[z] - 2);
          } else if (z === 2) {
            // 三区100%减小，强信号
            minIv[z] = Math.max(2, minIv[z] - 2);
          } else {
            // 一区78%减小
            minIv[z] = Math.max(2, minIv[z] - 1);
          }
        }
        
        // 连续2期减小后反转概率：
        // 一区82%增大，二区75%增大，三区64%增大
        if (change1 < 0 && change2 < 0) {
          if (z === 0) {
            // 一区82%增大，强信号
            minIv[z] = Math.min(4, minIv[z] + 2);
          } else if (z === 1) {
            // 二区75%增大
            minIv[z] = Math.min(4, minIv[z] + 1);
          } else {
            // 三区64%增大，一般信号
            minIv[z] = Math.min(4, minIv[z] + 1);
          }
        }
      }
      
      // 🆕 区间不变时尾重率高（0.66-0.73），利用这一规律
      // 检查前一期区间是否稳定（与前前一期相同）
      const isStable = prev1Iv[0] === prev2Iv[0] && prev1Iv[1] === prev2Iv[1] && prev1Iv[2] === prev2Iv[2];
      if (isStable) {
        // 区间稳定时，尾重率高，可以更信任尾号预测
        // 在评分中通过isIntervalStable标志体现
      }
    }
  }
  const pool = [];
  const zoneCount = [0, 0, 0];
  const seen = new Set();
  
  // 第一轮：按分数排序添加，同时检查区间保底
  for (const c of candidates) {
    if (pool.length >= V4_POOL_SIZE) break;
    const z = getSampleIntervalIndex(c.number, sampleIntervals);
    if (zoneCount[z] < minIv[z]) {
      pool.push(c);
      zoneCount[z]++;
      seen.add(c.number);
    }
  }
  
  // 第二轮：填充剩余位置
  for (const c of candidates) {
    if (pool.length >= V4_POOL_SIZE) break;
    if (!seen.has(c.number)) {
      pool.push(c);
      seen.add(c.number);
    }
  }
  
  pool.sort((a, b) => b.score - a.score);
  const finalPool = pool.slice(0, V4_POOL_SIZE);

  const candidateEntries = finalPool.map((c, i) => ({
    number: c.number, score: c.score, baseScore: c.score, rank: i + 1,
    selectedTailHits: 0, selectedTailNeighborHits: 0, tailCount: 0, lastRowTailHits: 0,
    tailPatternScore: 0, upperColorHits: 0, upperColorTailHits: 0, upperColorTailNeighborHits: 0,
    hits: 0, bridgeEndpointHits: 0, arithmeticEndpointHits: 0, arithmeticScore: 0,
    integrityBonus: 0, templateHits: 0, sameRowSupport: 0, plusTenScore: 0,
    plusTenNeighborScore: 0, farOffsetCount: 0, anchorKeepPenalty: 0, transformedCount: 0,
  }));

  return {
    startRow: sourceWindow.startRow, endRow: sourceWindow.endRow,
    ratioSupportMap: new Map(),
    referenceRows: refRows, // 🆕 S5增强参考行（供v4组合评分使用）
    selectedNumbers, arithmeticMap: new Map(),
    candidates: candidateEntries.map((e) => e.number),
    candidateEntries,
    numbers: candidateEntries.slice(0, 5).map((e) => e.number),
    predictedTails, // 🆕 尾号预测结果（供v4.1组合评分使用）
    ivPrediction,  // 🆕 v5: 区间比预测（供组合评分IV微调使用）
    extremeFlags,  // 🆕 极端期检测标志（供组合评分使用）
  };
}

// ═══ v4.1 组合生成（区间比驱动回溯 + 自由回溯 + 多样性选择）═══
function buildSampleFrontCombosV4(entries, refs, anchorNumbers, selectedNumbers, predictTails = null, ivPrediction = null, firstBallPredictions = null, extremeFlags = null, manualRatio = null) {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const pool = [...entries].sort((a, b) => b.score - a.score);

  // 策略1: 区间比驱动
  const ratioFreq = new Map();
  refs.forEach((ref) => { if (ref.ivKey) ratioFreq.set(ref.ivKey, (ratioFreq.get(ref.ivKey) || 0) + 1); });
  const priorityRatios = [...ratioFreq.entries()].sort((a, b) => b[1] - a[1]).map(([rk]) => rk.split(":").map(Number));
  const defaults = [[2,2,1],[2,1,2],[1,2,2],[3,1,1],[1,3,1],[1,1,3]];
  defaults.forEach((r) => { if (!priorityRatios.some((pr) => pr.join(":") === r.join(":"))) priorityRatios.push(r); });
  
  // 🆕 优先级：手动选择的区间比 > 预测区间比 > 历史频率
  let useRatios;
  if (manualRatio && manualRatio.length > 0) {
    // manualRatio 是区间比数组，如 [[2,2,1]] 或 [[0,1,4],[0,2,3],...]
    // 只使用手动选择的区间比，不混入其他
    const manualRatios = [];
    for (const mr of manualRatio) {
      if (!Array.isArray(mr) || mr.length !== 3) continue;
      const mrKey = mr.join(":");
      const existIdx = priorityRatios.findIndex((r) => r.join(":") === mrKey);
      if (existIdx >= 0) {
        const [exist] = priorityRatios.splice(existIdx, 1);
        manualRatios.push(exist);
      } else {
        manualRatios.push(mr);
      }
    }
    // 只使用手动选择的区间比，不混入其他
    useRatios = manualRatios;
  } else if (ivPrediction && ivPrediction.predictedIv) {
    // 没有手动选择时，使用预测区间比
    const predKey = ivPrediction.predictedIv.join(":");
    const existIdx = priorityRatios.findIndex((r) => r.join(":") === predKey);
    if (existIdx >= 0) {
      const [exist] = priorityRatios.splice(existIdx, 1);
      priorityRatios.unshift(exist);
    } else {
      priorityRatios.unshift(ivPrediction.predictedIv);
    }
    useRatios = priorityRatios.slice(0, 6);
  } else {
    useRatios = priorityRatios.slice(0, 6);
  }

  const allCombos = [];
  const seenGlobal = new Set();  // 跨策略去重

  useRatios.forEach((ratio) => {
    const z0 = pool.filter((c) => getSampleIntervalIndex(c.number, sampleIntervals) === 0).slice(0, ratio[0] + 6);
    const z1 = pool.filter((c) => getSampleIntervalIndex(c.number, sampleIntervals) === 1).slice(0, ratio[1] + 6);
    const z2 = pool.filter((c) => getSampleIntervalIndex(c.number, sampleIntervals) === 2).slice(0, ratio[2] + 6);
    if (z0.length < ratio[0] || z1.length < ratio[1] || z2.length < ratio[2]) return;

    const ratioCombos = [];
    const maxLocal = 200;  // 每个比值最多生成200组合（性能保护）
    const seenLocal = new Set();
    function bt(idx, chosen, entriesChosen) {
      if (ratioCombos.length >= maxLocal) return;
      if (idx >= 3) {
        if (chosen.length !== 5) return;
        const nums = chosen.sort((a, b) => a - b);
        const key = nums.join("-");
        if (seenLocal.has(key) || seenGlobal.has(key)) return;
        seenLocal.add(key);
        const result = v4ScoreCombo(nums, entriesChosen, selectedNumbers, selectedNumbers, refs, predictTails, ivPrediction, firstBallPredictions, extremeFlags);
        if (result) { result.key = key; result.ratioKey = ratio.join(":"); ratioCombos.push(result); }
        return;
      }
      const arr = idx === 0 ? z0 : idx === 1 ? z1 : z2;
      const need = ratio[idx];
      function pick(start, depth, picked, ep) {
        if (ratioCombos.length >= maxLocal) return;
        if (depth === need) { bt(idx + 1, [...chosen, ...picked], [...entriesChosen, ...ep]); return; }
        for (let i = start; i <= arr.length - (need - depth); i++) {
          picked.push(arr[i].number); ep.push(arr[i]); pick(i + 1, depth + 1, picked, ep);
          picked.pop(); ep.pop();
        }
      }
      pick(0, 0, [], []);
    }
    bt(0, [], []);
    ratioCombos.sort((a, b) => b.score - a.score);
    ratioCombos.slice(0, 15).forEach((c) => {
      if (!seenGlobal.has(c.key)) { seenGlobal.add(c.key); allCombos.push(c); }
    });
  });

  // 策略2: 自由回溯 Top20 候选 C(20,5)，最多150个
  const topCands = pool.slice(0, 20);
  if (topCands.length >= 5) {
    const freeCombos = [];
    const maxFree = 150;  // 性能保护：最多150个自由组合
    function freeBt(start, chosen, ep) {
      if (freeCombos.length >= maxFree) return;
      if (chosen.length === 5) {
        const nums = [...chosen].sort((a, b) => a - b);
        const key = nums.join("-");
        if (seenGlobal.has(key)) return;
        const result = v4ScoreCombo(nums, ep, selectedNumbers, selectedNumbers, refs, predictTails, ivPrediction, firstBallPredictions, extremeFlags);
        if (result) { result.key = key; result.ratioKey = intervalRatio(nums).join(":"); freeCombos.push(result); }
        return;
      }
      for (let i = start; i <= topCands.length - (5 - chosen.length); i++) {
        chosen.push(topCands[i].number); ep.push(topCands[i]);
        freeBt(i + 1, chosen, ep);
        chosen.pop(); ep.pop();
      }
    }
    freeBt(0, [], []);
    freeCombos.sort((a, b) => b.score - a.score);
    freeCombos.slice(0, 15).forEach((c) => {
      if (!seenGlobal.has(c.key)) { seenGlobal.add(c.key); allCombos.push(c); }
    });
  }

  // 去重 + 排序
  const seenKeys = new Set();
  const unique = [];
  for (const c of allCombos) {
    if (seenKeys.has(c.key)) continue;
    seenKeys.add(c.key);
    unique.push(c);
  }
  unique.sort((a, b) => b.score - a.score);

  // 降级贪心补充
  if (unique.length < 20 && pool.length >= 5) {
    const poolSet = new Set(pool.map((c) => c.number));
    const remaining = pool.filter((c) => !selectedNumbers.includes(c.number));
    for (let i = 0; i < 5 && unique.length < 20; i++) {
      const seed = selectedNumbers[i % selectedNumbers.length];
      const candidates = remaining.filter((c) => Math.abs(c.number - seed) <= 8);
      if (candidates.length >= 4) {
        const combo = [...candidates.slice(0, 4), pool[0]].slice(0, 5);
        const nums = combo.map((c) => c.number).sort((a, b) => a - b);
        const key = nums.join("-");
        if (!seenKeys.has(key)) {
          const result = v4ScoreCombo(nums, combo, selectedNumbers, selectedNumbers, refs, predictTails, ivPrediction, firstBallPredictions, extremeFlags);
          if (result) { result.key = key; result.ratioKey = intervalRatio(nums).join(":"); seenKeys.add(key); unique.push(result); }
        }
      }
    }
    unique.sort((a, b) => b.score - a.score);
  }

  // 🆕 手动区间比强制过滤：只保留符合手动选择区间比的组合（不降级）
  let finalPool = unique;
  if (manualRatio && manualRatio.length > 0) {
    const manualKeys = new Set(manualRatio.map((r) => Array.isArray(r) ? r.join(":") : ""));
    const ratioFiltered = unique.filter((c) => c.ratioKey && manualKeys.has(c.ratioKey));
    if (ratioFiltered.length > 0) {
      finalPool = ratioFiltered;
    }
  }

  // 多样性选择 Top20
  const diverse = v4SelectDiverseTopN(finalPool, Math.min(finalPool.length, 20));

  return diverse.map((c) => ({
    numbers: c.numbers, key: c.key, score: c.score, sum: c.sum, span: c.span,
    iv: c.iv, odd: c.odd, ratioKey: c.ratioKey,
    ratioText: c.ratioKey ? c.ratioKey.split(":").join("/") : "",
  }));
}

// ═══ V5 6维度独立版：各维度独立评分+独立生成组合，不跨维度融合求和 ═══
// 核心改造：废除跨维度加权求和，改为6维度各自出注后去重合并

// --- V5 组合生成工具（维度内独立选号） ---
function v5GenCombos(dimPool, count, maxPool) {
  maxPool = maxPool || 13;
  const topN = [...dimPool].sort((a, b) => b.score - a.score).slice(0, maxPool);
  const combos = [], seenKeys = new Set();
  const loopLimit = count * 20;
  for (let a = 0; a < topN.length - 4 && combos.length < loopLimit; a++) {
    for (let b = a + 1; b < topN.length - 3 && combos.length < loopLimit; b++) {
      for (let c = b + 1; c < topN.length - 2 && combos.length < loopLimit; c++) {
        for (let d = c + 1; d < topN.length - 1 && combos.length < loopLimit; d++) {
          for (let e = d + 1; e < topN.length && combos.length < loopLimit; e++) {
            const nums = [topN[a].number, topN[b].number, topN[c].number, topN[d].number, topN[e].number].sort((x, y) => x - y);
            if (new Set(nums).size !== 5) continue;
            const sp = nums[4] - nums[0], odd = nums.filter(function (v) { return v % 2 === 1; }).length;
            if (odd === 0 || odd === 5 || sp < 14 || sp > 32) continue;
            var ivX = [0, 0, 0]; nums.forEach(function (v) { ivX[getSampleIntervalIndex(v, sampleIntervals)]++; });
            if (Math.max.apply(Math, ivX) >= 4) continue;
            var run = 1, mc = 1;
            for (var i = 1; i < nums.length; i++) { if (nums[i] - nums[i - 1] === 1) { run++; mc = Math.max(mc, run); } else run = 1; }
            if (mc > 3) continue;
            // 🆕 密集度控制：间距≤2的相邻对≤2个，间距≤1的≤1个
            var dense2 = 0, dense1 = 0;
            for (var gi = 1; gi < nums.length; gi++) {
              var gap = nums[gi] - nums[gi - 1];
              if (gap <= 2) dense2++;
              if (gap <= 1) dense1++;
            }
            if (dense2 > 2 || dense1 > 1) continue;
            var key = nums.join("-");
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);
            var score = nums.reduce(function (s, n) { var c = topN.find(function (x) { return x.number === n; }); return s + (c ? c.score : 0); }, 0);
            combos.push({ key: key, numbers: nums, score: score });
          }
        }
      }
    }
  }
  combos.sort(function (a, b) { return b.score - a.score; });
  // 维度内多样性选择：重叠<4（优化: 3→4，+1.1pp Joint）
  var sel = [], dk = new Set();
  for (var ci = 0; ci < combos.length; ci++) {
    var c = combos[ci];
    if (sel.length >= count) break;
    if (dk.has(c.key)) continue;
    var sim = false;
    for (var si = 0; si < sel.length; si++) {
      var s = sel[si];
      var o = 0; var ss = new Set(s.numbers);
      c.numbers.forEach(function (n) { if (ss.has(n)) o++; });
      if (o >= 4) { sim = true; break; }
    }
    if (!sim) { sel.push(c); dk.add(c.key); }
  }
  return sel;
}

// --- V5 加权随机抽取（从号码池中按score权重随机选号） ---
function weightedRandomPickV5(pool, count, weightPower) {
  weightPower = weightPower || 0.5;
  var selected = new Set(), numbers = [];
  var poolCopy = pool.map(function (p) {
    var w = Math.max(0.01, p.score + 1);
    return { number: p.number, weight: Math.pow(w, weightPower) };
  });
  var totalWeight = poolCopy.reduce(function (s, p) { return s + p.weight; }, 0);
  while (numbers.length < count) {
    var r = Math.random() * totalWeight;
    for (var i = 0; i < poolCopy.length; i++) {
      r -= poolCopy[i].weight;
      if (r <= 0 && !selected.has(poolCopy[i].number)) {
        selected.add(poolCopy[i].number);
        numbers.push(poolCopy[i].number);
        break;
      }
    }
    if (numbers.length < count && numbers.length > 0) {
      var remaining = poolCopy.filter(function (p) { return !selected.has(p.number); });
      if (remaining.length > 0) {
        var idx = Math.floor(Math.random() * remaining.length);
        selected.add(remaining[idx].number);
        numbers.push(remaining[idx].number);
      }
    }
  }
  return numbers.sort(function (a, b) { return a - b; });
}

// --- V5 随机生成组合（加权随机抽取，替代枚举穷举） ---
function v5GenCombosRandom(dimPool, count, maxPool, weightPower) {
  maxPool = maxPool || 13;
  weightPower = weightPower || 0.5;
  var poolRange = [].concat(dimPool).sort(function (a, b) { return b.score - a.score; }).slice(0, maxPool);
  var combos = [], seenKeys = new Set();
  var maxAttempts = count * 100;

  for (var attempt = 0; attempt < maxAttempts && combos.length < count * 10; attempt++) {
    var nums = weightedRandomPickV5(poolRange, 5, weightPower);
    if (new Set(nums).size !== 5) continue;
    var sp = nums[4] - nums[0], odd = nums.filter(function (v) { return v % 2 === 1; }).length;
    if (odd === 0 || odd === 5 || sp < 14 || sp > 32) continue;
    var ivX = [0, 0, 0]; nums.forEach(function (v) { ivX[getSampleIntervalIndex(v, sampleIntervals)]++; });
    if (Math.max.apply(Math, ivX) >= 4) continue;
    var run = 1, mc = 1;
    for (var i = 1; i < nums.length; i++) { if (nums[i] - nums[i - 1] === 1) { run++; mc = Math.max(mc, run); } else run = 1; }
    if (mc > 3) continue;
    var dense2 = 0, dense1 = 0;
    for (var gi = 1; gi < nums.length; gi++) {
      var gap = nums[gi] - nums[gi - 1];
      if (gap <= 2) dense2++;
      if (gap <= 1) dense1++;
    }
    if (dense2 > 2 || dense1 > 1) continue;
    var key = nums.join("-");
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    combos.push({ key: key, numbers: nums, score: 0 });
  }

  // 多样性选择：重叠<4（优化: 3→4，+1.1pp Joint）
  var sel = [], dk = new Set();
  for (var ci = 0; ci < combos.length; ci++) {
    var c = combos[ci];
    if (sel.length >= count) break;
    if (dk.has(c.key)) continue;
    var sim = false;
    for (var si = 0; si < sel.length; si++) {
      var s = sel[si];
      var o = 0; var ss = new Set(s.numbers);
      c.numbers.forEach(function (n) { if (ss.has(n)) o++; });
      if (o >= 4) { sim = true; break; }
    }
    if (!sim) { sel.push(c); dk.add(c.key); }
  }
  return sel;
}

// --- V5 组合级智能评分（对齐V4全约束：区间比/和值/奇偶比/跨度/尾号/首位球/锚点/扩散） ---
// 🆕 区间方向预测函数
function predictIntervalDirection(sourceRow, allBalls) {
  if (!allBalls || allBalls.length === 0) return null;
  
  // 获取最近5期的区间分布
  var history = [];
  for (var r = Math.max(1, sourceRow - 4); r <= sourceRow; r++) {
    var rowBalls = allBalls.filter(function(b) { return b.zone === "front" && b.row === r; });
    if (rowBalls.length === 0) continue;
    var nums = rowBalls.map(function(b) { return b.number; });
    var iv = [0, 0, 0];
    nums.forEach(function(n) {
      if (n <= 12) iv[0]++;
      else if (n <= 24) iv[1]++;
      else iv[2]++;
    });
    history.push(iv);
  }
  
  if (history.length < 3) return null;
  
  var current = history[history.length - 1];
  var prev1 = history[history.length - 2];
  var prev2 = history[history.length - 3];
  
  var predictions = [];
  
  for (var z = 0; z < 3; z++) {
    var curr = current[z];
    var p1 = prev1[z];
    var p2 = prev2[z];
    var change1 = curr - p1;
    var change2 = p1 - p2;
    
    // 规则1：极值回归（最强信号）
    if (curr >= 4) {
      predictions.push({ direction: 'decrease', confidence: 0.9, reason: 'extreme_high' });
      continue;
    }
    if (curr === 0) {
      predictions.push({ direction: 'increase', confidence: 0.85, reason: 'extreme_low' });
      continue;
    }
    
    // 规则2：连续同向反转
    if (change1 > 0 && change2 > 0) {
      predictions.push({ direction: 'decrease', confidence: 0.75, reason: 'consecutive_increase' });
      continue;
    }
    if (change1 < 0 && change2 < 0) {
      predictions.push({ direction: 'increase', confidence: 0.7, reason: 'consecutive_decrease' });
      continue;
    }
    
    // 规则3：均值回归
    var avg = (current[z] + prev1[z] + prev2[z]) / 3;
    if (curr > avg + 1.5) {
      predictions.push({ direction: 'decrease', confidence: 0.6, reason: 'above_average' });
      continue;
    }
    if (curr < avg - 1.5) {
      predictions.push({ direction: 'increase', confidence: 0.6, reason: 'below_average' });
      continue;
    }
    
    predictions.push({ direction: 'stable', confidence: 0.5, reason: 'no_signal' });
  }
  
  return predictions;
}

function v5RescoreCombos(combos, srcNums, predictTails, ivPrediction, firstBallPredictions, intervalDirectionPreds) {
  var srcSet = new Set(srcNums);
  var sumRanges = {
    "0:1:4": { lo: 125, hi: 155 }, "0:2:3": { lo: 110, hi: 135 }, "0:3:2": { lo: 95, hi: 130 }, "0:4:1": { lo: 85, hi: 125 },
    "1:0:4": { lo: 100, hi: 140 }, "2:0:3": { lo: 85, hi: 125 }, "3:0:2": { lo: 60, hi: 100 }, "4:0:1": { lo: 35, hi: 77 },
    "1:1:3": { lo: 95, hi: 135 }, "1:2:2": { lo: 82, hi: 118 }, "1:3:1": { lo: 75, hi: 112 },
    "2:1:2": { lo: 78, hi: 112 }, "2:2:1": { lo: 58, hi: 97 }, "3:1:1": { lo: 52, hi: 78 },
    "1:4:0": { lo: 59, hi: 90 }, "2:3:0": { lo: 48, hi: 80 }, "3:2:0": { lo: 38, hi: 76 }, "4:1:0": { lo: 35, hi: 63 },
  };
  var commonRatios = ["2:1:2", "2:2:1", "1:2:2", "3:1:1", "1:3:1", "1:1:3"];
  return combos.map(function (c) {
    var nums = c.numbers, s = sum(nums), sp = nums[4] - nums[0];
    var bonus = c.score;

    // === 全局和值硬过滤 ===
    if (s < 20 || s > 170) return null;

    var iv = [0, 0, 0]; nums.forEach(function (n) { iv[getSampleIntervalIndex(n, sampleIntervals)]++; });
    var ivKey = iv.join(":");

    // === 动态区间比-和值约束（硬淘汰+软奖惩）===
    var sr = sumRanges[ivKey];
    if (sr) {
      if (s < sr.lo - 20 || s > sr.hi + 20) return null;
      if (s >= sr.lo && s <= sr.hi) {
        var center = (sr.lo + sr.hi) / 2, range = (sr.hi - sr.lo) / 2;
        bonus += Math.round((1 - Math.abs(s - center) / range) * 10);
      } else {
        bonus -= Math.min(Math.abs(s < sr.lo ? sr.lo - s : s - sr.hi) * 1.5, 25);
      }
    }

    // === 常见区间比奖励（对齐V4：前3个+8, 后3个+4）===
    var ratioIndex = commonRatios.indexOf(ivKey);
    if (ratioIndex >= 0) bonus += ratioIndex < 3 ? 8 : 4;

    // === 预测区间比匹配 S13 ===
    if (ivPrediction && ivPrediction.predictedIv) {
      var predIv = ivPrediction.predictedIv;
      var ivDist = Math.abs(iv[0] - predIv[0]) + Math.abs(iv[1] - predIv[1]) + Math.abs(iv[2] - predIv[2]) / 2;
      if (ivDist === 0) bonus += 12;
      else if (ivDist <= 1) bonus += 6;
    }

    // === S7: 锚点变换评分 ===
    var anchorKeep = 0, anchorOffset = 0;
    nums.forEach(function (n) {
      if (srcSet.has(n)) { anchorKeep++; return; }
      var best = 0;
      srcNums.forEach(function (a) { var d = Math.abs(n - a); var p = V4_OFFSET_SCORE[d] || 0; if (p > best) best = p; });
      anchorOffset += best;
    });
    bonus += Math.min(anchorOffset * 0.6 + anchorKeep * 18, 35);
    if (anchorKeep >= 2 && anchorKeep <= 3) bonus += (anchorKeep - 1) * 10;
    else if (anchorKeep >= 4) bonus -= (anchorKeep - 3) * 8;
    // 锚点覆盖率奖励
    var explainedAnchors = new Set();
    nums.forEach(function (n) {
      srcNums.forEach(function (a) { if ((V4_OFFSET_SCORE[Math.abs(n - a)] || 0) > 0) explainedAnchors.add(a); });
    });
    if (explainedAnchors.size >= 4) bonus += 8;
    else if (explainedAnchors.size >= 3) bonus += 4;

    // === S9: 重复号奖励 ===
    var repeatCnt = nums.filter(function (n) { return srcSet.has(n); }).length;
    if (repeatCnt === 1) bonus += 8;
    else if (repeatCnt === 2) bonus += 3;
    else if (repeatCnt === 0) bonus -= 5;
    else if (repeatCnt >= 3) bonus -= 12;
    
    // 🆕 区间方向预测调整（基于详细区间变化分析数据）
    if (intervalDirectionPreds && intervalDirectionPreds.length === 3) {
      // 1. 和值方向调整（分析数据：一区增大→和值71.3，一区减小→和值107.1，三区增大→和值104.6，三区减小→和值72.7）
      var sumBias = 0;
      if (intervalDirectionPreds[0].direction === 'increase') sumBias -= 15;  // 一区增大→和值偏低（71.3 vs 均值82）
      if (intervalDirectionPreds[0].direction === 'decrease') sumBias += 15;  // 一区减小→和值偏高（107.1 vs 均值82）
      if (intervalDirectionPreds[2].direction === 'increase') sumBias += 15;  // 三区增大→和值偏高（104.6 vs 均值82）
      if (intervalDirectionPreds[2].direction === 'decrease') sumBias -= 15;  // 三区减小→和值偏低（72.7 vs 均值82）
      
      // 调整和值范围
      if (sr) {
        var adjustedLo = sr.lo + sumBias;
        var adjustedHi = sr.hi + sumBias;
        if (s >= adjustedLo && s <= adjustedHi) bonus += 8; // 在调整后的范围内加分
      }
      
      // 2. 区间稳定时大幅提升重号和尾重权重（分析数据：稳定时重号率0.82，尾重率0.91）
      var isStable = intervalDirectionPreds.every(function(p) { return p.direction === 'stable'; });
      if (isStable) {
        if (repeatCnt >= 1 && repeatCnt <= 2) bonus += 8; // 稳定期重号率0.82，大幅增加重号权重
        if (repeatCnt === 0) bonus -= 3; // 稳定期无重号概率低，轻微惩罚
        // 尾重奖励（分析数据：稳定时尾重率0.91）
        var stableTailRepeat = 0;
        nums.forEach(function(n) { if (srcSet.has(n % 10 + 10) || srcSet.has(n % 10) || srcSet.has(n % 10 + 20)) stableTailRepeat++; });
        // 简化：检查组合中尾号与源号码尾号的重叠
        var srcTailsSet = new Set(srcNums.map(function(n) { return n % 10; }));
        var comboTailMatches = nums.filter(function(n) { return srcTailsSet.has(n % 10); }).length;
        if (comboTailMatches >= 4) bonus += 6;
        else if (comboTailMatches >= 3) bonus += 3;
      }
      
      // 3. 区间分布匹配预测方向
      for (var z = 0; z < 3; z++) {
        var pred = intervalDirectionPreds[z];
        var conf = pred.confidence;
        if (pred.direction === 'increase' && iv[z] >= 2) bonus += Math.round(conf * 8);
        if (pred.direction === 'decrease' && iv[z] <= 1) bonus += Math.round(conf * 8);
        if (pred.direction === 'stable' && iv[z] >= 1 && iv[z] <= 2) bonus += 4;
      }
    }

    // === S8: 连号评罚 ===
    var maxRun = 1, run = 1;
    for (var i = 1; i < nums.length; i++) {
      if (nums[i] - nums[i - 1] === 1) { run++; maxRun = Math.max(maxRun, run); }
      else run = 1;
    }
    if (maxRun === 4) bonus -= 15;
    else if (maxRun === 3) bonus -= 5;
    if (maxRun === 1) bonus += 3;
    else if (maxRun === 2) bonus += 5;

    // === 跨度和奇偶 ===
    if (sp >= 18 && sp <= 24) bonus += 18;
    else if (sp >= 26 && sp <= 33) bonus += 12;
    else if (sp < 14) bonus -= 22;
    else if (sp < 18) bonus -= 8;
    var odd = nums.filter(function (n) { return n % 2 === 1; }).length;
    if (odd === 1) bonus += 12;
    else if (odd === 3) bonus += 8;

    // === 区间均衡 ===
    if (!iv.includes(0)) bonus += 5;
    var ivMax = Math.max.apply(Math, iv);
    if (ivMax >= 3) bonus -= (ivMax - 2) * 4;

    // === S10: 尾号模式（增强版：连续+等差）===
    var comboTailsArr = Array.from(new Set(nums.map(function (n) { return n % 10; })));
    if (comboTailsArr.length >= 5) bonus += 4;
    else if (comboTailsArr.length >= 4) bonus += 2;

    // 🆕 尾号连续模式评分（双连+5, 三连+10, 四连+15, 五连+20）
    var sortedTails = comboTailsArr.slice().sort(function(a, b) { return a - b; });
    var maxTailConsec = 1, curTailConsec = 1;
    for (var ti = 1; ti < sortedTails.length; ti++) {
      if (sortedTails[ti] === sortedTails[ti-1] + 1) {
        curTailConsec++;
        maxTailConsec = Math.max(maxTailConsec, curTailConsec);
      } else {
        curTailConsec = 1;
      }
    }
    // 检查跨0-9连续（如8,9,0,1）
    if (sortedTails.includes(9) && sortedTails.includes(0)) {
      var wrapConsec = 1;
      for (var wi = sortedTails.indexOf(0); wi < sortedTails.length - 1; wi++) {
        if (sortedTails[wi+1] === sortedTails[wi] + 1) wrapConsec++;
        else break;
      }
      // 从0开始检查到9
      var wrapFrom9 = 1;
      for (var wj = sortedTails.indexOf(9); wj >= 1; wj--) {
        if (sortedTails[wj] === sortedTails[wj-1] + 1) wrapFrom9++;
        else break;
      }
      maxTailConsec = Math.max(maxTailConsec, wrapConsec, wrapFrom9);
    }
    if (maxTailConsec >= 5) bonus += 20;
    else if (maxTailConsec >= 4) bonus += 15;
    else if (maxTailConsec >= 3) bonus += 10;
    else if (maxTailConsec >= 2) bonus += 5;

    // 🆕 尾号等差模式评分（等差3: +8, 等差4: +12）
    var hasTailAP3 = false, hasTailAP4 = false;
    for (var td = 2; td <= 4; td++) {
      for (var ts = 0; ts <= 9 - td * 2; ts++) {
        var tcnt = 0;
        for (var tv = ts; tv <= 9; tv += td) {
          if (sortedTails.includes(tv)) tcnt++;
          else break;
        }
        if (tcnt >= 4) hasTailAP4 = true;
        if (tcnt >= 3) hasTailAP3 = true;
      }
    }
    if (hasTailAP4) bonus += 12;
    else if (hasTailAP3) bonus += 8;

    // === 预测尾号匹配（对齐V4: tailMatches * 3）===
    if (predictTails && predictTails.length > 0) {
      var topTails = new Set(predictTails.slice(0, 5).map(function (p) { return p[0]; }));
      var tailMatches = comboTailsArr.filter(function (t) { return topTails.has(t); }).length;
      bonus += tailMatches * 3;
    }

    // === S11: 首位球预测/静态 ===
    var firstBall = nums[0];
    if (firstBallPredictions && firstBallPredictions.length > 0) {
      var fbRank = firstBallPredictions.findIndex(function (x) { return x[0] === firstBall; });
      if (fbRank >= 0 && fbRank < 3) bonus += 15;
      else if (fbRank >= 3 && fbRank < 6) bonus += 12;
      else if (fbRank >= 6 && fbRank < 10) bonus += 8;
      else if (fbRank >= 10 && fbRank < 15) bonus += 4;
      else if (fbRank >= 15) bonus += 1;
      var nearFB = firstBallPredictions.slice(0, 5).some(function (x) { return Math.abs(x[0] - firstBall) === 1; });
      if (nearFB) bonus += 5;
      if (firstBall >= 18) bonus -= 10;
      if (firstBall >= 25) bonus -= 10;
    } else {
      // 静态规则：95.8%首位球≤15
      if (firstBall <= 5) bonus += 12;
      else if (firstBall <= 10) bonus += 8;
      else if (firstBall <= 15) bonus += 4;
      else if (firstBall >= 18) bonus -= 15;
    }

    // === 扩散简化版：区间内最大数量惩罚 ===
    if (ivMax >= 4) bonus -= 8;

    return { key: c.key, numbers: nums, score: bonus };
  }).filter(function (c) { return c !== null; });
}

// --- V5 主函数：6维度独立选号 ---
function buildSampleFrontCombosV5(entries, refs, anchorNumbers, selectedNumbers, predictTails, ivPrediction, firstBallPredictions, extremeFlags, manualRatio, sourceRow) {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  var allBalls = collectBalls();
  var src = selectedNumbers.slice().sort(function (a, b) { return a - b; });
  var srcTails = [].concat(Array.from(new Set(src.map(function (n) { return n % 10; }))));
  var topPT = predictTails ? new Set(predictTails.slice(0, 5).map(function (p) { return p[0]; })) : new Set();

  // 热号
  var hotness = new Map();
  for (var r = Math.max(1, sourceRow - 5); r < sourceRow; r++) {
    allBalls.filter(function (b) { return b.zone === "front" && b.row === r && ballHasColor(b, sampleRedColor); })
      .forEach(function (b) { hotness.set(b.number, (hotness.get(b.number) || 0) + 1); });
  }

  // 频率
  var histMetrics = calculateHistoryMetricsForBoard();
  var afHist = histMetrics ? histMetrics.avgHistoryFreq : 1;
  var afRecent = histMetrics ? histMetrics.avgRecentFreq : 1;
  var histFreq = histMetrics ? histMetrics.historyFreq : new Array(36).fill(0);
  var recentFreq = histMetrics ? histMetrics.recentFreq : new Array(36).fill(0);

  // 桥接 + 等差
  var bridgeMap = buildV4BridgeMap(selectedNumbers, selectedNumbers);
  var arithMap = buildV4ArithmeticMap(selectedNumbers, 6, selectedNumbers);

  // ========== 6维度独立评分 ==========

  // 维度1：尾号
  var dimTail = [];
  for (var n = 1; n <= 35; n++) {
    var s = 0, t = n % 10;
    if (topPT.has(t)) s += 35;
    else if (predictTails && predictTails.some(function (p) { return Math.abs(p[0] - t) === 1; })) s += 15;
    else if (srcTails.indexOf(t) >= 0) s += 8;
    dimTail.push({ number: n, score: s });
  }
  dimTail.sort(function (a, b) { return b.score - a.score; });

  // 维度2：偏移
  var dimOff = [];
  for (var n = 1; n <= 35; n++) {
    var mo = Infinity;
    src.forEach(function (a) { mo = Math.min(mo, Math.abs(n - a)); });
    dimOff.push({ number: n, score: V4_OFFSET_SCORE[mo] || 0 });
  }
  dimOff.sort(function (a, b) { return b.score - a.score; });

  // 维度3：热号（增强权重：Pool +0.5pp）
  var dimHot = [];
  for (var n = 1; n <= 35; n++) {
    var h = hotness.get(n) || 0;
    var s = 0;
    if (h >= 4) s = 10; else if (h >= 3) s = 7; else if (h >= 2) s = 4; else if (h === 0) s = -2;
    dimHot.push({ number: n, score: s });
  }
  dimHot.sort(function (a, b) { return b.score - a.score; });

  // 维度4：频率+邻号
  var dimFreq = [];
  for (var n = 1; n <= 35; n++) {
    var fr = (histFreq[n] || 0) / afHist;
    var r5 = (recentFreq[n] || 0) / afRecent;
    var s = 0;
    if (fr > 1.2) s += Math.round((fr - 1) * 15);
    if (r5 > 1.3) s += Math.round((r5 - 1) * 10);
    if (src.some(function (a) { return Math.abs(a - n) === 1; })) s += 12;
    dimFreq.push({ number: n, score: s });
  }
  dimFreq.sort(function (a, b) { return b.score - a.score; });

  // 维度5：桥接
  var dimBr = [];
  for (var n = 1; n <= 35; n++) {
    var bg = bridgeMap.gapMap.get(n), be = bridgeMap.endpointMap.get(n);
    dimBr.push({ number: n, score: (bg ? bg.score : 0) + (be ? be.score : 0) });
  }
  dimBr.sort(function (a, b) { return b.score - a.score; });

  // 维度6：锚点/等差
  var dimAr = [];
  for (var n = 1; n <= 35; n++) {
    var ae = arithMap.get(n);
    dimAr.push({ number: n, score: ae ? ae.score : 0 });
  }
  dimAr.sort(function (a, b) { return b.score - a.score; });

  // 维度7：重复号码（与上期重号，历史重号率约47%）
  var dimRepeat = [];
  var srcSet = new Set(src);
  for (var n = 1; n <= 35; n++) {
    var s = 0;
    if (srcSet.has(n)) s += 30;
    else if (srcTails.indexOf(n % 10) >= 0) s += 8;
    dimRepeat.push({ number: n, score: s });
  }
  dimRepeat.sort(function (a, b) { return b.score - a.score; });

  // 维度8：跨期关系（尾号匹配+邻号+上期等差延伸）
  var dimCross = [];
  for (var n = 1; n <= 35; n++) {
    var s = 0;
    if (srcSet.has(n)) s += 12;
    if (src.some(function (a) { return Math.abs(a - n) === 1; })) s += 18;
    if (srcTails.indexOf(n % 10) >= 0) s += 10;
    dimCross.push({ number: n, score: s });
  }
  dimCross.sort(function (a, b) { return b.score - a.score; });

  // ========== 归一化：每个维度映射到 0-100 ==========
  function normDim(dim) {
    var mx = dim[0] ? dim[0].score : 1;
    var mn = dim[dim.length - 1] ? dim[dim.length - 1].score : 0;
    var rng = mx - mn || 1;
    var map = new Map();
    dim.forEach(function (e) {
      map.set(e.number, Math.round(((e.score - mn) / rng) * 100));
    });
    return map;
  }
  var nTail = normDim(dimTail), nOff = normDim(dimOff);
  var nHot = normDim(dimHot), nFreq = normDim(dimFreq);
  var nBr = normDim(dimBr), nAr = normDim(dimAr);
  var nRepeat = normDim(dimRepeat), nCross = normDim(dimCross);

  // ========== 8维独立生成（加权随机抽取，不配对） ==========
  function toArr(map) {
    var arr = [];
    for (var n = 1; n <= 35; n++) arr.push({ number: n, score: map.get(n) || 0 });
    return arr.sort(function (a, b) { return b.score - a.score; });
  }

  var dims = [
    { arr: toArr(nTail), count: 3, maxPool: 10 },   // 优化: 2→3 (回测: tail权重最高)
    { arr: toArr(nOff),  count: 1, maxPool: 10 },   // 优化: 2→1 (回测: offset权重低于tail)
    { arr: toArr(nHot),  count: 1, maxPool: 10 },
    { arr: toArr(nFreq), count: 2, maxPool: 10 },   // 优化: 1→2 (回测: freq权重高于hot)
    { arr: toArr(nBr),   count: 1, maxPool: 10 },
    { arr: toArr(nAr),   count: 2, maxPool: 10 },   // 优化: 1→2 (回测: arith权重高于bridge)
    { arr: toArr(nRepeat), count: 1, maxPool: 10 }, // 优化: 2→1 (减少重复维度)
    { arr: toArr(nCross),  count: 1, maxPool: 10 }, // 优化: 2→1 (减少重复维度)
  ];

  var allCombos = [], usedKeys = new Set();
  dims.forEach(function (d) {
    var wp = 0.5;  // weightPower固定值（随机化测试未提升）
    v5GenCombosRandom(d.arr, d.count, d.maxPool, wp).forEach(function (c) {
      if (!usedKeys.has(c.key)) { allCombos.push(c); usedKeys.add(c.key); }
    });
  });

  // 补到至少8注
  if (allCombos.length < 8) {
    var suppPool = new Map();
    dims.forEach(function (d) {
      d.arr.slice(0, 12).forEach(function (c, i) {
        var k = c.number;
        if (!suppPool.has(k) || suppPool.get(k).score < c.score + 10 - i) {
          suppPool.set(k, { number: k, score: c.score + 10 - i });
        }
      });
    });
    var suppArr = Array.from(suppPool.values()).sort(function (a, b) { return b.score - a.score; });
    v5GenCombosRandom(suppArr, 8 - allCombos.length, 13, 0.5).forEach(function (c) {
      if (!usedKeys.has(c.key)) { allCombos.push(c); usedKeys.add(c.key); }
    });
  }

  // ========== 组合级智能评分（全约束：区间比/和值/奇偶/跨度/尾号/首位球/锚点）==========
  // 🆕 计算区间方向预测
  var intervalDirectionPreds = predictIntervalDirection(sourceRow, allBalls);
  var rescored = v5RescoreCombos(allCombos, src, predictTails, ivPrediction, firstBallPredictions, intervalDirectionPreds);
  rescored.sort(function (a, b) { return b.score - a.score; });

  // ========== 跨维度去重（重叠≥3跳过，回测验证：阈值3优于4，命中率+0.2%覆盖率+0.4%）==========
  var finalCombo = [], fk = new Set();
  for (var fi = 0; fi < rescored.length; fi++) {
    var c = rescored[fi];
    if (finalCombo.length >= 20) break;
    if (fk.has(c.key)) continue;
    var sim = false;
    for (var si = 0; si < finalCombo.length; si++) {
      var sp = finalCombo[si];
      var o = 0; var sset = new Set(sp.numbers);
      c.numbers.forEach(function (n) { if (sset.has(n)) o++; });
      if (o >= 3) { sim = true; break; }
    }
    if (!sim) { finalCombo.push(c); fk.add(c.key); }
  }

  return finalCombo.map(function (c) {
    var nsum = sum(c.numbers), nsp = c.numbers[4] - c.numbers[0];
    var niv = [0, 0, 0]; c.numbers.forEach(function (n) { niv[getSampleIntervalIndex(n, sampleIntervals)]++; });
    var nodd = c.numbers.filter(function (n) { return n % 2 === 1; }).length;
    return {
      numbers: c.numbers, key: c.key, score: c.score,
      sum: nsum, span: nsp, iv: niv.join(":"), odd: nodd,
      ratioKey: null, ratioText: "",
    };
  });
}

// ═══ v4.1 单组五行计划（覆盖优先策略）+ 补漏6 ═══
function buildV4SingleSamplePlan(frontCombos, backCombos, poolNumbers = null, candidateEntries = null, predictedTails = null, firstBallPreds = null) {
  const frontBase = frontCombos[0] || null;
  const backBase = backCombos[0] || null;
  if (!frontBase && !backBase) return [];
  
  // 覆盖优先策略：选择Top5使得5组联合覆盖尽可能多的候选池号码
  const selectedFront = poolNumbers && poolNumbers.length > 0
    ? selectCoverageOptimalCombos(frontCombos, poolNumbers, 5)
    : frontCombos.slice(0, 5);
  
  const variants = [];
  for (let offset = 0; offset < Math.min(5, selectedFront.length); offset += 1) {
    const front = selectedFront[offset] || frontBase;
    const back = backCombos[offset % backCombos.length] || backBase;
    variants.push({
      key: `single-${offset + 1}`,
      label: `第${offset + 1}行`,
      front, back,
      title: ["单组五行", front?.ratioText ? `前区 ${front.ratioText}` : "", "后区自由"].filter(Boolean).join(" / "),
    });
  }

  // 🆕 补漏6：从候选池中选Top5未覆盖的号码 + Top5高频号（≥2次）
  if (candidateEntries && candidateEntries.length > 0 && selectedFront.length >= 1) {
    const top5Covered = new Set();
    selectedFront.forEach(c => (c.numbers || []).forEach(n => top5Covered.add(n)));
    const top5Freq = new Map();
    selectedFront.forEach(c => (c.numbers || []).forEach(n => top5Freq.set(n, (top5Freq.get(n) || 0) + 1)));
    const entryMap = new Map(candidateEntries.map(e => [e.number, e]));

    // 计算 Top5 区间最少的区间
    const top5IvCounts = [0, 0, 0];
    selectedFront.forEach(c => {
      (c.numbers || []).forEach(n => { if (n <= 12) top5IvCounts[0]++; else if (n <= 24) top5IvCounts[1]++; else top5IvCounts[2]++; });
    });
    const top5IvMinIdx = top5IvCounts.indexOf(Math.min(...top5IvCounts));
    
    // 预测尾号集合
    const predTails6 = predictedTails ? new Set(predictedTails.slice(0, 5).map(([t]) => t)) : new Set();

    // 筛选：Top5未覆盖 或 Top5出现≥1次
    const c6Scored = candidateEntries
      .filter(e => !top5Covered.has(e.number) || (top5Freq.get(e.number) || 0) >= 1)
      .map(e => {
        const n = e.number;
        const freq = top5Freq.get(n) || 0;
        let s6 = e.score || 0;
        // 尾号匹配（优化：10→5，+6pp联合命中率）
        if (predTails6.has(n % 10)) s6 += 5;
        // 区间平衡（移植 optimized_picker）
        const zone = n <= 12 ? 0 : n <= 24 ? 1 : 2;
        if (zone === top5IvMinIdx) s6 += 6;
        // Top5频率
        if (freq >= 3) s6 += 30;
        else if (freq <= 1) s6 += 25;
        else if (freq >= 2) s6 += 15;
        // 邻近加分
        let minDist = Infinity;
        top5Covered.forEach(cn => { const d = Math.abs(n - cn); if (d < minDist) minDist = d; });
        if (minDist === 1) s6 += 12;
        else if (minDist === 2) s6 += 6;
        else if (minDist === 3) s6 += 3;
        return { number: n, score6: s6 };
      })
      .sort((a, b) => b.score6 - a.score6);

    if (c6Scored.length >= 5) {
      // 生成多个候选组合，选结构最优的
      const combos = [];
      combos.push(c6Scored.slice(0, 5).map(e => e.number).sort((a, b) => a - b));
      for (let t = 0; t < 3; t++) {
        const pool = [...c6Scored];
        const sel = [];
        for (let i = 0; i < 5 && pool.length > 0; i++) {
          const tw = pool.reduce((s, e) => s + Math.max(1, e.score6 + 50), 0);
          let r = Math.random() * tw, idx = 0;
          for (let j = 0; j < pool.length; j++) {
            r -= Math.max(1, pool[j].score6 + 50);
            if (r <= 0) { idx = j; break; }
          }
          sel.push(pool[idx].number);
          pool.splice(idx, 1);
        }
        combos.push(sel.sort((a, b) => a - b));
      }
      let best = null, bestS = -Infinity;
      for (const nums of combos) {
        const sm = nums.reduce((a, b) => a + b, 0);
        const sp = Math.max(...nums) - Math.min(...nums);
        const odd = nums.filter(n => n % 2 === 1).length;
        const iv = [0, 0, 0];
        nums.forEach(n => { if (n <= 12) iv[0]++; else if (n <= 24) iv[1]++; else iv[2]++; });
        let ss = 0;
        if (sm >= 65 && sm <= 115) ss += 10;
        if (sp >= 12 && sp <= 28) ss += 8;
        if (odd >= 1 && odd <= 4) ss += 6;
        if (iv[0] > 0 && iv[1] > 0 && iv[2] > 0) ss += 10;
        else if ((iv[0] > 0 && iv[1] > 0) || (iv[1] > 0 && iv[2] > 0) || (iv[0] > 0 && iv[2] > 0)) ss += 5;
        // 🆕 首位球动态预测加分
        const firstB = nums[0];
        if (firstB <= 15) {
          if (firstBallPreds && firstBallPreds.length > 0) {
            const rank = firstBallPreds.findIndex(([num]) => num === firstB);
            if (rank >= 0 && rank < 5) ss += 12;
            else if (rank >= 5 && rank < 10) ss += 6;
            else ss += 2;
          } else {
            ss += 2;
          }
        } else if (firstB >= 18) ss -= 15;
        const ns = nums.reduce((s, n) => { const e = entryMap.get(n); return s + (e ? (e.score || 0) : 0); }, 0);
        const total = ns + ss * 2;
        if (total > bestS) { bestS = total; best = nums; }
      }
      if (best) {
        variants.push({
          key: 'bulou6',
          label: '补漏6',
          front: { numbers: best, score: bestS, ratioText: '补漏' },
          back: backBase,
          title: '补漏6 / 前区补盲+高频 / 后区自由',
        });
      }
    } else if (c6Scored.length > 0) {
      // 不足5个时直接取可用的
      const nums = c6Scored.slice(0, Math.min(5, c6Scored.length)).map(e => e.number).sort((a, b) => a - b);
      variants.push({
        key: 'bulou6',
        label: '补漏6',
        front: { numbers: nums, score: c6Scored.reduce((s, e) => s + e.score6, 0), ratioText: '补漏' },
        back: backBase,
        title: '补漏6 / 前区补盲+高频 / 后区自由',
      });
    }
  }

  return variants;
}

/**
 * 覆盖优先的组合选择：
 * 1. Top1 选最高分
 * 2. Top2-5 贪心选择覆盖最多未覆盖池号码的组合
 * 3. 在覆盖数相同时偏好高分组合
 */
function selectCoverageOptimalCombos(allCombos, poolNumbers, n) {
  if (allCombos.length <= n) return allCombos;
  
  const poolSet = new Set(poolNumbers);
  const selected = [allCombos[0]]; // Top1: 最高分
  const comboKey = (c) => c.key || (c.numbers ? c.numbers.join(",") : String(c));
  const usedKeys = new Set([comboKey(allCombos[0])]);
  
  for (let round = 1; round < n && selected.length < n; round++) {
    // 当前已覆盖的池号码
    const covered = new Set();
    selected.forEach(c => c.numbers.forEach(num => {
      if (poolSet.has(num)) covered.add(num);
    }));
    
    let bestIdx = -1, bestCombined = -Infinity;
    
    for (let i = 1; i < allCombos.length; i++) {
      const c = allCombos[i];
      if (usedKeys.has(comboKey(c))) continue;
      
      // 计算该组合覆盖了多少个新池号码
      let newCoverage = 0;
      c.numbers.forEach(num => {
        if (poolSet.has(num) && !covered.has(num)) newCoverage++;
      });
      
      // 综合评分：覆盖数 × 50 + 原始分数（覆盖优先但不忽视分数）
      const combined = newCoverage * 50 + c.score;
      
      if (combined > bestCombined) {
        bestCombined = combined;
        bestIdx = i;
      }
    }
    
    if (bestIdx >= 0) {
      selected.push(allCombos[bestIdx]);
      usedKeys.add(comboKey(allCombos[bestIdx]));
    } else {
      // 没有更多候选，用剩余最高分
      for (let i = 1; i < allCombos.length; i++) {
        if (!usedKeys.has(comboKey(allCombos[i]))) {
          selected.push(allCombos[i]);
          usedKeys.add(comboKey(allCombos[i]));
          break;
        }
      }
    }
  }
  
  return selected;
}

function findSampleTargetRow(requestedRow) {
  const currentRow = clamp(requestedRow, 1, rows);
  if (currentRow > drawRows) return currentRow;
  for (let row = drawRows + 1; row <= rows; row += 1) {
    if (!board.querySelector(`.cell[data-row="${row}"] .ball`)) return row;
  }
  return drawRows + 1;
}

function clearFrontRow(row) {
  for (let number = 1; number <= zones.front.max; number += 1) {
    removeBall(getCell(row, "front", number), false, "删除球", { force: true });
  }
}

function clearSampleZoneRow(row, zone) {
  for (let number = 1; number <= zones[zone].max; number += 1) {
    const cell = getCell(row, zone, number);
    const ball = cell?.querySelector(".ball");
    if (!ball || ball.dataset.generated !== "sample") continue;
    if (ball.dataset.sampleBase) {
      try {
        const baseBall = JSON.parse(ball.dataset.sampleBase);
        cell.textContent = cell.dataset.value;
        addBall(row, zone, number, baseBall.label, baseBall.color, false, baseBall.colors, {
          protected: Boolean(baseBall.protected),
          restoreBaseColor: true,
        });
        continue;
      } catch {}
    }
    removeBall(cell, false, "删除球", { force: true });
  }
}

function clearAllSampleBalls() {
  Object.keys(zones).forEach((zone) => {
    for (let row = 1; row <= rows; row += 1) {
      clearSampleZoneRow(row, zone);
    }
  });
}

function markSampleBall(row, zone, number, baseBall = null) {
  const ball = getCell(row, zone, number)?.querySelector(".ball");
  if (!ball) return;
  ball.dataset.generated = "sample";
  if (baseBall) {
    ball.dataset.sampleBase = JSON.stringify(baseBall);
  } else {
    delete ball.dataset.sampleBase;
  }
}

// ═══ 候选池显示 ═══
function renderPoolDisplay(poolNumbers, candidateEntries) {
  const panel = document.querySelector("#agentPoolPanel");
  const display = document.querySelector("#poolDisplay");
  const stats = document.querySelector("#poolStats");
  const coverageInfo = document.querySelector("#poolCoverageInfo");
  if (!panel || !display) return;
  
  panel.hidden = false;
  
  // 区间颜色映射
  const getZoneClass = (n) => {
    if (n <= 12) return "zone-0";
    if (n <= 24) return "zone-1";
    return "zone-2";
  };
  
  // 生成号码球（按尾号排序）
  const sortedByTail = [...poolNumbers].sort((a, b) => (a % 10) - (b % 10) || a - b);
  display.innerHTML = sortedByTail.map((n, i) => {
    const entry = candidateEntries?.find(e => e.number === n);
    const score = entry ? entry.score : 0;
    const zone = getZoneClass(n);
    const rank = poolNumbers.indexOf(n) + 1;
    return `<span class="pool-ball ${zone}" title="${n}号 (得分:${score}, 排名:${rank}) 尾号:${n % 10}">${String(n).padStart(2, "0")}</span>`;
  }).join("");
  
  // 统计信息
  const zone0 = poolNumbers.filter(n => n <= 12).length;
  const zone1 = poolNumbers.filter(n => n >= 13 && n <= 24).length;
  const zone2 = poolNumbers.filter(n => n >= 25).length;
  const odd = poolNumbers.filter(n => n % 2 === 1).length;
  const even = poolNumbers.length - odd;
  
  stats.textContent = `${poolNumbers.length}球 | 区间:${zone0}/${zone1}/${zone2} | 奇偶:${odd}/${even}`;
  
  // Top5覆盖分析
  const comboRows = document.querySelectorAll('[data-generated="sample"]');
  const top5Numbers = new Set();
  comboRows.forEach(ball => {
    const num = parseInt(ball.textContent);
    if (!isNaN(num)) top5Numbers.add(num);
  });
  
  const poolSet = new Set(poolNumbers);
  const covered = [...poolSet].filter(n => top5Numbers.has(n));
  const uncovered = [...poolSet].filter(n => !top5Numbers.has(n));
  
  if (covered.length > 0) {
    coverageInfo.innerHTML = `Top5覆盖: <strong>${covered.length}/${poolNumbers.length}</strong> (${(covered.length / poolNumbers.length * 100).toFixed(0)}%)`;
    if (uncovered.length > 0) {
      coverageInfo.innerHTML += ` | 未覆盖: ${uncovered.join(", ")}`;
    }
    
    // 标记已覆盖的球
    display.querySelectorAll(".pool-ball").forEach(ball => {
      const num = parseInt(ball.textContent);
      if (top5Numbers.has(num)) {
        ball.classList.add("hit");
      }
    });
  }
}

function hidePoolDisplay() {
  const panel = document.querySelector("#agentPoolPanel");
  if (panel) panel.hidden = true;
}

function unlockPage() {
  appRoot.hidden = false;
  appLock.classList.add("is-hidden");
  sessionStorage.setItem(pageAuthStorageKey, "true");
  // 🆕 密码验证通过后显示生成示例按钮
  if (sampleButton) sampleButton.style.display = '';
  renderVersions();
  fitBoardToScreen(true);
  syncVisiblePanel();
}

function updateBaseLabel() {
  currentBaseLabel.textContent = currentBaseTitle
    ? `当前编辑：基于 ${currentBaseTitle} 调整`
    : "当前编辑：空白画面";
}

function updateVersionBanner() {
  if (!versionBanner || !versionBannerText) return;
  versionBanner.hidden = !currentBaseTitle;
  versionBannerText.textContent = currentBaseTitle;
}

function getVersionLabel(version) {
  const title = version?.title || "历史版本";
  const time = version?.time ? ` / ${version.time}` : "";
  return `${title}${time}`;
}

function persistDraft() {
  writeStorage(draftStorageKey, {
    baseTitle: currentBaseTitle,
    updatedAt: formatTime(),
    balls: cloneBalls(collectBalls()),
    rowIssues: { ...rowIssues },
    compareSplitRows: [...compareSplitRows],
    customDividerRows: { ...customDividerRows },
    sampleRowMeta: { ...sampleRowMeta },
  });
}

function addHistory(action, balls) {
  const normalizedBalls = cloneBalls(Array.isArray(balls) ? balls : [balls]);
  if (normalizedBalls.length === 0) return;

  history.unshift({
    id: makeId(),
    action,
    time: formatTime(),
    balls: normalizedBalls,
  });
  history = history.slice(0, 80);
  writeStorage(historyStorageKey, history);
  renderHistory();
}

function createChip(ball) {
  const cleanBall = cloneBall(ball);
  const chip = document.createElement("span");
  chip.className = "history-chip";
  chip.style.setProperty("--ball-color", cleanBall.color);
  chip.textContent = pad(cleanBall.number);
  chip.title = `颜色 ${cleanBall.color}`;
  return chip;
}

function createDetailRow(ball) {
  const cleanBall = cloneBall(ball);
  const row = document.createElement("div");
  row.className = "version-detail-row";
  row.style.setProperty("--ball-color", cleanBall.color);
  row.innerHTML = `
    <span class="detail-dot"></span>
    <strong>${pad(cleanBall.number)}</strong>
    <code>${cleanBall.color}</code>
  `;
  return row;
}

function renderHistory() {
  if (!historyList) return;
  historyList.innerHTML = "";
  if (history.length === 0) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = "还没有记录";
    historyList.append(empty);
    return;
  }

  history.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "history-item";
    const meta = document.createElement("div");
    meta.className = "history-meta";
    meta.innerHTML = `<strong>${entry.action}</strong><span>${entry.time}</span>`;
    const balls = document.createElement("div");
    balls.className = "history-balls";
    cloneBalls(entry.balls).forEach((ball) => balls.append(createChip(ball)));
    item.append(meta, balls);
    historyList.append(item);
  });
}

function updateCount() {
  ballCount.textContent = board.querySelectorAll(".ball").length;
}

function addBall(row, zone, number, label = numberInput.value, color = colorInput.value, shouldRecord = true, existingColors = null, options = {}) {
  const cell = getCell(row, zone, number);
  if (!cell) return;

  const previous = cell.querySelector(".ball");
  const cleanColor = normalizeColor(color);
  const cleanLabel = String(label || cell.dataset.value).slice(0, 2).padStart(2, "0");
  const isProtected = Boolean(options.protected) || previous?.dataset.protected === "true";
  const restoreBaseColor = Boolean(options.restoreBaseColor);
  const protectedAttr = isProtected ? ' data-protected="true"' : "";

  // 从版本恢复彩虹球（shouldRecord=false 且 existingColors 包含多种颜色）
  if (!shouldRecord && existingColors && existingColors.length > 1) {
    const colorsStr = existingColors.join(",");
    cell.innerHTML = restoreBaseColor
      ? `<span class="ball" data-color="${cleanColor}" data-colors="${colorsStr}"${protectedAttr} style="--ball-color:${cleanColor}">${cleanLabel}</span>`
      : `<span class="ball rainbow-ball" data-color="${cleanColor}" data-colors="${colorsStr}"${protectedAttr} style="--ball-color:#1f2937;background:#1f2937">${cleanLabel}</span>`;
    updateCount();
    return;
  }

  // 检查是否已有球，如果有则叠加彩虹效果（黑色）
  if (previous) {
    const existingColorsArr = previous.dataset.colors
      ? previous.dataset.colors.split(",")
      : [previous.dataset.color];
    const shouldStackAsBlack = !shouldRecord || !existingColorsArr.includes(cleanColor);
    if (shouldStackAsBlack) {
      const hadColor = existingColorsArr.includes(cleanColor);
      if (!hadColor) {
        existingColorsArr.push(cleanColor);
      }
      const newColors = existingColorsArr.join(",");
      previous.dataset.colors = newColors;
      if (isProtected) previous.dataset.protected = "true";
      previous.style.background = "#1f2937";
      previous.classList.add("rainbow-ball");
      updateCount();
      if (shouldRecord) {
        addHistory("叠加彩虹球", { row, zone, number, label: cleanLabel, color: newColors, colors: existingColorsArr });
        persistDraft();
      }
      return;
    }
  }

  cell.innerHTML = `<span class="ball" data-color="${cleanColor}"${protectedAttr} style="--ball-color:${cleanColor}">${cleanLabel}</span>`;
  updateCount();

  if (shouldRecord) {
    addHistory(previous ? "替换球" : "添加球", { row, zone, number, label: cleanLabel, color: cleanColor });
    persistDraft();
  }
}

function removeBall(cell, shouldRecord = true, action = "删除球", options = {}) {
  const ball = cell.querySelector(".ball");
  if (!ball) return null;
  if (ball.dataset.protected === "true" && !options.force) return null;

  const removed = getBallData(ball);
  cell.textContent = cell.dataset.value;
  updateCount();

  if (shouldRecord) {
    addHistory(action, removed);
    persistDraft();
  }

  return removed;
}

function clearBoard(shouldRecord = true, force = false) {
  const removed = [];
  board.querySelectorAll(".cell").forEach((cell) => {
    const removedBall = removeBall(cell, false, "删除球", { force });
    if (removedBall) removed.push(removedBall);
  });
  rowIssues = {};
  sampleRowMeta = {};
  setCompareSplitRows([]);
  setCustomDividerRows({});
  updateCount();

  if (shouldRecord) {
    currentBaseTitle = "";
    updateBaseLabel();
    updateVersionBanner();
    addHistory("清空画面", removed);
    persistDraft();
  }
}

function clearMainBoard(shouldRecord = true) {
  clearBoard(shouldRecord, true);
}

function updateRowLabels() {
  board.querySelectorAll(".row-label").forEach((label) => {
    const row = Number(label.dataset.row);
    const issue = rowIssues[row];
    const sampleMeta = sampleRowMeta[row];
    if (label.dataset.zone === "front" && sampleMeta) {
      label.innerHTML = `<span class="row-label-issue row-label-sample">${sampleMeta.label}</span><span class="row-label-num">${row}</span>`;
      label.title = sampleMeta.title;
    } else if (label.dataset.zone === "front" && issue) {
      label.innerHTML = `<span class="row-label-issue">${String(issue).replace(/^20(\d{5})$/, "$1")}</span><span class="row-label-num">${row}</span>`;
      label.title = `${issue}期 第${row}行`;
    } else {
      label.innerHTML = `<span class="row-label-num">${row}</span>`;
      label.title = `第${row}行`;
    }
  });
}

function setSelectedRow(row) {
  selectedRowValue = clamp(row, 1, rows);
  board.querySelectorAll('[data-selected-row="true"]').forEach((element) => {
    delete element.dataset.selectedRow;
  });
  board
    .querySelectorAll(`.row-label[data-row="${selectedRowValue}"], .cell[data-row="${selectedRowValue}"]`)
    .forEach((element) => {
      element.dataset.selectedRow = "true";
    });
}

function applyBalls(balls, options = {}) {
  clearBoard(false, true);
  if (options.rowIssues) rowIssues = { ...options.rowIssues };
  if (options.sampleRowMeta) sampleRowMeta = normalizeSampleRowMeta(options.sampleRowMeta);
  setCompareSplitRows(options.compareSplitRows || []);
  setCustomDividerRows(options.customDividerRows || {});
  cloneBalls(balls).forEach((ball) => {
    addBall(ball.row, ball.zone, ball.number, ball.label, ball.color, false, ball.colors, {
      protected: Boolean(options.protectBalls || ball.protected),
    });
  });
  updateCount();
  updateRowLabels();

  if (Object.prototype.hasOwnProperty.call(options, "baseTitle")) {
    currentBaseTitle = options.baseTitle || "";
  }

  updateBaseLabel();
  updateVersionBanner();
  if (options.persist !== false) persistDraft();
}

function getVersionById(id) {
  return versions.find((version) => version.id === id) || null;
}

function goToComparePage(sourceVersionId = "", selectedIds = [], targetPage = "./compare.html", contextKey = compareContextStorageKey) {
  const cleanedIds = [...new Set((Array.isArray(selectedIds) ? selectedIds : []).filter(Boolean))];
  writeStorage(contextKey, {
    sourceVersionId,
    selectedIds: cleanedIds,
    updatedAt: Date.now(),
  });
  globalThis.location.href = targetPage;
}

function goToCompare90Page(sourceVersionId = "", selectedIds = []) {
  const cleanedIds = Array.isArray(selectedIds) ? selectedIds : [];
  goToComparePage(sourceVersionId, cleanedIds.slice(0, 3), "./compare90.html", compare90ContextStorageKey);
}

const compareRuleHint =
  "选 2 个版本时取各版本第 11-30 行映射到主选号区 1-20、21-40；选 3 个版本时取各版本第 16-30 行映射到主选号区 1-15、16-30、31-45，号码仍按原号码落位。";

function buildCompareBalls(selectedVersions) {
  const compareMode = selectedVersions.length === 2
    ? {
        sourceStart: 11,
        sourceEnd: 30,
        segments: [
          { start: 1, end: 20 },
          { start: 21, end: 40 },
        ],
      }
    : {
        sourceStart: 16,
        sourceEnd: 30,
        segments: [
          { start: 1, end: 15 },
          { start: 16, end: 30 },
          { start: 31, end: 45 },
        ],
      };
  const { sourceStart, sourceEnd, segments } = compareMode;
  const sourceRowCount = sourceEnd - sourceStart + 1;
  const compareBalls = [];
  const compareRows = {};
  const compareSplitRows = [];

  selectedVersions.forEach((version, versionIndex) => {
    const segment = segments[versionIndex];
    if (!version || !segment) return;
    if (versionIndex < selectedVersions.length - 1 && segment.end < rows) compareSplitRows.push(segment.end);
    const sourceBalls = cloneBalls(version.balls).filter((ball) => ball.row >= sourceStart && ball.row <= sourceEnd);
    for (let offset = 0; offset < sourceRowCount; offset += 1) {
      const sourceRow = sourceStart + offset;
      const mappedRow = segment.start + offset;
      compareRows[mappedRow] = version.rowIssues?.[sourceRow] || `${version.title || "历史版本"}-${sourceRow}`;
    }
    sourceBalls.forEach((ball) => {
      const mappedRow = segment.start + (ball.row - sourceStart);
      const mappedNumber = Number(ball.number);
      if (mappedNumber < 1 || mappedNumber > zones[ball.zone]?.max) return;
      compareBalls.push({
        ...ball,
        row: mappedRow,
        zone: ball.zone,
        number: mappedNumber,
        label: pad(mappedNumber),
        protected: true,
      });
    });
  });

  return { compareBalls, compareRows, compareSplitRows };
}

function populateCompareSelects() {
  const selects = [compareVersionOne, compareVersionTwo, compareVersionThree];
  const availableVersions = versions.slice();
  selects.forEach((select, index) => {
    if (!select) return;
    if (index === 2 && availableVersions.length < 3) {
      select.innerHTML = "";
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "不选择第三个版本";
      select.append(option);
      select.value = "";
      return;
    }
    const previous = activeCompareSelection[index] || select.value;
    select.innerHTML = "";
    if (index === 2) {
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "不选择第三个版本";
      select.append(emptyOption);
    }
    availableVersions.forEach((version) => {
      const option = document.createElement("option");
      option.value = version.id;
      option.textContent = getVersionLabel(version);
      select.append(option);
    });
    const fallback = index === 2 ? "" : availableVersions[index]?.id || availableVersions[0]?.id || "";
    select.value = availableVersions.some((version) => version.id === previous) ? previous : fallback;
  });
  activeCompareSelection = selects.map((select) => select?.value || "");
}

function openCompareModal(sourceVersionId = "") {
  if (!versionsUnlocked) {
    versionAuthMessage.textContent = "请先输入密码验证，再查看对比图。";
    return;
  }
  if (versions.length < 2) {
    versionAuthMessage.textContent = "至少需要 2 个版本才能生成对比图。";
    return;
  }
  compareSourceVersionId = sourceVersionId;
  populateCompareSelects();
  compareHint.textContent = compareRuleHint;
  compareModal.hidden = false;
}

function applyCompareView() {
  const selectedIds = [compareVersionOne.value, compareVersionTwo.value, compareVersionThree.value].filter(Boolean);
  activeCompareSelection = selectedIds;
  const selectedVersions = selectedIds.map(getVersionById);
  if (selectedVersions.length < 2 || selectedVersions.some((version) => !version)) {
    compareHint.textContent = "请至少选择 2 个有效版本后再加载。";
    return;
  }

  const { compareBalls, compareRows, compareSplitRows } = buildCompareBalls(selectedVersions);
  const compareTitle = `对比图：${selectedVersions.map((version) => version.title || "历史版本").join(" / ")}`;
  applyBalls(compareBalls, {
    baseTitle: compareTitle,
    rowIssues: compareRows,
    protectBalls: true,
    compareSplitRows,
  });
  addHistory(compareTitle, compareBalls);
  compareHint.textContent = "对比图已加载到主选号区。";
  compareModal.hidden = true;
}

function restoreDraft() {
  const draft = readStorage(draftStorageKey);
  if (draft && Array.isArray(draft.balls) && draft.balls.length > 0) {
    currentBaseTitle = draft.baseTitle || "";
    if (draft.rowIssues) rowIssues = { ...draft.rowIssues };
    sampleRowMeta = normalizeSampleRowMeta(draft.sampleRowMeta);
    applyBalls(draft.balls, {
      persist: false,
      compareSplitRows: draft.compareSplitRows || [],
      customDividerRows: draft.customDividerRows || {},
    });
    updateBaseLabel();
    updateVersionBanner();
    updateRowLabels();
    return;
  }

  const latestVersion = versions[0];
  sampleRowMeta = {};
  if (latestVersion?.balls?.length) {
    applyBalls(latestVersion.balls, {
      baseTitle: latestVersion.title || "",
      rowIssues: latestVersion.rowIssues,
      sampleRowMeta: latestVersion.sampleRowMeta,
      protectBalls: isDrawVersion(latestVersion),
      compareSplitRows: latestVersion.compareSplitRows || [],
      customDividerRows: latestVersion.customDividerRows || {},
      persist: false,
    });
  }

  updateBaseLabel();
  updateVersionBanner();
  updateRowLabels();
}

function syncInputs(row, zone, number) {
  rowInput.value = row;
  zoneInput.value = zone;
  numberInput.max = zones[zone].max;
  numberInput.value = number;
  if (row <= drawRows) sampleSourceRow = row;
  setSelectedRow(row);
}

function setColor(color) {
  colorInput.value = color;
  swatches.forEach((swatch) => {
    swatch.classList.toggle("active", swatch.dataset.color.toLowerCase() === color.toLowerCase());
  });
}

function getBoardNaturalWidth() {
  const rootStyle = getComputedStyle(document.documentElement);
  const boardStyle = getComputedStyle(board);
  const cellSize = parseFloat(rootStyle.getPropertyValue("--cell")) || 28;
  const frontRowLabelWidth = parseFloat(rootStyle.getPropertyValue("--row-label-w")) || 92;
  const backRowLabelWidth = parseFloat(rootStyle.getPropertyValue("--back-row-label-w")) || 19;
  const gap = parseFloat(boardStyle.gap) || 14;
  const paddingLeft = parseFloat(boardStyle.paddingLeft) || 0;
  const paddingRight = parseFloat(boardStyle.paddingRight) || 0;
  const frontWidth = frontRowLabelWidth + zones.front.max * cellSize;
  const backWidth = backRowLabelWidth + zones.back.max * cellSize;
  return frontWidth + backWidth + gap + paddingLeft + paddingRight;
}

function setBoardZoom(value) {
  const zoom = Math.min(Math.max(value, 0.3), 1.3);
  document.documentElement.style.setProperty("--board-zoom", `${zoom}`);
  zoomInput.value = Math.round(zoom * 100);
}

function fitBoardToScreen(force = false) {
  if (userAdjustedZoom && !force) return;
  const availableWidth = boardWrap.clientWidth - 2;
  const naturalWidth = getBoardNaturalWidth();
  if (availableWidth <= 0 || naturalWidth <= 0) return;
  const zoom = Math.min(1, Math.max(0.3, availableWidth / naturalWidth));
  setBoardZoom(zoom);
}

function buildBoard() {
  Object.entries(zones).forEach(([zone, config]) => {
    const fragment = document.createDocumentFragment();
    for (let row = 1; row <= rows; row += 1) {
      const labelCell = document.createElement("div");
      labelCell.className = "row-label";
      labelCell.dataset.row = row;
      labelCell.dataset.zone = zone;
      if (row % 5 === 0) labelCell.dataset.groupEnd = "true";
      if (zone === "front" && (row === 15 || row === 30)) labelCell.dataset.frontSplit = "true";
      if (row > drawRows) labelCell.dataset.pick = "true";
      labelCell.textContent = row;
      labelCell.title = `第${row}行`;
      fragment.append(labelCell);

      for (let number = 1; number <= config.max; number += 1) {
        const cell = document.createElement("button");
        const value = pad(number);
        cell.type = "button";
        cell.className = "cell";
        cell.dataset.row = row;
        cell.dataset.zone = zone;
        cell.dataset.number = number;
        cell.dataset.value = value;
        if (row > drawRows) cell.dataset.pick = "true";
        if (row % 5 === 0) cell.dataset.groupEnd = "true";
        if (zone === "front" && (row === 15 || row === 30)) cell.dataset.frontSplit = "true";
        cell.textContent = value;
        cell.title = `${config.label} 第 ${row} 行，${value} 号`;
        fragment.append(cell);
      }
    }
    config.element.append(fragment);
  });
}

function getBuiltInDrawData() {
  // 优先从外部文件 all_draws.js 读取（window.ALL_DRAWS_DATA）
  // 若无则回退到 localStorage 缓存
  if (window.ALL_DRAWS_DATA && Array.isArray(window.ALL_DRAWS_DATA) && window.ALL_DRAWS_DATA.length > 0) {
    const draws = window.ALL_DRAWS_DATA;
    return sortDrawsByIssue(draws).filter((draw, index, list) => {
      return index === 0 || list[index - 1]?.issue !== draw.issue;
    });
  }
  // 回退：提示加载失败
  console.warn("all_draws.js 未加载，数据源为空，请检查文件是否存在。");
  return [];
}

function createBuiltInDrawBalls(options = {}) {
  const red = "#d6202a";
  const blue = "#1768b7";
  const draws = getBuiltInDrawData();
  const startIssue = String(options.startIssue || "").trim();
  const sourceIndex = startIssue ? draws.findIndex((draw) => draw.issue === startIssue) : -1;
  const sourceDraws = sourceIndex >= 0
    ? draws.slice(sourceIndex, sourceIndex + drawRows)
    : draws.slice(-drawRows);

  rowIssues = {};
  sourceDraws.forEach((draw, index) => {
    rowIssues[index + 1] = draw.issue;
  });

  return sourceDraws.flatMap((draw, index) => {
    const row = index + 1;
    return [
      ...draw.front.map((number) => ({ ...makeBall(row, "front", number, red), protected: true })),
      ...draw.back.map((number) => ({ ...makeBall(row, "back", number, blue), protected: true })),
    ];
  });
}

function saveVersion() {
  const balls = cloneBalls(collectBalls());
  const time = formatTime();
  const defaultTitle = `版本 ${time}`;
  
  // 弹出输入框让用户修改版本名称
  const customTitle = prompt("请输入版本名称：", defaultTitle);
  
  // 如果用户取消，则不保存
  if (customTitle === null) return;
  
  // 使用用户输入的名称，如果为空则使用默认名称
  const title = customTitle.trim() || defaultTitle;
  
  const version = {
    id: makeId(),
    kind: "custom",
    time,
    timestamp: Date.now(),
    title: title,
    balls: cloneBalls(balls),
    rowIssues: { ...rowIssues },
    compareSplitRows: [...compareSplitRows],
    customDividerRows: { ...customDividerRows },
  };

  versions.unshift(version);
  versions = versions.slice(0, 80);
  writeStorage(versionStorageKey, versions);
  currentBaseTitle = version.title;
  updateBaseLabel();
  persistDraft();
  renderVersions();
  showVersion(version.id);
  addHistory("保存版本", balls);
}

async function captureBoard() {
  if (!globalThis.html2canvas) {
    alert("截图组件加载失败，请刷新页面后重试。");
    return;
  }

  const target = document.querySelector("#board");
  const frontSource = document.querySelector("#frontBoard");
  const backSource = document.querySelector("#backBoard");
  if (!target || !frontSource || !backSource) return;

  const filenameBase = currentBaseTitle
    ? currentBaseTitle.replace(/[\\/:*?\"<>|]/g, "-")
    : `选号区-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`;

  const previousText = captureBoardButton?.textContent;
  let captureHost = null;
  if (captureBoardButton) {
    captureBoardButton.disabled = true;
    captureBoardButton.textContent = "生成中...";
  }

  try {
    const boardStyle = getComputedStyle(target);
    const zoneGap = parseFloat(boardStyle.columnGap || boardStyle.gap) || 0;

    captureHost = document.createElement("div");
    captureHost.style.position = "fixed";
    captureHost.style.left = "0";
    captureHost.style.top = "-100000px";
    captureHost.style.padding = "0";
    captureHost.style.margin = "0";
    captureHost.style.background = "#ffffff";
    captureHost.style.zIndex = "-1";
    captureHost.style.overflow = "visible";
    captureHost.style.width = "max-content";

    const clone = document.createElement("div");
    clone.style.display = "inline-flex";
    clone.style.alignItems = "flex-start";
    clone.style.gap = `${zoneGap}px`;
    clone.style.padding = "0";
    clone.style.margin = "0";
    clone.style.background = "#ffffff";
    clone.style.zoom = "1";
    clone.style.transform = "none";
    clone.style.width = "max-content";
    clone.style.minWidth = "0";
    clone.style.maxWidth = "none";
    clone.style.overflow = "visible";

    const frontClone = frontSource.cloneNode(true);
    const backClone = backSource.cloneNode(true);
    [frontClone, backClone].forEach((zoneClone) => {
      zoneClone.style.flex = "0 0 auto";
      zoneClone.style.width = "max-content";
      zoneClone.style.minWidth = "0";
      zoneClone.style.maxWidth = "none";
      zoneClone.style.overflow = "visible";
      zoneClone.style.zoom = "1";
      zoneClone.style.transform = "none";
    });

    clone.append(frontClone, backClone);

    clone.querySelectorAll('.cell[data-zone="front"]:not([data-pick="true"])').forEach((cell) => {
      cell.style.background = "#ffe9e7";
      cell.style.color = "#e06f66";
    });
    clone.querySelectorAll('.cell[data-zone="back"]:not([data-pick="true"])').forEach((cell) => {
      cell.style.background = "#edf6ff";
      cell.style.color = "#6f9ecf";
    });
    clone.querySelectorAll('.cell[data-pick="true"]').forEach((cell) => {
      cell.style.background = "#fff6d8";
      cell.style.color = "#b3913a";
    });
    clone.querySelectorAll('.cell[data-pick="true"][data-zone="back"]').forEach((cell) => {
      cell.style.background = "#eaf8f0";
      cell.style.color = "#58a07b";
    });
    clone.querySelectorAll(".row-label").forEach((label) => {
      label.style.color = "#3f4b5f";
      label.style.background = "#f1f4f9";
    });

    const sourceBalls = [...frontSource.querySelectorAll(".ball"), ...backSource.querySelectorAll(".ball")];
    const clonedBalls = [...clone.querySelectorAll(".ball")];
    sourceBalls.forEach((ball, index) => {
      const cloneBall = clonedBalls[index];
      if (!cloneBall) return;
      const computed = getComputedStyle(ball);
      const sourceColor = ball.dataset.color || computed.backgroundColor;
      const boostedColor = boostCaptureBallColor(sourceColor);
      cloneBall.style.background = boostedColor;
      cloneBall.style.color = "#ffffff";
      cloneBall.style.boxShadow = "0 2px 4px rgba(31, 41, 55, 0.28)";
      cloneBall.style.border = "1px solid rgba(255, 255, 255, 0.3)";
      cloneBall.style.setProperty("--ball-color", boostedColor);
    });

    captureHost.append(clone);
    document.body.append(captureHost);

    await new Promise((resolve) => globalThis.requestAnimationFrame(() => resolve()));

    const captureWidth = Math.ceil(
      Math.max(
        clone.scrollWidth,
        clone.offsetWidth,
        clone.getBoundingClientRect().width,
      ),
    );
    const captureHeight = Math.ceil(
      Math.max(
        clone.scrollHeight,
        clone.offsetHeight,
        clone.getBoundingClientRect().height,
      ),
    );

    const canvas = await globalThis.html2canvas(clone, {
      backgroundColor: "#ffffff",
      scale: Math.max(2, globalThis.devicePixelRatio || 1),
      useCORS: true,
      width: captureWidth,
      height: captureHeight,
      windowWidth: captureWidth,
      windowHeight: captureHeight,
      scrollX: 0,
      scrollY: 0,
    });
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${filenameBase}.png`;
    link.click();
    captureHost.remove();
  } catch (error) {
    console.error(error);
    alert("截图失败，请稍后重试。");
  } finally {
    captureHost?.remove();
    if (captureBoardButton) {
      captureBoardButton.disabled = false;
      captureBoardButton.textContent = previousText || "截图";
    }
  }
}

function downloadVersionFile(version) {
  if (!version) return;
  const safeTitle = String(version.title || "版本")
    .replace(/[\\/:*?\"<>|]/g, "-")
    .trim() || "版本";
  const payload = {
    exportedAt: new Date().toISOString(),
    version,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${safeTitle}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function extractVersionImportPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.versions)) return payload.versions;
  if (payload?.version && typeof payload.version === "object") return [payload.version];
  return [];
}

function normalizeImportedVersion(version) {
  if (!version || typeof version !== "object" || !Array.isArray(version.balls)) return null;
  const id = String(version.id || makeId());
  const time = String(version.time || formatTime());
  const title = String(version.title || `导入版本 ${time}`);
  return {
    ...version,
    id,
    kind: String(version.kind || "custom"),
    time,
    timestamp: Number(version.timestamp) || Date.now(),
    title,
    balls: cloneBalls(version.balls),
    rowIssues: version.rowIssues && typeof version.rowIssues === "object" ? { ...version.rowIssues } : {},
    compareSplitRows: Array.isArray(version.compareSplitRows) ? version.compareSplitRows.map(Number).filter(Boolean) : [],
    customDividerRows: version.customDividerRows && typeof version.customDividerRows === "object" ? { ...version.customDividerRows } : {},
    sampleRowMeta: normalizeSampleRowMeta(version.sampleRowMeta),
  };
}

function downloadVersionsFile() {
  if (!versionsUnlocked) {
    versionAuthMessage.textContent = "请先验证密码后再下载版本信息。";
    return;
  }
  if (versions.length === 0) {
    versionAuthMessage.textContent = "当前没有可下载的版本信息。";
    return;
  }
  const payload = {
    schema: "select-ball-version-library/v1",
    exportedAt: new Date().toISOString(),
    count: versions.length,
    versions,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `版本信息-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  versionAuthMessage.textContent = `已下载 ${versions.length} 个版本信息。`;
}

async function importVersionsFile(file) {
  if (!versionsUnlocked) {
    versionAuthMessage.textContent = "请先验证密码后再导入版本信息。";
    return;
  }
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const importedVersions = extractVersionImportPayload(payload).map(normalizeImportedVersion).filter(Boolean);
    if (importedVersions.length === 0) {
      versionAuthMessage.textContent = "导入失败：文件里没有有效版本信息。";
      return;
    }

    const seenIds = new Set(versions.map((version) => String(version.id)));
    const nextVersions = [];
    let skipped = 0;
    importedVersions.forEach((version) => {
      if (seenIds.has(version.id)) {
        skipped += 1;
        return;
      }
      seenIds.add(version.id);
      nextVersions.push(version);
    });

    if (nextVersions.length === 0) {
      versionAuthMessage.textContent = `没有新增版本，已跳过 ${skipped} 个重复版本。`;
      return;
    }

    versions = [...nextVersions, ...versions].slice(0, 80);
    writeStorage(versionStorageKey, versions);
    renderVersions();
    showVersion(nextVersions[0].id);
    versionAuthMessage.textContent = `已导入 ${nextVersions.length} 个版本${skipped ? `，跳过 ${skipped} 个重复版本` : ""}。`;
  } catch (error) {
    console.error(error);
    versionAuthMessage.textContent = "导入失败：请确认文件是版本信息 JSON。";
  }
}

function saveCurrentBoardAsVersion(title = "") {
  const balls = cloneBalls(collectBalls());
  const time = formatTime();
  const version = {
    id: makeId(),
    kind: "custom",
    time,
    timestamp: Date.now(),
    title: title || `版本 ${time}`,
    balls: cloneBalls(balls),
    rowIssues: { ...rowIssues },
    compareSplitRows: [...compareSplitRows],
    customDividerRows: { ...customDividerRows },
    sampleRowMeta: { ...sampleRowMeta },
  };

  versions.unshift(version);
  versions = versions.slice(0, 80);
  writeStorage(versionStorageKey, versions);
  currentBaseTitle = version.title;
  updateBaseLabel();
  updateVersionBanner();
  persistDraft();
  renderVersions();
  showVersion(version.id);
  addHistory(`保存版本 ${version.title}`, balls);
  return version;
}

function extractDate(text) {
  const match = text.match(/\b(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?\b/);
  if (!match) return "";
  return `${match[1]}-${pad(match[2])}-${pad(match[3])}`;
}

function parseDrawLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const issue = line.match(/\b(20\d{5})\b/)?.[1] || "";
      const date = extractDate(line);
      const cleanLine = line
        .replace(/\b20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?\b/g, " ")
        .replace(/\b20\d{5,}\b/g, " ");
      const numbers = (cleanLine.match(/\b\d{1,2}\b/g) || []).map(Number);
      if (numbers.length < 7) return null;
      const drawNumbers = numbers.slice(-7);
      const front = drawNumbers.slice(0, 5);
      const back = drawNumbers.slice(5, 7);
      const validFront = front.every((number) => number >= 1 && number <= 35);
      const validBack = back.every((number) => number >= 1 && number <= 12);
      if (!validFront || !validBack) return null;
      return { issue, date, front, back };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aKey = a.issue || a.date || "";
      const bKey = b.issue || b.date || "";
      return aKey.localeCompare(bKey);
    });
}

function extractDrawDate(text) {
  const normalized = String(text || "")
    .replace(/[年月]/g, "-")
    .replace(/日/g, "");
  const match = normalized.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (!match) return "";
  return `${match[1]}-${pad(match[2])}-${pad(match[3])}`;
}

function parseIntegerValue(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  const match = String(value).replace(/,/g, "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function normalizeIssue(value) {
  const number = parseIntegerValue(value);
  if (!number) return "";
  const digits = String(number);
  if (digits.length === 7 && digits.startsWith("20")) return digits.slice(2);
  if (digits.length > 5) return digits.slice(-5);
  return digits.padStart(5, "0");
}

function parseDateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && Number.isFinite(value) && value > 20000 && value < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + value * 86400000).toISOString().slice(0, 10);
  }
  return extractDrawDate(String(value || ""));
}

function sortDrawsByIssue(draws) {
  return [...draws].sort((a, b) => {
    const aIssue = parseIntegerValue(a.issue);
    const bIssue = parseIntegerValue(b.issue);
    if (aIssue && bIssue && aIssue !== bIssue) return aIssue - bIssue;
    if (aIssue && !bIssue) return -1;
    if (!aIssue && bIssue) return 1;
    const dateCompare = String(a.date || "").localeCompare(String(b.date || ""));
    return dateCompare || ((a.sequence || 0) - (b.sequence || 0));
  });
}

function parseNumberList(value, max, expected) {
  if (value == null || value === "") return [];
  const text = typeof value === "number" ? String(Math.trunc(value)) : String(value);
  const numbers = (text.match(/\d{1,2}/g) || []).map(Number).filter((number) => number >= 1 && number <= max);
  return expected ? numbers.slice(0, expected) : numbers;
}

function normalizeHeader(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, "").replace(/[（）()【】[\]：:、,_-]/g, "");
}

function getColumnIndex(headers, names) {
  return headers.findIndex((header) => names.some((name) => header === name || header.includes(name)));
}

function getNumberColumnIndexes(headers, zone, count) {
  const digits = zone === "前区" ? ["一", "二", "三", "四", "五", "1", "2", "3", "4", "5"] : ["一", "二", "1", "2"];
  const result = [];
  digits.some((digit) => {
    const index = headers.findIndex((header, columnIndex) => {
      return !result.includes(columnIndex) && header.includes(zone) && header.includes(digit) && !header.includes("注数") && !header.includes("奖金");
    });
    if (index >= 0) result.push(index);
    return result.length >= count;
  });
  return result.slice(0, count);
}

function parseDrawRowsFromSheet(rowsData, options = {}) {
  const cleanRows = rowsData.filter((row) => row.some((cell) => String(cell ?? "").trim()));
  const headerRowIndex = cleanRows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.some((header) => header.includes("前区")) && headers.some((header) => header.includes("后区"));
  });
  if (headerRowIndex < 0) return [];

  const headers = cleanRows[headerRowIndex].map(normalizeHeader);
  const issueColumn = getColumnIndex(headers, ["期号", "开奖期号"]);
  const sequenceColumn = getColumnIndex(headers, ["序号", "顺序", "行号"]);
  const dateColumn = getColumnIndex(headers, ["开奖时间", "开奖日期", "日期"]);
  const frontColumns = getNumberColumnIndexes(headers, "前区", 5);
  const backColumns = getNumberColumnIndexes(headers, "后区", 2);
  const frontCombinedColumn = getColumnIndex(headers, ["前区号码", "前区号"]);
  const backCombinedColumn = getColumnIndex(headers, ["后区号码", "后区号"]);

  const parsedRows = cleanRows.slice(headerRowIndex + 1).map((row, index) => {
    const front = frontColumns.length === 5
      ? frontColumns.flatMap((column) => parseNumberList(row[column], 35)).slice(0, 5)
      : parseNumberList(row[frontCombinedColumn], 35, 5);
    const back = backColumns.length === 2
      ? backColumns.flatMap((column) => parseNumberList(row[column], 12)).slice(0, 2)
      : parseNumberList(row[backCombinedColumn], 12, 2);
    if (front.length !== 5 || back.length !== 2) return null;
    return {
      sequence: parseIntegerValue(row[sequenceColumn]) || index + 1,
      issue: normalizeIssue(row[issueColumn]),
      date: parseDateValue(row[dateColumn]),
      front,
      back,
    };
  }).filter(Boolean);

  return options.sort === false ? parsedRows : sortDrawsByIssue(parsedRows);
}

function serializeDraws(draws) {
  return sortDrawsByIssue(draws).map((draw) => {
    return [draw.issue, draw.date, draw.sequence ? `序号${draw.sequence}` : "", "前区", ...draw.front.map(pad), "后区", ...draw.back.map(pad)]
      .filter(Boolean)
      .join(" ");
  }).join("\n");
}

async function handleDrawFileImport() {
  const file = drawFileInput?.files?.[0];
  if (!file) return;
  if (!globalThis.XLSX) {
    drawImportMessage.textContent = "Excel 解析库加载失败，请刷新页面后重试，或复制 Excel 内容粘贴到输入框。";
    drawFileInput.value = "";
    return;
  }
  try {
    const workbook = globalThis.XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rowsData = globalThis.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
    const parsedDraws = parseDrawRowsFromSheet(rowsData);
    if (parsedDraws.length === 0) {
      drawImportMessage.textContent = "没有从文件中解析到有效数据，请确认表格包含期号、前区号码和后区号码。";
      return;
    }
    drawDataInput.value = serializeDraws(parsedDraws);
    const latestDate = parsedDraws.map((draw) => draw.date).filter(Boolean).sort().at(-1);
    if (latestDate) drawDateInput.value = latestDate;
    drawImportMessage.textContent = `已从 ${file.name} 导入 ${parsedDraws.length} 期，并按期号从小到大排列。`;
  } catch (error) {
    console.error(error);
    drawImportMessage.textContent = "文件读取失败，请确认导入的是 Excel、CSV 或制表符文本文件。";
  } finally {
    drawFileInput.value = "";
  }
}

function parseDrawLinesSafe(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.some((line) => line.includes("\t"))) {
    const parsedRows = parseDrawRowsFromSheet(lines.map((line) => line.split("\t")));
    if (parsedRows.length > 0) return parsedRows;
  }

  return sortDrawsByIssue(lines
    .map((line) => {
      const fullIssue = line.match(/\b(20\d{5})\b/)?.[1] || "";
      const shortIssue = line.match(/\b(\d{5})\b/)?.[1] || "";
      const issue = normalizeIssue(fullIssue || shortIssue);
      const date = extractDrawDate(line);
      const cleanLine = line
        .replace(/\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/g, " ")
        .replace(/20\d{2}年\d{1,2}月\d{1,2}日?/g, " ")
        .replace(/\b20\d{5,}\b/g, " ");
      const numbers = (cleanLine.match(/\b\d{1,2}\b/g) || []).map(Number);
      if (numbers.length < 7) return null;
      const drawNumbers = numbers.slice(-7);
      const front = drawNumbers.slice(0, 5);
      const back = drawNumbers.slice(5, 7);
      if (!front.every((number) => number >= 1 && number <= 35)) return null;
      if (!back.every((number) => number >= 1 && number <= 12)) return null;
      return { issue, date, front, back };
    })
    .filter(Boolean));
}

function generateDrawVersion() {
  const drawText = drawDataInput.value.trim();
  const parsedDraws = sortDrawsByIssue(parseDrawLinesSafe(drawText));
  if (parsedDraws.length === 0) {
    drawImportMessage.textContent = "没有解析到有效开奖数据。请保证每行至少包含 5 个前区和 2 个后区号码。";
    return;
  }

  const latestParsedDate = parsedDraws.map((draw) => draw.date).filter(Boolean).sort().at(-1);
  const date = drawDateInput.value || latestParsedDate || extractDrawDate(drawText) || new Date().toISOString().slice(0, 10);
  const red = "#d6202a";
  const blue = "#1768b7";
  const sourceDraws = parsedDraws.slice(-drawRows);
  const newRowIssues = {};
  const balls = sourceDraws.flatMap((draw, index) => {
    const row = index + 1;
    newRowIssues[row] = draw.issue || `${draw.date}-${row}`;
    return [
      ...draw.front.map((number) => ({ ...makeBall(row, "front", number, red), protected: true })),
      ...draw.back.map((number) => ({ ...makeBall(row, "back", number, blue), protected: true })),
    ];
  });
  const title = `${date}版本`;
  const version = {
    id: editingDrawVersionId || `manual-draw-${date}-${makeId()}`,
    kind: "draw",
    drawDate: date,
    sourceText: drawText,
    rowIssues: newRowIssues,
    time: `${date} 00:00:00`,
    timestamp: new Date(`${date}T00:00:00`).getTime() || Date.now(),
    title,
    balls,
  };

  const wasEditing = Boolean(editingDrawVersionId);
  if (wasEditing) {
    const index = versions.findIndex((item) => item.id === editingDrawVersionId);
    if (index >= 0) {
      versions[index] = { ...versions[index], ...version };
    } else {
      versions.unshift(version);
    }
  } else {
    versions.unshift(version);
  }
  versions = versions.slice(0, 80);
  writeStorage(versionStorageKey, versions);
  drawImportMessage.textContent = `已生成 ${title}，共 ${sourceDraws.length} 期、${balls.length} 个球。`;
  applyBalls(balls, { baseTitle: title, rowIssues: newRowIssues, protectBalls: true });
  addHistory(`生成 ${title}`, balls);
  renderVersions();
  showVersion(version.id);
}

function versionMatches(version, query) {
  if (!query) return true;
  const balls = cloneBalls(version.balls);
  const text = [
    version.title,
    version.time,
    balls.length,
    ...balls.flatMap((ball) => [zones[ball.zone]?.label || "", pad(ball.number), `${ball.row}行`, ball.color]),
  ]
    .join(" ")
    .toLowerCase();
  return text.includes(query.toLowerCase());
}

function renderVersions() {
  document.querySelector(".version-shell").classList.toggle("locked", !versionsUnlocked);
  versionSearch.disabled = !versionsUnlocked;
  downloadVersionsButton.disabled = !versionsUnlocked || versions.length === 0;
  importVersionsInput.disabled = !versionsUnlocked;
  clearVersionsButton.disabled = !versionsUnlocked;
  compareVersionsButton.disabled = !versionsUnlocked || versions.length < 2;
  lockVersionsButton.hidden = !versionsUnlocked;
  unlockVersionsButton.hidden = versionsUnlocked;
  versionPassword.hidden = versionsUnlocked;

  if (!versionsUnlocked) {
    versionList.innerHTML = `<li class="history-empty">验证后显示历史版本</li>`;
    versionPreviewTitle.textContent = "未验证";
    versionPreview.innerHTML = "";
    versionAuthMessage.textContent = "请输入密码后查看历史版本。";
    return;
  }

  versionAuthMessage.textContent = `已验证。${localVersionNotice}历史版本是冻结快照，点击“在此基础上调整”只会复制到当前编辑区。`;
  const query = versionSearch.value.trim();
  const matchedVersions = versions.filter((version) => versionMatches(version, query));
  versionList.innerHTML = "";

  if (matchedVersions.length === 0) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = query ? "没有匹配的历史版本" : "还没有历史版本";
    versionList.append(empty);
    return;
  }

  matchedVersions.forEach((version) => {
    const balls = cloneBalls(version.balls);
    const item = document.createElement("li");
    item.className = "version-item";

    const info = document.createElement("div");
    info.className = "version-info";
    info.innerHTML = `<strong>${version.title || "历史版本"}</strong><span>${balls.length} 个球</span>`;

    const actions = document.createElement("div");
    actions.className = "version-actions";

    const viewButton = document.createElement("button");
    viewButton.type = "button";
    viewButton.textContent = "查看";
    viewButton.addEventListener("click", () => {
      showVersion(version.id);
      openVersionModal(version.id);
    });

    const restoreButton = document.createElement("button");
    restoreButton.type = "button";
    restoreButton.textContent = "在此基础上调整";
    restoreButton.addEventListener("click", () => {
      applyBalls(version.balls, {
        baseTitle: version.title || "历史版本",
        rowIssues: version.rowIssues,
        protectBalls: isDrawVersion(version),
        compareSplitRows: version.compareSplitRows || [],
        customDividerRows: version.customDividerRows || {},
      });
      showVersion(version.id);
      addHistory(`基于 ${version.title || "历史版本"} 调整`, version.balls);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "删除";
    deleteButton.addEventListener("click", () => {
      versions = versions.filter((itemVersion) => itemVersion.id !== version.id);
      writeStorage(versionStorageKey, versions);
      renderVersions();
      versionPreviewTitle.textContent = "未选择版本";
      versionPreview.innerHTML = "";
    });

    actions.append(viewButton, restoreButton, deleteButton);
    item.append(info, actions);
    versionList.append(item);
  });
}

function showVersion(id) {
  const version = versions.find((item) => item.id === id);
  if (!version) return;

  const balls = cloneBalls(version.balls);
  versionPreviewTitle.textContent = `${version.title || "历史版本"}，共 ${balls.length} 个球`;
  versionPreview.innerHTML = "";
  versionPreview.className = "history-balls";

  const hint = document.createElement("span");
  hint.className = "history-empty";
  hint.textContent = balls.length === 0 ? "此版本为空" : "历史版本信息不展示颜色、球、行，点击“查看”可打开详情。";
  versionPreview.append(hint);
}

function openVersionModal(id) {
  const version = versions.find((item) => item.id === id);
  if (!version) return;

  const balls = cloneBalls(version.balls);
  versionModalTitle.textContent = `${version.title || "历史版本"}，共 ${balls.length} 个球`;
  versionModalBody.innerHTML = "";
  if (balls.length === 0) {
    const empty = document.createElement("span");
    empty.className = "history-empty";
    empty.textContent = "此版本为空";
    versionModalBody.append(empty);
  } else {
    balls.forEach((ball) => versionModalBody.append(createDetailRow(ball)));
  }
  versionModal.hidden = false;
}

board.addEventListener("click", (event) => {
  const rowLabel = event.target.closest(".row-label");
  if (rowLabel) {
    syncInputs(Number(rowLabel.dataset.row), zoneInput.value, numberInput.value);
    return;
  }
  const cell = event.target.closest(".cell");
  if (!cell) return;
  const row = Number(cell.dataset.row);
  const zone = cell.dataset.zone;
  const number = Number(cell.dataset.number);
  syncInputs(row, zone, number);
  if (cell.querySelector(".ball")) {
    removeBall(cell);
    return;
  }
  addBall(row, zone, number, cell.dataset.value, colorInput.value);
});

function syncSelectedRowFromInput() {
  const row = clamp(rowInput.value, 1, rows);
  rowInput.value = row;
  setSelectedRow(row);
}

addBallButton.addEventListener("click", () => {
  const row = clamp(rowInput.value, 1, rows);
  const zone = zoneInput.value;
  const number = clamp(numberInput.value, 1, zones[zone].max);
  rowInput.value = row;
  numberInput.value = number;
  addBall(row, zone, number, pad(number));
});

eraseButton.addEventListener("click", () => {
  eraseMode = !eraseMode;
  eraseButton.setAttribute("aria-pressed", String(eraseMode));
});

deleteColorButton.addEventListener("click", () => {
  const targetColor = normalizeColor(colorInput.value);
  const removed = [...board.querySelectorAll(".ball")]
    .filter((ball) => normalizeColor(ball.dataset.color) === targetColor)
    .map((ball) => removeBall(ball.closest(".cell"), false));
  addHistory(`删除颜色 ${targetColor}`, removed);
  persistDraft();
});

addDividerButton?.addEventListener("click", () => {
  const row = clamp(rowInput.value, 1, rows);
  rowInput.value = row;
  addDividerRow(row, colorInput.value, true);
});

clearButton.addEventListener("click", () => clearBoard());
clearMainBoardButton?.addEventListener("click", () => clearMainBoard());

function handleDescAdd() {
  const text = descInput?.value.trim();
  if (!text) return;

  let addedCount = 0;
  const added = [];
  text.split(/[\r\n;；]+/).forEach((line) => {
    const parsed = parseBallDescription(line);
    if (!parsed) return;
    parsed.numbers.forEach((number) => {
      const before = getCell(parsed.row, parsed.zone, number)?.querySelector(".ball");
      addBall(parsed.row, parsed.zone, number, pad(number), parsed.color, false);
      if (!before) addedCount += 1;
      added.push({ row: parsed.row, zone: parsed.zone, number, label: pad(number), color: parsed.color });
    });
  });

  if (added.length === 0) {
    descInput.select();
    return;
  }
  addHistory(`按描述添加 ${addedCount} 个球`, added);
  persistDraft();
  updateCount();
  descInput.value = "";
  descInput.placeholder = `已添加 ${addedCount} 个球`;
}

function addDrawRowsByReverseOrder(draws, sourceName = "Excel") {
  const currentColor = colorInput.value;
  const importedDraws = draws.slice(-rows).reverse();
  const added = [];

  importedDraws.forEach((draw, index) => {
    const row = index + 1;
    [
      ...draw.front.map((number) => ({ zone: "front", number })),
      ...draw.back.map((number) => ({ zone: "back", number })),
    ].forEach(({ zone, number }) => {
      addBall(row, zone, number, pad(number), currentColor, false, null, { protected: true });
      added.push({ row, zone, number, label: pad(number), color: currentColor, protected: true });
    });
  });

  updateCount();
  persistDraft();
  addHistory(`按描述导入 ${sourceName}（倒序）`, added);
  if (descInput) {
    descInput.value = "";
    descInput.placeholder = `已倒序导入 ${importedDraws.length} 行，最下面的数据在第1行`;
  }
}

async function handleDescFileImport() {
  const file = descFileInput?.files?.[0];
  if (!file) return;
  if (!globalThis.XLSX) {
    descInput.placeholder = "Excel 解析库加载失败，请刷新页面后重试。";
    descFileInput.value = "";
    return;
  }

  try {
    const workbook = globalThis.XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rowsData = globalThis.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
    const parsedDraws = parseDrawRowsFromSheet(rowsData, { sort: false });
    if (parsedDraws.length === 0) {
      descInput.placeholder = "没有解析到有效数据，请确认 Excel 包含前区和后区号码。";
      return;
    }
    addDrawRowsByReverseOrder(parsedDraws, file.name);
    
    // 🆕 更新all_draws.json
    updateAllDrawsJson(parsedDraws);
    
  } catch (error) {
    console.error(error);
    descInput.placeholder = "Excel 导入失败，请确认文件格式正确。";
  } finally {
    descFileInput.value = "";
  }
}

// 🆕 更新all_draws.json函数
function updateAllDrawsJson(newDraws) {
  try {
    // 读取现有的all_draws.json数据
    let existingDraws = [];
    try {
      // 尝试从localStorage获取
      const storedDraws = localStorage.getItem('all_draws');
      if (storedDraws) {
        existingDraws = JSON.parse(storedDraws);
      }
    } catch (e) {
      console.log("从localStorage读取all_draws失败，将创建新数据");
    }
    
    // 合并新数据，避免重复
    const allIssues = new Set(existingDraws.map(d => d.issue));
    const newUniqueDraws = newDraws.filter(d => d.issue && !allIssues.has(d.issue));
    
    if (newUniqueDraws.length === 0) {
      console.log("没有新的开奖数据需要添加");
      return;
    }
    
    // 合并数据并按期号排序
    const combinedDraws = [...existingDraws, ...newUniqueDraws].sort((a, b) => {
      const issueA = parseInt(a.issue) || 0;
      const issueB = parseInt(b.issue) || 0;
      return issueA - issueB;
    });
    
    // 保存到localStorage
    localStorage.setItem('all_draws', JSON.stringify(combinedDraws));
    
    // 生成下载内容
    const jsonContent = JSON.stringify(combinedDraws, null, 2);
    
    // 创建下载链接
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'all_draws.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // 显示成功消息
    descInput.placeholder = `已导入 ${newDraws.length} 期数据，其中 ${newUniqueDraws.length} 期为新数据。已自动下载更新后的 all_draws.json`;
    
    console.log(`[all_draws更新] 原有: ${existingDraws.length}期, 新增: ${newUniqueDraws.length}期, 总计: ${combinedDraws.length}期`);
    
  } catch (error) {
    console.error("更新all_draws.json失败:", error);
    descInput.placeholder = "导入成功，但更新all_draws.json失败，请手动更新文件。";
  }
}

descFileInput?.addEventListener("change", handleDescFileImport);
descAddButton?.addEventListener("click", handleDescAdd);
descInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) handleDescAdd();
});
descHelpButton?.addEventListener("click", () => {
  if (!descHelpTip) return;
  descHelpTip.hidden = !descHelpTip.hidden;
  descHelpButton.textContent = descHelpTip.hidden ? "?" : "×";
});

// ═══ 更新预测显示 ═══
function updatePredictionDisplay(predictedTails, ivPrediction, firstBallPredictions, sourceRow, selectedNumbers) {
  const intervalRatioDiv = document.querySelector("#intervalRatioPrediction");
  const tailPredictionDiv = document.querySelector("#tailPrediction");
  const firstBallPredictionDiv = document.querySelector("#firstBallPrediction");
  
  if (!intervalRatioDiv || !tailPredictionDiv || !firstBallPredictionDiv) return;
  
  // 更新区间比预测
  if (ivPrediction && ivPrediction.predictedIv) {
    const ratio = ivPrediction.predictedIv.join(":");
    const confidence = ivPrediction.confidence || "中";
    const sourceRatio = selectedNumbers.length > 0 ? 
      intervalRatio(selectedNumbers).join(":") : "未知";
    
    intervalRatioDiv.innerHTML = `
      <span class="prediction-value ratio">预测: ${ratio}</span>
      <span class="prediction-value">源: ${sourceRatio}</span>
      <div class="prediction-info">置信度: ${confidence} | 基于历史转移模式</div>
    `;
  } else {
    intervalRatioDiv.innerHTML = '<span class="prediction-placeholder">区间比预测数据不足</span>';
  }
  
  // 更新尾号预测（显示7种模式）
  if (predictedTails && predictedTails.length > 0) {
    // 获取7种模式的尾号预测
    const allBalls = collectBalls();
    const tailTransData = analyzeTailTransitionsV4(sourceRow, 50, allBalls);
    const tailCorrelationData = analyzeTailCorrelation(allBalls, sourceRow, 100);
    const correlationBasedCombos = generateTailCorrelationBasedCombos(tailCorrelationData, predictedTails, allBalls, sourceRow, []);
    
    // 模式名称映射
    const modeNames = {
      'pair': '尾号对',
      'triplet': '三元组',
      'consecutive': '连续',
      'arithmetic': '等差',
      'multiSegment': '多段连续',
      'mixed': '混合模式'
    };
    
    // 生成7种模式的尾号组合
    const modes = [];
    
    // 前6种模式来自关联性分析
    for (let i = 0; i < Math.min(6, correlationBasedCombos.length); i++) {
      const combo = correlationBasedCombos[i];
      modes.push({
        name: modeNames[combo.source] || `模式${i + 1}`,
        tails: combo.tails,
        pattern: combo.pattern,
        score: combo.score
      });
    }
    
    // 第7种模式：转移+混合模式（融合转移频率+连续+等差+混合）
    const srcTails = selectedNumbers.map(n => n % 10);
    const tailTransferScores = new Map();
    for (let t = 0; t <= 9; t++) tailTransferScores.set(t, 0);
    
    // 转移频率评分
    if (tailTransData && tailTransData.transFreq) {
      const { transFreq, tailFreq } = tailTransData;
      for (const st of srcTails) {
        for (let tt = 0; tt <= 9; tt++) {
          const key = `${st}→${tt}`;
          const count = transFreq.get(key) || 0;
          tailTransferScores.set(tt, tailTransferScores.get(tt) + count * 3);
        }
      }
      for (let t = 0; t <= 9; t++) {
        const globalFreq = tailFreq.get(t) || 0;
        tailTransferScores.set(t, tailTransferScores.get(t) + globalFreq);
      }
    }
    // 混合模式评分：连续+等差+混合
    if (tailCorrelationData) {
      if (tailCorrelationData.consecutiveTripletFreq) {
        for (const [pattern, count] of tailCorrelationData.consecutiveTripletFreq) {
          if (count < 2) continue;
          const pts = pattern.split(',').map(Number);
          if (pts.some(t => srcTails.includes(t))) {
            for (const t of pts) { if (!srcTails.includes(t)) tailTransferScores.set(t, tailTransferScores.get(t) + count * 2); }
          }
        }
      }
      if (tailCorrelationData.arithmeticTripletFreq) {
        for (const [pattern, count] of tailCorrelationData.arithmeticTripletFreq) {
          if (count < 2) continue;
          const pts = pattern.split(',').map(Number);
          if (pts.some(t => srcTails.includes(t))) {
            for (const t of pts) { if (!srcTails.includes(t)) tailTransferScores.set(t, tailTransferScores.get(t) + count * 2); }
          }
        }
      }
      if (tailCorrelationData.mixedPatternFreq) {
        for (const [pattern, count] of tailCorrelationData.mixedPatternFreq) {
          if (count < 2) continue;
          const pts = pattern.split(',').map(Number);
          if (pts.some(t => srcTails.includes(t))) {
            for (const t of pts) { if (!srcTails.includes(t)) tailTransferScores.set(t, tailTransferScores.get(t) + count * 1.5); }
          }
        }
      }
    }
    
    const transferTails = [...tailTransferScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);
    
    modes.push({
      name: '转移+混合',
      tails: transferTails,
      pattern: '转移频率+连续+等差+混合',
      score: 0
    });
    
    // 第8种模式：桥接模式（填充源尾号之间的间隔尾号）
    const bridgeTailsResult = getBridgeTails(srcTails, 3);
    const bridgeTailScores = new Map();
    for (let t = 0; t <= 9; t++) bridgeTailScores.set(t, 0);
    // 桥接尾号基础分
    for (const t of bridgeTailsResult) {
      bridgeTailScores.set(t, bridgeTailScores.get(t) + 20);
    }
    // 结合全局频率加分
    if (tailTransData && tailTransData.tailFreq) {
      for (let t = 0; t <= 9; t++) {
        const freq = tailTransData.tailFreq.get(t) || 0;
        bridgeTailScores.set(t, bridgeTailScores.get(t) + freq);
      }
    }
    const bridgeSorted = [...bridgeTailScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);
    
    modes.push({
      name: '桥接',
      tails: bridgeSorted,
      pattern: `桥接尾号(${srcTails.join(',')}间隔填充)`,
      score: 0
    });
    
    // 生成HTML显示
    let modesHTML = '';
    for (const mode of modes) {
      const tailsHTML = mode.tails.map(t => `<span class="tail-item">${t}</span>`).join('');
      modesHTML += `
        <div class="mode-item">
          <span class="mode-name">${mode.name}</span>
          <span class="mode-tails">${tailsHTML}</span>
        </div>
      `;
    }
    
    tailPredictionDiv.innerHTML = `
      <div class="modes-container">
        ${modesHTML}
      </div>
      <div class="prediction-info">基于8种尾号模式分析</div>
    `;
  } else {
    tailPredictionDiv.innerHTML = '<span class="prediction-placeholder">尾号预测数据不足</span>';
  }
  
  // 更新首位球预测
  if (firstBallPredictions && firstBallPredictions.length > 0) {
    const top5First = firstBallPredictions.slice(0, 5);
    const firstHTML = top5First.map(([num, score], index) => {
      const className = index < 2 ? "top-pick" : index < 4 ? "highlight" : "";
      return `<span class="prediction-value first-ball ${className}">${num} (${Math.round(score)})</span>`;
    }).join("");
    
    firstBallPredictionDiv.innerHTML = `
      ${firstHTML}
      <div class="prediction-info">基于首位球综合动态预测</div>
    `;
  } else {
    firstBallPredictionDiv.innerHTML = '<span class="prediction-placeholder">首位球预测数据不足</span>';
  }
}

// ═══ 清空预测显示 ═══
function clearPredictionDisplay() {
  const intervalRatioDiv = document.querySelector("#intervalRatioPrediction");
  const tailPredictionDiv = document.querySelector("#tailPrediction");
  const firstBallPredictionDiv = document.querySelector("#firstBallPrediction");
  
  if (intervalRatioDiv) {
    intervalRatioDiv.innerHTML = '<span class="prediction-placeholder">点击"生成示例"后显示预测结果</span>';
  }
  if (tailPredictionDiv) {
    tailPredictionDiv.innerHTML = '<span class="prediction-placeholder">点击"生成示例"后显示预测结果</span>';
  }
  if (firstBallPredictionDiv) {
    firstBallPredictionDiv.innerHTML = '<span class="prediction-placeholder">点击"生成示例"后显示预测结果</span>';
  }
}

// ═══ 7种尾号模式回测对比 ═══
function backtestTailModes(startRow, endRow) {
  const allBalls = collectBalls();
  if (!allBalls || allBalls.length === 0) return null;

  // 8种模式的名称
  const modeNames = ['尾号对', '三元组', '连续', '等差', '多段连续', '混合模式', '转移+混合', '桥接'];
  const modeKeys = ['pair', 'triplet', 'consecutive', 'arithmetic', 'multiSegment', 'mixed', 'transfer', 'bridge'];

  // 统计数据：每个模式的命中次数、总覆盖尾号数
  const stats = modeKeys.map(() => ({
    hits: 0,        // 至少命中1个尾号的期数
    totalMatched: 0, // 总共命中的尾号数
    totalActual: 0,  // 总共实际尾号数
    exactHits: 0,    // 命中3个及以上的期数
    tests: 0
  }));

  let validTests = 0;

  for (let row = startRow; row <= endRow; row++) {
    const sourceRow = row - 1;
    if (sourceRow < 1) continue;

    // 获取实际开奖号码的尾号
    const actualBalls = allBalls.filter(b => b.row === row && b.zone === "front");
    const actualNums = [...new Set(actualBalls.map(b => b.number))].sort((a, b) => a - b);
    if (actualNums.length !== 5) continue;
    const actualTails = new Set(actualNums.map(n => n % 10));

    // 获取源行数据
    const sourceBalls = allBalls.filter(b => b.row === sourceRow && b.zone === "front");
    const sourceNums = [...new Set(sourceBalls.map(b => b.number))].sort((a, b) => a - b);
    if (sourceNums.length !== 5) continue;
    const srcTails = sourceNums.map(n => n % 10);

    // 分析关联性和转移数据
    const tailCorrelationData = analyzeTailCorrelation(allBalls, sourceRow, 100);
    const tailTransData = analyzeTailTransitionsV4(sourceRow, 50, allBalls);

    // 生成预测尾号（简化版：使用全局频率预测）
    const predictedTails = [];
    const globalTailFreq = new Map();
    for (let t = 0; t <= 9; t++) globalTailFreq.set(t, 0);
    for (let r = Math.max(1, sourceRow - 50); r < sourceRow; r++) {
      const rowBalls = allBalls.filter(b => b.row === r && b.zone === "front");
      const rowNums = [...new Set(rowBalls.map(b => b.number))];
      for (const n of rowNums) {
        const t = n % 10;
        globalTailFreq.set(t, globalTailFreq.get(t) + 1);
      }
    }
    for (const [t, count] of globalTailFreq) {
      predictedTails.push([t, count]);
    }
    predictedTails.sort((a, b) => b[1] - a[1]);

    // 生成6种关联性模式组合
    const correlationBasedCombos = generateTailCorrelationBasedCombos(tailCorrelationData, predictedTails, allBalls, sourceRow, []);

    // 前6种模式
    const modeTailsList = [];
    for (let i = 0; i < 6; i++) {
      if (i < correlationBasedCombos.length) {
        modeTailsList.push(new Set(correlationBasedCombos[i].tails));
      } else {
        modeTailsList.push(new Set());
      }
    }

    // 第7种：转移+混合模式（融合转移频率+连续+等差+混合）
    const transferScores = new Map();
    for (let t = 0; t <= 9; t++) transferScores.set(t, 0);
    // 转移频率评分
    if (tailTransData && tailTransData.transFreq) {
      const { transFreq, tailFreq } = tailTransData;
      for (const st of srcTails) {
        for (let tt = 0; tt <= 9; tt++) {
          const key = `${st}→${tt}`;
          const count = transFreq.get(key) || 0;
          transferScores.set(tt, transferScores.get(tt) + count * 3);
        }
      }
      for (let t = 0; t <= 9; t++) {
        const globalFreq = tailFreq.get(t) || 0;
        transferScores.set(t, transferScores.get(t) + globalFreq);
      }
    }
    // 混合模式评分
    if (tailCorrelationData) {
      if (tailCorrelationData.consecutiveTripletFreq) {
        for (const [pattern, count] of tailCorrelationData.consecutiveTripletFreq) {
          if (count < 2) continue;
          const pts = pattern.split(',').map(Number);
          if (pts.some(t => srcTails.includes(t))) {
            for (const t of pts) { if (!srcTails.includes(t)) transferScores.set(t, transferScores.get(t) + count * 2); }
          }
        }
      }
      if (tailCorrelationData.arithmeticTripletFreq) {
        for (const [pattern, count] of tailCorrelationData.arithmeticTripletFreq) {
          if (count < 2) continue;
          const pts = pattern.split(',').map(Number);
          if (pts.some(t => srcTails.includes(t))) {
            for (const t of pts) { if (!srcTails.includes(t)) transferScores.set(t, transferScores.get(t) + count * 2); }
          }
        }
      }
      if (tailCorrelationData.mixedPatternFreq) {
        for (const [pattern, count] of tailCorrelationData.mixedPatternFreq) {
          if (count < 2) continue;
          const pts = pattern.split(',').map(Number);
          if (pts.some(t => srcTails.includes(t))) {
            for (const t of pts) { if (!srcTails.includes(t)) transferScores.set(t, transferScores.get(t) + count * 1.5); }
          }
        }
      }
    }
    const transferTails = [...transferScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);
    modeTailsList.push(new Set(transferTails));

    // 第8种：桥接模式（填充源尾号之间的间隔尾号）
    const bridgeTailsResult = getBridgeTails(srcTails, 3);
    const bridgeScores = new Map();
    for (let t = 0; t <= 9; t++) bridgeScores.set(t, 0);
    for (const t of bridgeTailsResult) {
      bridgeScores.set(t, bridgeScores.get(t) + 20);
    }
    if (tailTransData && tailTransData.tailFreq) {
      for (let t = 0; t <= 9; t++) {
        const freq = tailTransData.tailFreq.get(t) || 0;
        bridgeScores.set(t, bridgeScores.get(t) + freq);
      }
    }
    const bridgeSorted = [...bridgeScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);
    modeTailsList.push(new Set(bridgeSorted));

    // 统计每种模式的命中情况
    for (let m = 0; m < 8; m++) {
      const predSet = modeTailsList[m];
      if (predSet.size === 0) continue;

      let matched = 0;
      for (const t of actualTails) {
        if (predSet.has(t)) matched++;
      }

      stats[m].tests++;
      stats[m].totalMatched += matched;
      stats[m].totalActual += actualTails.size;
      if (matched > 0) stats[m].hits++;
      if (matched >= 3) stats[m].exactHits++;
    }
    validTests++;
  }

  if (validTests === 0) return null;

  // 计算结果
  const results = modeNames.map((name, i) => {
    const s = stats[i];
    const tests = s.tests || 1;
    return {
      name,
      key: modeKeys[i],
      hitRate: (s.hits / tests * 100).toFixed(1),       // 命中率%
      avgMatched: (s.totalMatched / tests).toFixed(2),   // 平均命中数
      coverage: (s.totalMatched / s.totalActual * 100).toFixed(1), // 覆盖率%
      exactRate: (s.exactHits / tests * 100).toFixed(1), // 命中3+率%
      tests
    };
  });

  return { results, validTests };
}

// ═══ 渲染回测结果 ═══
function renderBacktestResults(backtestData) {
  const container = document.querySelector("#tailModeBacktest");
  if (!container || !backtestData) return;

  const { results, validTests } = backtestData;

  // 找出最高命中率和覆盖率
  const maxHitRate = Math.max(...results.map(r => parseFloat(r.hitRate)));
  const maxCoverage = Math.max(...results.map(r => parseFloat(r.coverage)));

  let html = `<div class="backtest-header">回测 ${validTests} 期 | 命中=至少中1个尾号 | 覆盖=实际尾号被预测覆盖比例</div>`;
  html += '<div class="backtest-table">';

  // 表头
  html += `<div class="backtest-row backtest-row-header">
    <span class="bt-mode">模式</span>
    <span class="bt-rate">命中率</span>
    <span class="bt-avg">平均命中</span>
    <span class="bt-cov">覆盖率</span>
    <span class="bt-exact">命中3+</span>
  </div>`;

  for (const r of results) {
    const isHitBest = parseFloat(r.hitRate) === maxHitRate;
    const isCovBest = parseFloat(r.coverage) === maxCoverage;
    const hitClass = isHitBest ? 'bt-best' : '';
    const covClass = isCovBest ? 'bt-best' : '';

    // 颜色条
    const hitBarWidth = Math.min(100, parseFloat(r.hitRate));
    const covBarWidth = Math.min(100, parseFloat(r.coverage));

    html += `<div class="backtest-row">
      <span class="bt-mode">${r.name}</span>
      <span class="bt-rate ${hitClass}">
        <span class="bt-bar" style="width:${hitBarWidth}%"></span>
        <span class="bt-val">${r.hitRate}%</span>
      </span>
      <span class="bt-avg">${r.avgMatched}</span>
      <span class="bt-cov ${covClass}">
        <span class="bt-bar bt-bar-cov" style="width:${covBarWidth}%"></span>
        <span class="bt-val">${r.coverage}%</span>
      </span>
      <span class="bt-exact">${r.exactRate}%</span>
    </div>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

sampleButton.addEventListener("click", () => {
  const requestedRow = clamp(rowInput.value, 1, rows);
  const added = [];
  const displayMode = sampleDisplayModeInput?.value || "single";
  const version = sampleVersionInput?.value || "v3";
  const ratioPlan = getActiveSampleRatios();
  const sourceStartRow = requestedRow <= drawRows ? requestedRow : sampleSourceRow;
  const frontRepeatTarget = Math.floor(Math.random() * 4);
  const backRepeatTarget = Math.floor(Math.random() * 3);
  
  // 🆕 尾号选择模式：直接从尾号候选池生成组合
  let tailPool = getTailFilteredPool();
  const TAIL_POOL_MIN_SIZE = 6; // 候选池最小规模，低于此值触发扩展
  
  if (tailPool.length >= 2) {
    // 尾号模式：从候选池中生成5组组合
    clearAllSampleBalls();
    sampleRowMeta = {};
    const targetStartRow = clamp(requestedRow, 1, Math.max(1, rows - 8 + 1));
    
    // 生成后区组合（按照原来的逻辑）
    const backSample = buildSampleNumbers(requestedRow, "back");
    let backCombos = buildSampleFreeCombos(backSample.candidateEntries, sampleBackPickCount, backRepeatTarget, backSample.selectedNumbers);
    // 🆕 后区桥接组合优先插入到最前面
    const backBridgeNums = generateBackBridgeCombos(sourceStartRow, allBalls);
    const bridgeCombos = backBridgeNums
      .filter(nums => !backCombos.some(c => c.key === nums.join("-")))
      .map(nums => ({ numbers: nums, key: nums.join("-"), score: 999, ratioText: "桥接" }));
    backCombos = [...bridgeCombos, ...backCombos];
    
    const allCombos = [];
    
    // 🆕 尾号模式多维度评分+预测
    // 获取历史数据用于评分
    const allBalls = collectBalls();
    const sourceWindow = getSampleSourceWindow(requestedRow);
    const sourceRow = sourceWindow.selectedRow;
    const selectedRowBalls = allBalls.filter((b) => b.zone === "front" && b.row === sourceRow && ballHasColor(b, sampleRedColor));
    const selectedNumbers = getUniqueSortedSampleNumbers(selectedRowBalls.map((b) => b.number));
    
    // 🆕 候选池动态扩展：当候选池太小时，补充邻近尾号和历史高频号码
    if (tailPool.length < TAIL_POOL_MIN_SIZE) {
      const currentTails = [...selectedTails];
      const poolSet = new Set(tailPool);
      const expansionCandidates = [];
      
      // 策略1: 邻近尾号补充（±1尾号）
      currentTails.forEach(tail => {
        const neighborTails = [(tail + 9) % 10, (tail + 1) % 10]; // 前一个和后一个尾号
        neighborTails.forEach(nt => {
          for (let n = 1; n <= 35; n++) {
            if (n % 10 === nt && !poolSet.has(n)) {
              // 计算历史频率作为评分依据
              const histCount = allBalls.filter(b => b.zone === "front" && b.number === n && ballHasColor(b, sampleRedColor)).length;
              const recentCount = allBalls.filter(b => b.zone === "front" && b.number === n && b.row >= sourceRow - 5 && b.row < sourceRow && ballHasColor(b, sampleRedColor)).length;
              const score = histCount * 2 + recentCount * 3; // 近期频率权重更高
              expansionCandidates.push({ number: n, score, type: 'neighbor', sourceTail: nt });
            }
          }
        });
      });
      
      // 策略2: 历史高频补充（同尾号下历史出现最多的号码，优先补充高频尾号的遗漏号码）
      currentTails.forEach(tail => {
        const tailNumbers = [];
        for (let n = 1; n <= 35; n++) {
          if (n % 10 === tail) {
            const histCount = allBalls.filter(b => b.zone === "front" && b.number === n && ballHasColor(b, sampleRedColor)).length;
            const recentCount = allBalls.filter(b => b.zone === "front" && b.number === n && b.row >= sourceRow - 5 && b.row < sourceRow && ballHasColor(b, sampleRedColor)).length;
            const score = histCount * 2 + recentCount * 3;
            if (!poolSet.has(n)) {
              // 不在候选池的同尾号高频号码，作为扩展候选
              expansionCandidates.push({ number: n, score, type: 'highfreq', sourceTail: tail });
            }
            tailNumbers.push({ number: n, score });
          }
        }
      });
      
      // 按评分排序，选择最高分的号码扩展
      expansionCandidates.sort((a, b) => b.score - a.score);
      
      // 扩展到目标大小（最多扩展到10个，避免过度扩展）
      const targetSize = Math.min(10, TAIL_POOL_MIN_SIZE + 4);
      const expandedPool = [...tailPool];
      const expandedSet = new Set(tailPool);
      
      for (const candidate of expansionCandidates) {
        if (expandedPool.length >= targetSize) break;
        if (!expandedSet.has(candidate.number)) {
          expandedPool.push(candidate.number);
          expandedSet.add(candidate.number);
        }
      }
      
      // 如果仍然不够，从1-35中选择历史最高频的号码补充
      if (expandedPool.length < TAIL_POOL_MIN_SIZE) {
        const allNumbers = [];
        for (let n = 1; n <= 35; n++) {
          if (!expandedSet.has(n)) {
            const histCount = allBalls.filter(b => b.zone === "front" && b.number === n && ballHasColor(b, sampleRedColor)).length;
            const recentCount = allBalls.filter(b => b.zone === "front" && b.number === n && b.row >= sourceRow - 5 && b.row < sourceRow && ballHasColor(b, sampleRedColor)).length;
            allNumbers.push({ number: n, score: histCount * 2 + recentCount * 3 });
          }
        }
        allNumbers.sort((a, b) => b.score - a.score);
        for (const num of allNumbers) {
          if (expandedPool.length >= TAIL_POOL_MIN_SIZE) break;
          expandedPool.push(num.number);
          expandedSet.add(num.number);
        }
      }
      
      tailPool = expandedPool;
    }
    
    // 预处理映射
    const bridgeMap = buildV4BridgeMap(selectedNumbers, selectedNumbers);
    const arithMap = buildV4ArithmeticMap(selectedNumbers, 6, selectedNumbers);
    const plusTenTrend = buildV4PlusTenTrendMap(sourceRow, selectedNumbers, allBalls);
    const refRows = buildV4FullReferenceRows(sourceRow, allBalls);
    
    // 尾号转移预测（增强版：融合参考行关系+全局高频）
    const tailTransData = analyzeTailTransitionsV4(sourceRow, 50, allBalls);
    const predictedTails = predictLikelyTailsV4Enhanced([...new Set(tailPool.map(n => n % 10))], tailTransData, refRows, sourceRow, allBalls);
    
    // 🆕 尾号关联性分析
    const tailCorrelationData = analyzeTailCorrelation(allBalls, sourceRow, 100);
    
    // 🆕 基于关联性分析生成六个尾号组合
    const correlationBasedCombos = generateTailCorrelationBasedCombos(tailCorrelationData, predictedTails, allBalls, sourceRow, tailPool);
    
    // 🆕 首位球综合动态预测（融合5种回测规律：±3范围、±1相邻、+9期、等差延伸、尾号转移）
    const firstBallPredictions = predictFirstBallComprehensive(sourceRow, allBalls);
    
    // 区间比预测
    const sourceIv = intervalRatio(selectedNumbers);
    const ivPrediction = predictTargetIntervalRatio(sourceRow, sourceIv, allBalls);
    
    // 奇偶和和值预测
    const sourceOdd = oddCount(selectedNumbers);
    const sourceSum = sum(selectedNumbers);
    const targetOdd = predictTargetOddCount(sourceRow, allBalls);
    const targetSum = predictTargetSum(sourceRow, allBalls);
    
    // 历史频率分析
    const historyMetrics = calculateHistoryMetricsForBoard();
    
    // 热号（优化：5期窗口命中率最高35.6%，比10期窗口31.3%更好）
    const hotness = new Map();
    for (let r = Math.max(1, sourceRow - 5); r < sourceRow; r++) {
      allBalls.filter((b) => b.zone === "front" && b.row === r && ballHasColor(b, sampleRedColor))
        .forEach((b) => hotness.set(b.number, (hotness.get(b.number) || 0) + 1));
    }
    
    // 极端期检测
    const extremeFlags = { sumCrash: false, parityFlip: false, narrowRange: false };
    if (selectedNumbers.length >= 5) {
      const sourceSpan = selectedNumbers[selectedNumbers.length - 1] - selectedNumbers[0];
      if (sourceSpan <= 12) extremeFlags.narrowRange = true;
      
      const neighborDraws = [];
      for (let r = sourceRow - 1; r >= Math.max(1, sourceRow - 3); r--) {
        const nb = allBalls.filter((b) => b.zone === "front" && b.row === r && ballHasColor(b, sampleRedColor));
        const nbNums = [...new Set(nb.map((b) => b.number))].sort((a, b) => a - b);
        if (nbNums.length === 5) neighborDraws.push(nbNums);
        if (neighborDraws.length >= 2) break;
      }
      if (neighborDraws.length >= 2) {
        const avgPrevSum = (neighborDraws[0].reduce((a, b) => a + b, 0) + neighborDraws[1].reduce((a, b) => a + b, 0)) / 2;
        if (Math.abs(sourceSum - avgPrevSum) > 30) extremeFlags.sumCrash = true;
      }
      if (neighborDraws.length >= 1) {
        const srcOdd = selectedNumbers.filter((n) => n % 2 === 1).length;
        const nbOdd = neighborDraws[0].filter((n) => n % 2 === 1).length;
        if (Math.abs(srcOdd - nbOdd) >= 4) extremeFlags.parityFlip = true;
      }
    }
    
    // 归一化参考值
    const maxPlusTen = Math.max(1, ...[...plusTenTrend.targetMap.values()]);
    const maxBridge = Math.max(1,
      ...[...bridgeMap.gapMap.values()].map((v) => v.score),
      ...[...bridgeMap.endpointMap.values()].map((v) => v.score)
    );
    const maxArith = Math.max(1, ...[...arithMap.values()].map((v) => v.score));
    
    // 对尾号候选池逐一评分
    const tailEntries = tailPool.map(number => {
      let score = 0;
      const n = number;
      const t = n % 10;
      
      // 偏移评分
      if (selectedNumbers.length > 0) {
        let minOffset = Infinity;
        selectedNumbers.forEach((a) => { minOffset = Math.min(minOffset, Math.abs(n - a)); });
        score += V4_OFFSET_SCORE[minOffset] || 0;
      }
      
      // 尾号关联（优先级：predictedTails匹配 > 邻号 > sourceTails）
      if (predictedTails && predictedTails.length > 0) {
        const topTails = new Set(predictedTails.slice(0, 5).map(([tt]) => tt));
        if (topTails.has(t)) score += V4_TAIL_SAME;
        else if (predictedTails.some(([tt]) => Math.abs(t - tt) === 1)) score += V4_TAIL_NEIGHBOR;
        else score += V4_TAIL_WITHIN;
      } else {
        score += V4_TAIL_WITHIN;
      }
      
      // S1: +10期趋势
      const ptScore = plusTenTrend.targetMap.get(n) || 0;
      if (ptScore > 0) score += Math.round(ptScore / maxPlusTen * 30);
      const ptNb = plusTenTrend.neighborMap.get(n) || 0;
      if (ptNb > 0) score += Math.round(ptNb / maxPlusTen * 6);
      
      // S2: 桥梁
      const bg = bridgeMap.gapMap.get(n);
      const be = bridgeMap.endpointMap.get(n);
      if (bg) score += Math.round(bg.score / maxBridge * 15);
      if (be) score += Math.round(be.score / maxBridge * 8);
      
      // S3: 等距
      const ae = arithMap.get(n);
      if (ae) score += Math.round(ae.score / maxArith * 10);
      
      // 热号（增强权重：Pool +0.5pp）
      const hot = hotness.get(n) || 0;
      if (hot >= 4) score += 10;
      else if (hot >= 3) score += 7;
      else if (hot >= 2) score += 4;
      else if (hot === 0) score -= 2;
      
      // 极端期加成
      if (selectedNumbers.length > 0) {
        let minOffset = Infinity;
        selectedNumbers.forEach((a) => { minOffset = Math.min(minOffset, Math.abs(n - a)); });
        if (extremeFlags.narrowRange && minOffset >= 2) score += 4;
        if (extremeFlags.sumCrash && minOffset >= 3) score += 5;
        if (extremeFlags.parityFlip && n % 2 !== selectedNumbers[0] % 2) score += 3;
      }
      
      // 连号附近奖励
      if (selectedNumbers.length > 0) {
        const nearConsec = selectedNumbers.some((a) => {
          const others = selectedNumbers.filter((x) => x !== a);
          return others.some((x) => Math.abs(x - a) === 1) && Math.abs(n - a) <= 4;
        });
        if (nearConsec) score += 7;
      }
      
      // 区间平衡奖励
      const iv = getSampleIntervalIndex(n, sampleIntervals);
      const predictedIv = ivPrediction.predictedIv || sourceIv;
      if (sourceIv[iv] < predictedIv[iv]) {
        score += 3;
      }
      
      // 奇偶平衡奖励
      if (n % 2 === 1 && sourceOdd < targetOdd) {
        score += 2;
      } else if (n % 2 === 0 && sourceOdd > targetOdd) {
        score += 2;
      }
      
      // 和值贡献奖励
      const sumDiff = targetSum - sourceSum;
      if (Math.abs(sumDiff) > 10) {
        if (sumDiff > 0 && n >= 15) {
          score += 2;
        } else if (sumDiff < 0 && n <= 18) {
          score += 2;
        }
      }
      
      // 历史频率评分
      if (historyMetrics) {
        const historyFreq = historyMetrics.historyFreq[n] || 0;
        const recentFreq = historyMetrics.recentFreq[n] || 0;
        const repeatRate = historyMetrics.normalizedRepeatRate[n] || 0;
        const historyRatio = historyFreq / historyMetrics.avgHistoryFreq;
        const recentRatio = recentFreq / historyMetrics.avgRecentFreq;
        const repeatRatio = repeatRate / historyMetrics.avgRepeatRate;
        if (historyRatio > 1.2) score += Math.round((historyRatio - 1) * 15 * V4_HISTORY_FREQ_WEIGHT);
        if (recentRatio > 1.3) score += Math.round((recentRatio - 1) * 10 * V4_RECENT_FREQ_WEIGHT);
        if (repeatRatio > 1.2) score += Math.round((repeatRatio - 1) * 8 * V4_REPEAT_RATE_WEIGHT);
      }
      
      // 🆕 首位球综合动态预测加分（融合±3范围、±1相邻、+9期、等差延伸、尾号转移）
      if (n <= 15) {
        const rank = firstBallPredictions.findIndex(([num]) => num === n);
        if (rank >= 0 && rank < 5) score += 12;       // Top5预测号码
        else if (rank >= 5 && rank < 10) score += 6;  // Top6-10
        else if (rank >= 10) score += 2;              // 其他1-15号码
        // 邻近预测号码轻微加分
        const isNear = firstBallPredictions.slice(0, 5).some(([num]) => Math.abs(num - n) === 1);
        if (isNear) score += 3;
      } else if (n >= 25) {
        score -= 3;  // 25+几乎不会作为首位球
      }
      
      return { number, score };
    });
    
    // 按评分排序
    tailEntries.sort((a, b) => b.score - a.score);
    
    // 🆕 尾号模式：自定义组合生成，确保所有选中尾号都被覆盖
    // 通用 buildSampleFrontCombos 会限制池子大小为14，可能导致某些尾号被裁剪
    let tailCombos = [];
    const tailPoolSize = tailEntries.length;
    const maxTailPool = Math.min(tailPoolSize, 20); // 尾号模式允许更大池子（最多20个号码）
    const tailPoolEntries = tailEntries.slice(0, maxTailPool);
    
    // 生成所有可能的5号码组合
    const MAX_TAIL_COMBOS = 3000;
    const tailComboStack = [];
    function tailComboWalk(startIndex) {
      if (tailCombos.length >= MAX_TAIL_COMBOS) return;
      if (tailComboStack.length === samplePickCount) {
        const record = buildSampleComboRecord(tailComboStack, [], { intervals: sampleIntervals, applyRunPenalty: true, applySpreadPenalty: true, referenceRows: [], zone: "front", repeatTarget: frontRepeatTarget, anchorNumbers: [], selectedNumbers });
        record.key = getSampleComboKey(record.numbers);
        record.ratioText = record.ratioKey;
        tailCombos.push(record);
        return;
      }
      for (let index = startIndex; index <= tailPoolEntries.length - (samplePickCount - tailComboStack.length); index += 1) {
        if (tailCombos.length >= MAX_TAIL_COMBOS) break;
        tailComboStack.push(tailPoolEntries[index]);
        tailComboWalk(index + 1);
        tailComboStack.pop();
      }
    }
    tailComboWalk(0);
    tailCombos.sort(compareSampleCombos);
    
    // 🆕 尾号覆盖优化：贪心选择5组组合，最大化尾号多样性 + 号码多样性
    const selectedCombos = [];
    const usedTailSets = [];
    const usedNumbers = new Set(); // 记录已选组合的所有号码
    
    // 🆕 优先使用基于关联性分析的六个尾号组合
    if (correlationBasedCombos && correlationBasedCombos.length > 0) {
      // 将尾号组合转换为号码组合
      for (const comboData of correlationBasedCombos) {
        const comboNumbers = [];
        const targetTails = new Set(comboData.tails);
        
        // 从候选池中选择匹配尾号的号码
        for (const entry of tailEntries) {
          if (comboNumbers.length >= 5) break;
          const tail = entry.number % 10;
          if (targetTails.has(tail)) {
            comboNumbers.push(entry.number);
            targetTails.delete(tail); // 避免重复选择同一尾号
          }
        }
        
        // 如果号码不够5个，从评分最高的号码中补充
        if (comboNumbers.length < 5) {
          for (const entry of tailEntries) {
            if (comboNumbers.length >= 5) break;
            if (!comboNumbers.includes(entry.number)) {
              comboNumbers.push(entry.number);
            }
          }
        }
        
        // 创建组合记录
        const record = {
          numbers: comboNumbers.slice(0, 5).sort((a, b) => a - b),
          score: comboData.score,
          source: comboData.source,
          pattern: comboData.pattern,
          key: getSampleComboKey(comboNumbers.slice(0, 5))
        };
        
        selectedCombos.push(record);
        usedTailSets.push(new Set(record.numbers.map(n => n % 10)));
        record.numbers.forEach(n => usedNumbers.add(n));
      }
    } else if (tailCombos.length > 0) {
      // 原有逻辑：从tailCombos中选择
      // 第1组：选评分最高的
      selectedCombos.push(tailCombos[0]);
      usedTailSets.push(new Set(tailCombos[0].numbers.map(n => n % 10)));
      tailCombos[0].numbers.forEach(n => usedNumbers.add(n));
      
      // 第2-5组：贪心选择，综合考虑尾号覆盖度 + 号码多样性
      for (let i = 1; i < Math.min(5, tailCombos.length); i++) {
        const allUsedTails = new Set();
        usedTailSets.forEach(ts => ts.forEach(t => allUsedTails.add(t)));
        
        let bestCombo = null;
        let bestScore = -Infinity;
        
        for (const candidate of tailCombos) {
          if (selectedCombos.some(sc => sc.key === candidate.key)) continue;
          
          const candidateTails = new Set(candidate.numbers.map(n => n % 10));
          // 新尾号覆盖度
          let newTailCount = 0;
          candidateTails.forEach(t => {
            if (!allUsedTails.has(t)) newTailCount++;
          });
          // 号码多样性：不在已选号码集合中的新号码数量
          let newNumberCount = 0;
          candidate.numbers.forEach(n => {
            if (!usedNumbers.has(n)) newNumberCount++;
          });
          
          // 综合评分 = 新尾号覆盖度×10 + 新号码数×5 + 组合评分/10
          const comboScore = newTailCount * 10 + newNumberCount * 5 + (candidate.score || 0) / 10;
          if (comboScore > bestScore) {
            bestScore = comboScore;
            bestCombo = candidate;
          }
        }
        
        if (bestCombo) {
          selectedCombos.push(bestCombo);
          usedTailSets.push(new Set(bestCombo.numbers.map(n => n % 10)));
          bestCombo.numbers.forEach(n => usedNumbers.add(n));
        }
      }
    }
    
    // 🆕 区间比强制过滤+生成：当用户选择了区间比时，确保所有组合符合区间比
    if (ratioPlan && ratioPlan.length > 0) {
      const allowedRatioKeys = new Set(ratioPlan.map(r => Array.isArray(r) ? r.join(":") : ""));
      
      // 第1步：从已有组合中过滤出符合区间比的
      const ratioFiltered = selectedCombos.filter(c => {
        const rKey = getSampleRatioKey(c.numbers, sampleIntervals);
        return allowedRatioKeys.has(rKey);
      });
      // 从 tailCombos 中补充更多符合区间比的组合
      const extraRatioCombos = tailCombos.filter(c => {
        const rKey = getSampleRatioKey(c.numbers, sampleIntervals);
        return allowedRatioKeys.has(rKey) && !ratioFiltered.some(rc => rc.key === c.key);
      });
      const allRatioCombos = [...ratioFiltered, ...extraRatioCombos];
      
      // 第2步：如果过滤后不足5个，主动按区间比从 tailEntries 生成新组合
      const generatedRatioCombos = [];
      if (allRatioCombos.length < 5 && tailEntries.length >= 5) {
        for (const ratio of ratioPlan) {
          if (!Array.isArray(ratio) || ratio.length !== 3) continue;
          const [z0Count, z1Count, z2Count] = ratio;
          if (z0Count + z1Count + z2Count !== 5) continue;
          
          // 按区间分桶
          const z0 = tailEntries.filter(e => getSampleIntervalIndex(e.number, sampleIntervals) === 0);
          const z1 = tailEntries.filter(e => getSampleIntervalIndex(e.number, sampleIntervals) === 1);
          const z2 = tailEntries.filter(e => getSampleIntervalIndex(e.number, sampleIntervals) === 2);
          
          if (z0.length < z0Count || z1.length < z1Count || z2.length < z2Count) continue;
          
          // 回溯生成符合区间比的组合
          const seen = new Set(allRatioCombos.map(c => c.key));
          let genCount = 0;
          const MAX_GEN = 20;
          
          function btGen(idx, chosen, entriesChosen) {
            if (genCount >= MAX_GEN) return;
            if (idx >= 3) {
              if (chosen.length !== 5) return;
              const nums = chosen.sort((a, b) => a - b);
              const key = nums.join("-");
              if (seen.has(key)) return;
              seen.add(key);
              const record = buildSampleComboRecord(entriesChosen, ratio, { intervals: sampleIntervals, applyRunPenalty: true, applySpreadPenalty: true, referenceRows: [], zone: "front", repeatTarget: frontRepeatTarget, anchorNumbers: [], selectedNumbers });
              record.key = key;
              record.ratioText = getSampleRatioText(ratio);
              generatedRatioCombos.push(record);
              genCount++;
              return;
            }
            const arr = idx === 0 ? z0 : idx === 1 ? z1 : z2;
            const need = ratio[idx];
            function pick(start, depth, picked, ep) {
              if (genCount >= MAX_GEN) return;
              if (depth === need) { btGen(idx + 1, [...chosen, ...picked], [...entriesChosen, ...ep]); return; }
              for (let i = start; i <= arr.length - (need - depth); i++) {
                picked.push(arr[i].number); ep.push(arr[i]);
                pick(i + 1, depth + 1, picked, ep);
                picked.pop(); ep.pop();
              }
            }
            pick(0, 0, [], []);
          }
          btGen(0, [], []);
        }
        generatedRatioCombos.sort(compareSampleCombos);
      }
      
      // 第3步：合并所有符合区间比的组合，替换 selectedCombos
      const finalRatioCombos = [...allRatioCombos, ...generatedRatioCombos];
      if (finalRatioCombos.length > 0) {
        selectedCombos.length = 0;
        finalRatioCombos.slice(0, 5).forEach(c => selectedCombos.push(c));
      }
    }
    
    for (let i = 0; i < 5; i++) {
      const targetRow = targetStartRow + i;
      let combo = [];
      
      if (selectedCombos.length > i) {
        // 使用优化后的组合选择
        combo = selectedCombos[i].numbers.slice(0, 5).sort((a, b) => a - b);
      } else if (tailCombos.length > 0) {
        // 组合不够时循环使用
        const comboIndex = i % tailCombos.length;
        combo = tailCombos[comboIndex].numbers.slice(0, 5).sort((a, b) => a - b);
      } else {
        // 如果没有生成组合，回退到从评分最高的号码中选择
        combo = tailEntries.slice(0, 5).map(e => e.number).sort((a, b) => a - b);
      }
      allCombos.push(combo);
      
      // 根据关联性模式显示标签
      const patternLabels = {
        'pair': '尾号对',
        'triplet': '三元组',
        'consecutive': '连续',
        'arithmetic': '等差',
        'multiSegment': '多段连续',
        'mixed': '混合模式'
      };
      const patternDescs = {
        'pair': '基于高频尾号对组合',
        'triplet': '基于高频三元组',
        'consecutive': '基于连续尾号三元组',
        'arithmetic': '基于等差尾号三元组',
        'multiSegment': '基于多段连续模式',
        'mixed': '连续+等差混合'
      };
      const comboSource = selectedCombos[i]?.source || '';
      const patternLabel = patternLabels[comboSource] || `组合${i + 1}`;
      const patternDesc = patternDescs[comboSource] || '';
      
      clearSampleZoneRow(targetRow, "front");
      sampleRowMeta[targetRow] = { label: patternLabel, title: patternDesc ? `${patternLabel} — ${patternDesc}` : `关联性模式: ${comboSource}` };
      for (const number of combo) {
        const existingBall = getCell(targetRow, "front", number)?.querySelector(".ball");
        const baseBall = existingBall ? getBallData(existingBall) : null;
        addBall(targetRow, "front", number, pad(number), samplePurpleColor, false);
        markSampleBall(targetRow, "front", number, baseBall);
        added.push({ row: targetRow, zone: "front", number, label: pad(number), color: samplePurpleColor });
      }
      
      // 生成后区号码（按照原来的逻辑，从后区组合中选择）
      clearSampleZoneRow(targetRow, "back");
      let backNumbers = [];
      if (backCombos.length > 0) {
        // 从后区组合中随机选择一个
        const backCombo = backCombos[Math.floor(Math.random() * backCombos.length)];
        backNumbers = backCombo.numbers.slice(0, 2);
      } else {
        // 如果没有后区组合，回退到随机生成
        while (backNumbers.length < 2) {
          const num = Math.floor(Math.random() * 12) + 1;
          if (!backNumbers.includes(num)) {
            backNumbers.push(num);
          }
        }
      }
      for (const number of backNumbers) {
        const existingBall = getCell(targetRow, "back", number)?.querySelector(".ball");
        const baseBall = existingBall ? getBallData(existingBall) : null;
        addBall(targetRow, "back", number, pad(number), samplePurpleColor, false);
        markSampleBall(targetRow, "back", number, baseBall);
        added.push({ row: targetRow, zone: "back", number, label: pad(number), color: samplePurpleColor });
      }
    }
    
    // 🆕 补漏6：参考普通模式v4的补漏机制
    const top5Covered = new Set();
    allCombos.forEach(combo => combo.forEach(n => top5Covered.add(n)));
    const top5Freq = new Map();
    allCombos.forEach(combo => combo.forEach(n => top5Freq.set(n, (top5Freq.get(n) || 0) + 1)));
    
    // 计算 Top5 区间最少的区间
    const top5IvCounts = [0, 0, 0];
    allCombos.forEach(combo => {
      combo.forEach(n => { if (n <= 12) top5IvCounts[0]++; else if (n <= 24) top5IvCounts[1]++; else top5IvCounts[2]++; });
    });
    const top5IvMinIdx = top5IvCounts.indexOf(Math.min(...top5IvCounts));
    
    // 预测尾号集合：补漏6使用第6个关联性组合的尾号（与top1-5不同的尾号组合）
    const predTails6 = correlationBasedCombos && correlationBasedCombos.length >= 6 
      ? new Set(correlationBasedCombos[5].tails) 
      : (predictedTails ? new Set(predictedTails.slice(0, 5).map(([t]) => t)) : new Set());
    
    // 筛选：Top5未覆盖 或 Top5出现≥1次
    const c6Scored = tailEntries
      .filter(e => !top5Covered.has(e.number) || (top5Freq.get(e.number) || 0) >= 1)
      .map(e => {
        const n = e.number;
        const freq = top5Freq.get(n) || 0;
        let s6 = e.score || 0;
        // 尾号匹配（优化：10→5，+6pp联合命中率）
        if (predTails6.has(n % 10)) s6 += 5;
        // 区间平衡
        const zone = n <= 12 ? 0 : n <= 24 ? 1 : 2;
        if (zone === top5IvMinIdx) s6 += 6;
        // Top5频率
        if (freq >= 3) s6 += 30;
        else if (freq <= 1) s6 += 25;
        else if (freq >= 2) s6 += 15;
        // 邻近加分
        let minDist = Infinity;
        top5Covered.forEach(cn => { const d = Math.abs(n - cn); if (d < minDist) minDist = d; });
        if (minDist === 1) s6 += 12;
        else if (minDist === 2) s6 += 6;
        else if (minDist === 3) s6 += 3;
        return { number: n, score6: s6 };
      })
      .sort((a, b) => b.score6 - a.score6);
    
    if (c6Scored.length >= 5) {
      // 生成多个候选组合，选结构最优的
      const combos = [];
      combos.push(c6Scored.slice(0, 5).map(e => e.number).sort((a, b) => a - b));
      for (let t = 0; t < 3; t++) {
        const pool = [...c6Scored];
        const sel = [];
        for (let i = 0; i < 5 && pool.length > 0; i++) {
          const tw = pool.reduce((s, e) => s + Math.max(1, e.score6 + 50), 0);
          let r = Math.random() * tw, idx = 0;
          for (let j = 0; j < pool.length; j++) {
            r -= Math.max(1, pool[j].score6 + 50);
            if (r <= 0) { idx = j; break; }
          }
          sel.push(pool[idx].number);
          pool.splice(idx, 1);
        }
        combos.push(sel.sort((a, b) => a - b));
      }
      let best = null, bestS = -Infinity;
      for (const nums of combos) {
        const sm = nums.reduce((a, b) => a + b, 0);
        const sp = Math.max(...nums) - Math.min(...nums);
        const odd = nums.filter(n => n % 2 === 1).length;
        const iv = [0, 0, 0];
        nums.forEach(n => { if (n <= 12) iv[0]++; else if (n <= 24) iv[1]++; else iv[2]++; });
        let ss = 0;
        if (sm >= 65 && sm <= 115) ss += 10;
        if (sp >= 12 && sp <= 28) ss += 8;
        if (odd >= 1 && odd <= 4) ss += 6;
        if (iv[0] > 0 && iv[1] > 0 && iv[2] > 0) ss += 10;
        else if ((iv[0] > 0 && iv[1] > 0) || (iv[1] > 0 && iv[2] > 0) || (iv[0] > 0 && iv[2] > 0)) ss += 5;
        // 🆕 首位球动态预测加分
        const firstB = nums[0];
        if (firstB <= 15) {
          const rank = firstBallPredictions.findIndex(([num]) => num === firstB);
          if (rank >= 0 && rank < 5) ss += 12;
          else if (rank >= 5 && rank < 10) ss += 6;
          else ss += 2;
        } else if (firstB >= 18) ss -= 15;
        const ns = nums.reduce((s, n) => { const e = tailEntries.find(te => te.number === n); return s + (e ? (e.score || 0) : 0); }, 0);
        const total = ns + ss * 2;
        if (total > bestS) { bestS = total; best = nums; }
      }
      if (best) {
        const bulou6Row = targetStartRow + 5;
        clearSampleZoneRow(bulou6Row, "front");
        sampleRowMeta[bulou6Row] = { label: '混合模式', title: '混合模式 — 连续+等差混合' };
        for (const number of best) {
          const existingBall = getCell(bulou6Row, "front", number)?.querySelector(".ball");
          const baseBall = existingBall ? getBallData(existingBall) : null;
          addBall(bulou6Row, "front", number, pad(number), samplePurpleColor, false);
          markSampleBall(bulou6Row, "front", number, baseBall);
          added.push({ row: bulou6Row, zone: "front", number, label: pad(number), color: samplePurpleColor });
        }
      }
    } else if (c6Scored.length > 0) {
      // 不足5个时直接取可用的
      const nums = c6Scored.slice(0, Math.min(5, c6Scored.length)).map(e => e.number).sort((a, b) => a - b);
      const bulou6Row = targetStartRow + 5;
      clearSampleZoneRow(bulou6Row, "front");
      sampleRowMeta[bulou6Row] = { label: '混合模式', title: '混合模式 — 连续+等差混合' };
      for (const number of nums) {
        const existingBall = getCell(bulou6Row, "front", number)?.querySelector(".ball");
        const baseBall = existingBall ? getBallData(existingBall) : null;
        addBall(bulou6Row, "front", number, pad(number), samplePurpleColor, false);
        markSampleBall(bulou6Row, "front", number, baseBall);
        added.push({ row: bulou6Row, zone: "front", number, label: pad(number), color: samplePurpleColor });
      }
    }
    // 🆕 基于尾号转移模式分析生成第7注
    {
      const transRow = targetStartRow + 6;
      const srcTails = selectedNumbers.map(n => n % 10);
      
      // 从转移数据中提取每个源尾号的高频目标尾号
      const tailTransferScores = new Map(); // tail → score
      for (let t = 0; t <= 9; t++) tailTransferScores.set(t, 0);
      
      // ① 转移频率评分
      if (tailTransData && tailTransData.transFreq) {
        const { transFreq, tailFreq } = tailTransData;
        for (const st of srcTails) {
          for (let tt = 0; tt <= 9; tt++) {
            const key = `${st}→${tt}`;
            const count = transFreq.get(key) || 0;
            tailTransferScores.set(tt, tailTransferScores.get(tt) + count * 3);
          }
        }
        for (let t = 0; t <= 9; t++) {
          const globalFreq = tailFreq.get(t) || 0;
          tailTransferScores.set(t, tailTransferScores.get(t) + globalFreq);
        }
      }
      
      // ② 混合模式评分：连续三元组 + 等差三元组
      if (tailCorrelationData) {
        // 连续三元组加分
        if (tailCorrelationData.consecutiveTripletFreq) {
          for (const [pattern, count] of tailCorrelationData.consecutiveTripletFreq) {
            if (count < 2) continue;
            const patternTails = pattern.split(',').map(Number);
            // 如果源尾号中有该模式的任意一个尾号，给其他尾号加分
            const hasSrc = patternTails.some(t => srcTails.includes(t));
            if (hasSrc) {
              for (const t of patternTails) {
                if (!srcTails.includes(t)) {
                  tailTransferScores.set(t, tailTransferScores.get(t) + count * 2);
                }
              }
            }
          }
        }
        // 等差三元组加分
        if (tailCorrelationData.arithmeticTripletFreq) {
          for (const [pattern, count] of tailCorrelationData.arithmeticTripletFreq) {
            if (count < 2) continue;
            const patternTails = pattern.split(',').map(Number);
            const hasSrc = patternTails.some(t => srcTails.includes(t));
            if (hasSrc) {
              for (const t of patternTails) {
                if (!srcTails.includes(t)) {
                  tailTransferScores.set(t, tailTransferScores.get(t) + count * 2);
                }
              }
            }
          }
        }
        // 混合模式加分
        if (tailCorrelationData.mixedPatternFreq) {
          for (const [pattern, count] of tailCorrelationData.mixedPatternFreq) {
            if (count < 2) continue;
            const patternTails = pattern.split(',').map(Number);
            const hasSrc = patternTails.some(t => srcTails.includes(t));
            if (hasSrc) {
              for (const t of patternTails) {
                if (!srcTails.includes(t)) {
                  tailTransferScores.set(t, tailTransferScores.get(t) + count * 1.5);
                }
              }
            }
          }
        }
      }
      
      // 排序获取高频转移尾号
      const sortedTransferTails = [...tailTransferScores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([t]) => t);
      
      const transferTailSet = new Set(sortedTransferTails);
      
      // 从候选池中选择匹配转移尾号的号码
      const transCombo = [];
      const poolToUse = tailEntries.length > 0 ? tailEntries : tailPool.map(n => ({ number: n, score: 0 }));
      for (const entry of poolToUse) {
        if (transCombo.length >= 5) break;
        const tail = entry.number % 10;
        if (transferTailSet.has(tail)) {
          transCombo.push(entry.number);
          transferTailSet.delete(tail);
        }
      }
      // 不够5个则从候选池中补充
      if (transCombo.length < 5) {
        for (const entry of poolToUse) {
          if (transCombo.length >= 5) break;
          if (!transCombo.includes(entry.number)) transCombo.push(entry.number);
        }
      }
      // 仍不够则从1-35中补充
      if (transCombo.length < 5) {
        for (let n = 1; n <= 35 && transCombo.length < 5; n++) {
          if (!transCombo.includes(n)) transCombo.push(n);
        }
      }
      transCombo.sort((a, b) => a - b);
      
      clearSampleZoneRow(transRow, "front");
      sampleRowMeta[transRow] = { label: '转移+混合', title: `转移+混合模式 — 融合转移频率+连续+等差+混合模式 (${sortedTransferTails.join(',')})` };
      for (const number of transCombo.slice(0, 5)) {
        const existingBall = getCell(transRow, "front", number)?.querySelector(".ball");
        const baseBall = existingBall ? getBallData(existingBall) : null;
        addBall(transRow, "front", number, pad(number), samplePurpleColor, false);
        markSampleBall(transRow, "front", number, baseBall);
        added.push({ row: transRow, zone: "front", number, label: pad(number), color: samplePurpleColor });
      }
      // 后区
      clearSampleZoneRow(transRow, "back");
      let backNums = [];
      if (backCombos.length > 0) {
        const backCombo = backCombos[Math.floor(Math.random() * backCombos.length)];
        backNums = backCombo.numbers.slice(0, 2);
      } else {
        while (backNums.length < 2) {
          const num = Math.floor(Math.random() * 12) + 1;
          if (!backNums.includes(num)) backNums.push(num);
        }
      }
      for (const number of backNums) {
        const existingBall = getCell(transRow, "back", number)?.querySelector(".ball");
        const baseBall = existingBall ? getBallData(existingBall) : null;
        addBall(transRow, "back", number, pad(number), samplePurpleColor, false);
        markSampleBall(transRow, "back", number, baseBall);
        added.push({ row: transRow, zone: "back", number, label: pad(number), color: samplePurpleColor });
      }
    }
    
    // 🆕 基于桥接模式生成第8注
    {
      const bridgeRow = targetStartRow + 7;
      const srcTails = selectedNumbers.map(n => n % 10);
      const bridgeTailsResult = getBridgeTails(srcTails, 3);
      
      // 桥接尾号评分
      const bridgeTailScores = new Map();
      for (let t = 0; t <= 9; t++) bridgeTailScores.set(t, 0);
      for (const t of bridgeTailsResult) {
        bridgeTailScores.set(t, bridgeTailScores.get(t) + 20);
      }
      if (tailTransData && tailTransData.tailFreq) {
        for (let t = 0; t <= 9; t++) {
          const freq = tailTransData.tailFreq.get(t) || 0;
          bridgeTailScores.set(t, bridgeTailScores.get(t) + freq);
        }
      }
      const sortedBridgeTails = [...bridgeTailScores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([t]) => t);
      
      const bridgeTailSet = new Set(sortedBridgeTails);
      
      // 从候选池中选择匹配桥接尾号的号码
      const bridgeCombo = [];
      const poolToUse = tailEntries.length > 0 ? tailEntries : tailPool.map(n => ({ number: n, score: 0 }));
      for (const entry of poolToUse) {
        if (bridgeCombo.length >= 5) break;
        const tail = entry.number % 10;
        if (bridgeTailSet.has(tail)) {
          bridgeCombo.push(entry.number);
          bridgeTailSet.delete(tail);
        }
      }
      // 不够5个则从候选池中补充
      if (bridgeCombo.length < 5) {
        for (const entry of poolToUse) {
          if (bridgeCombo.length >= 5) break;
          if (!bridgeCombo.includes(entry.number)) bridgeCombo.push(entry.number);
        }
      }
      // 仍不够则从1-35中补充
      if (bridgeCombo.length < 5) {
        for (let n = 1; n <= 35 && bridgeCombo.length < 5; n++) {
          if (!bridgeCombo.includes(n)) bridgeCombo.push(n);
        }
      }
      bridgeCombo.sort((a, b) => a - b);
      
      clearSampleZoneRow(bridgeRow, "front");
      sampleRowMeta[bridgeRow] = { label: '桥接', title: `桥接模式 — 填充源尾号(${srcTails.join(',')})间隔尾号 (${sortedBridgeTails.join(',')})` };
      for (const number of bridgeCombo.slice(0, 5)) {
        const existingBall = getCell(bridgeRow, "front", number)?.querySelector(".ball");
        const baseBall = existingBall ? getBallData(existingBall) : null;
        addBall(bridgeRow, "front", number, pad(number), samplePurpleColor, false);
        markSampleBall(bridgeRow, "front", number, baseBall);
        added.push({ row: bridgeRow, zone: "front", number, label: pad(number), color: samplePurpleColor });
      }
      // 后区
      clearSampleZoneRow(bridgeRow, "back");
      let backNums = [];
      if (backCombos.length > 0) {
        const backCombo = backCombos[Math.floor(Math.random() * backCombos.length)];
        backNums = backCombo.numbers.slice(0, 2);
      } else {
        while (backNums.length < 2) {
          const num = Math.floor(Math.random() * 12) + 1;
          if (!backNums.includes(num)) backNums.push(num);
        }
      }
      for (const number of backNums) {
        const existingBall = getCell(bridgeRow, "back", number)?.querySelector(".ball");
        const baseBall = existingBall ? getBallData(existingBall) : null;
        addBall(bridgeRow, "back", number, pad(number), samplePurpleColor, false);
        markSampleBall(bridgeRow, "back", number, baseBall);
        added.push({ row: bridgeRow, zone: "back", number, label: pad(number), color: samplePurpleColor });
      }
    }
    
    // 🆕 在主选号区第31行显示候选号码池（紫球）
    const poolRow = 31;
    clearSampleZoneRow(poolRow, "front");
    sampleRowMeta[poolRow] = { label: '候选池', title: `尾号候选池 (${tailPool.length}球)` };
    for (const number of tailPool) {
      const existingBall = getCell(poolRow, "front", number)?.querySelector(".ball");
      const baseBall = existingBall ? getBallData(existingBall) : null;
      addBall(poolRow, "front", number, pad(number), samplePurpleColor, false);
      markSampleBall(poolRow, "front", number, baseBall);
      added.push({ row: poolRow, zone: "front", number, label: pad(number), color: samplePurpleColor });
    }
    
    // 🆕 更新预测显示
    updatePredictionDisplay(predictedTails, ivPrediction, firstBallPredictions, sourceRow, selectedNumbers);
    
    updateRowLabels();
    addHistory("尾号生成示例", added);
    persistDraft();
    return;
  }
  
  let frontSample;
  if (version === "v4") {
    frontSample = buildSampleNumbersV4(sourceStartRow, "front", ratioPlan);
    // 🆕 V4并集池合并：第二个源行（偏移1期）
    const UNION_SECOND_OFFSET = 1;
    const secondSourceRow = sourceStartRow - UNION_SECOND_OFFSET;
    if (secondSourceRow >= 1 && secondSourceRow <= drawRows && secondSourceRow !== sourceStartRow) {
      const frontSample2 = buildSampleNumbersV4(secondSourceRow, "front", ratioPlan);
      const W1 = 0.7, W2 = 0.3;
      const scoreMap = new Map();
      frontSample.candidateEntries.forEach(e => scoreMap.set(e.number, (scoreMap.get(e.number) || 0) + e.score * W1));
      frontSample2.candidateEntries.forEach(e => scoreMap.set(e.number, (scoreMap.get(e.number) || 0) + e.score * W2));
      const mergedEntries = [...scoreMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, V4_POOL_SIZE)
        .map(([num, score], i) => {
          const o = frontSample.candidateEntries.find(e => e.number === num)
            || frontSample2.candidateEntries.find(e => e.number === num)
            || {};
          return {
            number: num, score, baseScore: score, rank: i + 1,
            selectedTailHits: o.selectedTailHits || 0, selectedTailNeighborHits: o.selectedTailNeighborHits || 0,
            tailCount: o.tailCount || 0, lastRowTailHits: o.lastRowTailHits || 0,
            tailPatternScore: o.tailPatternScore || 0, upperColorHits: o.upperColorHits || 0,
            upperColorTailHits: o.upperColorTailHits || 0, upperColorTailNeighborHits: o.upperColorTailNeighborHits || 0,
            hits: o.hits || 0, bridgeEndpointHits: o.bridgeEndpointHits || 0,
            arithmeticEndpointHits: o.arithmeticEndpointHits || 0, arithmeticScore: o.arithmeticScore || 0,
            integrityBonus: o.integrityBonus || 0, templateHits: o.templateHits || 0,
            sameRowSupport: o.sameRowSupport || 0, plusTenScore: o.plusTenScore || 0,
            plusTenNeighborScore: o.plusTenNeighborScore || 0, farOffsetCount: o.farOffsetCount || 0,
            anchorKeepPenalty: o.anchorKeepPenalty || 0, transformedCount: o.transformedCount || 0,
          };
        });
      frontSample.candidateEntries = mergedEntries;
      frontSample.candidates = mergedEntries.map(e => e.number);
      frontSample.numbers = mergedEntries.slice(0, 5).map(e => e.number);
      // 合并参考行
      frontSample.referenceRows = [...new Set([
        ...frontSample.referenceRows, ...frontSample2.referenceRows
      ])].sort((a, b) => a - b);
      // 合并预测尾号（加权去重）
      if (frontSample.predictedTails || frontSample2.predictedTails) {
        const tailMap = new Map();
        (frontSample.predictedTails || []).forEach(([t, s]) => tailMap.set(t, (tailMap.get(t) || 0) + s * W1));
        (frontSample2.predictedTails || []).forEach(([t, s]) => tailMap.set(t, (tailMap.get(t) || 0) + s * W2));
        frontSample.predictedTails = [...tailMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);
      }
      console.log("[V4并集池] 主行" + sourceStartRow + " + 辅行" + secondSourceRow
        + " → 合并池" + mergedEntries.length + "球 (权重" + W1 + ":" + W2 + ")");
    }
  } else {
    frontSample = buildSampleNumbers(sourceStartRow, "front", ratioPlan);
  }
  const backSample = buildSampleNumbers(sourceStartRow, "back");
  // v4 走完整管线：池生成 → 组合评分(S4/S7/S8/S9/S10/S5-S6) → 多样性选择
  const isV4 = version === "v4";
  const v4Refs = isV4 && Array.isArray(frontSample.referenceRows) ? frontSample.referenceRows : [];
  // v4 首位球预测（组合评分 + 补漏6需要）
  const firstBallPreds = isV4
    ? predictFirstBallComprehensive(getSampleSourceWindow(sourceStartRow).selectedRow, collectBalls())
    : null;
  // 🔍 调试：输出区间比选择状态
  console.log("[区间比调试] version:", version, "isV4:", isV4);
  console.log("[区间比调试] ratioPlan:", JSON.stringify(ratioPlan));
  console.log("[区间比调试] sampleRatioModeInput.value:", sampleRatioModeInput?.value);
  
  const frontCombos = isV4
    ? buildSampleFrontCombosV5(frontSample.candidateEntries, v4Refs, frontSample.selectedNumbers, frontSample.selectedNumbers, frontSample.predictedTails || null, frontSample.ivPrediction || null, firstBallPreds, frontSample.extremeFlags || null, ratioPlan, sourceStartRow)
    : buildSampleFrontCombos(frontSample.candidateEntries, ratioPlan, samplePickCount, sampleIntervals, frontSample.ratioSupportMap, frontSample.referenceRows, frontRepeatTarget, frontSample.selectedNumbers, frontSample.selectedNumbers);
  let backCombos = buildSampleFreeCombos(backSample.candidateEntries, sampleBackPickCount, backRepeatTarget, backSample.selectedNumbers);
  // 🆕 后区桥接组合优先插入到最前面
  const backBridgeNums = generateBackBridgeCombos(sourceStartRow, collectBalls());
  const bridgeCombos = backBridgeNums
    .filter(nums => !backCombos.some(c => c.key === nums.join("-")))
    .map(nums => ({ numbers: nums, key: nums.join("-"), score: 999, ratioText: "桥接" }));
  backCombos = [...bridgeCombos, ...backCombos];
  
  // 🔍 调试：输出生成的组合区间比分布
  const comboRatios = frontCombos.map((c) => c.ratioKey || c.ratioText || "unknown");
  console.log("[区间比调试] 生成的组合数:", frontCombos.length, "区间比分布:", comboRatios.slice(0, 10));
  
  // 获取候选池号码用于覆盖优化和显示
  const poolNumbers = isV4 ? frontSample.candidates : [];
  
  const variantPlan = isV4
    ? buildV4SingleSamplePlan(frontCombos, backCombos, poolNumbers, frontSample.candidateEntries, frontSample.predictedTails || null, firstBallPreds)
    : (displayMode === "variants"
        ? buildSampleVariantPlan(frontCombos, backCombos, sampleRotationCursor)
        : buildSingleSamplePlan(frontCombos, backCombos, ratioPlan, sampleRotationCursor));
  
  // 显示候选池
  if (isV4 && poolNumbers.length > 0) {
    renderPoolDisplay(poolNumbers, frontSample.candidateEntries);
  } else {
    hidePoolDisplay();
  }
  const sampleGroupCount = variantPlan.length;
  const targetStartRow = clamp(requestedRow, 1, Math.max(1, rows - sampleGroupCount + 1));
  sampleSourceRow = sourceStartRow;
  sampleRotationCursor += 1;
  clearAllSampleBalls();
  sampleRowMeta = {};

  for (let offset = 0; offset < sampleGroupCount; offset += 1) {
    const variant = variantPlan[offset];
    if (!variant) continue;
    const targetRow = targetStartRow + offset;
    const frontNumbers = variant.front?.numbers || [];
    const backNumbers = variant.back?.numbers || [];
    sampleRowMeta[targetRow] = {
      label: variant.label,
      title: `${variant.title}，源行 ${sourceStartRow}`,
    };

    clearSampleZoneRow(targetRow, "front");
    for (const number of frontNumbers) {
      const existingBall = getCell(targetRow, "front", number)?.querySelector(".ball");
      const baseBall = existingBall ? getBallData(existingBall) : null;
      addBall(targetRow, "front", number, pad(number), samplePurpleColor, false);
      markSampleBall(targetRow, "front", number, baseBall);
      added.push({ row: targetRow, zone: "front", number, label: pad(number), color: samplePurpleColor });
    }

    clearSampleZoneRow(targetRow, "back");
    for (const number of backNumbers) {
      const existingBall = getCell(targetRow, "back", number)?.querySelector(".ball");
      const baseBall = existingBall ? getBallData(existingBall) : null;
      addBall(targetRow, "back", number, pad(number), samplePurpleColor, false);
      markSampleBall(targetRow, "back", number, baseBall);
      added.push({ row: targetRow, zone: "back", number, label: pad(number), color: samplePurpleColor });
    }
  }

  // 🆕 在主选号区第31行显示候选号码池（紫球）
  if (isV4 && poolNumbers.length > 0) {
    const poolRow = 31;
    clearSampleZoneRow(poolRow, "front");
    sampleRowMeta[poolRow] = { label: '候选池', title: `候选号码池 (${poolNumbers.length}球)` };
    for (const number of poolNumbers) {
      const existingBall = getCell(poolRow, "front", number)?.querySelector(".ball");
      const baseBall = existingBall ? getBallData(existingBall) : null;
      addBall(poolRow, "front", number, pad(number), samplePurpleColor, false);
      markSampleBall(poolRow, "front", number, baseBall);
      added.push({ row: poolRow, zone: "front", number, label: pad(number), color: samplePurpleColor });
    }
  }

  if (added.length === 0) return;
  
  // 保存当前示例数据用于导出Excel
  currentSampleData = {
    variantPlan: variantPlan.slice(0, 5), // 只取前五组
    sourceStartRow: sourceStartRow,
    targetStartRow: targetStartRow,
    poolNumbers: poolNumbers,
    isV4: isV4,
    added: added
  };
  
  // 显示导出Excel按钮
  if (exportSampleExcelButton) {
    exportSampleExcelButton.style.display = 'inline-block';
  }
  
  // 🆕 更新预测显示
  if (isV4) {
    const sourceWindow = getSampleSourceWindow(sourceStartRow);
    const sourceRow = sourceWindow.selectedRow;
    const allBalls = collectBalls();
    const selectedRowBalls = allBalls.filter((b) => b.zone === "front" && b.row === sourceRow && ballHasColor(b, sampleRedColor));
    const selectedNumbers = getUniqueSortedSampleNumbers(selectedRowBalls.map((b) => b.number));
    
    const predictedTails = frontSample.predictedTails || null;
    const ivPrediction = frontSample.ivPrediction || null;
    const firstBallPredictions = firstBallPreds || null;
    
    updatePredictionDisplay(predictedTails, ivPrediction, firstBallPredictions, sourceRow, selectedNumbers);
  } else {
    clearPredictionDisplay();
  }
  
  updateRowLabels();
  addHistory("生成示例", added);
  persistDraft();
});

clearSampleButton?.addEventListener("click", () => {
  clearAllSampleBalls();
  sampleRowMeta = {};
  updateRowLabels();
  persistDraft();
  
  // 🆕 重置尾号选择器
  selectedTails.clear();
  document.querySelectorAll(".tail-btn").forEach((btn) => btn.classList.remove("active"));
  updateTailPoolInfo();
  
  // 🆕 清空预测显示
  clearPredictionDisplay();
  
  // 隐藏导出Excel按钮并清空示例数据
  if (exportSampleExcelButton) {
    exportSampleExcelButton.style.display = 'none';
  }
  currentSampleData = null;
});

// 🆕 刷新预测按钮
refreshPredictionButton?.addEventListener("click", () => {
  const allBalls = collectBalls();
  if (allBalls.length === 0) {
    clearPredictionDisplay();
    return;
  }
  
  // 获取当前选中行的号码
  const sourceRow = clamp(rowInput?.value || 1, 1, rows);
  const sourceColor = sampleRedColor;
  const selectedRowBalls = allBalls.filter(
    (b) => b.zone === "front" && b.row === sourceRow && ballHasColor(b, sourceColor)
  );
  const selectedNumbers = [...new Set(selectedRowBalls.map((b) => b.number))].sort((a, b) => a - b);
  
  if (selectedNumbers.length === 0) {
    // 尝试获取最近一行有数据的
    let fallbackRow = sourceRow;
    let fallbackNumbers = [];
    for (let r = sourceRow; r >= Math.max(1, sourceRow - 10); r--) {
      const balls = allBalls.filter(
        (b) => b.zone === "front" && b.row === r && ballHasColor(b, sourceColor)
      );
      const nums = [...new Set(balls.map((b) => b.number))].sort((a, b) => a - b);
      if (nums.length === 5) {
        fallbackRow = r;
        fallbackNumbers = nums;
        break;
      }
    }
    
    if (fallbackNumbers.length === 0) {
      clearPredictionDisplay();
      return;
    }
    
    // 使用回退行数据进行预测
    const tailTransData = analyzeTailTransitionsV4(fallbackRow, 50, allBalls);
    const sourceTails = fallbackNumbers.map(n => n % 10);
    const refRows = buildV4FullReferenceRows(fallbackRow, allBalls);
    const predictedTails = predictLikelyTailsV4Enhanced(sourceTails, tailTransData, refRows, fallbackRow, allBalls);
    const firstBallPredictions = predictFirstBallComprehensive(fallbackRow, allBalls);
    const sourceIv = intervalRatio(fallbackNumbers);
    const ivPrediction = predictTargetIntervalRatio(fallbackRow, sourceIv, allBalls);
    
    updatePredictionDisplay(predictedTails, ivPrediction, firstBallPredictions, fallbackRow, fallbackNumbers);
    return;
  }
  
  // 使用当前行数据进行预测
  const sourceTails = selectedNumbers.map(n => n % 10);
  const tailTransData = analyzeTailTransitionsV4(sourceRow, 50, allBalls);
  const refRows = buildV4FullReferenceRows(sourceRow, allBalls);
  const predictedTails = predictLikelyTailsV4Enhanced(sourceTails, tailTransData, refRows, sourceRow, allBalls);
  const firstBallPredictions = predictFirstBallComprehensive(sourceRow, allBalls);
  const sourceIv = intervalRatio(selectedNumbers);
  const ivPrediction = predictTargetIntervalRatio(sourceRow, sourceIv, allBalls);
  
  updatePredictionDisplay(predictedTails, ivPrediction, firstBallPredictions, sourceRow, selectedNumbers);
});

// 🆕 模式回测对比按钮
document.querySelector("#backtestTailModesBtn")?.addEventListener("click", () => {
  const allBalls = collectBalls();
  if (!allBalls || allBalls.length === 0) {
    alert("没有开奖数据，无法进行回测");
    return;
  }
  
  // 回测范围：最近100期（排除最近1期，因为需要有实际数据对比）
  const endRow = Math.max(1, rows - 1);
  const startRow = Math.max(1, endRow - 99);
  
  const container = document.querySelector("#tailModeBacktest");
  if (container) container.innerHTML = '<span style="color:#6366f1;font-size:12px;">回测中，请稍候...</span>';
  
  // 使用setTimeout让UI先更新
  setTimeout(() => {
    const result = backtestTailModes(startRow, endRow);
    if (result) {
      renderBacktestResults(result);
    } else {
      if (container) container.innerHTML = '<span style="color:#ef4444;font-size:12px;">回测失败：数据不足</span>';
    }
  }, 50);
});

// 导出Excel功能
exportSampleExcelButton?.addEventListener("click", () => {
  if (!currentSampleData || !currentSampleData.variantPlan || currentSampleData.variantPlan.length === 0) {
    alert("没有可导出的示例数据，请先生成示例");
    return;
  }
  
  exportSampleToExcel(currentSampleData);
});

saveHistoryButton?.addEventListener("click", () => addHistory("保存记录", collectBalls()));
saveVersionButton.addEventListener("click", saveVersion);
captureBoardButton?.addEventListener("click", captureBoard);
drawFileInput?.addEventListener("change", handleDrawFileImport);
generateDrawVersionButton.addEventListener("click", generateDrawVersion);

unlockAppButton.addEventListener("click", () => {
  if (passwordMatches(appPassword.value, pagePasswordValue)) {
    sessionStorage.setItem(pageAuthStorageKey, "true");
    appPassword.value = "";
    unlockPage();
    return;
  }
  appAuthMessage.textContent = "密码错误，请重新输入。";
  appPassword.select();
});

toggleAppPasswordButton.addEventListener("click", () => {
  const showing = appPassword.type === "text";
  appPassword.type = showing ? "password" : "text";
  toggleAppPasswordButton.textContent = showing ? "显示" : "隐藏";
});

appPassword.addEventListener("keydown", (event) => {
  if (event.key === "Enter") unlockAppButton.click();
});

unlockVersionsButton.addEventListener("click", () => {
  if (passwordMatches(versionPassword.value, versionPasswordValue)) {
    versionsUnlocked = true;
    sessionStorage.setItem(versionAuthStorageKey, "true");
    versionPassword.value = "";
    renderVersions();
    return;
  }
  versionAuthMessage.textContent = "密码错误，请重新输入。";
  versionPassword.select();
});

versionPassword.addEventListener("keydown", (event) => {
  if (event.key === "Enter") unlockVersionsButton.click();
});

lockVersionsButton.addEventListener("click", () => {
  versionsUnlocked = false;
  sessionStorage.removeItem(versionAuthStorageKey);
  renderVersions();
});

closeVersionModalButton.addEventListener("click", () => {
  versionModal.hidden = true;
});

closeCompareModalButton.addEventListener("click", () => {
  compareModal.hidden = true;
});

versionModal.addEventListener("click", (event) => {
  if (event.target === versionModal) versionModal.hidden = true;
});

compareModal.addEventListener("click", (event) => {
  if (event.target === compareModal) compareModal.hidden = true;
});

compareVersionsButton?.addEventListener("click", openCompareModal);
applyCompareButton?.addEventListener("click", applyCompareView);

clearHistoryButton?.addEventListener("click", () => {
  history = [];
  writeStorage(historyStorageKey, history);
  renderHistory();
});

clearVersionsButton.addEventListener("click", () => {
  versions = [];
  currentBaseTitle = "";
  editingDrawVersionId = "";
  compareSourceVersionId = "";
  versionSearch.value = "";
  writeStorage(versionStorageKey, versions);
  updateBaseLabel();
  updateVersionBanner();
  resetDrawEditMode();
  renderVersions();
  versionPreviewTitle.textContent = "未选择版本";
  versionPreview.innerHTML = "";
});

versionSearch.addEventListener("input", renderVersions);

zoneInput.addEventListener("change", () => {
  const zone = zoneInput.value;
  numberInput.max = zones[zone].max;
  numberInput.value = clamp(numberInput.value, 1, zones[zone].max);
});

rowInput.addEventListener("input", syncSelectedRowFromInput);
rowInput.addEventListener("change", syncSelectedRowFromInput);

sizeInput.addEventListener("input", () => {
  document.documentElement.style.setProperty("--ball-size", `${sizeInput.value}px`);
});

zoomInput.addEventListener("input", () => {
  userAdjustedZoom = true;
  document.documentElement.style.setProperty("--board-zoom", `${zoomInput.value / 100}`);
});

colorInput.addEventListener("input", () => {
  swatches.forEach((swatch) => swatch.classList.remove("active"));
});

swatches.forEach((swatch) => {
  swatch.addEventListener("click", () => setColor(swatch.dataset.color));
});

dockButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveDockBySelector(button.dataset.target);
    scrollToPanel(button.dataset.target);
  });
});

jumpButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const targetSelector = button.dataset.target || "";
    setActiveDockBySelector(targetSelector);
    scrollToPanel(targetSelector);
  });
});

installAppButton?.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    updateInstallUI();
    return;
  }
  deferredInstallPrompt.prompt();
  try {
    await deferredInstallPrompt.userChoice;
  } catch {}
  deferredInstallPrompt = null;
  updateInstallUI();
});

globalThis.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallUI();
});

globalThis.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  updateDisplayModeBadge();
  updateInstallUI();
});

globalThis.addEventListener("online", updateNetworkBadge);
globalThis.addEventListener("offline", updateNetworkBadge);
globalThis.addEventListener("scroll", syncVisiblePanel, { passive: true });
globalThis.addEventListener("resize", () => {
  updateDisplayModeBadge();
  syncVisiblePanel();
});

buildBoard();
restoreDraft();
updateRowLabels();
setSelectedRow(selectedRowValue);
updateVersionBanner();
updateCount();
renderHistory();
renderVersions();
updateDisplayModeBadge();
updateNetworkBadge();
updateInstallUI();
setActiveDockBySelector("#agentBoardPanel");
function getDefaultCompareSelection(sourceVersionId = "") {
  const availableVersions = versions.slice();
  if (availableVersions.length < 2) return ["", "", ""];
  if (!sourceVersionId) {
    return [
      availableVersions[1]?.id || availableVersions[0]?.id || "",
      availableVersions[0]?.id || "",
      availableVersions[2]?.id || "",
    ];
  }

  const sourceIndex = availableVersions.findIndex((version) => version.id === sourceVersionId);
  if (sourceIndex < 0) {
    return [
      availableVersions[1]?.id || availableVersions[0]?.id || "",
      availableVersions[0]?.id || "",
      availableVersions[2]?.id || "",
    ];
  }

  const previousVersion = availableVersions[sourceIndex + 1] || availableVersions[sourceIndex];
  const currentVersion = availableVersions[sourceIndex];
  const nextVersion = availableVersions[sourceIndex - 1] || null;
  return [previousVersion?.id || "", currentVersion?.id || "", nextVersion?.id || ""];
}

populateCompareSelects = function populateCompareSelectsOverride() {
  const selects = [compareVersionOne, compareVersionTwo, compareVersionThree];
  const availableVersions = versions.slice();
  const defaults = getDefaultCompareSelection(compareSourceVersionId);

  selects.forEach((select, index) => {
    if (!select) return;
    const previous = activeCompareSelection[index] || select.value || defaults[index] || "";
    select.innerHTML = "";

    if (index === 2) {
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "不选择第三个版本";
      select.append(emptyOption);
    }

    availableVersions.forEach((version) => {
      const option = document.createElement("option");
      option.value = version.id;
      option.textContent = getVersionLabel(version);
      select.append(option);
    });

    const fallback = defaults[index] || (index === 2 ? "" : availableVersions[index]?.id || availableVersions[0]?.id || "");
    select.value = availableVersions.some((version) => version.id === previous) ? previous : fallback;
  });

  if (availableVersions.length < 3 && compareVersionThree) {
    compareVersionThree.value = "";
  }

  activeCompareSelection = selects.map((select) => select?.value || "");
};

function openComparePageFromVersionPanel(sourceVersionId = "") {
  if (!versionsUnlocked) {
    versionAuthMessage.textContent = "请先输入密码验证，再进入180行对比页。";
    return;
  }
  if (versions.length < 6) {
    versionAuthMessage.textContent = "至少需要 6 个版本才能进入180行对比页。";
    return;
  }
  compareSourceVersionId = sourceVersionId;
  const defaults = getDefaultCompareSelection(sourceVersionId);
  goToComparePage(sourceVersionId, defaults);
}

function saveCompareAsVersion() {
  const selectedIds = [compareVersionOne.value, compareVersionTwo.value, compareVersionThree.value].filter(Boolean);
  activeCompareSelection = selectedIds;
  const selectedVersions = selectedIds.map(getVersionById);
  if (selectedVersions.length < 2 || selectedVersions.some((version) => !version)) {
    compareHint.textContent = "请至少选择 2 个有效版本后再保存。";
    return;
  }

  const { compareBalls, compareRows, compareSplitRows } = buildCompareBalls(selectedVersions);
  const compareTitle = `对比图：${selectedVersions.map((version) => version.title || "历史版本").join(" / ")}`;
  applyBalls(compareBalls, {
    baseTitle: compareTitle,
    rowIssues: compareRows,
    protectBalls: true,
    compareSplitRows,
  });
  const version = saveCurrentBoardAsVersion(compareTitle);
  compareHint.textContent = `对比图已保存为版本：${version.title}`;
  compareModal.hidden = true;
}

renderVersions = function renderVersionsOverride() {
  document.querySelector(".version-shell").classList.toggle("locked", !versionsUnlocked);
  versionSearch.disabled = !versionsUnlocked;
  downloadVersionsButton.disabled = !versionsUnlocked || versions.length === 0;
  importVersionsInput.disabled = !versionsUnlocked;
  clearVersionsButton.disabled = !versionsUnlocked;
  compareVersionsButton.disabled = !versionsUnlocked || versions.length < 2;
  lockVersionsButton.hidden = !versionsUnlocked;
  unlockVersionsButton.hidden = versionsUnlocked;
  versionPassword.hidden = versionsUnlocked;

  if (!versionsUnlocked) {
    versionList.innerHTML = `<li class="history-empty">验证后显示历史版本</li>`;
    versionPreviewTitle.textContent = "未验证";
    versionPreview.innerHTML = "";
    versionAuthMessage.textContent = "请输入密码后查看历史版本。";
    return;
  }

  versionAuthMessage.textContent = `已验证。${localVersionNotice}历史版本是冻结快照，点击“在此基础上调整”只会复制到当前编辑区。`;
  const query = versionSearch.value.trim();
  const matchedVersions = versions.filter((version) => versionMatches(version, query));
  versionList.innerHTML = "";

  if (matchedVersions.length === 0) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = query ? "没有匹配的历史版本" : "还没有历史版本";
    versionList.append(empty);
    return;
  }

  matchedVersions.forEach((version) => {
    const balls = cloneBalls(version.balls);
    const item = document.createElement("li");
    item.className = "version-item";

    const info = document.createElement("div");
    info.className = "version-info";
    info.innerHTML = `<strong>${version.title || "历史版本"}</strong><span>${balls.length} 个球</span>`;

    const summary = document.createElement("div");
    summary.className = "version-summary";
    if (balls.length === 0) {
      const empty = document.createElement("span");
      empty.className = "history-empty";
      empty.textContent = "此版本为空";
      summary.append(empty);
    } else {
      balls.slice(0, 10).forEach((ball) => summary.append(createChip(ball)));
      if (balls.length > 10) {
        const more = document.createElement("span");
        more.className = "version-more";
        more.textContent = `还有 ${balls.length - 10} 个球`;
        summary.append(more);
      }
    }

    const actions = document.createElement("div");
    actions.className = "version-actions";

    const viewButton = document.createElement("button");
    viewButton.type = "button";
    viewButton.textContent = "查看";
    viewButton.addEventListener("click", () => {
      showVersion(version.id);
      openVersionModal(version.id);
    });

    const restoreButton = document.createElement("button");
    restoreButton.type = "button";
    restoreButton.textContent = "在此基础上调整";
    restoreButton.addEventListener("click", () => {
      applyBalls(version.balls, {
        baseTitle: version.title || "历史版本",
        rowIssues: version.rowIssues,
        protectBalls: isDrawVersion(version),
        compareSplitRows: version.compareSplitRows || [],
        customDividerRows: version.customDividerRows || {},
      });
      showVersion(version.id);
      addHistory(`基于 ${version.title || "历史版本"} 调整`, version.balls);
    });

    const compareButton = document.createElement("button");
    compareButton.type = "button";
    compareButton.textContent = "对比图";
    compareButton.addEventListener("click", () => {
      showVersion(version.id);
      openCompareModal(version.id);
    });

    const downloadButton = document.createElement("button");
    downloadButton.type = "button";
    downloadButton.textContent = "下载";
    downloadButton.addEventListener("click", () => downloadVersionFile(version));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "删除";
    deleteButton.addEventListener("click", () => {
      versions = versions.filter((itemVersion) => itemVersion.id !== version.id);
      writeStorage(versionStorageKey, versions);
      renderVersions();
      versionPreviewTitle.textContent = "未选择版本";
      versionPreview.innerHTML = "";
    });

    actions.append(viewButton, restoreButton, compareButton, downloadButton, deleteButton);
    item.append(info, actions);
    versionList.append(item);
  });
};

saveCompareButton?.addEventListener("click", saveCompareAsVersion);
compareVersionsButton?.addEventListener("click", () => openCompareModal());
compareVersionsButton?.addEventListener(
  "click",
  (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    openCompareModal();
  },
  true,
);
versionSearch.addEventListener("input", () => renderVersions());
downloadVersionsButton.addEventListener("click", downloadVersionsFile);
importVersionsInput.addEventListener("change", async () => {
  const file = importVersionsInput.files?.[0];
  await importVersionsFile(file);
  importVersionsInput.value = "";
});
renderVersions();
sizeInput.value = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--ball-size"), 10);
fitBoardToScreen(true);
window.addEventListener("resize", () => fitBoardToScreen());
registerServiceWorker();
openComparePageButton?.addEventListener("click", () => goToComparePage());
openComparePageFromHome?.addEventListener("click", () => goToComparePage());
openCompare90PageButton?.addEventListener("click", () => goToCompare90Page());
openCompare90PageFromHome?.addEventListener("click", () => goToCompare90Page());
// 🆕 密码验证前隐藏生成示例按钮
if (sampleButton) sampleButton.style.display = 'none';

if (sessionStorage.getItem(pageAuthStorageKey) === "true") {
  unlockPage();
} else {
  syncVisiblePanel();
}

// 导出示例到Excel功能
function exportSampleToExcel(sampleData) {
  try {
    // 检查XLSX库是否可用
    if (typeof XLSX === 'undefined') {
      alert("Excel库未加载，请刷新页面后重试");
      return;
    }
    
    const { variantPlan, sourceStartRow } = sampleData;
    
    // 获取开奖号码（目标号码）
    const drawNumbers = getDrawNumbers(sourceStartRow);
    
    if (!drawNumbers) {
      alert("无法获取开奖号码数据");
      return;
    }
    
    const drawFrontSet = new Set(drawNumbers.front);
    const drawBackSet = new Set(drawNumbers.back);
    
    // 创建工作簿
    const wb = XLSX.utils.book_new();
    const data = [];
    
    // 标题行：组别 + 5个前区 + 2个后区 + 命中前区 + 命中后区 + 总命中
    data.push(["组别", "前区1", "前区2", "前区3", "前区4", "前区5", "后区1", "后区2", "命中前区", "命中后区", "总命中"]);
    
    // 开奖号码行
    data.push([
      "开奖号码",
      ...drawNumbers.front.slice(0, 5),
      ...drawNumbers.back.slice(0, 2),
      "", "", ""
    ]);
    
    // 前五组数据
    for (let i = 0; i < Math.min(5, variantPlan.length); i++) {
      const variant = variantPlan[i];
      const frontNumbers = (variant.front?.numbers || []).slice(0, 5);
      const backNumbers = (variant.back?.numbers || []).slice(0, 2);
      
      // 填满5个前区和2个后区
      while (frontNumbers.length < 5) frontNumbers.push("");
      while (backNumbers.length < 2) backNumbers.push("");
      
      // 计算命中
      const frontHits = frontNumbers.filter(n => n !== "" && drawFrontSet.has(n)).length;
      const backHits = backNumbers.filter(n => n !== "" && drawBackSet.has(n)).length;
      
      data.push([
        `第${i + 1}组`,
        ...frontNumbers,
        ...backNumbers,
        frontHits,
        backHits,
        frontHits + backHits
      ]);
    }
    
    // 候选池号码行
    const poolNumbers = sampleData.poolNumbers || [];
    if (poolNumbers.length > 0) {
      data.push([]);
      data.push(["候选池号码", ...poolNumbers.slice(0, 25)]);
    }
    
    // 创建工作表
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // 设置列宽
    ws['!cols'] = [
      { width: 10 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 },
      { width: 8 }, { width: 8 }, { width: 10 }, { width: 10 }, { width: 10 }
    ];
    
    // SheetJS社区版不支持cell.s样式，尝试应用（兼容Pro版本）
    try {
      applyHitStyles(ws, drawFrontSet, drawBackSet, variantPlan);
    } catch (e) {
      console.warn("样式设置需要SheetJS Pro版本，已跳过样式");
    }
    
    XLSX.utils.book_append_sheet(wb, ws, "示例对比");
    
    // 生成文件名
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    const fileName = `选号示例_${dateStr}_${timeStr}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
    
    // 同时保存JSON供Python脚本生成带样式版本
    try {
      const jsonData = {
        drawFront: drawNumbers.front,
        drawBack: drawNumbers.back,
        groups: variantPlan.slice(0, 5).map((v, i) => ({
          label: `第${i + 1}组`,
          front: (v.front?.numbers || []).slice(0, 5),
          back: (v.back?.numbers || []).slice(0, 2)
        })),
        poolNumbers: poolNumbers
      };
      const jsonBlob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      const jsonA = document.createElement('a');
      jsonA.href = jsonUrl;
      jsonA.download = 'sample_data.json';
      jsonA.click();
      URL.revokeObjectURL(jsonUrl);
    } catch (e) { /* JSON导出失败不影响主流程 */ }
    
    alert(`Excel文件已生成：${fileName}`);
    
  } catch (error) {
    console.error("导出Excel失败:", error);
    alert("导出Excel失败：" + error.message);
  }
}

// 获取开奖号码
function getDrawNumbers(row) {
  try {
    const allBalls = collectBalls();
    const rowBalls = allBalls.filter(ball => ball.row === row);
    
    if (rowBalls.length === 0) {
      // 尝试从内置数据获取
      const draws = typeof getBuiltInDrawData === 'function' ? getBuiltInDrawData() : [];
      const draw = draws.find(d => d.issue === rowIssues?.[row]);
      if (draw) return { front: draw.front, back: draw.back };
      return null;
    }
    
    const frontBalls = rowBalls.filter(ball => ball.zone === "front").map(ball => ball.number).sort((a, b) => a - b);
    const backBalls = rowBalls.filter(ball => ball.zone === "back").map(ball => ball.number).sort((a, b) => a - b);
    
    return { front: frontBalls, back: backBalls };
  } catch (error) {
    console.error("获取开奖号码失败:", error);
    return null;
  }
}

// 应用命中样式（仅在SheetJS Pro版本中生效）
function applyHitStyles(ws, drawFrontSet, drawBackSet, variantPlan) {
  for (let i = 0; i < Math.min(5, variantPlan.length); i++) {
    const variant = variantPlan[i];
    const frontNumbers = (variant.front?.numbers || []).slice(0, 5);
    const backNumbers = (variant.back?.numbers || []).slice(0, 2);
    const row = i + 2; // 0-based: row 0=header, row 1=draw, row 2+=groups
    
    for (let j = 0; j < 5; j++) {
      const addr = XLSX.utils.encode_cell({ r: row, c: j + 1 });
      if (ws[addr] && frontNumbers[j] && drawFrontSet.has(frontNumbers[j])) {
        ws[addr].s = {
          font: { color: { rgb: "FF0000" }, bold: true },
          fill: { patternType: 'solid', fgColor: { rgb: "FFFF00" } }
        };
      }
    }
    
    for (let j = 0; j < 2; j++) {
      const addr = XLSX.utils.encode_cell({ r: row, c: j + 6 });
      if (ws[addr] && backNumbers[j] && drawBackSet.has(backNumbers[j])) {
        ws[addr].s = {
          font: { color: { rgb: "FF0000" }, bold: true },
          fill: { patternType: 'solid', fgColor: { rgb: "FFFF00" } }
        };
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  Node.js 回测入口（完整复用 script.js 的 V4/V5 生成管线）
//  运行: node "script回测.js"
// ═══════════════════════════════════════════════════════════════════
if (__isNode) {
  const draws = getBuiltInDrawData();
  if (!draws || draws.length < 3) {
    console.error("数据不足，无法回测");
    process.exit(1);
  }
  
  console.log("=".repeat(90));
  console.log("script回测.js — 完整复用浏览器 V5 生成管线");
  console.log("=".repeat(90));
  console.log(`数据范围: ${draws[0].issue} ~ ${draws[draws.length - 1].issue} (共${draws.length}期)`);
  console.log(`可验证期数: ${draws.length - 2}期`);
  console.log("");
  
  const results = [];
  const totalDraws = draws.length;
  
  // 预测间隔配置：选中N期，预测N+10期（间隔10），可结合N+9期（间隔9）
  const PREDICT_INTERVAL = 6; // 预测间隔10后的期数
  const SECOND_INTERVAL = 9;   // 第二间隔9（用于并集池合并）
  
  // 重置随机种子（确保每次运行结果一致）
  if (typeof resetSeed === 'function') resetSeed();
  
  for (let sourceIdx = 1; sourceIdx <= totalDraws - PREDICT_INTERVAL - 1; sourceIdx++) {
    // 主源：N+9期（如2025110），辅源：N期（如2025101），目标：N+10期（如2025111）
    const mainSourceIdx = sourceIdx + SECOND_INTERVAL; // N+9期
    const auxSourceIdx = sourceIdx;                     // N期
    const targetIdx = sourceIdx + PREDICT_INTERVAL;     // N+10期
    
    const sourceDraw = draws[mainSourceIdx]; // 主源：N+9期
    const targetDraw = draws[targetIdx];     // 目标：N+10期
    if (!sourceDraw || !targetDraw) continue;
    
    const sourceNums = [...sourceDraw.front].sort((a, b) => a - b);
    const targetNums = [...targetDraw.front].sort((a, b) => a - b);
    const targetSet = new Set(targetNums);
    
    // sourceRow 在 allBalls 中的行号（1-based，draws[0]=row1）
    const sourceRow = mainSourceIdx + 1; // 主源行号
    
    try {
      // ─── 调用 script.js 的完整生成管线 ───
      // 1. V4 候选池生成（包含所有子预测：尾号、区间比、首位球、+10期趋势等）
      const ratioPlan = null; // 自动区间比
      let frontSample = buildSampleNumbersV4(sourceRow, "front", ratioPlan);
      
      // 2. V4 并集池合并（三个源：N期、N+9期、N+10期前的N-1期）
      const secondSourceRow = auxSourceIdx + 1; // N期
      const thirdSourceRow = auxSourceIdx;       // N-1期（更早的历史数据）
      
      
      // 收集所有候选源
      const sourceRows = [sourceRow]; // 主源
      
      // 间隔9的源
      const auxSource1Idx = sourceIdx + 8;
      const auxSource1Row = auxSource1Idx + 1;
      if (auxSource1Row >= 1 && auxSource1Row <= totalDraws && auxSource1Row !== sourceRow) {
        sourceRows.push(auxSource1Row);
      }
      // 间隔10的源
      const auxSource2Idx = sourceIdx + 9;
      const auxSource2Row = auxSource2Idx + 1;
      if (auxSource2Row >= 1 && auxSource2Row <= totalDraws && auxSource2Row !== sourceRow) {
        sourceRows.push(auxSource2Row);
      }
  
      
      // 生成所有源的候选池
      const allSamples = sourceRows.map(row => ({
        row,
        sample: buildSampleNumbersV4(row, "front", ratioPlan)
      }));
      
      // 合并候选池（加权：主源0.5，辅源0.3，第三源0.2）
      const weights = [0.5, 0.3, 0.2];
      const scoreMap = new Map();
      allSamples.forEach((item, idx) => {
        const w = weights[idx] || 0.1;
        item.sample.candidateEntries.forEach(e => {
          scoreMap.set(e.number, (scoreMap.get(e.number) || 0) + e.score * w);
        });
      });
      
      const mergedEntries = [...scoreMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, V4_POOL_SIZE)
        .map(([num, score]) => {
          // 从所有源中找到该号码的属性
          let o = {};
          for (const item of allSamples) {
            const found = item.sample.candidateEntries.find(e => e.number === num);
            if (found) { o = found; break; }
          }
          return {
            number: num, score, baseScore: score, rank: 0,
            selectedTailHits: o.selectedTailHits || 0, selectedTailNeighborHits: o.selectedTailNeighborHits || 0,
            tailCount: o.tailCount || 0, lastRowTailHits: o.lastRowTailHits || 0,
            tailPatternScore: o.tailPatternScore || 0, upperColorHits: o.upperColorHits || 0,
            upperColorTailHits: o.upperColorTailHits || 0, upperColorTailNeighborHits: o.upperColorTailNeighborHits || 0,
            hits: o.hits || 0, bridgeEndpointHits: o.bridgeEndpointHits || 0,
            arithmeticEndpointHits: o.arithmeticEndpointHits || 0, arithmeticScore: o.arithmeticScore || 0,
            integrityBonus: o.integrityBonus || 0, templateHits: o.templateHits || 0,
            sameRowSupport: o.sameRowSupport || 0, plusTenScore: o.plusTenScore || 0,
            plusTenNeighborScore: o.plusTenNeighborScore || 0, farOffsetCount: o.farOffsetCount || 0,
            anchorKeepPenalty: o.anchorKeepPenalty || 0, transformedCount: o.transformedCount || 0,
          };
        });
      
      frontSample.candidateEntries = mergedEntries;
      frontSample.candidates = mergedEntries.map(e => e.number);
      frontSample.numbers = mergedEntries.slice(0, 5).map(e => e.number);
      
      // 合并参考行
      frontSample.referenceRows = [...new Set([
        ...allSamples.flatMap(s => s.sample.referenceRows || [])
      ])].sort((a, b) => a - b);
      
      // 合并预测尾号（加权去重）
      const tailMap = new Map();
      allSamples.forEach((item, idx) => {
        const w = weights[idx] || 0.1;
        (item.sample.predictedTails || []).forEach(([t, s]) => {
          tailMap.set(t, (tailMap.get(t) || 0) + s * w);
        });
      });
      frontSample.predictedTails = [...tailMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      // 2.5 尾号关系加分（动态：等差、相邻、桥接）
      const sourceTails = [...new Set(frontSample.numbers.map(n => n % 10))];
      const relatedTails = new Set();
      
      // 检测尾号关系
      for (let i = 0; i < sourceTails.length; i++) {
        for (let j = i + 1; j < sourceTails.length; j++) {
          const t1 = sourceTails[i], t2 = sourceTails[j];
          const diff = Math.abs(t1 - t2);
          
          // 1. 相邻（差为1或9）
          if (diff === 1 || diff === 9) {
            // 给相邻尾号的相邻尾号加分（延伸）
            relatedTails.add((t1 + 1) % 10);
            relatedTails.add((t1 + 9) % 10); // t1 - 1
            relatedTails.add((t2 + 1) % 10);
            relatedTails.add((t2 + 9) % 10); // t2 - 1
          }
          
          // 2. 等差（差为2或3）
          if (diff === 2 || diff === 7) { // 差2或8（环形等差）
            // 给等差延伸的尾号加分
            relatedTails.add((t1 + 2) % 10);
            relatedTails.add((t1 + 8) % 10); // t1 - 2
            relatedTails.add((t2 + 2) % 10);
            relatedTails.add((t2 + 8) % 10); // t2 - 2
          }
          if (diff === 3 || diff === 6) { // 差3或7（环形等差）
            relatedTails.add((t1 + 3) % 10);
            relatedTails.add((t1 + 7) % 10); // t1 - 3
            relatedTails.add((t2 + 3) % 10);
            relatedTails.add((t2 + 7) % 10); // t2 - 3
          }
          
          // 3. 桥接（两个尾号之间的中点）
          if (diff === 2 || diff === 8) {
            const mid = ((t1 + t2) / 2) % 10;
            relatedTails.add(mid);
            relatedTails.add((mid + 5) % 10); // 对称点
          }
          if (diff === 4 || diff === 6) {
            const mid = ((t1 + t2) / 2) % 10;
            relatedTails.add(mid);
          }
        }
      }
      
      // 移除源尾号本身
      sourceTails.forEach(t => relatedTails.delete(t));
      
      // 对候选池中符合尾号关系的号码加分
      if (relatedTails.size > 0) {
        frontSample.candidateEntries.forEach(e => {
          const tail = e.number % 10;
          if (relatedTails.has(tail)) {
            e.score += 4; // 关联尾号+4分
          }
        });
        // 重新排序
        frontSample.candidateEntries.sort((a, b) => b.score - a.score);
        frontSample.candidates = frontSample.candidateEntries.map(e => e.number);
      }
      
      // 3. 首位球预测
      const firstBallPreds = predictFirstBallComprehensive(sourceRow, __allBalls);
      
      // 4. V5 组合生成（8维度评分 + 随机组合 + 重评分）
      const v4Refs = frontSample.referenceRows || [];
      const frontCombos = buildSampleFrontCombosV5(
        frontSample.candidateEntries, v4Refs,
        frontSample.selectedNumbers, frontSample.selectedNumbers,
        frontSample.predictedTails || null,
        frontSample.ivPrediction || null,
        firstBallPreds,
        frontSample.extremeFlags || null,
        ratioPlan, sourceRow
      );
      
      // 5. 补漏6 生成
      const backSample = buildSampleNumbers(sourceRow, "back");
      let backCombos = buildSampleFreeCombos(backSample.candidateEntries, 2, 1, backSample.selectedNumbers);
      const backBridgeNums = generateBackBridgeCombos(sourceRow, __allBalls);
      const bridgeCombos = backBridgeNums
        .filter(nums => !backCombos.some(c => c.key === nums.join("-")))
        .map(nums => ({ numbers: nums, key: nums.join("-"), score: 999, ratioText: "桥接" }));
      backCombos = [...bridgeCombos, ...backCombos];
      
      // 6. 生成完整方案（前区+后区）
      const variantPlan = buildV4SingleSamplePlan(
        frontCombos, backCombos,
        frontSample.candidates || [],
        frontSample.candidateEntries || [],
        frontSample.predictedTails || null,
        firstBallPreds
      );
      
      // ─── 提取结果 ───
      // Top5 = variantPlan 的前5个前区组合
      const top5 = variantPlan.slice(0, 5).map(v => ({
        numbers: (v.front?.numbers || []).slice(0, 5).sort((a, b) => a - b),
      }));
      
      // 补漏6 = variantPlan 的第6个（如果存在）
      const bl6 = variantPlan.length > 5 ? {
        numbers: (variantPlan[5]?.front?.numbers || []).slice(0, 5).sort((a, b) => a - b),
      } : null;
      
      // 候选池（使用V4_POOL_SIZE配置）
      const pool30 = new Set(frontSample.candidates ? frontSample.candidates.slice(0, V4_POOL_SIZE) : []);
      
      // ─── 计算指标 ───
      const top5Hits = top5.map(c => c.numbers.filter(n => targetSet.has(n)).length);
      const top5Union = new Set();
      top5.forEach(c => c.numbers.forEach(n => top5Union.add(n)));
      const top5UnionCoverage = targetNums.filter(n => top5Union.has(n)).length;
      
      let bl6Hits = 0, bl6UnionCoverage = 0;
      if (bl6 && bl6.numbers.length > 0) {
        bl6Hits = bl6.numbers.filter(n => targetSet.has(n)).length;
        const allUnion = new Set(top5Union);
        bl6.numbers.forEach(n => allUnion.add(n));
        bl6UnionCoverage = targetNums.filter(n => allUnion.has(n)).length;
      }
      
      const poolCoverage = targetNums.filter(n => pool30.has(n)).length;
      
      results.push({
        sourceIssue: sourceDraw.issue,
        targetIssue: targetDraw.issue,
        sourceNums, targetNums,
        top5Hits, top5UnionCoverage,
        bl6Hits, bl6UnionCoverage,
        poolCoverage,
        poolSize: pool30.size,
        totalCombos: frontCombos.length,
        poolNums: [...pool30].sort((a, b) => a - b), // 候选池号码
        missedBalls: targetNums.filter(n => !pool30.has(n)), // 未覆盖的球
      });
      
    } catch (err) {
      console.error(`[${sourceDraw.issue}] 回测出错:`, err.message);
      results.push({
        sourceIssue: sourceDraw.issue,
        targetIssue: targetDraw.issue,
        sourceNums, targetNums,
        top5Hits: [0,0,0,0,0], top5UnionCoverage: 0,
        bl6Hits: 0, bl6UnionCoverage: 0,
        poolCoverage: 0, poolSize: 0, totalCombos: 0,
        error: err.message,
      });
    }
  }
  
  // ═══ 输出结果 ═══
  const header = [
    '源期号'.padEnd(10),
    '目标期号'.padEnd(10),
    'Top5命中'.padEnd(18),
    'Top5联合覆盖/5'.padEnd(16),
    '补漏6命中'.padEnd(12),
    '联合覆盖/5'.padEnd(12),
    '候选池覆盖/5'.padEnd(14),
    '源号码'.padEnd(24),
    '目标号码'.padEnd(24),
  ].join(' | ');
  
  console.log(header);
  console.log("-".repeat(header.length));
  
  let sumTop5Max = 0, sumTop5Union = 0, sumBl6Hits = 0, sumUnion = 0, sumPool = 0;
  let cnt = 0;
  
  results.forEach(r => {
    cnt++;
    const maxTop5Hit = Math.max(...r.top5Hits);
    sumTop5Max += maxTop5Hit;
    sumTop5Union += r.top5UnionCoverage;
    sumBl6Hits += r.bl6Hits;
    sumUnion += r.bl6UnionCoverage;
    sumPool += r.poolCoverage;
    
    const row = [
      r.sourceIssue.padEnd(10),
      r.targetIssue.padEnd(10),
      `${r.top5Hits.join(',')} (max${maxTop5Hit})`.padEnd(18),
      `${r.top5UnionCoverage}/5`.padEnd(16),
      `${r.bl6Hits}`.padEnd(12),
      `${r.bl6UnionCoverage}/5`.padEnd(12),
      `${r.poolCoverage}/5`.padEnd(14),
      r.sourceNums.join(',').padEnd(24),
      r.targetNums.join(',').padEnd(24),
    ].join(' | ');
    console.log(row);
  });
  
  console.log("");
  console.log("=".repeat(90));
  console.log("汇总统计");
  console.log("=".repeat(90));
  console.log(`  总验证期数: ${cnt}`);
  console.log(`  平均 Top5 最高命中: ${(sumTop5Max / cnt).toFixed(2)} / 5`);
  console.log(`  平均 Top5 联合覆盖: ${(sumTop5Union / cnt).toFixed(2)} / 5`);
  console.log(`  平均 补漏6 命中: ${(sumBl6Hits / cnt).toFixed(2)} / 5`);
  console.log(`  平均 Top5+补漏6 联合覆盖: ${(sumUnion / cnt).toFixed(2)} / 5`);
  console.log(`  平均 候选池覆盖 (Top30): ${(sumPool / cnt).toFixed(2)} / 5`);
  
  // 命中率
  const top5HitRate = (sumTop5Max / (cnt * 5) * 100).toFixed(1);
  const unionRate = (sumUnion / (cnt * 5) * 100).toFixed(1);
  const poolRate = (sumPool / (cnt * 5) * 100).toFixed(1);
  console.log("");
  console.log(`  Top5最高命中率: ${top5HitRate}%`);
  console.log(`  Top5+补漏6 联合覆盖率: ${unionRate}%`);
  console.log(`  候选池覆盖率 (Top30): ${poolRate}%`);
  
  // 命中分布
  const bestDist = {};
  const unionDist = {};
  results.forEach(r => {
    const maxH = Math.max(...r.top5Hits);
    bestDist[maxH] = (bestDist[maxH] || 0) + 1;
    unionDist[r.bl6UnionCoverage] = (unionDist[r.bl6UnionCoverage] || 0) + 1;
  });
  
  console.log("");
  console.log("  Top5 最高命中分布:");
  for (let h = 5; h >= 0; h--) {
    if (bestDist[h]) console.log(`    命中${h}个: ${bestDist[h]}次 (${(bestDist[h] / cnt * 100).toFixed(1)}%)`);
  }
  
  console.log("");
  console.log("  Top5+补漏6 联合覆盖分布:");
  for (let h = 5; h >= 0; h--) {
    if (unionDist[h]) console.log(`    覆盖${h}个: ${unionDist[h]}次 (${(unionDist[h] / cnt * 100).toFixed(1)}%)`);
  }
  
  // ═══ 未覆盖球分析 ═══
  console.log("");
  console.log("=".repeat(90));
  console.log("未覆盖球分析");
  console.log("=".repeat(90));
  
  // 收集所有未覆盖的球
  const missedBallCount = {};
  const missedTailCount = {};
  const missedBallsWithSource = [];
  let totalMissed = 0;
  
  results.forEach(r => {
    if (r.missedBalls && r.missedBalls.length > 0) {
      totalMissed += r.missedBalls.length;
      r.missedBalls.forEach(ball => {
        missedBallCount[ball] = (missedBallCount[ball] || 0) + 1;
        const tail = ball % 10;
        missedTailCount[tail] = (missedTailCount[tail] || 0) + 1;
      });
      missedBallsWithSource.push({
        sourceIssue: r.sourceIssue,
        targetIssue: r.targetIssue,
        sourceNums: r.sourceNums,
        targetNums: r.targetNums,
        missed: r.missedBalls,
        sourceTails: r.sourceNums.map(n => n % 10),
      });
    }
  });
  
  console.log(`  总未覆盖球数: ${totalMissed}`);
  console.log(`  有未覆盖球的期数: ${missedBallsWithSource.length}`);
  console.log("");
  
  // 被漏掉最多的球
  console.log("  被漏掉最多的球（Top 10）:");
  const sortedMissedBalls = Object.entries(missedBallCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  sortedMissedBalls.forEach(([ball, count]) => {
    console.log(`    球${ball.padStart(2)}: 被漏掉${count}次`);
  });
  
  console.log("");
  console.log("  未覆盖球的尾号分布:");
  for (let t = 0; t <= 9; t++) {
    const cnt = missedTailCount[t] || 0;
    console.log(`    尾号${t}: ${cnt}次`);
  }
  
  // 尾号关联分析
  console.log("");
  console.log("  尾号关联分析（源尾号→未覆盖球尾号）:");
  const tailRelation = {};
  missedBallsWithSource.forEach(r => {
    const sourceTails = [...new Set(r.sourceTails)];
    r.missed.forEach(ball => {
      const ballTail = ball % 10;
      sourceTails.forEach(srcTail => {
        const diff = Math.abs(srcTail - ballTail);
        const key = `${srcTail}→${ballTail}`;
        if (diff <= 2 || diff >= 8) {
          tailRelation[key] = (tailRelation[key] || 0) + 1;
        }
      });
    });
  });
  
  const sortedRelations = Object.entries(tailRelation)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  sortedRelations.forEach(([key, count]) => {
    console.log(`    ${key}: ${count}次`);
  });
  
  // 未覆盖球的区间分布
  console.log("");
  console.log("  未覆盖球的区间分布:");
  const interval1Count = Object.entries(missedBallCount).filter(([b]) => parseInt(b) <= 12).reduce((s, [, c]) => s + c, 0);
  const interval2Count = Object.entries(missedBallCount).filter(([b]) => parseInt(b) >= 13 && parseInt(b) <= 24).reduce((s, [, c]) => s + c, 0);
  const interval3Count = Object.entries(missedBallCount).filter(([b]) => parseInt(b) >= 25).reduce((s, [, c]) => s + c, 0);
  console.log(`    一区(1-12): ${interval1Count}次`);
  console.log(`    二区(13-24): ${interval2Count}次`);
  console.log(`    三区(25-35): ${interval3Count}次`);
  
  // 建议
  console.log("");
  console.log("  优化建议:");
  console.log("    1. 对源号码的相邻尾号(+1/-1)增加候选权重");
  console.log("    2. 对源号码尾号的+2/-2尾号增加候选权重");
  console.log("    3. 考虑增加候选池大小从30到33以提高覆盖率");
  
  console.log("");
  console.log("完成!");
}