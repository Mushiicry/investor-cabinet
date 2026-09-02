import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isTradeReviewComplete,
  readTraderJournal,
  transactionJournalId,
  upsertTraderJournalEntry,
  type TraderJournalDraft,
} from "../../src/v2/lib/traderJournal";
import type { InvestorTransaction } from "../../src/types/portfolio";

const store: Record<string, string> = {};

vi.stubGlobal("window", {
  localStorage: {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
  },
});

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
});

const draft: TraderJournalDraft = {
  transactionId: "tx-bnb-sale",
  thesis: "Фиксация по заранее заданному уровню",
  expectedScenario: "Частичная продажа по лимитному ордеру",
  invalidation: "Ордер отменяется при изменении плана",
  executionReview: "Продажа исполнена по плану",
  emotion: "Спокойно",
  adherence: "yes",
  errorType: "none",
  lesson: "Лимитный ордер снимает необходимость реагировать вручную",
  nextRule: "Проверять активные ордера каждую неделю",
};

describe("дневник трейдера", () => {
  it("сохраняет и обновляет полный разбор сделки", () => {
    const first = upsertTraderJournalEntry([], draft, ":test");
    const updated = upsertTraderJournalEntry(first, { ...draft, errorType: "missing-limit" }, ":test");

    expect(updated).toHaveLength(1);
    expect(updated[0].errorType).toBe("missing-limit");
    expect(readTraderJournal(":test")).toHaveLength(1);
    expect(isTradeReviewComplete(updated[0])).toBe(true);
  });

  it("не считает неполный разбор завершённым", () => {
    const entries = upsertTraderJournalEntry([], { ...draft, lesson: "" }, ":test");
    expect(isTradeReviewComplete(entries[0])).toBe(false);
  });

  it("предпочитает уникальный API id общему audit hash", () => {
    const transaction = { hash: "BALANCE_DELTA", id: "tx-bnb-sale" } as InvestorTransaction;
    expect(transactionJournalId(transaction)).toBe("tx-bnb-sale");
  });

  it("сохраняет необязательную связь с торговым кейсом", () => {
    const entries = upsertTraderJournalEntry([], { ...draft, tradeCaseId: "trade-case-1" }, ":test");
    expect(entries[0].tradeCaseId).toBe("trade-case-1");
    expect(readTraderJournal(":test")[0].tradeCaseId).toBe("trade-case-1");
  });
});
