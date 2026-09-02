import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("trading workflow information architecture", () => {
  it("keeps the six approved steps inside one trading workspace", () => {
    const page = read("src/v2/components/V2TradingPage.tsx");

    ["Идея", "Проверка", "Наблюдение", "Решение", "Дневник", "Ожидание"].forEach((label) => {
      expect(page).toContain(`title: "${label}"`);
    });
    expect(page).toContain("<V2SignalsPage");
    expect(page).toContain("<V2GatePage");
    expect(page).toContain('<V2ReportsPage {...reportsProps} mode="trading"');
    expect(page).not.toContain("v2-trading-workflow__manual-boundary");
    expect(page).not.toContain("Ручное исполнение");
  });

  it("moves portfolio alerts to Health and removes health summaries from Trading", () => {
    const signals = read("src/v2/components/V2SignalsPage.tsx");
    const health = read("src/v2/components/V2HealthPage.tsx");
    const alertsPanel = read("src/v2/components/V2PortfolioAlertsPanel.tsx");
    const shell = read("src/v2/components/V2Shell.tsx");

    expect(signals).not.toContain("Сигналы портфеля");
    expect(signals).not.toContain("v2-alerts-row");
    expect(signals).not.toContain("v2-sig-health-strip");
    expect(health).toContain("<V2PortfolioAlertsPanel");
    expect(alertsPanel).toContain("Сигналы и рекомендации");
    expect(alertsPanel).toContain("group.alerts.map((alert)");
    expect(shell).toContain("portfolioAlerts={alerts}");
    expect(shell).toContain("onPortfolioAlertAction={handleAlertAction}");
    expect(shell).toContain('if (alert.action === "Открыть стратегию")');
    expect(shell).toContain('if (alert.action === "Поставить лимитки вручную")');
    expect(shell).toContain('handleNavigate("health")');
  });

  it("moves a selected signal into the gate without losing its candidate context", () => {
    const page = read("src/v2/components/V2TradingPage.tsx");
    const shell = read("src/v2/components/V2Shell.tsx");

    expect(page).toContain("signalsProps.onOpenTradeCandidate?.(nextCandidate)");
    expect(page).toContain("ensureTradeCaseForCandidate(tradeCases, nextCandidate)");
    expect(page).toContain('setStep("check")');
    expect(shell).toContain("candidate={effectiveTradeCandidate}");
    expect(shell).toContain("candidate: effectiveTradeCandidate");
    expect(shell).toContain("tradingStepForTradeCase(activeTradeCase.status)");
  });

  it("keeps legacy signals and gate routes grouped under trading", () => {
    const shell = read("src/v2/components/V2Shell.tsx");
    const reports = read("src/v2/components/V2ReportsPage.tsx");

    expect(shell).toContain('page === "trading" || page === "signals" || page === "gate"');
    expect(shell).not.toContain(') : page === "gate" ? (');
    expect(reports).toContain('mode?: "reports" | "trading"');
    expect(reports).toContain('mode === "trading" ? "is-trading-workspace"');
  });

  it("moves a saved decision to the journal while preserving manual execution", () => {
    const page = read("src/v2/components/V2TradingPage.tsx");
    const gate = read("src/v2/components/V2GatePage.tsx");

    expect(page).toContain("gateProps.onSaveDecision?.({ ...draft, tradeCaseId: tradeCase.tradeCaseId })");
    expect(page).toContain('setStep(blocked ? "check" : "journal")');
    expect(gate).toContain("Биржевую лимитку нужно поставить вручную");
    expect(gate).toContain("не исполняет сделки");
  });

  it("keeps the complete trade-case lifecycle explicit and links the final review", () => {
    const page = read("src/v2/components/V2TradingPage.tsx");
    const shell = read("src/v2/components/V2Shell.tsx");

    [
      "IDEA",
      "CHECKING",
      "WATCHING",
      "DECISION_READY",
      "ORDER_PLACED",
      "WAITING",
      "FILLED",
      "CANCELLED",
      "REVIEWED",
    ].forEach((status) => expect(page).toContain(status));
    expect(page).toContain("transactionJournalId");
    expect(page).toContain("Подтвердить исполнение");
    expect(shell).toContain("readTradeCaseStore(profileKeySuffix)");
    expect(shell).toContain("setTradeCandidate(null)");
    expect(shell).toContain("tradeCaseIdByTransaction");
    expect(shell).toContain('status: "REVIEWED"');
  });
});
