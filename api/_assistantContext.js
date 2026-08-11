import { selectAssistantKnowledge } from "./_assistantKnowledge.js";
import { readInvestorPayloadForAssistant } from "./_investorProxy.js";

const MAX_CONTEXT_POSITIONS = 12;
const MAX_TEXT_FIELD_LENGTH = 280;

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
      status: position.status ?? "",
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
        status: compactText(position.status),
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

function compactText(value) {
  const text = String(value ?? "").trim();
  return text.length > MAX_TEXT_FIELD_LENGTH ? `${text.slice(0, MAX_TEXT_FIELD_LENGTH)}...` : text;
}

function cleanRecord(record) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
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
    portfolio: {
      totalPortfolioValue: round(portfolio.totalPortfolioValue, 2),
      totalInvested: round(portfolio.totalInvested, 2),
      pnlUsd: round(portfolio.pnlUsd, 2),
      pnlPct: round(portfolio.pnlPct, 6),
      stableReserve: round(portfolio.stableReserve, 2),
      reserveShare: round(portfolio.reserveShare, 4),
      positionsCount: round(portfolio.positionsCount, 0),
      healthFactor: round(portfolio.healthFactor, 0),
      healthStatus: compactText(portfolio.healthStatus),
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
      caution: "Do not invent futures margin math. Use only these fields; if a field is absent, say the exact breakdown must be checked in the Capital Ladder/Risk screen.",
      futuresShare: roundOptional(healthInput.futuresShare, 4),
      futuresDeployableUsd: roundOptional(healthInput.futuresDeployableUsd ?? portfolio.futuresDeployable, 2),
      futuresCapUsd: roundOptional(riskControl?.meta?.futuresCapUsd, 2),
      futuresUsedUsd: roundOptional(riskControl?.meta?.futuresUsedUsd, 2),
      futuresRemainingUsd: roundOptional(riskControl?.meta?.futuresRemainingUsd, 2),
      futuresBreachUsd: roundOptional(riskControl?.meta?.futuresBreachUsd, 2),
      futuresCapUtilization: roundOptional(riskControl?.meta?.futuresCapUtilization, 4),
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

  return {
    ok: true,
    accountId: normalizedAccountId,
    context: {
      readOnly: true,
      accountId: normalizedAccountId,
      source: normalizedAccountId === "wife" ? "/api/investor-wife" : "/api/investor",
      overview: compactOverview(payload),
      positions: compactPositions(payload),
      risk: compactRisk(payload),
      uiSnapshot: compactClientContext(clientContext),
      sourcePriority: [
        "1. uiSnapshot.health.healthFactor / uiSnapshot.portfolio.healthFactor — главное число здоровья, если передано.",
        "2. uiSnapshot allocation/portfolio — главные видимые цифры overview, если переданы.",
        "3. /api/investor overview/risk/portfolio — source of truth для raw фактов портфеля.",
        "4. overview.health и risk.health могут быть legacy и не должны перебивать uiSnapshot Health Factor.",
        "5. По фьючерсам не смешивать health-formula, свободную маржу и биржевую маржу. Называть только явно переданные поля, иначе просить сверку в Лестнице капитала/Risk.",
      ],
      answerGuards: [
        "Если актив выше лимита или компонент concentration содержит blocker/overLimitAssets, нельзя говорить, что актив можно докупать или накапливать.",
        "При over-limit нельзя писать 'рекомендация положительная', 'есть накопление', 'можно купить' или 'можно добрать'. Разрешенная формулировка: увеличение заблокировано до возврата в лимит.",
        "Запреты, blockers и фраза 'Не докупать' всегда сильнее recommendations/scenarios/желания пользователя.",
        "Если recommendation выглядит положительной, но тот же актив выше лимита, объясни конфликт и держи risk-first запрет на увеличение позиции.",
        "Не используй status CLOSED/EXITED как доказательство нулевой позиции, если currentValue/share по активу больше нуля.",
      ],
      concentrationGuards,
      knowledgePack: selectAssistantKnowledge(question),
      recommendations: compactRecommendations(payload, concentrationGuards),
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
  "Если данных недостаточно, прямо скажи, каких read-only данных не хватает.",
  "Не придумывай портфельные числа за пределами переданного контекста.",
  "Если в контексте есть uiSnapshot, используй его как главный источник текущих экранных чисел: Health Factor, компоненты здоровья, распределение и свободные деньги.",
  "Не называй overview.health или risk.health главным здоровьем, если они расходятся с uiSnapshot.health.healthFactor.",
  "Объясняй цифру здоровья через веса, компоненты, formulas, blockers и warnings из uiSnapshot.health.components.",
  "Не делай собственные расчеты по фьючерсам, марже, лимитам и превышениям, если в контексте нет всех исходных полей.",
  "Если число по фьючерсам взято из health-formula, явно называй его расчетом health-formula, а не биржевым фактом.",
  "Если данных по фьючерсам недостаточно или они конфликтуют, скажи, что нужна сверка с Лестницей капитала или экраном Risk.",
  "Если актив выше лимита, нельзя говорить, что его можно докупать или накапливать. Запреты и blockers сильнее рекомендаций.",
  "При over-limit не называй рекомендации положительными. Говори: увеличение позиции заблокировано до возврата в лимит.",
  "Пиши без markdown-разметки: не используй **жирный**, markdown-таблицы или заголовки.",
  "Заканчивай ответ полным предложением; не обрывай мысль на середине.",
].join("\n");
