import type { PortfolioHistoryPoint } from "../types/portfolio";

const STORAGE_KEY = "mushii-daily-snapshots-v1";
const MAX_SNAPSHOTS = 365;

// ─── Invested floor (baseline) ────────────────────────────────────────────────
// ВЛОЖЕНО never decreases on its own — it can only grow (new deposits) or be
// explicitly reduced by the investor when cash is withdrawn from the system.
// The floor is updated automatically when invested rises above it.
const INVESTED_FLOOR_KEY = "mushii-invested-floor-v1";

export function getInvestedFloor(): number {
  try {
    const raw = localStorage.getItem(INVESTED_FLOOR_KEY);
    const val = raw ? Number(raw) : 0;
    return Number.isFinite(val) ? val : 0;
  } catch { return 0; }
}

/**
 * Record an external deposit (cash arriving from outside the system).
 * Only call this when the investor explicitly adds new capital.
 */
export function recordDeposit(amount: number): void {
  try {
    const next = getInvestedFloor() + amount;
    localStorage.setItem(INVESTED_FLOOR_KEY, String(Math.round(next * 100) / 100));
  } catch { /* localStorage unavailable */ }
}

/**
 * Record an external withdrawal (cash leaving the system to personal use).
 * Only call this when the investor explicitly pulls capital out.
 */
export function recordWithdrawal(amount: number): void {
  try {
    const next = Math.max(0, getInvestedFloor() - amount);
    localStorage.setItem(INVESTED_FLOOR_KEY, String(Math.round(next * 100) / 100));
  } catch { /* localStorage unavailable */ }
}

/**
 * Seed the floor once on first load (floor === 0).
 * After that, only recordDeposit / recordWithdrawal change it.
 */
export function seedInvestedFloorIfEmpty(investedRaw: number): void {
  try {
    if (getInvestedFloor() === 0 && investedRaw > 0) {
      localStorage.setItem(INVESTED_FLOOR_KEY, String(Math.round(investedRaw * 100) / 100));
    }
  } catch { /* localStorage unavailable */ }
}

/**
 * Returns the confirmed external capital baseline.
 * Trading profits/losses do NOT affect this — only deposits/withdrawals do.
 * Falls back to investedRaw only if the floor has never been seeded.
 */
export function applyInvestedFloor(investedRaw: number): number {
  const floor = getInvestedFloor();
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

function readAll(): DailySnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(snapshots: DailySnapshot[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
  } catch {
    // localStorage full — drop oldest
    const trimmed = snapshots.slice(-Math.floor(MAX_SNAPSHOTS / 2));
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)); } catch { /* ignore */ }
  }
}

export function maybeRecordSnapshot(params: {
  portfolioValue: number;
  invested: number;
  reserve: number;
  positionsCount: number;
}): void {
  if (!params.portfolioValue) return;
  if (!isMoscowPast7am()) return;

  const today = todayIso();
  const todayKey = dateKey(today);
  const existing = readAll();

  // Already have today's snapshot — skip
  if (existing.some(s => dateKey(s.date) === todayKey)) return;

  // Snapshot follows the accounting basis supplied by Google Sheets.
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

  const updated = [...existing, snapshot]
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .slice(-MAX_SNAPSHOTS);

  writeAll(updated);
}

export function getLocalSnapshots(): DailySnapshot[] {
  return readAll();
}

/** Merge API history with local snapshots, dedup by date (API wins for same day) */
export function mergeWithLocalSnapshots(
  apiHistory: PortfolioHistoryPoint[],
): PortfolioHistoryPoint[] {
  const local = readAll();
  if (!local.length) return apiHistory;

  const apiDates = new Set(apiHistory.map(p => dateKey(p.date)));

  // Only add local snapshots not already covered by API
  const localOnly = local.filter(s => !apiDates.has(dateKey(s.date)));

  return [...apiHistory, ...localOnly].sort(
    (a, b) => Date.parse(a.date) - Date.parse(b.date),
  );
}
