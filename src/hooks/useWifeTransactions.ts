/* eslint-disable @typescript-eslint/no-explicit-any -- внешние JSON-ответы блокчейн-API */
import { useEffect, useRef, useState } from "react";
import type { InvestorTransaction } from "../types/portfolio";

const EVM_ADDRESS = "0x06F03b067b34f3d6E569De9aB7839c988Bf6BAEE";
const TON_ADDRESS = "UQCMRrWTgMBqBMr6yUw04ZYz398fyIhDlaJyaqoQTchVNm74";
const BTC_ADDRESS = "bc1qmmpq6jm6rr02anv7ldnpq29cqrpqesswesv7at";

const REFRESH_MS = 5 * 60 * 1000;

const STABLE_SYMBOLS = new Set(["USDT", "USDC", "DAI", "BUSD", "USDE"]);

function normalizeAssetSymbol(symbol: string): string {
  const normalized = symbol
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/₮/g, "T")
    .replace(/Т/g, "T")
    .toUpperCase();
  if (normalized === "USDT0" || normalized === "USDTE" || normalized.startsWith("USDT")) {
    return "USDT";
  }
  return normalized;
}

function isStable(symbol: string): boolean {
  return STABLE_SYMBOLS.has(normalizeAssetSymbol(symbol));
}

function addrLower(a: string | null | undefined): string {
  return (a ?? "").toLowerCase();
}

function bcAction(assetSymbol: string, isIn: boolean): string {
  // Raw wallet stable transfers are capital flows unless a paired swap importer
  // explicitly rewrites them into Покупка/Продажа.
  if (isStable(assetSymbol)) return isIn ? "Пополнение" : "Вывод";
  // For non-stables: IN → "Покупка", OUT → "Продажа"
  return isIn ? "Покупка" : "Продажа";
}

// ─── Blockscout (Arbitrum) ────────────────────────────────────────────────────

async function fetchArbTokenTransfers(): Promise<InvestorTransaction[]> {
  const url = `https://arbitrum.blockscout.com/api/v2/addresses/${EVM_ADDRESS}/token-transfers`;
  const r = await fetch(url);
  const d: any = await r.json();
  const items: any[] = d.items ?? [];

  return items.flatMap((item) => {
    const hash: string = item.tx_hash ?? item.transaction_hash ?? "";
    const decimals = Number(item.token?.decimals ?? 6);
    const rawQty = Number(item.total?.value ?? 0);
    const quantity = rawQty / Math.pow(10, decimals);
    const rawSymbol: string = item.token?.symbol ?? "UNKNOWN";
    const symbol = normalizeAssetSymbol(rawSymbol);

    if (quantity < 0.0001 || !hash) return [];

    const isIn = addrLower(item.to?.hash) === addrLower(EVM_ADDRESS);
    const action = bcAction(symbol, isIn);

    const tx: InvestorTransaction = {
      id: `bc:arb_tok:${hash}:${item.total?.value ?? rawQty}`,
      date: item.timestamp ?? new Date().toISOString(),
      asset: symbol,
      category: isStable(symbol) ? "Свободные деньги" : "Крипта",
      action,
      quantity,
      price: 0,
      amount: isStable(symbol) ? quantity : 0,
      comment: "",
      walletId: EVM_ADDRESS,
      chain: "ARB",
      hash,
      status: "CONFIRMED",
      direction: isIn ? "IN" : "OUT",
      counterparty: isIn
        ? (item.from?.hash ?? "")
        : (item.to?.hash ?? ""),
      rawAsset: rawSymbol,
      rawAmount: quantity,
      note: "blockchain",
    };
    return [tx];
  });
}

async function fetchArbEthTransfers(): Promise<InvestorTransaction[]> {
  const url = `https://arbitrum.blockscout.com/api/v2/addresses/${EVM_ADDRESS}/transactions`;
  const r = await fetch(url);
  const d: any = await r.json();
  const items: any[] = d.items ?? [];

  return items.flatMap((item) => {
    // Only plain ETH transfers — skip zero-value contract calls
    const ethAmount = Number(BigInt(item.value ?? "0")) / 1e18;
    if (ethAmount < 0.0001) return [];

    const hash: string = item.hash ?? "";
    if (!hash) return [];

    const isIn = addrLower(item.to?.hash) === addrLower(EVM_ADDRESS);

    const tx: InvestorTransaction = {
      id: `bc:arb_eth:${hash}`,
      date: item.timestamp ?? new Date().toISOString(),
      asset: "ETH",
      category: "Крипта",
      action: isIn ? "Покупка" : "Продажа",
      quantity: ethAmount,
      price: 0,
      amount: 0,
      comment: "",
      walletId: EVM_ADDRESS,
      chain: "ARB",
      hash,
      status: item.status === "ok" ? "CONFIRMED" : "PENDING",
      direction: isIn ? "IN" : "OUT",
      counterparty: isIn
        ? (item.from?.hash ?? "")
        : (item.to?.hash ?? ""),
      rawAsset: "ETH",
      rawAmount: ethAmount,
      note: "blockchain",
    };
    return [tx];
  });
}

// ─── TONapi ───────────────────────────────────────────────────────────────────

async function fetchTonTransactions(): Promise<InvestorTransaction[]> {
  const url = `https://tonapi.io/v2/accounts/${TON_ADDRESS}/events?limit=50&subject_only=true`;
  const r = await fetch(url);
  const d: any = await r.json();
  const events: any[] = d.events ?? [];

  const txs: InvestorTransaction[] = [];

  for (const evt of events) {
    const eventId: string = evt.event_id ?? String(evt.lt ?? "");
    const date = evt.timestamp
      ? new Date((evt.timestamp as number) * 1000).toISOString()
      : new Date().toISOString();

    const actions: any[] = evt.actions ?? [];
    for (let i = 0; i < actions.length; i++) {
      const act = actions[i];
      const rowId = `bc:ton:${eventId}:${i}`;

      if (act.type === "TonTransfer") {
        const tt = act.TonTransfer ?? {};
        const quantity = Number(tt.amount ?? 0) / 1e9;
        if (quantity < 0.01) continue;
        const isIn = addrLower(tt.sender?.address) !== addrLower(TON_ADDRESS);
        txs.push({
          id: rowId,
          date,
          asset: "TON",
          category: "Крипта",
          action: isIn ? "Покупка" : "Продажа",
          quantity,
          price: 0,
          amount: 0,
          comment: "",
          walletId: TON_ADDRESS,
          chain: "TON",
          hash: eventId,
          status: "CONFIRMED",
          direction: isIn ? "IN" : "OUT",
          counterparty: isIn
            ? (tt.sender?.address ?? "")
            : (tt.recipient?.address ?? ""),
          rawAsset: "TON",
          rawAmount: quantity,
          note: "blockchain",
        });
      } else if (act.type === "JettonTransfer") {
        const jt = act.JettonTransfer ?? {};
        const decimals = Number(jt.jetton?.decimals ?? 6);
        const quantity = Number(jt.amount ?? 0) / Math.pow(10, decimals);
        if (quantity < 0.001) continue;
        const symbol: string = jt.jetton?.symbol ?? "USDT";
        const cleanSymbol = normalizeAssetSymbol(symbol);
        const isIn = addrLower(jt.sender?.address) !== addrLower(TON_ADDRESS);
        const action = bcAction(cleanSymbol, isIn);
        txs.push({
          id: rowId,
          date,
          asset: cleanSymbol,
          category: isStable(cleanSymbol) ? "Свободные деньги" : "Крипта",
          action,
          quantity,
          price: 0,
          amount: isStable(cleanSymbol) ? quantity : 0,
          comment: "",
          walletId: TON_ADDRESS,
          chain: "TON",
          hash: eventId,
          status: "CONFIRMED",
          direction: isIn ? "IN" : "OUT",
          counterparty: isIn
            ? (jt.sender?.address ?? "")
            : (jt.recipient?.address ?? ""),
          rawAsset: cleanSymbol,
          rawAmount: quantity,
          note: "blockchain",
        });
      }
    }
  }

  return txs;
}

// ─── Blockstream (Bitcoin) ────────────────────────────────────────────────────

async function fetchBtcTransactions(): Promise<InvestorTransaction[]> {
  const url = `https://blockstream.info/api/address/${BTC_ADDRESS}/txs`;
  const r = await fetch(url);
  const rawTxs: any[] = await r.json();

  return rawTxs.flatMap((tx) => {
    const received: number = (tx.vout ?? []).reduce(
      (sum: number, out: any) =>
        sum + ((out.scriptpubkey_address ?? "") === BTC_ADDRESS ? Number(out.value ?? 0) : 0),
      0
    );
    const spent: number = (tx.vin ?? []).reduce(
      (sum: number, inp: any) =>
        sum +
        ((inp.prevout?.scriptpubkey_address ?? "") === BTC_ADDRESS
          ? Number(inp.prevout?.value ?? 0)
          : 0),
      0
    );
    const net = (received - spent) / 1e8;
    if (Math.abs(net) < 0.000001) return [];

    const isIn = net > 0;
    const quantity = Math.abs(net);
    const ts: string = tx.status?.block_time
      ? new Date((tx.status.block_time as number) * 1000).toISOString()
      : new Date().toISOString();

    return [
      {
        id: `bc:btc:${tx.txid ?? ""}`,
        date: ts,
        asset: "BTC",
        category: "Крипта",
        action: isIn ? "Покупка" : "Продажа",
        quantity,
        price: 0,
        amount: 0,
        comment: "",
        walletId: BTC_ADDRESS,
        chain: "BTC",
        hash: tx.txid ?? "",
        status: tx.status?.confirmed ? "CONFIRMED" : "PENDING",
        direction: isIn ? "IN" : "OUT",
        counterparty: "",
        rawAsset: "BTC",
        rawAmount: quantity,
        note: "blockchain",
      } satisfies InvestorTransaction,
    ];
  });
}

// ─── Aggregator ───────────────────────────────────────────────────────────────

async function fetchAllBlockchainTxs(): Promise<InvestorTransaction[]> {
  const results = await Promise.allSettled([
    fetchArbTokenTransfers(),
    fetchArbEthTransfers(),
    fetchTonTransactions(),
    fetchBtcTransactions(),
  ]);

  const all: InvestorTransaction[] = [];
  for (const res of results) {
    if (res.status === "fulfilled") all.push(...res.value);
  }

  // Deduplicate by id
  const seen = new Set<string>();
  const deduped = all.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  // Newest first
  deduped.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  return deduped;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWifeTransactions(enabled: boolean): InvestorTransaction[] {
  const [txs, setTxs] = useState<InvestorTransaction[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const load = async () => {
      try {
        setTxs(await fetchAllBlockchainTxs());
      } catch {
        // silent — keep previous data
      }
    };

    load();
    timer.current = setInterval(load, REFRESH_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [enabled]);

  return txs;
}
