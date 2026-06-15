import type { PortfolioApiItem } from "../types/api";
import type { Category, PositionCalculated } from "../types/portfolio";
import { CATEGORY_ORDER } from "./portfolioCalculations";
import { isClosedStatus } from "./portfolioSelectors";

export const toNumber = (value: unknown, fallback = 0) => {
  if (value === undefined || value === null || value === "") return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const toRatio = (value: unknown, fallback = 0) => {
  if (value === undefined || value === null || value === "") return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;

  return Math.abs(parsed) > 1 ? parsed / 100 : parsed;
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

const normalizePortfolioPnlPct = (item: PortfolioApiItem) => {
  const pnlPct = toNumber(item?.pnlPct);
  const invested = toNumber(item?.invested);
  const pnl = toNumber(item?.pnl);

  if (!invested) return pnlPct;

  const moneyPct = (pnl / invested) * 100;
  if (!Number.isFinite(moneyPct)) return pnlPct;

  const isClearlyBrokenPct =
    Math.abs(pnlPct) > 500 ||
    Math.abs(pnlPct - moneyPct) > Math.max(25, Math.abs(moneyPct) * 4);

  if (isClearlyBrokenPct) return moneyPct;

  if (Math.abs(pnlPct) < 1000) return pnlPct;

  const scaledPct = pnlPct / 100;

  if (Math.abs(scaledPct) < Math.abs(pnlPct) && Math.abs(scaledPct) <= 500) {
    return scaledPct;
  }

  return moneyPct;
};

export const normalizePortfolio = (portfolio: unknown, fallback: PositionCalculated[]) => {
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
        pnlPct: normalizePortfolioPnlPct(item),
        share: toNumber(item?.share),
        status: String(item?.status ?? ""),
      };
    })
    .filter((item) => item.asset && (item.currentValue > 0 || !isClosedStatus(item.status))) as PositionCalculated[];
};
