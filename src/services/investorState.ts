import { normalizeHistory } from "../lib/historyNormalizers";
import { normalizeFearGreedStrategyFromApi, applyTransactionsToCooldown } from "../lib/fearGreedStrategy";
import { normalizeDecisions, normalizeScenarios } from "../lib/playbookNormalizers";
import { normalizePortfolio, toNumber } from "../lib/portfolioNormalizers";
import { normalizeTransactions } from "../lib/transactionNormalizers";
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
  const transactions = normalizeTransactions(json?.transactions, prev.transactions);
  const decisions = normalizeDecisions(json?.decisions, prev.decisions);
  const scenarios = normalizeScenarios(json?.scenarios, prev.scenarios);
  const openRiskPositions = getOpenRiskPositions(portfolio);

  // Google Sheets overview is the accounting source of truth. Position rows are
  // presentation detail and must not silently replace reconciled portfolio totals.
  const portfolioValue = toNumber(json?.overview?.portfolioValue, prev.overview.portfolioValue);
  const invested = toNumber(json?.overview?.invested, prev.overview.invested);
  const fearGreedStrategyRaw = normalizeFearGreedStrategyFromApi(
    json?.fearGreedStrategy,
    prev.fearGreedStrategy,
    invested
  );
  const fearGreedStrategy = applyTransactionsToCooldown(fearGreedStrategyRaw, transactions, invested);

  return {
    ...prev,
    portfolio,
    history,
    transactions,
    decisions,
    scenarios,
    fearGreedStrategy,

    overview: buildOverviewStateFromApi({
      json,
      prev,
      portfolio,
      openRiskPositions,
      portfolioValue,
      invested,
    }),

    risk: buildRiskStateFromApi({
      json,
      prev,
      portfolio,
      openRiskPositions,
      portfolioValue,
      invested,
    }),

    updatedAt: json?.updatedAt ?? prev.updatedAt,
  };
}
