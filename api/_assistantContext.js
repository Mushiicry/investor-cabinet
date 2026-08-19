import { selectAssistantKnowledge } from "./_assistantKnowledge.js";
import { readInvestorPayloadForAssistant } from "./_investorProxy.js";

const MAX_CONTEXT_POSITIONS = 12;
const MAX_TEXT_FIELD_LENGTH = 280;
const MAX_PAGE_CONTEXT_TEXT_LENGTH = 420;

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const toNumber = (value) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const toFiniteNumber = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const round = (value, digits = 4) => {
  const factor = 10 ** digits;
  return Math.round(toNumber(value) * factor) / factor;
};

const roundOptional = (value, digits = 4) => {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return undefined;
  const factor = 10 ** digits;
  return Math.round(parsed * factor) / factor;
};

const normalizeAccountId = (value) => value === "wife" ? "wife" : "main";

const STRATEGY_RULES = {
  main: {
    title: "Основная стратегия",
    role: "risk-first portfolio operating system",
    allocationLabel: "60/10/10/10/10",
    reserve: {
      floorShare: 0.1,
      targetShare: 0.3,
      bandMaxShare: 0.6,
      meaning: "Резерв защищает от вынужденной продажи, дает гибкость и свободу действия.",
    },
    limits: {
      cryptoMaxShare: 0.6,
      stocksMaxShare: 0.1,
      metalsMaxShare: 0.1,
      futuresMaxShare: 0.1,
      futuresAllowed: true,
      speculativeBlockMaxShare: 0.1,
      defaultCryptoAssetLimit: 0.05,
      cryptoAssetLimits: {
        ETH: 0.35,
        BTC: 0.2,
        SOL: 0.1,
        TON: 0.1,
        GRAM: 0.1,
        BNB: 0.1,
      },
    },
    discipline: [
      "Риск важнее прибыли.",
      "Перед покупкой проверить фазу рынка, резерв, лимиты, качество актива и выживание при просадке.",
      "Плечо не является базовым ускорителем капитала.",
      "Binance Monitoring List активы запрещены без отдельного качества и risk-gate.",
    ],
  },
  wife: {
    title: "Стратегия Полины",
    role: "protective long-term accumulation",
    allocationLabel: "75/8/7/10",
    reserve: {
      floorShare: 0.1,
      targetShare: 0.1,
      bandMaxShare: 0.6,
      meaning: "Резерв важен, но стратегия Полины сфокусирована на защитном накоплении и качестве активов.",
    },
    limits: {
      cryptoMaxShare: 0.75,
      stocksMaxShare: 0.07,
      metalsMaxShare: 0.08,
      futuresMaxShare: 0,
      futuresAllowed: false,
      defaultCryptoAssetLimit: 0,
      cryptoAssetLimits: {
        ETH: 0.75,
        BTC: 0.1,
        TON: 0.1,
        GRAM: 0.1,
        SOL: 0.05,
      },
      allowedMetalAssets: ["GOLD", "XAU", "XAUUSD"],
    },
    discipline: [
      "Фьючерсы не входят в стратегию Полины.",
      "Спекулятивные активы не подходят.",
      "Покупки только по плану.",
      "ETH-heavy накопление допустимо только в рамках лимитов стратегии.",
    ],
  },
};

const PROFILE_RULES = {
  main: {
    title: "Сбалансированный инвестор",
    horizon: "средний/длинный",
    drawdownTolerance: "средняя",
    volatilityTolerance: "средняя",
    discipline: "по плану с ручной проверкой",
    futuresFit: true,
    speculativeAssetsFit: true,
  },
  wife: {
    title: "Защитный долгосрочный накопитель",
    horizon: "длинный",
    drawdownTolerance: "средне-низкая",
    volatilityTolerance: "низкая",
    discipline: "только по плану",
    futuresFit: false,
    speculativeAssetsFit: false,
  },
};

function compactOverview(payload) {
  const overview = isRecord(payload.overview) ? payload.overview : {};
  const categories = Array.isArray(overview.categories) ? overview.categories : [];

  return {
    portfolioValue: round(overview.portfolioValue, 2),
    invested: round(overview.invested, 2),
    pnl: round(overview.pnl, 2),
    pnlPct: round(overview.pnlPct, 6),
    reserve: round(overview.reserve, 2),
    positionsCount: round(overview.positionsCount, 0),
    health: round(overview.health, 0),
    state: overview.state ?? "",
    signal: overview.signal ?? "",
    action: overview.action ?? "",
    realizedPnl: round(overview.realizedPnl, 2),
    realizedPnlPct: round(overview.realizedPnlPct, 6),
    categories: categories.map((category) => ({
      name: category.name ?? "",
      value: round(category.value, 2),
      share: round(category.share, 4),
    })),
  };
}

function compactRisk(payload) {
  const risk = isRecord(payload.risk) ? payload.risk : {};

  return cleanRecord({
    portfolioValue: roundOptional(risk.portfolioValue, 2),
    reserve: roundOptional(risk.reserve, 2),
    reserveShare: roundOptional(risk.reserveShare, 4),
    cryptoShare: roundOptional(risk.cryptoShare, 4),
    futuresShare: roundOptional(risk.futuresShare, 4),
    largestRiskAsset: risk.largestRiskAsset ?? "",
    largestRiskShare: roundOptional(risk.largestRiskShare, 4),
    health: roundOptional(risk.health, 0),
    state: risk.state ?? "",
    signal: risk.signal ?? "",
    deployableCash: roundOptional(risk.deployableCash, 2),
    spotDeployableCash: roundOptional(risk.spotDeployableCash, 2),
    futuresDeployableCash: roundOptional(risk.futuresDeployableCash, 2),
  });
}

function compactPositions(payload) {
  const positions = Array.isArray(payload.portfolio) ? payload.portfolio : [];

  return positions
    .map((position) => ({
      asset: position.asset ?? "",
      ticker: position.ticker ?? "",
      category: position.category ?? "",
      quantity: round(position.quantity, 8),
      invested: round(position.invested, 2),
      currentValue: round(position.currentValue, 2),
      pnl: round(position.pnl, 2),
      pnlPct: round(position.pnlPct, 4),
      share: round(position.share, 4),
    }))
    .sort((a, b) => Math.abs(b.currentValue) - Math.abs(a.currentValue))
    .slice(0, MAX_CONTEXT_POSITIONS);
}

function deriveConcentrationGuards(payload, accountId) {
  const strategy = STRATEGY_RULES[normalizeAccountId(accountId)];
  const positions = Array.isArray(payload.portfolio) ? payload.portfolio : [];
  const cryptoPositions = positions.filter((position) => (
    String(position.category ?? "").toLowerCase().includes("крип")
    && roundOptional(position.currentValue, 2) !== undefined
    && round(position.currentValue, 2) > 0
  ));
  const cryptoTotal = cryptoPositions.reduce((sum, position) => sum + round(position.currentValue, 2), 0);

  return cryptoPositions
    .map((position) => {
      const asset = compactText(position.asset ?? position.ticker).toUpperCase();
      const ticker = compactText(position.ticker ?? position.asset).toUpperCase();
      const limit = strategy.limits.cryptoAssetLimits[asset] ?? strategy.limits.cryptoAssetLimits[ticker] ?? strategy.limits.defaultCryptoAssetLimit;
      if (!limit || cryptoTotal <= 0) return null;

      const currentValue = round(position.currentValue, 2);
      const shareOfCrypto = currentValue / cryptoTotal;
      if (shareOfCrypto <= limit) return null;

      return {
        asset: compactText(position.asset ?? position.ticker),
        ticker: compactText(position.ticker ?? position.asset),
        currentValue,
        portfolioShare: round(position.share, 4),
        shareOfCryptoBlock: round(shareOfCrypto, 4),
        limitShareOfCryptoBlock: round(limit, 4),
        overLimitByShareOfCryptoBlock: round(shareOfCrypto - limit, 4),
        utilization: round(shareOfCrypto / limit, 4),
        rule: "Over-limit crypto asset. Increasing/averaging/add-buy is blocked until concentration returns inside strategy limit.",
        wording: "Call utilization 'использование лимита', not 'превышение'. Call overLimitByShareOfCryptoBlock 'превышение над лимитом'.",
      };
    })
    .filter(Boolean);
}

function recommendationConflictsWithGuard(asset, text, concentrationGuards) {
  const normalizedAsset = String(asset ?? "").trim().toUpperCase();
  const normalizedText = String(text ?? "").trim();
  if (!normalizedAsset || !normalizedText) return null;

  const guard = concentrationGuards.find((item) => (
    String(item.asset).toUpperCase() === normalizedAsset
    || String(item.ticker).toUpperCase() === normalizedAsset
  ));
  if (!guard) return null;

  const suggestsIncrease = /куп|докуп|добир|накап|усили|увелич/i.test(normalizedText);
  return suggestsIncrease ? guard : null;
}

function compactRecommendations(payload, concentrationGuards = []) {
  const recommendations = [];
  const signals = isRecord(payload.signals) ? payload.signals : {};
  const decisions = Array.isArray(payload.decisions) ? payload.decisions : [];
  const scenarios = Array.isArray(payload.scenarios) ? payload.scenarios : [];
  const dna = isRecord(payload.investorDNA) ? payload.investorDNA : {};

  if (payload.overview?.action) recommendations.push(String(payload.overview.action));
  if (payload.risk?.signal) recommendations.push(String(payload.risk.signal));
  if (signals.interest?.action) recommendations.push(String(signals.interest.action));

  decisions.slice(0, 5).forEach((decision) => {
    const action = String(decision.nextAction ?? decision.status ?? "");
    const conflict = recommendationConflictsWithGuard(decision.asset, action, concentrationGuards);
    recommendations.push(conflict
      ? `${decision.asset ?? "Актив"}: CONFLICT_BLOCKED — старый план предлагает увеличение, но текущая концентрация выше лимита; не использовать как разрешение на покупку.`
      : `${decision.asset ?? "Актив"}: ${action}`);
  });
  scenarios.slice(0, 4).forEach((scenario) => {
    const action = String(scenario.action ?? scenario.actionZone ?? "");
    const conflict = recommendationConflictsWithGuard(scenario.asset, action, concentrationGuards);
    recommendations.push(conflict
      ? `${scenario.asset ?? "Актив"}: CONFLICT_BLOCKED — сценарий предлагает увеличение, но текущая концентрация выше лимита; не использовать как разрешение на покупку.`
      : `${scenario.asset ?? "Актив"}: зона ${scenario.actionZone ?? "не задана"}`);
  });

  if (Array.isArray(dna.recommendations)) {
    dna.recommendations.slice(0, 4).forEach((item) => {
      recommendations.push(`${item.title ?? "ДНК"}: ${item.action ?? item.reason ?? ""}`);
    });
  }

  return [...new Set(recommendations.filter(Boolean))].slice(0, 12);
}

function detectAnswerFocus(question) {
  const normalized = String(question || "").toLowerCase();
  const asksPortfolioReport = (
    /(отчет|отчёт|сводк|итог|резюме|summary|report)/i.test(normalized)
    && /(портфел|позици|влож|прибыл|убыт|p&l|pnl|пнл|cash|кэш|резерв|health|хелс|страх|жадн|fear|greed)/i.test(normalized)
  );
  const asksRecommendationPanel = (
    /(рекомендац|совет|карточк)/i.test(normalized)
    && /(справа|прав[оы]й|радар|overview|обзор|главн|экран|панел)/i.test(normalized)
  );
  const asksStaking = /(стейк|staking|stake|доход со стейкинга|в стейке)/i.test(normalized);
  const asksPageOrTab = /(страниц|вкладк|сайдбар|меню|раздел|экран|что тут|что здесь|что расскаж|что покаж|что означает вклад)/i.test(normalized);
  const asksDetailedHealth = (
    /(здоров|health|хелс)/i.test(normalized)
    && /(подроб|разбор|компонент|почему|всем|всех|фактор|оценк)/i.test(normalized)
  );
  const asksHealthPageOverview = (
    /(здоров|health|хелс)/i.test(normalized)
    && asksPageOrTab
    && !asksDetailedHealth
  );

  if (asksPortfolioReport) {
    return {
      type: "portfolio_daily_report",
      instruction: [
        "Вопрос просит краткий отчет по портфелю за сегодня.",
        "Главный источник для ответа — context.dailyReport, затем uiSnapshot.currentPage.facts.",
        "Структура ответа: 1) итог одной строкой; 2) вложено/текущая стоимость/общий P&L; 3) P&L 24H, только если dailyReport.dataAvailability.hasDailyPnl=true; 4) инвестиционные позиции; 5) кэш/резерв отдельно; 6) Health Factor; 7) индекс страха и жадности, только если hasFearGreed=true; 8) главный риск/что проверить.",
        "Не называй общий P&L дневным результатом. Дневной P&L брать только из dailyReport.dailyPnl.",
        "Позиции перечисляй только из dailyReport.investmentPositions. Кэш/резерв не смешивай с инвестиционными позициями.",
        "Для каждой позиции называй asset, value, sharePct, pnl и pnlPct, если эти поля есть.",
        "Если P&L 24H или Fear & Greed не переданы, коротко скажи, что именно не передано, без догадок.",
      ],
      allowedContext: [
        "dailyReport",
        "uiSnapshot.currentPage.facts.dailyPnl",
        "uiSnapshot.currentPage.facts.fearGreed",
        "uiSnapshot.currentPage.facts.visibleInvestmentPositions",
        "uiSnapshot.currentPage.facts.cashAndReserveRows",
        "uiSnapshot.health.components",
      ],
      forbiddenContextForThisQuestion: [
        "recommendations as buy permission",
        "signals as current holdings",
        "scenarios as current holdings",
        "manual daily PnL math outside dailyReport.dailyPnl",
      ],
    };
  }

  if (asksRecommendationPanel) {
    return {
      type: "visible_overview_recommendations",
      instruction: [
        "Вопрос про видимый блок рекомендаций справа от радара здоровья на Overview.",
        "Отвечай только по uiSnapshot.currentPage.facts.recommendations, если они есть.",
        "Объясни смысл карточек: это risk-first подсказки проверки и улучшения здоровья, не торговые команды.",
        "Для каждой карточки можно назвать только переданные поля level/title/detail/action.",
        "Не подтягивай ценовые точки, сигналы, сценарии, positions, concentrationGuards, strategy limits или health formula, если пользователь прямо не просит конкретный актив/лимит/формулу.",
        "Не объясняй 'точка сработала' как ценовой сигнал, если этого нет в visible recommendations.",
        "Не называй точные лимиты активов и цены из других слоёв контекста.",
      ],
      allowedContext: [
        "uiSnapshot.currentPage.facts.recommendations",
        "uiSnapshot.portfolio.healthFactor",
        "uiSnapshot.health.healthFactor",
      ],
      forbiddenContextForThisQuestion: [
        "signals.interest",
        "scenarios",
        "positions",
        "concentrationGuards",
        "strategy.cryptoAssetLimits",
        "healthInput.worstConcentration*",
        "uiSnapshot.health.components formulas/meta",
      ],
    };
  }

  if (asksStaking) {
    return {
      type: "visible_portfolio_staking",
      instruction: [
        "Вопрос про активы в стейкинге на вкладке Портфель.",
        "Отвечай по uiSnapshot.currentPage.facts.visibleInvestmentPositions[].staking, если этот список есть.",
        "Если хотя бы одна позиция имеет staking.isStaked=true, назови только эти активы и их переданные поля staking.",
        "Не отвечай, что данных нет, если в visibleInvestmentPositions есть staking.isStaked=true.",
        "Не приплетай статусы позиций, closed/exited, cash rows, лимиты, рекомендации или health formula.",
        "Если staking.isStaked=true нет ни у одной позиции, скажи: на текущей вкладке не вижу активов с бейджем 'в стейке'.",
      ],
      allowedContext: [
        "uiSnapshot.currentPage.facts.visibleInvestmentPositions[].asset",
        "uiSnapshot.currentPage.facts.visibleInvestmentPositions[].staking",
      ],
      forbiddenContextForThisQuestion: [
        "positions.status",
        "cashAndReserveRows",
        "recommendations",
        "scenarios",
        "signals",
        "health formula",
        "concentrationGuards",
      ],
    };
  }

  if (asksHealthPageOverview) {
    return {
      type: "health_page_overview",
      instruction: [
        "Вопрос про назначение вкладки/страницы Здоровье, а не про полный расчет Health Factor.",
        "Отвечай по uiSnapshot.currentPage.label, uiSnapshot.currentPage.purpose, uiSnapshot.currentPage.visibleBlocks и uiSnapshot.currentPage.facts.pageGuide.",
        "Кратко объясни основные секции страницы: показатель здоровья, диагноз, рекомендации, цель капитала, инвестиционная стратегия, жесткие ограничения, лучи здоровья, ДНК инвестора, разбор здоровья и симулятор.",
        "Можно назвать текущий Health Factor одной строкой как контекст, если он есть.",
        "Не уходи в подробный расчет всех компонентов, если пользователь не спросил почему здоровье такое или не попросил подробный разбор.",
        "Не подтягивай healthInput, futuresFacts, positions, scenarios, signals, global recommendations или формулы здоровья для этого вопроса.",
      ],
      allowedContext: [
        "uiSnapshot.currentPage.label",
        "uiSnapshot.currentPage.purpose",
        "uiSnapshot.currentPage.visibleBlocks",
        "uiSnapshot.currentPage.facts.pageGuide",
        "uiSnapshot.health.healthFactor",
        "uiSnapshot.portfolio.healthFactor",
      ],
      forbiddenContextForThisQuestion: [
        "healthInput",
        "uiSnapshot.futuresFacts",
        "positions",
        "scenarios",
        "signals",
        "global recommendations",
        "full health formulas",
      ],
    };
  }

  if (asksDetailedHealth) {
    return {
      type: "detailed_health_components",
      instruction: [
        "Вопрос про подробный разбор здоровья портфеля.",
        "Сначала используй видимые компоненты: uiSnapshot.currentPage.facts.visibleHealthComponents, если они есть; иначе uiSnapshot.health.components.",
        "Главное число здоровья бери из uiSnapshot.health.healthFactor или uiSnapshot.portfolio.healthFactor.",
        "Для каждого компонента называй видимый score, смысл desc, blockers и warnings.",
        "Не пересчитывай баллы, проценты, лимиты и веса заново. Если нужны формулы, читай только уже переданные formulas/meta и называй это 'по переданной формуле'.",
        "Не смешивай разные уровни: видимый score компонента отдельно, техническая расшифровка формулы отдельно.",
        "Не называй оценочные поля точной биржевой маржей или точным разрешением на действие.",
      ],
      allowedContext: [
        "uiSnapshot.health.healthFactor",
        "uiSnapshot.portfolio.healthFactor",
        "uiSnapshot.currentPage.facts.visibleHealthComponents",
        "uiSnapshot.health.components",
        "uiSnapshot.futuresFacts",
      ],
      forbiddenContextForThisQuestion: [
        "signals",
        "scenarios",
        "positions.status",
        "decision plans",
      ],
    };
  }

  return {
    type: "general",
    instruction: "Отвечай по общим sourcePriority и answerGuards.",
  };
}

function compactText(value) {
  const text = String(value ?? "").trim();
  return text.length > MAX_TEXT_FIELD_LENGTH ? `${text.slice(0, MAX_TEXT_FIELD_LENGTH)}...` : text;
}

function compactPageText(value) {
  const text = String(value ?? "").trim();
  return text.length > MAX_PAGE_CONTEXT_TEXT_LENGTH ? `${text.slice(0, MAX_PAGE_CONTEXT_TEXT_LENGTH)}...` : text;
}

function cleanRecord(record) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function compactAny(value, depth = 0) {
  if (depth > 4) return "[compact]";
  if (Array.isArray(value)) return value.slice(0, 12).map((item) => compactAny(item, depth + 1));
  if (isRecord(value)) {
    return cleanRecord(Object.fromEntries(
      Object.entries(value)
        .slice(0, 40)
        .map(([key, item]) => [key, compactAny(item, depth + 1)]),
    ));
  }
  if (typeof value === "number") return roundOptional(value, 6);
  if (typeof value === "boolean") return value;
  return compactPageText(value);
}

function compactPageContext(pageContext) {
  if (!isRecord(pageContext)) return null;
  return {
    id: compactText(pageContext.id),
    label: compactText(pageContext.label),
    purpose: compactText(pageContext.purpose),
    visibleBlocks: Array.isArray(pageContext.visibleBlocks)
      ? pageContext.visibleBlocks.map(compactText).slice(0, 12)
      : [],
    facts: compactAny(isRecord(pageContext.facts) ? pageContext.facts : {}),
  };
}

function normalizeReportPosition(position) {
  if (!isRecord(position)) return null;
  const value = roundOptional(position.value ?? position.currentValue, 2);
  if (value === undefined || value <= 0) return null;

  return cleanRecord({
    asset: compactText(position.asset ?? position.ticker),
    ticker: compactText(position.ticker),
    category: compactText(position.category),
    invested: roundOptional(position.invested, 2),
    value,
    sharePct: roundOptional(position.share, 2),
    pnl: roundOptional(position.pnl, 2),
    pnlPct: roundOptional(position.pnlPct, 2),
    source: compactText(position.source),
  });
}

function normalizeCashRow(row) {
  if (!isRecord(row)) return null;
  const value = roundOptional(row.value ?? row.currentValue, 2);
  if (value === undefined || value <= 0) return null;

  return cleanRecord({
    asset: compactText(row.asset ?? row.name ?? row.ticker),
    value,
    sharePct: roundOptional(row.share, 2),
    role: compactText(row.role),
  });
}

function buildDailyReport({ overview, positions, uiSnapshot }) {
  const pageFacts = isRecord(uiSnapshot?.currentPage?.facts) ? uiSnapshot.currentPage.facts : {};
  const portfolio = isRecord(uiSnapshot?.portfolio) ? uiSnapshot.portfolio : {};
  const health = isRecord(uiSnapshot?.health) ? uiSnapshot.health : {};
  const visiblePositions = Array.isArray(pageFacts.visibleInvestmentPositions)
    ? pageFacts.visibleInvestmentPositions
    : [];
  const cashRows = Array.isArray(pageFacts.cashAndReserveRows)
    ? pageFacts.cashAndReserveRows
    : [];
  const allocation = Array.isArray(uiSnapshot?.allocation) ? uiSnapshot.allocation : [];
  const visibleDailyPnl = isRecord(pageFacts.dailyPnl) ? pageFacts.dailyPnl : {};
  const visibleFearGreed = isRecord(pageFacts.fearGreed) ? pageFacts.fearGreed : {};
  const fallbackCashRows = allocation.filter((row) => (
    String(row.name ?? "").toLowerCase().includes("свобод")
    || String(row.name ?? "").toLowerCase().includes("cash")
    || String(row.name ?? "").toLowerCase().includes("резерв")
  ));
  const reportPositions = (visiblePositions.length > 0 ? visiblePositions : positions)
    .map(normalizeReportPosition)
    .filter(Boolean)
    .filter((position) => !String(position.category).toLowerCase().includes("свобод"))
    .slice(0, MAX_CONTEXT_POSITIONS);
  const reportCashRows = (cashRows.length > 0 ? cashRows : fallbackCashRows)
    .map(normalizeCashRow)
    .filter(Boolean)
    .slice(0, 8);
  const healthComponents = Array.isArray(health.components) ? health.components : [];
  const weakHealthComponents = healthComponents
    .filter((component) => roundOptional(component.score, 0) !== undefined)
    .sort((a, b) => round(a.score, 0) - round(b.score, 0))
    .slice(0, 3)
    .map((component) => ({
      label: compactText(component.label),
      score: round(component.score, 0),
      desc: compactText(component.desc),
      blockers: Array.isArray(component.blockers) ? component.blockers.map(compactText).slice(0, 3) : [],
      warnings: Array.isArray(component.warnings) ? component.warnings.map(compactText).slice(0, 3) : [],
    }));
  const dailyPnlUsd = roundOptional(visibleDailyPnl.pnlUsd, 2);
  const dailyPnlPct = roundOptional(visibleDailyPnl.pnlPct, 2);
  const fearGreedIndex = roundOptional(visibleFearGreed.currentIndex, 0);

  return cleanRecord({
    source: "normalized assistant report facts from visible UI snapshot and /api/investor",
    totals: cleanRecord({
      invested: roundOptional(portfolio.totalInvested ?? overview.invested, 2),
      portfolioValue: roundOptional(portfolio.totalPortfolioValue ?? overview.portfolioValue, 2),
      totalPnlUsd: roundOptional(portfolio.pnlUsd ?? overview.pnl, 2),
      totalPnlPct: roundOptional(portfolio.pnlPct ?? overview.pnlPct, 6),
      reserveUsd: roundOptional(portfolio.stableReserve ?? overview.reserve, 2),
      reserveShare: roundOptional(portfolio.reserveShare, 4),
      positionsCount: roundOptional(portfolio.positionsCount ?? overview.positionsCount, 0),
    }),
    dailyPnl: cleanRecord({
      pnlUsd: dailyPnlUsd,
      pnlPct: dailyPnlPct,
      previousSnapshotDate: compactText(visibleDailyPnl.previousSnapshotDate),
      previousPortfolioValue: roundOptional(visibleDailyPnl.previousPortfolioValue, 2),
      source: compactText(visibleDailyPnl.source),
      rule: compactText(visibleDailyPnl.rule),
    }),
    investmentPositions: reportPositions,
    cashAndReserveRows: reportCashRows,
    health: cleanRecord({
      healthFactor: roundOptional(health.healthFactor ?? portfolio.healthFactor ?? overview.health, 0),
      status: compactText(health.status),
      riskLevel: compactText(health.riskLevel ?? portfolio.riskLevel),
      weakestComponents: weakHealthComponents,
    }),
    fearGreed: cleanRecord({
      currentIndex: fearGreedIndex,
      currentZone: compactText(visibleFearGreed.currentZone),
      marketMood: compactText(visibleFearGreed.marketMood),
      mode: compactText(visibleFearGreed.mode),
      source: compactText(visibleFearGreed.source),
    }),
    dataAvailability: {
      hasDailyPnl: dailyPnlUsd !== undefined,
      hasFearGreed: fearGreedIndex !== undefined,
      positionsSource: visiblePositions.length > 0 ? "uiSnapshot.currentPage.facts.visibleInvestmentPositions" : "/api/investor portfolio",
      cashSource: cashRows.length > 0 ? "uiSnapshot.currentPage.facts.cashAndReserveRows" : "uiSnapshot.allocation",
      totalPnlIsDaily: false,
    },
    wordingRules: [
      "Общий P&L = totals.totalPnlUsd; дневной P&L = dailyPnl.pnlUsd.",
      "Не называй totals.totalPnlUsd результатом за сегодня.",
      "Кэш/резерв всегда отдельным блоком, не в списке инвестиционных позиций.",
      "Fear & Greed называй только если dataAvailability.hasFearGreed=true.",
    ],
  });
}

function buildFuturesRiskBudgetBreakdown({ riskControl, healthInput, portfolio }) {
  const futuresUsedUsd = roundOptional(riskControl?.meta?.futuresUsedUsd, 2);
  const futuresCapUsd = roundOptional(riskControl?.meta?.futuresCapUsd, 2);
  if (futuresUsedUsd === undefined && futuresCapUsd === undefined) return {};

  const futuresDeployableUsd = roundOptional(healthInput.futuresDeployableUsd ?? portfolio.futuresDeployable, 2);
  const investedCapital = roundOptional(healthInput.investedCapital ?? portfolio.totalInvested, 2);
  const futuresShare = roundOptional(healthInput.futuresShare, 4);
  const futuresBreachUsd = roundOptional(riskControl?.meta?.futuresBreachUsd, 2);
  const futuresRemainingUsd = roundOptional(riskControl?.meta?.futuresRemainingUsd, 2);
  const futuresCapUtilization = roundOptional(riskControl?.meta?.futuresCapUtilization, 4);
  const estimatedOpenFuturesMarginUsd =
    futuresUsedUsd !== undefined && futuresDeployableUsd !== undefined
      ? roundOptional(Math.max(0, futuresUsedUsd - futuresDeployableUsd), 2)
      : undefined;

  return cleanRecord({
    source: "frontend health-formula read-only расшифровка",
    plainMeaning: "Это не биржевая маржа. Это занято в лимите активной торговли по health-formula.",
    formula: "futuresUsedUsd = open futures invested margin + USDC HL/free futures margin",
    components: cleanRecord({
      estimatedOpenFuturesMarginUsd,
      freeFuturesMarginUsd: futuresDeployableUsd,
    }),
    totals: cleanRecord({
      investedCapital,
      futuresShare,
      futuresUsedUsd,
      futuresCapUsd,
      futuresRemainingUsd,
      futuresBreachUsd,
      futuresCapUtilization,
    }),
    wordingRules: [
      "Говори 'по health-formula занято в лимите активной торговли'.",
      "Не называй futuresUsedUsd биржевой маржей.",
      "Не пересчитывай эти числа заново; просто объясняй готовую расшифровку.",
      "Не используй слово breakdown в русском ответе; говори 'расшифровка' или 'разбивка'.",
    ],
  });
}

function compactHealthComponent(component) {
  if (!isRecord(component)) return null;
  const meta = isRecord(component.meta) ? component.meta : {};
  const formulas = [
    ...(Array.isArray(meta.reserveFormula) ? meta.reserveFormula : []),
    ...(Array.isArray(meta.survivalFormula) ? meta.survivalFormula : []),
    ...(Array.isArray(meta.riskControlFormula) ? meta.riskControlFormula : []),
    ...(Array.isArray(meta.concentrationFormula) ? meta.concentrationFormula : []),
    ...(Array.isArray(meta.diversificationFormula) ? meta.diversificationFormula : []),
    ...(Array.isArray(meta.disciplineFormula) ? meta.disciplineFormula : []),
  ];
  const blockers = [
    ...(Array.isArray(meta.reserveBlockers) ? meta.reserveBlockers : []),
    ...(Array.isArray(meta.survivalBlockers) ? meta.survivalBlockers : []),
    ...(Array.isArray(meta.riskControlBlockers) ? meta.riskControlBlockers : []),
    ...(Array.isArray(meta.concentrationBlockers) ? meta.concentrationBlockers : []),
    ...(Array.isArray(meta.diversificationBlockers) ? meta.diversificationBlockers : []),
    ...(Array.isArray(meta.disciplineBlockers) ? meta.disciplineBlockers : []),
  ];
  const warnings = [
    ...(Array.isArray(meta.reserveWarnings) ? meta.reserveWarnings : []),
    ...(Array.isArray(meta.survivalWarnings) ? meta.survivalWarnings : []),
    ...(Array.isArray(meta.riskControlWarnings) ? meta.riskControlWarnings : []),
    ...(Array.isArray(meta.concentrationWarnings) ? meta.concentrationWarnings : []),
    ...(Array.isArray(meta.diversificationWarnings) ? meta.diversificationWarnings : []),
    ...(Array.isArray(meta.disciplineWarnings) ? meta.disciplineWarnings : []),
  ];

  return {
    key: compactText(component.v2Key ?? component.key),
    legacyKey: compactText(component.key),
    label: compactText(component.label),
    score: round(component.score, 0),
    weight: round(component.weight, 3),
    desc: compactText(component.desc),
    blockers: blockers.map(compactText).slice(0, 6),
    warnings: warnings.map(compactText).slice(0, 6),
    formulas: formulas.map(compactText).slice(0, 8),
    meta: cleanRecord({
      reserveUsd: roundOptional(meta.reserveUsd, 2),
      reserveBaseUsd: roundOptional(meta.reserveBaseUsd, 2),
      reserveShare: roundOptional(meta.reserveShare, 4),
      reserveFloorUsd: roundOptional(meta.reserveFloorUsd, 2),
      reserveTargetUsd: roundOptional(meta.reserveTargetUsd, 2),
      reserveIdleUsd: roundOptional(meta.reserveIdleUsd, 2),
      futuresCapUsd: roundOptional(meta.futuresCapUsd, 2),
      futuresUsedUsd: roundOptional(meta.futuresUsedUsd, 2),
      futuresRemainingUsd: roundOptional(meta.futuresRemainingUsd, 2),
      futuresBreachUsd: roundOptional(meta.futuresBreachUsd, 2),
      futuresCapUtilization: roundOptional(meta.futuresCapUtilization, 4),
      worstConcentrationAsset: compactText(meta.worstConcentrationAsset),
      worstConcentrationShare: roundOptional(meta.worstConcentrationShare, 4),
      worstConcentrationPortfolioShare: roundOptional(meta.worstConcentrationPortfolioShare, 4),
      worstConcentrationLimit: roundOptional(meta.worstConcentrationLimit, 4),
      maxAssetLimitUtilization: roundOptional(meta.maxAssetLimitUtilization, 4),
      overLimitAssets: Array.isArray(meta.overLimitAssets) ? meta.overLimitAssets.map(compactText).slice(0, 8) : [],
      largestClassName: compactText(meta.largestClassName),
      largestClassShareOfRisk: roundOptional(meta.largestClassShareOfRisk, 4),
      largestClassShareOfPortfolio: roundOptional(meta.largestClassShareOfPortfolio, 4),
      activeClassCount: roundOptional(meta.activeClassCount, 0),
      riskClassTotalShare: roundOptional(meta.riskClassTotalShare, 4),
    }),
  };
}

function compactClientContext(clientContext) {
  if (!isRecord(clientContext)) return null;
  const portfolio = isRecord(clientContext.portfolio) ? clientContext.portfolio : {};
  const health = isRecord(clientContext.health) ? clientContext.health : {};
  const healthInput = isRecord(clientContext.healthInput) ? clientContext.healthInput : {};
  const allocation = Array.isArray(clientContext.allocation) ? clientContext.allocation : [];
  const components = Array.isArray(health.components) ? health.components : [];
  const healthComponents = components.map(compactHealthComponent).filter(Boolean);
  const riskControl = healthComponents.find((component) => (
    ["riskControl", "risk-control", "control"].includes(component.key)
    || component.label.toLowerCase().includes("контроль")
    || component.label.toLowerCase().includes("risk")
  ));

  return {
    accountId: normalizeAccountId(clientContext.accountId),
    renderedAt: compactText(clientContext.renderedAt),
    source: "V2 frontend read-only rendered snapshot",
    canonicalForVisibleNumbers: true,
    currentPage: compactPageContext(clientContext.currentPage),
    portfolio: {
      totalPortfolioValue: round(portfolio.totalPortfolioValue, 2),
      totalInvested: round(portfolio.totalInvested, 2),
      pnlUsd: round(portfolio.pnlUsd, 2),
      pnlPct: round(portfolio.pnlPct, 6),
      stableReserve: round(portfolio.stableReserve, 2),
      reserveShare: round(portfolio.reserveShare, 4),
      positionsCount: round(portfolio.positionsCount, 0),
      healthFactor: round(portfolio.healthFactor, 0),
      riskLevel: compactText(portfolio.riskLevel),
      deployableCapital: round(portfolio.deployableCapital, 2),
      spotDeployable: round(portfolio.spotDeployable, 2),
      futuresDeployable: round(portfolio.futuresDeployable, 2),
      exposureMode: compactText(portfolio.exposureMode),
      exposureSignal: compactText(portfolio.exposureSignal),
      realizedPnlUsd: round(portfolio.realizedPnlUsd, 2),
      realizedPnlPct: round(portfolio.realizedPnlPct, 6),
    },
    health: {
      healthFactor: round(health.healthFactor, 0),
      status: compactText(health.status),
      riskLevel: compactText(health.riskLevel),
      components: healthComponents,
    },
    healthInput: cleanRecord({
      cashShare: roundOptional(healthInput.cashShare, 4),
      cryptoShare: roundOptional(healthInput.cryptoShare, 4),
      futuresShare: roundOptional(healthInput.futuresShare, 4),
      largestShare: roundOptional(healthInput.largestShare, 4),
      reserveShare: roundOptional(healthInput.reserveShare, 4),
      portfolioValue: roundOptional(healthInput.portfolioValue, 2),
      investedCapital: roundOptional(healthInput.investedCapital, 2),
      spotDeployableUsd: roundOptional(healthInput.spotDeployableUsd, 2),
      futuresDeployableUsd: roundOptional(healthInput.futuresDeployableUsd, 2),
      plannedLimitOrdersUsd: roundOptional(healthInput.plannedLimitOrdersUsd, 2),
      concentrationScore: roundOptional(healthInput.concentrationScore, 0),
      maxAssetLimitUtilization: roundOptional(healthInput.maxAssetLimitUtilization, 4),
      worstConcentrationAsset: compactText(healthInput.worstConcentrationAsset),
      worstConcentrationShare: roundOptional(healthInput.worstConcentrationShare, 4),
      worstConcentrationPortfolioShare: roundOptional(healthInput.worstConcentrationPortfolioShare, 4),
      worstConcentrationLimit: roundOptional(healthInput.worstConcentrationLimit, 4),
      overLimitAssets: Array.isArray(healthInput.overLimitAssets) ? healthInput.overLimitAssets.map(compactText).slice(0, 8) : [],
    }),
    futuresFacts: cleanRecord({
      source: "read-only UI health formula fields only",
      caution: "Do not invent futures margin math. Use only these fields; if a field is absent, say the exact futures limit details must be checked in the Capital Ladder/Risk screen.",
      futuresShare: roundOptional(healthInput.futuresShare, 4),
      futuresDeployableUsd: roundOptional(healthInput.futuresDeployableUsd ?? portfolio.futuresDeployable, 2),
      futuresCapUsd: roundOptional(riskControl?.meta?.futuresCapUsd, 2),
      futuresUsedUsd: roundOptional(riskControl?.meta?.futuresUsedUsd, 2),
      futuresRemainingUsd: roundOptional(riskControl?.meta?.futuresRemainingUsd, 2),
      futuresBreachUsd: roundOptional(riskControl?.meta?.futuresBreachUsd, 2),
      futuresCapUtilization: roundOptional(riskControl?.meta?.futuresCapUtilization, 4),
      riskBudgetBreakdown: buildFuturesRiskBudgetBreakdown({ riskControl, healthInput, portfolio }),
    }),
    allocation: allocation.map((category) => ({
      name: compactText(category.name),
      value: round(category.value, 2),
      share: round(category.share, 4),
    })),
  };
}

export async function buildAssistantContext(accountId, clientContext = null, question = "") {
  const normalizedAccountId = normalizeAccountId(accountId);
  const payload = await readInvestorPayloadForAssistant(normalizedAccountId);

  if (!payload?.success) {
    return {
      ok: false,
      status: 502,
      body: {
        success: false,
        error: payload?.error ?? "Investor data is unavailable",
        upstreamStatus: payload?.upstreamStatus,
      },
    };
  }

  const concentrationGuards = deriveConcentrationGuards(payload, normalizedAccountId);
  const answerFocus = detectAnswerFocus(question);
  const includeGlobalRecommendations = answerFocus.type === "general";
  const knowledgeOptions = answerFocus.type === "health_page_overview"
    ? { excludeSections: ["Health Formula"] }
    : {};
  const overview = compactOverview(payload);
  const positions = compactPositions(payload);
  const uiSnapshot = compactClientContext(clientContext);
  const risk = compactRisk(payload);
  const dailyReport = buildDailyReport({ overview, positions, uiSnapshot });

  return {
    ok: true,
    accountId: normalizedAccountId,
    context: {
      readOnly: true,
      accountId: normalizedAccountId,
      source: normalizedAccountId === "wife" ? "/api/investor-wife" : "/api/investor",
      overview,
      positions,
      risk,
      uiSnapshot,
      dailyReport,
      answerFocus,
      sourcePriority: [
        "1. uiSnapshot.health.healthFactor / uiSnapshot.portfolio.healthFactor — главное число здоровья, если передано.",
        "2. uiSnapshot.currentPage — главный источник текущей открытой вкладки, видимых блоков, названий и page-specific фактов.",
        "3. uiSnapshot allocation/portfolio — главные видимые цифры overview, если переданы.",
        "4. /api/investor overview/risk/portfolio — source of truth для raw фактов портфеля.",
        "5. overview.health и risk.health могут быть legacy и не должны перебивать uiSnapshot Health Factor.",
        "6. По фьючерсам сначала читать uiSnapshot.futuresFacts.riskBudgetBreakdown, если он есть. Не смешивать health-formula, свободную маржу и биржевую маржу.",
        "7. На вкладке Портфель сначала читать uiSnapshot.currentPage.facts.visibleInvestmentPositions; cashAndReserveRows объяснять отдельно как кэш/резерв, а не как инвестиционные активы.",
        "8. По стейкингу на вкладке Портфель читать только uiSnapshot.currentPage.facts.visibleInvestmentPositions[].staking.",
        "9. Для краткого отчета по портфелю использовать context.dailyReport как нормализованный источник: totals, dailyPnl, investmentPositions, cashAndReserveRows, health, fearGreed.",
      ],
      answerGuards: [
        "Отвечать строго по теме вопроса. Не добавлять соседние темы только потому, что они есть в контексте.",
        "Для понятийных вопросов давать объяснение понятия и максимум 1-2 релевантные цифры, без пересказа всего портфеля.",
        "Для вопросов про DCA читать uiSnapshot.currentPage.facts.dcaStrategy, если он есть: зоны индекса, проценты покупки, текущий индекс и текущую зону.",
        "Если актив выше лимита или компонент concentration содержит blocker/overLimitAssets, нельзя говорить, что актив можно докупать или накапливать.",
        "Если answerFocus.type = visible_overview_recommendations, отвечать только по answerFocus.allowedContext и не использовать forbiddenContextForThisQuestion.",
        "Для видимых рекомендаций справа от радара объясняй карточки как подсказки проверки риска/дисциплины: title = что сделать/не делать, detail = почему, action = первый проверочный шаг, level/gain = ожидаемый вклад в здоровье. Это не приказ и не автоматическое действие.",
        "Если answerFocus.type = visible_portfolio_staking, отвечать только по visibleInvestmentPositions[].staking. Если есть staking.isStaked=true, перечислить эти активы и не писать, что данных нет.",
        "Если answerFocus.type = health_page_overview, объяснять вкладку Здоровье как страницу: назначение и видимые разделы. Не делать подробный расчет Health Factor.",
        "Если answerFocus.type = detailed_health_components, сначала разбирать видимые компоненты здоровья и их score; формулы использовать только как пояснение, без собственной математики.",
        "Если answerFocus.type = portfolio_daily_report, отвечать по context.dailyReport: общий P&L отдельно от P&L 24H, позиции отдельно от кэша/резерва, Fear & Greed только если он передан.",
        "При over-limit нельзя писать 'рекомендация положительная', 'есть накопление', 'можно купить' или 'можно добрать'. Разрешенная формулировка: увеличение заблокировано до возврата в лимит.",
        "Запреты, blockers и фраза 'Не докупать' всегда сильнее recommendations/scenarios/желания пользователя.",
        "Если recommendation выглядит положительной, но тот же актив выше лимита, объясни конфликт и держи risk-first запрет на увеличение позиции.",
        "Не упоминать статусы позиций, если пользователь прямо не спрашивает про статусы.",
        "USDC, USDT и USDC HL в категории 'Свободные деньги' — это кэш/резерв/маржа, а не обычные инвестиционные активы портфеля.",
      ],
      concentrationGuards,
      knowledgePack: selectAssistantKnowledge(question, knowledgeOptions),
      recommendations: includeGlobalRecommendations ? compactRecommendations(payload, concentrationGuards) : [],
      strategy: STRATEGY_RULES[normalizedAccountId],
      profile: PROFILE_RULES[normalizedAccountId],
      boundaries: [
        "Frontend не является источником портфельных данных.",
        "Google Sheets и Apps Script API остаются source of truth.",
        "Assistant не имеет write endpoints, tools или торговых команд.",
        "Ответы являются объяснением стратегии и risk checks, а не приказом купить или продать.",
      ],
    },
  };
}

export const ASSISTANT_SYSTEM_PROMPT = [
  "Ты помощник Investor Cabinet.",
  "Твоя роль — объяснять состояние портфеля, риск, лимиты, резерв, концентрацию, дисциплину и рекомендации.",
  "Ты не даешь приказов покупать или продавать.",
  "Ты не имеешь права менять данные.",
  "Ты не утверждаешь, что сделка безопасна.",
  "Ты объясняешь, что разрешено стратегией, что запрещено, где риск, и какие проверки нужно сделать перед действием.",
  "Главный приоритет: Risk first. Discipline first. PnL second.",
  "Отвечай на русском, кратко и строго.",
  "Отвечай строго на заданный вопрос. Не добавляй соседние темы только потому, что они есть в контексте.",
  "Если вопрос понятийный ('что такое DCA', 'что значит резерв', 'что значит лимит'), дай объяснение понятия и максимум 1-2 релевантные цифры. Не пересказывай весь портфель, стейблы, Health Factor, фьючерсы или blockers, если пользователь прямо не спрашивал.",
  "Для вопроса про стратегию DCA обязательно объясни зоны индекса: 30-100 наблюдаем; 20-29 покупка на 1%; 15-19 покупка на 1.5%; 0-14 покупка на 2%. Укажи текущий индекс и текущую зону, если они есть в контексте.",
  "Для вопроса 'что такое стратегия DCA' объясни: плановый поэтапный добор, когда используется, чем отличается от ручного спот-добора, и что это не разрешение нарушать проверку риска. Не перечисляй резерв, стейблы, HL-маржу и все блокировки.",
  "Не используй английские служебные слова в русском ответе: cautious, Balanced, risk-gate, blockers, breakdown, status, mode. Замени на русские слова: осторожная зона, баланс, проверка риска, блокировки, расшифровка, статус, режим.",
  "Не упоминай статусы позиций в ответе, если пользователь прямо не спрашивает про статусы.",
  "Если данных недостаточно, прямо скажи, каких read-only данных не хватает.",
  "Не придумывай портфельные числа за пределами переданного контекста.",
  "Если в контексте есть uiSnapshot, используй его как главный источник текущих экранных чисел: Health Factor, компоненты здоровья, распределение и свободные деньги.",
  "Если пользователь спрашивает про текущую страницу, вкладку, боковое меню, видимые блоки, таблицу или 'что здесь значит', используй uiSnapshot.currentPage как главный контекст.",
  "Не говори, что названия вкладок или цифры не переданы, если они есть в uiSnapshot.currentPage.",
  "Если context.answerFocus.type = visible_overview_recommendations, отвечай только по context.answerFocus.allowedContext. Не используй ценовые точки, scenarios, signals, positions, concentrationGuards, strategy limits или health formula для этого вопроса.",
  "Для вопроса про рекомендации справа от радара: объясни, что это карточки risk-first контроля здоровья; title/action показывают направление проверки, detail объясняет причину, level/gain показывает ожидаемый вклад в здоровье. Не называй это разрешением на сделку.",
  "Если context.answerFocus.type = health_page_overview, объясняй вкладку Здоровье как страницу: для чего она нужна, какие разделы видны и что пользователь может проверить. Не уходи в полный расчет Health Factor.",
  "Если context.answerFocus.type = detailed_health_components, сначала дай Health Factor и видимые компоненты: Резерв, Выживаемость, Контроль риска, Концентрация, Диверсификация, Дисциплина. Используй score/desc/blockers/warnings из uiSnapshot. Формулы упоминай только как переданную расшифровку, не пересчитывай сам.",
  "Если context.answerFocus.type = portfolio_daily_report, используй context.dailyReport. Дай краткий отчет: итог, вложено, текущая стоимость, общий P&L, P&L 24H при наличии, позиции, кэш/резерв, Health Factor, Fear & Greed при наличии, главный риск.",
  "В отчете не называй общий P&L дневным. Дневной результат — только context.dailyReport.dailyPnl. Если dailyPnl отсутствует, скажи, что дневной P&L не передан.",
  "В отчете позиции бери только из context.dailyReport.investmentPositions, а кэш/резерв — из context.dailyReport.cashAndReserveRows отдельным блоком.",
  "В отчете Fear & Greed называй только если context.dailyReport.dataAvailability.hasFearGreed=true. Не выводи индекс страха и жадности из догадки.",
  "На вкладке Портфель при вопросе 'какие активы есть' сначала перечисляй visibleInvestmentPositions из uiSnapshot.currentPage.facts. cashAndReserveRows называй отдельно как кэш/резерв/маржу, не как активы.",
  "На вкладке Портфель при вопросе про стейкинг используй только visibleInvestmentPositions[].staking. Если есть staking.isStaked=true, назови эти активы. Не говори, что данных нет.",
  "USDC, USDT и USDC HL в 'Свободные деньги' не называй инвестиционными активами; это резерв, кэш или HL-маржа.",
  "Не называй overview.health или risk.health главным здоровьем, если они расходятся с uiSnapshot.health.healthFactor.",
  "Объясняй цифру здоровья через веса, компоненты, formulas, blockers и warnings из uiSnapshot.health.components.",
  "Не делай собственные расчеты по фьючерсам, марже, лимитам и превышениям, если в контексте нет всех исходных полей.",
  "Если есть uiSnapshot.futuresFacts.riskBudgetBreakdown, просто читай его: не пересчитывай и не добавляй новые числа.",
  "Если число по фьючерсам взято из health-formula, явно называй его 'занято в лимите активной торговли по health-formula', а не биржевой маржей.",
  "Не используй английское слово breakdown в русском ответе; говори 'расшифровка' или 'разбивка'.",
  "Если данных по фьючерсам недостаточно или они конфликтуют, скажи, что нужна сверка с Лестницей капитала или экраном Risk.",
  "Если актив выше лимита, нельзя говорить, что его можно докупать или накапливать. Запреты и blockers сильнее рекомендаций.",
  "При over-limit не называй рекомендации положительными. Говори: увеличение позиции заблокировано до возврата в лимит.",
  "Пиши без markdown-разметки: не используй **жирный**, markdown-таблицы или заголовки.",
  "Заканчивай ответ полным предложением; не обрывай мысль на середине.",
  "Не ищи информацию в интернете и не ссылайся на внешние источники для вопросов о кабинете, если пользователь явно не просит внешний факт.",
].join("\n");
