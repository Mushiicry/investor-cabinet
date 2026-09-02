function parseNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const normalized = String(value)
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace("%", "")
    .replace(/[^\d.+-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePortfolioPnlPct(pnlPct, invested, pnl) {
  if (!Number.isFinite(pnlPct)) return 0;
  if (!invested) return pnlPct;

  const moneyPct = (pnl / invested) * 100;
  if (!Number.isFinite(moneyPct)) return pnlPct;

  const isClearlyBrokenPct =
    Math.abs(pnlPct) > 500 ||
    Math.abs(pnlPct - moneyPct) > Math.max(25, Math.abs(moneyPct) * 4);

  if (isClearlyBrokenPct) return moneyPct;

  if (Math.abs(pnlPct) < 1000) return pnlPct;

  const scaledPct = pnlPct / 100;

  if (Math.abs(scaledPct) < Math.abs(pnlPct) && Math.abs(scaledPct) <= 500) {
    return scaledPct;
  }

  return moneyPct;
}

function doGet(e) {
  const accountId = e && e.parameter && e.parameter.accountId === "wife" ? "wife" : "main";

  // Запись достигнутого уровня (лестница на сайте): ?action=setMaxLevel&level=N.
  // Авторизацию владельца обеспечивает Vercel-прокси (Supabase), сюда чужие
  // запросы не доходят. Запись монотонная — понизить уровень нельзя.
  if (e && e.parameter && e.parameter.action === "setMaxLevel") {
    const ss = SpreadsheetApp.openById("1bk_Ex8Kl6jSlcxDNV0BIBio0CRTFK_jyRdB5-06Mpm8");
    return IC_PROGRESS_handleSetMaxLevel_(ss, e.parameter.level);
  }

  if (e && e.parameter && e.parameter.action === "listTradeCases") {
    const ss = SpreadsheetApp.openById("1bk_Ex8Kl6jSlcxDNV0BIBio0CRTFK_jyRdB5-06Mpm8");
    return IC_TRADE_CASE_handleList_(ss, accountId);
  }

  if (accountId === "wife" && e && e.parameter && e.parameter.action === "syncWifeDailySnapshot") {
    return IC_WIFE_API_json_(IC_WIFE_API.syncDailySnapshot());
  }

  if (accountId === "wife" && e && e.parameter && e.parameter.action === "recordWifeDailySnapshot") {
    return IC_WIFE_API_json_(IC_WIFE_API.recordDailySnapshot(e.parameter));
  }

  if (accountId === "wife" && e && e.parameter && e.parameter.action === "setupWifeDailySnapshotTrigger") {
    return IC_WIFE_API_json_(IC_WIFE_API.setupDailySnapshotTrigger());
  }

  if (accountId === "wife" && e && e.parameter && e.parameter.action === "testWifeMorningTelegram") {
    return IC_WIFE_API_json_(testWifeMorningTelegram());
  }

  if (accountId === "wife" && e && e.parameter && e.parameter.action === "setupWifeMorningTelegram") {
    return IC_WIFE_API_json_(setupWifeMorningTelegram());
  }

  if (accountId === "wife") {
    try {
      return ContentService
        .createTextOutput(JSON.stringify(IC_WIFE_API.buildPortfolioJson()))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: error && error.message ? error.message : "Wife portfolio API failed",
          updatedAt: new Date().toISOString()
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  const ss = SpreadsheetApp.openById("1bk_Ex8Kl6jSlcxDNV0BIBio0CRTFK_jyRdB5-06Mpm8");
  const overview = ss.getSheetByName("Обзор");
  const portfolio = ss.getSheetByName("Портфель");
  const calculations = ss.getSheetByName("Расчеты");
  const risk = ss.getSheetByName("Риск");
  const decisions = ss.getSheetByName("Решения");
  const scenarios = ss.getSheetByName("Сценарии");
  const signals = ss.getSheetByName("Сигналы");
  const history = ss.getSheetByName("История");
  const transactions = ss.getSheetByName("Транзакции_IMPORT");
  const assetQuality =
    ss.getSheetByName("Качество активов") ||
    ss.getSheetByName("Качество_активов") ||
    ss.getSheetByName("AssetQuality");
  const overviewData = getOverview(overview);
  attachRealizedProfit(overviewData, calculations);
  const portfolioSource = calculations || portfolio;

  const result = {
    success: true,
    patch: "SITE API - PATCH 1.1",
    updatedAt: new Date().toISOString(),

    overview: overviewData,
    portfolio: getPortfolio(portfolioSource),
    risk: getRisk(risk),
    decisions: getDecisions(decisions),
    scenarios: getScenarios(scenarios),
    signals: getSignals(signals),
    history: getHistory(history),
    transactions: getTransactions(transactions),
    assetQuality: getAssetQuality(assetQuality),
    investorDNA: IC_DNA_getInvestorDNA_(ss, accountId),
    fearGreedStrategy: getFearGreedStrategyReadOnly(ss, overviewData.invested),
    // Достигнутый уровень лестницы (лист «Прогресс», монотонный) — общий
    // для всех устройств; localStorage на сайте остаётся офлайн-кэшем.
    progress: { maxLevel: IC_PROGRESS_readMaxLevel_(ss) }
  };

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function syncWifeDailySnapshot() {
  return IC_WIFE_API.syncDailySnapshot();
}

function setupWifeDailySnapshotTrigger() {
  return IC_WIFE_API.setupDailySnapshotTrigger();
}

function removeWifeDailySnapshotTrigger() {
  return IC_WIFE_API.removeDailySnapshotTrigger();
}

function IC_WIFE_API_json_(result) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      snapshot: result,
      updatedAt: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const ss = SpreadsheetApp.openById("1bk_Ex8Kl6jSlcxDNV0BIBio0CRTFK_jyRdB5-06Mpm8");
  const action = e && e.parameter && e.parameter.action;
  const accountId = e && e.parameter && e.parameter.accountId === "wife" ? "wife" : "main";

  if (action === "saveInvestorDNAAnswers") {
    return IC_DNA_handleSaveAnswers_(ss, e);
  }

  if (action === "createSignalLimitLevel") {
    return IC_SIGNAL_ALERT_handleCreateLimitLevel_(ss, e);
  }

  if (action === "deleteSignalLimitLevel") {
    return IC_SIGNAL_ALERT_handleDeleteLimitLevel_(ss, e);
  }

  if (action === "upsertTradeCases") {
    return IC_TRADE_CASE_handleUpsert_(ss, e, accountId);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: "Unsupported action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

const IC_DNA_PROFILE_SHEET = "ДНК_Профили";
const IC_DNA_RECOMMENDATIONS_SHEET = "ДНК_Рекомендации";
const IC_DNA_ANSWERS_SHEET = "ДНК_Ответы";
const IC_DNA_RESULTS_SHEET = "ДНК_Результаты";

const IC_DNA_ANSWER_HEADERS = [
  "auditId",
  "accountId",
  "auditType",
  "questionId",
  "option",
  "note",
  "answeredAt",
  "source"
];

const IC_DNA_RESULT_HEADERS = [
  "auditId",
  "accountId",
  "auditType",
  "submittedAt",
  "answeredCount",
  "totalQuestions",
  "profileId",
  "investorType",
  "riskWillingness",
  "riskCapacity",
  "resultNote"
];

function IC_DNA_getInvestorDNA_(ss, accountId) {
  const profileSheet = ss.getSheetByName(IC_DNA_PROFILE_SHEET);
  if (!profileSheet || profileSheet.getLastRow() < 2) return null;

  const profile = IC_DNA_findRow_(profileSheet, "accountId", accountId);
  if (!profile) return null;

  return {
    id: IC_DNA_text_(profile.profileId),
    accountId: accountId,
    title: IC_DNA_text_(profile.title) || "ДНК Инвестора",
    investorType: IC_DNA_text_(profile.investorType),
    thesis: IC_DNA_text_(profile.thesis),
    riskWillingness: {
      label: IC_DNA_text_(profile.riskWillingnessLabel) || "Готовность к риску",
      value: IC_DNA_number_(profile.riskWillingnessValue),
      note: IC_DNA_text_(profile.riskWillingnessNote)
    },
    riskCapacity: {
      label: IC_DNA_text_(profile.riskCapacityLabel) || "Способность принимать риск",
      value: IC_DNA_number_(profile.riskCapacityValue),
      note: IC_DNA_text_(profile.riskCapacityNote)
    },
    horizon: IC_DNA_text_(profile.horizon),
    capitalGoal: IC_DNA_text_(profile.capitalGoal),
    benchmarkVerdict: IC_DNA_text_(profile.benchmarkVerdict),
    maxDrawdownRule: IC_DNA_text_(profile.maxDrawdownRule),
    stressDrawdown: IC_DNA_text_(profile.stressDrawdown),
    liquidityRule: IC_DNA_text_(profile.liquidityRule),
    tradingBudgetRule: IC_DNA_text_(profile.tradingBudgetRule),
    leverageRule: IC_DNA_text_(profile.leverageRule),
    keyVerdict: IC_DNA_text_(profile.keyVerdict),
    recommendations: IC_DNA_getRecommendations_(ss, accountId),
    answers: IC_DNA_getLatestAnswers_(ss, accountId),
    auditHistory: IC_DNA_getAuditHistory_(ss, accountId)
  };
}

function IC_DNA_handleSaveAnswers_(ss, e) {
  const payload = IC_DNA_parsePostPayload_(e);
  if (!payload) {
    return IC_DNA_json_({ success: false, error: "Invalid JSON payload" });
  }

  const accountId = payload.accountId === "wife" ? "wife" : "main";
  const auditType = payload.auditType === "full" ? "full" : "lite";
  const submittedAt = IC_DNA_text_(payload.submittedAt) || new Date().toISOString();
  const answers = Array.isArray(payload.answers) ? payload.answers : [];
  const auditId = [accountId, auditType, submittedAt.replace(/[^0-9A-Za-z]/g, "")].join("-");
  const answerSheet = IC_DNA_getOrCreateSheet_(ss, IC_DNA_ANSWERS_SHEET, IC_DNA_ANSWER_HEADERS);
  const resultSheet = IC_DNA_getOrCreateSheet_(ss, IC_DNA_RESULTS_SHEET, IC_DNA_RESULT_HEADERS);
  const now = new Date().toISOString();

  const answerRows = answers
    .filter(function(answer) {
      return answer && IC_DNA_text_(answer.questionId);
    })
    .map(function(answer) {
      return [
        auditId,
        accountId,
        auditType,
        IC_DNA_text_(answer.questionId),
        IC_DNA_text_(answer.option),
        IC_DNA_text_(answer.note),
        submittedAt,
        "site"
      ];
    });

  if (answerRows.length) {
    answerSheet.getRange(answerSheet.getLastRow() + 1, 1, answerRows.length, IC_DNA_ANSWER_HEADERS.length).setValues(answerRows);
  }

  const profile = IC_DNA_getInvestorDNA_(ss, accountId) || {};
  const resultRow = [[
    auditId,
    accountId,
    auditType,
    submittedAt,
    IC_DNA_number_(payload.answeredCount),
    IC_DNA_number_(payload.totalQuestions),
    IC_DNA_text_(profile.id),
    IC_DNA_text_(profile.investorType),
    profile.riskWillingness ? IC_DNA_number_(profile.riskWillingness.value) : 0,
    profile.riskCapacity ? IC_DNA_number_(profile.riskCapacity.value) : 0,
    "Ответы сохранены через сайт " + now
  ]];
  resultSheet.getRange(resultSheet.getLastRow() + 1, 1, 1, IC_DNA_RESULT_HEADERS.length).setValues(resultRow);

  return IC_DNA_json_({
    success: true,
    auditId: auditId,
    savedAnswers: answerRows.length,
    investorDNA: IC_DNA_getInvestorDNA_(ss, accountId)
  });
}

function IC_DNA_getRecommendations_(ss, accountId) {
  const sheet = ss.getSheetByName(IC_DNA_RECOMMENDATIONS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  return IC_DNA_readObjects_(sheet)
    .filter(function(row) { return IC_DNA_text_(row.accountId) === accountId; })
    .map(function(row) {
      return {
        id: IC_DNA_text_(row.id),
        priority: IC_DNA_text_(row.priority) || "medium",
        area: IC_DNA_text_(row.area) || "риск",
        title: IC_DNA_text_(row.title),
        action: IC_DNA_text_(row.action),
        reason: IC_DNA_text_(row.reason),
        expectedEffect: IC_DNA_text_(row.expectedEffect)
      };
    })
    .filter(function(row) { return row.id && row.title; });
}

function IC_DNA_getLatestAnswers_(ss, accountId) {
  const sheet = ss.getSheetByName(IC_DNA_ANSWERS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const rows = IC_DNA_readObjects_(sheet)
    .filter(function(row) { return IC_DNA_text_(row.accountId) === accountId; });
  const latestByQuestion = {};

  rows.forEach(function(row) {
    const questionId = IC_DNA_text_(row.questionId);
    if (!questionId) return;
    latestByQuestion[questionId] = row;
  });

  return Object.keys(latestByQuestion).map(function(questionId) {
    const row = latestByQuestion[questionId];
    return {
      auditId: IC_DNA_text_(row.auditId),
      accountId: accountId,
      auditType: IC_DNA_text_(row.auditType) === "full" ? "full" : "lite",
      questionId: questionId,
      option: IC_DNA_text_(row.option),
      note: IC_DNA_text_(row.note),
      answeredAt: IC_DNA_text_(row.answeredAt),
      source: IC_DNA_text_(row.source) || "google-sheets"
    };
  });
}

function IC_DNA_getAuditHistory_(ss, accountId) {
  const sheet = ss.getSheetByName(IC_DNA_RESULTS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  return IC_DNA_readObjects_(sheet)
    .filter(function(row) { return IC_DNA_text_(row.accountId) === accountId; })
    .map(function(row) {
      return {
        auditId: IC_DNA_text_(row.auditId),
        accountId: accountId,
        auditType: IC_DNA_text_(row.auditType) === "full" ? "full" : "lite",
        submittedAt: IC_DNA_text_(row.submittedAt),
        answeredCount: IC_DNA_number_(row.answeredCount),
        totalQuestions: IC_DNA_number_(row.totalQuestions),
        profileId: IC_DNA_text_(row.profileId),
        investorType: IC_DNA_text_(row.investorType),
        riskWillingness: IC_DNA_number_(row.riskWillingness),
        riskCapacity: IC_DNA_number_(row.riskCapacity),
        resultNote: IC_DNA_text_(row.resultNote)
      };
    });
}

function IC_DNA_getOrCreateSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function IC_DNA_findRow_(sheet, key, value) {
  const rows = IC_DNA_readObjects_(sheet);
  for (let i = 0; i < rows.length; i += 1) {
    if (IC_DNA_text_(rows[i][key]) === value) return rows[i];
  }
  return null;
}

function IC_DNA_readObjects_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return [];

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
  const headers = values[0].map(function(header) { return IC_DNA_text_(header); });

  return values.slice(1).map(function(row) {
    const item = {};
    headers.forEach(function(header, index) {
      if (header) item[header] = row[index];
    });
    return item;
  });
}

function IC_DNA_parsePostPayload_(e) {
  try {
    return JSON.parse(e && e.postData && e.postData.contents ? e.postData.contents : "{}");
  } catch (error) {
    return null;
  }
}

function IC_DNA_json_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function IC_DNA_text_(value) {
  return String(value === null || value === undefined ? "" : value).trim();
}

function IC_DNA_number_(value) {
  const parsed = Number(IC_DNA_text_(value).replace(",", ".").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getSignals(sheet) {
  if (!sheet || sheet.getLastRow() < 2) {
    return { interest: null, interestList: [] };
  }

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getDisplayValues();
  const interestList = rows
    .filter(row => {
      const status = String(row[7] || "").trim().toUpperCase();
      const telegram = String(row[10] || "").trim().toUpperCase();
      return (row[0] || row[1]) && status !== "CANCELLED" && telegram !== "CANCELLED";
    })
    .map(row => ({
      id: row[0],
      asset: row[1],
      action: row[2],
      amountUsd: parseNumber(row[3]),
      triggerPrice: parseNumber(row[4]),
      source: row[5],
      currentPrice: parseNumber(row[6]),
      status: row[7],
      lastCheck: row[8],
      triggeredAt: row[9],
      telegram: row[10],
      comment: row[11]
    }));

  return {
    interest: interestList[0] || null,
    interestList: interestList
  };
}

// Реализованный профит по закрытым/зафиксированным позициям — таблица O:U
// на «Расчетах». Ищем строку по метке (не по фиксированной ячейке), чтобы
// вставки строк не ломали ссылку.
function attachRealizedProfit(overviewData, calculations) {
  overviewData.realizedPnl = 0;
  overviewData.realizedPnlPct = 0;
  if (!calculations) return;

  const labels = calculations.getRange("O1:O30").getDisplayValues();
  for (let i = 0; i < labels.length; i += 1) {
    const label = String(labels[i][0]).trim();
    if (label === "realizedProfitUsd") {
      overviewData.realizedPnl = parseNumber(calculations.getRange(i + 1, 20).getDisplayValue());
    }
    if (label === "realizedProfitPct") {
      overviewData.realizedPnlPct = parseNumber(calculations.getRange(i + 1, 21).getDisplayValue());
    }
  }
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

  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const rows = sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues();
  const columns = getPortfolioColumns(headers);

  return rows
    .filter(row => row[columns.asset])
    .map(row => {
      const asset = row[columns.asset];
      const category = normalizePortfolioCategoryForApi(
        getPortfolioCell(row, columns.category),
        asset
      );
      const quantity = parseNumber(getPortfolioCell(row, columns.quantity));
      const invested = parseNumber(getPortfolioCell(row, columns.invested));
      const currentValue = parseNumber(getPortfolioCell(row, columns.currentValue));
      const pnl = parseNumber(getPortfolioCell(row, columns.pnl));
      const rawStatus = getPortfolioCell(row, columns.status);
      const ticker = getTickerByAsset(getPortfolioCell(row, columns.ticker) || asset);

      return {
        asset: asset,
        ticker: ticker || getTickerByAsset(asset),
        category: category,

        quantity: quantity,
        avgEntry: parseNumber(getPortfolioCell(row, columns.avgEntry)),
        invested: invested,
        currentPrice: parseNumber(getPortfolioCell(row, columns.currentPrice)),
        currentValue: currentValue,
        pnl: pnl,
        pnlPct: normalizePortfolioPnlPct(parseNumber(getPortfolioCell(row, columns.pnlPct)), invested, pnl),
        share: parseNumber(getPortfolioCell(row, columns.share)),
        status: normalizePortfolioStatus(asset, category, rawStatus, quantity, invested, currentValue)
      };
    });
}

function getPortfolioColumns(headers) {
  return {
    asset: findPortfolioColumn(headers, ["asset", "актив"], 0),
    ticker: findPortfolioColumn(headers, ["ticker", "тикер"], -1),
    category: findPortfolioColumn(headers, ["category", "категория"], 2),
    quantity: findPortfolioColumn(headers, ["quantity", "количество"], 3),
    avgEntry: findPortfolioColumn(headers, ["avgentry", "средняя входа", "средняя"], 4),
    invested: findPortfolioColumn(headers, ["invested", "вложено"], 5),
    currentPrice: findPortfolioColumn(headers, ["currentprice", "текущая цена"], 6),
    currentValue: findPortfolioColumn(headers, ["currentvalue", "текущая стоимость", "стоимость"], 7),
    pnl: findPortfolioColumn(headers, ["pnl", "pnl $"], 8),
    pnlPct: findPortfolioColumn(headers, ["pnlpct", "pnl %"], 9),
    share: findPortfolioColumn(headers, ["share", "доля", "доля %"], 10),
    status: findPortfolioColumn(headers, ["status", "статус", "столбец1", "столбец 1"], -1)
  };
}

function findPortfolioColumn(headers, aliases, fallbackIndex) {
  for (let index = 0; index < headers.length; index += 1) {
    const header = normalizePortfolioHeader(headers[index]);
    if (aliases.indexOf(header) >= 0) return index;
  }

  return fallbackIndex;
}

function normalizePortfolioHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function getPortfolioCell(row, index) {
  if (index < 0 || index >= row.length) return "";
  return row[index];
}

function getAssetQuality(sheet) {
  if (!sheet || sheet.getLastRow() < 2) {
    return {
      connected: false,
      cmcTop100Connected: false,
      binanceMonitoringConnected: false,
      updatedAt: "",
      source: "",
      records: []
    };
  }

  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastColumn).getDisplayValues();
  const columns = getAssetQualityColumns_(headers);
  const records = rows
    .filter(row => getAssetQualityCell_(row, columns.asset))
    .map(row => ({
      asset: String(getAssetQualityCell_(row, columns.asset)).trim().toUpperCase(),
      cmcRank: parseAssetQualityRank_(getAssetQualityCell_(row, columns.cmcRank)),
      binanceMonitoring: parseAssetQualityBoolean_(getAssetQualityCell_(row, columns.binanceMonitoring)),
      source: getAssetQualityCell_(row, columns.source),
      updatedAt: getAssetQualityCell_(row, columns.updatedAt)
    }));
  const updatedAt = records
    .map(item => item.updatedAt)
    .filter(Boolean)
    .sort()
    .pop() || "";

  return {
    connected: records.length > 0,
    cmcTop100Connected: records.some(item => item.cmcRank && item.cmcRank <= 100),
    binanceMonitoringConnected: records.some(item => item.binanceMonitoring),
    updatedAt: updatedAt,
    source: "Google Sheets: Качество активов",
    records: records
  };
}

function getAssetQualityColumns_(headers) {
  return {
    asset: findAssetQualityColumn_(headers, ["asset", "актив", "тикер"], 0),
    cmcRank: findAssetQualityColumn_(headers, ["cmcrank", "cmc rank", "рейтинг cmc", "рейтинг"], 2),
    binanceMonitoring: findAssetQualityColumn_(headers, ["binancemonitoring", "binance monitoring", "мониторинг binance", "мониторинг"], 4),
    source: findAssetQualityColumn_(headers, ["source", "источник"], 5),
    updatedAt: findAssetQualityColumn_(headers, ["updatedat", "updated at", "обновлено"], 6)
  };
}

function findAssetQualityColumn_(headers, aliases, fallbackIndex) {
  for (let index = 0; index < headers.length; index += 1) {
    const header = normalizeAssetQualityHeader_(headers[index]);
    if (aliases.indexOf(header) >= 0) return index;
  }

  return fallbackIndex;
}

function normalizeAssetQualityHeader_(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function getAssetQualityCell_(row, index) {
  if (index < 0 || index >= row.length) return "";
  return row[index];
}

function parseAssetQualityRank_(value) {
  const rank = parseNumber(value);
  return rank > 0 ? rank : null;
}

function parseAssetQualityBoolean_(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "true" || normalized === "yes" || normalized === "1" || normalized === "да" || normalized === "истина";
}

function getTickerByAsset(asset) {
  const a = String(asset || "").toUpperCase();
  const futuresMatch = a.match(/^(.+)\s+(LONG|SHORT)$/);
  if (futuresMatch) return futuresMatch[1];
  if (a.includes("BTC")) return "BTC";
  if (a.includes("ETH")) return "ETH";
  if (a.includes("TON")) return "TON";
  if (a.includes("SOL")) return "SOL";
  if (a.includes("MNT")) return "MNT";
  if (a === "GOLD") return "GOLD";
  if (a.includes("GOLD") || a.includes("PAXG")) return "GOLD-PERP";
  if (a.includes("USDC")) return "USDC";
  if (a.includes("USDT")) return "USDT";
  return a;
}

function normalizePortfolioCategoryForApi(category, asset) {
  const normalizedCategory = String(category || "").trim();

  if (!normalizedCategory) return getCategoryByAsset(asset);
  if (normalizedCategory === "Кэш / Стейблы") return "Свободные деньги";

  return normalizedCategory;
}

function normalizePortfolioStatus(asset, category, status, quantity, invested, currentValue) {
  const normalizedStatus = String(status || "").trim();
  const statusUpper = normalizedStatus.toUpperCase();

  if (statusUpper === "CLOSED" || statusUpper === "EXITED" || statusUpper === "FIXED") {
    return statusUpper;
  }

  if (!quantity && !invested && !currentValue) return "EXITED";

  if (
    normalizedStatus &&
    statusUpper !== "0"
  ) {
    return normalizedStatus;
  }

  const a = String(asset || "").toUpperCase();
  if (category === "Свободные деньги") return "Reserve";
  if (category === "Металлы") return "Hedge";
  if (category === "Фьючерсы" || a.includes("LONG") || a.includes("SHORT")) return "Speculation";
  if (a === "ETH" || a === "ATOM") return "Accumulate";
  return "Watch";
}

function getCategoryByAsset(asset) {
  const a = String(asset || "").toUpperCase();

  if (a.includes("USDT") || a.includes("USDC")) return "Свободные деньги";
  if (a.includes("GOLD") || a.includes("PAXG")) return "Металлы";
  if (a.includes("SHORT") || a.includes("PERP") || a.includes(" LONG")) return "Фьючерсы";
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
      action: row[5],
      invalidation: row[6],
      status: ""
    }));
}

function getHistory(sheet) {
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(value => String(value || "").trim());
  const column = name => headers.indexOf(name);
  const cell = (row, name) => {
    const index = column(name);
    return index >= 0 ? row[index] : "";
  };

  return values
    .slice(1)
    .filter(row => cell(row, "Дата") && cell(row, "Стоимость портфеля") !== "")
    .map(row => ({
      date: formatHistoryDate(cell(row, "Дата")),
      portfolioValue: parseNumber(cell(row, "Стоимость портфеля")),
      invested: parseNumber(cell(row, "Вложено")),
      pnl: parseNumber(cell(row, "PnL $")),
      pnlPct: parseNumber(cell(row, "PnL %")),
      reserve: parseNumber(cell(row, "Резерв")),
      positionsCount: parseNumber(cell(row, "Кол-во позиций")),
      pointType: String(cell(row, "Тип точки") || ""),
      note: String(cell(row, "Заметка") || ""),
      trigger: String(cell(row, "Триггер") || ""),
      source: String(cell(row, "Источник") || ""),
      comment: String(cell(row, "Комментарий") || "")
    }));
}

function formatHistoryDate(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return value.toISOString();
  }

  return String(value || "").trim();
}

function getTransactions(sheet) {
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(value => String(value || "").trim());
  const column = name => headers.indexOf(name);
  const cell = (row, name) => {
    const index = column(name);
    return index >= 0 ? row[index] : "";
  };

  return values
    .slice(1)
    .filter(row => cell(row, "Import ID") || cell(row, "Hash"))
    .map(row => {
      const importId = String(cell(row, "Import ID") || "");
      const note = String(cell(row, "Review Note") || "");
      const preciseDate = parseFearGreedImportDate(note) ||
        parseFearGreedImportIdDate(importId) ||
        parseFearGreedDate(cell(row, "Дата"));

      return {
        id: importId,
        status: String(cell(row, "Status") || ""),
        date: preciseDate ? formatFearGreedDate(preciseDate) : formatHistoryDate(cell(row, "Дата")),
        asset: String(cell(row, "Актив") || ""),
        category: String(cell(row, "Категория") || ""),
        action: String(cell(row, "Действие") || ""),
        quantity: parseNumber(cell(row, "Количество")),
        price: parseNumber(cell(row, "Цена")),
        amount: parseNumber(cell(row, "Сумма")),
        comment: String(cell(row, "Комментарий") || ""),
        walletId: String(cell(row, "Wallet ID") || ""),
        chain: String(cell(row, "Chain") || ""),
        hash: String(cell(row, "Hash") || ""),
        direction: String(cell(row, "Direction") || ""),
        counterparty: String(cell(row, "Counterparty") || ""),
        rawAsset: String(cell(row, "Raw Asset") || ""),
        rawAmount: parseNumber(cell(row, "Raw Amount")),
        note: note
      };
    })
    .sort((a, b) => {
      const aTime = parseFearGreedDate(a.date);
      const bTime = parseFearGreedDate(b.date);
      return (bTime ? bTime.getTime() : 0) - (aTime ? aTime.getTime() : 0);
    });
}

function getFearGreedStrategyReadOnly(ss, portfolioValue) {
  const currentIndex = getFearGreedCurrentIndex(ss);
  const sheet = ss.getSheetByName("FearGreedRules");
  const sourceRules = sheet ? readFearGreedRules(sheet) : getDefaultFearGreedRules();
  const strategyBuys = getFearGreedStrategyBuys(ss, sourceRules, portfolioValue);
  const rules = applyFearGreedStrategyBuysToRules(sourceRules, strategyBuys);
  const currentMode = getFearGreedMode(currentIndex, rules);
  const now = new Date();

  return {
    currentIndex: currentIndex,
    currentMode: currentMode,
    portfolioValue: portfolioValue,
    lastBuy: strategyBuys.length ? strategyBuys[0] : getFearGreedLastBuyFromRules(rules, portfolioValue),
    strategyBuys: strategyBuys,
    history: getFearGreedHistory(ss),
    rules: rules.map(rule => buildFearGreedRuleState(rule, currentIndex, currentMode, portfolioValue, now))
  };
}

function getFearGreedHistory(ss) {
  const sheet = ss.getSheetByName("FearGreedHistory");
  if (!sheet || sheet.getLastRow() < 2) return [];

  const timezone = ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || "Europe/Moscow";
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();

  return values
    .map(row => {
      const date = parseFearGreedDate(row[0]);
      const value = parseNumber(row[1]);
      if (!date || !Number.isFinite(value)) return null;

      return {
        date: Utilities.formatDate(date, timezone, "yyyy-MM-dd"),
        value: Math.max(0, Math.min(100, Math.round(value))),
        label: String(row[2] || ""),
        source: String(row[3] || "")
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(-365);
}

function getFearGreedStrategy(ss, portfolioValue) {
  const currentIndex = getFearGreedCurrentIndex(ss);
  const sheet = getOrCreateFearGreedRulesSheet(ss);
  const now = new Date();
  let rules = readFearGreedRules(sheet);
  const currentMode = getFearGreedMode(currentIndex, rules);

  const autoMark = autoMarkFearGreedFromRecentStrategyImport(ss, sheet, rules, currentIndex, currentMode, portfolioValue, now);
  if (autoMark.marked) rules = readFearGreedRules(sheet);

  const apiRules = rules.map(rule => buildFearGreedRuleState(rule, currentIndex, currentMode, portfolioValue, now));
  writeFearGreedComputedState(sheet, apiRules);

  return {
    currentIndex: currentIndex,
    currentMode: currentMode,
    portfolioValue: portfolioValue,
    lastBuy: getFearGreedLastStrategyBuy(ss, rules, portfolioValue),
    rules: apiRules
  };
}

function autoMarkFearGreedFromRecentStrategyImport(ss, rulesSheet, rules, currentIndex, currentMode, portfolioValue, now) {
  const importSheet = ss.getSheetByName("Транзакции_IMPORT");
  if (!importSheet || importSheet.getLastRow() < 2) return { marked: false, reason: "missing_import_sheet" };

  const lookbackRows = Math.min(importSheet.getLastRow() - 1, 80);
  const rows = importSheet.getRange(importSheet.getLastRow() - lookbackRows + 1, 1, lookbackRows, 19).getValues();
  const allMarks = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const importId = String(row[0] || "");
    const action = String(row[5] || "").trim();
    const asset = String(row[3] || "").trim().toUpperCase();
    const chain = String(row[11] || "").trim().toUpperCase();
    const comment = String(row[9] || "");
    const amount = parseNumber(row[8]);
    const note = String(row[18] || "");
    const isSolanaStrategyBuy =
      importId.indexOf("SOLANA_BALANCE_DELTA") === 0 ||
      importId.indexOf("SOLANA_SWAP_TX") === 0 ||
      comment.indexOf("Solana wallet balance delta") >= 0 ||
      comment.indexOf("Solana wallet transaction") >= 0;
    const boughtAt = parseFearGreedImportDate(note) || parseFearGreedImportIdDate(importId) || parseFearGreedDate(row[2]) || now;
    const ageHours = Math.abs(now.getTime() - boughtAt.getTime()) / 3600000;

    if (!isSolanaStrategyBuy) continue;
    if (action !== "Покупка" || asset !== "SOL") continue;
    if (chain && chain !== "SOLANA") continue;
    if (ageHours > 36) continue;

    const mark = markFearGreedStrategyBuyAmount_(rulesSheet, rules, portfolioValue, amount, boughtAt, currentIndex);
    if (mark.marked && mark.marks) allMarks.push.apply(allMarks, mark.marks);
  }

  if (allMarks.length) {
    return {
      marked: true,
      currentMode: currentMode,
      marks: allMarks,
      lastBuyAt: allMarks[allMarks.length - 1].lastBuyAt
    };
  }

  return { marked: false, reason: "no_recent_strategy_import" };
}

function getFearGreedLastStrategyBuy(ss, rules, portfolioValue) {
  const buys = getFearGreedStrategyBuys(ss, rules, portfolioValue);
  return buys.length ? buys[0] : getFearGreedLastBuyFromRules(rules, portfolioValue);
}

function getFearGreedStrategyBuys(ss, rules, portfolioValue) {
  const importSheet = ss.getSheetByName("Транзакции_IMPORT");
  if (!importSheet || importSheet.getLastRow() < 2) return [];

  const rows = importSheet.getRange(2, 1, importSheet.getLastRow() - 1, 19).getValues();

  return rows
    .map(row => {
      const importId = String(row[0] || "");
      const action = String(row[5] || "").trim();
      const asset = String(row[3] || "").trim().toUpperCase();
      const chain = String(row[11] || "").trim().toUpperCase();
      const comment = String(row[9] || "");
      const amount = parseNumber(row[8]);
      const assetPrice = parseNumber(row[7]);
      const note = String(row[18] || "");
      const isTonStrategyBuy =
        importId.indexOf("TON_BALANCE_DELTA") === 0 ||
        comment.indexOf("TON wallet balance delta") >= 0;
      const isSolanaStrategyBuy =
        importId.indexOf("SOLANA_SWAP_TX") === 0 ||
        comment.indexOf("Solana wallet transaction") >= 0;

      if (action !== "Покупка" || !asset || !amount) return null;
      if (!isTonStrategyBuy && !isSolanaStrategyBuy) return null;
      if (isTonStrategyBuy && chain && chain !== "TON") return null;
      if (isSolanaStrategyBuy && chain && chain !== "SOLANA") return null;

      const boughtAt = parseFearGreedImportDate(note) ||
        parseFearGreedImportIdDate(importId) ||
        parseFearGreedDate(row[2]);
      if (!boughtAt) return null;

      const matchedRule = getFearGreedRuleForBuyAmount(rules, portfolioValue, amount) ||
        getFearGreedRuleForBuyDate(rules, boughtAt);
      if (!matchedRule) return null;

      return {
        mode: matchedRule.mode,
        range: matchedRule.minIndex + "-" + matchedRule.maxIndex,
        label: matchedRule.label,
        asset: asset,
        assetPrice: roundFearGreed(assetPrice, 4),
        buyAmount: roundFearGreed(amount, 2),
        boughtAt: formatFearGreedDate(boughtAt)
      };
    })
    .filter(Boolean)
    .sort((a, b) => parseFearGreedDate(b.boughtAt).getTime() - parseFearGreedDate(a.boughtAt).getTime())
    .slice(0, 20);
}

function applyFearGreedStrategyBuysToRules(rules, strategyBuys) {
  return rules.map(rule => {
    const latestBuy = strategyBuys.find(buy => buy.mode === rule.mode);
    if (!latestBuy) return rule;

    const existingDate = parseFearGreedDate(rule.lastBuyAt);
    const buyDate = parseFearGreedDate(latestBuy.boughtAt);
    if (!buyDate || (existingDate && existingDate.getTime() >= buyDate.getTime())) return rule;

    return Object.assign({}, rule, { lastBuyAt: latestBuy.boughtAt });
  });
}

function getFearGreedRuleForBuyAmount(rules, portfolioValue, amount) {
  const directRules = getFearGreedDirectRulesForBuyAmount_(rules, portfolioValue, amount);
  return directRules.length ? directRules[0].rule : null;
}

function getFearGreedRuleForBuyDate(rules, boughtAt) {
  if (!boughtAt) return null;
  const boughtAtTime = boughtAt.getTime();

  return rules.find(rule => {
    if (!rule.buyPct || !rule.lastBuyAt) return false;
    const lastBuyDate = parseFearGreedDate(rule.lastBuyAt);
    if (!lastBuyDate) return false;
    return Math.abs(lastBuyDate.getTime() - boughtAtTime) <= 36 * 3600000;
  }) || null;
}

function getFearGreedLastBuyFromRules(rules, portfolioValue) {
  let latest = null;

  rules.forEach(rule => {
    const lastBuyDate = parseFearGreedDate(rule.lastBuyAt);
    if (!lastBuyDate || !rule.buyPct) return;
    if (
      !latest ||
      lastBuyDate.getTime() > latest.date.getTime() ||
      (lastBuyDate.getTime() === latest.date.getTime() && rule.buyPct > latest.rule.buyPct)
    ) {
      latest = { rule: rule, date: lastBuyDate };
    }
  });

  if (!latest) return null;

  return {
    mode: latest.rule.mode,
    range: latest.rule.minIndex + "-" + latest.rule.maxIndex,
    label: latest.rule.label,
    asset: "",
    assetPrice: 0,
    buyAmount: roundFearGreed(portfolioValue * latest.rule.buyPct, 2),
    boughtAt: formatFearGreedDate(latest.date)
  };
}

function markFearGreedStrategyBuy(ss, buyAmount, boughtAt) {
  const amount = Number(buyAmount || 0);
  if (!amount || amount <= 0) return { marked: false, reason: "empty_buy_amount" };

  const currentIndex = getFearGreedCurrentIndex(ss);
  const sheet = getOrCreateFearGreedRulesSheet(ss);
  const rules = readFearGreedRules(sheet);
  const currentMode = getFearGreedMode(currentIndex, rules);
  const now = boughtAt || new Date();
  const portfolioValue = getOverview(ss.getSheetByName("Обзор")).invested;
  const mark = markFearGreedStrategyBuyAmount_(sheet, rules, portfolioValue, amount, now, currentIndex);

  if (mark.marked) getFearGreedStrategy(ss, portfolioValue);

  return Object.assign({ currentMode: currentMode }, mark);
}

function markFearGreedStrategyBuyAmount_(sheet, rules, portfolioValue, amount, boughtAt, currentIndex) {
  const matches = getFearGreedRulesForBuyAmount_(rules, portfolioValue, amount, currentIndex);
  if (!matches.length) {
    return {
      marked: false,
      reason: "amount_outside_strategy_band",
      buyAmount: roundFearGreed(amount, 2)
    };
  }

  const now = boughtAt || new Date();
  const marks = [];
  const skipped = [];

  matches.forEach(match => {
    const rule = match.rule;
    const ruleIndex = rules.findIndex(item => item.mode === rule.mode);
    if (ruleIndex < 0) return;

    if (!rule.buyPct || !rule.cooldownDays) {
      skipped.push({ mode: rule.mode, reason: "mode_has_no_buy" });
      return;
    }

    const lastBuyDate = parseFearGreedDate(rule.lastBuyAt);
    const nextAvailableDate = lastBuyDate ? addFearGreedDays(lastBuyDate, rule.cooldownDays) : null;
    if (nextAvailableDate && nextAvailableDate.getTime() > now.getTime()) {
      skipped.push({
        mode: rule.mode,
        reason: "already_on_cooldown",
        nextAvailableAt: formatFearGreedDate(nextAvailableDate)
      });
      return;
    }

    const lastBuyAt = formatFearGreedDate(now);
    const nextAvailableAt = formatFearGreedDate(addFearGreedDays(now, rule.cooldownDays));
    sheet.getRange(ruleIndex + 2, 7).setValue(lastBuyAt);
    rules[ruleIndex].lastBuyAt = lastBuyAt;
    marks.push({
      mode: rule.mode,
      range: rule.minIndex + "-" + rule.maxIndex,
      buyAmount: roundFearGreed(match.amount || match.expectedAmount, 2),
      expectedAmount: roundFearGreed(match.expectedAmount, 2),
      lastBuyAt: lastBuyAt,
      nextAvailableAt: nextAvailableAt
    });
  });

  if (!marks.length) {
    return {
      marked: false,
      reason: skipped.length ? skipped.map(item => item.mode + ":" + item.reason).join(",") : "no_markable_rule",
      skipped: skipped
    };
  }

  return {
    marked: true,
    currentMode: marks.map(mark => mark.mode).join("+"),
    buyAmount: roundFearGreed(amount, 2),
    marks: marks,
    skipped: skipped,
    lastBuyAt: marks[marks.length - 1].lastBuyAt,
    nextAvailableAt: marks[marks.length - 1].nextAvailableAt
  };
}

function markFearGreedStrategyModeBuy_(sheet, rules, mode, portfolioValue, amount, boughtAt) {
  const ruleIndex = rules.findIndex(rule => rule.mode === mode);
  if (ruleIndex < 0) return { marked: false, reason: "missing_rule", mode: mode };

  const rule = rules[ruleIndex];
  if (!rule.buyPct || !rule.cooldownDays) {
    return { marked: false, reason: "mode_has_no_buy", mode: mode };
  }

  const expectedAmount = portfolioValue * rule.buyPct;
  const numericAmount = Number(amount || expectedAmount);
  if (Math.abs(numericAmount - expectedAmount) > getFearGreedBuyTolerance_(expectedAmount)) {
    return {
      marked: false,
      reason: "amount_outside_strategy_band",
      mode: mode,
      buyAmount: roundFearGreed(numericAmount, 2),
      expectedAmount: roundFearGreed(expectedAmount, 2)
    };
  }

  const buyDate = parseFearGreedDate(boughtAt) || new Date();
  const lastBuyAt = formatFearGreedDate(buyDate);
  const nextAvailableAt = formatFearGreedDate(addFearGreedDays(buyDate, rule.cooldownDays));

  sheet.getRange(ruleIndex + 2, 7).setValue(lastBuyAt);
  rules[ruleIndex].lastBuyAt = lastBuyAt;

  return {
    marked: true,
    mode: mode,
    range: rule.minIndex + "-" + rule.maxIndex,
    buyAmount: roundFearGreed(numericAmount, 2),
    expectedAmount: roundFearGreed(expectedAmount, 2),
    lastBuyAt: lastBuyAt,
    nextAvailableAt: nextAvailableAt
  };
}

function getFearGreedRulesForBuyAmount_(rules, portfolioValue, amount, currentIndex) {
  const eligibleRules = getFearGreedEligibleBuyRules_(rules, currentIndex);
  const directMatches = getFearGreedDirectRulesForBuyAmount_(eligibleRules, portfolioValue, amount);
  if (directMatches.length) return directMatches;

  const buyRules = eligibleRules;
  let bestMatch = null;

  for (let mask = 1; mask < Math.pow(2, buyRules.length); mask += 1) {
    const combo = [];
    for (let index = 0; index < buyRules.length; index += 1) {
      if (mask & Math.pow(2, index)) combo.push(buyRules[index]);
    }

    if (combo.length < 2) continue;

    const expectedAmount = combo.reduce((sum, rule) => sum + portfolioValue * rule.buyPct, 0);
    const tolerance = combo.reduce((sum, rule) => sum + getFearGreedBuyTolerance_(portfolioValue * rule.buyPct), 0);
    const diff = Math.abs(amount - expectedAmount);
    if (diff > tolerance) continue;

    if (!bestMatch || diff < bestMatch.diff || (diff === bestMatch.diff && combo.length > bestMatch.rules.length)) {
      bestMatch = {
        rules: combo,
        diff: diff,
        expectedAmount: expectedAmount
      };
    }
  }

  if (!bestMatch) return [];

  const scale = bestMatch.expectedAmount ? amount / bestMatch.expectedAmount : 1;
  return bestMatch.rules.map(rule => {
    const expectedAmount = portfolioValue * rule.buyPct;
    return {
      rule: rule,
      expectedAmount: expectedAmount,
      amount: expectedAmount * scale
    };
  });
}

function getFearGreedDirectRulesForBuyAmount_(rules, portfolioValue, amount) {
  return rules
    .filter(rule => {
      if (!rule.buyPct) return false;
      const expectedAmount = portfolioValue * rule.buyPct;
      return Math.abs(amount - expectedAmount) <= getFearGreedBuyTolerance_(expectedAmount);
    })
    .map(rule => ({
      rule: rule,
      expectedAmount: portfolioValue * rule.buyPct,
      amount: amount,
      diff: Math.abs(amount - portfolioValue * rule.buyPct)
    }))
    .sort((a, b) => a.diff - b.diff || b.rule.buyPct - a.rule.buyPct);
}

function getFearGreedEligibleBuyRules_(rules, currentIndex) {
  const index = Number(currentIndex);
  if (!Number.isFinite(index)) return rules.filter(rule => rule.buyPct > 0);

  return rules.filter(rule => rule.buyPct > 0 && index <= rule.maxIndex);
}

function getFearGreedBuyTolerance_(expectedAmount) {
  return Math.max(0.35, Math.min(1.25, expectedAmount * 0.15));
}

function markFearGreedCurrentModeBuyNow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const portfolioValue = getOverview(ss.getSheetByName("Обзор")).invested;
  const currentIndex = getFearGreedCurrentIndex(ss);
  const rules = readFearGreedRules(getOrCreateFearGreedRulesSheet(ss));
  const currentMode = getFearGreedMode(currentIndex, rules);
  const currentRule = rules.find(rule => rule.mode === currentMode);
  const buyAmount = currentRule ? portfolioValue * currentRule.buyPct : 0;

  return markFearGreedStrategyBuy(ss, buyAmount, new Date());
}

function markFearGreedCurrentLadderBuyNow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateFearGreedRulesSheet(ss);
  const portfolioValue = getOverview(ss.getSheetByName("Обзор")).invested;
  const currentIndex = getFearGreedCurrentIndex(ss);
  const rules = readFearGreedRules(sheet);
  const now = new Date();
  const lastBuyAt = formatFearGreedDate(now);
  const marks = [];

  getFearGreedEligibleBuyRules_(rules, currentIndex).forEach(rule => {
    const ruleIndex = rules.findIndex(item => item.mode === rule.mode);
    if (ruleIndex < 0 || !rule.cooldownDays) return;

    sheet.getRange(ruleIndex + 2, 7).setValue(lastBuyAt);
    marks.push({
      mode: rule.mode,
      range: rule.minIndex + "-" + rule.maxIndex,
      expectedAmount: roundFearGreed(portfolioValue * rule.buyPct, 2),
      lastBuyAt: lastBuyAt,
      nextAvailableAt: formatFearGreedDate(addFearGreedDays(now, rule.cooldownDays))
    });
  });

  getFearGreedStrategy(ss, portfolioValue);

  return {
    marked: marks.length > 0,
    currentIndex: currentIndex,
    modes: marks.map(mark => mark.mode).join("+"),
    marks: marks
  };
}

function markFearGreedModeBuy(mode, buyAmount, boughtAt) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateFearGreedRulesSheet(ss);
  const portfolioValue = getOverview(ss.getSheetByName("Обзор")).invested;
  const rules = readFearGreedRules(sheet);
  const mark = markFearGreedStrategyModeBuy_(sheet, rules, String(mode || ""), portfolioValue, buyAmount, boughtAt);

  if (mark.marked) getFearGreedStrategy(ss, portfolioValue);
  return mark;
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

function IC_ASSET_QUALITY_refresh() {
  const ss = SpreadsheetApp.openById("1bk_Ex8Kl6jSlcxDNV0BIBio0CRTFK_jyRdB5-06Mpm8");
  const updatedAt = new Date().toISOString();
  const cmc = IC_ASSET_QUALITY_fetchCoinMarketCapTop100_();
  const binance = IC_ASSET_QUALITY_fetchBinanceMonitoring_();
  const byAsset = {};

  cmc.records.forEach(item => {
    byAsset[item.asset] = {
      asset: item.asset,
      name: item.name,
      cmcRank: item.cmcRank,
      cmcTop100: true,
      binanceMonitoring: false,
      marketCap: item.marketCap,
      source: "CoinMarketCap",
      updatedAt: updatedAt,
      status: cmc.ok ? "OK" : "CMC_ERROR",
      note: ""
    };
  });

  binance.records.forEach(item => {
    const current = byAsset[item.asset] || {
      asset: item.asset,
      name: item.name,
      cmcRank: null,
      cmcTop100: false,
      binanceMonitoring: false,
      marketCap: item.marketCap,
      source: "",
      updatedAt: updatedAt,
      status: "",
      note: ""
    };

    current.name = current.name || item.name;
    current.binanceMonitoring = true;
    current.marketCap = current.marketCap || item.marketCap;
    current.source = [current.source, "Binance Monitoring"].filter(Boolean).join(" + ");
    current.status = binance.ok ? current.status || "OK" : "BINANCE_ERROR";
    current.note = item.tags.join(", ");
    byAsset[item.asset] = current;
  });

  const records = Object.keys(byAsset)
    .sort((a, b) => {
      const rankA = byAsset[a].cmcRank || 999999;
      const rankB = byAsset[b].cmcRank || 999999;
      if (rankA !== rankB) return rankA - rankB;
      return a.localeCompare(b);
    })
    .map(asset => byAsset[asset]);

  IC_ASSET_QUALITY_writeSheet_(ss, records);

  return {
    updatedAt: updatedAt,
    cmcTop100: cmc.records.length,
    binanceMonitoring: binance.records.length,
    total: records.length,
    cmcOk: cmc.ok,
    binanceOk: binance.ok,
    cmcError: cmc.error || "",
    binanceError: binance.error || ""
  };
}

function IC_ASSET_QUALITY_fetchCoinMarketCapTop100_() {
  const url = "https://pro-api.coinmarketcap.com/public-api/v3/cryptocurrency/listings/latest?start=1&limit=100&convert=USD";

  try {
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        "Accept": "application/json",
        "User-Agent": "InvestorCabinet/asset-quality"
      }
    });
    const code = response.getResponseCode();
    if (code < 200 || code >= 300) return { ok: false, error: "CMC_HTTP_" + code, records: [] };

    const json = JSON.parse(response.getContentText());
    const records = (json.data || [])
      .filter(item => item && item.symbol)
      .map(item => ({
        asset: String(item.symbol || "").trim().toUpperCase(),
        name: String(item.name || ""),
        cmcRank: Number(item.cmc_rank || 0),
        marketCap: item.quote && item.quote[0] ? Number(item.quote[0].market_cap || 0) : 0
      }))
      .filter(item => item.asset && item.cmcRank > 0 && item.cmcRank <= 100);

    return { ok: records.length > 0, error: records.length > 0 ? "" : "CMC_EMPTY", records: records };
  } catch (error) {
    return { ok: false, error: String(error), records: [] };
  }
}

function IC_ASSET_QUALITY_fetchBinanceMonitoring_() {
  const proxy = IC_ASSET_QUALITY_fetchBinanceMonitoringFromProxy_();
  if (proxy.ok && proxy.records.length) return proxy;

  const url = "https://www.binance.com/bapi/composite/v1/public/marketing/symbol/list";

  try {
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        "Accept": "application/json",
        "clienttype": "web",
        "User-Agent": "Mozilla/5.0"
      }
    });
    const code = response.getResponseCode();
    if (code < 200 || code >= 300) return { ok: false, error: "BINANCE_HTTP_" + code, records: [] };

    const json = JSON.parse(response.getContentText());
    const records = (json.data || [])
      .filter(item => item && item.baseAsset && item.tags && item.tags.indexOf("Monitoring") >= 0)
      .map(item => ({
        asset: String(item.baseAsset || "").trim().toUpperCase(),
        name: String(item.fullName || item.name || ""),
        marketCap: Number(item.marketCap || 0),
        tags: item.tags || []
      }));

    return { ok: records.length > 0, error: records.length > 0 ? "" : "BINANCE_EMPTY", records: records };
  } catch (error) {
    return { ok: false, error: String(error), records: [] };
  }
}

function IC_ASSET_QUALITY_fetchBinanceMonitoringFromProxy_() {
  const url = "https://investor-cabinet.vercel.app/api/asset-quality";

  try {
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { "Accept": "application/json" }
    });
    const code = response.getResponseCode();
    if (code < 200 || code >= 300) return { ok: false, error: "PROXY_HTTP_" + code, records: [] };

    const json = JSON.parse(response.getContentText());
    const records = (json.binanceMonitoring || [])
      .filter(item => item && item.asset)
      .map(item => ({
        asset: String(item.asset || "").trim().toUpperCase(),
        name: String(item.name || ""),
        marketCap: Number(item.marketCap || 0),
        tags: item.tags || ["Monitoring"]
      }));

    return { ok: records.length > 0, error: records.length > 0 ? "" : "PROXY_EMPTY", records: records };
  } catch (error) {
    return { ok: false, error: String(error), records: [] };
  }
}

function IC_ASSET_QUALITY_writeSheet_(ss, records) {
  const sheetName = "Качество активов";
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  const headers = [
    "asset",
    "name",
    "cmcRank",
    "cmcTop100",
    "binanceMonitoring",
    "source",
    "updatedAt",
    "marketCap",
    "status",
    "note"
  ];
  const values = records.map(item => [
    item.asset,
    item.name,
    item.cmcRank || "",
    item.cmcTop100,
    item.binanceMonitoring,
    item.source,
    item.updatedAt,
    item.marketCap || "",
    item.status,
    item.note
  ]);

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (values.length) sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  sheet.setFrozenRows(1);
}

function IC_ASSET_QUALITY_installDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === "IC_ASSET_QUALITY_refresh")
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger("IC_ASSET_QUALITY_refresh")
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  return "IC_ASSET_QUALITY_refresh daily trigger installed";
}
