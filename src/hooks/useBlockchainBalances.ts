import { useEffect, useRef, useState } from "react";

// Public wallet addresses for wife's portfolio (read-only)
const EVM_ADDRESS     = "0x06F03b067b34f3d6E569De9aB7839c988Bf6BAEE";
const TON_ADDRESS     = "UQCMRrWTgMBqBMr6yUw04ZYz398fyIhDlaJyaqoQTchVNm74";
const BTC_ADDRESS     = "bc1qmmpq6jm6rr02anv7ldnpq29cqrpqesswesv7at";
const SOL_ADDRESS     = "3XR4H5XiVKdWGFEb9r3KbFcJ7o2vhQsFvTsFt1MutuCs";
const USDT_ARB        = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";
const ARB_RPC         = "https://arbitrum-one.public.blastapi.io";
const REFRESH_MS      = 5 * 60 * 1000;

export type BlockchainBalances = Record<string, number>;

async function arbCall(method: string, params: unknown[]): Promise<{ result?: string }> {
  const r = await fetch(ARB_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return r.json();
}

async function getEthArb(): Promise<number> {
  const d = await arbCall("eth_getBalance", [EVM_ADDRESS, "latest"]);
  return d.result ? parseInt(d.result, 16) / 1e18 : 0;
}

async function getUsdtArb(): Promise<number> {
  const padded = "000000000000000000000000" + EVM_ADDRESS.slice(2).toLowerCase();
  const d = await arbCall("eth_call", [{ to: USDT_ARB, data: "0x70a08231" + padded }, "latest"]);
  return d.result && d.result.length > 2 ? parseInt(d.result, 16) / 1e6 : 0;
}

async function getTon(): Promise<number> {
  const r = await fetch(`https://tonapi.io/v2/accounts/${TON_ADDRESS}`);
  const d = await r.json();
  return Number(d.balance ?? 0) / 1e9;
}

async function getUsdtTon(): Promise<number> {
  const r = await fetch(`https://tonapi.io/v2/accounts/${TON_ADDRESS}/jettons`);
  const d = await r.json();
  for (const b of (d.balances ?? [])) {
    if (b.jetton?.name === "Tether USD" || b.jetton?.symbol === "USD₮") {
      const dec: number = b.jetton?.decimals ?? 6;
      return Number(b.balance) / 10 ** dec;
    }
  }
  return 0;
}

async function getBtc(): Promise<number> {
  const r = await fetch(`https://blockstream.info/api/address/${BTC_ADDRESS}`);
  const d = await r.json();
  const funded: number = d.chain_stats?.funded_txo_sum ?? 0;
  const spent: number  = d.chain_stats?.spent_txo_sum  ?? 0;
  return (funded - spent) / 1e8;
}

async function getSol(): Promise<number> {
  const r = await fetch("https://api.mainnet-beta.solana.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [SOL_ADDRESS] }),
  });
  const d = await r.json();
  return (d.result?.value ?? 0) / 1e9;
}

async function fetchAll(): Promise<BlockchainBalances> {
  const [eth, usdtArb, ton, usdtTon, btc, sol] = await Promise.allSettled([
    getEthArb(),
    getUsdtArb(),
    getTon(),
    getUsdtTon(),
    getBtc(),
    getSol(),
  ]);

  const v = (r: PromiseSettledResult<number>) =>
    r.status === "fulfilled" && r.value > 0 ? r.value : 0;

  const usdt = v(usdtArb) + v(usdtTon);

  return {
    ETH:      v(eth),
    TON:      v(ton),
    BTC:      v(btc),
    SOL:      v(sol),
    USDT:     usdt,
    USDT_ARB: v(usdtArb),
    USDT_TON: v(usdtTon),
  };
}

export function useBlockchainBalances(enabled: boolean): BlockchainBalances | null {
  const [balances, setBalances] = useState<BlockchainBalances | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const load = async () => {
      try {
        setBalances(await fetchAll());
      } catch {
        // silent — positions will use Apps Script sheet data as fallback
      }
    };

    load();
    timer.current = setInterval(load, REFRESH_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [enabled]);

  return balances;
}
