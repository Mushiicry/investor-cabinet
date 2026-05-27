import {
  INVESTOR_API_TIMEOUT_MS,
  INVESTOR_API_URL,
} from "../config/constants";
import { fetchJsonWithTimeout } from "../services/http";

export async function fetchInvestorData(): Promise<unknown> {
  return fetchJsonWithTimeout(INVESTOR_API_URL, {
    method: "GET",
    cache: "no-store",
    timeoutMs: INVESTOR_API_TIMEOUT_MS,
  });
}
