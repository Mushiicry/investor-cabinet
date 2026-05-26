import { INVESTOR_API_URL } from "../config/constants";

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
    };
    worstPosition?: {
      asset?: string;
      pnl?: unknown;
    };
  };
  portfolio?: unknown;
  risk?: {
    portfolioValue?: unknown;
    reserve?: unknown;
    reserveShare?: unknown;
    deployableCash?: unknown;
    largestRiskAsset?: string;
    largestRiskShare?: unknown;
    cryptoShare?: unknown;
    health?: unknown;
    state?: string;
    signal?: string;
    summary?: string;
  };
  updatedAt?: string;
};

export async function fetchInvestorData(): Promise<InvestorApiResponse> {
  const res = await fetch(INVESTOR_API_URL, {
    method: "GET",
    cache: "no-store",
  });

  return res.json();
}
