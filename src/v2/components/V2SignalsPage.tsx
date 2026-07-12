import { buildFearGreedStrategy } from "../../lib/fearGreedStrategy";
import {
  MAX_CRYPTO_EXPOSURE_SHARE,
  MAX_SINGLE_RISK_ASSET_SHARE,
  RESERVE_TARGET_SHARE,
} from "../../config/riskRules";
import type { V2LabData } from "../InvestorCabinetV2Lab";
import type { PortfolioHealth } from "../../lib/portfolioHealth";

type Props = {
  portfolio: V2LabData["portfolio"];
  positions: V2LabData["positions"];
  risk: V2LabData["risk"];
  health: PortfolioHealth;
  fearGreedStrategy: V2LabData["fearGreedStrategy"];
  allocation: V2LabData["allocation"];
};

type AlertLevel = "critical" | "warning" | "info";
type Alert = { id: string; level: AlertLevel; title: string; detail: string; action?: string };

const toPercent = (share: number) => share * 100;

function computeAlerts(
  portfolio: Props["portfolio"],
  positions: Props["positions"],
  allocation: Props["allocation"],
  currentFG: number,
): Alert[] {
  const alerts: Alert[] = [];

  // Пустой аккаунт (кошельки ещё не подключены): нули — это не «критичный риск»,
  // а отсутствие данных. Не генерим тревожные сигналы для пустого портфеля.
  if (portfolio.totalPortfolioValue <= 0) {
    return alerts;
  }

  // 1. Резерв
  const reservePct = portfolio.reserveShare * 100;
  if (portfolio.stableReserve < portfolio.totalPortfolioValue * 0.05) {
    alerts.push({
      id: "reserve-critical",
      level: "critical",
      title: "Нет резерва",
      detail: `${portfolio.stableReserve.toFixed(0)}$ · цель ${(RESERVE_TARGET_SHARE * 100).toFixed(0)}% (${(portfolio.totalPortfolioValue * RESERVE_TARGET_SHARE).toFixed(0)}$)`,
      action: "Вывести часть прибыли в резерв",
    });
  } else if (reservePct < 20) {
    alerts.push({
      id: "reserve-low",
      level: "warning",
      title: "Резерв низкий",
      detail: `${reservePct.toFixed(0)}% портфеля · цель ${(RESERVE_TARGET_SHARE * 100).toFixed(0)}%`,
    });
  }

  // 2. Крипта > 60% портфеля
  const cryptoAlloc = allocation.find((a) => a.name === "Крипта" || a.name === "Crypto");
  if (cryptoAlloc) {
    const cryptoPct = toPercent(cryptoAlloc.share);
    const cryptoLimitPct = toPercent(MAX_CRYPTO_EXPOSURE_SHARE);
    if (cryptoAlloc.share > MAX_CRYPTO_EXPOSURE_SHARE + 0.1) {
      alerts.push({
        id: "crypto-critical",
        level: "critical",
        title: "Крипта сильно превышает лимит",
        detail: `${cryptoPct.toFixed(1)}% при лимите ${cryptoLimitPct.toFixed(0)}%`,
      });
    } else if (cryptoAlloc.share > MAX_CRYPTO_EXPOSURE_SHARE) {
      alerts.push({
        id: "crypto-warn",
        level: "warning",
        title: "Крипта выше лимита",
        detail: `${cryptoPct.toFixed(1)}% · лимит ${cryptoLimitPct.toFixed(0)}%`,
      });
    }
  }

  // 3. ETH — доля близка к лимиту позиции (35%)
  const ethPos = positions.find((p) => p.asset === "ETH");
  if (ethPos) {
    const ethShare = (ethPos.value / portfolio.totalPortfolioValue) * 100;
    const positionLimitPct = toPercent(MAX_SINGLE_RISK_ASSET_SHARE);
    if (ethShare > positionLimitPct - 1) {
      alerts.push({
        id: "eth-limit",
        level: "warning",
        title: "ETH на лимите позиции",
        detail: `${ethShare.toFixed(1)}% из ${positionLimitPct.toFixed(0)}% допустимых`,
      });
    }
  }

  // 4. Мало стейблов на споте
  const freeAlloc = allocation.find((a) =>
    a.name === "Свободные деньги" || a.name === "Стейблы" || a.name === "Cash",
  );
  const freePct = freeAlloc
    ? toPercent(freeAlloc.share)
    : (portfolio.stableReserve / portfolio.totalPortfolioValue) * 100;
  if (freePct < 8 && freePct > 0) {
    alerts.push({
      id: "stables-low",
      level: "warning",
      title: "Мало стейблов для откупа",
      detail: `${freePct.toFixed(1)}% на споте · недостаточно для усреднения`,
      action: "Пополнить резерв",
    });
  } else if (freePct === 0 || portfolio.stableReserve === 0) {
    alerts.push({
      id: "stables-zero",
      level: "critical",
      title: "Нет стейблов на споте",
      detail: "Невозможно откупить просадку",
      action: "Срочно пополнить",
    });
  }

  // 5. Зона страха — окно покупки
  if (currentFG <= 14) {
    alerts.push({
      id: "fg-max",
      level: "info",
      title: "Экстремальный страх — максимум",
      detail: `F&G ${currentFG} · зона агрессивной покупки`,
      action: "Открыть стратегию",
    });
  } else if (currentFG <= 19) {
    alerts.push({
      id: "fg-strong",
      level: "info",
      title: "Зона страха — усиленная покупка",
      detail: `F&G ${currentFG} · исторически выгодная зона`,
      action: "Открыть стратегию",
    });
  }

  return alerts;
}

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

export function V2SignalsPage({ portfolio, positions, risk, health, fearGreedStrategy, allocation }: Props) {
  const currentFG = fearGreedStrategy.currentIndex;
  const liveStrategy = buildFearGreedStrategy(
    currentFG,
    portfolio.totalPortfolioValue || 0,
    fearGreedStrategy.rules ?? []
  );

  const alerts = computeAlerts(portfolio, positions, allocation, currentFG);
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
        {portfolio.totalPortfolioValue <= 0 ? (
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
            <span className="v2-sig-int-bot-badge">НЕТ ИСТОЧНИКА API</span>
          </div>
          <div className="v2-sig-int-list">
            <div className="v2-sig-int-row">
              <span className="v2-sig-int-asset">—</span>
              <span className="v2-sig-int-range">Диапазоны отключены</span>
              <span className="v2-sig-int-label">Нет данных</span>
            </div>
          </div>
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
