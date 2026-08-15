import { describe, expect, it } from "vitest";
import type { HealthComponent, HealthComponentMeta, HealthInput } from "../../src/lib/portfolioHealth";
import { buildCoreRecs, buildHealthBoardRecs } from "../../src/v2/lib/healthCoreHelpers";
import type { V2Portfolio } from "../../src/v2/InvestorCabinetV2Lab";

const portfolio: V2Portfolio = {
  totalPortfolioValue: 1000,
  totalInvested: 600,
  pnlUsd: 0,
  pnlPct: 0,
  stableReserve: 400,
  positionsCount: 6,
  healthFactor: 80,
  healthStatus: "CONTROL",
  riskLevel: "Хорошо",
  deployableCapital: 300,
  spotDeployable: 250,
  futuresDeployable: 50,
  reserveShare: 0.4,
  exposureMode: "Норма",
  exposureSignal: "Норма",
};

function component(
  key: HealthComponent["key"],
  label: string,
  meta: HealthComponentMeta,
  score = 80,
): HealthComponent {
  return {
    key,
    label,
    score,
    color: "#5AEF8D",
    desc: "",
    weight: 0.15,
    meta,
  };
}

describe("рекомендации здоровья портфеля", () => {
  it("блокер выживаемости не теряется, даже если луч не передали как слабый", () => {
    const recs = buildCoreRecs([], portfolio, [
      component("crypto", "Выживаемость", {
        survivalBlockers: ["После шока нет покупательской способности"],
      }),
    ]);

    expect(recs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "Не добавлять риск: после шока нет покупательской способности",
          critical: true,
        }),
      ]),
    );
  });

  it("блокер дисциплины не теряется, даже если луч не передали как слабый", () => {
    const recs = buildCoreRecs([], portfolio, [
      component("flexibility", "Дисциплина", {
        disciplineBlockers: ["Активен дисциплинарный блокер"],
      }),
    ]);

    expect(recs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "Пауза на новые сделки: активен дисциплинарный блокер",
          critical: true,
        }),
      ]),
    );
  });

  it("жёсткие блокировки идут раньше обычных рекомендаций", () => {
    const recs = buildCoreRecs([], portfolio, [
      component("reserve", "Резерв", {
        reserveWarnings: ["Резерв ниже необходимого остатка 30%"],
      }),
      component("flexibility", "Дисциплина", {
        disciplineBlockers: ["Обнаружена сделка-месть"],
      }),
    ]);

    expect(recs[0]).toEqual(
      expect.objectContaining({
        action: "Пауза на новые сделки: обнаружена сделка-месть",
        critical: true,
      }),
    );
  });

  it("показывает рекомендацию по простою капитала, если резерв выше 60%", () => {
    const recs = buildCoreRecs([], {
      ...portfolio,
      totalInvested: 680.2,
      stableReserve: 464.62,
      reserveShare: 0.68,
    }, [
      component("reserve", "Резерв", {
        reserveWarnings: ["Резерв выше 60% — капитал простаивает!"],
        reserveIdleUsd: 56.5,
        reserveBaseUsd: 680.2,
        reserveBandMaxUsd: 408.12,
        reserveShare: 0.68,
      }, 79),
    ]);

    expect(recs).toContainEqual(
      expect.objectContaining({
        action: "$56.50 нужно пустить в работу",
        source: expect.stringContaining("Резерв выше 60% — капитал простаивает"),
      }),
    );
  });

  it("показывает не больше пяти рекомендаций с реальным приростом здоровья", () => {
    const healthInput: HealthInput = {
      cashShare: 0.08,
      reserveShare: 0.08,
      cryptoShare: 0.7,
      futuresShare: 0.16,
      largestShare: 0.45,
      riskCategoryShares: [0.7, 0, 0],
      portfolioValue: 1000,
      investedCapital: 600,
      concentrationScore: 52,
      maxAssetLimitUtilization: 1.4,
      worstConcentrationAsset: "TON",
      worstConcentrationLimit: 0.1,
      worstConcentrationShare: 0.14,
      worstConcentrationPortfolioShare: 0.1,
      overLimitAssets: ["TON"],
      altcoinSlotsUsed: 4,
      altcoinSlotsTotal: 3,
      spotDeployableUsd: 20,
      futuresLegs: [
        { asset: "TON LONG", leverage: 3, liqDistance: 0.08 },
        { asset: "BTC SHORT", leverage: 4, liqDistance: 0.12 },
        { asset: "SOL LONG", leverage: 3, liqDistance: 0.2 },
        { asset: "ETH LONG", leverage: 3, liqDistance: 0.2 },
      ],
      disciplineJournalCoverage: 0.3,
      fomoEvents30d: 2,
      revengeTrades30d: 1,
      overtradingDays30d: 3,
      disciplineCooldownActive: true,
    };

    const recs = buildCoreRecs(
      [
        component("reserve", "Резерв", { reserveBlockers: ["Резерв ниже неприкосновенной части 10%"] }, 20),
        component("diversification", "Диверсификация", {
          diversificationBlockers: ["Рисковый капитал в одном спотовом классе"],
        }, 0),
        component("crypto", "Выживаемость", {
          survivalBlockers: ["После шока нет покупательской способности"],
        }, 25),
        component("futures", "Контроль риска", {
          riskControlBlockers: ["Превышен лимит 10% активной торговли"],
          futuresBreachUsd: 36,
          futuresUsedUsd: 96,
          futuresCapUsd: 60,
          worstLiqAsset: "TON LONG",
          worstLiqDistance: 0.08,
        }, 30),
        component("concentration", "Концентрация", {
          concentrationBlockers: ["Актив выше своего лимита"],
          worstConcentrationAsset: "TON",
          worstConcentrationLimit: 0.1,
          worstConcentrationShare: 0.14,
          maxAssetLimitUtilization: 1.4,
          overLimitAssets: ["TON"],
        }, 52),
        component("flexibility", "Дисциплина", {
          disciplineBlockers: ["Активен дисциплинарный блокер"],
        }, 25),
      ],
      portfolio,
      [
        component("reserve", "Резерв", { reserveBlockers: ["Резерв ниже неприкосновенной части 10%"] }, 20),
        component("diversification", "Диверсификация", {
          diversificationBlockers: ["Рисковый капитал в одном спотовом классе"],
        }, 0),
        component("crypto", "Выживаемость", {
          survivalBlockers: ["После шока нет покупательской способности"],
        }, 25),
        component("futures", "Контроль риска", {
          riskControlBlockers: ["Превышен лимит 10% активной торговли"],
          futuresBreachUsd: 36,
          futuresUsedUsd: 96,
          futuresCapUsd: 60,
          worstLiqAsset: "TON LONG",
          worstLiqDistance: 0.08,
        }, 30),
        component("concentration", "Концентрация", {
          concentrationBlockers: ["Актив выше своего лимита"],
          worstConcentrationAsset: "TON",
          worstConcentrationLimit: 0.1,
          worstConcentrationShare: 0.14,
          maxAssetLimitUtilization: 1.4,
          overLimitAssets: ["TON"],
        }, 52),
        component("flexibility", "Дисциплина", {
          disciplineBlockers: ["Активен дисциплинарный блокер"],
        }, 25),
      ],
      healthInput,
    );

    expect(recs).toHaveLength(5);
    expect(recs.every((rec) => rec.gain > 0)).toBe(true);
    expect(recs.every((rec) => /здоровье \+\d+$/.test(rec.source))).toBe(true);
  });

  it("убирает выполненные рекомендации с нулевым приростом", () => {
    const perfectInput: HealthInput = {
      cashShare: 0.4,
      reserveShare: 0.4,
      cryptoShare: 0.2,
      futuresShare: 0,
      largestShare: 0.05,
      riskCategoryShares: [0.2, 0.1, 0.1],
      portfolioValue: 1000,
      investedCapital: 600,
      concentrationScore: 100,
      maxAssetLimitUtilization: 0.5,
      overLimitAssets: [],
      spotDeployableUsd: 250,
      plannedLimitOrdersUsd: 150,
      disciplineJournalCoverage: 1,
      disciplineViolations30d: 0,
      fomoEvents30d: 0,
      revengeTrades30d: 0,
      overtradingDays30d: 0,
      disciplineCooldownActive: false,
      futuresLegs: [],
    };

    const recs = buildCoreRecs(
      [
        component("futures", "Контроль риска", {}, 100),
      ],
      {
        ...portfolio,
        deployableCapital: 300,
        reserveShare: 0.4,
        stableReserve: 400,
      },
      [
        component("futures", "Контроль риска", {
          futuresUsedUsd: 60,
          futuresCapUsd: 60,
          futuresRemainingUsd: 0,
          futuresBreachUsd: 0,
          riskControlBlockers: [],
        }, 100),
      ],
      perfectInput,
    );

    expect(recs).toEqual([]);
  });

  it("не показывает рекомендации на докупку классов, если резерв ниже пола", () => {
    const recs = buildCoreRecs(
      [
        component("reserve", "Резерв", { reserveBlockers: ["Резерв ниже неприкосновенной части 10%"] }, 20),
        component("diversification", "Диверсификация", {
          missingClassNames: ["Металлы", "Акции"],
        }, 10),
      ],
      {
        ...portfolio,
        reserveShare: 0.04,
        stableReserve: 40,
        deployableCapital: 20,
      },
      [
        component("reserve", "Резерв", { reserveBlockers: ["Резерв ниже неприкосновенной части 10%"] }, 20),
        component("diversification", "Диверсификация", {
          missingClassNames: ["Металлы", "Акции"],
        }, 10),
      ],
    );

    expect(recs.map((rec) => rec.action).some((action) => action.startsWith("Добавить"))).toBe(false);
    expect(recs.map((rec) => rec.action).some((action) => action.startsWith("Не открывать новые позиции"))).toBe(true);
  });

  it("строит правую доску из предупреждений карточек и общих рекомендаций", () => {
    const recs = buildHealthBoardRecs(
      [],
      {
        ...portfolio,
        totalInvested: 680.2,
        stableReserve: 464.62,
        reserveShare: 0.68,
      },
      [
        component("reserve", "Резерв", {
          reserveWarnings: ["Резерв выше 60% — капитал простаивает!"],
          reserveIdleUsd: 56.5,
          reserveBaseUsd: 680.2,
          reserveBandMaxUsd: 408.12,
          reserveShare: 0.68,
        }, 79),
        component("concentration", "Концентрация", {
          concentrationWarnings: ["Все 3 альткоин-места заняты"],
        }, 82),
      ],
    );

    expect(recs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "$56.50 нужно пустить в работу",
          source: expect.stringContaining("Резерв: Резерв выше 60%"),
        }),
        expect.objectContaining({
          action: "Не добавлять новый актив, пока место не освободится",
          source: expect.stringContaining("Концентрация: Все 3 альткоин-места заняты"),
        }),
      ]),
    );
  });
});
