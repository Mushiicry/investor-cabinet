import type { CSSProperties } from "react";
import { buildFearGreedStrategy } from "../../lib/fearGreedStrategy";
import type { FearGreedStrategy } from "../../types/portfolio";
import type { V2Portfolio } from "../InvestorCabinetV2Lab";

const RESERVE_TARGET_PCT = 0.30;

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

  const freeCash =
    portfolio.stableReserve || portfolio.spotDeployable + portfolio.futuresDeployable;

  const futuresCash = portfolio.futuresDeployable;
  const strategyCash = activeStrategy.rules
    .filter((row) => row.buyPct > 0 && row.status !== "cooldown")
    .reduce((sum, row) => sum + row.buyAmount, 0);
  const spotCash = Math.max(freeCash - futuresCash - strategyCash, 0);

  // Чистый резерв — что не распределено ни под фьючи, ни под стратегию, ни под спот
  const pureReserve = Math.max(freeCash - futuresCash - strategyCash - spotCash, 0);
  const totalPortfolio = portfolio.totalPortfolioValue || 0;
  const reserveTarget = totalPortfolio * RESERVE_TARGET_PCT;
  const reserveShort = pureReserve < reserveTarget;

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

        {/* Строка резерва — всегда показываем, красная варнинг если ниже цели */}
        <div className={`v2-alloc-card v2-reserve-row ${reserveShort ? "is-danger" : "is-ok"}`}>
          <span className="v2-alloc-icon v2-reserve-icon" aria-hidden="true">
            {reserveShort ? "⚠" : "◈"}
          </span>
          <div className="v2-alloc-main">
            <div className="v2-alloc-line">
              <span className="v2-alloc-name">
                Резерв
                <span className="v2-reserve-target"> · цель 30%</span>
              </span>
              <strong className="v2-alloc-pct">{money.format(pureReserve)}</strong>
            </div>
            {reserveShort && (
              <div className="v2-reserve-warning">
                ⚠ Опасно — резерв не сформирован. Нужно {money.format(reserveTarget)}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
