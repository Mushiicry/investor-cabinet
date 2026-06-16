import type { V2Risk } from "../InvestorCabinetV2Lab";

type Props = {
  risk: V2Risk;
};

const rows: Array<{ key: keyof Pick<V2Risk, "reserve" | "exposure" | "leverage" | "diversification" | "volatility">; label: string }> = [
  { key: "reserve", label: "Резерв" },
  { key: "exposure", label: "Крипта" },
  { key: "leverage", label: "Фьючерсы" },
  { key: "diversification", label: "Диверсификация" },
  { key: "volatility", label: "Концентрация" },
];

function healthLabel(avg: number) {
  if (avg >= 75) return { text: "GOOD", tone: "is-good" };
  if (avg >= 55) return { text: "BALANCED", tone: "is-mid" };
  return { text: "RISK", tone: "is-risk" };
}

export function V2PortfolioHealth({ risk }: Props) {
  const avg =
    rows.reduce((sum, row) => sum + (risk[row.key] || 0), 0) / rows.length;
  const status = healthLabel(avg);

  return (
    <section className="v2-panel v2-ph-panel">
      <div className="v2-panel-header">
        <span>Health компоненты</span>
        <strong className={`v2-ph-status ${status.tone}`}>{status.text}</strong>
      </div>
      <div className="v2-bars">
        {rows.map((row) => (
          <div className="v2-bar-row" key={row.key}>
            <span>{row.label}</span>
            <div className="v2-bar-track">
              <div className="v2-bar-fill" style={{ width: `${risk[row.key]}%` }} />
            </div>
            <strong>{risk[row.key]}%</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
