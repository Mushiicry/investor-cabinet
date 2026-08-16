import { normalizeHistory } from "../lib/historyNormalizers";
import { normalizeFearGreedStrategyFromApi, applyTransactionsToCooldown } from "../lib/fearGreedStrategy";
import { normalizeDecisions, normalizeScenarios } from "../lib/playbookNormalizers";
import { normalizePortfolio, toNumber } from "../lib/portfolioNormalizers";
import { normalizeTransactions } from "../lib/transactionNormalizers";
import { getOpenRiskPositions } from "../lib/portfolioSelectors";
import { dnaForSlot, normalizeInvestorDNAFromApi } from "../v2/lib/investorDNA";
import type { AssetQualityApiItem, InvestorApiResponse } from "../types/api";
import type { AssetQualityRecord, AssetQualitySource, InterestSignal, PortfolioState } from "../types/portfolio";
import {
  buildOverviewStateFromApi,
  buildRiskStateFromApi,
} from "./investorStateSections";

const toText = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const toBoolean = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "yes", "1", "да", "истина"].includes(normalized)) return true;
  if (["false", "no", "0", "нет", "ложь"].includes(normalized)) return false;
  return fallback;
};

const emptyAssetQuality: AssetQualitySource = {
  connected: false,
  records: [],
  cmcTop100Connected: false,
  binanceMonitoringConnected: false,
};

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

const normalizeAssetQualityRecord = (value: unknown): AssetQualityRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const source = value as AssetQualityApiItem;
  const asset = toText(source.asset).trim().toUpperCase();
  if (!asset) return null;

  const rawRank = source.cmcRank;
  const cmcRank = rawRank === null || rawRank === undefined || rawRank === ""
    ? null
    : toNumber(rawRank, 0);

  return {
    asset,
    cmcRank: cmcRank && cmcRank > 0 ? cmcRank : null,
    binanceMonitoring: toBoolean(source.binanceMonitoring),
    updatedAt: toText(source.updatedAt),
    source: toText(source.source),
  };
};

const normalizeAssetQuality = (
  value: InvestorApiResponse["assetQuality"],
  fallback?: AssetQualitySource,
): AssetQualitySource => {
  const safeFallback = fallback ?? emptyAssetQuality;
  if (!value || typeof value !== "object" || Array.isArray(value)) return safeFallback;

  const records = Array.isArray(value.records)
    ? value.records
        .map((item) => normalizeAssetQualityRecord(item))
        .filter((item): item is AssetQualityRecord => item !== null)
    : safeFallback.records;
  const hasTop100 = records.some((item) => item.cmcRank !== null && item.cmcRank <= 100);
  const hasMonitoring = records.some((item) => item.binanceMonitoring);

  return {
    records,
    connected: toBoolean(value.connected, records.length > 0),
    cmcTop100Connected: toBoolean(value.cmcTop100Connected, hasTop100),
    binanceMonitoringConnected: toBoolean(value.binanceMonitoringConnected, hasMonitoring),
    updatedAt: toText(value.updatedAt, safeFallback.updatedAt),
    source: toText(value.source, safeFallback.source),
  };
};

export function buildInvestorStateFromApi(json: InvestorApiResponse, prev: PortfolioState): PortfolioState {
  const portfolio = normalizePortfolio(json?.portfolio, prev.portfolio);
  const history = normalizeHistory(json?.history, prev.history);
  const transactions = normalizeTransactions(json?.transactions, prev.transactions);
  const decisions = normalizeDecisions(json?.decisions, prev.decisions);
  const scenarios = normalizeScenarios(json?.scenarios, prev.scenarios);
  const assetQuality = normalizeAssetQuality(json?.assetQuality, prev.assetQuality);
  const dnaAccountId = json?.investorDNA && typeof json.investorDNA === "object"
    ? (json.investorDNA as { accountId?: unknown }).accountId as string | undefined
    : prev.investorDNA?.accountId;
  const currentDnaSeed = dnaForSlot(dnaAccountId);
  const investorDNA = normalizeInvestorDNAFromApi(
    json?.investorDNA,
    {
      ...currentDnaSeed,
      answers: prev.investorDNA?.answers ?? currentDnaSeed.answers,
      auditHistory: prev.investorDNA?.auditHistory ?? currentDnaSeed.auditHistory,
    },
  );
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
    assetQuality,
    investorDNA,
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
