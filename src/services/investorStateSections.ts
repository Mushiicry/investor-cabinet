import { calculateCategoryAllocations } from "../lib/portfolioCalculations";
import { toNumber, toRatio } from "../lib/portfolioNormalizers";
import {
  calculateDeployableCashBuckets,
  findPosition,
  getOverviewTopPositions,
  pickBestPosition,
  pickLargestRiskPosition,
  pickWorstPosition,
} from "../lib/portfolioSelectors";
import {
  buildExposureWarnings,
  calculateCategoryExposureShares,
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

const CASH_CATEGORY = "Свободные деньги";

// Кэш/резерв = сумма текущей стоимости позиций категории «Свободные деньги»
function sumCashFromRows(portfolio: PositionCalculated[]): number {
  return Number(
    portfolio
      .filter((position) => position.category === CASH_CATEGORY)
      .reduce((sum, position) => sum + (position.currentValue || 0), 0)
      .toFixed(2)
  );
}

// Активные позиции = со стоимостью или вложением (закрытые/пустые не считаем)
function countActivePositions(portfolio: PositionCalculated[]): number {
  return portfolio.filter(
    (position) => (position.currentValue || 0) > 0 || (position.invested || 0) > 0
  ).length;
}

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
  const hasRows = portfolio.length > 0;
  const apiPnl = toNumber(json?.overview?.pnl, prev.overview.pnl);
  const pnl = invested ? portfolioValue - invested : apiPnl;
  const pnlPct = invested ? pnl / invested : toRatio(json?.overview?.pnlPct, prev.overview.pnlPct);

  return {
    ...prev.overview,
    invested,
    portfolioValue,
    pnl,
    pnlPct,
    reserve: hasRows ? sumCashFromRows(portfolio) : toNumber(json?.overview?.reserve, prev.overview.reserve),
    positionsCount: hasRows ? countActivePositions(portfolio) : toNumber(json?.overview?.positionsCount, prev.overview.positionsCount),
    health: toRatio(json?.overview?.health, prev.overview.health),
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
  const apiFuturesDeployableCash = toNumber(
    json?.risk?.futuresDeployableCash,
    prev.risk.futuresDeployableCash
  );
  const largestRiskShare = largestRiskPosition
    ? toRatio(largestRiskPosition.share, prev.risk.largestRiskShare)
    : toRatio(json?.risk?.largestRiskShare, prev.risk.largestRiskShare);
  const exposureWarnings = buildExposureWarnings(categoryExposure, largestRiskShare);

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
    cryptoShare: categoryExposure.cryptoShare || toRatio(json?.risk?.cryptoShare, prev.risk.cryptoShare),
    stocksShare: categoryExposure.stocksShare,
    metalsShare: categoryExposure.metalsShare,
    futuresShare: categoryExposure.futuresShare,
    cashShare: categoryExposure.cashShare,
    health: toRatio(json?.risk?.health, prev.risk.health),
    state: json?.risk?.state ?? prev.risk.state,
    signal: json?.risk?.signal ?? prev.risk.signal,
    summary: json?.risk?.summary ?? prev.risk.summary,
    warnings: exposureWarnings,
  };
}
