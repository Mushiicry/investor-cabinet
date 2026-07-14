// Построение датасетов для V2-кабинета (mock / пустой / live).
// Вынесено из InvestorCabinetV2Lab.tsx, чтобы компонент отвечал за рендер/состояние,
// а конструирование данных жило отдельно. Типы остаются в InvestorCabinetV2Lab
// (их импортируют компоненты) и подтягиваются сюда как type-only (без runtime-цикла).
import { buildFearGreedStrategy } from "../../lib/fearGreedStrategy";
import { computePortfolioHealth, DIVERSIFIABLE_CLASSES } from "../../lib/portfolioHealth";
import type { HealthInput, PortfolioHealth } from "../../lib/portfolioHealth";
import { buildPlaybookCards } from "../../lib/playbookSelectors";
import { decisionsData, scenariosData } from "../../mocks/portfolioData";
import { mergeWithLocalSnapshots } from "../../services/dailySnapshotService";
import type { PortfolioState } from "../../types/portfolio";
import type { V2LabData } from "../InvestorCabinetV2Lab";

const mockFearGreedStrategy = buildFearGreedStrategy(42, 710570);

// Входы health вынесены в константу: их же отдаём наружу как healthInput,
// чтобы симулятор мог пересчитывать здоровье реальным computePortfolioHealth().
const mockHealthInput: HealthInput = {
  cashShare: 0.324,
  cryptoShare: 0.627,
  futuresShare: 0.021,
  largestShare: 0.4,
  // спотовые рисковые классы: Крипта / Металлы / Акции (без кэша и фьючерсов)
  riskCategoryShares: [0.627, 0.026, 0],
};

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
    futuresShare: 0.24,
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
  history: [],
  transactions: [],
  allocation: [
    { name: "Крипта", share: 0.627, value: 334 },
    { name: "Металлы", share: 0.026, value: 14 },
    { name: "Фьючерсы", share: 0.021, value: 11 },
    { name: "Акции", share: 0, value: 0 },
    { name: "Свободные деньги", share: 0.324, value: 173 },
  ],
  health: computePortfolioHealth(mockHealthInput),
  healthInput: mockHealthInput,
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

// Нулевой датасет для не-владельца (напр. жены): та же структура и все виджеты,
// но личный портфель по нулям — пока не подключены её кошельки. Рыночные данные
// (BTC-график, Fear & Greed, тикер, фаза цикла) общие и остаются как есть.
// Здоровье пустого аккаунта тоже по нулям: сохраняем структуру компонентов
// (лейблы/цвета/описания для радара), но все баллы = 0, пока нет данных.
const zeroedHealthInput: HealthInput = {
  cashShare: 0,
  cryptoShare: 0,
  futuresShare: 0,
  largestShare: 0,
  riskCategoryShares: [0, 0, 0],
};

const zeroedHealth: PortfolioHealth = (() => {
  const base = computePortfolioHealth(zeroedHealthInput);
  return {
    healthFactor: 0,
    status: "RISK",
    riskLevel: "Нет данных",
    components: base.components.map((component) => ({ ...component, score: 0 })),
  };
})();

export function buildZeroedV2Data(): V2LabData {
  return {
    ...mockData,
    positions: [],
    decisions: [],
    scenarios: [],
    playbook: [],
    history: [],
    transactions: [],
    fearGreedStrategy: buildFearGreedStrategy(50, 0),
    allocation: mockData.allocation.map((category) => ({ ...category, share: 0, value: 0 })),
    health: zeroedHealth,
    healthInput: zeroedHealthInput,
    risk: {
      ...mockData.risk,
      reserve: 0,
      exposure: 0,
      leverage: 0,
      futuresShare: 0,
      diversification: 0,
      volatility: 0,
      concentration: "LOW",
      futuresPressure: "LOW",
    },
    portfolio: {
      ...mockData.portfolio,
      totalPortfolioValue: 0,
      totalInvested: 0,
      pnlUsd: 0,
      pnlPct: 0,
      stableReserve: 0,
      positionsCount: 0,
      healthFactor: zeroedHealth.healthFactor,
      healthStatus: zeroedHealth.status,
      riskLevel: zeroedHealth.riskLevel,
      deployableCapital: 0,
      spotDeployable: 0,
      futuresDeployable: 0,
      reserveShare: 0,
    },
  };
}

const resolveReserveShare = (state: PortfolioState) => {
  if (state.risk.reserveShare) return state.risk.reserveShare;
  if (!state.overview.portfolioValue) return mockData.portfolio.reserveShare;
  return state.overview.reserve / state.overview.portfolioValue;
};

const categoryShare = (state: PortfolioState, name: string) =>
  state.overview.categories.find((category) => category.name === name)?.share ?? 0;

export const buildLiveV2Data = (
  state: PortfolioState,
  leverageByCoin: Record<string, number> = {},
  slot: import("../../services/dailySnapshotService").SnapshotSlot = "main"
): V2LabData => {
  // Реальное выставленное плечо фьючерс-позиций берём с Hyperliquid (по монете).
  // Монету извлекаем из имени актива ("BTC LONG" → "BTC"). Нет данных → null (не штрафуем).
  // GOLD остаётся категорией «Металлы», но торгуется с плечом на HL — поэтому его плечо
  // тоже контролируем (строгий лимит ≤3x) и учитываем в лимите позиций. Маржу GOLD в
  // лимит 10% пока НЕ включаем — точная сумма ещё не зафиксирована (futuresShare = BTC/MNT).
  const coinOf = (asset: string) => asset.trim().split(/\s+/)[0].toUpperCase();
  const futuresLegs = state.portfolio
    .filter((position) => {
      if (position.currentValue <= 0) return false;
      if (position.category === "Фьючерсы") return true;
      // Металл с реально выставленным плечом на HL (GOLD) — под контроль плеча.
      return position.category === "Металлы" && leverageByCoin[coinOf(position.asset)] != null;
    })
    .map((position) => ({
      asset: position.asset,
      leverage: leverageByCoin[coinOf(position.asset)] ?? null,
    }));

  const liveHealthInput: HealthInput = {
    cashShare: categoryShare(state, "Свободные деньги"),
    cryptoShare: categoryShare(state, "Крипта"),
    futuresShare: state.risk.futuresShare,
    largestShare: state.risk.largestRiskShare,
    riskCategoryShares: DIVERSIFIABLE_CLASSES.map((name) => categoryShare(state, name)),
    reserveShare: resolveReserveShare(state),
    futuresLegs,
    portfolioValue: state.overview.portfolioValue,
  };
  const computedHealth = computePortfolioHealth(liveHealthInput);
  // Честный диагноз: используем собственный расчёт, а не сглаженный health из API.
  const healthFactor = Math.round(computedHealth.healthFactor);
  const healthStatus: PortfolioHealth["status"] =
    healthFactor >= 75 ? "CONTROL" : healthFactor >= 55 ? "BALANCED" : "RISK";
  const health: PortfolioHealth = {
    ...computedHealth,
    healthFactor,
    status: healthStatus,
    riskLevel: computedHealth.riskLevel,
  };
  const diversification =
    health.components.find((component) => component.key === "diversification")?.score ?? 0;
  const largestRiskShare = state.risk.largestRiskShare;
  const futuresShare = state.risk.futuresShare;

  return {
    ...mockData,
    fearGreedStrategy: state.fearGreedStrategy,
    history: mergeWithLocalSnapshots(state.history, slot),
    transactions: state.transactions,
    health,
    healthInput: liveHealthInput,
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
    risk: {
      reserve: Math.round(state.risk.reserveShare * 100),
      exposure: Math.round(state.risk.cryptoShare * 100),
      leverage: Math.round(futuresShare * 100),
      futuresShare,
      diversification,
      volatility: 0,
      concentration: largestRiskShare > 0.35 ? "HIGH" : largestRiskShare > 0.25 ? "MEDIUM" : "LOW",
      futuresPressure: futuresShare > 0.1 ? "HIGH" : futuresShare > 0.05 ? "MEDIUM" : "LOW",
    },
    portfolio: {
      ...mockData.portfolio,
      totalPortfolioValue: state.overview.portfolioValue,
      totalInvested: state.overview.invested,
      pnlUsd: state.overview.pnl,
      pnlPct: state.overview.pnlPct,
      stableReserve: state.overview.reserve,
      positionsCount: Math.round(state.overview.positionsCount),
      healthFactor,
      healthStatus,
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
