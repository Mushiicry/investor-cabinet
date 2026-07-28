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
import { mergeServerMaxLevel } from "../v2/lib/levelProgress";
import type { DataLoadState } from "../types/dataStatus";
import type { PortfolioState } from "../types/portfolio";

export type InvestorDataSource = "cache" | "fallback" | "live";

export type InvestorDataResult = DataLoadState<PortfolioState> & {
  source: InvestorDataSource;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown investor data error";

const buildInitialInvestorDataState = (
  fallbackData: PortfolioState,
  cacheSlot: "wife" | undefined,
  allowCache: boolean,
): InvestorDataResult => {
  if (!allowCache) {
    return {
      data: fallbackData,
      isLoading: true,
      isRefreshing: false,
      status: "initial-loading",
      error: null,
      lastLoadedAt: null,
      source: "fallback",
    };
  }

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
};

export function useInvestorData(
  fallbackData: PortfolioState,
  apiUrl: string = INVESTOR_API_URL,
  cacheSlot?: "wife",
  enabled = true,
): InvestorDataResult {
  const [state, setState] = useState<InvestorDataResult>(() =>
    buildInitialInvestorDataState(fallbackData, cacheSlot, enabled)
  );

  useEffect(() => {
    let isMounted = true;

    if (!enabled) {
      setState(buildInitialInvestorDataState(fallbackData, cacheSlot, false));
      return () => {
        isMounted = false;
      };
    }

    setState(buildInitialInvestorDataState(fallbackData, cacheSlot, true));

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

        // Достигнутый уровень лестницы с сервера → в локальный кэш (монотонно).
        // Только основной аккаунт: у жены своя таблица и своя лестница.
        if (cacheSlot !== "wife") {
          mergeServerMaxLevel(json.progress?.maxLevel);
        }

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

          // Daily auto-snapshot — only main account here; wife snapshot happens
          // in the V2 shell after Apps Script/API has assembled live portfolio data.
          if (cacheSlot !== "wife") {
            const nonStable = data.portfolio.filter(
              (p) => p.category !== "Свободные деньги"
            );
            maybeRecordSnapshot({
              portfolioValue: data.overview.portfolioValue,
              invested: data.overview.invested,
              reserve: data.overview.reserve,
              positionsCount: nonStable.length,
              slot: "main",
            });
          }

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
        // Отмена запроса — штатное событие (размонтирование, повторная загрузка,
        // таймаут перед ретраем). Логировать её как ошибку значит зашумлять
        // консоль и маскировать настоящие сбои.
        const aborted = error instanceof DOMException && error.name === "AbortError";
        if (!aborted) console.error("INVESTOR DATA LOAD ERROR", error);
        if (!isMounted) return;
        if (aborted) return;

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
  }, [apiUrl, cacheSlot, enabled, fallbackData]);

  return state;
}
