import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("scenarios and risk information architecture", () => {
  it("keeps scenarios and risk in one main workspace", () => {
    const shell = read("src/v2/components/V2Shell.tsx");
    const hub = read("src/v2/components/V2ScenariosHubPage.tsx");

    expect(shell).toContain('page === "scenarios" || page === "risk"');
    expect(shell).toContain('initialSection={page === "risk" ? "risk" : "playbook"}');
    expect(shell).not.toContain(') : page === "risk" ? (');
    expect(hub).toContain("<V2ScenariosPage");
    expect(hub).toContain("<V2RiskEnginePage");
    expect(hub).toContain("Сценарии и решения");
    expect(hub).toContain("Риск и ограничения");
  });

  it("passes the existing data and strategy into both preserved sections", () => {
    const shell = read("src/v2/components/V2Shell.tsx");
    const hub = read("src/v2/components/V2ScenariosHubPage.tsx");

    expect(shell).toContain("playbook={data.playbook}");
    expect(shell).toContain("positions={data.positions}");
    expect(shell).toContain("risk={data.risk}");
    expect(shell).toContain("allocation={data.allocation}");
    expect(shell).toContain("strategy={data.strategy}");
    expect(hub).toContain("strategy={strategy}");
    expect(hub).toContain('hidden={section !== "playbook"}');
    expect(hub).toContain('hidden={section !== "risk"}');
  });
});
