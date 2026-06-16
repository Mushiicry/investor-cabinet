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

  const radarPoints = [
    `50,${100 - risk.reserve}`,
    `${50 + risk.exposure * 0.44},${50 - risk.exposure * 0.12}`,
    `${50 + risk.leverage * 0.28},${50 + risk.leverage * 0.38}`,
    `${50 - risk.diversification * 0.4},${50 + risk.diversification * 0.28}`,
    `${50 - risk.volatility * 0.38},${50 - risk.volatility * 0.18}`,
  ].join(" ");

  return (
    <section className="v2-panel v2-ph-panel v2-health-merged">
      <div className="v2-panel-header">
        <span>Health компоненты</span>
        <strong className={`v2-ph-status ${status.tone}`}>{status.text}</strong>
      </div>

      <div className="v2-health-merged-body">
        <div className="v2-risk-radar v2-health-radar">
          <svg viewBox="0 0 100 100" role="img" aria-label="Health компоненты радар">
            <polygon className="v2-radar-grid" points="50,6 92,36 76,88 24,88 8,36" />
            <polygon className="v2-radar-grid mid" points="50,22 76,41 66,74 34,74 24,41" />
            <polygon className="v2-radar-area" points={radarPoints} />
            <line x1="50" y1="6" x2="50" y2="94" />
            <line x1="8" y1="36" x2="92" y2="36" />
            <line x1="24" y1="88" x2="76" y2="36" />
            <line x1="76" y1="88" x2="24" y2="36" />
          </svg>
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
      </div>
    </section>
  );
}
