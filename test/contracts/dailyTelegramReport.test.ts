import { afterEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import dailyTelegramReportHandler from "../../api/daily-telegram-report.js";
import { buildDailyTelegramReport } from "../../api/_dailyTelegramReport.js";
import { computeDailyReportHealth } from "../../api/_dailyReportHealth.js";

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
    { asset: "CAKE LONG", category: "Фьючерсы", currentValue: 5.54, invested: 5, share: 0.83, pnl: 0.54, pnlPct: 10.8 },
  ],
};

const liveLikePayload = {
  ...portfolioPayload,
  overview: {
    ...portfolioPayload.overview,
    portfolioValue: 667.6,
    invested: 699.4,
    pnl: -31.8,
    pnlPct: -0.04546754360880748,
    health: 0,
  },
  risk: {
    ...portfolioPayload.risk,
    health: 79,
  },
  portfolio: [
    { asset: "SOL", category: "Крипта", currentValue: 20.32, invested: 19.98, currentPrice: 20.32, share: 3.04, pnl: 0.34, pnlPct: 1.7 },
    { asset: "TON", category: "Крипта", currentValue: 86.87, invested: 105.69, currentPrice: 1.32, share: 13, pnl: -18.82, pnlPct: -17.81 },
    { asset: "ATOM", category: "Крипта", currentValue: 29.43, invested: 40.47, currentPrice: 1.41, share: 4.41, pnl: -11.04, pnlPct: -27.28 },
    { asset: "BNB", category: "Крипта", currentValue: 13.14, invested: 12.54, currentPrice: 13.14, share: 1.97, pnl: 0.6, pnlPct: 4.78 },
    { asset: "SPCXB", category: "Акции", currentValue: 10.54, invested: 9.94, currentPrice: 10.54, share: 1.58, pnl: 0.6, pnlPct: 6.04 },
    { asset: "MNT LONG", category: "Фьючерсы", currentValue: 7.6, invested: 10.34, currentPrice: 0.446, share: 1.13, pnl: -2.74, pnlPct: -26.5 },
    { asset: "BTC SHORT", category: "Фьючерсы", currentValue: 9.64, invested: 9.92, currentPrice: 65607, share: 1.46, pnl: -0.28, pnlPct: -2.82 },
    { asset: "USDC HL", category: "Свободные деньги", currentValue: 66.92, invested: 66.92, currentPrice: 1, share: 10.02, pnl: 0, pnlPct: 0 },
    { asset: "USDC", category: "Свободные деньги", currentValue: 325.92, invested: 325.92, currentPrice: 1, share: 48.78, pnl: 0, pnlPct: 0 },
    { asset: "USDT ARB", category: "Свободные деньги", currentValue: 75.73, invested: 75.73, currentPrice: 1, share: 11.33, pnl: 0, pnlPct: 0 },
    { asset: "USDC BNB", category: "Свободные деньги", currentValue: 10.21, invested: 10.21, currentPrice: 1, share: 1.53, pnl: 0, pnlPct: 0 },
    { asset: "CAKE LONG", category: "Фьючерсы", currentValue: 5.55, invested: 5, currentPrice: 1.554, share: 0.83, pnl: 0.55, pnlPct: 11 },
    { asset: "APEX", category: "Крипта", currentValue: 6.18, invested: 6.8, currentPrice: 0.15, share: 0.93, pnl: -0.62, pnlPct: -9.12 },
  ],
};

const hyperliquidRiskByCoin = {
  BTC: { leverage: 3, liquidationPx: 85502.46 },
  CAKE: { leverage: 2, liquidationPx: 0.8845537059 },
  MNT: { leverage: 2, liquidationPx: 0.2877424788 },
};

const setEnv = () => {
  process.env.CRON_SECRET = "cron-secret";
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_CHAT_ID = "123456";
  process.env.INVESTOR_APPS_SCRIPT_URL = "https://apps-script.example/main";
  delete process.env.HYPERLIQUID_ADDRESS;
  delete process.env.VITE_HL_ADDRESS;
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
    expect(telegramBody.text).toContain("TON — P&L -19,63 $ (-18,57%)");
    expect(telegramBody.text).not.toContain("TON — 86,06 $");
    expect(telegramBody.text).toContain("CAKE LONG");
    expect(telegramBody.text).toContain("Кэш и резерв: 478,77 $");
    expect(telegramBody.text).toContain("Health Factor: 65/100");
    expect(telegramBody.text).toContain("Индекс страха и жадности: 46");
    expect(telegramBody.text).toContain("простаивает 59,13 $ сверх лимита 419,64 $");
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
      positionsCount: 4,
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

  it("uses computed Health Factor instead of legacy risk.health", () => {
    const report = buildDailyTelegramReport({
      ...portfolioPayload,
      overview: {
        ...portfolioPayload.overview,
        health: 0,
      },
      risk: {
        ...portfolioPayload.risk,
        health: 79,
      },
    }, {
      accountId: "main",
      now: new Date("2026-08-19T05:30:00.000Z"),
      computedHealth: { healthFactor: 65, components: {} },
    });

    expect(report.text).toContain("Health Factor: 65/100");
    expect(report.text).not.toContain("Health Factor: 79/100");
    expect(report.facts.health).toBe(65);
  });

  it("computes the current UI-like Health Factor from positions and Hyperliquid risk", () => {
    const health = computeDailyReportHealth(liveLikePayload, { riskByCoin: hyperliquidRiskByCoin });
    const report = buildDailyTelegramReport(liveLikePayload, {
      accountId: "main",
      now: new Date("2026-08-19T05:30:00.000Z"),
      hyperliquidRiskByCoin,
    });

    expect(health.healthFactor).toBe(65);
    expect(health.components).toMatchObject({
      reserve: 79,
      riskControl: 49,
      diversification: 24,
    });
    expect(report.text).toContain("Health Factor: 65/100");
    expect(report.text).not.toContain("Health Factor: 79/100");
  });
});
