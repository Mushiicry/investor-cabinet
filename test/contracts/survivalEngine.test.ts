import { describe, expect, it } from "vitest";
import { calculateSurvival } from "../../src/lib/survivalEngine";

describe("движок выживаемости", () => {
  it("считает худший стресс-сценарий и покупательскую способность после падения", () => {
    const result = calculateSurvival({
      cryptoShare: 0.4,
      futuresShare: 0.02,
      riskCategoryShares: [0.4, 0.05, 0],
      reserveShare: 0.3,
      portfolioValue: 1000,
    });

    expect(result.status).toBe("ОСТОРОЖНО");
    expect(result.survivalWorstScenario).toBe("Общий рыночный шок");
    expect(result.survivalShockLossPct).toBeCloseTo(0.285, 3);
    expect(result.survivalReserveAfterShockShare).toBeCloseTo(0.42, 3);
    expect(result.survivalBuyPowerAfterShockUsd).toBeCloseTo(228.5, 1);
    expect(result.survivalWarnings).toEqual(["План лимитных покупок не подключён"]);
    expect(result.survivalBlockers).toEqual([]);
    expect(result.score).toBe(88);
  });

  it("максимальная риск-стратегия проходит без блокировки, но не получает идеальные 100", () => {
    const result = calculateSurvival({
      cryptoShare: 0.4,
      futuresShare: 0.1,
      riskCategoryShares: [0.4, 0.1, 0.1],
      reserveShare: 0.3,
      portfolioValue: 1000,
      spotDeployableUsd: 240,
      plannedLimitOrdersUsd: 150,
    });

    expect(result.status).toBe("ОСТОРОЖНО");
    expect(result.survivalWorstScenario).toBe("Общий рыночный шок");
    expect(result.survivalShockLossPct).toBeCloseTo(0.42, 3);
    expect(result.survivalWarnings).toContain("Худший сценарий даёт просадку выше 40%");
    expect(result.survivalBlockers).toEqual([]);
    expect(result.score).toBeLessThan(100);
  });

  it("блокирует сценарий, где портфель теряет выживаемость", () => {
    const result = calculateSurvival({
      cryptoShare: 0.9,
      futuresShare: 0.1,
      riskCategoryShares: [0.9, 0, 0],
      reserveShare: 0.03,
      portfolioValue: 1000,
    });

    expect(result.status).toBe("НЕ ВЫЖИВАЕТ");
    expect(result.survivalWorstScenario).toBe("Крах крипты");
    expect(result.survivalShockLossPct).toBeCloseTo(0.64, 3);
    expect(result.survivalBlockers).toEqual([
      "Худший сценарий даёт просадку выше 60%",
      "После шока нет покупательской способности",
    ]);
    expect(result.score).toBeLessThan(40);
  });

  it("блокирует план лимитных покупок, если он больше свободных денег после шока", () => {
    const result = calculateSurvival({
      cryptoShare: 0.2,
      futuresShare: 0,
      riskCategoryShares: [0.2, 0.1, 0.1],
      reserveShare: 0.4,
      portfolioValue: 1000,
      spotDeployableUsd: 120,
      plannedLimitOrdersUsd: 200,
    });

    expect(result.status).toBe("НЕ ВЫЖИВАЕТ");
    expect(result.survivalBlockers).toEqual(["План лимитных покупок больше доступных денег после шока"]);
    expect(result.survivalPlanScore).toBe(20);
  });
});
