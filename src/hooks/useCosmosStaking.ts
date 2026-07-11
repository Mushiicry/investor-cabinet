/* eslint-disable @typescript-eslint/no-explicit-any -- внешние JSON-ответы блокчейн-API */
import { useEffect, useRef, useState } from "react";

// Публичный Cosmos-адрес владельца (read-only) — где застейкан ATOM.
export const MAIN_COSMOS_ADDRESS = "cosmos19cykvjv5sqgqgrrw0n94et2knvj3t3chpv7hka";

const REST = "https://cosmos-rest.publicnode.com";
const REFRESH_MS = 5 * 60 * 1000;
const FALLBACK_APR = 0.154; // если параметры сети недоступны

export type CosmosStaking = {
  staked: number;        // застейкано ATOM (делегации)
  liquid: number;        // свободно ATOM
  claimable: number;     // награда к клейму ATOM
  atomPrice: number;     // цена ATOM в USD
  apr: number;           // годовая ставка (доля), gross
  stakedUsd: number;
  claimableUsd: number;
  dailyAtom: number;     // начисление в сутки ATOM
  dailyUsd: number;
  validatorName: string; // напр. "Keplr"
  commission: number;    // комиссия валидатора (доля)
};

async function getJson(url: string): Promise<unknown> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function fetchCosmosStaking(address: string): Promise<CosmosStaking | null> {
  // 1. Делегации (застейкано + адрес валидатора)
  const del: any = await getJson(`${REST}/cosmos/staking/v1beta1/delegations/${address}`);
  const responses: any[] = del.delegation_responses ?? [];
  let staked = 0;
  let validatorAddr = "";
  for (const d of responses) {
    staked += num(d.balance?.amount) / 1e6;
    if (!validatorAddr) validatorAddr = String(d.delegation?.validator_address ?? "");
  }
  if (staked <= 0) return null; // нет стейка

  // 2–3. Награды + liquid (параллельно, best-effort)
  const [rewardsRes, balanceRes, priceRes] = await Promise.allSettled([
    getJson(`${REST}/cosmos/distribution/v1beta1/delegators/${address}/rewards`),
    getJson(`${REST}/cosmos/bank/v1beta1/balances/${address}/by_denom?denom=uatom`),
    getJson(`https://api.coingecko.com/api/v3/simple/price?ids=cosmos&vs_currencies=usd`),
  ]);

  let claimable = 0;
  if (rewardsRes.status === "fulfilled") {
    const total: any[] = (rewardsRes.value as any).total ?? [];
    for (const t of total) if (t.denom === "uatom") claimable += num(t.amount) / 1e6;
  }

  let liquid = 0;
  if (balanceRes.status === "fulfilled") {
    liquid = num((balanceRes.value as any).balance?.amount) / 1e6;
  }

  let atomPrice = 0;
  if (priceRes.status === "fulfilled") {
    atomPrice = num((priceRes.value as any).cosmos?.usd);
  }

  // 4. APR live из параметров сети (inflation × (1−tax) / bonded_ratio), + комиссия валидатора
  let apr = FALLBACK_APR;
  let commission = 0.05;
  let validatorName = "Cosmos";
  try {
    const [inflRes, poolRes, supplyRes, distRes, valRes] = await Promise.allSettled([
      getJson(`${REST}/cosmos/mint/v1beta1/inflation`),
      getJson(`${REST}/cosmos/staking/v1beta1/pool`),
      getJson(`${REST}/cosmos/bank/v1beta1/supply/by_denom?denom=uatom`),
      getJson(`${REST}/cosmos/distribution/v1beta1/params`),
      validatorAddr
        ? getJson(`${REST}/cosmos/staking/v1beta1/validators/${validatorAddr}`)
        : Promise.reject(),
    ]);

    const infl = inflRes.status === "fulfilled" ? num((inflRes.value as any).inflation) : 0;
    const bonded = poolRes.status === "fulfilled" ? num((poolRes.value as any).pool?.bonded_tokens) : 0;
    const supply = supplyRes.status === "fulfilled" ? num((supplyRes.value as any).amount?.amount) : 0;
    const tax = distRes.status === "fulfilled" ? num((distRes.value as any).params?.community_tax) : 0;

    if (infl > 0 && bonded > 0 && supply > 0) {
      apr = (infl * (1 - tax)) / (bonded / supply); // gross APR (как показывает Keplr)
    }

    if (valRes.status === "fulfilled") {
      const v = (valRes.value as any).validator ?? {};
      validatorName = String(v.description?.moniker ?? "Cosmos");
      commission = num(v.commission?.commission_rates?.rate);
    }
  } catch {
    // фолбэк на константы
  }

  const stakedUsd = staked * atomPrice;
  const claimableUsd = claimable * atomPrice;
  // Начисление в сутки — по net APR (после комиссии валидатора), реальный доход делегатора
  const netApr = apr * (1 - commission);
  const dailyAtom = (staked * netApr) / 365;
  const dailyUsd = dailyAtom * atomPrice;

  return {
    staked,
    liquid,
    claimable,
    atomPrice,
    apr,
    stakedUsd,
    claimableUsd,
    dailyAtom,
    dailyUsd,
    validatorName,
    commission,
  };
}

export function useCosmosStaking(
  address: string,
  enabled: boolean
): CosmosStaking | null {
  const [staking, setStaking] = useState<CosmosStaking | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс при отключении хука
      setStaking(null);
      return;
    }
    const load = async () => {
      try {
        setStaking(await fetchCosmosStaking(address));
      } catch {
        // тихо — карточка просто не покажется
      }
    };
    load();
    timer.current = setInterval(load, REFRESH_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [address, enabled]);

  return staking;
}