import { describe, expect, it } from "vitest";
import {
  MAX_CRYPTO_EXPOSURE_SHARE,
  MAX_FUTURES_EXPOSURE_SHARE,
  MAX_METALS_EXPOSURE_SHARE,
  MAX_STOCKS_EXPOSURE_SHARE,
  RESERVE_FLOOR_SHARE,
  RESERVE_TARGET_SHARE,
  SPOT_RESERVE_FLOOR_SHARE,
} from "../../src/config/riskRules";
import {
  MAIN_INVESTOR_STRATEGY,
  STRATEGY_CRYPTO_CATEGORY,
  STRATEGY_FUTURES_CATEGORY,
  STRATEGY_METALS_CATEGORY,
  WIFE_INVESTOR_STRATEGY,
  assetLimitForStrategy,
  isAssetAllowedByStrategy,
  strategyForSlot,
} from "../../src/v2/lib/investorStrategy";

describe("investor strategy policies", () => {
  it("keeps the main strategy equal to the current global policy", () => {
    expect(strategyForSlot()).toBe(MAIN_INVESTOR_STRATEGY);
    expect(strategyForSlot("main")).toBe(MAIN_INVESTOR_STRATEGY);
    expect(MAIN_INVESTOR_STRATEGY.reserveFloorShare).toBe(RESERVE_FLOOR_SHARE);
    expect(MAIN_INVESTOR_STRATEGY.reserveTargetShare).toBe(RESERVE_TARGET_SHARE);
    expect(MAIN_INVESTOR_STRATEGY.spotReserveFloorShare).toBe(SPOT_RESERVE_FLOOR_SHARE);
    expect(MAIN_INVESTOR_STRATEGY.cryptoMaxShare).toBe(MAX_CRYPTO_EXPOSURE_SHARE);
    expect(MAIN_INVESTOR_STRATEGY.stocksMaxShare).toBe(MAX_STOCKS_EXPOSURE_SHARE);
    expect(MAIN_INVESTOR_STRATEGY.metalsMaxShare).toBe(MAX_METALS_EXPOSURE_SHARE);
    expect(MAIN_INVESTOR_STRATEGY.futuresMaxShare).toBe(MAX_FUTURES_EXPOSURE_SHARE);
    expect(MAIN_INVESTOR_STRATEGY.futuresAllowed).toBe(true);
    expect(MAIN_INVESTOR_STRATEGY.healthRiskRay).toBe("Контроль риска");
  });

  it("defines Polina's capital policy separately from the main policy", () => {
    expect(strategyForSlot("wife")).toBe(WIFE_INVESTOR_STRATEGY);
    expect(WIFE_INVESTOR_STRATEGY.reserveFloorShare).toBe(0.1);
    expect(WIFE_INVESTOR_STRATEGY.reserveTargetShare).toBe(0.1);
    expect(WIFE_INVESTOR_STRATEGY.cryptoMaxShare).toBe(0.75);
    expect(WIFE_INVESTOR_STRATEGY.stocksMaxShare).toBe(0.07);
    expect(WIFE_INVESTOR_STRATEGY.metalsMaxShare).toBe(0.08);
    expect(WIFE_INVESTOR_STRATEGY.futuresMaxShare).toBe(0);
    expect(WIFE_INVESTOR_STRATEGY.futuresAllowed).toBe(false);
    expect(WIFE_INVESTOR_STRATEGY.healthRiskRay).toBe("Качество активов");
    expect(WIFE_INVESTOR_STRATEGY.maxStockSlots).toBe(2);
    expect(WIFE_INVESTOR_STRATEGY.maxMetalSlots).toBe(1);
  });

  it("applies Polina's allowed asset limits", () => {
    expect(assetLimitForStrategy(STRATEGY_CRYPTO_CATEGORY, "ETH", WIFE_INVESTOR_STRATEGY)).toBe(0.75);
    expect(assetLimitForStrategy(STRATEGY_CRYPTO_CATEGORY, "ETHUSDT", WIFE_INVESTOR_STRATEGY)).toBe(0.75);
    expect(assetLimitForStrategy(STRATEGY_CRYPTO_CATEGORY, "BTC", WIFE_INVESTOR_STRATEGY)).toBe(0.1);
    expect(assetLimitForStrategy(STRATEGY_CRYPTO_CATEGORY, "GRAM", WIFE_INVESTOR_STRATEGY)).toBe(0.1);
    expect(assetLimitForStrategy(STRATEGY_CRYPTO_CATEGORY, "TON", WIFE_INVESTOR_STRATEGY)).toBe(0.1);
    expect(assetLimitForStrategy(STRATEGY_CRYPTO_CATEGORY, "SOL", WIFE_INVESTOR_STRATEGY)).toBe(0.05);
    expect(assetLimitForStrategy(STRATEGY_CRYPTO_CATEGORY, "BNB", WIFE_INVESTOR_STRATEGY)).toBe(0);
    expect(assetLimitForStrategy(STRATEGY_METALS_CATEGORY, "GOLD", WIFE_INVESTOR_STRATEGY)).toBe(0.08);
  });

  it("blocks assets outside Polina's strategy", () => {
    expect(isAssetAllowedByStrategy("BNB", STRATEGY_CRYPTO_CATEGORY, WIFE_INVESTOR_STRATEGY).allowed).toBe(false);
    expect(isAssetAllowedByStrategy("JASMY", STRATEGY_CRYPTO_CATEGORY, WIFE_INVESTOR_STRATEGY).allowed).toBe(false);
    expect(isAssetAllowedByStrategy("GOLD", STRATEGY_METALS_CATEGORY, WIFE_INVESTOR_STRATEGY).allowed).toBe(true);
    expect(isAssetAllowedByStrategy("SILVER", STRATEGY_METALS_CATEGORY, WIFE_INVESTOR_STRATEGY).allowed).toBe(false);
    expect(isAssetAllowedByStrategy("BTC SHORT", STRATEGY_FUTURES_CATEGORY, WIFE_INVESTOR_STRATEGY).allowed).toBe(false);
  });
});
