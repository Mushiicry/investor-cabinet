import { RESERVE_FLOOR_SHARE } from "../config/riskRules";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const score = (value: number) => Math.round(clamp01(value) * 100);

export const SURVIVAL_CRYPTO_SHOCK = 0.6;
export const SURVIVAL_STOCK_SHOCK = 0.3;
export const SURVIVAL_METAL_SHOCK = 0.5;
export const SURVIVAL_ACTIVE_TRADING_SHOCK = 1;
export const SURVIVAL_COMFORT_LOSS_SHARE = 0.25;
export const SURVIVAL_WARNING_LOSS_SHARE = 0.4;
export const SURVIVAL_BLOCK_LOSS_SHARE = 0.6;
export const SURVIVAL_BUY_POWER_TARGET_SHARE = 0.15;

export type SurvivalStatus = "ВЫЖИВАЕТ" | "ОСТОРОЖНО" | "НЕ ВЫЖИВАЕТ";

export type SurvivalScenario = {
  name: string;
  lossPct: number;
  lossUsd?: number;
};

export type SurvivalInput = {
  cryptoShare: number;
  futuresShare: number;
  riskCategoryShares: number[];
  reserveShare: number;
  portfolioValue?: number;
  spotDeployableUsd?: number;
  plannedLimitOrdersUsd?: number;
};

export type SurvivalResult = {
  score: number;
  status: SurvivalStatus;
  survivalShockLossPct: number;
  survivalLossUsd?: number;
  survivalPortfolioAfterShockShare: number;
  survivalPortfolioAfterShockUsd?: number;
  survivalReserveAfterShockShare: number;
  survivalBuyPowerAfterShockUsd?: number;
  survivalBuyPowerAfterShockShare: number;
  survivalLossScore: number;
  survivalBuyPowerScore: number;
  survivalPlanScore: number;
  survivalWorstScenario: string;
  survivalScenarios: SurvivalScenario[];
  plannedLimitOrdersUsd?: number;
  plannedLimitOrdersShare?: number;
  survivalBlockers: string[];
  survivalWarnings: string[];
  survivalFormula: string[];
};

export function calculateSurvival(input: SurvivalInput): SurvivalResult {
  const scenarioCryptoShare = input.riskCategoryShares[0] ?? input.cryptoShare;
  const scenarioMetalShare = input.riskCategoryShares[1] ?? 0;
  const scenarioStockShare = input.riskCategoryShares[2] ?? 0;
  const portfolioValue = input.portfolioValue ?? 0;

  const survivalScenarios = [
    {
      name: "Крах крипты",
      lossPct: Math.min(
        1,
        scenarioCryptoShare * SURVIVAL_CRYPTO_SHOCK +
          input.futuresShare * SURVIVAL_ACTIVE_TRADING_SHOCK,
      ),
    },
    {
      name: "Падение акций США",
      lossPct: Math.min(1, scenarioStockShare * SURVIVAL_STOCK_SHOCK),
    },
    {
      name: "Обвал золота и металлов",
      lossPct: Math.min(1, scenarioMetalShare * SURVIVAL_METAL_SHOCK),
    },
    {
      name: "Общий рыночный шок",
      lossPct: Math.min(
        1,
        scenarioCryptoShare * SURVIVAL_CRYPTO_SHOCK +
          scenarioMetalShare * SURVIVAL_METAL_SHOCK +
          scenarioStockShare * SURVIVAL_STOCK_SHOCK +
          input.futuresShare * SURVIVAL_ACTIVE_TRADING_SHOCK,
      ),
    },
  ].map((scenario) => ({
    ...scenario,
    lossUsd: input.portfolioValue ? scenario.lossPct * input.portfolioValue : undefined,
  }));

  const worstSurvivalScenario = survivalScenarios.reduce((worst, current) =>
    current.lossPct > worst.lossPct ? current : worst,
  );
  const survivalShockLossPct = worstSurvivalScenario.lossPct;
  const survivalPortfolioAfterShockShare = Math.max(0, 1 - survivalShockLossPct);
  const survivalReserveAfterShockShare =
    survivalPortfolioAfterShockShare > 0 ? input.reserveShare / survivalPortfolioAfterShockShare : 0;
  const reserveAfterShockUsd = portfolioValue ? input.reserveShare * portfolioValue : undefined;
  const floorAfterShockUsd = portfolioValue
    ? RESERVE_FLOOR_SHARE * survivalPortfolioAfterShockShare * portfolioValue
    : undefined;
  const derivedBuyPowerAfterShockUsd =
    reserveAfterShockUsd !== undefined && floorAfterShockUsd !== undefined
      ? Math.max(0, reserveAfterShockUsd - floorAfterShockUsd)
      : undefined;
  const buyPowerAfterShockUsd = input.spotDeployableUsd ?? derivedBuyPowerAfterShockUsd;
  const survivalBuyPowerAfterShockShare =
    portfolioValue && buyPowerAfterShockUsd !== undefined ? buyPowerAfterShockUsd / portfolioValue : 0;
  const survivalLossScore = score(
    (SURVIVAL_BLOCK_LOSS_SHARE - survivalShockLossPct) /
      (SURVIVAL_BLOCK_LOSS_SHARE - SURVIVAL_COMFORT_LOSS_SHARE),
  );
  const survivalBuyPowerScore = score(
    survivalBuyPowerAfterShockShare / SURVIVAL_BUY_POWER_TARGET_SHARE,
  );
  const plannedLimitOrdersUsd = input.plannedLimitOrdersUsd;
  const plannedLimitOrdersShare =
    portfolioValue && plannedLimitOrdersUsd !== undefined
      ? plannedLimitOrdersUsd / portfolioValue
      : undefined;

  let survivalPlanScore = 60;
  if (plannedLimitOrdersUsd !== undefined) {
    if (plannedLimitOrdersUsd <= 0) {
      survivalPlanScore = 40;
    } else if (buyPowerAfterShockUsd !== undefined && plannedLimitOrdersUsd > buyPowerAfterShockUsd) {
      survivalPlanScore = 20;
    } else {
      survivalPlanScore = 100;
    }
  }

  const survivalScore = Math.round(
    survivalLossScore * 0.45 + survivalBuyPowerScore * 0.35 + survivalPlanScore * 0.2,
  );
  const survivalLossUsd = input.portfolioValue
    ? survivalShockLossPct * input.portfolioValue
    : undefined;
  const survivalPortfolioAfterShockUsd = input.portfolioValue
    ? survivalPortfolioAfterShockShare * input.portfolioValue
    : undefined;
  const survivalBlockers: string[] = [];
  const survivalWarnings: string[] = [];

  if (survivalShockLossPct >= SURVIVAL_BLOCK_LOSS_SHARE) {
    survivalBlockers.push("Худший сценарий даёт просадку выше 60%");
  } else if (survivalShockLossPct >= SURVIVAL_WARNING_LOSS_SHARE) {
    survivalWarnings.push("Худший сценарий даёт просадку выше 40%");
  }
  if (survivalBuyPowerAfterShockShare <= 0) {
    survivalBlockers.push("После шока нет покупательской способности");
  } else if (survivalBuyPowerAfterShockShare < SURVIVAL_BUY_POWER_TARGET_SHARE) {
    survivalWarnings.push("Покупательская способность после шока ниже цели 15%");
  }
  if (plannedLimitOrdersUsd === undefined) {
    survivalWarnings.push("План лимитных покупок не подключён");
  } else if (plannedLimitOrdersUsd <= 0) {
    survivalWarnings.push("План лимитных покупок на падение не подготовлен");
  } else if (buyPowerAfterShockUsd !== undefined && plannedLimitOrdersUsd > buyPowerAfterShockUsd) {
    survivalBlockers.push("План лимитных покупок больше доступных денег после шока");
  }

  let status: SurvivalStatus = "ВЫЖИВАЕТ";
  if (survivalBlockers.length) {
    status = "НЕ ВЫЖИВАЕТ";
  } else if (survivalWarnings.length) {
    status = "ОСТОРОЖНО";
  }

  const survivalFormula = [
    "Сценарии: крипта −60%, акции −30%, металлы −50%, активная торговля −100%",
    `Худший сценарий: ${worstSurvivalScenario.name}`,
    `Оценочная просадка: ${Math.round(survivalShockLossPct * 100)}%`,
    `Портфель после шока: ${
      input.portfolioValue
        ? `$${Math.round(survivalPortfolioAfterShockUsd ?? 0)}`
        : `${Math.round(survivalPortfolioAfterShockShare * 100)}%`
    }`,
    `Покупательская способность после шока: ${
      buyPowerAfterShockUsd !== undefined
        ? `$${Math.round(buyPowerAfterShockUsd)}`
        : `${Math.round(survivalBuyPowerAfterShockShare * 100)}%`
    }`,
    plannedLimitOrdersUsd !== undefined
      ? `План лимитных покупок: $${Math.round(plannedLimitOrdersUsd)}`
      : "План лимитных покупок: источник не подключён",
    `Балл выживаемости: ${survivalScore}/100`,
  ];

  return {
    score: survivalScore,
    status,
    survivalShockLossPct,
    survivalLossUsd,
    survivalPortfolioAfterShockShare,
    survivalPortfolioAfterShockUsd,
    survivalReserveAfterShockShare,
    survivalBuyPowerAfterShockUsd: buyPowerAfterShockUsd,
    survivalBuyPowerAfterShockShare,
    survivalLossScore,
    survivalBuyPowerScore,
    survivalPlanScore,
    survivalWorstScenario: worstSurvivalScenario.name,
    survivalScenarios,
    plannedLimitOrdersUsd,
    plannedLimitOrdersShare,
    survivalBlockers,
    survivalWarnings,
    survivalFormula,
  };
}
