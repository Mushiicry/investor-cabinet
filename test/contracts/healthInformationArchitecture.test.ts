import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("health information architecture", () => {
  it("keeps the approved vertical order", () => {
    const health = read("src/v2/components/V2HealthPage.tsx");
    const anchors = [
      "<V2PortfolioAlertsPanel",
      'aria-label="Командный диагноз здоровья"',
      'aria-label="Механика здоровья"',
      'aria-label="ДНК инвестора"',
      'aria-label="Капитал и выживаемость"',
      'aria-label="Симулятор здоровья"',
      'aria-label="Стратегия и лимиты"',
      'aria-label="Психология и дисциплина"',
    ];

    let previous = -1;
    anchors.forEach((anchor) => {
      const index = health.indexOf(anchor);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    });
  });

  it("orders title-only signals by severity without horizontal scrolling", () => {
    const alertsPanel = read("src/v2/components/V2PortfolioAlertsPanel.tsx");
    const styles = read("src/v2/styles/v2-btc-chart.css");
    const mobile = read("src/v2/styles/v2-mobile.css");

    expect(alertsPanel).toContain("Сигналы и рекомендации");
    expect(alertsPanel).toContain('critical: "Тревоги"');
    expect(alertsPanel).toContain('warning: "Требует внимания"');
    expect(alertsPanel).toContain('info: "Рекомендации и сигналы"');
    expect(alertsPanel).not.toContain("v2-alert-group-head");
    expect(alertsPanel).not.toContain("v2-alert-summary");
    expect(alertsPanel).not.toContain("shortAlertText");
    expect(alertsPanel).not.toContain("v2-alerts-row");
    expect(alertsPanel).toContain("GROUP_COLUMN_LIMIT");
    expect(alertsPanel).toContain("critical: 5");
    expect(alertsPanel).toContain("compactAlertTitle(alert)");
    expect(styles).toContain("grid-template-columns: repeat(var(--alert-columns), minmax(0, 1fr))");
    expect(styles).toMatch(/\.v2-hp-alert-system \{[\s\S]*?border: 0;[\s\S]*?background: transparent;/);
    expect(mobile).toContain(".v2-alert-group.level-critical .v2-alert-group-grid");
  });

  it("opens the full signal and its concrete action from the compact card", () => {
    const alertsPanel = read("src/v2/components/V2PortfolioAlertsPanel.tsx");
    const shell = read("src/v2/components/V2Shell.tsx");

    expect(alertsPanel).toContain("setSelectedAlert(alert)");
    expect(alertsPanel).toContain('className="v2-alert-detail-overlay"');
    expect(alertsPanel).toContain("{selectedAlert.detail}");
    expect(alertsPanel).toContain("{selectedAlert.action} →");
    expect(shell).toContain('if (alert.action === "Поставить лимитки вручную")');
    expect(shell).toContain('if (alert.action === "Сократить позицию")');
  });

  it("removes trading and market context from Health without removing the execution reminder", () => {
    const health = read("src/v2/components/V2HealthPage.tsx");
    const scenarios = read("src/v2/components/V2ScenariosHubPage.tsx");
    const alerts = read("src/v2/lib/portfolioAlerts.ts");

    expect(health).toContain('alert.id.startsWith("signal-")');
    expect(health).toContain('alert.id.startsWith("market-psychology-")');
    expect(health).not.toContain("activeSignalRows");
    expect(health).not.toContain("interestSignals");
    expect(alerts).toContain('id: "exchange-limit-orders-unconfirmed"');
    expect(scenarios).toContain('aria-label="Рыночный контекст"');
  });

  it("keeps the visible DNA figure as the entry to the full embedded DNA", () => {
    const health = read("src/v2/components/V2HealthPage.tsx");

    expect(health).toContain("dna-risk-readiness.webp");
    expect(health).toContain('className="v2-hp-dna-figure"');
    expect(health).toContain('aria-controls="investor-dna-content"');
    expect(health).toContain('id="investor-dna-content"');
    expect(health).toContain("<V2InvestorDNAPage");
  });

  it("keeps the health score centered between status and permission", () => {
    const styles = read("src/v2/styles/v2-btc-chart.css");

    expect(styles).toContain('grid-template-areas: "status score permission"');
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr) 280px minmax(0, 1fr)");
    expect(styles).toMatch(/\.v2-hp-command-score \{[\s\S]*?grid-area: score;/);
    expect(styles).toMatch(/\.v2-hp-command-main \{[\s\S]*?grid-area: status;/);
    expect(styles).toMatch(/\.v2-hp-command-side \{[\s\S]*?grid-area: permission;/);
    expect(styles).toMatch(/\.v2-hp-command-card \{[\s\S]*?border: 0;[\s\S]*?background: transparent;/);
    expect(styles).toMatch(/\.v2-hp-command-score,[\s\S]*?\.v2-hp-command-side \{[\s\S]*?border: 0;[\s\S]*?background: transparent;/);
  });

  it("does not repeat an active-trading alert inside permission rows", () => {
    const health = read("src/v2/components/V2HealthPage.tsx");

    expect(health).toContain('alert.id === "health-recommendation-risk"');
    expect(health).toContain('permissionRows.filter((row) => row.label !== "Фьючерсы")');
    expect(health).toContain("visiblePermissionRows.map((row)");
  });

  it("keeps the capital ladder only on Overview", () => {
    const health = read("src/v2/components/V2HealthPage.tsx");
    const shell = read("src/v2/components/V2Shell.tsx");

    expect(health).not.toContain("<V2CapitalLadder");
    expect(shell).toContain("<V2CapitalLadder portfolio={behaviorPortfolio} strategy={data.strategy}");
  });
});
