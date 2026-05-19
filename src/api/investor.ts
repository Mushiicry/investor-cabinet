import { INVESTOR_API_URL } from "../config/constants";

export async function fetchInvestorData(): Promise<Record<string, any>> {
  const res = await fetch(INVESTOR_API_URL, {
    method: "GET",
    cache: "no-store",
  });

  return res.json();
}
