import { useEffect, useState } from "react";
import { fetchInvestorData } from "../api/investor";
import { INVESTOR_REFRESH_INTERVAL_MS } from "../config/constants";
import type { PortfolioState } from "../types/portfolio";

export function useInvestorData(fallbackData: PortfolioState): PortfolioState {
  const [data, setData] = useState<PortfolioState>(fallbackData);

  useEffect(() => {
    let isMounted = true;

    const loadInvestorData = async () => {
      try {
        const json = await fetchInvestorData();

        if (!isMounted || !json?.success) return;

        setData((prev) => ({
          ...prev,

          overview: {
            ...prev.overview,
            invested: Number(json?.overview?.invested ?? prev.overview.invested),
            portfolioValue: Number(json?.overview?.portfolioValue ?? prev.overview.portfolioValue),
            pnl: Number(json?.overview?.pnl ?? prev.overview.pnl),
            pnlPct: Number(json?.overview?.pnlPct ?? prev.overview.pnlPct) / 100,
            reserve: Number(json?.overview?.reserve ?? prev.overview.reserve),
            positionsCount: Number(json?.overview?.positionsCount ?? prev.overview.positionsCount),
            health: Number(json?.overview?.health ?? prev.overview.health) / 100,
            state: json?.overview?.state ?? prev.overview.state,
            signal: json?.overview?.signal ?? prev.overview.signal,
            action: json?.overview?.action ?? prev.overview.action,
            bestPosition: {
              ...prev.overview.bestPosition,
              asset: json?.overview?.bestPosition?.asset ?? prev.overview.bestPosition.asset,
              pnl: Number(json?.overview?.bestPosition?.pnl ?? prev.overview.bestPosition.pnl),
            },
            worstPosition: {
              ...prev.overview.worstPosition,
              asset: json?.overview?.worstPosition?.asset ?? prev.overview.worstPosition.asset,
              pnl: Number(json?.overview?.worstPosition?.pnl ?? prev.overview.worstPosition.pnl),
            },
          },

          risk: {
            ...prev.risk,
            portfolioValue: Number(json?.risk?.portfolioValue ?? prev.risk.portfolioValue),
            reserve: Number(json?.risk?.reserve ?? prev.risk.reserve),
            reserveShare: Number(json?.risk?.reserveShare ?? prev.risk.reserveShare) / 100,
            deployableCash: Number(json?.risk?.deployableCash ?? prev.risk.deployableCash),
            largestRiskAsset: json?.risk?.largestRiskAsset ?? prev.risk.largestRiskAsset,
            largestRiskShare: Number(json?.risk?.largestRiskShare ?? prev.risk.largestRiskShare) / 100,
            cryptoShare: Number(json?.risk?.cryptoShare ?? prev.risk.cryptoShare) / 100,
            health: Number(json?.risk?.health ?? prev.risk.health) / 100,
            state: json?.risk?.state ?? prev.risk.state,
            signal: json?.risk?.signal ?? prev.risk.signal,
            summary: json?.risk?.summary ?? prev.risk.summary,
          },

          updatedAt: json?.updatedAt ?? prev.updatedAt,
        }));
      } catch (error) {
        console.error("INVESTOR DATA LOAD ERROR", error);
      }
    };

    loadInvestorData();
    const interval = setInterval(loadInvestorData, INVESTOR_REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return data;
}
