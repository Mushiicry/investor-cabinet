import type { InterestSignal } from "../../types/portfolio";

export type SignalFreshness = "свежий" | "устарел" | "нет_проверки";
export type SignalPriority = "сломано" | "сработал" | "близко" | "устарел" | "наблюдать" | "далеко";
export type SignalNotificationStatus = "разрешено" | "лимит" | "повтор_рано" | "пауза" | "не_требуется";

/**
 * Расстояние от текущей цены до срабатывания сигнала.
 * pct/abs знаковые: минус — нужно падение цены, плюс — нужен рост.
 * Знак честнее стрелки «вниз/вверх» в данных, стрелку рисует уже UI.
 */
export type SignalDistance = {
  pct: number;
  abs: number;
};

export type SignalAssessment = {
  status: string;
  distance: SignalDistance | null;
  freshness: SignalFreshness;
  ageMinutes: number | null;
  priority: SignalPriority;
  priorityRank: number;
  needsGate: boolean;
  text: string;
};

export type SignalNotificationDecision = {
  status: SignalNotificationStatus;
  canNotify: boolean;
  dailyLimit: number;
  remainingToday: number;
  repeatAfterHours: number;
  nextAt: string | null;
  text: string;
};

export type SignalNotificationPolicyOptions = {
  dailyLimit?: number;
  repeatAfterHours?: number;
  sentTodayCount?: number;
  disciplineCooldownActive?: boolean;
};

export type SignalNotificationPlanItem = {
  signal: InterestSignal;
  assessment: SignalAssessment;
  notification: SignalNotificationDecision;
};

export type SignalNotificationPlan = {
  dailyLimit: number;
  sentTodayCount: number;
  remainingToday: number;
  items: SignalNotificationPlanItem[];
};

/** Статусы, при которых сигнал снят с дежурства и требует внимания инвестора. */
const ATTENTION_STATUSES = new Set(["CHECK", "ERROR"]);
const DONE_STATUSES = new Set(["TRIGGERED"]);

const normalizeStatus = (status: string) => status.trim().toUpperCase();
const NEAR_TRIGGER_PCT = 3;
const WATCH_TRIGGER_PCT = 10;
const STALE_MINUTES = 15;
export const SIGNAL_DAILY_NOTIFICATION_LIMIT = 3;
export const SIGNAL_REPEAT_AFTER_HOURS = 6;
const HOUR_MS = 60 * 60 * 1000;
const MSK_OFFSET_MS = 3 * HOUR_MS;
const PRIORITY_RANK: Record<SignalPriority, number> = {
  "сломано": 0,
  "сработал": 1,
  "близко": 2,
  "устарел": 3,
  "наблюдать": 4,
  "далеко": 5,
};

function parseSignalTime(value: string): number {
  const raw = String(value || "").trim();
  if (!raw) return 0;

  const msk = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?\s*MSK$/i);
  if (msk) {
    const [, year, month, day, hour, minute, second = "0"] = msk;
    return Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - 3,
      Number(minute),
      Number(second),
    );
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mskDayKey(time: number) {
  return new Date(time + MSK_OFFSET_MS).toISOString().slice(0, 10);
}

export function getSignalDistance(signal: InterestSignal): SignalDistance | null {
  const { currentPrice, triggerPrice } = signal;
  if (!Number.isFinite(currentPrice) || !Number.isFinite(triggerPrice)) return null;
  if (currentPrice <= 0 || triggerPrice <= 0) return null;

  return {
    abs: triggerPrice - currentPrice,
    pct: ((triggerPrice - currentPrice) / currentPrice) * 100,
  };
}

function signalAgeMinutes(signal: InterestSignal, now: Date): number | null {
  const time = parseSignalTime(signal.lastCheck);
  if (!Number.isFinite(time) || time <= 0) return null;
  const age = (now.getTime() - time) / 60000;
  return age >= 0 ? age : 0;
}

function signalFreshness(signal: InterestSignal, now: Date): { freshness: SignalFreshness; ageMinutes: number | null } {
  const ageMinutes = signalAgeMinutes(signal, now);
  if (ageMinutes === null) return { freshness: "нет_проверки", ageMinutes };
  return { freshness: ageMinutes > STALE_MINUTES ? "устарел" : "свежий", ageMinutes };
}

export function assessSignal(signal: InterestSignal, now: Date = new Date()): SignalAssessment {
  const status = normalizeStatus(signal.status);
  const distance = getSignalDistance(signal);
  const { freshness, ageMinutes } = signalFreshness(signal, now);
  let priority: SignalPriority = "далеко";
  let text = "Точка далеко — только наблюдение.";
  let needsGate = false;

  if (ATTENTION_STATUSES.has(status)) {
    priority = "сломано";
    text = "Сигнал снят с дежурства — проверьте строку в таблице.";
  } else if (DONE_STATUSES.has(status)) {
    priority = "сработал";
    text = "Цена коснулась уровня — это повод открыть проверку риска, а не разрешение на сделку.";
    needsGate = true;
  } else if (freshness !== "свежий") {
    priority = "устарел";
    text = "Цена давно не обновлялась — решение по этому уровню нельзя принимать вслепую.";
  } else if (distance && Math.abs(distance.pct) <= NEAR_TRIGGER_PCT) {
    priority = "близко";
    text = "Цена рядом с уровнем — перед действием открыть проверку риска.";
    needsGate = true;
  } else if (distance && Math.abs(distance.pct) <= WATCH_TRIGGER_PCT) {
    priority = "наблюдать";
    text = "Уровень приближается — готовить сценарий, сделку не исполнять автоматически.";
  }

  return {
    status,
    distance,
    freshness,
    ageMinutes,
    priority,
    priorityRank: PRIORITY_RANK[priority],
    needsGate,
    text,
  };
}

/**
 * Порядок списка = порядок внимания инвестора:
 * 1. сигналы, снятые с дежурства (CHECK/ERROR) — сломаны, их надо чинить;
 * 2. ждущие — по близости к срабатыванию;
 * 3. без цены — считать расстояние не из чего;
 * 4. уже сработавшие — история, ниже всех.
 * Порядок строк в таблице для приоритизации бесполезен.
 */
const groupOf = (signal: InterestSignal, distance: SignalDistance | null) => {
  const status = normalizeStatus(signal.status);
  if (ATTENTION_STATUSES.has(status)) return 0;
  if (DONE_STATUSES.has(status)) return 3;
  if (!distance) return 2;
  return 1;
};

export function sortByProximity(signals: InterestSignal[]): InterestSignal[] {
  return signals
    .map((signal) => ({ signal, distance: getSignalDistance(signal) }))
    .sort((a, b) => {
      const groupDiff = groupOf(a.signal, a.distance) - groupOf(b.signal, b.distance);
      if (groupDiff !== 0) return groupDiff;

      if (!a.distance || !b.distance) return 0;
      return Math.abs(a.distance.pct) - Math.abs(b.distance.pct);
    })
    .map((item) => item.signal);
}

export function sortBySignalPriority(signals: InterestSignal[], now: Date = new Date()): InterestSignal[] {
  return [...signals].sort((a, b) => {
    const aa = assessSignal(a, now);
    const bb = assessSignal(b, now);
    if (aa.priorityRank !== bb.priorityRank) return aa.priorityRank - bb.priorityRank;
    if (!aa.distance || !bb.distance) return 0;
    return Math.abs(aa.distance.pct) - Math.abs(bb.distance.pct);
  });
}

export function countSignalNotificationsToday(signals: InterestSignal[], now: Date = new Date()): number {
  const today = mskDayKey(now.getTime());

  return signals.filter((signal) => {
    if (normalizeStatus(signal.telegram) !== "SENT") return false;
    const time = parseSignalTime(signal.triggeredAt);
    return time > 0 && mskDayKey(time) === today;
  }).length;
}

export function assessSignalNotification(
  signal: InterestSignal,
  now: Date = new Date(),
  options: SignalNotificationPolicyOptions = {},
): SignalNotificationDecision {
  const assessment = assessSignal(signal, now);
  const dailyLimit = options.dailyLimit ?? SIGNAL_DAILY_NOTIFICATION_LIMIT;
  const repeatAfterHours = options.repeatAfterHours ?? SIGNAL_REPEAT_AFTER_HOURS;
  const sentTodayCount = options.sentTodayCount ?? 0;
  const remainingToday = Math.max(0, dailyLimit - sentTodayCount);
  const telegramSent = normalizeStatus(signal.telegram) === "SENT";
  const notifiedAt = parseSignalTime(signal.triggeredAt);

  if (!assessment.needsGate) {
    return {
      status: "не_требуется",
      canNotify: false,
      dailyLimit,
      remainingToday,
      repeatAfterHours,
      nextAt: null,
      text: "Напоминание не требуется: сигнал не должен вести к действию.",
    };
  }

  if (options.disciplineCooldownActive) {
    return {
      status: "пауза",
      canNotify: false,
      dailyLimit,
      remainingToday,
      repeatAfterHours,
      nextAt: null,
      text: "Дисциплинарная пауза активна — сигнал нельзя превращать в действие.",
    };
  }

  if (remainingToday <= 0) {
    return {
      status: "лимит",
      canNotify: false,
      dailyLimit,
      remainingToday,
      repeatAfterHours,
      nextAt: null,
      text: `Дневной лимит напоминаний исчерпан: ${dailyLimit} из ${dailyLimit}.`,
    };
  }

  if (telegramSent && notifiedAt <= 0) {
    return {
      status: "повтор_рано",
      canNotify: false,
      dailyLimit,
      remainingToday,
      repeatAfterHours,
      nextAt: null,
      text: "Сигнал уже отправлен, но время отправки не читается — повтор заблокирован.",
    };
  }

  if (telegramSent && notifiedAt > 0) {
    const nextTime = notifiedAt + repeatAfterHours * HOUR_MS;
    if (now.getTime() < nextTime) {
      return {
        status: "повтор_рано",
        canNotify: false,
        dailyLimit,
        remainingToday,
        repeatAfterHours,
        nextAt: new Date(nextTime).toISOString(),
        text: `Повтор не раньше чем через ${repeatAfterHours} ч после прошлого напоминания.`,
      };
    }
  }

  return {
    status: "разрешено",
    canNotify: true,
    dailyLimit,
    remainingToday,
    repeatAfterHours,
    nextAt: null,
    text: "Напоминание разрешено, но сделка всё равно проходит проверку риска.",
  };
}

export function buildSignalNotificationPlan(
  signals: InterestSignal[],
  now: Date = new Date(),
  options: SignalNotificationPolicyOptions = {},
): SignalNotificationPlan {
  const dailyLimit = options.dailyLimit ?? SIGNAL_DAILY_NOTIFICATION_LIMIT;
  const sentTodayCount = options.sentTodayCount ?? countSignalNotificationsToday(signals, now);
  let usedToday = sentTodayCount;

  const items = sortBySignalPriority(signals, now).map((signal) => {
    const assessment = assessSignal(signal, now);
    const notification = assessSignalNotification(signal, now, {
      ...options,
      dailyLimit,
      sentTodayCount: usedToday,
    });
    if (notification.canNotify) usedToday += 1;
    return { signal, assessment, notification };
  });

  return {
    dailyLimit,
    sentTodayCount,
    remainingToday: Math.max(0, dailyLimit - usedToday),
    items,
  };
}

/** Актив со своими точками входа/выхода — одна кнопка в сетке монет. */
export type AssetSignalGroup = {
  asset: string;
  signals: InterestSignal[];
  /** Ближайшая к срабатыванию точка актива — по ней сортируются монеты. */
  nearest: SignalDistance | null;
  /** Есть строки, снятые с дежурства (CHECK/ERROR) — актив требует внимания. */
  needsAttention: boolean;
  /** Сколько точек ещё ждут срабатывания. */
  waitingCount: number;
};

/**
 * Группировка по активу: 23 строки списком читаются тяжело, а по монетам
 * это 10 кнопок. Порядок монет — по близости их ближайшей точки, чтобы
 * первым в сетке стоял актив, за которым надо следить сегодня.
 */
export function groupByAsset(signals: InterestSignal[]): AssetSignalGroup[] {
  const groups = new Map<string, InterestSignal[]>();

  signals.forEach((signal) => {
    const asset = signal.asset.trim() || "—";
    const bucket = groups.get(asset);
    if (bucket) bucket.push(signal);
    else groups.set(asset, [signal]);
  });

  return [...groups.entries()]
    .map(([asset, assetSignals]) => {
      const ordered = sortByProximity(assetSignals);
      const waiting = ordered.filter(
        (signal) => !DONE_STATUSES.has(normalizeStatus(signal.status))
      );
      const nearest = waiting
        .map(getSignalDistance)
        .filter((distance): distance is SignalDistance => distance !== null)
        .reduce<SignalDistance | null>(
          (best, distance) =>
            !best || Math.abs(distance.pct) < Math.abs(best.pct) ? distance : best,
          null
        );

      return {
        asset,
        signals: ordered,
        nearest,
        needsAttention: ordered.some((signal) =>
          ATTENTION_STATUSES.has(normalizeStatus(signal.status))
        ),
        waitingCount: waiting.length,
      };
    })
    .sort((a, b) => {
      if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
      if (!a.nearest || !b.nearest) return a.nearest ? -1 : b.nearest ? 1 : 0;
      return Math.abs(a.nearest.pct) - Math.abs(b.nearest.pct);
    });
}
