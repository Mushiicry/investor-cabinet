import type { InvestorDNA } from "../v2/lib/investorDNA";

export type Category =
  | "Крипта"
  | "Металлы"
  | "Фьючерсы"
  | "Акции"
  | "Свободные деньги";

export type PositionStatus =
  | "Накапливать"
  | "Наблюдать"
  | "Хедж"
  | "Спекуляция"
  | "Держать"
  | "Резерв";

export type Page =
  | "Обзор"
  | "Портфель"
  | "Риск"
  | "Сценарии и решения"
  | "Вход";

export type PositionInput = {
  asset: string;
  category: Category;
  quantity: number;
  avgEntry: number;
  currentPrice: number;
  status: PositionStatus;
};

export type PositionCalculated = PositionInput & {
  invested: number;
  currentValue: number;
  pnl: number;
  pnlPct: number;
  share: number;
};

export type CategoryAllocation = {
  name: Category;
  value: number;
  share: number;
};

export type OverviewPosition = {
  asset: string;
  share: number;
  value: number;
  status: string;
};

export type OverviewPerformancePosition = {
  asset: string;
  pnl: number;
  pnlPct: number;
};

export type OverviewData = {
  portfolioValue: number;
  invested: number;
  pnl: number;
  pnlPct: number;
  reserve: number;
  positionsCount: number;
  health: number;
  /** Реализованный профит по закрытым позициям (Расчеты O:U), $ и доля 0..1. */
  realizedPnl?: number;
  realizedPnlPct?: number;
  state: string;
  signal: string;
  action: string;
  topPositions: OverviewPosition[];
  bestPosition: OverviewPerformancePosition;
  worstPosition: OverviewPerformancePosition;
  categories: CategoryAllocation[];
};

export type OverviewBaseData = Omit<OverviewData, "bestPosition" | "worstPosition">;

export type RiskData = {
  portfolioValue: number;
  reserve: number;
  reserveShare: number;
  deployableCash: number;
  futuresDeployableCash: number;
  spotDeployableCash: number;
  largestRiskAsset: string;
  largestRiskShare: number;
  cryptoShare: number;
  stocksShare: number;
  metalsShare: number;
  futuresShare: number;
  cashShare: number;
  health: number;
  state: string;
  signal: string;
  summary: string;
  warnings: RiskWarning[];
};

export type RiskWarning = {
  code: "CRYPTO_OVEREXPOSURE" | "FUTURES_OVEREXPOSURE" | "SINGLE_ASSET_CONCENTRATION";
  level: "watch" | "high";
  message: string;
};

export type Decision = {
  asset: string;
  thesis: string;
  whyHold: string;
  expect: string;
  nextAction: string;
  reviewTrigger: string;
  status: string;
};

export type ScenarioCard = {
  asset: string;
  base: string;
  bull: string;
  bear: string;
  action: string;
  invalidation: string;
  status: string;
};

export type Position = PositionCalculated;
export type Scenario = ScenarioCard;
export type Overview = OverviewData;
export type Risk = RiskData;

export type FearGreed = {
  value: number;
  label: string;
  summary: string;
  action: string;
};

export type FearGreedMode = "observation" | "cautious" | "strong" | "aggressive";

export type FearGreedStrategyStatus = "passive" | "active" | "cooldown";

export type FearGreedStrategyRule = {
  mode: FearGreedMode;
  range: string;
  label: string;
  buyPct: number;
  buyAmount: number;
  cooldownDays: number;
  lastBuyAt: string | null;
  nextAvailableAt: string | null;
  isCurrent: boolean;
  isAvailable: boolean;
  cooldownRemainingHours: number;
  status: FearGreedStrategyStatus;
};

export type FearGreedStrategyLastBuy = {
  mode: FearGreedMode;
  range: string;
  label: string;
  asset: string;
  assetPrice: number;
  buyAmount: number;
  boughtAt: string;
};

export type FearGreedHistoryPoint = {
  date: string;
  value: number;
  label: string;
  source: string;
};

export type FearGreedStrategy = {
  currentIndex: number;
  currentMode: FearGreedMode;
  portfolioValue: number;
  lastBuy: FearGreedStrategyLastBuy | null;
  strategyBuys: FearGreedStrategyLastBuy[];
  history: FearGreedHistoryPoint[];
  rules: FearGreedStrategyRule[];
};

export type InvestorTransaction = {
  id: string;
  status: string;
  date: string;
  asset: string;
  category: string;
  action: string;
  quantity: number;
  price: number;
  amount: number;
  comment: string;
  walletId: string;
  chain: string;
  hash: string;
  direction: string;
  counterparty: string;
  rawAsset: string;
  rawAmount: number;
  note: string;
};

export type PortfolioHistoryPoint = {
  date: string;
  portfolioValue: number;
  invested: number;
  pnl: number;
  pnlPct: number;
  reserve: number;
  positionsCount: number;
  pointType: string;
  note: string;
  trigger: string;
  source: string;
  comment: string;
};

export type InterestSignal = {
  id: string;
  asset: string;
  action: string;
  amountUsd: number;
  triggerPrice: number;
  source: string;
  currentPrice: number;
  status: string;
  lastCheck: string;
  triggeredAt: string;
  telegram: string;
  comment: string;
};

export type AssetQualityRecord = {
  asset: string;
  cmcRank: number | null;
  binanceMonitoring: boolean;
  updatedAt?: string;
  source?: string;
};

export type AssetQualitySource = {
  records: AssetQualityRecord[];
  connected: boolean;
  cmcTop100Connected?: boolean;
  binanceMonitoringConnected?: boolean;
  updatedAt?: string;
  source?: string;
};

export type PortfolioState = {
  overview: OverviewData;
  portfolio: PositionCalculated[];
  risk: RiskData;
  decisions: Decision[];
  scenarios: ScenarioCard[];
  history: PortfolioHistoryPoint[];
  transactions: InvestorTransaction[];
  signals: {
    interest: InterestSignal | null;
    interestList: InterestSignal[];
  };
  fearGreedStrategy: FearGreedStrategy;
  assetQuality: AssetQualitySource;
  investorDNA?: InvestorDNA;
  updatedAt: string;
};

export type PortfolioStateBase = Omit<PortfolioState, "overview"> & {
  overview: OverviewBaseData;
};
