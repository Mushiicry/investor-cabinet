const OKX_CANDLES_URL = "https://www.okx.com/api/v5/market/candles";
const BINANCE_CANDLES_URL = "https://data-api.binance.vision/api/v3/klines";
const BYBIT_CANDLES_URL = "https://api.bybit.com/v5/market/kline";
const ALLOWED_ASSETS = new Map([
  ["GRAM", { source: "okx", market: "GRAM-USDT" }],
  ["ATOM", { source: "binance", market: "ATOMUSDT" }],
  ["SOL", { source: "binance", market: "SOLUSDT" }],
  ["BNB", { source: "binance", market: "BNBUSDT" }],
  ["BTC", { source: "binance", market: "BTCUSDT" }],
  ["ETH", { source: "binance", market: "ETHUSDT" }],
  ["APEX", { source: "bybit", market: "APEXUSDT" }],
  ["MNT", { source: "bybit", market: "MNTUSDT" }],
  ["CAKE", { source: "binance", market: "CAKEUSDT" }],
  ["GOLD", { source: "binance", market: "PAXGUSDT" }],
  ["SPCXB", { source: "binance", market: "SPCXBUSDT" }],
]);

const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", status === 200
    ? "public, s-maxage=300, stale-while-revalidate=600"
    : "no-store");
  res.end(JSON.stringify(body));
};

function assetFromRequest(req) {
  const url = new URL(req.url || "/api/market-sparkline", "http://localhost");
  return String(url.searchParams.get("asset") || "").trim().toUpperCase();
}

export async function fetchMarketSparkline(asset) {
  const config = ALLOWED_ASSETS.get(String(asset || "").toUpperCase());
  if (!config) throw new Error("Unsupported sparkline asset");

  const endpoint = config.source === "okx"
    ? OKX_CANDLES_URL
    : config.source === "bybit"
      ? BYBIT_CANDLES_URL
      : BINANCE_CANDLES_URL;
  const url = new URL(endpoint);
  if (config.source === "okx") {
    url.searchParams.set("instId", config.market);
    url.searchParams.set("bar", "1D");
  } else if (config.source === "bybit") {
    url.searchParams.set("category", "spot");
    url.searchParams.set("symbol", config.market);
    url.searchParams.set("interval", "D");
  } else {
    url.searchParams.set("symbol", config.market);
    url.searchParams.set("interval", "1d");
  }
  url.searchParams.set("limit", "36");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "investor-cabinet",
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${config.source.toUpperCase()} candles failed: ${response.status}`);

    const json = await response.json();
    const rows = config.source === "okx"
      ? json?.data
      : config.source === "bybit"
        ? json?.result?.list
        : json;
    const invalidStatus = (config.source === "okx" && json?.code !== "0")
      || (config.source === "bybit" && json?.retCode !== 0);
    if (invalidStatus || !Array.isArray(rows)) {
      throw new Error(`${config.source.toUpperCase()} candles returned invalid payload`);
    }

    return rows
      .map((row) => ({ ts: Number(row?.[0]), close: Number(row?.[4]) }))
      .filter((point) => Number.isFinite(point.ts) && Number.isFinite(point.close))
      .sort((a, b) => a.ts - b.ts);
  } finally {
    clearTimeout(timeout);
  }
}

export async function handleMarketSparklineApi(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "GET") {
    sendJson(res, 405, { success: false, error: "Method not allowed" });
    return;
  }

  const asset = assetFromRequest(req);
  const config = ALLOWED_ASSETS.get(asset);
  if (!config) {
    sendJson(res, 400, { success: false, error: "Unsupported sparkline asset" });
    return;
  }

  try {
    const points = await fetchMarketSparkline(asset);
    sendJson(res, points.length > 1 ? 200 : 502, {
      success: points.length > 1,
      source: config.source,
      interval: "1D",
      asset,
      updatedAt: new Date().toISOString(),
      points,
    });
  } catch (error) {
    sendJson(res, 502, {
      success: false,
      error: error instanceof Error ? error.message : "Market sparkline proxy failed",
    });
  }
}
