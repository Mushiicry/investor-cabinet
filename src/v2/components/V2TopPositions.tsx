import type { V2Position } from "../InvestorCabinetV2Lab";

type Props = {
  positions: V2Position[];
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const statusLabel: Record<V2Position["status"], string> = {
  HOLD: "HOLD",
  ACCUMULATE: "ACCUM",
  WATCH: "WATCH",
  REDUCE: "REDUCE",
};

export function V2TopPositions({ positions }: Props) {
  return (
    <section className="v2-panel v2-positions">
      <div className="v2-panel-kicker">Top Positions</div>
      <div className="v2-table">
        <div className="v2-table-head">
          <span>Asset</span>
          <span>Value</span>
          <span>Share</span>
          <span>PnL %</span>
          <span>Status</span>
        </div>
        {positions.map((position) => (
          <div className="v2-table-row" key={position.asset}>
            <span>
              <i>{position.asset.slice(0, 1)}</i>
              {position.asset}
            </span>
            <span>{money.format(position.value)}</span>
            <span>{position.share.toFixed(1)}%</span>
            <span className={position.pnlPct >= 0 ? "is-positive" : "is-negative"}>
              {position.pnlPct >= 0 ? "+" : ""}
              {(position.pnlPct * 100).toFixed(2)}%
            </span>
            <span className={`v2-status-pill status-${position.status.toLowerCase()}`}>{statusLabel[position.status]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
