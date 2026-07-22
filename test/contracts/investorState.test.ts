import { describe, expect, it } from "vitest";
import { buildPortfolioState } from "../../src/lib/portfolioCalculations";
import { rawPositions, decisionsData, scenariosData } from "../../src/mocks/portfolioData";
import { buildInvestorStateFromApi } from "../../src/services/investorState";
import type { PortfolioState } from "../../src/types/portfolio";

describe("нормализация состояния инвестора", () => {
  it("переживает старый кэш без assetQuality", () => {
    const cached = buildPortfolioState(rawPositions, decisionsData, scenariosData) as Partial<PortfolioState>;
    delete cached.assetQuality;

    const state = buildInvestorStateFromApi(
      { success: true, updatedAt: "2026-07-22T00:00:00Z" },
      cached as PortfolioState,
    );

    expect(state.assetQuality).toEqual({
      connected: false,
      records: [],
      cmcTop100Connected: false,
      binanceMonitoringConnected: false,
    });
  });
});
