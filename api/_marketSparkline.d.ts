import type { IncomingMessage, ServerResponse } from "node:http";

export type MarketSparklinePoint = {
  ts: number;
  close: number;
};

export function fetchMarketSparkline(asset: string): Promise<MarketSparklinePoint[]>;

export function handleMarketSparklineApi(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void>;
