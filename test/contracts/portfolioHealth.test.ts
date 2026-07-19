import { describe, expect, it } from "vitest";
import { computePortfolioHealth, type HealthInput } from "../../src/lib/portfolioHealth";

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

  it("без concentrationScore → legacy по largestShare (35% лимит)", () => {
    const h = computePortfolioHealth({ ...base, largestShare: 0.5 });
    expect(conc(h).score).toBe(0); // largestShare 0.5 = CONCENTRATION_HARD
    expect(conc(h).meta).toBeUndefined();
  });
});
