import { beforeEach, describe, expect, it, vi } from "vitest";

// levelProgress тянет supabaseClient (env) — подменяем, тесты про хранилище.
vi.mock("../../src/lib/supabaseClient", () => ({ supabase: null }));

import { mergeServerMaxLevel, persistMaxLevel, readMaxLevel } from "../../src/v2/lib/levelProgress";

const store: Record<string, string> = {};
vi.stubGlobal("window", {
  localStorage: {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
  },
});

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
});

describe("прогресс уровня — монотонность", () => {
  it("без записи — базовый уровень 1", () => {
    expect(readMaxLevel()).toBe(1);
  });

  it("рост уровня сохраняется", () => {
    expect(persistMaxLevel(4)).toBe(4);
    expect(readMaxLevel()).toBe(4);
  });

  it("понизить уровень нельзя", () => {
    persistMaxLevel(4);
    expect(persistMaxLevel(2)).toBe(4);
    expect(readMaxLevel()).toBe(4);
  });

  it("серверный максимум вливается, если он выше", () => {
    persistMaxLevel(2);
    expect(mergeServerMaxLevel(5)).toBe(5);
    expect(readMaxLevel()).toBe(5);
  });

  it("серверный максимум НИЖЕ локального не затирает достигнутое", () => {
    persistMaxLevel(4);
    expect(mergeServerMaxLevel(1)).toBe(4);
    expect(readMaxLevel()).toBe(4);
  });

  it("мусор с сервера игнорируется", () => {
    persistMaxLevel(3);
    expect(mergeServerMaxLevel(undefined)).toBe(3);
    expect(mergeServerMaxLevel("abc")).toBe(3);
    expect(readMaxLevel()).toBe(3);
  });

  it("уровень не выходит за пределы лестницы", () => {
    expect(persistMaxLevel(99)).toBe(5);
  });
});
