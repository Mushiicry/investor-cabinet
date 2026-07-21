import { createPortal } from "react-dom";
import { useEscapeClose } from "../../hooks/useEscapeClose";
import type { Alert, AlertLevel } from "../lib/portfolioAlerts";

type Props = {
  alerts: Alert[];
  onClose: () => void;
};

const LEVEL_LABEL: Record<AlertLevel, string> = {
  critical: "ТРЕВОГА",
  warning: "ВНИМАНИЕ",
  info: "СИГНАЛ",
};

export function V2NotificationsPanel({ alerts, onClose }: Props) {
  useEscapeClose(true, onClose);

  const criticalCount = alerts.filter((alert) => alert.level === "critical").length;
  const warningCount = alerts.filter((alert) => alert.level === "warning").length;

  return createPortal(
    <div className="v2-notif-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Уведомления">
      <div className="v2-notif-panel" onClick={(event) => event.stopPropagation()}>
        <div className="v2-notif-head">
          <div className="v2-notif-title-block">
            <span className="v2-notif-kicker">Уведомления</span>
            <span className="v2-notif-summary">
              {alerts.length === 0
                ? "Портфель в норме"
                : `${criticalCount} тревог · ${warningCount} предупреждений`}
            </span>
          </div>
          <button className="v2-notif-close" type="button" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="v2-notif-list">
          {alerts.length === 0 ? (
            <div className="v2-notif-empty">
              <span className="v2-notif-empty-title">Активных сигналов нет</span>
              <span className="v2-notif-empty-sub">
                Лимиты не пробиты, резерв на месте, точки интереса далеко от срабатывания
              </span>
            </div>
          ) : (
            alerts.map((alert) => (
              <div key={alert.id} className={`v2-notif-item level-${alert.level}`}>
                <span className="v2-notif-level">{LEVEL_LABEL[alert.level]}</span>
                <span className="v2-notif-item-title">{alert.title}</span>
                <span className="v2-notif-item-detail">{alert.detail}</span>
                {alert.action && <span className="v2-notif-item-action">→ {alert.action}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
