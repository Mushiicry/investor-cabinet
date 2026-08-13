import {
  validateInvestorApiPayload,
  type ApiValidationResult,
} from "../../services/apiValidation";
import type { InvestorApiResponse } from "../../types/api";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasRequiredRecord = (source: Record<string, unknown>, key: string) =>
  isRecord(source[key]);

const hasRequiredArray = (source: Record<string, unknown>, key: string) =>
  Array.isArray(source[key]);

const hasValue = (source: Record<string, unknown>, key: string) =>
  source[key] !== undefined && source[key] !== null && source[key] !== "";

const mobileValidationError = (error: string): ApiValidationResult<InvestorApiResponse> => ({
  ok: false,
  error,
});

export function validateMobileInvestorApiPayload(value: unknown): ApiValidationResult<InvestorApiResponse> {
  const base = validateInvestorApiPayload(value);
  if (!base.ok) return base;

  if (!isRecord(value)) {
    return mobileValidationError("root response is not an object");
  }

  if (typeof value.success !== "boolean") {
    return mobileValidationError("success is required for mobile contract");
  }

  if (value.success === false) {
    return { ok: true, data: value as InvestorApiResponse };
  }

  if (!hasRequiredRecord(value, "overview")) {
    return mobileValidationError("overview is required for mobile contract");
  }

  if (!hasRequiredArray(value, "portfolio")) {
    return mobileValidationError("portfolio is required for mobile contract");
  }

  if (!hasRequiredRecord(value, "risk")) {
    return mobileValidationError("risk is required for mobile contract");
  }

  if (typeof value.updatedAt !== "string" || !value.updatedAt.trim()) {
    return mobileValidationError("updatedAt is required for mobile contract");
  }

  const overview = value.overview as Record<string, unknown>;
  const requiredOverviewKeys = [
    "portfolioValue",
    "invested",
    "pnl",
    "pnlPct",
    "reserve",
    "positionsCount",
    "state",
    "signal",
    "action",
  ];
  const missingOverviewKey = requiredOverviewKeys.find((key) => !hasValue(overview, key));
  if (missingOverviewKey) {
    return mobileValidationError(`overview.${missingOverviewKey} is required for mobile contract`);
  }

  const risk = value.risk as Record<string, unknown>;
  const requiredRiskKeys = [
    "portfolioValue",
    "reserve",
    "reserveShare",
    "deployableCash",
    "largestRiskAsset",
    "largestRiskShare",
    "cryptoShare",
    "state",
    "signal",
    "summary",
  ];
  const missingRiskKey = requiredRiskKeys.find((key) => !hasValue(risk, key));
  if (missingRiskKey) {
    return mobileValidationError(`risk.${missingRiskKey} is required for mobile contract`);
  }

  return { ok: true, data: value as InvestorApiResponse };
}
