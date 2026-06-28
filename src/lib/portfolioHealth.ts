import {
  MAX_CRYPTO_EXPOSURE_SHARE,
  MAX_FUTURES_EXPOSURE_SHARE,
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

export type HealthInput = {
  cashShare: number; // 0..1
  cryptoShare: number;
  futuresShare: number;
  largestShare: number;
  categoryShares: number[];
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
  const hhi = input.categoryShares.reduce((sum, value) => sum + value * value, 0);

  // ── Резерв (Risk First): выделенные стейблы относительно цели 30% ──
  const reserveShare = input.reserveShare ?? input.cashShare;
  const reserveScore = score(reserveShare / RESERVE_TARGET_SHARE);
  const reserveUsd = input.portfolioValue ? reserveShare * input.portfolioValue : undefined;
  const reserveTargetUsd = input.portfolioValue
    ? RESERVE_TARGET_SHARE * input.portfolioValue
    : undefined;

  // ── Фьючерсы: min(балл за вес, балл за плечо, балл за число позиций) ──
  // Вес: градация к лимиту 10% — 100 при 0%, 0 при ≥10% (≤10% уже не «отлично»).
  const weightScore = score(
    (MAX_FUTURES_EXPOSURE_SHARE - input.futuresShare) / MAX_FUTURES_EXPOSURE_SHARE
  );
  const legs = input.futuresLegs ?? [];
  const breaches: { asset: string; leverage: number; limit: number }[] = [];
  let leverageScore = 100; // нет фьючерсов / плечо не определить → не штрафуем
  let worstLeverage: number | undefined;
  let worstLeverageAsset: string | undefined;
  let worstLeverageLimit: number | undefined;
  for (const leg of legs) {
    if (leg.leverage == null || !isFinite(leg.leverage)) continue;
    const limit = futuresLeverageLimit(leg.asset);
    // 100 при плече ≤ лимита; падает по мере превышения (0 при удвоении лимита)
    const legScore = score(1 - Math.max(0, leg.leverage - limit) / limit);
    if (legScore < leverageScore) leverageScore = legScore;
    if (worstLeverage === undefined || leg.leverage > worstLeverage) {
      worstLeverage = leg.leverage;
      worstLeverageAsset = leg.asset;
      worstLeverageLimit = limit;
    }
    if (leg.leverage > limit) {
      breaches.push({ asset: leg.asset, leverage: leg.leverage, limit });
    }
  }
  // Число позиций: ≤3 — ок; каждая лишняя сильно срезает балл (−50 за позицию).
  const futuresCount = legs.length;
  const countScore =
    futuresCount <= MAX_FUTURES_POSITIONS
      ? 100
      : Math.max(0, 100 - (futuresCount - MAX_FUTURES_POSITIONS) * 50);
  const futuresScore = Math.min(weightScore, leverageScore, countScore);

  const components: HealthComponent[] = [
    {
      key: "reserve",
      label: "Резерв",
      color: "#56d8f5",
      desc: "Выделенный резерв (стейблы) относительно цели 30%.",
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
      desc: "Вес ≤10%, плечо ≤2x альты / ≤3x BTC-золото, не более 3 позиций.",
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
      desc: "Распределение по классам активов.",
      weight: 0.15,
      score: score(1 - hhi),
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
