export type PortfolioApiItem = {
  asset?: unknown;
  ticker?: unknown;
  category?: unknown;
  quantity?: unknown;
  avgEntry?: unknown;
  currentPrice?: unknown;
  invested?: unknown;
  currentValue?: unknown;
  pnl?: unknown;
  pnlPct?: unknown;
  share?: unknown;
  status?: unknown;
};

export type InvestorApiResponse = {
  success?: boolean;
  overview?: {
    invested?: unknown;
    portfolioValue?: unknown;
    pnl?: unknown;
    pnlPct?: unknown;
    reserve?: unknown;
    positionsCount?: unknown;
    health?: unknown;
    state?: string;
    signal?: string;
    action?: string;
    bestPosition?: {
      asset?: string;
      pnl?: unknown;
      pnlPct?: unknown;
    };
    worstPosition?: {
      asset?: string;
      pnl?: unknown;
      pnlPct?: unknown;
    };
  };
  portfolio?: unknown;
  history?: unknown;
  risk?: {
    portfolioValue?: unknown;
    reserve?: unknown;
    reserveShare?: unknown;
    deployableCash?: unknown;
    futuresDeployableCash?: unknown;
    spotDeployableCash?: unknown;
    largestRiskAsset?: string;
    largestRiskShare?: unknown;
    cryptoShare?: unknown;
    health?: unknown;
    state?: string;
    signal?: string;
    summary?: string;
  };
  decisions?: unknown;
  scenarios?: unknown;
  updatedAt?: string;
};
