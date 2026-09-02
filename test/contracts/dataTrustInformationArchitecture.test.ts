import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("data trust information architecture", () => {
  it("wires portfolio and signal freshness into Trading and the gate", () => {
    const shell = read("src/v2/components/V2Shell.tsx");
    const trading = read("src/v2/components/V2TradingPage.tsx");
    const gate = read("src/v2/components/V2GatePage.tsx");

    expect(shell).toContain("buildTradingDataTrust");
    expect(shell).toContain("portfolioUpdatedAt: data.updatedAt");
    expect(shell).toContain("data.signals.interestList.find");
    expect(shell).toContain("dataTrust={tradingDataTrust}");
    expect(trading).toContain("<V2DataTrustPanel");
    expect(trading).toContain("if (!dataTrust.canCreateDecision) return");
    expect(trading).toContain("dataTrust={dataTrust}");
    expect(gate).toContain("dataTrust?.canCreateDecision !== true");
    expect(gate).toContain("!dataTrustBlocked && decision.status");
    expect(gate).toContain("Решение заблокировано данными");
  });

  it("shows source and update time for portfolio, price and signal", () => {
    const trust = read("src/v2/lib/dataTrust.ts");
    const panel = read("src/v2/components/V2DataTrustPanel.tsx");

    ["portfolio", "price", "signal"].forEach((id) => {
      expect(trust).toContain(`id: "${id}"`);
    });
    expect(trust).toContain("Google Sheets · Apps Script API");
    expect(trust).toContain("signal.lastCheck");
    expect(panel).toContain("formatTime(fact.updatedAt)");
    expect(panel).toContain("fact.source");
  });

  it("marks the unavailable volatility metric instead of presenting zero as a calculation", () => {
    const data = read("src/v2/lib/v2LabData.ts");
    const risk = read("src/v2/components/V2RiskEnginePage.tsx");

    expect(data).toContain("volatility: null");
    expect(risk).toContain('m.value === null ? "нет данных" : m.value');
    expect(risk).toContain("нет подтверждённого источника");
  });
});
