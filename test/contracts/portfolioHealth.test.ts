import { describe, expect, it } from "vitest";
import {
  computeDiversificationScore,
  computePortfolioHealth,
  findHealthComponentByKey,
  liquidationPenalty,
  toHealthComponentV2Key,
  toLegacyHealthComponentKey,
  type HealthInput,
} from "../../src/lib/portfolioHealth";

const base: HealthInput = {
  cashShare: 0.3,
  cryptoShare: 0.4,
  futuresShare: 0.02,
  largestShare: 0.2,
  riskCategoryShares: [0.4, 0.05, 0],
  reserveShare: 0.3,
  portfolioValue: 1000,
};

const conc = (h: ReturnType<typeof computePortfolioHealth>) =>
  h.components.find((c) => c.key === "concentration")!;
const reserve = (h: ReturnType<typeof computePortfolioHealth>) =>
  h.components.find((c) => c.key === "reserve")!;
const div = (h: ReturnType<typeof computePortfolioHealth>) =>
  h.components.find((c) => c.key === "diversification")!;
const survival = (h: ReturnType<typeof computePortfolioHealth>) =>
  h.components.find((c) => c.key === "crypto")!;
const discipline = (h: ReturnType<typeof computePortfolioHealth>) =>
  h.components.find((c) => c.key === "flexibility")!;
const scoreOf = (h: ReturnType<typeof computePortfolioHealth>, key: string) =>
  h.components.find((c) => c.key === key)!.score;

describe("health concentration — per-asset score passthrough", () => {
  it("возвращает канонические v2-ключи без ломки legacy-ключей", () => {
    const h = computePortfolioHealth(base);

    expect(h.components.map((component) => [component.key, component.v2Key])).toEqual([
      ["reserve", "reserve"],
      ["crypto", "survival"],
      ["futures", "riskControl"],
      ["concentration", "concentration"],
      ["diversification", "diversification"],
      ["flexibility", "discipline"],
    ]);
    expect(toHealthComponentV2Key("crypto")).toBe("survival");
    expect(toHealthComponentV2Key("futures")).toBe("riskControl");
    expect(toHealthComponentV2Key("flexibility")).toBe("discipline");
    expect(toLegacyHealthComponentKey("survival")).toBe("crypto");
    expect(toLegacyHealthComponentKey("riskControl")).toBe("futures");
    expect(toLegacyHealthComponentKey("discipline")).toBe("flexibility");
    expect(findHealthComponentByKey(h.components, "survival")).toBe(survival(h));
    expect(findHealthComponentByKey(h.components, "riskControl")?.label).toBe("Контроль риска");
    expect(findHealthComponentByKey(h.components, "discipline")).toBe(discipline(h));
  });

  it("резерв: ниже пола 10% включает жёсткую блокировку", () => {
    const h = computePortfolioHealth({
      ...base,
      reserveShare: 0.05,
      cashShare: 0.05,
      portfolioValue: 1000,
    });
    const r = reserve(h);
    expect(r.label).toBe("Резерв");
    expect(r.score).toBe(15);
    expect(r.meta?.reserveBlockers).toEqual(["Резерв ниже пола 10%"]);
    expect(r.meta?.reserveFloorShortfallUsd).toBeCloseTo(50, 2);
    expect(r.meta?.reserveTargetShortfallUsd).toBeCloseTo(250, 2);
  });

  it("резерв: коридор 30–60% даёт норму без блокировок и предупреждений", () => {
    const h = computePortfolioHealth({
      ...base,
      reserveShare: 0.3,
      cashShare: 0.3,
      portfolioValue: 1000,
    });
    const r = reserve(h);
    expect(r.score).toBe(100);
    expect(r.meta?.reserveBlockers).toEqual([]);
    expect(r.meta?.reserveWarnings).toEqual([]);
    expect(r.meta?.reserveFormula).toEqual([
      "Текущий резерв: 30%",
      "Пол: 10%",
      "Цель: 30%",
      "Норма: 30–60%",
    ]);
  });

  it("резерв: выше 60% предупреждает о простаивающем капитале", () => {
    const h = computePortfolioHealth({
      ...base,
      reserveShare: 0.7,
      cashShare: 0.7,
      portfolioValue: 1000,
    });
    const r = reserve(h);
    expect(r.score).toBe(75);
    expect(r.meta?.reserveBlockers).toEqual([]);
    expect(r.meta?.reserveWarnings).toEqual(["Резерв выше 60% — капитал простаивает"]);
    expect(r.meta?.reserveIdleUsd).toBeCloseTo(100, 2);
  });

  it("готовый concentrationScore используется как есть", () => {
    const h = computePortfolioHealth({ ...base, concentrationScore: 63 });
    expect(conc(h).score).toBe(63);
  });

  it("перевес одного актива — балл снижен, но не 0 + меты худшего актива", () => {
    const h = computePortfolioHealth({
      ...base,
      concentrationScore: 56,
      maxAssetLimitUtilization: 4.2,
      worstConcentrationAsset: "TON",
      worstConcentrationLimit: 0.1,
      worstConcentrationShare: 0.42,
      worstConcentrationPortfolioShare: 0.156,
      overLimitAssets: ["TON"],
    });
    expect(conc(h).score).toBe(56);
    expect(conc(h).score).toBeGreaterThan(0);
    expect(conc(h).meta?.worstConcentrationAsset).toBe("TON");
    expect(conc(h).meta?.overLimitAssets).toEqual(["TON"]);
    expect(conc(h).meta?.concentrationBlockers).toEqual(["Актив выше своего лимита"]);
    expect(conc(h).meta?.concentrationWarnings).toEqual([]);
    expect(conc(h).meta?.concentrationFormula).toEqual([
      "Балл концентрации: 56/100",
      "Худший актив: TON",
      "Доля к лимиту: 420%",
      "Текущая доля: 42%",
      "Лимит худшего актива: 10%",
      "Альткоин-места: нет данных",
      "Места акций: нет данных",
      "Места металлов: нет данных",
    ]);
  });

  it("концентрация: близко к лимиту — предупреждение без блокировки", () => {
    const h = computePortfolioHealth({
      ...base,
      concentrationScore: 82,
      maxAssetLimitUtilization: 0.9,
      worstConcentrationAsset: "BTC",
      worstConcentrationLimit: 0.2,
      worstConcentrationShare: 0.18,
      worstConcentrationPortfolioShare: 0.12,
      overLimitAssets: [],
    });
    expect(conc(h).meta?.concentrationBlockers).toEqual([]);
    expect(conc(h).meta?.concentrationWarnings).toEqual(["Актив близко к своему лимиту"]);
  });

  it("концентрация: 3 альткоин-места заняты — предупреждение", () => {
    const h = computePortfolioHealth({
      ...base,
      concentrationScore: 78,
      maxAssetLimitUtilization: 0.7,
      worstConcentrationAsset: "ATOM",
      worstConcentrationLimit: 0.05,
      worstConcentrationShare: 0.035,
      worstConcentrationPortfolioShare: 0.02,
      overLimitAssets: [],
      altcoinSlotsUsed: 3,
      altcoinSlotsTotal: 3,
      altcoinSlotsFree: 0,
      altcoins: ["ATOM", "INJ", "SEI"],
    });
    expect(conc(h).meta?.concentrationBlockers).toEqual([]);
    expect(conc(h).meta?.concentrationWarnings).toEqual(["Все 3 альткоин-места заняты"]);
    expect(conc(h).meta?.concentrationFormula).toContain("Альткоин-места: 3/3");
  });

  it("концентрация: больше 3 альткоинов — жёсткая блокировка", () => {
    const h = computePortfolioHealth({
      ...base,
      concentrationScore: 72,
      maxAssetLimitUtilization: 0.7,
      worstConcentrationAsset: "ATOM",
      worstConcentrationLimit: 0.05,
      worstConcentrationShare: 0.035,
      worstConcentrationPortfolioShare: 0.02,
      overLimitAssets: [],
      altcoinSlotsUsed: 4,
      altcoinSlotsTotal: 3,
      altcoinSlotsFree: 0,
      altcoins: ["ATOM", "INJ", "SEI", "PEPE"],
    });
    expect(conc(h).meta?.concentrationBlockers).toEqual(["Превышен лимит альткоин-мест"]);
  });

  it("концентрация: 2 места акций заняты — предупреждение", () => {
    const h = computePortfolioHealth({
      ...base,
      concentrationScore: 88,
      maxAssetLimitUtilization: 0.7,
      worstConcentrationAsset: "AAPL",
      worstConcentrationLimit: 0.05,
      worstConcentrationShare: 0.035,
      worstConcentrationPortfolioShare: 0.035,
      overLimitAssets: [],
      stockSlotsUsed: 2,
      stockSlotsTotal: 2,
      stockSlotsFree: 0,
      stocks: ["AAPL", "MSFT"],
    });
    expect(conc(h).meta?.concentrationWarnings).toEqual(["Все 2 места акций заняты"]);
    expect(conc(h).meta?.concentrationFormula).toContain("Места акций: 2/2");
  });

  it("концентрация: больше 2 металлов — жёсткая блокировка", () => {
    const h = computePortfolioHealth({
      ...base,
      concentrationScore: 80,
      maxAssetLimitUtilization: 0.7,
      worstConcentrationAsset: "GOLD",
      worstConcentrationLimit: 0.05,
      worstConcentrationShare: 0.035,
      worstConcentrationPortfolioShare: 0.035,
      overLimitAssets: [],
      metalSlotsUsed: 3,
      metalSlotsTotal: 2,
      metalSlotsFree: 0,
      metals: ["GOLD", "NICKEL", "SILVER"],
    });
    expect(conc(h).meta?.concentrationBlockers).toEqual(["Превышен лимит мест металлов"]);
    expect(conc(h).meta?.concentrationFormula).toContain("Места металлов: 3/2");
  });

  it("фьючерсы: свободный остаток до лимита не снимает баллы", () => {
    // 4.7% из лимита 10% → лимит не превышен. Капитал 603.8 → лимит 60.38, занято 28.38.
    const h = computePortfolioHealth({
      ...base,
      futuresShare: 0.047,
      investedCapital: 603.8,
      futuresLegs: [],
    });
    const f = h.components.find((c) => c.key === "futures")!;
    expect(f.meta?.futuresCapUsd).toBeCloseTo(60.38, 1);
    expect(f.meta?.futuresUsedUsd).toBeCloseTo(28.38, 1);
    expect(f.meta?.futuresRemainingUsd).toBeCloseTo(32.0, 0);
    expect(f.meta?.futuresBreachUsd).toBeCloseTo(0, 2);
    expect(f.score).toBe(100);
  });

  it("фьючерсы: ровно 10% лимита не штрафуется", () => {
    const h = computePortfolioHealth({
      ...base,
      futuresShare: 0.10,
      investedCapital: 603.8,
      futuresLegs: [],
    });
    const f = h.components.find((c) => c.key === "futures")!;
    expect(f.meta?.futuresRemainingUsd).toBeCloseTo(0, 2);
    expect(f.meta?.futuresBreachUsd).toBeCloseTo(0, 2);
    expect(f.meta?.riskControlBlockers).toEqual([]);
    expect(f.score).toBe(100);
  });

  it("фьючерсы: превышение лимита штрафуется, свободный остаток нет", () => {
    const under = computePortfolioHealth({ ...base, futuresShare: 0, investedCapital: 600, futuresLegs: [] });
    const middle = computePortfolioHealth({ ...base, futuresShare: 0.05, investedCapital: 600, futuresLegs: [] });
    const exact = computePortfolioHealth({ ...base, futuresShare: 0.10, investedCapital: 600, futuresLegs: [] });
    const over = computePortfolioHealth({ ...base, futuresShare: 0.15, investedCapital: 600, futuresLegs: [] });
    const s = (h: ReturnType<typeof computePortfolioHealth>) =>
      h.components.find((c) => c.key === "futures")!.score;
    expect(s(under)).toBe(100);
    expect(s(middle)).toBe(100);
    expect(s(exact)).toBe(100);
    expect(s(over)).toBeLessThan(s(under));
    expect(over.components.find((c) => c.key === "futures")!.meta?.futuresBreachUsd).toBeCloseTo(30, 2);
  });

  it("контроль риска: жёсткие блокировки попадают в мету луча", () => {
    const h = computePortfolioHealth({
      ...base,
      futuresShare: 0.16,
      investedCapital: 600,
      futuresLegs: [
        { asset: "MNT LONG", leverage: 3, liqDistance: 0.08 },
        { asset: "TON LONG", leverage: 2, liqDistance: 0.5 },
        { asset: "BTC SHORT", leverage: 3, liqDistance: 0.5 },
        { asset: "SOL LONG", leverage: 1.5, liqDistance: 0.5 },
      ],
    });
    const f = h.components.find((c) => c.key === "futures")!;
    expect(f.label).toBe("Контроль риска");
    expect(f.meta?.riskControlBlockers).toEqual([
      "Превышен лимит 10% активной торговли",
      "Превышено допустимое плечо",
      "Открыто больше 3 активных позиций",
      "Ликвидация слишком близко",
    ]);
    expect(f.meta?.riskControlFormula).toEqual([
      `Лимит активной торговли: ${f.meta?.weightScore}/100`,
      `Плечо: ${f.meta?.leverageScore}/100`,
      `Число позиций: ${f.meta?.countScore}/100`,
      `Запас до ликвидации: ${f.meta?.liquidationScore}/100`,
    ]);
  });

  it("близость к ликвидации: чем ближе — тем больше штраф", () => {
    expect(liquidationPenalty(0.5)).toBe(0); // далеко — без штрафа
    expect(liquidationPenalty(null)).toBe(0); // нет данных — не штрафуем
    expect(liquidationPenalty(0.05)).toBe(30); // критично — полный штраф
    expect(liquidationPenalty(0.2)).toBeGreaterThan(0);
    expect(liquidationPenalty(0.2)).toBeLessThan(30);
    // монотонность: ближе к ликвидации → штраф не меньше
    expect(liquidationPenalty(0.1)).toBeGreaterThan(liquidationPenalty(0.3));
  });

  it("фьючерсы: близкая ликвидация роняет балл и попадает в мету", () => {
    const h = computePortfolioHealth({
      ...base,
      futuresShare: 0.10,
      investedCapital: 600,
      futuresLegs: [{ asset: "MNT LONG", leverage: 2, liqDistance: 0.06 }],
    });
    const f = h.components.find((c) => c.key === "futures")!;
    expect(f.meta?.worstLiqAsset).toBe("MNT LONG");
    expect(f.meta?.worstLiqDistance).toBeCloseTo(0.06, 3);
    expect(f.score).toBeLessThan(75); // штраф за ликвидацию ощутимый
  });

  it("выживаемость: стресс-сценарий выдержан при достаточном резерве", () => {
    const h = computePortfolioHealth({
      ...base,
      reserveShare: 0.3,
      cashShare: 0.3,
      riskCategoryShares: [0.4, 0.05, 0],
      futuresShare: 0.02,
      portfolioValue: 1000,
    });
    const s = survival(h);
    expect(s.label).toBe("Выживаемость");
    expect(s.meta?.survivalWorstScenario).toBe("Общий рыночный шок");
    expect(s.meta?.survivalShockLossPct).toBeCloseTo(0.285, 3);
    expect(s.meta?.survivalReserveAfterShockShare).toBeCloseTo(0.42, 3);
    expect(s.meta?.survivalBuyPowerAfterShockUsd).toBeCloseTo(228.5, 1);
    expect(s.meta?.survivalBlockers).toEqual([]);
    expect(s.meta?.survivalWarnings).toEqual(["План лимитных ордеров не подключён"]);
    expect(s.meta?.survivalFormula).toContain("Балл выживаемости: 88/100");
  });

  it("выживаемость: слабая покупательская способность и большая просадка включают блокировки", () => {
    const h = computePortfolioHealth({
      ...base,
      reserveShare: 0.03,
      cashShare: 0.03,
      riskCategoryShares: [0.9, 0, 0],
      futuresShare: 0.1,
      portfolioValue: 1000,
    });
    const s = survival(h);
    expect(s.meta?.survivalWorstScenario).toBe("Крах крипты");
    expect(s.meta?.survivalShockLossPct).toBeCloseTo(0.64, 3);
    expect(s.meta?.survivalBuyPowerAfterShockUsd).toBeCloseTo(0, 3);
    expect(s.meta?.survivalBlockers).toEqual([
      "Худший сценарий даёт просадку выше 60%",
      "После шока нет покупательской способности",
    ]);
    expect(s.score).toBeLessThan(40);
  });

  it("дисциплина: без подключённого журнала не ставит 100 и показывает предупреждения", () => {
    const h = computePortfolioHealth(base);
    const d = discipline(h);
    expect(d.label).toBe("Дисциплина");
    expect(d.score).toBe(70);
    expect(d.meta?.disciplineWarnings).toEqual([
      "Журнал решений не подключён",
      "Поведенческие маркеры не подключены",
    ]);
    expect(d.meta?.disciplineFormula).toEqual([
      "Журнал решений: 60/100",
      "Поведение: 60/100",
      "Блокеры: 100/100",
      "План лимитных ордеров: 60/100",
      "Нарушений за 30 дней: нет данных",
      "Балл дисциплины: 70/100",
    ]);
  });

  it("дисциплина: подготовленные лимитные ордера дают плюс к процессу", () => {
    const withoutOrders = discipline(computePortfolioHealth({
      ...base,
      disciplineJournalCoverage: 0.8,
      disciplineViolations30d: 0,
      fomoEvents30d: 0,
      revengeTrades30d: 0,
      overtradingDays30d: 0,
      plannedLimitOrdersUsd: 0,
    }));
    const withOrders = discipline(computePortfolioHealth({
      ...base,
      disciplineJournalCoverage: 0.8,
      disciplineViolations30d: 0,
      fomoEvents30d: 0,
      revengeTrades30d: 0,
      overtradingDays30d: 0,
      plannedLimitOrdersUsd: 120,
    }));

    expect(withoutOrders.meta?.disciplinePlanScore).toBe(50);
    expect(withOrders.meta?.disciplinePlanScore).toBe(100);
    expect(withOrders.score).toBeGreaterThan(withoutOrders.score);
  });

  it("дисциплина: сделка-месть, переторговка и страх упустить рост включают блокировки", () => {
    const h = computePortfolioHealth({
      ...base,
      disciplineJournalCoverage: 0.4,
      fomoEvents30d: 2,
      revengeTrades30d: 1,
      overtradingDays30d: 3,
      disciplineCooldownActive: true,
    });
    const d = discipline(h);
    expect(d.meta?.disciplineBlockers).toEqual([
      "Активен дисциплинарный блокер",
      "Обнаружена сделка-месть",
      "Обнаружена переторговка",
      "Повторяется покупка из страха упустить рост",
    ]);
    expect(d.score).toBeLessThan(40);
  });

  it("здоровье 100 достижимо в защитной версии стратегии с подключёнными источниками", () => {
    const h = computePortfolioHealth({
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
      worstConcentrationAsset: "ETH",
      worstConcentrationLimit: 0.35,
      worstConcentrationShare: 0.175,
      worstConcentrationPortfolioShare: 0.05,
      overLimitAssets: [],
      altcoinSlotsUsed: 2,
      altcoinSlotsTotal: 3,
      altcoinSlotsFree: 1,
      stockSlotsUsed: 1,
      stockSlotsTotal: 2,
      stockSlotsFree: 1,
      metalSlotsUsed: 1,
      metalSlotsTotal: 2,
      metalSlotsFree: 1,
      spotDeployableUsd: 250,
      plannedLimitOrdersUsd: 150,
      disciplineJournalCoverage: 1,
      disciplineViolations30d: 0,
      fomoEvents30d: 0,
      revengeTrades30d: 0,
      overtradingDays30d: 0,
      disciplineCooldownActive: false,
      futuresLegs: [],
    });

    expect(h.healthFactor).toBe(100);
    expect(scoreOf(h, "reserve")).toBe(100);
    expect(scoreOf(h, "crypto")).toBe(100);
    expect(scoreOf(h, "futures")).toBe(100);
    expect(scoreOf(h, "concentration")).toBe(100);
    expect(scoreOf(h, "diversification")).toBe(100);
    expect(scoreOf(h, "flexibility")).toBe(100);
    expect(h.components.flatMap((component) => [
      ...(component.meta?.reserveBlockers ?? []),
      ...(component.meta?.riskControlBlockers ?? []),
      ...(component.meta?.concentrationBlockers ?? []),
      ...(component.meta?.diversificationBlockers ?? []),
      ...(component.meta?.survivalBlockers ?? []),
      ...(component.meta?.disciplineBlockers ?? []),
    ])).toEqual([]);
  });

  it("максимально загруженный риск-бюджет не маскируется под идеальные 100 здоровья", () => {
    const h = computePortfolioHealth({
      cashShare: 0.3,
      reserveShare: 0.3,
      cryptoShare: 0.4,
      futuresShare: 0.1,
      largestShare: 0.05,
      riskCategoryShares: [0.4, 0.1, 0.1],
      portfolioValue: 1000,
      investedCapital: 600,
      concentrationScore: 100,
      maxAssetLimitUtilization: 0.5,
      worstConcentrationAsset: "ETH",
      worstConcentrationLimit: 0.35,
      worstConcentrationShare: 0.175,
      worstConcentrationPortfolioShare: 0.05,
      overLimitAssets: [],
      altcoinSlotsUsed: 2,
      altcoinSlotsTotal: 3,
      altcoinSlotsFree: 1,
      stockSlotsUsed: 1,
      stockSlotsTotal: 2,
      stockSlotsFree: 1,
      metalSlotsUsed: 1,
      metalSlotsTotal: 2,
      metalSlotsFree: 1,
      spotDeployableUsd: 240,
      plannedLimitOrdersUsd: 150,
      disciplineJournalCoverage: 1,
      disciplineViolations30d: 0,
      fomoEvents30d: 0,
      revengeTrades30d: 0,
      overtradingDays30d: 0,
      disciplineCooldownActive: false,
      futuresLegs: [],
    });
    const s = survival(h);

    expect(s.meta?.survivalWorstScenario).toBe("Общий рыночный шок");
    expect(s.meta?.survivalShockLossPct).toBeCloseTo(0.42, 3);
    expect(s.meta?.survivalWarnings).toContain("Худший сценарий даёт просадку выше 40%");
    expect(s.score).toBeLessThan(100);
    expect(h.healthFactor).toBeLessThan(100);
    expect(h.healthFactor).toBeGreaterThanOrEqual(90);
  });

  it("без concentrationScore → legacy по largestShare (35% лимит)", () => {
    const h = computePortfolioHealth({ ...base, largestShare: 0.5 });
    expect(conc(h).score).toBe(0); // largestShare 0.5 = CONCENTRATION_HARD
    expect(conc(h).meta?.concentrationFormula).toEqual([
      "Балл концентрации: 0/100",
      "Крупнейшая позиция: 50% портфеля",
      "Лимит legacy-модели: 35% портфеля",
    ]);
  });
});

describe("диверсификация калибруется по манифесту, а не по равным долям", () => {
  it("портфель, идеально собранный по лимитам политики, даёт 100", () => {
    // Резерв 30% и фьючерсы 10% → на рисковый спот 60%: крипта 40, металлы 10, акции 10.
    expect(computeDiversificationScore([40, 10, 10])).toBe(100);
  });

  it("диверсификация: идеальная структура не даёт блокировок и предупреждений", () => {
    const h = computePortfolioHealth({
      ...base,
      riskCategoryShares: [0.4, 0.1, 0.1],
      portfolioValue: 1000,
    });
    const d = div(h);
    expect(d.score).toBe(100);
    expect(d.meta?.activeClassCount).toBe(3);
    expect(d.meta?.diversificationBlockers).toEqual([]);
    expect(d.meta?.diversificationWarnings).toEqual([]);
  });

  it("диверсификация: один спотовый класс включает блокировку", () => {
    const h = computePortfolioHealth({
      ...base,
      riskCategoryShares: [0.6, 0, 0],
      portfolioValue: 1000,
    });
    const d = div(h);
    expect(d.score).toBe(0);
    expect(d.meta?.largestClassName).toBe("Крипта");
    expect(d.meta?.activeClassCount).toBe(1);
    expect(d.meta?.diversificationBlockers).toEqual(["Рисковый капитал в одном спотовом классе"]);
    expect(d.meta?.missingClassNames).toEqual(["Металлы", "Акции"]);
  });

  it("диверсификация: отсутствующий класс даёт предупреждение без жёсткой блокировки", () => {
    const h = computePortfolioHealth({
      ...base,
      riskCategoryShares: [0.3, 0.1, 0],
      portfolioValue: 1000,
    });
    const d = div(h);
    expect(d.meta?.activeClassCount).toBe(2);
    expect(d.meta?.diversificationBlockers).toEqual([]);
    expect(d.meta?.diversificationWarnings).toContain("Отсутствуют классы: акции");
  });

  it("перевес одного класса всё ещё снижает балл", () => {
    expect(computeDiversificationScore([81, 11, 8])).toBeLessThan(70);
  });

  it("весь риск в одном классе — ноль", () => {
    expect(computeDiversificationScore([100, 0, 0])).toBe(0);
  });

  it("равные доли не наказываются — тоже 100", () => {
    expect(computeDiversificationScore([33, 33, 33])).toBe(100);
  });

  it("меньше двух классов оценить нельзя", () => {
    expect(computeDiversificationScore([100])).toBe(0);
  });
});
