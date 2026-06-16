import {
  MAX_CRYPTO_EXPOSURE_SHARE,
  MAX_FUTURES_EXPOSURE_SHARE,
  RESERVE_TARGET_SHARE,
} from "../config/riskRules";

// Прозрачный расчёт Health Factor из реальных долей портфеля.
// Каждый компонент — балл 0..100 относительно лимита политики (лист «Риск»).
// Принцип «Risk First»: больший вес у резерва и концентрации.

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const score = (value: number) => Math.round(clamp01(value) * 100);

// Пороги «мягкой деградации»: балл 100 у комфортного уровня, 0 у жёсткого.
const CRYPTO_HARD = 0.9; // 100 при ≤60% (лимит), 0 при ≥90%
const FUTURES_HARD = 0.3; // 100 при ≤10% (лимит), 0 при ≥30%
const CONCENTRATION_SAFE = 0.2; // 100 при ≤20%
const CONCENTRATION_HARD = 0.5; // 0 при ≥50% (лимит 35% посередине)

// Веса компонентов (в сумме = 1)
export const HEALTH_WEIGHTS = {
  reserve: 0.3,
  concentration: 0.25,
  crypto: 0.2,
  futures: 0.15,
  diversification: 0.1,
};

export type HealthInput = {
  cashShare: number; // 0..1
  cryptoShare: number;
  futuresShare: number;
  largestShare: number;
  categoryShares: number[]; // доли категорий 0..1 для HHI
};

export type HealthComponents = {
  reserve: number;
  exposure: number; // = крипта
  leverage: number; // = фьючерсы
  diversification: number;
  volatility: number; // = концентрация
};

export type PortfolioHealth = {
  healthFactor: number; // 0..100
  status: "CONTROL" | "BALANCED" | "RISK";
  riskLevel: string;
  components: HealthComponents;
};

export function computePortfolioHealth(input: HealthInput): PortfolioHealth {
  // Резерв — кэш относительно цели 30%
  const reserve = score(input.cashShare / RESERVE_TARGET_SHARE);
  // Крипта — 100 при ≤60%, деградация до 0 при 90%
  const crypto = score(
    (CRYPTO_HARD - input.cryptoShare) / (CRYPTO_HARD - MAX_CRYPTO_EXPOSURE_SHARE)
  );
  // Фьючерсы — 100 при ≤10%, деградация до 0 при 30%
  const futures = score(
    (FUTURES_HARD - input.futuresShare) / (FUTURES_HARD - MAX_FUTURES_EXPOSURE_SHARE)
  );
  // Концентрация — 100 при ≤20%, 0 при ≥50% (лимит на позицию 35%)
  const concentration = score(
    (CONCENTRATION_HARD - input.largestShare) / (CONCENTRATION_HARD - CONCENTRATION_SAFE)
  );
  // Диверсификация — 1 - индекс Херфиндаля по категориям
  const hhi = input.categoryShares.reduce((sum, value) => sum + value * value, 0);
  const diversification = score(1 - hhi);

  const healthFactor = Math.round(
    reserve * HEALTH_WEIGHTS.reserve +
      concentration * HEALTH_WEIGHTS.concentration +
      crypto * HEALTH_WEIGHTS.crypto +
      futures * HEALTH_WEIGHTS.futures +
      diversification * HEALTH_WEIGHTS.diversification
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

  return {
    healthFactor,
    status,
    riskLevel,
    components: {
      reserve,
      exposure: crypto,
      leverage: futures,
      diversification,
      volatility: concentration,
    },
  };
}

// Ярлыки компонентов (для баров/радара/HUD)
export const HEALTH_COMPONENT_LABELS: Record<keyof HealthComponents, string> = {
  reserve: "Резерв",
  exposure: "Крипта",
  leverage: "Фьючерсы",
  diversification: "Диверсификация",
  volatility: "Концентрация",
};
