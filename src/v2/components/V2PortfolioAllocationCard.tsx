import { useState, type CSSProperties } from "react";
import { isEmptyAccount } from "../lib/accountState";

type AllocItem = { name: string; share: number; value: number };
type LimitKind = "max" | "min" | "none";

const CFG: Record<string, {
  glyph: string; color: string; iconColor: string; glow: string;
  limit: number | null; limitKind: LimitKind;
  limitLabel: string;
}> = {
  "Крипта":           { glyph: "₿", color: "#1260E8", iconColor: "#3D8FFF", glow: "rgba(18,96,232,0.85)",   limit: 0.60, limitKind: "max", limitLabel: "ЛИМИТ 60%" },
  "Металлы":          { glyph: "◆", color: "#E6A200", iconColor: "#FFB800", glow: "rgba(230,162,0,0.80)",   limit: 0.10, limitKind: "max", limitLabel: "ЛИМИТ 10%" },
  "Фьючерсы":         { glyph: "↗", color: "#8B20FF", iconColor: "#B060FF", glow: "rgba(139,32,255,0.82)",  limit: 0.10, limitKind: "max", limitLabel: "ЛИМИТ 10%" },
  "Акции":            { glyph: "▲", color: "#00BFFF", iconColor: "#22E5FF", glow: "rgba(0,191,255,0.80)",   limit: 0.10, limitKind: "max", limitLabel: "ЛИМИТ 10%" },
  "Свободные деньги": { glyph: "$", color: "#00CC66", iconColor: "#00FF80", glow: "rgba(0,204,102,0.80)",   limit: 0.30, limitKind: "min", limitLabel: "ЦЕЛЬ 30%" },
};

const ORDER = ["Крипта", "Металлы", "Фьючерсы", "Акции", "Свободные деньги"];

/* ── SVG geometry ── */
const CX = 160, CY = 160, R_OUT = 116, R_IN = 72, GAP = 2.2;
const PERSPECTIVE_Y = 0.64;
const PUCK_DEPTH = 32;
const PUCK_OFFSET_Y = CY * (1 - PERSPECTIVE_Y);
const PUCK_TRANSFORM = `translate(0 ${PUCK_OFFSET_Y}) scale(1 ${PERSPECTIVE_Y})`;
// HUD tick marks: 8 major (every 45°) + 16 minor (every 22.5°) — cleaner than 36
const HUD_MAJOR_TICKS = Array.from({ length: 8  }, (_, i) => i * 45);
const HUD_MINOR_TICKS = Array.from({ length: 16 }, (_, i) => i * 22.5).filter(d => d % 45 !== 0);
const HUD_CY = 160, HUD_RX = 150, HUD_RY = 103;

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

function ellipsePoint(cx: number, cy: number, rx: number, ry: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + rx * Math.cos(rad), y: cy + ry * Math.sin(rad) };
}

function ellipseArcPath(cx: number, cy: number, rx: number, ry: number, s: number, e: number) {
  const A = ellipsePoint(cx, cy, rx, ry, s);
  const B = ellipsePoint(cx, cy, rx, ry, e);
  const large = e - s > 180 ? 1 : 0;
  return `M${A.x} ${A.y} A${rx} ${ry} 0 ${large} 1 ${B.x} ${B.y}`;
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

function CategoryGlyph({ name }: { name: string }) {
  if (name === "Металлы") {
    return (
      <svg className="v2-pac-card-icon-svg" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 3.5 7.5 16 16 21l8.5-5L16 3.5Z" />
        <path d="m7.5 17.8 8.5 10.7 8.5-10.7L16 23l-8.5-5.2Z" />
      </svg>
    );
  }

  if (name === "Фьючерсы") {
    return (
      <svg className="v2-pac-card-icon-svg" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M7 25 25 7M12 7h13v13" />
      </svg>
    );
  }

  if (name === "Акции") {
    return (
      <svg className="v2-pac-card-icon-svg" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 5 27 25H5L16 5Z" />
        <path d="M16 10.5 22.5 23h-13L16 10.5Z" className="v2-pac-card-icon-inner" />
      </svg>
    );
  }

  return <span className="v2-pac-card-icon-text">{name === "Крипта" ? "₿" : "$"}</span>;
}

type Props = { allocation: AllocItem[]; total: number };

export function V2PortfolioAllocationCard({ allocation, total }: Props) {
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  // Пустой аккаунт (кошельки не подключены): доли по нулям — не считаем это
  // нарушением лимитов, не показываем тревожные бейджи ВЫШЕ/НИЖЕ.
  const isEmpty = isEmptyAccount({ totalPortfolioValue: total });
  const sorted = [...allocation].sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name));
  const segs   = buildSegs(sorted);
  const faceFront = frontFaces(segs);
  const faceInner = innerFaces(segs);
  const indexedSegs = segs.map((seg, index) => ({ seg, index }));
  const paintSegments = hoveredName
    ? [...indexedSegs.filter(({ seg }) => seg.name !== hoveredName), ...indexedSegs.filter(({ seg }) => seg.name === hoveredName)]
    : indexedSegs;

  const segmentStyle = (seg: Segment): CSSProperties => {
    const rad = (seg.mid * Math.PI) / 180;
    // Small offset for huge segments so they don't shift the visual center
    const offset = seg.share > 0.70 ? 3 : seg.share > 0.40 ? 5 : 8;
    return {
      "--seg-dx": `${Math.cos(rad) * offset}px`,
      // Compensate for parent scaleY so visual movement is truly radial
      "--seg-dy": `${(Math.sin(rad) * offset) / PERSPECTIVE_Y}px`,
    } as CSSProperties;
  };

  const segmentClass = (name: string) => [
    "v2-pac-segment",
    hoveredName === name ? "is-active" : "",
    hoveredName && hoveredName !== name ? "is-muted" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className="v2-pac-wrap">
      <div className="v2-pac-header">РАСПРЕДЕЛЕНИЕ СРЕДСТВ</div>

      <div className="v2-pac-body">

        {/* ── Левая колонка: категории ── */}
        <div className="v2-pac-list">
          {sorted.map((item, idx) => {
            const cfg = CFG[item.name] ?? { glyph: "•", color: "#6f86a6", iconColor: "#7fd8ff", glow: "rgba(111,134,166,0.4)", limit: null, limitKind: "none" as LimitKind, limitLabel: "" };
            const st  = isEmpty ? null : statusOf(item.share, cfg.limit, cfg.limitKind);
            const bar = Math.min(100, item.share * 100);
            const lim = cfg.limit ? cfg.limit * 100 : null;
            return (
              <div key={item.name} className={`v2-pac-card${hoveredName === item.name ? " is-active" : ""}${hoveredName && hoveredName !== item.name ? " is-muted" : ""}`}
                style={{ "--c": cfg.color, "--icon-c": cfg.iconColor, "--glow": cfg.glow, animationDelay: `${idx * 70}ms` } as CSSProperties}
                onPointerEnter={() => setHoveredName(item.name)}
                onPointerLeave={() => setHoveredName(null)}>
                <div className="v2-pac-card-icon">
                  <CategoryGlyph name={item.name} />
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
          <svg viewBox="0 0 320 320" className={`v2-pac-svg${hoveredName ? " is-hovering" : ""}`}
            xmlns="http://www.w3.org/2000/svg"
            style={{ shapeRendering: "geometricPrecision" }}>
            <defs>
              {/* Per-segment glow filter */}
              {segs.map((_, i) => (
                <g key={i}>
                  <filter id={`psg${i}`} x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="3" result="b"/>
                    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                  <filter id={`psg-hover${i}`} x="-55%" y="-55%" width="210%" height="210%">
                    <feGaussianBlur stdDeviation="4" result="b"/>
                    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                </g>
              ))}
              {/* Top-face gradient per segment */}
              {segs.map((seg, i) => {
                const c = CFG[seg.name]?.color ?? "#6f86a6";
                const ic = CFG[seg.name]?.iconColor ?? "#aaccff";
                return (
                  <radialGradient key={i} id={`ptg${i}`} cx="35%" cy="25%" r="78%">
                    <stop offset="0%"   stopColor={ic}  stopOpacity="0.72"/>
                    <stop offset="20%"  stopColor={c}   stopOpacity="1.00"/>
                    <stop offset="72%"  stopColor={c}   stopOpacity="0.88"/>
                    <stop offset="100%" stopColor={c}   stopOpacity="0.45"/>
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

            {/* Orbital HUD — four clearly-spaced concentric rings with depth gradient */}
            <g className="v2-pac-hud" aria-hidden="true">
              {/* Ring 1 — outermost, faintest (suggests far depth) */}
              <ellipse cx={CX} cy={HUD_CY} rx="158" ry="108" className="v2-pac-hud-ring--far" />
              {/* Ring 2 — outer orbit, sparse dash */}
              <ellipse cx={CX} cy={HUD_CY} rx={HUD_RX} ry={HUD_RY} className="v2-pac-hud-orbit" />
              {/* Ring 3 — mid ring, more visible */}
              <ellipse cx={CX} cy={HUD_CY} rx="130" ry="89" className="v2-pac-hud-ring" />
              {/* Ring 4 — innermost HUD ring, right at the donut perimeter */}
              <ellipse cx={CX} cy={HUD_CY} rx="118" ry="81" className="v2-pac-hud-ring--inner" />

              {/* Major ticks — 8 at 45° intervals, bridge outer two rings */}
              {HUD_MAJOR_TICKS.map(deg => {
                const from = ellipsePoint(CX, HUD_CY, 150, 103, deg);
                const to   = ellipsePoint(CX, HUD_CY, 158, 108, deg);
                return <line key={deg} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="v2-pac-hud-tick is-major" />;
              })}
              {/* Minor ticks — 16 between majors, shorter */}
              {HUD_MINOR_TICKS.map(deg => {
                const from = ellipsePoint(CX, HUD_CY, 152, 104, deg);
                const to   = ellipsePoint(CX, HUD_CY, 157, 107, deg);
                return <line key={deg} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="v2-pac-hud-tick" />;
              })}

              {/* Cardinal node diamonds at 0° / 90° / 180° / 270° on outer ring */}
              {[0, 90, 180, 270].map(deg => {
                const n = ellipsePoint(CX, HUD_CY, HUD_RX, HUD_RY, deg);
                return <circle key={deg} cx={n.x} cy={n.y} r="1.8" className="v2-pac-hud-node" />;
              })}

              {/* Accent arcs — symmetric pairs at top and bottom of orbit */}
              <path d={ellipseArcPath(CX, HUD_CY, 150, 103, -60, -20)} className="v2-pac-hud-arc" />
              <path d={ellipseArcPath(CX, HUD_CY, 150, 103,  20,  60)} className="v2-pac-hud-arc" />
              <path d={ellipseArcPath(CX, HUD_CY, 150, 103, 120, 160)} className="v2-pac-hud-arc" />
              <path d={ellipseArcPath(CX, HUD_CY, 150, 103, 200, 240)} className="v2-pac-hud-arc" />
            </g>

            <g transform={PUCK_TRANSFORM} style={{ isolation: "isolate" }}>

              {/* 1. Central well bottom */}
              <circle cx={CX} cy={CY + PUCK_DEPTH} r={R_IN - 2} fill="url(#p-well)"/>

              {/* 2. Back half outer wall — slightly past 180° on both ends to seal the seam */}
              <path d={curvedWall(CX, CY, R_OUT, 176, 364, PUCK_DEPTH)}
                fill="url(#p-back-wall)"/>

              {/* Each segment moves as one solid 3D object. */}
              {paintSegments.map(({ seg, index }) => (
                <g key={seg.name}
                  className={segmentClass(seg.name)}
                  style={segmentStyle(seg)}>
                  {faceFront.filter(face => face.index === index).map(face => (
                    <path key={`fw-${face.start}`}
                      d={curvedWall(CX, CY, R_OUT, face.start, face.end, PUCK_DEPTH)}
                      fill={`url(#psg-wall${index})`}
                    />
                  ))}

                  {faceInner.filter(face => face.index === index).map(face => (
                    <path key={`iw-${face.start}`}
                      d={curvedWall(CX, CY, R_IN, face.start, face.end, PUCK_DEPTH)}
                      fill={`url(#psg-wall${index})`}
                      opacity="0.65"
                    />
                  ))}

                  <path
                    d={donut(CX, CY, R_OUT, R_IN, seg.start, seg.end)}
                    fill={`url(#ptg${index})`}
                    filter={`url(#${hoveredName === seg.name ? `psg-hover${index}` : `psg${index}`})`}
                  />

                  <path
                    d={donut(CX, CY, R_OUT, R_IN + (R_OUT - R_IN) * 0.52, seg.start, seg.end)}
                    fill="url(#p-shine)"
                    clipPath="url(#p-top-half)"
                  />

                  {hoveredName === seg.name && (
                    <path
                      className="v2-pac-segment-outline"
                      d={donut(CX, CY, R_OUT, R_IN, seg.start, seg.end)}
                    />
                  )}
                </g>
              ))}

              {/* Gap lines are only needed in the resting state. */}
              {!hoveredName && segs.map((seg) => [seg.start, seg.end]).flat().map((deg, idx) => {
                const n = ((deg % 360) + 360) % 360;
                if (n < 2 || n > 358) return null;
                const p1 = polar(CX, CY, R_IN, deg);
                const p2 = polar(CX, CY, R_OUT, deg);
                return (
                  <line key={`gap${idx}`}
                    className="v2-pac-gap-line"
                    x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                    stroke="rgba(0,5,18,0.92)"
                    strokeWidth="1.4"
                    strokeLinecap="butt"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}

              {/* Ring contours — drawn once on top, non-scaling stroke stays uniform under perspective */}
              <circle cx={CX} cy={CY} r={R_OUT}
                fill="none" stroke="rgba(110,200,255,0.28)" strokeWidth="0.9"
                vectorEffect="non-scaling-stroke"/>
              <circle cx={CX} cy={CY} r={R_IN}
                fill="none" stroke="rgba(80,155,215,0.22)" strokeWidth="0.8"
                vectorEffect="non-scaling-stroke"/>

              {/* Stable hover targets stay in place while the visible segment moves. */}
              {segs.map((seg) => (
                <path key={`hit-${seg.name}`}
                  className="v2-pac-segment-hit"
                  d={donut(CX, CY, R_OUT + 16, R_IN - 10, seg.start, seg.end)}
                  tabIndex={0}
                  aria-label={`${seg.name}: ${(seg.share * 100).toFixed(1)}%`}
                  onPointerEnter={() => setHoveredName(seg.name)}
                  onPointerLeave={() => setHoveredName(null)}
                  onFocus={() => setHoveredName(seg.name)}
                  onBlur={() => setHoveredName(null)}
                />
              ))}

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

        </div>

      </div>
    </div>
  );
}
