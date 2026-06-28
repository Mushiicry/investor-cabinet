import type { V2Portfolio } from "../InvestorCabinetV2Lab";
import type { PortfolioHistoryPoint } from "../../types/portfolio";

type Props = {
  portfolio: V2Portfolio;
  history?: PortfolioHistoryPoint[];
};

// ── Letter grade ──────────────────────────────────────────────────
function letterGrade(hf: number) {
  if (hf >= 75) return "A";
  if (hf >= 55) return "B";
  if (hf >= 35) return "C";
  return "D";
}

const gradeColor: Record<string, string> = {
  A: "#f5c842",
  B: "#56c4f0",
  C: "#e8b35a",
  D: "#ff5d6c",
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

// ── Level badge (octagon) ─────────────────────────────────────────
function LevelBadge({ grade }: { grade: string }) {
  const color = gradeColor[grade] ?? "#56c4f0";
  return (
    <div className="v2-phc-badge">
      <svg viewBox="0 0 48 48" width="52" height="52" aria-hidden="true">
        <polygon
          points="14,1 34,1 47,14 47,34 34,47 14,47 1,34 1,14"
          fill="rgba(8,18,40,0.92)"
          stroke={color}
          strokeWidth="1.8"
        />
        <polygon
          points="16,5 32,5 43,16 43,32 32,43 16,43 5,32 5,16"
          fill="none"
          stroke={color}
          strokeWidth="0.6"
          strokeOpacity="0.35"
        />
      </svg>
      <span className="v2-phc-badge-letter" style={{ color }}>{grade}</span>
    </div>
  );
}

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

// ── Portfolio chart (centered) ────────────────────────────────────
function trimFlat(pts: PortfolioHistoryPoint[]) {
  if (pts.length < 3) return pts;
  const vals = pts.map(p => p.portfolioValue);
  const max = Math.max(...vals);
  let start = 0;
  for (let i = 0; i < vals.length - 1; i++) {
    if (vals[i] < max * 0.15) start = i + 1;
    else break;
  }
  return pts.slice(Math.min(start, pts.length - 2));
}

function PortfolioChart({ points, trending }: { points: PortfolioHistoryPoint[]; trending: boolean }) {
  const trimmed = trimFlat(points);
  if (trimmed.length < 2) return null;
  const W = 600;
  const H = 80;
  const vals = trimmed.map(p => p.portfolioValue);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const step = W / (vals.length - 1);
  const coords = vals.map((v, i) => ({
    x: i * step,
    y: H - ((v - min) / range) * (H - 14) - 7,
  }));
  const line = coords.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const last = coords[coords.length - 1];
  const accent = trending ? "#56c4f0" : "#ff5d6c";
  const fill0 = trending ? "rgba(86,196,240,0.18)" : "rgba(255,93,108,0.12)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="v2-phc-chart" preserveAspectRatio="none" aria-label="История портфеля">
      <defs>
        <linearGradient id="phc-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill0} />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#phc-area)" />
      <path d={line} fill="none" stroke={accent} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last.x} cy={last.y} r="4" fill={accent} opacity="0.9" />
      <circle cx={last.x} cy={last.y} r="7" fill={accent} opacity="0.18" />
    </svg>
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
          {signedMoney(portfolio.pnlUsd).replace(/^[+\-]?\$/, "")}
        </span>
        <div className="v2-phc-bottom-divider" aria-hidden="true" />
        <span className={`v2-phc-bottom-val ${pnlClass}`}>{signedPct(portfolio.pnlPct)}</span>
      </div>
    </div>
  );
}
