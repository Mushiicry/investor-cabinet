import { describe, expect, it } from "vitest";
import {
  buildPortfolioState,
  calculatePortfolio,
} from "../../src/lib/portfolioCalculations";
import {
  calculateDeployableCashBuckets,
  getOpenRiskPositions,
} from "../../src/lib/portfolioSelectors";
import {
  normalizePortfolio,
  toRatio,
} from "../../src/lib/portfolioNormalizers";
import { normalizeHistory } from "../../src/lib/historyNormalizers";
import type { PositionCalculated, PositionInput } from "../../src/types/portfolio";

const position = (partial: Partial<PositionCalculated>): PositionCalculated => ({
  asset: "BTC",
  category: "Крипта",
  quantity: 1,
  avgEntry: 100,
  currentPrice: 100,
  invested: 100,
  currentValue: 100,
  pnl: 0,
  pnlPct: 0,
  share: 10,
  status: "Держать",
  ...partial,
});

describe("portfolio percent and cash contracts", () => {
  it("keeps overview pnlPct as decimal fraction while portfolio row pnlPct is direct percent", () => {
    const positions: PositionInput[] = [
      { asset: "BTC", category: "Крипта", quantity: 1, avgEntry: 100, currentPrice: 110, status: "Держать" },
      { asset: "USDT", category: "Свободные деньги", quantity: 100, avgEntry: 1, currentPrice: 1, status: "Резерв" },
    ];

    const portfolio = calculatePortfolio(positions);
    const state = buildPortfolioState(positions, [], []);

    expect(portfolio.find((item) => item.asset === "BTC")?.pnlPct).toBe(10);
    expect(state.overview.pnlPct).toBe(0.05);
  });

  it("normalizes risk direct percent values to ratios without scaling decimal fractions twice", () => {
    expect(toRatio(38.8)).toBeCloseTo(0.388);
    expect(toRatio(-0.0004)).toBe(-0.0004);
  });

  it("normalizes legacy cash alias and keeps closed zero-value rows for tracking", () => {
    const fallback = [position({ asset: "FALLBACK" })];
    const normalized = normalizePortfolio([
      {
        asset: "USDT",
        category: "Кэш / Стейблы",
        quantity: 100,
        avgEntry: 1,
        currentPrice: 1,
        invested: 100,
        currentValue: 100,
        pnl: 0,
        pnlPct: 0,
        share: 10,
        status: "Reserve",
      },
      {
        asset: "OLD",
        category: "Крипта",
        quantity: 0,
        avgEntry: 10,
        currentPrice: 0,
        invested: 0,
        currentValue: 0,
        pnl: 0,
        pnlPct: 0,
        share: 0,
        status: "CLOSED",
      },
    ], fallback);

    expect(normalized).toHaveLength(2);
    expect(normalized[0].asset).toBe("USDT");
    expect(normalized[0].category).toBe("Свободные деньги");
    expect(normalized[1].asset).toBe("OLD");
    expect(normalized[1].status).toBe("CLOSED");
  });

  it("separates futures cash from spot deployable cash", () => {
    const portfolio = [
      position({ asset: "USDC HL", category: "Свободные деньги", currentValue: 150 }),
      position({ asset: "USDT", category: "Свободные деньги", currentValue: 400 }),
      position({ asset: "BTC", category: "Крипта", currentValue: 450 }),
    ];

    expect(calculateDeployableCashBuckets(portfolio, 1000)).toEqual({
      futuresDeployableCash: 150,
      spotDeployableCash: 100,
    });
  });

  it("excludes reserve, cash and closed rows from open risk positions", () => {
    const openRisk = getOpenRiskPositions([
      position({ asset: "BTC", category: "Крипта", currentValue: 100, status: "Держать" }),
      position({ asset: "USDT", category: "Свободные деньги", currentValue: 200, status: "Резерв" }),
      position({ asset: "OLD", category: "Крипта", currentValue: 0, status: "CLOSED" }),
      position({ asset: "ETH", category: "Крипта", currentValue: 0, status: "WAIT_REBUY" }),
    ]);

    expect(openRisk.map((item) => item.asset)).toEqual(["BTC"]);
  });

  it("normalizes history percentage strings into decimal fractions", () => {
    const normalized = normalizeHistory([
      {
        date: "2026-07-10",
        portfolioValue: "1 000,00",
        invested: "900",
        pnl: "100",
        pnlPct: "2,8%",
        reserve: "300",
      },
      {
        date: "2026-07-11",
        portfolioValue: 1000,
        invested: 1000,
        pnl: -0.4,
        pnlPct: -0.0004,
        reserve: 300,
      },
    ], []);

    expect(normalized[0].pnlPct).toBeCloseTo(0.028);
    expect(normalized[1].pnlPct).toBe(-0.0004);
  });
});
