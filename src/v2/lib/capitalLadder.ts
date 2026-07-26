import {
  MAX_CRYPTO_EXPOSURE_SHARE,
  MAX_FUTURES_EXPOSURE_SHARE,
  MAX_METALS_EXPOSURE_SHARE,
  MAX_STOCKS_EXPOSURE_SHARE,
  RESERVE_FLOOR_SHARE,
  RESERVE_TARGET_SHARE,
} from "../../config/riskRules";

export const CAPITAL_LADDER_TARGETS = [100, 500, 1000, 2000, 5000, 10000, 20000];
export const ALT_IN_CRYPTO_LIMIT_SHARE = 0.05;
export const MAJOR_IN_CRYPTO_LIMIT_SHARE = 0.35;
export const SINGLE_STOCK_LIMIT_SHARE = 0.05;
export const SINGLE_METAL_LIMIT_SHARE = 0.05;

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

function nextTarget(currentDepositsUsd: number) {
  return CAPITAL_LADDER_TARGETS.find((target) => currentDepositsUsd < target) ?? CAPITAL_LADDER_TARGETS[CAPITAL_LADDER_TARGETS.length - 1];
}

export function buildCapitalLadderPlan(currentDepositsUsd: number): CapitalLadderPlan {
  return buildCapitalLadderPlanForTarget(currentDepositsUsd, nextTarget(currentDepositsUsd));
}

export function buildCapitalLadderPlanForTarget(currentDepositsUsd: number, targetUsd: number): CapitalLadderPlan {
  const current = Math.max(0, currentDepositsUsd);
  const target = Math.max(targetUsd, 1);
  const cryptoMax = target * MAX_CRYPTO_EXPOSURE_SHARE;
  const rawProgressPct = target > 0 ? (current / target) * 100 : 0;
  const plan: CapitalLadderPlan = {
    currentDepositsUsd: current,
    targetUsd: target,
    remainingUsd: Math.max(0, target - current),
    progressPct: current >= target ? 100 : Math.max(0, Math.min(99, Math.round(rawProgressPct))),
    reserveTargetUsd: target * RESERVE_TARGET_SHARE,
    reserveFloorUsd: target * RESERVE_FLOOR_SHARE,
    cryptoMaxUsd: cryptoMax,
    futuresMaxUsd: target * MAX_FUTURES_EXPOSURE_SHARE,
    stocksMaxUsd: target * MAX_STOCKS_EXPOSURE_SHARE,
    metalsMaxUsd: target * MAX_METALS_EXPOSURE_SHARE,
    majorCryptoMaxUsd: cryptoMax * MAJOR_IN_CRYPTO_LIMIT_SHARE,
    altCryptoMaxUsd: cryptoMax * ALT_IN_CRYPTO_LIMIT_SHARE,
    limits: [],
  };

  plan.limits = [
    { label: "Резерв", valueUsd: plan.reserveTargetUsd, sharePct: RESERVE_TARGET_SHARE * 100 },
    { label: "Крипта до", valueUsd: plan.cryptoMaxUsd, sharePct: MAX_CRYPTO_EXPOSURE_SHARE * 100 },
    { label: "Фьючерсы до", valueUsd: plan.futuresMaxUsd, sharePct: MAX_FUTURES_EXPOSURE_SHARE * 100 },
    { label: "Акции до", valueUsd: plan.stocksMaxUsd, sharePct: MAX_STOCKS_EXPOSURE_SHARE * 100 },
    { label: "Металлы до", valueUsd: plan.metalsMaxUsd, sharePct: MAX_METALS_EXPOSURE_SHARE * 100 },
  ];

  return plan;
}

export function buildCapitalLadderSteps(currentDepositsUsd: number): CapitalLadderStep[] {
  const current = Math.max(0, currentDepositsUsd);
  const target = nextTarget(current);

  return CAPITAL_LADDER_TARGETS.map((stepTarget) => {
    const status: CapitalLadderStepStatus =
      stepTarget < target ? "done" : stepTarget === target ? "current" : "next";
    return {
      ...buildCapitalLadderPlanForTarget(current, stepTarget),
      status,
    };
  });
}

export function buildCapitalLadderAssetLimits(plan: CapitalLadderPlan): CapitalLadderAssetLimit[] {
  return [
    {
      id: "major-crypto",
      label: "Крупная крипта",
      valueUsd: plan.majorCryptoMaxUsd,
      shareText: "35% крипто-блока",
      rule: "Один крупный криптоактив не выше 35% от планового крипто-блока.",
    },
    {
      id: "alt-crypto",
      label: "Альткоин",
      valueUsd: plan.altCryptoMaxUsd,
      shareText: "5% крипто-блока",
      rule: "Один альткоин не выше 5% от планового крипто-блока.",
    },
    {
      id: "stock",
      label: "Одна акция",
      valueUsd: plan.targetUsd * SINGLE_STOCK_LIMIT_SHARE,
      shareText: "5% портфеля",
      rule: "Класс акций до 10% портфеля, одна акция не выше 5%.",
    },
    {
      id: "metal",
      label: "Один металл",
      valueUsd: plan.targetUsd * SINGLE_METAL_LIMIT_SHARE,
      shareText: "5% портфеля",
      rule: "Класс металлов до 10% портфеля, один металл не выше 5%.",
    },
    {
      id: "futures",
      label: "Фьючерсы",
      valueUsd: plan.futuresMaxUsd,
      shareText: "10% портфеля",
      rule: "Это общий риск-бюджет активной торговли, не цель для заполнения.",
    },
  ];
}
