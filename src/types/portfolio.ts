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

export type PortfolioState = {
  overview: OverviewData;
  portfolio: PositionCalculated[];
  risk: RiskData;
  decisions: Decision[];
  scenarios: ScenarioCard[];
  history: PortfolioHistoryPoint[];
  updatedAt: string;
};

export type PortfolioStateBase = Omit<PortfolioState, "overview"> & {
  overview: OverviewBaseData;
};
