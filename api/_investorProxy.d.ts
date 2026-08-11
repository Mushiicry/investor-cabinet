import type { IncomingMessage, ServerResponse } from 'node:http'

export function proxyInvestorApi(
  req: IncomingMessage,
  res: ServerResponse,
  kind: 'main' | 'wife',
): Promise<void>

export function investorReadUrlFor(kind: 'main' | 'wife'): string

export function readInvestorPayloadForAssistant(kind: 'main' | 'wife'): Promise<unknown>
