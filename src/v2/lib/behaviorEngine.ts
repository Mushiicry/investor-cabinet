import type { DecisionJournalEntry } from "./decisionJournal";

export type BehaviorSignalKind =
  | "страх_упустить"
  | "после_убытка"
  | "переторговка"
  | "повторная_блокировка"
  | "журнал";

export type BehaviorSignal = {
  kind: BehaviorSignalKind;
  severity: "warn" | "block";
  text: string;
};

export type BehaviorEngineResult = {
  score: number;
  status: "НОРМА" | "НАБЛЮДЕНИЕ" | "ПАУЗА";
  blockers: string[];
  warnings: string[];
  signals: BehaviorSignal[];
  cooldownUntil: string | null;
  healthInputs: {
    disciplineJournalCoverage: number;
    disciplineViolations30d: number;
    fomoEvents30d: number;
    overtradingDays30d: number;
    disciplineCooldownActive: boolean;
  };
  stats: {
    journalCount: number;
    decisions24h: number;
    blocked24h: number;
    fomo24h: number;
    afterLoss24h: number;
    decisions30d: number;
    blocked30d: number;
    fomo30d: number;
    afterLoss30d: number;
    overtradingDays30d: number;
    journalCoverage: number;
  };
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const JOURNAL_TARGET_ENTRIES_30D = 5;

function timeOf(entry: DecisionJournalEntry) {
  const time = Date.parse(entry.createdAt);
  return Number.isFinite(time) ? time : 0;
}

function isWithin(entry: DecisionJournalEntry, nowMs: number, windowMs: number) {
  const time = timeOf(entry);
  return time > 0 && nowMs - time >= 0 && nowMs - time <= windowMs;
}

function isFomo(entry: DecisionJournalEntry) {
  return entry.emotion === "Страх упустить рост";
}

function isAfterLoss(entry: DecisionJournalEntry) {
  return entry.emotion === "После убытка";
}

function dayKey(entry: DecisionJournalEntry) {
  const time = timeOf(entry);
  return time > 0 ? new Date(time).toISOString().slice(0, 10) : "";
}

function countOvertradingDays(entries: DecisionJournalEntry[]) {
  const byDay = new Map<string, number>();
  for (const entry of entries) {
    const key = dayKey(entry);
    if (!key) continue;
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  return [...byDay.values()].filter((count) => count >= 3).length;
}

function latestTime(entries: DecisionJournalEntry[]) {
  return entries.reduce((max, entry) => Math.max(max, timeOf(entry)), 0);
}

export function evaluateBehavior(
  journal: DecisionJournalEntry[],
  now: Date = new Date(),
): BehaviorEngineResult {
  const nowMs = now.getTime();
  const recent24h = journal.filter((entry) => isWithin(entry, nowMs, DAY_MS));
  const recent30d = journal.filter((entry) => isWithin(entry, nowMs, 30 * DAY_MS));

  const blocked24h = recent24h.filter((entry) => entry.status === "БЛОКИРОВКА").length;
  const fomo24h = recent24h.filter(isFomo).length;
  const afterLoss24h = recent24h.filter(isAfterLoss).length;
  const blocked30d = recent30d.filter((entry) => entry.status === "БЛОКИРОВКА").length;
  const fomo30d = recent30d.filter(isFomo).length;
  const afterLoss30d = recent30d.filter(isAfterLoss).length;
  const overtradingDays30d = countOvertradingDays(recent30d);

  const signals: BehaviorSignal[] = [];

  if (blocked24h > 0) {
    signals.push({
      kind: "повторная_блокировка",
      severity: blocked24h >= 2 ? "block" : "warn",
      text:
        blocked24h >= 2
          ? "Пауза: повторяются попытки пройти заблокированную сделку."
          : "Есть сохранённая блокировка за сутки — не исполнять без пересмотра.",
    });
  }

  if (fomo24h > 0) {
    signals.push({
      kind: "страх_упустить",
      severity: fomo24h >= 2 ? "block" : "warn",
      text:
        fomo24h >= 2
          ? "Пауза: повторяется страх упустить рост."
          : "Есть решение из страха упустить рост — нужна ручная проверка.",
    });
  }

  if (afterLoss24h > 0) {
    signals.push({
      kind: "после_убытка",
      severity: afterLoss24h >= 1 && (recent24h.length >= 2 || blocked24h > 0) ? "block" : "warn",
      text:
        afterLoss24h >= 1 && (recent24h.length >= 2 || blocked24h > 0)
          ? "Пауза: решение после убытка требует остановки."
          : "Есть решение после убытка — не усиливать риск автоматически.",
    });
  }

  if (recent24h.length >= 3) {
    signals.push({
      kind: "переторговка",
      severity: "block",
      text: "Пауза: слишком много решений за сутки.",
    });
  } else if (recent24h.length >= 2) {
    signals.push({
      kind: "переторговка",
      severity: "warn",
      text: "Высокая частота решений за сутки — проверь, нет ли спешки.",
    });
  }

  const blockers = signals.filter((signal) => signal.severity === "block").map((signal) => signal.text);
  const warnings = signals.filter((signal) => signal.severity === "warn").map((signal) => signal.text);
  const journalCoverage = Math.min(1, recent30d.length / JOURNAL_TARGET_ENTRIES_30D);
  const disciplineViolations30d = fomo30d + afterLoss30d + overtradingDays30d + Math.max(0, blocked30d - 1);
  const score = Math.max(
    0,
    100 -
      warnings.length * 8 -
      blockers.length * 25 -
      fomo30d * 5 -
      afterLoss30d * 7 -
      overtradingDays30d * 10,
  );
  const status = blockers.length ? "ПАУЗА" : warnings.length ? "НАБЛЮДЕНИЕ" : "НОРМА";
  const latest = latestTime(recent24h);

  return {
    score,
    status,
    blockers,
    warnings,
    signals,
    cooldownUntil: blockers.length && latest ? new Date(latest + DAY_MS).toISOString() : null,
    healthInputs: {
      disciplineJournalCoverage: journalCoverage,
      disciplineViolations30d,
      fomoEvents30d: fomo30d,
      overtradingDays30d,
      disciplineCooldownActive: blockers.length > 0,
    },
    stats: {
      journalCount: journal.length,
      decisions24h: recent24h.length,
      blocked24h,
      fomo24h,
      afterLoss24h,
      decisions30d: recent30d.length,
      blocked30d,
      fomo30d,
      afterLoss30d,
      overtradingDays30d,
      journalCoverage,
    },
  };
}
