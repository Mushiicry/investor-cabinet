import { investorReadUrlFor, proxyInvestorApi } from "./_investorProxy.js";

export default function handler(req, res) {
  const incoming = new URL(req.url ?? "/", "http://localhost");
  const action = incoming.searchParams.get("action");

  if (req.method === "GET" && !action) {
    res.statusCode = 307;
    res.setHeader("location", investorReadUrlFor("wife"));
    res.setHeader("cache-control", "no-store");
    res.end();
    return;
  }

  return proxyInvestorApi(req, res, "wife");
}
