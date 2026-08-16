import { afterEach, describe, expect, it } from "vitest";
import { buildPortfolioState } from "../../src/lib/portfolioCalculations";
import { rawPositions, decisionsData, scenariosData } from "../../src/mocks/portfolioData";
import { readCachedInvestorState } from "../../src/services/investorDataCache";
import { buildInvestorStateFromApi } from "../../src/services/investorState";
import type { PortfolioState } from "../../src/types/portfolio";
import { MAIN_INVESTOR_DNA } from "../../src/v2/lib/investorDNA";
import { buildLiveV2Data } from "../../src/v2/lib/v2LabData";

const originalWindow = globalThis.window;

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
});

function installCachedState(rawValue: string) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) =>
          key === "investor-cabinet:last-live-investor-state:v2" ? rawValue : null,
      },
    },
  });
}

describe("нормализация состояния инвестора", () => {
  it("переживает старый кэш без assetQuality", () => {
    const cached = buildPortfolioState(rawPositions, decisionsData, scenariosData) as Partial<PortfolioState>;
    delete cached.assetQuality;

    const state = buildInvestorStateFromApi(
      { success: true, updatedAt: "2026-07-22T00:00:00Z" },
      cached as PortfolioState,
    );

    expect(state.assetQuality).toEqual({
      connected: false,
      records: [],
      cmcTop100Connected: false,
      binanceMonitoringConnected: false,
    });
  });

  it("переживает старый кэш без signals", () => {
    const cached = buildPortfolioState(rawPositions, decisionsData, scenariosData) as Partial<PortfolioState>;
    delete cached.signals;
    installCachedState(JSON.stringify({
      data: cached,
      cachedAt: "2026-07-30T00:00:00Z",
    }));

    const state = readCachedInvestorState();

    expect(state?.data.signals).toEqual({
      interest: null,
      interestList: [],
    });
  });

  it("не роняет V2 при старом состоянии без signals", () => {
    const state = buildPortfolioState(rawPositions, decisionsData, scenariosData) as Partial<PortfolioState>;
    delete state.signals;

    const data = buildLiveV2Data(state as PortfolioState, {}, {}, "main");

    expect(data.signals).toEqual({
      interest: null,
      interestList: [],
    });
  });

  it("не берёт устаревшие вопросы ДНК из live/cache fallback", () => {
    const staleState = buildPortfolioState(rawPositions, decisionsData, scenariosData) as PortfolioState;
    staleState.investorDNA = {
      ...MAIN_INVESTOR_DNA,
      fullQuestionGroups: [
        {
          title: "Финансовая база",
          questions: [
            {
              id: "full-1",
              text: "Какой общий размер капитала с учётом активов и долгов?",
            },
          ],
        },
      ],
    } as PortfolioState["investorDNA"];

    const state = buildInvestorStateFromApi(
      {
        success: true,
        updatedAt: "2026-08-15T00:00:00Z",
        investorDNA: {
          accountId: "main",
          investorType: "Профиль из API",
        },
      },
      staleState,
    );

    const fullOne = state.investorDNA?.fullQuestionGroups[0]?.questions[0];

    expect(fullOne?.text).toBe("Для чего тебе в первую очередь нужен инвестиционный капитал?");
    expect(fullOne?.answerKind).toBe("choice");
    expect(state.investorDNA?.investorType).toBe("Профиль из API");
  });

  it("санитизирует устаревшие вопросы ДНК при чтении localStorage cache", () => {
    const staleState = buildPortfolioState(rawPositions, decisionsData, scenariosData) as PortfolioState;
    staleState.investorDNA = {
      ...MAIN_INVESTOR_DNA,
      fullQuestionGroups: [
        {
          title: "Финансовая база",
          questions: [
            {
              id: "full-1",
              text: "Какой общий размер капитала с учётом активов и долгов?",
            },
          ],
        },
      ],
    } as PortfolioState["investorDNA"];

    installCachedState(JSON.stringify({
      data: staleState,
      cachedAt: "2026-08-15T00:00:00Z",
    }));

    const state = readCachedInvestorState();
    const fullOne = state?.data.investorDNA?.fullQuestionGroups[0]?.questions[0];

    expect(fullOne?.text).toBe("Для чего тебе в первую очередь нужен инвестиционный капитал?");
    expect(fullOne?.answerKind).toBe("choice");
  });
});
