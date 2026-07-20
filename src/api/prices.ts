// Hyperliquid — основная площадка для большинства активов (perp mids, один запрос)
const HYPERLIQUID_MAP: Record<string, string> = {
  BTC:  "BTC",
  ETH:  "ETH",
  SOL:  "SOL",
  BNB:  "BNB",
  ATOM: "ATOM",
  MNT:  "MNT",
  TIA:  "TIA",
  APEX: "APEX",
};

// OKX — GRAM-токен. Внимание: в Sheets актив называется "TON" но это GRAM (FULL_NAME: TON→GRAM)
const OKX_MAP: Record<string, string> = {
  TON:  "GRAM-USDT",
};

// Стейблы — цена фиксирована
const STABLECOINS = new Set(["USDT", "USDC", "DAI", "BUSD"]);

const OKX_TICKER_URL = "https://www.okx.com/api/v5/market/tickers?instType=SPOT";
const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";

async function fetchOkxPrices(assets: string[]): Promise<Record<string, number>> {
  const needed = assets.filter((a) => OKX_MAP[a]);
  if (!needed.length) return {};

  const res = await fetch(OKX_TICKER_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`OKX API error: ${res.status}`);

  const data = await res.json() as { data: { instId: string; last: string }[] };
  const result: Record<string, number> = {};

  for (const asset of needed) {
    const sym = OKX_MAP[asset];
    const match = data.data?.find((d) => d.instId === sym);
    if (match) result[asset] = parseFloat(match.last);
  }

  return result;
}

async function fetchHyperliquidPrices(assets: string[]): Promise<Record<string, number>> {
  const needed = assets.filter((a) => HYPERLIQUID_MAP[a]);
  if (!needed.length) return {};

  const res = await fetch(HYPERLIQUID_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "allMids" }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Hyperliquid API error: ${res.status}`);

  const data = await res.json() as Record<string, string>;
  const result: Record<string, number> = {};

  for (const asset of needed) {
    const sym = HYPERLIQUID_MAP[asset];
    const price = parseFloat(data[sym]);
    if (Number.isFinite(price) && price > 0) result[asset] = price;
  }

  return result;
}

// Билдер-perp-DEX'ы, где живут доп. инструменты (GOLD торгуется на xyz:GOLD).
// Их плечо основной clearinghouseState не отдаёт — нужен отдельный запрос с dex.
const HYPERLIQUID_EXTRA_DEXES = ["xyz"];

type ClearingState = {
  assetPositions?: {
    position?: {
      coin?: string;
      leverage?: { value?: number };
      liquidationPx?: string | number | null;
      entryPx?: string | number | null;
    };
  }[];
};

/** Риск открытой фьючерс-позиции с Hyperliquid: плечо + цена ликвидации. */
export type HlPositionRisk = {
  leverage: number;
  /** Цена ликвидации. null — HL её не отдал (напр. позиция без риска ликвидации). */
  liquidationPx: number | null;
  entryPx: number | null;
};

const toNum = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Один запрос clearinghouseState (основной DEX при dex=undefined, иначе билдер-DEX).
// Возвращает map: COIN (upper) → выставленное плечо.
async function fetchClearinghouseRisk(
  address: string,
  dex?: string
): Promise<Record<string, HlPositionRisk>> {
  const body: Record<string, unknown> = { type: "clearinghouseState", user: address };
  if (dex) body.dex = dex;

  const res = await fetch(HYPERLIQUID_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Hyperliquid clearinghouseState error: ${res.status}`);

  const data = (await res.json()) as ClearingState;
  const result: Record<string, HlPositionRisk> = {};
  for (const ap of data?.assetPositions ?? []) {
    const coin = ap?.position?.coin;
    const lev = Number(ap?.position?.leverage?.value);
    if (coin && Number.isFinite(lev) && lev > 0) {
      result[String(coin).toUpperCase()] = {
        leverage: lev,
        liquidationPx: toNum(ap?.position?.liquidationPx),
        entryPx: toNum(ap?.position?.entryPx),
      };
    }
  }
  return result;
}

// ── Плечо открытых фьючерс-позиций (clearinghouseState, привязан к адресу) ──
// Основной perp-DEX + билдер-DEX'ы (xyz: GOLD). Возвращает map: COIN → плечо.
// Падение отдельного DEX не ломает остальные (allSettled).
export async function fetchHyperliquidRisk(
  address: string
): Promise<Record<string, HlPositionRisk>> {
  if (!address) return {};

  const settled = await Promise.allSettled([
    fetchClearinghouseRisk(address),
    ...HYPERLIQUID_EXTRA_DEXES.map((dex) => fetchClearinghouseRisk(address, dex)),
  ]);

  const result: Record<string, HlPositionRisk> = {};
  for (const s of settled) {
    if (s.status === "fulfilled") Object.assign(result, s.value);
  }
  return result;
}

/** Обратная совместимость: только плечо (COIN → leverage). */
export async function fetchHyperliquidLeverage(
  address: string
): Promise<Record<string, number>> {
  const risk = await fetchHyperliquidRisk(address);
  const result: Record<string, number> = {};
  for (const [coin, r] of Object.entries(risk)) result[coin] = r.leverage;
  return result;
}

export async function fetchLivePrices(assets: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  // Стейблы сразу
  for (const a of assets) {
    if (STABLECOINS.has(a)) result[a] = 1;
  }

  const okxAssets = assets.filter((a) => OKX_MAP[a]);
  const hyperliquidAssets = assets.filter((a) => HYPERLIQUID_MAP[a]);

  const [okx, hyperliquid] = await Promise.allSettled([
    fetchOkxPrices(okxAssets),
    fetchHyperliquidPrices(hyperliquidAssets),
  ]);

  if (okx.status === "fulfilled") Object.assign(result, okx.value);
  if (hyperliquid.status === "fulfilled") Object.assign(result, hyperliquid.value);

  return result;
}
