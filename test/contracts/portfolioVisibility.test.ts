import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { V2Position } from "../../src/v2/InvestorCabinetV2Lab";
import { V2PortfolioPage } from "../../src/v2/components/V2PortfolioPage";
import { isObservationPortfolioPosition, isVisiblePortfolioPosition } from "../../src/v2/lib/portfolioVisibility";
import { MAIN_INVESTOR_STRATEGY, WIFE_INVESTOR_STRATEGY } from "../../src/v2/lib/investorStrategy";

const position = (patch: Partial<V2Position> = {}): V2Position => ({
  asset: "MNT LONG", category: "Фьючерсы", avgEntry: 0, currentPrice: 0.53,
  invested: 0, value: 0, pnl: 0, pnlPct: 0, share: 0, status: "CLOSED",
  ...patch,
});

describe("portfolio position visibility", () => {
  it("marks invested amounts below one dollar as observation regardless of API status", () => {
    for (const status of ["CLOSED", "EXITED", "FIXED", "WATCH", " wait_rebuy ", "WAIT_ENTRY", "Speculation", "OPEN", ""]) {
      for (const invested of [0, 0.01, 0.99]) {
        expect(isObservationPortfolioPosition(position({ category: "Крипта", status, invested }))).toBe(true);
      }
    }
    expect(isObservationPortfolioPosition(position({ category: "Crypto", invested: 0.01 }))).toBe(true);
    for (const invested of [1, 31, -0.01, NaN, Infinity]) {
      expect(isObservationPortfolioPosition(position({ category: "Крипта", invested }))).toBe(false);
    }
  });

  it.each(["Крипта", "Crypto", "Металлы", "Акции", "Фьючерсы", "Свободные деньги", "Новая категория"])(
    "uses the same invested threshold for %s regardless of asset or market value",
    (category) => {
      for (const invested of [0, 0.01, 0.999, 1, 1.001, 40]) {
        for (const value of [0, 0.5, 1, 100]) {
          const row = position({ asset: "NEW_ASSET", category, value, invested, currentPrice: 1000 });
          expect(isObservationPortfolioPosition(row)).toBe(invested < 1);
        }
      }
    },
  );

  it.each(["Крипта", "Металлы", "Акции", "Фьючерсы", "Свободные деньги"])(
    "wires observation into rendered %s rows and restores normal styling at one dollar",
    (category) => {
      const row = Object.freeze(position({ asset: "NEW_ASSET", category, value: 0.5, invested: 0.25 }));
      const render = (value: V2Position) => renderToStaticMarkup(createElement(V2PortfolioPage, { positions: [value], playbook: [] }));
      const html = render(row);
      expect(html).toContain("NEW_ASSET");
      expect(html).toContain("is-observing");
      expect(html).toContain("Наблюдение");
      expect(html).toContain("0,50");
      expect(html).toContain("вложено меньше $1");
      expect(render({ ...row, invested: 1 })).not.toContain("is-observing");
      expect(render({ ...row, invested: 1 })).not.toContain("Наблюдение");
      expect(render({ ...row, value: 100 })).toContain("is-observing");
      expect(row.value).toBe(0.5);
      expect(row.invested).toBe(0.25);
    },
  );

  it("renders BNB and ETH dust identically without hiding balances or dimming ATOM", () => {
    const render = (row: V2Position) => renderToStaticMarkup(createElement(V2PortfolioPage, { positions: [row], playbook: [] }));
    const eth = position({ asset: "ETH", category: "Крипта", value: 0.01 });
    const html = render(eth);
    expect(html).toContain("is-observing");
    expect(html).toContain("Наблюдение");
    expect(html).toContain("Ethereum");
    expect(html).toContain("0,01");
    expect(render({ ...eth, invested: 1 })).not.toContain("is-observing");
    const bnbHtml = render({ ...eth, asset: "BNB", invested: 0.58, value: 0.68, status: "Speculation" });
    expect(bnbHtml).toContain("is-observing");
    expect(bnbHtml).toContain("Наблюдение");
    expect(bnbHtml).toContain("0,68");
    expect(render({ ...eth, asset: "ATOM", invested: 40.47, value: 31 })).not.toContain("is-observing");
    expect(render(position({ asset: "BTC SHORT", value: 0.01 }))).toContain("is-observing");
    expect(render({ ...eth, asset: "SOL", value: 1.24, invested: 0.93 })).toContain("is-observing");
    expect(render({ ...eth, asset: "ATOM", invested: 40.47, value: 0.5 })).not.toContain("is-observing");
  });

  it("keeps unbought gold visible in observation and restores its normal appearance from one dollar", () => {
    const gold = position({ asset: "GOLD", category: "Металлы" });
    const render = (row: V2Position) => renderToStaticMarkup(createElement(V2PortfolioPage, { positions: [row], playbook: [] }));
    const html = render(gold);
    expect(html).toContain("GOLD");
    expect(html).toContain("is-observing");
    expect(html).toContain("Наблюдение");
    expect(render({ ...gold, value: 1, invested: 1 })).not.toContain("is-observing");
  });

  it("hides fully zeroed futures even while their market price updates", () => {
    for (const asset of ["MNT LONG", "CAKE LONG", "HYPE LONG", "BLUR LONG"]) {
      expect(isVisiblePortfolioPosition(position({ asset }))).toBe(false);
    }
    expect(isVisiblePortfolioPosition(position({ status: "Speculation" }))).toBe(false);
  });

  it("keeps exposure, margin and PnL even if the CLOSED label is stale", () => {
    for (const patch of [{ value: 33.2 }, { value: -2 }, { invested: 10 }, { pnl: -5 }, { value: 0.00001 }]) {
      expect(isVisiblePortfolioPosition(position(patch))).toBe(true);
    }
  });

  it("does not hide metals, stocks or futures cash", () => {
    for (const category of ["Металлы", "Акции", "Свободные деньги"]) {
      expect(isVisiblePortfolioPosition(position({ category }))).toBe(true);
    }
  });

  it("hides any zeroed spot altcoin, not only APEX", () => {
    for (const asset of ["APEX", "ATOM", "INJ", "SEI", "NEWCOIN"]) {
      for (const category of ["Крипта", "Crypto"]) {
        expect(isVisiblePortfolioPosition(position({ asset, category }))).toBe(false);
      }
    }
  });

  it("keeps the strategy core even with zero balances", () => {
    for (const asset of ["BTC", "ETH", "SOL", "TON", "BNB", "GRAM", " btc "]) {
      expect(isVisiblePortfolioPosition(position({ asset, category: "Крипта" }))).toBe(true);
    }
    const bnb = position({ asset: "BNB", category: "Крипта" });
    expect(isVisiblePortfolioPosition(bnb, WIFE_INVESTOR_STRATEGY)).toBe(false);
    const customStrategy = { ...MAIN_INVESTOR_STRATEGY, cryptoAssetLimits: { ...MAIN_INVESTOR_STRATEGY.cryptoAssetLimits, INJ: 0.05 } };
    expect(isVisiblePortfolioPosition(position({ asset: "INJ", category: "Крипта" }), customStrategy)).toBe(true);
  });

  it("keeps active and partially sold altcoins even with a stale CLOSED status", () => {
    for (const patch of [{ value: 31 }, { value: 0.00001 }, { invested: 10 }, { pnl: -2 }]) {
      expect(isVisiblePortfolioPosition(position({ asset: "ATOM", category: "Крипта", ...patch }))).toBe(true);
    }
  });

  it("renders open positions and core coins without mutating the source", () => {
    const positions = Object.freeze([
      Object.freeze(position({ asset: "BTC SHORT", invested: 39.7, value: 33.2, pnl: -6.5 })),
      Object.freeze(position({ asset: "BLUR LONG" })),
      Object.freeze(position({ asset: "APEX", category: "Крипта" })),
      Object.freeze(position({ asset: "BTC", category: "Крипта" })),
      Object.freeze(position({ asset: "ATOM", category: "Крипта", value: 31, invested: 40 })),
    ]);
    const html = renderToStaticMarkup(createElement(V2PortfolioPage, { positions: [...positions], playbook: [] }));
    expect(html).toContain("BTC SHORT");
    expect(html).not.toContain("BLUR LONG");
    expect(html).not.toContain("APEX");
    expect(html).toContain("BTC");
    expect(html).toContain("Cosmos");
    expect(positions).toHaveLength(5);
  });

  it("automatically shows a repurchased altcoin and applies the account strategy in the page", () => {
    const closed = position({ asset: "APEX", category: "Крипта" });
    const render = (row: V2Position, strategy = MAIN_INVESTOR_STRATEGY) =>
      renderToStaticMarkup(createElement(V2PortfolioPage, { positions: [row], playbook: [], strategy }));
    expect(render(closed)).not.toContain("APEX");
    expect(render({ ...closed, value: 5, invested: 5 })).toContain("APEX");
    const bnb = position({ asset: "BNB", category: "Крипта" });
    expect(render(bnb)).toContain("BNB");
    expect(render(bnb, WIFE_INVESTOR_STRATEGY)).not.toContain("BNB");
  });

  it("hides the empty futures section and shows a reopened position automatically", () => {
    const closed = position({ asset: "BLUR LONG" });
    const render = (row: V2Position) => renderToStaticMarkup(createElement(V2PortfolioPage, { positions: [row], playbook: [] }));
    expect(render(closed)).not.toContain("Фьючи");
    const reopened = render({ ...closed, value: 10, invested: 10 });
    expect(reopened).toContain("Фьючи");
    expect(reopened).toContain("BLUR LONG");
  });
});
