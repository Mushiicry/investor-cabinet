const BINANCE_SYMBOL_LIST_URL =
  "https://www.binance.com/bapi/composite/v1/public/marketing/symbol/list";

const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
};

const normalizeMonitoringRows = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .filter((item) => item?.baseAsset && Array.isArray(item.tags) && item.tags.includes("Monitoring"))
    .map((item) => ({
      asset: String(item.baseAsset || "").trim().toUpperCase(),
      name: String(item.fullName || item.name || ""),
      marketCap: Number(item.marketCap || 0),
      tags: item.tags,
    }))
    .filter((item) => item.asset)
    .sort((a, b) => a.asset.localeCompare(b.asset));

export default async function handler(req, res) {
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
    const response = await fetch(BINANCE_SYMBOL_LIST_URL, {
      headers: {
        accept: "application/json",
        clienttype: "web",
        "user-agent": "Mozilla/5.0",
      },
      redirect: "follow",
    });
    const json = await response.json();
    const records = normalizeMonitoringRows(json.data);

    sendJson(res, response.ok && records.length > 0 ? 200 : 502, {
      success: response.ok && records.length > 0,
      source: BINANCE_SYMBOL_LIST_URL,
      updatedAt: new Date().toISOString(),
      binanceMonitoring: records,
      count: records.length,
      upstreamStatus: response.status,
    });
  } catch (error) {
    sendJson(res, 502, {
      success: false,
      error: error instanceof Error ? error.message : "Asset quality proxy failed",
    });
  }
}
