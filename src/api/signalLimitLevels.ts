import {
  INVESTOR_API_TIMEOUT_MS,
  INVESTOR_API_URL,
} from "../config/constants";
import { supabase } from "../lib/supabaseClient";
import { fetchJsonWithTimeout } from "../services/http";

export type CreateSignalLimitLevelPayload = {
  asset: string;
  action: "Купить" | "Продать";
  amountUsd: number;
  triggerPrice: number;
  comment: string;
};

export type DeleteSignalLimitLevelPayload = {
  signalId: string;
};

export async function createSignalLimitLevel(
  payload: CreateSignalLimitLevelPayload,
  apiUrl: string = INVESTOR_API_URL,
): Promise<unknown> {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const accessToken = session?.access_token;
  const url = new URL(apiUrl, window.location.origin);
  url.searchParams.set("action", "createSignalLimitLevel");

  return fetchJsonWithTimeout(url.pathname + url.search, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(payload),
    timeoutMs: INVESTOR_API_TIMEOUT_MS,
  });
}

export async function deleteSignalLimitLevel(
  payload: DeleteSignalLimitLevelPayload,
  apiUrl: string = INVESTOR_API_URL,
): Promise<unknown> {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const accessToken = session?.access_token;
  const url = new URL(apiUrl, window.location.origin);
  url.searchParams.set("action", "deleteSignalLimitLevel");

  return fetchJsonWithTimeout(url.pathname + url.search, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(payload),
    timeoutMs: INVESTOR_API_TIMEOUT_MS,
  });
}
