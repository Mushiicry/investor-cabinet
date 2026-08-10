import { describe, expect, it } from "vitest";
import { buildCapitalBuckets, buildFuturesLimitSnapshot } from "../../src/v2/lib/capitalBuckets";
import { WIFE_INVESTOR_STRATEGY } from "../../src/v2/lib/investorStrategy";

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

  it("обнуляет карман фьючерсов, если маржа позиций и свободная HL-маржа уже выше лимита", () => {
    const futuresLimit = buildFuturesLimitSnapshot({
      investedCapital: 680.5,
      futuresDeployableUsd: 56.37,
      positions: [
        { asset: "MNT LONG", category: "Фьючерсы", invested: 10.34, value: 6.94 },
        { asset: "BTC SHORT", category: "Фьючерсы", invested: 9.92, value: 9.74 },
      ],
    });
    const buckets = buildCapitalBuckets({
      totalPortfolioValue: 645.4,
      investedCapital: 680.5,
      stableReserve: 422.27,
      futuresDeployableUsd: 56.37,
      futuresUsedUsd: futuresLimit.usedUsd,
      allocation: [
        { name: "Фьючерсы", value: 16.68 },
      ],
      strategyRules: [],
    });

    expect(futuresLimit.limitUsd).toBeCloseTo(68.05, 2);
    expect(futuresLimit.positionMarginUsd).toBeCloseTo(20.26, 2);
    expect(futuresLimit.freeMarginUsd).toBeCloseTo(56.37, 2);
    expect(futuresLimit.usedUsd).toBeCloseTo(76.63, 2);
    expect(futuresLimit.breachUsd).toBeCloseTo(8.58, 2);
    expect(buckets.futuresBudgetUsd).toBe(0);
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

  it("для стратегии Полины держит резерв 10% и не выделяет карман фьючерсов", () => {
    const buckets = buildCapitalBuckets({
      totalPortfolioValue: 1000,
      stableReserve: 500,
      futuresDeployableUsd: 40,
      allocation: [
        { name: "Крипта", value: 700 },
        { name: "Металлы", value: 60 },
        { name: "Акции", value: 20 },
        { name: "Фьючерсы", value: 0 },
      ],
      strategyRules: [{ buyPct: 0.01, buyAmount: 10, status: "active" }],
      investorStrategy: WIFE_INVESTOR_STRATEGY,
    });

    expect(buckets.lockedReserveUsd).toBe(100);
    expect(buckets.workCashUsd).toBe(400);
    expect(buckets.averagingBudgetUsd).toBe(10);
    expect(buckets.futuresBudgetUsd).toBe(0);
    expect(buckets.metalsBudgetUsd).toBe(20);
    expect(buckets.stocksBudgetUsd).toBe(50);
    expect(buckets.cryptoSpotBudgetUsd).toBe(50);
  });
});
