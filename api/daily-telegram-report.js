import { runDailyTelegramReport } from "./_dailyTelegramReport.js";

const getEnv = (name) => process.env[name]?.trim() ?? "";

const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
};

const getHeader = (req, name) => {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
};

const normalizeAccountId = (value) => value === "wife" ? "wife" : "main";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED" });
    return;
  }

  const cronSecret = getEnv("CRON_SECRET");
  if (!cronSecret) {
    sendJson(res, 503, { success: false, code: "CRON_SECRET_MISSING" });
    return;
  }

  const authorization = getHeader(req, "authorization");
  if (authorization !== `Bearer ${cronSecret}`) {
    sendJson(res, 401, { success: false, code: "UNAUTHORIZED" });
    return;
  }

  const botToken = getEnv("TELEGRAM_BOT_TOKEN");
  const chatId = getEnv("TELEGRAM_CHAT_ID");
  if (!botToken || !chatId) {
    sendJson(res, 503, { success: false, code: "TELEGRAM_ENV_MISSING" });
    return;
  }

  try {
    const report = await runDailyTelegramReport({
      accountId: normalizeAccountId(getEnv("DAILY_REPORT_ACCOUNT_ID")),
      botToken,
      chatId,
    });

    sendJson(res, 200, {
      success: true,
      sent: true,
      facts: report.facts,
    });
  } catch (error) {
    sendJson(res, 502, {
      success: false,
      code: "DAILY_REPORT_FAILED",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
