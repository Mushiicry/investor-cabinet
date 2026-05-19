import { FEAR_GREED_API_URL } from "../config/constants";

export async function fetchFearGreedValue(): Promise<number | null> {
  const res = await fetch(FEAR_GREED_API_URL, {
    method: "GET",
    cache: "no-store",
  });

  const json: { data?: Array<{ value?: string | number }> } = await res.json();
  const value = Number(json?.data?.[0]?.value);

  return Number.isFinite(value) ? value : null;
}
