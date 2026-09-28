import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

type Row = (string | number | Date)[];
const address = "bc1q0u2ch352h0mjz9609z799pefufen42n9vhy28e";
const change = "bc1q39rzjxhdqyj8c5q599c6fh4g8ulv3g5l7w7z59";
const hash = (char: string) => char.repeat(64);
const config = { walletId: "main", addresses: [address, change].sort() };
const state = { height: 100, blockHash: hash("a"), sats: 31719, addresses: config.addresses, syncedAt: 0 };
type Plan = {
  status: string; nextSats: number; rows: Row[]; assetRow?: number;
};
type ScriptContext = Record<string, unknown> & {
  IC_BTC_buildPlan_: (...args: unknown[]) => Plan;
  IC_BTC_commitPlan_: (...args: unknown[]) => void;
  IC_BTC_readSnapshot_: (...args: unknown[]) => { txs: ReturnType<typeof tx>[]; sats: number };
  IC_BTC_orderTransactions_: (...args: unknown[]) => ReturnType<typeof tx>[];
  IC_BTC_sats_: (value: unknown) => number;
  syncBitcoinWalletImports: () => Record<string, unknown>;
  syncInvestorCabinetWallets: () => void;
};

function sheet(initial: Row[], maxRows = 200) {
  const rows = initial.map(row => [...row]);
  let writes = 0;
  const target = {
    rows,
    failOnce: false,
    getLastRow: () => rows.length,
    getMaxRows: () => maxRows,
    insertRowsAfter: (_index: number, count: number) => { maxRows += count; },
    getRange: (r: number, c: number, height = 1, width = 1) => ({
      getValues: () => Array.from({ length: height }, (_, dy) =>
        Array.from({ length: width }, (_, dx) => rows[r - 1 + dy]?.[c - 1 + dx] ?? "")),
      setValues: (values: Row[]) => {
        if (target.failOnce) { target.failOnce = false; throw new Error("interrupted write"); }
        values.forEach((row, dy) => row.forEach((value, dx) => {
          rows[r - 1 + dy] ??= [];
          rows[r - 1 + dy][c - 1 + dx] = value;
        }));
        writes++;
      },
      setValue: (value: string | number | Date) => {
        rows[r - 1] ??= [];
        rows[r - 1][c - 1] = value;
      },
      getDataValidation: () => null,
    }),
    writes: () => writes,
  };
  return target;
}

function harness() {
  const properties = new Map<string, string>();
  const props = {
    getProperty: (key: string) => properties.get(key) ?? null,
    setProperty: (key: string, value: string) => { properties.set(key, value); },
    deleteProperty: (key: string) => { properties.delete(key); },
  };
  const calculations = sheet([["Asset"], ["BTC", "Крипта", 0.00031719, 56451.6129032258, "=C2*D2"]]);
  const imports = sheet([Array(19).fill("header")]);
  const balances = sheet([["Wallet ID"]]);
  const wallets = sheet([["Wallet ID"], ["main", address, change, "ACTIVE", "", ""]]);
  const sheets: Record<string, ReturnType<typeof sheet>> = {
    "Расчеты": calculations, "Транзакции_IMPORT": imports,
    BTC_WALLET_BALANCES: balances, BTC_WALLETS: wallets,
  };
  const ss = { getSheetByName: (name: string) => sheets[name] };
  const requests: string[] = [];
  const replies = new Map<string, unknown>();
  const context = vm.createContext({
    Date, console,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush: () => {} },
    PropertiesService: { getScriptProperties: () => props },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Session: { getScriptTimeZone: () => "Europe/Moscow" },
    Utilities: {
      formatDate: (date: Date) => date.toISOString().replace("Z", "").slice(0, 19),
      newBlob: (text: string) => ({ getBytes: () => Buffer.from(text) }),
    },
    UrlFetchApp: { fetch: (url: string) => {
      requests.push(url);
      const path = new URL(url).pathname.replace(/^\/api/, "");
      const value = replies.get(path);
      return { getResponseCode: () => value === undefined ? 503 : 200,
        getContentText: () => typeof value === "string" ? value : JSON.stringify(value) };
    } },
  });
  for (const file of ["walletLedger.gs", "bitcoinWalletImport.gs", "walletSync.gs"]) {
    vm.runInContext(readFileSync(resolve(process.cwd(), "apps-script", file), "utf8"), context);
  }
  const api = context as ScriptContext;
  const snapshot = (sats: number, txs: unknown[] = [], mempoolCount = 0) =>
    ({ sats, txs, mempoolCount, height: 102, blockHash: hash("b") });
  const plan = (sats: number, txs: unknown[] = [], currentState: typeof state | null = state) =>
    ({ ...api.IC_BTC_buildPlan_(config, currentState, snapshot(sats, txs), 31719, 56451.6129032258), assetRow: 2 });
  const network = (txs: unknown[] = [], sats = 31719) => {
    replies.set("/blocks/tip/hash", hash("b"));
    replies.set("/blocks/tip/height", "102");
    replies.set("/block-height/102", hash("b"));
    replies.set("/block-height/100", hash("a"));
    for (const addr of config.addresses) {
      replies.set(`/address/${addr}`, { address: addr,
        chain_stats: { funded_txo_sum: addr === change ? sats : 0, spent_txo_sum: 0 },
        mempool_stats: { tx_count: 0 } });
      replies.set(`/address/${addr}/txs/chain`, txs);
    }
  };
  return { api, props, properties, calculations, imports, balances, wallets, ss, replies, requests, snapshot, plan, network };
}

function tx(id = "c", inputAddress = "external", input = 10000, outputAddress = address, output = 9900) {
  return { txid: hash(id), vin: [{ txid: hash("e"), prevout: { scriptpubkey_address: inputAddress, value: input } }],
    vout: [{ scriptpubkey_address: outputAddress, value: output }], fee: input - output,
    status: { confirmed: true, block_height: 101, block_hash: hash("d"), block_time: 1790606996 } };
}

describe("native Bitcoin address import", () => {
  it("baselines the repaired position without replaying the historical sale or crediting USDC", () => {
    const h = harness();
    const plan = h.plan(31719, [], null);
    expect(plan.status).toBe("READY");
    h.api.IC_BTC_commitPlan_(h.ss, h.props, plan);
    expect(h.imports.rows).toHaveLength(1);
    expect(h.calculations.rows[1]).toEqual(["BTC", "Крипта", 0.00031719, 56451.6129032258, "=C2*D2"]);
    expect(JSON.parse(h.properties.get("IC_BTC_IMPORT_STATE")!).height).toBe(102);
  });

  it("imports incoming BTC once and preserves invested capital without inventing a purchase price", () => {
    const h = harness();
    const plan = h.plan(41619, [tx()]);
    h.api.IC_BTC_commitPlan_(h.ss, h.props, plan);
    h.api.IC_BTC_commitPlan_(h.ss, h.props, plan);
    expect(h.calculations.rows[1][2]).toBe(0.00041619);
    expect(Number(h.calculations.rows[1][2]) * Number(h.calculations.rows[1][3])).toBeCloseTo(17.905887096774194, 10);
    expect(h.imports.rows).toHaveLength(2);
    expect(h.imports.rows[1][5]).toBe("Перевод");
    expect(h.imports.rows[1][8]).toBe("");
    expect(h.imports.rows[1][12]).toBe(hash("c"));
    expect(h.imports.rows[1][18]).toMatch(/^BALANCE_APPLIED/);
  });

  it("accounts for the exact fee of a transfer between verified wallet addresses", () => {
    const h = harness();
    const plan = h.plan(31438, [tx("c", change, 31719, address, 31438)]);
    h.api.IC_BTC_commitPlan_(h.ss, h.props, plan);
    expect(h.calculations.rows[1][2]).toBe(0.00031438);
    expect(h.calculations.rows[1][3]).toBe(56451.6129032258);
    expect(h.imports.rows[1][5]).toBe("Комиссия");
    expect(h.imports.rows[1][6]).toBe(0.00000281);
  });

  it("holds a withdrawal to an unknown change address instead of zeroing the wallet or fabricating a sale", () => {
    const h = harness();
    const plan = h.plan(0, [tx("c", change, 31719, "unknown-change", 31438)]);
    expect(plan.status).toBe("NEEDS_ADDRESS_REVIEW");
    h.api.IC_BTC_commitPlan_(h.ss, h.props, plan);
    h.api.IC_BTC_commitPlan_(h.ss, h.props, plan);
    expect(h.calculations.rows[1][2]).toBe(0.00031719);
    expect(h.imports.rows).toHaveLength(2);
    expect(h.imports.rows[1][18]).toMatch(/^BTC_REVIEW/);
    expect(JSON.parse(h.properties.get("IC_BTC_IMPORT_STATE")!).height).toBe(100);
  });

  it("holds the whole batch when a later transaction needs review", () => {
    const h = harness();
    const outgoing = tx("f", change, 31719, "unknown", 31438);
    outgoing.status.block_height = 102;
    const plan = h.plan(9900, [tx(), outgoing]);
    expect(plan.nextSats).toBe(31719);
    expect(plan.rows.every((row: Row) => String(row[18]).startsWith("BTC_REVIEW"))).toBe(true);
  });

  it("holds mixed-input transactions and rejects malformed balances/fees", () => {
    const h = harness();
    const mixed = tx("c", change, 31719, address, 40000);
    mixed.vin.push({ txid: hash("f"), prevout: { scriptpubkey_address: "external", value: 8562 } });
    mixed.fee = 281;
    expect(h.plan(40000, [mixed]).status).toBe("NEEDS_ADDRESS_REVIEW");
    expect(() => h.api.IC_BTC_sats_(undefined)).toThrow();
    expect(() => h.api.IC_BTC_sats_("31719")).toThrow();
    expect(() => h.api.IC_BTC_sats_(-1)).toThrow();
    const malformed = tx();
    malformed.fee++;
    expect(() => h.plan(41619, [malformed])).toThrow(/conservation/);
    malformed.status.confirmed = false;
    expect(() => h.plan(41619, [malformed])).toThrow(/confirmed/);
  });

  it("replays an interrupted apply after the audit append without duplicating quantity or rows", () => {
    const h = harness();
    const plan = h.plan(41619, [tx()]);
    h.props.setProperty("IC_BTC_PENDING_APPLY", JSON.stringify(plan));
    h.calculations.failOnce = true;
    expect(() => h.api.IC_BTC_commitPlan_(h.ss, h.props, plan)).toThrow(/interrupted/);
    expect(h.imports.rows).toHaveLength(2);
    expect(h.api.syncBitcoinWalletImports()).toEqual({ skipped: "cooldown" });
    expect(h.imports.rows).toHaveLength(2);
    expect(h.calculations.rows[1][2]).toBe(0.00041619);
    expect(h.properties.has("IC_BTC_PENDING_APPLY")).toBe(false);
  });

  it("refuses a pending apply if a user changed the position in the meantime", () => {
    const h = harness();
    const plan = h.plan(41619, [tx()]);
    h.calculations.rows[1][2] = 0.001;
    expect(() => h.api.IC_BTC_commitPlan_(h.ss, h.props, plan)).toThrow(/manually changed/);
    expect(h.imports.rows).toHaveLength(1);
  });

  it("deduplicates history across receive/change addresses and applies confirmed amounts only", () => {
    const h = harness();
    h.network([tx()], 41619);
    const snapshot = h.api.IC_BTC_readSnapshot_(config.addresses, state);
    expect(snapshot.txs).toHaveLength(1);
    expect(snapshot.sats).toBe(41619);
    expect(h.requests.every(url => !url.includes("mempool.space"))).toBe(true);
  });

  it("paginates past 25 transactions and rejects a reorg without touching the position", () => {
    const h = harness();
    const txs = Array.from({ length: 25 }, (_, i) => ({ ...tx(), txid: i.toString(16).padStart(64, "0") }));
    h.network(txs);
    for (const addr of config.addresses) h.replies.set(`/address/${addr}/txs/chain/${txs[24].txid}`, []);
    expect(h.api.IC_BTC_readSnapshot_(config.addresses, state).txs).toHaveLength(25);
    expect(h.requests.some(url => url.endsWith(`/txs/chain/${txs[24].txid}`))).toBe(true);
    h.replies.set("/block-height/100", hash("f"));
    expect(() => h.api.IC_BTC_readSnapshot_(config.addresses, state)).toThrow(/reorg/);
    expect(h.calculations.rows[1][2]).toBe(0.00031719);
  });

  it("fails closed on incomplete API data or an API outage", () => {
    const h = harness();
    h.network();
    h.replies.set(`/address/${address}`, { address, chain_stats: {}, mempool_stats: { tx_count: 0 } });
    expect(() => h.api.syncBitcoinWalletImports()).toThrow(/satoshi/);
    expect(h.calculations.rows[1][2]).toBe(0.00031719);
    h.replies.clear();
    expect(() => h.api.syncBitcoinWalletImports()).toThrow(/503/);
    expect(h.calculations.rows[1][2]).toBe(0.00031719);
  });

  it("runs BTC from the existing unified trigger and preserves independent network steps on failure", () => {
    const h = harness();
    const called: string[] = [];
    for (const name of ["IC_WALLET_syncTonWithRateLimitGuard_", "setupArbitrumWalletImport", "syncArbitrumWalletBalances",
      "setupSolanaWalletImport", "syncSolanaWalletBalances", "setupCosmosWalletImport", "syncCosmosWalletBalances",
      "setupHyperliquidAccountImport", "syncHyperliquidAccountState", "setupBnbWalletImport", "syncBnbWalletBalances"]) {
      h.api[name] = () => { called.push(name); };
    }
    h.api.syncBitcoinWalletImports = () => { called.push("BTC"); throw new Error("BTC offline"); };
    expect(() => h.api.syncInvestorCabinetWallets()).toThrow(/Bitcoin wallet import: BTC offline/);
    expect(called[0]).toBe("BTC");
    expect(called).toContain("syncBnbWalletBalances");
  });

  it("orders same-block dependent transactions before spending their incoming output", () => {
    const h = harness();
    const incoming = tx("f");
    const fee = tx("c", address, 9900, change, 9800);
    fee.vin[0].txid = incoming.txid;
    expect(h.api.IC_BTC_orderTransactions_([fee, incoming]).map((item: { txid: string }) => item.txid)).toEqual([incoming.txid, fee.txid]);
  });

  it("keeps unconfirmed coins out of the position and reports the pending mempool", () => {
    const h = harness();
    const plan = h.api.IC_BTC_buildPlan_(config, state, h.snapshot(31719, [], 1), 31719, 56451.6129032258);
    expect(plan.status).toBe("MEMPOOL_PENDING");
    expect(plan.nextSats).toBe(31719);
    expect(plan.rows).toHaveLength(0);
  });

  it("does not silently establish a baseline when configured addresses disagree with accounting", () => {
    const h = harness();
    expect(h.plan(0, [], null).status).toBe("NEEDS_ADDRESS_REVIEW");
    expect(h.plan(0, [], null).nextSats).toBe(31719);
  });

  it("recovers a failure after the quantity write, keeping the same hash and cost basis", () => {
    const h = harness();
    const plan = h.plan(41619, [tx()]);
    h.props.setProperty("IC_BTC_PENDING_APPLY", JSON.stringify(plan));
    h.balances.failOnce = true;
    expect(() => h.api.IC_BTC_commitPlan_(h.ss, h.props, plan)).toThrow(/interrupted/);
    expect(h.calculations.rows[1][2]).toBe(0.00041619);
    expect(h.api.syncBitcoinWalletImports()).toEqual({ skipped: "cooldown" });
    expect(h.imports.rows).toHaveLength(2);
    expect(h.calculations.rows[1][2]).toBe(0.00041619);
  });

  it("tries the fallback API when the primary snapshot request fails", () => {
    const h = harness();
    h.network();
    const original = h.api.IC_BTC_fetch_ as (base: string, path: string, json: boolean) => unknown;
    h.api.IC_BTC_fetch_ = (base: string, path: string, json: boolean) => {
      if (base.includes("blockstream")) throw new Error("429");
      return original(base, path, json);
    };
    expect(h.api.IC_BTC_readSnapshot_(config.addresses, state).sats).toBe(31719);
    expect(h.requests.some(url => url.includes("mempool.space"))).toBe(true);
  });
});
