import { describe, expect, it } from "vitest";
import {
  actionableLimitSignalsSummary,
  assessSignal,
  assessSignalNotification,
  buildSignalNotificationPlan,
  countSignalNotificationsToday,
  getSignalDistance,
  isActiveActionableLimitSignal,
  groupByAsset,
  isPlannedLimitOrder,
  plannedLimitOrdersSummary,
  sortByProximity,
  sortBySignalPriority,
} from "../../src/v2/lib/interestSignals";
import type { InterestSignal } from "../../src/types/portfolio";

const signal = (patch: Partial<InterestSignal>): InterestSignal => ({
  id: "X",
  asset: "ETH",
  action: "Купить",
  amountUsd: 25,
  triggerPrice: 0,
  source: "",
  currentPrice: 0,
  status: "ARMED",
  lastCheck: "",
  triggeredAt: "",
  telegram: "PENDING",
  comment: "",
  ...patch,
});

describe("расстояние до срабатывания", () => {
  it("покупка ниже рынка — отрицательное расстояние (нужно падение)", () => {
    const distance = getSignalDistance(signal({ currentPrice: 65500, triggerPrice: 59200 }));

    expect(distance).not.toBeNull();
    expect(distance!.abs).toBeCloseTo(-6300, 6);
    expect(distance!.pct).toBeCloseTo(-9.618, 2);
  });

  it("продажа выше рынка — положительное расстояние (нужен рост)", () => {
    const distance = getSignalDistance(signal({ currentPrice: 1924, triggerPrice: 1964 }));

    expect(distance!.abs).toBeCloseTo(40, 6);
    expect(distance!.pct).toBeCloseTo(2.079, 2);
  });

  it("без цены расстояние не считается", () => {
    expect(getSignalDistance(signal({ currentPrice: 0, triggerPrice: 100 }))).toBeNull();
    expect(getSignalDistance(signal({ currentPrice: 100, triggerPrice: 0 }))).toBeNull();
  });
});

describe("порядок списка", () => {
  it("ждущие идут по близости к срабатыванию, а не по порядку строк таблицы", () => {
    const far = signal({ id: "far", currentPrice: 100, triggerPrice: 50 }); // −50%
    const near = signal({ id: "near", currentPrice: 100, triggerPrice: 98 }); // −2%
    const middle = signal({ id: "middle", currentPrice: 100, triggerPrice: 110 }); // +10%

    expect(sortByProximity([far, middle, near]).map((s) => s.id)).toEqual([
      "near",
      "middle",
      "far",
    ]);
  });

  it("сломанные сигналы наверх, сработавшие вниз", () => {
    const armed = signal({ id: "armed", currentPrice: 100, triggerPrice: 50 });
    const done = signal({ id: "done", status: "TRIGGERED", currentPrice: 100, triggerPrice: 99 });
    const broken = signal({ id: "broken", status: "CHECK", currentPrice: 100, triggerPrice: 10 });

    expect(sortByProximity([done, armed, broken]).map((s) => s.id)).toEqual([
      "broken",
      "armed",
      "done",
    ]);
  });

  it("сигнал без цены стоит ниже ждущих, но выше сработавших", () => {
    const armed = signal({ id: "armed", currentPrice: 100, triggerPrice: 50 });
    const noPrice = signal({ id: "noPrice", currentPrice: 0, triggerPrice: 50 });
    const done = signal({ id: "done", status: "TRIGGERED", currentPrice: 100, triggerPrice: 99 });

    expect(sortByProximity([done, noPrice, armed].map((s) => s)).map((s) => s.id)).toEqual([
      "armed",
      "noPrice",
      "done",
    ]);
  });

  it("исходный массив не мутируется", () => {
    const input = [
      signal({ id: "a", currentPrice: 100, triggerPrice: 50 }),
      signal({ id: "b", currentPrice: 100, triggerPrice: 99 }),
    ];

    sortByProximity(input);

    expect(input.map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("группировка по монетам", () => {
  it("собирает точки одного актива в одну группу, монеты — по близости", () => {
    const groups = groupByAsset([
      signal({ id: "btc-far", asset: "BTC", currentPrice: 100, triggerPrice: 60 }), // −40%
      signal({ id: "eth-near", asset: "ETH", currentPrice: 100, triggerPrice: 98 }), // −2%
      signal({ id: "btc-mid", asset: "BTC", currentPrice: 100, triggerPrice: 90 }), // −10%
    ]);

    expect(groups.map((g) => g.asset)).toEqual(["ETH", "BTC"]);
    expect(groups[1].signals.map((s) => s.id)).toEqual(["btc-mid", "btc-far"]);
    expect(groups[1].nearest!.pct).toBeCloseTo(-10, 6);
    expect(groups[1].waitingCount).toBe(2);
  });

  it("актив со сломанной строкой поднимается наверх независимо от расстояния", () => {
    const groups = groupByAsset([
      signal({ id: "eth", asset: "ETH", currentPrice: 100, triggerPrice: 99 }),
      signal({ id: "sol", asset: "SOL", status: "CHECK", currentPrice: 100, triggerPrice: 10 }),
    ]);

    expect(groups.map((g) => g.asset)).toEqual(["SOL", "ETH"]);
    expect(groups[0].needsAttention).toBe(true);
    expect(groups[1].needsAttention).toBe(false);
  });

  it("сработавшие точки не считаются ждущими и не задают близость актива", () => {
    const groups = groupByAsset([
      signal({ id: "done", asset: "ETH", status: "TRIGGERED", currentPrice: 100, triggerPrice: 100 }),
      signal({ id: "waiting", asset: "ETH", currentPrice: 100, triggerPrice: 80 }),
    ]);

    expect(groups[0].waitingCount).toBe(1);
    expect(groups[0].nearest!.pct).toBeCloseTo(-20, 6);
    expect(groups[0].hasTriggered).toBe(true);
  });

  it("актив со сработавшей точкой поднимается выше обычного близкого ордера", () => {
    const groups = groupByAsset([
      signal({ id: "eth-near", asset: "ETH", currentPrice: 100, triggerPrice: 99 }),
      signal({ id: "atom-done", asset: "ATOM", status: "TRIGGERED", currentPrice: 100, triggerPrice: 100 }),
    ]);

    expect(groups.map((g) => g.asset)).toEqual(["ATOM", "ETH"]);
    expect(groups[0].hasTriggered).toBe(true);
    expect(groups[1].hasTriggered).toBe(false);
  });
});

describe("лимитные ордера", () => {
  it("считает депозит только по активным покупательным ордерам", () => {
    const summary = plannedLimitOrdersSummary([
      signal({ id: "eth-buy", asset: "ETH", action: "Купить", amountUsd: 25 }),
      signal({ id: "sol-add", asset: "SOL", action: "Добор", amountUsd: 15 }),
      signal({ id: "btc-done", asset: "BTC", action: "Купить", amountUsd: 100, status: "TRIGGERED" }),
      signal({ id: "ton-check", asset: "TON", action: "Купить", amountUsd: 40, status: "CHECK" }),
      signal({ id: "gram-sell", asset: "GRAM", action: "Продать", amountUsd: 30 }),
    ]);

    expect(summary.count).toBe(2);
    expect(summary.totalUsd).toBe(40);
    expect(summary.assets).toEqual(["ETH", "SOL"]);
  });

  it("не принимает продажу или нулевую сумму за план покупки", () => {
    expect(isPlannedLimitOrder(signal({ action: "Сократить позицию", amountUsd: 20 }))).toBe(false);
    expect(isPlannedLimitOrder(signal({ action: "Купить", amountUsd: 0 }))).toBe(false);
    expect(isPlannedLimitOrder(signal({ action: "Купить", amountUsd: 20 }))).toBe(true);
  });

  it("считает активные buy/sell уровни, которые требуют биржевой лимитки", () => {
    const summary = actionableLimitSignalsSummary([
      signal({ id: "eth-buy", asset: "ETH", action: "Купить", amountUsd: 25 }),
      signal({ id: "btc-short-sell", asset: "BTC SHORT", action: "Продать", amountUsd: 20 }),
      signal({ id: "btc-done", asset: "BTC", action: "Купить", amountUsd: 100, status: "TRIGGERED" }),
      signal({ id: "ton-check", asset: "TON", action: "Купить", amountUsd: 40, status: "CHECK" }),
      signal({ id: "unknown", asset: "GRAM", action: "Ждать", amountUsd: 30 }),
    ]);

    expect(summary.count).toBe(2);
    expect(summary.totalUsd).toBe(45);
    expect(summary.buyCount).toBe(1);
    expect(summary.sellCount).toBe(1);
    expect(summary.assets).toEqual(["ETH", "BTC SHORT"]);
  });

  it("не считает снятый или неизвестный сигнал требованием к биржевой лимитке", () => {
    expect(isActiveActionableLimitSignal(signal({ action: "Купить", status: "CHECK" }))).toBe(false);
    expect(isActiveActionableLimitSignal(signal({ action: "Ждать", status: "ARMED" }))).toBe(false);
    expect(isActiveActionableLimitSignal(signal({ action: "Продать", status: "ARMED" }))).toBe(true);
  });
});

describe("качество и приоритет сигналов", () => {
  const now = new Date("2026-07-24T12:00:00.000Z");

  it("сработавшая точка отправляет в проверку риска, а не разрешает сделку", () => {
    const assessment = assessSignal(
      signal({ status: "TRIGGERED", currentPrice: 100, triggerPrice: 100, lastCheck: "2026-07-24T11:59:00.000Z" }),
      now,
    );

    expect(assessment.priority).toBe("сработал");
    expect(assessment.needsGate).toBe(true);
    expect(assessment.text).toContain("проверку риска");
  });

  it("устаревшая проверка не считается рабочим свежим сигналом", () => {
    const assessment = assessSignal(
      signal({ currentPrice: 100, triggerPrice: 99, lastCheck: "2026-07-24T11:30:00.000Z" }),
      now,
    );

    expect(assessment.freshness).toBe("устарел");
    expect(assessment.priority).toBe("устарел");
    expect(assessment.needsGate).toBe(false);
  });

  it("приоритет ставит сломанные и сработавшие точки выше близких", () => {
    const ordered = sortBySignalPriority([
      signal({ id: "near", currentPrice: 100, triggerPrice: 99, lastCheck: "2026-07-24T11:59:00.000Z" }),
      signal({ id: "done", status: "TRIGGERED", currentPrice: 100, triggerPrice: 100, lastCheck: "2026-07-24T11:59:00.000Z" }),
      signal({ id: "broken", status: "ERROR", currentPrice: 100, triggerPrice: 10, lastCheck: "2026-07-24T11:59:00.000Z" }),
    ], now);

    expect(ordered.map((item) => item.id)).toEqual(["broken", "done", "near"]);
  });
});

describe("правила напоминаний по сигналам", () => {
  const now = new Date("2026-07-24T09:00:00.000Z"); // 12:00 MSK
  const touched = signal({
    id: "touched",
    status: "TRIGGERED",
    currentPrice: 100,
    triggerPrice: 100,
    lastCheck: "2026-07-24 11:59:00 MSK",
    telegram: "PENDING",
  });

  it("читает время MSK из таблицы и считает отправки за текущий день", () => {
    const count = countSignalNotificationsToday([
      signal({ id: "today", telegram: "SENT", triggeredAt: "2026-07-24 10:15:00 MSK" }),
      signal({ id: "yesterday", telegram: "SENT", triggeredAt: "2026-07-23 23:59:00 MSK" }),
      signal({ id: "pending", telegram: "PENDING", triggeredAt: "2026-07-24 10:30:00 MSK" }),
    ], now);

    expect(count).toBe(1);
  });

  it("разрешает первое напоминание, но не разрешает сделку без проверки риска", () => {
    const decision = assessSignalNotification(touched, now, { sentTodayCount: 0 });

    expect(decision.status).toBe("разрешено");
    expect(decision.canNotify).toBe(true);
    expect(decision.text).toContain("проверку риска");
  });

  it("блокирует напоминание, когда дневной лимит исчерпан", () => {
    const decision = assessSignalNotification(touched, now, { sentTodayCount: 3 });

    expect(decision.status).toBe("лимит");
    expect(decision.canNotify).toBe(false);
  });

  it("блокирует повтор раньше шести часов", () => {
    const decision = assessSignalNotification(
      signal({ ...touched, telegram: "SENT", triggeredAt: "2026-07-24 10:30:00 MSK" }),
      now,
      { sentTodayCount: 1 },
    );

    expect(decision.status).toBe("повтор_рано");
    expect(decision.canNotify).toBe(false);
  });

  it("разрешает повтор после шести часов", () => {
    const decision = assessSignalNotification(
      signal({ ...touched, telegram: "SENT", triggeredAt: "2026-07-24 05:30:00 MSK" }),
      now,
      { sentTodayCount: 1 },
    );

    expect(decision.status).toBe("разрешено");
    expect(decision.canNotify).toBe(true);
  });

  it("дисциплинарная пауза сильнее ценового сигнала", () => {
    const decision = assessSignalNotification(touched, now, {
      sentTodayCount: 0,
      disciplineCooldownActive: true,
    });

    expect(decision.status).toBe("пауза");
    expect(decision.canNotify).toBe(false);
  });

  it("план напоминаний не пропускает больше дневного лимита", () => {
    const plan = buildSignalNotificationPlan([
      touched,
      signal({ ...touched, id: "second" }),
      signal({ ...touched, id: "third" }),
    ], now, { dailyLimit: 2 });

    expect(plan.items.filter((item) => item.notification.canNotify)).toHaveLength(2);
    expect(plan.remainingToday).toBe(0);
  });
});
