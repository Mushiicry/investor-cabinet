import {
  MAX_FUTURES_EXPOSURE_SHARE,
  RESERVE_BAND_MAX_SHARE,
  RESERVE_FLOOR_SHARE,
  RESERVE_TARGET_SHARE,
} from "../config/riskRules";
import { calculateSurvival, type SurvivalStatus } from "./survivalEngine";

// Прозрачный расчёт Health Factor из реальных долей портфеля.
// 6 компонентов (объединение текущей и прежней методики), каждый 0..100
// относительно лимита политики. Принцип «Risk First».

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const score = (value: number) => Math.round(clamp01(value) * 100);

// Пороги мягкой деградации
const CONCENTRATION_SAFE = 0.2; // «Концентрация» (legacy, largestShare): 100 при ≤20%
const CONCENTRATION_HARD = 0.5; // 0 при ≥50% (лимит на позицию 35%)
// Per-asset балл считается снаружи (assetConcentration): системный риск по доле
// портфеля минус ограниченный штраф за активы сверх своих лимитов — сюда приходит
// готовым в input.concentrationScore, чтобы health не дублировал модель.

const DISCIPLINE_JOURNAL_TARGET_COVERAGE = 0.8;

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
const LIQ_BLOCK_DISTANCE = 0.10;
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
  reserveShare?: number;
  reserveFloorUsd?: number;
  reserveTargetUsd?: number;
  reserveBandMaxUsd?: number;
  reserveFloorShortfallUsd?: number;
  reserveTargetShortfallUsd?: number;
  reserveIdleUsd?: number;
  reserveBlockers?: string[];
  reserveWarnings?: string[];
  reserveFormula?: string[];
  /** Диверсификация: крупнейший класс и конкретика для ребаланса */
  largestClassName?: string;
  largestClassShareOfRisk?: number; // доля крупнейшего класса в РИСКОВОМ капитале (0..1)
  largestClassShareOfPortfolio?: number; // тот же класс, но от ВСЕГО портфеля (0..1) — как в «Распределении»
  rebalanceAddShare?: number; // сколько добавить в другие классы, доля портфеля (0..1), чтобы крупнейший стал ≤80%
  rebalanceAddUsd?: number; // то же в $
  otherClassNames?: string[]; // куда добавлять
  missingClassNames?: string[]; // классы с нулевой долей
  activeClassCount?: number;
  riskClassTotalShare?: number;
  diversificationBlockers?: string[];
  diversificationWarnings?: string[];
  diversificationFormula?: string[];
  worstLeverage?: number;
  worstLeverageAsset?: string;
  worstLeverageLimit?: number;
  leverageBreaches?: { asset: string; leverage: number; limit: number }[];
  weightScore?: number;
  leverageScore?: number;
  countScore?: number;
  futuresCount?: number;
  futuresShare?: number;
  /** Контроль риска: лимит 10% активной торговли. */
  futuresCapUsd?: number; // верхняя граница риска
  futuresUsedUsd?: number; // маржа позиций + свободная маржа торгового счёта
  futuresRemainingUsd?: number; // сколько осталось до лимита
  futuresBreachUsd?: number; // превышение лимита
  futuresCapUtilization?: number; // занято / лимит
  riskControlBlockers?: string[]; // причины, при которых новый риск запрещён
  riskControlWarnings?: string[]; // ранние предупреждения без полного запрета
  riskControlFormula?: string[]; // человекочитаемая раскладка формулы
  /** Контроль риска: близость к ликвидации худшей позиции */
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
  altcoinSlotsUsed?: number;
  altcoinSlotsTotal?: number;
  altcoinSlotsFree?: number;
  altcoins?: string[];
  stockSlotsUsed?: number;
  stockSlotsTotal?: number;
  stockSlotsFree?: number;
  stocks?: string[];
  metalSlotsUsed?: number;
  metalSlotsTotal?: number;
  metalSlotsFree?: number;
  metals?: string[];
  concentrationBlockers?: string[];
  concentrationWarnings?: string[];
  concentrationFormula?: string[];
  /** Выживаемость: стресс-сценарий сильного падения рынка. */
  survivalShockLossPct?: number;
  survivalLossUsd?: number;
  survivalPortfolioAfterShockShare?: number;
  survivalPortfolioAfterShockUsd?: number;
  survivalReserveAfterShockShare?: number;
  survivalBuyPowerAfterShockUsd?: number;
  survivalBuyPowerAfterShockShare?: number;
  survivalLossScore?: number;
  survivalBuyPowerScore?: number;
  survivalPlanScore?: number;
  survivalStatus?: SurvivalStatus;
  survivalWorstScenario?: string;
  survivalScenarios?: { name: string; lossPct: number; lossUsd?: number }[];
  plannedLimitOrdersUsd?: number;
  plannedLimitOrdersShare?: number;
  survivalBlockers?: string[];
  survivalWarnings?: string[];
  survivalFormula?: string[];
  /** Дисциплина: процесс решений, журнал и поведенческие нарушения. */
  disciplineJournalCoverage?: number;
  disciplineJournalScore?: number;
  disciplineBehaviorScore?: number;
  disciplineBlockerScore?: number;
  disciplinePlanScore?: number;
  disciplinePlannedOrdersUsd?: number;
  disciplineViolations30d?: number;
  fomoEvents30d?: number;
  revengeTrades30d?: number;
  overtradingDays30d?: number;
  disciplineCooldownActive?: boolean;
  disciplineBlockers?: string[];
  disciplineWarnings?: string[];
  disciplineFormula?: string[];
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
 * Фьючерсы исключены: это плечевой оверлей, он оценивается отдельным компонентом риска.
 * Включать их значило бы требовать ~25% во фьючерсах ради 100 баллов — прямой
 * конфликт с компонентом «Контроль риска», который за это же штрафует.
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
  altcoinSlotsUsed?: number;
  altcoinSlotsTotal?: number;
  altcoinSlotsFree?: number;
  altcoins?: string[];
  stockSlotsUsed?: number;
  stockSlotsTotal?: number;
  stockSlotsFree?: number;
  stocks?: string[];
  metalSlotsUsed?: number;
  metalSlotsTotal?: number;
  metalSlotsFree?: number;
  metals?: string[];
  /** Свободная покупательская сила спота, если уже рассчитана выше по цепочке. */
  spotDeployableUsd?: number;
  /** Свободная покупательская сила активной торговли, если уже рассчитана выше по цепочке. */
  futuresDeployableUsd?: number;
  /** Сумма заранее подготовленных лимитных ордеров. Нет поля = источник ещё не подключён. */
  plannedLimitOrdersUsd?: number;
  /** Доля решений/сделок с заполненным журналом за период 0..1. */
  disciplineJournalCoverage?: number;
  disciplineViolations30d?: number;
  fomoEvents30d?: number;
  revengeTrades30d?: number;
  overtradingDays30d?: number;
  disciplineCooldownActive?: boolean;
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
  const reserveFloorUsd = input.portfolioValue
    ? RESERVE_FLOOR_SHARE * input.portfolioValue
    : undefined;
  const reserveTargetUsd = input.portfolioValue
    ? RESERVE_TARGET_SHARE * input.portfolioValue
    : undefined;
  const reserveBandMaxUsd = input.portfolioValue
    ? RESERVE_BAND_MAX_SHARE * input.portfolioValue
    : undefined;
  const reserveFloorShortfallUsd =
    reserveFloorUsd !== undefined && reserveUsd !== undefined
      ? Math.max(0, reserveFloorUsd - reserveUsd)
      : undefined;
  const reserveTargetShortfallUsd =
    reserveTargetUsd !== undefined && reserveUsd !== undefined
      ? Math.max(0, reserveTargetUsd - reserveUsd)
      : undefined;
  const reserveIdleUsd =
    reserveBandMaxUsd !== undefined && reserveUsd !== undefined
      ? Math.max(0, reserveUsd - reserveBandMaxUsd)
      : undefined;
  const reserveBlockers: string[] = [];
  const reserveWarnings: string[] = [];
  if (reserveShare <= 0) {
    reserveBlockers.push("Резерв отсутствует");
  } else if (reserveShare < RESERVE_FLOOR_SHARE) {
    reserveBlockers.push("Резерв ниже пола 10%");
  }
  if (reserveShare >= RESERVE_FLOOR_SHARE && reserveShare < RESERVE_TARGET_SHARE) {
    reserveWarnings.push("Резерв ниже цели 30%");
  }
  if (reserveShare > RESERVE_BAND_MAX_SHARE) {
    reserveWarnings.push("Резерв выше 60% — капитал простаивает");
  }
  const reserveFormula = [
    `Текущий резерв: ${Math.round(reserveShare * 100)}%`,
    `Пол: ${Math.round(RESERVE_FLOOR_SHARE * 100)}%`,
    `Цель: ${Math.round(RESERVE_TARGET_SHARE * 100)}%`,
    `Норма: ${Math.round(RESERVE_TARGET_SHARE * 100)}–${Math.round(RESERVE_BAND_MAX_SHARE * 100)}%`,
  ];

  // ── Контроль риска: 10% — верхняя граница, а не цель пополнения ──
  // Активная торговля остаётся разрешённой частью системы, но здоровье не должно
  // стимулировать «добивать» счёт до 10%. Снижение балла начинается только при
  // превышении лимита, нарушении плеча, лишних позициях или риске ликвидации.
  const futuresCapBase = input.investedCapital ?? input.portfolioValue ?? 0;
  const futuresCapUsd = futuresCapBase > 0 ? MAX_FUTURES_EXPOSURE_SHARE * futuresCapBase : undefined;
  const futuresUsedUsd = futuresCapBase > 0 ? input.futuresShare * futuresCapBase : undefined;
  const futuresCapUtilization =
    futuresCapUsd && futuresCapUsd > 0 && futuresUsedUsd !== undefined
      ? futuresUsedUsd / futuresCapUsd
      : input.futuresShare / MAX_FUTURES_EXPOSURE_SHARE;
  const futuresRemainingUsd =
    futuresCapUsd !== undefined && futuresUsedUsd !== undefined
      ? Math.max(0, futuresCapUsd - futuresUsedUsd)
      : undefined;
  const futuresBreachUsd =
    futuresCapUsd !== undefined && futuresUsedUsd !== undefined
      ? Math.max(0, futuresUsedUsd - futuresCapUsd)
      : undefined;
  const overLimit = Math.max(0, futuresCapUtilization - 1);
  const marginPenalty = overLimit * 50;
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

  const riskControlBlockers: string[] = [];
  const riskControlWarnings: string[] = [];
  if (overLimit > 0) {
    riskControlBlockers.push("Превышен лимит 10% активной торговли");
  } else if (futuresCapUtilization >= 0.8) {
    riskControlWarnings.push("Лимит активной торговли почти выбран");
  }
  if (breaches.length) {
    riskControlBlockers.push("Превышено допустимое плечо");
  }
  if (futuresCount > MAX_FUTURES_POSITIONS) {
    riskControlBlockers.push("Открыто больше 3 активных позиций");
  }
  if (worstLiqDistance !== undefined && worstLiqDistance <= LIQ_BLOCK_DISTANCE) {
    riskControlBlockers.push("Ликвидация слишком близко");
  } else if (worstLiqDistance !== undefined && worstLiqDistance < LIQ_SAFE_DISTANCE) {
    riskControlWarnings.push("Запас до ликвидации ниже комфортного");
  }

  const futuresScore = Math.max(
    0,
    Math.round(100 - marginPenalty - leveragePenalty - positionPenalty - liqPenalty)
  );
  const riskControlFormula = [
    `Лимит активной торговли: ${weightScore}/100`,
    `Плечо: ${leverageScore}/100`,
    `Число позиций: ${countScore}/100`,
    `Запас до ликвидации: ${liquidationScore}/100`,
  ];

  // ── Диверсификация: конкретика для рекомендаций (не «не держать более 80%»
  // абстрактно, а сколько $ и куда добавить). Всё меряется по РИСКОВОМУ
  // капиталу (крипта/металлы/акции, без кэша и фьючерсов) — доля класса
  // от всего портфеля здесь намеренно не используется, она вводит в заблуждение.
  const riskShares = input.riskCategoryShares;
  const riskTotal = riskShares.reduce((sum, value) => sum + value, 0);
  const diversificationScore = computeDiversificationScore(input.riskCategoryShares);
  let diversificationMeta: HealthComponentMeta | undefined;
  if (riskTotal > 0 && riskShares.length === DIVERSIFIABLE_CLASSES.length) {
    const maxIdx = riskShares.indexOf(Math.max(...riskShares));
    const largestOfRisk = riskShares[maxIdx] / riskTotal;
    const missingClassNames = DIVERSIFIABLE_CLASSES.filter((_, i) => riskShares[i] <= 0.001);
    const activeClassCount = DIVERSIFIABLE_CLASSES.length - missingClassNames.length;
    const diversificationBlockers: string[] = [];
    const diversificationWarnings: string[] = [];
    if (activeClassCount <= 1) {
      diversificationBlockers.push("Рисковый капитал в одном спотовом классе");
    } else if (largestOfRisk > 0.8) {
      diversificationWarnings.push("Крупнейший класс выше 80% рисковой части");
    }
    if (missingClassNames.length) {
      diversificationWarnings.push(`Отсутствуют классы: ${missingClassNames.join(" / ").toLowerCase()}`);
    }
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
      missingClassNames,
      activeClassCount,
      riskClassTotalShare: riskTotal,
      diversificationBlockers,
      diversificationWarnings,
      diversificationFormula: [
        `Балл диверсификации: ${diversificationScore}/100`,
        `Крупнейший класс: ${DIVERSIFIABLE_CLASSES[maxIdx]} ${Math.round(largestOfRisk * 100)}% рисковой части`,
        `Активных классов: ${activeClassCount}/${DIVERSIFIABLE_CLASSES.length}`,
        "Учитываются только крипта, металлы и акции",
      ],
    };
  }

  // ── Концентрация: готовый per-asset балл (assetConcentration), иначе legacy. ──
  const usePerAssetConcentration = input.concentrationScore !== undefined;
  const concentrationScore = usePerAssetConcentration
    ? input.concentrationScore!
    : score((CONCENTRATION_HARD - input.largestShare) / (CONCENTRATION_HARD - CONCENTRATION_SAFE));
  const concentrationBlockers: string[] = [];
  const concentrationWarnings: string[] = [];
  const overLimitAssets = input.overLimitAssets ?? [];
  const concentrationUtil = input.maxAssetLimitUtilization ?? 0;
  const concentrationWorstAsset = input.worstConcentrationAsset;
  const concentrationWorstLimit = input.worstConcentrationLimit ?? 0;
  const concentrationWorstShare = input.worstConcentrationShare ?? 0;
  const altcoinSlotsUsed = input.altcoinSlotsUsed;
  const altcoinSlotsTotal = input.altcoinSlotsTotal;
  const altcoinSlotsFree = input.altcoinSlotsFree;
  const altcoins = input.altcoins;
  const stockSlotsUsed = input.stockSlotsUsed;
  const stockSlotsTotal = input.stockSlotsTotal;
  const stockSlotsFree = input.stockSlotsFree;
  const stocks = input.stocks;
  const metalSlotsUsed = input.metalSlotsUsed;
  const metalSlotsTotal = input.metalSlotsTotal;
  const metalSlotsFree = input.metalSlotsFree;
  const metals = input.metals;
  if (usePerAssetConcentration && overLimitAssets.length > 0) {
    concentrationBlockers.push("Актив выше своего лимита");
  } else if (usePerAssetConcentration && concentrationUtil >= 0.85) {
    concentrationWarnings.push("Актив близко к своему лимиту");
  }
  if (
    usePerAssetConcentration &&
    altcoinSlotsUsed !== undefined &&
    altcoinSlotsTotal !== undefined &&
    altcoinSlotsUsed > altcoinSlotsTotal
  ) {
    concentrationBlockers.push("Превышен лимит альткоин-мест");
  } else if (
    usePerAssetConcentration &&
    altcoinSlotsUsed !== undefined &&
    altcoinSlotsTotal !== undefined &&
    altcoinSlotsUsed === altcoinSlotsTotal
  ) {
    concentrationWarnings.push("Все 3 альткоин-места заняты");
  }
  if (
    usePerAssetConcentration &&
    stockSlotsUsed !== undefined &&
    stockSlotsTotal !== undefined &&
    stockSlotsUsed > stockSlotsTotal
  ) {
    concentrationBlockers.push("Превышен лимит мест акций");
  } else if (
    usePerAssetConcentration &&
    stockSlotsUsed !== undefined &&
    stockSlotsTotal !== undefined &&
    stockSlotsUsed === stockSlotsTotal
  ) {
    concentrationWarnings.push("Все 2 места акций заняты");
  }
  if (
    usePerAssetConcentration &&
    metalSlotsUsed !== undefined &&
    metalSlotsTotal !== undefined &&
    metalSlotsUsed > metalSlotsTotal
  ) {
    concentrationBlockers.push("Превышен лимит мест металлов");
  } else if (
    usePerAssetConcentration &&
    metalSlotsUsed !== undefined &&
    metalSlotsTotal !== undefined &&
    metalSlotsUsed === metalSlotsTotal
  ) {
    concentrationWarnings.push("Все 2 места металлов заняты");
  }
  const concentrationFormula = usePerAssetConcentration
    ? [
        `Балл концентрации: ${concentrationScore}/100`,
        concentrationWorstAsset && concentrationWorstAsset !== "-"
          ? `Худший актив: ${concentrationWorstAsset}`
          : "Худший актив: нет",
        `Доля к лимиту: ${Math.round(concentrationUtil * 100)}%`,
        `Текущая доля: ${Math.round(concentrationWorstShare * 100)}%`,
        `Лимит худшего актива: ${Math.round(concentrationWorstLimit * 100)}%`,
        altcoinSlotsUsed !== undefined && altcoinSlotsTotal !== undefined
          ? `Альткоин-места: ${altcoinSlotsUsed}/${altcoinSlotsTotal}`
          : "Альткоин-места: нет данных",
        stockSlotsUsed !== undefined && stockSlotsTotal !== undefined
          ? `Места акций: ${stockSlotsUsed}/${stockSlotsTotal}`
          : "Места акций: нет данных",
        metalSlotsUsed !== undefined && metalSlotsTotal !== undefined
          ? `Места металлов: ${metalSlotsUsed}/${metalSlotsTotal}`
          : "Места металлов: нет данных",
      ]
    : [
        `Балл концентрации: ${concentrationScore}/100`,
        `Крупнейшая позиция: ${Math.round(input.largestShare * 100)}% портфеля`,
        "Лимит legacy-модели: 35% портфеля",
      ];
  const concentrationDesc = usePerAssetConcentration
    ? "У каждого актива свой лимит: ETH 35% / BTC 20% / SOL·TON·BNB 10% / альты 5% внутри крипто-блока; акции и металлы — 5% портфеля на актив и максимум 2 актива в классе. Балл = системный риск крупнейшей позиции минус ограниченный штраф за активы сверх лимита."
    : "Нет перегруза одним активом (≤35%).";

  // ── Выживаемость: продолжит ли система работать после сильного падения. ──
  // Это не дубль резерва. Луч смотрит на худший из сценариев, покупательскую
  // способность после шока и наличие заранее подготовленного плана лимитных
  // ордеров. Если источник ордеров ещё не подключён, это честно остаётся
  // предупреждением, а не выдуманными данными.
  const survivalResult = calculateSurvival({
    cryptoShare: input.cryptoShare,
    futuresShare: input.futuresShare,
    riskCategoryShares: input.riskCategoryShares,
    reserveShare,
    portfolioValue: input.portfolioValue,
    spotDeployableUsd: input.spotDeployableUsd,
    plannedLimitOrdersUsd: input.plannedLimitOrdersUsd,
  });
  const survivalScore = survivalResult.score;

  // ── Дисциплина: соблюдается ли процесс принятия решений. ──
  // Это не оценка доходности и не оценка личности. Прибыльная сделка против
  // правил ухудшает дисциплину, убыточная сделка по правилам — нет.
  const disciplineJournalCoverage = input.disciplineJournalCoverage;
  const disciplineJournalScore =
    disciplineJournalCoverage === undefined
      ? 60
      : score(disciplineJournalCoverage / DISCIPLINE_JOURNAL_TARGET_COVERAGE);
  const fomoEvents30d = input.fomoEvents30d;
  const revengeTrades30d = input.revengeTrades30d;
  const overtradingDays30d = input.overtradingDays30d;
  const explicitDisciplineViolations = input.disciplineViolations30d;
  const hasBehaviorData =
    explicitDisciplineViolations !== undefined ||
    fomoEvents30d !== undefined ||
    revengeTrades30d !== undefined ||
    overtradingDays30d !== undefined;
  const disciplineViolations30d =
    explicitDisciplineViolations ??
    (hasBehaviorData
      ? (fomoEvents30d ?? 0) + (revengeTrades30d ?? 0) + (overtradingDays30d ?? 0)
      : undefined);
  const disciplineBehaviorScore =
    disciplineViolations30d === undefined
      ? 60
      : Math.max(
          0,
          100 -
            (disciplineViolations30d * 15 +
              (fomoEvents30d ?? 0) * 10 +
              (revengeTrades30d ?? 0) * 25 +
              (overtradingDays30d ?? 0) * 15)
        );
  const disciplineCooldownActive = input.disciplineCooldownActive ?? false;
  const disciplineBlockerScore = disciplineCooldownActive ? 0 : 100;
  const disciplinePlannedOrdersUsd = input.plannedLimitOrdersUsd;
  const disciplinePlanScore =
    disciplinePlannedOrdersUsd === undefined
      ? 60
      : disciplinePlannedOrdersUsd > 0
        ? 100
        : 50;
  const disciplineScore = Math.round(
    disciplineJournalScore * 0.35 +
      disciplineBehaviorScore * 0.3 +
      disciplineBlockerScore * 0.25 +
      disciplinePlanScore * 0.1
  );
  const disciplineBlockers: string[] = [];
  const disciplineWarnings: string[] = [];
  if (disciplineCooldownActive) {
    disciplineBlockers.push("Активен дисциплинарный блокер");
  }
  if ((revengeTrades30d ?? 0) > 0) {
    disciplineBlockers.push("Обнаружена сделка-месть");
  }
  if ((overtradingDays30d ?? 0) >= 3) {
    disciplineBlockers.push("Обнаружена переторговка");
  } else if ((overtradingDays30d ?? 0) > 0) {
    disciplineWarnings.push("Есть дни с переторговкой");
  }
  if ((fomoEvents30d ?? 0) >= 2) {
    disciplineBlockers.push("Повторяется покупка из страха упустить рост");
  } else if ((fomoEvents30d ?? 0) > 0) {
    disciplineWarnings.push("Есть покупка из страха упустить рост");
  }
  if (disciplineJournalCoverage === undefined) {
    disciplineWarnings.push("Журнал решений не подключён");
  } else if (disciplineJournalCoverage < DISCIPLINE_JOURNAL_TARGET_COVERAGE) {
    disciplineWarnings.push("Журнал заполнен меньше чем на 80%");
  }
  if (disciplinePlannedOrdersUsd !== undefined && disciplinePlannedOrdersUsd <= 0) {
    disciplineWarnings.push("Лимитные ордера не подготовлены");
  }
  if (!hasBehaviorData) {
    disciplineWarnings.push("Поведенческие маркеры не подключены");
  } else if ((disciplineViolations30d ?? 0) > 0 && disciplineBlockers.length === 0) {
    disciplineWarnings.push("Есть дисциплинарные нарушения");
  }
  const disciplineFormula = [
    `Журнал решений: ${disciplineJournalScore}/100`,
    `Поведение: ${disciplineBehaviorScore}/100`,
    `Блокеры: ${disciplineBlockerScore}/100`,
    `План лимитных ордеров: ${disciplinePlanScore}/100`,
    `Нарушений за 30 дней: ${disciplineViolations30d ?? "нет данных"}`,
    `Балл дисциплины: ${disciplineScore}/100`,
  ];

  const components: HealthComponent[] = [
    {
      key: "reserve",
      label: "Резерв",
      color: "#56d8f5",
      desc: "Выделенный резерв. Пол 10%, цель 30%, коридор нормы 30–60%. Ниже пола новые рисковые действия запрещены; выше 60% начинается штраф за простой капитала.",
      weight: 0.2,
      score: reserveScore,
      meta: {
        reserveUsd,
        reserveShare,
        reserveFloorUsd,
        reserveTargetUsd,
        reserveBandMaxUsd,
        reserveFloorShortfallUsd,
        reserveTargetShortfallUsd,
        reserveIdleUsd,
        reserveBlockers,
        reserveWarnings,
        reserveFormula,
      },
    },
    {
      key: "crypto",
      label: "Выживаемость",
      color: "#ad67ff",
      desc: "Стресс-проверка: выдержит ли портфель сильное падение рынка без разрушения резерва и структуры капитала.",
      weight: 0.17,
      score: survivalScore,
      meta: {
        survivalShockLossPct: survivalResult.survivalShockLossPct,
        survivalLossUsd: survivalResult.survivalLossUsd,
        survivalPortfolioAfterShockShare: survivalResult.survivalPortfolioAfterShockShare,
        survivalPortfolioAfterShockUsd: survivalResult.survivalPortfolioAfterShockUsd,
        survivalReserveAfterShockShare: survivalResult.survivalReserveAfterShockShare,
        survivalBuyPowerAfterShockUsd: survivalResult.survivalBuyPowerAfterShockUsd,
        survivalBuyPowerAfterShockShare: survivalResult.survivalBuyPowerAfterShockShare,
        survivalLossScore: survivalResult.survivalLossScore,
        survivalBuyPowerScore: survivalResult.survivalBuyPowerScore,
        survivalPlanScore: survivalResult.survivalPlanScore,
        survivalStatus: survivalResult.status,
        survivalWorstScenario: survivalResult.survivalWorstScenario,
        survivalScenarios: survivalResult.survivalScenarios,
        plannedLimitOrdersUsd: survivalResult.plannedLimitOrdersUsd,
        plannedLimitOrdersShare: survivalResult.plannedLimitOrdersShare,
        survivalBlockers: survivalResult.survivalBlockers,
        survivalWarnings: survivalResult.survivalWarnings,
        survivalFormula: survivalResult.survivalFormula,
      },
    },
    {
      key: "futures",
      label: "Контроль риска",
      color: "#e8b35a",
      desc: "Активная торговля — не более 10% капитала. Балл = 100 минус штраф за превышение лимита, плечо, лишние позиции и близкую ликвидацию. Свободная часть лимита не ухудшает здоровье.",
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
        futuresCapUsd,
        futuresUsedUsd,
        futuresRemainingUsd,
        futuresBreachUsd,
        futuresCapUtilization,
        riskControlBlockers,
        riskControlWarnings,
        riskControlFormula,
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
            altcoinSlotsUsed,
            altcoinSlotsTotal,
            altcoinSlotsFree,
            altcoins,
            stockSlotsUsed,
            stockSlotsTotal,
            stockSlotsFree,
            stocks,
            metalSlotsUsed,
            metalSlotsTotal,
            metalSlotsFree,
            metals,
            concentrationBlockers,
            concentrationWarnings,
            concentrationFormula,
          }
        : { concentrationFormula },
    },
    {
      key: "diversification",
      label: "Диверсификация",
      color: "#5fe0cf",
      desc: "Насколько устойчиво разложен рисковый капитал по спотовым классам: крипта, металлы и акции. Кэш и фьючерсы не учитываются.",
      weight: 0.15,
      score: diversificationScore,
      meta: diversificationMeta,
    },
    {
      key: "flexibility",
      label: "Дисциплина",
      color: "#5af08d",
      desc: "Целостность процесса: журнал решений, отсутствие покупок из страха упустить рост, сделок-мести, переторговки и дисциплинарных блокеров.",
      weight: 0.15,
      score: disciplineScore,
      meta: {
        disciplineJournalCoverage,
        disciplineJournalScore,
        disciplineBehaviorScore,
        disciplineBlockerScore,
        disciplinePlanScore,
        disciplinePlannedOrdersUsd,
        disciplineViolations30d,
        fomoEvents30d,
        revengeTrades30d,
        overtradingDays30d,
        disciplineCooldownActive,
        disciplineBlockers,
        disciplineWarnings,
        disciplineFormula,
      },
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
