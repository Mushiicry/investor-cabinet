import { proxyInvestorApi } from "./_investorProxy.js";

export default function handler(req, res) {
  return proxyInvestorApi(req, res, "wife");
}
