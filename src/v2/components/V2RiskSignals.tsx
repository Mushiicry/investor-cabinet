import type { V2Risk } from "../InvestorCabinetV2Lab";

type Props = {
  risk: V2Risk;
};

export function V2RiskSignals({ risk }: Props) {
  const signals = [
    { label: "Concentration risk", value: risk.concentration, tone: "amber" },
    { label: "Low reserve warning", value: risk.reserve > 70 ? "OK" : "WATCH", tone: risk.reserve > 70 ? "green" : "amber" },
    { label: "Futures pressure", value: risk.futuresPressure, tone: risk.futuresPressure === "LOW" ? "green" : "amber" },
    { label: "High volatility", value: risk.volatility > 55 ? "MEDIUM" : "LOW", tone: "amber" },
    { label: "Large drawdown", value: "NONE", tone: "green" },
  ];

  return (
    <section className="v2-panel v2-risk-signals">
      <div className="v2-panel-kicker">Risk Signals</div>
      {signals.map((signal) => (
        <div className="v2-signal-row" key={signal.label}>
          <span className={`v2-dot tone-${signal.tone}`} />
          <span>{signal.label}</span>
          <strong>{signal.value}</strong>
        </div>
      ))}
    </section>
  );
}
