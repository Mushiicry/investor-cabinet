import { describe, expect, it } from "vitest";
import {
  buildCapitalLadderAssetLimits,
  buildCapitalLadderPlan,
  buildCapitalLadderSteps,
} from "../../src/v2/lib/capitalLadder";

describe("лестница капитала", () => {
  it("считает ближайшую ступень от общего депозита, а не рыночной стоимости", () => {
    const plan = buildCapitalLadderPlan(606.7);

    expect(plan.targetUsd).toBe(1000);
    expect(plan.remainingUsd).toBeCloseTo(393.3, 5);
    expect(plan.progressPct).toBe(61);
  });

  it("считает лимиты ступени 1000 по политике риска", () => {
    const plan = buildCapitalLadderPlan(606.7);

    expect(plan.reserveTargetUsd).toBe(300);
    expect(plan.cryptoMaxUsd).toBe(600);
    expect(plan.futuresMaxUsd).toBe(100);
    expect(plan.stocksMaxUsd).toBe(100);
    expect(plan.metalsMaxUsd).toBe(100);
    expect(plan.altCryptoMaxUsd).toBe(30);
    expect(plan.majorCryptoMaxUsd).toBe(210);
    expect(plan.limits.map((limit) => limit.label)).toEqual(["Резерв", "Крипта до", "Фьючерсы до", "Акции до", "Металлы до"]);
    expect(plan.limits.map((limit) => limit.sharePct)).toEqual([30, 60, 10, 10, 10]);
  });

  it("переходит на следующую ступень после достижения текущей", () => {
    const plan = buildCapitalLadderPlan(1500);

    expect(plan.targetUsd).toBe(2000);
    expect(plan.altCryptoMaxUsd).toBe(60);
  });

  it("строит соседние ступени для горизонтальной лестницы", () => {
    const steps = buildCapitalLadderSteps(606.7);

    expect(steps.map((step) => step.targetUsd)).toEqual([100, 500, 1000, 2000, 5000, 10000, 20000]);
    expect(steps.map((step) => step.status)).toEqual(["done", "done", "current", "next", "next", "next", "next"]);
    expect(steps[0].progressPct).toBe(100);
  });

  it("не округляет текущую ступень до 100%, пока цель не закрыта", () => {
    const plan = buildCapitalLadderPlan(9961.28);

    expect(plan.targetUsd).toBe(10000);
    expect(plan.remainingUsd).toBeCloseTo(38.72, 5);
    expect(plan.progressPct).toBe(99);
  });

  it("считает типовые лимиты актива без привязки к конкретной монете", () => {
    const plan = buildCapitalLadderPlan(606.7);
    const limits = buildCapitalLadderAssetLimits(plan);

    expect(limits.map((limit) => limit.label)).toEqual(["Крупная крипта", "Альткоин", "Одна акция", "Один металл", "Фьючерсы"]);
    expect(limits.map((limit) => limit.valueUsd)).toEqual([210, 30, 50, 50, 100]);
  });
});
