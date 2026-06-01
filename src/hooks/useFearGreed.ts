import { useEffect, useState } from "react";
import { fetchFearGreedValue } from "../api/fearGreed";
import {
  FEAR_GREED_FALLBACK_VALUE,
  FEAR_GREED_REFRESH_INTERVAL_MS,
} from "../config/constants";
import {
  readCachedFearGreedState,
  writeCachedFearGreedState,
} from "../services/fearGreedCache";
import type { DataLoadState } from "../types/dataStatus";
import type { FearGreed } from "../types/portfolio";

const fearGreed: FearGreed = {
  value: FEAR_GREED_FALLBACK_VALUE,
  label: "Страх",
  summary: "Рынок находится в зоне страха. Индекс используем как фильтр эмоций, а не как отдельный сигнал к действию.",
  action: "Ниже 20 - сигнал на покупку x1. Ниже 15 - сигнал на покупку x1,5. Ниже 10 - сигнал на откуп x2.",
};

function getFearGreedLabel(value: number): string {
  if (value <= 24) return "Экстремальный страх";
  if (value <= 44) return "Страх";
  if (value <= 54) return "Нейтрально";
  if (value <= 74) return "Жадность";
  return "Крайняя жадность";
}

function buildFearGreedData(value: number): FearGreed {
  const label = getFearGreedLabel(value);

  return {
    ...fearGreed,
    value,
    label,
    summary: `Текущее состояние рынка: ${label}. Используем индекс как фильтр эмоций, а не как отдельный сигнал к действию.`,
  };
}

export type FearGreedDataSource = "cache" | "fallback" | "live";

export type FearGreedDataResult = DataLoadState<FearGreed> & {
  source: FearGreedDataSource;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown fear greed data error";

export function useFearGreed(): FearGreedDataResult {
  const [state, setState] = useState<FearGreedDataResult>(() => {
    const cachedFearGreedState = readCachedFearGreedState();

    return {
      data: cachedFearGreedState?.data ?? fearGreed,
      isLoading: true,
      isRefreshing: Boolean(cachedFearGreedState),
      status: cachedFearGreedState ? "refreshing" : "initial-loading",
      error: null,
      lastLoadedAt: cachedFearGreedState?.cachedAt ?? null,
      source: cachedFearGreedState ? "cache" : "fallback",
    };
  });

  useEffect(() => {
    let isMounted = true;

    const loadFearGreedData = async () => {
      setState((prev) => ({
        ...prev,
        isLoading: prev.source === "fallback" && !prev.lastLoadedAt,
        isRefreshing: prev.source !== "fallback" || Boolean(prev.lastLoadedAt),
        status: prev.source === "fallback" && !prev.lastLoadedAt ? "initial-loading" : "refreshing",
      }));

      try {
        const value = await fetchFearGreedValue();

        if (!isMounted) return;

        if (value === null) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isRefreshing: false,
            status: prev.source === "fallback" ? "error" : "stale",
            error: "Fear & Greed API response is invalid",
          }));
          return;
        }

        const normalizedValue = Math.min(Math.max(Math.round(value), 0), 100);
        const loadedAt = new Date().toISOString();
        const data = buildFearGreedData(normalizedValue);

        writeCachedFearGreedState(data, loadedAt);

        setState({
          data,
          isLoading: false,
          isRefreshing: false,
          status: "ready",
          error: null,
          lastLoadedAt: loadedAt,
          source: "live",
        });
      } catch (error) {
        console.error("FEAR GREED DATA LOAD ERROR", error);
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

    loadFearGreedData();
    const interval = setInterval(loadFearGreedData, FEAR_GREED_REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return state;
}
