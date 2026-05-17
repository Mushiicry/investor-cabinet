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
  | "Решения"
  | "Сценарии"
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

export type Overview = {
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
  topPositions: Array<{
    asset: string;
    share: number;
    value: number;
    status: string;
  }>;
  categories: CategoryAllocation[];
};

export type Risk = {
  portfolioValue: number;
  reserve: number;
  reserveShare: number;
  deployableCash: number;
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

export type PortfolioState = {
  overview: Overview;
  portfolio: PositionCalculated[];
  risk: Risk;
  decisions: Decision[];
  scenarios: ScenarioCard[];
  updatedAt: string;
};