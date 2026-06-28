import type { CSSProperties } from "react";

type AllocItem = { name: string; share: number; value: number };
type LimitKind = "max" | "min" | "none";

const CFG: Record<string, {
  glyph: string; color: string; glow: string;
  limit: number | null; limitKind: LimitKind;
  limitLabel: string;
}> = {
  "Крипта":           { glyph: "₿", color: "#2e7ef5", glow: "rgba(46,126,245,0.70)",  limit: 0.60, limitKind: "max", limitLabel: "ЛИМИТ 60%" },
  "Металлы":          { glyph: "◆", color: "#8a6cf0", glow: "rgba(138,108,240,0.65)", limit: null, limitKind: "none", limitLabel: "" },
  "Фьючерсы":         { glyph: "↗", color: "#56d4f5", glow: "rgba(86,212,245,0.60)",  limit: 0.10, limitKind: "max", limitLabel: "ЛИМИТ 10%" },
  "Акции":            { glyph: "▲", color: "#38bcd4", glow: "rgba(56,188,212,0.55)",  limit: null, limitKind: "none", limitLabel: "" },
  "Свободные деньги": { glyph: "$", color: "#3dd6b0", glow: "rgba(61,214,176,0.55)",  limit: 0.30, limitKind: "min", limitLabel: "ЦЕЛЬ 30%" },
};

const ORDER = ["Крипта", "Металлы", "Фьючерсы", "Акции", "Свободные деньги"];

/* ── SVG geometry ── */
const CX = 160, CY = 160, R_OUT = 118, R_IN = 74, GAP = 2.0;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donut(cx: number, cy: number, ro: number, ri: number, s: number, e: number) {
  const A = polar(cx, cy, ro, s), B = polar(cx, cy, ro, e);
  const C = polar(cx, cy, ri, e), D = polar(cx, cy, ri, s);
  const large = (e - s) > 180 ? 1 : 0;
  return `M${A.x} ${A.y} A${ro} ${ro} 0 ${large} 1 ${B.x} ${B.y} L${C.x} ${C.y} A${ri} ${ri} 0 ${large} 0 ${D.x} ${D.y}Z`;
}

function buildSegs(items: AllocItem[]) {
  const active = items.filter(i => i.share > 0.003);
  const total  = active.reduce((s, i) => s + i.share, 0) || 1;
  const avail  = 360 - GAP * active.length;
  const out: { name: string; share: number; start: number; end: number; mid: number }[] = [];
  let cur = -90;
  for (const it of active) {
    const sw = (it.share / total) * avail;
    out.push({ name: it.name, share: it.share, start: cur, end: cur + sw, mid: cur + sw / 2 });
    cur += sw + GAP;
  }
  return out;
}

function statusOf(share: number, limit: number | null, kind: LimitKind) {
  if (!limit || kind === "none") return null;
  if (kind === "max") return share > limit ? { text: "ВЫШЕ", ok: false } : { text: "ОК", ok: true };
  return share < limit ? { text: "НИЖЕ", ok: false } : { text: "ОК", ok: true };
}

/* Risk marker (outside the ring) */
function RiskMarker({ deg, label }: { deg: number; label: string }) {
  const R_TICK_IN  = R_OUT + 5;
  const R_TICK_OUT = R_OUT + 16;
  const R_TEXT     = R_OUT + 28;
  const p1 = polar(CX, CY, R_TICK_IN,  deg);
  const p2 = polar(CX, CY, R_TICK_OUT, deg);
  const pt = polar(CX, CY, R_TEXT,     deg);
  const anchor = pt.x > CX ? "start" : "end";
  const lines = label.split(" ");
  return (
    <g>
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#e8b842" strokeWidth="1.5" opacity="0.85"/>
      <circle cx={p2.x} cy={p2.y} r="2.5" fill="#e8b842" opacity="0.90"/>
      {lines.map((l, i) => (
        <text key={i} x={pt.x} y={pt.y + i * 9 - (lines.length - 1) * 4.5}
          textAnchor={anchor} fontSize="7.5" fill="#e8b842" opacity="0.90"
          fontFamily="'Space Grotesk', system-ui, sans-serif" fontWeight="700"
          letterSpacing="0.05em">
          {l}
        </text>
      ))}
    </g>
  );
}

type Props = { allocation: AllocItem[]; total: number };

export function V2PortfolioAllocationCard({ allocation, total }: Props) {
  const sorted = [...allocation].sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name));
  const segs   = buildSegs(sorted);

  /* fixed ring positions for limit markers */
  const limitDeg60  = -90 + 0.60 * 360; /* 126° — конец 60% */
  const targetDeg30 = -90 + 0.30 * 360; /* 18°  — конец 30% */

  return (
    <div className="v2-pac-wrap">
      <div className="v2-pac-header">РАСПРЕДЕЛЕНИЕ СРЕДСТВ</div>

      <div className="v2-pac-body">

        {/* ── Левая колонка: категории ── */}
        <div className="v2-pac-list">
          {sorted.map(item => {
            const cfg = CFG[item.name] ?? { glyph: "•", color: "#6f86a6", glow: "rgba(111,134,166,0.4)", limit: null, limitKind: "none" as LimitKind, limitLabel: "" };
            const st  = statusOf(item.share, cfg.limit, cfg.limitKind);
            const bar = Math.min(100, item.share * 100);
            const lim = cfg.limit ? cfg.limit * 100 : null;
            return (
              <div key={item.name} className="v2-pac-card" style={{ "--c": cfg.color, "--glow": cfg.glow } as CSSProperties}>
                {/* icon */}
                <div className="v2-pac-card-icon" style={{ borderColor: cfg.color, boxShadow: `0 0 12px ${cfg.glow}, inset 0 0 8px rgba(0,0,0,0.5)`, color: cfg.color }}>
                  {cfg.glyph}
                </div>
                {/* info */}
                <div className="v2-pac-card-info">
                  <span className="v2-pac-card-name">{item.name}</span>
                  <span className="v2-pac-card-amt">{Math.round(item.value)} $</span>
                </div>
                {/* right: pct + limit + status */}
                <div className="v2-pac-card-right">
                  <span className="v2-pac-card-pct" style={{ color: cfg.color }}>{(item.share * 100).toFixed(1)}%</span>
                  {cfg.limitLabel && (
                    <span className="v2-pac-card-limit-row">
                      <span className="v2-pac-card-limit-label">{cfg.limitLabel}</span>
                      {st && <em className={`v2-pac-badge ${st.ok ? "ok" : "warn"}`}>{st.text}</em>}
                    </span>
                  )}
                </div>
                {/* progress bar */}
                <div className="v2-pac-bar-track">
                  <span className="v2-pac-bar-fill" style={{ width: `${bar}%`, background: cfg.color, boxShadow: `0 0 6px ${cfg.glow}` }} />
                  {lim !== null && (
                    <span className="v2-pac-bar-tick" style={{ left: `${lim}%` }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Правая колонка: донат ── */}
        <div className="v2-pac-chart-col">
          <svg viewBox="0 0 320 320" className="v2-pac-svg" xmlns="http://www.w3.org/2000/svg">
            <defs>
              {/* Glow filter per segment */}
              {segs.map((_, i) => (
                <filter key={i} id={`pac-sg${i}`} x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="4" result="b"/>
                  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              ))}
              {/* Radial gradient per segment */}
              {segs.map((seg, i) => {
                const cfg = CFG[seg.name];
                return cfg ? (
                  <radialGradient key={i} id={`pac-g${i}`} cx="38%" cy="28%" r="75%">
                    <stop offset="0%"   stopColor={cfg.color} stopOpacity="1.00"/>
                    <stop offset="70%"  stopColor={cfg.color} stopOpacity="0.82"/>
                    <stop offset="100%" stopColor={cfg.color} stopOpacity="0.55"/>
                  </radialGradient>
                ) : null;
              })}
              {/* Center radial */}
              <radialGradient id="pac-ctr" cx="50%" cy="38%" r="60%">
                <stop offset="0%"   stopColor="rgba(28,68,140,0.55)"/>
                <stop offset="55%"  stopColor="rgba(6,14,38,0.92)"/>
                <stop offset="100%" stopColor="rgba(2,5,15,0.99)"/>
              </radialGradient>
              {/* Outer dark plate gradient */}
              <radialGradient id="pac-plate" cx="50%" cy="45%" r="52%">
                <stop offset="0%"   stopColor="rgba(8,20,55,0.0)"/>
                <stop offset="100%" stopColor="rgba(2,5,18,0.65)"/>
              </radialGradient>
              {/* Highlight clip */}
              <clipPath id="pac-top">
                <ellipse cx="160" cy="150" rx="135" ry="115"/>
              </clipPath>
              {/* Inner shadow for well */}
              <radialGradient id="pac-well" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="rgba(60,120,220,0.18)"/>
                <stop offset="60%"  stopColor="rgba(4,10,28,0.0)"/>
                <stop offset="100%" stopColor="rgba(0,3,12,0.70)"/>
              </radialGradient>
            </defs>

            {/* ── Outer dark plate (base shadow) ── */}
            <circle cx={CX} cy={CY + 4} r={R_OUT + 12} fill="rgba(0,3,14,0.85)"/>
            <circle cx={CX} cy={CY}     r={R_OUT + 12} fill="rgba(4,12,38,0.55)"/>
            {/* Ring "groove" — тёмная полоса где живёт кольцо */}
            <circle cx={CX} cy={CY} r={R_OUT + 3}  fill="none" stroke="rgba(0,2,10,0.95)" strokeWidth={R_OUT - R_IN + 12}/>

            {/* ── Shadow arcs (volume, 4 layers) ── */}
            {segs.map((seg, i) => [4, 3, 2, 1].map(d => (
              <path key={`sh${i}-${d}`}
                d={donut(CX + d * 0.6, CY + d * 2.2, R_OUT + 1, R_IN - 1, seg.start, seg.end)}
                fill={`rgba(0,2,10,${0.65 - d * 0.10})`}
              />
            )))}

            {/* ── Rim outer ring (dark bevel) ── */}
            <circle cx={CX} cy={CY} r={R_OUT + 4} fill="none" stroke="rgba(2,8,28,0.98)" strokeWidth="7"/>
            <circle cx={CX} cy={CY} r={R_OUT + 1} fill="none" stroke="rgba(120,200,255,0.07)" strokeWidth="1.2"/>

            {/* ── Main colored segments ── */}
            {segs.map((seg, i) => (
              <path key={`seg${i}`}
                d={donut(CX, CY, R_OUT, R_IN, seg.start, seg.end)}
                fill={`url(#pac-g${i})`}
                filter={`url(#pac-sg${i})`}
              />
            ))}

            {/* ── Highlight (blick top) ── */}
            {segs.map((seg, i) => (
              <path key={`hi${i}`}
                d={donut(CX, CY, R_OUT - 1, R_IN + (R_OUT - R_IN) * 0.55, seg.start, seg.end)}
                fill="rgba(255,255,255,0.10)"
                clipPath="url(#pac-top)"
              />
            ))}

            {/* ── Inner rim bevel ── */}
            <circle cx={CX} cy={CY} r={R_IN + 1} fill="none" stroke="rgba(2,8,24,0.95)" strokeWidth="5"/>
            <circle cx={CX} cy={CY} r={R_IN - 1} fill="none" stroke="rgba(100,180,255,0.08)" strokeWidth="1"/>

            {/* ── Center well ── */}
            <circle cx={CX} cy={CY} r={R_IN - 2} fill="url(#pac-ctr)"/>
            <circle cx={CX} cy={CY} r={R_IN - 2} fill="url(#pac-well)"/>

            {/* ── Outer policy ring (dashed) ── */}
            <circle cx={CX} cy={CY} r={R_OUT + 18}
              fill="none" stroke="rgba(86,196,240,0.10)" strokeWidth="1" strokeDasharray="3 6"/>

            {/* ── Limit markers ── */}
            <RiskMarker deg={limitDeg60}  label={"60%\nЛИМИТ"} />
            <RiskMarker deg={targetDeg30} label={"30%\nЦЕЛЬ"} />

            {/* ── Center text ── */}
            <text x={CX} y={CY - 12} textAnchor="middle"
              fontSize="10" fontWeight="600" letterSpacing="0.16em"
              fill="rgba(140,190,240,0.55)"
              fontFamily="'Space Grotesk', system-ui, sans-serif">
              ПОРТФЕЛЬ
            </text>
            <text x={CX} y={CY + 18} textAnchor="middle"
              fontSize="22" fontWeight="700" letterSpacing="-0.025em"
              fill="rgba(215,238,255,0.94)"
              fontFamily="'Space Grotesk', system-ui, sans-serif">
              ${Math.round(total)}
            </text>
          </svg>

          {/* ── Легенда ── */}
          <div className="v2-pac-legend">
            {segs.map((seg, i) => {
              const cfg = CFG[seg.name];
              return (
                <div key={i} className="v2-pac-legend-row">
                  <span className="v2-pac-legend-dot" style={{ background: cfg?.color, boxShadow: `0 0 5px ${cfg?.glow}` }}/>
                  <span className="v2-pac-legend-name">{seg.name}</span>
                  <span className="v2-pac-legend-pct">{(seg.share * 100).toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
