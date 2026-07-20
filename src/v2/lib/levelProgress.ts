// Достигнутый уровень не сгорает: награда получена — уровень остаётся навсегда.
// Просадка здоровья забирает ОПЫТ внутри текущего уровня, но не сам уровень
// (решение владельца 2026-07-20).
//
// Источник истины — лист «Прогресс» в Google-таблице (общий для всех
// устройств); localStorage — офлайн-кэш. Оба хранилища монотонны: пишем
// только Math.max, поэтому пустой/чужой аккаунт (нули → уровень 1) не может
// затереть достигнутое ни локально, ни на сервере.

import { INVESTOR_API_URL } from "../../config/constants";
import { supabase } from "../../lib/supabaseClient";
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
 * Фиксирует достигнутый уровень локально. Возвращает актуальный максимум.
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

/**
 * Отправляет достигнутый уровень в таблицу (лист «Прогресс») через
 * Vercel-прокси. Fire-and-forget: офлайн/гость/чужой аккаунт — тихо
 * пропускаем, сервер и так монотонный, повторная отправка безвредна.
 */
export async function pushMaxLevelToServer(level: number): Promise<void> {
  try {
    const session = supabase ? (await supabase.auth.getSession()).data.session : null;
    const token = session?.access_token;
    if (!token) return; // гость — некому писать

    await fetch(`${INVESTOR_API_URL}?action=setMaxLevel&level=${Math.floor(level)}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    // сеть упала — уровень уедет при следующем повышении или заходе
  }
}

/**
 * Вливает серверный максимум (из основного API-ответа) в локальный кэш.
 * Вызывается при каждой загрузке данных — так новое устройство сразу
 * получает достигнутый уровень.
 */
export function mergeServerMaxLevel(serverLevel: unknown): number {
  const n = Number(serverLevel);
  if (!Number.isFinite(n) || n < 1) return readMaxLevel();
  return persistMaxLevel(n);
}
