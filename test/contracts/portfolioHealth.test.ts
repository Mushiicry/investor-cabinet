import { describe, expect, it } from "vitest";
import {
  computePortfolioHealth,
  liquidationPenalty,
  type HealthInput,
} from "../../src/lib/portfolioHealth";

const base: HealthInput = {
  cashShare: 0.3,
  cryptoShare: 0.4,
  futuresShare: 0.02,
  largestShare: 0.2,
  riskCategoryShares: [0.4, 0.05, 0],
  reserveShare: 0.3,
  portfolioValue: 1000,
};

const conc = (h: ReturnType<typeof computePortfolioHealth>) =>
  h.components.find((c) => c.key === "concentration")!;

describe("health concentration — per-asset score passthrough", () => {
  it("готовый concentrationScore используется как есть", () => {
    const h = computePortfolioHealth({ ...base, concentrationScore: 63 });
    expect(conc(h).score).toBe(63);
  });

  it("перевес одного актива — балл снижен, но не 0 + меты худшего актива", () => {
    const h = computePortfolioHealth({
      ...base,
      concentrationScore: 56,
      maxAssetLimitUtilization: 4.2,
      worstConcentrationAsset: "TON",
      worstConcentrationLimit: 0.1,
      worstConcentrationShare: 0.42,
      worstConcentrationPortfolioShare: 0.156,
      overLimitAssets: ["TON"],
    });
    expect(conc(h).score).toBe(56);
    expect(conc(h).score).toBeGreaterThan(0);
    expect(conc(h).meta?.worstConcentrationAsset).toBe("TON");
    expect(conc(h).meta?.overLimitAssets).toEqual(["TON"]);
  });

  it("фьючерсы: счёт недофинансирован → баллы сняты + сумма пополнения в мете", () => {
    // 4.7% из 10% → недофинансирован. Капитал 603.8 → цель 60.38, занято 28.38.
    const h = computePortfolioHealth({
      ...base,
      futuresShare: 0.047,
      investedCapital: 603.8,
      futuresLegs: [],
    });
    const f = h.components.find((c) => c.key === "futures")!;
    expect(f.meta?.isFutureBudgetFunded).toBe(false);
    expect(f.meta?.futuresTargetUsd).toBeCloseTo(60.38, 1);
    expect(f.meta?.futuresTopUpUsd).toBeCloseTo(32.0, 0);
    expect(f.score).toBeLessThan(100); // штраф за невыполненный план
  });

  it("фьючерсы: счёт укомплектован ровно на 10% → ачивка, штрафа нет", () => {
    const h = computePortfolioHealth({
      ...base,
      futuresShare: 0.10,
      investedCapital: 603.8,
      futuresLegs: [],
    });
    const f = h.components.find((c) => c.key === "futures")!;
    expect(f.meta?.isFutureBudgetFunded).toBe(true);
    expect(f.meta?.futuresTopUpUsd).toBeCloseTo(0, 2);
    expect(f.score).toBe(100);
  });

  it("фьючерсы: превышение лимита штрафуется жёстче недофинансирования", () => {
    const under = computePortfolioHealth({ ...base, futuresShare: 0.05, investedCapital: 600, futuresLegs: [] });
    const over = computePortfolioHealth({ ...base, futuresShare: 0.15, investedCapital: 600, futuresLegs: [] });
    const s = (h: ReturnType<typeof computePortfolioHealth>) =>
      h.components.find((c) => c.key === "futures")!.score;
    expect(s(over)).toBeLessThan(s(under));
  });

  it("близость к ликвидации: чем ближе — тем больше штраф", () => {
    expect(liquidationPenalty(0.5)).toBe(0); // далеко — без штрафа
    expect(liquidationPenalty(null)).toBe(0); // нет данных — не штрафуем
    expect(liquidationPenalty(0.05)).toBe(30); // критично — полный штраф
    expect(liquidationPenalty(0.2)).toBeGreaterThan(0);
    expect(liquidationPenalty(0.2)).toBeLessThan(30);
    // монотонность: ближе к ликвидации → штраф не меньше
    expect(liquidationPenalty(0.1)).toBeGreaterThan(liquidationPenalty(0.3));
  });

  it("фьючерсы: близкая ликвидация роняет балл и попадает в мету", () => {
    const h = computePortfolioHealth({
      ...base,
      futuresShare: 0.10,
      investedCapital: 600,
      futuresLegs: [{ asset: "MNT LONG", leverage: 2, liqDistance: 0.06 }],
    });
    const f = h.components.find((c) => c.key === "futures")!;
    expect(f.meta?.worstLiqAsset).toBe("MNT LONG");
    expect(f.meta?.worstLiqDistance).toBeCloseTo(0.06, 3);
    expect(f.score).toBeLessThan(75); // штраф за ликвидацию ощутимый
  });

  it("без concentrationScore → legacy по largestShare (35% лимит)", () => {
    const h = computePortfolioHealth({ ...base, largestShare: 0.5 });
    expect(conc(h).score).toBe(0); // largestShare 0.5 = CONCENTRATION_HARD
    expect(conc(h).meta).toBeUndefined();
  });
});
