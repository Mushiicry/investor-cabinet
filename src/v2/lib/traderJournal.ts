import type { InvestorTransaction } from "../../types/portfolio";

export type TradePlanAdherence = "" | "yes" | "partial" | "no";

export type TradeErrorType =
  | ""
  | "none"
  | "missing-limit"
  | "fomo"
  | "no-plan"
  | "early-exit"
  | "revenge"
  | "oversize"
  | "other";

export type TraderJournalEntry = {
  transactionId: string;
  tradeCaseId?: string | null;
  updatedAt: string;
  thesis: string;
  expectedScenario: string;
  invalidation: string;
  executionReview: string;
  emotion: string;
  adherence: TradePlanAdherence;
  errorType: TradeErrorType;
  lesson: string;
  nextRule: string;
};

export type TraderJournalDraft = Omit<TraderJournalEntry, "updatedAt">;

const STORAGE_PREFIX = "mushii-trader-journal-v1";
const MAX_ENTRIES = 300;

export function traderJournalKey(suffix = "") {
  return `${STORAGE_PREFIX}${suffix}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const toText = (value: unknown) => typeof value === "string" ? value : "";

export function transactionJournalId(transaction: InvestorTransaction) {
  return transaction.id || transaction.hash || [
    transaction.date,
    transaction.asset || transaction.rawAsset,
    transaction.action,
    transaction.amount,
    transaction.quantity || transaction.rawAmount,
  ].join("|");
}

export function normalizeTraderJournalEntry(value: unknown): TraderJournalEntry | null {
  if (!isRecord(value)) return null;
  const transactionId = toText(value.transactionId);
  if (!transactionId) return null;

  const adherence = ["yes", "partial", "no"].includes(toText(value.adherence))
    ? toText(value.adherence) as TradePlanAdherence
    : "";
  const errorType = [
    "none",
    "missing-limit",
    "fomo",
    "no-plan",
    "early-exit",
    "revenge",
    "oversize",
    "other",
  ].includes(toText(value.errorType))
    ? toText(value.errorType) as TradeErrorType
    : "";

  return {
    transactionId,
    tradeCaseId: toText(value.tradeCaseId) || null,
    updatedAt: toText(value.updatedAt),
    thesis: toText(value.thesis),
    expectedScenario: toText(value.expectedScenario),
    invalidation: toText(value.invalidation),
    executionReview: toText(value.executionReview),
    emotion: toText(value.emotion),
    adherence,
    errorType,
    lesson: toText(value.lesson),
    nextRule: toText(value.nextRule),
  };
}

export function readTraderJournal(suffix = ""): TraderJournalEntry[] {
  try {
    const raw = window.localStorage.getItem(traderJournalKey(suffix));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeTraderJournalEntry)
      .filter((entry): entry is TraderJournalEntry => entry !== null)
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function writeTraderJournal(entries: TraderJournalEntry[], suffix = "") {
  const normalized = entries.slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(traderJournalKey(suffix), JSON.stringify(normalized));
  } catch {
    // Разбор сделки не должен ломать отчёты, если локальное хранилище недоступно.
  }
  return normalized;
}

export function upsertTraderJournalEntry(
  current: TraderJournalEntry[],
  draft: TraderJournalDraft,
  suffix = "",
) {
  const entry: TraderJournalEntry = { ...draft, updatedAt: new Date().toISOString() };
  return writeTraderJournal(
    [entry, ...current.filter((item) => item.transactionId !== draft.transactionId)],
    suffix,
  );
}

export function isTradeReviewComplete(entry: TraderJournalEntry | undefined) {
  if (!entry) return false;
  return Boolean(
    entry.thesis.trim() &&
    entry.expectedScenario.trim() &&
    entry.invalidation.trim() &&
    entry.executionReview.trim() &&
    entry.emotion.trim() &&
    entry.adherence &&
    entry.errorType &&
    entry.lesson.trim() &&
    entry.nextRule.trim(),
  );
}
