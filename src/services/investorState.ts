import { normalizeHistory } from "../lib/historyNormalizers";
import { normalizeFearGreedStrategyFromApi, applyTransactionsToCooldown } from "../lib/fearGreedStrategy";
import { normalizeDecisions, normalizeScenarios } from "../lib/playbookNormalizers";
import { normalizePortfolio, toNumber } from "../lib/portfolioNormalizers";
import { normalizeTransactions } from "../lib/transactionNormalizers";
import { getOpenRiskPositions } from "../lib/portfolioSelectors";
import type { InvestorApiResponse } from "../types/api";
import type { InterestSignal, PortfolioState } from "../types/portfolio";
import {
  buildOverviewStateFromApi,
  buildRiskStateFromApi,
} from "./investorStateSections";

const toText = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const normalizeInterestSignal = (
  value: unknown,
  fallback: InterestSignal | null
): InterestSignal | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;

  const source = value as NonNullable<InvestorApiResponse["signals"]>["interest"];
  if (!source || typeof source !== "object" || Array.isArray(source)) return fallback;

  const asset = toText(source.asset);
  if (!asset) return fallback;

  return {
    id: toText(source.id),
    asset,
    action: toText(source.action),
    amountUsd: toNumber(source.amountUsd, fallback?.amountUsd ?? 0),
    triggerPrice: toNumber(source.triggerPrice, fallback?.triggerPrice ?? 0),
    source: toText(source.source),
    currentPrice: toNumber(source.currentPrice, fallback?.currentPrice ?? 0),
    status: toText(source.status),
    lastCheck: toText(source.lastCheck),
    triggeredAt: toText(source.triggeredAt),
    telegram: toText(source.telegram),
    comment: toText(source.comment),
  };
};

const normalizeInterestSignals = (
  value: unknown,
  fallback: InterestSignal[]
): InterestSignal[] => {
  if (!Array.isArray(value)) return fallback;

  return value
    .map((item) => normalizeInterestSignal(item, null))
    .filter((item): item is InterestSignal => item !== null);
};

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
    signals: {
      interest: normalizeInterestSignal(json.signals?.interest, prev.signals?.interest ?? null),
      interestList: normalizeInterestSignals(
        json.signals?.interestList,
        prev.signals?.interestList ?? []
      ),
    },

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
