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
const normalizeReportScope = (value) => ["wife", "all", "both"].includes(value) ? value : "main";

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
    const scope = normalizeReportScope(getEnv("DAILY_REPORT_ACCOUNT_ID"));
    const wifeChatId = getEnv("TELEGRAM_WIFE_CHAT_ID");
    const targets = scope === "all" || scope === "both"
      ? [
          { accountId: "main", chatId },
          ...(wifeChatId ? [{ accountId: "wife", chatId: wifeChatId }] : []),
        ]
      : [
          {
            accountId: normalizeAccountId(scope),
            chatId: scope === "wife" ? wifeChatId || chatId : chatId,
          },
        ];

    if ((scope === "all" || scope === "both" || scope === "wife") && !wifeChatId) {
      sendJson(res, 503, { success: false, code: "TELEGRAM_WIFE_CHAT_ID_MISSING" });
      return;
    }

    const reports = [];
    for (const target of targets) {
      reports.push(await runDailyTelegramReport({
        accountId: target.accountId,
        botToken,
        chatId: target.chatId,
      }));
    }

    sendJson(res, 200, {
      success: true,
      sent: true,
      accounts: targets.map((target) => target.accountId),
      facts: reports.length === 1 ? reports[0].facts : Object.fromEntries(
        reports.map((report, index) => [targets[index].accountId, report.facts]),
      ),
    });
  } catch (error) {
    sendJson(res, 502, {
      success: false,
      code: "DAILY_REPORT_FAILED",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
