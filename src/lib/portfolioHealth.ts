import {
  MAX_CRYPTO_EXPOSURE_SHARE,
  MAX_FUTURES_EXPOSURE_SHARE,
  RESERVE_BAND_MAX_SHARE,
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
const CONCENTRATION_SAFE = 0.2; // «Концентрация»: 100 при ≤20%
const CONCENTRATION_HARD = 0.5; // 0 при ≥50% (лимит на позицию 35%)

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

export type FuturesLeg = {
  asset: string;
  leverage: number | null; // эффективное плечо, выведенное из данных (null = не определить)
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
  worstLeverage?: number;
  worstLeverageAsset?: string;
  worstLeverageLimit?: number;
  leverageBreaches?: { asset: string; leverage: number; limit: number }[];
  weightScore?: number;
  leverageScore?: number;
  countScore?: number;
  futuresCount?: number;
  futuresShare?: number;
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
 * < 30%  — подушки не хватает: линейный рост балла до 100.
 * 30–60% — дисциплинированная зона: 100 баллов.
 * > 60%  — капитал простаивает: инвестор перестал инвестировать. Балл линейно
 *          падает до 0 при 100% в кэше.
 *
 * Без верхней границы модель выдавала 100/100 за портфель «94% кэша + по 2% в трёх
 * классах» — вырожденный оптимум, при котором «идеальное здоровье» = не инвестировать.
 * Резерв даёт опциональность, но сверх коридора это уже не подушка, а простой.
 */
export function computeReserveScore(reserveShare: number): number {
  if (reserveShare <= 0) return 0;
  if (reserveShare < RESERVE_TARGET_SHARE) return score(reserveShare / RESERVE_TARGET_SHARE);
  if (reserveShare <= RESERVE_BAND_MAX_SHARE) return 100;
  return score((1 - reserveShare) / (1 - RESERVE_BAND_MAX_SHARE));
}

export function computeDiversificationScore(riskShares: number[]): number {
  const n = riskShares.length;
  const total = riskShares.reduce((sum, value) => sum + value, 0);
  if (n < 2 || total <= 0) return 0;

  const hhi = riskShares.reduce((sum, value) => {
    const weight = value / total;
    return sum + weight * weight;
  }, 0);

  return score((1 - hhi) / (1 - 1 / n));
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

  // ── Фьючерсы: 100 без позиций, далее суммируются прозрачные штрафы ──
  // Лимит 10% считается по начальной марже фьючерсов относительно общего invested.
  const marginUsage = input.futuresShare / MAX_FUTURES_EXPOSURE_SHARE;
  const marginPenalty =
    Math.min(marginUsage, 1) * 20 + Math.max(0, marginUsage - 1) * 50;
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
  const futuresScore = Math.max(
    0,
    Math.round(100 - marginPenalty - leveragePenalty - positionPenalty)
  );

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
      desc: "Начальная маржа ≤10% от вложенного капитала, плечо ≤2x альты / ≤3x BTC и золото, не более 3 позиций.",
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
      },
    },
    {
      key: "concentration",
      label: "Концентрация",
      color: "#ff6b8a",
      desc: "Нет перегруза одним активом (≤35%).",
      weight: 0.18,
      score: score(
        (CONCENTRATION_HARD - input.largestShare) / (CONCENTRATION_HARD - CONCENTRATION_SAFE)
      ),
    },
    {
      key: "diversification",
      label: "Диверсификация",
      color: "#5fe0cf",
      desc: "Насколько ровно разложен рисковый капитал по спотовым классам (крипта / металлы / акции). Кэш и фьючерсы не учитываются.",
      weight: 0.15,
      score: computeDiversificationScore(input.riskCategoryShares),
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
