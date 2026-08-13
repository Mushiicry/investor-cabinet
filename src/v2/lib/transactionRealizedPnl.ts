import type { InvestorTransaction } from "../../types/portfolio";

export type TransactionRealizedPnl = {
  realizedPnl: number;
  proceeds: number;
  costBasisSold: number;
  avgEntry: number;
  source: "api-note" | "journal";
};

type LotState = {
  quantity: number;
  costBasis: number;
};

const EPSILON = 0.00000001;

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedAction(transaction: InvestorTransaction) {
  return (transaction.action || "").toLowerCase();
}

function assetKey(transaction: InvestorTransaction) {
  return (transaction.asset || transaction.rawAsset || "").trim().toUpperCase();
}

function transactionQuantity(transaction: InvestorTransaction) {
  return Math.abs(numeric(transaction.quantity || transaction.rawAmount));
}

function transactionAmount(transaction: InvestorTransaction) {
  const amount = Math.abs(numeric(transaction.amount));
  if (amount) return amount;

  const quantity = transactionQuantity(transaction);
  const price = Math.abs(numeric(transaction.price));
  return quantity && price ? quantity * price : 0;
}

function isBuy(transaction: InvestorTransaction) {
  const action = normalizedAction(transaction);
  return action.includes("покуп") || action.includes("buy");
}

function isSell(transaction: InvestorTransaction) {
  const action = normalizedAction(transaction);
  return action.includes("прод") || action.includes("sell");
}

function noteNumber(note: string, key: string) {
  const match = new RegExp(`${key}\\s*(?:=|:)?\\s*([-+]?\\d+(?:[.,]\\d+)?)`, "i").exec(note);
  if (!match) return null;

  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function resultFromAccountingNote(transaction: InvestorTransaction): TransactionRealizedPnl | null {
  const note = transaction.note || transaction.comment || "";
  const realizedPnl = noteNumber(note, "realizedPnL");
  if (realizedPnl == null) return null;

  const quantity = transactionQuantity(transaction);
  const proceeds = transactionAmount(transaction);
  const avgEntry = noteNumber(note, "avgEntry") ?? (quantity ? (proceeds - realizedPnl) / quantity : 0);
  const costBasisSold = noteNumber(note, "costBasisSold") ?? proceeds - realizedPnl;

  return {
    realizedPnl,
    proceeds,
    costBasisSold,
    avgEntry,
    source: "api-note",
  };
}

function applySellToState(state: LotState, quantity: number, costBasisSold: number) {
  if (state.quantity <= EPSILON) return;

  state.quantity = Math.max(0, state.quantity - quantity);
  state.costBasis = Math.max(0, state.costBasis - costBasisSold);
}

export function calculateTransactionRealizedPnl(
  transactions: InvestorTransaction[],
): Array<TransactionRealizedPnl | null> {
  const results: Array<TransactionRealizedPnl | null> = Array(transactions.length).fill(null);
  const lots = new Map<string, LotState>();
  const ordered = transactions
    .map((transaction, index) => ({ transaction, index }))
    .sort((a, b) => {
      const aTime = Date.parse(a.transaction.date);
      const bTime = Date.parse(b.transaction.date);
      const timeDelta = (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
      return timeDelta || a.index - b.index;
    });

  for (const { transaction, index } of ordered) {
    const asset = assetKey(transaction);
    const quantity = transactionQuantity(transaction);
    const amount = transactionAmount(transaction);
    if (!asset || !quantity || !amount) continue;

    const state = lots.get(asset) ?? { quantity: 0, costBasis: 0 };

    if (isBuy(transaction)) {
      state.quantity += quantity;
      state.costBasis += amount;
      lots.set(asset, state);
      continue;
    }

    if (!isSell(transaction)) continue;

    const exact = resultFromAccountingNote(transaction);
    if (exact) {
      results[index] = exact;
      applySellToState(state, quantity, exact.costBasisSold);
      lots.set(asset, state);
      continue;
    }

    if (state.quantity + EPSILON < quantity || state.costBasis <= 0) {
      lots.set(asset, state);
      continue;
    }

    const avgEntry = state.costBasis / state.quantity;
    const costBasisSold = quantity * avgEntry;
    const realizedPnl = amount - costBasisSold;

    results[index] = {
      realizedPnl,
      proceeds: amount,
      costBasisSold,
      avgEntry,
      source: "journal",
    };

    applySellToState(state, quantity, costBasisSold);
    lots.set(asset, state);
  }

  return results;
}
