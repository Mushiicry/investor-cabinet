import { describe, expect, it } from "vitest";
import {
  buildFearGreedStrategy,
  getFearGreedMode,
  normalizeFearGreedStrategyFromApi,
} from "../../src/lib/fearGreedStrategy";

describe("Fear & Greed strategy contract", () => {
  it("uses decimal buyPct values for strategy buy amounts", () => {
    const strategy = buildFearGreedStrategy(29, 1000, [], Date.parse("2026-07-11T00:00:00Z"));
    const cautious = strategy.rules.find((rule) => rule.mode === "cautious");

    expect(strategy.currentMode).toBe("cautious");
    expect(cautious?.buyPct).toBe(0.01);
    expect(cautious?.buyAmount).toBe(10);
    expect(cautious?.status).toBe("active");
  });

  it("maps index ranges to the expected risk-first modes", () => {
    expect(getFearGreedMode(31)).toBe("observation");
    expect(getFearGreedMode(29)).toBe("cautious");
    expect(getFearGreedMode(15)).toBe("strong");
    expect(getFearGreedMode(0)).toBe("aggressive");
  });

  it("normalizes API rules without converting decimal buyPct into direct percent", () => {
    const fallback = buildFearGreedStrategy(50, 1000);
    const normalized = normalizeFearGreedStrategyFromApi({
      currentIndex: 14,
      portfolioValue: 1000,
      rules: [
        { mode: "observation", range: "30-100", buyPct: 0, cooldownDays: 0 },
        { mode: "cautious", range: "20-29", buyPct: 0.01, cooldownDays: 7 },
        { mode: "strong", range: "15-19", buyPct: 0.015, cooldownDays: 7 },
        { mode: "aggressive", range: "0-14", buyPct: 0.02, cooldownDays: 7 },
      ],
    }, fallback, 1000);

    const aggressive = normalized.rules.find((rule) => rule.mode === "aggressive");

    expect(normalized.currentMode).toBe("aggressive");
    expect(aggressive?.buyPct).toBe(0.02);
    expect(aggressive?.buyAmount).toBe(20);
  });
});
