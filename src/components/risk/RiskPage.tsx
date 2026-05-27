import type { CSSProperties } from "react";
import { percentDirect } from "../../lib/formatters";
import { pickLargestNonCashPosition } from "../../lib/portfolioSelectors";
import {
  buildRiskMarketBars,
  getRiskHealthSummary,
  RISK_BAR_COLORS,
  RISK_HEALTH_AXES,
} from "../../lib/riskPresentation";
import {
  buildRiskRadarGrid,
  buildRiskRadarPolygon,
} from "../../lib/uiHelpers";
import type { PortfolioState } from "../../types/portfolio";
import { Panel } from "../shared/Panel";
import { RiskWarningsPanel } from "./RiskWarningsPanel";

export function RiskPage({ data }: { data: PortfolioState }) {
  const risk = data.risk;
  const portfolio = [...data.portfolio].sort((a, b) => b.share - a.share);
  const healthAxes = RISK_HEALTH_AXES;
  const healthScore = Math.round(risk.health * 100);
  const radarFill = buildRiskRadarPolygon(healthAxes.map((axis) => axis.score));
  const assetsForBars = portfolio;
  const maxBarShare = Math.max(...assetsForBars.map((item) => item.share), 1);
  const marketBars = buildRiskMarketBars(risk);
  const maxMarketShare = Math.max(...marketBars.map((item) => item.value), 1);
  const largestNonCashAsset = pickLargestNonCashPosition(portfolio);
  const largestAssetValueText = `${Math.round(Number(largestNonCashAsset?.currentValue || 0))} $`;
  const reserveText = `${Math.round(Number(risk.reserve || 0))} $`;
  const futuresDeployableText = `${Math.round(Number(risk.futuresDeployableCash ?? 0))} $`;
  const spotDeployableText = `${Math.round(Number(risk.spotDeployableCash ?? 0))} $`;

  return (
    <div className="space-y-6">
      <Panel tone="yellow" className="p-6 risk-top-panel" hover>
        <div className="section-title risk-main-title">Risk</div>
        <div className="risk-top-copy">
          Резерв стейблов высокий, позволяет быть в рынке. Текущая медвежья стадия идеально подходит под набор позиций, но постепенно, не перегружая каждый из активов. Портфель защитный, позволяет пересиживать высоковолатильные движения. Есть маневренность, главное не перегружать фьючерсный блок.
        </div>
      </Panel>

      <div className="risk-main-grid">
        <Panel tone="violet" className="p-5" hover>
          <div className="risk-health-head">
            <div>
              <div className="section-kicker text-cyan-300">Health factor</div>
              <div className="section-title risk-health-title">Здоровье</div>
              <a href="/portfolio-health.pdf" target="_blank" rel="noreferrer" className="health-link">
                Полный разбор портфеля →
              </a>
              <p className="risk-health-summary">
                {getRiskHealthSummary(healthScore)}
                <br />
                До 100 не хватает из-за неполной диверсификации.
                <br />
                Отдельное давление на оценку создают концентрация в рисковых активах и наличие фьючерсного блока.
              </p>
            </div>
            <div className="health-score-main">{healthScore}%</div>
          </div>

          <div className="radar-wrap">
            <svg className="radar-svg" viewBox="0 0 380 380" aria-hidden="true">
              {[0.25, 0.5, 0.75, 1].map((level) => (
                <polygon key={level} points={buildRiskRadarGrid(level)} className="radar-grid" />
              ))}

              {Array.from({ length: 5 }).map((_, index) => {
                const angle = (-90 + index * 72) * (Math.PI / 180);
                const x = 190 + 140 * Math.cos(angle);
                const y = 190 + 140 * Math.sin(angle);
                return <line key={index} x1="190" y1="190" x2={x} y2={y} className="radar-axis" />;
              })}

              <polygon points={radarFill} className="radar-fill" />
              <polygon points={radarFill} className="radar-stroke" />

              {healthAxes.map((axis, index) => {
                const angle = (-90 + index * 72) * (Math.PI / 180);
                const r = 140 * (axis.score / 100);
                const x = 190 + r * Math.cos(angle);
                const y = 190 + r * Math.sin(angle);
                const lx = 190 + 170 * Math.cos(angle);
                const ly = 190 + 170 * Math.sin(angle);
                return (
                  <g key={axis.title}>
                    <circle cx={x} cy={y} r="8" fill={axis.color} className="radar-dot" />
                    <text x={lx} y={ly} className="radar-label" textAnchor="middle">
                      {axis.short}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="radar-center">
              <div className="radar-center-value">{healthScore}</div>
              <div className="radar-center-label">HEALTH</div>
            </div>
          </div>

          <div className="axis-cards">
            {healthAxes.map((axis) => (
              <div className="axis-card" key={axis.title}>
                <div className="axis-card-left">
                  <span className="axis-dot" style={{ background: axis.color }} />
                  <div>
                    <div className="axis-title">{axis.title}</div>
                    <div className="axis-note">{axis.note}</div>
                  </div>
                </div>
                <div className="axis-score">{axis.score}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel tone="cyan" className="p-5" hover>
          <div className="assets-head">
            <div>
              <div className="section-kicker text-cyan-300">Assets weight</div>
              <div className="section-title risk-assets-title">Доли активов</div>
              <p className="risk-assets-summary">
                Столбцы показывают вес каждой позиции в структуре портфеля. Сверху - доля в процентах, снизу - тикер актива.
              </p>
            </div>
            
          </div>

          <div className="risk-right-grid">
            <div className="risk-right-card risk-right-card-assets">
              <div className="risk-mini-title">Распределение по активам</div>

              <div className="assets-top-space">
                <div className="assets-mini-grid">
                  <div className="assets-mini-card">
                    <div className="assets-mini-label">Свободные деньги</div>
                    <div className="assets-mini-value">{reserveText}</div>
                  </div>

                  <div className="assets-mini-card">
                    <div className="assets-mini-label">Можно в работу</div>
                    <div className="assets-mini-value assets-mini-value-split">
                      <span>Фьючи {futuresDeployableText}</span>
                      <span>Спот {spotDeployableText}</span>
                    </div>
                  </div>

                  <div className="assets-mini-card">
                    <div className="assets-mini-label">Крупнейший актив</div>
                    <div className="assets-mini-value">{largestNonCashAsset?.asset} - {largestAssetValueText}</div>
                  </div>
                </div>
              </div>

              <div className="assets-bars-wrap">
                <div className="assets-bars">
                  {assetsForBars.map((asset, i) => {
                    const rawRatio = asset.share / maxBarShare;
                    let heightPct = Math.pow(rawRatio, 0.68) * 100;

                    if (asset.asset === "USDT") heightPct *= 0.92;
                    if (asset.asset === "ETH") heightPct *= 1.18;
                    if (asset.currentPrice <= 2) heightPct *= 0.78;
                    if (asset.currentPrice <= 1) heightPct *= 0.9;

                    heightPct = Math.max(Math.min(heightPct, 96), 8);

                    const color = RISK_BAR_COLORS[i % RISK_BAR_COLORS.length];

                    return (
                      <div key={asset.asset} className="bar-item" title={`${asset.asset} - ${percentDirect(asset.share)}`}>
                        <div
                          className="bar-track"
                          style={{ ["--bar-height" as string]: `${heightPct}%` } as CSSProperties}
                        >
                          <div className="bar-value">{percentDirect(asset.share)}</div>

                          <div
                            className="bar-column"
                            style={
                              {
                                "--bar-height": `${heightPct}%`,
                                "--bar-color": color,
                              } as CSSProperties
                            }
                          >
                            <div className="bar-face bar-face-front" />
                            <div className="bar-face bar-face-right" />
                            <div className="bar-face bar-face-top" />
                          </div>
                        </div>

                        <div className="bar-label">{asset.asset}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="risk-right-card risk-right-card-markets">
              <div className="risk-mini-title">Распределение по рынкам</div>
              <div className="markets-top-space">
                <RiskWarningsPanel warnings={risk.warnings} />
              </div>

              <div className="markets-bars-wrap">
                <div className="markets-bars">
                  {marketBars.map((item) => {
                    let heightPct = item.value === 0 ? 6 : (item.value / maxMarketShare) * 100;

                    if (item.name === "Фьючерсы") heightPct *= 1.14;
                    if (item.name === "Металлы") heightPct *= 0.88;

                    heightPct = Math.max(Math.min(heightPct, 100), item.value === 0 ? 6 : 10);

                    return (
                      <div key={item.name} className="market-item" title={`${item.name} - ${item.value.toFixed(1)}%`}>
                        <div
                          className="market-track"
                          style={{ ["--market-height" as string]: `${heightPct}%` } as CSSProperties}
                        >
                          <div className="market-value">{item.value.toFixed(1)}%</div>

                          <div
                            className="market-column"
                            style={{ ["--market-height" as string]: `${heightPct}%`, ["--market-color" as string]: item.color } as CSSProperties}
                          >
                            <div className="market-face market-face-front" />
                            <div className="market-face market-face-right" />
                            <div className="market-face market-face-top" />
                          </div>
                        </div>

                        <div className="market-label">{item.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </div>

    </div>
  );
}
