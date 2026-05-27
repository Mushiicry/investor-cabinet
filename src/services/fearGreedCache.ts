import type { FearGreed } from "../types/portfolio";

const FEAR_GREED_CACHE_KEY = "investor-cabinet:last-live-fear-greed";

type CachedFearGreedState = {
  data: FearGreed;
  cachedAt: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isSameUtcDay = (dateA: string, dateB: string) => {
  const a = new Date(dateA);
  const b = new Date(dateB);

  return (
    Number.isFinite(a.getTime()) &&
    Number.isFinite(b.getTime()) &&
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
};

const isFearGreed = (value: unknown): value is FearGreed =>
  isRecord(value) &&
  typeof value.value === "number" &&
  typeof value.label === "string" &&
  typeof value.summary === "string" &&
  typeof value.action === "string";

export function readCachedFearGreedState(now = new Date().toISOString()): CachedFearGreedState | null {
  try {
    const rawValue = window.localStorage.getItem(FEAR_GREED_CACHE_KEY);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue);
    const cachedAt = String(parsed?.cachedAt ?? "");

    if (!isRecord(parsed) || !isFearGreed(parsed.data) || !isSameUtcDay(cachedAt, now)) {
      return null;
    }

    return {
      data: parsed.data,
      cachedAt,
    };
  } catch {
    return null;
  }
}

export function writeCachedFearGreedState(data: FearGreed, cachedAt: string) {
  try {
    window.localStorage.setItem(
      FEAR_GREED_CACHE_KEY,
      JSON.stringify({ data, cachedAt })
    );
  } catch {
    // Cache is an optimization only. The live/fallback data path must keep working.
  }
}
