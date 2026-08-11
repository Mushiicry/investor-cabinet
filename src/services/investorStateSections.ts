import { calculateCategoryAllocations } from "../lib/portfolioCalculations";
import { toNumber, toRatio } from "../lib/portfolioNormalizers";
import {
  calculateDeployableCashBuckets,
  findPosition,
  getOverviewTopPositions,
  getTrackedPortfolioPositions,
  pickBestPosition,
  pickLargestRiskPosition,
  pickWorstPosition,
} from "../lib/portfolioSelectors";
import {
  buildExposureWarnings,
  calculateCategoryExposureShares,
  calculateFuturesMarginShare,
} from "../lib/riskExposure";
import type { InvestorApiResponse } from "../types/api";
import type { PortfolioState, PositionCalculated } from "../types/portfolio";

type InvestorStateSectionInput = {
  json: InvestorApiResponse;
  prev: PortfolioState;
  portfolio: PositionCalculated[];
  openRiskPositions: PositionCalculated[];
  portfolioValue: number;
  invested: number;
};

export function buildOverviewStateFromApi({
  json,
  prev,
  portfolio,
  openRiskPositions,
  portfolioValue,
  invested,
}: InvestorStateSectionInput): PortfolioState["overview"] {
  const bestOpenPosition = pickBestPosition(openRiskPositions);
  const worstOpenPosition = pickWorstPosition(openRiskPositions);
  const bestAsset = json?.overview?.bestPosition?.asset ?? prev.overview.bestPosition.asset;
  const worstAsset = json?.overview?.worstPosition?.asset ?? prev.overview.worstPosition.asset;
  const bestPosition = bestOpenPosition ?? findPosition(portfolio, bestAsset);
  const worstPosition = worstOpenPosition ?? findPosition(portfolio, worstAsset);
  const pnl = toNumber(
    json?.overview?.pnl,
    invested ? portfolioValue - invested : prev.overview.pnl
  );
  const pnlPct = toRatio(
    json?.overview?.pnlPct,
    invested ? pnl / invested : prev.overview.pnlPct
  );

  return {
    ...prev.overview,
    invested,
    portfolioValue,
    pnl,
    pnlPct,
    reserve: toNumber(json?.overview?.reserve, prev.overview.reserve),
    positionsCount: getTrackedPortfolioPositions(portfolio).length,
    health: toNumber(json?.overview?.health, prev.overview.health),
    realizedPnl: toNumber(json?.overview?.realizedPnl, prev.overview.realizedPnl ?? 0),
    realizedPnlPct: toNumber(json?.overview?.realizedPnlPct, prev.overview.realizedPnlPct ?? 0),
    state: json?.overview?.state ?? prev.overview.state,
    signal: json?.overview?.signal ?? prev.overview.signal,
    action: json?.overview?.action ?? prev.overview.action,
    categories: calculateCategoryAllocations(portfolio),
    topPositions: getOverviewTopPositions(portfolio),
    bestPosition: {
      ...prev.overview.bestPosition,
      asset: bestPosition?.asset ?? bestAsset,
      pnl: bestPosition?.pnl ?? toNumber(json?.overview?.bestPosition?.pnl, prev.overview.bestPosition.pnl),
      pnlPct: bestPosition?.pnlPct ?? toNumber(json?.overview?.bestPosition?.pnlPct, prev.overview.bestPosition.pnlPct),
    },
    worstPosition: {
      ...prev.overview.worstPosition,
      asset: worstPosition?.asset ?? worstAsset,
      pnl: worstPosition?.pnl ?? toNumber(json?.overview?.worstPosition?.pnl, prev.overview.worstPosition.pnl),
      pnlPct: worstPosition?.pnlPct ?? toNumber(json?.overview?.worstPosition?.pnlPct, prev.overview.worstPosition.pnlPct),
    },
  };
}

export function buildRiskStateFromApi({
  json,
  prev,
  portfolio,
  openRiskPositions,
  portfolioValue,
}: InvestorStateSectionInput): PortfolioState["risk"] {
  const largestRiskPosition = pickLargestRiskPosition(openRiskPositions);
  const deployableCashBuckets = calculateDeployableCashBuckets(portfolio, portfolioValue);
  const categoryExposure = calculateCategoryExposureShares(portfolio, portfolioValue);
  const futuresShare = calculateFuturesMarginShare(portfolio);
  const apiFuturesDeployableCash = toNumber(
    json?.risk?.futuresDeployableCash,
    prev.risk.futuresDeployableCash
  );
  const largestRiskShare = largestRiskPosition
    ? toRatio(largestRiskPosition.share, prev.risk.largestRiskShare)
    : toRatio(json?.risk?.largestRiskShare, prev.risk.largestRiskShare);
  const exposureWarnings = buildExposureWarnings(
    { ...categoryExposure, futuresShare },
    largestRiskShare
  );

  return {
    ...prev.risk,
    portfolioValue: toNumber(json?.risk?.portfolioValue, prev.risk.portfolioValue),
    reserve: toNumber(json?.risk?.reserve, prev.risk.reserve),
    reserveShare: toRatio(json?.risk?.reserveShare, prev.risk.reserveShare),
    deployableCash: toNumber(json?.risk?.deployableCash, prev.risk.deployableCash),
    futuresDeployableCash: deployableCashBuckets.futuresDeployableCash || apiFuturesDeployableCash,
    spotDeployableCash: deployableCashBuckets.spotDeployableCash,
    largestRiskAsset: largestRiskPosition?.asset ?? json?.risk?.largestRiskAsset ?? prev.risk.largestRiskAsset,
    largestRiskShare,
    cryptoShare: categoryExposure.cryptoShare,
    stocksShare: categoryExposure.stocksShare,
    metalsShare: categoryExposure.metalsShare,
    futuresShare,
    cashShare: categoryExposure.cashShare,
    health: toNumber(json?.risk?.health, prev.risk.health),
    state: json?.risk?.state ?? prev.risk.state,
    signal: json?.risk?.signal ?? prev.risk.signal,
    summary: json?.risk?.summary ?? prev.risk.summary,
    warnings: exposureWarnings,
  };
}
