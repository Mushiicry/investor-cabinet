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

function formatMoneyDetailed(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function getStatusLabel(row: FearGreedStrategyRule) {
  if (row.cooldownRemainingHours > 0) return "Кулдаун";
  if (row.isAvailable) return "Доступно";
  return "Пассивный";
}

function getRuleHint(row: FearGreedStrategyRule) {
  if (!row.buyPct) return "Покупка не активна";
  return "Можно купить 1 актив";
}

function getCooldownLabel(row: FearGreedStrategyRule) {
  if (!row.buyPct) return "—";
  if (row.cooldownRemainingHours > 0) return formatCooldown(row.cooldownRemainingHours);
  if (row.isAvailable) return "Доступно";
  return "—";
}

function getCooldownSubLabel(row: FearGreedStrategyRule) {
  if (row.cooldownRemainingHours > 0 && row.nextAvailableAt) {
    return `до ${new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(row.nextAvailableAt))}`;
  }
  if (row.isAvailable) return "можно купить";
  return "";
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
          <div className="fg-buy-row fg-buy-head">
            <div className="fg-buy-cell">Диапазон индекса</div>
            <div className="fg-buy-cell">Режим покупки</div>
            <div className="fg-buy-cell">% от капитала</div>
            <div className="fg-buy-cell">Сумма покупки</div>
            <div className="fg-buy-cell">Статус</div>
            <div className="fg-buy-cell">Кулдаун</div>
          </div>

          {buyStrategy.rules.map((row) => (
            <div
              key={row.mode}
              className={`fg-buy-row fg-buy-row-${row.mode} ${row.isCurrent && !isSyncingWithoutFreshValue ? "is-active" : ""}`.trim()}
            >
              <div className="fg-buy-cell fg-buy-range">
                <span className="fg-buy-dot" aria-hidden="true" />
                <span>{row.range.replace("-", " - ")}</span>
                {row.isCurrent && !isSyncingWithoutFreshValue ? <span className="fg-buy-current-tag">Текущий уровень</span> : null}
              </div>

              <div className="fg-buy-cell fg-buy-title-cell">
                <span className="fg-buy-main">{row.label}</span>
                <span className="fg-buy-sub">{getRuleHint(row)}</span>
              </div>

              <div className="fg-buy-cell fg-buy-number-cell">
                <span className="fg-buy-main">{formatBuyPct(row.buyPct)}</span>
                <span className="fg-buy-sub">от капитала</span>
              </div>

              <div className="fg-buy-cell fg-buy-number-cell">
                <span className="fg-buy-main">{formatMoneyDetailed(row.buyAmount)}</span>
                <span className="fg-buy-sub">{formatMoneyDetailed(buyStrategy.portfolioValue)} × {formatBuyPct(row.buyPct)}</span>
              </div>

              <div className="fg-buy-cell fg-buy-status-cell">
                <span className={`fg-buy-mode fg-buy-mode-${row.cooldownRemainingHours > 0 ? "cooldown" : row.isAvailable ? "available" : "passive"}`}>
                  {getStatusLabel(row)}
                </span>
              </div>

              <div className="fg-buy-cell fg-buy-cooldown-cell">
                <span className="fg-buy-main">{getCooldownLabel(row)}</span>
                <span className="fg-buy-sub">{getCooldownSubLabel(row)}</span>
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
