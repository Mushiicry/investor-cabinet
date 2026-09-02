import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("account DNA wiring", () => {
  it("keeps DNA as an internal Health route and data model", () => {
    const lab = read("src/v2/InvestorCabinetV2Lab.tsx");
    const labData = read("src/v2/lib/v2LabData.ts");
    const shell = read("src/v2/components/V2Shell.tsx");
    const healthPage = read("src/v2/components/V2HealthPage.tsx");

    expect(lab).toContain("dna: InvestorDNA");
    expect(lab).toContain("\"dna\"");
    expect(labData).toContain("dnaForSlot(slot)");
    expect(shell).toContain("dna={data.dna}");
    expect(shell).toContain('page === "health" || page === "dna"');
    expect(shell).toContain('initialDNAExpanded={page === "dna"}');
    expect(healthPage).toContain("<V2InvestorDNAPage");
    expect(healthPage).toContain("embedded");
  });

  it("exposes the full DNA inside Health without duplicating its implementation", () => {
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
    expect(healthPage).toContain('aria-controls="investor-dna-content"');
    expect(healthPage).toContain('id="investor-dna-content"');
    expect(dnaPage).toContain("embedded?: boolean");
    expect(dnaPage).toContain("saveInvestorDNAAudit(");
  });
});
