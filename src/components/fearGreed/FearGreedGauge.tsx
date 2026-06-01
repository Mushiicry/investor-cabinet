import type { CSSProperties } from "react";
import gaugeBg from "../../assets/fear-greed/gauge-bg.webp";
import { currency, percent } from "../../lib/formatters";
import { buildFearGreedStrategy } from "../../lib/fearGreedStrategy";
import { fgTone } from "../../lib/uiHelpers";
import type { FearGreed, FearGreedStrategy, FearGreedStrategyRule } from "../../types/portfolio";
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

function getStatusLabel(row: FearGreedStrategyRule) {
  if (row.cooldownRemainingHours > 0) return `Cooldown ${formatCooldown(row.cooldownRemainingHours)}`;
  if (row.isAvailable) return "Доступно";
  return "Пассивный";
}

export function FearGreedGauge({
  data,
  isLoading = false,
  source = "live",
  strategy,
  portfolioValue = 0,
}: {
  data: FearGreed;
  isLoading?: boolean;
  source?: "cache" | "fallback" | "live";
  strategy?: FearGreedStrategy;
  portfolioValue?: number;
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
  const currentRule = buyStrategy.rules.find((row) => row.isCurrent);
  const currentRuleMessage = isSyncingWithoutFreshValue
    ? "Синхронизируем индекс. До live-значения сигнал не используется."
    : !currentRule || currentRule.mode === "observation"
      ? "Наблюдение: покупка по индексу не активна."
      : currentRule.cooldownRemainingHours > 0
        ? `Покупка уже использована, осталось ${formatCooldown(currentRule.cooldownRemainingHours)}.`
        : `Можно купить на ${currency(currentRule.buyAmount)}.`;

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
              className={`fg-buy-row ${row.isCurrent && !isSyncingWithoutFreshValue ? "is-active" : ""}`.trim()}
            >
              <div className="fg-buy-cell">{row.range}</div>
              <div className="fg-buy-cell">{row.label}</div>
              <div className="fg-buy-cell">{formatBuyPct(row.buyPct)}</div>
              <div className="fg-buy-cell">{currency(row.buyAmount)}</div>
              <div className="fg-buy-cell">
                <span className={`fg-buy-mode fg-buy-mode-${row.cooldownRemainingHours > 0 ? "cooldown" : row.isAvailable ? "available" : "passive"}`}>
                  {getStatusLabel(row)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="fg-buy-note">
          <div className="fg-buy-note-icon" aria-hidden="true" />
          <div>
            <div className="fg-buy-note-title">ВАЖНОЕ УТОЧНЕНИЕ</div>
            <div className="fg-buy-note-text">
              {isSyncingWithoutFreshValue ? (
                <>Синхронизируем индекс. До live-значения сигнал не используется.</>
              ) : (
                <>{currentRuleMessage} Каждый режим имеет <strong>отдельный cooldown.</strong></>
              )}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
