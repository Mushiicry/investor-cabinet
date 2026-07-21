import { describe, expect, it } from "vitest";
import { getSignalDistance, sortByProximity } from "../../src/v2/lib/interestSignals";
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
