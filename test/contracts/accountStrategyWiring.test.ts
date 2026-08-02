import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("account strategy wiring", () => {
  it("passes the selected V2 account strategy through shell surfaces", () => {
    const shell = read("src/v2/components/V2Shell.tsx");
    const lab = read("src/v2/InvestorCabinetV2Lab.tsx");

    expect(lab).toContain("investorDataReady");
    expect(lab).toContain("!configured || (!authLoading && Boolean(user))");
    expect(lab).toContain("const { accessToken, configured, loading: authLoading, user } = useAuth()");
    expect(lab).toContain("accessToken,");
    expect(lab).toContain("useInvestorData(");
    expect(shell).toContain("<V2SignalsPage");
    expect(shell).toContain("strategy={data.strategy}");
    expect(shell).toContain("<V2GatePage");
    expect(shell).toContain("<V2RiskEnginePage");
    expect(shell).toContain("<V2PortfolioAllocationCard");
    expect(shell).toContain("investorStrategy={data.strategy}");
    expect(shell).toContain("<V2CapitalLadder portfolio={behaviorPortfolio} strategy={data.strategy}");
  });

  it("keeps strategy-aware props typed separately from fear-and-greed strategy props", () => {
    expect(read("src/v2/components/V2DeployableCapital.tsx")).toContain("investorStrategy?: InvestorStrategy");
    expect(read("src/v2/components/V2DCAStrategy.tsx")).toContain("investorStrategy?: InvestorStrategy");
    expect(read("src/v2/components/V2GatePage.tsx")).toContain("strategy?: InvestorStrategy");
  });

  it("uses account strategy limits in the pre-trade gate instead of raw market phase limits", () => {
    const gate = read("src/v2/components/V2GatePage.tsx");

    expect(gate).toContain("effectiveReserveFloorShare");
    expect(gate).toContain("effectiveCryptoMaxShare");
    expect(gate).toContain("effectiveSpotReserveFloorShare");
    expect(gate).toContain("spotDeployable: gateSpotDeployable");
    expect(gate).toContain("reserveFloorShare: effectiveReserveFloorShare");
    expect(gate).toContain("cryptoMaxShare: effectiveCryptoMaxShare");
    expect(gate).not.toContain("резерв ≥ {pct(phase.reserveFloorShare)}");
    expect(gate).not.toContain("{pct(phase.cryptoMaxShare)}");
    expect(gate).not.toContain("сверх {pct(SPOT_RESERVE_FLOOR_SHARE)}-резерва");
  });

  it("uses account strategy limits on risk and signals surfaces", () => {
    const risk = read("src/v2/components/V2RiskEnginePage.tsx");
    const signals = read("src/v2/components/V2SignalsPage.tsx");
    const alerts = read("src/v2/lib/portfolioAlerts.ts");

    expect(risk).toContain("allocationLimit(item.name, strategy)");
    expect(risk).toContain("strategy.reserveTargetShare");
    expect(risk).toContain("strategy.futuresAllowed");
    expect(risk).not.toContain("Крипта:           { limit: 0.6");
    expect(risk).not.toContain("const reserveTarget = 30");
    expect(signals).toContain("strategy,");
    expect(alerts).toContain("strategy.cryptoMaxShare");
    expect(alerts).toContain("strategy.reserveTargetShare");
    expect(alerts).not.toContain("MAX_CRYPTO_EXPOSURE_SHARE");
    expect(alerts).not.toContain("RESERVE_TARGET_SHARE");
  });

  it("hides futures-only UI surfaces when the selected strategy forbids futures", () => {
    const portfolio = read("src/v2/components/V2PortfolioPage.tsx");
    const signals = read("src/v2/components/V2SignalsPage.tsx");
    const healthCore = read("src/v2/components/V2HealthCore.tsx");

    expect(portfolio).toContain("strategy?.futuresAllowed !== false || group.category !== \"Фьючерсы\"");
    expect(portfolio).toContain("visibleGroups.map");
    expect(portfolio).not.toContain("GROUPS.map");
    expect(signals).toContain("marketRows");
    expect(signals).toContain("strategy?.futuresAllowed === false");
    expect(signals).not.toContain("[\n              { label: \"Здоровье портфеля\"");
    expect(healthCore).toContain("c.label === \"Качество активов\"");
    expect(healthCore).not.toContain("const labelLines = c.key === \"futures\" ? [\"Контроль\", \"риска\"] : [label]");
  });

  it("prints the selected investment strategy on the health page", () => {
    const healthPage = read("src/v2/components/V2HealthPage.tsx");
    const styles = read("src/v2/styles/v2-btc-chart.css");

    expect(healthPage).toContain("function StrategyPolicyCard");
    expect(healthPage).toContain("Инвестиционная стратегия");
    expect(healthPage).toContain("strategy.cryptoMaxShare");
    expect(healthPage).toContain("strategy.reserveFloorShare");
    expect(healthPage).toContain("strategy.futuresAllowed");
    expect(healthPage).toContain("strategyCryptoRows(strategy)");
    expect(healthPage).toContain("<V2CapitalLadder portfolio={portfolio} mode=\"health\" strategy={strategy}");
    expect(styles).toContain(".v2-hp-policy-card");
    expect(styles).toContain(".v2-hp-policy-grid");
  });

  it("keeps Polina reports and concentration risk grounded in account strategy data", () => {
    const labData = read("src/v2/lib/v2LabData.ts");

    expect(labData).toContain("history: slot === \"wife\" ? state.history : mergeWithLocalSnapshots(state.history, slot)");
    expect(labData).toContain("concentration.maxUtilization > 1");
    expect(labData).toContain("concentration.maxUtilization >= 0.85");
  });
});
