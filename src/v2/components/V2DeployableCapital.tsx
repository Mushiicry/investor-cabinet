import type { CSSProperties } from "react";
import { buildFearGreedStrategy } from "../../lib/fearGreedStrategy";
import { RESERVE_TARGET_SHARE } from "../../config/riskRules";
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
  // 4. Резерв — 30% от вложенного, хранится отдельно (кошелёк USDT в сети BNB). Сейчас пуст.
  const reserveTarget = portfolio.totalInvested * RESERVE_TARGET_SHARE;
  const reserveHeld = 0;
  // 3. Спот — всё, что остаётся свободным после фьючерсов, стратегии и резерва
  const spotCash = Math.max(freeCash - futuresCash - strategyCash - reserveHeld, 0);

  const rows: Array<{
    label: string;
    value: number;
    glyph: string;
    color: string;
    note: string;
    danger?: boolean;
  }> = [
    {
      label: "Фьючи",
      value: futuresCash,
      glyph: "↗",
      color: "#8f9ff0",
      note: "на Hyperliquid",
    },
    {
      label: "Стратегия",
      value: strategyCash,
      glyph: "⚡",
      color: "#5fe0cf",
      note: "3 ступени по индексу",
    },
    {
      label: "Спот",
      value: spotCash,
      glyph: "○",
      color: "#56d8f5",
      note: "можно в работу на споте",
    },
    {
      label: "Резерв",
      value: reserveHeld,
      glyph: "◆",
      color: "#ff5d6c",
      note: `цель 30% · ${money.format(reserveTarget)} · нет резерва`,
      danger: true,
    },
  ];

  const maxValue = Math.max(...rows.map((r) => r.value), 1);

  return (
    <section className="v2-panel v2-allocation">
      <div className="v2-panel-header">
        <span>Свободные деньги</span>
        <strong className="v2-stables-total">{money.format(freeCash)}</strong>
      </div>
      <div className="v2-alloc-kicker">из них в работу: фьючи · стратегия · спот</div>

      <div className="v2-alloc-cards">
        {rows.map((row) => {
          const fill = Math.max(0, Math.min(100, (row.value / maxValue) * 100));
          return (
            <div
              className={`v2-alloc-card${row.danger ? " is-danger" : ""}`}
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
                <div className="v2-alloc-sub">
                  <span className="v2-alloc-amount">{row.note}</span>
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
