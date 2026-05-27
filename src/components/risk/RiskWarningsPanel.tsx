import type { RiskWarning } from "../../types/portfolio";

const warningPriority: Record<RiskWarning["level"], number> = {
  high: 0,
  watch: 1,
};

export function RiskWarningsPanel({ warnings }: { warnings?: RiskWarning[] }) {
  const sortedWarnings = [...(warnings ?? [])].sort(
    (a, b) => warningPriority[a.level] - warningPriority[b.level]
  );
  const highestLevel = sortedWarnings[0]?.level ?? "ok";

  return (
    <div className={`risk-warning-box risk-warning-box-${highestLevel}`}>
      <div className="risk-warning-kicker">Risk discipline</div>

      {sortedWarnings.length ? (
        <div className="risk-warning-list">
          {sortedWarnings.slice(0, 3).map((warning) => (
            <div key={warning.code} className={`risk-warning-item risk-warning-item-${warning.level}`}>
              <span className="risk-warning-dot" />
              <span>{warning.message}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="risk-warning-empty">
          Лимиты риска в норме. Новые действия только по плану и без увеличения фьючерсного давления.
        </div>
      )}
    </div>
  );
}
