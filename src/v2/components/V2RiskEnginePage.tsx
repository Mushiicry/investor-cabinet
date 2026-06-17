import type { PortfolioHealth } from "../../lib/portfolioHealth";
import type { V2Portfolio, V2Risk } from "../InvestorCabinetV2Lab";

type AllocationItem = { name: string; share: number; value: number };

type Props = {
  portfolio: V2Portfolio;
  health: PortfolioHealth;
  risk: V2Risk;
  allocation: AllocationItem[];
};

const ALLOC_LIMITS: Record<string, { limit: number; target?: number; dir: "above" | "below" | "target" }> = {
  Крипта:           { limit: 0.6, dir: "above" },
  Фьючерсы:        { limit: 0.1, dir: "above" },
  "Свободные деньги": { limit: 0.3, dir: "below", target: 0.3 },
  Металлы:         { limit: 0.15, dir: "above" },
  Акции:           { limit: 0.2, dir: "above" },
};

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

export function V2RiskEnginePage({ portfolio, health, risk, allocation }: Props) {
  const reservePct = portfolio.reserveShare * 100;
  const reserveTarget = 30;
  const reserveDelta = reservePct - reserveTarget;
  const reserveStatus = reserveDelta >= 0 ? "above" : reserveDelta >= -5 ? "near" : "below";

  return (
    <section className="v2-re-page">
      {/* ── HERO STATUS ── */}
      <div className="v2-re-hero">
        <div className="v2-re-hero-left">
          <h2 className="v2-re-title">Risk Engine</h2>
          <p className="v2-re-subtitle">Системный контроль рисков портфеля</p>
        </div>
        <div className="v2-re-hero-scores">
          <div className={`v2-re-hf-badge ${statusClass(health.healthFactor)}`}>
            <span className="v2-re-hf-num">{health.healthFactor}</span>
            <span className="v2-re-hf-label">{health.riskLevel}</span>
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
              <span className="v2-re-card-title">Health Factor</span>
              <span className="v2-re-card-note">6 компонентов · взвешенный индекс</span>
            </div>
            <div className="v2-re-components">
              {health.components.map((c) => (
                <div key={c.key} className="v2-re-comp-row">
                  <div className="v2-re-comp-meta">
                    <span className="v2-re-comp-label">{c.label}</span>
                    <span className="v2-re-comp-score" style={{ color: scoreColor(c.score) }}>
                      {c.score}
                    </span>
                  </div>
                  <div className="v2-re-comp-bar-wrap">
                    <div
                      className={`v2-re-comp-bar-fill ${c.score >= 75 ? "is-good" : c.score >= 50 ? "is-mid" : "is-low"}`}
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
              {allocation.map((item) => {
                const rule = ALLOC_LIMITS[item.name];
                const over = rule && item.share > rule.limit;
                const under = rule?.dir === "below" && item.share < rule.limit;
                const flagClass = over ? "re-flag-over" : under ? "re-flag-under" : "re-flag-ok";
                const flagLabel = over ? "ВЫШЕ" : under ? "НИЖЕ" : "OK";

                return (
                  <div key={item.name} className="v2-re-alloc-row">
                    <div className="v2-re-alloc-name">
                      <span>{item.name}</span>
                      {rule && (
                        <span className={`v2-re-flag ${flagClass}`}>{flagLabel}</span>
                      )}
                    </div>
                    <div className="v2-re-alloc-bar-wrap">
                      <div
                        className={`v2-re-alloc-bar-fill ${over ? "is-over" : ""}`}
                        style={{ width: `${Math.min(item.share * 100, 100)}%` }}
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
                        {pct(item.share)}
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
              <span className="v2-re-card-note">цель 30% · текущее</span>
            </div>
            <div className="v2-re-reserve-hero">
              <span className="v2-re-reserve-pct">{reservePct.toFixed(1)}%</span>
              <span className={`v2-re-reserve-delta ${reserveStatus === "above" ? "is-pos" : "is-neg"}`}>
                {reserveDelta >= 0 ? "+" : ""}{reserveDelta.toFixed(1)}% от цели
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
              <div className="v2-re-deploy-item">
                <span className="v2-re-field-label">Фьючерсы</span>
                <span className="v2-re-deploy-val is-futures">{money(portfolio.futuresDeployable)}</span>
              </div>
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
              <div className="v2-re-signal-item">
                <span className="v2-re-field-label">Давление фьючерсов</span>
                <span className={`v2-re-lvl-badge ${levelBadge(risk.futuresPressure)}`}>
                  {levelLabel(risk.futuresPressure)}
                </span>
              </div>
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
                      style={{ width: `${m.value}%`, background: scoreColor(m.value) }}
                    />
                  </div>
                  <span className="v2-re-radar-val" style={{ color: scoreColor(m.value) }}>
                    {m.value}
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
