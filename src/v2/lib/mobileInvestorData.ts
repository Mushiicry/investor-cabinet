import { buildInvestorStateFromApi } from "../../services/investorState";
import type { InvestorDataSource } from "../../hooks/useInvestorData";
import type { InvestorApiResponse } from "../../types/api";
import type { DataSyncStatus } from "../../types/dataStatus";
import type { PortfolioState } from "../../types/portfolio";
import type { V2LabData } from "../InvestorCabinetV2Lab";
import { buildLiveV2Data } from "./v2LabData";
import { validateMobileInvestorApiPayload } from "./mobileApiContract";
import type { SnapshotSlot } from "../../services/dailySnapshotService";

export type MobileAccountSlot = Extract<SnapshotSlot, "main" | "wife">;

export type MobileDataTrust =
  | "trusted-live"
  | "trusted-refreshing"
  | "limited-cache"
  | "limited-stale"
  | "blocked-error";

export type MobileInvestorDataStatus = {
  accountId: MobileAccountSlot;
  source: InvestorDataSource;
  status: DataSyncStatus;
  lastLoadedAt: string | null;
  error: string | null;
  trust: MobileDataTrust;
  canTrustNumbers: boolean;
};

export type MobileInvestorDataResult =
  | {
      ok: true;
      state: PortfolioState;
      data: V2LabData;
      status: MobileInvestorDataStatus;
    }
  | {
      ok: false;
      error: string;
      status: MobileInvestorDataStatus;
    };

export function buildMobileDataStatus(input: {
  accountId: MobileAccountSlot;
  source: InvestorDataSource;
  status: DataSyncStatus;
  lastLoadedAt?: string | null;
  error?: string | null;
}): MobileInvestorDataStatus {
  const { accountId, source, status, lastLoadedAt = null, error = null } = input;

  const trust: MobileDataTrust =
    status === "error" || (source === "fallback" && status !== "initial-loading")
      ? "blocked-error"
      : status === "stale"
        ? "limited-stale"
        : source === "cache"
          ? "limited-cache"
          : status === "refreshing" || status === "initial-loading"
            ? "trusted-refreshing"
            : "trusted-live";

  return {
    accountId,
    source,
    status,
    lastLoadedAt,
    error,
    trust,
    canTrustNumbers: trust === "trusted-live" || trust === "trusted-refreshing",
  };
}

export function buildMobileInvestorDataFromApi(input: {
  payload: unknown;
  previousState: PortfolioState;
  accountId: MobileAccountSlot;
  source?: InvestorDataSource;
  status?: DataSyncStatus;
  lastLoadedAt?: string | null;
  error?: string | null;
  leverageByCoin?: Record<string, number>;
  riskByCoin?: Record<string, { liquidationPx: number | null }>;
}): MobileInvestorDataResult {
  const {
    payload,
    previousState,
    accountId,
    source = "live",
    status = "ready",
    lastLoadedAt = null,
    error = null,
    leverageByCoin = {},
    riskByCoin = {},
  } = input;
  const dataStatus = buildMobileDataStatus({ accountId, source, status, lastLoadedAt, error });
  const validation = validateMobileInvestorApiPayload(payload);

  if (!validation.ok) {
    return {
      ok: false,
      error: validation.error,
      status: {
        ...dataStatus,
        status: "error",
        trust: "blocked-error",
        canTrustNumbers: false,
        error: validation.error,
      },
    };
  }

  const json = validation.data as InvestorApiResponse;
  if (!json.success) {
    return {
      ok: false,
      error: "Investor API response is unsuccessful",
      status: {
        ...dataStatus,
        status: "error",
        trust: "blocked-error",
        canTrustNumbers: false,
        error: "Investor API response is unsuccessful",
      },
    };
  }

  const state = buildInvestorStateFromApi(json, previousState);
  return {
    ok: true,
    state,
    data: buildLiveV2Data(state, leverageByCoin, riskByCoin, accountId),
    status: dataStatus,
  };
}
