// Достигнутый уровень не сгорает: награда получена — уровень остаётся навсегда.
// Просадка здоровья забирает ОПЫТ внутри текущего уровня, но не сам уровень
// (решение владельца 2026-07-20).
//
// Хранение: localStorage, значение монотонно растёт. Понизить его нельзя даже
// случайно — пишем только Math.max, поэтому пустой/чужой аккаунт (нули → уровень 1)
// не может затереть достигнутое.

import { MAX_LADDER_LEVEL } from "./levelLadder";

const MAX_LEVEL_KEY = "investor-cabinet:max-level:v1";

/** Максимальный когда-либо достигнутый уровень (1..MAX_LADDER_LEVEL). */
export function readMaxLevel(): number {
  try {
    const raw = window.localStorage.getItem(MAX_LEVEL_KEY);
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(Math.floor(n), MAX_LADDER_LEVEL);
  } catch {
    return 1; // localStorage недоступен — деградируем к базовому уровню
  }
}

/**
 * Фиксирует достигнутый уровень. Возвращает актуальный максимум.
 * Запись только вверх: уровень невозможно отобрать.
 */
export function persistMaxLevel(level: number): number {
  const prev = readMaxLevel();
  const next = Math.max(prev, Math.min(Math.floor(level), MAX_LADDER_LEVEL));
  if (next > prev) {
    try {
      window.localStorage.setItem(MAX_LEVEL_KEY, String(next));
    } catch {
      // приватный режим / переполнение — уровень просто не переживёт перезагрузку
    }
  }
  return next;
}
