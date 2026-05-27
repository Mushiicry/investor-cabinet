import type { InvestorApiResponse } from "../types/api";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasOptionalRecord = (source: Record<string, unknown>, key: string) =>
  source[key] === undefined || isRecord(source[key]);

const hasOptionalArray = (source: Record<string, unknown>, key: string) =>
  source[key] === undefined || Array.isArray(source[key]);

export function validateInvestorApiResponse(value: unknown): InvestorApiResponse | null {
  if (!isRecord(value)) {
    console.warn("INVESTOR API VALIDATION ERROR: root response is not an object");
    return null;
  }

  if (value.success !== undefined && typeof value.success !== "boolean") {
    console.warn("INVESTOR API VALIDATION ERROR: success must be boolean");
    return null;
  }

  if (!hasOptionalRecord(value, "overview")) {
    console.warn("INVESTOR API VALIDATION ERROR: overview must be an object");
    return null;
  }

  if (!hasOptionalArray(value, "portfolio")) {
    console.warn("INVESTOR API VALIDATION ERROR: portfolio must be an array");
    return null;
  }

  if (!hasOptionalArray(value, "history")) {
    console.warn("INVESTOR API VALIDATION ERROR: history must be an array");
    return null;
  }

  if (!hasOptionalRecord(value, "risk")) {
    console.warn("INVESTOR API VALIDATION ERROR: risk must be an object");
    return null;
  }

  if (!hasOptionalArray(value, "decisions")) {
    console.warn("INVESTOR API VALIDATION ERROR: decisions must be an array");
    return null;
  }

  if (!hasOptionalArray(value, "scenarios")) {
    console.warn("INVESTOR API VALIDATION ERROR: scenarios must be an array");
    return null;
  }

  return value as InvestorApiResponse;
}
