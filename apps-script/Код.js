function parseNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  return Number(String(value).replace(/\s/g, "").replace(",", ".").replace("%", ""));
}

function doGet() {
  const ss = SpreadsheetApp.openById("1bk_Ex8Kl6jSlcxDNV0BIBio0CRTFK_jyRdB5-06Mpm8");

  const overview = ss.getSheetByName("Обзор");
  const portfolio = ss.getSheetByName("Портфель");
  const risk = ss.getSheetByName("Риск");
  const decisions = ss.getSheetByName("Решения");
  const scenarios = ss.getSheetByName("Сценарии");
  const overviewData = getOverview(overview);

  const result = {
    success: true,
    patch: "SITE API - PATCH 1.1",
    updatedAt: new Date().toISOString(),

    overview: overviewData,
    portfolio: getPortfolio(portfolio),
    risk: getRisk(risk),
    decisions: getDecisions(decisions),
    scenarios: getScenarios(scenarios),
    fearGreedStrategy: getFearGreedStrategy(ss, overviewData.portfolioValue)
  };

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOverview(sheet) {
  const invested = parseNumber(sheet.getRange("N6").getDisplayValue());
  const portfolioValue = parseNumber(sheet.getRange("N7").getDisplayValue());
  const pnl = portfolioValue - invested;

  return {
    investedLabel: sheet.getRange("M6").getDisplayValue(),
    invested: invested,

    portfolioLabel: sheet.getRange("M7").getDisplayValue(),
    portfolioValue: portfolioValue,

    pnlLabel: sheet.getRange("M8").getDisplayValue(),
    pnl: pnl,

    pnlPct: invested ? pnl / invested : 0,
    reserve: parseNumber(sheet.getRange("E2").getDisplayValue()),
    positionsCount: parseNumber(sheet.getRange("F2").getDisplayValue()),

    health: parseNumber(sheet.getRange("H2").getDisplayValue()),
    state: sheet.getRange("I2").getDisplayValue(),
    signal: sheet.getRange("J2").getDisplayValue(),
    action: sheet.getRange("K2").getDisplayValue(),

    bestPosition: {
      asset: sheet.getRange("Q1").getDisplayValue(),
      pnl: parseNumber(sheet.getRange("Q2").getDisplayValue())
    },

    worstPosition: {
      asset: sheet.getRange("Q3").getDisplayValue(),
      pnl: parseNumber(sheet.getRange("Q4").getDisplayValue())
    }
  };
}

function getPortfolio(sheet) {
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  // Берем A:L, потому что статус у нас в L
  const rows = sheet.getRange(2, 1, lastRow - 1, 12).getDisplayValues();

  return rows
    .filter(row => row[0])
    .map(row => {
      const asset = row[0];

      return {
        asset: asset,
        ticker: row[1],
        category: getCategoryByAsset(asset),

        quantity: parseNumber(row[3]),
        avgEntry: parseNumber(row[4]),
        invested: parseNumber(row[5]),
        currentPrice: parseNumber(row[6]),
        currentValue: parseNumber(row[7]),
        pnl: parseNumber(row[8]),
        pnlPct: parseNumber(row[9]),
        share: parseNumber(row[10]),
        status: row[11]
      };
    });
}

function getCategoryByAsset(asset) {
  const a = String(asset || "").toUpperCase();

  if (a === "USDT" || a === "USDC") return "Свободные деньги";
  if (a.includes("GOLD") || a.includes("PAXG")) return "Металлы";
  if (a.includes("SHORT") || a.includes("PERP")) return "Фьючерсы";
  return "Крипта";
}

function getRisk(sheet) {
  if (!sheet) return null;

  return {
    portfolioValue: parseNumber(sheet.getRange("B2").getDisplayValue()),
    reserve: parseNumber(sheet.getRange("B3").getDisplayValue()),
    reserveShare: parseNumber(sheet.getRange("B4").getDisplayValue()),
    deployableCash: parseNumber(sheet.getRange("B5").getDisplayValue()),
    largestRiskAsset: sheet.getRange("B6").getDisplayValue(),
    largestRiskShare: parseNumber(sheet.getRange("B7").getDisplayValue()),
    cryptoShare: parseNumber(sheet.getRange("B8").getDisplayValue()),
    health: parseNumber(sheet.getRange("B9").getDisplayValue()),
    state: sheet.getRange("B10").getDisplayValue(),
    signal: sheet.getRange("B11").getDisplayValue(),
    summary: sheet.getRange("B12").getDisplayValue()
  };
}

function getDecisions(sheet) {
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const rows = sheet.getRange(2, 1, lastRow - 1, 7).getValues();

  return rows
    .filter(row => row[0])
    .map(row => ({
      asset: row[0],
      thesis: row[1],
      whyHold: row[2],
      expect: row[3],
      nextAction: row[4],
      reviewTrigger: row[5],
      status: row[6]
    }));
}

function getScenarios(sheet) {
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const rows = sheet.getRange(2, 1, lastRow - 1, 7).getValues();

  return rows
    .filter(row => row[0])
    .map(row => ({
      asset: row[0],
      base: row[1],
      bull: row[2],
      bear: row[3],
      action: row[4],
      invalidation: row[5],
      status: row[6]
    }));
}

function getFearGreedStrategy(ss, portfolioValue) {
  const currentIndex = getFearGreedCurrentIndex(ss);
  const sheet = getOrCreateFearGreedRulesSheet(ss);
  const now = new Date();
  let rules = readFearGreedRules(sheet);
  const currentMode = getFearGreedMode(currentIndex, rules);

  const autoMark = autoMarkFearGreedFromRecentStrategyImport(ss, sheet, rules, currentMode, portfolioValue, now);
  if (autoMark.marked) rules = readFearGreedRules(sheet);

  const apiRules = rules.map(rule => buildFearGreedRuleState(rule, currentIndex, currentMode, portfolioValue, now));
  writeFearGreedComputedState(sheet, apiRules);

  return {
    currentIndex: currentIndex,
    currentMode: currentMode,
    portfolioValue: portfolioValue,
    rules: apiRules
  };
}

function autoMarkFearGreedFromRecentStrategyImport(ss, rulesSheet, rules, currentMode, portfolioValue, now) {
  const ruleIndex = rules.findIndex(rule => rule.mode === currentMode);
  if (ruleIndex < 0) return { marked: false, reason: "missing_current_rule" };

  const rule = rules[ruleIndex];
  if (!rule.buyPct || !rule.cooldownDays) return { marked: false, reason: "mode_has_no_buy" };

  const lastBuyDate = parseFearGreedDate(rule.lastBuyAt);
  const nextAvailableDate = lastBuyDate ? addFearGreedDays(lastBuyDate, rule.cooldownDays) : null;
  if (nextAvailableDate && nextAvailableDate.getTime() > now.getTime()) {
    return { marked: false, reason: "already_on_cooldown" };
  }

  const importSheet = ss.getSheetByName("Транзакции_IMPORT");
  if (!importSheet || importSheet.getLastRow() < 2) return { marked: false, reason: "missing_import_sheet" };

  const lookbackRows = Math.min(importSheet.getLastRow() - 1, 20);
  const rows = importSheet.getRange(importSheet.getLastRow() - lookbackRows + 1, 1, lookbackRows, 19).getValues();
  const expectedAmount = portfolioValue * rule.buyPct;
  const tolerance = Math.max(0.35, expectedAmount * 0.15);

  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    const importId = String(row[0] || "");
    const action = String(row[5] || "").trim();
    const asset = String(row[3] || "").trim().toUpperCase();
    const chain = String(row[11] || "").trim().toUpperCase();
    const comment = String(row[9] || "");
    const amount = parseNumber(row[8]);
    const note = String(row[18] || "");
    const isSolanaBalanceDelta = importId.indexOf("SOLANA_BALANCE_DELTA") === 0 || comment.indexOf("Solana wallet balance delta") >= 0;
    const boughtAt = parseFearGreedImportDate(note) || parseFearGreedImportIdDate(importId) || parseFearGreedDate(row[2]) || now;
    const ageHours = Math.abs(now.getTime() - boughtAt.getTime()) / 3600000;

    if (!isSolanaBalanceDelta) continue;
    if (action !== "Покупка" || asset !== "SOL") continue;
    if (chain && chain !== "SOLANA") continue;
    if (ageHours > 36) continue;
    if (Math.abs(amount - expectedAmount) > tolerance) continue;

    rulesSheet.getRange(ruleIndex + 2, 7).setValue(formatFearGreedDate(boughtAt));
    return {
      marked: true,
      currentMode: currentMode,
      buyAmount: roundFearGreed(amount, 2),
      expectedAmount: roundFearGreed(expectedAmount, 2),
      lastBuyAt: formatFearGreedDate(boughtAt)
    };
  }

  return { marked: false, reason: "no_recent_strategy_import" };
}

function markFearGreedStrategyBuy(ss, buyAmount, boughtAt) {
  const amount = Number(buyAmount || 0);
  if (!amount || amount <= 0) return { marked: false, reason: "empty_buy_amount" };

  const currentIndex = getFearGreedCurrentIndex(ss);
  const sheet = getOrCreateFearGreedRulesSheet(ss);
  const rules = readFearGreedRules(sheet);
  const currentMode = getFearGreedMode(currentIndex, rules);
  const ruleIndex = rules.findIndex(rule => rule.mode === currentMode);
  if (ruleIndex < 0) return { marked: false, reason: "missing_current_rule", currentMode: currentMode };

  const rule = rules[ruleIndex];
  if (!rule.buyPct || !rule.cooldownDays) {
    return { marked: false, reason: "mode_has_no_buy", currentMode: currentMode };
  }

  const now = boughtAt || new Date();
  const portfolioValue = getOverviewData(ss).portfolioValue;
  const expectedAmount = portfolioValue * rule.buyPct;
  const tolerance = Math.max(0.35, expectedAmount * 0.15);
  if (Math.abs(amount - expectedAmount) > tolerance) {
    return {
      marked: false,
      reason: "amount_outside_strategy_band",
      currentMode: currentMode,
      buyAmount: roundFearGreed(amount, 2),
      expectedAmount: roundFearGreed(expectedAmount, 2)
    };
  }

  const lastBuyDate = parseFearGreedDate(rule.lastBuyAt);
  const nextAvailableDate = lastBuyDate ? addFearGreedDays(lastBuyDate, rule.cooldownDays) : null;
  if (nextAvailableDate && nextAvailableDate.getTime() > now.getTime()) {
    return {
      marked: false,
      reason: "already_on_cooldown",
      currentMode: currentMode,
      nextAvailableAt: formatFearGreedDate(nextAvailableDate)
    };
  }

  sheet.getRange(ruleIndex + 2, 7).setValue(formatFearGreedDate(now));
  getFearGreedStrategy(ss, portfolioValue);

  return {
    marked: true,
    currentMode: currentMode,
    buyAmount: roundFearGreed(amount, 2),
    expectedAmount: roundFearGreed(expectedAmount, 2),
    lastBuyAt: formatFearGreedDate(now),
    nextAvailableAt: formatFearGreedDate(addFearGreedDays(now, rule.cooldownDays))
  };
}

function markFearGreedCurrentModeBuyNow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const portfolioValue = getOverviewData(ss).portfolioValue;
  const currentIndex = getFearGreedCurrentIndex(ss);
  const rules = readFearGreedRules(getOrCreateFearGreedRulesSheet(ss));
  const currentMode = getFearGreedMode(currentIndex, rules);
  const currentRule = rules.find(rule => rule.mode === currentMode);
  const buyAmount = currentRule ? portfolioValue * currentRule.buyPct : 0;

  return markFearGreedStrategyBuy(ss, buyAmount, new Date());
}

function getFearGreedCurrentIndex(ss) {
  const sheet = ss.getSheetByName("Настройки");
  if (!sheet) return 50;

  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return 50;

  const rows = sheet.getRange(1, 1, lastRow, 2).getDisplayValues();
  for (let i = 0; i < rows.length; i += 1) {
    if (String(rows[i][0]).trim() === "fearGreedValue") {
      const value = parseNumber(rows[i][1]);
      return Math.max(0, Math.min(100, Math.round(value || 50)));
    }
  }

  return 50;
}

function getOrCreateFearGreedRulesSheet(ss) {
  const sheetName = "FearGreedRules";
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  const headers = [
    "mode",
    "minIndex",
    "maxIndex",
    "label",
    "buyPct",
    "cooldownDays",
    "lastBuyAt",
    "nextAvailableAt",
    "isAvailable",
    "buyAmount",
    "status"
  ];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  const needsHeaders = headers.some((header, index) => currentHeaders[index] !== header);
  if (needsHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  if (sheet.getLastRow() < 5) {
    sheet.getRange(2, 1, 4, headers.length).setValues(getDefaultFearGreedRules().map(rule => [
      rule.mode,
      rule.minIndex,
      rule.maxIndex,
      rule.label,
      rule.buyPct,
      rule.cooldownDays,
      "",
      "",
      false,
      0,
      "Passive"
    ]));
  }

  return sheet;
}

function getDefaultFearGreedRules() {
  return [
    { mode: "observation", minIndex: 30, maxIndex: 100, label: "Наблюдение", buyPct: 0, cooldownDays: 0 },
    { mode: "cautious", minIndex: 20, maxIndex: 29, label: "Осторожная покупка", buyPct: 0.01, cooldownDays: 7 },
    { mode: "strong", minIndex: 15, maxIndex: 19, label: "Усиленная покупка", buyPct: 0.015, cooldownDays: 7 },
    { mode: "aggressive", minIndex: 0, maxIndex: 14, label: "Агрессивная покупка", buyPct: 0.02, cooldownDays: 7 }
  ];
}

function readFearGreedRules(sheet) {
  const defaults = getDefaultFearGreedRules();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return defaults;

  const rows = sheet.getRange(2, 1, Math.min(lastRow - 1, 4), 7).getValues();
  return rows.map((row, index) => {
    const fallback = defaults[index];
    return {
      mode: String(row[0] || fallback.mode),
      minIndex: parseNumber(row[1] || fallback.minIndex),
      maxIndex: parseNumber(row[2] || fallback.maxIndex),
      label: String(row[3] || fallback.label),
      buyPct: parseNumber(row[4] === "" ? fallback.buyPct : row[4]),
      cooldownDays: parseNumber(row[5] === "" ? fallback.cooldownDays : row[5]),
      lastBuyAt: row[6] || ""
    };
  });
}

function getFearGreedMode(index, rules) {
  const matchingRule = rules.find(rule => index >= rule.minIndex && index <= rule.maxIndex);
  return matchingRule ? matchingRule.mode : "observation";
}

function buildFearGreedRuleState(rule, currentIndex, currentMode, portfolioValue, now) {
  const lastBuyDate = parseFearGreedDate(rule.lastBuyAt);
  const nextAvailableDate = lastBuyDate && rule.cooldownDays
    ? addFearGreedDays(lastBuyDate, rule.cooldownDays)
    : null;
  const cooldownRemainingHours = nextAvailableDate
    ? Math.max(0, Math.ceil((nextAvailableDate.getTime() - now.getTime()) / 3600000))
    : 0;
  const hasCooldown = rule.buyPct > 0 && cooldownRemainingHours > 0;
  const isAvailable = rule.buyPct > 0 && !hasCooldown;
  const isCurrent = rule.mode === currentMode;
  const status = hasCooldown ? "cooldown" : (isCurrent && isAvailable ? "active" : "passive");

  return {
    mode: rule.mode,
    range: rule.minIndex + "-" + rule.maxIndex,
    label: rule.label,
    buyPct: rule.buyPct,
    buyAmount: roundFearGreed(portfolioValue * rule.buyPct, 2),
    cooldownDays: rule.cooldownDays,
    lastBuyAt: lastBuyDate ? formatFearGreedDate(lastBuyDate) : null,
    nextAvailableAt: nextAvailableDate ? formatFearGreedDate(nextAvailableDate) : null,
    isCurrent: isCurrent,
    isAvailable: isAvailable,
    cooldownRemainingHours: cooldownRemainingHours,
    status: status
  };
}

function writeFearGreedComputedState(sheet, rules) {
  const rows = rules.map(rule => [
    rule.nextAvailableAt || "",
    rule.isAvailable,
    rule.buyAmount,
    rule.status === "active" ? "Active" : rule.status === "cooldown" ? "Cooldown" : "Passive"
  ]);

  sheet.getRange(2, 8, rows.length, 4).setValues(rows);
}

function parseFearGreedDate(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) return value;

  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function parseFearGreedImportDate(value) {
  const match = String(value || "").match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  return match ? parseFearGreedDate(match[0]) : null;
}

function parseFearGreedImportIdDate(value) {
  const match = String(value || "").match(/(\d{8})T(\d{6})/);
  if (!match) return null;

  const datePart = match[1];
  const timePart = match[2];
  return parseFearGreedDate(
    datePart.slice(0, 4) + "-" +
    datePart.slice(4, 6) + "-" +
    datePart.slice(6, 8) + "T" +
    timePart.slice(0, 2) + ":" +
    timePart.slice(2, 4) + ":" +
    timePart.slice(4, 6)
  );
}

function addFearGreedDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + Number(days || 0));
  return next;
}

function formatFearGreedDate(date) {
  return Utilities.formatDate(date, "UTC", "yyyy-MM-dd'T'HH:mm:ss'Z'");
}

function roundFearGreed(value, digits) {
  const factor = Math.pow(10, digits || 0);
  return Math.round(Number(value || 0) * factor) / factor;
}
