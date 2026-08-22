import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("wife daily snapshot", () => {
  it("records snapshots from the same live valuation mode used by the cabinet", () => {
    const wifeApi = read("apps-script/wifePortfolioApi.gs");

    expect(wifeApi).toContain("var useLivePrices = useLive || options.useLivePrices === true;");
    expect(wifeApi).toContain("var useLiveStable = useLive || options.useLiveStable === true;");
    expect(wifeApi).toContain("var WIFE_CABINET_LIVE_URL = 'https://investor-cabinet.vercel.app/api/investor-wife';");
    expect(wifeApi).toContain("var wifeJson = fetchWifeCabinetLiveSnapshot_();");
    expect(wifeApi).toContain("function recordWifeDailySnapshot(params)");
    expect(wifeApi).toContain("writeWifeDailySnapshotOverview_(overview");
    expect(wifeApi).toContain("UrlFetchApp.fetch(WIFE_CABINET_LIVE_URL");
    expect(wifeApi).toContain("Wife portfolio daily snapshot; live valuation from cabinet API");
    expect(wifeApi).toContain("'WIFE API v2.6 - live snapshot base'");
  });
});
