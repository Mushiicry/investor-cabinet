import { useState, useEffect } from "react";
import { percent } from "../../lib/formatters";
import { buildFearGreedStrategy } from "../../lib/fearGreedStrategy";
import type {
  FearGreedMode,
  FearGreedStrategy,
  FearGreedStrategyLastBuy,
  FearGreedStrategyRule,
} from "../../types/portfolio";
import type { V2Portfolio } from "../InvestorCabinetV2Lab";

// Витринные прошлые покупки (история в контракте отсутствует) — для показа 5 транзакций
const DEMO_PREV_BUYS: FearGreedStrategyLastBuy[] = [
  { mode: "cautious",    range: "20-29", label: "", asset: "ETH", assetPrice: 2156,  buyAmount: 4.89, boughtAt: "2026-05-28T00:00:00" },
  { mode: "strong",      range: "15-19", label: "", asset: "BTC", assetPrice: 64200, buyAmount: 7.51, boughtAt: "2026-05-20T00:00:00" },
  { mode: "cautious",    range: "20-29", label: "", asset: "SOL", assetPrice: 138,   buyAmount: 7.51, boughtAt: "2026-05-01T00:00:00" },
  { mode: "cautious",    range: "20-29", label: "", asset: "ETH", assetPrice: 2400,  buyAmount: 5.20, boughtAt: "2026-04-15T00:00:00" },
];

type Props = {
  portfolio: V2Portfolio;
  strategy: FearGreedStrategy;
  variant?: "full" | "ladder" | "meta";
};

function formatCooldown(hours: number) {
  const totalMins = Math.floor(hours * 60);
  const days = Math.floor(totalMins / (24 * 60));
  const hh = String(Math.floor((totalMins % (24 * 60)) / 60)).padStart(2, "0");
  const mm = String(totalMins % 60).padStart(2, "0");
  return days > 0 ? `${days}:${hh}:${mm}` : `${hh}:${mm}`;
}

function formatBuyPct(value: number) {
  if (!value) return "0%";
  return percent(value, value === 0.015 ? 1 : 0);
}

function formatMoneyDetailed(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function getShortModeLabel(mode: FearGreedMode) {
  if (mode === "cautious") return "Добор";
  if (mode === "strong") return "Усиление";
  if (mode === "aggressive") return "Максимум";
  return "Наблюдение";
}

function getStatusKind(row: FearGreedStrategyRule) {
  if (row.cooldownRemainingHours > 0) return "cooldown";
  if (row.isAvailable) return "available";
  return "passive";
}

function getStatusLabel(row: FearGreedStrategyRule) {
  if (row.cooldownRemainingHours > 0) return formatCooldown(row.cooldownRemainingHours);
  if (row.isAvailable) return "Доступно";
  return "Пассивный";
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}

function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
}

export function V2FearGreedStrategy({ portfolio, strategy, variant = "full" }: Props) {
  useMinuteTick();
  const activeStrategy = buildFearGreedStrategy(
    strategy.currentIndex,
    portfolio.totalPortfolioValue || strategy.portfolioValue || 0,
    strategy.rules
  );
  const lastBuy = strategy.lastBuy ?? activeStrategy.lastBuy;

  const ladder = (
    <div className="v2-fg-rule-table" aria-label="Fear and Greed strategy rules">
      {activeStrategy.rules.map((row) => (
        <div
          key={row.mode}
          className={[
            "v2-fg-rule",
            `v2-fg-rule-${row.mode}`,
            row.isCurrent && row.cooldownRemainingHours <= 0 ? "is-active" : "",
            row.isCurrent && row.cooldownRemainingHours > 0 ? "is-cooldown-row" : "",
          ].filter(Boolean).join(" ")}
        >
          <div className="v2-fg-rule-range">
            <span className="v2-fg-rule-dot" aria-hidden="true" />
            <span>{row.range}</span>
          </div>
          <strong>{getShortModeLabel(row.mode)}</strong>
          <span>{formatBuyPct(row.buyPct)}</span>
          <span>{formatMoneyDetailed(row.buyAmount)}</span>
          <span className={`v2-fg-rule-status is-${getStatusKind(row)}`}>
            {getStatusLabel(row)}
          </span>
        </div>
      ))}
    </div>
  );

  const recentBuys = (lastBuy ? [lastBuy, ...DEMO_PREV_BUYS] : DEMO_PREV_BUYS).slice(0, 5);

  const meta = (
    <div className="v2-lastbuys">
      <div className="v2-lastbuys-head">
        <span className="v2-panel-kicker">Последние покупки по стратегии</span>
      </div>
      {recentBuys.length ? (
        <div className="v2-lastbuys-list">
          {recentBuys.map((buy, index) => (
            <div className={`v2-buy-row${index === 0 ? " is-latest" : ""}`} key={`${buy.boughtAt}-${buy.asset}`}>
              <span className="v2-buy-dot" aria-hidden="true" />
              <span className="v2-buy-asset">{buy.asset || "—"}</span>
              <span className="v2-buy-mode">{getShortModeLabel(buy.mode)} · {buy.range}</span>
              <span className="v2-buy-amount">{formatMoneyDetailed(buy.buyAmount)}</span>
              <span className="v2-buy-date">{formatShortDate(buy.boughtAt)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="v2-fg-last-buy-empty">Покупок по стратегии еще нет</div>
      )}
    </div>
  );

  if (variant === "ladder") {
    return <section className="v2-panel v2-fg-ladder-panel">{ladder}</section>;
  }

  if (variant === "meta") {
    return <section className="v2-panel v2-fg-meta-panel">{meta}</section>;
  }

  return (
    <section className="v2-panel v2-fg-strategy-panel">
      {ladder}
      {meta}
    </section>
  );
}
