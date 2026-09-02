import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendDecisionJournalEntry,
  readDecisionJournal,
  removeDecisionJournalEntry,
  type DecisionJournalDraft,
} from "../../src/v2/lib/decisionJournal";
import type { DecisionResult } from "../../src/v2/lib/decisionEngine";

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

const decision: DecisionResult = {
  status: "РАЗРЕШЕНО",
  reasons: [],
  warnings: [{ kind: "выживаемость", severity: "warn", text: "Просадка выше нормы" }],
  maxSafeAmount: 10,
  maxAllowedAmount: 20,
  recommendedAction: "Сделка проходит проверку риска",
  gate: {
    status: "ok",
    checks: [],
    reasons: [],
    warnings: [],
    maxSafeAmount: 10,
    maxAllowedAmount: 20,
    fearGreed: null,
  },
  tradePreview: {
    asset: "ETH",
    amountUsd: 25,
    buyPrice: 1516,
    currentCostBasis: 25,
    currentQuantity: 0.014,
    addedQuantity: 0.016,
    averageEntryBefore: 1776,
    averageEntryAfter: 1638,
  },
  healthPreview: {
    before: { healthFactor: 80, status: "CONTROL", riskLevel: "Норма", components: [] },
    after: { healthFactor: 78, status: "CONTROL", riskLevel: "Норма", components: [] },
    delta: -2,
    changedComponents: [],
    applicable: true,
  },
  survivalAfter: {
    score: 80,
    status: "ВЫЖИВАЕТ",
    survivalWorstScenario: "Общий рыночный шок",
    survivalShockLossPct: 0.32,
    survivalLossUsd: 320,
    survivalPortfolioAfterShockShare: 0.68,
    survivalPortfolioAfterShockUsd: 680,
    survivalReserveAfterShockShare: 0.3,
    survivalBuyPowerAfterShockUsd: 120,
    survivalBuyPowerAfterShockShare: 0.12,
    survivalLossScore: 80,
    survivalBuyPowerScore: 75,
    survivalPlanScore: 100,
    survivalScenarios: [],
    survivalBlockers: [],
    survivalWarnings: [],
    survivalFormula: [],
  },
};

const draft: DecisionJournalDraft = {
  asset: "ETH",
  category: "Крипта",
  amountUsd: 25,
  buyPrice: 1516,
  decision,
  setup: "ДСА добор",
  emotion: "Спокойно",
  note: "Плановая проверка",
  invalidation: "Сценарий отменяется при сломе поддержки",
  exitPlan: "Тейки по плану, остаток определяется заранее",
  orderPlan: "Лимитный ордер $25 по 1516",
  priceAndAmountChecked: true,
  alertIsNotOrderConfirmed: true,
  planNotFomoConfirmed: true,
};

describe("журнал решений", () => {
  it("сохраняет снимок решения в локальный журнал", () => {
    const entries = appendDecisionJournalEntry([], draft, ":test");

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        asset: "ETH",
        category: "Крипта",
        action: "buy",
        amountUsd: 25,
        buyPrice: 1516,
        status: "РАЗРЕШЕНО",
        setup: "ДСА добор",
        emotion: "Спокойно",
        invalidation: "Сценарий отменяется при сломе поддержки",
        exitPlan: "Тейки по плану, остаток определяется заранее",
        orderPlan: "Лимитный ордер $25 по 1516",
        priceAndAmountChecked: true,
        alertIsNotOrderConfirmed: true,
        planNotFomoConfirmed: true,
        healthBefore: 80,
        healthAfter: 78,
        healthDelta: -2,
        averageEntryBefore: 1776,
        averageEntryAfter: 1638,
      }),
    );
    expect(readDecisionJournal(":test")).toHaveLength(1);
  });

  it("сохраняет направление сделки в журнале решений", () => {
    const entries = appendDecisionJournalEntry([], { ...draft, action: "sell" }, ":test");

    expect(entries[0].action).toBe("sell");
    expect(readDecisionJournal(":test")[0].action).toBe("sell");
  });

  it("сохраняет tradeCaseId и читает старые записи без него", () => {
    const entries = appendDecisionJournalEntry([], { ...draft, tradeCaseId: "trade-case-1" }, ":test");
    expect(entries[0].tradeCaseId).toBe("trade-case-1");

    const legacy = { ...entries[0] } as Record<string, unknown>;
    delete legacy.tradeCaseId;
    store["mushii-decision-journal-v1:test"] = JSON.stringify([legacy]);
    expect(readDecisionJournal(":test")[0].tradeCaseId).toBeNull();
  });

  it("не ломается на испорченном хранилище", () => {
    store["mushii-decision-journal-v1:test"] = "{bad json";

    expect(readDecisionJournal(":test")).toEqual([]);
  });

  it("удаляет ошибочно сохранённое решение", () => {
    const entries = appendDecisionJournalEntry([], draft, ":test");
    const next = removeDecisionJournalEntry(entries, entries[0].id, ":test");

    expect(next).toEqual([]);
    expect(readDecisionJournal(":test")).toEqual([]);
  });
});
