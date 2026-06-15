import { normalizeHistory } from "../lib/historyNormalizers";
import { normalizeFearGreedStrategyFromApi } from "../lib/fearGreedStrategy";
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

  // Единый источник правды: totals считаем из строк позиций («Расчеты»), а не из
  // агрегатных ячеек листа (Обзор N6/N7), где фьючерсы учитывались асимметрично.
  // Фьючерсы приходят в строках по марже как «вложено»; закрытые позиции = 0 и не влияют.
  const round2 = (value: number) => Number(value.toFixed(2));
  const hasRows = portfolio.length > 0;
  const portfolioValue = hasRows
    ? round2(portfolio.reduce((sum, position) => sum + (position.currentValue || 0), 0))
    : toNumber(json?.overview?.portfolioValue, prev.overview.portfolioValue);
  const invested = hasRows
    ? round2(portfolio.reduce((sum, position) => sum + (position.invested || 0), 0))
    : toNumber(json?.overview?.invested, prev.overview.invested);
  const fearGreedStrategy = normalizeFearGreedStrategyFromApi(
    json?.fearGreedStrategy,
    prev.fearGreedStrategy,
    invested
  );

  return {
    ...prev,
    portfolio,
    history,
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
