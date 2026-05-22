import React, { useMemo, useState } from "react";
import btcLogo from "./assets/coins/btc.png";
import ethLogo from "./assets/coins/eth.png";
import tonLogo from "./assets/coins/ton.png";
import solLogo from "./assets/coins/sol.png";
import bnbLogo from "./assets/coins/bnb.png";
import apexLogo from "./assets/coins/apex.png";
import mntLogo from "./assets/coins/mnt.png";
import tiaLogo from "./assets/coins/tia.png";
import usdtLogo from "./assets/coins/usdt.png";
import gaugeBg from "./assets/fear-greed/gauge-bg.webp";
import { HologramAllocationChart } from "./components/charts/HologramAllocationChart";
import { Sidebar } from "./components/layout/Sidebar";
import { Panel } from "./components/shared/Panel";
import {
  TEST_LOGIN,
  TEST_PASSWORD,
} from "./config/constants";
import { useFearGreed } from "./hooks/useFearGreed";
import { useInvestorData } from "./hooks/useInvestorData";
import { currency, percent, percentDirect } from "./lib/formatters";
import { getMoodData } from "./lib/moodData";
import { buildPortfolioState, round } from "./lib/portfolioCalculations";
import {
  assetGlyph,
  assetRarity,
  buildRiskRadarGrid,
  buildRiskRadarPolygon,
  cardNumbers,
  fgTone,
  getAttackMetricClass,
  getProfitColor,
  getRiskColor,
  getRiskMetricClass,
  statusTone,
} from "./lib/uiHelpers";
import { rawPositions, decisionsData, scenariosData } from "./mocks/portfolioData";
import type {
  FearGreed,
  Page,
  PortfolioState,
} from "./types/portfolio";
import "./App.css";

const RISK_BAR_COLORS = ["#63d8ff", "#3ddb72", "#9f57ff", "#f7d64a", "#ff6f8e", "#ff8b2a", "#45c2ff", "#53ea87"];

function Badge({
  children,
  tone = "cyan",
}: {
  children: React.ReactNode;
  tone?: "cyan" | "violet" | "yellow";
}) {
  const map = {
    cyan: "cyber-badge-cyan",
    violet: "cyber-badge-violet",
    yellow: "cyber-badge-yellow",
  };

  return <span className={`cyber-badge ${map[tone]}`}>{children}</span>;
}
function TrendArrow({ direction = "up" }: { direction?: "up" | "down" }) {
  return (
    <span
      aria-hidden="true"
      className={`trend-arrow ${direction === "up" ? "trend-arrow-up" : "trend-arrow-down"}`}
    >
      {direction === "up" ? "↗" : "↘"}
    </span>
  );
}

function MiniInfo({
  label,
  value,
  sub,
  tone = "cyan",
  center = false,
  valueClassName = "",
  subClassName = "",
  labelClassName = "",
  panelClassName = "",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "cyan" | "violet" | "yellow";
  center?: boolean;
  valueClassName?: string;
  subClassName?: string;
  labelClassName?: string;
  panelClassName?: string;
}) {
  return (
    <div className={`mini-panel mini-panel-${tone} ${center ? "mini-panel-center" : ""} ${panelClassName}`.trim()}>
      <div className={`mini-label ${labelClassName}`.trim()}>{label}</div>
      <div className={`mini-value ${valueClassName}`.trim()}>{value}</div>
      {sub ? <div className={`mini-sub ${subClassName}`.trim()}>{sub}</div> : null}
    </div>
  );
}
function FearGreedGauge({ data }: { data: FearGreed }) {
  const tone = fgTone(data.value);
  const clampedValue = Math.max(0, Math.min(100, data.value));
  const needleAngle = -90 + (clampedValue / 100) * 180;
  const buyLadderRows = [
    { range: "30 - 100", action: "Наблюдение", size: "0%", mode: "Пассивный", active: clampedValue >= 30 },
    { range: "20 - 29", action: "Осторожная покупка", size: "1%", mode: "Активный", active: clampedValue >= 20 && clampedValue <= 29 },
    { range: "15 - 19", action: "Усиленная покупка", size: "1.5%", mode: "Агрессивный", active: clampedValue >= 15 && clampedValue <= 19 },
    { range: "0 - 14", action: "Агрессивная покупка", size: "2%", mode: "Максимальный", active: clampedValue <= 14 },
  ];

  return (
    <Panel tone={tone} className="fear-greed-panel fg-clean-panel h-full" hover>
      <div
        className="fg-image-gauge"
        style={{ "--fg-angle": `${needleAngle}deg` } as React.CSSProperties}
        aria-label={`Fear and Greed index ${clampedValue}`}
      >
        <img src={gaugeBg} alt="" className="fg-image-gauge-bg" />
        <div className="fg-image-bloom" aria-hidden="true" />
        <div className="fg-image-needle-wrap" aria-hidden="true">
          <div className="fg-image-needle" />
        </div>
        <div className="fg-image-center-value" aria-label={`Fear and Greed value ${clampedValue}`}>
          {clampedValue}
        </div>
      </div>

      <div className="fg-buy-ladder">
        <div className="fg-buy-ladder-table">
          {buyLadderRows.map((row) => (
            <div key={row.range} className={`fg-buy-row ${row.active ? "is-active" : ""}`.trim()}>
              <div className="fg-buy-cell">{row.range}</div>
              <div className="fg-buy-cell">{row.action}</div>
              <div className="fg-buy-cell">{row.size}</div>
              <div className="fg-buy-cell">
                <span className="fg-buy-mode">{row.mode}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="fg-buy-note">
          <div className="fg-buy-note-icon" aria-hidden="true" />
          <div>
            <div className="fg-buy-note-title">ВАЖНОЕ УТОЧНЕНИЕ</div>
            <div className="fg-buy-note-text">
              По данной стратегии допускается только <strong>1 покупка в неделю.</strong>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
function MoodSummary() {
  const mood = useMemo(() => getMoodData(), []);

  return (
    <Panel tone="cyan" className="p-6 mood-panel" hover>
      <div className="section-kicker mood-kicker text-cyan-300">MY MOOD</div>
      <div className="section-title">Краткий вывод</div>

      <div className="mood-grid">
        <div className="mood-card mood-card-primary">
          <div className="mood-card-label">Текущий рынок</div>
          <div className="mood-card-text">{mood.currentMarket}</div>
        </div>

        <div className="mood-card mood-card-window">
          <div className="mood-card-label">Окно агрессивных покупок</div>
          <div className="mood-window-date">{mood.buyWindow}</div>
          <div className="mood-countdown">{mood.countdownLabel}</div>
        </div>

        <div className="mood-card">
          <div className="mood-card-label">Предполагаемая волна - крипта</div>
          <div className="mood-card-text">{mood.cryptoWave}</div>
        </div>

        <div className="mood-card">
          <div className="mood-card-label">Предполагаемая волна - золото</div>
          <div className="mood-card-text">{mood.goldWave}</div>
        </div>

        <div className="mood-card">
          <div className="mood-card-label">Предполагаемая волна - акции</div>
          <div className="mood-card-text">{mood.stocksWave}</div>
        </div>

        <div className="mood-card mood-card-logic">
          <div className="mood-card-label">Циклы, халвинг, сантимент, шкала эмоций</div>
          <div className="mood-card-text">{mood.cycleLogic}</div>
        </div>
      </div>
    </Panel>
  );
}
function OverviewPage({ data, setPage, fearGreedData }: { data: PortfolioState; setPage: (page: Page) => void; fearGreedData: FearGreed }) {
  const overview = data.overview;
  const risk = data.risk;
  const riskValue = Math.round(risk.health * 10);
  const riskColor = getRiskColor(riskValue);

  return (
    <div className="space-y-6">
      <div className="overview-top-grid">
        <Panel tone="cyan" className="p-7 xl:p-8 h-full overview-main-panel" hover>
          <div className="overview-header overview-header-main">
            <div>
              <div className="section-kicker section-kicker-main text-cyan-300">Today</div>
              <div className="section-title section-title-main">Портфель сегодня</div>
            </div>
            <div className="pnl-hero-pill">
              <span className="pnl-hero-value">{currency(overview.pnl)}</span>
              {overview.pnl > 0 ? <TrendArrow direction="up" /> : overview.pnl < 0 ? <TrendArrow direction="down" /> : null}
            </div>
          </div>

          <div className="overview-main-grid">
            <MiniInfo
              label="Стоимость портфеля"
              value={currency(overview.portfolioValue)}
              sub={
                <span className="mini-sub-pnl-row">
                  {overview.pnl > 0 ? <TrendArrow direction="up" /> : overview.pnl < 0 ? <TrendArrow direction="down" /> : null}
                  <span>PnL {percent(overview.pnlPct)}</span>
                </span>
              }
              tone="cyan"
              center
              panelClassName="overview-mini-card"
              labelClassName="mini-label-overview-main"
              valueClassName="mini-value-hero"
              subClassName={overview.pnl > 0 ? "mini-sub-green" : overview.pnl < 0 ? "mini-sub-red" : ""}
            />

            <MiniInfo
              label="Вложено"
              value={currency(overview.invested)}
              tone="yellow"
              center
              panelClassName="overview-mini-card"
              labelClassName="mini-label-overview-main"
              valueClassName="mini-value-hero"
            />

            <button type="button" onClick={() => setPage("Портфель")} className="portfolio-link-card">
              <MiniInfo
                label="Лучшая позиция"
                value={overview.bestPosition.asset}
                sub={
                  <span>
                    {currency(overview.bestPosition.pnl)} /{" "}
                    <span className="mini-sub-green">{percentDirect(overview.bestPosition.pnlPct)}</span>
                  </span>
                }
                tone="cyan"
                center
                panelClassName="overview-mini-card"
                valueClassName="mini-value-asset"
              />
            </button>

            <button type="button" onClick={() => setPage("Портфель")} className="portfolio-link-card">
              <MiniInfo
                label="Худшая позиция"
                value={overview.worstPosition.asset}
                sub={
                  <span>
                    {currency(overview.worstPosition.pnl)} /{" "}
                    <span className="mini-sub-red">{percentDirect(overview.worstPosition.pnlPct)}</span>
                  </span>
                }
                tone="violet"
                center
                panelClassName="overview-mini-card"
                valueClassName="mini-value-asset"
              />
            </button>
          </div>
        </Panel>

        <Panel tone="violet" className="p-6 xl:p-8 h-full overview-health-panel" hover>
          <div className="overview-header overview-header-health">
            <div>
              <div className="section-kicker section-kicker-main text-violet-300">Health</div>
              <div className="section-title section-title-main risk-title-main">Здоровье портфеля</div>
            </div>
            <Badge tone={risk.health >= 0.8 ? "cyan" : risk.health >= 0.6 ? "yellow" : "violet"}>{risk.state}</Badge>
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
              tone={riskColor === "red" ? "violet" : "cyan"}
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
              value={currency(risk.deployableCash)}
              sub="Без поломки структуры"
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
        <FearGreedGauge data={fearGreedData} />
      </div>

      <MoodSummary />
    </div>
  );
}
function PortfolioPage({ data }: { data: PortfolioState }) {
  const sortedPortfolio = [...data.portfolio].sort((a, b) => b.invested - a.invested);

  return (
    <div className="space-y-6">
      <Panel tone="cyan" className="p-6 portfolio-header-panel" hover>
        <div className="section-kicker portfolio-kicker text-cyan-300">PORTFOLIO</div>
        <div className="section-title portfolio-title">Все позиции</div>
      </Panel>

      <div className="overflow-x-auto portfolio-table-wrap">
        <table className="w-full min-w-[1000px] border-separate border-spacing-y-3 portfolio-table">
          <thead>
            <tr className="portfolio-table-head-row">
              <th className="px-3 portfolio-th portfolio-th-left">Актив</th>
              <th className="px-3 portfolio-th">Категория</th>
              <th className="px-3 portfolio-th">Средняя</th>
              <th className="px-3 portfolio-th">Текущая</th>
              <th className="px-3 portfolio-th">Вложено</th>
              <th className="px-3 portfolio-th">Стоимость</th>
              <th className="px-3 portfolio-th">PnL</th>
              <th className="px-3 portfolio-th">Доля</th>
              <th className="px-3 portfolio-th">Статус</th>
            </tr>
          </thead>

          <tbody>
            {sortedPortfolio.map((item) => {
              const pnlClass =
                getProfitColor(item.pnlPct) === "green"
                  ? "portfolio-pnl-positive"
                  : "portfolio-pnl-negative";

              return (
                <tr key={item.asset} className="portfolio-table-row">
                  <td className="px-3 py-3 rounded-l-2xl portfolio-td portfolio-td-asset">{item.asset}</td>

                  <td className="px-3 py-3 portfolio-td portfolio-td-center">{item.category}</td>

                  <td className="px-3 py-3 portfolio-td portfolio-td-center">{currency(item.avgEntry)}</td>

                  <td className="px-3 py-3 portfolio-td portfolio-td-center">{currency(item.currentPrice)}</td>

                  <td className="px-3 py-3 portfolio-td portfolio-td-center portfolio-td-money">{currency(item.invested)}</td>

                  <td className="px-3 py-3 portfolio-td portfolio-td-center portfolio-td-money">{currency(item.currentValue)}</td>

                  <td className={`px-3 py-3 portfolio-td portfolio-td-center portfolio-pnl-cell ${pnlClass}`}>
                    <span className="portfolio-pnl-main">
                      {item.pnl > 0 ? "+" : ""}
                      {currency(item.pnl)}
                    </span>
                    <span className="portfolio-pnl-sep"> / </span>
                    <span className="portfolio-pnl-percent">
                      {item.pnlPct > 0 ? "+" : ""}
                      {percentDirect(item.pnlPct)}
                    </span>
                  </td>

                  <td className="px-3 py-3 portfolio-td portfolio-td-center">{percentDirect(item.share)}</td>

                  <td className="px-3 py-3 rounded-r-2xl portfolio-td portfolio-td-center">
                    <span
                      className={`status-badge ${
                        item.status === "Держать"
                          ? "status-badge-hold"
                          : item.status === "Накапливать"
                            ? "status-badge-accumulate"
                            : item.status === "Наблюдать"
                              ? "status-badge-watch"
                              : item.status === "Хедж"
                                ? "status-badge-hedge"
                                : "status-badge-spec"
                      }`}
                      title={item.status}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RiskPage({ data }: { data: PortfolioState }) {
  const risk = data.risk;
  const portfolio = [...data.portfolio].sort((a, b) => b.share - a.share);
  const healthAxes = [
    { short: "Диверс.", title: "Диверсификация", score: 78, note: "Категории и отсутствие перегруза одним активом.", color: "#d875ff" },
    { short: "Гибкость", title: "Гибкость", score: 95, note: "Запас манёвра и возможность двигать капитал.", color: "#89df18" },
    { short: "Кэш", title: "Покупательская сила", score: 93, note: "Свободные деньги для добора по плану.", color: "#57d1ff" },
    { short: "Фьючи", title: "Фьючерсная дисциплина", score: 70, note: "Малое плечо и небольшой вес фьючерсов.", color: "#ffd42b" },
    { short: "MM", title: "Мани-менеджмент", score: 73, note: "Баланс резерва, риска и размеров позиций.", color: "#ff7288" },
  ];
  const healthScore = 82;
  const radarFill = buildRiskRadarPolygon(healthAxes.map((axis) => axis.score));
  const assetsForBars = portfolio;
  const maxBarShare = Math.max(...assetsForBars.map((item) => item.share), 1);
  const marketBars = [
    { name: "Доллары", value: round(risk.cashShare * 100, 1), color: "#63d8ff", order: 0 },
    { name: "Спот крипта", value: round(risk.cryptoShare * 100, 1), color: "#53ea87", order: 1 },
    { name: "Фьючерсы", value: round(risk.futuresShare * 100, 1), color: "#ff9a3c", order: 2 },
    { name: "Металлы", value: round(risk.metalsShare * 100, 1), color: "#f7d64a", order: 3 },
    { name: "Акции", value: round(risk.stocksShare * 100, 1), color: "#8b9bb8", order: 4 },
    { name: "Валюта", value: 0, color: "#9f57ff", order: 5 },
  ].sort((a, b) => (b.value - a.value) || (a.order - b.order));
  const maxMarketShare = Math.max(...marketBars.map((item) => item.value), 1);
  const largestNonCashAsset =
    [...portfolio]
      .filter((item) => item.category !== "Свободные деньги")
      .sort((a, b) => b.currentValue - a.currentValue)[0] ?? portfolio[0];
  const largestAssetValueText = `${Math.round(Number(largestNonCashAsset?.currentValue || 0))} $`;
  const reserveText = `${Math.round(Number(risk.reserve || 0))} $`;
  const deployableText = `${Math.round(Number(risk.deployableCash || 0))} $`;

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
                При текущей оценке 82 портфель выглядит защищённым: запас кэша высокий, структура не перегружена, пространство для добора сохраняется.
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
                    <div className="assets-mini-value">{deployableText}</div>
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
                          style={{ ["--bar-height" as string]: `${heightPct}%` } as React.CSSProperties}
                        >
                          <div className="bar-value">{percentDirect(asset.share)}</div>

                          <div
                            className="bar-column"
                            style={
                              {
                                "--bar-height": `${heightPct}%`,
                                "--bar-color": color,
                              } as React.CSSProperties
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
                <div className="markets-info-box markets-info-box-alert">
                  <div className="markets-info-text markets-info-text-alert">
                    Портфель нужно обязательно диверсифицировать по рынкам.
                    <br />
                    Нужно заранее определить куда именно добавлять капитал.
                    <br />
                    И при каких условиях входить в каждый из блоков.
                  </div>
                </div>
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
                          style={{ ["--market-height" as string]: `${heightPct}%` } as React.CSSProperties}
                        >
                          <div className="market-value">{item.value.toFixed(1)}%</div>

                          <div
                            className="market-column"
                            style={{ ["--market-height" as string]: `${heightPct}%`, ["--market-color" as string]: item.color } as React.CSSProperties}
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
const importedCoinLogos: Record<string, { src: string; mode: "cover" | "contain"; imgClass?: string }> = {
  BTC: { src: btcLogo, mode: "contain", imgClass: "coin-image-btc" },
  ETH: { src: ethLogo, mode: "contain", imgClass: "coin-image-eth" },
  TON: { src: tonLogo, mode: "contain", imgClass: "coin-image-ton" },
  SOL: { src: solLogo, mode: "contain", imgClass: "coin-image-sol" },
  BNB: { src: bnbLogo, mode: "contain", imgClass: "coin-image-bnb" },
  TIA: { src: tiaLogo, mode: "contain", imgClass: "coin-image-tia" },
  MNT: { src: mntLogo, mode: "contain", imgClass: "coin-image-mnt" },
  APEX: { src: apexLogo, mode: "contain", imgClass: "coin-image-apex" },
  USDT: { src: usdtLogo, mode: "contain", imgClass: "coin-image-usdt" },
};

function CryptoLogo({ asset, className = "" }: { asset: string; className?: string }) {
  const wrap = `crypto-logo ${className}`.trim();

  if (asset === "BTC") {
    return (
      <div className={`${wrap} crypto-logo-image crypto-logo-image-contain coin-image-btc`.trim()} aria-label={asset}>
        <img src={btcLogo} alt={asset} className="crypto-logo-img" />
      </div>
    );
  }

  if (asset === "BTC SHORT") {
    return (
      <div className={`${wrap} crypto-logo-image crypto-logo-image-contain coin-image-btcshort`.trim()} aria-label={asset}>
        <img src={btcLogo} alt={asset} className="crypto-logo-img" />
      </div>
    );
  }

  if (asset === "GOLD LONG") {
    return (
      <div className={`${wrap} crypto-logo-gold`.trim()} aria-label={asset}>
        <svg viewBox="0 0 64 64" role="img" aria-hidden="true">
          <circle cx="32" cy="32" r="32" fill="#5A4312" />
          <path d="M19 36.5 26 23h12l7 13.5H19Z" fill="#F5C84C" />
          <path d="M26 23h12l4.1 7.4H21.9L26 23Z" fill="#FFD96A" />
          <path d="M24.1 30.4h15.8l2.7 5H21.4l2.7-5Z" fill="#E0A91F" />
          <path d="M21.4 35.4h21.2" stroke="#9F6C00" strokeWidth="1.8" strokeLinecap="round" opacity="0.75" />
          <path d="M26 23 23 30.4m15-7.4 3 7.4" stroke="#B9850A" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
        </svg>
      </div>
    );
  }

  const imported = importedCoinLogos[asset];
  if (imported) {
    return (
      <div
        className={`${wrap} crypto-logo-image crypto-logo-image-${imported.mode} ${imported.imgClass ?? ""}`.trim()}
        aria-label={asset}
      >
        <img src={imported.src} alt={asset} className="crypto-logo-img" />
      </div>
    );
  }

  return (
    <div className={wrap} aria-label={asset}>
      <span className="crypto-logo-fallback">{assetGlyph(asset)}</span>
    </div>
  );
}

function DecisionsScenariosPage({ data }: { data: PortfolioState }) {
  const [openAsset, setOpenAsset] = useState<string>("");

  const mergedCards = useMemo(() => {
    const scenarioMap = new Map(data.scenarios.map((item) => [item.asset, item]));
    const orderedAssets = [
      "USDT",
      "GOLD LONG",
      "BTC",
      "ETH",
      "BNB",
      "TON",
      "SOL",
      "TIA",
      "MNT",
      "BTC SHORT",
      "APEX",
    ];
    const riskOrder: Record<string, number> = Object.fromEntries(
      orderedAssets.map((asset, index) => [asset, index])
    );

    return data.decisions
      .map((decision) => {
        const scenario = scenarioMap.get(decision.asset);
        const numbers = cardNumbers(decision.asset);
        return {
          asset: decision.asset,
          status: decision.status,
          rarity: assetRarity(decision.asset),
          attack: numbers.attack,
          risk: numbers.risk,
          rarityTitle: numbers.title,
          thesis: decision.thesis,
          whyHold: decision.whyHold,
          expect: decision.expect,
          nextAction: decision.nextAction,
          reviewTrigger: decision.reviewTrigger,
          base: scenario?.base ?? "Базовый сценарий не задан.",
          bull: scenario?.bull ?? "Сценарий роста не задан.",
          bear: scenario?.bear ?? "Сценарий снижения не задан.",
          action: scenario?.action ?? decision.nextAction,
          invalidation: scenario?.invalidation ?? decision.reviewTrigger,
        };
      })
      .sort((a, b) => {
        const aOrder = riskOrder[a.asset] ?? 999;
        const bOrder = riskOrder[b.asset] ?? 999;
        if (aOrder !== bOrder) return aOrder - bOrder;
        if (a.risk !== b.risk) return a.risk - b.risk;
        return a.asset.localeCompare(b.asset);
      });
  }, [data.decisions, data.scenarios]);

  const openCard = mergedCards.find((item) => item.asset === openAsset) ?? null;

  return (
    <div className="space-y-6">
      <Panel tone="violet" className="p-6" hover>
        <div className="section-kicker text-violet-300">PLAYBOOK</div>
        <div className="section-title">Сценарии и решения</div>
        <div className="playbook-hero-text">
          Главный экран - сетка игровых карт. Клик по карте открывает полный тактический лист по активу: почему держим, что ждём, как действуем при росте и при падении.
        </div>
      </Panel>

      <div className="playbook-grid playbook-grid-tabletop">
        {mergedCards.map((item) => {
          const tone = statusTone(item.status);
          const cardClass = item.asset === "BTC" ? "playbook-card-boss" : `playbook-card-rarity-${item.rarity}`;

          return (
            <button
              key={item.asset}
              type="button"
              className={`playbook-card playbook-card-tabletop ${cardClass}`}
              onClick={() => setOpenAsset(item.asset)}
            >
              <div className="playbook-card-frame" />
              <div className="playbook-card-header-row playbook-card-header-row-centered">
                <span className={`playbook-status-pill playbook-status-pill-${tone}`}>{item.status}</span>
              </div>

              <div className="playbook-tabletop-artwrap">
                <CryptoLogo asset={item.asset} className={`playbook-tabletop-glyph playbook-tabletop-glyph-${item.rarity}`} />
                <div className="playbook-card-nameplate">{item.asset}</div>
              </div>

              <div className="playbook-tabletop-stats">
                <div className={`playbook-stat-ball playbook-stat-ball-attack ${getAttackMetricClass(item.attack)}`}>
                  <span className="playbook-stat-label">Прибыль</span>
                  <span className="playbook-stat-value">{item.attack}</span>
                </div>
                <div className="playbook-tabletop-desc">
                  <div className="playbook-preview-label">Тезис</div>
                  <div className="playbook-preview-text">{item.thesis}</div>
                </div>
                <div className={`playbook-stat-ball playbook-stat-ball-risk ${getRiskMetricClass(item.risk)}`}>
                  <span className="playbook-stat-label">Риск</span>
                  <span className="playbook-stat-value">{item.risk}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {openCard ? (
        <div className="playbook-overlay" onClick={() => setOpenAsset("")}>
          <div
            className={`playbook-modal-card playbook-card ${openCard.asset === "BTC" ? "playbook-card-boss" : `playbook-card-rarity-${openCard.rarity}`}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="playbook-card-frame" />
            <div className="playbook-card-open-top">
              <div className="playbook-card-open-left">
                <div className="playbook-card-open-title-row">
                  <CryptoLogo asset={openCard.asset} className={`playbook-tabletop-glyph playbook-tabletop-glyph-${openCard.rarity} is-large`} />
                  <div>
                    <div className="playbook-card-symbol">{openCard.asset}</div>
                  </div>
                </div>
              </div>

              <div className="playbook-card-side">
                <button type="button" className="playbook-overlay-close" onClick={() => setOpenAsset("")}>
                  Закрыть
                </button>
              </div>
            </div>

            <div className="playbook-open-status-row">
              <span className={`playbook-status-pill playbook-status-pill-${statusTone(openCard.status)}`}>{openCard.status}</span>
            </div>

            <div className="playbook-open-stats-row playbook-open-stats-row-extended">
              <div className={`playbook-open-stat playbook-open-stat-attack ${getAttackMetricClass(openCard.attack)}`}>
                <span className="playbook-open-stat-title">Прибыль</span>
                <span className="playbook-open-stat-value">{openCard.attack}/10</span>
              </div>
              <div className={`playbook-open-stat playbook-open-stat-risk ${getRiskMetricClass(openCard.risk)}`}>
                <span className="playbook-open-stat-title">Риск</span>
                <span className="playbook-open-stat-value">{openCard.risk}/10</span>
              </div>
              <div className="playbook-open-stat playbook-open-stat-text">
                <span className="playbook-open-stat-title">База</span>
                <span className="playbook-open-stat-text-value">{openCard.base}</span>
              </div>
              <div className="playbook-open-stat playbook-open-stat-text">
                <span className="playbook-open-stat-title">Роль</span>
                <span className="playbook-open-stat-text-value">{openCard.whyHold}</span>
              </div>
            </div>

            <div className="playbook-card-body is-open">
              <div className="playbook-card-body-inner">
                <div className="playbook-detail-grid playbook-detail-grid-scenario">
                  <div className="playbook-detail-block playbook-detail-block-scenario-down">
                    <div className="playbook-detail-title playbook-detail-title-down">Сценарий <span className="playbook-scenario-arrow-down" aria-hidden="true">↓</span></div>
                    <div className="playbook-detail-text playbook-detail-text-large">{openCard.bear}</div>
                  </div>

                  <div className="playbook-detail-block playbook-detail-block-scenario-up">
                    <div className="playbook-detail-title playbook-detail-title-up">Сценарий <span className="playbook-scenario-arrow-up" aria-hidden="true">↑</span></div>
                    <div className="playbook-detail-text playbook-detail-text-large">{openCard.bull}</div>
                  </div>

                  <div className="playbook-detail-block playbook-detail-block-action-down">
                    <div className="playbook-detail-title playbook-detail-title-action-down">Решение</div>
                    <div className="playbook-detail-text playbook-detail-text-large playbook-detail-action-text">{openCard.nextAction}</div>
                  </div>

                  <div className="playbook-detail-block playbook-detail-block-action-up">
                    <div className="playbook-detail-title playbook-detail-title-action-up">Решение</div>
                    <div className="playbook-detail-text playbook-detail-text-large playbook-detail-action-text">{openCard.action}</div>
                  </div>

                  <div className="playbook-detail-block">
                    <div className="playbook-detail-title">Пересмотр</div>
                    <div className="playbook-detail-text playbook-detail-text-large">{openCard.reviewTrigger}</div>
                  </div>

                  <div className="playbook-detail-block">
                    <div className="playbook-detail-title">Инвалидация</div>
                    <div className="playbook-detail-text playbook-detail-text-large">{openCard.invalidation}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
function LoginPage({
  login,
  password,
  setLogin,
  setPassword,
  authError,
  onSubmit,
}: {
  login: string;
  password: string;
  setLogin: (v: string) => void;
  setPassword: (v: string) => void;
  authError: string;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="max-w-xl">
      <Panel tone="yellow" className="p-8" hover>
        <div className="section-kicker text-yellow-300">Access (доступ)</div>
        <div className="section-title">Вход в кабинет</div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Логин</label>
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none"
              placeholder="Введите логин"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none"
              placeholder="Введите пароль"
            />
          </div>

          {authError ? (
            <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/10 px-4 py-3 text-fuchsia-200">
              {authError}
            </div>
          ) : null}

          <button type="submit" className="cyber-nav-btn cyber-nav-btn-active">Войти</button>

          <div className="text-sm text-slate-500">
            Логин: <span className="text-slate-300">{TEST_LOGIN}</span> | Пароль: <span className="text-slate-300">{TEST_PASSWORD}</span>
          </div>
        </form>
      </Panel>
    </div>
  );
}
export default function App() {
  const [page, setPage] = useState<Page>("Обзор");
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const fallbackData = useMemo(
    () => buildPortfolioState(rawPositions, decisionsData, scenariosData),
    []
  );

  const data = useInvestorData(fallbackData);
  const fearGreedData = useFearGreed();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (login.trim() === TEST_LOGIN && password === TEST_PASSWORD) {
      setIsAuthenticated(true);
      setAuthError("");
      setPassword("");
      setPage("Обзор");
      return;
    }

    setAuthError("Неверный логин или пароль");
  };

  const renderPage = () => {
    if (page === "Вход") {
      return (
        <LoginPage
          login={login}
          password={password}
          setLogin={setLogin}
          setPassword={setPassword}
          authError={authError}
          onSubmit={handleLogin}
        />
      );
    }

    if (!isAuthenticated) {
      return (
        <Panel tone="violet" className="p-8" hover>
          <div className="section-kicker text-violet-300">Locked</div>
          <div className="section-title">Сначала нужен вход</div>
          <div className="mt-4 text-slate-300">
            Открой раздел «Вход» слева и авторизуйся.
          </div>
        </Panel>
      );
    }

    switch (page) {
      case "Обзор":
        return <OverviewPage data={data} setPage={setPage} fearGreedData={fearGreedData} />;
      case "Портфель":
        return <PortfolioPage data={data} />;
      case "Риск":
        return <RiskPage data={data} />;
      case "Сценарии и решения":
        return <DecisionsScenariosPage data={data} />;
      default:
        return null;
    }
  };

  return (
    <div
      className="cyber-scene"
      style={{
        minHeight: "100vh",
        color: "#eef2ff",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div className="scene-orb orb-cyan" />
      <div className="scene-orb orb-violet" />
      <div className="scene-orb orb-yellow" />
      <div className="scene-plane plane-left" />
      <div className="scene-plane plane-right" />
      <div className="space-wormhole" />

      <div
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding: 24,
          display: "flex",
          gap: 24,
          position: "relative",
          zIndex: 10,
        }}
      >
        <Sidebar page={page} setPage={setPage} />
        <main style={{ flex: 1 }}>{renderPage()}</main>
      </div>
    </div>
  );
}
