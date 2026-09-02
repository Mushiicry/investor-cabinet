import { afterEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { investorReadUrlFor, proxyInvestorApi } from "../../api/_investorProxy.js";

type MockResponse = ServerResponse & {
  body?: string;
  headers: Record<string, string | number | readonly string[]>;
};

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

const mockReq = (authorization?: string, url = "/api/investor"): IncomingMessage => ({
  method: "GET",
  url,
  headers: authorization ? { authorization } : {},
}) as IncomingMessage;

const mockPostReq = (authorization?: string): IncomingMessage => ({
  method: "POST",
  url: "/api/investor?action=saveInvestorDNAAnswers",
  headers: authorization ? { authorization } : {},
  [Symbol.asyncIterator]: async function* () {
    yield Buffer.from(JSON.stringify({ accountId: "main", auditType: "lite", answers: [] }));
  },
}) as IncomingMessage;

const mockTradeCasesPostReq = (authorization?: string): IncomingMessage => ({
  method: "POST",
  url: "/api/investor?action=upsertTradeCases",
  headers: authorization ? { authorization, "content-type": "application/json" } : {},
  [Symbol.asyncIterator]: async function* () {
    yield Buffer.from(JSON.stringify({ version: 1, activeTradeCaseId: null, cases: [] }));
  },
}) as IncomingMessage;

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

const setProxyEnv = () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon";
  process.env.FOUNDER_EMAIL = "founder@example.com";
  process.env.WIFE_EMAIL = "wife@example.com";
  process.env.INVESTOR_APPS_SCRIPT_URL = "https://apps-script.example/main";
  process.env.WIFE_APPS_SCRIPT_URL = "https://apps-script.example/wife";
};

describe("investor serverless auth proxy", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("allows public read-only GET requests without a Supabase bearer token", async () => {
    setProxyEnv();
    globalThis.fetch = vi.fn(async () => Response.json({ success: true, overview: {}, portfolio: [] })) as typeof fetch;
    const res = mockRes();

    await proxyInvestorApi(mockReq(), res, "main");

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({ success: true });
    expect(globalThis.fetch).toHaveBeenCalledOnce();
    expect(String(vi.mocked(globalThis.fetch).mock.calls[0][0])).toBe("https://apps-script.example/main?accountId=main");
  });

  it("routes wife reads through the canonical investor Apps Script endpoint", async () => {
    setProxyEnv();
    globalThis.fetch = vi.fn(async () => Response.json({ success: true, overview: {}, portfolio: [] })) as typeof fetch;
    const res = mockRes();

    await proxyInvestorApi(mockReq(undefined, "/api/investor-wife"), res, "wife");

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({ success: true });
    expect(String(vi.mocked(globalThis.fetch).mock.calls[0][0])).toBe("https://apps-script.example/main?accountId=wife");
    expect(vi.mocked(globalThis.fetch).mock.calls.map((call) => String(call[0]))).toEqual(expect.arrayContaining([
      "https://api.hyperliquid.xyz/info",
      "https://arb1.arbitrum.io/rpc",
    ]));
  });

  it("builds the canonical wife read URL from the main Apps Script endpoint", () => {
    setProxyEnv();

    expect(investorReadUrlFor("wife")).toBe("https://apps-script.example/main?accountId=wife");
  });

  it("ignores the legacy wife Apps Script URL even when it is configured", async () => {
    setProxyEnv();
    globalThis.fetch = vi.fn(async () => Response.json({ success: true, overview: {}, portfolio: [] })) as typeof fetch;
    const res = mockRes();

    await proxyInvestorApi(mockReq(undefined, "/api/investor-wife"), res, "wife");

    expect(String(vi.mocked(globalThis.fetch).mock.calls[0][0])).not.toContain("apps-script.example/wife");
  });

  it("enriches wife reads with live prices and live USDT balance", async () => {
    setProxyEnv();
    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const body = String(init?.body ?? "");

      if (url === "https://apps-script.example/main?accountId=wife") {
        return Response.json({
          success: true,
          overview: { portfolioValue: 1000, invested: 1000, reserve: 426.28 },
          risk: {},
          fearGreedStrategy: { portfolioValue: 1000 },
          portfolio: [
            { asset: "ETH", ticker: "ETH", category: "Крипта", quantity: 3, invested: 7465, currentPrice: 2476, currentValue: 7464.89 },
            { asset: "USDT", ticker: "USDT", category: "Кэш / Стейблы", quantity: 426.28, invested: 426.28, currentPrice: 1, currentValue: 426.28 },
          ],
        });
      }

      if (url === "https://api.hyperliquid.xyz/info" && body.includes('"dex":"xyz"')) {
        return Response.json({ "xyz:GOLD": "4358.15", "xyz:SPCX": "136.585" });
      }

      if (url === "https://api.hyperliquid.xyz/info") {
        return Response.json({ BTC: "65100.5", ETH: "1920.85", SOL: "77.2375", GRAM: "1.3392" });
      }

      if (url === "https://arb1.arbitrum.io/rpc") {
        return Response.json({ result: "0x1f5e6540" });
      }

      if (url.includes("tonapi.io")) {
        return Response.json({ balances: [] });
      }

      return Response.json({});
    }) as typeof fetch;
    const res = mockRes();

    await proxyInvestorApi(mockReq(undefined, "/api/investor-wife"), res, "wife");

    const body = JSON.parse(res.body ?? "{}");
    expect(body).toMatchObject({
      success: true,
      patch: "WIFE API v2.5 - vercel-live-prices",
      overview: {
        reserve: 526.28,
      },
      _chain: {
        USDT: 526.28,
      },
    });
    expect(body.portfolio[0]).toMatchObject({
      asset: "ETH",
      currentPrice: 1920.85,
      currentValue: 5762.55,
    });
  });

  it("retries transient Apps Script read failures before serving public GET data", async () => {
    setProxyEnv();
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response("<!doctype html>", {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" },
      }))
      .mockResolvedValueOnce(Response.json({ success: true, overview: { portfolioValue: 588.3 }, portfolio: [] })) as typeof fetch;
    const res = mockRes();

    await proxyInvestorApi(mockReq(), res, "main");

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({
      success: true,
      overview: { portfolioValue: 588.3 },
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("returns controlled JSON when Apps Script keeps returning HTML for public GET", async () => {
    setProxyEnv();
    globalThis.fetch = vi.fn(async () => new Response("<!doctype html>", {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    })) as typeof fetch;
    const res = mockRes();

    await proxyInvestorApi(mockReq(), res, "main");

    expect(res.statusCode).toBe(502);
    expect(res.headers["content-type"]).toBe("application/json; charset=utf-8");
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({
      success: false,
      upstreamStatus: 404,
      attempts: 3,
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it("rejects write requests without a Supabase bearer token", async () => {
    setProxyEnv();
    const res = mockRes();

    await proxyInvestorApi(mockPostReq(), res, "main");

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({ success: false });
  });

  it("rejects authenticated users that do not match the account owner email", async () => {
    setProxyEnv();
    globalThis.fetch = vi.fn(async () => Response.json({ email: "other@example.com" })) as typeof fetch;
    const res = mockRes();

    await proxyInvestorApi(mockReq("Bearer token", "/api/investor?action=setMaxLevel&level=2"), res, "main");

    expect(res.statusCode).toBe(403);
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });

  it("proxies the main investor API after Supabase user verification", async () => {
    setProxyEnv();
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/auth/v1/user")) {
        return Response.json({ email: "founder@example.com" });
      }

      return Response.json({ success: true, overview: {}, portfolio: [] });
    }) as typeof fetch;
    const res = mockRes();

    await proxyInvestorApi(mockReq("Bearer token", "/api/investor?action=setMaxLevel&level=2"), res, "main");

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({ success: true });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(globalThis.fetch).mock.calls[1][0])).toBe(
      "https://apps-script.example/main?accountId=main&action=setMaxLevel&level=2",
    );
  });

  it("forwards wife daily snapshot action through the authenticated wife proxy", async () => {
    setProxyEnv();
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/auth/v1/user")) {
        return Response.json({ email: "wife@example.com" });
      }

      return Response.json({ success: true, snapshot: { date: "20.08.2026" } });
    }) as typeof fetch;
    const res = mockRes();

    await proxyInvestorApi(
      mockReq("Bearer token", "/api/investor-wife?action=syncWifeDailySnapshot"),
      res,
      "wife",
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({ success: true });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(globalThis.fetch).mock.calls[1][0])).toBe(
      "https://apps-script.example/main?accountId=wife&action=syncWifeDailySnapshot",
    );
  });

  it("forwards wife recorded snapshot values through the authenticated wife proxy", async () => {
    setProxyEnv();
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/auth/v1/user")) {
        return Response.json({ email: "wife@example.com" });
      }

      return Response.json({ success: true, snapshot: { date: "20.08.2026" } });
    }) as typeof fetch;
    const res = mockRes();

    await proxyInvestorApi(
      mockReq(
        "Bearer token",
        "/api/investor-wife?action=recordWifeDailySnapshot&portfolioValue=8703.09&invested=10188.28&pnl=-1485.19&pnlPct=-0.1458&reserve=653.28&positionsCount=6",
      ),
      res,
      "wife",
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({ success: true });
    expect(String(vi.mocked(globalThis.fetch).mock.calls[1][0])).toBe(
      "https://apps-script.example/main?accountId=wife&action=recordWifeDailySnapshot&portfolioValue=8703.09&invested=10188.28&pnl=-1485.19&pnlPct=-0.1458&reserve=653.28&positionsCount=6",
    );
  });

  it("forwards DNA answer POST through the authenticated investor proxy", async () => {
    setProxyEnv();
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/auth/v1/user")) {
        return Response.json({ email: "founder@example.com" });
      }

      return Response.json({ success: true, savedAnswers: 1 });
    }) as typeof fetch;
    const res = mockRes();

    await proxyInvestorApi(mockPostReq("Bearer token"), res, "main");

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({ success: true });
    expect(String(vi.mocked(globalThis.fetch).mock.calls[1][0])).toBe(
      "https://apps-script.example/main?accountId=main&action=saveInvestorDNAAnswers",
    );
    expect(vi.mocked(globalThis.fetch).mock.calls[1][1]).toMatchObject({
      method: "POST",
    });
  });

  it("forwards authenticated TradeCase reads without exposing them in the public payload", async () => {
    setProxyEnv();
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/auth/v1/user")) {
        return Response.json({ email: "founder@example.com" });
      }
      return Response.json({ success: true, store: { version: 1, activeTradeCaseId: null, cases: [] } });
    }) as typeof fetch;
    const res = mockRes();

    await proxyInvestorApi(
      mockReq("Bearer token", "/api/investor?action=listTradeCases"),
      res,
      "main",
    );

    expect(res.statusCode).toBe(200);
    expect(String(vi.mocked(globalThis.fetch).mock.calls[1][0])).toBe(
      "https://apps-script.example/main?accountId=main&action=listTradeCases",
    );
  });

  it("forwards authenticated TradeCase upserts to the selected account", async () => {
    setProxyEnv();
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/auth/v1/user")) {
        return Response.json({ email: "founder@example.com" });
      }
      return Response.json({ success: true, store: { version: 1, activeTradeCaseId: null, cases: [] } });
    }) as typeof fetch;
    const res = mockRes();

    await proxyInvestorApi(mockTradeCasesPostReq("Bearer token"), res, "main");

    expect(res.statusCode).toBe(200);
    expect(String(vi.mocked(globalThis.fetch).mock.calls[1][0])).toBe(
      "https://apps-script.example/main?accountId=main&action=upsertTradeCases",
    );
    expect(vi.mocked(globalThis.fetch).mock.calls[1][1]).toMatchObject({ method: "POST" });
  });
});
