import { describe, expect, it } from "vitest";
import { buildPortfolioState } from "../../src/lib/portfolioCalculations";
import { decisionsData, rawPositions, scenariosData } from "../../src/mocks/portfolioData";
import {
  MAIN_INVESTOR_DNA,
  WIFE_INVESTOR_DNA,
  dnaForSlot,
  normalizeInvestorDNAFromApi,
  type InvestorDNAQuestion,
} from "../../src/v2/lib/investorDNA";
import { MAIN_INVESTOR_PROFILE, WIFE_INVESTOR_PROFILE } from "../../src/v2/lib/investorProfile";
import { buildLiveV2Data, buildZeroedV2Data } from "../../src/v2/lib/v2LabData";

const normalizeQuestionText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[?.,:;$%]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const allFullQuestions = () => MAIN_INVESTOR_DNA.fullQuestionGroups.flatMap((group) => group.questions);

function expectChoiceQuestion(question: InvestorDNAQuestion) {
  expect(question.answerKind).toBe("choice");
  expect(question.options?.length).toBeGreaterThanOrEqual(2);
}

describe("investor DNA policy", () => {
  it("keeps investor DNA as a layer above profile, not as portfolio facts", () => {
    expect(MAIN_INVESTOR_DNA.profile).toBe(MAIN_INVESTOR_PROFILE);
    expect(WIFE_INVESTOR_DNA.profile).toBe(WIFE_INVESTOR_PROFILE);
    expect(MAIN_INVESTOR_DNA).not.toHaveProperty("positions");
    expect(MAIN_INVESTOR_DNA).not.toHaveProperty("portfolioValue");
    expect(MAIN_INVESTOR_DNA.ipsOutputs).toContain("бюджет риска");
  });

  it("captures current main account audit recommendations", () => {
    expect(MAIN_INVESTOR_DNA.investorType).toBe("Долгосрочный риск-ориентированный инвестор");
    expect(MAIN_INVESTOR_DNA.riskWillingness.value).toBeGreaterThan(MAIN_INVESTOR_DNA.riskCapacity.value);
    expect(MAIN_INVESTOR_DNA.recommendations.map((item) => item.id)).toEqual([
      "main-emergency-reserve",
      "main-benchmark-reset",
      "main-risk-management-study",
      "main-leverage-budget",
    ]);
    expect(MAIN_INVESTOR_DNA.benchmarkVerdict).toContain("$100 000");
    expect(MAIN_INVESTOR_DNA.liquidityRule).toContain("3 месяца");
    expect(MAIN_INVESTOR_DNA.liteQuestions).toHaveLength(12);
    expect(MAIN_INVESTOR_DNA.fullQuestionGroups.flatMap((group) => group.questions)).toHaveLength(50);
  });

  it("keeps the lite questionnaire as closed screening questions", () => {
    MAIN_INVESTOR_DNA.liteQuestions.forEach(expectChoiceQuestion);
  });

  it("keeps the full questionnaire deeper than the lite screening", () => {
    const liteTexts = new Set(MAIN_INVESTOR_DNA.liteQuestions.map((question) => normalizeQuestionText(question.text)));
    const fullQuestions = allFullQuestions();
    const fullTexts = fullQuestions.map((question) => normalizeQuestionText(question.text));

    expect(fullTexts.filter((text) => liteTexts.has(text))).toEqual([]);
    expect(fullQuestions.filter((question) => question.answerKind === "open")).toHaveLength(11);
    expect(fullQuestions.filter((question) => question.answerKind === "choice")).toHaveLength(39);
  });

  it("uses answer controls that match each full DNA question", () => {
    allFullQuestions().forEach((question) => {
      if (question.answerKind === "choice") {
        expect(question.options?.length).toBeGreaterThanOrEqual(2);
        return;
      }

      expect(question.options).toBeUndefined();
      expect(question.placeholder?.trim()).toBeTruthy();
    });
  });

  it("keeps risk and recommendation questions diagnostically separated", () => {
    const questionsById = new Map(allFullQuestions().map((question) => [question.id, question]));

    expect(questionsById.get("full-9")?.text).toContain("эмоционально");
    expect(questionsById.get("full-10")?.text).toContain("запретить новые покупки");
    expect(questionsById.get("full-47")?.text).toContain("Какая одна тема");
    expect(questionsById.get("full-50")?.text).toContain("реально будешь соблюдать");
  });

  it("keeps wife DNA separate from main DNA", () => {
    expect(dnaForSlot()).toBe(MAIN_INVESTOR_DNA);
    expect(dnaForSlot("main")).toBe(MAIN_INVESTOR_DNA);
    expect(dnaForSlot("wife")).toBe(WIFE_INVESTOR_DNA);
    expect(WIFE_INVESTOR_DNA.accountId).toBe("wife");
    expect(WIFE_INVESTOR_DNA.leverageRule).toContain("не подходят");
  });

  it("attaches DNA to V2 account data by selected account slot", () => {
    const state = buildPortfolioState(rawPositions, decisionsData, scenariosData);

    expect(buildLiveV2Data(state, {}, {}, "main").dna).toBe(MAIN_INVESTOR_DNA);
    expect(buildLiveV2Data(state, {}, {}, "wife").dna).toBe(WIFE_INVESTOR_DNA);
    expect(buildZeroedV2Data().dna).toBe(MAIN_INVESTOR_DNA);
  });

  it("normalizes optional Google Sheets DNA without replacing portfolio facts", () => {
    const dna = normalizeInvestorDNAFromApi(
      {
        accountId: "main",
        investorType: "Профиль из Google Sheets",
        riskWillingness: { label: "Готовность к риску", value: "77", note: "из анкеты" },
        riskCapacity: { label: "Способность принимать риск", value: "41", note: "из анкеты" },
        answers: [
          {
            auditId: "audit-1",
            accountId: "main",
            auditType: "lite",
            questionId: "lite-1",
            option: "Рост",
            note: "контекст",
            answeredAt: "2026-07-28T00:00:00.000Z",
            source: "google-sheets",
          },
        ],
      },
      MAIN_INVESTOR_DNA,
    );

    expect(dna.investorType).toBe("Профиль из Google Sheets");
    expect(dna.riskWillingness.value).toBe(77);
    expect(dna.riskCapacity.value).toBe(41);
    expect(dna.answers?.[0]).toMatchObject({ questionId: "lite-1", option: "Рост" });
    expect(dna).not.toHaveProperty("portfolioValue");
    expect(dna).not.toHaveProperty("positions");
  });
});
