import { useEffect, useRef, useState } from "react";
import { fetchLivePrices } from "../api/prices";

const REFRESH_INTERVAL_MS = 60_000;

export type LivePricesState = {
  prices: Record<string, number>;
  isLoading: boolean;
  lastUpdatedAt: string | null;
  error: string | null;
};

export function useLivePrices(assets: string[]): LivePricesState {
  const [state, setState] = useState<LivePricesState>({
    prices: {},
    isLoading: true,
    lastUpdatedAt: null,
    error: null,
  });

  // Стабильная ссылка на список активов чтобы не перезапускать эффект при каждом рендере
  const assetsKey = assets.slice().sort().join(",");
  const assetsRef = useRef(assets);
  assetsRef.current = assets;

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const prices = await fetchLivePrices(assetsRef.current);
        if (!isMounted) return;
        setState({
          prices,
          isLoading: false,
          lastUpdatedAt: new Date().toISOString(),
          error: null,
        });
      } catch (err) {
        if (!isMounted) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : "Price fetch error",
        }));
      }
    };

    load();
    const id = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      isMounted = false;
      clearInterval(id);
    };
  }, [assetsKey]);

  return state;
}
