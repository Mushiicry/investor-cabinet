import { useState, useEffect } from "react";
import { percent } from "../../lib/formatters";
import { buildFearGreedStrategy } from "../../lib/fearGreedStrategy";
import type {
  FearGreedMode,
  FearGreedStrategy,
  FearGreedStrategyRule,
} from "../../types/portfolio";
import type { V2Portfolio } from "../InvestorCabinetV2Lab";

const MODE_EXPLAIN: Record<string, { when: string; action: string; logic: string }> = {
  watch: {
    when: "Индекс страха и жадности: 30–100 (нейтрально или жадность)",
    action: "Не покупаем. Наблюдаем, держим позиции.",
    logic: "Цены на среднем или высоком уровне. Покупка сейчас — переплата. Дисциплина: ждём когда рынок даст скидку.",
  },
  cautious: {
    when: "Индекс страха и жадности: 20–29 (страх)",
    action: "Докупаем небольшую позицию — 1% от портфеля.",
    logic: "Рынок испуган, но не капитулировал. Первый осторожный шаг накопления. Размер небольшой — сохраняем резерв для более глубоких уровней.",
  },
  strong: {
    when: "Индекс страха и жадности: 15–19 (сильный страх)",
    action: "Усиливаем покупку — 1.5% от портфеля.",
    logic: "Давление продавцов усиливается. Второй уровень стратегии: увеличенный размер позиции. Рынок даёт скидку — используем её.",
  },
  aggressive: {
    when: "Индекс страха и жадности: 0–14 (экстремальный страх / капитуляция)",
    action: "Максимальная покупка — 2% от портфеля.",
    logic: "Редкий и ценный момент. Рынок в панике, большинство продаёт. Это лучшие точки входа для долгосрочного инвестора с резервом.",
  },
};

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
  return days > 0 ? `${days}д ${hh}:${mm}` : `${hh}:${mm}`;
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
  const [expandedMode, setExpandedMode] = useState<string | null>(null);
  const currentIndex = strategy.currentIndex;
  const activeStrategy = buildFearGreedStrategy(
    currentIndex,
    portfolio.totalPortfolioValue || strategy.portfolioValue || 0,
    strategy.rules ?? [],
  );
  const lastBuy = strategy.lastBuy ?? activeStrategy.lastBuy;

  const ladder = (
    <div className="v2-fg-rule-table" aria-label="Fear and Greed strategy rules">
      {activeStrategy.rules.map((row) => {
        const explain = MODE_EXPLAIN[row.mode];
        const isOpen = expandedMode === row.mode;
        return (
          <div key={row.mode}>
            <div
              className={[
                "v2-fg-rule",
                `v2-fg-rule-${row.mode}`,
                row.isCurrent ? "is-current" : "",
                row.isCurrent && row.cooldownRemainingHours <= 0 ? "is-active" : "",
                row.cooldownRemainingHours > 0 ? "is-cooldown-row" : "",
              ].filter(Boolean).join(" ")}
            >
              <div className="v2-fg-rule-range">
                <span className="v2-fg-rule-dot" aria-hidden="true" />
                <span>{row.range}</span>
              </div>
              <div className="v2-fg-rule-mode">
                <strong>{getShortModeLabel(row.mode)}</strong>
                {explain && (
                  <button
                    className={`v2-fg-info-btn${isOpen ? " is-open" : ""}`}
                    onClick={() => setExpandedMode(isOpen ? null : row.mode)}
                    aria-label={`Объяснение режима ${getShortModeLabel(row.mode)}`}
                    type="button"
                  >ⓘ</button>
                )}
              </div>
              <span>{formatBuyPct(row.buyPct)}</span>
              <span>{formatMoneyDetailed(row.buyAmount)}</span>
              <span className={`v2-fg-rule-status is-${getStatusKind(row)}`}>
                {getStatusLabel(row)}
              </span>
            </div>
            {isOpen && explain && (
              <div className="v2-fg-explain">
                <div className="v2-fg-explain-row">
                  <span className="v2-fg-explain-key">Когда</span>
                  <span>{explain.when}</span>
                </div>
                <div className="v2-fg-explain-row">
                  <span className="v2-fg-explain-key">Действие</span>
                  <span className="v2-fg-explain-action">{explain.action}</span>
                </div>
                <div className="v2-fg-explain-row">
                  <span className="v2-fg-explain-key">Логика</span>
                  <span>{explain.logic}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const recentBuys = (strategy.strategyBuys?.length
    ? strategy.strategyBuys
    : lastBuy ? [lastBuy] : [])
    .slice(0, 4);

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
