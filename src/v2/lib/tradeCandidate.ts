import type { InterestSignal } from "../../types/portfolio";
import type { V2Position } from "../InvestorCabinetV2Lab";
import { CRYPTO_CATEGORY } from "./preTradeGate";
import { classifySignalAction } from "./interestSignals";

export type TradeCandidateSource = "limit_order" | "manual";

export type TradeCandidate = {
  id: string;
  source: TradeCandidateSource;
  sourceId?: string;
  action: "buy" | "sell";
  asset: string;
  category: string;
  amountUsd: number;
  price: number;
  currentPrice: number;
  status: string;
  label: string;
};

export function buildTradeCandidateFromSignal(
  signal: InterestSignal,
  positions: Pick<V2Position, "asset" | "category">[],
): TradeCandidate | null {
  const action = classifySignalAction(signal.action);
  if (action === "unknown") return null;

  const asset = signal.asset.trim().toUpperCase();
  if (!asset || !Number.isFinite(signal.amountUsd) || signal.amountUsd <= 0) return null;

  const position = positions.find((p) => p.asset.trim().toUpperCase() === asset);
  const price = Number.isFinite(signal.triggerPrice) && signal.triggerPrice > 0
    ? signal.triggerPrice
    : signal.currentPrice;

  return {
    id: `limit:${signal.id}:${action}`,
    source: "limit_order",
    sourceId: signal.id,
    action,
    asset,
    category: position?.category ?? CRYPTO_CATEGORY,
    amountUsd: signal.amountUsd,
    price: Number.isFinite(price) && price > 0 ? price : 0,
    currentPrice: Number.isFinite(signal.currentPrice) ? signal.currentPrice : 0,
    status: signal.status,
    label: `${asset} · ${action === "buy" ? "покупка" : "продажа"} ${Math.round(signal.amountUsd)}$`,
  };
}
