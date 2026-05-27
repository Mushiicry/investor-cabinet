export type DataLoadState<TData> = {
  data: TData;
  isLoading: boolean;
  error: string | null;
  lastLoadedAt: string | null;
};
