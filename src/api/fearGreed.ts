import {
  FEAR_GREED_API_TIMEOUT_MS,
  FEAR_GREED_API_URL,
} from "../config/constants";
import { fetchJsonWithTimeout } from "../services/http";

export async function fetchFearGreedValue(): Promise<number | null> {
  const json = await fetchJsonWithTimeout(FEAR_GREED_API_URL, {
    method: "GET",
    cache: "no-store",
    timeoutMs: FEAR_GREED_API_TIMEOUT_MS,
  });
  const data = json && typeof json === "object" && "data" in json
    ? json.data
    : undefined;
  const firstItem = Array.isArray(data) ? data[0] : undefined;
  const value = firstItem && typeof firstItem === "object" && "value" in firstItem
    ? Number(firstItem.value)
    : NaN;

  return Number.isFinite(value) ? value : null;
}
