import type { InterestSignal } from "../../types/portfolio";

/**
 * Расстояние от текущей цены до срабатывания сигнала.
 * pct/abs знаковые: минус — нужно падение цены, плюс — нужен рост.
 * Знак честнее стрелки «вниз/вверх» в данных, стрелку рисует уже UI.
 */
export type SignalDistance = {
  pct: number;
  abs: number;
};

/** Статусы, при которых сигнал снят с дежурства и требует внимания инвестора. */
const ATTENTION_STATUSES = new Set(["CHECK", "ERROR"]);
const DONE_STATUSES = new Set(["TRIGGERED"]);

const normalizeStatus = (status: string) => status.trim().toUpperCase();

export function getSignalDistance(signal: InterestSignal): SignalDistance | null {
  const { currentPrice, triggerPrice } = signal;
  if (!Number.isFinite(currentPrice) || !Number.isFinite(triggerPrice)) return null;
  if (currentPrice <= 0 || triggerPrice <= 0) return null;

  return {
    abs: triggerPrice - currentPrice,
    pct: ((triggerPrice - currentPrice) / currentPrice) * 100,
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
