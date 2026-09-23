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
  const averageInPurchase = vi.fn();
  const context = vm.createContext({
    console,
    Logger: { log: vi.fn() },
    IC_LEDGER_averageInPurchase_: averageInPurchase,
    IC_LEDGER_appendTradeRow_: appendTrade,
    IC_LEDGER_appendStableFlowRow_: appendStableFlow,
    IC_LEDGER_ensureStableRow_: vi.fn(),
    IC_LEDGER_round_: (value: number) => value,
  }) as ScriptContext;

  vm.runInContext(read("apps-script/bnbWalletImport.gs"), context);
  return { context, appendTrade, appendStableFlow, averageInPurchase };
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

  it("tracks Tether Gold on BNB Chain as the existing GOLD portfolio asset", () => {
    const importer = read("apps-script/bnbWalletImport.gs");

    expect(importer).toContain("0x21caef8a43163eea865baee23b9c2e327696a3bf");
    expect(importer).toContain("var IC_BNB_GOLD_DECIMALS = 6");
    expect(importer).toContain("var IC_BNB_GOLD_SYMBOL = 'GOLD'");
    expect(importer).toContain("IC_BNB_setQuantity_(calculations, IC_BNB_GOLD_SYMBOL, gold)");
  });

  it("classifies a stable-to-XAUT swap as a GOLD purchase", () => {
    const { context, appendTrade, appendStableFlow, averageInPurchase } = bnbContext();

    context.IC_BNB_classifyDeltas_(
      {},
      {},
      { "USDC BNB": 20, "USDT BNB": 0, SPCXB: 0.06644548, GOLD: 0, BNB: 0.01 },
      { "USDC BNB": 0, "USDT BNB": 0, STOCK: 0.06644548, GOLD: 0.005686, BNB: 0.00999 },
      new Date("2026-09-17T08:05:28.000Z"),
    );

    expect(averageInPurchase).toHaveBeenCalledWith({}, "GOLD", 0.005686, 20);
    expect(appendTrade).toHaveBeenCalledTimes(1);
    expect(appendTrade.mock.calls[0][1]).toEqual(expect.objectContaining({
      action: "Покупка",
      asset: "GOLD",
      category: "Металлы",
      amount: 20,
      pairLabel: "USDC -> XAUT",
    }));
    expect(appendStableFlow).not.toHaveBeenCalled();
  });

  it("verifies both USDT and XAUT transfers in the confirmed swap receipt", () => {
    const { context } = bnbContext();
    const hash = "0x886a3fb12e5664b2844fcc76cfd9245d660e71b699f6747cd8f0fb2a738f5636";
    const wallet = "fec18d4474826afd65d578ff931f4ff2926ee0c3";
    const other = "e860b8f6eb2bd11367a8232b3bdbcc6fd1ec99a9";
    const transfer = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const topic = (address: string) => `0x${address.padStart(64, "0")}`;
    const log = (address: string, from: string, to: string, amount: bigint) => ({
      address,
      topics: [transfer, topic(from), topic(to)],
      data: `0x${amount.toString(16)}`,
      transactionHash: hash,
    });
    const xaut = "0x21caef8a43163eea865baee23b9c2e327696a3bf";
    const usdt = "0x55d398326f99059ff775485246999027b3197955";
    const receipt = { status: "0x1", logs: [
      log(xaut, other, wallet, 1736n),
      log(usdt, wallet, other, 7525342000000000000n),
      log(usdt, wallet, other, 22576026000000000000n),
      log(xaut, other, wallet, 5207n),
    ] };
    const parse = context.IC_BNB_parseGoldSwapReceipt_ as (receipt: unknown, hash: string) => unknown;
    expect(parse(receipt, hash)).toEqual(expect.objectContaining({
      hash, stable: "USDT", amount: 30.101368,
      quantity: expect.closeTo(0.006943, 8),
    }));
  });

  it("flags an unpaired XAUT increase without inventing cost basis", () => {
    const { context, appendTrade, averageInPurchase } = bnbContext();
    const review = vi.fn();
    context.IC_BNB_appendUnpairedGoldReview_ = review;

    context.IC_BNB_classifyDeltas_(
      {}, {},
      { "USDT BNB": 0, "USDC BNB": 0, SPCXB: 0.075726, GOLD: 0.005686, BNB: 0.001 },
      { "USDT BNB": 0, "USDC BNB": 0, STOCK: 0.075726, GOLD: 0.012629, BNB: 0.001 },
      new Date("2026-09-23T06:54:12.000Z"),
    );

    expect(review).toHaveBeenCalledTimes(1);
    expect(averageInPurchase).not.toHaveBeenCalled();
    expect(appendTrade).not.toHaveBeenCalled();
  });

  it("repairs the confirmed GOLD swap once without changing on-chain quantity", () => {
    const { context } = bnbContext();
    let avg = 20 / 0.005686;
    const importRows: unknown[][] = [];
    const appendRow = vi.fn((row: unknown[]) => { importRows.push(row); });
    const setImportValues = vi.fn((row: number, column: number, values: unknown[][]) => {
      values[0].forEach((value, index) => { importRows[row - 2][column - 1 + index] = value; });
    });
    const setQuantity = vi.fn();
    const calc = { getRange: (_row: number, column: number) => ({
      getValue: () => column === 3 ? 0.012629 : avg,
      setValue: (value: number) => { if (column === 3) setQuantity(value); else avg = value; },
      setFormula: vi.fn(),
    }) };
    const imports = {
      getLastRow: () => importRows.length + 1,
      getRange: (row: number, column: number) => ({
        getValues: () => importRows,
        setNumberFormat: vi.fn(),
        setValues: (values: unknown[][]) => setImportValues(row, column, values),
      }),
      appendRow,
    };
    context.IC_BNB_rpcCall_ = vi.fn(() => ({}));
    context.IC_BNB_parseGoldSwapReceipt_ = vi.fn(() => ({
      quantity: 0.006943, amount: 30.101368, stable: "USDT",
    }));
    context.IC_BNB_findAssetRow_ = vi.fn(() => 11);
    context.LockService = { getScriptLock: () => ({ waitLock: vi.fn(), releaseLock: vi.fn() }) };
    context.SpreadsheetApp = {
      getActiveSpreadsheet: () => ({ getSheetByName: (name: string) =>
        name === "Расчеты" ? calc : imports }),
      flush: vi.fn(),
    };

    const repair = context.repairGoldSwap20260923 as () => string;
    expect(repair()).toContain("one audit row added");
    expect(avg).toBeCloseTo(50.101368 / 0.012629, 9);
    expect(appendRow).toHaveBeenCalledTimes(1);
    expect(appendRow.mock.calls[0][0][12]).toBe(
      "0x886a3fb12e5664b2844fcc76cfd9245d660e71b699f6747cd8f0fb2a738f5636",
    );
    expect(appendRow.mock.calls[0][0][13]).toBe("");
    importRows[0][13] = importRows[0][12];
    importRows[0][12] = "BALANCE_DELTA";
    expect(repair()).toContain("already exists");
    expect(importRows[0][12]).toBe(appendRow.mock.calls[0][0][12]);
    expect(importRows[0][13]).toBe("");
    expect(setImportValues).toHaveBeenCalledTimes(1);
    expect(repair()).toContain("already exists");
    expect(setImportValues).toHaveBeenCalledTimes(1);
    expect(setQuantity).not.toHaveBeenCalled();
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
