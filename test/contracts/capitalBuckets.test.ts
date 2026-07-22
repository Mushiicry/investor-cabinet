import { describe, expect, it } from "vitest";
import { buildCapitalBuckets } from "../../src/v2/lib/capitalBuckets";

describe("карманы капитала", () => {
  it("считает торговый капитал как стейблы минус резерв 30%", () => {
    const buckets = buildCapitalBuckets({
      totalPortfolioValue: 1000,
      stableReserve: 500,
      futuresDeployableUsd: 40,
      allocation: [
        { name: "Крипта", value: 300 },
        { name: "Металлы", value: 80 },
        { name: "Акции", value: 50 },
      ],
      strategyRules: [{ buyPct: 0.01, buyAmount: 10, status: "active" }],
    });

    expect(buckets.lockedReserveUsd).toBe(300);
    expect(buckets.workCashUsd).toBe(200);
    expect(buckets.averagingBudgetUsd).toBe(10);
    expect(buckets.futuresBudgetUsd).toBe(40);
    expect(buckets.spotBudgetUsd).toBe(150);
    expect(buckets.metalsBudgetUsd).toBe(20);
    expect(buckets.stocksBudgetUsd).toBe(50);
    expect(buckets.cryptoSpotBudgetUsd).toBe(150);
  });

  it("оставляет усреднение отдельным карманом, но включает его в плановый крипто-блок", () => {
    const buckets = buildCapitalBuckets({
      totalPortfolioValue: 1000,
      stableReserve: 525,
      futuresDeployableUsd: 0,
      allocation: [
        { name: "Крипта", value: 175 },
        { name: "Металлы", value: 100 },
        { name: "Акции", value: 100 },
      ],
      strategyRules: [{ buyPct: 0.025, buyAmount: 25, status: "active" }],
    });

    expect(buckets.averagingBudgetUsd).toBe(25);
    expect(buckets.spotBudgetUsd).toBe(200);
    expect(buckets.cryptoSpotBudgetUsd).toBe(200);
    expect(buckets.plannedCryptoBlockUsd).toBe(400);
  });

  it("не закладывает карман фьючерсов выше переданной суммы", () => {
    const buckets = buildCapitalBuckets({
      totalPortfolioValue: 1000,
      stableReserve: 700,
      futuresDeployableUsd: 35,
      allocation: [
        { name: "Крипта", value: 100 },
        { name: "Фьючерсы", value: 0 },
      ],
      strategyRules: [],
    });

    expect(buckets.futuresBudgetUsd).toBe(35);
  });

  it("металлы и акции не отнимают спот автоматически", () => {
    const buckets = buildCapitalBuckets({
      totalPortfolioValue: 1000,
      stableReserve: 500,
      futuresDeployableUsd: 0,
      allocation: [
        { name: "Крипта", value: 200 },
        { name: "Металлы", value: 60 },
        { name: "Акции", value: 40 },
      ],
      strategyRules: [],
    });

    expect(buckets.workCashUsd).toBe(200);
    expect(buckets.spotBudgetUsd).toBe(200);
    expect(buckets.metalsBudgetUsd).toBe(40);
    expect(buckets.stocksBudgetUsd).toBe(60);
    expect(buckets.cryptoSpotBudgetUsd).toBe(200);
  });
});
