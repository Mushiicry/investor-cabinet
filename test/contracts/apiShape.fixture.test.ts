import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type ShapeFixture = {
  mode: string;
  privacy: string;
  investorApiShape: {
    rootKeys: string[];
    overviewKeys: string[];
    portfolio: {
      type: string;
      length: number;
      itemKeys: string[];
    };
    history: {
      type: string;
      length: number;
      itemKeys: string[];
    };
    riskKeys: string[];
    fearGreedStrategyKeys: string[];
  };
  wifeApiShape: {
    rootKeys: string[];
    chainKeys: string[];
    portfolioLength: number;
  };
  contractGapsToTest: { field: string }[];
};

const fixturePath = resolve("docs/api-fixtures/investor-live-shape-2026-07-11.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as ShapeFixture;

describe("sanitized investor API shape fixture", () => {
  it("keeps only shape metadata, not raw portfolio values", () => {
    expect(fixture.mode).toBe("sanitized-live-shape");
    expect(fixture.privacy).toContain("No portfolio values");
  });

  it("captures the stable investor API root sections", () => {
    expect(fixture.investorApiShape.rootKeys).toEqual(expect.arrayContaining([
      "success",
      "overview",
      "portfolio",
      "history",
      "risk",
      "fearGreedStrategy",
      "decisions",
      "scenarios",
      "updatedAt",
    ]));
  });

  it("captures current portfolio/history item keys for future contract tests", () => {
    expect(fixture.investorApiShape.portfolio.type).toBe("array");
    expect(fixture.investorApiShape.portfolio.length).toBeGreaterThan(0);
    expect(fixture.investorApiShape.portfolio.itemKeys).toEqual(expect.arrayContaining([
      "asset",
      "category",
      "quantity",
      "avgEntry",
      "currentPrice",
      "invested",
      "currentValue",
      "pnl",
      "pnlPct",
      "share",
      "status",
    ]));

    expect(fixture.investorApiShape.history.type).toBe("array");
    expect(fixture.investorApiShape.history.itemKeys).toEqual(expect.arrayContaining([
      "date",
      "portfolioValue",
      "invested",
      "pnl",
      "pnlPct",
      "reserve",
    ]));
  });

  it("keeps wife API chain errors visible as a degraded-state test target", () => {
    expect(fixture.wifeApiShape.rootKeys).toContain("_chain");
    expect(fixture.wifeApiShape.chainKeys).toContain("_errors");
    expect(fixture.wifeApiShape.portfolioLength).toBeGreaterThan(0);
  });

  it("documents live gaps before strict root contract enforcement", () => {
    const gapFields = fixture.contractGapsToTest.map((gap) => gap.field);

    expect(gapFields).toEqual(expect.arrayContaining([
      "risk.futuresDeployableCash",
      "risk.spotDeployableCash",
      "transactions",
      "portfolio[].ticker",
      "overview.*Label",
    ]));
  });
});
