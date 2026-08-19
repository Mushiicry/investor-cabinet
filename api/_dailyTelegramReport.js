import { readInvestorPayloadForAssistant } from "./_investorProxy.js";
import { computeDailyReportHealth, fetchDailyReportHyperliquidRisk } from "./_dailyReportHealth.js";

const MOSCOW_TIME_ZONE = "Europe/Moscow";
const MAX_REPORT_POSITIONS = 12;
const MIN_REPORT_POSITION_VALUE_USD = 1;
const TELEGRAM_API_BASE = "https://api.telegram.org";
const RESERVE_TARGET_MAX = 0.6;
const CRYPTO_POSITION_LIMITS = {
  BTC: 0.2,
  ETH: 0.35,
  TON: 0.1,
  SOL: 0.1,
  BNB: 0.1,
  GRAM: 0.1,
};

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toNumber = (value) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(toNumber(value) * factor) / factor;
};

const compactText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const formatNumber = (value, digits = 2) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(round(value, digits));

const formatUsd = (value, digits = 2) => `${formatNumber(value, digits)} $`;

const formatSignedUsd = (value, digits = 2) => {
  const numeric = round(value, digits);
  const sign = numeric > 0 ? "+" : "";
  return `${sign}${formatUsd(numeric, digits)}`;
};

const formatPctValue = (value, digits = 2) => {
  const numeric = round(value, digits);
  const sign = numeric > 0 ? "+" : "";
  return `${sign}${formatNumber(numeric, digits)}%`;
};

const formatPctPlain = (value, digits = 2) => `${formatNumber(value, digits)}%`;
const formatPp = (value, digits = 1) => `${formatNumber(value, digits)} п.п.`;

const formatPctFraction = (value, digits = 2) => formatPctValue(toNumber(value) * 100, digits);

const moscowDateParts = (date) => {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: MOSCOW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    day: byType.day ?? "01",
    month: byType.month ?? "01",
    year: byType.year ?? "1970",
    hour: byType.hour ?? "00",
    minute: byType.minute ?? "00",
  };
};

const formatMoscowDate = (date) => {
  const parts = moscowDateParts(date);
  return `${parts.day}.${parts.month}.${parts.year}`;
};

const moscowDateKey = (date) => {
  const parts = moscowDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const parseHistoryDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const raw = compactText(value);
  if (!raw) return null;

  const ruMatch = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:,\s*(\d{1,2}):(\d{2}))?/);
  if (ruMatch) {
    const [, day, month, yearRaw, hour = "00", minute = "00"] = ruMatch;
    const year = Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw);
    const parsed = new Date(Date.UTC(year, Number(month) - 1, Number(day), Number(hour), Number(minute)));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const findPreviousDailySnapshot = (history, now) => {
  if (!Array.isArray(history)) return null;
  const todayKey = moscowDateKey(now);

  return history
    .map((point) => {
      const date = parseHistoryDate(point?.date);
      const value = toNumber(point?.portfolioValue);
      if (!date || value <= 0 || moscowDateKey(date) >= todayKey) return null;
      return { date, portfolioValue: value };
    })
    .filter(Boolean)
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0] ?? null;
};

const getPortfolioValue = (position) => {
  const currentValue = toNumber(position?.currentValue);
  return currentValue || toNumber(position?.value);
};

const isCashPosition = (position) => {
  const category = compactText(position?.category).toLowerCase();
  const asset = compactText(position?.asset || position?.ticker).toUpperCase();
  return category.includes("свобод")
    || category.includes("кэш")
    || category.includes("cash")
    || ["USDC", "USDT", "USD"].includes(asset);
};

const normalizePositions = (payload) => {
  const portfolio = Array.isArray(payload.portfolio) ? payload.portfolio : [];
  return portfolio
    .map((position) => ({
      asset: compactText(position.asset || position.ticker || "Актив"),
      category: compactText(position.category),
      currentValue: round(getPortfolioValue(position), 2),
      invested: round(position.invested, 2),
      pnl: round(position.pnl, 2),
      pnlPct: round(position.pnlPct, 2),
      share: round(position.share, 2),
      isCash: isCashPosition(position),
    }))
    .filter((position) => position.currentValue > 0)
    .sort((a, b) => b.currentValue - a.currentValue);
};

const modeLabel = (value) => {
  const normalized = compactText(value).toLowerCase();
  if (!normalized) return "";
  const labels = {
    fear: "Страх",
    observation: "Наблюдаем",
    neutral: "Нейтрально",
    greed: "Жадность",
    balance: "Баланс",
    balanced: "Баланс",
  };
  return labels[normalized] ?? compactText(value);
};

const normalizeShareFraction = (value) => {
  const numeric = toNumber(value);
  if (numeric <= 0) return 0;
  return numeric > 1 ? numeric / 100 : numeric;
};

const isCryptoPosition = (position) => compactText(position?.category).toLowerCase().includes("крип");

const assetBaseSymbol = (asset) => compactText(asset).toUpperCase().split(/\s+/)[0];

const resolveReportHealth = ({ overview, computedHealth }) => {
  const health = toNumber(overview.health);
  if (health > 0 && health <= 100) {
    return {
      value: Math.round(health),
      line: `4. Health Factor: ${Math.round(health)}/100.`,
    };
  }

  if (computedHealth?.healthFactor > 0) {
    return {
      value: Math.round(computedHealth.healthFactor),
      line: `4. Health Factor: ${Math.round(computedHealth.healthFactor)}/100.`,
    };
  }

  return {
    value: null,
    line: "4. Health Factor: не передан в серверных данных, чтобы не подменять его risk.health.",
  };
};

const buildLargestPositionNote = (positions) => {
  const largestPosition = positions.find((position) => !position.isCash);
  if (!largestPosition) return "";

  const cryptoPositions = positions.filter((position) => !position.isCash && isCryptoPosition(position));
  const cryptoBlockValue = cryptoPositions.reduce((sum, position) => sum + position.currentValue, 0);
  const symbol = assetBaseSymbol(largestPosition.asset);
  const limit = CRYPTO_POSITION_LIMITS[symbol];

  if (isCryptoPosition(largestPosition) && cryptoBlockValue > 0 && limit) {
    const blockShare = largestPosition.currentValue / cryptoBlockValue;
    const excess = Math.max(0, blockShare - limit);
    return `Крупнейшая позиция: ${largestPosition.asset} — ${formatPctPlain(largestPosition.share)} портфеля; внутри крипто-блока ${formatPctPlain(blockShare * 100, 1)} при лимите ${formatPctPlain(limit * 100, 0)}, превышение ${formatPp(excess * 100)}`;
  }

  return `Крупнейшая позиция: ${largestPosition.asset}, вес ${formatPctPlain(largestPosition.share)}.`;
};

const buildReserveNote = ({ overview, risk, reserve, portfolioValue }) => {
  const invested = toNumber(overview.invested);
  const reserveShare = normalizeShareFraction(risk.reserveShare) || (portfolioValue > 0 ? reserve / portfolioValue : 0);
  const reserveLimitBase = invested > 0 ? invested : portfolioValue;
  const reserveLimitUsd = reserveLimitBase * RESERVE_TARGET_MAX;
  const idleUsd = Math.max(0, reserve - reserveLimitUsd);

  if (reserveShare > RESERVE_TARGET_MAX) {
    return `Резерв выше 60%: простаивает ${formatUsd(idleUsd)} сверх лимита ${formatUsd(reserveLimitUsd)}.`;
  }

  if (reserveShare > 0 && reserveShare < 0.1) {
    return "Резерв ниже 10%: мало защиты на просадке.";
  }

  return "";
};

const buildRiskNotes = ({ overview, risk, positions, fearGreed, reserve, portfolioValue }) => {
  const notes = [];
  const health = toNumber(overview.health);

  if (health > 0 && health < 70) {
    notes.push(`Health ниже нормы: ${Math.round(health)}/100.`);
  }

  const largestPositionNote = buildLargestPositionNote(positions);
  if (largestPositionNote) notes.push(largestPositionNote);

  const reserveNote = buildReserveNote({ overview, risk, reserve, portfolioValue });
  if (reserveNote) notes.push(reserveNote);

  if (toNumber(risk.futuresShare) > 0.1) {
    notes.push("Активная торговля выше лимита 10%.");
  }

  if (fearGreed.index !== null && fearGreed.index < 50) {
    notes.push(`Fear & Greed ${fearGreed.index}: рынок без сигнала к агрессивным покупкам.`);
  }

  return notes.slice(0, 4);
};

export function buildDailyTelegramReport(payload, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const accountId = options.accountId === "wife" ? "wife" : "main";
  const overview = isRecord(payload?.overview) ? payload.overview : {};
  const risk = isRecord(payload?.risk) ? payload.risk : {};
  const positions = normalizePositions(payload ?? {});
  const investmentPositions = positions.filter((position) => !position.isCash && position.currentValue >= MIN_REPORT_POSITION_VALUE_USD);
  const cashPositions = positions.filter((position) => position.isCash);
  const cashTotal = cashPositions.reduce((sum, position) => sum + position.currentValue, 0);
  const portfolioValue = toNumber(overview.portfolioValue);
  const reserve = toNumber(overview.reserve) || cashTotal;
  const reserveShare = portfolioValue > 0 ? reserve / portfolioValue : 0;
  const previousSnapshot = findPreviousDailySnapshot(payload?.history, now);
  const dailyPnlUsd = previousSnapshot ? portfolioValue - previousSnapshot.portfolioValue : null;
  const dailyPnlPct = previousSnapshot && previousSnapshot.portfolioValue > 0
    ? (dailyPnlUsd / previousSnapshot.portfolioValue) * 100
    : null;
  const fearGreedSource = isRecord(payload?.fearGreedStrategy) ? payload.fearGreedStrategy : {};
  const rawFearGreedIndex = fearGreedSource.currentIndex === undefined ? null : Math.round(toNumber(fearGreedSource.currentIndex));
  const fearGreed = {
    index: rawFearGreedIndex === null || !Number.isFinite(rawFearGreedIndex) ? null : rawFearGreedIndex,
    mode: modeLabel(fearGreedSource.currentZone || fearGreedSource.currentMode),
  };
  const computedHealth = options.computedHealth ?? computeDailyReportHealth(payload, {
    riskByCoin: options.hyperliquidRiskByCoin,
  });
  const health = resolveReportHealth({ overview, risk, computedHealth });
  const riskNotes = buildRiskNotes({ overview, risk, positions, fearGreed, reserve, portfolioValue });
  const positionLines = investmentPositions.slice(0, MAX_REPORT_POSITIONS).map((position) =>
    `- ${position.asset} — P&L ${formatSignedUsd(position.pnl)} (${formatPctValue(position.pnlPct)}).`
  );
  const overflowLine = investmentPositions.length > MAX_REPORT_POSITIONS
    ? `- Еще позиций: ${investmentPositions.length - MAX_REPORT_POSITIONS}.`
    : null;

  const lines = [
    `MUSHII INVEST — утренний отчет ${formatMoscowDate(now)}`,
    ...(accountId === "wife" ? ["Аккаунт: Полина"] : []),
    "",
    `1. Итог: вложено ${formatUsd(overview.invested)}, портфель ${formatUsd(portfolioValue)}, P&L ${formatSignedUsd(overview.pnl)} (${formatPctFraction(overview.pnlPct)}).`,
    previousSnapshot
      ? `24ч: ${formatSignedUsd(dailyPnlUsd)} (${formatPctValue(dailyPnlPct)}) к предыдущему дню.`
      : "24ч: нет предыдущего дневного снимка для расчета.",
    "",
    "2. Инвестиционные позиции:",
    ...positionLines,
    ...(overflowLine ? [overflowLine] : []),
    "",
    `3. Кэш и резерв: ${formatUsd(reserve)}, или ${formatPctPlain(reserveShare * 100)} портфеля. Это не инвестиционная позиция.`,
    "",
    health.line,
    fearGreed.index === null
      ? "5. Индекс страха и жадности: не передан в данных."
      : `5. Индекс страха и жадности: ${fearGreed.index}${fearGreed.mode ? `, зона ${fearGreed.mode}` : ""}.`,
    "",
    "6. Что проверить дальше:",
    ...(riskNotes.length ? riskNotes.map((note) => `- ${note}`) : ["- Новых критичных отклонений в переданных данных нет."]),
    "",
    "Это утренний read-only отчет. Он не является торговым сигналом.",
  ];

  return {
    text: lines.join("\n"),
    facts: {
      portfolioValue: round(portfolioValue, 2),
      invested: round(overview.invested, 2),
      pnl: round(overview.pnl, 2),
      pnlPct: round(overview.pnlPct, 6),
      reserve: round(reserve, 2),
      reserveShare: round(reserveShare, 4),
      positionsCount: investmentPositions.length,
      health: health.value,
      healthComponents: computedHealth?.components ?? null,
      dailyPnlUsd: dailyPnlUsd === null ? null : round(dailyPnlUsd, 2),
      dailyPnlPct: dailyPnlPct === null ? null : round(dailyPnlPct, 2),
      fearGreedIndex: fearGreed.index,
    },
  };
}

export async function sendTelegramMessage({ botToken, chatId, text }) {
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
  const body = await response.text();
  const parsed = (() => {
    try {
      return JSON.parse(body);
    } catch {
      return { ok: false, description: body.slice(0, 240) };
    }
  })();

  if (!response.ok || parsed.ok === false) {
    const description = compactText(parsed.description || body).slice(0, 240);
    throw new Error(`Telegram sendMessage failed: HTTP ${response.status}${description ? ` ${description}` : ""}`);
  }

  return parsed;
}

export async function runDailyTelegramReport({ accountId = "main", botToken, chatId, now = new Date() }) {
  const payload = await readInvestorPayloadForAssistant(accountId === "wife" ? "wife" : "main");
  if (!isRecord(payload) || payload.success === false) {
    throw new Error(compactText(payload?.error || "Investor API returned invalid payload"));
  }

  let hyperliquidRiskByCoin = {};
  try {
    hyperliquidRiskByCoin = await fetchDailyReportHyperliquidRisk();
  } catch {
    hyperliquidRiskByCoin = {};
  }

  const report = buildDailyTelegramReport(payload, { accountId, now, hyperliquidRiskByCoin });
  await sendTelegramMessage({ botToken, chatId, text: report.text });
  return report;
}
