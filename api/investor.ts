import type { IncomingMessage, ServerResponse } from "node:http";
import { proxyInvestorApi } from "./_investorProxy";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return proxyInvestorApi(req, res, "main");
}
