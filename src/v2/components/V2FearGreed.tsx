import { useFearGreed } from "../../hooks/useFearGreed";
import type { FearGreedStrategy } from "../../types/portfolio";
import type { V2Portfolio } from "../InvestorCabinetV2Lab";

type Props = {
  portfolio: V2Portfolio;
  strategy: FearGreedStrategy;
};

/** Детерминированный ряд значений индекса, сходящийся к текущему — для графика. */
function buildSeries(value: number, n = 30): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    const drift = 50 + (value - 50) * t;
    const wave = Math.sin(i * 0.72) * 6 * (1 - t * 0.45) + Math.sin(i * 1.9) * 3;
    out.push(Math.max(3, Math.min(97, drift + wave)));
  }
  out[out.length - 1] = value;
  return out;
}

function linePath(values: number[], w: number, h: number, pad = 3): string {
  const max = 100;
  const min = 0;
  const span = max - min || 1;
  const step = (w - pad * 2) / (values.length - 1);
  return values
    .map((v, i) => {
      const x = pad + i * step;
      const y = pad + (1 - (v - min) / span) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function V2FearGreed(_props: Props) {
  void _props;
  const fearGreed = useFearGreed();
  const isSyncing = fearGreed.isLoading && fearGreed.source === "fallback";
  const value = Math.max(0, Math.min(100, isSyncing ? 50 : fearGreed.data.value));

  const series = buildSeries(value);
  const yesterday = Math.round(series[series.length - 2]);
  const w = 320;
  const h = 96;
  const line = linePath(series, w, h);
  const area = `${line} L${w - 3},${h} L3,${h} Z`;

  return (
    <section className="v2-panel v2-fear">
      <div className="v2-panel-header">
        <span>Fear &amp; Greed Index</span>
      </div>

      <div className="v2-fg2">
        <div className="v2-fg2-head">
          <div className="v2-fg2-readout">
            <strong>{isSyncing ? "…" : value}</strong>
            <span>{fearGreed.data.label}</span>
          </div>
          <div className="v2-fg2-meta">
            <span>Вчера</span>
            <b>{isSyncing ? "…" : yesterday}</b>
          </div>
        </div>

        <div className="v2-fg2-chart">
          <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="v2-fg2-svg">
            <defs>
              <linearGradient id="v2-fg2-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6cc8e8" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#6cc8e8" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="rgba(120,160,220,0.12)" strokeWidth="1" strokeDasharray="3 4" />
            <path d={area} fill="url(#v2-fg2-area)" />
            <path d={line} fill="none" stroke="#6cc8e8" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <div className="v2-fg2-yax">
            <span>100</span>
            <span>50</span>
            <span>0</span>
          </div>
        </div>

        <div className="v2-fg2-scale">
          <div className="v2-fg2-bar">
            <span className="v2-fg2-marker" style={{ left: `${value}%` }} />
          </div>
          <div className="v2-fg2-ticks">
            <span>Страх</span>
            <span>Нейтрально</span>
            <span>Жадность</span>
          </div>
        </div>
      </div>
    </section>
  );
}
