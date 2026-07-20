import { describe, expect, it } from "vitest";
import { buildLevelCards, currentLadderLevel } from "../../src/v2/lib/levelLadder";
import type { PortfolioHealth } from "../../src/lib/portfolioHealth";
import type { V2Portfolio } from "../../src/v2/InvestorCabinetV2Lab";

const health = (hf: number): PortfolioHealth => ({
  healthFactor: hf,
  status: hf >= 75 ? "CONTROL" : hf >= 55 ? "BALANCED" : "RISK",
  riskLevel: "-",
  components: [
    { key: "reserve", label: "Резерв", score: 100, color: "", desc: "", weight: 0.2 },
    { key: "flexibility", label: "Гибкость", score: 100, color: "", desc: "", weight: 0.15 },
    { key: "futures", label: "Фьючерсы", score: 80, color: "", desc: "", weight: 0.15 },
    { key: "concentration", label: "Концентрация", score: 71, color: "", desc: "", weight: 0.18 },
    { key: "diversification", label: "Диверсификация", score: 44, color: "", desc: "", weight: 0.15 },
  ],
});

const portfolio = { positionsCount: 8 } as V2Portfolio;

const card = (cards: ReturnType<typeof buildLevelCards>, lvl: number) =>
  cards.find((c) => c.level === lvl)!;

describe("лестница уровней", () => {
  it("уровень определяется по порогам здоровья", () => {
    expect(currentLadderLevel(10)).toBe(1);
    expect(currentLadderLevel(40)).toBe(2);
    expect(currentLadderLevel(60)).toBe(3);
    expect(currentLadderLevel(86)).toBe(4);
    expect(currentLadderLevel(95)).toBe(5);
  });

  it("пройденные уровни закрыты, текущий отмечен, дальше — заперты", () => {
    const cards = buildLevelCards(health(86), portfolio, 4);
    expect(card(cards, 3).status).toBe("done");
    expect(card(cards, 4).status).toBe("current");
    expect(card(cards, 5).status).toBe("locked");
    expect(card(cards, 5).rewardUsd).toBe(50);
  });

  it("уровень НЕ откатывается при просадке здоровья", () => {
    // Был 4-й уровень, здоровье упало до 50 (это порог 2-го) — уровень остаётся 4.
    const cards = buildLevelCards(health(50), portfolio, 4);
    expect(card(cards, 4).status).toBe("current");
    expect(card(cards, 3).status).toBe("done");
    expect(card(cards, 2).status).toBe("done");
  });

  it("опыт внутри текущего уровня проседает вместе со здоровьем", () => {
    const strong = buildLevelCards(health(86), portfolio, 4);
    const weak = buildLevelCards(health(78), portfolio, 4);
    expect(card(strong, 4).xpCurrent).toBeGreaterThan(card(weak, 4).xpCurrent);
  });

  it("здоровье ниже порога уровня — опыт 0 и флаг просадки, но уровень цел", () => {
    const cards = buildLevelCards(health(50), portfolio, 4);
    const c4 = card(cards, 4);
    expect(c4.status).toBe("current"); // уровень сохранён
    expect(c4.xpCurrent).toBe(0); // опыт списан
    expect(c4.xpDrained).toBe(true);
  });

  it("рост здоровья выше зафиксированного максимума поднимает уровень", () => {
    const cards = buildLevelCards(health(95), portfolio, 4);
    expect(card(cards, 5).status).toBe("current");
    expect(card(cards, 4).status).toBe("done");
  });
});
