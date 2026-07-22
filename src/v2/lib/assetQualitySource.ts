import type { AssetQualitySource } from "./assetQualityGate";

const BINANCE_MONITORING_SOURCE_URL = "https://www.binance.com/en/markets/coinInfo-Monitoring";

// Временный контролируемый источник v1. Следующий шаг — вынести список в
// Google Sheets/API, чтобы обновлять его без релиза фронтенда.
const BINANCE_MONITORING_SYMBOLS = [
  "JASMY",
  "WIF",
  "AWE",
  "FTT",
  "BLUR",
  "SYN",
  "MOVE",
  "STORJ",
  "ARK",
  "EPIC",
  "DODO",
  "VELODROME",
  "SCRT",
  "QKC",
  "TLM",
  "VANRY",
  "PORTAL",
  "ACT",
  "RESOLV",
  "QI",
  "HEI",
  "HFT",
  "COOKIE",
  "GTC",
  "QUICK",
  "VIC",
  "PYR",
  "NOM",
  "PIVX",
  "AEUR",
];

export const BINANCE_MONITORING_ASSET_QUALITY: AssetQualitySource = {
  connected: true,
  cmcTop100Connected: false,
  binanceMonitoringConnected: true,
  source: BINANCE_MONITORING_SOURCE_URL,
  updatedAt: "2026-07-22",
  records: BINANCE_MONITORING_SYMBOLS.map((asset) => ({
    asset,
    cmcRank: null,
    binanceMonitoring: true,
    source: BINANCE_MONITORING_SOURCE_URL,
    updatedAt: "2026-07-22",
  })),
};
