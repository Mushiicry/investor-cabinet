import { useEffect, useState } from "react";
import { fetchInvestorData } from "../api/investor";
import { INVESTOR_API_URL, INVESTOR_REFRESH_INTERVAL_MS } from "../config/constants";
import { validateInvestorApiPayload } from "../services/apiValidation";
import {
  readCachedInvestorState,
  writeCachedInvestorState,
} from "../services/investorDataCache";
import { buildInvestorStateFromApi } from "../services/investorState";
import { maybeRecordSnapshot } from "../services/dailySnapshotService";
import type { DataLoadState } from "../types/dataStatus";
import type { PortfolioState } from "../types/portfolio";

export type InvestorDataSource = "cache" | "fallback" | "live";

export type InvestorDataResult = DataLoadState<PortfolioState> & {
  source: InvestorDataSource;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown investor data error";

export function useInvestorData(
  fallbackData: PortfolioState,
  apiUrl: string = INVESTOR_API_URL,
  cacheSlot?: "wife"
): InvestorDataResult {
  const [state, setState] = useState<InvestorDataResult>(() => {
    const cachedInvestorState = readCachedInvestorState(cacheSlot);

    return {
      data: cachedInvestorState?.data ?? fallbackData,
      isLoading: true,
      isRefreshing: Boolean(cachedInvestorState),
      status: cachedInvestorState ? "refreshing" : "initial-loading",
      error: null,
      lastLoadedAt: cachedInvestorState?.cachedAt ?? null,
      source: cachedInvestorState ? "cache" : "fallback",
    };
  });

  useEffect(() => {
    let isMounted = true;

    const loadInvestorData = async () => {
      setState((prev) => ({
        ...prev,
        isLoading: prev.source === "fallback" && !prev.lastLoadedAt,
        isRefreshing: prev.source !== "fallback" || Boolean(prev.lastLoadedAt),
        status: prev.source === "fallback" && !prev.lastLoadedAt ? "initial-loading" : "refreshing",
      }));

      try {
        const validation = validateInvestorApiPayload(await fetchInvestorData(apiUrl));

        if (!isMounted) return;

        if (!validation.ok) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isRefreshing: false,
            status: prev.source === "fallback" ? "error" : "stale",
            error: `Investor API response is invalid: ${validation.error}`,
          }));
          return;
        }

        const json = validation.data;

        if (!json.success) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isRefreshing: false,
            status: prev.source === "fallback" ? "error" : "stale",
            error: "Investor API response is unsuccessful",
          }));
          return;
        }

        setState((prev) => {
          const loadedAt = new Date().toISOString();
          const data = buildInvestorStateFromApi(json, prev.data);

          // Daily auto-snapshot for both accounts (separate storage slots)
          maybeRecordSnapshot({
            portfolioValue: data.overview.portfolioValue,
            invested: data.overview.invested,
            reserve: data.overview.reserve,
            positionsCount: data.portfolio.length,
            slot: cacheSlot === "wife" ? "wife" : "main",
          });

          writeCachedInvestorState(data, loadedAt, cacheSlot);

          return {
            data,
            isLoading: false,
            isRefreshing: false,
            status: "ready",
            error: null,
            lastLoadedAt: loadedAt,
            source: "live",
          };
        });
      } catch (error) {
        console.error("INVESTOR DATA LOAD ERROR", error);
        if (!isMounted) return;

        setState((prev) => ({
          ...prev,
          isLoading: false,
          isRefreshing: false,
          status: prev.source === "fallback" ? "error" : "stale",
          error: getErrorMessage(error),
        }));
      }
    };

    loadInvestorData();
    const interval = setInterval(loadInvestorData, INVESTOR_REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [apiUrl, cacheSlot]);

  return state;
}
