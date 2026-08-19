export function buildDailyTelegramReport(
  payload: unknown,
  options?: { accountId?: 'main' | 'wife'; now?: Date },
): { text: string; facts: Record<string, unknown> }

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
