import { SPOT_RESERVE_FLOOR_SHARE } from "../config/riskRules";
import type { Category, OverviewPosition, PositionCalculated } from "../types/portfolio";
import { round } from "./portfolioCalculations";

export const isWaitingRebuyStatus = (status: string) =>
  ["WAIT_REBUY", "WAIT_REENTRY", "WAIT_ENTRY", "ЖДАТЬ ВХОД", "ЖДАТЬ ПОКУПКУ"].includes(status.trim().toUpperCase());

export const isClosedStatus = (status: string) =>
  ["CLOSED", "FIXED", "EXITED"].includes(status.trim().toUpperCase()) || isWaitingRebuyStatus(status);

export const isReserveStatus = (status: string) =>
  ["RESERVE", "РЕЗЕРВ"].includes(status.toUpperCase());

export const isFuturesCash = (item: PositionCalculated) =>
  item.category === "Свободные деньги" && item.asset.toUpperCase().includes("USDC HL");

export const getOpenRiskPositions = (portfolio: PositionCalculated[]) =>
  portfolio.filter((item) => (
    item.currentValue > 0 &&
    item.category !== "Свободные деньги" &&
    !isClosedStatus(item.status) &&
    !isReserveStatus(item.status)
  ));

export const pickBestPosition = (positions: PositionCalculated[]) =>
  [...positions].sort((a, b) => (b.pnlPct - a.pnlPct) || (b.pnl - a.pnl) || (b.currentValue - a.currentValue))[0];

export const pickWorstPosition = (positions: PositionCalculated[]) =>
  [...positions].sort((a, b) => (a.pnlPct - b.pnlPct) || (a.pnl - b.pnl) || (b.currentValue - a.currentValue))[0];

export const pickLargestNonCashPosition = (portfolio: PositionCalculated[]) =>
  [...portfolio]
    .filter((item) => item.category !== "Свободные деньги")
    .sort((a, b) => b.currentValue - a.currentValue)[0] ?? portfolio[0];

export const pickLargestRiskPosition = (positions: PositionCalculated[]) =>
  [...positions].sort((a, b) => b.currentValue - a.currentValue)[0];

export const calculateFuturesDeployableCash = (portfolio: PositionCalculated[]) =>
  portfolio
    .filter(isFuturesCash)
    .reduce((sum, item) => sum + item.currentValue, 0);

export const calculateSpotDeployableCash = (portfolio: PositionCalculated[], portfolioValue: number) => {
  const spotReserve = portfolio
    .filter((item) => item.category === "Свободные деньги" && !isFuturesCash(item))
    .reduce((sum, item) => sum + item.currentValue, 0);

  return Math.max(spotReserve - portfolioValue * SPOT_RESERVE_FLOOR_SHARE, 0);
};

export const calculateDeployableCashBuckets = (
  portfolio: PositionCalculated[],
  portfolioValue: number
) => ({
  futuresDeployableCash: calculateFuturesDeployableCash(portfolio),
  spotDeployableCash: calculateSpotDeployableCash(portfolio, portfolioValue),
});

export const calculateShare = (portfolio: PositionCalculated[], category: Category) => {
  const total = portfolio.reduce((sum, item) => sum + item.currentValue, 0);
  const value = portfolio
    .filter((item) => item.category === category)
    .reduce((sum, item) => sum + item.currentValue, 0);

  return total ? round(value / total, 4) : 0;
};

export const findPosition = (portfolio: PositionCalculated[], asset?: string) =>
  portfolio.find((item) => item.asset === asset);

export const getOverviewTopPositions = (portfolio: PositionCalculated[]): OverviewPosition[] =>
  portfolio
    .filter((item) => (
      item.currentValue > 0 &&
      item.category !== "Свободные деньги" &&
      !isReserveStatus(item.status)
    ))
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, 3)
    .map((item) => ({
      asset: item.asset,
      share: round(item.share / 100, 4),
      value: item.currentValue,
      status: item.status,
    }));
