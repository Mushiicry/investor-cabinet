import { describe, expect, it } from "vitest";
import type { PortfolioHealth } from "../../src/lib/portfolioHealth";
import type { V2Portfolio } from "../../src/v2/InvestorCabinetV2Lab";
import { buildPortfolioAlerts } from "../../src/v2/lib/portfolioAlerts";
import { getMarketPsychology } from "../../src/v2/lib/marketPsychology";
import { WIFE_INVESTOR_STRATEGY } from "../../src/v2/lib/investorStrategy";

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

  it("переносит простой резерва выше верхней границы в сигналы и общие рекомендации", () => {
    const alerts = buildPortfolioAlerts({
      portfolio: portfolio({ stableReserve: 700, reserveShare: 0.7 }),
      positions: [],
      allocation: [],
      currentFG: 50,
      health,
      marketPsychology: getMarketPsychology(50),
    });

    expect(alerts).toContainEqual(
      expect.objectContaining({
        id: "reserve-idle",
        level: "warning",
        title: "Резерв выше 60%",
        detail: "$100 сверх $600 простаивает",
        action: "Открыть разбор здоровья",
      }),
    );
  });

  it("для стратегии Полины не ругается на резерв выше 10% и крипту ниже 75%", () => {
    const alerts = buildPortfolioAlerts({
      portfolio: portfolio({ stableReserve: 150, reserveShare: 0.15 }),
      positions: [],
      allocation: [{ name: "Крипта", share: 0.7, value: 700 }],
      currentFG: 50,
      health,
      marketPsychology: getMarketPsychology(50),
      strategy: WIFE_INVESTOR_STRATEGY,
    });

    expect(alerts.find((alert) => alert.id === "reserve-low")).toBeUndefined();
    expect(alerts.find((alert) => alert.id === "crypto-warn")).toBeUndefined();
    expect(alerts.find((alert) => alert.id === "crypto-critical")).toBeUndefined();
  });

  it("для стратегии Полины считает крипто-предупреждение от лимита 75%", () => {
    const alerts = buildPortfolioAlerts({
      portfolio: portfolio({ stableReserve: 150, reserveShare: 0.15 }),
      positions: [],
      allocation: [{ name: "Крипта", share: 0.8, value: 800 }],
      currentFG: 50,
      health,
      marketPsychology: getMarketPsychology(50),
      strategy: WIFE_INVESTOR_STRATEGY,
    });

    expect(alerts).toContainEqual(
      expect.objectContaining({
        id: "crypto-warn",
        detail: "80.0% · лимит 75%",
      }),
    );
  });
});
