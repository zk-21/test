const comparePageLock = document.querySelector("#comparePageLock");
const comparePageRoot = document.querySelector("#comparePageRoot");
const comparePagePassword = document.querySelector("#comparePagePassword");
const toggleComparePagePasswordButton = document.querySelector("#toggleComparePagePasswordButton");
const unlockComparePageButton = document.querySelector("#unlockComparePageButton");
const comparePageAuthMessage = document.querySelector("#comparePageAuthMessage");

const compareVersionPassword = document.querySelector("#compareVersionPassword");
const unlockCompareVersionsButton = document.querySelector("#unlockCompareVersionsButton");
const lockCompareVersionsButton = document.querySelector("#lockCompareVersionsButton");
const comparePageHint = document.querySelector("#comparePageHint");
const compareVersionAuthMessage = document.querySelector("#compareVersionAuthMessage");
const compareVersionSearch = document.querySelector("#compareVersionSearch");

const compareBoard = document.querySelector("#compareBoard");
const compareFrontBoard = document.querySelector("#compareFrontBoard");
const compareBackBoard = document.querySelector("#compareBackBoard");
const compareBallCount = document.querySelector("#compareBallCount");
const compareCurrentBaseLabel = document.querySelector("#compareCurrentBaseLabel");
const compareVersionBanner = document.querySelector("#compareVersionBanner");
const compareVersionBannerText = document.querySelector("#compareVersionBannerText");
const compareRowInput = document.querySelector("#compareRowInput");
const compareZoneInput = document.querySelector("#compareZoneInput");
const compareNumberInput = document.querySelector("#compareNumberInput");
const compareColorInput = document.querySelector("#compareColorInput");
const compareSizeInput = document.querySelector("#compareSizeInput");
const compareZoomInput = document.querySelector("#compareZoomInput");
const compareAddBallButton = document.querySelector("#compareAddBallButton");
const compareDeleteColorButton = document.querySelector("#compareDeleteColorButton");
const compareAddDividerButton = document.querySelector("#compareAddDividerButton");
const compareClearBoardButton = document.querySelector("#compareClearBoardButton");
const compareSwatches = [...document.querySelectorAll(".compare-swatch")];

const compareVersionList = document.querySelector("#compareVersionList");
const compareVersionPreviewTitle = document.querySelector("#compareVersionPreviewTitle");
const compareVersionPreview = document.querySelector("#compareVersionPreview");
const downloadCompareVersionsButton = document.querySelector("#downloadCompareVersionsButton");
const importCompareVersionsInput = document.querySelector("#importCompareVersionsInput");

const compareVersionOne = document.querySelector("#compareVersionOne");
const compareVersionTwo = document.querySelector("#compareVersionTwo");
const compareVersionThree = document.querySelector("#compareVersionThree");
const compareVersionFour = document.querySelector("#compareVersionFour");
const compareVersionFive = document.querySelector("#compareVersionFive");
const compareVersionSix = document.querySelector("#compareVersionSix");
const compareSelects = [
  compareVersionOne,
  compareVersionTwo,
  compareVersionThree,
  compareVersionFour,
  compareVersionFive,
  compareVersionSix,
].filter(Boolean);

const loadCompareVersionsButton = document.querySelector("#loadCompareVersionsButton");
const saveCompareBoardButton = document.querySelector("#saveCompareBoardButton");
const saveCompareBoardButtonInline = document.querySelector("#saveCompareBoardButtonInline");
const clearCompareBoardButton = document.querySelector("#clearCompareBoardButton");
const captureCompareBoardButton = document.querySelector("#captureCompareBoardButton");

const backToMainPageTop = document.querySelector("#backToMainPageTop");
const backToMainPageButton = document.querySelector("#backToMainPageButton");
const backToMainPageInline = document.querySelector("#backToMainPageInline");
const comparePageSwitchButtons = [...document.querySelectorAll("[data-switch-page]")];
const jumpToCompareControls = document.querySelector("#jumpToCompareControls");
const jumpToCompareBoard = document.querySelector("#jumpToCompareBoard");
const jumpToCompareVersions = document.querySelector("#jumpToCompareVersions");

const comparePageConfig = globalThis.comparePageConfig || {};
const pagePasswordValue = "zk@001";
const versionPasswordValue = "zk@001";
const pageAuthStorageKey = "lottery-page-auth";
const versionAuthStorageKey = "lottery-version-auth";
const versionStorageKey = "lottery-board-versions";
const compareDraftStorageKey = comparePageConfig.draftStorageKey || "lottery-board-compare-draft";
const compareContextStorageKey = comparePageConfig.contextStorageKey || "lottery-board-compare-context";
const compare90ContextStorageKey = "lottery-board-compare90-context";
const compare180ContextStorageKey = "lottery-board-compare-context";
const compare90PagePath = "./compare90.html";
const compare180PagePath = "./compare.html";
const browserOnlyStorage = globalThis.localStorage;

const drawRowsPerVersion = Number(comparePageConfig.drawRowsPerVersion) || 35;
const compareVersionsCount = Number(comparePageConfig.compareVersionsCount) || 6;
const reservedRows = Number(comparePageConfig.reservedRows) || 0;
const rows = drawRowsPerVersion * compareVersionsCount + reservedRows;
const compareRowsLabel = comparePageConfig.rowsLabel || `${rows}行`;
const compareVersionsLabel = comparePageConfig.versionsLabel || `${compareVersionsCount} 个版本`;
const compareVersionsText = comparePageConfig.versionsText || `${compareVersionsCount}个版本`;
const comparePageTitlePrefix = comparePageConfig.titlePrefix || `${compareRowsLabel}对比图`;
const defaultCaptureSplitRow = Math.ceil(rows / 2);
const compareCaptureSplitRow = Math.min(Number(comparePageConfig.captureSplitRow) || defaultCaptureSplitRow, rows);
const zones = {
  front: { label: "前区", max: 35, element: compareFrontBoard },
  back: { label: "后区", max: 12, element: compareBackBoard },
};

let versions = readStorage(versionStorageKey);
let versionsUnlocked = sessionStorage.getItem(versionAuthStorageKey) === "true";
let currentBaseTitle = "";
let rowIssues = {};
let compareSplitRows = [];
let compareSelectedIds = [];
let userAdjustedZoom = false;
let customDividerRows = {};

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

function pad(value) {
  return String(value).padStart(2, "0");
}

function normalizeColor(color) {
  return String(color || "").trim().toLowerCase();
}

function normalizePassword(value) {
  return String(value || "")
    .replace(/[！-～]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, "");
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || min, min), max);
}

function passwordMatches(value, expected) {
  return normalizePassword(value) === expected;
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

function cloneBall(ball) {
  const number = Number(ball?.number) || Number(ball?.label) || 0;
  const result = {
    row: Number(ball?.row) || 0,
    zone: ball?.zone,
    number,
    label: String(ball?.label || pad(number)),
    color: normalizeColor(ball?.color) || "#999999",
  };
  if (ball?.colors && Array.isArray(ball.colors) && ball.colors.length > 1) {
    result.colors = ball.colors.map(normalizeColor).filter(Boolean);
  }
  if (ball?.protected) result.protected = true;
  return result;
}

function cloneBalls(balls) {
  return (Array.isArray(balls) ? balls : []).filter(Boolean).map(cloneBall);
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
  };
}

function downloadVersionFile(version) {
  if (!version) return;
  const safeTitle =
    String(version.title || "版本")
      .replace(/[\\/:*?"<>|]/g, "-")
      .trim() || "版本";
  const payload = {
    schema: "select-ball-version/v1",
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

function downloadVersionsFile() {
  if (!versionsUnlocked) {
    compareVersionAuthMessage.textContent = "请先验证密码后再下载版本信息。";
    return;
  }
  if (versions.length === 0) {
    compareVersionAuthMessage.textContent = "当前没有可下载的版本信息。";
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
  compareVersionAuthMessage.textContent = `已下载 ${versions.length} 个版本信息。`;
}

async function importVersionsFile(file) {
  if (!versionsUnlocked) {
    compareVersionAuthMessage.textContent = "请先验证密码后再导入版本信息。";
    return;
  }
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const importedVersions = extractVersionImportPayload(payload).map(normalizeImportedVersion).filter(Boolean);
    if (importedVersions.length === 0) {
      compareVersionAuthMessage.textContent = "导入失败：文件里没有有效版本信息。";
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
      compareVersionAuthMessage.textContent = `没有新增版本，已跳过 ${skipped} 个重复版本。`;
      return;
    }

    versions = [...nextVersions, ...versions].slice(0, 80);
    writeStorage(versionStorageKey, versions);
    renderVersions();
    showVersion(nextVersions[0].id);
    compareVersionAuthMessage.textContent = `已导入 ${nextVersions.length} 个版本${skipped ? `，跳过 ${skipped} 个重复版本` : ""}。`;
  } catch (error) {
    console.error(error);
    compareVersionAuthMessage.textContent = "导入失败：请确认文件是版本信息 JSON。";
  }
}

function getCell(row, zone, number) {
  return compareBoard.querySelector(`[data-row="${row}"][data-zone="${zone}"][data-number="${number}"]`);
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

function getVersionLabel(version) {
  const title = version?.title || "历史版本";
  const time = version?.time ? ` / ${version.time}` : "";
  return `${title}${time}`;
}

function getVersionById(id) {
  return versions.find((version) => version.id === id) || null;
}

function createChip(ball) {
  const cleanBall = cloneBall(ball);
  const chip = document.createElement("span");
  chip.className = "history-chip";
  chip.style.setProperty("--ball-color", cleanBall.color);
  chip.textContent = pad(cleanBall.number);
  return chip;
}

function createDetailSummary(version) {
  const summary = document.createElement("div");
  summary.className = "version-summary";
  const balls = cloneBalls(version?.balls);
  if (balls.length === 0) {
    const empty = document.createElement("span");
    empty.className = "history-empty";
    empty.textContent = "此版本为空";
    summary.append(empty);
    return summary;
  }
  balls.slice(0, 10).forEach((ball) => summary.append(createChip(ball)));
  if (balls.length > 10) {
    const more = document.createElement("span");
    more.className = "version-more";
    more.textContent = `还有 ${balls.length - 10} 个球`;
    summary.append(more);
  }
  return summary;
}

function updateCount() {
  compareBallCount.textContent = compareBoard.querySelectorAll(".ball").length;
}

function syncInputs(row, zone, number) {
  compareRowInput.value = row;
  compareZoneInput.value = zone;
  compareNumberInput.max = zones[zone].max;
  compareNumberInput.value = number;
}

function setColor(color) {
  compareColorInput.value = color;
  compareSwatches.forEach((swatch) => {
    swatch.classList.toggle("active", swatch.dataset.color.toLowerCase() === color.toLowerCase());
  });
}

function updateBaseLabel() {
  compareCurrentBaseLabel.textContent = currentBaseTitle ? `当前编辑：基于 ${currentBaseTitle} 调整` : "当前编辑：空白画面";
}

function updateVersionBanner() {
  compareVersionBanner.hidden = !currentBaseTitle;
  compareVersionBannerText.textContent = currentBaseTitle;
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

function renderDividerRows() {
  compareBoard.querySelectorAll(".row-label, .cell").forEach((element) => {
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

function addDividerRow(row, color = compareColorInput.value, shouldPersist = true) {
  const clampedRow = clamp(row, 1, rows);
  customDividerRows[clampedRow] = normalizeColor(color);
  renderDividerRows();
  if (shouldPersist) persistDraft();
}

function updateRowLabels() {
  compareBoard.querySelectorAll(".row-label").forEach((label) => {
    const row = Number(label.dataset.row);
    const issue = rowIssues[row];
    if (label.dataset.zone === "front" && issue) {
      label.innerHTML = `<span class="row-label-issue">${String(issue)}</span><span class="row-label-num">${row}</span>`;
      label.title = `${issue} / 第${row}行`;
    } else {
      label.innerHTML = `<span class="row-label-num">${row}</span>`;
      label.title = `第${row}行`;
    }
  });
}

function addBall(row, zone, number, label = pad(number), color = "#d6202a", shouldRecord = false, existingColors = null, options = {}) {
  const cell = getCell(row, zone, number);
  if (!cell) return;

  const previous = cell.querySelector(".ball");
  const cleanColor = normalizeColor(color);
  const cleanLabel = String(label || cell.dataset.value).slice(0, 2).padStart(2, "0");
  const isProtected = Boolean(options.protected) || previous?.dataset.protected === "true";
  const protectedAttr = isProtected ? ' data-protected="true"' : "";

  if (!shouldRecord && existingColors && existingColors.length > 1) {
    const colorsStr = existingColors.join(",");
    cell.innerHTML = `<span class="ball rainbow-ball" data-color="${cleanColor}" data-colors="${colorsStr}"${protectedAttr} style="--ball-color:#1f2937;background:#1f2937">${cleanLabel}</span>`;
    updateCount();
    return;
  }

  if (previous) {
    const existingColorsArr = previous.dataset.colors ? previous.dataset.colors.split(",") : [previous.dataset.color];
    const shouldStackAsBlack = !shouldRecord || !existingColorsArr.includes(cleanColor);
    if (shouldStackAsBlack) {
      if (!existingColorsArr.includes(cleanColor)) existingColorsArr.push(cleanColor);
      previous.dataset.colors = existingColorsArr.join(",");
      previous.classList.add("rainbow-ball");
      previous.style.background = "#1f2937";
      if (isProtected) previous.dataset.protected = "true";
      updateCount();
      return;
    }
  }

  cell.innerHTML = `<span class="ball" data-color="${cleanColor}"${protectedAttr} style="--ball-color:${cleanColor}">${cleanLabel}</span>`;
  updateCount();
  if (shouldRecord) persistDraft();
}

function removeBall(cell, options = {}) {
  const ball = cell.querySelector(".ball");
  if (!ball) return null;
  if (ball.dataset.protected === "true" && !options.force) return null;
  const removed = getBallData(ball);
  cell.textContent = cell.dataset.value;
  updateCount();
  persistDraft();
  return removed;
}

function clearBoard() {
  compareBoard.querySelectorAll(".cell").forEach((cell) => {
    cell.textContent = cell.dataset.value;
  });
  rowIssues = {};
  setCompareSplitRows([]);
  setCustomDividerRows({});
  currentBaseTitle = "";
  updateBaseLabel();
  updateVersionBanner();
  updateCount();
  persistDraft();
}

function collectBalls() {
  return [...compareBoard.querySelectorAll(".ball")].map(getBallData);
}

function applyBalls(balls, options = {}) {
  compareBoard.querySelectorAll(".cell").forEach((cell) => {
    cell.textContent = cell.dataset.value;
  });
  rowIssues = options.rowIssues ? { ...options.rowIssues } : {};
  setCompareSplitRows(options.compareSplitRows || []);
  setCustomDividerRows(options.customDividerRows || {});
  cloneBalls(balls).forEach((ball) => {
    addBall(ball.row, ball.zone, ball.number, ball.label, ball.color, false, ball.colors, {
      protected: Boolean(options.protectBalls || ball.protected),
    });
  });
  if (Object.prototype.hasOwnProperty.call(options, "baseTitle")) {
    currentBaseTitle = options.baseTitle || "";
  }
  updateRowLabels();
  updateBaseLabel();
  updateVersionBanner();
  updateCount();
  if (options.persist !== false) persistDraft();
}

function persistDraft() {
  writeStorage(compareDraftStorageKey, {
    baseTitle: currentBaseTitle,
    updatedAt: formatTime(),
    balls: cloneBalls(collectBalls()),
    rowIssues: { ...rowIssues },
    compareSplitRows: [...compareSplitRows],
    customDividerRows: { ...customDividerRows },
    selectedIds: [...compareSelectedIds],
  });
}

function restoreDraft() {
  const draft = readStorage(compareDraftStorageKey);
  if (!draft || !Array.isArray(draft.balls) || draft.balls.length === 0) return false;
  compareSelectedIds = Array.isArray(draft.selectedIds) ? draft.selectedIds.filter(Boolean) : [];
  applyBalls(draft.balls, {
    baseTitle: draft.baseTitle || "",
    rowIssues: draft.rowIssues || {},
    compareSplitRows: draft.compareSplitRows || [],
    customDividerRows: draft.customDividerRows || {},
    protectBalls: true,
    persist: false,
  });
  return true;
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
      if (row > drawRowsPerVersion * compareVersionsCount) labelCell.dataset.pick = "true";
      labelCell.textContent = row;
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
        if (row > drawRowsPerVersion * compareVersionsCount) cell.dataset.pick = "true";
        if (row % 5 === 0) cell.dataset.groupEnd = "true";
        cell.textContent = value;
        fragment.append(cell);
      }
    }
    config.element.append(fragment);
  });
}

function getBoardNaturalWidth() {
  const rootStyle = getComputedStyle(document.documentElement);
  const boardStyle = getComputedStyle(compareBoard);
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
  compareZoomInput.value = Math.round(zoom * 100);
}

function fitBoardToScreen(force = false) {
  if (userAdjustedZoom && !force) return;
  const wrap = document.querySelector(".compare-board-wrap");
  const availableWidth = (wrap?.clientWidth || 0) - 2;
  const naturalWidth = getBoardNaturalWidth();
  if (availableWidth <= 0 || naturalWidth <= 0) return;
  const zoom = Math.min(1, Math.max(0.3, availableWidth / naturalWidth));
  setBoardZoom(zoom);
}

function populateCompareSelects() {
  const defaults = getDefaultCompareSelection();
  compareSelects.forEach((select, index) => {
    if (!select) return;
    const previous = compareSelectedIds[index] || select.value || defaults[index] || "";
    select.innerHTML = "";
    versions.forEach((version) => {
      const option = document.createElement("option");
      option.value = version.id;
      option.textContent = getVersionLabel(version);
      select.append(option);
    });
    select.value = versions.some((version) => version.id === previous) ? previous : defaults[index] || versions[index]?.id || "";
  });
  compareSelectedIds = compareSelects.map((select) => select?.value || "");
}

function readCompareContext() {
  const context = readStorage(compareContextStorageKey);
  return context && typeof context === "object" ? context : {};
}

function getDefaultCompareSelection() {
  const context = readCompareContext();
  const preferred = Array.isArray(context.selectedIds) ? context.selectedIds.filter(Boolean) : [];
  if (preferred.length > 0) return preferred.slice(0, compareVersionsCount);

  const sourceVersionId = String(context.sourceVersionId || "");
  const availableVersions = versions.slice();
  if (availableVersions.length === 0) return [];
  if (!sourceVersionId) return availableVersions.slice(0, compareVersionsCount).map((version) => version.id);

  const sourceIndex = availableVersions.findIndex((version) => version.id === sourceVersionId);
  if (sourceIndex < 0) return availableVersions.slice(0, compareVersionsCount).map((version) => version.id);

  const anchorOffset = Math.floor((compareVersionsCount - 1) / 2);
  const start = Math.max(0, Math.min(sourceIndex - anchorOffset, Math.max(availableVersions.length - compareVersionsCount, 0)));
  return availableVersions.slice(start, start + compareVersionsCount).map((version) => version.id);
}

function buildCompareBoard(selectedVersions) {
  const compareBalls = [];
  const compareRows = {};
  const splitRows = [];

  selectedVersions.forEach((version, versionIndex) => {
    const startRow = versionIndex * drawRowsPerVersion + 1;
    const endRow = startRow + drawRowsPerVersion - 1;
    if (versionIndex < selectedVersions.length - 1) splitRows.push(endRow);

    for (let offset = 0; offset < drawRowsPerVersion; offset += 1) {
      const sourceRow = offset + 1;
      const mappedRow = startRow + offset;
      compareRows[mappedRow] = version.rowIssues?.[sourceRow] || `${version.title || "历史版本"}-${sourceRow}`;
    }

    cloneBalls(version.balls)
      .filter((ball) => ball.row >= 1 && ball.row <= drawRowsPerVersion)
      .forEach((ball) => {
        const mappedRow = startRow + (ball.row - 1);
        const mappedNumber = Number(ball.number);
        if (mappedNumber < 1 || mappedNumber > zones[ball.zone]?.max) return;
        compareBalls.push({
          ...ball,
          row: mappedRow,
          number: mappedNumber,
          label: pad(mappedNumber),
          protected: true,
        });
      });
  });

  return { compareBalls, compareRows, splitRows };
}

function loadCompareVersionsToBoard() {
  const selectedIds = compareSelects.map((select) => select?.value || "").filter(Boolean);
  compareSelectedIds = selectedIds;
  if (selectedIds.length !== compareVersionsCount) {
    comparePageHint.textContent = `请选择 ${compareVersionsCount} 个有效版本后再加载。`;
    return;
  }

  const uniqueIds = [...new Set(selectedIds)];
  if (uniqueIds.length !== compareVersionsCount) {
    comparePageHint.textContent = `${compareVersionsCount} 个位置不能重复选择同一个版本。`;
    return;
  }

  const selectedVersions = selectedIds.map(getVersionById);
  if (selectedVersions.some((version) => !version)) {
    comparePageHint.textContent = "存在无效版本，请重新选择。";
    return;
  }

  const { compareBalls, compareRows, splitRows } = buildCompareBoard(selectedVersions);
  const compareTitle = `${comparePageTitlePrefix}：${selectedVersions.map((version) => version.title || "历史版本").join(" / ")}`;
  applyBalls(compareBalls, {
    baseTitle: compareTitle,
    rowIssues: compareRows,
    compareSplitRows: splitRows,
    protectBalls: true,
  });
  writeStorage(compareContextStorageKey, {
    sourceVersionId: selectedIds[0] || "",
    selectedIds: [...selectedIds],
    updatedAt: Date.now(),
  });
  comparePageHint.textContent = `${compareVersionsText}已加载到 ${compareRowsLabel}选号区。`;
}

function loadVersionToBoard(version) {
  if (!version) return;
  applyBalls(version.balls, {
    baseTitle: version.title || "历史版本",
    rowIssues: version.rowIssues || {},
    compareSplitRows: version.compareSplitRows || [],
    customDividerRows: version.customDividerRows || {},
    protectBalls: true,
  });
  showVersion(version.id);
  comparePageHint.textContent = `${version.title || "历史版本"}已加载到${compareRowsLabel}选号区，可继续调整。`;
  scrollToSection("#compareBoardPanel");
}

function saveCurrentBoardAsVersion() {
  const balls = cloneBalls(collectBalls());
  const time = formatTime();
  const title = currentBaseTitle || `${compareRowsLabel}版本 ${time}`;
  const version = {
    id: makeId(),
    kind: "custom",
    time,
    timestamp: Date.now(),
    title,
    balls,
    rowIssues: { ...rowIssues },
    compareSplitRows: [...compareSplitRows],
    customDividerRows: { ...customDividerRows },
  };
  versions = readStorage(versionStorageKey);
  versions.unshift(version);
  versions = versions.slice(0, 80);
  writeStorage(versionStorageKey, versions);
  currentBaseTitle = version.title;
  updateBaseLabel();
  updateVersionBanner();
  persistDraft();
  renderVersions();
  showVersion(version.id);
  comparePageHint.textContent = `已保存为版本：${version.title}`;
}

function versionMatches(version, query) {
  if (!query) return true;
  const source = [
    version.title,
    version.time,
    ...(cloneBalls(version.balls).map((ball) => `${ball.row}-${ball.zone}-${pad(ball.number)}-${ball.color}`)),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return source.includes(query.toLowerCase());
}

function showVersion(id) {
  if (!compareVersionPreviewTitle || !compareVersionPreview) return;
  const version = getVersionById(id);
  if (!version) return;
  const balls = cloneBalls(version.balls);
  compareVersionPreviewTitle.textContent = `${version.title || "历史版本"}，共 ${balls.length} 个球`;
  compareVersionPreview.innerHTML = "";
  if (balls.length === 0) {
    const empty = document.createElement("span");
    empty.className = "history-empty";
    empty.textContent = "此版本为空";
    compareVersionPreview.append(empty);
    return;
  }
  balls.slice(0, 60).forEach((ball) => compareVersionPreview.append(createChip(ball)));
  if (balls.length > 60) {
    const more = document.createElement("span");
    more.className = "version-more";
    more.textContent = `预览已截断，剩余 ${balls.length - 60} 个球`;
    compareVersionPreview.append(more);
  }
}

function renderVersions() {
  const section = document.querySelector("#compareVersionsPanel");
  section?.classList.toggle("locked", !versionsUnlocked);
  compareVersionSearch.disabled = !versionsUnlocked;
  downloadCompareVersionsButton.disabled = !versionsUnlocked || versions.length === 0;
  importCompareVersionsInput.disabled = !versionsUnlocked;
  loadCompareVersionsButton.disabled = !versionsUnlocked || versions.length < compareVersionsCount;
  saveCompareBoardButton.disabled = false;
  saveCompareBoardButtonInline.disabled = false;
  lockCompareVersionsButton.hidden = !versionsUnlocked;
  unlockCompareVersionsButton.hidden = versionsUnlocked;
  compareVersionPassword.hidden = versionsUnlocked;

  compareVersionList.innerHTML = "";
  if (!versionsUnlocked) {
    comparePageHint.textContent = `请先输入密码验证版本库，再选择${compareVersionsText}。`;
    compareVersionAuthMessage.textContent = "请输入密码后查看版本内容。";
    if (compareVersionPreviewTitle) compareVersionPreviewTitle.textContent = "未验证";
    if (compareVersionPreview) compareVersionPreview.innerHTML = "";
    compareSelects.forEach((select) => {
      select.innerHTML = "";
      select.disabled = true;
    });
    return;
  }

  compareVersionAuthMessage.textContent = "已验证。当前页面与主页面共用同一个版本库。";
  compareSelects.forEach((select) => {
    select.disabled = false;
  });
  populateCompareSelects();

  const query = compareVersionSearch.value.trim();
  const matchedVersions = versions.filter((version) => versionMatches(version, query));
  if (matchedVersions.length === 0) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = query ? "没有匹配的版本" : "还没有历史版本";
    compareVersionList.append(empty);
    return;
  }

  matchedVersions.forEach((version) => {
    const item = document.createElement("li");
    item.className = "version-item";

    const info = document.createElement("div");
    info.className = "version-info";
    info.innerHTML = `<strong>${version.title || "历史版本"}</strong><span>${cloneBalls(version.balls).length} 个球</span>`;

    const actions = document.createElement("div");
    actions.className = "version-actions";

    const loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.textContent = "加载到选号区";
    loadButton.addEventListener("click", () => loadVersionToBoard(version));

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.textContent = "设为默认";
    selectButton.addEventListener("click", () => {
      const nextIds = [...compareSelects.map((select) => select.value)];
      nextIds[0] = version.id;
      compareSelectedIds = nextIds;
      populateCompareSelects();
      comparePageHint.textContent = `已将 ${version.title || "历史版本"} 放到版本一位置。`;
    });

    const downloadButton = document.createElement("button");
    downloadButton.type = "button";
    downloadButton.textContent = "下载";
    downloadButton.addEventListener("click", () => downloadVersionFile(version));

    actions.append(loadButton, selectButton, downloadButton);
    item.append(info, actions, createDetailSummary(version));
    compareVersionList.append(item);
  });
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

function trimCaptureRows(root, startRow, endRow) {
  root.querySelectorAll("[data-row]").forEach((element) => {
    const row = Number(element.dataset.row);
    if (row < startRow || row > endRow) element.remove();
  });
}

function prepareCaptureZone(zoneClone, zone, startRow, endRow, options = {}) {
  const { keepRowLabels = false } = options;
  trimCaptureRows(zoneClone, startRow, endRow);
  if (!keepRowLabels) {
    zoneClone.querySelectorAll(".row-label").forEach((label) => label.remove());
  }
  if (keepRowLabels) {
    zoneClone.style.gridTemplateColumns =
      zone === "front" ? "var(--row-label-w) repeat(35, var(--cell))" : "var(--back-row-label-w) repeat(12, var(--cell))";
    return;
  }
  zoneClone.style.gridTemplateColumns = zone === "front" ? "repeat(35, var(--cell))" : "repeat(12, var(--cell))";
}

async function captureBoard() {
  if (!globalThis.html2canvas) {
    comparePageHint.textContent = "截图组件加载失败，请刷新页面后重试。";
    return;
  }

  const target = compareBoard;
  const frontSource = compareFrontBoard;
  const backSource = compareBackBoard;
  if (!target || !frontSource || !backSource) return;

  const filenameBase = (currentBaseTitle || `${compareRowsLabel}选号区-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`).replace(/[\\/:*?"<>|]/g, "-");
  const previousText = captureCompareBoardButton.textContent;
  let captureHost = null;
  captureCompareBoardButton.disabled = true;
  captureCompareBoardButton.textContent = "生成中...";

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

    const createCapturePane = (startRow, endRow) => {
      const pane = document.createElement("div");
      pane.style.display = "inline-flex";
      pane.style.alignItems = "flex-start";
      pane.style.gap = "0";
      pane.style.padding = "0";
      pane.style.margin = "0";
      pane.style.background = "#ffffff";
      pane.style.zoom = "1";
      pane.style.transform = "none";
      pane.style.width = "max-content";
      pane.style.minWidth = "0";
      pane.style.maxWidth = "none";
      pane.style.overflow = "visible";

      const frontClone = frontSource.cloneNode(true);
      const backClone = backSource.cloneNode(true);
      prepareCaptureZone(frontClone, "front", startRow, endRow, { keepRowLabels: true });
      prepareCaptureZone(backClone, "back", startRow, endRow);
      [frontClone, backClone].forEach((zoneClone) => {
        zoneClone.style.flex = "0 0 auto";
        zoneClone.style.width = "max-content";
        zoneClone.style.minWidth = "0";
        zoneClone.style.maxWidth = "none";
        zoneClone.style.overflow = "visible";
        zoneClone.style.zoom = "1";
        zoneClone.style.transform = "none";
      });

      backClone.style.borderLeft = "3px solid #b8d6e5";
      pane.append(frontClone, backClone);
      return pane;
    };

    const createMergedCapturePane = () => {
      const pane = document.createElement("div");
      pane.style.display = "inline-flex";
      pane.style.alignItems = "flex-start";
      pane.style.gap = "18px";
      pane.style.padding = "0";
      pane.style.margin = "0";
      pane.style.background = "#ffffff";
      pane.style.zoom = "1";
      pane.style.transform = "none";
      pane.style.width = "max-content";
      pane.style.minWidth = "0";
      pane.style.maxWidth = "none";
      pane.style.overflow = "visible";

      const frontPane = createCapturePane(1, compareCaptureSplitRow);
      const backPane = createCapturePane(compareCaptureSplitRow + 1, rows);
      [frontPane, backPane].forEach((capturePane) => {
        capturePane.style.flex = "0 0 auto";
      });
      pane.append(frontPane, backPane);
      return pane;
    };

    const styleCapturePane = (pane) => {
      pane.querySelectorAll('.cell[data-zone="front"]:not([data-pick="true"])').forEach((cell) => {
        cell.style.background = "#ffe9e7";
        cell.style.color = "#e06f66";
      });
      pane.querySelectorAll('.cell[data-zone="back"]:not([data-pick="true"])').forEach((cell) => {
        cell.style.background = "#edf6ff";
        cell.style.color = "#6f9ecf";
      });
      pane.querySelectorAll('.cell[data-pick="true"]').forEach((cell) => {
        cell.style.background = "#fff6d8";
        cell.style.color = "#b3913a";
      });
      pane.querySelectorAll('.cell[data-pick="true"][data-zone="back"]').forEach((cell) => {
        cell.style.background = "#eaf8f0";
        cell.style.color = "#58a07b";
      });
      pane.querySelectorAll(".ball").forEach((cloneBall) => {
        const sourceColor = cloneBall.dataset.color || cloneBall.style.getPropertyValue("--ball-color");
        const boostedColor = boostCaptureBallColor(sourceColor);
        cloneBall.style.background = boostedColor;
        cloneBall.style.color = "#ffffff";
        cloneBall.style.boxShadow = "0 2px 4px rgba(31, 41, 55, 0.28)";
        cloneBall.style.border = "1px solid rgba(255, 255, 255, 0.3)";
        cloneBall.style.setProperty("--ball-color", boostedColor);
      });
    };

    document.body.append(captureHost);
    const captures = [
      { pane: createCapturePane(1, compareCaptureSplitRow), suffix: rows > compareCaptureSplitRow ? `前${compareCaptureSplitRow}行` : `${rows}行` },
    ];
    if (rows > compareCaptureSplitRow) {
      captures.push({ pane: createCapturePane(compareCaptureSplitRow + 1, rows), suffix: `后${rows - compareCaptureSplitRow}行` });
      captures.push({ pane: createMergedCapturePane(), suffix: `前${compareCaptureSplitRow}行-后${rows - compareCaptureSplitRow}行合并` });
    }

    for (const capture of captures) {
      styleCapturePane(capture.pane);
      captureHost.append(capture.pane);
      await new Promise((resolve) => globalThis.requestAnimationFrame(() => resolve()));

      const captureWidth = Math.ceil(Math.max(capture.pane.scrollWidth, capture.pane.offsetWidth, capture.pane.getBoundingClientRect().width));
      const captureHeight = Math.ceil(Math.max(capture.pane.scrollHeight, capture.pane.offsetHeight, capture.pane.getBoundingClientRect().height));

      const canvas = await globalThis.html2canvas(capture.pane, {
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
      link.download = `${filenameBase}-${capture.suffix}.png`;
      link.click();
      capture.pane.remove();
    }
    comparePageHint.textContent =
      rows > compareCaptureSplitRow
        ? `已生成前${compareCaptureSplitRow}行、后${rows - compareCaptureSplitRow}行和左右合并截图。`
        : `已生成${rows}行截图。`;
  } catch (error) {
    console.error(error);
    comparePageHint.textContent = "截图失败，请稍后重试。";
  } finally {
    captureHost?.remove();
    captureCompareBoardButton.disabled = false;
    captureCompareBoardButton.textContent = previousText || "截图";
  }
}

function goToMainPage() {
  const params = new URLSearchParams();
  params.set("from", "compare");
  if (currentBaseTitle) params.set("title", currentBaseTitle);
  globalThis.location.href = `./index.html?${params.toString()}`;
}

function getActiveCompareSelectedIds() {
  const selectIds = compareSelects.map((select) => select?.value || "").filter(Boolean);
  if (selectIds.length > 0) return [...new Set(selectIds)];
  return [...new Set((Array.isArray(compareSelectedIds) ? compareSelectedIds : []).filter(Boolean))];
}

function goToCompareTargetPage(targetPage, targetCount, targetContextKey) {
  persistDraft();
  const selectedIds = getActiveCompareSelectedIds().slice(0, targetCount);
  writeStorage(targetContextKey, {
    sourceVersionId: selectedIds[0] || "",
    selectedIds,
    updatedAt: Date.now(),
  });
  globalThis.location.href = targetPage;
}

function goToCompare90Page() {
  goToCompareTargetPage(compare90PagePath, 3, compare90ContextStorageKey);
}

function goToCompare180Page() {
  goToCompareTargetPage(compare180PagePath, 6, compare180ContextStorageKey);
}

function unlockPage() {
  comparePageRoot.hidden = false;
  comparePageLock.classList.add("is-hidden");
  sessionStorage.setItem(pageAuthStorageKey, "true");
  renderVersions();
}

function scrollToSection(selector) {
  document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

toggleComparePagePasswordButton.addEventListener("click", () => {
  const showing = comparePagePassword.type === "text";
  comparePagePassword.type = showing ? "password" : "text";
  toggleComparePagePasswordButton.textContent = showing ? "显示" : "隐藏";
});

unlockComparePageButton.addEventListener("click", () => {
  if (passwordMatches(comparePagePassword.value, pagePasswordValue)) {
    comparePagePassword.value = "";
    unlockPage();
    return;
  }
  comparePageAuthMessage.textContent = "密码错误，请重新输入。";
  comparePagePassword.select();
});

comparePagePassword.addEventListener("keydown", (event) => {
  if (event.key === "Enter") unlockComparePageButton.click();
});

unlockCompareVersionsButton.addEventListener("click", () => {
  if (passwordMatches(compareVersionPassword.value, versionPasswordValue)) {
    versionsUnlocked = true;
    sessionStorage.setItem(versionAuthStorageKey, "true");
    compareVersionPassword.value = "";
    renderVersions();
    return;
  }
  comparePageHint.textContent = "版本库密码错误，请重新输入。";
  compareVersionPassword.select();
});

compareVersionPassword.addEventListener("keydown", (event) => {
  if (event.key === "Enter") unlockCompareVersionsButton.click();
});

lockCompareVersionsButton.addEventListener("click", () => {
  versionsUnlocked = false;
  sessionStorage.removeItem(versionAuthStorageKey);
  renderVersions();
});

compareVersionSearch.addEventListener("input", renderVersions);
downloadCompareVersionsButton.addEventListener("click", downloadVersionsFile);
importCompareVersionsInput.addEventListener("change", async () => {
  const file = importCompareVersionsInput.files?.[0];
  await importVersionsFile(file);
  importCompareVersionsInput.value = "";
});
compareZoneInput.addEventListener("change", () => {
  const zone = compareZoneInput.value;
  compareNumberInput.max = zones[zone].max;
  compareNumberInput.value = clamp(compareNumberInput.value, 1, zones[zone].max);
});
compareSizeInput.addEventListener("input", () => {
  document.documentElement.style.setProperty("--ball-size", `${compareSizeInput.value}px`);
});
compareZoomInput.addEventListener("input", () => {
  userAdjustedZoom = true;
  document.documentElement.style.setProperty("--board-zoom", `${compareZoomInput.value / 100}`);
});
compareColorInput.addEventListener("input", () => {
  compareSwatches.forEach((swatch) => swatch.classList.remove("active"));
});
compareSwatches.forEach((swatch) => {
  swatch.addEventListener("click", () => setColor(swatch.dataset.color));
});
compareAddBallButton.addEventListener("click", () => {
  const row = clamp(compareRowInput.value, 1, rows);
  const zone = compareZoneInput.value;
  const number = clamp(compareNumberInput.value, 1, zones[zone].max);
  syncInputs(row, zone, number);
  addBall(row, zone, number, pad(number), compareColorInput.value, true);
});
compareAddDividerButton.addEventListener("click", () => {
  const row = clamp(compareRowInput.value, 1, rows);
  compareRowInput.value = row;
  addDividerRow(row, compareColorInput.value, true);
});
compareDeleteColorButton.addEventListener("click", () => {
  const targetColor = normalizeColor(compareColorInput.value);
  [...compareBoard.querySelectorAll(".ball")]
    .filter((ball) => normalizeColor(ball.dataset.color) === targetColor)
    .forEach((ball) => removeBall(ball.closest(".cell")));
});
compareClearBoardButton.addEventListener("click", clearBoard);
compareSelects.forEach((select) => {
  select.addEventListener("change", () => {
    compareSelectedIds = compareSelects.map((item) => item?.value || "");
    persistDraft();
  });
});

loadCompareVersionsButton.addEventListener("click", loadCompareVersionsToBoard);
saveCompareBoardButton.addEventListener("click", saveCurrentBoardAsVersion);
saveCompareBoardButtonInline.addEventListener("click", saveCurrentBoardAsVersion);
clearCompareBoardButton.addEventListener("click", clearBoard);
captureCompareBoardButton.addEventListener("click", captureBoard);

[backToMainPageTop, backToMainPageButton, backToMainPageInline].forEach((button) => {
  button?.addEventListener("click", goToMainPage);
});

comparePageSwitchButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.switchPage || "";
    if (target === "compare90") {
      goToCompare90Page();
      return;
    }
    if (target === "compare180") {
      goToCompare180Page();
      return;
    }
    if (target === "main") goToMainPage();
  });
});

jumpToCompareControls.addEventListener("click", () => scrollToSection("#compareControlPanel"));
jumpToCompareBoard.addEventListener("click", () => scrollToSection("#compareBoardPanel"));
jumpToCompareVersions.addEventListener("click", () => scrollToSection("#compareVersionsPanel"));

compareBoard.addEventListener("click", (event) => {
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
  addBall(row, zone, number, pad(number), compareColorInput.value, true);
});

buildBoard();
const restored = restoreDraft();
if (!restored) {
  updateRowLabels();
  updateBaseLabel();
  updateVersionBanner();
  updateCount();
}
renderVersions();
compareSizeInput.value = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--ball-size"), 10);
fitBoardToScreen(true);
globalThis.addEventListener("resize", () => fitBoardToScreen());

if (sessionStorage.getItem(pageAuthStorageKey) === "true") {
  unlockPage();
}
