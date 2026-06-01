import type { InvestorApiResponse } from "../types/api";

export type ApiValidationResult<TData> =
  | { ok: true; data: TData }
  | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasOptionalRecord = (source: Record<string, unknown>, key: string) =>
  source[key] === undefined || isRecord(source[key]);

const hasOptionalArray = (source: Record<string, unknown>, key: string) =>
  source[key] === undefined || Array.isArray(source[key]);

const validationError = (error: string): ApiValidationResult<InvestorApiResponse> => {
  console.warn(`INVESTOR API VALIDATION ERROR: ${error}`);
  return { ok: false, error };
};

export function validateInvestorApiPayload(value: unknown): ApiValidationResult<InvestorApiResponse> {
  if (!isRecord(value)) {
    return validationError("root response is not an object");
  }

  if (value.success !== undefined && typeof value.success !== "boolean") {
    return validationError("success must be boolean");
  }

  if (!hasOptionalRecord(value, "overview")) {
    return validationError("overview must be an object");
  }

  if (!hasOptionalArray(value, "portfolio")) {
    return validationError("portfolio must be an array");
  }

  if (!hasOptionalArray(value, "history")) {
    return validationError("history must be an array");
  }

  if (!hasOptionalRecord(value, "risk")) {
    return validationError("risk must be an object");
  }

  if (!hasOptionalRecord(value, "fearGreedStrategy")) {
    return validationError("fearGreedStrategy must be an object");
  }

  if (!hasOptionalArray(value, "decisions")) {
    return validationError("decisions must be an array");
  }

  if (!hasOptionalArray(value, "scenarios")) {
    return validationError("scenarios must be an array");
  }

  return { ok: true, data: value as InvestorApiResponse };
}

export function validateInvestorApiResponse(value: unknown): InvestorApiResponse | null {
  const result = validateInvestorApiPayload(value);
  return result.ok ? result.data : null;
}
