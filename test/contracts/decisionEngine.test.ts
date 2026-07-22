import { describe, expect, it } from "vitest";
import {
  calculateAveragingPreview,
  evaluateDecision,
  type DecisionContext,
} from "../../src/v2/lib/decisionEngine";

const baseCtx: DecisionContext = {
  totalPortfolioValue: 1000,
  stableReserve: 600,
  spotDeployable: 200,
  positions: [
    { asset: "ETH", category: "Крипта", value: 100, avgEntry: 1776, invested: 25 },
    { asset: "SOL", category: "Крипта", value: 40, avgEntry: 77, invested: 38 },
    { asset: "GOLD", category: "Металлы", value: 30, avgEntry: 4300, invested: 28 },
  ],
  allocation: [
    { name: "Крипта", value: 400 },
    { name: "Металлы", value: 30 },
    { name: "Свободные деньги", value: 600 },
  ],
  fearGreedRules: [
    {
      mode: "cautious",
      label: "Осторожная покупка",
      buyAmount: 100,
      isCurrent: true,
      isAvailable: true,
      cooldownRemainingHours: 0,
    },
  ],
  reserveFloorShare: 0.1,
  cryptoMaxShare: 0.6,
  futuresShare: 0,
  plannedLimitOrdersUsd: 100,
};

describe("движок решений", () => {
  it("разрешает сделку, если шлюз и выживаемость проходят", () => {
    const decision = evaluateDecision(
      { asset: "ETH", amountUsd: 20, category: "Крипта" },
      baseCtx,
    );

    expect(decision.status).toBe("РАЗРЕШЕНО");
    expect(decision.reasons).toEqual([]);
    expect(decision.warnings).toEqual([]);
    expect(decision.maxSafeAmount).toBeGreaterThanOrEqual(20);
    expect(decision.recommendedAction).toBe("Сделка проходит проверку риска");
  });

  it("даёт осторожность, если после покупки выживаемость уходит в предупреждение", () => {
    const decision = evaluateDecision(
      { asset: "ETH", amountUsd: 20, category: "Крипта" },
      {
        ...baseCtx,
        allocation: [
          { name: "Крипта", value: 400 },
          { name: "Металлы", value: 100 },
          { name: "Акции", value: 100 },
          { name: "Свободные деньги", value: 400 },
        ],
        stableReserve: 400,
        spotDeployable: 240,
        futuresShare: 0.1,
        cryptoMaxShare: 0.8,
      },
    );

    expect(decision.status).toBe("ОСТОРОЖНО");
    expect(decision.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "выживаемость",
          text: "Худший сценарий даёт просадку выше 40%",
        }),
      ]),
    );
    expect(decision.reasons).toEqual([]);
  });

  it("блокирует сделку, если после покупки портфель не проходит выживаемость", () => {
    const decision = evaluateDecision(
      { asset: "ETH", amountUsd: 1, category: "Крипта" },
      {
        ...baseCtx,
        totalPortfolioValue: 1000,
        stableReserve: 150,
        spotDeployable: 50,
        positions: [
          { asset: "ETH", category: "Крипта", value: 250 },
          { asset: "BTC", category: "Крипта", value: 170 },
          { asset: "SOL", category: "Крипта", value: 85 },
          { asset: "TON", category: "Крипта", value: 85 },
          { asset: "BNB", category: "Крипта", value: 85 },
          { asset: "ATOM", category: "Крипта", value: 45 },
          { asset: "INJ", category: "Крипта", value: 45 },
          { asset: "SEI", category: "Крипта", value: 45 },
        ],
        allocation: [
          { name: "Крипта", value: 850 },
          { name: "Свободные деньги", value: 150 },
        ],
        cryptoMaxShare: 1,
        futuresShare: 0.1,
        plannedLimitOrdersUsd: 20,
      },
    );

    expect(decision.status).toBe("БЛОКИРОВКА");
    expect(decision.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "выживаемость",
          text: "Худший сценарий даёт просадку выше 60%",
        }),
      ]),
    );
  });

  it("блокирует сделку при дисциплинарном блокере", () => {
    const decision = evaluateDecision(
      { asset: "ETH", amountUsd: 20, category: "Крипта" },
      { ...baseCtx, disciplineBlockers: ["Активен дисциплинарный блокер"] },
    );

    expect(decision.status).toBe("БЛОКИРОВКА");
    expect(decision.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "дисциплина",
          text: "Активен дисциплинарный блокер",
        }),
      ]),
    );
  });

  it("считает новую среднюю входа при усреднении покупки", () => {
    const preview = calculateAveragingPreview(
      { asset: "ETH", amountUsd: 25, category: "Крипта", buyPrice: 1516 },
      baseCtx,
    );

    const oldQty = 25 / 1776;
    const addedQty = 25 / 1516;
    const expectedAvg = 50 / (oldQty + addedQty);

    expect(preview?.averageEntryBefore).toBe(1776);
    expect(preview?.addedQuantity).toBeCloseTo(addedQty, 8);
    expect(preview?.averageEntryAfter).toBeCloseTo(expectedAvg, 6);
    expect(preview?.averageEntryAfter).toBeLessThan(1776);
    expect(preview?.averageEntryAfter).toBeGreaterThan(1516);
  });

  it("не считает усреднение без цены покупки", () => {
    expect(
      calculateAveragingPreview(
        { asset: "ETH", amountUsd: 25, category: "Крипта" },
        baseCtx,
      ),
    ).toBeNull();
  });
});
