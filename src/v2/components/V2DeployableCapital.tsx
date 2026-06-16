import type { CSSProperties } from "react";
import { buildFearGreedStrategy } from "../../lib/fearGreedStrategy";
import type { FearGreedStrategy } from "../../types/portfolio";
import type { V2Portfolio } from "../InvestorCabinetV2Lab";

type Props = {
  portfolio: V2Portfolio;
  strategy: FearGreedStrategy;
};

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function V2DeployableCapital({ portfolio, strategy }: Props) {
  const activeStrategy = buildFearGreedStrategy(
    strategy.currentIndex,
    portfolio.totalPortfolioValue || strategy.portfolioValue || 0,
    strategy.rules
  );

  // Полная сумма незадействованных стейблов (= категория «Свободные деньги» в распределении)
  const freeCash =
    portfolio.stableReserve || portfolio.spotDeployable + portfolio.futuresDeployable;

  // 1. Фьючи — всё свободное USDC на Hyperliquid
  const futuresCash = portfolio.futuresDeployable;
  // 2. Стратегия — USDC, заложенные на полный цикл откупа в 3 ступени (20-29 / 15-19 / 0-14)
  const strategyCash = activeStrategy.rules
    .filter((row) => row.buyPct > 0)
    .reduce((sum, row) => sum + row.buyAmount, 0);
  // 3. Спот — всё, что остаётся свободным после фьючерсов и стратегии
  const spotCash = Math.max(freeCash - futuresCash - strategyCash, 0);

  const rows: Array<{
    label: string;
    value: number;
    glyph: string;
    color: string;
  }> = [
    { label: "Фьючи", value: futuresCash, glyph: "↗", color: "#8f9ff0" },
    { label: "Стратегия", value: strategyCash, glyph: "⚡", color: "#5fe0cf" },
    { label: "Спот", value: spotCash, glyph: "○", color: "#56d8f5" },
  ];

  const maxValue = Math.max(...rows.map((r) => r.value), 1);

  return (
    <section className="v2-panel v2-allocation">
      <div className="v2-panel-header">
        <span>Торговый капитал</span>
        <strong className="v2-stables-total">{money.format(freeCash)}</strong>
      </div>
      <div className="v2-alloc-kicker">можно пустить в работу</div>

      <div className="v2-alloc-cards">
        {rows.map((row) => {
          const fill = Math.max(0, Math.min(100, (row.value / maxValue) * 100));
          return (
            <div
              className="v2-alloc-card"
              key={row.label}
              style={{ "--c": row.color } as CSSProperties}
            >
              <span className="v2-alloc-icon" aria-hidden="true">
                {row.glyph}
              </span>
              <div className="v2-alloc-main">
                <div className="v2-alloc-line">
                  <span className="v2-alloc-name">{row.label}</span>
                  <strong className="v2-alloc-pct">{money.format(row.value)}</strong>
                </div>
                <div className="v2-alloc-track">
                  <span className="v2-alloc-fill" style={{ width: `${fill}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
