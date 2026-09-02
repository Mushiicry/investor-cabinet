import { describe, expect, it } from "vitest";
import type { PortfolioHealth } from "../../src/lib/portfolioHealth";
import type { InterestSignal } from "../../src/types/portfolio";
import type { V2Portfolio } from "../../src/v2/InvestorCabinetV2Lab";
import { buildPortfolioAlerts } from "../../src/v2/lib/portfolioAlerts";
import { getMarketPsychology } from "../../src/v2/lib/marketPsychology";
import { WIFE_INVESTOR_STRATEGY } from "../../src/v2/lib/investorStrategy";

const portfolio = (patch: Partial<V2Portfolio> = {}): V2Portfolio => ({
  totalPortfolioValue: 1000,
  totalInvested: 1000,
  pnlUsd: 0,
  pnlPct: 0,
  stableReserve: 400,
  positionsCount: 0,
  healthFactor: 82,
  healthStatus: "CONTROL",
  riskLevel: "LOW",
  deployableCapital: 100,
  spotDeployable: 100,
  futuresDeployable: 0,
  reserveShare: 0.4,
  exposureMode: "CONTROL",
  exposureSignal: "Норма",
  ...patch,
});

const health: PortfolioHealth = {
  healthFactor: 82,
  status: "CONTROL",
  riskLevel: "LOW",
  components: [],
};

const signal = (patch: Partial<InterestSignal>): InterestSignal => ({
  id: "X",
  asset: "BTC SHORT",
  action: "Продать",
  amountUsd: 20,
  triggerPrice: 79422,
  source: "",
  currentPrice: 77600,
  status: "ARMED",
  lastCheck: "2026-08-21 16:40:00 MSK",
  triggeredAt: "",
  telegram: "PENDING",
  comment: "",
  ...patch,
});

describe("единый движок тревог портфеля", () => {
  it("передаёт эйфорию рынка как блокирующую макро-тревогу", () => {
    const alerts = buildPortfolioAlerts({
      portfolio: portfolio(),
      positions: [],
      allocation: [],
      currentFG: 92,
      health,
      marketPsychology: getMarketPsychology(92),
    });

    expect(alerts).toContainEqual(
      expect.objectContaining({
        id: "market-psychology-block",
        level: "critical",
        title: "Рынок: Эйфория",
      }),
    );
  });

  it("передаёт жадность рынка как предупреждение перед проверкой риска", () => {
    const alerts = buildPortfolioAlerts({
      portfolio: portfolio(),
      positions: [],
      allocation: [],
      currentFG: 80,
      health,
      marketPsychology: getMarketPsychology(80),
    });

    expect(alerts).toContainEqual(
      expect.objectContaining({
        id: "market-psychology-warning",
        level: "warning",
        title: "Рынок: Жадность",
        action: "Открыть проверку риска",
      }),
    );
  });

  it("передаёт оптимизм рынка прямым запретом покупать без плана", () => {
    const alerts = buildPortfolioAlerts({
      portfolio: portfolio(),
      positions: [],
      allocation: [],
      currentFG: 72,
      health,
      marketPsychology: getMarketPsychology(72),
    });

    expect(alerts).toContainEqual(
      expect.objectContaining({
        id: "market-psychology-warning",
        detail: expect.stringContaining("Не покупай просто из-за роста"),
        action: "Открыть проверку риска",
      }),
    );
  });

  it("сохраняет предупреждение по резерву в том же списке тревог", () => {
    const alerts = buildPortfolioAlerts({
      portfolio: portfolio({ stableReserve: 150, reserveShare: 0.15 }),
      positions: [],
      allocation: [],
      currentFG: 50,
      health,
      marketPsychology: getMarketPsychology(50),
    });

    expect(alerts).toContainEqual(
      expect.objectContaining({
        id: "reserve-low",
        level: "warning",
        title: "Резерв низкий",
      }),
    );
  });

  it("кричит, если активные уровни есть, а биржевые лимитки не подтверждены кабинетом", () => {
    const alerts = buildPortfolioAlerts({
      portfolio: portfolio(),
      positions: [],
      allocation: [],
      currentFG: 50,
      health,
      interestSignals: [
        signal({ id: "btc-short-add" }),
        signal({ id: "eth-buy", asset: "ETH", action: "Купить", amountUsd: 25 }),
      ],
      marketPsychology: getMarketPsychology(50),
    });

    expect(alerts).toContainEqual(
      expect.objectContaining({
        id: "exchange-limit-orders-unconfirmed",
        level: "critical",
        title: "Лимитки на бирже не подтверждены",
        detail: expect.stringContaining("Сайт/TG только напоминают"),
        action: "Поставить лимитки вручную",
        priority: -10,
      }),
    );
  });

  it("переносит простой резерва выше верхней границы в сигналы и общие рекомендации", () => {
    const alerts = buildPortfolioAlerts({
      portfolio: portfolio({ stableReserve: 700, reserveShare: 0.7 }),
      positions: [],
      allocation: [],
      currentFG: 49,
      health,
      marketPsychology: getMarketPsychology(49),
    });

    expect(alerts).toContainEqual(
      expect.objectContaining({
        id: "reserve-idle",
        level: "warning",
        title: "Резерв выше 60%",
        detail: "$100 сверх $600 простаивает",
        action: "Открыть разбор здоровья",
      }),
    );
  });

  it("при жадности резерв ждёт лимитные зоны, а не считается срочным топливом для покупки", () => {
    const alerts = buildPortfolioAlerts({
      portfolio: portfolio({ stableReserve: 700, reserveShare: 0.7 }),
      positions: [],
      allocation: [],
      currentFG: 71,
      health,
      marketPsychology: getMarketPsychology(71),
    });

    expect(alerts).toContainEqual(
      expect.objectContaining({
        id: "reserve-idle",
        detail: "$100 ждёт страх, откат или лимитные зоны",
        action: "Не догонять рост: открыть разбор здоровья",
      }),
    );
  });

  it("для стратегии Полины не ругается на резерв выше 10% и крипту ниже 75%", () => {
    const alerts = buildPortfolioAlerts({
      portfolio: portfolio({ stableReserve: 150, reserveShare: 0.15 }),
      positions: [],
      allocation: [{ name: "Крипта", share: 0.7, value: 700 }],
      currentFG: 50,
      health,
      marketPsychology: getMarketPsychology(50),
      strategy: WIFE_INVESTOR_STRATEGY,
    });

    expect(alerts.find((alert) => alert.id === "reserve-low")).toBeUndefined();
    expect(alerts.find((alert) => alert.id === "crypto-warn")).toBeUndefined();
    expect(alerts.find((alert) => alert.id === "crypto-critical")).toBeUndefined();
  });

  it("для стратегии Полины считает крипто-предупреждение от лимита 75%", () => {
    const alerts = buildPortfolioAlerts({
      portfolio: portfolio({ stableReserve: 150, reserveShare: 0.15 }),
      positions: [],
      allocation: [{ name: "Крипта", share: 0.8, value: 800 }],
      currentFG: 50,
      health,
      marketPsychology: getMarketPsychology(50),
      strategy: WIFE_INVESTOR_STRATEGY,
    });

    expect(alerts).toContainEqual(
      expect.objectContaining({
        id: "crypto-warn",
        detail: "80.0% · лимит 75%",
      }),
    );
  });

  it("считает лимит крипто-позиции внутри крипто-блока, а не как маленький процент портфеля", () => {
    const alerts = buildPortfolioAlerts({
      portfolio: portfolio(),
      positions: [
        { asset: "SOL", category: "Крипта", value: 30 },
        { asset: "BNB", category: "Крипта", value: 17 },
        { asset: "ETH", category: "Крипта", value: 153 },
      ],
      allocation: [{ name: "Крипта", share: 0.2, value: 200 }],
      currentFG: 50,
      health,
      marketPsychology: getMarketPsychology(50),
    });

    expect(alerts).toContainEqual(
      expect.objectContaining({
        id: "position-over-SOL",
        detail: "15.0% крипто-блока при лимите 10% · в портфеле 3.0%",
      }),
    );
    expect(alerts.find((alert) => alert.id === "position-limit-BNB")).toBeUndefined();
    expect(alerts.find((alert) => alert.id === "position-over-BNB")).toBeUndefined();
  });

  it("не занимает альткоин-место полностью закрытой нулевой позицией", () => {
    const alerts = buildPortfolioAlerts({
      portfolio: portfolio(),
      positions: [
        { asset: "ATOM", category: "Крипта", value: 31.17 },
        { asset: "APEX", category: "Крипта", value: 0 },
        { asset: "SOL", category: "Крипта", value: 1.27 },
        { asset: "ETH", category: "Крипта", value: 0.01 },
        { asset: "BTC", category: "Крипта", value: 0 },
      ],
      allocation: [{ name: "Крипта", share: 0.04, value: 32.45 }],
      currentFG: 50,
      health,
    });

    expect(alerts).toContainEqual(
      expect.objectContaining({
        id: "altcoins-slots",
        title: "Альткоины: свободно 2 из 3",
        detail: expect.stringContaining("Занято: ATOM."),
      }),
    );
    expect(alerts.find((alert) => alert.id === "altcoins-slots")?.detail).not.toContain("APEX");
  });
});
