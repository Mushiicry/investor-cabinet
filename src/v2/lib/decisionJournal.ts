import type { DecisionResult, DecisionStatus } from "./decisionEngine";

export type DecisionJournalEntry = {
  id: string;
  tradeCaseId: string | null;
  createdAt: string;
  asset: string;
  category: string;
  action: "buy" | "sell";
  amountUsd: number;
  buyPrice: number | null;
  status: DecisionStatus;
  recommendedAction: string;
  reasons: string[];
  warnings: string[];
  setup: string;
  emotion: string;
  note: string;
  invalidation: string;
  exitPlan: string;
  orderPlan: string;
  priceAndAmountChecked: boolean;
  alertIsNotOrderConfirmed: boolean;
  planNotFomoConfirmed: boolean;
  healthBefore: number | null;
  healthAfter: number | null;
  healthDelta: number | null;
  healthApplicable: boolean;
  survivalStatus: string | null;
  survivalWorstScenario: string | null;
  survivalShockLossPct: number | null;
  averageEntryBefore: number | null;
  averageEntryAfter: number | null;
};

export type DecisionJournalDraft = {
  tradeCaseId?: string | null;
  asset: string;
  category: string;
  action?: "buy" | "sell";
  amountUsd: number;
  buyPrice: number;
  decision: DecisionResult;
  setup: string;
  emotion: string;
  note: string;
  invalidation: string;
  exitPlan: string;
  orderPlan: string;
  priceAndAmountChecked: boolean;
  alertIsNotOrderConfirmed: boolean;
  planNotFomoConfirmed: boolean;
};

const STORAGE_PREFIX = "mushii-decision-journal-v1";
const MAX_ENTRIES = 100;

export function decisionJournalKey(suffix = "") {
  return `${STORAGE_PREFIX}${suffix}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const toText = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const toNumberOrNull = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function normalizeDecisionJournalEntry(value: unknown): DecisionJournalEntry | null {
  if (!isRecord(value)) return null;
  const id = toText(value.id);
  const createdAt = toText(value.createdAt);
  const asset = toText(value.asset);
  const category = toText(value.category);
  const status = toText(value.status) as DecisionStatus;
  if (!id || !createdAt || !asset || !category || !status) return null;

  return {
    id,
    tradeCaseId: toText(value.tradeCaseId) || null,
    createdAt,
    asset,
    category,
    action: value.action === "sell" ? "sell" : "buy",
    status,
    amountUsd: toNumberOrNull(value.amountUsd) ?? 0,
    buyPrice: toNumberOrNull(value.buyPrice),
    recommendedAction: toText(value.recommendedAction),
    reasons: toStringArray(value.reasons),
    warnings: toStringArray(value.warnings),
    setup: toText(value.setup),
    emotion: toText(value.emotion),
    note: toText(value.note),
    invalidation: toText(value.invalidation),
    exitPlan: toText(value.exitPlan),
    orderPlan: toText(value.orderPlan),
    priceAndAmountChecked: value.priceAndAmountChecked === true,
    alertIsNotOrderConfirmed: value.alertIsNotOrderConfirmed === true,
    planNotFomoConfirmed: value.planNotFomoConfirmed === true,
    healthBefore: toNumberOrNull(value.healthBefore),
    healthAfter: toNumberOrNull(value.healthAfter),
    healthDelta: toNumberOrNull(value.healthDelta),
    healthApplicable: value.healthApplicable === true,
    survivalStatus: toText(value.survivalStatus) || null,
    survivalWorstScenario: toText(value.survivalWorstScenario) || null,
    survivalShockLossPct: toNumberOrNull(value.survivalShockLossPct),
    averageEntryBefore: toNumberOrNull(value.averageEntryBefore),
    averageEntryAfter: toNumberOrNull(value.averageEntryAfter),
  };
}

export function readDecisionJournal(suffix = ""): DecisionJournalEntry[] {
  try {
    const raw = window.localStorage.getItem(decisionJournalKey(suffix));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeDecisionJournalEntry(item))
      .filter((item): item is DecisionJournalEntry => item !== null)
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function writeDecisionJournal(entries: DecisionJournalEntry[], suffix = "") {
  const normalized = entries.slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(decisionJournalKey(suffix), JSON.stringify(normalized));
  } catch {
    // Журнал решений не должен ломать основной интерфейс, если хранилище недоступно.
  }
  return normalized;
}

export function buildDecisionJournalEntry(draft: DecisionJournalDraft): DecisionJournalEntry {
  const { decision } = draft;
  return {
    id: `decision-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    tradeCaseId: draft.tradeCaseId ?? null,
    createdAt: new Date().toISOString(),
    asset: draft.asset,
    category: draft.category,
    action: draft.action ?? "buy",
    amountUsd: draft.amountUsd,
    buyPrice: Number.isFinite(draft.buyPrice) && draft.buyPrice > 0 ? draft.buyPrice : null,
    status: decision.status,
    recommendedAction: decision.recommendedAction,
    reasons: decision.reasons.map((reason) => reason.text),
    warnings: decision.warnings.map((warning) => warning.text),
    setup: draft.setup,
    emotion: draft.emotion,
    note: draft.note,
    invalidation: draft.invalidation,
    exitPlan: draft.exitPlan,
    orderPlan: draft.orderPlan,
    priceAndAmountChecked: draft.priceAndAmountChecked,
    alertIsNotOrderConfirmed: draft.alertIsNotOrderConfirmed,
    planNotFomoConfirmed: draft.planNotFomoConfirmed,
    healthBefore: decision.healthPreview ? Math.round(decision.healthPreview.before.healthFactor) : null,
    healthAfter:
      decision.healthPreview && decision.healthPreview.applicable
        ? Math.round(decision.healthPreview.after.healthFactor)
        : null,
    healthDelta:
      decision.healthPreview && decision.healthPreview.applicable
        ? decision.healthPreview.delta
        : null,
    healthApplicable: decision.healthPreview?.applicable ?? false,
    survivalStatus: decision.survivalAfter?.status ?? null,
    survivalWorstScenario: decision.survivalAfter?.survivalWorstScenario ?? null,
    survivalShockLossPct: decision.survivalAfter?.survivalShockLossPct ?? null,
    averageEntryBefore: decision.tradePreview?.averageEntryBefore ?? null,
    averageEntryAfter: decision.tradePreview?.averageEntryAfter ?? null,
  };
}

export function appendDecisionJournalEntry(
  current: DecisionJournalEntry[],
  draft: DecisionJournalDraft,
  suffix = "",
) {
  return writeDecisionJournal([buildDecisionJournalEntry(draft), ...current], suffix);
}

export function removeDecisionJournalEntry(
  current: DecisionJournalEntry[],
  id: string,
  suffix = "",
) {
  return writeDecisionJournal(current.filter((entry) => entry.id !== id), suffix);
}
