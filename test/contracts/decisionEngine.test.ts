import { describe, expect, it } from "vitest";
import {
  calculateAveragingPreview,
  evaluateDecision,
  type DecisionContext,
} from "../../src/v2/lib/decisionEngine";
import { BINANCE_MONITORING_ASSET_QUALITY } from "../../src/v2/lib/assetQualitySource";
import type { HealthInput } from "../../src/lib/portfolioHealth";
import { getMarketPsychology } from "../../src/v2/lib/marketPsychology";

const baseHealthInput: HealthInput = {
  cashShare: 0.6,
  cryptoShare: 0.4,
  futuresShare: 0,
  largestShare: 0.1,
  riskCategoryShares: [0.4, 0.03, 0],
  reserveShare: 0.6,
  portfolioValue: 1000,
  investedCapital: 1000,
  spotDeployableUsd: 200,
  concentrationScore: 100,
  maxAssetLimitUtilization: 0.75,
  worstConcentrationAsset: "ETH",
  worstConcentrationShare: 0.25,
  worstConcentrationPortfolioShare: 0.1,
  worstConcentrationLimit: 0.35,
  overLimitAssets: [],
  altcoinSlotsUsed: 1,
  altcoinSlotsTotal: 3,
  altcoinSlotsFree: 2,
  altcoins: ["SOL"],
  stockSlotsUsed: 0,
  stockSlotsTotal: 2,
  stockSlotsFree: 2,
  stocks: [],
  metalSlotsUsed: 1,
  metalSlotsTotal: 2,
  metalSlotsFree: 1,
  metals: ["GOLD"],
};

const baseCtx: DecisionContext = {
  totalPortfolioValue: 1000,
  stableReserve: 600,
  spotDeployable: 200,
  positions: [
    { asset: "ETH", category: "Крипта", value: 100, avgEntry: 1776, invested: 25 },
    { asset: "SOL", category: "Крипта", value: 40, avgEntry: 77, invested: 38 },
    { asset: "GOLD", category: "Металлы", value: 30, avgEntry: 4300, invested: 28 },
  ],
  allocation: [
    { name: "Крипта", value: 400 },
    { name: "Металлы", value: 30 },
    { name: "Свободные деньги", value: 600 },
  ],
  fearGreedRules: [
    {
      mode: "cautious",
      label: "Осторожная покупка",
      buyAmount: 100,
      isCurrent: true,
      isAvailable: true,
      cooldownRemainingHours: 0,
    },
  ],
  reserveFloorShare: 0.1,
  cryptoMaxShare: 0.6,
  futuresShare: 0,
  plannedLimitOrdersUsd: 100,
  healthInput: baseHealthInput,
};

describe("движок решений", () => {
  it("разрешает сделку, если шлюз и выживаемость проходят", () => {
    const decision = evaluateDecision(
      { asset: "ETH", amountUsd: 20, category: "Крипта" },
      baseCtx,
    );

    expect(decision.status).toBe("РАЗРЕШЕНО");
    expect(decision.reasons).toEqual([]);
    expect(decision.warnings).toEqual([]);
    expect(decision.maxSafeAmount).toBeGreaterThanOrEqual(20);
    expect(decision.recommendedAction).toBe("Сделка проходит проверку риска");
  });

  it("даёт осторожность, если после покупки выживаемость уходит в предупреждение", () => {
    const decision = evaluateDecision(
      { asset: "ETH", amountUsd: 20, category: "Крипта" },
      {
        ...baseCtx,
        allocation: [
          { name: "Крипта", value: 400 },
          { name: "Металлы", value: 100 },
          { name: "Акции", value: 100 },
          { name: "Свободные деньги", value: 400 },
        ],
        stableReserve: 400,
        spotDeployable: 240,
        futuresShare: 0.1,
        cryptoMaxShare: 0.8,
      },
    );

    expect(decision.status).toBe("ОСТОРОЖНО");
    expect(decision.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "выживаемость",
          text: "Худший сценарий даёт просадку выше 40%",
        }),
      ]),
    );
    expect(decision.reasons).toEqual([]);
  });

  it("блокирует сделку, если после покупки портфель не проходит выживаемость", () => {
    const decision = evaluateDecision(
      { asset: "ETH", amountUsd: 1, category: "Крипта" },
      {
        ...baseCtx,
        totalPortfolioValue: 1000,
        stableReserve: 150,
        spotDeployable: 50,
        positions: [
          { asset: "ETH", category: "Крипта", value: 250 },
          { asset: "BTC", category: "Крипта", value: 170 },
          { asset: "SOL", category: "Крипта", value: 85 },
          { asset: "TON", category: "Крипта", value: 85 },
          { asset: "BNB", category: "Крипта", value: 85 },
          { asset: "ATOM", category: "Крипта", value: 45 },
          { asset: "INJ", category: "Крипта", value: 45 },
          { asset: "SEI", category: "Крипта", value: 45 },
        ],
        allocation: [
          { name: "Крипта", value: 850 },
          { name: "Свободные деньги", value: 150 },
        ],
        cryptoMaxShare: 1,
        futuresShare: 0.1,
        plannedLimitOrdersUsd: 20,
      },
    );

    expect(decision.status).toBe("БЛОКИРОВКА");
    expect(decision.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "выживаемость",
          text: "Худший сценарий даёт просадку выше 60%",
        }),
      ]),
    );
  });

  it("блокирует сделку при дисциплинарном блокере", () => {
    const decision = evaluateDecision(
      { asset: "ETH", amountUsd: 20, category: "Крипта" },
      { ...baseCtx, disciplineBlockers: ["Активен дисциплинарный блокер"] },
    );

    expect(decision.status).toBe("БЛОКИРОВКА");
    expect(decision.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "дисциплина",
          text: "Активен дисциплинарный блокер",
        }),
      ]),
    );
  });

  it("блокирует добор риск-актива в зоне рыночной эйфории", () => {
    const decision = evaluateDecision(
      { asset: "ETH", amountUsd: 20, category: "Крипта" },
      { ...baseCtx, marketPsychology: getMarketPsychology(92) },
    );

    expect(decision.status).toBe("БЛОКИРОВКА");
    expect(decision.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "рыночная_психология",
          text: "Рынок в эйфории — увеличение риска заблокировано до выхода из зоны перегрева.",
        }),
      ]),
    );
  });

  it("блокирует крипто-покупку, если токен вне топ-100", () => {
    const decision = evaluateDecision(
      { asset: "PEPE", amountUsd: 5, category: "Крипта" },
      {
        ...baseCtx,
        assetQuality: {
          connected: true,
          records: [{ asset: "PEPE", cmcRank: 140, binanceMonitoring: false }],
        },
      },
    );

    expect(decision.status).toBe("БЛОКИРОВКА");
    expect(decision.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "качество_актива",
          text: "PEPE: токен вне топ-100 CoinMarketCap",
        }),
      ]),
    );
  });

  it("блокирует крипто-покупку, если токен в мониторинге Binance", () => {
    const decision = evaluateDecision(
      { asset: "ATOM", amountUsd: 5, category: "Крипта" },
      {
        ...baseCtx,
        assetQuality: {
          connected: true,
          records: [{ asset: "ATOM", cmcRank: 55, binanceMonitoring: true }],
        },
      },
    );

    expect(decision.status).toBe("БЛОКИРОВКА");
    expect(decision.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "качество_актива",
          text: "ATOM: токен находится в списке мониторинга Binance",
        }),
      ]),
    );
  });

  it("блокирует JASMY из подключённого источника Binance Monitoring", () => {
    const decision = evaluateDecision(
      { asset: "jasmy", amountUsd: 1, category: "Крипта", buyPrice: 1 },
      { ...baseCtx, assetQuality: BINANCE_MONITORING_ASSET_QUALITY },
    );

    expect(decision.status).toBe("БЛОКИРОВКА");
    expect(decision.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "качество_актива",
          text: "JASMY: токен находится в списке мониторинга Binance",
        }),
      ]),
    );
  });

  it("блокирует NOM из подключённого источника Binance Monitoring", () => {
    const decision = evaluateDecision(
      { asset: "Nom", amountUsd: 15, category: "Крипта", buyPrice: 11 },
      { ...baseCtx, assetQuality: BINANCE_MONITORING_ASSET_QUALITY },
    );

    expect(decision.status).toBe("БЛОКИРОВКА");
    expect(decision.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "качество_актива",
          text: "NOM: токен находится в списке мониторинга Binance",
        }),
      ]),
    );
  });

  it("показывает здоровье до и после для обычной проверки сделки", () => {
    const decision = evaluateDecision(
      { asset: "ETH", amountUsd: 20, category: "Крипта", buyPrice: 1500 },
      baseCtx,
    );

    expect(decision.healthPreview).not.toBeNull();
    expect(decision.healthPreview?.applicable).toBe(true);
    expect(decision.healthPreview?.before.healthFactor).toBeGreaterThan(0);
    expect(decision.healthPreview?.after.healthFactor).toBeGreaterThan(0);
    expect(decision.healthPreview?.changedComponents.length).toBeGreaterThan(0);
  });

  it("не применяет здоровье после сделки к запрещённому активу", () => {
    const decision = evaluateDecision(
      { asset: "jasmy", amountUsd: 1, category: "Крипта", buyPrice: 1 },
      { ...baseCtx, assetQuality: BINANCE_MONITORING_ASSET_QUALITY },
    );

    expect(decision.status).toBe("БЛОКИРОВКА");
    expect(decision.healthPreview?.applicable).toBe(false);
    expect(decision.healthPreview?.note).toBe(
      "Здоровье после сделки не применяется: актив запрещён политикой риска.",
    );
  });

  it("считает новую среднюю входа при усреднении покупки", () => {
    const preview = calculateAveragingPreview(
      { asset: "ETH", amountUsd: 25, category: "Крипта", buyPrice: 1516 },
      baseCtx,
    );

    const oldQty = 25 / 1776;
    const addedQty = 25 / 1516;
    const expectedAvg = 50 / (oldQty + addedQty);

    expect(preview?.averageEntryBefore).toBe(1776);
    expect(preview?.addedQuantity).toBeCloseTo(addedQty, 8);
    expect(preview?.averageEntryAfter).toBeCloseTo(expectedAvg, 6);
    expect(preview?.averageEntryAfter).toBeLessThan(1776);
    expect(preview?.averageEntryAfter).toBeGreaterThan(1516);
  });

  it("не считает усреднение без цены покупки", () => {
    expect(
      calculateAveragingPreview(
        { asset: "ETH", amountUsd: 25, category: "Крипта" },
        baseCtx,
      ),
    ).toBeNull();
  });
});
