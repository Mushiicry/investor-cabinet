import { useEffect, useState } from "react";
import { fetchFearGreedValue } from "../api/fearGreed";
import {
  FEAR_GREED_FALLBACK_VALUE,
  FEAR_GREED_REFRESH_INTERVAL_MS,
} from "../config/constants";
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

export function useFearGreed(): FearGreed {
  const [fearGreedData, setFearGreedData] = useState<FearGreed>(fearGreed);

  useEffect(() => {
    let isMounted = true;

    const loadFearGreedData = async () => {
      try {
        const value = await fetchFearGreedValue();

        if (!isMounted || value === null) return;

        const normalizedValue = Math.min(Math.max(Math.round(value), 0), 100);
        setFearGreedData(buildFearGreedData(normalizedValue));
      } catch (error) {
        console.error("FEAR GREED DATA LOAD ERROR", error);
      }
    };

    loadFearGreedData();
    const interval = setInterval(loadFearGreedData, FEAR_GREED_REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return fearGreedData;
}
