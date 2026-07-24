import { describe, expect, it } from "vitest";
import type { InterestSignal } from "../../src/types/portfolio";
import { buildTradeCandidateFromSignal } from "../../src/v2/lib/tradeCandidate";

const signal = (patch: Partial<InterestSignal>): InterestSignal => ({
  id: "S1",
  asset: "ETH",
  action: "Купить",
  amountUsd: 25,
  triggerPrice: 1800,
  source: "HL",
  currentPrice: 1900,
  status: "ARMED",
  lastCheck: "",
  triggeredAt: "",
  telegram: "PENDING",
  comment: "",
  ...patch,
});

describe("кандидат сделки из лимитного ордера", () => {
  it("создаёт кандидата покупки с категорией существующей позиции", () => {
    const candidate = buildTradeCandidateFromSignal(
      signal({ asset: "eth", action: "Купить" }),
      [{ asset: "ETH", category: "Крипта" }],
    );

    expect(candidate).toMatchObject({
      source: "limit_order",
      sourceId: "S1",
      action: "buy",
      asset: "ETH",
      category: "Крипта",
      amountUsd: 25,
      price: 1800,
    });
  });

  it("создаёт кандидата продажи, но не исполняет её", () => {
    const candidate = buildTradeCandidateFromSignal(
      signal({ asset: "ETH", action: "Продать", amountUsd: 10 }),
      [{ asset: "ETH", category: "Крипта" }],
    );

    expect(candidate?.action).toBe("sell");
    expect(candidate?.label).toContain("продажа");
  });

  it("не создаёт кандидата из неизвестного действия", () => {
    expect(buildTradeCandidateFromSignal(signal({ action: "Следить" }), [])).toBeNull();
  });
});
