import {
  computePortfolioHealth,
  DIVERSIFIABLE_CLASSES,
  type HealthInput,
  type PortfolioHealth,
} from "../../lib/portfolioHealth";
import { calculateSurvival, type SurvivalResult } from "../../lib/survivalEngine";
import { evaluateAssetQuality, type AssetQualitySource } from "./assetQualityGate";
import {
  assetConcentration,
  CASH_CATEGORY,
  CRYPTO_CATEGORY,
  evaluateTrade,
  FUTURES_CATEGORY,
  METALS_CATEGORY,
  STOCKS_CATEGORY,
  type GateCheck,
  type GateCheckSeverity,
  type GateContext,
  type GatePosition,
  type GateVerdict,
  type TradeInput,
} from "./preTradeGate";

export type DecisionTradeInput = TradeInput & {
  buyPrice?: number;
  action?: "buy" | "sell";
};

export type DecisionStatus =
  | "РАЗРЕШЕНО"
  | "РАЗРЕШЕНО_С_ЛИМИТОМ"
  | "ОСТОРОЖНО"
  | "БЛОКИРОВКА"
  | "ЖДАТЬ"
  | "СНИЗИТЬ_РИСК";

export type DecisionReasonKind =
  | "капитал"
  | "позиция"
  | "класс"
  | "слоты"
  | "выживаемость"
  | "качество_актива"
  | "портрет_инвестора"
  | "дисциплина"
  | "рыночная_лестница"
  | "рыночная_психология"
  | "ввод";

export type DecisionReason = {
  kind: DecisionReasonKind;
  severity: GateCheckSeverity | "info";
  text: string;
};

export type DecisionContext = GateContext & {
  futuresShare?: number;
  plannedLimitOrdersUsd?: number;
  assetQuality?: AssetQualitySource;
  healthInput?: HealthInput;
  disciplineBlockers?: string[];
  disciplineWarnings?: string[];
};

export type DecisionResult = {
  status: DecisionStatus;
  reasons: DecisionReason[];
  warnings: DecisionReason[];
  maxSafeAmount: number;
  maxAllowedAmount: number;
  recommendedAction: string;
  gate: GateVerdict;
  tradePreview: TradePreview | null;
  healthPreview: DecisionHealthPreview | null;
  survivalBefore?: SurvivalResult;
  survivalAfter?: SurvivalResult;
};

function isShortIncrease(input: DecisionTradeInput, ctx: DecisionContext): boolean {
  if (input.action !== "sell") return false;
  const position = ctx.positions.find((p) => p.asset.trim().toUpperCase() === input.asset.trim().toUpperCase());
  return Boolean(
    position &&
      position.category === FUTURES_CATEGORY &&
      /\bSHORT\b/i.test(position.asset),
  );
}

export type TradePreview = {
  asset: string;
  amountUsd: number;
  buyPrice: number;
  currentCostBasis: number;
  currentQuantity: number;
  addedQuantity: number;
  averageEntryBefore: number | null;
  averageEntryAfter: number;
};

export type DecisionHealthComponentChange = {
  key: string;
  label: string;
  before: number;
  after: number;
  delta: number;
};

export type DecisionHealthPreview = {
  before: PortfolioHealth;
  after: PortfolioHealth;
  delta: number;
  changedComponents: DecisionHealthComponentChange[];
  applicable: boolean;
  note?: string;
};

function reasonKind(label: string): DecisionReasonKind {
  const lower = label.toLowerCase();
  if (lower.includes("капитал")) return "капитал";
  if (lower.includes("портрет")) return "портрет_инвестора";
  if (lower.includes("позици") || lower.includes("доля ")) return "позиция";
  if (lower.includes("мест")) return "слоты";
  if (lower.includes("класс") || lower.includes("портфел")) return "класс";
  return "ввод";
}

function resolveCategory(input: TradeInput, ctx: GateContext): string {
  const existing = ctx.positions.find((position) => position.asset === input.asset);
  return existing?.category ?? input.category ?? CASH_CATEGORY;
}

function postBuyCategoryShare(ctx: GateContext, category: string, name: string, amountUsd: number): number {
  if (ctx.totalPortfolioValue <= 0) return 0;
  const current = ctx.allocation.find((item) => item.name === name)?.value ?? 0;
  const after = current + (category === name ? amountUsd : 0);
  return after / ctx.totalPortfolioValue;
}

function survivalInput(ctx: DecisionContext, input: TradeInput, postBuy: boolean) {
  const category = resolveCategory(input, ctx);
  const amount = postBuy && category !== CASH_CATEGORY ? input.amountUsd : 0;
  const reserveAfterUsd = Math.max(0, ctx.stableReserve - amount);
  const reserveShare =
    ctx.totalPortfolioValue > 0 ? reserveAfterUsd / ctx.totalPortfolioValue : 0;

  return {
    cryptoShare: postBuyCategoryShare(ctx, category, CRYPTO_CATEGORY, amount),
    futuresShare: ctx.futuresShare ?? 0,
    riskCategoryShares: [
      postBuyCategoryShare(ctx, category, CRYPTO_CATEGORY, amount),
      postBuyCategoryShare(ctx, category, METALS_CATEGORY, amount),
      postBuyCategoryShare(ctx, category, STOCKS_CATEGORY, amount),
    ],
    reserveShare,
    portfolioValue: ctx.totalPortfolioValue,
    spotDeployableUsd: Math.max(0, ctx.spotDeployable - amount),
    plannedLimitOrdersUsd: ctx.plannedLimitOrdersUsd,
  };
}

function projectPositionsAfterTrade(input: TradeInput, ctx: DecisionContext): GatePosition[] {
  const category = resolveCategory(input, ctx);
  if (category === CASH_CATEGORY || input.amountUsd <= 0) return ctx.positions;

  const asset = input.asset.trim().toUpperCase();
  let found = false;
  const projected = ctx.positions.map((position) => {
    if (position.asset.trim().toUpperCase() !== asset) return position;
    found = true;
    return { ...position, value: Math.max(0, position.value) + input.amountUsd };
  });

  if (!found) {
    projected.push({ asset, category, value: input.amountUsd });
  }

  return projected;
}

function postTradeHealthInput(input: TradeInput, ctx: DecisionContext): HealthInput | null {
  if (!ctx.healthInput || ctx.totalPortfolioValue <= 0 || input.amountUsd <= 0) return null;

  const category = resolveCategory(input, ctx);
  const amount = category === CASH_CATEGORY ? 0 : input.amountUsd;
  const total = ctx.totalPortfolioValue;
  const projectedPositions = projectPositionsAfterTrade(input, ctx);
  const projectedCryptoBlock = projectedPositions
    .filter((position) => position.category === CRYPTO_CATEGORY)
    .reduce((sum, position) => sum + Math.max(0, position.value), 0);
  const concentration = assetConcentration(projectedPositions, projectedCryptoBlock, total, ctx.investorStrategy);
  const reserveAfterUsd = Math.max(0, ctx.stableReserve - amount);
  const amountShare = amount / total;
  const categoryShare = (name: string) => {
    const current = ctx.allocation.find((item) => item.name === name)?.value ?? 0;
    return (current + (category === name ? amount : 0)) / total;
  };
  const largestShare = projectedPositions.reduce(
    (max, position) => Math.max(max, Math.max(0, position.value) / total),
    0,
  );

  return {
    ...ctx.healthInput,
    cashShare: Math.max(0, ctx.healthInput.cashShare - amountShare),
    cryptoShare: categoryShare(CRYPTO_CATEGORY),
    futuresShare:
      category === FUTURES_CATEGORY
        ? ((ctx.futuresShare ?? ctx.healthInput.futuresShare) * total + amount) / total
        : ctx.healthInput.futuresShare,
    largestShare,
    riskCategoryShares: DIVERSIFIABLE_CLASSES.map((name) => categoryShare(name)),
    reserveShare: reserveAfterUsd / total,
    spotDeployableUsd: Math.max(0, (ctx.healthInput.spotDeployableUsd ?? ctx.spotDeployable) - amount),
    concentrationScore: concentration.score,
    maxAssetLimitUtilization: concentration.maxUtilization,
    worstConcentrationAsset: concentration.worstAsset,
    worstConcentrationShare: concentration.worstShare,
    worstConcentrationPortfolioShare: concentration.worstPortfolioShare,
    worstConcentrationLimit: concentration.worstLimit,
    overLimitAssets: concentration.overLimitAssets,
    altcoinSlotsUsed: concentration.altcoinSlotsUsed,
    altcoinSlotsTotal: concentration.altcoinSlotsTotal,
    altcoinSlotsFree: concentration.altcoinSlotsFree,
    altcoins: concentration.altcoins,
    stockSlotsUsed: concentration.stockSlotsUsed,
    stockSlotsTotal: concentration.stockSlotsTotal,
    stockSlotsFree: concentration.stockSlotsFree,
    stocks: concentration.stocks,
    metalSlotsUsed: concentration.metalSlotsUsed,
    metalSlotsTotal: concentration.metalSlotsTotal,
    metalSlotsFree: concentration.metalSlotsFree,
    metals: concentration.metals,
  };
}

function calculateHealthPreview(
  input: TradeInput,
  ctx: DecisionContext,
  applicable: boolean,
): DecisionHealthPreview | null {
  const afterInput = postTradeHealthInput(input, ctx);
  if (!ctx.healthInput || !afterInput) return null;

  const before = computePortfolioHealth(ctx.healthInput);
  const after = computePortfolioHealth(afterInput);
  const changedComponents = after.components
    .map((component) => {
      const beforeComponent = before.components.find((item) => item.key === component.key);
      const beforeScore = beforeComponent?.score ?? component.score;
      return {
        key: component.key,
        label: component.label,
        before: beforeScore,
        after: component.score,
        delta: component.score - beforeScore,
      };
    })
    .filter((component) => component.delta !== 0)
    .sort((a, b) => a.delta - b.delta);

  return {
    before,
    after,
    delta: Math.round(after.healthFactor - before.healthFactor),
    changedComponents,
    applicable,
    note: applicable ? undefined : "Здоровье после сделки не применяется: актив запрещён политикой риска.",
  };
}

export function calculateAveragingPreview(
  input: DecisionTradeInput,
  ctx: DecisionContext,
): TradePreview | null {
  const buyPrice = input.buyPrice ?? 0;
  if (!Number.isFinite(input.amountUsd) || input.amountUsd <= 0) return null;
  if (!Number.isFinite(buyPrice) || buyPrice <= 0) return null;

  const existing = ctx.positions.find((position) => position.asset === input.asset);
  const currentCostBasis = Math.max(0, existing?.invested ?? 0);
  const averageEntryBefore = existing?.avgEntry && existing.avgEntry > 0 ? existing.avgEntry : null;
  const currentQuantity =
    averageEntryBefore && currentCostBasis > 0 ? currentCostBasis / averageEntryBefore : 0;
  const addedQuantity = input.amountUsd / buyPrice;
  const averageEntryAfter =
    (currentCostBasis + input.amountUsd) / (currentQuantity + addedQuantity);

  return {
    asset: input.asset,
    amountUsd: input.amountUsd,
    buyPrice,
    currentCostBasis,
    currentQuantity,
    addedQuantity,
    averageEntryBefore,
    averageEntryAfter,
  };
}

function statusFrom(
  gate: GateVerdict,
  hardReasons: DecisionReason[],
  warnings: DecisionReason[],
  maxSafeAmount: number,
  amountUsd: number,
): DecisionStatus {
  if (gate.status === "idle") return "ЖДАТЬ";
  if (hardReasons.length) return "БЛОКИРОВКА";
  if (warnings.length) return "ОСТОРОЖНО";
  if (maxSafeAmount > 0 && amountUsd > maxSafeAmount) return "РАЗРЕШЕНО_С_ЛИМИТОМ";
  return "РАЗРЕШЕНО";
}

function recommendedAction(
  status: DecisionStatus,
  reasons: DecisionReason[],
  maxSafeAmount: number,
  action: "buy" | "sell" = "buy",
): string {
  if (status === "ЖДАТЬ") return "Ввести актив и сумму сделки";
  if (status === "БЛОКИРОВКА") return reasons[0]?.text ?? "Сделку не открывать";
  if (action === "sell") {
    if (status === "ОСТОРОЖНО") return "Продажа только после ручной проверки причины";
    return "Продажа проходит базовую проверку риска";
  }
  if (status === "ОСТОРОЖНО") return "Разрешено только после ручной проверки риска";
  if (status === "РАЗРЕШЕНО_С_ЛИМИТОМ") return `Уменьшить сумму до ${Math.floor(maxSafeAmount)}$`;
  if (status === "СНИЗИТЬ_РИСК") return "Сначала снизить риск портфеля";
  return "Сделка проходит проверку риска";
}

export function evaluateDecision(input: DecisionTradeInput, ctx: DecisionContext): DecisionResult {
  if (input.action === "sell" && !isShortIncrease(input, ctx)) {
    const amountUsd = Number(input.amountUsd);
    const position = ctx.positions.find((p) => p.asset.trim().toUpperCase() === input.asset.trim().toUpperCase());
    if (!input.asset || !Number.isFinite(amountUsd) || amountUsd <= 0) {
      const reason: DecisionReason = { kind: "ввод", severity: "info", text: "Ввести актив и сумму продажи" };
      return {
        status: "ЖДАТЬ",
        reasons: [reason],
        warnings: [],
        maxSafeAmount: 0,
        maxAllowedAmount: 0,
        recommendedAction: recommendedAction("ЖДАТЬ", [reason], 0, "sell"),
        gate: { status: "idle", message: reason.text },
        tradePreview: null,
        healthPreview: null,
      };
    }

    const hardReasons: DecisionReason[] = [];
    const warnings: DecisionReason[] = [];
    if (!position) {
      hardReasons.push({ kind: "позиция", severity: "block", text: "Нельзя продать актив, которого нет в портфеле" });
    } else if (amountUsd > position.value) {
      hardReasons.push({ kind: "позиция", severity: "block", text: "Сумма продажи выше текущей стоимости позиции" });
    }
    if (ctx.marketPsychology?.riskMode === "покупать_по_плану") {
      warnings.push({
        kind: "рыночная_психология",
        severity: "warn",
        text: "Рынок в зоне страха — продажа может быть эмоциональной, нужна ручная причина",
      });
    }
    for (const blocker of ctx.disciplineBlockers ?? []) {
      hardReasons.push({ kind: "дисциплина", severity: "block", text: blocker });
    }
    for (const warning of ctx.disciplineWarnings ?? []) {
      warnings.push({ kind: "дисциплина", severity: "warn", text: warning });
    }

    const checks: GateCheck[] = [{
      key: "position",
      label: "Позиция к продаже",
      ok: Boolean(position) && amountUsd <= (position?.value ?? 0),
      severity: "block",
      before: position?.value ?? 0,
      after: Math.max(0, (position?.value ?? 0) - amountUsd),
      limit: position?.value ?? 0,
      isShare: false,
      note: !position
        ? "Актив не найден в портфеле."
        : amountUsd > position.value
          ? "Нельзя продать больше текущей позиции."
          : undefined,
    }];
    const status = hardReasons.length ? "БЛОКИРОВКА" : warnings.length ? "ОСТОРОЖНО" : "РАЗРЕШЕНО";

    return {
      status,
      reasons: hardReasons,
      warnings,
      maxSafeAmount: position?.value ?? 0,
      maxAllowedAmount: position?.value ?? 0,
      recommendedAction: recommendedAction(status, hardReasons, position?.value ?? 0, "sell"),
      gate: {
        status: hardReasons.length ? "block" : warnings.length ? "caution" : "ok",
        checks,
        reasons: hardReasons.map((reason) => reason.text),
        warnings: warnings.map((warning) => warning.text),
        maxSafeAmount: position?.value ?? 0,
        maxAllowedAmount: position?.value ?? 0,
        fearGreed: null,
      },
      tradePreview: null,
      healthPreview: null,
    };
  }

  const gate = evaluateTrade(input, ctx);
  if (gate.status === "idle") {
    const reason: DecisionReason = { kind: "ввод", severity: "info", text: gate.message };
    return {
      status: "ЖДАТЬ",
      reasons: [reason],
      warnings: [],
      maxSafeAmount: 0,
      maxAllowedAmount: 0,
      recommendedAction: recommendedAction("ЖДАТЬ", [reason], 0),
      gate,
      tradePreview: calculateAveragingPreview(input, ctx),
      healthPreview: null,
    };
  }

  const survivalBefore = calculateSurvival(survivalInput(ctx, input, false));
  const survivalAfter = calculateSurvival(survivalInput(ctx, input, true));
  const category = resolveCategory(input, ctx);
  const hardReasons: DecisionReason[] = gate.reasons.map((text) => ({
    kind: reasonKind(text),
    severity: "block",
    text,
  }));
  const warnings: DecisionReason[] = gate.warnings.map((text) => ({
    kind: reasonKind(text),
    severity: "warn",
    text,
  }));

  if (category === CRYPTO_CATEGORY && ctx.assetQuality) {
    const assetQuality = evaluateAssetQuality(input.asset, ctx.assetQuality);
    for (const blocker of assetQuality.blockers) {
      hardReasons.push({ kind: "качество_актива", severity: "block", text: blocker });
    }
    for (const warning of assetQuality.warnings) {
      warnings.push({ kind: "качество_актива", severity: "warn", text: warning });
    }
  }

  for (const blocker of survivalAfter.survivalBlockers) {
    hardReasons.push({ kind: "выживаемость", severity: "block", text: blocker });
  }
  for (const warning of survivalAfter.survivalWarnings) {
    warnings.push({ kind: "выживаемость", severity: "warn", text: warning });
  }
  for (const blocker of ctx.disciplineBlockers ?? []) {
    hardReasons.push({ kind: "дисциплина", severity: "block", text: blocker });
  }
  for (const warning of ctx.disciplineWarnings ?? []) {
    warnings.push({ kind: "дисциплина", severity: "warn", text: warning });
  }
  if (gate.fearGreed?.blocks) {
    hardReasons.push({ kind: "рыночная_психология", severity: "block", text: gate.fearGreed.text });
  } else if (gate.fearGreed?.tone === "warning") {
    warnings.push({
      kind: gate.fearGreed.kind === "рыночная_психология" ? "рыночная_психология" : "рыночная_лестница",
      severity: "warn",
      text: gate.fearGreed.text,
    });
  }

  const status = statusFrom(gate, hardReasons, warnings, gate.maxSafeAmount, input.amountUsd);
  const hasAssetQualityBlock = hardReasons.some((reason) => reason.kind === "качество_актива");
  return {
    status,
    reasons: hardReasons,
    warnings,
    maxSafeAmount: gate.maxSafeAmount,
    maxAllowedAmount: gate.maxAllowedAmount,
    recommendedAction: recommendedAction(status, hardReasons, gate.maxSafeAmount),
    gate,
    tradePreview: calculateAveragingPreview(input, ctx),
    healthPreview: calculateHealthPreview(input, ctx, !hasAssetQualityBlock),
    survivalBefore,
    survivalAfter,
  };
}
