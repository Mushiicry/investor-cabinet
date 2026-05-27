import type { PortfolioHistoryPoint } from "../types/portfolio";
import { round } from "./portfolioCalculations";

export type PortfolioHistorySummary = {
  pointsCount: number;
  firstPoint: PortfolioHistoryPoint | null;
  latestPoint: PortfolioHistoryPoint | null;
  portfolioValueChange: number;
  portfolioValueChangePct: number;
  pnlChange: number;
  reserveChange: number;
};

const parseHistoryDate = (date: string) => {
  const trimmed = date.trim();
  const ruDateMatch = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(trimmed);

  if (ruDateMatch) {
    const [, day, month, year] = ruDateMatch;
    return Date.UTC(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getSortedPortfolioHistory = (history: PortfolioHistoryPoint[]) =>
  [...history]
    .filter((point) => point.date && point.portfolioValue > 0)
    .sort((a, b) => parseHistoryDate(a.date) - parseHistoryDate(b.date));

export const getLatestPortfolioHistoryPoint = (history: PortfolioHistoryPoint[]) => {
  const sortedHistory = getSortedPortfolioHistory(history);
  return sortedHistory.at(-1) ?? null;
};

export const getPortfolioHistorySummary = (
  history: PortfolioHistoryPoint[]
): PortfolioHistorySummary => {
  const sortedHistory = getSortedPortfolioHistory(history);
  const firstPoint = sortedHistory[0] ?? null;
  const latestPoint = sortedHistory.at(-1) ?? null;

  if (!firstPoint || !latestPoint) {
    return {
      pointsCount: sortedHistory.length,
      firstPoint,
      latestPoint,
      portfolioValueChange: 0,
      portfolioValueChangePct: 0,
      pnlChange: 0,
      reserveChange: 0,
    };
  }

  const portfolioValueChange = latestPoint.portfolioValue - firstPoint.portfolioValue;

  return {
    pointsCount: sortedHistory.length,
    firstPoint,
    latestPoint,
    portfolioValueChange: round(portfolioValueChange),
    portfolioValueChangePct: firstPoint.portfolioValue
      ? round(portfolioValueChange / firstPoint.portfolioValue, 4)
      : 0,
    pnlChange: round(latestPoint.pnl - firstPoint.pnl),
    reserveChange: round(latestPoint.reserve - firstPoint.reserve),
  };
};
