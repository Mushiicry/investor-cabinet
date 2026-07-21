import {
  MAX_CRYPTO_EXPOSURE_SHARE,
  MAX_FUTURES_EXPOSURE_SHARE,
  RESERVE_BAND_MAX_SHARE,
  RESERVE_FLOOR_SHARE,
  RESERVE_TARGET_SHARE,
} from "../config/riskRules";

// Прозрачный расчёт Health Factor из реальных долей портфеля.
// 6 компонентов (объединение текущей и прежней методики), каждый 0..100
// относительно лимита политики. Принцип «Risk First».

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const score = (value: number) => Math.round(clamp01(value) * 100);

// Пороги мягкой деградации
const COMFORT_CASH = 0.5; // «Гибкость»: комфортная зона кэша
const CRYPTO_HARD = 0.9; // «Волатильность»: 100 при ≤60%, 0 при ≥90%
const CONCENTRATION_SAFE = 0.2; // «Концентрация» (legacy, largestShare): 100 при ≤20%
const CONCENTRATION_HARD = 0.5; // 0 при ≥50% (лимит на позицию 35%)
// Per-asset балл считается снаружи (assetConcentration): системный риск по доле
// портфеля минус ограниченный штраф за активы сверх своих лимитов — сюда приходит
// готовым в input.concentrationScore, чтобы health не дублировал модель.

// Лимиты плеча по фьючерсам (правило инвестора):
// мажоры (BTC / золото) — до 3x, всё остальное (альты) — до 2x.
export const FUTURES_LEVERAGE_LIMIT_MAJOR = 3;
export const FUTURES_LEVERAGE_LIMIT_ALT = 2;

// Максимум одновременных фьючерс-позиций — превышение сильно режет балл.
export const MAX_FUTURES_POSITIONS = 3;

export function isMajorFuturesAsset(asset: string): boolean {
  const a = (asset || "").toUpperCase();
  return a.includes("BTC") || a.includes("GOLD") || a.includes("XAU");
}

export function futuresLeverageLimit(asset: string): number {
  return isMajorFuturesAsset(asset) ? FUTURES_LEVERAGE_LIMIT_MAJOR : FUTURES_LEVERAGE_LIMIT_ALT;
}

// Близость к ликвидации: d = |цена − цена_ликвидации| / цена.
// d ≥ 40% — безопасно (0 штрафа); d ≤ 5% — критично (полный штраф 30).
const LIQ_SAFE_DISTANCE = 0.40;
const LIQ_CRITICAL_DISTANCE = 0.05;
const LIQ_MAX_PENALTY = 30;

/** Штраф за близость к ликвидации по одной позиции (0..LIQ_MAX_PENALTY). */
export function liquidationPenalty(distance: number | null): number {
  if (distance === null || !isFinite(distance) || distance >= LIQ_SAFE_DISTANCE) return 0;
  if (distance <= LIQ_CRITICAL_DISTANCE) return LIQ_MAX_PENALTY;
  const t = (LIQ_SAFE_DISTANCE - distance) / (LIQ_SAFE_DISTANCE - LIQ_CRITICAL_DISTANCE);
  return Math.round(t * LIQ_MAX_PENALTY);
}

export type FuturesLeg = {
  asset: string;
  leverage: number | null; // эффективное плечо, выведенное из данных (null = не определить)
  /** Расстояние до ликвидации 0..1 (|цена−ликв|/цена). null — данных нет. */
  liqDistance?: number | null;
  liquidationPx?: number | null;
  markPx?: number | null;
};

export type HealthComponentKey =
  | "reserve"
  | "crypto"
  | "futures"
  | "concentration"
  | "diversification"
  | "flexibility";

export type HealthComponentMeta = {
  reserveUsd?: number;
  reserveTargetUsd?: number;
  /** Диверсификация: крупнейший класс и конкретика для ребаланса */
  largestClassName?: string;
  largestClassShareOfRisk?: number; // доля крупнейшего класса в РИСКОВОМ капитале (0..1)
  largestClassShareOfPortfolio?: number; // тот же класс, но от ВСЕГО портфеля (0..1) — как в «Распределении»
  rebalanceAddShare?: number; // сколько добавить в другие классы, доля портфеля (0..1), чтобы крупнейший стал ≤80%
  rebalanceAddUsd?: number; // то же в $
  otherClassNames?: string[]; // куда добавлять
  missingClassNames?: string[]; // классы с нулевой долей
  worstLeverage?: number;
  worstLeverageAsset?: string;
  worstLeverageLimit?: number;
  leverageBreaches?: { asset: string; leverage: number; limit: number }[];
  weightScore?: number;
  leverageScore?: number;
  countScore?: number;
  futuresCount?: number;
  futuresShare?: number;
  /** Фьючерсы: финансирование спекулятивного счёта до лимита 10% */
  isFutureBudgetFunded?: boolean; // цель достигнута — ачивка
  futuresTargetUsd?: number; // 10% капитала
  futuresUsedUsd?: number; // маржа позиций + свободная маржа HL
  futuresTopUpUsd?: number; // сколько доложить до 10%
  /** Фьючерсы: близость к ликвидации худшей позиции */
  liquidationScore?: number;
  worstLiqDistance?: number; // 0..1, доля до цены ликвидации
  worstLiqAsset?: string;
  /** Концентрация (per-asset): худший актив и его перегруз */
  worstConcentrationAsset?: string;
  worstConcentrationShare?: number; // доля актива в его базе (крипто-блок/портфель)
  worstConcentrationPortfolioShare?: number; // доля актива в портфеле
  worstConcentrationLimit?: number; // его per-asset лимит
  maxAssetLimitUtilization?: number; // доля/лимит (1.0 = ровно на лимите)
  overLimitAssets?: string[]; // все активы сверх своих лимитов
};

export type HealthComponent = {
  key: HealthComponentKey;
  label: string;
  score: number;
  color: string;
  desc: string;
  weight: number;
  meta?: HealthComponentMeta;
};

// Спотовые рисковые классы, по которым меряется диверсификация.
// Кэш/стейблы и фьючерсы сюда НЕ входят — см. computeDiversificationScore.
export const DIVERSIFIABLE_CLASSES = ["Крипта", "Металлы", "Акции"] as const;

/**
 * Диверсификация: насколько ровно разложен РИСКОВЫЙ капитал по спотовым классам.
 *
 * Кэш/стейблы исключены: подушка — это не «концентрация». Прежняя формула считала
 * HHI по всем классам вместе с кэшем и потому наказывала за резерв — компоненты
 * «Гибкость» (хочет много кэша) и «Диверсификация» воевали друг с другом.
 *
 * Фьючерсы исключены: это плечевой оверлей, он оценивается отдельным компонентом.
 * Включать их значило бы требовать ~25% во фьючерсах ради 100 баллов — прямой
 * конфликт с компонентом «Фьючерсы», который за это же штрафует.
 *
 * Нормализация: 100 = капитал ровно разложен по всем спотовым классам (HHI = 1/n),
 * 0 = всё в одном классе (HHI = 1). Без нормализации потолок был 80 — сотня была
 * недостижима by design, а вместе с ней и Health = 100.
 */
/**
 * Резерв — это КОРИДОР, а не «чем больше, тем лучше».
 *
 * < 10%  — ниже пола политики (RESERVE_FLOOR_SHARE): резкий линейный рост 0→30.
 *          Пол — минимум, ниже которого резерв не опускаем даже при полном
 *          развороте в рынок.
 * 10–30% — рабочая зона «полной картины рынка» (всё куплено по лимитам классов:
 *          крипта 60 + акции 10 + металлы 10 + фьючерсы 10 + резерв 10):
 *          линейный рост 30→100.
 * 30–60% — дисциплинированная зона: 100 баллов.
 * > 60%  — капитал простаивает: инвестор перестал инвестировать. Балл линейно
 *          падает до 0 при 100% в кэше.
 *
 * Без верхней границы модель выдавала 100/100 за портфель «94% кэша + по 2% в трёх
 * классах» — вырожденный оптимум, при котором «идеальное здоровье» = не инвестировать.
 * Резерв даёт опциональность, но сверх коридора это уже не подушка, а простой.
 */
const RESERVE_FLOOR_SCORE = 30; // балл ровно на полу 10% — допустимо, но на пределе

export function computeReserveScore(reserveShare: number): number {
  if (reserveShare <= 0) return 0;
  if (reserveShare < RESERVE_FLOOR_SHARE) {
    return Math.round((reserveShare / RESERVE_FLOOR_SHARE) * RESERVE_FLOOR_SCORE);
  }
  if (reserveShare < RESERVE_TARGET_SHARE) {
    const progress =
      (reserveShare - RESERVE_FLOOR_SHARE) / (RESERVE_TARGET_SHARE - RESERVE_FLOOR_SHARE);
    return Math.round(RESERVE_FLOOR_SCORE + progress * (100 - RESERVE_FLOOR_SCORE));
  }
  if (reserveShare <= RESERVE_BAND_MAX_SHARE) return 100;
  return score((1 - reserveShare) / (1 - RESERVE_BAND_MAX_SHARE));
}

// Эталон диверсификации — не равные доли, а структура из манифеста.
// При резерве 30% и фьючерсах 10% на рисковый спот остаётся 60%: крипта 40,
// металлы 10, акции 10. Внутри рисковой части это 0.667 / 0.167 / 0.167,
// то есть HHI = 0.5. Раньше шкала требовала равенства (HHI = 1/n), и такой
// «идеальный по политике» портфель получал 75 из 100 — метрика не могла
// показать 100 ни при каком допустимом раскладе и горела вечно.
const DIVERSIFICATION_TARGET_HHI = 0.5;

export function computeDiversificationScore(riskShares: number[]): number {
  const n = riskShares.length;
  const total = riskShares.reduce((sum, value) => sum + value, 0);
  if (n < 2 || total <= 0) return 0;

  const hhi = riskShares.reduce((sum, value) => {
    const weight = value / total;
    return sum + weight * weight;
  }, 0);

  // Идеал не может быть строже равномерного распределения: при двух классах
  // 1/n = 0.5 совпадает с целью, при большем числе классов цель мягче.
  const targetHhi = Math.max(DIVERSIFICATION_TARGET_HHI, 1 / n);

  return score((1 - hhi) / (1 - targetHhi));
}

export type HealthInput = {
  cashShare: number; // 0..1
  cryptoShare: number;
  futuresShare: number;
  largestShare: number;
  riskCategoryShares: number[]; // доли спотовых рисковых классов (DIVERSIFIABLE_CLASSES)
  reserveShare?: number; // выделенный резерв (стейблы) / портфель — Risk First
  futuresLegs?: FuturesLeg[]; // фьючерс-позиции с выведенным плечом
  portfolioValue?: number; // для перевода долей в $ в подсказках
  /** Вложенный капитал — база спекулятивного лимита 10% (как в futuresShare). */
  investedCapital?: number;
  // Концентрация по per-asset лимитам (единый источник со шлюзом). Если задано —
  // метрика считается по худшему активу (доля/лимит), а не по плоским 35%.
  concentrationScore?: number; // готовый балл 0..100 из assetConcentration
  maxAssetLimitUtilization?: number; // худший util = доля/лимит (1.0 = ровно на лимите)
  worstConcentrationAsset?: string;
  worstConcentrationShare?: number; // доля актива в его базе (крипто-блок/портфель)
  worstConcentrationPortfolioShare?: number; // доля актива в портфеле
  worstConcentrationLimit?: number; // его per-asset лимит
  overLimitAssets?: string[]; // все активы сверх своих лимитов
};

export type PortfolioHealth = {
  healthFactor: number; // 0..100
  status: "CONTROL" | "BALANCED" | "RISK";
  riskLevel: string;
  components: HealthComponent[];
};

export function computePortfolioHealth(input: HealthInput): PortfolioHealth {
  // ── Резерв (Risk First): коридор 30–60%, см. computeReserveScore ──
  const reserveShare = input.reserveShare ?? input.cashShare;
  const reserveScore = computeReserveScore(reserveShare);
  const reserveUsd = input.portfolioValue ? reserveShare * input.portfolioValue : undefined;
  const reserveTargetUsd = input.portfolioValue
    ? RESERVE_TARGET_SHARE * input.portfolioValue
    : undefined;

  // ── Фьючерсы: 100 при выполненном плане, далее прозрачные штрафы ──
  // Спекулятивный бюджет = ровно 10% капитала (манифест). Цель — держать счёт
  // профинансированным на эту сумму: маржа открытых позиций + свободная маржа HL.
  //   • недофинансирован → план не выполнен, снимаем баллы, пока не пополнишь;
  //   • превышен лимит  → пробит риск-лимит, штраф жёстче.
  // Ровно 10% = 0 штрафа (цель достигнута).
  const fundingRatio = input.futuresShare / MAX_FUTURES_EXPOSURE_SHARE; // 1.0 = ровно 10%
  const underfunded = Math.max(0, 1 - fundingRatio);
  const overfunded = Math.max(0, fundingRatio - 1);
  const marginPenalty = underfunded * 25 + overfunded * 50;
  const isFutureBudgetFunded = fundingRatio >= 0.98 && overfunded === 0;
  const futuresTargetUsd = input.portfolioValue
    ? MAX_FUTURES_EXPOSURE_SHARE * (input.investedCapital ?? input.portfolioValue)
    : undefined;
  const futuresUsedUsd = input.investedCapital
    ? input.futuresShare * input.investedCapital
    : undefined;
  const futuresTopUpUsd =
    futuresTargetUsd !== undefined && futuresUsedUsd !== undefined
      ? Math.max(0, futuresTargetUsd - futuresUsedUsd)
      : undefined;
  const weightScore = Math.max(0, Math.round(100 - marginPenalty));
  const legs = input.futuresLegs ?? [];
  const breaches: { asset: string; leverage: number; limit: number }[] = [];
  let leveragePenalty = 0;
  let worstLeverage: number | undefined;
  let worstLeverageAsset: string | undefined;
  let worstLeverageLimit: number | undefined;
  for (const leg of legs) {
    if (leg.leverage == null || !isFinite(leg.leverage)) continue;
    const limit = futuresLeverageLimit(leg.asset);
    const leverageUsage = Math.max(0, leg.leverage) / limit;
    leveragePenalty +=
      Math.min(leverageUsage, 1) * 4 + Math.max(0, leverageUsage - 1) * 25;
    if (worstLeverage === undefined || leg.leverage > worstLeverage) {
      worstLeverage = leg.leverage;
      worstLeverageAsset = leg.asset;
      worstLeverageLimit = limit;
    }
    if (leg.leverage > limit) {
      breaches.push({ asset: leg.asset, leverage: leg.leverage, limit });
    }
  }
  const leverageScore = Math.max(0, Math.round(100 - leveragePenalty));
  // Каждая позиция несёт базовый риск; сверх лимита 3 включается усиленный штраф.
  const futuresCount = legs.length;
  const positionPenalty =
    futuresCount * 5 + Math.max(0, futuresCount - MAX_FUTURES_POSITIONS) * 20;
  const countScore = Math.max(0, 100 - positionPenalty);

  // ── Близость к ликвидации: ведёт ХУДШАЯ позиция (она и убьёт счёт первой). ──
  let liqPenalty = 0;
  let worstLiqDistance: number | undefined;
  let worstLiqAsset: string | undefined;
  for (const leg of legs) {
    const d = leg.liqDistance ?? null;
    if (d === null || !isFinite(d)) continue;
    if (worstLiqDistance === undefined || d < worstLiqDistance) {
      worstLiqDistance = d;
      worstLiqAsset = leg.asset;
    }
  }
  liqPenalty = liquidationPenalty(worstLiqDistance ?? null);
  const liquidationScore = Math.max(0, 100 - liqPenalty);

  const futuresScore = Math.max(
    0,
    Math.round(100 - marginPenalty - leveragePenalty - positionPenalty - liqPenalty)
  );

  // ── Диверсификация: конкретика для рекомендаций (не «не держать более 80%»
  // абстрактно, а сколько $ и куда добавить). Всё меряется по РИСКОВОМУ
  // капиталу (крипта/металлы/акции, без кэша и фьючерсов) — доля класса
  // от всего портфеля здесь намеренно не используется, она вводит в заблуждение.
  const riskShares = input.riskCategoryShares;
  const riskTotal = riskShares.reduce((sum, value) => sum + value, 0);
  let diversificationMeta: HealthComponentMeta | undefined;
  if (riskTotal > 0 && riskShares.length === DIVERSIFIABLE_CLASSES.length) {
    const maxIdx = riskShares.indexOf(Math.max(...riskShares));
    const largestOfRisk = riskShares[maxIdx] / riskTotal;
    // Чтобы крупнейший класс стал ≤80% рискового капитала, в ДРУГИЕ классы
    // нужно добавить X (доля портфеля): largest / (total + X) = 0.8
    const rebalanceAddShare = Math.max(0, riskShares[maxIdx] / 0.8 - riskTotal);
    diversificationMeta = {
      largestClassName: DIVERSIFIABLE_CLASSES[maxIdx],
      largestClassShareOfRisk: largestOfRisk,
      largestClassShareOfPortfolio: riskShares[maxIdx],
      rebalanceAddShare,
      rebalanceAddUsd: input.portfolioValue
        ? rebalanceAddShare * input.portfolioValue
        : undefined,
      otherClassNames: DIVERSIFIABLE_CLASSES.filter((_, i) => i !== maxIdx),
      missingClassNames: DIVERSIFIABLE_CLASSES.filter((_, i) => riskShares[i] <= 0.001),
    };
  }

  // ── Концентрация: готовый per-asset балл (assetConcentration), иначе legacy. ──
  const usePerAssetConcentration = input.concentrationScore !== undefined;
  const concentrationScore = usePerAssetConcentration
    ? input.concentrationScore!
    : score((CONCENTRATION_HARD - input.largestShare) / (CONCENTRATION_HARD - CONCENTRATION_SAFE));
  const concentrationDesc = usePerAssetConcentration
    ? "У каждого актива свой лимит: ETH 35% / BTC 20% / SOL·TON·BNB 10% / альты 5% ВНУТРИ крипто-блока; прочие классы — 35% портфеля. Балл = системный риск (крупнейшая позиция от портфеля) минус ограниченный штраф за активы сверх лимита — один перевес не обнуляет метрику."
    : "Нет перегруза одним активом (≤35%).";

  const components: HealthComponent[] = [
    {
      key: "reserve",
      label: "Резерв",
      color: "#56d8f5",
      desc: "Выделенный резерв (стейблы). Коридор 30–60% = 100 баллов; выше — штраф за простаивающий капитал.",
      weight: 0.2,
      score: reserveScore,
      meta: { reserveUsd, reserveTargetUsd },
    },
    {
      key: "crypto",
      label: "Сопротивление волатильности",
      color: "#ad67ff",
      desc: "Экспозиция в волатильных активах против лимита 60%.",
      weight: 0.17,
      score: score((CRYPTO_HARD - input.cryptoShare) / (CRYPTO_HARD - MAX_CRYPTO_EXPOSURE_SHARE)),
    },
    {
      key: "futures",
      label: "Фьючерсы",
      color: "#e8b35a",
      desc: "Спекулятивный бюджет — ровно 10% капитала (маржа открытых позиций + свободная маржа HL). Недофинансирован — план не выполнен, баллы снимаются; превышен — пробит риск-лимит. Плюс плечо (≤2x альты / ≤3x BTC и золото), не более 3 позиций и близость к ликвидации: чем ближе цена к ликвидации, тем ниже оценка.",
      weight: 0.15,
      score: futuresScore,
      meta: {
        weightScore,
        leverageScore,
        countScore,
        futuresCount,
        futuresShare: input.futuresShare,
        worstLeverage,
        worstLeverageAsset,
        worstLeverageLimit,
        leverageBreaches: breaches,
        isFutureBudgetFunded,
        futuresTargetUsd,
        futuresUsedUsd,
        futuresTopUpUsd,
        liquidationScore,
        worstLiqDistance,
        worstLiqAsset,
      },
    },
    {
      key: "concentration",
      label: "Концентрация",
      color: "#ff6b8a",
      desc: concentrationDesc,
      weight: 0.18,
      score: concentrationScore,
      meta: usePerAssetConcentration
        ? {
            worstConcentrationAsset: input.worstConcentrationAsset,
            worstConcentrationShare: input.worstConcentrationShare,
            worstConcentrationPortfolioShare: input.worstConcentrationPortfolioShare,
            worstConcentrationLimit: input.worstConcentrationLimit,
            maxAssetLimitUtilization: input.maxAssetLimitUtilization,
            overLimitAssets: input.overLimitAssets,
          }
        : undefined,
    },
    {
      key: "diversification",
      label: "Диверсификация",
      color: "#5fe0cf",
      desc: "Насколько ровно разложен рисковый капитал по спотовым классам (крипта / металлы / акции). Кэш и фьючерсы не учитываются.",
      weight: 0.15,
      score: computeDiversificationScore(input.riskCategoryShares),
      meta: diversificationMeta,
    },
    {
      key: "flexibility",
      label: "Гибкость",
      color: "#5af08d",
      desc: "Запас манёвра — свободный кэш.",
      weight: 0.15,
      score: score(input.cashShare / COMFORT_CASH),
    },
  ];

  const healthFactor = Math.round(
    components.reduce((sum, component) => sum + component.score * component.weight, 0)
  );

  let status: PortfolioHealth["status"] = "RISK";
  let riskLevel = "Риск";
  if (healthFactor >= 75) {
    status = "CONTROL";
    riskLevel = "Хорошо";
  } else if (healthFactor >= 55) {
    status = "BALANCED";
    riskLevel = "Баланс";
  }

  return { healthFactor, status, riskLevel, components };
}
