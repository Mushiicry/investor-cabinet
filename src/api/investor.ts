import {
  INVESTOR_API_TIMEOUT_MS,
  INVESTOR_API_URL,
} from "../config/constants";
import { supabase } from "../lib/supabaseClient";
import { fetchJsonWithTimeout } from "../services/http";

export async function fetchInvestorData(apiUrl: string = INVESTOR_API_URL): Promise<unknown> {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const accessToken = session?.access_token;

  return fetchJsonWithTimeout(apiUrl, {
    method: "GET",
    cache: "no-store",
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : undefined,
    timeoutMs: INVESTOR_API_TIMEOUT_MS,
  });
}
