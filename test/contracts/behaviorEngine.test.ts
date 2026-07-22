import { describe, expect, it } from "vitest";
import { evaluateBehavior } from "../../src/v2/lib/behaviorEngine";
import type { DecisionJournalEntry } from "../../src/v2/lib/decisionJournal";

const now = new Date("2026-07-22T12:00:00.000Z");

function entry(partial: Partial<DecisionJournalEntry> = {}): DecisionJournalEntry {
  return {
    id: partial.id ?? `id-${Math.random()}`,
    createdAt: partial.createdAt ?? "2026-07-22T10:00:00.000Z",
    asset: partial.asset ?? "ETH",
    category: partial.category ?? "Крипта",
    amountUsd: partial.amountUsd ?? 10,
    buyPrice: partial.buyPrice ?? 100,
    status: partial.status ?? "РАЗРЕШЕНО",
    recommendedAction: partial.recommendedAction ?? "Сделка проходит проверку риска",
    reasons: partial.reasons ?? [],
    warnings: partial.warnings ?? [],
    setup: partial.setup ?? "Плановый добор",
    emotion: partial.emotion ?? "Спокойно",
    note: partial.note ?? "",
    healthBefore: partial.healthBefore ?? 80,
    healthAfter: partial.healthAfter ?? 80,
    healthDelta: partial.healthDelta ?? 0,
    healthApplicable: partial.healthApplicable ?? true,
    survivalStatus: partial.survivalStatus ?? "ВЫЖИВАЕТ",
    survivalWorstScenario: partial.survivalWorstScenario ?? "Общий рыночный шок",
    survivalShockLossPct: partial.survivalShockLossPct ?? 0.3,
    averageEntryBefore: partial.averageEntryBefore ?? null,
    averageEntryAfter: partial.averageEntryAfter ?? null,
  };
}

describe("поведенческий движок", () => {
  it("пустой журнал не блокирует проверку", () => {
    const behavior = evaluateBehavior([], now);

    expect(behavior.status).toBe("НОРМА");
    expect(behavior.blockers).toEqual([]);
    expect(behavior.warnings).toEqual([]);
    expect(behavior.healthInputs.disciplineJournalCoverage).toBe(0);
    expect(behavior.healthInputs.disciplineCooldownActive).toBe(false);
  });

  it("одна сохранённая блокировка — предупреждение, а не наказание за дисциплину", () => {
    const behavior = evaluateBehavior([entry({ status: "БЛОКИРОВКА" })], now);

    expect(behavior.status).toBe("НАБЛЮДЕНИЕ");
    expect(behavior.blockers).toEqual([]);
    expect(behavior.warnings).toEqual([
      "Есть сохранённая блокировка за сутки — не исполнять без пересмотра.",
    ]);
  });

  it("повторный страх упустить рост включает дисциплинарную паузу", () => {
    const behavior = evaluateBehavior([
      entry({ id: "one", emotion: "Страх упустить рост" }),
      entry({ id: "two", emotion: "Страх упустить рост", createdAt: "2026-07-22T11:00:00.000Z" }),
    ], now);

    expect(behavior.status).toBe("ПАУЗА");
    expect(behavior.blockers).toContain("Пауза: повторяется страх упустить рост.");
    expect(behavior.healthInputs.fomoEvents30d).toBe(2);
    expect(behavior.healthInputs.disciplineCooldownActive).toBe(true);
  });

  it("один страх упустить рост в эйфории рынка сразу включает паузу", () => {
    const behavior = evaluateBehavior(
      [entry({ emotion: "Страх упустить рост" })],
      now,
      { riskMode: "защита_капитала", emotion: "Эйфория" },
    );

    expect(behavior.status).toBe("ПАУЗА");
    expect(behavior.blockers).toContain("Пауза: страх упустить рост в зоне эйфории рынка.");
    expect(behavior.healthInputs.disciplineCooldownActive).toBe(true);
  });

  it("жадность рынка без FOMO не наказывает дисциплину", () => {
    const behavior = evaluateBehavior(
      [entry({ emotion: "Спокойно" })],
      now,
      { riskMode: "снижать_риск", emotion: "Жадность" },
    );

    expect(behavior.status).toBe("НОРМА");
    expect(behavior.blockers).toEqual([]);
  });

  it("три решения за сутки считаются переторговкой", () => {
    const behavior = evaluateBehavior([
      entry({ id: "one" }),
      entry({ id: "two", createdAt: "2026-07-22T09:00:00.000Z" }),
      entry({ id: "three", createdAt: "2026-07-22T08:00:00.000Z" }),
    ], now);

    expect(behavior.status).toBe("ПАУЗА");
    expect(behavior.blockers).toContain("Пауза: слишком много решений за сутки.");
    expect(behavior.healthInputs.overtradingDays30d).toBe(1);
  });
});
