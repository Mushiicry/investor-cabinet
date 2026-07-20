import { describe, expect, it } from "vitest";
import { calculateFuturesMarginShare } from "../../src/lib/riskExposure";
import type { PositionCalculated } from "../../src/types/portfolio";

// Спекулятивный лимит 10% капитала (манифест) считается по ВСЕМУ, что уже
// выделено под спекуляцию: маржа открытых фьючерсов + свободная маржа на
// Hyperliquid. GOLD (плечо на HL, но категория «Металлы») в лимит НЕ входит.
const pos = (
  over: Partial<PositionCalculated> & Pick<PositionCalculated, "asset" | "category">,
): PositionCalculated => ({
  quantity: 1,
  avgEntry: 0,
  currentPrice: 0,
  status: "HOLD",
  invested: 0,
  currentValue: 0,
  pnl: 0,
  pnlPct: 0,
  share: 0,
  ...over,
});

describe("futures 10% limit — что входит в спекулятивную нагрузку", () => {
  // Капитал (вложено) = 10.3 + 18 + 30 + 545.5 = 603.8 — как в живом портфеле.
  const portfolio: PositionCalculated[] = [
    pos({ asset: "MNT LONG", category: "Фьючерсы", invested: 10.3, currentValue: 6.77 }),
    pos({ asset: "USDC HL", category: "Свободные деньги", invested: 18, currentValue: 18 }),
    pos({ asset: "GOLD LONG", category: "Металлы", invested: 30, currentValue: 24.8 }),
    pos({ asset: "ETH", category: "Крипта", invested: 545.5, currentValue: 520 }),
  ];

  it("считает маржу открытых фьючерсов И свободную маржу HL", () => {
    // (10.3 + 18) / 603.8 = 4.69%
    expect(calculateFuturesMarginShare(portfolio)).toBeCloseTo(0.0469, 3);
  });

  it("свободная маржа HL действительно учтена (без неё было бы 1.7%)", () => {
    const withoutHl = portfolio.filter((p) => p.asset !== "USDC HL");
    // Тот же портфель без USDC HL: 10.3 / 585.8 = 1.76% — заметно ниже.
    expect(calculateFuturesMarginShare(withoutHl)).toBeLessThan(0.02);
  });

  it("GOLD (плечо, но «Металлы») в лимит 10% НЕ входит", () => {
    const noGold = portfolio.filter((p) => p.asset !== "GOLD LONG");
    // Убрали GOLD из активов → доля выросла только за счёт меньшего капитала,
    // но сам GOLD маржой не считался: (10.3+18)/573.8 = 4.93%, не 9.7%.
    expect(calculateFuturesMarginShare(noGold)).toBeLessThan(0.06);
  });

  it("нет спекулятивных позиций и маржи — 0", () => {
    expect(
      calculateFuturesMarginShare([pos({ asset: "ETH", category: "Крипта", invested: 100, currentValue: 100 })]),
    ).toBe(0);
  });

  it("закрытая фьючерс-позиция (currentValue 0) не считается", () => {
    const closed: PositionCalculated[] = [
      pos({ asset: "BTC SHORT", category: "Фьючерсы", invested: 50, currentValue: 0 }),
      pos({ asset: "ETH", category: "Крипта", invested: 100, currentValue: 100 }),
    ];
    expect(calculateFuturesMarginShare(closed)).toBe(0);
  });
});
