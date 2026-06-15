import type { CSSProperties } from "react";
import gaugeBg from "../../assets/fear-greed/gauge-bg.webp";
import { percent } from "../../lib/formatters";
import { buildFearGreedStrategy } from "../../lib/fearGreedStrategy";
import { fgTone } from "../../lib/uiHelpers";
import type { FearGreed, FearGreedMode, FearGreedStrategy, FearGreedStrategyRule } from "../../types/portfolio";
import { Panel } from "../shared/Panel";

function formatCooldown(hours: number) {
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;

  if (days <= 0) return `${restHours}ч`;
  if (restHours <= 0) return `${days}д`;
  return `${days}д ${restHours}ч`;
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

function getStatusLabel(row: FearGreedStrategyRule) {
  if (row.cooldownRemainingHours > 0) return getCooldownLabel(row);
  if (row.isAvailable) return "Доступно";
  return "Пассивный";
}

function getShortModeLabel(mode: FearGreedMode) {
  if (mode === "cautious") return "Добор";
  if (mode === "strong") return "Усиление";
  if (mode === "aggressive") return "Максимум";
  return "Наблюдение";
}

function getCooldownLabel(row: FearGreedStrategyRule) {
  if (row.cooldownRemainingHours > 0) return `⏱ ${formatCooldown(row.cooldownRemainingHours)}`;
  return "—";
}

function formatStrategyDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function FearGreedGauge({
  data,
  isLoading = false,
  source = "live",
  strategy,
  portfolioValue = 0,
  spotDeployableCash = 0,
  futuresDeployableCash = 0,
  freeCashTotal = 0,
}: {
  data: FearGreed;
  isLoading?: boolean;
  source?: "cache" | "fallback" | "live";
  strategy?: FearGreedStrategy;
  portfolioValue?: number;
  spotDeployableCash?: number;
  futuresDeployableCash?: number;
  freeCashTotal?: number;
}) {
  const isSyncingWithoutFreshValue = isLoading && source === "fallback";
  const tone = fgTone(data.value);
  const clampedValue = Math.max(0, Math.min(100, isSyncingWithoutFreshValue ? 50 : data.value));
  const needleAngle = -90 + (clampedValue / 100) * 180;
  const buyStrategy = buildFearGreedStrategy(
    clampedValue,
    portfolioValue || strategy?.portfolioValue || 0,
    strategy?.rules
  );
  const lastBuy = strategy?.lastBuy ?? buyStrategy.lastBuy;
  const strategyMaxBuy = buyStrategy.rules.find((row) => row.mode === "aggressive")?.buyAmount ?? 0;
  const visibleFreeCash = freeCashTotal || spotDeployableCash + futuresDeployableCash;

  return (
    <Panel tone={tone} className="fear-greed-panel fg-clean-panel h-full" hover>
      <div
        className="fg-image-gauge"
        style={{ "--fg-angle": `${needleAngle}deg` } as CSSProperties}
        aria-label={`Fear and Greed index ${clampedValue}`}
      >
        <img src={gaugeBg} alt="" className="fg-image-gauge-bg" />
        <div className="fg-image-bloom" aria-hidden="true" />
        <div className="fg-image-needle-wrap" aria-hidden="true">
          <div className="fg-image-needle" />
        </div>
        <div className="fg-image-center-value" aria-label={`Fear and Greed value ${isSyncingWithoutFreshValue ? "syncing" : clampedValue}`}>
          {isSyncingWithoutFreshValue ? "..." : clampedValue}
        </div>
      </div>

      <div className="fg-buy-ladder">
        <div className="fg-buy-ladder-table">
          {buyStrategy.rules.map((row) => (
            <div
              key={row.mode}
              className={`fg-buy-row fg-buy-row-${row.mode} ${row.isCurrent && !isSyncingWithoutFreshValue ? "is-active" : ""}`.trim()}
            >
              <div className="fg-buy-cell fg-buy-range">
                <span className="fg-buy-dot" aria-hidden="true" />
                <span>{row.range}</span>
                {row.isCurrent && !isSyncingWithoutFreshValue ? <span className="fg-buy-current-tag">Текущий уровень</span> : null}
              </div>

              <div className="fg-buy-cell fg-buy-title-cell">
                <span className="fg-buy-main">{getShortModeLabel(row.mode)}</span>
              </div>

              <div className="fg-buy-cell fg-buy-number-cell">
                <span className="fg-buy-main">{formatBuyPct(row.buyPct)}</span>
              </div>

              <div className="fg-buy-cell fg-buy-number-cell">
                <span className="fg-buy-main">{formatMoneyDetailed(row.buyAmount)}</span>
              </div>

              <div className="fg-buy-cell fg-buy-status-cell">
                <span className={`fg-buy-mode fg-buy-mode-${row.cooldownRemainingHours > 0 ? "cooldown" : row.isAvailable ? "available" : "passive"}`}>
                  {getStatusLabel(row)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="fg-bottom-grid">
          <div className="fg-last-buy-card">
            <div className={`fg-last-buy-icon fg-last-buy-icon-${lastBuy?.mode ?? "empty"}`} aria-hidden="true" />
            <div className="fg-last-buy-body">
              <div className="fg-last-buy-title">Последняя покупка</div>
              {lastBuy ? (
                <div className="fg-last-buy-metrics">
                  <div className="fg-last-buy-metric">
                    <div className="fg-last-buy-kicker">Режим</div>
                    <div className="fg-last-buy-name">{getShortModeLabel(lastBuy.mode)} ({lastBuy.range.replace("-", "–")})</div>
                    <div className="fg-last-buy-date">{formatStrategyDate(lastBuy.boughtAt)}</div>
                    <div className="fg-last-buy-amount">{formatMoneyDetailed(lastBuy.buyAmount)}</div>
                  </div>
                  <div className="fg-last-buy-metric">
                    <div className="fg-last-buy-kicker">Актив / цена</div>
                    <div className="fg-last-buy-name">{lastBuy.asset || "—"}</div>
                    <div className="fg-last-buy-date">Цена покупки</div>
                    <div className="fg-last-buy-amount">
                      {lastBuy.assetPrice ? formatMoneyDetailed(lastBuy.assetPrice) : "—"}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="fg-last-buy-empty">Покупок по стратегии еще нет</div>
              )}
            </div>
          </div>

          <div className="fg-cash-card">
            <div className="fg-cash-title-row">
              <div className="fg-cash-title">Свободные деньги</div>
              <strong>{formatMoneyDetailed(visibleFreeCash)}</strong>
            </div>
            <div className="fg-cash-grid">
              <div className="fg-cash-metric">
                <span>Фьючи</span>
                <strong>{formatMoneyDetailed(futuresDeployableCash)}</strong>
              </div>
              <div className="fg-cash-metric">
                <span>Спот</span>
                <strong>{formatMoneyDetailed(spotDeployableCash)}</strong>
              </div>
              <div className="fg-cash-metric fg-cash-metric-strategy">
                <span>Стратегия</span>
                <strong>{formatMoneyDetailed(strategyMaxBuy)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
