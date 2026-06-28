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

// ── Плечо открытых фьючерс-позиций (clearinghouseState, привязан к адресу) ──
// Возвращает map: COIN (upper) → выставленное плечо.
export async function fetchHyperliquidLeverage(
  address: string
): Promise<Record<string, number>> {
  if (!address) return {};

  const res = await fetch(HYPERLIQUID_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "clearinghouseState", user: address }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Hyperliquid clearinghouseState error: ${res.status}`);

  const data = (await res.json()) as {
    assetPositions?: { position?: { coin?: string; leverage?: { value?: number } } }[];
  };

  const result: Record<string, number> = {};
  for (const ap of data?.assetPositions ?? []) {
    const coin = ap?.position?.coin;
    const lev = Number(ap?.position?.leverage?.value);
    if (coin && Number.isFinite(lev) && lev > 0) {
      result[String(coin).toUpperCase()] = lev;
    }
  }
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
