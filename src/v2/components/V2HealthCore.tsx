import type { V2Portfolio, V2Page } from "../InvestorCabinetV2Lab";
import type { HealthComponent, HealthInput, PortfolioHealth } from "../../lib/portfolioHealth";
import { isEmptyAccount } from "../lib/accountState";
import {
  CX, CY, RADAR_R, OUTER_R, VB_OFF, VB_SIZE, CHIP_W, CHIP_H, CHIP_R,
  CHIP_LABEL, SCORE_LABEL, scoreHint, scoreAlpha, chipColor,
  hexPts, hexPtsAt, chipLayout, scaleValuePts,
  healthInterpretation, diagWhy, buildCoreRecs, isActionableHealthComponent,
} from "../lib/healthCoreHelpers";

type Props = {
  portfolio: V2Portfolio;
  health: PortfolioHealth;
  healthInput: HealthInput;
  onChipSelect?: (c: HealthComponent) => void;
  onNavigate?: (page: V2Page) => void;
};

export function V2HealthCore({ portfolio, health, healthInput, onChipSelect, onNavigate }: Props) {
  const components = health.components;

  // Пустой аккаунт (кошельки ещё не подключены): диагноз/рекомендации не про
  // «риск портфеля», а призыв подключить кошельки.
  const isEmpty = isEmptyAccount(portfolio);

  const valuePts = components
    .map((c, i) => {
      const a = (-90 + i * 60) * (Math.PI / 180);
      const r = RADAR_R * Math.max(c.score, 2) / 100;
      return `${(CX + r * Math.cos(a)).toFixed(2)},${(CY + r * Math.sin(a)).toFixed(2)}`;
    })
    .join(" ");

  const valueInnerPts = scaleValuePts(valuePts, 0.88);

  // ── Диагноз (слабые места) и рекомендации (что делать) ──
  const sorted = [...components].sort((a, b) => a.score - b.score);
  const weak = sorted.filter(c => c.score < 65).slice(0, 5);
  const strong = sorted.filter(c => c.score >= 75).slice(-2);
  const actionable = sorted.filter(isActionableHealthComponent);
  // Рекомендации считаем один раз на всех компонентах (перевес актива даёт
  // рекомендацию даже при «умеренном» балле, не попав в weak).
  const recs = isEmpty ? [] : buildCoreRecs(actionable, portfolio, components, healthInput);
  const interp = isEmpty
    ? { text: "Подключите кошельки, чтобы увидеть анализ портфеля", color: "#55C7FF" }
    : healthInterpretation(health.healthFactor);

  return (
    <section className="v2-panel v2-health-core v2-health-core--premium" aria-label="Portfolio health factor">
      <div className="v2-hc-layout">

      {/* ── Слева: ДИАГНОЗ ── */}
      <aside className="v2-hc-side v2-hc-side--diagnosis">
        {/* Шкала здоровья портфеля */}
        <div className="v2-hc-healthbar">
          <div className="v2-hc-healthbar-top">
            <div className="v2-hc-healthbar-headings">
              <div className="v2-hc-healthbar-label">Здоровье портфеля</div>
              <div className="v2-hc-healthbar-num">
                <strong style={{ color: interp.color }}>{health.healthFactor}</strong>
                <span> / 100</span>
              </div>
            </div>
            <button type="button" className="v2-hc-detail-btn" onClick={() => onNavigate?.("health")}>
              Подробный анализ
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M4 2.5l4 3.5-4 3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className="v2-hc-healthbar-track">
            <span
              className="v2-hc-healthbar-marker"
              style={{ left: `${Math.max(0, Math.min(100, health.healthFactor))}%` }}
            />
          </div>
          <div className="v2-hc-healthbar-scale">
            <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
          </div>
        </div>

        <div className="v2-hc-side-title">Диагноз</div>
        <div className="v2-hc-side-verdict" style={{ color: interp.color }}>{interp.text}</div>
        <div className="v2-hc-side-list">
          {isEmpty && (
            <div className="v2-hc-diag-row">
              <span className="v2-hc-diag-icon">🔗</span>
              <div className="v2-hc-diag-body">
                <span className="v2-hc-diag-name">Кошельки не подключены</span>
                <span className="v2-hc-diag-why">Подключите свои кошельки, чтобы увидеть здоровье, риск и рекомендации по вашему портфелю.</span>
              </div>
            </div>
          )}
          {!isEmpty && portfolio.deployableCapital < 50 && (
            <div className="v2-hc-diag-row v2-hc-diag-row--critical">
              <span className="v2-hc-diag-icon">🔴</span>
              <div className="v2-hc-diag-body">
                <span className="v2-hc-diag-name">Покупательская сила</span>
                <span className="v2-hc-diag-why">На нуле — нечем откупать на просадке. Пополни баланс.</span>
              </div>
            </div>
          )}
          {!isEmpty && strong.map(c => (
            <div key={c.key} className="v2-hc-diag-row v2-hc-diag-row--ok">
              <span className="v2-hc-diag-icon">✓</span>
              <div className="v2-hc-diag-body">
                <span className="v2-hc-diag-name">{SCORE_LABEL[c.key]}</span>
                <span className="v2-hc-diag-why">{diagWhy(c, portfolio)}</span>
              </div>
              <span className="v2-hc-diag-val">{c.score}</span>
            </div>
          ))}
          {!isEmpty && weak.map(c => (
            <div key={c.key} className="v2-hc-diag-row v2-hc-diag-row--warn">
              <span className="v2-hc-diag-icon">⚠</span>
              <div className="v2-hc-diag-body">
                <span className="v2-hc-diag-name">{SCORE_LABEL[c.key]}</span>
                <span className="v2-hc-diag-why">{diagWhy(c, portfolio)}</span>
              </div>
              <span className="v2-hc-diag-val">{c.score}</span>
            </div>
          ))}
        </div>
      </aside>

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

              {/* ── Convex lens: купол-блик сверху ── */}
              <radialGradient id="v2hc-chip-dome" cx="40%" cy="26%" r="62%">
                <stop offset="0%"   stopColor="rgba(230,251,255,0.55)" />
                <stop offset="24%"  stopColor="rgba(175,232,255,0.22)" />
                <stop offset="52%"  stopColor="rgba(120,200,245,0.05)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>

              {/* ── Convex lens: вторичный отблеск снизу ── */}
              <radialGradient id="v2hc-chip-bounce" cx="55%" cy="97%" r="50%">
                <stop offset="0%"   stopColor="rgba(150,215,255,0.18)" />
                <stop offset="55%"  stopColor="rgba(80,160,220,0.04)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>

              {/* ── Convex lens: преломляющий ободок по краю ── */}
              <radialGradient id="v2hc-chip-rim" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="rgba(0,0,0,0)" />
                <stop offset="76%"  stopColor="rgba(0,0,0,0)" />
                <stop offset="90%"  stopColor="rgba(195,242,255,0.12)" />
                <stop offset="100%" stopColor="rgba(8,26,55,0.34)" />
              </radialGradient>

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

            {/* Concentric hex rings at 50% (норма) and 100% */}
            {[0.5, 1.0].map((scale, i) => (
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

            {/* Outer vertex dots (отметка 100) — top layer */}
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

            {/* Mid vertex dots (отметка 50 — «норма», порог здоровья) */}
            {Array.from({ length: 6 }, (_, i) => {
              const a = (-90 + i * 60) * (Math.PI / 180);
              const mx = (CX + RADAR_R * 0.5 * Math.cos(a)).toFixed(2);
              const my = (CY + RADAR_R * 0.5 * Math.sin(a)).toFixed(2);
              return (
                <g key={`md-${i}`}>
                  <polygon points={hexPtsAt(Number(mx), Number(my), 4.5)}
                    fill="rgba(85,199,255,0.22)" filter="url(#v2hc-f-dot)" />
                  <polygon points={hexPtsAt(Number(mx), Number(my), 2.2)}
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
              const labelLines = c.key === "futures" ? ["Контроль", "риска"] : [label];
              const cx = rx + CHIP_W / 2 + 1.5;
              const cy = ry + CHIP_H / 2;

              return (
                <g key={`chip-${c.key}`}
                  onClick={() => onChipSelect?.(c)}
                  style={{ cursor: onChipSelect ? "pointer" : "default" }}
                  className="v2-hc-chip-interactive"
                >
                  {/* Connector line */}
                  <line x1={vx.toFixed(2)} y1={vy.toFixed(2)}
                    x2={ax.toFixed(2)} y2={ay.toFixed(2)}
                    stroke="rgba(85,199,255,0.32)"
                    strokeWidth="0.7"
                    strokeDasharray="2 2" />

                  {/* Shadow circle */}
                  <circle cx={cx + 2} cy={cy + 3} r={CHIP_R}
                    fill="rgba(0,4,16,0.55)"
                    filter="url(#v2hc-f-chip-glow)" />

                  {/* Outer glow ring */}
                  <circle cx={cx} cy={cy} r={CHIP_R}
                    fill="none"
                    stroke="rgba(85,199,255,0.55)"
                    strokeWidth="2.8"
                    filter="url(#v2hc-f-chip-glow)" />

                  {/* Main fill */}
                  <circle cx={cx} cy={cy} r={CHIP_R}
                    fill="rgba(5,16,42,0.90)"
                    stroke="rgba(85,199,255,0.70)"
                    strokeWidth="0.9" />

                  {/* Score progress arc — fills clockwise from top based on score/100.
                      Если балл = 0 — кольцо пустое, только красная пульсирующая точка
                      сверху: метрика «больна» (напр. резерв не сформирован). */}
                  {(() => {
                    const r = CHIP_R - 1.5;
                    const circ = 2 * Math.PI * r;
                    const fill = circ * (c.score / 100);
                    const gap = circ - fill;
                    const offset = circ * 0.25; // start at 12 o'clock
                    const isEmpty = c.score <= 0;
                    return (
                      <>
                        {/* Track ring (dim background) */}
                        <circle cx={cx} cy={cy} r={r}
                          fill="none"
                          stroke="rgba(255,255,255,0.08)"
                          strokeWidth="2.2" />
                        {isEmpty ? (
                          /* Красная пульсирующая точка на 12 часах */
                          <circle cx={cx} cy={cy - r} r="2.6"
                            fill="#FF5D6C"
                            className="v2-hc-chip-deadpoint" />
                        ) : (
                          /* Fill arc */
                          <circle cx={cx} cy={cy} r={r}
                            fill="none"
                            stroke={color}
                            strokeWidth="2.8"
                            strokeOpacity="0.90"
                            strokeDasharray={`${fill} ${gap}`}
                            strokeDashoffset={`${offset}`}
                            strokeLinecap="round" />
                        )}
                      </>
                    );
                  })()}

                  {/* Glass sheen highlight */}
                  <clipPath id={`v2hc-clip-${i}`}>
                    <circle cx={cx} cy={cy} r={CHIP_R} />
                  </clipPath>
                  <g clipPath={`url(#v2hc-clip-${i})`}>
                    {/* base top→bottom tint */}
                    <rect x={cx - CHIP_R} y={cy - CHIP_R} width={CHIP_R * 2} height={CHIP_R}
                      fill="url(#v2hc-chip-glass)" />
                    {/* convex dome specular (top) */}
                    <circle cx={cx} cy={cy} r={CHIP_R} fill="url(#v2hc-chip-dome)" />
                    {/* secondary bounce light (bottom) */}
                    <circle cx={cx} cy={cy} r={CHIP_R} fill="url(#v2hc-chip-bounce)" />
                    {/* edge refraction rim */}
                    <circle cx={cx} cy={cy} r={CHIP_R} fill="url(#v2hc-chip-rim)" />
                    {/* curved crisp highlight along top inner edge */}
                    <path
                      d={`M ${(cx - CHIP_R * 0.62).toFixed(2)} ${(cy - CHIP_R * 0.6).toFixed(2)} A ${(CHIP_R * 0.8).toFixed(2)} ${(CHIP_R * 0.8).toFixed(2)} 0 0 1 ${(cx + CHIP_R * 0.58).toFixed(2)} ${(cy - CHIP_R * 0.64).toFixed(2)}`}
                      fill="none" stroke="rgba(228,251,255,0.5)" strokeWidth="1.3" strokeLinecap="round" />
                  </g>

                  {/* Label */}
                  <text x={cx} y={cy - 15}
                    fontSize={c.key === "futures" ? "5.6" : "7"} fontWeight="800"
                    fill="rgba(142,210,235,0.88)"
                    fontFamily="var(--v2-sans,system-ui,sans-serif)"
                    letterSpacing="0.4" textAnchor="middle">
                    {labelLines.map((line, lineIndex) => (
                      <tspan key={line} x={cx} dy={lineIndex === 0 ? 0 : 7}>
                        {line}
                      </tspan>
                    ))}
                  </text>

                  {/* Score number — всегда чисто-белый, как центральный */}
                  <text x={cx} y={cy + 9}
                    fontSize="22" fontWeight="900"
                    fill="#ffffff"
                    fontFamily="var(--v2-mono,'Courier New',monospace)"
                    textAnchor="middle">
                    {c.score}
                  </text>

                  {/* Status */}
                  <text x={cx} y={cy + 26}
                    fontSize="6" fontWeight="700"
                    fill={color}
                    fontFamily="var(--v2-sans,system-ui,sans-serif)"
                    letterSpacing="0.8" textAnchor="middle">
                    {scoreHint(c.score)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* ── Справа: РЕКОМЕНДАЦИИ ── */}
      <aside className="v2-hc-side v2-hc-side--recommend">
        <div className="v2-hc-side-title">Рекомендации</div>
        <div className="v2-hc-side-list">
          {isEmpty ? (
            <div className="v2-hc-rec-row v2-hc-rec-row--critical">
              <span className="v2-hc-rec-gain">1</span>
              <div className="v2-hc-rec-body">
                <span className="v2-hc-rec-action">Подключите реальные кошельки</span>
                <span className="v2-hc-rec-source">Портфель, риск и здоровье появятся автоматически по вашим данным</span>
              </div>
            </div>
          ) : recs.length === 0 ? (
            <div className="v2-hc-rec-row v2-hc-rec-row--ok">
              <span className="v2-hc-rec-arrow">✓</span>
              <span>Портфель сбалансирован — удерживайте структуру.</span>
            </div>
          ) : recs.map((rec, i) => (
            <div key={i} className={`v2-hc-rec-row v2-hc-rec-row--critical${rec.critical ? " is-urgent" : ""}`}>
              <span className="v2-hc-rec-gain">+{rec.gain}</span>
              <div className="v2-hc-rec-body">
                <span className="v2-hc-rec-action">{rec.action}</span>
                <span className="v2-hc-rec-source">{rec.source}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      </div>

      <span className="v2-sr-only">Здоровье портфеля {portfolio.healthFactor}.</span>
    </section>
  );
}
