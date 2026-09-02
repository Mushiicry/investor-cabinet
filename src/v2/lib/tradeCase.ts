import type { TradeCandidate } from "./tradeCandidate";

export type TradeCaseStatus =
  | "IDEA"
  | "CHECKING"
  | "WATCHING"
  | "DECISION_READY"
  | "ORDER_PLACED"
  | "WAITING"
  | "FILLED"
  | "CANCELLED"
  | "REVIEWED";

export type TradeCase = {
  tradeCaseId: string;
  createdAt: string;
  updatedAt: string;
  status: TradeCaseStatus;
  source: "signal" | "manual";
  idea: string;
  signalId: string | null;
  candidateId: string | null;
  asset: string;
  category: string;
  action: "buy" | "sell";
  amountUsd: number;
  price: number;
  currentPrice: number;
  decisionStatus: string | null;
  orderPlan: string;
  transactionId: string | null;
  reviewedAt: string | null;
};

export type TradeCaseStore = {
  version: 1;
  activeTradeCaseId: string | null;
  cases: TradeCase[];
};

const STORAGE_PREFIX = "mushii-trade-cases-v1";
const MAX_CASES = 1000;
const STATUSES = new Set<TradeCaseStatus>([
  "IDEA",
  "CHECKING",
  "WATCHING",
  "DECISION_READY",
  "ORDER_PLACED",
  "WAITING",
  "FILLED",
  "CANCELLED",
  "REVIEWED",
]);
const TERMINAL_STATUSES = new Set<TradeCaseStatus>(["CANCELLED", "REVIEWED"]);

export const EMPTY_TRADE_CASE_STORE: TradeCaseStore = {
  version: 1,
  activeTradeCaseId: null,
  cases: [],
};

export function tradeCaseStoreKey(suffix = "") {
  return `${STORAGE_PREFIX}${suffix}`;
}

const text = (value: unknown) => typeof value === "string" ? value : "";
const finite = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeTradeCase(value: unknown): TradeCase | null {
  if (!isRecord(value)) return null;
  const tradeCaseId = text(value.tradeCaseId);
  const createdAt = text(value.createdAt);
  const updatedAt = text(value.updatedAt) || createdAt;
  const rawStatus = text(value.status) as TradeCaseStatus;
  if (!tradeCaseId || !createdAt || !STATUSES.has(rawStatus)) return null;

  return {
    tradeCaseId,
    createdAt,
    updatedAt,
    status: rawStatus,
    source: value.source === "signal" ? "signal" : "manual",
    idea: text(value.idea),
    signalId: text(value.signalId) || null,
    candidateId: text(value.candidateId) || null,
    asset: text(value.asset).toUpperCase(),
    category: text(value.category),
    action: value.action === "sell" ? "sell" : "buy",
    amountUsd: finite(value.amountUsd),
    price: finite(value.price),
    currentPrice: finite(value.currentPrice),
    decisionStatus: text(value.decisionStatus) || null,
    orderPlan: text(value.orderPlan),
    transactionId: text(value.transactionId) || null,
    reviewedAt: text(value.reviewedAt) || null,
  };
}

export function normalizeTradeCaseStore(value: unknown): TradeCaseStore {
  if (!isRecord(value)) return { ...EMPTY_TRADE_CASE_STORE };
  const cases = Array.isArray(value.cases)
    ? value.cases
        .map(normalizeTradeCase)
        .filter((item): item is TradeCase => item !== null)
        .slice(0, MAX_CASES)
    : [];
  const requestedActiveId = text(value.activeTradeCaseId) || null;
  const activeTradeCaseId = requestedActiveId && cases.some((item) => item.tradeCaseId === requestedActiveId)
    ? requestedActiveId
    : null;
  return { version: 1, activeTradeCaseId, cases };
}

export function readTradeCaseStore(suffix = ""): TradeCaseStore {
  if (typeof window === "undefined") return { ...EMPTY_TRADE_CASE_STORE };
  try {
    const raw = window.localStorage.getItem(tradeCaseStoreKey(suffix));
    return raw ? normalizeTradeCaseStore(JSON.parse(raw) as unknown) : { ...EMPTY_TRADE_CASE_STORE };
  } catch {
    return { ...EMPTY_TRADE_CASE_STORE };
  }
}

export function writeTradeCaseStore(store: TradeCaseStore, suffix = "") {
  const normalized = normalizeTradeCaseStore(store);
  try {
    window.localStorage.setItem(tradeCaseStoreKey(suffix), JSON.stringify(normalized));
  } catch {
    // Локальный переходный слой не должен ломать кабинет, если storage недоступен.
  }
  return normalized;
}

const newTradeCaseId = () =>
  `trade-case-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

export function createManualTradeCase(idea: string): TradeCase {
  const now = new Date().toISOString();
  return {
    tradeCaseId: newTradeCaseId(),
    createdAt: now,
    updatedAt: now,
    status: "IDEA",
    source: "manual",
    idea: idea.trim(),
    signalId: null,
    candidateId: null,
    asset: "",
    category: "",
    action: "buy",
    amountUsd: 0,
    price: 0,
    currentPrice: 0,
    decisionStatus: null,
    orderPlan: "",
    transactionId: null,
    reviewedAt: null,
  };
}

export function createTradeCaseFromCandidate(candidate: TradeCandidate): TradeCase {
  const now = new Date().toISOString();
  return {
    tradeCaseId: newTradeCaseId(),
    createdAt: now,
    updatedAt: now,
    status: "CHECKING",
    source: candidate.source === "limit_order" ? "signal" : "manual",
    idea: candidate.label,
    signalId: candidate.sourceId ?? null,
    candidateId: candidate.id,
    asset: candidate.asset,
    category: candidate.category,
    action: candidate.action,
    amountUsd: candidate.amountUsd,
    price: candidate.price,
    currentPrice: candidate.currentPrice,
    decisionStatus: null,
    orderPlan: "",
    transactionId: null,
    reviewedAt: null,
  };
}

export function updateTradeCase(
  tradeCase: TradeCase,
  patch: Partial<Omit<TradeCase, "tradeCaseId" | "createdAt">>,
): TradeCase {
  return {
    ...tradeCase,
    ...patch,
    tradeCaseId: tradeCase.tradeCaseId,
    createdAt: tradeCase.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

export function ensureTradeCaseForCandidate(cases: TradeCase[], candidate: TradeCandidate) {
  const existing = cases.find((item) => {
    if (TERMINAL_STATUSES.has(item.status)) return false;
    if (candidate.sourceId && item.signalId === candidate.sourceId) return true;
    return item.candidateId === candidate.id;
  });
  if (!existing) return createTradeCaseFromCandidate(candidate);
  return updateTradeCase(existing, {
    status: existing.status === "IDEA" ? "CHECKING" : existing.status,
    candidateId: candidate.id,
    signalId: candidate.sourceId ?? existing.signalId,
    asset: candidate.asset,
    category: candidate.category,
    action: candidate.action,
    amountUsd: candidate.amountUsd,
    price: candidate.price,
    currentPrice: candidate.currentPrice,
  });
}

export function upsertTradeCaseStore(
  store: TradeCaseStore,
  tradeCase: TradeCase,
  activate = true,
): TradeCaseStore {
  return {
    version: 1,
    activeTradeCaseId: activate ? tradeCase.tradeCaseId : store.activeTradeCaseId,
    cases: [tradeCase, ...store.cases.filter((item) => item.tradeCaseId !== tradeCase.tradeCaseId)]
      .slice(0, MAX_CASES),
  };
}

const updatedAtTime = (tradeCase: TradeCase) => {
  const parsed = Date.parse(tradeCase.updatedAt);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function mergeTradeCaseStores(
  cloudStore: TradeCaseStore,
  localStore: TradeCaseStore,
): TradeCaseStore {
  const cloud = normalizeTradeCaseStore(cloudStore);
  const local = normalizeTradeCaseStore(localStore);
  const byId = new Map<string, TradeCase>();

  [...cloud.cases, ...local.cases].forEach((tradeCase) => {
    const current = byId.get(tradeCase.tradeCaseId);
    if (!current || updatedAtTime(tradeCase) >= updatedAtTime(current)) {
      byId.set(tradeCase.tradeCaseId, tradeCase);
    }
  });

  const cases = [...byId.values()]
    .sort((left, right) => updatedAtTime(right) - updatedAtTime(left))
    .slice(0, MAX_CASES);
  const activeCandidates = [cloud.activeTradeCaseId, local.activeTradeCaseId]
    .map((tradeCaseId) => cases.find((item) => item.tradeCaseId === tradeCaseId) ?? null)
    .filter((item): item is TradeCase => item !== null)
    .sort((left, right) => updatedAtTime(right) - updatedAtTime(left));

  return {
    version: 1,
    activeTradeCaseId: activeCandidates[0]?.tradeCaseId ?? null,
    cases,
  };
}

export function tradeCaseStoresEqual(left: TradeCaseStore, right: TradeCaseStore) {
  return JSON.stringify(normalizeTradeCaseStore(left)) === JSON.stringify(normalizeTradeCaseStore(right));
}

export function tradeCandidateFromTradeCase(tradeCase: TradeCase): TradeCandidate | null {
  if (!tradeCase.asset) return null;
  return {
    id: `case:${tradeCase.tradeCaseId}`,
    source: tradeCase.signalId ? "limit_order" : "manual",
    sourceId: tradeCase.signalId ?? undefined,
    action: tradeCase.action,
    asset: tradeCase.asset,
    category: tradeCase.category,
    amountUsd: tradeCase.amountUsd,
    price: tradeCase.price,
    currentPrice: tradeCase.currentPrice,
    status: tradeCase.status,
    label: tradeCase.idea || `${tradeCase.asset} · ${tradeCase.action === "sell" ? "продажа" : "покупка"}`,
  };
}

export function tradingStepForTradeCase(status: TradeCaseStatus) {
  if (status === "IDEA") return "idea" as const;
  if (status === "CHECKING") return "check" as const;
  if (status === "WATCHING") return "observe" as const;
  if (status === "DECISION_READY") return "decision" as const;
  if (status === "ORDER_PLACED" || status === "WAITING") return "waiting" as const;
  return "journal" as const;
}
