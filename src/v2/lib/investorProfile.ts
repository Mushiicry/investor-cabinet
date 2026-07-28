import type { InvestorStrategyId } from "./investorStrategy";

export type InvestorProfileKind =
  | "protective"
  | "long_term_accumulator"
  | "balanced"
  | "aggressive_growth"
  | "active_trader";

export type DrawdownTolerance = "низкая" | "средне-низкая" | "средняя" | "высокая";
export type VolatilityTolerance = "низкая" | "средняя" | "высокая";
export type LiquidityNeed = "низкая" | "средняя" | "высокая";
export type ProfileDiscipline = "только по плану" | "по плану с ручной проверкой" | "активное управление";

export type InvestorProfile = {
  id: string;
  accountId: InvestorStrategyId;
  baseKind: InvestorProfileKind;
  title: string;
  horizon: string;
  drawdownTolerance: DrawdownTolerance;
  volatilityTolerance: VolatilityTolerance;
  liquidityNeed: LiquidityNeed;
  reserveImportance: "средняя" | "высокая";
  discipline: ProfileDiscipline;
  activeTradingFit: boolean;
  futuresFit: boolean;
  speculativeAssetsFit: boolean;
  questionnaireVersion: number;
  questionnaireDraft: {
    plannedQuestions: number;
    dimensions: string[];
  };
  keyRestrictions: string[];
};

export type ProfileTradeVerdict = {
  ok: boolean;
  severity: "warn" | "block";
  label: string;
  note: string;
};

export const BASE_INVESTOR_PROFILES: Record<InvestorProfileKind, Omit<InvestorProfile, "id" | "accountId">> = {
  protective: {
    baseKind: "protective",
    title: "Защитный инвестор",
    horizon: "длинный",
    drawdownTolerance: "низкая",
    volatilityTolerance: "низкая",
    liquidityNeed: "высокая",
    reserveImportance: "высокая",
    discipline: "только по плану",
    activeTradingFit: false,
    futuresFit: false,
    speculativeAssetsFit: false,
    questionnaireVersion: 1,
    questionnaireDraft: {
      plannedQuestions: 18,
      dimensions: ["горизонт", "просадка", "волатильность", "ликвидность", "дисциплина", "опыт"],
    },
    keyRestrictions: ["Фьючерсы не подходят", "Спекулятивные активы не подходят", "Покупки только по плану"],
  },
  long_term_accumulator: {
    baseKind: "long_term_accumulator",
    title: "Долгосрочный накопитель",
    horizon: "длинный",
    drawdownTolerance: "средне-низкая",
    volatilityTolerance: "средняя",
    liquidityNeed: "средняя",
    reserveImportance: "высокая",
    discipline: "только по плану",
    activeTradingFit: false,
    futuresFit: false,
    speculativeAssetsFit: false,
    questionnaireVersion: 1,
    questionnaireDraft: {
      plannedQuestions: 18,
      dimensions: ["горизонт", "регулярность", "резерв", "просадка", "волатильность"],
    },
    keyRestrictions: ["Покупки регулярные, не импульсные", "Спекуляции не являются базовым режимом"],
  },
  balanced: {
    baseKind: "balanced",
    title: "Сбалансированный инвестор",
    horizon: "средний/длинный",
    drawdownTolerance: "средняя",
    volatilityTolerance: "средняя",
    liquidityNeed: "средняя",
    reserveImportance: "средняя",
    discipline: "по плану с ручной проверкой",
    activeTradingFit: true,
    futuresFit: true,
    speculativeAssetsFit: true,
    questionnaireVersion: 1,
    questionnaireDraft: {
      plannedQuestions: 18,
      dimensions: ["риск", "доходность", "ликвидность", "опыт", "дисциплина"],
    },
    keyRestrictions: ["Активный риск только через лимиты стратегии", "Спекуляции ограничены risk-gate"],
  },
  aggressive_growth: {
    baseKind: "aggressive_growth",
    title: "Агрессивный рост",
    horizon: "средний/длинный",
    drawdownTolerance: "высокая",
    volatilityTolerance: "высокая",
    liquidityNeed: "средняя",
    reserveImportance: "средняя",
    discipline: "по плану с ручной проверкой",
    activeTradingFit: true,
    futuresFit: true,
    speculativeAssetsFit: true,
    questionnaireVersion: 1,
    questionnaireDraft: {
      plannedQuestions: 18,
      dimensions: ["просадка", "волатильность", "концентрация", "опыт", "контроль плеча"],
    },
    keyRestrictions: ["Рост важен только после проверки риска", "Плечо не заменяет стратегию"],
  },
  active_trader: {
    baseKind: "active_trader",
    title: "Активный трейдер",
    horizon: "короткий/средний",
    drawdownTolerance: "высокая",
    volatilityTolerance: "высокая",
    liquidityNeed: "высокая",
    reserveImportance: "высокая",
    discipline: "активное управление",
    activeTradingFit: true,
    futuresFit: true,
    speculativeAssetsFit: true,
    questionnaireVersion: 1,
    questionnaireDraft: {
      plannedQuestions: 18,
      dimensions: ["опыт", "плечо", "стопы", "журнал", "просадка", "режим рынка"],
    },
    keyRestrictions: ["Каждая сделка проходит риск-шлюз", "Дисциплина важнее PnL"],
  },
};

export const MAIN_INVESTOR_PROFILE: InvestorProfile = {
  ...BASE_INVESTOR_PROFILES.balanced,
  id: "main-balanced-investor",
  accountId: "main",
  title: "Сбалансированный инвестор",
};

export const WIFE_INVESTOR_PROFILE: InvestorProfile = {
  ...BASE_INVESTOR_PROFILES.protective,
  id: "wife-protective-long-term-accumulator",
  accountId: "wife",
  title: "Защитный долгосрочный накопитель",
  drawdownTolerance: "средне-низкая",
  volatilityTolerance: "низкая",
  keyRestrictions: [
    "Фьючерсы не подходят",
    "Спекулятивные активы не подходят",
    "Высокая важность резерва",
    "Покупки только по плану",
    "ETH-heavy накопление допустимо только в рамках стратегии",
  ],
};

export const INVESTOR_PROFILES = {
  main: MAIN_INVESTOR_PROFILE,
  wife: WIFE_INVESTOR_PROFILE,
} satisfies Record<InvestorStrategyId, InvestorProfile>;

export function profileForSlot(slot?: string | null): InvestorProfile {
  return slot === "wife" ? WIFE_INVESTOR_PROFILE : MAIN_INVESTOR_PROFILE;
}

const CORE_ACCUMULATION_ASSETS = new Set(["BTC", "WBTC", "BITCOIN", "ETH", "WETH", "ETHEREUM", "TON", "GRAM", "SOL", "GOLD", "XAU", "XAUUSD"]);

export function normalizeProfileAssetKey(asset: string): string {
  const raw = asset.trim().toUpperCase();
  const firstToken = raw.split(/\s+/)[0] ?? raw;
  return firstToken.replace(/USDT$/, "").replace(/USD$/, "");
}

export function isSpeculativeAssetForProfile(asset: string, category: string): boolean {
  const key = normalizeProfileAssetKey(asset);
  if (category === "Фьючерсы") return true;
  if (category === "Крипта") return !CORE_ACCUMULATION_ASSETS.has(key);
  return false;
}

export function evaluateInvestorProfileTrade(input: {
  asset: string;
  category: string;
  amountUsd: number;
  totalPortfolioValue: number;
  stableReserve: number;
  reserveTargetShare: number;
  profile?: InvestorProfile;
}): ProfileTradeVerdict[] {
  const profile = input.profile ?? MAIN_INVESTOR_PROFILE;
  const verdicts: ProfileTradeVerdict[] = [];
  const isRiskBuy = input.category !== "Свободные деньги";

  if (input.category === "Фьючерсы" && !profile.futuresFit) {
    verdicts.push({
      ok: false,
      severity: "block",
      label: "Портрет инвестора",
      note: "Портрет инвестора: фьючерсы этому человеку не подходят.",
    });
  }

  if (!profile.speculativeAssetsFit && isSpeculativeAssetForProfile(input.asset, input.category)) {
    verdicts.push({
      ok: false,
      severity: "block",
      label: "Портрет инвестора",
      note: `Портрет инвестора: ${normalizeProfileAssetKey(input.asset)} считается спекулятивным активом и не подходит.`,
    });
  }

  if (isRiskBuy && profile.reserveImportance === "высокая" && input.totalPortfolioValue > 0) {
    const reserveAfterShare = Math.max(0, input.stableReserve - input.amountUsd) / input.totalPortfolioValue;
    const belowTarget = reserveAfterShare < input.reserveTargetShare;
    if (belowTarget) {
      verdicts.push({
        ok: false,
        severity: profile.baseKind === "protective" ? "block" : "warn",
        label: "Портрет инвестора",
        note: `Портрет инвестора: резерв после покупки ниже нормы ${Math.round(input.reserveTargetShare * 100)}%.`,
      });
    }
  }

  if (isRiskBuy && profile.discipline === "только по плану") {
    verdicts.push({
      ok: false,
      severity: "warn",
      label: "Портрет инвестора",
      note: "Портрет инвестора: покупка допустима только как плановое действие, не импульсный добор.",
    });
  }

  return verdicts;
}
