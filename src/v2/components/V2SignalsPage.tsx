import { useMemo, useState } from "react";
import { buildFearGreedStrategy } from "../../lib/fearGreedStrategy";
import type { V2LabData } from "../InvestorCabinetV2Lab";
import type { PortfolioHealth } from "../../lib/portfolioHealth";
import { isEmptyAccount } from "../lib/accountState";
import { getMarketPsychology } from "../lib/marketPsychology";
import type { InterestSignal } from "../../types/portfolio";
import {
  getSignalDistance,
  groupByAsset,
  sortByProximity,
  type SignalDistance,
} from "../lib/interestSignals";
import { CryptoLogo } from "../../components/crypto/CryptoLogo";
import {
  buildPortfolioAlerts,
  sortAlerts,
  type AlertLevel,
} from "../lib/portfolioAlerts";

type Props = {
  portfolio: V2LabData["portfolio"];
  positions: V2LabData["positions"];
  risk: V2LabData["risk"];
  health: PortfolioHealth;
  fearGreedStrategy: V2LabData["fearGreedStrategy"];
  allocation: V2LabData["allocation"];
  interestSignals: InterestSignal[];
};

const LEVEL_LABEL: Record<AlertLevel, string> = {
  critical: "ТРЕВОГА",
  warning: "ВНИМАНИЕ",
  info: "СИГНАЛ",
};

const FG_ZONES = [
  { label: "Максимум",  min: 0,   max: 14,  color: "rgba(220,70,70,0.9)" },
  { label: "Усиление",  min: 15,  max: 19,  color: "rgba(220,130,55,0.9)" },
  { label: "Добор",     min: 20,  max: 29,  color: "rgba(210,180,55,0.9)" },
  { label: "Наблюд.",   min: 30,  max: 100, color: "rgba(90,180,255,0.7)" },
];

function getFGZone(v: number) {
  return FG_ZONES.find((z) => v >= z.min && v <= z.max) ?? FG_ZONES[3];
}

function formatCooldownHours(hours: number) {
  const days = Math.floor(hours / 24);
  const hh = String(Math.floor(hours % 24)).padStart(2, "0");
  return days > 0 ? `${days}д ${hh}:00` : `${hh}:00`;
}

// Точность триггера — часть решения: 0.3068 нельзя показывать как 0,31.
// Разряды подбираем по величине цены, а не фиксируем на двух знаках.
const formatSignalMoney = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return "—";
  const digits = value >= 1000 ? 0 : value >= 1 ? 4 : 6;
  return `$${value.toLocaleString("ru-RU", { maximumFractionDigits: digits })}`;
};

const SIGNAL_STATUS_LABEL: Record<string, string> = {
  ARMED: "Ждёт",
  TRIGGERED: "Сработал",
  ERROR: "Сбой",
  CHECK: "Проверить",
};

const formatSignalStatus = (status: string) =>
  SIGNAL_STATUS_LABEL[status.trim().toUpperCase()] ?? (status.trim() || "Активно");

// Расстояние до срабатывания: стрелка вместо знака минус — направление хода
// читается быстрее, чем математический знак.
const formatSignalDistance = (distance: SignalDistance) => {
  const arrow = distance.pct < 0 ? "↓" : "↑";
  const pct = Math.abs(distance.pct).toLocaleString("ru-RU", { maximumFractionDigits: 1 });
  return `${arrow} ${pct}%`;
};

// Сигнал в двух шагах от срабатывания требует другого внимания, чем в двадцати.
const NEAR_TRIGGER_PCT = 3;

// В сигналах актив зовётся GOLD, а логотип заведён под позицию GOLD LONG.
const LOGO_ASSET_ALIAS: Record<string, string> = { GOLD: "GOLD LONG" };
const logoAssetFor = (asset: string) => LOGO_ASSET_ALIAS[asset] ?? asset;

export function V2SignalsPage({ portfolio, positions, risk, health, fearGreedStrategy, allocation, interestSignals }: Props) {
  const [openAsset, setOpenAsset] = useState<string | null>(null);
  const assetGroups = useMemo(() => groupByAsset(interestSignals), [interestSignals]);
  const openGroup = assetGroups.find((group) => group.asset === openAsset) ?? null;
  const nearestSignal = useMemo(() => sortByProximity(interestSignals)[0] ?? null, [interestSignals]);
  const nearestDistance = nearestSignal ? getSignalDistance(nearestSignal) : null;
  const currentFG = fearGreedStrategy.currentIndex;
  const liveStrategy = buildFearGreedStrategy(
    currentFG,
    portfolio.totalPortfolioValue || 0,
    fearGreedStrategy.rules ?? []
  );

  const alerts = sortAlerts(
    buildPortfolioAlerts({ portfolio, positions, allocation, currentFG, health, interestSignals })
  );
  // Поведенческий гид: живой F&G + тренд по истории → эмоция рынка и дисциплина.
  const psychology = getMarketPsychology(currentFG, fearGreedStrategy.history);
  const criticalCount = alerts.filter((a) => a.level === "critical").length;
  const fgZone = getFGZone(currentFG);
  const currentRule = liveStrategy.rules.find((r) => r.isCurrent);
  const activeRules = liveStrategy.rules.filter((r) => r.status === "active" && r.buyPct > 0);
  const cooldownRules = liveStrategy.rules.filter((r) => r.status === "cooldown");

  return (
    <div className="v2-signals-page">

      {/* ── Шапка ─────────────────────────────────────────── */}
      <div className="v2-sig-header">
        <div className="v2-sig-header-title">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            <path d="M9 2a4 4 0 00-4 4c0 4-1.6 5-1.6 5h11.2S13 10 13 6a4 4 0 00-4-4z" />
            <path d="M7.4 14a1.6 1.6 0 003.2 0" strokeLinecap="round" />
          </svg>
          Сигналы портфеля
          {criticalCount > 0 && (
            <span className="v2-sig-badge badge-critical">{criticalCount} ТРЕВОГ</span>
          )}
        </div>
        <span className="v2-sig-timestamp">данные API</span>
      </div>

      {/* ── Тревоги ───────────────────────────────────────── */}
      <div className="v2-alerts-row">
        {isEmptyAccount(portfolio) ? (
          <div className="v2-alert-card level-info">
            <div className="v2-alert-level">НЕТ ДАННЫХ</div>
            <div className="v2-alert-title">Кошельки не подключены</div>
            <div className="v2-alert-detail">Подключите источники данных — сигналы появятся автоматически</div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="v2-alert-card level-ok">
            <div className="v2-alert-level">ВСЁ В НОРМЕ</div>
            <div className="v2-alert-title">Нет активных тревог</div>
            <div className="v2-alert-detail">Портфель в допустимых параметрах</div>
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className={`v2-alert-card level-${alert.level}`}>
              <div className="v2-alert-level">{LEVEL_LABEL[alert.level]}</div>
              <div className="v2-alert-title">{alert.title}</div>
              <div className="v2-alert-detail">{alert.detail}</div>
              {alert.action && <div className="v2-alert-action">→ {alert.action}</div>}
            </div>
          ))
        )}
      </div>

      {/* ── Основная сетка ────────────────────────────────── */}
      <div className="v2-sig-main-grid">

        {/* Рынок */}
        <div className="v2-panel v2-sig-market">
          <div className="v2-sig-panel-label">
            <span className="v2-sig-dot dot-info" />
            Рынок
          </div>

          <div className="v2-fg-signal-row">
            <div className="v2-fg-signal-value" style={{ color: fgZone.color }}>{currentFG}</div>
            <div className="v2-fg-signal-info">
              <span className="v2-fg-signal-zone" style={{ color: fgZone.color }}>{fgZone.label}</span>
              <span className="v2-fg-signal-label">Индекс страха / жадности</span>
            </div>
          </div>

          <div className="v2-fg-bar-track">
            <div className="v2-fg-bar-fill" style={{ width: `${currentFG}%`, background: `linear-gradient(90deg, ${fgZone.color}, ${fgZone.color}88)` }} />
            <div className="v2-fg-bar-needle" style={{ left: `${currentFG}%` }} />
          </div>
          <div className="v2-fg-bar-labels">
            <span>Страх</span><span>Нейтрально</span><span>Жадность</span>
          </div>

          {/* ── Психология рынка: не прогноз, а поведенческий гид ── */}
          <div className="v2-psy-block">
            <div className="v2-psy-head">
              <span className="v2-psy-emotion" style={{ color: psychology.color }}>
                {psychology.emotion}
                {psychology.trend !== "flat" && (
                  <span className="v2-psy-trend" aria-label={psychology.trend === "rising" ? "индекс растёт" : "индекс падает"}>
                    {psychology.trend === "rising" ? "↗" : "↘"}
                  </span>
                )}
              </span>
              <span className="v2-psy-stance" style={{ borderColor: `${psychology.color}55`, color: psychology.color }}>
                {psychology.stanceLabel}
              </span>
            </div>
            <div className="v2-psy-rows">
              <div className="v2-psy-row">
                <span className="v2-psy-row-k">Рынок чувствует</span>
                <span className="v2-psy-row-v">{psychology.feels}</span>
              </div>
              <div className="v2-psy-row">
                <span className="v2-psy-row-k">Дисциплина делает</span>
                <span className="v2-psy-row-v">{psychology.disciplined}</span>
              </div>
              <div className="v2-psy-row is-danger">
                <span className="v2-psy-row-k">Опасно сейчас</span>
                <span className="v2-psy-row-v">{psychology.dangerous}</span>
              </div>
            </div>
          </div>

          <div className="v2-sig-divider" />

          <div className="v2-sig-market-rows">
            {[
              { label: "Здоровье портфеля", value: `${portfolio.healthFactor}/100`, tone: portfolio.healthFactor >= 60 ? "green" : portfolio.healthFactor >= 40 ? "amber" : "red" },
              { label: "Статус", value: portfolio.healthStatus === "CONTROL" ? "Контроль" : portfolio.healthStatus === "BALANCED" ? "Баланс" : "Риск", tone: portfolio.healthStatus === "CONTROL" ? "green" : portfolio.healthStatus === "BALANCED" ? "amber" : "red" },
              { label: "Концентрация крипто", value: risk.concentration === "HIGH" ? "Высокая" : risk.concentration === "MEDIUM" ? "Средняя" : "Низкая", tone: risk.concentration === "HIGH" ? "red" : risk.concentration === "MEDIUM" ? "amber" : "green" },
              { label: "Давление фьючерсов", value: risk.futuresPressure === "HIGH" ? "Высокое" : risk.futuresPressure === "MEDIUM" ? "Среднее" : "Низкое", tone: risk.futuresPressure === "HIGH" ? "red" : risk.futuresPressure === "MEDIUM" ? "amber" : "green" },
            ].map((row) => (
              <div key={row.label} className="v2-sig-market-row">
                <span className="v2-sig-row-label">{row.label}</span>
                <span className={`v2-sig-row-val val-${row.tone}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Стратегия */}
        <div className="v2-panel v2-sig-strategy">
          <div className="v2-sig-panel-label">
            <span className="v2-sig-dot dot-amber" />
            Стратегия F&G
          </div>

          <div className="v2-sig-strategy-zone">
            <div className="v2-sig-zone-label">Текущая зона</div>
            <div className="v2-sig-zone-name">{currentRule ? currentRule.label : "Наблюдение"}</div>
            <div className="v2-sig-zone-range">F&G {currentRule ? currentRule.range.replace("-", "–") : "30–100"}</div>
          </div>

          <div className="v2-sig-rules-list">
            {liveStrategy.rules.filter((r) => r.buyPct > 0).map((rule) => {
              const isCurrent = rule.isCurrent;
              const isCooldown = rule.status === "cooldown";
              const isActive = rule.status === "active";
              return (
                <div key={rule.mode} className={`v2-sig-rule-row${isCurrent ? " is-current" : ""}${isCooldown ? " is-cooldown" : ""}${isActive ? " is-active" : ""}`}>
                  <div className="v2-sig-rule-left">
                    <span className="v2-sig-rule-dot" />
                    <span className="v2-sig-rule-name">{rule.label}</span>
                    <span className="v2-sig-rule-range">{rule.range.replace("-", "–")}</span>
                  </div>
                  <div className="v2-sig-rule-right">
                    <span className="v2-sig-rule-amount">{rule.buyAmount.toFixed(2)} $</span>
                    {isCooldown && rule.cooldownRemainingHours != null && (
                      <span className="v2-sig-rule-cooldown">{formatCooldownHours(rule.cooldownRemainingHours)}</span>
                    )}
                    {isActive && <span className="v2-sig-rule-status status-active">ДОСТУПНО</span>}
                    {rule.status === "passive" && !isCurrent && (
                      <span className="v2-sig-rule-status status-passive">ПАССИВ</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {activeRules.length > 0 ? (
            <div className="v2-sig-action-hint">
              <span className="v2-sig-dot dot-green" />
              {activeRules.length === 1 ? `Доступна зона · ${activeRules[0].buyAmount.toFixed(2)}$` : `${activeRules.length} зоны доступны`}
            </div>
          ) : cooldownRules.length > 0 ? (
            <div className="v2-sig-action-hint hint-cooldown">
              <span className="v2-sig-dot dot-amber" />
              Все активные зоны на кулдауне
            </div>
          ) : null}
        </div>

        {/* Зона интереса */}
        <div className="v2-panel v2-sig-interest">
          <div className="v2-sig-panel-label">
            <span className="v2-sig-dot dot-info" />
            Зона интереса
            <span className="v2-sig-int-bot-badge">{interestSignals.length ? "СИГНАЛЫ API" : "НЕТ ИСТОЧНИКА API"}</span>
          </div>
          {assetGroups.length ? (
            <>
              <div className="v2-sig-coin-grid">
                {assetGroups.map((group) => {
                  const isOpen = group.asset === openAsset;
                  const isNear =
                    !!group.nearest && Math.abs(group.nearest.pct) <= NEAR_TRIGGER_PCT;

                  return (
                    <button
                      key={group.asset}
                      type="button"
                      className={[
                        "v2-sig-coin",
                        isOpen ? "is-open" : "",
                        group.needsAttention ? "is-alert" : "",
                        isNear ? "is-near" : "",
                      ].filter(Boolean).join(" ")}
                      aria-expanded={isOpen}
                      onClick={() => setOpenAsset((prev) => (prev === group.asset ? null : group.asset))}
                    >
                      <CryptoLogo asset={logoAssetFor(group.asset)} className="v2-sig-coin-logo" />
                      <span className="v2-sig-coin-ticker">{group.asset}</span>
                      <span className="v2-sig-coin-meta">
                        {group.needsAttention
                          ? "проверить"
                          : group.nearest
                            ? formatSignalDistance(group.nearest)
                            : `${group.waitingCount} точки`}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="v2-sig-int-list">
                {openGroup ? (
                  openGroup.signals.map((signal) => {
                    const distance = getSignalDistance(signal);
                    const isDone = signal.status.trim().toUpperCase() === "TRIGGERED";
                    const isNear = !isDone && !!distance && Math.abs(distance.pct) <= NEAR_TRIGGER_PCT;

                    return (
                      <div className="v2-sig-int-row" key={signal.id}>
                        <span className="v2-sig-int-range">
                          {signal.action} {formatSignalMoney(signal.amountUsd)} при {formatSignalMoney(signal.triggerPrice)}
                        </span>
                        <span className="v2-sig-int-label">
                          {distance && !isDone ? (
                            <span className={`v2-sig-int-dist${isNear ? " is-near" : ""}`}>
                              {formatSignalDistance(distance)}
                              <span className="v2-sig-int-dist-abs">
                                {formatSignalMoney(Math.abs(distance.abs))}
                              </span>
                            </span>
                          ) : null}
                          <span className="v2-sig-int-sub">
                            {formatSignalStatus(signal.status)} · {formatSignalMoney(signal.currentPrice)}
                          </span>
                        </span>
                      </div>
                    );
                  })
                ) : (
                  // Пока монета не выбрана, панель всё равно отвечает на главный
                  // вопрос: за чем следить сегодня.
                  <div className="v2-sig-int-hint">
                    {nearestSignal ? (
                      <>
                        <span className="v2-sig-int-hint-label">Ближайшая точка</span>
                        <span className="v2-sig-int-hint-main">
                          {nearestSignal.asset} · {nearestSignal.action}{" "}
                          {formatSignalMoney(nearestSignal.amountUsd)} при{" "}
                          {formatSignalMoney(nearestSignal.triggerPrice)}
                        </span>
                        {nearestDistance ? (
                          <span className="v2-sig-int-dist is-near">
                            {formatSignalDistance(nearestDistance)}
                            <span className="v2-sig-int-dist-abs">
                              {formatSignalMoney(Math.abs(nearestDistance.abs))}
                            </span>
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="v2-sig-int-hint-label">Нет активных точек</span>
                    )}
                    <span className="v2-sig-int-hint-note">Нажмите монету — покажу её точки</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="v2-sig-int-list">
              <div className="v2-sig-int-row">
                <span className="v2-sig-int-range">Диапазоны отключены</span>
                <span className="v2-sig-int-label">Нет данных</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Факторы здоровья ──────────────────────────────── */}
      <div className="v2-sig-health-strip">
        {health.components.map((comp) => {
          const tone = comp.score >= 60 ? "green" : comp.score >= 35 ? "amber" : "red";
          return (
            <div key={comp.key} className={`v2-sig-hbar tone-${tone}`}>
              <div className="v2-sig-hbar-top">
                <span className="v2-sig-hbar-label">{comp.label}</span>
                <span className="v2-sig-hbar-score">{comp.score}</span>
              </div>
              <div className="v2-sig-hbar-track">
                <div className="v2-sig-hbar-fill" style={{ width: `${comp.score}%` }} />
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
