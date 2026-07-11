import { useEffect, useRef, useState } from "react";
import { stakingApy } from "../config/stakingRules";

// Публичный TON-адрес владельца (read-only) — где лежит tsTON (Tonstakers).
export const MAIN_TON_ADDRESS = "UQD-JmUdBLDBlBvOzid3UBMs8A5Tk-E7ikV17NJ0IR8VccUj";

// Пул Tonstakers (liquidTF) — для cycle_end и живого APY.
const TONSTAKERS_POOL =
  "0:a45b17f28409229b78360e3290420f13e4fe20f90d7e2bf8c4ac6703259e22fa";

const REFRESH_MS = 5 * 60 * 1000;

// Одна точка курса tsTON→TON во времени (из ончейн-депозитов + текущая).
export type RatePoint = { t: number; rate: number };

export type TonStaking = {
  tstonBalance: number; // сколько tsTON на руках (не меняется от наград)
  rate: number;         // курс: сколько TON за 1 tsTON (растёт каждый цикл)
  tonPrice: number;     // цена TON в USD
  apy: number;          // годовая ставка (доля) — из пула, живая
  cycleEnd: number;     // unix-секунды: конец текущего цикла (для таймера)
  stakedTon: number;    // tsTON пересчитанные в TON
  stakedUsd: number;    // стоимость стейка в USD
  depositedTon: number; // сколько TON внесено суммарно (из истории)
  earnedTon: number;    // накоплено наград = stakedTon - depositedTon
  earnedUsd: number;
  dailyTon: number;     // оценка начисления в сутки @ APY
  dailyUsd: number;
  ratePoints: RatePoint[]; // реальные точки курса для мини-графика
};

async function fetchJson(url: string): Promise<unknown> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function fetchTonStaking(address: string): Promise<TonStaking | null> {
  // Живой APY + конец цикла из пула Tonstakers (фолбэк на конфиг).
  let apy = stakingApy("TON") ?? 0.1437;
  let cycleEnd = 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const poolResp: any = await fetchJson(
      `https://tonapi.io/v2/staking/pool/${TONSTAKERS_POOL}`
    );
    const pool = poolResp.pool ?? {};
    if (pool.apy > 0) apy = pool.apy / 100; // API отдаёт в процентах
    if (pool.cycle_end > 0) cycleEnd = pool.cycle_end;
  } catch {
    // фолбэк на конфиг — таймер просто не покажется
  }

  // 1. tsTON баланс + цена в USD
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jettons: any = await fetchJson(
    `https://tonapi.io/v2/accounts/${address}/jettons?currencies=usd`
  );
  let tstonBalance = 0;
  let tstonUsd = 0;
  for (const b of jettons.balances ?? []) {
    if ((b.jetton?.symbol ?? "") === "tsTON") {
      const dec = Number(b.jetton?.decimals ?? 9);
      tstonBalance = Number(b.balance) / Math.pow(10, dec);
      tstonUsd = Number(b.price?.prices?.USD ?? 0);
      break;
    }
  }
  if (tstonBalance <= 0) return null; // нет стейка

  // 2. Цена TON в USD
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rates: any = await fetchJson(
    `https://tonapi.io/v2/rates?tokens=ton&currencies=usd`
  );
  const tonPrice = Number(rates.rates?.TON?.prices?.USD ?? 0);

  // Курс tsTON→TON = ($ за tsTON) / ($ за TON)
  const rate = tonPrice > 0 ? tstonUsd / tonPrice : 1;

  const stakedTon = tstonBalance * rate;
  const stakedUsd = tstonBalance * tstonUsd;

  // 3. Сумма депозитов + реальные точки курса из истории.
  // В одном событии DepositStake (TON внесено) идёт вместе с JettonMint (tsTON получено).
  // mint rate = TON / tsTON — реальное наблюдение курса на момент депозита.
  let depositedTon = 0;
  const ratePoints: RatePoint[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: any = await fetchJson(
      `https://tonapi.io/v2/accounts/${address}/events?limit=100`
    );
    for (const evt of events.events ?? []) {
      let depTon = 0;
      let mintTs = 0;
      for (const act of evt.actions ?? []) {
        if (act.type === "DepositStake") {
          depTon += Number(act.DepositStake?.amount ?? 0) / 1e9;
        } else if (act.type === "WithdrawStake") {
          depositedTon -= Number(act.WithdrawStake?.amount ?? 0) / 1e9;
        } else if (act.type === "JettonMint") {
          const dec = Number(act.JettonMint?.jetton?.decimals ?? 9);
          mintTs += Number(act.JettonMint?.amount ?? 0) / Math.pow(10, dec);
        }
      }
      if (depTon > 0) {
        depositedTon += depTon;
        if (mintTs > 0) ratePoints.push({ t: Number(evt.timestamp ?? 0), rate: depTon / mintTs });
      }
    }
  } catch {
    depositedTon = 0; // история недоступна — «заработано» и график скроем в UI
  }

  // Текущая точка курса + сортировка по времени
  ratePoints.push({ t: Math.floor(Date.now() / 1000), rate });
  ratePoints.sort((a, b) => a.t - b.t);

  const earnedTon = depositedTon > 0 ? stakedTon - depositedTon : 0;
  const earnedUsd = earnedTon * tonPrice;

  const dailyTon = (stakedTon * apy) / 365;
  const dailyUsd = dailyTon * tonPrice;

  return {
    tstonBalance,
    rate,
    tonPrice,
    apy,
    cycleEnd,
    stakedTon,
    stakedUsd,
    depositedTon,
    earnedTon,
    earnedUsd,
    dailyTon,
    dailyUsd,
    ratePoints,
  };
}

export function useTonStaking(
  address: string,
  enabled: boolean
): TonStaking | null {
  const [staking, setStaking] = useState<TonStaking | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс при отключении хука
      setStaking(null);
      return;
    }
    const load = async () => {
      try {
        setStaking(await fetchTonStaking(address));
      } catch {
        // тихо — карточка стейкинга просто не покажется
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
