export type DataSyncStatus =
  | "initial-loading"
  | "refreshing"
  | "ready"
  | "stale"
  | "error";

export type DataLoadState<TData> = {
  data: TData;
  isLoading: boolean;
  isRefreshing: boolean;
  status: DataSyncStatus;
  error: string | null;
  lastLoadedAt: string | null;
};
