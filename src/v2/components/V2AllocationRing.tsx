type AllocItem = { name: string; share: number; value: number };

const COLORS: Record<string, { fill: string; glow: string }> = {
  "Крипта":           { fill: "#2e7ef5", glow: "rgba(46,126,245,0.65)" },
  "Металлы":          { fill: "#8a6cf0", glow: "rgba(138,108,240,0.60)" },
  "Фьючерсы":         { fill: "#56d4f5", glow: "rgba(86,212,245,0.55)" },
  "Акции":            { fill: "#38bcd4", glow: "rgba(56,188,212,0.55)" },
  "Свободные деньги": { fill: "#3dd6b0", glow: "rgba(61,214,176,0.50)" },
};

const GAP_DEG = 2.5;

function buildArcs(items: AllocItem[]) {
  const active = items.filter(i => i.share > 0.005);
  const totalShare = active.reduce((s, i) => s + i.share, 0) || 1;
  const totalGap = GAP_DEG * active.length;
  const availDeg = 360 - totalGap;

  const arcs: { path: string; color: { fill: string; glow: string }; name: string; share: number }[] = [];
  let cursor = -90;

  for (const item of active) {
    const sweep = (item.share / totalShare) * availDeg;
    const startRad = (cursor * Math.PI) / 180;
    const endRad   = ((cursor + sweep) * Math.PI) / 180;
    const R = 82, r = 56;
    const x1o = 100 + R * Math.cos(startRad), y1o = 100 + R * Math.sin(startRad);
    const x2o = 100 + R * Math.cos(endRad),   y2o = 100 + R * Math.sin(endRad);
    const x1i = 100 + r * Math.cos(endRad),   y1i = 100 + r * Math.sin(endRad);
    const x2i = 100 + r * Math.cos(startRad), y2i = 100 + r * Math.sin(startRad);
    const large = sweep > 180 ? 1 : 0;
    const path = `M ${x1o} ${y1o} A ${R} ${R} 0 ${large} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${r} ${r} 0 ${large} 0 ${x2i} ${y2i} Z`;
    arcs.push({
      path,
      color: COLORS[item.name] ?? { fill: "#6f86a6", glow: "rgba(111,134,166,0.4)" },
      name: item.name,
      share: item.share,
    });
    cursor += sweep + GAP_DEG;
  }
  return arcs;
}

const fmt$ = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`;

type Props = { allocation: AllocItem[]; total?: number };

export function V2AllocationRing({ allocation, total }: Props) {
  const arcs = buildArcs(allocation);
  const displayTotal = total ?? allocation.reduce((s, i) => s + i.value, 0);

  return (
    <div className="v2-aring-wrap">
      <svg viewBox="0 0 200 200" className="v2-aring-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {arcs.map((arc, i) => (
            <filter key={i} id={`ar-glow-${i}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          ))}
          <radialGradient id="ar-center" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(56,140,220,0.22)"/>
            <stop offset="70%" stopColor="rgba(4,12,30,0.80)"/>
            <stop offset="100%" stopColor="rgba(4,12,30,0.95)"/>
          </radialGradient>
        </defs>

        {/* центральная подложка */}
        <circle cx="100" cy="100" r="54" fill="url(#ar-center)"/>
        <circle cx="100" cy="100" r="54" fill="none" stroke="rgba(86,196,240,0.12)" strokeWidth="1"/>

        {/* сегменты */}
        {arcs.map((arc, i) => (
          <path
            key={i}
            d={arc.path}
            fill={arc.color.fill}
            opacity={0.90}
            filter={`url(#ar-glow-${i})`}
          />
        ))}

        {/* блик сверху на кольце */}
        <circle cx="100" cy="100" r="82" fill="none"
          stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>

        {/* центр: портфель */}
        <text x="100" y="93" textAnchor="middle" className="v2-aring-total-label">ПОРТФЕЛЬ</text>
        <text x="100" y="113" textAnchor="middle" className="v2-aring-total-val">
          {fmt$(displayTotal)}
        </text>
      </svg>

      {/* легенда */}
      <div className="v2-aring-legend">
        {arcs.map((arc, i) => (
          <div key={i} className="v2-aring-legend-row">
            <span className="v2-aring-legend-dot" style={{ background: arc.color.fill, boxShadow: `0 0 5px ${arc.color.glow}` }} />
            <span className="v2-aring-legend-name">{arc.name}</span>
            <span className="v2-aring-legend-pct">{(arc.share * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
