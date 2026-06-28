"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isReportQueryRequested, withReportQueryFlag } from "@/lib/reports/report-query-params";

export interface UseReportQueryOptions<TDraft, TData> {
  initialDraft: TDraft;
  /** Compare draft vs last applied filters (for stale hint). */
  isDraftDirty: (draft: TDraft, applied: TDraft | null) => boolean;
  fetch: (draft: TDraft) => Promise<TData>;
  /** Build URLSearchParams from draft; q=1 added automatically on search success. */
  buildUrlParams: (draft: TDraft) => URLSearchParams;
  /** Base path for router.replace after search (omit to skip URL sync). */
  syncUrlPath?: string;
  /** When false, never sync URL (embedded instances). */
  syncUrl?: boolean;
}

export interface UseReportQueryResult<TDraft, TData> {
  draft: TDraft;
  setDraft: React.Dispatch<React.SetStateAction<TDraft>>;
  applied: TDraft | null;
  data: TData | null;
  loading: boolean;
  error: string | null;
  hasQueried: boolean;
  filtersDirty: boolean;
  search: () => Promise<void>;
  /** Re-run fetch with optional draft; keeps URL sync when enabled. */
  refetch: (draft?: TDraft) => Promise<void>;
}

export function useReportQuery<TDraft, TData>({
  initialDraft,
  isDraftDirty,
  fetch,
  buildUrlParams,
  syncUrlPath,
  syncUrl = true,
}: UseReportQueryOptions<TDraft, TData>): UseReportQueryResult<TDraft, TData> {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState<TDraft>(initialDraft);
  const [applied, setApplied] = useState<TDraft | null>(null);
  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasQueried, setHasQueried] = useState(false);
  const autoRan = useRef(false);

  const runSearch = useCallback(
    async (nextDraft: TDraft) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetch(nextDraft);
        setData(result);
        setApplied(nextDraft);
        setHasQueried(true);

        if (syncUrl && syncUrlPath) {
          const params = withReportQueryFlag(buildUrlParams(nextDraft));
          router.replace(`${syncUrlPath}?${params.toString()}`, {
            scroll: false,
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        setLoading(false);
      }
    },
    [buildUrlParams, fetch, router, syncUrl, syncUrlPath]
  );

  const search = useCallback(async () => {
    await runSearch(draft);
  }, [draft, runSearch]);

  const refetch = useCallback(
    async (nextDraft?: TDraft) => {
      await runSearch(nextDraft ?? draft);
    },
    [draft, runSearch]
  );

  useEffect(() => {
    if (autoRan.current) return;
    if (!isReportQueryRequested(searchParams)) return;
    autoRan.current = true;
    void runSearch(initialDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- S2: auto-query once when q=1 on mount
  }, []);

  const filtersDirty =
    hasQueried && applied !== null && isDraftDirty(draft, applied);

  return {
    draft,
    setDraft,
    applied,
    data,
    loading,
    error,
    hasQueried,
    filtersDirty,
    search,
    refetch,
  };
}
