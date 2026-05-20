import type { CSSProperties } from "react";
import { Panel } from "../shared/Panel";
import { currency } from "../../lib/formatters";
import type { Category, CategoryAllocation } from "../../types/portfolio";

type HologramAllocationChartProps = {
  categories: CategoryAllocation[];
};

type ChartSegment = CategoryAllocation & {
  color: string;
  glow: string;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  topPath: string;
  sidePath: string;
  liftX: number;
  liftY: number;
};

const CATEGORY_COLORS: Record<Category, { color: string; glow: string }> = {
  Крипта: { color: "#45d8ff", glow: "rgba(69, 216, 255, 0.48)" },
  Металлы: { color: "#ffe15c", glow: "rgba(255, 225, 92, 0.5)" },
  Фьючерсы: { color: "#a855f7", glow: "rgba(168, 85, 247, 0.48)" },
  Акции: { color: "#50f08d", glow: "rgba(80, 240, 141, 0.44)" },
  "Свободные деньги": { color: "#56f783", glow: "rgba(86, 247, 131, 0.48)" },
};

const DEFAULT_COLOR = { color: "#8fb5ff", glow: "rgba(143, 181, 255, 0.42)" };
const CX = 165;
const CY = 126;
const RX = 126;
const RY = 70;
const DEPTH = 36;
const MIN_VISIBLE_FRACTION = 0.002;

function pointOnEllipse(angle: number, yOffset = 0) {
  const radians = ((angle - 90) * Math.PI) / 180;

  return {
    x: CX + RX * Math.cos(radians),
    y: CY + yOffset + RY * Math.sin(radians),
  };
}

function sectorPath(startAngle: number, endAngle: number) {
  const start = pointOnEllipse(startAngle);
  const end = pointOnEllipse(endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return `M ${CX} ${CY} L ${start.x} ${start.y} A ${RX} ${RY} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

function sidePath(startAngle: number, endAngle: number) {
  const start = pointOnEllipse(startAngle);
  const end = pointOnEllipse(endAngle);
  const lowerEnd = pointOnEllipse(endAngle, DEPTH);
  const lowerStart = pointOnEllipse(startAngle, DEPTH);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return `M ${start.x} ${start.y} A ${RX} ${RY} 0 ${largeArc} 1 ${end.x} ${end.y} L ${lowerEnd.x} ${lowerEnd.y} A ${RX} ${RY} 0 ${largeArc} 0 ${lowerStart.x} ${lowerStart.y} Z`;
}

function formatShare(share: number) {
  const safeShare = Number(share || 0);
  const value = Math.abs(safeShare) <= 1 ? safeShare * 100 : safeShare;

  return `${value.toFixed(1)}%`;
}

function buildSegments(categories: CategoryAllocation[]): ChartSegment[] {
  const visibleCategories = [...categories]
    .filter((item) => Number(item.value || 0) > 0)
    .sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
  const total = visibleCategories.reduce((sum, item) => sum + Number(item.value || 0), 0);
  let cursor = -118;

  return visibleCategories.map((item) => {
    const fraction = total ? Math.max(Number(item.value || 0) / total, MIN_VISIBLE_FRACTION) : 0;
    const span = fraction * 360;
    const startAngle = cursor;
    const endAngle = cursor + span;
    const midAngle = startAngle + span / 2;
    const midRadians = ((midAngle - 90) * Math.PI) / 180;
    const palette = CATEGORY_COLORS[item.name] ?? DEFAULT_COLOR;

    cursor = endAngle;

    return {
      ...item,
      ...palette,
      startAngle,
      endAngle,
      midAngle,
      topPath: sectorPath(startAngle + 1.2, endAngle - 1.2),
      sidePath: sidePath(startAngle + 1.2, endAngle - 1.2),
      liftX: Math.cos(midRadians) * 8,
      liftY: Math.sin(midRadians) * 5,
    };
  });
}

export function HologramAllocationChart({ categories }: HologramAllocationChartProps) {
  const segments = buildSegments(categories);

  return (
    <Panel tone="yellow" className="p-6 h-full hologram-allocation-panel" hover>
      <div className="allocation-header holo-allocation-header">
        <div>
          <div className="section-kicker allocation-kicker text-yellow-300">Allocation</div>
          <div className="section-title">Распределение средств</div>
        </div>
      </div>

      <div className="holo-allocation-layout">
        <div className="holo-chart-stage" aria-label="Динамическое распределение активов">
          <div className="holo-chart-hud holo-chart-hud-left">
            <span>DATA FLOW</span>
            <strong>SYS. ONLINE</strong>
          </div>
          <div className="holo-chart-hud holo-chart-hud-right">
            <span>{segments.length} CATEGORIES</span>
            <strong>BALANCE</strong>
          </div>

          <svg className="holo-pie" viewBox="0 0 340 265" role="img" aria-label="Hologram allocation diagram">
            <defs>
              <radialGradient id="holoCoreGlow" cx="50%" cy="54%" r="58%">
                <stop offset="0%" stopColor="rgba(91, 214, 255, 0.58)" />
                <stop offset="48%" stopColor="rgba(30, 112, 255, 0.18)" />
                <stop offset="100%" stopColor="rgba(2, 6, 23, 0)" />
              </radialGradient>
              <linearGradient id="holoGlass" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.34)" />
                <stop offset="45%" stopColor="rgba(255,255,255,0.06)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.18)" />
              </linearGradient>
              <filter id="holoSoftGlow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <ellipse className="holo-base-orbit holo-base-orbit-outer" cx="165" cy="224" rx="136" ry="28" />
            <ellipse className="holo-base-orbit holo-base-orbit-inner" cx="165" cy="224" rx="92" ry="18" />
            <ellipse className="holo-base-glow" cx="165" cy="226" rx="72" ry="18" />
            <path className="holo-center-glow" d="M 38 126 A 126 70 0 1 1 292 126 A 126 70 0 1 1 38 126" />

            <g className="holo-segments">
              {segments.map((segment) => (
                <g
                  key={segment.name}
                  className="holo-allocation-slice"
                  style={{
                    "--slice-color": segment.color,
                    "--slice-glow": segment.glow,
                    "--slice-x": `${segment.liftX}px`,
                    "--slice-y": `${segment.liftY}px`,
                  } as CSSProperties}
                >
                  <path className="holo-slice-side" d={segment.sidePath} />
                  <path className="holo-slice-top" d={segment.topPath} />
                  <path className="holo-slice-glass" d={segment.topPath} />
                </g>
              ))}
            </g>

            <line className="holo-axis holo-axis-vertical" x1="165" y1="32" x2="165" y2="238" />
            <line className="holo-axis holo-axis-horizontal" x1="42" y1="126" x2="292" y2="126" />
          </svg>

        </div>

        <div className="holo-allocation-list">
          {segments.map((item) => (
            <div key={item.name} className="holo-allocation-card">
              <div className="holo-card-main">
                <div className="holo-card-dot" style={{ backgroundColor: item.color, boxShadow: `0 0 18px ${item.glow}` }} />
                <div className="holo-card-name-wrap">
                  <div className="holo-card-name">{item.name}</div>
                  <div className="holo-card-value">{currency(item.value)}</div>
                </div>
                <div className="holo-card-share">{formatShare(item.share)}</div>
              </div>
              <div className="holo-card-progress">
                <span
                  style={{
                    width: `${Math.min(Math.max(Math.abs(Number(item.share || 0)) <= 1 ? Number(item.share || 0) * 100 : Number(item.share || 0), 0), 100)}%`,
                    backgroundColor: item.color,
                    boxShadow: `0 0 14px ${item.glow}`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
