import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("portfolio TradingView chart link", () => {
  it("adds a dedicated compact chart column and maps the current TON row to GRAM", () => {
    const page = read("src/v2/components/V2PortfolioPage.tsx");
    const chart = read("src/v2/components/V2PortfolioMiniChart.tsx");
    const styles = read("src/v2/styles/v2-portfolio.css");

    expect(page).toContain("TRADINGVIEW_CHARTS");
    expect(page).toContain('url: "https://ru.tradingview.com/chart/?symbol=OKX%3AGRAMUSDT"');
    expect(page).toContain('TON: {\n    symbol: "GRAM"');
    expect(page).toContain('ATOM: {\n    symbol: "ATOM"');
    expect(page).toContain('url: "https://ru.tradingview.com/chart/?symbol=BINANCE%3AATOMUSDT"');
    expect(page).toContain('SOL: {\n    symbol: "SOL"');
    expect(page).toContain('url: "https://ru.tradingview.com/chart/?symbol=BINANCE%3ASOLUSDT"');
    expect(page).toContain('url: "https://ru.tradingview.com/chart/?symbol=BINANCE%3ABNBUSDT"');
    expect(page).toContain('url: "https://ru.tradingview.com/chart/?symbol=BINANCE%3ABTCUSDT"');
    expect(page).toContain('url: "https://ru.tradingview.com/chart/?symbol=BINANCE%3AETHUSDT"');
    expect(page).toContain('url: "https://ru.tradingview.com/chart/?symbol=BYBIT%3AAPEXUSDT"');
    expect(page).toContain('url: "https://ru.tradingview.com/chart/?symbol=BYBIT%3AMNTUSDT"');
    expect(page).toContain('url: "https://ru.tradingview.com/chart/?symbol=BINANCE%3ACAKEUSDT"');
    expect(page).toContain('url: "https://ru.tradingview.com/chart/?symbol=PEPPERSTONE%3AXAUUSD"');
    expect(page).toContain('url: "https://ru.tradingview.com/chart/?symbol=BINANCE%3ASPCXBUSDT"');
    expect(chart).toContain('rel="noopener noreferrer"');
    expect(page).toContain('<TradingViewChartLink asset={position.asset} />');
    expect(page).toContain("<V2PortfolioMiniChart");
    expect(styles).toContain("grid-template-columns: 280px 210px minmax(0, 1fr)");
    expect(styles).toContain(".v2-port-chart-link");
  });
});
