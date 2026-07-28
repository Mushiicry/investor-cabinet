import {
  MAIN_INVESTOR_STRATEGY,
} from "./investorStrategy";

export const CAPITAL_LADDER_TARGETS = [100, 500, 1000, 2000, 5000, 10000, 20000];
export const ALT_IN_CRYPTO_LIMIT_SHARE = MAIN_INVESTOR_STRATEGY.defaultCryptoAssetLimit;
export const MAJOR_IN_CRYPTO_LIMIT_SHARE = MAIN_INVESTOR_STRATEGY.cryptoAssetLimits.ETH;
export const SINGLE_STOCK_LIMIT_SHARE = MAIN_INVESTOR_STRATEGY.stockAssetLimit;
export const SINGLE_METAL_LIMIT_SHARE = MAIN_INVESTOR_STRATEGY.metalAssetLimit;

export type CapitalLadderLimit = {
  label: string;
  valueUsd: number;
  sharePct: number;
};

export type CapitalLadderAssetLimit = {
  id: string;
  label: string;
  valueUsd: number;
  shareText: string;
  rule: string;
};

export type CapitalLadderPlan = {
  currentDepositsUsd: number;
  targetUsd: number;
  remainingUsd: number;
  progressPct: number;
  reserveTargetUsd: number;
  reserveFloorUsd: number;
  cryptoMaxUsd: number;
  futuresMaxUsd: number;
  stocksMaxUsd: number;
  metalsMaxUsd: number;
  majorCryptoMaxUsd: number;
  altCryptoMaxUsd: number;
  limits: CapitalLadderLimit[];
};

export type CapitalLadderStepStatus = "done" | "current" | "next";

export type CapitalLadderStep = CapitalLadderPlan & {
  status: CapitalLadderStepStatus;
};

const sharePct = (share: number) => Math.round(share * 100);

function nextTarget(currentDepositsUsd: number) {
  return CAPITAL_LADDER_TARGETS.find((target) => currentDepositsUsd < target) ?? CAPITAL_LADDER_TARGETS[CAPITAL_LADDER_TARGETS.length - 1];
}

export function buildCapitalLadderPlan(
  currentDepositsUsd: number,
  strategy = MAIN_INVESTOR_STRATEGY,
): CapitalLadderPlan {
  return buildCapitalLadderPlanForTarget(currentDepositsUsd, nextTarget(currentDepositsUsd), strategy);
}

export function buildCapitalLadderPlanForTarget(
  currentDepositsUsd: number,
  targetUsd: number,
  strategy = MAIN_INVESTOR_STRATEGY,
): CapitalLadderPlan {
  const current = Math.max(0, currentDepositsUsd);
  const target = Math.max(targetUsd, 1);
  const cryptoMax = target * strategy.cryptoMaxShare;
  const ethCryptoLimit = strategy.cryptoAssetLimits.ETH ?? MAJOR_IN_CRYPTO_LIMIT_SHARE;
  const defaultCryptoLimit = strategy.defaultCryptoAssetLimit;
  const rawProgressPct = target > 0 ? (current / target) * 100 : 0;
  const plan: CapitalLadderPlan = {
    currentDepositsUsd: current,
    targetUsd: target,
    remainingUsd: Math.max(0, target - current),
    progressPct: current >= target ? 100 : Math.max(0, Math.min(99, Math.round(rawProgressPct))),
    reserveTargetUsd: target * strategy.reserveTargetShare,
    reserveFloorUsd: target * strategy.reserveFloorShare,
    cryptoMaxUsd: cryptoMax,
    futuresMaxUsd: strategy.futuresAllowed ? target * strategy.futuresMaxShare : 0,
    stocksMaxUsd: target * strategy.stocksMaxShare,
    metalsMaxUsd: target * strategy.metalsMaxShare,
    majorCryptoMaxUsd: cryptoMax * ethCryptoLimit,
    altCryptoMaxUsd: cryptoMax * defaultCryptoLimit,
    limits: [],
  };

  plan.limits = [
    { label: "Резерв", valueUsd: plan.reserveTargetUsd, sharePct: sharePct(strategy.reserveTargetShare) },
    { label: "Крипта до", valueUsd: plan.cryptoMaxUsd, sharePct: sharePct(strategy.cryptoMaxShare) },
    ...(strategy.futuresAllowed
      ? [{ label: "Фьючерсы до", valueUsd: plan.futuresMaxUsd, sharePct: sharePct(strategy.futuresMaxShare) }]
      : []),
    { label: "Акции до", valueUsd: plan.stocksMaxUsd, sharePct: sharePct(strategy.stocksMaxShare) },
    { label: "Металлы до", valueUsd: plan.metalsMaxUsd, sharePct: sharePct(strategy.metalsMaxShare) },
  ];

  return plan;
}

export function buildCapitalLadderSteps(
  currentDepositsUsd: number,
  strategy = MAIN_INVESTOR_STRATEGY,
): CapitalLadderStep[] {
  const current = Math.max(0, currentDepositsUsd);
  const target = nextTarget(current);

  return CAPITAL_LADDER_TARGETS.map((stepTarget) => {
    const status: CapitalLadderStepStatus =
      stepTarget < target ? "done" : stepTarget === target ? "current" : "next";
    return {
      ...buildCapitalLadderPlanForTarget(current, stepTarget, strategy),
      status,
    };
  });
}

export function buildCapitalLadderAssetLimits(
  plan: CapitalLadderPlan,
  strategy = MAIN_INVESTOR_STRATEGY,
): CapitalLadderAssetLimit[] {
  if (strategy.id === "wife") {
    return [
      {
        id: "eth",
        label: "ETH",
        valueUsd: plan.cryptoMaxUsd * (strategy.cryptoAssetLimits.ETH ?? 0),
        shareText: `${sharePct(strategy.cryptoAssetLimits.ETH ?? 0)}% крипто-блока`,
        rule: "ETH — ядро криптоблока Полины, но не выше своего лимита внутри крипты.",
      },
      {
        id: "btc-ton",
        label: "BTC / TON",
        valueUsd: plan.cryptoMaxUsd * (strategy.cryptoAssetLimits.BTC ?? 0),
        shareText: `${sharePct(strategy.cryptoAssetLimits.BTC ?? 0)}% крипто-блока`,
        rule: "BTC, TON или GRAM разрешены только в пределах лимита внутри криптоблока.",
      },
      {
        id: "sol",
        label: "SOL",
        valueUsd: plan.cryptoMaxUsd * (strategy.cryptoAssetLimits.SOL ?? 0),
        shareText: `${sharePct(strategy.cryptoAssetLimits.SOL ?? 0)}% крипто-блока`,
        rule: "SOL — малый разрешенный актив, лимит ниже ETH/BTC/TON.",
      },
      {
        id: "stock",
        label: "Одна акция",
        valueUsd: plan.targetUsd * strategy.stockAssetLimit,
        shareText: `${sharePct(strategy.stockAssetLimit)}% портфеля`,
        rule: `Акции суммарно до ${sharePct(strategy.stocksMaxShare)}% портфеля, максимум ${strategy.maxStockSlots} позиции.`,
      },
      {
        id: "gold",
        label: "Золото",
        valueUsd: plan.targetUsd * strategy.metalAssetLimit,
        shareText: `${sharePct(strategy.metalAssetLimit)}% портфеля`,
        rule: "В металлах разрешено только золото.",
      },
    ];
  }

  const limits: CapitalLadderAssetLimit[] = [
    {
      id: "major-crypto",
      label: "Крупная крипта",
      valueUsd: plan.majorCryptoMaxUsd,
      shareText: `${sharePct(strategy.cryptoAssetLimits.ETH ?? MAJOR_IN_CRYPTO_LIMIT_SHARE)}% крипто-блока`,
      rule: `Один крупный криптоактив не выше ${sharePct(strategy.cryptoAssetLimits.ETH ?? MAJOR_IN_CRYPTO_LIMIT_SHARE)}% от планового крипто-блока.`,
    },
    {
      id: "alt-crypto",
      label: "Альткоин",
      valueUsd: plan.altCryptoMaxUsd,
      shareText: `${sharePct(strategy.defaultCryptoAssetLimit)}% крипто-блока`,
      rule: `Один альткоин не выше ${sharePct(strategy.defaultCryptoAssetLimit)}% от планового крипто-блока.`,
    },
    {
      id: "stock",
      label: "Одна акция",
      valueUsd: plan.targetUsd * strategy.stockAssetLimit,
      shareText: `${sharePct(strategy.stockAssetLimit)}% портфеля`,
      rule: `Класс акций до ${sharePct(strategy.stocksMaxShare)}% портфеля, одна акция не выше ${sharePct(strategy.stockAssetLimit)}%.`,
    },
    {
      id: "metal",
      label: "Один металл",
      valueUsd: plan.targetUsd * strategy.metalAssetLimit,
      shareText: `${sharePct(strategy.metalAssetLimit)}% портфеля`,
      rule: `Класс металлов до ${sharePct(strategy.metalsMaxShare)}% портфеля, один металл не выше ${sharePct(strategy.metalAssetLimit)}%.`,
    },
  ];

  if (strategy.futuresAllowed) {
    limits.push({
      id: "futures",
      label: "Фьючерсы",
      valueUsd: plan.futuresMaxUsd,
      shareText: `${sharePct(strategy.futuresMaxShare)}% портфеля`,
      rule: "Это общий риск-бюджет активной торговли, не цель для заполнения.",
    });
  }

  return limits;
}
