import { describe, expect, it } from "vitest";
import type { PortfolioHealth } from "../../src/lib/portfolioHealth";
import type { V2Portfolio } from "../../src/v2/InvestorCabinetV2Lab";
import { buildPortfolioAlerts } from "../../src/v2/lib/portfolioAlerts";
import { getMarketPsychology } from "../../src/v2/lib/marketPsychology";

const portfolio = (patch: Partial<V2Portfolio> = {}): V2Portfolio => ({
  totalPortfolioValue: 1000,
  totalInvested: 1000,
  pnlUsd: 0,
  pnlPct: 0,
  stableReserve: 400,
  positionsCount: 0,
  healthFactor: 82,
  healthStatus: "CONTROL",
  riskLevel: "LOW",
  deployableCapital: 100,
  spotDeployable: 100,
  futuresDeployable: 0,
  reserveShare: 0.4,
  exposureMode: "CONTROL",
  exposureSignal: "Норма",
  ...patch,
});

const health: PortfolioHealth = {
  healthFactor: 82,
  status: "CONTROL",
  riskLevel: "LOW",
  components: [],
};

describe("единый движок тревог портфеля", () => {
  it("передаёт эйфорию рынка как блокирующую макро-тревогу", () => {
    const alerts = buildPortfolioAlerts({
      portfolio: portfolio(),
      positions: [],
      allocation: [],
      currentFG: 92,
      health,
      marketPsychology: getMarketPsychology(92),
    });

    expect(alerts).toContainEqual(
      expect.objectContaining({
        id: "market-psychology-block",
        level: "critical",
        title: "Рынок: Эйфория",
      }),
    );
  });

  it("передаёт жадность рынка как предупреждение перед проверкой риска", () => {
    const alerts = buildPortfolioAlerts({
      portfolio: portfolio(),
      positions: [],
      allocation: [],
      currentFG: 80,
      health,
      marketPsychology: getMarketPsychology(80),
    });

    expect(alerts).toContainEqual(
      expect.objectContaining({
        id: "market-psychology-warning",
        level: "warning",
        title: "Рынок: Жадность",
        action: "Открыть проверку риска",
      }),
    );
  });

  it("сохраняет предупреждение по резерву в том же списке тревог", () => {
    const alerts = buildPortfolioAlerts({
      portfolio: portfolio({ stableReserve: 150, reserveShare: 0.15 }),
      positions: [],
      allocation: [],
      currentFG: 50,
      health,
      marketPsychology: getMarketPsychology(50),
    });

    expect(alerts).toContainEqual(
      expect.objectContaining({
        id: "reserve-low",
        level: "warning",
        title: "Резерв низкий",
      }),
    );
  });
});
