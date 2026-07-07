import type { PortfolioState, PositionCalculated, CategoryAllocation } from "../types/portfolio";
import type { BlockchainBalances } from "../hooks/useBlockchainBalances";

const r2 = (n: number) => Math.round(n * 100) / 100;
const r6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000;

function patchPosition(pos: PositionCalculated, qty: number): PositionCalculated {
  const isStable  = pos.category === "Свободные деньги";
  const value     = isStable ? r2(qty) : r2(qty * pos.currentPrice);
  const invested  = isStable ? r2(qty) : pos.invested; // stables: invested = current balance
  const pnl       = isStable ? 0 : r2(value - invested);
  const pnlPct    = !isStable && invested > 0 ? r2((pnl / invested) * 100) : 0;

  return { ...pos, quantity: qty, currentValue: value, invested, pnl, pnlPct };
}

export function applyBlockchainOverride(
  state: PortfolioState,
  chain: BlockchainBalances
): PortfolioState {
  // 1. Patch quantities; USDT is split into ARB + TON when both amounts are available
  const arbQty = chain["USDT_ARB"] ?? 0;
  const tonQty = chain["USDT_TON"] ?? 0;
  const splitUsdt = arbQty > 0 && tonQty > 0;

  const portfolio: PositionCalculated[] = state.portfolio.flatMap((pos) => {
    if (pos.asset === "USDT" && splitUsdt) {
      // Replace single USDT row with two: TON + ARB
      const tonPos = patchPosition({ ...pos, asset: "USDT" },     tonQty);
      const arbPos = patchPosition({ ...pos, asset: "USDT ARB" }, arbQty);
      return [tonPos, arbPos];
    }
    const qty = chain[pos.asset];
    return [qty && qty > 0 ? patchPosition(pos, qty) : pos];
  });

  // 2. Recalculate totals
  const portfolioValue = r2(portfolio.reduce((s, p) => s + p.currentValue, 0));
  const invested       = r2(portfolio.reduce((s, p) => s + p.invested, 0));
  const pnl            = r2(portfolioValue - invested);
  const pnlPct         = invested > 0 ? r6(pnl / invested) : 0;
  const reserve        = r2(
    portfolio
      .filter((p) => p.category === "Свободные деньги")
      .reduce((s, p) => s + p.currentValue, 0)
  );

  // 3. Recalculate share % for each position
  const withShares = portfolio.map((p) => ({
    ...p,
    share: portfolioValue > 0 ? r2((p.currentValue / portfolioValue) * 100) : 0,
  }));

  // 4. Recalculate category allocations
  const catMap: Record<string, number> = {};
  withShares.forEach((p) => {
    catMap[p.category] = (catMap[p.category] ?? 0) + p.currentValue;
  });
  const categories: CategoryAllocation[] = state.overview.categories.map((c) => ({
    name:  c.name,
    value: r2(catMap[c.name] ?? 0),
    share: portfolioValue > 0 ? r6((catMap[c.name] ?? 0) / portfolioValue) : 0,
  }));

  // 5. Recalculate best/worst among non-stable positions
  const crypto = withShares.filter((p) => p.category !== "Свободные деньги");
  const best   = crypto.length ? crypto.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null;
  const worst  = crypto.length ? crypto.reduce((a, b) => (b.pnl < a.pnl ? b : a)) : null;

  // 6. Recalculate risk snapshot
  const cryptoValue    = r2(catMap["Крипта"] ?? 0);
  const cryptoShare    = portfolioValue > 0 ? r2(cryptoValue / portfolioValue * 100) : 0;
  const reserveShare   = portfolioValue > 0 ? r2(reserve / portfolioValue * 100) : 0;

  return {
    ...state,
    portfolio: withShares,
    overview: {
      ...state.overview,
      portfolioValue,
      invested,
      pnl,
      pnlPct,
      reserve,
      categories,
      bestPosition:  best  ? { asset: best.asset,  pnl: best.pnl,  pnlPct: best.pnlPct  } : state.overview.bestPosition,
      worstPosition: worst ? { asset: worst.asset, pnl: worst.pnl, pnlPct: worst.pnlPct } : state.overview.worstPosition,
    },
    risk: {
      ...state.risk,
      portfolioValue,
      reserve,
      reserveShare,
      cryptoShare,
    },
  };
}
