import {
  INVESTOR_API_TIMEOUT_MS,
  INVESTOR_API_URL,
} from "../config/constants";
import { supabase } from "../lib/supabaseClient";
import { fetchJsonWithTimeout } from "../services/http";
import type { InvestorDNAAuditAnswer } from "../v2/lib/investorDNA";

export type SaveInvestorDNAAuditPayload = {
  accountId: "main" | "wife";
  auditType: "lite" | "full";
  submittedAt: string;
  answeredCount: number;
  totalQuestions: number;
  answers: Array<Pick<InvestorDNAAuditAnswer, "questionId" | "option" | "note">>;
};

export async function saveInvestorDNAAudit(
  payload: SaveInvestorDNAAuditPayload,
  apiUrl: string = INVESTOR_API_URL,
): Promise<unknown> {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const accessToken = session?.access_token;
  const url = new URL(apiUrl, window.location.origin);
  url.searchParams.set("action", "saveInvestorDNAAnswers");

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
