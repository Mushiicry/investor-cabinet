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

  const result = {
    success: true,
    patch: "SITE API - PATCH 1.1",
    updatedAt: new Date().toISOString(),

    overview: getOverview(overview),
    portfolio: getPortfolio(portfolio),
    risk: getRisk(risk),
    decisions: getDecisions(decisions),
    scenarios: getScenarios(scenarios)
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
