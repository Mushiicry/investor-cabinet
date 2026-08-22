import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

type ScriptContext = Record<string, unknown> & {
  IC_BNB_classifyDeltas_: (
    calc: unknown,
    importSheet: unknown,
    previous: Record<string, number>,
    current: Record<string, number | null>,
    syncStartedAt: Date,
  ) => void;
};

function bnbContext() {
  const appendTrade = vi.fn();
  const appendStableFlow = vi.fn();
  const context = vm.createContext({
    console,
    Logger: { log: vi.fn() },
    IC_LEDGER_averageInPurchase_: vi.fn(),
    IC_LEDGER_appendTradeRow_: appendTrade,
    IC_LEDGER_appendStableFlowRow_: appendStableFlow,
    IC_LEDGER_ensureStableRow_: vi.fn(),
    IC_LEDGER_round_: (value: number) => value,
  }) as ScriptContext;

  vm.runInContext(read("apps-script/bnbWalletImport.gs"), context);
  return { context, appendTrade, appendStableFlow };
}

describe("BNB wallet import", () => {
  it("runs BNB Chain inside the shared five-minute wallet sync", () => {
    const walletSync = read("apps-script/walletSync.gs");

    expect(walletSync).toContain("'syncBnbWalletBalances'");
    expect(walletSync).toContain("IC_WALLET_runSyncStep_('BNB wallet balances'");
    expect(walletSync).toContain("setupBnbWalletImport();");
    expect(walletSync).toContain("syncBnbWalletBalances();");
  });

  it("uses responsive public BNB Chain RPC endpoints", () => {
    const importer = read("apps-script/bnbWalletImport.gs");

    expect(importer).toContain("https://bsc-mainnet.public.blastapi.io");
    expect(importer).toContain("https://1rpc.io/bnb");
    expect(importer).toContain("https://rpc-bsc.48.club");
    expect(importer).not.toContain("bsc-dataseed.binance.org");
  });

  it("classifies paired BNB decrease and USDC increase as a BNB sale", () => {
    const { context, appendTrade, appendStableFlow } = bnbContext();
    const previousBnb = 0.0108;
    const currentBnb = 0.000992688593723186;
    const previousUsdc = 17.54457721;
    const currentUsdc = 24.37768924064709;

    context.IC_BNB_classifyDeltas_(
      {},
      {},
      { "USDC BNB": previousUsdc, "USDT BNB": 0, SPCXB: 0.06644548, BNB: previousBnb },
      { "USDC BNB": currentUsdc, "USDT BNB": 0, STOCK: 0.06644548, BNB: currentBnb },
      new Date("2026-08-22T19:21:00.000Z"),
    );

    expect(appendTrade).toHaveBeenCalledTimes(1);
    expect(appendTrade.mock.calls[0][1]).toEqual(expect.objectContaining({
      action: "Продажа",
      asset: "BNB",
      quantity: expect.closeTo(previousBnb - currentBnb, 12),
      amount: expect.closeTo(currentUsdc - previousUsdc, 12),
      pairLabel: "BNB -> USDC",
    }));
    expect(appendStableFlow).not.toHaveBeenCalled();
  });

  it("keeps an unpaired small BNB decrease classified as gas", () => {
    const { context, appendTrade, appendStableFlow } = bnbContext();

    context.IC_BNB_classifyDeltas_(
      {},
      {},
      { "USDC BNB": 5, "USDT BNB": 0, SPCXB: 0.06644548, BNB: 0.01 },
      { "USDC BNB": 5, "USDT BNB": 0, STOCK: 0.06644548, BNB: 0.00999 },
      new Date("2026-08-22T19:21:00.000Z"),
    );

    expect(appendTrade).not.toHaveBeenCalled();
    expect(appendStableFlow).not.toHaveBeenCalled();
  });

  it("does not turn SPCXB sale gas into a second BNB sale", () => {
    const { context, appendTrade } = bnbContext();

    context.IC_BNB_classifyDeltas_(
      {},
      {},
      { "USDC BNB": 0, "USDT BNB": 0, SPCXB: 0.06644548, BNB: 0.01 },
      { "USDC BNB": 10, "USDT BNB": 0, STOCK: 0.05, BNB: 0.00999 },
      new Date("2026-08-22T19:21:00.000Z"),
    );

    expect(appendTrade).toHaveBeenCalledTimes(1);
    expect(appendTrade.mock.calls[0][1]).toEqual(expect.objectContaining({
      action: "Продажа",
      asset: "SPCXB",
    }));
  });

  it("keeps the one-time BNB sale repair audit-only and idempotent", () => {
    const importer = read("apps-script/bnbWalletImport.gs");
    const repair = importer.slice(importer.indexOf("function repairBnbSale20260822()"));

    expect(repair).toContain("already repaired");
    expect(repair).toContain("LEDGER_TRADE:BNB:20260822T230352:ПРОДАЖА:BNB:");
    expect(repair).toContain("setValues");
    expect(repair).not.toContain("deleteRow");
    expect(repair).not.toContain("IC_BNB_setQuantity_");
  });
});
