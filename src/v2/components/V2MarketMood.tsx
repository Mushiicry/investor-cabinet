import type { V2Market } from "../InvestorCabinetV2Lab";

type Props = {
  market: V2Market;
};

export function V2MarketMood({ market }: Props) {
  return (
    <section className="v2-panel v2-market-mood">
      <div className="v2-panel-header">
        <span>Market Mood</span>
        <strong>{market.marketMood}</strong>
      </div>
      <div className="v2-wave-field">
        <span />
        <span />
        <span />
      </div>
      <div className="v2-market-cards">
        <div>
          <span>Buy Window</span>
          <strong>{market.buyWindowStatus}</strong>
        </div>
        <div>
          <span>Next Halving</span>
          <strong>{market.nextHalvingDays} days</strong>
        </div>
        <div>
          <span>Cycle Phase</span>
          <strong>{market.cyclePhase}</strong>
        </div>
      </div>
    </section>
  );
}
