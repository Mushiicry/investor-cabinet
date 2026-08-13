import { describe, expect, it } from "vitest";
import { WIFE_API_URL, INVESTOR_API_URL } from "../../src/config/constants";
import { buildPortfolioState } from "../../src/lib/portfolioCalculations";
import { rawPositions, decisionsData, scenariosData } from "../../src/mocks/portfolioData";
import { validateInvestorApiPayload } from "../../src/services/apiValidation";
import { buildInvestorStateFromApi } from "../../src/services/investorState";
import type { InvestorApiResponse } from "../../src/types/api";
import { validateMobileInvestorApiPayload } from "../../src/v2/lib/mobileApiContract";
import {
  buildMobileDataStatus,
  buildMobileInvestorDataFromApi,
} from "../../src/v2/lib/mobileInvestorData";

const previousState = () => buildPortfolioState(rawPositions, decisionsData, scenariosData);

const baseMobilePayload = (): InvestorApiResponse => ({
  success: true,
  updatedAt: "2026-08-12T00:00:00.000Z",
  overview: {
    portfolioValue: 1000,
    invested: 1200,
    pnl: -200,
    pnlPct: -0.1667,
    reserve: 250,
    positionsCount: 2,
    state: "RISK",
    signal: "Проверить риск",
    action: "Не добавлять риск без проверки.",
  },
  portfolio: [
    {
      asset: "BTC",
      ticker: "BTC",
      category: "Крипта",
      quantity: 0.01,
      avgEntry: 70000,
      currentPrice: 65000,
      invested: 700,
      currentValue: 650,
      pnl: -50,
      pnlPct: -7.14,
      share: 65,
      status: "Наблюдать",
    },
    {
      asset: "USDT",
      ticker: "USDT",
      category: "Свободные деньги",
      quantity: 250,
      avgEntry: 1,
      currentPrice: 1,
      invested: 250,
      currentValue: 250,
      pnl: 0,
      pnlPct: 0,
      share: 25,
      status: "RESERVE",
    },
  ],
  risk: {
    portfolioValue: 1000,
    reserve: 250,
    reserveShare: 0.25,
    deployableCash: 50,
    largestRiskAsset: "BTC",
    largestRiskShare: 0.65,
    cryptoShare: 0.65,
    state: "RISK",
    signal: "Риск выше нормы",
    summary: "Нужна проверка лимитов.",
  },
});

describe("mobile API contract", () => {
  it("keeps main and wife endpoints separated", () => {
    expect(INVESTOR_API_URL).toBe("/api/investor");
    expect(WIFE_API_URL).toBe("/api/investor-wife");
    expect(WIFE_API_URL).not.toBe(INVESTOR_API_URL);
  });

  it("accepts the minimal mobile payload without optional sections", () => {
    const payload = baseMobilePayload();

    const validation = validateInvestorApiPayload(payload);
    expect(validation.ok).toBe(true);
    expect(validateMobileInvestorApiPayload(payload).ok).toBe(true);

    const state = buildInvestorStateFromApi(payload, previousState());

    expect(state.overview.portfolioValue).toBe(1000);
    expect(state.overview.pnlPct).toBeCloseTo(-0.1667, 4);
    expect(state.portfolio).toHaveLength(2);
    expect(state.signals).toEqual({ interest: null, interestList: [] });
    expect(state.assetQuality).toEqual({
      connected: false,
      records: [],
      cmcTop100Connected: false,
      binanceMonitoringConnected: false,
    });
  });

  it("survives empty mobile optional arrays for wife-like payloads", () => {
    const payload: InvestorApiResponse = {
      ...baseMobilePayload(),
      decisions: [],
      scenarios: [],
      history: [],
      transactions: [],
      signals: undefined,
      investorDNA: undefined,
      assetQuality: undefined,
    };

    const validation = validateInvestorApiPayload(payload);
    expect(validation.ok).toBe(true);
    expect(validateMobileInvestorApiPayload(payload).ok).toBe(true);

    const state = buildInvestorStateFromApi(payload, previousState());

    expect(state.history).toEqual([]);
    expect(state.transactions).toEqual([]);
    expect(state.signals.interest).toBeNull();
    expect(state.signals.interestList).toEqual([]);
  });

  it("builds a mobile V2 data result without touching the web runtime path", () => {
    const result = buildMobileInvestorDataFromApi({
      payload: baseMobilePayload(),
      previousState: previousState(),
      accountId: "main",
      lastLoadedAt: "2026-08-12T00:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.status).toMatchObject({
      accountId: "main",
      source: "live",
      status: "ready",
      trust: "trusted-live",
      canTrustNumbers: true,
    });
    expect(result.data.portfolio.totalPortfolioValue).toBe(1000);
    expect(result.data.portfolio.pnlPct).toBeCloseTo(-0.1667, 4);
    expect(result.data.signals).toEqual({ interest: null, interestList: [] });
  });

  it("marks cache/stale/error states explicitly for the mobile indicator", () => {
    expect(buildMobileDataStatus({
      accountId: "wife",
      source: "cache",
      status: "refreshing",
      lastLoadedAt: "2026-08-12T00:00:00.000Z",
    })).toMatchObject({
      accountId: "wife",
      trust: "limited-cache",
      canTrustNumbers: false,
    });

    expect(buildMobileDataStatus({
      accountId: "main",
      source: "live",
      status: "stale",
      error: "timeout",
    })).toMatchObject({
      trust: "limited-stale",
      canTrustNumbers: false,
    });

    expect(buildMobileDataStatus({
      accountId: "main",
      source: "fallback",
      status: "error",
      error: "invalid",
    })).toMatchObject({
      trust: "blocked-error",
      canTrustNumbers: false,
    });
  });

  it("rejects payloads that cannot provide mobile core sections", () => {
    expect(validateMobileInvestorApiPayload({ success: true, portfolio: {} }).ok).toBe(false);
    expect(validateMobileInvestorApiPayload({ success: true, overview: [] }).ok).toBe(false);
    expect(validateMobileInvestorApiPayload({ success: true, risk: [] }).ok).toBe(false);
    expect(validateMobileInvestorApiPayload({ success: true, overview: {}, portfolio: [], risk: {}, updatedAt: "" }).ok).toBe(false);
    expect(validateMobileInvestorApiPayload({ ...baseMobilePayload(), overview: { invested: 1000 } }).ok).toBe(false);
    expect(validateMobileInvestorApiPayload({ ...baseMobilePayload(), risk: { reserve: 100 } }).ok).toBe(false);
  });

  it("returns a blocked mobile result for invalid payloads", () => {
    const result = buildMobileInvestorDataFromApi({
      payload: { success: true, overview: {}, portfolio: [], risk: {}, updatedAt: "2026-08-12T00:00:00.000Z" },
      previousState: previousState(),
      accountId: "main",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toMatchObject({
      status: "error",
      trust: "blocked-error",
      canTrustNumbers: false,
    });
  });
});
