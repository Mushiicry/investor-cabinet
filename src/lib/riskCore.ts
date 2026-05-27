import {
  RESERVE_HEALTH_BALANCED_SHARE,
  RESERVE_HEALTH_LOW_SHARE,
  RESERVE_HEALTH_STRONG_SHARE,
} from "../config/riskRules";

export function calculateReserveHealth(reserveShare: number): number {
  if (reserveShare >= RESERVE_HEALTH_STRONG_SHARE) return 0.88;
  if (reserveShare >= RESERVE_HEALTH_BALANCED_SHARE) return 0.74;
  if (reserveShare >= RESERVE_HEALTH_LOW_SHARE) return 0.59;

  return 0.41;
}

export function getRiskState(health: number): string {
  if (health >= 0.8) return "Контроль";
  if (health >= 0.6) return "Баланс";

  return "Риск";
}

export function getReserveSignal(reserveShare: number): string {
  if (reserveShare >= RESERVE_HEALTH_STRONG_SHARE) {
    return "Резерв высокий. Можно добирать ядро и держать спекулятивный лимит.";
  }

  if (reserveShare >= RESERVE_HEALTH_BALANCED_SHARE) {
    return "Резерв нормальный. Добор только ступенчато.";
  }

  return "Резерв низкий. Новые входы только выборочно.";
}

export function getReserveSummary(reserveShare: number): string {
  if (reserveShare >= RESERVE_HEALTH_STRONG_SHARE) {
    return "Портфель защитный. Есть манёвренность и запас по риску.";
  }

  if (reserveShare >= RESERVE_HEALTH_BALANCED_SHARE) {
    return "Портфель сбалансирован, но агрессию лучше не повышать.";
  }

  return "Портфель уже нагружен. Приоритет - защита и дисциплина.";
}
