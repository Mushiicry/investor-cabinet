import { describe, expect, it } from "vitest";

type LotState = {
  quantity: number;
  costBasis: number;
  realizedPnl: number;
};

const avgEntry = (state: LotState) =>
  state.quantity ? state.costBasis / state.quantity : 0;

const buy = (state: LotState, quantity: number, price: number): LotState => ({
  ...state,
  quantity: state.quantity + quantity,
  costBasis: state.costBasis + quantity * price,
});

const sell = (state: LotState, quantity: number, price: number): LotState => {
  const entry = avgEntry(state);
  const soldCostBasis = quantity * entry;

  return {
    quantity: state.quantity - quantity,
    costBasis: state.costBasis - soldCostBasis,
    realizedPnl: state.realizedPnl + quantity * price - soldCostBasis,
  };
};

const transfer = (state: LotState): LotState => ({ ...state });

describe("accounting rules contract", () => {
  it("BUY increases quantity and cost basis and recalculates average entry", () => {
    const initial = { quantity: 1, costBasis: 100, realizedPnl: 0 };
    const next = buy(initial, 1, 200);

    expect(next.quantity).toBe(2);
    expect(next.costBasis).toBe(300);
    expect(avgEntry(next)).toBe(150);
  });

  it("partial SELL reduces cost basis at old average entry and keeps remaining average entry unchanged", () => {
    const initial = { quantity: 2, costBasis: 300, realizedPnl: 0 };
    const next = sell(initial, 0.5, 240);

    expect(next.quantity).toBe(1.5);
    expect(next.costBasis).toBe(225);
    expect(avgEntry(next)).toBe(150);
    expect(next.realizedPnl).toBe(45);
  });

  it("SELL does not use sale proceeds to recalculate remaining average entry", () => {
    const initial = { quantity: 10, costBasis: 1000, realizedPnl: 0 };
    const next = sell(initial, 4, 10);

    expect(next.quantity).toBe(6);
    expect(next.costBasis).toBe(600);
    expect(avgEntry(next)).toBe(100);
    expect(next.realizedPnl).toBe(-360);
  });

  it("TRANSFER does not change quantity, cost basis or realized PnL", () => {
    const initial = { quantity: 3, costBasis: 450, realizedPnl: 25 };

    expect(transfer(initial)).toEqual(initial);
  });

  it("SWAP is represented as SELL disposed asset plus BUY acquired asset", () => {
    const atom = { quantity: 10, costBasis: 100, realizedPnl: 0 };
    const usdc = { quantity: 0, costBasis: 0, realizedPnl: 0 };

    const disposedAtom = sell(atom, 2, 15);
    const acquiredUsdc = buy(usdc, 30, 1);

    expect(disposedAtom).toEqual({
      quantity: 8,
      costBasis: 80,
      realizedPnl: 10,
    });
    expect(acquiredUsdc).toEqual({
      quantity: 30,
      costBasis: 30,
      realizedPnl: 0,
    });
  });
});
