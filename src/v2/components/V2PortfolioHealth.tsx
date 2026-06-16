import type { PortfolioHealth } from "../../lib/portfolioHealth";

type Props = {
  health: PortfolioHealth;
};

const RADAR_R = 40;
const RADAR_C = 50;

function radarPoint(index: number, total: number, radius: number) {
  const angle = (-90 + (360 / total) * index) * (Math.PI / 180);
  return {
    x: RADAR_C + radius * Math.cos(angle),
    y: RADAR_C + radius * Math.sin(angle),
  };
}

export function V2PortfolioHealth({ health }: Props) {
  const components = health.components;
  const total = components.length;

  const gridPoints = components
    .map((_, i) => {
      const p = radarPoint(i, total, RADAR_R);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");

  const valuePoints = components
    .map((component, i) => {
      const p = radarPoint(i, total, RADAR_R * (component.score / 100));
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <section className="v2-panel v2-ph-panel v2-health-merged">
      <div className="v2-panel-header">
        <span>Health компоненты</span>
      </div>

      <div className="v2-health-merged-body">
        <div className="v2-health-list">
          {components.map((component) => (
            <div className="v2-health-row" key={component.key}>
              <div className="v2-health-meta">
                <span className="v2-health-name">{component.label}</span>
                <span className="v2-health-desc">{component.desc}</span>
              </div>
              <strong className="v2-health-score">{component.score}</strong>
            </div>
          ))}
        </div>

        <div className="v2-health-radar">
          <svg viewBox="0 0 100 100" role="img" aria-label="Health компоненты радар">
            <polygon className="v2-radar-grid" points={gridPoints} />
            <polygon
              className="v2-radar-grid mid"
              points={components
                .map((_, i) => {
                  const p = radarPoint(i, total, RADAR_R * 0.55);
                  return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                })
                .join(" ")}
            />
            {components.map((_, i) => {
              const p = radarPoint(i, total, RADAR_R);
              return (
                <line key={`axis-${i}`} x1={RADAR_C} y1={RADAR_C} x2={p.x} y2={p.y} />
              );
            })}
            <polygon className="v2-radar-area" points={valuePoints} />
            {components.map((component, i) => {
              const p = radarPoint(i, total, RADAR_R);
              return (
                <circle
                  key={`dot-${component.key}`}
                  className="v2-radar-dot"
                  cx={p.x}
                  cy={p.y}
                  r="2.2"
                />
              );
            })}
            <text className="v2-radar-score" x="50" y="49">
              {health.healthFactor}
            </text>
            <text className="v2-radar-caption" x="50" y="58">
              HEALTH
            </text>
          </svg>
        </div>
      </div>
    </section>
  );
}
