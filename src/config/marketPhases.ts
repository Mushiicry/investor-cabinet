// Фазовый календарь фонда — единый источник истины по фазам рынка.
// Даты и параметры из инвестиционного манифеста (разделы «Резерв фонда»,
// «Динамическая модель риска», «Максимальная доля крипты»).
//
// От фазы зависят: минимальный резерв (пол дисциплины), цель резерва и
// максимальная доля крипты. Абсолютный пол резерва (10%, «святое») задан
// отдельно в riskRules (RESERVE_FLOOR_SHARE) и ниже него не опускаемся НИКОГДА,
// независимо от фазы.

export type MarketPhaseKey =
  | "gradual" // постепенное накопление
  | "aggressive" // агрессивное накопление (потенциальный экстремальный страх)
  | "return" // возврат к накоплению
  | "growth" // рост и сопровождение тренда
  | "distribution"; // распределение риска (эйфория)

export type MarketPhase = {
  key: MarketPhaseKey;
  label: string;
  start: Date;
  end: Date;
  /** Минимальный резерв фазы (пол дисциплины), доля 0..1. */
  reserveFloorShare: number;
  /** Целевой резерв фазы, доля 0..1. */
  reserveTargetShare: number;
  /** Максимальная доля крипты в фазе, доля 0..1. */
  cryptoMaxShare: number;
  note: string;
};

// Порядок — по датам; последняя фаза покрывает «после цикла».
const PHASES: MarketPhase[] = [
  {
    key: "gradual",
    label: "Постепенное накопление",
    start: new Date("2026-05-28T00:00:00"),
    end: new Date("2026-10-09T00:00:00"),
    reserveFloorShare: 0.3,
    reserveTargetShare: 0.3,
    cryptoMaxShare: 0.6,
    note: "Системное накопление частями, резерв не ниже 30%, без агрессии.",
  },
  {
    key: "aggressive",
    label: "Агрессивное накопление",
    start: new Date("2026-10-09T00:00:00"),
    end: new Date("2027-01-01T00:00:00"),
    reserveFloorShare: 0.1,
    reserveTargetShare: 0.2,
    cryptoMaxShare: 0.8,
    note: "Потенциальный экстремальный страх — резерв допустимо до 10%, крипта до 80%.",
  },
  {
    key: "return",
    label: "Возврат к накоплению",
    start: new Date("2027-01-01T00:00:00"),
    end: new Date("2028-04-17T00:00:00"),
    reserveFloorShare: 0.3,
    reserveTargetShare: 0.3,
    cryptoMaxShare: 0.6,
    note: "Восстановление гибкости, резерв снова не ниже 30%.",
  },
  {
    key: "growth",
    label: "Рост и удержание",
    start: new Date("2028-04-17T00:00:00"),
    end: new Date("2029-09-03T00:00:00"),
    reserveFloorShare: 0.3,
    reserveTargetShare: 0.3,
    cryptoMaxShare: 0.6,
    note: "Сопровождение тренда, удержание позиций, резерв постепенно растёт.",
  },
  {
    key: "distribution",
    label: "Распределение риска",
    start: new Date("2029-09-03T00:00:00"),
    end: new Date("2029-11-15T00:00:00"),
    reserveFloorShare: 0.3,
    reserveTargetShare: 0.8,
    cryptoMaxShare: 0.4,
    note: "Потенциальная эйфория — фиксация прибыли, резерв к 80%, крипта до 20–40%.",
  },
];

// Дефолт вне окон календаря — консервативная фаза накопления (резерв 30%).
const DEFAULT_PHASE: MarketPhase = PHASES[0];

/** Активная фаза рынка на дату (по умолчанию — сейчас). */
export function getMarketPhase(now: Date = new Date()): MarketPhase {
  const t = now.getTime();
  const found = PHASES.find((p) => t >= p.start.getTime() && t < p.end.getTime());
  if (found) return found;
  // До первой фазы или после последней — консервативный дефолт.
  return { ...DEFAULT_PHASE, note: `${DEFAULT_PHASE.note} (вне календаря — дефолт)` };
}

export { PHASES as MARKET_PHASES };
