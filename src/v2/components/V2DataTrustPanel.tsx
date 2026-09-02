import type { TradingDataTrust } from "../lib/dataTrust";

type Props = {
  dataTrust: TradingDataTrust;
  compact?: boolean;
  onRefresh?: () => void;
};

function formatTime(value: string | null) {
  if (!value) return "подтверждается вручную";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export function V2DataTrustPanel({ dataTrust, compact = false, onRefresh }: Props) {
  return (
    <section
      className={`v2-data-trust is-${dataTrust.state}${compact ? " is-compact" : ""}`}
      aria-label="Доверие к данным торгового решения"
    >
      <div className="v2-data-trust__head">
        <div>
          <span>Data Trust · {dataTrust.accountId}</span>
          <strong>{dataTrust.title}</strong>
        </div>
        {onRefresh && (
          <button type="button" onClick={onRefresh}>Обновить данные</button>
        )}
      </div>

      <div className="v2-data-trust__facts">
        {dataTrust.facts.map((fact) => (
          <div className={`v2-data-trust__fact is-${fact.state}`} key={fact.id}>
            <span>{fact.label}</span>
            <strong>{fact.source}</strong>
            <time>{formatTime(fact.updatedAt)}</time>
            {!compact && <small>{fact.note}</small>}
          </div>
        ))}
      </div>

      {dataTrust.blockers.length > 0 && (
        <div className="v2-data-trust__blockers" role="alert">
          <strong>Почему закрыт допуск</strong>
          <span>{dataTrust.blockers.join(" · ")}</span>
        </div>
      )}
    </section>
  );
}
