import type {
  Category,
  CategoryAllocation,
  Decision,
  PortfolioState,
  PositionCalculated,
  PositionInput,
  Risk,
  ScenarioCard,
} from "../types/portfolio";

export const CATEGORY_ORDER: Category[] = ["Крипта", "Металлы", "Фьючерсы", "Акции", "Свободные деньги"];

export const round = (n: number, digits = 2) => Number(n.toFixed(digits));

export function calculateInvested(position: PositionInput): number {
  return round(position.quantity * position.avgEntry);
}

export function calculateCurrentValue(position: PositionInput): number {
  return round(position.quantity * position.currentPrice);
}

export function calculatePnL(position: PositionInput): number {
  return round(calculateCurrentValue(position) - calculateInvested(position));
}

export function calculatePnLPercent(position: PositionInput): number {
  const invested = calculateInvested(position);
  if (!invested) return 0;
  return round((calculatePnL(position) / invested) * 100, 1);
}

export function calculatePortfolio(positions: PositionInput[]): PositionCalculated[] {
  const enriched = positions.map((position) => ({
    ...position,
    invested: calculateInvested(position),
    currentValue: calculateCurrentValue(position),
    pnl: calculatePnL(position),
    pnlPct: calculatePnLPercent(position),
    share: 0,
  }));
  const totalValue = enriched.reduce((sum, item) => sum + item.currentValue, 0);
  return enriched.map((item) => ({
    ...item,
    share: totalValue ? round((item.currentValue / totalValue) * 100, 1) : 0,
  }));
}

export function calculateCategoryAllocations(positions: PositionCalculated[]): CategoryAllocation[] {
  const totalValue = positions.reduce((sum, item) => sum + item.currentValue, 0);
  return CATEGORY_ORDER.map((category) => {
    const value = round(positions.filter((item) => item.category === category).reduce((sum, item) => sum + item.currentValue, 0));
    return { name: category, value, share: totalValue ? round(value / totalValue, 4) : 0 };
  });
}

export function calculateRisk(positions: PositionCalculated[]): Risk {
  const portfolioValue = round(positions.reduce((sum, item) => sum + item.currentValue, 0));
  const reserve = positions.find((item) => item.category === "Свободные деньги")?.currentValue ?? 0;
  const reserveShare = portfolioValue ? reserve / portfolioValue : 0;
  const cryptoValue = positions.filter((item) => item.category === "Крипта").reduce((sum, item) => sum + item.currentValue, 0);
  const metalsValue = positions.filter((item) => item.category === "Металлы").reduce((sum, item) => sum + item.currentValue, 0);
  const futuresValue = positions.filter((item) => item.category === "Фьючерсы").reduce((sum, item) => sum + item.currentValue, 0);
  const stocksValue = positions.filter((item) => item.category === "Акции").reduce((sum, item) => sum + item.currentValue, 0);
  const workBudget = reserve * 0.4575;
  const largestRiskAsset = positions.filter((item) => item.category !== "Свободные деньги").sort((a, b) => b.currentValue - a.currentValue)[0] ?? null;
  const health = reserveShare >= 0.5 ? 0.88 : reserveShare >= 0.35 ? 0.74 : reserveShare >= 0.2 ? 0.59 : 0.41;
  const state = health >= 0.8 ? "Контроль" : health >= 0.6 ? "Баланс" : "Риск";
  const signal = reserveShare >= 0.5 ? "Резерв высокий. Можно добирать ядро и держать спекулятивный лимит." : reserveShare >= 0.35 ? "Резерв нормальный. Добор только ступенчато." : "Резерв низкий. Новые входы только выборочно.";
  const summary = reserveShare >= 0.5 ? "Портфель защитный. Есть манёвренность и запас по риску." : reserveShare >= 0.35 ? "Портфель сбалансирован, но агрессию лучше не повышать." : "Портфель уже нагружен. Приоритет - защита и дисциплина.";
  return {
    portfolioValue,
    reserve: round(reserve),
    reserveShare: round(reserveShare, 4),
    deployableCash: round(workBudget),
    largestRiskAsset: largestRiskAsset?.asset ?? "-",
    largestRiskShare: largestRiskAsset ? round(largestRiskAsset.share / 100, 4) : 0,
    cryptoShare: portfolioValue ? round(cryptoValue / portfolioValue, 4) : 0,
    stocksShare: portfolioValue ? round(stocksValue / portfolioValue, 4) : 0,
    metalsShare: portfolioValue ? round(metalsValue / portfolioValue, 4) : 0,
    futuresShare: portfolioValue ? round(futuresValue / portfolioValue, 4) : 0,
    cashShare: portfolioValue ? round(reserve / portfolioValue, 4) : 0,
    health: round(health, 2),
    state,
    signal,
    summary,
  };
}

export function buildPortfolioState(positionsInput: PositionInput[], decisions: Decision[], scenarios: ScenarioCard[]): PortfolioState {
  const portfolio = calculatePortfolio(positionsInput);
  const invested = round(portfolio.reduce((sum, item) => sum + item.invested, 0));
  const portfolioValue = round(portfolio.reduce((sum, item) => sum + item.currentValue, 0));
  const pnl = round(portfolioValue - invested);
  const pnlPct = invested ? round(pnl / invested, 4) : 0;
  const categories = calculateCategoryAllocations(portfolio);
  const risk = calculateRisk(portfolio);

  const bestNonCash =
    [...portfolio]
      .filter((item) => item.asset !== "USDT")
      .sort((a, b) => b.pnl - a.pnl)[0] ?? portfolio[0];

  const worstNonCash =
    [...portfolio]
      .filter((item) => item.asset !== "USDT")
      .sort((a, b) => a.pnlPct - b.pnlPct)[0] ?? portfolio[0];

  const topPositions = [...portfolio].sort((a, b) => b.currentValue - a.currentValue).slice(0, 3).map((item) => ({
    asset: item.asset,
    share: round(item.share / 100, 4),
    value: item.currentValue,
    status: item.status,
  }));

  return {
    overview: {
      portfolioValue,
      invested,
      pnl,
      pnlPct,
      reserve: risk.reserve,
      positionsCount: portfolio.length,
      health: risk.health,
      state: risk.state,
      signal: risk.signal,
      action: `В работу по стратегии можно пустить около $${risk.deployableCash.toFixed(1)} без поломки структуры портфеля.`,
      topPositions,
      bestPosition: { asset: bestNonCash.asset, pnl: bestNonCash.pnl, pnlPct: bestNonCash.pnlPct },
      worstPosition: { asset: worstNonCash.asset, pnl: worstNonCash.pnl, pnlPct: worstNonCash.pnlPct },
      categories,
    },
    portfolio,
    risk,
    decisions,
    scenarios,
    updatedAt: new Date().toISOString(),
  };
}
