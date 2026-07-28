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

export type CapitalBucketsInput = {
  totalPortfolioValue: number;
  stableReserve: number;
  allocation: AllocationItem[];
  strategyRules?: StrategyRule[];
  futuresDeployableUsd?: number;
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

const clampMin0 = (n: number) => (n > 0 ? n : 0);

function allocationValue(allocation: AllocationItem[], name: string): number {
  return allocation.find((item) => item.name === name)?.value ?? 0;
}

function takeBudget(remaining: number, target: number): [number, number] {
  const value = Math.min(clampMin0(target), clampMin0(remaining));
  return [value, clampMin0(remaining - value)];
}

export function buildCapitalBuckets(input: CapitalBucketsInput): CapitalBuckets {
  const investorStrategy = input.investorStrategy ?? MAIN_INVESTOR_STRATEGY;
  const total = clampMin0(input.totalPortfolioValue);
  const freeCash = clampMin0(input.stableReserve);
  const lockedReserve = Math.min(freeCash, total * investorStrategy.reserveTargetShare);
  let remaining = clampMin0(freeCash - lockedReserve);

  const currentCrypto = clampMin0(allocationValue(input.allocation, "Крипта"));
  const currentFutures = clampMin0(allocationValue(input.allocation, "Фьючерсы"));
  const currentMetals = clampMin0(allocationValue(input.allocation, "Металлы"));
  const currentStocks = clampMin0(allocationValue(input.allocation, "Акции"));

  const futuresTarget = investorStrategy.futuresAllowed
    ? clampMin0(input.futuresDeployableUsd ?? total * investorStrategy.futuresMaxShare - currentFutures)
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
