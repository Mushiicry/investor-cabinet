import {
  INVESTOR_API_TIMEOUT_MS,
  INVESTOR_API_URL,
} from "../config/constants";
import { supabase } from "../lib/supabaseClient";
import { fetchJsonWithTimeout } from "../services/http";

/** Прокси к Apps Script изредка отвечает 502, пока таблица просыпается. */
const isTransientServerError = (error: unknown) =>
  error instanceof Error && /API request failed: 5\d\d/.test(error.message);

export async function fetchInvestorData(
  apiUrl: string = INVESTOR_API_URL,
  authToken?: string | null,
): Promise<unknown> {
  const session = authToken ? null : supabase ? (await supabase.auth.getSession()).data.session : null;
  const accessToken = authToken ?? session?.access_token;

  const request = () =>
    fetchJsonWithTimeout(apiUrl, {
      method: "GET",
      cache: "no-store",
      headers: accessToken ? { authorization: `Bearer ${accessToken}` } : undefined,
      timeoutMs: INVESTOR_API_TIMEOUT_MS,
    });

  try {
    return await request();
  } catch (error) {
    // Одна повторная попытка на серверную ошибку: сеть моргнула — данные
    // портфеля не должны из-за этого проваливаться в кэш или fallback.
    if (!isTransientServerError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 800));
    return request();
  }
}
