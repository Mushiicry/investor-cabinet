import {
  FEAR_GREED_API_TIMEOUT_MS,
  FEAR_GREED_API_URL,
} from "../config/constants";
import { fetchJsonWithTimeout } from "../services/http";
import type { FearGreedHistoryPoint } from "../types/portfolio";

function fearGreedLabel(value: number): string {
  if (value <= 24) return "Extreme Fear";
  if (value <= 44) return "Fear";
  if (value <= 54) return "Neutral";
  if (value <= 74) return "Greed";
  return "Extreme Greed";
}

export type FearGreedApiData = {
  current: number;
  history: FearGreedHistoryPoint[];
};

export async function fetchFearGreedData(): Promise<FearGreedApiData | null> {
  const json = await fetchJsonWithTimeout(FEAR_GREED_API_URL, {
    method: "GET",
    cache: "no-store",
    timeoutMs: FEAR_GREED_API_TIMEOUT_MS,
  });

  const rawData = json && typeof json === "object" && "data" in json && Array.isArray(json.data)
    ? json.data as Array<Record<string, unknown>>
    : [];

  if (!rawData.length) return null;

  const currentValue = Number(rawData[0]?.value);
  if (!Number.isFinite(currentValue)) return null;

  // Build history from all 30 returned points
  const history: FearGreedHistoryPoint[] = rawData
    .map((item) => {
      const ts = Number(item.timestamp);
      const val = Number(item.value);
      if (!ts || !Number.isFinite(val)) return null;
      const date = new Date(ts * 1000);
      const dateStr = date.toISOString().slice(0, 10); // yyyy-mm-dd
      return {
        date: dateStr,
        value: Math.max(0, Math.min(100, Math.round(val))),
        label: String(item.value_classification ?? fearGreedLabel(val)),
        source: "alternative.me",
      };
    })
    .filter((p): p is FearGreedHistoryPoint => p !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    current: Math.max(0, Math.min(100, Math.round(currentValue))),
    history,
  };
}

// Backward-compatible single-value fetch (still used elsewhere)
export async function fetchFearGreedValue(): Promise<number | null> {
  const result = await fetchFearGreedData();
  return result?.current ?? null;
}
