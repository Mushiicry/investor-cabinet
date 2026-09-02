import { fetchCryptoRankFearGreed } from "./_dailyTelegramReport.js";

const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED" });
    return;
  }

  try {
    const result = await fetchCryptoRankFearGreed();

    sendJson(res, 200, {
      name: "Fear and Greed Index",
      source: result.source,
      data: [{
        value: String(result.currentIndex),
        value_classification: result.currentZone,
        timestamp: String(Math.floor(Date.now() / 1000)),
      }],
    });
  } catch (error) {
    sendJson(res, 502, {
      success: false,
      code: "FEAR_GREED_BACKUP_FAILED",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
