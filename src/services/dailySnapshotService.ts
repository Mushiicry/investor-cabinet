import type { PortfolioHistoryPoint } from "../types/portfolio";

const STORAGE_KEY = "mushii-daily-snapshots-v1";
const MAX_SNAPSHOTS = 365;

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

  const pnl = params.portfolioValue - params.invested;
  const pnlPct = params.invested > 0 ? pnl / params.invested : 0;

  const snapshot: DailySnapshot = {
    date: today,
    portfolioValue: Math.round(params.portfolioValue * 100) / 100,
    invested: Math.round(params.invested * 100) / 100,
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
