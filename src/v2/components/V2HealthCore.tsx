import type { V2Portfolio } from "../InvestorCabinetV2Lab";
import type { PortfolioHealth } from "../../lib/portfolioHealth";

const CX = 140, CY = 140;
const RADAR_R = 118;
const OUTER_R = 136;

const VB_OFF = 80;
const VB_SIZE = 280 + VB_OFF * 2; // 440

const CHIP_W = 89, CHIP_H = 52, GAP = 12, CORNER = 7;

const CHIP_LABEL: Record<string, string> = {
  reserve:         "Резерв",
  crypto:          "Крипта",
  futures:         "Фьючерсы",
  concentration:   "Концентрация",
  diversification: "Диверсификация",
  flexibility:     "Гибкость",
};

function scoreHint(s: number): string {
  if (s >= 75) return "НОРМА";
  if (s >= 50) return "УМЕРЕННО";
  if (s >= 30) return "ОСТОРОЖНО";
  return "РИСК";
}

function scoreAlpha(s: number): number {
  if (s >= 75) return 1;
  if (s >= 50) return 0.82;
  if (s >= 30) return 0.62;
  return 0.42;
}

function chipColor(s: number): string {
  if (s >= 75) return "#5AEF8D";
  if (s >= 50) return "#55C7FF";
  if (s >= 30) return "#FFB84A";
  return "#FF5D6C";
}

// Hex polygon points centered at CX,CY
function hexPts(r: number, startDeg = -90): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (startDeg + i * 60) * (Math.PI / 180);
    return `${(CX + r * Math.cos(a)).toFixed(2)},${(CY + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

// Hex points with arbitrary center (for offset shadows)
function hexPtsAt(cx: number, cy: number, r: number, startDeg = -90): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (startDeg + i * 60) * (Math.PI / 180);
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

function chipLayout(idx: number): {
  rx: number; ry: number;
  vx: number; vy: number;
  ax: number; ay: number;
} {
  const a = (-90 + idx * 60) * (Math.PI / 180);
  const vx = CX + OUTER_R * Math.cos(a);
  const vy = CY + OUTER_R * Math.sin(a);
  if (idx === 0)          return { rx: vx - CHIP_W / 2, ry: vy - GAP - CHIP_H, vx, vy, ax: vx, ay: vy - GAP };
  if (idx === 1 || idx === 2) return { rx: vx + GAP,        ry: vy - CHIP_H / 2,   vx, vy, ax: vx + GAP, ay: vy };
  if (idx === 3)          return { rx: vx - CHIP_W / 2, ry: vy + GAP,          vx, vy, ax: vx, ay: vy + GAP };
  return                         { rx: vx - GAP - CHIP_W, ry: vy - CHIP_H / 2, vx, vy, ax: vx - GAP, ay: vy };
}

function octPts(rx: number, ry: number): string {
  const c = CORNER, w = CHIP_W, h = CHIP_H;
  return [
    `${rx+c},${ry}`,     `${rx+w-c},${ry}`,
    `${rx+w},${ry+c}`,   `${rx+w},${ry+h-c}`,
    `${rx+w-c},${ry+h}`, `${rx+c},${ry+h}`,
    `${rx},${ry+h-c}`,   `${rx},${ry+c}`,
  ].join(" ");
}

// Scale value polygon toward center by factor (for inner highlight effect)
function scaleValuePts(pts: string, factor: number): string {
  return pts.split(" ").map(p => {
    const [x, y] = p.split(",").map(Number);
    return `${(CX + (x - CX) * factor).toFixed(2)},${(CY + (y - CY) * factor).toFixed(2)}`;
  }).join(" ");
}

const SCORE_LABEL: Record<string, string> = {
  reserve:         "Резерв",
  crypto:          "Крипта",
  futures:         "Фьючерсы",
  concentration:   "Концентрация",
  diversification: "Диверсификация",
  flexibility:     "Гибкость",
};

const ADVICE: Record<string, string> = {
  reserve:         "Пополните резерв — цель 30% портфеля",
  crypto:          "Доля крипты выше лимита 60% — зафиксируйте часть",
  futures:         "Фьючерсная экспозиция выше нормы — уменьшите позицию",
  concentration:   "Один актив занимает слишком большую долю — снизьте концентрацию",
  diversification: "Добавьте другой класс активов для лучшего баланса",
  flexibility:     "Мало свободного кэша — высвободите ликвидность",
};

function healthInterpretation(score: number): { text: string; color: string } {
  if (score >= 80) return { text: "Отлично — портфель в полном контроле", color: "#5AEF8D" };
  if (score >= 65) return { text: "Хорошо — портфель в зоне контроля", color: "#55C7FF" };
  if (score >= 50) return { text: "Умеренно — есть риски требующие внимания", color: "#FFB84A" };
  return { text: "Риск — портфель требует корректировки", color: "#FF5D6C" };
}

type Props = { portfolio: V2Portfolio; health: PortfolioHealth };

export function V2HealthCore({ portfolio, health }: Props) {
  const components = health.components;

  const valuePts = components
    .map((c, i) => {
      const a = (-90 + i * 60) * (Math.PI / 180);
      const r = RADAR_R * Math.max(c.score, 2) / 100;
      return `${(CX + r * Math.cos(a)).toFixed(2)},${(CY + r * Math.sin(a)).toFixed(2)}`;
    })
    .join(" ");

  const valueInnerPts = scaleValuePts(valuePts, 0.88);

  return (
    <section className="v2-panel v2-health-core v2-health-core--premium" aria-label="Portfolio health factor">
      <div className="v2-health-stage" aria-hidden="true">
        <div className="v2-stage-bg" />

        <div className="v2-hc-radar-chart">
          <svg
            viewBox={`${-VB_OFF} ${-VB_OFF} ${VB_SIZE} ${VB_SIZE}`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* ── Depth background glow (hex-shaped fill) ── */}
              <radialGradient id="v2hc-bg" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="rgba(22,68,140,0.80)" />
                <stop offset="30%"  stopColor="rgba(12,40,90,0.55)" />
                <stop offset="65%"  stopColor="rgba(5,16,42,0.30)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>

              {/* ── Core glow (inner hex) ── */}
              <radialGradient id="v2hc-core" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="rgba(200,248,255,0.88)" />
                <stop offset="20%"  stopColor="rgba(100,220,255,0.65)" />
                <stop offset="50%"  stopColor="rgba(50,150,220,0.28)" />
                <stop offset="100%" stopColor="rgba(10,50,100,0.00)" />
              </radialGradient>

              {/* ── Core glass highlight gradient ── */}
              <linearGradient id="v2hc-core-glass" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="rgba(200,248,255,0.30)" />
                <stop offset="40%"  stopColor="rgba(100,200,240,0.10)" />
                <stop offset="100%" stopColor="rgba(10,40,80,0.05)" />
              </linearGradient>

              {/* ── Value polygon fill ── */}
              <radialGradient id="v2hc-poly-fill" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="rgba(142,235,255,0.00)" />
                <stop offset="35%"  stopColor="rgba(85,199,255,0.06)" />
                <stop offset="75%"  stopColor="rgba(85,199,255,0.16)" />
                <stop offset="100%" stopColor="rgba(20,80,160,0.06)" />
              </radialGradient>

              {/* ── Chip glass gradient (top→bottom) ── */}
              <linearGradient id="v2hc-chip-glass" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="rgba(120,210,255,0.22)" />
                <stop offset="28%"  stopColor="rgba(60,150,220,0.08)" />
                <stop offset="60%"  stopColor="rgba(10,40,90,0.03)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.00)" />
              </linearGradient>

              {/* ── Filters ── */}
              <filter id="v2hc-f-bg" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="18" />
              </filter>
              <filter id="v2hc-f-poly-bloom" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="6" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="v2hc-f-poly-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3.5" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="v2hc-f-core-bloom" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="12" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="v2hc-f-hex-shadow">
                <feDropShadow dx="2.5" dy="3" stdDeviation="5" floodColor="rgba(0,5,20,0.85)" floodOpacity="1" />
              </filter>
              <filter id="v2hc-f-chip-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3.5" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="v2hc-f-score-glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="5" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="v2hc-f-dot" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="3" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>

              {/* Blueprint grid pattern */}
              <pattern id="v2hc-bp" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="20" y2="0" stroke="rgba(40,160,220,0.06)" strokeWidth="0.3"/>
                <line x1="0" y1="0" x2="0" y2="20" stroke="rgba(40,160,220,0.06)" strokeWidth="0.3"/>
              </pattern>
            </defs>

            {/* ══════════════════════════════════════════
                LAYER 0 — DEPTH HEX OUTLINES ONLY
            ══════════════════════════════════════════ */}
            {[165, 148].map((r, i) => (
              <polygon key={`depth-${i}`} points={hexPts(r)} fill="none"
                stroke={`rgba(40,140,210,${0.06 + i * 0.03})`}
                strokeWidth="0.5" strokeDasharray={i === 0 ? "3 8" : "2 6"} />
            ))}

            {/* ══════════════════════════════════════════
                LAYER 1 — INNER CORE (BACKGROUND)
                Small, transparent — sits far behind the polygon
            ══════════════════════════════════════════ */}

            {/* Core soft glow — very faint atmospheric pulse */}
            <polygon points={hexPts(42)}
              fill="url(#v2hc-core)"
              filter="url(#v2hc-f-core-bloom)"
              opacity="0.35" />

            {/* Core base — light blue glass */}
            <polygon points={hexPts(38)}
              fill="rgba(85,199,255,0.07)"
              stroke="none" />

            {/* Core energy face */}
            <polygon points={hexPts(36)}
              fill="url(#v2hc-core)"
              opacity="0.28" />

            {/* Core glass top sheen */}
            <polygon points={hexPts(36)}
              fill="url(#v2hc-core-glass)"
              opacity="0.55" />

            {/* Core rim — faint */}
            <polygon points={hexPts(38)}
              fill="none" stroke="rgba(85,199,255,0.30)" strokeWidth="0.7" />
            <polygon points={hexPts(32, -30)}
              fill="none" stroke="rgba(85,199,255,0.12)" strokeWidth="0.4" />

            {/* Core soft glow — atmospheric pulse behind the number */}
            <polygon points={hexPts(44)}
              fill="url(#v2hc-core)"
              filter="url(#v2hc-f-core-bloom)"
              opacity="0.45" />

            {/* Core base — light blue glass */}
            <polygon points={hexPts(40)}
              fill="rgba(85,199,255,0.09)"
              stroke="none" />

            {/* Core energy face */}
            <polygon points={hexPts(38)}
              fill="url(#v2hc-core)"
              opacity="0.32" />

            {/* Core glass top sheen */}
            <polygon points={hexPts(38)}
              fill="url(#v2hc-core-glass)"
              opacity="0.60" />

            {/* Core rim */}
            <polygon points={hexPts(40)}
              fill="none" stroke="rgba(85,199,255,0.28)" strokeWidth="0.65" />
            <polygon points={hexPts(34, -30)}
              fill="none" stroke="rgba(85,199,255,0.10)" strokeWidth="0.35" />

            {/* ══════════════════════════════════════════
                LAYER 2 — OUTER HEX BOUNDARY (3D)
            ══════════════════════════════════════════ */}

            {/* 3D shadow */}
            <polygon points={hexPtsAt(CX + 3, CY + 4, OUTER_R + 2)}
              fill="rgba(0,5,18,0.55)" stroke="none"
              filter="url(#v2hc-f-hex-shadow)" />

            {/* Outer hex fill */}
            <polygon points={hexPts(OUTER_R)}
              fill="rgba(4,15,40,0.28)" stroke="none" />

            {/* Outer hex border */}
            <polygon points={hexPts(OUTER_R)}
              fill="none" stroke="rgba(85,199,255,0.52)" strokeWidth="1.0" />

            {/* Inner bevel */}
            <polygon points={hexPts(OUTER_R - 2.5)}
              fill="none" stroke="rgba(142,235,255,0.16)" strokeWidth="0.5" />

            {/* Outer glow */}
            <polygon points={hexPts(OUTER_R + 1.5)}
              fill="none" stroke="rgba(85,199,255,0.16)" strokeWidth="2.0"
              filter="url(#v2hc-f-poly-glow)" />

            {/* Vertex tick marks */}
            {Array.from({ length: 6 }, (_, i) => {
              const a = (-90 + i * 60) * (Math.PI / 180);
              const c = Math.cos(a), s = Math.sin(a);
              return <line key={`tk-${i}`}
                x1={(CX + (OUTER_R + 4) * c).toFixed(2)} y1={(CY + (OUTER_R + 4) * s).toFixed(2)}
                x2={(CX + (OUTER_R + 10) * c).toFixed(2)} y2={(CY + (OUTER_R + 10) * s).toFixed(2)}
                stroke="rgba(142,235,255,0.48)" strokeWidth="1.1" />;
            })}

            {/* ══════════════════════════════════════════
                LAYER 3 — RADAR GRID (hex rings + axis rays)
            ══════════════════════════════════════════ */}

            {/* Concentric hex rings at 55% and 100% */}
            {[0.55, 1.0].map((scale, i) => (
              <polygon key={`gr-${i}`}
                points={hexPts(RADAR_R * scale)}
                fill="none"
                stroke={i === 1 ? "rgba(85,199,255,0.14)" : "rgba(60,150,210,0.08)"}
                strokeWidth={i === 1 ? "0.6" : "0.35"}
              />
            ))}

            {/* Axis rays — from center to radar boundary, slightly visible */}
            {Array.from({ length: 6 }, (_, i) => {
              const a = (-90 + i * 60) * (Math.PI / 180);
              return (
                <line key={`ax-${i}`}
                  x1={CX} y1={CY}
                  x2={(CX + RADAR_R * Math.cos(a)).toFixed(2)}
                  y2={(CY + RADAR_R * Math.sin(a)).toFixed(2)}
                  stroke="rgba(85,199,255,0.16)" strokeWidth="0.55" />
              );
            })}

            {/* ══════════════════════════════════════════
                LAYER 4 — VALUE POLYGON (FOREGROUND)
                The main dynamic shape — on top of everything
            ══════════════════════════════════════════ */}

            {/* 3D shadow behind polygon */}
            <polygon points={valuePts}
              fill="none"
              stroke="rgba(0,5,20,0.65)"
              strokeWidth="8"
              transform="translate(2.5,3)"
              filter="url(#v2hc-f-poly-bloom)"
            />

            {/* Wide bloom glow */}
            <polygon points={valuePts}
              fill="rgba(85,199,255,0.07)"
              stroke="rgba(85,199,255,0.42)"
              strokeWidth="12"
              filter="url(#v2hc-f-poly-bloom)"
            />

            {/* Main polygon — sharp bright foreground edge */}
            <polygon points={valuePts}
              fill="url(#v2hc-poly-fill)"
              stroke="rgba(142,235,255,0.98)"
              strokeWidth="1.6"
              strokeLinejoin="round"
              className="v2-hc-polygon-pulse"
            />

            {/* Inner glass highlight on polygon */}
            <polygon points={valueInnerPts}
              fill="none"
              stroke="rgba(210,252,255,0.28)"
              strokeWidth="0.7"
              strokeLinejoin="round"
            />

            {/* Outer vertex dots — top layer */}
            {Array.from({ length: 6 }, (_, i) => {
              const a = (-90 + i * 60) * (Math.PI / 180);
              const ox = (CX + RADAR_R * Math.cos(a)).toFixed(2);
              const oy = (CY + RADAR_R * Math.sin(a)).toFixed(2);
              return (
                <g key={`od-${i}`}>
                  <polygon points={hexPtsAt(Number(ox), Number(oy), 4.5)}
                    fill="rgba(85,199,255,0.22)" filter="url(#v2hc-f-dot)" />
                  <polygon points={hexPtsAt(Number(ox), Number(oy), 2.2)}
                    fill="rgba(184,244,255,0.96)" />
                </g>
              );
            })}

            {/* Value vertex dots */}
            {components.map((c, i) => {
              const a = (-90 + i * 60) * (Math.PI / 180);
              const r = RADAR_R * Math.max(c.score, 2) / 100;
              const vx2 = (CX + r * Math.cos(a)).toFixed(2);
              const vy2 = (CY + r * Math.sin(a)).toFixed(2);
              return (
                <g key={`vv-${i}`}>
                  <polygon points={hexPtsAt(Number(vx2), Number(vy2), 5.5)}
                    fill="rgba(85,199,255,0.30)" filter="url(#v2hc-f-dot)" />
                  <polygon points={hexPtsAt(Number(vx2), Number(vy2), 2.8)}
                    fill="rgba(220,250,255,0.99)"
                    style={{ opacity: scoreAlpha(c.score) }} />
                </g>
              );
            })}

            {/* ══════════════════════════════════════════
                LAYER 5 — SCORE TEXT (FOREGROUND)
                Drawn on top of the polygon — white & bright
            ══════════════════════════════════════════ */}

            {/* Light blue hex backdrop so text reads cleanly over the glow */}
            <polygon points={hexPts(34)}
              fill="rgba(85,199,255,0.10)"
              stroke="rgba(85,199,255,0.35)"
              strokeWidth="0.7"
            />

            {/* Score glow halo */}
            <text x={CX} y={CY + 5} textAnchor="middle"
              fontSize="26" fontWeight="900"
              fontFamily="var(--v2-mono,'Courier New',monospace)"
              fill="rgba(142,235,255,0.60)"
              filter="url(#v2hc-f-score-glow)">
              {portfolio.healthFactor}
            </text>
            {/* Score — white, sharp, foreground */}
            <text x={CX} y={CY + 5} textAnchor="middle"
              fontSize="26" fontWeight="900"
              fontFamily="var(--v2-mono,'Courier New',monospace)"
              fill="rgba(255,255,255,1.00)"
              letterSpacing="-0.3">
              {portfolio.healthFactor}
            </text>

            {/* Separator */}
            <line x1={CX - 20} y1={CY + 10} x2={CX + 20} y2={CY + 10}
              stroke="rgba(85,199,255,0.35)" strokeWidth="0.5" />

            {/* Label — white, bright */}
            <text x={CX} y={CY + 18} textAnchor="middle"
              fontSize="4.4" fontWeight="700"
              fontFamily="var(--v2-sans,system-ui,sans-serif)"
              fill="rgba(255,255,255,0.90)"
              letterSpacing="0.8">
              ЗДОРОВЬЕ ПОРТФЕЛЯ
            </text>

            {/* ══════════════════════════════════════════
                LAYER 6 — CHIP CARDS (premium glass panels)
            ══════════════════════════════════════════ */}
            {components.map((c, i) => {
              const { rx, ry, vx, vy, ax, ay } = chipLayout(i);
              const color = chipColor(c.score);
              const label = CHIP_LABEL[c.key as keyof typeof CHIP_LABEL] ?? c.key;
              const mx = rx + CHIP_W / 2;

              return (
                <g key={`chip-${c.key}`}>
                  {/* Connector line from vertex to chip */}
                  <line x1={vx.toFixed(2)} y1={vy.toFixed(2)}
                    x2={ax.toFixed(2)} y2={ay.toFixed(2)}
                    stroke="rgba(85,199,255,0.32)"
                    strokeWidth="0.7"
                    strokeDasharray="2 2" />

                  {/* Card 3D shadow */}
                  <polygon points={octPts(rx + 2.5, ry + 3)}
                    fill="rgba(0,4,16,0.70)"
                    filter="url(#v2hc-f-chip-glow)" />

                  {/* Card glow border layer */}
                  <polygon points={octPts(rx, ry)}
                    fill="none"
                    stroke="rgba(85,199,255,0.65)"
                    strokeWidth="2.5"
                    filter="url(#v2hc-f-chip-glow)"
                  />

                  {/* Card main body — dark glass */}
                  <polygon points={octPts(rx, ry)}
                    fill="rgba(5,16,42,0.88)"
                    stroke="rgba(85,199,255,0.78)"
                    strokeWidth="0.85"
                  />

                  {/* Card glass overlay gradient */}
                  <clipPath id={`v2hc-clip-${i}`}>
                    <polygon points={octPts(rx, ry)} />
                  </clipPath>
                  <g clipPath={`url(#v2hc-clip-${i})`}>
                    {/* Glass sheen on top */}
                    <rect x={rx} y={ry} width={CHIP_W} height={CHIP_H}
                      fill="url(#v2hc-chip-glass)" />

                    {/* Top edge highlight — glass bevel */}
                    <line x1={rx + CORNER} y1={ry + 0.6}
                      x2={rx + CHIP_W - CORNER} y2={ry + 0.6}
                      stroke="rgba(200,248,255,0.35)" strokeWidth="1.0" />

                    {/* Left color accent bar */}
                    <rect x={rx} y={ry} width="3.0" height={CHIP_H}
                      fill={color} opacity="0.72" />
                    <rect x={rx} y={ry} width="3.0" height={CHIP_H}
                      fill="rgba(255,255,255,0.18)" />

                    {/* Label */}
                    <text x={mx + 1.5} y={ry + 15}
                      fontSize="5.2" fontWeight="800"
                      fill="rgba(142,210,235,0.85)"
                      fontFamily="var(--v2-sans,system-ui,sans-serif)"
                      letterSpacing="0.4" textAnchor="middle">
                      {label}
                    </text>

                    {/* Score number */}
                    <text x={mx + 1.5} y={ry + 35}
                      fontSize="18" fontWeight="900"
                      fill="rgba(240,252,255,0.97)"
                      fontFamily="var(--v2-mono,'Courier New',monospace)"
                      textAnchor="middle"
                      style={{ opacity: scoreAlpha(c.score) }}>
                      {c.score}
                    </text>

                    {/* Status */}
                    <text x={mx + 1.5} y={ry + 47}
                      fontSize="4.8" fontWeight="700"
                      fill={color}
                      fontFamily="var(--v2-sans,system-ui,sans-serif)"
                      letterSpacing="0.8" textAnchor="middle">
                      {scoreHint(c.score)}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* ── Расшифровка Health Factor ── */}
      {(() => {
        const sorted = [...health.components].sort((a, b) => a.score - b.score);
        const weak = sorted.filter(c => c.score < 65).slice(0, 2);
        const strong = sorted.filter(c => c.score >= 75).slice(-1);
        const interp = healthInterpretation(health.healthFactor);
        const topAdvice = weak[0] ? ADVICE[weak[0].key] : null;

        return (
          <div className="v2-hc-insight">
            <div className="v2-hc-insight-header">
              <span className="v2-hc-insight-score" style={{ color: interp.color }}>
                {health.healthFactor}
              </span>
              <span className="v2-hc-insight-interp">{interp.text}</span>
            </div>

            <div className="v2-hc-insight-rows">
              {strong.map(c => (
                <div key={c.key} className="v2-hc-insight-row v2-hc-insight-row--ok">
                  <span className="v2-hc-insight-icon">✓</span>
                  <span className="v2-hc-insight-name">{SCORE_LABEL[c.key]}</span>
                  <span className="v2-hc-insight-val">{c.score}</span>
                </div>
              ))}
              {weak.map(c => (
                <div key={c.key} className="v2-hc-insight-row v2-hc-insight-row--warn">
                  <span className="v2-hc-insight-icon">⚠</span>
                  <span className="v2-hc-insight-name">{SCORE_LABEL[c.key]}</span>
                  <span className="v2-hc-insight-val">{c.score}</span>
                </div>
              ))}
            </div>

            {topAdvice && (
              <div className="v2-hc-insight-action">
                <span className="v2-hc-insight-arrow">→</span>
                {topAdvice}
              </div>
            )}
          </div>
        );
      })()}

      <span className="v2-sr-only">Здоровье портфеля {portfolio.healthFactor}.</span>
    </section>
  );
}
