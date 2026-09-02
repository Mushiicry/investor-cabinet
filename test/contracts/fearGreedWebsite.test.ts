import { afterEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import fearGreedCryptoRankHandler from "../../api/fear-greed-cryptorank.js";
import { fetchFearGreedData } from "../../src/api/fearGreed";

type MockResponse = ServerResponse & {
  body?: string;
  headers: Record<string, string | number | readonly string[]>;
};

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;

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

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
});

describe("website Fear & Greed sources", () => {
  it("uses Alternative.me when the primary source responds", async () => {
    globalThis.window = globalThis as unknown as Window & typeof globalThis;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ value: "68", value_classification: "Greed", timestamp: "1787961600" }],
    }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchFearGreedData();

    expect(result?.current).toBe(68);
    expect(result?.history[0]?.source).toBe("alternative.me");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/fear-greed");
  });

  it("switches to the CryptoRank endpoint when the primary source fails", async () => {
    globalThis.window = globalThis as unknown as Window & typeof globalThis;
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("Alternative timeout"))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        source: "cryptorank",
        data: [{ value: "68", value_classification: "Greed", timestamp: "1787961600" }],
      }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchFearGreedData();

    expect(result?.current).toBe(68);
    expect(result?.history[0]?.source).toBe("cryptorank");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/fear-greed-cryptorank");
  });

  it("normalizes the latest CryptoRank value for the website endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { value: 67, timestamp: 1787875200000 },
      { value: 68, timestamp: 1787961600000 },
    ]), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const res = mockRes();

    await fearGreedCryptoRankHandler({ method: "GET" } as IncomingMessage, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({
      source: "cryptorank",
      data: [{ value: "68", value_classification: "Greed" }],
    });
  });
});
