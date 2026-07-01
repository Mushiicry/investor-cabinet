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
const CX = 160, CY = 160, R_OUT = 116, R_IN = 72, GAP = 2.2;
const PERSPECTIVE_Y = 0.64;
const PUCK_DEPTH = 32;
const PUCK_OFFSET_Y = CY * (1 - PERSPECTIVE_Y);
const PUCK_TRANSFORM = `translate(0 ${PUCK_OFFSET_Y}) scale(1 ${PERSPECTIVE_Y})`;

type Segment = { name: string; share: number; start: number; end: number; mid: number };

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donut(cx: number, cy: number, ro: number, ri: number, s: number, e: number): string {
  const span = e - s;
  if (span >= 359.9) {
    // Full ring — draw as two halves to avoid degenerate arc
    const mid = s + 180;
    const d1 = donut(cx, cy, ro, ri, s, mid - 0.01);
    const d2 = donut(cx, cy, ro, ri, mid, e);
    return d1 + " " + d2;
  }
  const A = polar(cx, cy, ro, s), B = polar(cx, cy, ro, e);
  const C = polar(cx, cy, ri, e), D = polar(cx, cy, ri, s);
  const large = span > 180 ? 1 : 0;
  return `M${A.x} ${A.y} A${ro} ${ro} 0 ${large} 1 ${B.x} ${B.y} L${C.x} ${C.y} A${ri} ${ri} 0 ${large} 0 ${D.x} ${D.y}Z`;
}

/* Outer curved wall — no stroke, clean fill only */
function curvedWall(cx: number, cy: number, r: number, s: number, e: number, depth: number) {
  const span = e - s;
  const A = polar(cx, cy, r, s), B = polar(cx, cy, r, e);
  const C = polar(cx, cy + depth, r, e), D = polar(cx, cy + depth, r, s);
  const large = span > 180 ? 1 : 0;
  return `M${A.x} ${A.y} A${r} ${r} 0 ${large} 1 ${B.x} ${B.y} L${C.x} ${C.y} A${r} ${r} 0 ${large} 0 ${D.x} ${D.y}Z`;
}

function frontFaces(segs: Segment[]) {
  const ranges = [[-360, -180], [0, 180], [360, 540]] as const;
  return segs.flatMap((seg, index) => ranges.flatMap(([rs, re]) => {
    const start = Math.max(seg.start, rs);
    const end   = Math.min(seg.end, re);
    return end > start ? [{ ...seg, index, start, end }] : [];
  }));
}

function innerFaces(segs: Segment[]) {
  const ranges = [[-180, 0], [180, 360], [540, 720]] as const;
  return segs.flatMap((seg, index) => ranges.flatMap(([rs, re]) => {
    const start = Math.max(seg.start, rs);
    const end   = Math.min(seg.end, re);
    return end > start ? [{ ...seg, index, start, end }] : [];
  }));
}

function buildSegs(items: AllocItem[]) {
  const active = items.filter(i => i.share > 0.003);
  const total  = active.reduce((s, i) => s + i.share, 0) || 1;
  const avail  = 360 - GAP * active.length;
  const out: Segment[] = [];
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

type Props = { allocation: AllocItem[]; total: number };

export function V2PortfolioAllocationCard({ allocation, total }: Props) {
  const sorted = [...allocation].sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name));
  const segs   = buildSegs(sorted);
  const faceFront = frontFaces(segs);
  const faceInner = innerFaces(segs);

  return (
    <div className="v2-pac-wrap">
      <div className="v2-pac-header">РАСПРЕДЕЛЕНИЕ СРЕДСТВ</div>

      <div className="v2-pac-body">

        {/* ── Левая колонка: категории ── */}
        <div className="v2-pac-list">
          {sorted.map((item, idx) => {
            const cfg = CFG[item.name] ?? { glyph: "•", color: "#6f86a6", glow: "rgba(111,134,166,0.4)", limit: null, limitKind: "none" as LimitKind, limitLabel: "" };
            const st  = statusOf(item.share, cfg.limit, cfg.limitKind);
            const bar = Math.min(100, item.share * 100);
            const lim = cfg.limit ? cfg.limit * 100 : null;
            return (
              <div key={item.name} className="v2-pac-card"
                style={{ "--c": cfg.color, "--glow": cfg.glow, animationDelay: `${idx * 70}ms` } as CSSProperties}>
                <div className="v2-pac-card-icon" style={{ borderColor: cfg.color, boxShadow: `0 0 14px ${cfg.glow}, inset 0 0 10px rgba(0,0,0,0.6)`, color: cfg.color }}>
                  {cfg.glyph}
                </div>
                <div className="v2-pac-card-info">
                  <span className="v2-pac-card-name">{item.name}</span>
                  <span className="v2-pac-card-amt">{Math.round(item.value)} $</span>
                </div>
                <div className="v2-pac-card-right">
                  <span className="v2-pac-card-pct" style={{ color: cfg.color }}>{(item.share * 100).toFixed(1)}%</span>
                  {cfg.limitLabel && (
                    <span className="v2-pac-card-limit-row">
                      <span className="v2-pac-card-limit-label">{cfg.limitLabel}</span>
                      {st && <em className={`v2-pac-badge ${st.ok ? "ok" : "warn"}`}>{st.text}</em>}
                    </span>
                  )}
                </div>
                <div className="v2-pac-bar-track">
                  <span className="v2-pac-bar-fill"
                    style={{ width: `${bar}%`, background: cfg.color, boxShadow: `0 0 8px ${cfg.glow}`, transitionDelay: `${idx * 70 + 180}ms` }} />
                  {lim !== null && <span className="v2-pac-bar-tick" style={{ left: `${lim}%` }} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Правая колонка: донат ── */}
        <div className="v2-pac-chart-col">
          <svg viewBox="0 0 320 320" className="v2-pac-svg"
            xmlns="http://www.w3.org/2000/svg"
            style={{ shapeRendering: "geometricPrecision" }}>
            <defs>
              {/* Per-segment glow filter */}
              {segs.map((_, i) => (
                <filter key={i} id={`psg${i}`} x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="3" result="b"/>
                  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              ))}
              {/* Top-face gradient per segment */}
              {segs.map((seg, i) => {
                const c = CFG[seg.name]?.color ?? "#6f86a6";
                return (
                  <radialGradient key={i} id={`ptg${i}`} cx="35%" cy="25%" r="78%">
                    <stop offset="0%"   stopColor="#eaf6ff" stopOpacity="0.55"/>
                    <stop offset="18%"  stopColor={c} stopOpacity="1.00"/>
                    <stop offset="75%"  stopColor={c} stopOpacity="0.85"/>
                    <stop offset="100%" stopColor={c} stopOpacity="0.50"/>
                  </radialGradient>
                );
              })}
              {/* Side-wall gradient per segment */}
              {segs.map((seg, i) => {
                const c = CFG[seg.name]?.color ?? "#6f86a6";
                return (
                  <linearGradient key={i} id={`psg-wall${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={c} stopOpacity="0.90"/>
                    <stop offset="55%"  stopColor={c} stopOpacity="0.65"/>
                    <stop offset="100%" stopColor={c} stopOpacity="0.28"/>
                  </linearGradient>
                );
              })}
              {/* Dark back-wall gradient */}
              <linearGradient id="p-back-wall" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#1a4878" stopOpacity="0.90"/>
                <stop offset="50%"  stopColor="#071c3a" stopOpacity="0.97"/>
                <stop offset="100%" stopColor="#010408" stopOpacity="1"/>
              </linearGradient>
              {/* Inner well */}
              <radialGradient id="p-well" cx="50%" cy="36%" r="58%">
                <stop offset="0%"   stopColor="rgba(30,75,160,0.45)"/>
                <stop offset="60%"  stopColor="rgba(4,10,28,0.95)"/>
                <stop offset="100%" stopColor="rgba(1,3,10,1)"/>
              </radialGradient>
              {/* Top highlight bevel */}
              <linearGradient id="p-shine" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.30"/>
                <stop offset="50%"  stopColor="#d5efff" stopOpacity="0.08"/>
                <stop offset="100%" stopColor="#9bd8ff" stopOpacity="0"/>
              </linearGradient>
              {/* Drop shadow */}
              <filter id="p-shadow" x="-30%" y="-80%" width="160%" height="260%">
                <feGaussianBlur stdDeviation="8"/>
              </filter>
              {/* Scan sweep */}
              <linearGradient id="p-scan" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="white" stopOpacity="0"/>
                <stop offset="45%"  stopColor="white" stopOpacity="0.08"/>
                <stop offset="55%"  stopColor="white" stopOpacity="0.15"/>
                <stop offset="100%" stopColor="white" stopOpacity="0"/>
              </linearGradient>
              <clipPath id="p-ring-clip">
                <path d={donut(CX, CY, R_OUT + 3, R_IN - 3, -90, 269.99)}/>
              </clipPath>
              {/* Top-face clip — upper half only */}
              <clipPath id="p-top-half">
                <ellipse cx={CX} cy={CY - 10} rx={R_OUT + 8} ry={R_OUT * 0.7}/>
              </clipPath>
            </defs>

            {/* Ground shadow */}
            <ellipse cx={CX} cy="272" rx="100" ry="10"
              fill="rgba(14,70,130,0.22)" filter="url(#p-shadow)"/>

            <g transform={PUCK_TRANSFORM} style={{ isolation: "isolate" }}>

              {/* 1. Central well bottom */}
              <circle cx={CX} cy={CY + PUCK_DEPTH} r={R_IN - 2} fill="url(#p-well)"/>

              {/* 2. Back half of outer wall (dark, behind segments) */}
              <path d={curvedWall(CX, CY, R_OUT, 180, 360, PUCK_DEPTH)}
                fill="url(#p-back-wall)"/>

              {/* 3. Front half colored walls — NO stroke */}
              {faceFront.map(face => (
                <path key={`fw${face.index}-${face.start}`}
                  d={curvedWall(CX, CY, R_OUT, face.start, face.end, PUCK_DEPTH)}
                  fill={`url(#psg-wall${face.index})`}
                />
              ))}

              {/* 4. Inner walls (back half, colored) — NO stroke */}
              {faceInner.map(face => (
                <path key={`iw${face.index}-${face.start}`}
                  d={curvedWall(CX, CY, R_IN, face.start, face.end, PUCK_DEPTH)}
                  fill={`url(#psg-wall${face.index})`}
                  style={{ opacity: 0.65 }}
                />
              ))}

              {/* 5. Top-face donut segments — NO stroke, clean fills */}
              {segs.map((seg, i) => (
                <path key={`seg${i}`}
                  d={donut(CX, CY, R_OUT, R_IN, seg.start, seg.end)}
                  fill={`url(#ptg${i})`}
                  filter={`url(#psg${i})`}
                />
              ))}

              {/* 6. Bevel highlight — upper-left shine only */}
              {segs.map((seg, i) => (
                <path key={`bv${i}`}
                  d={donut(CX, CY, R_OUT, R_IN + (R_OUT - R_IN) * 0.52, seg.start, seg.end)}
                  fill="url(#p-shine)"
                  clipPath="url(#p-top-half)"
                  style={{ pointerEvents: "none" }}
                />
              ))}

              {/* 7. Outer ring contour — single clean line */}
              <circle cx={CX} cy={CY} r={R_OUT}
                fill="none"
                stroke="rgba(110,200,255,0.32)"
                strokeWidth="0.8"/>

              {/* 8. Inner ring contour */}
              <circle cx={CX} cy={CY} r={R_IN}
                fill="none"
                stroke="rgba(80,160,220,0.28)"
                strokeWidth="0.7"/>

              {/* 9. Gap lines — draw only top arcs of each gap edge as hair-lines */}
              {segs.map((seg) => [seg.start, seg.end]).flat().map((deg, idx) => {
                const n = ((deg % 360) + 360) % 360;
                // only draw the top-face gap edges, not the walls
                if (n < 2 || n > 358) return null;
                const p1 = polar(CX, CY, R_IN, deg);
                const p2 = polar(CX, CY, R_OUT, deg);
                return (
                  <line key={`gap${idx}`}
                    x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                    stroke="rgba(0,5,18,0.88)"
                    strokeWidth="1.8"
                    strokeLinecap="butt"
                  />
                );
              })}

            </g>

            {/* Scan sweep over ring */}
            <g clipPath="url(#p-ring-clip)" transform={PUCK_TRANSFORM} style={{ pointerEvents: "none" }}>
              <rect className="v2-pac-scan"
                x={CX - R_OUT - 60} y={CY - R_OUT}
                width="110" height={R_OUT * 2}
                fill="url(#p-scan)"/>
            </g>

            {/* Center label */}
            <text x={CX} y={CY + 8} textAnchor="middle"
              fontSize="23" fontWeight="700" letterSpacing="-0.03em"
              className="v2-pac-total-text"
              fill="rgba(220,242,255,0.96)"
              fontFamily="'Space Grotesk', system-ui, sans-serif">
              ${Math.round(total)}
            </text>
          </svg>

          {/* Legend */}
          <div className="v2-pac-legend">
            {segs.map((seg, i) => {
              const cfg = CFG[seg.name];
              return (
                <div key={i} className="v2-pac-legend-row">
                  <span className="v2-pac-legend-dot" style={{ background: cfg?.color, boxShadow: `0 0 6px ${cfg?.glow}` }}/>
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
