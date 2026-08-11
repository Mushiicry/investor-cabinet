import {
  MAIN_INVESTOR_STRATEGY,
  type InvestorStrategy,
} from "./investorStrategy";

type AllocationItem = {
  name: string;
  value: number;
};

type StrategyRule = {
  buyPct: number;
  buyAmount: number;
  status?: string;
};

type CapitalPosition = {
  asset: string;
  category: string;
  invested: number;
  value: number;
};

export type CapitalBucketsInput = {
  totalPortfolioValue: number;
  investedCapital?: number;
  stableReserve: number;
  allocation: AllocationItem[];
  strategyRules?: StrategyRule[];
  futuresDeployableUsd?: number;
  futuresUsedUsd?: number;
  investorStrategy?: InvestorStrategy;
};

export type CapitalBuckets = {
  freeCashUsd: number;
  lockedReserveUsd: number;
  workCashUsd: number;
  futuresBudgetUsd: number;
  averagingBudgetUsd: number;
  spotBudgetUsd: number;
  metalsBudgetUsd: number;
  stocksBudgetUsd: number;
  cryptoSpotBudgetUsd: number;
  currentCryptoBlockUsd: number;
  plannedCryptoBlockUsd: number;
};

export type FuturesLimitSnapshot = {
  limitUsd: number;
  positionMarginUsd: number;
  freeMarginUsd: number;
  usedUsd: number;
  remainingUsd: number;
  breachUsd: number;
  transferToHlUsd: number;
  withdrawFromHlUsd: number;
  balancedFreeMarginUsd: number;
  utilization: number;
};

const clampMin0 = (n: number) => (n > 0 ? n : 0);

function allocationValue(allocation: AllocationItem[], name: string): number {
  return allocation.find((item) => item.name === name)?.value ?? 0;
}

function takeBudget(remaining: number, target: number): [number, number] {
  const value = Math.min(clampMin0(target), clampMin0(remaining));
  return [value, clampMin0(remaining - value)];
}

export function buildFuturesLimitSnapshot({
  positions,
  futuresDeployableUsd = 0,
  investedCapital,
  investorStrategy = MAIN_INVESTOR_STRATEGY,
}: {
  positions: CapitalPosition[];
  futuresDeployableUsd?: number;
  investedCapital: number;
  investorStrategy?: InvestorStrategy;
}): FuturesLimitSnapshot {
  const limitUsd = investorStrategy.futuresAllowed
    ? clampMin0(investedCapital) * investorStrategy.futuresMaxShare
    : 0;
  const positionMarginUsd = positions
    .filter((position) => position.category === "Фьючерсы" && position.value > 0)
    .reduce((sum, position) => sum + clampMin0(position.invested), 0);
  const freeMarginUsd = investorStrategy.futuresAllowed ? clampMin0(futuresDeployableUsd) : 0;
  const usedUsd = positionMarginUsd + freeMarginUsd;
  const remainingUsd = Math.max(limitUsd - usedUsd, 0);
  const breachUsd = Math.max(usedUsd - limitUsd, 0);
  const transferToHlUsd = remainingUsd;
  const withdrawFromHlUsd = Math.min(freeMarginUsd, breachUsd);

  return {
    limitUsd,
    positionMarginUsd,
    freeMarginUsd,
    usedUsd,
    remainingUsd,
    breachUsd,
    transferToHlUsd,
    withdrawFromHlUsd,
    balancedFreeMarginUsd: Math.max(freeMarginUsd + transferToHlUsd - withdrawFromHlUsd, 0),
    utilization: limitUsd ? usedUsd / limitUsd : 0,
  };
}

export function buildCapitalBuckets(input: CapitalBucketsInput): CapitalBuckets {
  const investorStrategy = input.investorStrategy ?? MAIN_INVESTOR_STRATEGY;
  const total = clampMin0(input.totalPortfolioValue);
  const reserveBase = clampMin0(input.investedCapital ?? input.totalPortfolioValue);
  const freeCash = clampMin0(input.stableReserve);
  const lockedReserve = Math.min(freeCash, reserveBase * investorStrategy.reserveTargetShare);
  let remaining = clampMin0(freeCash - lockedReserve);

  const currentCrypto = clampMin0(allocationValue(input.allocation, "Крипта"));
  const currentFutures = clampMin0(allocationValue(input.allocation, "Фьючерсы"));
  const currentMetals = clampMin0(allocationValue(input.allocation, "Металлы"));
  const currentStocks = clampMin0(allocationValue(input.allocation, "Акции"));

  const futuresLimitUsd = reserveBase * investorStrategy.futuresMaxShare;
  const hasExplicitFuturesUsage = input.futuresUsedUsd != null;
  const futuresRemainingByLimit = hasExplicitFuturesUsage
    ? clampMin0(input.futuresUsedUsd ?? 0) > futuresLimitUsd
      ? 0
      : clampMin0(input.futuresDeployableUsd ?? 0)
    : clampMin0(total * investorStrategy.futuresMaxShare - currentFutures);
  const futuresTarget = investorStrategy.futuresAllowed
    ? Math.min(clampMin0(input.futuresDeployableUsd ?? futuresRemainingByLimit), futuresRemainingByLimit)
    : 0;
  const averagingTarget = clampMin0(
    (input.strategyRules ?? [])
      .filter((rule) => rule.buyPct > 0 && rule.status !== "cooldown")
      .reduce((sum, rule) => sum + clampMin0(rule.buyAmount), 0),
  );
  const metalsTarget = clampMin0(total * investorStrategy.metalsMaxShare - currentMetals);
  const stocksTarget = clampMin0(total * investorStrategy.stocksMaxShare - currentStocks);
  const cryptoTarget = clampMin0(total * investorStrategy.cryptoMaxShare - currentCrypto);

  let futuresBudget = 0;
  let averagingBudget = 0;

  [averagingBudget, remaining] = takeBudget(remaining, averagingTarget);
  [futuresBudget, remaining] = takeBudget(remaining, Math.min(futuresTarget, total * investorStrategy.futuresMaxShare));

  const spotBudget = remaining;
  const metalsBudget = Math.min(spotBudget, metalsTarget);
  const stocksBudget = Math.min(spotBudget, stocksTarget);
  const cryptoSpotBudget = Math.min(spotBudget, cryptoTarget);

  return {
    freeCashUsd: freeCash,
    lockedReserveUsd: lockedReserve,
    workCashUsd: clampMin0(freeCash - lockedReserve),
    futuresBudgetUsd: futuresBudget,
    averagingBudgetUsd: averagingBudget,
    spotBudgetUsd: spotBudget,
    metalsBudgetUsd: metalsBudget,
    stocksBudgetUsd: stocksBudget,
    cryptoSpotBudgetUsd: cryptoSpotBudget,
    currentCryptoBlockUsd: currentCrypto,
    plannedCryptoBlockUsd: currentCrypto + averagingBudget + cryptoSpotBudget,
  };
}
