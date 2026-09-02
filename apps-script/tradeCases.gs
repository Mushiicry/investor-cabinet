const IC_TRADE_CASE_SHEET = "TradeCases";
const IC_TRADE_CASE_HEADERS = [
  "tradeCaseId",
  "accountId",
  "active",
  "createdAt",
  "updatedAt",
  "status",
  "source",
  "idea",
  "signalId",
  "candidateId",
  "asset",
  "category",
  "action",
  "amountUsd",
  "price",
  "currentPrice",
  "decisionStatus",
  "orderPlan",
  "transactionId",
  "reviewedAt",
  "sourceSystem"
];
const IC_TRADE_CASE_STATUSES = [
  "IDEA",
  "CHECKING",
  "WATCHING",
  "DECISION_READY",
  "ORDER_PLACED",
  "WAITING",
  "FILLED",
  "CANCELLED",
  "REVIEWED"
];

function IC_TRADE_CASE_handleList_(ss, accountId) {
  return IC_TRADE_CASE_json_({
    success: true,
    store: IC_TRADE_CASE_getStore_(ss, accountId)
  });
}

function IC_TRADE_CASE_handleUpsert_(ss, e, accountId) {
  const payload = IC_TRADE_CASE_parsePayload_(e);
  if (!payload || !Array.isArray(payload.cases)) {
    return IC_TRADE_CASE_json_({ success: false, error: "Invalid TradeCase payload" });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = IC_TRADE_CASE_getOrCreateSheet_(ss);
    const rows = IC_TRADE_CASE_readRows_(sheet);
    const byKey = {};
    const activeByAccount = {};

    rows.forEach(function(row) {
      const tradeCase = IC_TRADE_CASE_normalize_(row);
      if (!tradeCase) return;
      const key = tradeCase.accountId + "::" + tradeCase.tradeCaseId;
      const current = byKey[key];
      if (!current || IC_TRADE_CASE_time_(tradeCase.updatedAt) >= IC_TRADE_CASE_time_(current.updatedAt)) {
        byKey[key] = tradeCase;
      }
      if (row.active === true || String(row.active).toUpperCase() === "TRUE") {
        const active = activeByAccount[tradeCase.accountId];
        if (!active || IC_TRADE_CASE_time_(tradeCase.updatedAt) >= IC_TRADE_CASE_time_(active.updatedAt)) {
          activeByAccount[tradeCase.accountId] = tradeCase;
        }
      }
    });

    payload.cases.slice(0, 1000).forEach(function(value) {
      const incoming = IC_TRADE_CASE_normalize_(Object.assign({}, value, { accountId: accountId }));
      if (!incoming) return;
      const key = accountId + "::" + incoming.tradeCaseId;
      const current = byKey[key];
      if (!current || IC_TRADE_CASE_time_(incoming.updatedAt) >= IC_TRADE_CASE_time_(current.updatedAt)) {
        byKey[key] = incoming;
      }
    });

    const requestedActiveId = IC_TRADE_CASE_text_(payload.activeTradeCaseId);
    const requestedActive = requestedActiveId ? byKey[accountId + "::" + requestedActiveId] : null;
    const currentActive = activeByAccount[accountId] || null;
    if (requestedActive && (
      !currentActive ||
      requestedActive.tradeCaseId === currentActive.tradeCaseId ||
      IC_TRADE_CASE_time_(requestedActive.updatedAt) >= IC_TRADE_CASE_time_(currentActive.updatedAt)
    )) {
      activeByAccount[accountId] = requestedActive;
    }

    const merged = Object.keys(byKey)
      .map(function(key) { return byKey[key]; })
      .sort(function(left, right) {
        if (left.accountId !== right.accountId) return left.accountId < right.accountId ? -1 : 1;
        return IC_TRADE_CASE_time_(right.updatedAt) - IC_TRADE_CASE_time_(left.updatedAt);
      });
    const values = merged.map(function(tradeCase) {
      const active = activeByAccount[tradeCase.accountId];
      return IC_TRADE_CASE_toRow_(tradeCase, Boolean(active && active.tradeCaseId === tradeCase.tradeCaseId));
    });

    const existingDataRows = Math.max(0, sheet.getLastRow() - 1);
    if (existingDataRows) {
      sheet.getRange(2, 1, existingDataRows, IC_TRADE_CASE_HEADERS.length).clearContent();
    }
    if (values.length) {
      sheet.getRange(2, 1, values.length, IC_TRADE_CASE_HEADERS.length).setValues(values);
    }

    return IC_TRADE_CASE_json_({
      success: true,
      store: IC_TRADE_CASE_getStore_(ss, accountId)
    });
  } finally {
    lock.releaseLock();
  }
}

function IC_TRADE_CASE_getStore_(ss, accountId) {
  const sheet = ss.getSheetByName(IC_TRADE_CASE_SHEET);
  if (!sheet || sheet.getLastRow() < 2) {
    return { version: 1, activeTradeCaseId: null, cases: [] };
  }

  const byId = {};
  let activeTradeCase = null;
  IC_TRADE_CASE_readRows_(sheet).forEach(function(row) {
    const tradeCase = IC_TRADE_CASE_normalize_(row);
    if (!tradeCase || tradeCase.accountId !== accountId) return;
    const current = byId[tradeCase.tradeCaseId];
    if (!current || IC_TRADE_CASE_time_(tradeCase.updatedAt) >= IC_TRADE_CASE_time_(current.updatedAt)) {
      byId[tradeCase.tradeCaseId] = tradeCase;
    }
    if (row.active === true || String(row.active).toUpperCase() === "TRUE") {
      if (!activeTradeCase || IC_TRADE_CASE_time_(tradeCase.updatedAt) >= IC_TRADE_CASE_time_(activeTradeCase.updatedAt)) {
        activeTradeCase = tradeCase;
      }
    }
  });

  const cases = Object.keys(byId)
    .map(function(tradeCaseId) { return byId[tradeCaseId]; })
    .sort(function(left, right) {
      return IC_TRADE_CASE_time_(right.updatedAt) - IC_TRADE_CASE_time_(left.updatedAt);
    })
    .map(function(tradeCase) {
      const result = Object.assign({}, tradeCase);
      delete result.accountId;
      return result;
    });

  return {
    version: 1,
    activeTradeCaseId: activeTradeCase && byId[activeTradeCase.tradeCaseId]
      ? activeTradeCase.tradeCaseId
      : null,
    cases: cases
  };
}

function IC_TRADE_CASE_getOrCreateSheet_(ss) {
  const sheet = ss.getSheetByName(IC_TRADE_CASE_SHEET) || ss.insertSheet(IC_TRADE_CASE_SHEET);
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, IC_TRADE_CASE_HEADERS.length).setValues([IC_TRADE_CASE_HEADERS]);
    sheet.setFrozenRows(1);
  }
  const headers = sheet.getRange(1, 1, 1, IC_TRADE_CASE_HEADERS.length).getDisplayValues()[0];
  if (headers.join("|") !== IC_TRADE_CASE_HEADERS.join("|")) {
    throw new Error("TradeCases headers do not match the API schema");
  }
  return sheet;
}

function IC_TRADE_CASE_readRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(1, 1, lastRow, IC_TRADE_CASE_HEADERS.length).getValues();
  const headers = values[0].map(IC_TRADE_CASE_text_);
  return values.slice(1).map(function(row) {
    const result = {};
    headers.forEach(function(header, index) {
      if (header) result[header] = row[index];
    });
    return result;
  });
}

function IC_TRADE_CASE_normalize_(value) {
  if (!value || typeof value !== "object") return null;
  const tradeCaseId = IC_TRADE_CASE_text_(value.tradeCaseId);
  const accountId = value.accountId === "wife" ? "wife" : "main";
  const createdAt = IC_TRADE_CASE_text_(value.createdAt);
  const updatedAt = IC_TRADE_CASE_text_(value.updatedAt) || createdAt;
  const status = IC_TRADE_CASE_text_(value.status);
  if (!tradeCaseId || !createdAt || IC_TRADE_CASE_STATUSES.indexOf(status) < 0) return null;

  return {
    tradeCaseId: tradeCaseId,
    accountId: accountId,
    createdAt: createdAt,
    updatedAt: updatedAt,
    status: status,
    source: value.source === "signal" ? "signal" : "manual",
    idea: IC_TRADE_CASE_text_(value.idea),
    signalId: IC_TRADE_CASE_text_(value.signalId),
    candidateId: IC_TRADE_CASE_text_(value.candidateId),
    asset: IC_TRADE_CASE_text_(value.asset).toUpperCase(),
    category: IC_TRADE_CASE_text_(value.category),
    action: value.action === "sell" ? "sell" : "buy",
    amountUsd: IC_TRADE_CASE_number_(value.amountUsd),
    price: IC_TRADE_CASE_number_(value.price),
    currentPrice: IC_TRADE_CASE_number_(value.currentPrice),
    decisionStatus: IC_TRADE_CASE_text_(value.decisionStatus),
    orderPlan: IC_TRADE_CASE_text_(value.orderPlan),
    transactionId: IC_TRADE_CASE_text_(value.transactionId),
    reviewedAt: IC_TRADE_CASE_text_(value.reviewedAt)
  };
}

function IC_TRADE_CASE_toRow_(tradeCase, active) {
  return [
    tradeCase.tradeCaseId,
    tradeCase.accountId,
    active,
    tradeCase.createdAt,
    tradeCase.updatedAt,
    tradeCase.status,
    tradeCase.source,
    tradeCase.idea,
    tradeCase.signalId,
    tradeCase.candidateId,
    tradeCase.asset,
    tradeCase.category,
    tradeCase.action,
    tradeCase.amountUsd,
    tradeCase.price,
    tradeCase.currentPrice,
    tradeCase.decisionStatus,
    tradeCase.orderPlan,
    tradeCase.transactionId,
    tradeCase.reviewedAt,
    "site"
  ];
}

function IC_TRADE_CASE_parsePayload_(e) {
  try {
    return JSON.parse(e && e.postData && e.postData.contents ? e.postData.contents : "{}");
  } catch (error) {
    return null;
  }
}

function IC_TRADE_CASE_text_(value) {
  return String(value === null || value === undefined ? "" : value).trim();
}

function IC_TRADE_CASE_number_(value) {
  const parsed = Number(IC_TRADE_CASE_text_(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function IC_TRADE_CASE_time_(value) {
  const parsed = Date.parse(IC_TRADE_CASE_text_(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function IC_TRADE_CASE_json_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
