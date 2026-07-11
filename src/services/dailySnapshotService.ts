import type { PortfolioHistoryPoint } from "../types/portfolio";

export type SnapshotSlot = "main" | "wife";

const STORAGE_KEY = (slot: SnapshotSlot = "main") =>
  slot === "wife" ? "mushii-daily-snapshots-wife-v1" : "mushii-daily-snapshots-v1";

const MAX_SNAPSHOTS = 365;

// ─── Invested floor (baseline) ────────────────────────────────────────────────
const INVESTED_FLOOR_KEY = (slot: SnapshotSlot = "main") =>
  slot === "wife" ? "mushii-invested-floor-wife-v1" : "mushii-invested-floor-v1";

export function getInvestedFloor(slot: SnapshotSlot = "main"): number {
  try {
    const raw = localStorage.getItem(INVESTED_FLOOR_KEY(slot));
    const val = raw ? Number(raw) : 0;
    return Number.isFinite(val) ? val : 0;
  } catch { return 0; }
}

export function recordDeposit(amount: number, slot: SnapshotSlot = "main"): void {
  try {
    const next = getInvestedFloor(slot) + amount;
    localStorage.setItem(INVESTED_FLOOR_KEY(slot), String(Math.round(next * 100) / 100));
  } catch { /* localStorage unavailable */ }
}

export function recordWithdrawal(amount: number, slot: SnapshotSlot = "main"): void {
  try {
    const next = Math.max(0, getInvestedFloor(slot) - amount);
    localStorage.setItem(INVESTED_FLOOR_KEY(slot), String(Math.round(next * 100) / 100));
  } catch { /* localStorage unavailable */ }
}

export function seedInvestedFloorIfEmpty(investedRaw: number, slot: SnapshotSlot = "main"): void {
  try {
    if (getInvestedFloor(slot) === 0 && investedRaw > 0) {
      localStorage.setItem(INVESTED_FLOOR_KEY(slot), String(Math.round(investedRaw * 100) / 100));
    }
  } catch { /* localStorage unavailable */ }
}

export function applyInvestedFloor(investedRaw: number, slot: SnapshotSlot = "main"): number {
  const floor = getInvestedFloor(slot);
  return floor > 0 ? floor : investedRaw;
}
// ──────────────────────────────────────────────────────────────────────────────

export type DailySnapshot = PortfolioHistoryPoint;

function todayIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString();
}

// Moscow = UTC+3. Snapshot only after 07:00 MSK.
function isMoscowPast7am(): boolean {
  const nowUtcHour = new Date().getUTCHours();
  const moscowHour = (nowUtcHour + 3) % 24;
  return moscowHour >= 7;
}

function dateKey(isoDate: string): string {
  return isoDate.slice(0, 10); // "YYYY-MM-DD"
}

function readAll(slot: SnapshotSlot = "main"): DailySnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(slot));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(snapshots: DailySnapshot[], slot: SnapshotSlot = "main"): void {
  try {
    localStorage.setItem(STORAGE_KEY(slot), JSON.stringify(snapshots));
  } catch {
    // localStorage full — drop oldest
    const trimmed = snapshots.slice(-Math.floor(MAX_SNAPSHOTS / 2));
    try { localStorage.setItem(STORAGE_KEY(slot), JSON.stringify(trimmed)); } catch { /* ignore */ }
  }
}

export function maybeRecordSnapshot(params: {
  portfolioValue: number;
  invested: number;
  reserve: number;
  positionsCount: number;
  slot?: SnapshotSlot;
}): void {
  const slot = params.slot ?? "main";
  if (!params.portfolioValue) return;
  if (!isMoscowPast7am()) return;

  const today = todayIso();
  const todayKey = dateKey(today);
  const existing = readAll(slot);

  // Already have today's snapshot — skip unless it was recorded with bad data (reserve=0)
  const todayIdx = existing.findIndex(s => dateKey(s.date) === todayKey);
  if (todayIdx >= 0 && existing[todayIdx].reserve > 0) return;
  // If today's snapshot has reserve=0, overwrite with correct data below

  const invested = params.invested;
  const pnl = params.portfolioValue - invested;
  const pnlPct = invested > 0 ? pnl / invested : 0;

  const snapshot: DailySnapshot = {
    date: today,
    portfolioValue: Math.round(params.portfolioValue * 100) / 100,
    invested: Math.round(invested * 100) / 100,
    pnl: Math.round(pnl * 100) / 100,
    pnlPct: Math.round(pnlPct * 10000) / 10000,
    reserve: Math.round(params.reserve * 100) / 100,
    positionsCount: params.positionsCount,
    pointType: "auto",
    note: "Авто-снимок",
    trigger: "daily",
    source: "local",
    comment: "",
  };

  // Replace bad today snapshot or append new one
  const base = todayIdx >= 0
    ? existing.map((s, i) => (i === todayIdx ? snapshot : s))
    : [...existing, snapshot];
  const updated = base
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .slice(-MAX_SNAPSHOTS);

  writeAll(updated, slot);
}

export function getLocalSnapshots(slot: SnapshotSlot = "main"): DailySnapshot[] {
  return readAll(slot);
}

/** Merge API history with local snapshots, dedup by date (API wins for same day) */
export function mergeWithLocalSnapshots(
  apiHistory: PortfolioHistoryPoint[],
  slot: SnapshotSlot = "main",
): PortfolioHistoryPoint[] {
  const local = readAll(slot);
  if (!local.length) return apiHistory;

  const apiDates = new Set(apiHistory.map(p => dateKey(p.date)));

  // Only add local snapshots not already covered by API
  const localOnly = local.filter(s => !apiDates.has(dateKey(s.date)));

  return [...apiHistory, ...localOnly].sort(
    (a, b) => Date.parse(a.date) - Date.parse(b.date),
  );
}
