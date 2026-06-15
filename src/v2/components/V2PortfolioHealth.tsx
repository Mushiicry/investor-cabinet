import type { V2Risk } from "../InvestorCabinetV2Lab";

type Props = {
  risk: V2Risk;
};

const rows: Array<{ key: keyof Pick<V2Risk, "reserve" | "exposure" | "leverage" | "diversification" | "volatility">; label: string }> = [
  { key: "reserve", label: "Reserve" },
  { key: "exposure", label: "Exposure" },
  { key: "leverage", label: "Leverage" },
  { key: "diversification", label: "Diversification" },
  { key: "volatility", label: "Volatility" },
];

export function V2PortfolioHealth({ risk }: Props) {
  return (
    <section className="v2-panel v2-ph-panel">
      <div className="v2-panel-header">
        <span>Portfolio Health</span>
        <strong>Good</strong>
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
