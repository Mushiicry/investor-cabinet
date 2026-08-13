import { describe, expect, it } from "vitest";
import type { InvestorTransaction } from "../../src/types/portfolio";
import { calculateTransactionRealizedPnl } from "../../src/v2/lib/transactionRealizedPnl";

function tx(partial: Partial<InvestorTransaction>): InvestorTransaction {
  return {
    id: partial.id ?? `${partial.asset}-${partial.action}-${partial.date}`,
    status: partial.status ?? "PENDING",
    date: partial.date ?? "2026-01-01T00:00:00Z",
    asset: partial.asset ?? "",
    category: partial.category ?? "",
    action: partial.action ?? "",
    quantity: partial.quantity ?? 0,
    price: partial.price ?? 0,
    amount: partial.amount ?? 0,
    comment: partial.comment ?? "",
    walletId: partial.walletId ?? "",
    chain: partial.chain ?? "",
    hash: partial.hash ?? "",
    direction: partial.direction ?? "",
    counterparty: partial.counterparty ?? "",
    rawAsset: partial.rawAsset ?? "",
    rawAmount: partial.rawAmount ?? 0,
    note: partial.note ?? "",
  };
}

describe("transaction realized PnL", () => {
  it("calculates partial SELL from journal cost basis at the old average entry", () => {
    const results = calculateTransactionRealizedPnl([
      tx({ date: "2026-01-01T00:00:00Z", asset: "ETH", action: "Покупка", quantity: 2, amount: 300 }),
      tx({ date: "2026-01-02T00:00:00Z", asset: "ETH", action: "Продажа", quantity: 0.5, amount: 120 }),
    ]);

    expect(results[0]).toBeNull();
    expect(results[1]?.source).toBe("journal");
    expect(results[1]?.avgEntry).toBe(150);
    expect(results[1]?.costBasisSold).toBe(75);
    expect(results[1]?.realizedPnl).toBe(45);
  });

  it("prefers exact realized PnL from accounting audit note", () => {
    const results = calculateTransactionRealizedPnl([
      tx({
        date: "2026-08-10T13:49:01Z",
        asset: "ETH",
        action: "Продажа",
        quantity: 0.014002763554624001,
        amount: 26.588544000000013,
        note: "cost basis was reduced at avgEntry 1776.475081422112; costBasisSold=24.875561; realizedPnL=1.712983.",
      }),
    ]);

    expect(results[0]?.source).toBe("api-note");
    expect(results[0]?.avgEntry).toBeCloseTo(1776.475081422112, 6);
    expect(results[0]?.costBasisSold).toBeCloseTo(24.875561, 6);
    expect(results[0]?.realizedPnl).toBeCloseTo(1.712983, 6);
  });

  it("calculates the latest SPCXB sale from the previous SPCXB buy", () => {
    const results = calculateTransactionRealizedPnl([
      tx({
        date: "2026-07-16T23:03:58Z",
        asset: "SPCXB",
        action: "Покупка",
        quantity: 0.085,
        amount: 10.8516,
      }),
      tx({
        date: "2026-08-10T14:33:52Z",
        asset: "SPCXB",
        action: "Продажа",
        quantity: 0.07572617318711594,
        amount: 10.212428505332824,
      }),
    ]);

    expect(results[1]?.source).toBe("journal");
    expect(results[1]?.avgEntry).toBeCloseTo(127.66588235294117, 6);
    expect(results[1]?.costBasisSold).toBeCloseTo(9.667648717144791, 6);
    expect(results[1]?.realizedPnl).toBeCloseTo(0.5447797881880323, 6);
  });

  it("does not invent a result when the entry basis is missing", () => {
    const results = calculateTransactionRealizedPnl([
      tx({ date: "2026-01-02T00:00:00Z", asset: "ETH", action: "Продажа", quantity: 1, amount: 200 }),
    ]);

    expect(results[0]).toBeNull();
  });
});
