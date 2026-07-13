import { afterEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { proxyInvestorApi } from "../../api/_investorProxy.js";

type MockResponse = ServerResponse & {
  body?: string;
  headers: Record<string, string | number | readonly string[]>;
};

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

const mockReq = (authorization?: string): IncomingMessage => ({
  method: "GET",
  headers: authorization ? { authorization } : {},
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

  it("rejects requests without a Supabase bearer token", async () => {
    setProxyEnv();
    const res = mockRes();

    await proxyInvestorApi(mockReq(), res, "main");

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({ success: false });
  });

  it("rejects authenticated users that do not match the account owner email", async () => {
    setProxyEnv();
    globalThis.fetch = vi.fn(async () => Response.json({ email: "other@example.com" })) as typeof fetch;
    const res = mockRes();

    await proxyInvestorApi(mockReq("Bearer token"), res, "main");

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

    await proxyInvestorApi(mockReq("Bearer token"), res, "main");

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({ success: true });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(globalThis.fetch).mock.calls[1][0])).toBe("https://apps-script.example/main");
  });
});
