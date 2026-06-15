import type { V2Portfolio, V2Risk } from "../InvestorCabinetV2Lab";
import healthReactorImage from "../../assets/health/v2-portfolio-health-reactor.webp";

type Props = {
  portfolio: V2Portfolio;
  risk: V2Risk;
};

export function V2HealthCore({ portfolio, risk }: Props) {
  return (
    <section className="v2-panel v2-health-core" aria-label="Portfolio health factor">
      <div className="v2-health-stage" aria-hidden="true">
        <span className="v2-reactor-orbit orbit-one" />
        <span className="v2-reactor-orbit orbit-two" />
        <span className="v2-reactor-scan" />
        <svg className="v2-electrode-network" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id="v2-electrode-left" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="rgba(77, 239, 255, 0.12)" />
              <stop offset="58%" stopColor="rgba(145, 230, 255, 0.38)" />
              <stop offset="100%" stopColor="rgba(212, 252, 255, 0.7)" />
            </linearGradient>
            <linearGradient id="v2-electrode-right" x1="100%" x2="0%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="rgba(77, 239, 255, 0.12)" />
              <stop offset="58%" stopColor="rgba(145, 230, 255, 0.38)" />
              <stop offset="100%" stopColor="rgba(212, 252, 255, 0.7)" />
            </linearGradient>
          </defs>
          <path className="v2-electrode-base" d="M 29 30 C 35 30 35 36 41 36" />
          <path className="v2-electrode-base" d="M 29 43 C 35 43 35 43 41 43" />
          <path className="v2-electrode-base" d="M 29 56 C 35 56 35 50 41 50" />
          <path className="v2-electrode-base" d="M 71 30 C 65 30 65 36 59 36" />
          <path className="v2-electrode-base" d="M 71 43 C 65 43 65 43 59 43" />
          <path className="v2-electrode-base" d="M 71 56 C 65 56 65 50 59 50" />
          <path className="v2-electrode-flow flow-one" d="M 29 30 C 35 30 35 36 41 36" />
          <path className="v2-electrode-flow flow-two" d="M 29 43 C 35 43 35 43 41 43" />
          <path className="v2-electrode-flow flow-three" d="M 29 56 C 35 56 35 50 41 50" />
          <path className="v2-electrode-flow flow-four" d="M 71 30 C 65 30 65 36 59 36" />
          <path className="v2-electrode-flow flow-five" d="M 71 43 C 65 43 65 43 59 43" />
          <path className="v2-electrode-flow flow-six" d="M 71 56 C 65 56 65 50 59 50" />
          <circle className="v2-electrode-node" cx="41" cy="36" r="0.72" />
          <circle className="v2-electrode-node" cx="41" cy="43" r="0.72" />
          <circle className="v2-electrode-node" cx="41" cy="50" r="0.72" />
          <circle className="v2-electrode-node" cx="59" cy="36" r="0.72" />
          <circle className="v2-electrode-node" cx="59" cy="43" r="0.72" />
          <circle className="v2-electrode-node" cx="59" cy="50" r="0.72" />
        </svg>
        <div className="v2-reactor-hud hud-left">
          <span className="v2-hud-line line-reserve" />
          <span className="v2-hud-line line-exposure" />
          <span className="v2-hud-line line-leverage" />
          <div className="v2-hud-item hud-reserve">
            <span className="v2-hud-node" />
            <span className="v2-hud-icon" />
            <span className="v2-hud-label">Reserve</span>
            <strong>{risk.reserve}%</strong>
            <span className="v2-hud-bars" />
          </div>
          <div className="v2-hud-item hud-exposure">
            <span className="v2-hud-node" />
            <span className="v2-hud-icon" />
            <span className="v2-hud-label">Exposure</span>
            <strong>{risk.exposure}%</strong>
            <span className="v2-hud-bars" />
          </div>
          <div className="v2-hud-item hud-leverage">
            <span className="v2-hud-node" />
            <span className="v2-hud-icon" />
            <span className="v2-hud-label">Leverage</span>
            <strong>{risk.leverage}%</strong>
            <span className="v2-hud-bars" />
          </div>
        </div>
        <div className="v2-reactor-hud hud-right">
          <span className="v2-hud-line line-health" />
          <span className="v2-hud-line line-status" />
          <span className="v2-hud-line line-risk" />
          <div className="v2-hud-item hud-health">
            <span className="v2-hud-node" />
            <span className="v2-hud-icon" />
            <span className="v2-hud-label">Health</span>
            <strong>{portfolio.healthFactor} / 100</strong>
            <span className="v2-hud-bars" />
          </div>
          <div className="v2-hud-item hud-status">
            <span className="v2-hud-node" />
            <span className="v2-hud-icon" />
            <span className="v2-hud-label">Status</span>
            <strong>{portfolio.healthStatus}</strong>
            <span className="v2-hud-bars" />
          </div>
          <div className="v2-hud-item hud-risk">
            <span className="v2-hud-node" />
            <span className="v2-hud-icon" />
            <span className="v2-hud-label">Risk</span>
            <strong>{portfolio.riskLevel}</strong>
            <span className="v2-hud-bars" />
          </div>
        </div>
        <span className="v2-reactor-platform" />
        <span className="v2-reactor-beam" />
        <img
          className="v2-health-image"
          src={healthReactorImage}
          alt=""
        />
        <div className="v2-core-readout" aria-hidden="true">
          <span className="v2-core-score">{portfolio.healthFactor}</span>
          <span className="v2-core-control">{portfolio.healthStatus}</span>
          <span className="v2-core-risk">RISK LEVEL, {portfolio.riskLevel.toUpperCase()}</span>
        </div>
        <div className="v2-health-composition">
          Health factor built from:
          <span>Reserve · Exposure · Leverage · Diversification · Volatility</span>
        </div>
      </div>
      <span className="v2-sr-only">
        Portfolio health {portfolio.healthFactor}, {portfolio.healthStatus}, risk level {portfolio.riskLevel}.
        Reserve {risk.reserve}%, exposure {risk.exposure}%, leverage {risk.leverage}%.
      </span>
      <div className="v2-core-footer">
        <span>Reserve discipline active</span>
        <span>Emotional trading lock: on</span>
      </div>
    </section>
  );
}
