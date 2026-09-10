import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(resolve(process.cwd(), "apps-script/walletSync.gs"), "utf8");

function loadWalletSync(options?: { nextSyncAt?: number; syncError?: Error }) {
  const properties = new Map<string, string>();
  if (options?.nextSyncAt) {
    properties.set("IC_WALLET_TON_NEXT_SYNC_AT", String(options.nextSyncAt));
  }

  const syncTonWalletImports = vi.fn(() => {
    if (options?.syncError) throw options.syncError;
  });
  const logger = vi.fn();
  const context = vm.createContext({
    console,
    Logger: { log: logger },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties.get(key) ?? null,
        setProperty: (key: string, value: string) => properties.set(key, value),
      }),
    },
    syncTonWalletImports,
  }) as Record<string, (...args: unknown[]) => unknown>;

  vm.runInContext(source, context);
  return { context, properties, syncTonWalletImports, logger };
}

describe("shared wallet sync reliability", () => {
  it("does not call TonAPI again inside the successful 15-minute interval", () => {
    const nextSyncAt = Date.now() + 10 * 60 * 1000;
    const { context, syncTonWalletImports } = loadWalletSync({ nextSyncAt });

    expect(context.IC_WALLET_syncTonWithRateLimitGuard_()).toEqual({
      ok: true,
      skipped: "cooldown",
    });
    expect(syncTonWalletImports).not.toHaveBeenCalled();
  });

  it("turns only TonAPI 429 into a 30-minute cooldown and preserves the trigger", () => {
    const before = Date.now();
    const { context, properties, logger } = loadWalletSync({
      syncError: new Error('TON API request failed: 429 {"error":"rate limit: anonymous tier"}'),
    });

    expect(context.IC_WALLET_syncTonWithRateLimitGuard_()).toEqual({
      ok: true,
      skipped: "tonapi_rate_limit",
    });
    expect(Number(properties.get("IC_WALLET_TON_NEXT_SYNC_AT"))).toBeGreaterThanOrEqual(
      before + 30 * 60 * 1000,
    );
    expect(logger).toHaveBeenCalledWith(expect.stringContaining("previous sheet values preserved"));
  });

  it("still throws non-rate-limit TON failures", () => {
    const { context } = loadWalletSync({
      syncError: new Error("TON API request failed: 500 upstream unavailable"),
    });

    expect(() => context.IC_WALLET_syncTonWithRateLimitGuard_()).toThrow("500 upstream unavailable");
  });
});
