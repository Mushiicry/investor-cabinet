import { describe, expect, it } from "vitest";
import { computePortfolioHealth, type HealthInput } from "../../src/lib/portfolioHealth";
import {
  buildDefaultHealthSimulatorLevers,
  buildHealthSimulatorInput,
  type HealthSimulatorLevers,
} from "../../src/v2/lib/healthSimulator";

const base: HealthInput = {
  cashShare: 0.3,
  cryptoShare: 0.45,
  futuresShare: 0.12,
  largestShare: 0.42,
  riskCategoryShares: [0.55, 0.04, 0.01],
  reserveShare: 0.3,
  portfolioValue: 1000,
  investedCapital: 600,
  concentrationScore: 56,
  maxAssetLimitUtilization: 1.3,
  worstConcentrationAsset: "SOL",
  worstConcentrationLimit: 0.1,
  worstConcentrationShare: 0.13,
  worstConcentrationPortfolioShare: 0.08,
  overLimitAssets: ["SOL"],
  altcoinSlotsUsed: 4,
  altcoinSlotsTotal: 3,
  altcoinSlotsFree: 0,
  stockSlotsUsed: 2,
  stockSlotsTotal: 2,
  stockSlotsFree: 0,
  metalSlotsUsed: 2,
  metalSlotsTotal: 2,
  metalSlotsFree: 0,
  spotDeployableUsd: 160,
  futuresLegs: [
    { asset: "SOL LONG", leverage: 4, liqDistance: 0.08 },
    { asset: "TON LONG", leverage: 3, liqDistance: 0.12 },
    { asset: "BTC SHORT", leverage: 4, liqDistance: 0.2 },
    { asset: "ETH LONG", leverage: 3, liqDistance: 0.16 },
  ],
  disciplineJournalCoverage: 0.35,
  fomoEvents30d: 2,
  revengeTrades30d: 1,
  overtradingDays30d: 3,
  disciplineCooldownActive: true,
};

const levers = (patch: Partial<HealthSimulatorLevers>) => ({
  ...buildDefaultHealthSimulatorLevers(base),
  ...patch,
});

const component = (input: HealthInput, key: string) =>
  computePortfolioHealth(input).components.find((item) => item.key === key)!;

describe("симулятор здоровья", () => {
  it("создаёт шесть базовых рычагов из текущего портфеля", () => {
    expect(buildDefaultHealthSimulatorLevers(base)).toEqual({
      reserveShare: 0.3,
      diversificationRepair: 0,
      concentrationRepair: 0,
      riskControlRepair: 0,
      survivalPlan: 0,
      disciplineRepair: 0,
    });
  });

  it("рычаг диверсификации выравнивает рисковые классы и поднимает луч", () => {
    const before = component(base, "diversification").score;
    const afterInput = buildHealthSimulatorInput(base, levers({ diversificationRepair: 1 }));
    const after = component(afterInput, "diversification").score;

    expect(afterInput.riskCategoryShares[0]).toBeCloseTo(afterInput.riskCategoryShares[1], 3);
    expect(after).toBeGreaterThan(before);
  });

  it("рычаг концентрации убирает жёсткие нарушения и доводит луч до нормы", () => {
    const afterInput = buildHealthSimulatorInput(base, levers({ concentrationRepair: 1 }));
    const after = component(afterInput, "concentration");

    expect(after.score).toBe(100);
    expect(after.meta?.overLimitAssets).toEqual([]);
    expect(after.meta?.concentrationBlockers).toEqual([]);
  });

  it("рычаг контроля риска закрывает активные позиции и убирает блокировки", () => {
    const before = component(base, "futures");
    const afterInput = buildHealthSimulatorInput(base, levers({ riskControlRepair: 1 }));
    const after = component(afterInput, "futures");

    expect(before.meta?.riskControlBlockers?.length).toBeGreaterThan(0);
    expect(afterInput.futuresShare).toBe(0);
    expect(afterInput.futuresLegs).toEqual([]);
    expect(after.meta?.riskControlBlockers).toEqual([]);
    expect(after.score).toBe(100);
  });

  it("рычаг выживаемости подключает план лимитных ордеров без превышения покупательной способности", () => {
    const afterInput = buildHealthSimulatorInput(base, levers({ survivalPlan: 1 }));
    const after = component(afterInput, "crypto");

    expect(after.meta?.plannedLimitOrdersUsd).toBeDefined();
    expect(after.meta?.plannedLimitOrdersUsd).toBeLessThanOrEqual(base.spotDeployableUsd ?? 0);
    expect(after.meta?.survivalWarnings).not.toContain("План лимитных ордеров не подключён");
  });

  it("рычаг дисциплины заполняет журнал, снимает нарушения и паузу", () => {
    const afterInput = buildHealthSimulatorInput(base, levers({ disciplineRepair: 1 }));
    const after = component(afterInput, "flexibility");

    expect(afterInput.disciplineJournalCoverage).toBe(1);
    expect(afterInput.fomoEvents30d).toBe(0);
    expect(afterInput.revengeTrades30d).toBe(0);
    expect(afterInput.overtradingDays30d).toBe(0);
    expect(afterInput.disciplineCooldownActive).toBe(false);
    expect(after.meta?.disciplineBlockers).toEqual([]);
    expect(after.score).toBe(100);
  });
});
