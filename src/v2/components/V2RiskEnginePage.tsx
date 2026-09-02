import type { PortfolioHealth } from "../../lib/portfolioHealth";
import type { V2Portfolio, V2Risk } from "../InvestorCabinetV2Lab";
import { isEmptyAccount } from "../lib/accountState";
import {
  MAIN_INVESTOR_STRATEGY,
  type InvestorStrategy,
} from "../lib/investorStrategy";

type AllocationItem = { name: string; share: number; value: number };

type Props = {
  portfolio: V2Portfolio;
  health: PortfolioHealth;
  risk: V2Risk;
  allocation: AllocationItem[];
  strategy?: InvestorStrategy;
};

function allocationLimit(
  name: string,
  strategy: InvestorStrategy,
): { limit: number; target?: number; dir: "above" | "below" | "target" } | null {
  if (name === "Крипта") return { limit: strategy.cryptoMaxShare, dir: "above" };
  if (name === "Фьючерсы") return { limit: strategy.futuresMaxShare, dir: "above" };
  if (name === "Свободные деньги") {
    return { limit: strategy.reserveTargetShare, dir: "below", target: strategy.reserveTargetShare };
  }
  if (name === "Металлы") return { limit: strategy.metalsMaxShare, dir: "above" };
  if (name === "Акции") return { limit: strategy.stocksMaxShare, dir: "above" };
  return null;
}

function pct(value: number) {
  return (value * 100).toFixed(1) + "%";
}

function money(value: number) {
  return value.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " $";
}

function statusClass(hf: number) {
  if (hf >= 75) return "re-status-control";
  if (hf >= 55) return "re-status-balanced";
  return "re-status-risk";
}

function levelBadge(level: "LOW" | "MEDIUM" | "HIGH") {
  if (level === "LOW") return "re-lvl-low";
  if (level === "MEDIUM") return "re-lvl-medium";
  return "re-lvl-high";
}

function levelLabel(level: "LOW" | "MEDIUM" | "HIGH") {
  return level === "LOW" ? "Низкий" : level === "MEDIUM" ? "Средний" : "Высокий";
}

function scoreColor(score: number) {
  if (score >= 75) return "#56d8f5";
  if (score >= 50) return "#e8b35a";
  return "#f87171";
}

// Нейтральный «нет данных» тон для пустого аккаунта — вместо тревожного красного.
const EMPTY_TONE = "rgba(150, 170, 190, 0.5)";

export function V2RiskEnginePage({
  portfolio,
  health,
  risk,
  allocation,
  strategy = MAIN_INVESTOR_STRATEGY,
}: Props) {
  // Пустой/кастдев-аккаунт (кошельки не подключены): нули — это отсутствие данных,
  // а не критический риск. Гасим красные тона и флаги, геометрию сохраняем.
  // Реальный аккаунт (value > 0) идёт по прежней risk-логике без изменений.
  const isEmpty = isEmptyAccount(portfolio);
  const toneColor = (v: number) => (isEmpty ? EMPTY_TONE : scoreColor(v));

  const reservePct = portfolio.reserveShare * 100;
  const reserveTarget = strategy.reserveTargetShare * 100;
  const reserveDelta = reservePct - reserveTarget;
  const reserveStatus = reserveDelta >= 0 ? "above" : reserveDelta >= -5 ? "near" : "below";
  const visibleAllocation = allocation.filter(
    (item) => strategy.futuresAllowed || item.name !== "Фьючерсы" || item.value > 0,
  );

  return (
    <section className="v2-re-page">
      {/* ── HERO STATUS ── */}
      <div className="v2-re-hero">
        <div className="v2-re-hero-left">
          <h2 className="v2-re-title">{strategy.futuresAllowed ? "Контроль риска" : "Качество активов"}</h2>
          <p className="v2-re-subtitle">
            {strategy.futuresAllowed ? "Системный контроль рисков портфеля" : "Контроль чистоты портфеля Полины"}
          </p>
        </div>
        <div className="v2-re-hero-scores">
          <div className={`v2-re-hf-badge ${isEmpty ? "re-status-empty" : statusClass(health.healthFactor)}`}>
            <span className="v2-re-hf-num">{health.healthFactor}</span>
            <span className="v2-re-hf-label">{isEmpty ? "Нет данных" : health.riskLevel}</span>
          </div>
          <div className="v2-re-signal-row">
            <span className="v2-re-sig-chip">{portfolio.exposureMode}</span>
            <span className="v2-re-sig-text">{portfolio.exposureSignal}</span>
          </div>
        </div>
      </div>

      <div className="v2-re-body">
        {/* ── LEFT COLUMN ── */}
        <div className="v2-re-col-left">

          {/* Health Components */}
          <div className="v2-re-card">
            <div className="v2-re-card-head">
              <span className="v2-re-card-title">Здоровье капитала</span>
              <span className="v2-re-card-note">6 компонентов · взвешенный индекс</span>
            </div>
            <div className="v2-re-components">
              {health.components.map((c) => (
                <div key={c.key} className="v2-re-comp-row">
                  <div className="v2-re-comp-meta">
                    <span className="v2-re-comp-label">{c.label}</span>
                    <span className="v2-re-comp-score" style={{ color: toneColor(c.score) }}>
                      {c.score}
                    </span>
                  </div>
                  <div className="v2-re-comp-bar-wrap">
                    <div
                      className={`v2-re-comp-bar-fill ${isEmpty ? "is-empty" : c.score >= 75 ? "is-good" : c.score >= 50 ? "is-mid" : "is-low"}`}
                      style={{ width: `${c.score}%` }}
                    />
                  </div>
                  <span className="v2-re-comp-desc">{c.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Exposure Limits */}
          <div className="v2-re-card">
            <div className="v2-re-card-head">
              <span className="v2-re-card-title">Лимиты экспозиции</span>
              <span className="v2-re-card-note">текущее / лимит политики</span>
            </div>
            <div className="v2-re-alloc-list">
              {visibleAllocation.map((item) => {
                const rule = allocationLimit(item.name, strategy);
                const exposureShare = item.name === "Фьючерсы" ? risk.futuresShare : item.share;
                // Пустой аккаунт: доли по нулям — не считаем это нарушением лимитов.
                const over = !isEmpty && rule && exposureShare > rule.limit;
                const under = !isEmpty && rule?.dir === "below" && exposureShare < rule.limit;
                const flagClass = over ? "re-flag-over" : under ? "re-flag-under" : "re-flag-ok";
                const flagLabel = over ? "ВЫШЕ" : under ? "НИЖЕ" : "OK";

                return (
                  <div key={item.name} className="v2-re-alloc-row">
                    <div className="v2-re-alloc-name">
                      <span>{item.name}</span>
                      {rule && !isEmpty && (
                        <span className={`v2-re-flag ${flagClass}`}>{flagLabel}</span>
                      )}
                    </div>
                    <div className="v2-re-alloc-bar-wrap">
                      <div
                        className={`v2-re-alloc-bar-fill ${over ? "is-over" : ""}`}
                        style={{ width: `${Math.min(exposureShare * 100, 100)}%` }}
                      />
                      {rule && (
                        <div
                          className="v2-re-alloc-limit-line"
                          style={{ left: `${rule.limit * 100}%` }}
                        />
                      )}
                    </div>
                    <div className="v2-re-alloc-nums">
                      <span className={`v2-re-alloc-pct ${over ? "is-over" : ""}`}>
                        {pct(exposureShare)}
                      </span>
                      {rule && (
                        <span className="v2-re-alloc-limit">
                          / {rule.dir === "below" ? "цель" : "лимит"} {pct(rule.limit)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="v2-re-col-right">

          {/* Reserve Layer */}
          <div className="v2-re-card">
            <div className="v2-re-card-head">
              <span className="v2-re-card-title">Резервный слой</span>
              <span className="v2-re-card-note">цель {reserveTarget.toFixed(0)}% · текущее</span>
            </div>
            <div className="v2-re-reserve-hero">
              <span className="v2-re-reserve-pct">{reservePct.toFixed(1)}%</span>
              <span className={`v2-re-reserve-delta ${isEmpty ? "is-empty" : reserveStatus === "above" ? "is-pos" : "is-neg"}`}>
                {isEmpty ? "нет данных" : `${reserveDelta >= 0 ? "+" : ""}${reserveDelta.toFixed(1)}% от цели`}
              </span>
            </div>
            <div className="v2-re-reserve-bar-wrap">
              <div
                className="v2-re-reserve-bar-fill"
                style={{ width: `${Math.min(reservePct, 100)}%` }}
              />
              <div className="v2-re-reserve-target-line" style={{ left: `${reserveTarget}%` }} />
            </div>
            <div className="v2-re-reserve-labels">
              <span>0%</span>
              <span className="v2-re-reserve-target-tag">цель {reserveTarget}%</span>
              <span>100%</span>
            </div>
            <div className="v2-re-reserve-amount">
              <span className="v2-re-field-label">Сумма резерва</span>
              <strong>{money(portfolio.stableReserve)}</strong>
            </div>
          </div>

          {/* Deployable Capital */}
          <div className="v2-re-card">
            <div className="v2-re-card-head">
              <span className="v2-re-card-title">Торговый капитал</span>
              <span className="v2-re-card-note">доступно к развёртыванию</span>
            </div>
            <div className="v2-re-deploy-total">
              <span className="v2-re-field-label">Всего доступно</span>
              <strong className="v2-re-deploy-num">{money(portfolio.deployableCapital)}</strong>
            </div>
            <div className="v2-re-deploy-grid">
              <div className="v2-re-deploy-item">
                <span className="v2-re-field-label">Спот</span>
                <span className="v2-re-deploy-val is-spot">{money(portfolio.spotDeployable)}</span>
              </div>
              {strategy.futuresAllowed && (
                <div className="v2-re-deploy-item">
                  <span className="v2-re-field-label">Фьючерсы</span>
                  <span className="v2-re-deploy-val is-futures">{money(portfolio.futuresDeployable)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Risk Signals */}
          <div className="v2-re-card">
            <div className="v2-re-card-head">
              <span className="v2-re-card-title">Сигналы риска</span>
            </div>
            <div className="v2-re-signals">
              <div className="v2-re-signal-item">
                <span className="v2-re-field-label">Концентрация</span>
                <span className={`v2-re-lvl-badge ${levelBadge(risk.concentration)}`}>
                  {levelLabel(risk.concentration)}
                </span>
              </div>
              {strategy.futuresAllowed && (
                <div className="v2-re-signal-item">
                  <span className="v2-re-field-label">Давление фьючерсов</span>
                  <span className={`v2-re-lvl-badge ${levelBadge(risk.futuresPressure)}`}>
                    {levelLabel(risk.futuresPressure)}
                  </span>
                </div>
              )}
              <div className="v2-re-signal-item">
                <span className="v2-re-field-label">Режим экспозиции</span>
                <span className="v2-re-sig-chip">{portfolio.exposureMode}</span>
              </div>
              <div className="v2-re-signal-item is-full">
                <span className="v2-re-field-label">Сигнал</span>
                <span className="v2-re-signal-text">{portfolio.exposureSignal}</span>
              </div>
            </div>

            {/* Radar metrics */}
            <div className="v2-re-radar-grid">
              {[
                { label: "Резерв", value: risk.reserve },
                { label: "Экспозиция", value: risk.exposure },
                { label: "Плечо", value: risk.leverage },
                { label: "Диверсификация", value: risk.diversification },
                { label: "Волатильность", value: risk.volatility },
              ].map((m) => (
                <div key={m.label} className="v2-re-radar-item">
                  <span className="v2-re-field-label">{m.label}</span>
                  <div className="v2-re-mini-bar-wrap">
                    <div
                      className="v2-re-mini-bar-fill"
                      style={{
                        width: `${m.value ?? 0}%`,
                        background: m.value === null ? EMPTY_TONE : toneColor(m.value),
                      }}
                    />
                  </div>
                  <span
                    className="v2-re-radar-val"
                    style={{ color: m.value === null ? EMPTY_TONE : toneColor(m.value) }}
                    title={m.value === null ? "Метрика не рассчитывается: нет подтверждённого источника" : undefined}
                  >
                    {m.value === null ? "нет данных" : m.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
