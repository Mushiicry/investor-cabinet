import type { V2Portfolio } from "../InvestorCabinetV2Lab";

type Props = {
  portfolio: V2Portfolio;
};

// ── Money formatting ──────────────────────────────────────────────
const money = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD",
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const signedMoney = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "-" : ""}${money.format(Math.abs(v))}`;
const signedPct = (r: number) =>
  `${r >= 0 ? "+" : ""}${(r * 100).toFixed(2)}%`;

// ── HUD corner frame (4 SVG corners) ─────────────────────────────
function HudCornerTL() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="v2-phc-corner v2-phc-corner--tl" aria-hidden="true">
      <path d="M44 0.8 L0.8 0.8 L0.8 44" stroke="rgba(86,196,240,0.75)" strokeWidth="1.5" fill="none" />
      <path d="M44 5.5 L5.5 5.5 L5.5 44" stroke="rgba(86,196,240,0.28)" strokeWidth="0.8" fill="none" />
      <line x1="20" y1="0.8" x2="20" y2="5" stroke="rgba(86,196,240,0.5)" strokeWidth="1" />
    </svg>
  );
}
function HudCornerTR() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="v2-phc-corner v2-phc-corner--tr" aria-hidden="true">
      <path d="M0 0.8 L43.2 0.8 L43.2 44" stroke="rgba(86,196,240,0.75)" strokeWidth="1.5" fill="none" />
      <path d="M0 5.5 L38.5 5.5 L38.5 44" stroke="rgba(86,196,240,0.28)" strokeWidth="0.8" fill="none" />
      <line x1="24" y1="0.8" x2="24" y2="5" stroke="rgba(86,196,240,0.5)" strokeWidth="1" />
    </svg>
  );
}
function HudCornerBL() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="v2-phc-corner v2-phc-corner--bl" aria-hidden="true">
      <path d="M44 43.2 L0.8 43.2 L0.8 0" stroke="rgba(86,196,240,0.75)" strokeWidth="1.5" fill="none" />
      <path d="M44 38.5 L5.5 38.5 L5.5 0" stroke="rgba(86,196,240,0.28)" strokeWidth="0.8" fill="none" />
    </svg>
  );
}
function HudCornerBR() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="v2-phc-corner v2-phc-corner--br" aria-hidden="true">
      <path d="M0 43.2 L43.2 43.2 L43.2 0" stroke="rgba(86,196,240,0.75)" strokeWidth="1.5" fill="none" />
      <path d="M0 38.5 L38.5 38.5 L38.5 0" stroke="rgba(86,196,240,0.28)" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

// ── Edge dot decorations ──────────────────────────────────────────
function EdgeDots({ pos }: { pos: "top" | "bottom" }) {
  return (
    <div className={`v2-phc-dots v2-phc-dots--${pos}`} aria-hidden="true">
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} className="v2-phc-dot" style={{ opacity: i === 2 ? 0.8 : 0.35 }} />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export function V2PortfolioHeroCard({ portfolio }: Props) {
  const trending = portfolio.pnlUsd >= 0;
  const pnlClass = trending ? "v2-phc-pos" : "v2-phc-neg";

  return (
    <div className="v2-phc">
      <HudCornerTL />
      <HudCornerTR />
      <HudCornerBL />
      <HudCornerBR />
      <EdgeDots pos="top" />
      <div className="v2-phc-bar-left" aria-hidden="true" />

      <span className="v2-phc-label">Портфель сегодня</span>
      <strong className="v2-phc-value">
        <span className="v2-phc-value-currency">$</span>
        {money.format(portfolio.totalPortfolioValue).replace(/^\$/, "")}
      </strong>

      <div className="v2-phc-bottom">
        <span className={`v2-phc-bottom-val ${pnlClass}`}>
          <span className={`v2-phc-arrow-circle ${pnlClass}`} aria-hidden="true">
            {trending ? "↑" : "↓"}
          </span>
          <span className="v2-phc-pnl-sign">{trending ? "+" : "−"}</span>
          <span className="v2-phc-value-currency">$</span>
          {signedMoney(portfolio.pnlUsd).replace(/^[+-]?\$/, "")}
        </span>
        <div className="v2-phc-bottom-divider" aria-hidden="true" />
        <span className={`v2-phc-bottom-val ${pnlClass}`}>{signedPct(portfolio.pnlPct)}</span>
      </div>
    </div>
  );
}
