import { describe, expect, it } from "vitest";
import type { HealthComponent, HealthComponentMeta } from "../../src/lib/portfolioHealth";
import { buildCoreRecs } from "../../src/v2/lib/healthCoreHelpers";
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
): HealthComponent {
  return {
    key,
    label,
    score: 80,
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
        reserveWarnings: ["Резерв ниже цели 30%"],
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
});
