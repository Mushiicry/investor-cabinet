import { useMemo, useState } from "react";
import { V2Shell } from "./components/V2Shell";
import { useInvestorData } from "../hooks/useInvestorData";
import { buildFearGreedStrategy } from "../lib/fearGreedStrategy";
import { buildPortfolioState } from "../lib/portfolioCalculations";
import { computePortfolioHealth } from "../lib/portfolioHealth";
import type { PortfolioHealth } from "../lib/portfolioHealth";
import { buildPlaybookCards } from "../lib/playbookSelectors";
import type { PlaybookCard } from "../lib/playbookSelectors";
import { rawPositions, decisionsData, scenariosData } from "../mocks/portfolioData";
import type { PortfolioState } from "../types/portfolio";
import "./v2.css";

export type V2Portfolio = {
  totalPortfolioValue: number;
  totalInvested: number;
  pnlUsd: number;
  pnlPct: number;
  stableReserve: number;
  positionsCount: number;
  healthFactor: number;
  healthStatus: "CONTROL" | "BALANCED" | "RISK";
  riskLevel: string;
  deployableCapital: number;
  spotDeployable: number;
  futuresDeployable: number;
  reserveShare: number;
  exposureMode: string;
  exposureSignal: string;
};

export type V2Position = {
  asset: string;
  category: string;
  avgEntry: number;
  currentPrice: number;
  invested: number;
  value: number; // текущая стоимость
  pnl: number;
  pnlPct: number; // в процентах
  share: number; // в процентах
  status: string;
};

export type V2Risk = {
  reserve: number;
  exposure: number;
  leverage: number;
  diversification: number;
  volatility: number;
  concentration: "LOW" | "MEDIUM" | "HIGH";
  futuresPressure: "LOW" | "MEDIUM" | "HIGH";
};

export type V2Market = {
  fearGreedValue: number;
  fearGreedLabel: string;
  marketMood: string;
  buyWindowStatus: "ACTIVE" | "WAIT" | "CLOSED";
  nextHalvingDays: number;
  cyclePhase: string;
};

export type V2Decision = {
  asset: string;
  thesis: string;
  nextAction: string;
  reviewTrigger: string;
  status: "READY" | "WAIT" | "BLOCKED";
};

export type V2Scenario = {
  asset: string;
  baseCase: string;
  bullCase: string;
  bearCase: string;
  invalidation: string;
  actionZone: string;
};

export type V2LabData = {
  portfolio: V2Portfolio;
  positions: V2Position[];
  risk: V2Risk;
  market: V2Market;
  decisions: V2Decision[];
  scenarios: V2Scenario[];
  fearGreedStrategy: PortfolioState["fearGreedStrategy"];
  allocation: Array<{ name: string; share: number; value: number }>;
  health: PortfolioHealth;
  playbook: PlaybookCard[];
  ticker: Array<{ label: string; value: string; change: number }>;
};

const mockFearGreedStrategy = buildFearGreedStrategy(42, 710570);

const mockData: V2LabData = {
  portfolio: {
    totalPortfolioValue: 754691.21,
    totalInvested: 710570,
    pnlUsd: 44121.21,
    pnlPct: 0.0621,
    stableReserve: 244.8,
    positionsCount: 11,
    healthFactor: 62,
    healthStatus: "CONTROL",
    riskLevel: "Moderate",
    deployableCapital: 532.18,
    spotDeployable: 332.18,
    futuresDeployable: 200,
    reserveShare: 0.324,
    exposureMode: "Balanced",
    exposureSignal: "No aggressive leverage",
  },
  positions: [
    { asset: "ETH", category: "Крипта", avgEntry: 1807.7, currentPrice: 1790.9, invested: 196.2, value: 194.3, pnl: -1.8, pnlPct: -0.9, share: 34.9, status: "ACCUMULATE" },
    { asset: "SOL", category: "Крипта", avgEntry: 77.6, currentPrice: 74.9, invested: 99.6, value: 96.1, pnl: -3.5, pnlPct: -3.5, share: 17.3, status: "WATCH" },
    { asset: "TON", category: "Крипта", avgEntry: 1.8, currentPrice: 1.8, invested: 86.8, value: 86.8, pnl: 0, pnlPct: 0.1, share: 15.6, status: "WATCH" },
    { asset: "USDC", category: "Свободные деньги", avgEntry: 1, currentPrice: 1, invested: 54.6, value: 54.6, pnl: 0, pnlPct: 0, share: 9.8, status: "RESERVE" },
    { asset: "GOLD LONG", category: "Металлы", avgEntry: 4315.4, currentPrice: 4345.3, invested: 23.9, value: 24.4, pnl: 0.5, pnlPct: 2.1, share: 4.4, status: "HEDGE" },
  ],
  risk: {
    reserve: 82,
    exposure: 71,
    leverage: 24,
    diversification: 67,
    volatility: 58,
    concentration: "MEDIUM",
    futuresPressure: "LOW",
  },
  market: {
    fearGreedValue: 42,
    fearGreedLabel: "Neutral",
    marketMood: "Balanced",
    buyWindowStatus: "ACTIVE",
    nextHalvingDays: 328,
    cyclePhase: "Accumulation",
  },
  decisions: [
    {
      asset: "BTC",
      thesis: "Core reserve asset remains above long-term trend support.",
      nextAction: "Hold. Add only on reserve-safe pullback.",
      reviewTrigger: "Weekly close below risk band.",
      status: "WAIT",
    },
    {
      asset: "ETH",
      thesis: "Constructive relative strength with acceptable exposure.",
      nextAction: "Accumulate small tranche inside action zone.",
      reviewTrigger: "ETH/BTC loses 2-week structure.",
      status: "READY",
    },
  ],
  scenarios: [
    {
      asset: "BTC",
      baseCase: "Range expansion after consolidation.",
      bullCase: "Breakout with reserve kept above floor.",
      bearCase: "Liquidity sweep into lower support.",
      invalidation: "Weekly close below structural support.",
      actionZone: "$64k - $68k",
    },
    {
      asset: "TON",
      baseCase: "Recovery requires risk compression.",
      bullCase: "Momentum returns after ecosystem catalyst.",
      bearCase: "Position stays under watch with no add.",
      invalidation: "New low with rising volatility.",
      actionZone: "Only after health > 80",
    },
  ],
  fearGreedStrategy: mockFearGreedStrategy,
  allocation: [
    { name: "Крипта", share: 0.627, value: 334 },
    { name: "Металлы", share: 0.026, value: 14 },
    { name: "Фьючерсы", share: 0.021, value: 11 },
    { name: "Акции", share: 0, value: 0 },
    { name: "Свободные деньги", share: 0.324, value: 173 },
  ],
  health: computePortfolioHealth({
    cashShare: 0.324,
    cryptoShare: 0.627,
    futuresShare: 0.021,
    largestShare: 0.4,
    categoryShares: [0.627, 0.026, 0.021, 0, 0.324],
  }),
  playbook: [],
  ticker: [
    { label: "BTC / USD", value: "$69,759.60", change: 0.0152 },
    { label: "ETH / USD", value: "$2,156.00", change: 0.0234 },
    { label: "Total Crypto Cap", value: "$2.48T", change: 0.0126 },
    { label: "BTC Dominance", value: "54.29%", change: -0.0035 },
    { label: "ETH Dominance", value: "17.41%", change: 0.0018 },
    { label: "S&P 500", value: "$5,304.72", change: 0.0041 },
  ],
};

const resolveReserveShare = (state: PortfolioState) => {
  if (state.risk.reserveShare) return state.risk.reserveShare;
  if (!state.overview.portfolioValue) return mockData.portfolio.reserveShare;
  return state.overview.reserve / state.overview.portfolioValue;
};

const categoryShare = (state: PortfolioState, name: string) =>
  state.overview.categories.find((category) => category.name === name)?.share ?? 0;

const buildLiveV2Data = (state: PortfolioState): V2LabData => {
  // Реальный Health Factor из долей портфеля (единый прозрачный расчёт)
  const health = computePortfolioHealth({
    cashShare: categoryShare(state, "Свободные деньги"),
    cryptoShare: categoryShare(state, "Крипта"),
    futuresShare: categoryShare(state, "Фьючерсы"),
    largestShare: state.risk.largestRiskShare,
    categoryShares: state.overview.categories.map((category) => category.share),
  });

  return {
    ...mockData,
    fearGreedStrategy: state.fearGreedStrategy,
    health,
    playbook: buildPlaybookCards(
      [
        ...state.decisions,
        ...decisionsData.filter((d) => !state.decisions.find((ld) => ld.asset === d.asset)),
      ],
      [
        ...state.scenarios,
        ...scenariosData.filter((s) => !state.scenarios.find((ls) => ls.asset === s.asset)),
      ]
    ),
    positions: state.portfolio.map((position) => ({
      asset: position.asset,
      category: position.category,
      avgEntry: position.avgEntry,
      currentPrice: position.currentPrice,
      invested: position.invested,
      value: position.currentValue,
      pnl: position.pnl,
      pnlPct: position.pnlPct,
      share: position.share,
      status: position.status,
    })),
    allocation: state.overview.categories.map((category) => ({
      name: category.name,
      share: category.share,
      value: category.value,
    })),
    portfolio: {
      ...mockData.portfolio,
      totalPortfolioValue: state.overview.portfolioValue,
      totalInvested: state.overview.invested,
      pnlUsd: state.overview.pnl,
      pnlPct: state.overview.pnlPct,
      stableReserve: state.overview.reserve,
      positionsCount: Math.round(state.overview.positionsCount),
      healthFactor: health.healthFactor,
      healthStatus: health.status,
      riskLevel: health.riskLevel,
      deployableCapital: state.risk.deployableCash,
      spotDeployable: state.risk.spotDeployableCash,
      futuresDeployable: state.risk.futuresDeployableCash,
      reserveShare: resolveReserveShare(state),
      exposureMode: state.overview.state || state.risk.state || mockData.portfolio.exposureMode,
      exposureSignal:
        state.overview.signal ||
        state.overview.action ||
        state.risk.signal ||
        mockData.portfolio.exposureSignal,
    },
  };
};

export type V2Page = "overview" | "portfolio" | "decisions";

export default function InvestorCabinetV2Lab() {
  const [page, setPage] = useState<V2Page>("overview");
  const fallbackData = useMemo(
    () => buildPortfolioState(rawPositions, decisionsData, scenariosData),
    []
  );
  const investorData = useInvestorData(fallbackData);
  const data = useMemo(() => buildLiveV2Data(investorData.data), [investorData.data]);

  return <V2Shell data={data} page={page} onNavigate={setPage} />;
}
