import { afterEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { fetchMarketSparkline, handleMarketSparklineApi } from "../../api/_marketSparkline.js";

type MockResponse = ServerResponse & {
  body?: string;
  headers: Record<string, string | number | readonly string[]>;
};

const originalFetch = globalThis.fetch;

const mockReq = (url: string, method = "GET") => ({ method, url }) as IncomingMessage;
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

describe("market sparkline API", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("requests the latest daily GRAM candles from OKX and sorts them oldest first", async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      expect(url).toContain("instId=GRAM-USDT");
      expect(url).toContain("bar=1D");
      expect(url).toContain("limit=36");
      return Response.json({
        code: "0",
        data: [
          ["200", "1", "2", "0.5", "1.6"],
          ["100", "1", "2", "0.5", "1.4"],
        ],
      });
    }) as typeof fetch;

    await expect(fetchMarketSparkline("GRAM")).resolves.toEqual([
      { ts: 100, close: 1.4 },
      { ts: 200, close: 1.6 },
    ]);
  });

  it("requests the latest daily ATOM candles from Binance", async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      expect(url).toContain("data-api.binance.vision/api/v3/klines");
      expect(url).toContain("symbol=ATOMUSDT");
      expect(url).toContain("interval=1d");
      expect(url).toContain("limit=36");
      return Response.json([
        [100, "1.4", "1.7", "1.3", "1.6"],
        [200, "1.6", "1.8", "1.5", "1.7"],
      ]);
    }) as typeof fetch;

    await expect(fetchMarketSparkline("ATOM")).resolves.toEqual([
      { ts: 100, close: 1.6 },
      { ts: 200, close: 1.7 },
    ]);
  });

  it("requests the latest daily SOL candles from Binance", async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      expect(url).toContain("symbol=SOLUSDT");
      expect(url).toContain("interval=1d");
      return Response.json([
        [100, "94", "98", "92", "95.5"],
        [200, "95.5", "99", "94", "97.2"],
      ]);
    }) as typeof fetch;

    await expect(fetchMarketSparkline("SOL")).resolves.toEqual([
      { ts: 100, close: 95.5 },
      { ts: 200, close: 97.2 },
    ]);
  });

  it("requests daily BNB and BTC candles from Binance", async () => {
    const requestedSymbols: string[] = [];
    globalThis.fetch = vi.fn(async (input) => {
      const url = new URL(String(input));
      requestedSymbols.push(url.searchParams.get("symbol") ?? "");
      return Response.json([
        [100, "1", "2", "0.5", "1.5"],
        [200, "1.5", "2.5", "1", "2"],
      ]);
    }) as typeof fetch;

    await fetchMarketSparkline("BNB");
    await fetchMarketSparkline("BTC");

    expect(requestedSymbols).toEqual(["BNBUSDT", "BTCUSDT"]);
  });

  it("uses Binance for ETH and Bybit spot for APEX", async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "api.bytick.com") {
        expect(url.searchParams.get("category")).toBe("spot");
        expect(url.searchParams.get("symbol")).toBe("APEXUSDT");
        expect(url.searchParams.get("interval")).toBe("D");
        return Response.json({
          retCode: 0,
          result: { list: [["100", "0.2", "0.3", "0.1", "0.25"]] },
        });
      }

      expect(url.searchParams.get("symbol")).toBe("ETHUSDT");
      expect(url.searchParams.get("interval")).toBe("1d");
      return Response.json([[100, "2400", "2500", "2350", "2460"]]);
    }) as typeof fetch;

    await expect(fetchMarketSparkline("ETH")).resolves.toEqual([{ ts: 100, close: 2460 }]);
    await expect(fetchMarketSparkline("APEX")).resolves.toEqual([{ ts: 100, close: 0.25 }]);
  });

  it("maps MNT, CAKE, GOLD and SPCXB to their visual market sources", async () => {
    const requestedMarkets: string[] = [];
    globalThis.fetch = vi.fn(async (input) => {
      const url = new URL(String(input));
      requestedMarkets.push(url.searchParams.get("symbol") ?? "");
      if (url.hostname === "api.bytick.com") {
        return Response.json({
          retCode: 0,
          result: { list: [["100", "0.4", "0.6", "0.3", "0.5"]] },
        });
      }
      return Response.json([[100, "1", "2", "0.5", "1.5"]]);
    }) as typeof fetch;

    await fetchMarketSparkline("MNT");
    await fetchMarketSparkline("CAKE");
    await fetchMarketSparkline("GOLD");
    await fetchMarketSparkline("SPCXB");

    expect(requestedMarkets).toEqual(["MNTUSDT", "CAKEUSDT", "PAXGUSDT", "SPCXBUSDT"]);
  });

  it("rejects assets outside the explicit visual-data allowlist", async () => {
    const res = mockRes();
    await handleMarketSparklineApi(mockReq("/api/market-sparkline?asset=UNLISTED"), res);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body ?? "{}")).toEqual({
      success: false,
      error: "Unsupported sparkline asset",
    });
  });
});
