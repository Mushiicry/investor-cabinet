import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("account DNA wiring", () => {
  it("adds DNA as a first-class V2 page and data model", () => {
    const lab = read("src/v2/InvestorCabinetV2Lab.tsx");
    const labData = read("src/v2/lib/v2LabData.ts");
    const shell = read("src/v2/components/V2Shell.tsx");
    const sidebar = read("src/v2/components/V2Sidebar.tsx");

    expect(lab).toContain("dna: InvestorDNA");
    expect(lab).toContain("\"dna\"");
    expect(labData).toContain("dnaForSlot(slot)");
    expect(shell).toContain("<V2InvestorDNAPage");
    expect(shell).toContain("dna={data.dna}");
    expect(sidebar).toContain("label: \"ДНК\"");
    expect(sidebar).toContain("page: \"dna\"");
  });

  it("keeps full DNA details on the DNA page and only verdict on Health", () => {
    const healthPage = read("src/v2/components/V2HealthPage.tsx");
    const dnaPage = read("src/v2/components/V2InvestorDNAPage.tsx");

    expect(dnaPage).toContain("Рекомендации ДНК");
    expect(dnaPage).toContain("dna.recommendations.map");
    expect(dnaPage).toContain("Первичная анкета");
    expect(dnaPage).toContain("Полная анкета ДНК");
    expect(dnaPage).toContain("dna.liteQuestions.map");
    expect(dnaPage).toContain("dna.fullQuestionGroups.map");
    expect(dnaPage).toContain("dna.ipsOutputs.map");
    expect(dnaPage).toContain("dna.auditSections.join");
    expect(healthPage).toContain('aria-label="Психология и дисциплина"');
    expect(healthPage).toContain("<strong>{dna.keyVerdict}</strong>");
    expect(healthPage).toContain("Открыть ДНК инвестора");
  });
});
