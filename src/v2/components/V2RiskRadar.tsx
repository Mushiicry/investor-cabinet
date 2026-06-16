import type { V2Risk } from "../InvestorCabinetV2Lab";

type Props = {
  risk: V2Risk;
};

export function V2RiskRadar({ risk }: Props) {
  const points = [
    `50,${100 - risk.reserve}`,
    `${50 + risk.exposure * 0.44},${50 - risk.exposure * 0.12}`,
    `${50 + risk.leverage * 0.28},${50 + risk.leverage * 0.38}`,
    `${50 - risk.diversification * 0.4},${50 + risk.diversification * 0.28}`,
    `${50 - risk.volatility * 0.38},${50 - risk.volatility * 0.18}`,
  ].join(" ");

  return (
    <section className="v2-panel v2-risk-radar">
      <div className="v2-panel-kicker">Health компоненты</div>
      <svg viewBox="0 0 100 100" role="img" aria-label="Risk exposure radar">
        <polygon className="v2-radar-grid" points="50,6 92,36 76,88 24,88 8,36" />
        <polygon className="v2-radar-grid mid" points="50,22 76,41 66,74 34,74 24,41" />
        <polygon className="v2-radar-area" points={points} />
        <line x1="50" y1="6" x2="50" y2="94" />
        <line x1="8" y1="36" x2="92" y2="36" />
        <line x1="24" y1="88" x2="76" y2="36" />
        <line x1="76" y1="88" x2="24" y2="36" />
      </svg>
      <div className="v2-radar-labels">
        <span>Резерв {risk.reserve}</span>
        <span>Крипта {risk.exposure}</span>
        <span>Фьючерсы {risk.leverage}</span>
        <span>Диверсиф. {risk.diversification}</span>
        <span>Концентр. {risk.volatility}</span>
      </div>
    </section>
  );
}
