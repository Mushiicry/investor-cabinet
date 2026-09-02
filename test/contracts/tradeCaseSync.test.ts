import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("TradeCase cloud synchronization", () => {
  it("uses authenticated owner-only API actions", () => {
    const api = read("src/api/tradeCases.ts");
    const proxy = read("api/_investorProxy.js");

    expect(api).toContain('url.searchParams.set("action", "listTradeCases")');
    expect(api).toContain('url.searchParams.set("action", "upsertTradeCases")');
    expect(api).toContain("authorizationHeader()");
    expect(proxy).toContain('const allowedOwnerGetActions = new Set(["listTradeCases"])');
    expect(proxy).toContain('"upsertTradeCases"');
    expect(proxy).toContain("requiresOwnerAuth");
  });

  it("keeps account isolation and stable-id upsert in Apps Script", () => {
    const mainScript = read("apps-script/Код.js");
    const tradeCases = read("apps-script/tradeCases.gs");

    expect(mainScript).toContain('action === "listTradeCases"');
    expect(mainScript).toContain('action === "upsertTradeCases"');
    expect(mainScript).toContain("IC_TRADE_CASE_handleList_(ss, accountId)");
    expect(mainScript).toContain("IC_TRADE_CASE_handleUpsert_(ss, e, accountId)");
    expect(tradeCases).toContain('const IC_TRADE_CASE_SHEET = "TradeCases"');
    expect(tradeCases).toContain('const key = accountId + "::" + incoming.tradeCaseId');
    expect(tradeCases).toContain("IC_TRADE_CASE_time_(incoming.updatedAt) >= IC_TRADE_CASE_time_(current.updatedAt)");
    expect(tradeCases).toContain("LockService.getScriptLock()");
  });

  it("merges the local cache with cloud data without a separate Trading status card", () => {
    const shell = read("src/v2/components/V2Shell.tsx");
    const page = read("src/v2/components/V2TradingPage.tsx");

    expect(shell).toContain("readCloudTradeCaseStore(data.strategy.id)");
    expect(shell).toContain("mergeTradeCaseStores(cloudStore, latestLocal)");
    expect(shell).toContain("upsertCloudTradeCaseStore(data.strategy.id, merged)");
    expect(shell).toContain("queueTradeCaseCloudSync(persisted)");
    expect(shell).toContain('setTradeCaseSyncState("synced")');
    expect(shell).toContain('setTradeCaseSyncState("error")');
    expect(page).not.toContain("Ручное исполнение");
    expect(page).not.toContain("Синхронизировано");
  });
});
