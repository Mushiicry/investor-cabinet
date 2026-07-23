import {
  futuresLeverageLimit,
  type HealthInput,
} from "../../lib/portfolioHealth";
import { SURVIVAL_BUY_POWER_TARGET_SHARE } from "../../lib/survivalEngine";

export type HealthSimulatorLevers = {
  reserveShare: number;
  diversificationRepair: number;
  concentrationRepair: number;
  riskControlRepair: number;
  survivalPlan: number;
  disciplineRepair: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const sumOf = (xs: number[]) => xs.reduce((sum, value) => sum + value, 0);
const lerp = (from: number, to: number, t: number) => from + (to - from) * clamp01(t);

export function buildDefaultHealthSimulatorLevers(base: HealthInput): HealthSimulatorLevers {
  return {
    reserveShare: base.reserveShare ?? base.cashShare,
    diversificationRepair: 0,
    concentrationRepair: 0,
    riskControlRepair: 0,
    survivalPlan: 0,
    disciplineRepair: 0,
  };
}

function repairSlotCount(used: number | undefined, total: number | undefined, repair: number) {
  if (used === undefined || total === undefined) return used;
  const target = Math.min(used, total);
  return Math.round(lerp(used, target, repair));
}

function repairLegs(base: HealthInput, repair: number) {
  const legs = base.futuresLegs ?? [];
  const nextCount = Math.max(0, Math.round(lerp(legs.length, 0, repair)));

  return legs.slice(0, nextCount).map((leg) => {
    const targetLeverage =
      leg.leverage == null ? null : Math.min(leg.leverage, futuresLeverageLimit(leg.asset));
    const nextLiqDistance =
      leg.liqDistance == null ? leg.liqDistance : lerp(leg.liqDistance, Math.max(leg.liqDistance, 0.45), repair);

    return {
      ...leg,
      leverage: leg.leverage == null ? null : lerp(leg.leverage, targetLeverage ?? leg.leverage, repair),
      liqDistance: nextLiqDistance,
    };
  });
}

function safeLimitOrderPlan(base: HealthInput) {
  const portfolioValue = base.portfolioValue ?? 0;
  const targetPlan = portfolioValue * SURVIVAL_BUY_POWER_TARGET_SHARE;
  const availablePower = base.spotDeployableUsd ?? targetPlan;
  if (availablePower <= 0) return 0;
  return Math.min(targetPlan || availablePower, availablePower);
}

function currentViolations(base: HealthInput) {
  return (
    base.disciplineViolations30d ??
    (base.fomoEvents30d ?? 0) + (base.revengeTrades30d ?? 0) + (base.overtradingDays30d ?? 0)
  );
}

export function buildHealthSimulatorInput(
  base: HealthInput,
  levers: HealthSimulatorLevers,
): HealthInput {
  const reserveShare = Math.max(0, Math.min(0.9, levers.reserveShare));
  const diversificationRepair = clamp01(levers.diversificationRepair);
  const concentrationRepair = clamp01(levers.concentrationRepair);
  const riskControlRepair = clamp01(levers.riskControlRepair);
  const survivalPlan = clamp01(levers.survivalPlan);
  const disciplineRepair = clamp01(levers.disciplineRepair);

  const baseReserve = base.reserveShare ?? base.cashShare;
  const spot = base.riskCategoryShares;
  const spotTotal = sumOf(spot);
  const reserveDelta = reserveShare - baseReserve;
  const newSpotTotal = Math.max(0, spotTotal - reserveDelta);
  const scale = spotTotal > 0 ? newSpotTotal / spotTotal : 0;
  let newSpot = spot.map((share) => share * scale);

  const equalShare = newSpot.length > 0 ? newSpotTotal / newSpot.length : 0;
  newSpot = newSpot.map((share) => lerp(share, equalShare, diversificationRepair));

  const worstLimit = base.worstConcentrationLimit ?? 0;
  const worstShareTarget =
    worstLimit > 0
      ? Math.min(base.worstConcentrationShare ?? 0, worstLimit * 0.75)
      : base.worstConcentrationShare;
  const worstPortfolioTarget = Math.min(base.worstConcentrationPortfolioShare ?? 0, 0.2);
  const maxUtilTarget = Math.min(base.maxAssetLimitUtilization ?? 0, 0.75);
  const largestTarget = Math.min(base.largestShare, 0.2);
  const repairedViolations = Math.max(0, Math.round(lerp(currentViolations(base), 0, disciplineRepair)));
  const limitOrderRepair = Math.max(survivalPlan, disciplineRepair);
  const repairedLimitOrdersUsd =
    limitOrderRepair > 0
      ? lerp(base.plannedLimitOrdersUsd ?? 0, safeLimitOrderPlan(base), limitOrderRepair)
      : base.plannedLimitOrdersUsd;

  return {
    ...base,
    cashShare: Math.max(0, base.cashShare + reserveDelta),
    reserveShare,
    spotDeployableUsd: base.portfolioValue
      ? Math.max(0, (reserveShare - 0.1) * base.portfolioValue)
      : base.spotDeployableUsd,
    cryptoShare: newSpot[0] ?? 0,
    riskCategoryShares: newSpot,
    largestShare: lerp(base.largestShare, largestTarget, concentrationRepair),
    concentrationScore:
      base.concentrationScore === undefined
        ? undefined
        : Math.round(lerp(base.concentrationScore, 100, concentrationRepair)),
    maxAssetLimitUtilization:
      base.maxAssetLimitUtilization === undefined
        ? undefined
        : lerp(base.maxAssetLimitUtilization, maxUtilTarget, concentrationRepair),
    worstConcentrationShare:
      base.worstConcentrationShare === undefined
        ? undefined
        : lerp(base.worstConcentrationShare, worstShareTarget ?? base.worstConcentrationShare, concentrationRepair),
    worstConcentrationPortfolioShare:
      base.worstConcentrationPortfolioShare === undefined
        ? undefined
        : lerp(
            base.worstConcentrationPortfolioShare,
            worstPortfolioTarget ?? base.worstConcentrationPortfolioShare,
            concentrationRepair,
          ),
    overLimitAssets:
      concentrationRepair >= 0.95 ? [] : base.overLimitAssets,
    altcoinSlotsUsed: repairSlotCount(base.altcoinSlotsUsed, base.altcoinSlotsTotal, concentrationRepair),
    stockSlotsUsed: repairSlotCount(base.stockSlotsUsed, base.stockSlotsTotal, concentrationRepair),
    metalSlotsUsed: repairSlotCount(base.metalSlotsUsed, base.metalSlotsTotal, concentrationRepair),
    futuresShare: lerp(base.futuresShare, 0, riskControlRepair),
    futuresLegs: repairLegs(base, riskControlRepair),
    plannedLimitOrdersUsd: repairedLimitOrdersUsd,
    disciplineJournalCoverage:
      disciplineRepair > 0
        ? lerp(base.disciplineJournalCoverage ?? 0, 1, disciplineRepair)
        : base.disciplineJournalCoverage,
    disciplineViolations30d:
      disciplineRepair > 0 ? repairedViolations : base.disciplineViolations30d,
    fomoEvents30d:
      disciplineRepair > 0 ? Math.max(0, Math.round(lerp(base.fomoEvents30d ?? 0, 0, disciplineRepair))) : base.fomoEvents30d,
    revengeTrades30d:
      disciplineRepair > 0 ? Math.max(0, Math.round(lerp(base.revengeTrades30d ?? 0, 0, disciplineRepair))) : base.revengeTrades30d,
    overtradingDays30d:
      disciplineRepair > 0 ? Math.max(0, Math.round(lerp(base.overtradingDays30d ?? 0, 0, disciplineRepair))) : base.overtradingDays30d,
    disciplineCooldownActive:
      disciplineRepair >= 0.95 ? false : base.disciplineCooldownActive,
  };
}
