import { getProfitColor } from "./uiHelpers";
import type { PositionCalculated } from "../types/portfolio";

export function getPortfolioStatusBadgeClass(status: string): string {
  const normalizedStatus = String(status).toUpperCase();

  if (normalizedStatus === "RESERVE" || status === "Резерв") {
    return "status-badge-reserve";
  }

  if (normalizedStatus === "ACCUMULATE" || status === "Накапливать") {
    return "status-badge-accumulate";
  }

  if (normalizedStatus === "WATCH" || status === "Наблюдать") {
    return "status-badge-watch";
  }

  if (normalizedStatus === "HEDGE" || status === "Хедж") {
    return "status-badge-hedge";
  }

  if (normalizedStatus === "SPECULATION" || status === "Спекуляция") {
    return "status-badge-spec";
  }

  return "status-badge-hold";
}

export function getPortfolioPnlClass(item: PositionCalculated): string {
  if (item.category === "Свободные деньги") {
    return "portfolio-pnl-neutral";
  }

  return getProfitColor(item.pnlPct) === "green"
    ? "portfolio-pnl-positive"
    : "portfolio-pnl-negative";
}
