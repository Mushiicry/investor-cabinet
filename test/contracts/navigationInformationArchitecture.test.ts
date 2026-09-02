import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("V2 navigation information architecture", () => {
  it("exposes the five primary pages in the approved desktop order", () => {
    const sidebar = read("src/v2/components/V2Sidebar.tsx");
    const labels = ["Обзор", "Портфель", "Здоровье", "Торговля", "Сценарии"];

    let previousIndex = -1;
    labels.forEach((label) => {
      const index = sidebar.indexOf(`label: "${label}"`);
      expect(index).toBeGreaterThan(previousIndex);
      previousIndex = index;
    });

    expect(sidebar).toContain("const reportsItem");
    expect(sidebar).toContain("const settingsItem");
    expect(sidebar).toContain("const educationItem");
    expect(sidebar).not.toContain('label: "Сигналы"');
    expect(sidebar).not.toContain('label: "Проверка"');
    expect(sidebar).not.toContain('label: "Риск"');
    expect(sidebar).not.toContain('label: "ДНК"');
  });

  it("uses the same five primary pages in the mobile tab bar", () => {
    const tabBar = read("src/v2/components/V2TabBar.tsx");

    expect(tabBar).toContain('page: "trading"');
    expect(tabBar).toContain('page: "scenarios"');
    expect(tabBar).not.toContain('page: "education"');
    expect(tabBar).not.toContain('page: "signals"');
  });

  it("keeps legacy child routes and groups them under their parent tabs", () => {
    const lab = read("src/v2/InvestorCabinetV2Lab.tsx");
    const shell = read("src/v2/components/V2Shell.tsx");
    const sidebar = read("src/v2/components/V2Sidebar.tsx");

    expect(lab).toContain('"trading"');
    expect(lab).toContain('"signals"');
    expect(lab).toContain('"gate"');
    expect(lab).toContain('"risk"');
    expect(lab).toContain('"dna"');
    expect(shell).toContain('page === "trading" || page === "signals" || page === "gate"');
    expect(sidebar).toContain('activePages: ["trading", "signals", "gate"]');
    expect(sidebar).toContain('activePages: ["health", "dna"]');
    expect(sidebar).toContain('activePages: ["scenarios", "risk"]');
  });
});
