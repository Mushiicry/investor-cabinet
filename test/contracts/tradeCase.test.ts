import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TradeCandidate } from "../../src/v2/lib/tradeCandidate";
import {
  createManualTradeCase,
  ensureTradeCaseForCandidate,
  mergeTradeCaseStores,
  normalizeTradeCaseStore,
  readTradeCaseStore,
  tradeCaseStoreKey,
  tradeCaseStoresEqual,
  upsertTradeCaseStore,
  writeTradeCaseStore,
  EMPTY_TRADE_CASE_STORE,
} from "../../src/v2/lib/tradeCase";

const storage: Record<string, string> = {};

vi.stubGlobal("window", {
  localStorage: {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, value: string) => { storage[key] = value; },
  },
});

beforeEach(() => {
  Object.keys(storage).forEach((key) => delete storage[key]);
});

const candidate: TradeCandidate = {
  id: "limit:S1:buy",
  source: "limit_order",
  sourceId: "S1",
  action: "buy",
  asset: "ETH",
  category: "Крипта",
  amountUsd: 25,
  price: 1800,
  currentPrice: 1900,
  status: "ARMED",
  label: "ETH · покупка 25$",
};

describe("устойчивый торговый кейс", () => {
  it("не создаёт второй кейс для того же signalId", () => {
    const first = ensureTradeCaseForCandidate([], candidate);
    const second = ensureTradeCaseForCandidate([first], { ...candidate, currentPrice: 1850 });

    expect(second.tradeCaseId).toBe(first.tradeCaseId);
    expect(second.signalId).toBe("S1");
    expect(second.currentPrice).toBe(1850);
  });

  it("сохраняет активный кейс отдельно для аккаунта и восстанавливает его", () => {
    const tradeCase = createManualTradeCase("Плановый добор ETH");
    const store = upsertTradeCaseStore(EMPTY_TRADE_CASE_STORE, tradeCase);
    writeTradeCaseStore(store, ":main");

    expect(storage[tradeCaseStoreKey(":main")]).toBeTruthy();
    expect(readTradeCaseStore(":main")).toMatchObject({
      activeTradeCaseId: tradeCase.tradeCaseId,
      cases: [expect.objectContaining({ idea: "Плановый добор ETH", status: "IDEA" })],
    });
    expect(readTradeCaseStore(":wife").cases).toEqual([]);
  });

  it("безопасно читает старое или повреждённое хранилище", () => {
    expect(normalizeTradeCaseStore({ version: 1, activeTradeCaseId: "missing", cases: [] }))
      .toEqual(EMPTY_TRADE_CASE_STORE);
    storage[tradeCaseStoreKey(":main")] = "{bad json";
    expect(readTradeCaseStore(":main")).toEqual(EMPTY_TRADE_CASE_STORE);
  });

  it("при миграции объединяет локальные и облачные кейсы без дублей", () => {
    const older = {
      ...createManualTradeCase("Старая версия"),
      tradeCaseId: "trade-case-shared",
      createdAt: "2026-08-29T10:00:00.000Z",
      updatedAt: "2026-08-29T10:00:00.000Z",
    };
    const newer = {
      ...older,
      idea: "Новая версия",
      status: "WATCHING" as const,
      updatedAt: "2026-08-30T10:00:00.000Z",
    };
    const localOnly = {
      ...createManualTradeCase("Только локально"),
      tradeCaseId: "trade-case-local",
      createdAt: "2026-08-30T11:00:00.000Z",
      updatedAt: "2026-08-30T11:00:00.000Z",
    };

    const merged = mergeTradeCaseStores(
      { version: 1, activeTradeCaseId: older.tradeCaseId, cases: [older] },
      { version: 1, activeTradeCaseId: localOnly.tradeCaseId, cases: [newer, localOnly] },
    );

    expect(merged.activeTradeCaseId).toBe(localOnly.tradeCaseId);
    expect(merged.cases).toHaveLength(2);
    expect(merged.cases.find((item) => item.tradeCaseId === older.tradeCaseId)).toMatchObject({
      idea: "Новая версия",
      status: "WATCHING",
    });
    expect(tradeCaseStoresEqual(merged, normalizeTradeCaseStore(merged))).toBe(true);
  });
});
