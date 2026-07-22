export type AssetQualityRecord = {
  asset: string;
  cmcRank: number | null;
  binanceMonitoring: boolean;
  updatedAt?: string;
  source?: string;
};

export type AssetQualitySource = {
  records: AssetQualityRecord[];
  connected: boolean;
};

export type AssetQualityVerdict = {
  status: "ok" | "warn" | "block";
  blockers: string[];
  warnings: string[];
  record: AssetQualityRecord | null;
};

const TOP_LIMIT = 100;

function normalizeAsset(asset: string): string {
  return asset.trim().toUpperCase();
}

export function evaluateAssetQuality(
  asset: string,
  source?: AssetQualitySource,
): AssetQualityVerdict {
  const key = normalizeAsset(asset);

  if (!key || key === "—") {
    return { status: "warn", blockers: [], warnings: ["Введите тикер для проверки качества актива"], record: null };
  }

  if (!source?.connected) {
    return {
      status: "warn",
      blockers: [],
      warnings: ["Источник проверки токенов ещё не подключён"],
      record: null,
    };
  }

  const record = source.records.find((item) => normalizeAsset(item.asset) === key) ?? null;
  if (!record) {
    return {
      status: "warn",
      blockers: [],
      warnings: [`Нет записи качества для ${key}`],
      record: null,
    };
  }

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (record.cmcRank === null || record.cmcRank <= 0 || record.cmcRank > TOP_LIMIT) {
    blockers.push(`${key}: токен вне топ-100 CoinMarketCap`);
  }
  if (record.binanceMonitoring) {
    blockers.push(`${key}: токен находится в списке мониторинга Binance`);
  }

  return {
    status: blockers.length > 0 ? "block" : warnings.length > 0 ? "warn" : "ok",
    blockers,
    warnings,
    record,
  };
}
