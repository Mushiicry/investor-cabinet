import {
  INVESTOR_API_TIMEOUT_MS,
  INVESTOR_API_URL,
  WIFE_API_URL,
} from "../config/constants";
import { supabase } from "../lib/supabaseClient";
import {
  normalizeTradeCaseStore,
  type TradeCaseStore,
} from "../v2/lib/tradeCase";
import { fetchJsonWithTimeout } from "../services/http";

type AccountId = "main" | "wife";

type TradeCaseStoreResponse = {
  success?: boolean;
  store?: unknown;
  error?: string;
};

const apiUrlFor = (accountId: AccountId) =>
  accountId === "wife" ? WIFE_API_URL : INVESTOR_API_URL;

async function authorizationHeader() {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error("Для синхронизации TradeCase требуется авторизация");
  return `Bearer ${accessToken}`;
}

function responseStore(response: unknown): TradeCaseStore {
  const body = response as TradeCaseStoreResponse;
  if (!body?.success || !body.store) {
    throw new Error(body?.error || "TradeCase API вернул некорректный ответ");
  }
  return normalizeTradeCaseStore(body.store);
}

export async function readCloudTradeCaseStore(accountId: AccountId) {
  const url = new URL(apiUrlFor(accountId), window.location.origin);
  url.searchParams.set("action", "listTradeCases");
  const response = await fetchJsonWithTimeout(url.pathname + url.search, {
    method: "GET",
    cache: "no-store",
    headers: { authorization: await authorizationHeader() },
    timeoutMs: INVESTOR_API_TIMEOUT_MS,
  });
  return responseStore(response);
}

export async function upsertCloudTradeCaseStore(
  accountId: AccountId,
  store: TradeCaseStore,
) {
  const url = new URL(apiUrlFor(accountId), window.location.origin);
  url.searchParams.set("action", "upsertTradeCases");
  const response = await fetchJsonWithTimeout(url.pathname + url.search, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      authorization: await authorizationHeader(),
    },
    body: JSON.stringify(normalizeTradeCaseStore(store)),
    timeoutMs: INVESTOR_API_TIMEOUT_MS,
  });
  return responseStore(response);
}
