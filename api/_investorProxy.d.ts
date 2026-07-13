import type { IncomingMessage, ServerResponse } from 'node:http'

export function proxyInvestorApi(
  req: IncomingMessage,
  res: ServerResponse,
  kind: 'main' | 'wife',
): Promise<void>
