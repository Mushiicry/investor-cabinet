import { useEffect, useState } from "react";
import { fetchInvestorData } from "../api/investor";
import { INVESTOR_REFRESH_INTERVAL_MS } from "../config/constants";
import {
  CATEGORY_ORDER,
  calculateCategoryAllocations,
  round,
} from "../lib/portfolioCalculations";
import type { Category, PortfolioState, PositionCalculated } from "../types/portfolio";

type PortfolioApiItem = {
  asset?: unknown;
  ticker?: unknown;
  category?: unknown;
  quantity?: unknown;
  avgEntry?: unknown;
  currentPrice?: unknown;
  invested?: unknown;
  currentValue?: unknown;
  pnl?: unknown;
  pnlPct?: unknown;
  share?: unknown;
  status?: unknown;
};

const MIN_SPOT_RESERVE_SHARE = 0.3;

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toPortfolioApiItem = (item: unknown): PortfolioApiItem =>
  item && typeof item === "object" ? item as PortfolioApiItem : {};

const normalizeCategory = (category: unknown): Category => {
  if (category === "Кэш / Стейблы") return "Свободные деньги";
  if (CATEGORY_ORDER.includes(category as Category)) return category as Category;

  return "Крипта";
};

const normalizePortfolioCategory = (item: PortfolioApiItem): Category => {
  const status = String(item?.status ?? "").toUpperCase();
  const asset = String(item?.asset ?? "").toUpperCase();
  const ticker = String(item?.ticker ?? "").toUpperCase();

  if (status === "RESERVE" && (asset.includes("USDC") || asset.includes("USDT") || ticker === "USDC" || ticker === "USDT")) {
    return "Свободные деньги";
  }

  return normalizeCategory(item?.category);
};

const isClosedStatus = (status: string) =>
  ["CLOSED", "FIXED", "EXITED"].includes(status.toUpperCase());

const isReserveStatus = (status: string) =>
  ["RESERVE", "РЕЗЕРВ"].includes(status.toUpperCase());

const isFuturesCash = (item: PositionCalculated) =>
  item.category === "Свободные деньги" && item.asset.toUpperCase().includes("USDC HL");

const getOpenRiskPositions = (portfolio: PositionCalculated[]) =>
  portfolio.filter((item) => (
    item.currentValue > 0 &&
    item.category !== "Свободные деньги" &&
    !isClosedStatus(item.status) &&
    !isReserveStatus(item.status)
  ));

const pickBestPosition = (positions: PositionCalculated[]) =>
  [...positions].sort((a, b) => (b.pnlPct - a.pnlPct) || (b.pnl - a.pnl) || (b.currentValue - a.currentValue))[0];

const pickWorstPosition = (positions: PositionCalculated[]) =>
  [...positions].sort((a, b) => (a.pnlPct - b.pnlPct) || (a.pnl - b.pnl) || (b.currentValue - a.currentValue))[0];

const calculateFuturesDeployableCash = (portfolio: PositionCalculated[]) =>
  portfolio
    .filter(isFuturesCash)
    .reduce((sum, item) => sum + item.currentValue, 0);

const calculateSpotDeployableCash = (portfolio: PositionCalculated[], portfolioValue: number) => {
  const spotReserve = portfolio
    .filter((item) => item.category === "Свободные деньги" && !isFuturesCash(item))
    .reduce((sum, item) => sum + item.currentValue, 0);

  return Math.max(spotReserve - portfolioValue * MIN_SPOT_RESERVE_SHARE, 0);
};

const normalizePortfolio = (portfolio: unknown, fallback: PositionCalculated[]) => {
  if (!Array.isArray(portfolio)) return fallback;

  return portfolio
    .map((rawItem) => {
      const item = toPortfolioApiItem(rawItem);

      return {
        asset: String(item?.asset ?? ""),
        category: normalizePortfolioCategory(item),
        quantity: toNumber(item?.quantity),
        avgEntry: toNumber(item?.avgEntry),
        currentPrice: toNumber(item?.currentPrice),
        invested: toNumber(item?.invested),
        currentValue: toNumber(item?.currentValue),
        pnl: toNumber(item?.pnl),
        pnlPct: toNumber(item?.pnlPct),
        share: toNumber(item?.share),
        status: String(item?.status ?? ""),
      };
    })
    .filter((item) => item.asset && (item.currentValue > 0 || !isClosedStatus(item.status))) as PositionCalculated[];
};

const calculateShare = (portfolio: PositionCalculated[], category: Category) => {
  const total = portfolio.reduce((sum, item) => sum + item.currentValue, 0);
  const value = portfolio
    .filter((item) => item.category === category)
    .reduce((sum, item) => sum + item.currentValue, 0);

  return total ? round(value / total, 4) : 0;
};

const findPosition = (portfolio: PositionCalculated[], asset?: string) =>
  portfolio.find((item) => item.asset === asset);

export function useInvestorData(fallbackData: PortfolioState): PortfolioState {
  const [data, setData] = useState<PortfolioState>(fallbackData);

  useEffect(() => {
    let isMounted = true;

    const loadInvestorData = async () => {
      try {
        const json = await fetchInvestorData();

        if (!isMounted || !json?.success) return;

        setData((prev) => {
          const portfolio = normalizePortfolio(json?.portfolio, prev.portfolio);
          const openRiskPositions = getOpenRiskPositions(portfolio);
          const bestOpenPosition = pickBestPosition(openRiskPositions);
          const worstOpenPosition = pickWorstPosition(openRiskPositions);
          const bestAsset = json?.overview?.bestPosition?.asset ?? prev.overview.bestPosition.asset;
          const worstAsset = json?.overview?.worstPosition?.asset ?? prev.overview.worstPosition.asset;
          const bestPosition = bestOpenPosition ?? findPosition(portfolio, bestAsset);
          const worstPosition = worstOpenPosition ?? findPosition(portfolio, worstAsset);
          const portfolioValue = toNumber(json?.overview?.portfolioValue, prev.overview.portfolioValue);
          const futuresDeployableCash = calculateFuturesDeployableCash(portfolio);
          const spotDeployableCash = calculateSpotDeployableCash(portfolio, portfolioValue);

          return {
            ...prev,
            portfolio,

            overview: {
              ...prev.overview,
              invested: Number(json?.overview?.invested ?? prev.overview.invested),
              portfolioValue,
              pnl: Number(json?.overview?.pnl ?? prev.overview.pnl),
              pnlPct: Number(json?.overview?.pnlPct ?? prev.overview.pnlPct) / 100,
              reserve: Number(json?.overview?.reserve ?? prev.overview.reserve),
              positionsCount: Number(json?.overview?.positionsCount ?? prev.overview.positionsCount),
              health: Number(json?.overview?.health ?? prev.overview.health) / 100,
              state: json?.overview?.state ?? prev.overview.state,
              signal: json?.overview?.signal ?? prev.overview.signal,
              action: json?.overview?.action ?? prev.overview.action,
              categories: calculateCategoryAllocations(portfolio),
              topPositions: portfolio
                .filter((item) => (
                  item.currentValue > 0 &&
                  item.category !== "Свободные деньги" &&
                  String(item.status) !== "Reserve" &&
                  String(item.status) !== "Резерв"
                ))
                .sort((a, b) => b.currentValue - a.currentValue)
                .slice(0, 3)
                .map((item) => ({
                  asset: item.asset,
                  share: round(item.share / 100, 4),
                  value: item.currentValue,
                  status: item.status,
                })),
              bestPosition: {
                ...prev.overview.bestPosition,
                asset: bestPosition?.asset ?? bestAsset,
                pnl: bestPosition?.pnl ?? toNumber(json?.overview?.bestPosition?.pnl, prev.overview.bestPosition.pnl),
                pnlPct: bestPosition?.pnlPct ?? prev.overview.bestPosition.pnlPct,
              },
              worstPosition: {
                ...prev.overview.worstPosition,
                asset: worstPosition?.asset ?? worstAsset,
                pnl: worstPosition?.pnl ?? toNumber(json?.overview?.worstPosition?.pnl, prev.overview.worstPosition.pnl),
                pnlPct: worstPosition?.pnlPct ?? prev.overview.worstPosition.pnlPct,
              },
            },

            risk: {
              ...prev.risk,
              portfolioValue: Number(json?.risk?.portfolioValue ?? prev.risk.portfolioValue),
              reserve: Number(json?.risk?.reserve ?? prev.risk.reserve),
              reserveShare: Number(json?.risk?.reserveShare ?? prev.risk.reserveShare) / 100,
              deployableCash: Number(json?.risk?.deployableCash ?? prev.risk.deployableCash),
              futuresDeployableCash: futuresDeployableCash || Number(json?.risk?.deployableCash ?? prev.risk.futuresDeployableCash),
              spotDeployableCash,
              largestRiskAsset: json?.risk?.largestRiskAsset ?? prev.risk.largestRiskAsset,
              largestRiskShare: Number(json?.risk?.largestRiskShare ?? prev.risk.largestRiskShare) / 100,
              cryptoShare: Number(json?.risk?.cryptoShare ?? prev.risk.cryptoShare) / 100,
              stocksShare: calculateShare(portfolio, "Акции"),
              metalsShare: calculateShare(portfolio, "Металлы"),
              futuresShare: calculateShare(portfolio, "Фьючерсы"),
              cashShare: calculateShare(portfolio, "Свободные деньги"),
              health: Number(json?.risk?.health ?? prev.risk.health) / 100,
              state: json?.risk?.state ?? prev.risk.state,
              signal: json?.risk?.signal ?? prev.risk.signal,
              summary: json?.risk?.summary ?? prev.risk.summary,
            },

            updatedAt: json?.updatedAt ?? prev.updatedAt,
          };
        });
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
