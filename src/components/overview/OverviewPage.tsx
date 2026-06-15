import healthProtected from "../../assets/health/ChatGPT Image 24 мая 2026 г., 20_54_33.webp";
import { HologramAllocationChart } from "../charts/HologramAllocationChart";
import { FearGreedGauge } from "../fearGreed/FearGreedGauge";
import { MoodSummary } from "../mood/MoodSummary";
import { Panel } from "../shared/Panel";
import { currency, percent, percentDirect } from "../../lib/formatters";
import { getOpenRiskPositions, pickBestPosition, pickWorstPosition } from "../../lib/portfolioSelectors";
import { getHealthTone } from "../../lib/riskPresentation";
import type { FearGreed, Page, PortfolioState } from "../../types/portfolio";
import type { FearGreedDataSource } from "../../hooks/useFearGreed";
import {
  OverviewSparkline,
  OverviewTerminalIcon,
  TrendArrow,
} from "./OverviewPrimitives";

export function OverviewPage({
  data,
  setPage,
  fearGreedData,
  fearGreedIsLoading,
  fearGreedSource,
}: {
  data: PortfolioState;
  setPage: (page: Page) => void;
  fearGreedData: FearGreed;
  fearGreedIsLoading: boolean;
  fearGreedSource: FearGreedDataSource;
}) {
  const overview = data.overview;
  const risk = data.risk;
  const healthTone = getHealthTone(risk.health);
  const openPerformancePositions = getOpenRiskPositions(data.portfolio);
  const hasPerformanceSignal = openPerformancePositions.some((item) => item.pnl !== 0 || item.pnlPct !== 0);
  const bestPositionView = hasPerformanceSignal ? pickBestPosition(openPerformancePositions) : null;
  const worstPositionView = hasPerformanceSignal ? pickWorstPosition(openPerformancePositions) : null;
  const futuresDeployableCash = risk.futuresDeployableCash ?? risk.deployableCash;
  const spotDeployableCash = risk.spotDeployableCash ?? 0;
  const overviewPnl = overview.invested ? overview.portfolioValue - overview.invested : overview.pnl;
  const overviewPnlPct = overview.invested ? overviewPnl / overview.invested : overview.pnlPct;
  const signedCurrency = (value: number) => `${value > 0 ? "+" : ""}${currency(value)}`;
  const signedPercent = (value: number) => `${value > 0 ? "+" : ""}${percentDirect(value)}`;
  const overviewPnlClass =
    overviewPnl > 0 ? "overview-mosaic-positive" : overviewPnl < 0 ? "overview-mosaic-negative" : "overview-mosaic-neutral";
  const bestPnlClass =
    bestPositionView && bestPositionView.pnlPct > 0 ? "overview-mosaic-positive" : "overview-mosaic-neutral";
  const worstPnlClass =
    worstPositionView && worstPositionView.pnlPct < 0 ? "overview-mosaic-negative" : "overview-mosaic-neutral";

  return (
    <div className="space-y-6">
      <div className="overview-top-grid overview-top-mosaic">
        <Panel tone="cyan" className="overview-mosaic-panel" hover>
          <div className="overview-mosaic-grid" aria-label="Overview metrics">
            <div className="overview-mosaic-card overview-mosaic-card-cyan">
              <div className="overview-mosaic-head">
                <OverviewTerminalIcon name="wallet" />
                <div className="overview-mosaic-label overview-card-label-stack">
                  <span>Стоимость</span>
                  <span>портфеля</span>
                </div>
              </div>
              <div className="overview-mosaic-value">{currency(overview.portfolioValue)}</div>
              <OverviewSparkline tone="cyan" shape="portfolio" />
            </div>

            <div className="overview-mosaic-card overview-mosaic-card-violet">
              <div className="overview-mosaic-head">
                <OverviewTerminalIcon name="capital" />
                <div className="overview-mosaic-label">Вложено</div>
              </div>
              <div className="overview-mosaic-value">{currency(overview.invested)}</div>
              <OverviewSparkline tone="violet" shape="capital" />
            </div>

            <div className={`overview-mosaic-card overview-mosaic-card-pnl ${overviewPnlClass}`}>
              <div className="overview-mosaic-pnl-line">
                <span>{signedCurrency(overviewPnl)}</span>
                <span>/</span>
                <span>{overviewPnl > 0 ? "+" : ""}{percent(overviewPnlPct, 2)}</span>
              </div>
              {overviewPnl > 0 ? <TrendArrow direction="up" /> : overviewPnl < 0 ? <TrendArrow direction="down" /> : null}
            </div>

            <button type="button" onClick={() => setPage("Риск")} className="overview-mosaic-card overview-mosaic-card-health">
              <div className="overview-mosaic-label">Health factor</div>
              <div className="overview-mosaic-value">{percent(risk.health)}</div>
              <div className="overview-mosaic-sub">Общий запас по риску</div>
            </button>

            <div className={`overview-mosaic-card overview-mosaic-card-risk overview-mosaic-card-risk-${healthTone}`}>
              <div className="overview-mosaic-label">Risk</div>
              <div className="overview-mosaic-value overview-mosaic-risk-value">{risk.state}</div>
              <div className="overview-mosaic-sub">
                {risk.largestRiskAsset !== "-" ? `Крупнейший риск: ${risk.largestRiskAsset}` : "Без данных"}
              </div>
            </div>

            <div className="overview-mosaic-card overview-mosaic-card-protected" aria-label={risk.state}>
              <img src={healthProtected} alt="" />
            </div>
          </div>

          <div className="overview-best-worst-grid">
            <button type="button" onClick={() => setPage("Портфель")} className="overview-performance-card overview-performance-card-best">
              <OverviewTerminalIcon name="star" />
              <div className="overview-performance-text">
                <span className="overview-performance-label">THE BEST</span>
                <strong>{bestPositionView?.asset ?? "—"}</strong>
              </div>
              <span className={`overview-performance-pnl ${bestPnlClass}`}>
                {bestPositionView ? signedPercent(bestPositionView.pnlPct) : "—"}
              </span>
            </button>

            <button type="button" onClick={() => setPage("Портфель")} className="overview-performance-card overview-performance-card-worst">
              <OverviewTerminalIcon name="down" />
              <div className="overview-performance-text">
                <span className="overview-performance-label">THE WORST</span>
                <strong>{worstPositionView?.asset ?? "—"}</strong>
              </div>
              <span className={`overview-performance-pnl ${worstPnlClass}`}>
                {worstPositionView ? signedPercent(worstPositionView.pnlPct) : "—"}
              </span>
            </button>
          </div>
        </Panel>
      </div>

      <div className="overview-secondary-grid grid xl:grid-cols-[0.88fr_1.12fr] gap-6">
        <HologramAllocationChart categories={overview.categories} />
        <FearGreedGauge
          data={fearGreedData}
          isLoading={fearGreedIsLoading}
          source={fearGreedSource}
          strategy={data.fearGreedStrategy}
          portfolioValue={overview.invested}
          spotDeployableCash={spotDeployableCash}
          futuresDeployableCash={futuresDeployableCash}
          freeCashTotal={risk.reserve}
        />
      </div>

      <MoodSummary />
    </div>
  );
}
