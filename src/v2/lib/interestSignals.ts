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
