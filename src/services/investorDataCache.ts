import type { PortfolioState } from "../types/portfolio";
import { buildFearGreedStrategy } from "../lib/fearGreedStrategy";

const INVESTOR_DATA_CACHE_KEY = "investor-cabinet:last-live-investor-state";

type CachedInvestorState = {
  data: PortfolioState;
  cachedAt: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeCachedPortfolioState = (value: unknown): PortfolioState | null => {
  if (!isRecord(value)) return null;

  if (
    isRecord(value.overview) &&
    Array.isArray(value.portfolio) &&
    isRecord(value.risk) &&
    Array.isArray(value.decisions) &&
    Array.isArray(value.scenarios)
  ) {
    const cachedState = value as PortfolioState;
    const portfolioValue = Number(cachedState.overview?.portfolioValue ?? 0);
    const invested = Number(cachedState.overview?.invested ?? 0);
    const apiPnl = Number(cachedState.overview?.pnl ?? 0);
    const pnl = Number.isFinite(portfolioValue) && Number.isFinite(invested) && invested
      ? portfolioValue - invested
      : apiPnl;
    const pnlPct = Number.isFinite(invested) && Number.isFinite(pnl) && invested
      ? pnl / invested
      : cachedState.overview.pnlPct;

    return {
      ...cachedState,
      overview: {
        ...cachedState.overview,
        pnl,
        pnlPct,
      },
      history: Array.isArray(value.history) ? value.history : [],
      fearGreedStrategy: cachedState.fearGreedStrategy ?? buildFearGreedStrategy(50, cachedState.overview.invested),
    };
  }

  return null;
};

export function readCachedInvestorState(): CachedInvestorState | null {
  try {
    const rawValue = window.localStorage.getItem(INVESTOR_DATA_CACHE_KEY);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue);
    const data = isRecord(parsed) ? normalizeCachedPortfolioState(parsed.data) : null;
    if (!data) return null;

    return {
      data,
      cachedAt: String(parsed.cachedAt ?? data.updatedAt ?? ""),
    };
  } catch {
    return null;
  }
}

export function writeCachedInvestorState(data: PortfolioState, cachedAt: string) {
  try {
    window.localStorage.setItem(
      INVESTOR_DATA_CACHE_KEY,
      JSON.stringify({ data, cachedAt })
    );
  } catch {
    // Cache is an optimization only. The live/fallback data path must keep working.
  }
}
