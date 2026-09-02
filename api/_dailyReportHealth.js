const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";

const RESERVE_FLOOR_SHARE = 0.1;
const RESERVE_TARGET_SHARE = 0.3;
const RESERVE_BAND_MAX_SHARE = 0.6;
const MAX_FUTURES_EXPOSURE_SHARE = 0.1;
const SPOT_RESERVE_FLOOR_SHARE = 0.3;
const MAX_FUTURES_POSITIONS = 3;
const LIQ_SAFE_DISTANCE = 0.4;
const LIQ_CRITICAL_DISTANCE = 0.05;
const LIQ_MAX_PENALTY = 30;
const SURVIVAL_BUY_POWER_TARGET_SHARE = 0.15;
const DIVERSIFICATION_TARGET_HHI = 0.5;

const MAIN_CRYPTO_ASSET_LIMITS = {
  ETH: 0.35,
  WETH: 0.35,
  ETHEREUM: 0.35,
  BTC: 0.2,
  WBTC: 0.2,
  BITCOIN: 0.2,
  SOL: 0.1,
  SOLANA: 0.1,
  TON: 0.1,
  GRAM: 0.1,
  BNB: 0.1,
  WBNB: 0.1,
};

const INACTIVE_LIMIT_ORDER_STATUSES = new Set(["CHECK", "ERROR", "TRIGGERED"]);
const BUY_ACTION_MARKERS = ["куп", "докуп", "добор", "добав", "набор", "вход", "откуп", "buy", "dca"];

const toNumber = (value) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value, digits = 4) => Number(toNumber(value).toFixed(digits));
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const score = (value) => Math.round(clamp01(value) * 100);

const assetBaseSymbol = (asset) =>
  String(asset ?? "").trim().toUpperCase().split(/\s+/)[0]?.replace(/USDT$/, "").replace(/USD$/, "") ?? "";

const categoryValue = (positions, category) =>
  positions
    .filter((position) => position.category === category)
    .reduce((sum, position) => sum + position.currentValue, 0);

const categoryShare = (positions, category, portfolioValue) =>
  portfolioValue > 0 ? round(categoryValue(positions, category) / portfolioValue, 4) : 0;

const isFuturesCash = (position) =>
  position.category === "Свободные деньги" && position.asset.toUpperCase().includes("USDC HL");

const normalizePositions = (payload) =>
  (Array.isArray(payload?.portfolio) ? payload.portfolio : [])
    .map((position) => ({
      asset: String(position?.asset || position?.ticker || "").trim(),
      category: String(position?.category || "").trim(),
      status: String(position?.status || "").trim(),
      currentValue: toNumber(position?.currentValue ?? position?.value),
      invested: toNumber(position?.invested),
      currentPrice: toNumber(position?.currentPrice),
    }))
    .filter((position) => position.asset && position.currentValue >= 0);

const plannedLimitOrdersUsdFromPayload = (payload) => {
  const signals = Array.isArray(payload?.signals?.interestList)
    ? payload.signals.interestList.filter((signal) => String(signal?.asset || "").trim())
    : [];
  if (signals.length === 0) return undefined;

  return signals.reduce((sum, signal) => {
    const status = String(signal?.status || "").trim().toUpperCase();
    const action = String(signal?.action || "").trim().toLowerCase();
    const amountUsd = toNumber(signal?.amountUsd);
    const isBuy = BUY_ACTION_MARKERS.some((marker) => action.includes(marker));
    if (INACTIVE_LIMIT_ORDER_STATUSES.has(status) || !isBuy || amountUsd <= 0) return sum;
    return sum + amountUsd;
  }, 0);
};

function computeReserveScore(reserveShare) {
  if (reserveShare <= 0) return 0;
  if (reserveShare < RESERVE_FLOOR_SHARE) return Math.round((reserveShare / RESERVE_FLOOR_SHARE) * 30);
  if (reserveShare < RESERVE_TARGET_SHARE) {
    const progress = (reserveShare - RESERVE_FLOOR_SHARE) / (RESERVE_TARGET_SHARE - RESERVE_FLOOR_SHARE);
    return Math.round(30 + progress * 70);
  }
  if (reserveShare <= RESERVE_BAND_MAX_SHARE) return 100;
  return score((1 - reserveShare) / (1 - RESERVE_BAND_MAX_SHARE));
}

function computeDiversificationScore(riskShares) {
  const total = riskShares.reduce((sum, value) => sum + value, 0);
  if (riskShares.length < 2 || total <= 0) return 0;
  const hhi = riskShares.reduce((sum, value) => {
    const weight = value / total;
    return sum + weight * weight;
  }, 0);
  const targetHhi = Math.max(DIVERSIFICATION_TARGET_HHI, 1 / riskShares.length);
  return score((1 - hhi) / (1 - targetHhi));
}

function computeSurvivalScore({ cryptoShare, metalsShare, stocksShare, futuresShare, reserveShare, portfolioValue, spotDeployableUsd, plannedLimitOrdersUsd }) {
  const shockLoss = Math.min(
    1,
    cryptoShare * 0.6 + metalsShare * 0.5 + stocksShare * 0.3 + futuresShare,
  );
  const lossScore = score((0.6 - shockLoss) / (0.6 - 0.25));
  const derivedBuyPowerUsd = Math.max(0, reserveShare * portfolioValue - RESERVE_FLOOR_SHARE * (1 - shockLoss) * portfolioValue);
  const buyPowerUsd = spotDeployableUsd ?? derivedBuyPowerUsd;
  const buyPowerScore = score((portfolioValue > 0 ? buyPowerUsd / portfolioValue : 0) / SURVIVAL_BUY_POWER_TARGET_SHARE);
  let planScore = 60;
  if (plannedLimitOrdersUsd !== undefined) {
    if (plannedLimitOrdersUsd <= 0) planScore = 40;
    else if (plannedLimitOrdersUsd > buyPowerUsd) planScore = 20;
    else planScore = 100;
  }
  return Math.round(lossScore * 0.45 + buyPowerScore * 0.35 + planScore * 0.2);
}

const cryptoAssetLimit = (asset) => MAIN_CRYPTO_ASSET_LIMITS[assetBaseSymbol(asset)] ?? 0.05;
const isCryptoMajor = (asset) => MAIN_CRYPTO_ASSET_LIMITS[assetBaseSymbol(asset)] !== undefined;

function fixedClassSlots(assets, total) {
  const seen = new Set();
  for (const asset of assets) {
    const key = assetBaseSymbol(asset);
    if (key) seen.add(key);
  }
  return { used: seen.size, total };
}

function computeConcentrationScore(positions, portfolioValue) {
  const cryptoPositions = positions.filter((position) => position.category === "Крипта" && position.currentValue > 0);
  const cryptoBlockValue = cryptoPositions.reduce((sum, position) => sum + position.currentValue, 0);
  let largestPortfolioShare = 0;
  let disciplinePenalty = 0;
  const overLimitAssets = [];

  for (const position of positions) {
    if (position.currentValue <= 0 || position.category === "Свободные деньги") continue;
    const isCrypto = position.category === "Крипта";
    const base = isCrypto ? cryptoBlockValue : portfolioValue;
    if (base <= 0) continue;
    const share = position.currentValue / base;
    const portfolioShare = portfolioValue > 0 ? position.currentValue / portfolioValue : 0;
    const limit =
      position.category === "Крипта"
        ? cryptoAssetLimit(position.asset)
        : position.category === "Акции" || position.category === "Металлы"
          ? 0.05
          : position.category === "Фьючерсы"
            ? MAX_FUTURES_EXPOSURE_SHARE
            : 0.35;
    const utilization = limit > 0 ? share / limit : 0;
    if (portfolioShare > largestPortfolioShare) largestPortfolioShare = portfolioShare;
    if (utilization > 1) {
      overLimitAssets.push(position.asset);
      disciplinePenalty += Math.min(utilization - 1, 2) * portfolioShare * 120;
    }
  }

  const altcoins = cryptoPositions
    .map((position) => position.asset)
    .filter((asset) => !isCryptoMajor(asset));
  const stockSlots = fixedClassSlots(
    positions.filter((position) => position.category === "Акции" && position.currentValue > 0).map((position) => position.asset),
    2,
  );
  const metalSlots = fixedClassSlots(
    positions.filter((position) => position.category === "Металлы" && position.currentValue > 0).map((position) => position.asset),
    2,
  );

  const systemicScore = (0.5 - largestPortfolioShare) / (0.5 - 0.2);
  const slotsPenalty =
    Math.max(0, new Set(altcoins.map(assetBaseSymbol)).size - 3) * 8
    + Math.max(0, stockSlots.used - stockSlots.total) * 8
    + Math.max(0, metalSlots.used - metalSlots.total) * 8;
  return score(systemicScore - (Math.min(disciplinePenalty, 45) + slotsPenalty) / 100);
}

function futuresLeverageLimit(asset) {
  const symbol = assetBaseSymbol(asset);
  return symbol === "BTC" || symbol === "GOLD" || symbol === "XAU" ? 3 : 2;
}

function liquidationPenalty(distance) {
  if (distance === null || !Number.isFinite(distance) || distance >= LIQ_SAFE_DISTANCE) return 0;
  if (distance <= LIQ_CRITICAL_DISTANCE) return LIQ_MAX_PENALTY;
  return Math.round(((LIQ_SAFE_DISTANCE - distance) / (LIQ_SAFE_DISTANCE - LIQ_CRITICAL_DISTANCE)) * LIQ_MAX_PENALTY);
}

function computeRiskControlScore({ positions, futuresShare, investedCapital, riskByCoin }) {
  const capUsd = investedCapital * MAX_FUTURES_EXPOSURE_SHARE;
  const usedUsd = investedCapital * futuresShare;
  const utilization = capUsd > 0 ? usedUsd / capUsd : futuresShare > 0 ? Infinity : 0;
  const marginPenalty = Math.max(0, utilization - 1) * 50;
  const legs = positions.filter((position) => position.category === "Фьючерсы" && position.currentValue > 0);
  let leveragePenalty = 0;
  let worstLiqDistance = null;

  for (const leg of legs) {
    const risk = riskByCoin[assetBaseSymbol(leg.asset)];
    const leverage = toNumber(risk?.leverage);
    if (leverage > 0) {
      const leverageUsage = leverage / futuresLeverageLimit(leg.asset);
      leveragePenalty += Math.min(leverageUsage, 1) * 4 + Math.max(0, leverageUsage - 1) * 25;
    }
    const liquidationPx = toNumber(risk?.liquidationPx);
    const liqDistance = liquidationPx > 0 && leg.currentPrice > 0
      ? Math.abs(leg.currentPrice - liquidationPx) / leg.currentPrice
      : null;
    if (liqDistance !== null && (worstLiqDistance === null || liqDistance < worstLiqDistance)) {
      worstLiqDistance = liqDistance;
    }
  }

  const positionPenalty = legs.length * 5 + Math.max(0, legs.length - MAX_FUTURES_POSITIONS) * 20;
  return Math.max(0, Math.round(100 - marginPenalty - leveragePenalty - positionPenalty - liquidationPenalty(worstLiqDistance)));
}

function computeDisciplineScore({
  plannedLimitOrdersUsd,
  plannedLimitOrdersConfirmed,
  journalCoverage = 0,
  disciplineViolations30d = 0,
  fomoEvents30d = 0,
  revengeTrades30d = 0,
  overtradingDays30d = 0,
  cooldownActive = false,
}) {
  const journalScore = score(journalCoverage / 0.8);
  const behaviorScore = Math.max(
    0,
    100 - (
      disciplineViolations30d * 15
      + fomoEvents30d * 10
      + revengeTrades30d * 25
      + overtradingDays30d * 15
    ),
  );
  const blockerScore = cooldownActive ? 0 : 100;
  const planScore = plannedLimitOrdersUsd === undefined
    ? 60
    : plannedLimitOrdersUsd > 0 && plannedLimitOrdersConfirmed === false
      ? 40
      : plannedLimitOrdersUsd > 0
        ? 100
        : 50;
  return Math.round(journalScore * 0.35 + behaviorScore * 0.3 + blockerScore * 0.25 + planScore * 0.1);
}

export function computeDailyReportHealth(payload, options = {}) {
  const positions = normalizePositions(payload);
  const portfolioValue = toNumber(payload?.overview?.portfolioValue)
    || positions.reduce((sum, position) => sum + position.currentValue, 0);
  const investedCapital = toNumber(payload?.overview?.invested)
    || positions.reduce((sum, position) => sum + position.invested, 0);
  const reserveUsd = toNumber(payload?.overview?.reserve)
    || categoryValue(positions, "Свободные деньги");
  const reserveShare = investedCapital > 0 ? reserveUsd / investedCapital : 0;
  const reservePortfolioShare = portfolioValue > 0 ? reserveUsd / portfolioValue : 0;
  const cryptoShare = categoryShare(positions, "Крипта", portfolioValue);
  const metalsShare = categoryShare(positions, "Металлы", portfolioValue);
  const stocksShare = categoryShare(positions, "Акции", portfolioValue);
  const futuresInitialMargin = positions
    .filter((position) => position.category === "Фьючерсы" && position.currentValue > 0)
    .reduce((sum, position) => sum + position.invested, 0);
  const freeFuturesMargin = positions.filter(isFuturesCash).reduce((sum, position) => sum + position.currentValue, 0);
  const futuresShare = investedCapital > 0 ? round((futuresInitialMargin + freeFuturesMargin) / investedCapital, 4) : 0;
  const spotReserveUsd = positions
    .filter((position) => position.category === "Свободные деньги" && !isFuturesCash(position))
    .reduce((sum, position) => sum + position.currentValue, 0);
  const spotDeployableUsd = Math.max(0, spotReserveUsd - portfolioValue * SPOT_RESERVE_FLOOR_SHARE);
  const plannedLimitOrdersUsd = options.plannedLimitOrdersUsd
    ?? plannedLimitOrdersUsdFromPayload(payload);
  const plannedLimitOrdersConfirmed = options.plannedLimitOrdersConfirmed
    ?? (plannedLimitOrdersUsd !== undefined && plannedLimitOrdersUsd > 0 ? false : undefined);
  const behavior = options.behavior ?? {};

  const components = {
    reserve: computeReserveScore(reserveShare),
    survival: computeSurvivalScore({
      cryptoShare,
      metalsShare,
      stocksShare,
      futuresShare,
      reserveShare: reservePortfolioShare,
      portfolioValue,
      spotDeployableUsd,
      plannedLimitOrdersUsd,
    }),
    riskControl: computeRiskControlScore({
      positions,
      futuresShare,
      investedCapital,
      riskByCoin: options.riskByCoin ?? {},
    }),
    concentration: computeConcentrationScore(positions, portfolioValue),
    diversification: computeDiversificationScore([cryptoShare, metalsShare, stocksShare]),
    discipline: computeDisciplineScore({
      plannedLimitOrdersUsd,
      plannedLimitOrdersConfirmed,
      journalCoverage: toNumber(behavior.disciplineJournalCoverage),
      disciplineViolations30d: toNumber(behavior.disciplineViolations30d),
      fomoEvents30d: toNumber(behavior.fomoEvents30d),
      revengeTrades30d: toNumber(behavior.revengeTrades30d),
      overtradingDays30d: toNumber(behavior.overtradingDays30d),
      cooldownActive: Boolean(behavior.disciplineCooldownActive),
    }),
  };

  const healthFactor = Math.round(
    components.reserve * 0.2
      + components.survival * 0.17
      + components.riskControl * 0.15
      + components.concentration * 0.18
      + components.diversification * 0.15
      + components.discipline * 0.15,
  );

  return {
    healthFactor,
    status: healthFactor >= 75 ? "CONTROL" : healthFactor >= 55 ? "BALANCED" : "RISK",
    components,
  };
}

async function fetchClearinghouseRisk(address, dex) {
  const body = { type: "clearinghouseState", user: address };
  if (dex) body.dex = dex;
  const response = await fetch(HYPERLIQUID_INFO_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Hyperliquid clearinghouseState failed: HTTP ${response.status}`);
  const data = await response.json();
  const result = {};
  for (const item of data?.assetPositions ?? []) {
    const position = item?.position ?? {};
    const coin = assetBaseSymbol(position.coin);
    const leverage = toNumber(position?.leverage?.value);
    if (!coin || leverage <= 0) continue;
    result[coin] = {
      leverage,
      liquidationPx: toNumber(position.liquidationPx) || null,
      entryPx: toNumber(position.entryPx) || null,
    };
  }
  return result;
}

export async function fetchDailyReportHyperliquidRisk() {
  const address = (process.env.HYPERLIQUID_ADDRESS || process.env.VITE_HL_ADDRESS || "").trim();
  if (!address) return {};
  const settled = await Promise.allSettled([
    fetchClearinghouseRisk(address),
    fetchClearinghouseRisk(address, "xyz"),
  ]);
  return settled.reduce((acc, item) => {
    if (item.status === "fulfilled") Object.assign(acc, item.value);
    return acc;
  }, {});
}
