import { describe, expect, it } from "vitest";
import { evaluateAssetQuality } from "../../src/v2/lib/assetQualityGate";

describe("проверка качества токена", () => {
  it("разрешает токен из топ-100 без мониторинга Binance", () => {
    const verdict = evaluateAssetQuality("ETH", {
      connected: true,
      records: [{ asset: "ETH", cmcRank: 2, binanceMonitoring: false }],
    });

    expect(verdict.status).toBe("ok");
    expect(verdict.blockers).toEqual([]);
  });

  it("блокирует токен вне топ-100 CoinMarketCap", () => {
    const verdict = evaluateAssetQuality("PEPE", {
      connected: true,
      records: [{ asset: "PEPE", cmcRank: 140, binanceMonitoring: false }],
    });

    expect(verdict.status).toBe("block");
    expect(verdict.blockers).toContain("PEPE: токен вне топ-100 CoinMarketCap");
  });

  it("блокирует токен из мониторинга Binance", () => {
    const verdict = evaluateAssetQuality("ATOM", {
      connected: true,
      records: [{ asset: "ATOM", cmcRank: 55, binanceMonitoring: true }],
    });

    expect(verdict.status).toBe("block");
    expect(verdict.blockers).toContain("ATOM: токен находится в списке мониторинга Binance");
  });

  it("блокирует покупку без подключённого источника качества", () => {
    const verdict = evaluateAssetQuality("SOL");

    expect(verdict.status).toBe("block");
    expect(verdict.blockers).toContain("Источник проверки токенов недоступен — покупка запрещена до восстановления проверки");
    expect(verdict.warnings).toEqual([]);
  });

  it("блокирует неизвестный тикер при подключённом источнике Top-100", () => {
    const verdict = evaluateAssetQuality("NOM", {
      connected: true,
      cmcTop100Connected: true,
      records: [{ asset: "ETH", cmcRank: 2, binanceMonitoring: false }],
    });

    expect(verdict.status).toBe("block");
    expect(verdict.blockers).toContain("NOM: токен не найден в топ-100 CoinMarketCap");
  });

  it("блокирует токен без подтвержденного Top-100 статуса", () => {
    const verdict = evaluateAssetQuality("JASMY", {
      connected: true,
      records: [{ asset: "JASMY", cmcRank: null, binanceMonitoring: true }],
    });

    expect(verdict.status).toBe("block");
    expect(verdict.blockers).toEqual([
      "JASMY: статус CoinMarketCap Top-100 не подтверждён",
      "JASMY: токен находится в списке мониторинга Binance",
    ]);
    expect(verdict.warnings).toEqual([]);
  });
});
