import { afterEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import dailyTelegramReportHandler from "../../api/daily-telegram-report.js";
import { buildDailyTelegramReport } from "../../api/_dailyTelegramReport.js";

type MockResponse = ServerResponse & {
  body?: string;
  headers: Record<string, string | number | readonly string[]>;
};

type MockRequest = IncomingMessage & {
  body?: unknown;
};

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

const mockReq = (headers: Record<string, string> = {}, method = "GET"): MockRequest => ({
  method,
  url: "/api/daily-telegram-report",
  headers,
  [Symbol.asyncIterator]: async function* () {},
}) as MockRequest;

const mockRes = (): MockResponse => ({
  statusCode: 200,
  headers: {},
  setHeader(name: string, value: string | number | readonly string[]) {
    this.headers[name.toLowerCase()] = value;
    return this;
  },
  end(chunk?: unknown) {
    this.body = typeof chunk === "string" ? chunk : "";
    return this;
  },
}) as MockResponse;

const portfolioPayload = {
  success: true,
  overview: {
    portfolioValue: 667.5,
    invested: 699.4,
    pnl: -31.9,
    pnlPct: -0.0456,
    reserve: 478.77,
    positionsCount: 10,
    health: 65,
    state: "balance",
  },
  risk: {
    reserveShare: 0.717,
    futuresShare: 0.12,
    health: 65,
  },
  fearGreedStrategy: {
    currentIndex: 46,
    currentZone: "Наблюдаем",
  },
  history: [
    { date: "2026-08-18T20:48:00.000Z", portfolioValue: 666.6 },
    { date: "2026-08-19T20:48:00.000Z", portfolioValue: 667.5 },
  ],
  portfolio: [
    { asset: "USDC", category: "Свободные деньги", currentValue: 478.77, share: 71.7, pnl: 0, pnlPct: 0 },
    { asset: "TON", category: "Крипта", currentValue: 86.06, invested: 105.7, share: 12.89, pnl: -19.63, pnlPct: -18.57 },
    { asset: "ATOM", category: "Крипта", currentValue: 29.47, invested: 40.5, share: 4.42, pnl: -11, pnlPct: -27.18 },
    { asset: "BNB", category: "Крипта", currentValue: 13.04, invested: 12.54, share: 1.95, pnl: 0.5, pnlPct: 3.99 },
  ],
};

const setEnv = () => {
  process.env.CRON_SECRET = "cron-secret";
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_CHAT_ID = "123456";
  process.env.INVESTOR_APPS_SCRIPT_URL = "https://apps-script.example/main";
};

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
});

describe("daily telegram report endpoint", () => {
  it("requires the cron secret before doing any external work", async () => {
    setEnv();
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const req = mockReq({ authorization: "Bearer wrong" });
    const res = mockRes();

    await dailyTelegramReportHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body ?? "{}")).toEqual({ success: false, code: "UNAUTHORIZED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not run without Telegram environment variables", async () => {
    process.env.CRON_SECRET = "cron-secret";
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const req = mockReq({ authorization: "Bearer cron-secret" });
    const res = mockRes();

    await dailyTelegramReportHandler(req, res);

    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body ?? "{}")).toEqual({ success: false, code: "TELEGRAM_ENV_MISSING" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads the investor payload and sends one morning report to Telegram", async () => {
    setEnv();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(portfolioPayload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const req = mockReq({ authorization: "Bearer cron-secret" });
    const res = mockRes();

    await dailyTelegramReportHandler(req, res);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? "{}");
    expect(body).toMatchObject({
      success: true,
      sent: true,
      facts: {
        invested: 699.4,
        portfolioValue: 667.5,
        pnl: -31.9,
        reserve: 478.77,
        health: 65,
        fearGreedIndex: 46,
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("https://apps-script.example/main?accountId=main");
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.telegram.org/bottest-token/sendMessage");

    const telegramBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(telegramBody.chat_id).toBe("123456");
    expect(telegramBody.text).toContain("MUSHII INVEST");
    expect(telegramBody.text).toContain("вложено 699,40 $");
    expect(telegramBody.text).toContain("P&L -31,90 $");
    expect(telegramBody.text).toContain("TON");
    expect(telegramBody.text).toContain("вес 12,89%");
    expect(telegramBody.text).toContain("Кэш и резерв: 478,77 $");
    expect(telegramBody.text).toContain("Health Factor: 65/100");
    expect(telegramBody.text).toContain("Индекс страха и жадности: 46");
    expect(telegramBody.text).toContain("не является торговым сигналом");
  });
});

describe("buildDailyTelegramReport", () => {
  it("keeps total PnL percentage as a decimal fraction and position PnL as direct percent", () => {
    const report = buildDailyTelegramReport(portfolioPayload, {
      accountId: "main",
      now: new Date("2026-08-19T05:30:00.000Z"),
    });

    expect(report.text).toContain("P&L -31,90 $ (-4,56%)");
    expect(report.text).toContain("TON");
    expect(report.text).toContain("(-18,57%)");
    expect(report.facts).toMatchObject({
      dailyPnlUsd: 0.9,
      dailyPnlPct: 0.14,
      positionsCount: 3,
    });
  });

  it("does not print timestamps as the health mode", () => {
    const report = buildDailyTelegramReport({
      ...portfolioPayload,
      overview: {
        ...portfolioPayload.overview,
        state: "2026-07-20 22:47:49 MSK",
      },
    }, {
      accountId: "main",
      now: new Date("2026-08-19T05:30:00.000Z"),
    });

    expect(report.text).toContain("Health Factor: 65/100.");
    expect(report.text).not.toContain("режим 2026-07-20");
    expect(report.text).not.toContain("вес +");
    expect(report.text).not.toContain("или +");
  });
});
