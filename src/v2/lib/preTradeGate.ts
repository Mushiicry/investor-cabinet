// Pre-trade gate — дисциплинарный шлюз для спот-добора.
//
// Не исполняет сделки: исполнение остаётся на бирже. Задача модуля —
// до сделки ответить на вопросы конституции: «можно ли сейчас добирать,
// сколько, где перегруз, не роняет ли добор резерв».
//
// Капитал под спот-добор — это ОДИН пул стейблов с двумя порогами резерва:
//   • рабочий пол стратегии — всё сверх него можно отдавать в добор;
//   • абсолютный пол стратегии — «святое», ниже не опускаемся никогда.
// Отсюда три зоны добора:
//   🟢 ok      — в пределах рабочего капитала стратегии;
//   🟡 caution — заходим в подушку стратегии, разрешено, но с пометкой;
//   🔴 block   — пробили абсолютный пол стратегии ИЛИ лимит позиции/класса.
// Лимиты позиции и класса — жёсткие (block). Fear & Greed — сверка со ступенью
// откупа. Рыночная психология может усилить её до блока в зоне эйфории.

import {
  MAX_SINGLE_RISK_ASSET_SHARE,
  RESERVE_FLOOR_SHARE,
  RESERVE_TARGET_SHARE,
  SPOT_RESERVE_FLOOR_SHARE,
} from "../../config/riskRules";
import type { CapitalBuckets } from "./capitalBuckets";
import {
  MAIN_INVESTOR_STRATEGY,
  assetLimitForStrategy,
  cryptoAssetLimitForStrategy,
  isAssetAllowedByStrategy,
  isCryptoMajorForStrategy,
  type InvestorStrategy,
} from "./investorStrategy";
import {
  MAIN_INVESTOR_PROFILE,
  evaluateInvestorProfileTrade,
  type InvestorProfile,
} from "./investorProfile";
import type { MarketPsychology } from "./marketPsychology";

/** Категория актива — совпадает с именами в allocation/positions. */
export const CRYPTO_CATEGORY = "Крипта";
export const METALS_CATEGORY = "Металлы";
export const FUTURES_CATEGORY = "Фьючерсы";
export const STOCKS_CATEGORY = "Акции";
export const CASH_CATEGORY = "Свободные деньги";

// Лимиты доли актива ВНУТРИ крипто-блока (манифест «Структура крипто-блока» +
// решение владельца: BNB на уровне SOL/TON). Считаются от стоимости крипто-блока,
// НЕ от всего портфеля. Прочие (альткоины) — 5%.
// Мажоры при полном сборе: BTC 20 + ETH 35 + SOL 10 + TON 10 + BNB 10 = 85%,
// оставшиеся 15% → 3 места для альткоинов по 5%.
export const CRYPTO_ASSET_LIMITS: Record<string, number> = MAIN_INVESTOR_STRATEGY.cryptoAssetLimits;
export const CRYPTO_ALT_LIMIT = MAIN_INVESTOR_STRATEGY.defaultCryptoAssetLimit;
export const STOCK_ASSET_LIMIT = MAIN_INVESTOR_STRATEGY.stockAssetLimit;
export const METAL_ASSET_LIMIT = MAIN_INVESTOR_STRATEGY.metalAssetLimit;

/** Мест под альткоины: 15% крипто-блока ÷ 5% = 3 (мажоры занимают 85%). */
export const MAX_ALTCOIN_SLOTS = MAIN_INVESTOR_STRATEGY.maxAltcoinSlots;
export const MAX_STOCK_SLOTS = MAIN_INVESTOR_STRATEGY.maxStockSlots;
export const MAX_METAL_SLOTS = MAIN_INVESTOR_STRATEGY.maxMetalSlots;

/** true — актив это «мажор» с именным лимитом (не альткоин). */
export function isCryptoMajor(asset: string, strategy = MAIN_INVESTOR_STRATEGY): boolean {
  return isCryptoMajorForStrategy(asset, strategy);
}

/** Лимит доли одного крипто-актива внутри крипто-блока. */
export function cryptoAssetLimit(asset: string, strategy = MAIN_INVESTOR_STRATEGY): number {
  return cryptoAssetLimitForStrategy(asset, strategy);
}

/**
 * Учёт альткоин-мест по списку крипто-активов портфеля.
 * Альткоин = крипто-позиция без именного лимита (не мажор).
 */
export function altcoinSlots(cryptoAssets: string[], strategy = MAIN_INVESTOR_STRATEGY): {
  used: number;
  total: number;
  free: number;
  altcoins: string[];
} {
  const seen = new Set<string>();
  const altcoins: string[] = [];
  for (const raw of cryptoAssets) {
    const key = raw.trim().toUpperCase();
    if (!key || seen.has(key) || isCryptoMajor(raw, strategy)) continue;
    seen.add(key);
    altcoins.push(raw.trim());
  }
  const used = altcoins.length;
  return {
    used,
    total: strategy.maxAltcoinSlots,
    free: Math.max(strategy.maxAltcoinSlots - used, 0),
    altcoins,
  };
}

function uniqueAssets(assets: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of assets) {
    const key = raw.trim().toUpperCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw.trim());
  }
  return out;
}

export function fixedClassSlots(assets: string[], total: number): {
  used: number;
  total: number;
  free: number;
  assets: string[];
} {
  const listed = uniqueAssets(assets);
  return { used: listed.length, total, free: Math.max(total - listed.length, 0), assets: listed };
}

export function assetLimit(
  category: string,
  asset: string,
  strategy = MAIN_INVESTOR_STRATEGY,
): number {
  return assetLimitForStrategy(category, asset, strategy);
}

// ── Модель «Концентрации» (двухчастная, не роняет в 0 из-за одного актива) ──
// 1) Системный риск: крупнейшая позиция как доля ВСЕГО портфеля (что реально
//    потеряешь, если она рухнет). 100 при ≤20% портфеля, 0 при ≥50%.
// 2) Дисциплина: активы сверх своего per-asset лимита дают штраф, взвешенный
//    по доле в ПОРТФЕЛЕ (мелкий альт чуть выше своих 5% почти не штрафуется) и
//    ограниченный сверху — один актив не может обнулить метрику.
const CONC_SYSTEMIC_SAFE = 0.2;
const CONC_SYSTEMIC_HARD = 0.5;
const CONC_DISCIPLINE_SCALE = 120; // множитель штрафа overage×долю_портфеля
const CONC_DISCIPLINE_CAP = 45; // максимум штрафа от одного/суммы над-лимитных
const CONC_OVERAGE_CAP = 2; // overage = util−1, но не больше 2× (≥3× лимита = «сильно»)

const clamp0to100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export type AssetConcentration = {
  score: number; // 0..100 — итоговый балл «Концентрации»
  maxUtilization: number; // худший util = доля/лимит (для объяснения)
  worstAsset: string;
  worstLimit: number;
  worstShare: number; // доля худшего актива в его базе (крипто-блок/портфель)
  worstPortfolioShare: number; // доля худшего актива в портфеле
  largestPortfolioShare: number; // системный: крупнейшая позиция портфеля
  overLimitAssets: string[]; // активы сверх своего лимита
  altcoinSlotsUsed: number;
  altcoinSlotsTotal: number;
  altcoinSlotsFree: number;
  altcoins: string[];
  stockSlotsUsed: number;
  stockSlotsTotal: number;
  stockSlotsFree: number;
  stocks: string[];
  metalSlotsUsed: number;
  metalSlotsTotal: number;
  metalSlotsFree: number;
  metals: string[];
};

/**
 * Концентрация по per-asset лимитам стратегии (единый источник со шлюзом):
 * крипто считается внутри крипто-блока, акции/металлы — по доле портфеля
 * и числу разрешённых позиций. Кэш не концентрируем.
 * Считает итоговый балл двухчастной моделью.
 */
export function assetConcentration(
  positions: GatePosition[],
  cryptoBlockValue: number,
  totalPortfolio: number,
  strategy = MAIN_INVESTOR_STRATEGY,
): AssetConcentration {
  let maxUtilization = 0;
  let worstAsset = "-";
  let worstLimit = 1;
  let worstShare = 0;
  let worstPortfolioShare = 0;
  let largestPortfolioShare = 0;
  let disciplinePenalty = 0;
  const overLimitAssets: string[] = [];
  const slots = altcoinSlots(
    positions
      .filter((position) => position.category === CRYPTO_CATEGORY && position.value > 0)
      .map((position) => position.asset),
    strategy,
  );
  const stockSlots = fixedClassSlots(
    positions
      .filter((position) => position.category === STOCKS_CATEGORY && position.value > 0)
      .map((position) => position.asset),
    strategy.maxStockSlots,
  );
  const metalSlots = fixedClassSlots(
    positions
      .filter((position) => position.category === METALS_CATEGORY && position.value > 0)
      .map((position) => position.asset),
    strategy.maxMetalSlots,
  );

  for (const p of positions) {
    if (!p.value || p.value <= 0 || p.category === CASH_CATEGORY) continue;
    const isCrypto = p.category === CRYPTO_CATEGORY;
    const base = isCrypto ? cryptoBlockValue : totalPortfolio;
    if (base <= 0) continue;
    const share = p.value / base;
    const portfolioShare = totalPortfolio > 0 ? p.value / totalPortfolio : 0;
    const limit = assetLimit(p.category, p.asset, strategy);
    const util = limit > 0 ? share / limit : 0;

    if (portfolioShare > largestPortfolioShare) largestPortfolioShare = portfolioShare;
    if (util > maxUtilization) {
      maxUtilization = util;
      worstAsset = p.asset;
      worstLimit = limit;
      worstShare = share;
      worstPortfolioShare = portfolioShare;
    }
    if (util > 1) {
      overLimitAssets.push(p.asset);
      const overage = Math.min(util - 1, CONC_OVERAGE_CAP);
      disciplinePenalty += overage * portfolioShare * CONC_DISCIPLINE_SCALE;
    }
  }

  const systemicScore =
    (CONC_SYSTEMIC_HARD - largestPortfolioShare) / (CONC_SYSTEMIC_HARD - CONC_SYSTEMIC_SAFE);
  const score = clamp0to100(
    systemicScore * 100 - Math.min(disciplinePenalty, CONC_DISCIPLINE_CAP),
  );

  return {
    score,
    maxUtilization,
    worstAsset,
    worstLimit,
    worstShare,
    worstPortfolioShare,
    largestPortfolioShare,
    overLimitAssets,
    altcoinSlotsUsed: slots.used,
    altcoinSlotsTotal: slots.total,
    altcoinSlotsFree: slots.free,
    altcoins: slots.altcoins,
    stockSlotsUsed: stockSlots.used,
    stockSlotsTotal: stockSlots.total,
    stockSlotsFree: stockSlots.free,
    stocks: stockSlots.assets,
    metalSlotsUsed: metalSlots.used,
    metalSlotsTotal: metalSlots.total,
    metalSlotsFree: metalSlots.free,
    metals: metalSlots.assets,
  };
}

/** Потолок доли класса в портфеле. null — класс без лимита (кэш). */
export function categoryCap(category: string, strategy = MAIN_INVESTOR_STRATEGY): number | null {
  switch (category) {
    case CRYPTO_CATEGORY:
      return strategy.cryptoMaxShare;
    case METALS_CATEGORY:
      return strategy.metalsMaxShare;
    case FUTURES_CATEGORY:
      return strategy.futuresAllowed ? strategy.futuresMaxShare : 0;
    case STOCKS_CATEGORY:
      return strategy.stocksMaxShare;
    default:
      return null; // Свободные деньги / неизвестный класс — не риск-добор.
  }
}

// Минимальные срезы live-данных, которых достаточно шлюзу.
export type GatePosition = {
  asset: string;
  category: string;
  value: number; // текущая стоимость позиции, $
  avgEntry?: number;
  currentPrice?: number;
  invested?: number;
};

export type GateAllocation = {
  name: string;
  value: number; // стоимость класса, $
};

export type GateFearGreedRule = {
  mode: string;
  label: string;
  buyAmount: number;
  isCurrent: boolean;
  isAvailable: boolean;
  cooldownRemainingHours: number;
};

export type GateContext = {
  totalPortfolioValue: number;
  investedCapital?: number;
  /** Вся категория «Свободные деньги», $ (для пола резерва). */
  stableReserve: number;
  /** Спот-капитал сверх рабочего пола стратегии, $. */
  spotDeployable: number;
  positions: GatePosition[];
  allocation: GateAllocation[];
  fearGreedRules: GateFearGreedRule[];
  /** Пол резерва текущей фазы, доля 0..1 (по умолчанию абсолютный 10%). */
  reserveFloorShare?: number;
  /** Максимальная доля крипты текущей фазы, доля 0..1 (по умолчанию 60%). */
  cryptoMaxShare?: number;
  /** Стратегия конкретного аккаунта. По умолчанию — основной аккаунт. */
  investorStrategy?: InvestorStrategy;
  /** Портрет конкретного инвестора. По умолчанию — основной аккаунт. */
  investorProfile?: InvestorProfile;
  /** Расклад свободных денег по карманам риска. */
  capitalBuckets?: CapitalBuckets;
  /** Поведенческий режим рынка от живого F&G. Не меняет Health, но влияет на допуск сделки. */
  marketPsychology?: Pick<MarketPsychology, "riskMode" | "gate" | "stanceLabel">;
};

export type TradeInput = {
  asset: string;
  amountUsd: number;
  /** Категория — обязательна только для нового актива (нет в positions). */
  category?: string;
};

export type GateCheckKey = "capital" | "capitalBucket" | "position" | "class" | "assetSlots" | "investorProfile";
export type GateCheckSeverity = "block" | "warn";

export type GateCheck = {
  key: GateCheckKey;
  label: string;
  ok: boolean;
  /** Мягкая (warn) или жёсткая (block) проверка при провале. */
  severity: GateCheckSeverity;
  before: number;
  after: number;
  limit: number;
  /** true — before/after/limit это доли портфеля; false — суммы в $. */
  isShare: boolean;
  /** Пояснение для проваленных/пограничных проверок. */
  note?: string;
};

export type FearGreedNote = {
  tone: "info" | "warning" | "muted";
  kind?: "рыночная_лестница" | "рыночная_психология" | "смешанная";
  text: string;
  blocks?: boolean;
};

export type GateStatus = "idle" | "ok" | "caution" | "block";

export type GateVerdict =
  | { status: "idle"; message: string }
  | {
      status: "ok" | "caution" | "block";
      checks: GateCheck[];
      /** Причины жёсткого блока. */
      reasons: string[];
      /** Пометки жёлтой зоны (напр. заход в подушку). */
      warnings: string[];
      /** Максимум полностью безопасного (зелёного) добора, $. */
      maxSafeAmount: number;
      /** Максимум допустимого добора до жёсткого блока, $ (вкл. подушку). */
      maxAllowedAmount: number;
      fearGreed: FearGreedNote | null;
    };

const clampMin0 = (n: number) => (n > 0 ? n : 0);
const EPS = 1e-6;

function categoryBudget(category: string, buckets?: CapitalBuckets): { label: string; value: number; note?: string } | null {
  if (!buckets) return null;
  if (category === CRYPTO_CATEGORY) {
    return {
      label: "Карман ручной крипты",
      value: buckets.cryptoSpotBudgetUsd,
      note: `Карман ДСА добора ${Math.round(buckets.averagingBudgetUsd)}$ не тратится ручной покупкой, но входит в плановый крипто-блок.`,
    };
  }
  if (category === METALS_CATEGORY) return { label: "Карман металлов", value: buckets.metalsBudgetUsd };
  if (category === STOCKS_CATEGORY) return { label: "Карман акций", value: buckets.stocksBudgetUsd };
  if (category === FUTURES_CATEGORY) return { label: "Карман фьючерсов", value: buckets.futuresBudgetUsd };
  return null;
}

function resolveCategory(input: TradeInput, ctx: GateContext): string {
  const existing = ctx.positions.find((p) => p.asset === input.asset);
  if (existing) return existing.category;
  return input.category ?? CASH_CATEGORY;
}

/** Мягкая сверка суммы со ступенью откупа Fear & Greed. */
function buildLadderNote(
  input: TradeInput,
  ctx: GateContext,
): FearGreedNote | null {
  const current = ctx.fearGreedRules.find((r) => r.isCurrent);
  if (!current) return null;

  if (current.mode === "observation") {
    return {
      tone: "muted",
      kind: "рыночная_лестница",
      text: "Рынок в наблюдении — плановой ступени откупа сейчас нет.",
    };
  }
  if (!current.isAvailable && current.cooldownRemainingHours > 0) {
    const hours = Math.ceil(current.cooldownRemainingHours);
    return {
      tone: "warning",
      kind: "рыночная_лестница",
      text: `Ступень «${current.label}» на кулдауне ещё ~${hours} ч — добор вне графика лестницы.`,
    };
  }
  const recommended = current.buyAmount;
  if (recommended > 0 && input.amountUsd > recommended * 1.5) {
    return {
      tone: "warning",
      kind: "рыночная_лестница",
      text: `Выше рекомендации ступени «${current.label}» (${Math.round(recommended)}$). Лестница просит меньше.`,
    };
  }
  return {
    tone: "info",
    kind: "рыночная_лестница",
    text: `Ступень «${current.label}»: рекомендация ~${Math.round(recommended)}$.`,
  };
}

function buildFearGreedNote(
  input: TradeInput,
  ctx: GateContext,
): FearGreedNote | null {
  const ladder = buildLadderNote(input, ctx);
  const psychology = ctx.marketPsychology;
  const category = resolveCategory(input, ctx);
  const isRiskIncreasingBuy = category !== CASH_CATEGORY;

  if (!psychology || !isRiskIncreasingBuy) return ladder;

  if (psychology.gate.severity === "block") {
    return {
      tone: "warning",
      kind: "рыночная_психология",
      text: psychology.gate.text,
      blocks: true,
    };
  }

  if (psychology.gate.severity === "warning") {
    const ladderWarning = ladder?.tone === "warning" ? ` ${ladder.text}` : "";
    return {
      tone: "warning",
      kind: ladderWarning ? "смешанная" : "рыночная_психология",
      text: `${psychology.gate.text}${ladderWarning}`,
    };
  }

  return ladder ?? {
    tone: "info",
    kind: "рыночная_психология",
    text: psychology.gate.text,
  };
}

/**
 * Оценивает планируемый спот-добор против политики риска.
 * Total портфеля при доборе с собственных стейблов не меняется: капитал
 * переходит из «Свободные деньги» в актив.
 */
export function evaluateTrade(input: TradeInput, ctx: GateContext): GateVerdict {
  const amount = input.amountUsd;

  if (!Number.isFinite(amount) || amount <= 0) {
    return { status: "idle", message: "Введите сумму добора." };
  }
  if (ctx.totalPortfolioValue <= 0) {
    return { status: "idle", message: "Нет данных по портфелю." };
  }

  const total = ctx.totalPortfolioValue;
  const reserveBase = ctx.investedCapital && ctx.investedCapital > 0 ? ctx.investedCapital : total;
  const strategy = ctx.investorStrategy ?? MAIN_INVESTOR_STRATEGY;
  const profile = ctx.investorProfile ?? MAIN_INVESTOR_PROFILE;
  const category = resolveCategory(input, ctx);
  const checks: GateCheck[] = [];

  // ── Капитал: единый пул с фазовым полом резерва ───────────────
  // Зелёная граница — spotDeployable (движок, спот-пол 30% уже вычтен).
  // Жёсткая граница — пол резерва ТЕКУЩЕЙ ФАЗЫ: в постепенном накоплении
  // 30% (подушки нет), в агрессивном окне открывается до 10%. Ниже фазового
  // пола — блок. reserveFloorShare приходит из marketPhases (дефолт — 10%).
  const phaseFloor = ctx.reserveFloorShare ?? strategy.reserveFloorShare;
  const greenMax = clampMin0(ctx.spotDeployable);
  const phaseFloorMax = clampMin0(ctx.stableReserve - phaseFloor * reserveBase);
  const hardMax = Math.max(greenMax, phaseFloorMax);

  const inGreen = amount <= greenMax + EPS;
  const inCushion = !inGreen && amount <= hardMax + EPS;

  checks.push({
    key: "capital",
    label: "Капитал для добора",
    ok: inGreen,
    severity: inCushion ? "warn" : "block",
    before: greenMax,
    after: greenMax - amount,
    limit: greenMax,
    isShare: false,
    note: inGreen
      ? undefined
      : inCushion
        ? `Заходишь в подушку на ${Math.round(amount - greenMax)}$ — резерв опустится ниже цели, но выше пола фазы ${Math.round(phaseFloor * 100)}%.`
        : `Пробивает пол резерва фазы ${Math.round(phaseFloor * 100)}% — так нельзя.`,
  });

  const budget = categoryBudget(category, ctx.capitalBuckets);
  if (budget) {
    const budgetOk = amount <= budget.value + EPS;
    checks.push({
      key: "capitalBucket",
      label: budget.label,
      ok: budgetOk,
      severity: "block",
      before: budget.value,
      after: budget.value - amount,
      limit: budget.value,
      isShare: false,
      note: budgetOk
        ? undefined
        : `${budget.label} сейчас ${Math.round(budget.value)}$. Остальные свободные деньги закреплены за резервом или другими карманами риска.`,
    });
  }

  // ── Лимит доли одной позиции (жёсткий) ────────────────────────
  // Крипто-активы: лимит per-asset ВНУТРИ планового крипто-блока (купленная
  // крипта + ручной крипто-спот + карман усреднения). Если карманы не переданы,
  // сохраняем старую модель: крипто-блок растёт на сумму добора.
  const posValue = ctx.positions.find((p) => p.asset === input.asset)?.value ?? 0;
  const isCryptoAsset = category === CRYPTO_CATEGORY;
  const isStockAsset = category === STOCKS_CATEGORY;
  const isMetalAsset = category === METALS_CATEGORY;
  const cryptoBlockValue = ctx.allocation.find((a) => a.name === CRYPTO_CATEGORY)?.value ?? 0;
  const assetVerdict = isAssetAllowedByStrategy(input.asset, category, strategy);
  if (!assetVerdict.allowed) {
    checks.push({
      key: "assetSlots",
      label: "Качество актива",
      ok: false,
      severity: "block",
      before: 0,
      after: 1,
      limit: 0,
      isShare: false,
      note: assetVerdict.reason,
    });
  }

  for (const profileVerdict of evaluateInvestorProfileTrade({
    asset: input.asset,
    category,
    amountUsd: amount,
    totalPortfolioValue: reserveBase,
    stableReserve: ctx.stableReserve,
    reserveTargetShare: strategy.reserveTargetShare,
    profile,
  })) {
    checks.push({
      key: "investorProfile",
      label: profileVerdict.label,
      ok: profileVerdict.ok,
      severity: profileVerdict.severity,
      before: 0,
      after: profileVerdict.ok ? 0 : 1,
      limit: 0,
      isShare: false,
      note: profileVerdict.note,
    });
  }

  const positionLimit = assetLimit(category, input.asset, strategy);
  const plannedCryptoBlock = isCryptoAsset && ctx.capitalBuckets
    ? Math.max(cryptoBlockValue, ctx.capitalBuckets.plannedCryptoBlockUsd)
    : cryptoBlockValue;
  const cryptoBudgetOverflow = isCryptoAsset && ctx.capitalBuckets
    ? clampMin0(amount - ctx.capitalBuckets.cryptoSpotBudgetUsd)
    : amount;
  const posBaseBefore = isCryptoAsset ? plannedCryptoBlock : total;
  const posBaseAfter = isCryptoAsset
    ? Math.max(plannedCryptoBlock + cryptoBudgetOverflow, cryptoBlockValue + amount)
    : total;
  const positionBeforeShare = posBaseBefore > 0 ? posValue / posBaseBefore : 0;
  const positionAfterShare = posBaseAfter > 0 ? (posValue + amount) / posBaseAfter : 0;
  const positionOk = positionAfterShare <= positionLimit + 1e-9;
  const positionLimitPct = Math.round(positionLimit * 100);
  const existingAsset = ctx.positions.find((p) => p.asset === input.asset && p.value > 0);
  const altSlots = isCryptoAsset
    ? altcoinSlots(ctx.positions.filter((p) => p.category === CRYPTO_CATEGORY && p.value > 0).map((p) => p.asset), strategy)
    : null;
  const stockSlots = isStockAsset
    ? fixedClassSlots(ctx.positions.filter((p) => p.category === STOCKS_CATEGORY && p.value > 0).map((p) => p.asset), strategy.maxStockSlots)
    : null;
  const metalSlots = isMetalAsset
    ? fixedClassSlots(ctx.positions.filter((p) => p.category === METALS_CATEGORY && p.value > 0).map((p) => p.asset), strategy.maxMetalSlots)
    : null;
  const isAltcoin = isCryptoAsset && !isCryptoMajor(input.asset, strategy);
  const isNewAltcoin =
    isAltcoin && !altSlots?.altcoins.some((asset) => asset.toUpperCase() === input.asset.trim().toUpperCase()) && !existingAsset;
  const isNewStock =
    isStockAsset && !stockSlots?.assets.some((asset) => asset.toUpperCase() === input.asset.trim().toUpperCase()) && !existingAsset;
  const isNewMetal =
    isMetalAsset && !metalSlots?.assets.some((asset) => asset.toUpperCase() === input.asset.trim().toUpperCase()) && !existingAsset;
  checks.push({
    key: "position",
    label: isCryptoAsset && ctx.capitalBuckets
      ? `Доля ${input.asset} в плановом крипто-блоке`
      : isCryptoAsset
        ? `Доля ${input.asset} в крипто-блоке`
        : `Доля ${input.asset} в портфеле`,
    ok: positionOk,
    severity: "block",
    before: positionBeforeShare,
    after: positionAfterShare,
    limit: positionLimit,
    isShare: true,
    note: positionOk
      ? undefined
      : positionBeforeShare > positionLimit
        ? `${input.asset} уже выше лимита ${positionLimitPct}%. Добор этого же актива увеличит перегруз; свободные деньги можно использовать для других активов, которые проходят лимиты.`
        : `После добора ${input.asset} станет выше лимита ${positionLimitPct}%.`,
  });

  if (isNewAltcoin && altSlots) {
    const afterSlots = altSlots.used + 1;
    checks.push({
      key: "assetSlots",
      label: strategy.maxAltcoinSlots > 0
        ? `Альткоин-места по ${Math.round(strategy.defaultCryptoAssetLimit * 100)}%`
        : "Альты вне стратегии",
      ok: afterSlots <= altSlots.total,
      severity: "block",
      before: altSlots.used,
      after: afterSlots,
      limit: altSlots.total,
      isShare: false,
      note: strategy.maxAltcoinSlots > 0
        ? `В крипто-блоке есть только ${strategy.maxAltcoinSlots} места под альткоины по ${Math.round(strategy.defaultCryptoAssetLimit * 100)}%.`
        : "Альты вне списка стратегии запрещены.",
    });
  }
  if (isNewStock && stockSlots) {
    const afterSlots = stockSlots.used + 1;
    checks.push({
      key: "assetSlots",
      label: `Места акций по ${Math.round(strategy.stockAssetLimit * 100)}%`,
      ok: afterSlots <= stockSlots.total,
      severity: "block",
      before: stockSlots.used,
      after: afterSlots,
      limit: stockSlots.total,
      isShare: false,
      note: `В портфеле есть только ${strategy.maxStockSlots} места под акции по ${Math.round(strategy.stockAssetLimit * 100)}%.`,
    });
  }
  if (isNewMetal && metalSlots) {
    const afterSlots = metalSlots.used + 1;
    checks.push({
      key: "assetSlots",
      label: `Места металлов по ${Math.round(strategy.metalAssetLimit * 100)}%`,
      ok: afterSlots <= metalSlots.total,
      severity: "block",
      before: metalSlots.used,
      after: afterSlots,
      limit: metalSlots.total,
      isShare: false,
      note: `В портфеле есть только ${strategy.maxMetalSlots} места под металлы по ${Math.round(strategy.metalAssetLimit * 100)}%.`,
    });
  }

  // ── Лимит доли класса (жёсткий, кроме кэша) ───────────────────
  // Крипта — фазовый лимит (60% обычно / 80% агрессив / 40% эйфория).
  const baseCap = categoryCap(category, strategy);
  const cap =
    baseCap !== null && isCryptoAsset && ctx.cryptoMaxShare !== undefined && strategy.id === MAIN_INVESTOR_STRATEGY.id
      ? ctx.cryptoMaxShare
      : baseCap;
  if (cap !== null) {
    const classValue = ctx.allocation.find((a) => a.name === category)?.value ?? 0;
    const classAfterShare = (classValue + amount) / total;
    checks.push({
      key: "class",
      label: `Доля «${category}» в портфеле`,
      ok: classAfterShare <= cap + 1e-9,
      severity: "block",
      before: classValue / total,
      after: classAfterShare,
      limit: cap,
      isShare: true,
    });
  }

  // ── Границы «уменьшить до» ─────────────────────────────────────
  // Крипто-лимит без карманов считается от растущего блока:
  // (posValue + x)/(cryptoBlock + x) = L  →  x = (L·cryptoBlock − posValue)/(1 − L).
  // С карманами база уже плановая, поэтому максимум = L·plannedBase − posValue.
  const positionRoom = isCryptoAsset
    ? ctx.capitalBuckets
      ? positionLimit * plannedCryptoBlock - posValue
      : positionLimit < 1
        ? (positionLimit * cryptoBlockValue - posValue) / (1 - positionLimit)
        : Infinity
    : positionLimit * total - posValue;
  const classRoom =
    cap === null
      ? Infinity
      : cap * total - (ctx.allocation.find((a) => a.name === category)?.value ?? 0);
  const slotRoom =
    (isNewAltcoin && altSlots && altSlots.used >= altSlots.total) ||
    (isNewStock && stockSlots && stockSlots.used >= stockSlots.total) ||
    (isNewMetal && metalSlots && metalSlots.used >= metalSlots.total)
      ? 0
      : Infinity;
  const budgetRoom = budget ? budget.value : Infinity;
  const maxSafeAmount = clampMin0(Math.min(greenMax, budgetRoom, positionRoom, classRoom, slotRoom));
  const maxAllowedAmount = clampMin0(Math.min(hardMax, budgetRoom, positionRoom, classRoom, slotRoom));

  const hardFailed = checks.filter((c) => !c.ok && c.severity === "block");
  const softFailed = checks.filter((c) => !c.ok && c.severity === "warn");

  const status: GateStatus =
    hardFailed.length > 0 ? "block" : softFailed.length > 0 ? "caution" : "ok";

  return {
    status,
    checks,
    reasons: hardFailed.map((c) => c.label),
    warnings: softFailed.map((c) => c.note ?? c.label),
    maxSafeAmount,
    maxAllowedAmount,
    fearGreed: buildFearGreedNote(input, ctx),
  };
}

export {
  RESERVE_FLOOR_SHARE,
  RESERVE_TARGET_SHARE,
  SPOT_RESERVE_FLOOR_SHARE,
  MAX_SINGLE_RISK_ASSET_SHARE,
};
