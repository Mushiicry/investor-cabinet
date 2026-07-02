import type {
  Category,
  CategoryAllocation,
  Decision,
  PortfolioState,
  PositionCalculated,
  PositionInput,
  Risk,
  ScenarioCard,
} from "../types/portfolio";
import {
  RESERVE_WORK_BUDGET_SHARE,
  SPOT_RESERVE_FLOOR_SHARE,
} from "../config/riskRules";
import {
  calculateReserveHealth,
  getReserveSignal,
  getReserveSummary,
  getRiskState,
} from "./riskCore";
import {
  buildExposureWarnings,
  calculateCategoryExposureShares,
  calculateCategoryValue,
  calculateFuturesMarginShare,
  calculatePortfolioValue,
} from "./riskExposure";
import { buildFearGreedStrategy } from "./fearGreedStrategy";

export const CATEGORY_ORDER: Category[] = ["Крипта", "Металлы", "Фьючерсы", "Акции", "Свободные деньги"];

export const round = (n: number, digits = 2) => Number(n.toFixed(digits));

export function calculateInvested(position: PositionInput): number {
  return round(position.quantity * position.avgEntry);
}

export function calculateCurrentValue(position: PositionInput): number {
  return round(position.quantity * position.currentPrice);
}

export function calculatePnL(position: PositionInput): number {
  return round(calculateCurrentValue(position) - calculateInvested(position));
}

export function calculatePnLPercent(position: PositionInput): number {
  const invested = calculateInvested(position);
  if (!invested) return 0;
  return round((calculatePnL(position) / invested) * 100, 1);
}

export function calculatePortfolio(positions: PositionInput[]): PositionCalculated[] {
  const enriched = positions.map((position) => ({
    ...position,
    invested: calculateInvested(position),
    currentValue: calculateCurrentValue(position),
    pnl: calculatePnL(position),
    pnlPct: calculatePnLPercent(position),
    share: 0,
  }));
  const totalValue = enriched.reduce((sum, item) => sum + item.currentValue, 0);
  return enriched.map((item) => ({
    ...item,
    share: totalValue ? round((item.currentValue / totalValue) * 100, 1) : 0,
  }));
}

export function calculateCategoryAllocations(positions: PositionCalculated[]): CategoryAllocation[] {
  const totalValue = positions.reduce((sum, item) => sum + item.currentValue, 0);
  return CATEGORY_ORDER.map((category) => {
    const value = round(positions.filter((item) => item.category === category).reduce((sum, item) => sum + item.currentValue, 0));
    return { name: category, value, share: totalValue ? round(value / totalValue, 4) : 0 };
  });
}

export function calculateRisk(positions: PositionCalculated[]): Risk {
  const portfolioValue = round(calculatePortfolioValue(positions));
  const reserve = calculateCategoryValue(positions, "Свободные деньги");
  const reserveShare = portfolioValue ? reserve / portfolioValue : 0;
  const categoryExposure = calculateCategoryExposureShares(positions, portfolioValue);
  const futuresShare = calculateFuturesMarginShare(positions);
  const workBudget = reserve * RESERVE_WORK_BUDGET_SHARE;
  const futuresDeployableCash = positions
    .filter((item) => item.category === "Свободные деньги" && item.asset.toUpperCase().includes("USDC HL"))
    .reduce((sum, item) => sum + item.currentValue, 0);
  const spotReserve = positions
    .filter((item) => item.category === "Свободные деньги" && !item.asset.toUpperCase().includes("USDC HL"))
    .reduce((sum, item) => sum + item.currentValue, 0);
  const spotDeployableCash = Math.max(spotReserve - portfolioValue * SPOT_RESERVE_FLOOR_SHARE, 0);
  const largestRiskAsset = positions.filter((item) => item.category !== "Свободные деньги").sort((a, b) => b.currentValue - a.currentValue)[0] ?? null;
  const health = calculateReserveHealth(reserveShare);
  const state = getRiskState(health);
  const signal = getReserveSignal(reserveShare);
  const summary = getReserveSummary(reserveShare);
  const largestRiskShare = largestRiskAsset ? round(largestRiskAsset.share / 100, 4) : 0;
  const exposureWarnings = buildExposureWarnings(
    { ...categoryExposure, futuresShare },
    largestRiskShare
  );

  return {
    portfolioValue,
    reserve: round(reserve),
    reserveShare: round(reserveShare, 4),
    deployableCash: round(workBudget),
    futuresDeployableCash: round(futuresDeployableCash),
    spotDeployableCash: round(spotDeployableCash),
    largestRiskAsset: largestRiskAsset?.asset ?? "-",
    largestRiskShare,
    cryptoShare: categoryExposure.cryptoShare,
    stocksShare: categoryExposure.stocksShare,
    metalsShare: categoryExposure.metalsShare,
    futuresShare,
    cashShare: categoryExposure.cashShare,
    health: round(health, 2),
    state,
    signal,
    summary,
    warnings: exposureWarnings,
  };
}

export function buildPortfolioState(positionsInput: PositionInput[], decisions: Decision[], scenarios: ScenarioCard[]): PortfolioState {
  const portfolio = calculatePortfolio(positionsInput);
  const invested = round(portfolio.reduce((sum, item) => sum + item.invested, 0));
  const portfolioValue = round(portfolio.reduce((sum, item) => sum + item.currentValue, 0));
  const pnl = round(portfolioValue - invested);
  const pnlPct = invested ? round(pnl / invested, 4) : 0;
  const categories = calculateCategoryAllocations(portfolio);
  const risk = calculateRisk(portfolio);

  const bestNonCash =
    [...portfolio]
      .filter((item) => item.asset !== "USDT")
      .sort((a, b) => b.pnl - a.pnl)[0] ?? portfolio[0];

  const worstNonCash =
    [...portfolio]
      .filter((item) => item.asset !== "USDT")
      .sort((a, b) => a.pnlPct - b.pnlPct)[0] ?? portfolio[0];

  const topPositions = [...portfolio].sort((a, b) => b.currentValue - a.currentValue).slice(0, 3).map((item) => ({
    asset: item.asset,
    share: round(item.share / 100, 4),
    value: item.currentValue,
    status: item.status,
  }));

  return {
    overview: {
      portfolioValue,
      invested,
      pnl,
      pnlPct,
      reserve: risk.reserve,
      positionsCount: portfolio.filter((item) => item.category !== "Свободные деньги").length,
      health: risk.health,
      state: risk.state,
      signal: risk.signal,
      action: `В работу по стратегии можно пустить около $${risk.deployableCash.toFixed(1)} без поломки структуры портфеля.`,
      topPositions,
      bestPosition: { asset: bestNonCash.asset, pnl: bestNonCash.pnl, pnlPct: bestNonCash.pnlPct },
      worstPosition: { asset: worstNonCash.asset, pnl: worstNonCash.pnl, pnlPct: worstNonCash.pnlPct },
      categories,
    },
    portfolio,
    risk,
    decisions,
    scenarios,
    history: [],
    transactions: [],
    fearGreedStrategy: buildFearGreedStrategy(50, invested),
    updatedAt: new Date().toISOString(),
  };
}
