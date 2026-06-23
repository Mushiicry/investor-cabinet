import type { InvestorTransaction } from "../types/portfolio";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const text = (value: unknown) => typeof value === "string" ? value : String(value ?? "");

const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeTransaction = (value: unknown): InvestorTransaction | null => {
  if (!isRecord(value)) return null;

  const id = text(value.id);
  const hash = text(value.hash);
  if (!id && !hash) return null;

  return {
    id,
    status: text(value.status),
    date: text(value.date),
    asset: text(value.asset),
    category: text(value.category),
    action: text(value.action),
    quantity: number(value.quantity),
    price: number(value.price),
    amount: number(value.amount),
    comment: text(value.comment),
    walletId: text(value.walletId),
    chain: text(value.chain),
    hash,
    direction: text(value.direction),
    counterparty: text(value.counterparty),
    rawAsset: text(value.rawAsset),
    rawAmount: number(value.rawAmount),
    note: text(value.note),
  };
};

export function normalizeTransactions(
  value: unknown,
  fallback: InvestorTransaction[] = [],
): InvestorTransaction[] {
  if (!Array.isArray(value)) return fallback;

  return value
    .map(normalizeTransaction)
    .filter((transaction): transaction is InvestorTransaction => Boolean(transaction))
    .sort((a, b) => {
      const aTime = Date.parse(a.date);
      const bTime = Date.parse(b.date);
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    });
}
