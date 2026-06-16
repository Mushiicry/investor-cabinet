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
const CRYPTO_HARD = 0.9; // «Крипта»: 100 при ≤60%, 0 при ≥90%
const FUTURES_HARD = 0.3; // «Фьючерсы»: 100 при ≤10%, 0 при ≥30%
const CONCENTRATION_SAFE = 0.2; // «Концентрация»: 100 при ≤20%
const CONCENTRATION_HARD = 0.5; // 0 при ≥50% (лимит на позицию 35%)

export type HealthComponentKey =
  | "reserve"
  | "crypto"
  | "futures"
  | "concentration"
  | "diversification"
  | "flexibility";

export type HealthComponent = {
  key: HealthComponentKey;
  label: string;
  score: number;
  color: string;
  desc: string;
  weight: number;
};

export type HealthInput = {
  cashShare: number; // 0..1
  cryptoShare: number;
  futuresShare: number;
  largestShare: number;
  categoryShares: number[];
};

export type PortfolioHealth = {
  healthFactor: number; // 0..100
  status: "CONTROL" | "BALANCED" | "RISK";
  riskLevel: string;
  components: HealthComponent[];
};

export function computePortfolioHealth(input: HealthInput): PortfolioHealth {
  const hhi = input.categoryShares.reduce((sum, value) => sum + value * value, 0);

  const components: HealthComponent[] = [
    {
      key: "reserve",
      label: "Резерв",
      color: "#56d8f5",
      desc: "Кэш относительно цели 30%.",
      weight: 0.2,
      score: score(input.cashShare / RESERVE_TARGET_SHARE),
    },
    {
      key: "crypto",
      label: "Крипта",
      color: "#ad67ff",
      desc: "Доля крипты против лимита 60%.",
      weight: 0.17,
      score: score((CRYPTO_HARD - input.cryptoShare) / (CRYPTO_HARD - MAX_CRYPTO_EXPOSURE_SHARE)),
    },
    {
      key: "futures",
      label: "Фьючерсы",
      color: "#e8b35a",
      desc: "Малое плечо и вес фьючерсов (≤10%).",
      weight: 0.15,
      score: score((FUTURES_HARD - input.futuresShare) / (FUTURES_HARD - MAX_FUTURES_EXPOSURE_SHARE)),
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
