import {
  INVESTOR_API_TIMEOUT_MS,
  INVESTOR_API_URL,
} from "../config/constants";
import { fetchJsonWithTimeout } from "../services/http";

export async function fetchInvestorData(apiUrl: string = INVESTOR_API_URL): Promise<unknown> {
  return fetchJsonWithTimeout(apiUrl, {
    method: "GET",
    cache: "no-store",
    timeoutMs: INVESTOR_API_TIMEOUT_MS,
  });
}
