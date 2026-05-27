import { normalizeHistory } from "../lib/historyNormalizers";
import { normalizeDecisions, normalizeScenarios } from "../lib/playbookNormalizers";
import { normalizePortfolio, toNumber } from "../lib/portfolioNormalizers";
import { getOpenRiskPositions } from "../lib/portfolioSelectors";
import type { InvestorApiResponse } from "../types/api";
import type { PortfolioState } from "../types/portfolio";
import {
  buildOverviewStateFromApi,
  buildRiskStateFromApi,
} from "./investorStateSections";

export function buildInvestorStateFromApi(json: InvestorApiResponse, prev: PortfolioState): PortfolioState {
  const portfolio = normalizePortfolio(json?.portfolio, prev.portfolio);
  const history = normalizeHistory(json?.history, prev.history);
  const decisions = normalizeDecisions(json?.decisions, prev.decisions);
  const scenarios = normalizeScenarios(json?.scenarios, prev.scenarios);
  const openRiskPositions = getOpenRiskPositions(portfolio);
  const portfolioValue = toNumber(json?.overview?.portfolioValue, prev.overview.portfolioValue);

  return {
    ...prev,
    portfolio,
    history,
    decisions,
    scenarios,

    overview: buildOverviewStateFromApi({
      json,
      prev,
      portfolio,
      openRiskPositions,
      portfolioValue,
    }),

    risk: buildRiskStateFromApi({
      json,
      prev,
      portfolio,
      openRiskPositions,
      portfolioValue,
    }),

    updatedAt: json?.updatedAt ?? prev.updatedAt,
  };
}
