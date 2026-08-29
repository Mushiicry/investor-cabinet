export function buildDailyTelegramReport(
  payload: unknown,
  options?: {
    accountId?: 'main' | 'wife'
    now?: Date
    computedHealth?: { healthFactor?: number; components?: Record<string, unknown> }
    hyperliquidRiskByCoin?: Record<string, unknown>
    liveFearGreed?: { currentIndex?: number; currentZone?: string } | null
  },
): { text: string; facts: Record<string, unknown> }

export function fetchDailyReportFearGreed(): Promise<{
  currentIndex: number
  currentZone: string
  source: 'alternative.me' | 'cryptorank'
}>

export function sendTelegramMessage(input: {
  botToken: string
  chatId: string
  text: string
}): Promise<unknown>

export function runDailyTelegramReport(input: {
  accountId?: 'main' | 'wife'
  botToken: string
  chatId: string
  now?: Date
}): Promise<{ text: string; facts: Record<string, unknown> }>
