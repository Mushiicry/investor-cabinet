import type { IncomingMessage, ServerResponse } from 'node:http'

export type BtcDailyBar = {
  ts: number
  open: number
  high: number
  low: number
  close: number
}

export function fetchBtcDailyBars(now?: number): Promise<BtcDailyBar[]>

export function handleBtcDailyApi(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void>
