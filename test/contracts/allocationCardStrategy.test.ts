import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = () => readFileSync("src/v2/components/V2PortfolioAllocationCard.tsx", "utf8");

describe("portfolio allocation card strategy wiring", () => {
  it("derives class limits from the selected investor strategy", () => {
    const card = source();

    expect(card).toContain("strategy.cryptoMaxShare");
    expect(card).toContain("strategy.metalsMaxShare");
    expect(card).toContain("strategy.stocksMaxShare");
    expect(card).toContain("strategy.reserveTargetShare");
    expect(card).toContain("strategy.futuresMaxShare");
  });

  it("does not present Polina futures as an allowed allocation block", () => {
    const card = source();

    expect(card).toContain("strategy.futuresAllowed");
    expect(card).toContain("item.name !== \"Фьючерсы\"");
    expect(card).toContain("limitLabel: \"ЗАПРЕТ\"");
  });
});
