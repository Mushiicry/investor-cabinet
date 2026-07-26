import {
  MAX_CRYPTO_EXPOSURE_SHARE,
  MAX_FUTURES_EXPOSURE_SHARE,
  MAX_METALS_EXPOSURE_SHARE,
  MAX_SINGLE_RISK_ASSET_SHARE,
  MAX_STOCKS_EXPOSURE_SHARE,
  RESERVE_BAND_MAX_SHARE,
  RESERVE_FLOOR_SHARE,
  RESERVE_TARGET_SHARE,
  SPOT_RESERVE_FLOOR_SHARE,
} from "../../config/riskRules";

export const STRATEGY_CRYPTO_CATEGORY = "Крипта";
export const STRATEGY_METALS_CATEGORY = "Металлы";
export const STRATEGY_FUTURES_CATEGORY = "Фьючерсы";
export const STRATEGY_STOCKS_CATEGORY = "Акции";

export type InvestorStrategyId = "main" | "wife";
export type HealthRiskRayMode = "Контроль риска" | "Качество активов";

export type InvestorStrategy = {
  id: InvestorStrategyId;
  title: string;
  reserveFloorShare: number;
  reserveTargetShare: number;
  reserveBandMaxShare: number;
  spotReserveFloorShare: number;
  cryptoMaxShare: number;
  stocksMaxShare: number;
  metalsMaxShare: number;
  futuresMaxShare: number;
  futuresAllowed: boolean;
  healthRiskRay: HealthRiskRayMode;
  cryptoAssetLimits: Record<string, number>;
  defaultCryptoAssetLimit: number;
  allowedCryptoAssets?: string[];
  allowedMetalAssets?: string[];
  stockAssetLimit: number;
  metalAssetLimit: number;
  maxAltcoinSlots: number;
  maxStockSlots: number;
  maxMetalSlots: number;
  allocationLabel: string;
};

export type StrategyAssetVerdict = {
  allowed: boolean;
  reason?: string;
};

export const MAIN_CRYPTO_ASSET_LIMITS: Record<string, number> = {
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

export const WIFE_CRYPTO_ASSET_LIMITS: Record<string, number> = {
  ETH: 0.75,
  WETH: 0.75,
  ETHEREUM: 0.75,
  BTC: 0.1,
  WBTC: 0.1,
  BITCOIN: 0.1,
  TON: 0.1,
  GRAM: 0.1,
  SOL: 0.05,
  SOLANA: 0.05,
};

export const MAIN_INVESTOR_STRATEGY: InvestorStrategy = {
  id: "main",
  title: "Основная стратегия",
  reserveFloorShare: RESERVE_FLOOR_SHARE,
  reserveTargetShare: RESERVE_TARGET_SHARE,
  reserveBandMaxShare: RESERVE_BAND_MAX_SHARE,
  spotReserveFloorShare: SPOT_RESERVE_FLOOR_SHARE,
  cryptoMaxShare: MAX_CRYPTO_EXPOSURE_SHARE,
  stocksMaxShare: MAX_STOCKS_EXPOSURE_SHARE,
  metalsMaxShare: MAX_METALS_EXPOSURE_SHARE,
  futuresMaxShare: MAX_FUTURES_EXPOSURE_SHARE,
  futuresAllowed: true,
  healthRiskRay: "Контроль риска",
  cryptoAssetLimits: MAIN_CRYPTO_ASSET_LIMITS,
  defaultCryptoAssetLimit: 0.05,
  stockAssetLimit: 0.05,
  metalAssetLimit: 0.05,
  maxAltcoinSlots: 3,
  maxStockSlots: 2,
  maxMetalSlots: 2,
  allocationLabel: "60/10/10/10/10",
};

export const WIFE_INVESTOR_STRATEGY: InvestorStrategy = {
  id: "wife",
  title: "Стратегия Полины",
  reserveFloorShare: 0.1,
  reserveTargetShare: 0.1,
  reserveBandMaxShare: RESERVE_BAND_MAX_SHARE,
  spotReserveFloorShare: 0.1,
  cryptoMaxShare: 0.75,
  stocksMaxShare: 0.07,
  metalsMaxShare: 0.08,
  futuresMaxShare: 0,
  futuresAllowed: false,
  healthRiskRay: "Качество активов",
  cryptoAssetLimits: WIFE_CRYPTO_ASSET_LIMITS,
  defaultCryptoAssetLimit: 0,
  allowedCryptoAssets: Object.keys(WIFE_CRYPTO_ASSET_LIMITS),
  allowedMetalAssets: ["GOLD", "XAU", "XAUUSD"],
  stockAssetLimit: 0.07,
  metalAssetLimit: 0.08,
  maxAltcoinSlots: 0,
  maxStockSlots: 2,
  maxMetalSlots: 1,
  allocationLabel: "75/8/7/10",
};

export const INVESTOR_STRATEGIES = {
  main: MAIN_INVESTOR_STRATEGY,
  wife: WIFE_INVESTOR_STRATEGY,
} satisfies Record<InvestorStrategyId, InvestorStrategy>;

export function strategyForSlot(slot?: string | null): InvestorStrategy {
  return slot === "wife" ? WIFE_INVESTOR_STRATEGY : MAIN_INVESTOR_STRATEGY;
}

export function normalizeStrategyAssetKey(asset: string): string {
  const raw = asset.trim().toUpperCase();
  const firstToken = raw.split(/\s+/)[0] ?? raw;
  return firstToken.replace(/USDT$/, "").replace(/USD$/, "");
}

export function cryptoAssetLimitForStrategy(asset: string, strategy = MAIN_INVESTOR_STRATEGY): number {
  return strategy.cryptoAssetLimits[normalizeStrategyAssetKey(asset)] ?? strategy.defaultCryptoAssetLimit;
}

export function isCryptoMajorForStrategy(asset: string, strategy = MAIN_INVESTOR_STRATEGY): boolean {
  return strategy.cryptoAssetLimits[normalizeStrategyAssetKey(asset)] !== undefined;
}

export function assetLimitForStrategy(
  category: string,
  asset: string,
  strategy = MAIN_INVESTOR_STRATEGY,
): number {
  if (category === STRATEGY_CRYPTO_CATEGORY) return cryptoAssetLimitForStrategy(asset, strategy);
  if (category === STRATEGY_STOCKS_CATEGORY) return strategy.stockAssetLimit;
  if (category === STRATEGY_METALS_CATEGORY) return strategy.metalAssetLimit;
  if (category === STRATEGY_FUTURES_CATEGORY) return strategy.futuresMaxShare;
  return MAX_SINGLE_RISK_ASSET_SHARE;
}

export function isAssetAllowedByStrategy(
  asset: string,
  category: string,
  strategy = MAIN_INVESTOR_STRATEGY,
): StrategyAssetVerdict {
  const key = normalizeStrategyAssetKey(asset);

  if (category === STRATEGY_FUTURES_CATEGORY && !strategy.futuresAllowed) {
    return { allowed: false, reason: "Фьючерсы не входят в стратегию Полины" };
  }

  if (category === STRATEGY_CRYPTO_CATEGORY && strategy.allowedCryptoAssets && !strategy.allowedCryptoAssets.includes(key)) {
    return { allowed: false, reason: `${key}: актив не входит в стратегию Полины` };
  }

  if (category === STRATEGY_METALS_CATEGORY && strategy.allowedMetalAssets && !strategy.allowedMetalAssets.includes(key)) {
    return { allowed: false, reason: `${key}: в металлах разрешено только золото` };
  }

  if (assetLimitForStrategy(category, key, strategy) <= 0) {
    return { allowed: false, reason: `${key}: актив не входит в стратегию` };
  }

  return { allowed: true };
}
