import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const appsScriptIds = (content: string) =>
  [...content.matchAll(/AKfycb[a-zA-Z0-9_-]+/g)].map((match) => match[0]);

describe("local and production API config consistency", () => {
  it("routes local investor APIs through the same proxy as production", () => {
    const viteConfig = read("vite.config.ts");
    const mainId = "AKfycbwBtbI9LmbZGyr4gi35oXym56i1py5J_oy0shp_gDotJBmsRnG2UmVVvmPFBigoE3uLeA";
    const wifeId = "AKfycby9bBE9iJjilKgCcEwo93-tT0xQXUSBj92F_xBPsJJOrHDZUMaeGnm5rWZq4cujslZr";
    const proxyConfig = read("api/_investorProxy.js");
    const wifeRouteIndex = viteConfig.indexOf("'/api/investor-wife'");
    const mainRouteIndex = viteConfig.indexOf("'/api/investor'");

    expect(viteConfig).not.toContain("investor-local-auth-proxy");
    expect(viteConfig).toContain("proxyInvestorApi");
    expect(viteConfig).not.toContain("target: 'https://script.google.com'");
    expect(wifeRouteIndex).toBeGreaterThanOrEqual(0);
    expect(mainRouteIndex).toBeGreaterThanOrEqual(0);
    expect(wifeRouteIndex).toBeLessThan(mainRouteIndex);
    expect(appsScriptIds(proxyConfig)).toEqual(expect.arrayContaining([mainId, wifeId]));
  });

  it("does not expose investor Apps Script URLs through production rewrites", () => {
    const vercelConfig = read("vercel.json");
    const parsed = JSON.parse(vercelConfig) as { rewrites?: { source: string; destination: string }[] };

    expect(parsed.rewrites ?? []).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "/api/investor" }),
      expect.objectContaining({ source: "/api/investor-wife" }),
    ]));
  });
});
