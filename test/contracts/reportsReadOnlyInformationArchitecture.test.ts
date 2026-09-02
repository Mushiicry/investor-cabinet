import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("reports and trading information architecture", () => {
  it("keeps operational journal writes inside Trading", () => {
    const shell = read("src/v2/components/V2Shell.tsx");
    const reportsStart = shell.indexOf(') : page === "reports" ? (');
    const portfolioStart = shell.indexOf(') : page === "portfolio" ? (', reportsStart);
    const reportsBranch = shell.slice(reportsStart, portfolioStart);

    expect(reportsStart).toBeGreaterThan(-1);
    expect(portfolioStart).toBeGreaterThan(reportsStart);
    expect(reportsBranch).not.toContain("onDeleteDecision=");
    expect(reportsBranch).not.toContain("onSaveTradeReview=");
    expect(reportsBranch).not.toContain("decisionJournal=");
    expect(reportsBranch).not.toContain("traderJournal=");
    expect(reportsBranch).not.toContain("tradeCaseIdByTransaction=");

    const tradingStart = shell.indexOf("reportsProps={{");
    const tradingEnd = shell.indexOf("}}\n          />", tradingStart);
    const tradingReportsProps = shell.slice(tradingStart, tradingEnd);
    expect(tradingReportsProps).toContain("onDeleteDecision: handleDeleteDecision");
    expect(tradingReportsProps).toContain("onSaveTradeReview: handleSaveTradeReview");
  });

  it("renders both trading journals only inside Trading", () => {
    const reports = read("src/v2/components/V2ReportsPage.tsx");
    const traderPanel = reports.indexOf('className="v2-panel v2-rep-journal-panel v2-rep-trader-panel"');
    const decisionPanel = reports.indexOf('className="v2-panel v2-rep-journal-panel v2-rep-decision-panel"');
    const traderGuard = reports.lastIndexOf("{editable && (", traderPanel);
    const decisionGuard = reports.lastIndexOf("{editable && (", decisionPanel);

    expect(reports).toContain('const editable = mode === "trading"');
    expect(traderPanel).toBeGreaterThan(-1);
    expect(decisionPanel).toBeGreaterThan(traderPanel);
    expect(traderGuard).toBeGreaterThan(-1);
    expect(decisionGuard).toBeGreaterThan(traderPanel);
    expect(traderPanel - traderGuard).toBeLessThan(100);
    expect(decisionPanel - decisionGuard).toBeLessThan(100);
    expect(reports).toContain("{editable && isOpen && reviewDraft && (");
    expect(reports).toContain("{editable && onDeleteDecision && (");
    expect(reports).not.toContain("{!editable && isOpen && review && (");
    expect(reports).not.toContain('aria-label="Завершённый разбор сделки"');
    expect(reports).not.toContain('Разбор — во вкладке «Торговля»');
    expect(reports).not.toContain('"Посмотреть"');
  });

  it("distinguishes stable TradeCase links from legacy fallback matches", () => {
    const reports = read("src/v2/components/V2ReportsPage.tsx");

    expect(reports).toContain('entry.tradeCaseId === tradeCaseId');
    expect(reports).toContain('linkedByTradeCaseId ? "Связан по ID"');
    expect(reports).toContain('decision ? "Приблизительное совпадение" : "Без допуска"');
    expect(reports).toContain('entry.tradeCaseId ? `TradeCase · ${entry.tradeCaseId}` : "Legacy запись · приблизительная связь"');
  });
});
