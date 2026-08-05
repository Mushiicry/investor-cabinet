const COINBASE_CANDLES_URL = "https://api.exchange.coinbase.com/products/BTC-USD/candles";
const DAY_SECONDS = 86_400;
const COINBASE_MAX_DAYS = 299;

const chartStartSeconds = Math.floor(new Date("2022-11-15T00:00:00Z").getTime() / 1000);

const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
};

async function fetchCoinbaseChunk(startSeconds, endSeconds) {
  const url = new URL(COINBASE_CANDLES_URL);
  url.searchParams.set("granularity", String(DAY_SECONDS));
  url.searchParams.set("start", new Date(startSeconds * 1000).toISOString());
  url.searchParams.set("end", new Date(endSeconds * 1000).toISOString());

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "investor-cabinet",
    },
  });

  if (!response.ok) {
    throw new Error(`Coinbase candles failed: ${response.status}`);
  }

  const json = await response.json();
  if (!Array.isArray(json)) {
    throw new Error("Coinbase candles returned invalid payload");
  }

  return json;
}

export async function fetchBtcDailyBars(now = Date.now()) {
  const nowSeconds = Math.floor(now / 1000);
  const todayUtcSeconds = Math.floor(nowSeconds / DAY_SECONDS) * DAY_SECONDS;
  const rowsByTs = new Map();
  let start = chartStartSeconds;

  while (start < todayUtcSeconds) {
    const end = Math.min(start + COINBASE_MAX_DAYS * DAY_SECONDS, todayUtcSeconds);
    const chunk = await fetchCoinbaseChunk(start, end);

    chunk.forEach((row) => {
      const [time, low, high, open, close] = Array.isArray(row) ? row : [];
      const ts = Number(time) * 1000;
      if (!Number.isFinite(ts)) return;
      rowsByTs.set(ts, {
        ts,
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
      });
    });

    start = end + DAY_SECONDS;
  }

  return Array.from(rowsByTs.values())
    .filter((bar) =>
      Number.isFinite(bar.open)
      && Number.isFinite(bar.high)
      && Number.isFinite(bar.low)
      && Number.isFinite(bar.close)
    )
    .sort((a, b) => a.ts - b.ts);
}

export async function handleBtcDailyApi(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { success: false, error: "Method not allowed" });
    return;
  }

  try {
    const bars = await fetchBtcDailyBars();
    sendJson(res, bars.length > 0 ? 200 : 502, {
      success: bars.length > 0,
      source: "coinbase",
      updatedAt: new Date().toISOString(),
      bars,
    });
  } catch (error) {
    sendJson(res, 502, {
      success: false,
      error: error instanceof Error ? error.message : "BTC daily chart proxy failed",
    });
  }
}
