import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("account profile wiring", () => {
  it("passes the selected investor profile through shell surfaces", () => {
    const labData = read("src/v2/lib/v2LabData.ts");
    const lab = read("src/v2/InvestorCabinetV2Lab.tsx");
    const shell = read("src/v2/components/V2Shell.tsx");

    expect(lab).toContain("profile: InvestorProfile");
    expect(labData).toContain("profileForSlot(slot)");
    expect(shell).toContain("profile={data.profile}");
  });

  it("moves the full investor portrait to the DNA page and keeps health compact", () => {
    const healthPage = read("src/v2/components/V2HealthPage.tsx");
    const dnaPage = read("src/v2/components/V2InvestorDNAPage.tsx");

    expect(healthPage).toContain('aria-label="Психология и дисциплина"');
    expect(healthPage).toContain("<strong>{dna.keyVerdict}</strong>");
    expect(healthPage).toContain("Открыть ДНК инвестора");
    expect(healthPage).not.toContain("function InvestorProfileCard");
    expect(dnaPage).toContain("ДНК Инвестора");
    expect(dnaPage).toContain("Рекомендации ДНК");
    expect(dnaPage).toContain("Первичная анкета");
    expect(dnaPage).toContain("Полная анкета ДНК");
  });

  it("connects the profile filter to gate and decision engine", () => {
    const gatePage = read("src/v2/components/V2GatePage.tsx");
    const gate = read("src/v2/lib/preTradeGate.ts");
    const decision = read("src/v2/lib/decisionEngine.ts");

    expect(gatePage).toContain("investorProfile: profile");
    expect(gate).toContain("evaluateInvestorProfileTrade");
    expect(gate).toContain("\"investorProfile\"");
    expect(decision).toContain("\"портрет_инвестора\"");
  });
});
