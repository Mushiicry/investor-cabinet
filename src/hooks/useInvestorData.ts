import { useEffect, useState } from "react";
import { fetchInvestorData } from "../api/investor";
import { INVESTOR_REFRESH_INTERVAL_MS } from "../config/constants";
import { validateInvestorApiResponse } from "../services/apiValidation";
import {
  readCachedInvestorState,
  writeCachedInvestorState,
} from "../services/investorDataCache";
import { buildInvestorStateFromApi } from "../services/investorState";
import type { DataLoadState } from "../types/dataStatus";
import type { PortfolioState } from "../types/portfolio";

export type InvestorDataSource = "cache" | "fallback" | "live";

export type InvestorDataResult = DataLoadState<PortfolioState> & {
  source: InvestorDataSource;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown investor data error";

export function useInvestorData(fallbackData: PortfolioState): InvestorDataResult {
  const [state, setState] = useState<InvestorDataResult>(() => {
    const cachedInvestorState = readCachedInvestorState();

    return {
      data: cachedInvestorState?.data ?? fallbackData,
      isLoading: true,
      error: null,
      lastLoadedAt: cachedInvestorState?.cachedAt ?? null,
      source: cachedInvestorState ? "cache" : "fallback",
    };
  });

  useEffect(() => {
    let isMounted = true;

    const loadInvestorData = async () => {
      try {
        const json = validateInvestorApiResponse(await fetchInvestorData());

        if (!isMounted) return;

        if (!json?.success) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: "Investor API response is invalid or unsuccessful",
          }));
          return;
        }

        setState((prev) => {
          const loadedAt = new Date().toISOString();
          const data = buildInvestorStateFromApi(json, prev.data);

          writeCachedInvestorState(data, loadedAt);

          return {
            data,
            isLoading: false,
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
  }, []);

  return state;
}
