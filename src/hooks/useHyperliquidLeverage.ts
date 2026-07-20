import { useEffect, useState } from "react";
import { fetchHyperliquidRisk, type HlPositionRisk } from "../api/prices";

const REFRESH_INTERVAL_MS = 60_000;

export type HyperliquidLeverageState = {
  leverage: Record<string, number>; // COIN (upper) → выставленное плечо
  /** COIN → плечо + цена ликвидации (для оценки близости к ликвидации). */
  risk: Record<string, HlPositionRisk>;
  isLoading: boolean;
  lastUpdatedAt: string | null;
  error: string | null;
};

// Тянет реальное выставленное плечо открытых фьючерс-позиций с Hyperliquid.
// address — публичный адрес кошелька (read-only запрос clearinghouseState).
export function useHyperliquidLeverage(address: string | undefined): HyperliquidLeverageState {
  const [state, setState] = useState<HyperliquidLeverageState>({
    leverage: {},
    risk: {},
    isLoading: !!address,
    lastUpdatedAt: null,
    error: null,
  });

  useEffect(() => {
    if (!address) {
      setState({ leverage: {}, risk: {}, isLoading: false, lastUpdatedAt: null, error: null });
      return;
    }

    let isMounted = true;

    const load = async () => {
      try {
        const risk = await fetchHyperliquidRisk(address);
        if (!isMounted) return;
        const leverage: Record<string, number> = {};
        for (const [coin, r] of Object.entries(risk)) leverage[coin] = r.leverage;
        setState({
          leverage,
          risk,
          isLoading: false,
          lastUpdatedAt: new Date().toISOString(),
          error: null,
        });
      } catch (err) {
        if (!isMounted) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : "Leverage fetch error",
        }));
      }
    };

    load();
    const id = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      isMounted = false;
      clearInterval(id);
    };
  }, [address]);

  return state;
}
