import { describe, expect, it } from "vitest";
import { buildPortfolioState } from "../../src/lib/portfolioCalculations";
import { decisionsData, rawPositions, scenariosData } from "../../src/mocks/portfolioData";
import {
  BASE_INVESTOR_PROFILES,
  MAIN_INVESTOR_PROFILE,
  WIFE_INVESTOR_PROFILE,
  evaluateInvestorProfileTrade,
  profileForSlot,
} from "../../src/v2/lib/investorProfile";
import { MAIN_INVESTOR_STRATEGY, WIFE_INVESTOR_STRATEGY } from "../../src/v2/lib/investorStrategy";
import { buildLiveV2Data, buildZeroedV2Data } from "../../src/v2/lib/v2LabData";

describe("investor profile policies", () => {
  it("keeps strategy and investor portrait as separate models", () => {
    expect(MAIN_INVESTOR_STRATEGY).not.toHaveProperty("drawdownTolerance");
    expect(WIFE_INVESTOR_STRATEGY).not.toHaveProperty("volatilityTolerance");
    expect(MAIN_INVESTOR_PROFILE).not.toHaveProperty("cryptoMaxShare");
    expect(WIFE_INVESTOR_PROFILE).not.toHaveProperty("futuresMaxShare");
  });

  it("defines the baseline profile catalogue for future questionnaire scoring", () => {
    expect(Object.keys(BASE_INVESTOR_PROFILES)).toEqual([
      "protective",
      "long_term_accumulator",
      "balanced",
      "aggressive_growth",
      "active_trader",
    ]);
    expect(BASE_INVESTOR_PROFILES.protective.questionnaireDraft.plannedQuestions).toBeGreaterThanOrEqual(12);
    expect(BASE_INVESTOR_PROFILES.active_trader.activeTradingFit).toBe(true);
  });

  it("assigns wife profile separately from the main account profile", () => {
    expect(profileForSlot()).toBe(MAIN_INVESTOR_PROFILE);
    expect(profileForSlot("main")).toBe(MAIN_INVESTOR_PROFILE);
    expect(profileForSlot("wife")).toBe(WIFE_INVESTOR_PROFILE);
    expect(WIFE_INVESTOR_PROFILE.accountId).toBe("wife");
    expect(WIFE_INVESTOR_PROFILE.title).toBe("Защитный долгосрочный накопитель");
    expect(WIFE_INVESTOR_PROFILE.futuresFit).toBe(false);
    expect(WIFE_INVESTOR_PROFILE.speculativeAssetsFit).toBe(false);
  });

  it("attaches the selected profile to V2 account data independently of strategy", () => {
    const state = buildPortfolioState(rawPositions, decisionsData, scenariosData);

    expect(buildLiveV2Data(state, {}, {}, "main").strategy).toBe(MAIN_INVESTOR_STRATEGY);
    expect(buildLiveV2Data(state, {}, {}, "main").profile).toBe(MAIN_INVESTOR_PROFILE);
    expect(buildLiveV2Data(state, {}, {}, "wife").strategy).toBe(WIFE_INVESTOR_STRATEGY);
    expect(buildLiveV2Data(state, {}, {}, "wife").profile).toBe(WIFE_INVESTOR_PROFILE);
    expect(buildZeroedV2Data().profile).toBe(MAIN_INVESTOR_PROFILE);
  });

  it("blocks futures and speculative assets for Polina without blocking the main profile", () => {
    const wifeFutures = evaluateInvestorProfileTrade({
      asset: "ETH LONG",
      category: "Фьючерсы",
      amountUsd: 10,
      totalPortfolioValue: 1000,
      stableReserve: 500,
      reserveTargetShare: 0.1,
      profile: WIFE_INVESTOR_PROFILE,
    });
    const wifeSpeculative = evaluateInvestorProfileTrade({
      asset: "JASMY",
      category: "Крипта",
      amountUsd: 10,
      totalPortfolioValue: 1000,
      stableReserve: 500,
      reserveTargetShare: 0.1,
      profile: WIFE_INVESTOR_PROFILE,
    });
    const mainSpeculative = evaluateInvestorProfileTrade({
      asset: "JASMY",
      category: "Крипта",
      amountUsd: 10,
      totalPortfolioValue: 1000,
      stableReserve: 500,
      reserveTargetShare: 0.3,
      profile: MAIN_INVESTOR_PROFILE,
    });

    expect(wifeFutures.some((verdict) => verdict.severity === "block" && verdict.note.includes("фьючерсы"))).toBe(true);
    expect(wifeSpeculative.some((verdict) => verdict.severity === "block" && verdict.note.includes("спекулятивным"))).toBe(true);
    expect(mainSpeculative.some((verdict) => verdict.severity === "block")).toBe(false);
  });
});
