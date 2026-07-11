import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const appsScriptIds = (content: string) =>
  [...content.matchAll(/AKfycb[a-zA-Z0-9_-]+/g)].map((match) => match[0]);

describe("local and production API config consistency", () => {
  it("keeps local wife proxy aligned with the serverless wife fallback deployment", () => {
    const viteConfig = read("vite.config.ts");
    const proxy = read("api/_investorProxy.ts");
    const wifeId = "AKfycbwPvwu-EMXb9hGCZeRFhr9O8Vvz5-2y1sqn4V4OMsgqNkTs2t3U6zGDw7SVgdPVmrwg";

    expect(appsScriptIds(viteConfig)).toContain(wifeId);
    expect(appsScriptIds(proxy)).toContain(wifeId);
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
