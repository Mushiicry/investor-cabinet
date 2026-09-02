import { describe, expect, it } from "vitest";
import type { InterestSignal } from "../../src/types/portfolio";
import { buildTradingDataTrust } from "../../src/v2/lib/dataTrust";

const NOW = new Date("2026-08-30T10:00:00.000Z");

const liveStatus = {
  source: "live" as const,
  status: "ready" as const,
  lastLoadedAt: "2026-08-30T09:59:30.000Z",
  error: null,
};

const signal = (patch: Partial<InterestSignal> = {}): InterestSignal => ({
  id: "signal-eth",
  asset: "ETH",
  action: "Купить",
  amountUsd: 25,
  triggerPrice: 1800,
  source: "Hyperliquid allMids",
  currentPrice: 1810,
  status: "ARMED",
  lastCheck: "2026-08-30T09:55:00.000Z",
  triggeredAt: "",
  telegram: "PENDING",
  comment: "",
  ...patch,
});

describe("trading data trust", () => {
  it.each(["main", "wife"] as const)("allows a fresh manual decision for %s", (accountId) => {
    const trust = buildTradingDataTrust({
      accountId,
      portfolioStatus: liveStatus,
      portfolioUpdatedAt: "2026-08-30T09:59:30.000Z",
      expectsSignal: false,
      now: NOW,
    });

    expect(trust.canCreateDecision).toBe(true);
    expect(trust.state).toBe("trusted");
    expect(trust.facts.find((fact) => fact.id === "portfolio")?.source).toBe(
      accountId === "wife"
        ? "Google Sheets · Apps Script API + wallet proxy"
        : "Google Sheets · Apps Script API",
    );
    expect(trust.facts.find((fact) => fact.id === "price")?.state).toBe("manual");
  });

  it.each([
    { source: "fallback" as const, status: "error" as const },
    { source: "cache" as const, status: "refreshing" as const },
    { source: "live" as const, status: "stale" as const },
  ])("blocks new decisions for $source/$status portfolio data", ({ source, status }) => {
    const trust = buildTradingDataTrust({
      accountId: "main",
      portfolioStatus: { ...liveStatus, source, status },
      portfolioUpdatedAt: "2026-08-30T09:59:30.000Z",
      expectsSignal: false,
      now: NOW,
    });

    expect(trust.canCreateDecision).toBe(false);
    expect(trust.state).toBe("blocked");
  });

  it("blocks a live portfolio snapshot older than two minutes", () => {
    const trust = buildTradingDataTrust({
      accountId: "wife",
      portfolioStatus: liveStatus,
      portfolioUpdatedAt: "2026-08-30T09:57:00.000Z",
      expectsSignal: false,
      now: NOW,
    });

    expect(trust.canCreateDecision).toBe(false);
    expect(trust.blockers).toContain("Последнее подтверждённое обновление старше 2 минут.");
  });

  it("allows a fresh signal and exposes signal and price provenance", () => {
    const trust = buildTradingDataTrust({
      accountId: "main",
      portfolioStatus: liveStatus,
      portfolioUpdatedAt: "2026-08-30T09:59:30.000Z",
      signal: signal(),
      expectsSignal: true,
      now: NOW,
    });

    expect(trust.canCreateDecision).toBe(true);
    expect(trust.facts.find((fact) => fact.id === "signal")).toMatchObject({
      source: "Hyperliquid allMids",
      updatedAt: "2026-08-30T09:55:00.000Z",
      state: "trusted",
    });
    expect(trust.facts.find((fact) => fact.id === "price")?.note).toContain("1810");
  });

  it("blocks an outdated, broken or missing signal", () => {
    const stale = buildTradingDataTrust({
      accountId: "main",
      portfolioStatus: liveStatus,
      portfolioUpdatedAt: "2026-08-30T09:59:30.000Z",
      signal: signal({ lastCheck: "2026-08-30T09:40:00.000Z" }),
      expectsSignal: true,
      now: NOW,
    });
    const broken = buildTradingDataTrust({
      accountId: "main",
      portfolioStatus: liveStatus,
      portfolioUpdatedAt: "2026-08-30T09:59:30.000Z",
      signal: signal({ status: "ERROR" }),
      expectsSignal: true,
      now: NOW,
    });
    const missing = buildTradingDataTrust({
      accountId: "main",
      portfolioStatus: liveStatus,
      portfolioUpdatedAt: "2026-08-30T09:59:30.000Z",
      signal: null,
      expectsSignal: true,
      now: NOW,
    });

    expect(stale.canCreateDecision).toBe(false);
    expect(broken.canCreateDecision).toBe(false);
    expect(missing.canCreateDecision).toBe(false);
  });
});
