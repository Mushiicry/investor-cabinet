import { useState } from "react";
import type { CSSProperties } from "react";
import { useEscapeClose } from "../../hooks/useEscapeClose";
import type { V2Portfolio } from "../InvestorCabinetV2Lab";
import { isEmptyAccount } from "../lib/accountState";
import type { Alert, AlertLevel } from "../lib/portfolioAlerts";

type Props = {
  portfolio: V2Portfolio;
  alerts: Alert[];
  onAction?: (alert: Alert) => void;
  canRunAction?: (alert: Alert) => boolean;
};

const LEVEL_LABEL: Record<AlertLevel, string> = {
  critical: "ТРЕВОГА",
  warning: "ВНИМАНИЕ",
  info: "РЕКОМЕНДАЦИЯ",
};

const GROUP_LABEL: Record<AlertLevel, string> = {
  critical: "Тревоги",
  warning: "Требует внимания",
  info: "Рекомендации и сигналы",
};

const LEVELS: AlertLevel[] = ["critical", "warning", "info"];
const GROUP_COLUMN_LIMIT: Record<AlertLevel, number> = {
  critical: 5,
  warning: 2,
  info: 4,
};

function compactAlertTitle(alert: Alert) {
  if (alert.id === "exchange-limit-orders-unconfirmed") return "Лимитки не подтверждены";
  if (alert.title.includes("превышен лимит 10% активной торговли")) {
    return "Превышен лимит активной торговли";
  }
  if (alert.title.includes("план лимитных покупок больше доступных денег после шока")) {
    return "План покупок превышает деньги после шока";
  }
  return alert.title;
}

function AlertGlyph({ level }: { level: AlertLevel }) {
  return (
    <span className="v2-alert-glyph" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8">
        {level === "critical" ? (
          <>
            <path d="M16 4 29 27H3L16 4Z" />
            <path d="M16 11v8M16 23h.01" strokeLinecap="round" />
          </>
        ) : level === "warning" ? (
          <>
            <circle cx="16" cy="16" r="12" />
            <path d="M16 8v9l6 4" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <path d="M16 3 27 7v8c0 7-4.8 11.7-11 14-6.2-2.3-11-7-11-14V7l11-4Z" />
            <path d="m11 16 3 3 7-8" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </svg>
    </span>
  );
}

export function V2PortfolioAlertsPanel({ portfolio, alerts, onAction, canRunAction }: Props) {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  useEscapeClose(Boolean(selectedAlert), () => setSelectedAlert(null));
  const criticalCount = alerts.filter((alert) => alert.level === "critical").length;
  const groups = LEVELS
    .map((level) => ({ level, alerts: alerts.filter((alert) => alert.level === level) }))
    .filter((group) => group.alerts.length > 0);

  const runSelectedAction = () => {
    if (!selectedAlert || !onAction || !canRunAction?.(selectedAlert)) return;
    setSelectedAlert(null);
    onAction(selectedAlert);
  };

  return (
    <section className="v2-hp-alert-system" aria-label="Сигналы и рекомендации">
      <div className="v2-sig-header">
        <div className="v2-sig-header-title">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            <path d="M9 2a4 4 0 00-4 4c0 4-1.6 5-1.6 5h11.2S13 10 13 6a4 4 0 00-4-4z" />
            <path d="M7.4 14a1.6 1.6 0 003.2 0" strokeLinecap="round" />
          </svg>
          Сигналы и рекомендации
          {criticalCount > 0 && (
            <span className="v2-sig-badge badge-critical">{criticalCount} ТРЕВОГ</span>
          )}
        </div>
      </div>

      <div className="v2-alert-groups">
        {isEmptyAccount(portfolio) ? (
          <div className="v2-alert-card level-info">
            <div className="v2-alert-level">НЕТ ДАННЫХ</div>
            <div className="v2-alert-title">Кошельки не подключены</div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="v2-alert-card level-ok">
            <div className="v2-alert-level">ВСЁ В НОРМЕ</div>
            <div className="v2-alert-title">Нет активных тревог</div>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.level} className={`v2-alert-group level-${group.level}`} aria-label={GROUP_LABEL[group.level]}>
              <div
                className="v2-alert-group-grid"
                style={{
                  "--alert-columns": Math.min(group.alerts.length, GROUP_COLUMN_LIMIT[group.level]),
                } as CSSProperties}
              >
                {group.alerts.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    className={`v2-alert-card level-${alert.level}`}
                    onClick={() => setSelectedAlert(alert)}
                    aria-label={`Открыть сигнал: ${alert.title}`}
                  >
                    <AlertGlyph level={alert.level} />
                    <span className="v2-alert-card-copy">
                      <span className="v2-alert-level">{LEVEL_LABEL[alert.level]}</span>
                      <strong className="v2-alert-title">{compactAlertTitle(alert)}</strong>
                    </span>
                    <span className="v2-alert-chevron" aria-hidden="true">›</span>
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {selectedAlert && (
        <div className="v2-alert-detail-overlay" onClick={() => setSelectedAlert(null)}>
          <section
            className={`v2-alert-detail-modal level-${selectedAlert.level}`}
            role="dialog"
            aria-modal="true"
            aria-label={selectedAlert.title}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="v2-alert-detail-close" onClick={() => setSelectedAlert(null)} aria-label="Закрыть">✕</button>
            <span className="v2-alert-level">{LEVEL_LABEL[selectedAlert.level]}</span>
            <h2>{selectedAlert.title}</h2>
            <p>{selectedAlert.detail}</p>
            {selectedAlert.action && (
              onAction && canRunAction?.(selectedAlert) ? (
                <button type="button" className="v2-alert-detail-action" onClick={runSelectedAction}>
                  {selectedAlert.action} →
                </button>
              ) : (
                <span className="v2-alert-detail-action is-static">Рекомендуемое действие: {selectedAlert.action}</span>
              )
            )}
          </section>
        </div>
      )}
    </section>
  );
}
