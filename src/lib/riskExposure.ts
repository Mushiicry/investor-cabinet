import type { Category, PositionCalculated, RiskWarning } from "../types/portfolio";
import {
  MAX_CRYPTO_EXPOSURE_SHARE,
  MAX_FUTURES_EXPOSURE_SHARE,
  MAX_SINGLE_RISK_ASSET_SHARE,
} from "../config/riskRules";

const round = (value: number, digits = 4) => Number(value.toFixed(digits));

export type CategoryExposureShares = {
  cryptoShare: number;
  stocksShare: number;
  metalsShare: number;
  futuresShare: number;
  cashShare: number;
};

export function calculatePortfolioValue(positions: PositionCalculated[]): number {
  return positions.reduce((sum, item) => sum + item.currentValue, 0);
}

export function calculateCategoryValue(
  positions: PositionCalculated[],
  category: Category
): number {
  return positions
    .filter((item) => item.category === category)
    .reduce((sum, item) => sum + item.currentValue, 0);
}

export function calculateCategoryShare(
  positions: PositionCalculated[],
  category: Category,
  portfolioValue = calculatePortfolioValue(positions)
): number {
  if (!portfolioValue) return 0;

  return round(calculateCategoryValue(positions, category) / portfolioValue);
}

export function calculateCategoryExposureShares(
  positions: PositionCalculated[],
  portfolioValue = calculatePortfolioValue(positions)
): CategoryExposureShares {
  return {
    cryptoShare: calculateCategoryShare(positions, "Крипта", portfolioValue),
    stocksShare: calculateCategoryShare(positions, "Акции", portfolioValue),
    metalsShare: calculateCategoryShare(positions, "Металлы", portfolioValue),
    futuresShare: calculateCategoryShare(positions, "Фьючерсы", portfolioValue),
    cashShare: calculateCategoryShare(positions, "Свободные деньги", portfolioValue),
  };
}

// Спекулятивная нагрузка против лимита 10% капитала (манифест, «Спекулятивная
// часть»). Считаем ВСЁ, что уже выделено под спекуляцию:
//   1) начальная маржа ОТКРЫТЫХ фьючерс-позиций (invested);
//   2) СВОБОДНАЯ маржа на Hyperliquid (USDC HL) — деньги уже отведены под
//      торговлю, поэтому входят в лимит наравне с открытыми позициями
//      (решение владельца 2026-07-19).
// GOLD остаётся в «Металлах» и в этот лимит НЕ входит (плечо контролируется
// отдельно, ≤3x) — см. [[gold-leverage-control]].
export function calculateFuturesMarginShare(positions: PositionCalculated[]): number {
  const investedCapital = positions.reduce((sum, item) => sum + item.invested, 0);
  if (!investedCapital) return 0;

  const futuresInitialMargin = positions
    .filter((item) => item.category === "Фьючерсы" && item.currentValue > 0)
    .reduce((sum, item) => sum + item.invested, 0);

  const freeFuturesMargin = positions
    .filter(
      (item) =>
        item.category === "Свободные деньги" &&
        item.asset.toUpperCase().includes("USDC HL")
    )
    .reduce((sum, item) => sum + item.currentValue, 0);

  return round((futuresInitialMargin + freeFuturesMargin) / investedCapital);
}

export function buildExposureWarnings(
  exposures: CategoryExposureShares,
  largestRiskShare: number
): RiskWarning[] {
  const warnings: RiskWarning[] = [];

  if (exposures.cryptoShare > MAX_CRYPTO_EXPOSURE_SHARE) {
    warnings.push({
      code: "CRYPTO_OVEREXPOSURE",
      level: "watch",
      message: "Доля крипты выше текущего лимита политики. Добор только после пересмотра структуры.",
    });
  }

  if (exposures.futuresShare > MAX_FUTURES_EXPOSURE_SHARE) {
    warnings.push({
      code: "FUTURES_OVEREXPOSURE",
      level: "high",
      message: "Фьючерсный блок выше дисциплинарного лимита. Новое плечо не добавлять.",
    });
  }

  if (largestRiskShare > MAX_SINGLE_RISK_ASSET_SHARE) {
    warnings.push({
      code: "SINGLE_ASSET_CONCENTRATION",
      level: "watch",
      message: "Один рисковый актив выше лимита концентрации. Увеличение позиции только после ребаланса.",
    });
  }

  return warnings;
}
