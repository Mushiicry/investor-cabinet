import {
  MAX_CRYPTO_EXPOSURE_SHARE,
  MAX_FUTURES_EXPOSURE_SHARE,
  MAX_METALS_EXPOSURE_SHARE,
  MAX_STOCKS_EXPOSURE_SHARE,
  RESERVE_TARGET_SHARE,
} from "../../config/riskRules";

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
};

export type CapitalBuckets = {
  freeCashUsd: number;
  lockedReserveUsd: number;
  workCashUsd: number;
  futuresBudgetUsd: number;
  averagingBudgetUsd: number;
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
  const total = clampMin0(input.totalPortfolioValue);
  const freeCash = clampMin0(input.stableReserve);
  const lockedReserve = Math.min(freeCash, total * RESERVE_TARGET_SHARE);
  let remaining = clampMin0(freeCash - lockedReserve);

  const currentCrypto = clampMin0(allocationValue(input.allocation, "Крипта"));
  const currentFutures = clampMin0(allocationValue(input.allocation, "Фьючерсы"));
  const currentMetals = clampMin0(allocationValue(input.allocation, "Металлы"));
  const currentStocks = clampMin0(allocationValue(input.allocation, "Акции"));

  const futuresTarget = clampMin0(total * MAX_FUTURES_EXPOSURE_SHARE - currentFutures);
  const averagingTarget = clampMin0(
    (input.strategyRules ?? [])
      .filter((rule) => rule.buyPct > 0 && rule.status !== "cooldown")
      .reduce((sum, rule) => sum + clampMin0(rule.buyAmount), 0),
  );
  const metalsTarget = clampMin0(total * MAX_METALS_EXPOSURE_SHARE - currentMetals);
  const stocksTarget = clampMin0(total * MAX_STOCKS_EXPOSURE_SHARE - currentStocks);
  const cryptoTarget = clampMin0(total * MAX_CRYPTO_EXPOSURE_SHARE - currentCrypto);

  let futuresBudget = 0;
  let averagingBudget = 0;
  let metalsBudget = 0;
  let stocksBudget = 0;

  [futuresBudget, remaining] = takeBudget(remaining, futuresTarget);
  [averagingBudget, remaining] = takeBudget(remaining, averagingTarget);
  [metalsBudget, remaining] = takeBudget(remaining, metalsTarget);
  [stocksBudget, remaining] = takeBudget(remaining, stocksTarget);

  const cryptoSpotBudget = Math.min(remaining, cryptoTarget);

  return {
    freeCashUsd: freeCash,
    lockedReserveUsd: lockedReserve,
    workCashUsd: clampMin0(freeCash - lockedReserve),
    futuresBudgetUsd: futuresBudget,
    averagingBudgetUsd: averagingBudget,
    metalsBudgetUsd: metalsBudget,
    stocksBudgetUsd: stocksBudget,
    cryptoSpotBudgetUsd: cryptoSpotBudget,
    currentCryptoBlockUsd: currentCrypto,
    plannedCryptoBlockUsd: currentCrypto + averagingBudget + cryptoSpotBudget,
  };
}
