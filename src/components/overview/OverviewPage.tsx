import healthProtected from "../../assets/health/ChatGPT Image 24 мая 2026 г., 20_54_33.webp";
import { HologramAllocationChart } from "../charts/HologramAllocationChart";
import { FearGreedGauge } from "../fearGreed/FearGreedGauge";
import { MoodSummary } from "../mood/MoodSummary";
import { Panel } from "../shared/Panel";
import { currency, percent, percentDirect } from "../../lib/formatters";
import { getHealthTone } from "../../lib/riskPresentation";
import type { FearGreed, Page, PortfolioState } from "../../types/portfolio";
import type { FearGreedDataSource } from "../../hooks/useFearGreed";
import {
  MiniInfo,
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
  const bestPositionDetails = data.portfolio.find((item) => item.asset === overview.bestPosition.asset);
  const worstPositionDetails = data.portfolio.find((item) => item.asset === overview.worstPosition.asset);
  const bestPositionView = {
    value: bestPositionDetails?.currentValue ?? 0,
    pnl: bestPositionDetails?.pnl ?? overview.bestPosition.pnl,
    pnlPct: bestPositionDetails?.pnlPct ?? overview.bestPosition.pnlPct,
  };
  const worstPositionView = {
    value: worstPositionDetails?.currentValue ?? 0,
    pnl: worstPositionDetails?.pnl ?? overview.worstPosition.pnl,
    pnlPct: worstPositionDetails?.pnlPct ?? overview.worstPosition.pnlPct,
  };
  const futuresDeployableCash = risk.futuresDeployableCash ?? risk.deployableCash;
  const spotDeployableCash = risk.spotDeployableCash ?? 0;
  const overviewPnl = overview.invested ? overview.portfolioValue - overview.invested : overview.pnl;
  const overviewPnlPct = overview.invested ? overviewPnl / overview.invested : overview.pnlPct;
  const signedCurrency = (value: number) => `${value > 0 ? "+" : ""}${currency(value)}`;
  const signedPercent = (value: number) => `${value > 0 ? "+" : ""}${percentDirect(value)}`;
  const bestAssetParts = String(overview.bestPosition.asset).split(/\s+/).filter(Boolean);
  const worstAssetParts = String(overview.worstPosition.asset).split(/\s+/).filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="overview-top-grid">
        <Panel tone="cyan" className="p-7 xl:p-8 h-full overview-main-panel overview-terminal-panel" hover>
          <div className="overview-header overview-header-main overview-terminal-header">
            <div>
              <div className="section-kicker section-kicker-main text-cyan-300 overview-terminal-kicker">Портфель сегодня</div>
            </div>
            <div className={`pnl-hero-pill overview-terminal-pnl ${overviewPnl < 0 ? "overview-terminal-pnl-negative" : "overview-terminal-pnl-positive"}`}>
              <span className="pnl-hero-value">{signedCurrency(overviewPnl)}</span>
              {overviewPnl > 0 ? <TrendArrow direction="up" /> : overviewPnl < 0 ? <TrendArrow direction="down" /> : null}
            </div>
          </div>

          <div className="overview-main-grid overview-terminal-grid">
            <div className="overview-terminal-card overview-terminal-card-cyan">
              <div className="overview-card-head">
                <OverviewTerminalIcon name="wallet" />
                <div className="overview-card-label overview-card-label-stack">
                  <span>Стоимость</span>
                  <span>портфеля</span>
                </div>
              </div>
              <div className="overview-card-value overview-card-value-money">{currency(overview.portfolioValue)}</div>
              <div className={`overview-card-pnl-badge ${overviewPnl < 0 ? "overview-card-pnl-negative" : "overview-card-pnl-positive"}`}>
                {overviewPnl > 0 ? <TrendArrow direction="up" /> : overviewPnl < 0 ? <TrendArrow direction="down" /> : null}
                <span className="overview-card-pnl-percent">PnL {percent(overviewPnlPct, 2)}</span>
              </div>
              <OverviewSparkline tone="cyan" shape="portfolio" />
            </div>

            <div className="overview-terminal-card overview-terminal-card-violet">
              <div className="overview-card-head">
                <OverviewTerminalIcon name="capital" />
                <div className="overview-card-label">Вложено</div>
              </div>
              <div className="overview-card-value overview-card-value-money">{currency(overview.invested)}</div>
              <OverviewSparkline tone="violet" shape="capital" />
            </div>

            <button type="button" onClick={() => setPage("Портфель")} className="portfolio-link-card overview-terminal-card overview-terminal-card-green overview-terminal-card-button">
              <div className="overview-card-head">
                <OverviewTerminalIcon name="star" />
                <div className="overview-card-label overview-card-label-stack">
                  <span>THE BEST</span>
                </div>
              </div>
              <div className={`overview-card-value overview-card-value-asset ${bestAssetParts.length > 1 ? "overview-card-value-best-stacked" : ""}`}>
                {bestAssetParts.length > 1
                  ? bestAssetParts.map((part) => <span key={part}>{part}</span>)
                  : overview.bestPosition.asset}
              </div>
              <div className="overview-card-sub">
                {currency(bestPositionView.value)}{" "}
                <span className="overview-card-sub-green">({signedCurrency(bestPositionView.pnl)})</span>
                {" / "}
                <span className="overview-card-sub-green">{signedPercent(bestPositionView.pnlPct)}</span>
              </div>
              <OverviewSparkline tone="green" shape="best" />
            </button>

            <button type="button" onClick={() => setPage("Портфель")} className="portfolio-link-card overview-terminal-card overview-terminal-card-red overview-terminal-card-button">
              <div className="overview-card-head">
                <OverviewTerminalIcon name="down" />
                <div className="overview-card-label overview-card-label-stack">
                  <span>THE WORST</span>
                </div>
              </div>
              <div className="overview-card-value overview-card-value-asset overview-card-value-worst">
                {worstAssetParts.length > 1
                  ? worstAssetParts.map((part) => <span key={part}>{part}</span>)
                  : overview.worstPosition.asset}
              </div>
              <div className="overview-card-sub">
                {currency(worstPositionView.value)}{" "}
                <span className="overview-card-sub-red">({signedCurrency(worstPositionView.pnl)})</span>
                {" / "}
                <span className="overview-card-sub-red">{signedPercent(worstPositionView.pnlPct)}</span>
              </div>
              <OverviewSparkline tone="red" shape="worst" />
            </button>
          </div>
        </Panel>

        <Panel tone="violet" className="p-6 xl:p-8 h-full overview-health-panel" hover>
          <div className="overview-header overview-header-health">
            <div>
              <div className="section-kicker section-kicker-main text-violet-300">Здоровье портфеля</div>
            </div>
            <div className="health-shield-badge" aria-label={risk.state}>
              <img src={healthProtected} alt="" />
            </div>
          </div>

          <div className="overview-health-grid risk-grid-main">
            <button type="button" onClick={() => setPage("Риск")} className="overview-link-card">
              <MiniInfo
                label="Health factor"
                value={percent(risk.health)}
                sub="Общий запас по риску"
                tone="cyan"
                panelClassName="mini-panel-risk overview-mini-card"
                labelClassName="mini-label-risk"
                valueClassName="mini-value-risk mini-value-health-metric"
                subClassName="mini-sub-risk"
              />
            </button>

            <MiniInfo
              label="Risk"
              value={risk.state}
              sub={risk.largestRiskAsset !== "-" ? `Крупнейший риск: ${risk.largestRiskAsset}` : "Без данных"}
              tone={healthTone}
              panelClassName="mini-panel-risk overview-mini-card"
              labelClassName="mini-label-risk"
              valueClassName="mini-value-risk mini-value-risk-state"
              subClassName="mini-sub-risk"
            />

            <MiniInfo
              label="Резерв стейблов"
              value={currency(risk.reserve)}
              sub={percent(risk.cashShare)}
              tone="yellow"
              panelClassName="mini-panel-risk overview-mini-card"
              labelClassName="mini-label-risk"
              valueClassName="mini-value-risk mini-value-risk-money mini-value-health-secondary"
              subClassName="mini-sub-risk"
            />

            <MiniInfo
              label="Можно пустить в работу"
              value={(
                <span className="deployable-split-value">
                  <span><span className="deployable-split-label">Фьючерсы</span>{currency(futuresDeployableCash)}</span>
                  <span><span className="deployable-split-label">Спот</span>{currency(spotDeployableCash)}</span>
                </span>
              )}
              tone="cyan"
              panelClassName="mini-panel-risk overview-mini-card"
              labelClassName="mini-label-risk"
              valueClassName="mini-value-risk mini-value-risk-money mini-value-health-secondary"
              subClassName="mini-sub-risk mini-sub-health-note"
            />
          </div>
        </Panel>
      </div>

      <div className="overview-secondary-grid grid xl:grid-cols-[0.88fr_1.12fr] gap-6">
        <HologramAllocationChart categories={overview.categories} />
        <FearGreedGauge data={fearGreedData} isLoading={fearGreedIsLoading} source={fearGreedSource} />
      </div>

      <MoodSummary />
    </div>
  );
}
