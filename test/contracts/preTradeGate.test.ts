import { describe, expect, it } from "vitest";
import {
  altcoinSlots,
  assetConcentration,
  cryptoAssetLimit,
  evaluateTrade,
  isCryptoMajor,
  type GateContext,
  type GatePosition,
  type TradeInput,
} from "../../src/v2/lib/preTradeGate";

// Портфель 1000$. Крипто-блок 400$ (ETH 100, SOL 40, TON 32 + прочее).
// Свободные деньги 600$. spotDeployable 200$ (зелёный лимит капитала).
// Абсолютный пол резерва 10% = 100$ → до пола можно потратить 600−100 = 500$.
// Per-asset лимиты ВНУТРИ крипто-блока: ETH 35%, BTC 20%, SOL/TON 10%, альты 5%.
const baseCtx: GateContext = {
  totalPortfolioValue: 1000,
  stableReserve: 600,
  spotDeployable: 200,
  positions: [
    { asset: "ETH", category: "Крипта", value: 100 },
    { asset: "SOL", category: "Крипта", value: 40 },
    { asset: "TON", category: "Крипта", value: 32 },
    { asset: "GOLD", category: "Металлы", value: 30 },
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
      buyAmount: 10,
      isCurrent: true,
      isAvailable: true,
      cooldownRemainingHours: 0,
    },
  ],
};

const buy = (over: Partial<TradeInput>): TradeInput => ({
  asset: "ETH",
  amountUsd: 10,
  category: "Крипта",
  ...over,
});

describe("pre-trade gate", () => {
  it("пустой ввод — idle", () => {
    expect(evaluateTrade(buy({ amountUsd: 0 }), baseCtx).status).toBe("idle");
  });

  it("крипто-добор в пределах всех лимитов — ok", () => {
    // ETH 100→120 из 420 крипто = 28.6% < 35%; капитал 20 ≤ 200.
    expect(evaluateTrade(buy({ asset: "ETH", amountUsd: 20 }), baseCtx).status).toBe("ok");
  });

  it("TON: лимит 10% крипто-блока, не 35% — block", () => {
    // TON 32→62 из 430 = 14.4% > 10% (лимит TON), хотя от портфеля это лишь 6%.
    const v = evaluateTrade(buy({ asset: "TON", amountUsd: 30 }), baseCtx);
    expect(v.status).toBe("block");
    if (v.status === "block") {
      expect(v.reasons).toContain("Доля TON в крипто-блоке");
      const tonCheck = v.checks.find((c) => c.key === "position");
      expect(tonCheck?.limit).toBeCloseTo(0.1, 6);
      // room = (0.10·400 − 32)/(1−0.10) = 8/0.9 ≈ 8.89.
      expect(v.maxSafeAmount).toBeCloseTo(8.888, 2);
    }
  });

  it("ETH: лимит 35% крипто-блока выше, чем у TON — тот же добор проходит", () => {
    // ETH 100→130 из 430 = 30.2% < 35% → ok (демонстрирует разные лимиты).
    expect(evaluateTrade(buy({ asset: "ETH", amountUsd: 30 }), baseCtx).status).toBe("ok");
  });

  it("SOL уже выше 10% крипто-блока: докупка блокируется с объяснением", () => {
    const ctx: GateContext = {
      ...baseCtx,
      positions: [
        { asset: "SOL", category: "Крипта", value: 20 },
        { asset: "ETH", category: "Крипта", value: 80 },
        { asset: "BTC", category: "Крипта", value: 75 },
        { asset: "USDC", category: "Свободные деньги", value: 402 },
      ],
      allocation: [
        { name: "Крипта", value: 175 },
        { name: "Свободные деньги", value: 402 },
      ],
    };
    const v = evaluateTrade(buy({ asset: "SOL", amountUsd: 20, category: "Крипта" }), ctx);
    expect(v.status).toBe("block");
    if (v.status === "block") {
      const positionCheck = v.checks.find((check) => check.key === "position");
      expect(positionCheck?.before).toBeCloseTo(0.114, 3);
      expect(positionCheck?.after).toBeCloseTo(0.205, 3);
      expect(positionCheck?.note).toContain("SOL уже выше лимита 10%");
      expect(v.maxAllowedAmount).toBe(0);
    }
  });

  it("новый альткоин: лимит 5% крипто-блока — block", () => {
    // PEPE 0→30 из 430 = 7% > 5%.
    const v = evaluateTrade(buy({ asset: "PEPE", amountUsd: 30 }), baseCtx);
    expect(v.status).toBe("block");
    if (v.status === "block") {
      expect(v.checks.find((c) => c.key === "position")?.limit).toBeCloseTo(0.05, 6);
    }
  });

  it("металл: один актив использует лимит 5% портфеля", () => {
    const v = evaluateTrade(buy({ asset: "GOLD", amountUsd: 40, category: "Металлы" }), baseCtx);
    const pos = v.status !== "idle" ? v.checks.find((c) => c.key === "position") : undefined;
    expect(v.status).toBe("block");
    expect(pos?.limit).toBeCloseTo(0.05, 6);
    expect(pos?.label).toBe("Доля GOLD в портфеле");
  });

  it("акция: один актив использует лимит 5% портфеля", () => {
    const v = evaluateTrade(buy({ asset: "AAPL", amountUsd: 60, category: "Акции" }), baseCtx);
    const pos = v.status !== "idle" ? v.checks.find((c) => c.key === "position") : undefined;
    expect(v.status).toBe("block");
    expect(pos?.limit).toBeCloseTo(0.05, 6);
    expect(pos?.label).toBe("Доля AAPL в портфеле");
  });

  it("заход в подушку 10–30% резерва — caution", () => {
    // USDT (кэш, без лимита класса) 300$: > spotDeployable 200, ≤ 500 (пол 10%).
    const v = evaluateTrade(
      buy({ asset: "USDT", amountUsd: 300, category: "Свободные деньги" }),
      baseCtx,
    );
    expect(v.status).toBe("caution");
    if (v.status === "caution") {
      expect(v.maxSafeAmount).toBeCloseTo(200, 6);
    }
  });

  it("пробитие абсолютного пола 10% — block", () => {
    const v = evaluateTrade(
      buy({ asset: "USDT", amountUsd: 550, category: "Свободные деньги" }),
      baseCtx,
    );
    expect(v.status).toBe("block");
    if (v.status === "block") {
      expect(v.reasons.some((r) => r.includes("Капитал"))).toBe(true);
    }
  });

  it("Fear & Greed: сумма выше ступени — предупреждение, не блок", () => {
    const v = evaluateTrade(buy({ asset: "ETH", amountUsd: 20 }), baseCtx);
    expect(v.status).toBe("ok");
    if (v.status === "ok") expect(v.fearGreed?.tone).toBe("warning");
  });

  it("концентрация: TON перевешен (42% крипто-блока при лимите 10%) — util > 4", () => {
    const positions: GatePosition[] = [
      { asset: "ETH", category: "Крипта", value: 52 }, // 52/212 = 24.5% < 35% → util 0.7
      { asset: "TON", category: "Крипта", value: 89 }, // 89/212 = 42% при лимите 10% → util 4.2
      { asset: "SOL", category: "Крипта", value: 39 },
      { asset: "GOLD", category: "Металлы", value: 25 },
      { asset: "USDC", category: "Свободные деньги", value: 300 },
    ];
    const cryptoBlock = 52 + 89 + 39; // 180
    const c = assetConcentration(positions, cryptoBlock, 505);
    expect(c.worstAsset).toBe("TON");
    expect(c.worstLimit).toBeCloseTo(0.1, 6);
    expect(c.maxUtilization).toBeGreaterThan(4); // 89/180 / 0.10 ≈ 4.9
    // Один перевешенный актив НЕ обнуляет метрику: балл снижен, но > 0.
    expect(c.score).toBeGreaterThan(0);
    expect(c.score).toBeLessThan(100);
    expect(c.overLimitAssets).toContain("TON");
  });

  it("концентрация: мелкий альт чуть выше 5% штрафует слабее крупного", () => {
    // Маленький альт INJ на 2% крипто-блока (лимит 5%? нет — 2% < 5%, в норме).
    // Возьмём INJ 6% крипто-блока (> 5%) но мал в портфеле → штраф мал.
    const small = assetConcentration(
      [
        { asset: "ETH", category: "Крипта", value: 30 },
        { asset: "INJ", category: "Крипта", value: 6 }, // 6/36=16.7% крипто, лимит 5%
        { asset: "USDC", category: "Свободные деньги", value: 964 },
      ],
      36,
      1000,
    );
    // INJ перевешен, но это лишь 0.6% портфеля → балл остаётся высоким.
    expect(small.overLimitAssets).toContain("INJ");
    expect(small.score).toBeGreaterThan(80);
  });

  it("концентрация: кэш не считается, ровно на лимите util = 1", () => {
    const positions: GatePosition[] = [
      { asset: "ETH", category: "Крипта", value: 35 }, // 35/100 = 35% ровно лимит ETH → util 1.0
      { asset: "USDC", category: "Свободные деньги", value: 900 },
    ];
    const c = assetConcentration(positions, 100, 1000);
    expect(c.worstAsset).toBe("ETH");
    expect(c.maxUtilization).toBeCloseTo(1, 6);
  });

  it("фазовый пол 30% (накопление): подушки нет — за spotDeployable сразу block", () => {
    // Пол фазы 30% → phaseFloorMax = 600 − 0.30·1000 = 300 ≈ greenMax 200 (+ USDC-часть).
    // Добор 400$ (> phaseFloorMax) роняет резерв ниже 30% → block, не caution.
    const ctx: GateContext = { ...baseCtx, reserveFloorShare: 0.3 };
    const v = evaluateTrade(
      buy({ asset: "USDT", amountUsd: 400, category: "Свободные деньги" }),
      ctx,
    );
    expect(v.status).toBe("block");
  });

  it("BNB — мажор с лимитом 10% крипто-блока (как SOL/TON)", () => {
    expect(isCryptoMajor("BNB")).toBe(true);
    expect(cryptoAssetLimit("BNB")).toBeCloseTo(0.1, 6);
    expect(cryptoAssetLimit("PEPE")).toBeCloseTo(0.05, 6); // альт по умолчанию
  });

  it("альткоин-места: мажоры вне счёта, ATOM занимает 1 из 3", () => {
    const s = altcoinSlots(["BTC", "ETH", "SOL", "TON", "BNB", "ATOM"]);
    expect(s.used).toBe(1);
    expect(s.total).toBe(3);
    expect(s.free).toBe(2);
    expect(s.altcoins).toEqual(["ATOM"]);
  });

  it("альткоин-места: заполнено — free 0", () => {
    const s = altcoinSlots(["ETH", "ATOM", "INJ", "SEI", "SEI"]);
    expect(s.used).toBe(3);
    expect(s.free).toBe(0);
  });

  it("альткоин-места: новый 4-й альткоин блокируется", () => {
    const ctx: GateContext = {
      ...baseCtx,
      positions: [
        ...baseCtx.positions,
        { asset: "ATOM", category: "Крипта", value: 5 },
        { asset: "INJ", category: "Крипта", value: 5 },
        { asset: "SEI", category: "Крипта", value: 5 },
      ],
      allocation: baseCtx.allocation.map((item) =>
        item.name === "Крипта" ? { ...item, value: 415 } : item,
      ),
    };
    const v = evaluateTrade(buy({ asset: "PEPE", amountUsd: 1, category: "Крипта" }), ctx);
    expect(v.status).toBe("block");
    if (v.status === "block") {
      const slotCheck = v.checks.find((check) => check.key === "assetSlots");
      expect(slotCheck?.before).toBe(3);
      expect(slotCheck?.after).toBe(4);
      expect(slotCheck?.limit).toBe(3);
      expect(v.reasons).toContain("Альткоин-места по 5%");
      expect(v.maxAllowedAmount).toBe(0);
    }
  });

  it("акции: новая 3-я акция блокируется", () => {
    const ctx: GateContext = {
      ...baseCtx,
      positions: [
        ...baseCtx.positions,
        { asset: "AAPL", category: "Акции", value: 10 },
        { asset: "MSFT", category: "Акции", value: 10 },
      ],
      allocation: [...baseCtx.allocation, { name: "Акции", value: 20 }],
    };
    const v = evaluateTrade(buy({ asset: "NVDA", amountUsd: 1, category: "Акции" }), ctx);
    expect(v.status).toBe("block");
    if (v.status === "block") {
      const slotCheck = v.checks.find((check) => check.key === "assetSlots");
      expect(slotCheck?.before).toBe(2);
      expect(slotCheck?.after).toBe(3);
      expect(slotCheck?.limit).toBe(2);
      expect(v.reasons).toContain("Места акций по 5%");
    }
  });

  it("металлы: новый 3-й металл блокируется", () => {
    const ctx: GateContext = {
      ...baseCtx,
      positions: [
        { asset: "GOLD", category: "Металлы", value: 10 },
        { asset: "NICKEL", category: "Металлы", value: 10 },
      ],
      allocation: [{ name: "Металлы", value: 20 }, { name: "Свободные деньги", value: 980 }],
    };
    const v = evaluateTrade(buy({ asset: "SILVER", amountUsd: 1, category: "Металлы" }), ctx);
    expect(v.status).toBe("block");
    if (v.status === "block") {
      const slotCheck = v.checks.find((check) => check.key === "assetSlots");
      expect(slotCheck?.before).toBe(2);
      expect(slotCheck?.after).toBe(3);
      expect(slotCheck?.limit).toBe(2);
      expect(v.reasons).toContain("Места металлов по 5%");
    }
  });

  it("фазовый лимит крипты 80% (агрессив) мягче базовых 60%", () => {
    // Крипта 400→650 = 65% > 60% (обычный), но ≤ 80% (агрессив) → класс ок.
    const ctx: GateContext = {
      ...baseCtx,
      reserveFloorShare: 0.1,
      cryptoMaxShare: 0.8,
      // разводим per-asset: ETH 100, лимит 35% крипто-блока не мешает малому добору
    };
    // Берём ETH небольшой суммой в пределах капитала, проверяем что класс-лимит = 80%.
    const v = evaluateTrade(buy({ asset: "ETH", amountUsd: 20 }), ctx);
    const classCheck = v.status !== "idle" ? v.checks.find((c) => c.key === "class") : undefined;
    expect(classCheck?.limit).toBeCloseTo(0.8, 6);
  });
});
