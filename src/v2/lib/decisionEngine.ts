import { calculateSurvival, type SurvivalResult } from "../../lib/survivalEngine";
import {
  CASH_CATEGORY,
  CRYPTO_CATEGORY,
  evaluateTrade,
  METALS_CATEGORY,
  STOCKS_CATEGORY,
  type GateCheckSeverity,
  type GateContext,
  type GateVerdict,
  type TradeInput,
} from "./preTradeGate";

export type DecisionTradeInput = TradeInput & {
  buyPrice?: number;
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
  | "дисциплина"
  | "рыночная_лестница"
  | "ввод";

export type DecisionReason = {
  kind: DecisionReasonKind;
  severity: GateCheckSeverity | "info";
  text: string;
};

export type DecisionContext = GateContext & {
  futuresShare?: number;
  plannedLimitOrdersUsd?: number;
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
  survivalBefore?: SurvivalResult;
  survivalAfter?: SurvivalResult;
};

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

function reasonKind(label: string): DecisionReasonKind {
  const lower = label.toLowerCase();
  if (lower.includes("капитал")) return "капитал";
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

function recommendedAction(status: DecisionStatus, reasons: DecisionReason[], maxSafeAmount: number): string {
  if (status === "ЖДАТЬ") return "Ввести актив и сумму сделки";
  if (status === "БЛОКИРОВКА") return reasons[0]?.text ?? "Сделку не открывать";
  if (status === "ОСТОРОЖНО") return "Разрешено только после ручной проверки риска";
  if (status === "РАЗРЕШЕНО_С_ЛИМИТОМ") return `Уменьшить сумму до ${Math.floor(maxSafeAmount)}$`;
  if (status === "СНИЗИТЬ_РИСК") return "Сначала снизить риск портфеля";
  return "Сделка проходит проверку риска";
}

export function evaluateDecision(input: DecisionTradeInput, ctx: DecisionContext): DecisionResult {
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
    };
  }

  const survivalBefore = calculateSurvival(survivalInput(ctx, input, false));
  const survivalAfter = calculateSurvival(survivalInput(ctx, input, true));
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
  if (gate.fearGreed?.tone === "warning") {
    warnings.push({ kind: "рыночная_лестница", severity: "warn", text: gate.fearGreed.text });
  }

  const status = statusFrom(gate, hardReasons, warnings, gate.maxSafeAmount, input.amountUsd);
  return {
    status,
    reasons: hardReasons,
    warnings,
    maxSafeAmount: gate.maxSafeAmount,
    maxAllowedAmount: gate.maxAllowedAmount,
    recommendedAction: recommendedAction(status, hardReasons, gate.maxSafeAmount),
    gate,
    tradePreview: calculateAveragingPreview(input, ctx),
    survivalBefore,
    survivalAfter,
  };
}
