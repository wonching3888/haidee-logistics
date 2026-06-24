"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DataFreshnessScope } from "@/lib/data-freshness/types";

const DEFAULT_POLL_INTERVAL_MS = 60_000;

export interface UseDataFreshnessOptions {
  scope: DataFreshnessScope;
  params: Record<string, string | undefined>;
  enabled?: boolean;
  pollIntervalMs?: number;
  onRefresh: () => void | Promise<void>;
}

export interface UseDataFreshnessResult {
  lastLoadedAt: Date | null;
  hasNewData: boolean;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
}

function serializeFingerprint(value: unknown): string {
  return JSON.stringify(value);
}

function buildQueryString(
  scope: DataFreshnessScope,
  params: Record<string, string | undefined>
): string {
  const search = new URLSearchParams({ scope });
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (value !== undefined && value !== "") {
      search.set(key, value);
    }
  }
  return search.toString();
}

function paramsSignature(params: Record<string, string | undefined>): string {
  return JSON.stringify(
    Object.keys(params)
      .sort()
      .map((key) => [key, params[key] ?? ""] as const)
  );
}

export function useDataFreshness({
  scope,
  params,
  enabled = true,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  onRefresh,
}: UseDataFreshnessOptions): UseDataFreshnessResult {
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [hasNewData, setHasNewData] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const baselineRef = useRef<string | null>(null);
  const signature = paramsSignature(params);
  const paramsKey = useMemo(
    () => buildQueryString(scope, params),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable via signature
    [scope, signature]
  );

  const fetchFingerprint = useCallback(async () => {
    try {
      const response = await fetch(`/api/data-freshness?${paramsKey}`, {
        cache: "no-store",
      });
      if (!response.ok) return null;
      const data = (await response.json()) as { fingerprint?: unknown };
      return data.fingerprint ?? null;
    } catch {
      return null;
    }
  }, [paramsKey]);

  const captureBaseline = useCallback(async () => {
    const fingerprint = await fetchFingerprint();
    if (!fingerprint) return false;
    baselineRef.current = serializeFingerprint(fingerprint);
    setLastLoadedAt(new Date());
    return true;
  }, [fetchFingerprint]);

  useEffect(() => {
    if (!enabled) {
      baselineRef.current = null;
      setHasNewData(false);
      setLastLoadedAt(null);
      return;
    }

    let cancelled = false;
    setHasNewData(false);

    void (async () => {
      const ok = await captureBaseline();
      if (cancelled || !ok) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, paramsKey, captureBaseline]);

  useEffect(() => {
    if (!enabled) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      if (document.hidden || !baselineRef.current) return;
      const fingerprint = await fetchFingerprint();
      if (!fingerprint) return;
      const serialized = serializeFingerprint(fingerprint);
      if (serialized !== baselineRef.current) {
        setHasNewData(true);
      }
    };

    const stop = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const start = () => {
      stop();
      intervalId = setInterval(() => {
        void poll();
      }, pollIntervalMs);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
        return;
      }
      void poll();
      start();
    };

    if (!document.hidden) {
      start();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, paramsKey, pollIntervalMs, fetchFingerprint]);

  const refresh = useCallback(async () => {
    if (!enabled || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
      const fingerprint = await fetchFingerprint();
      if (fingerprint) {
        baselineRef.current = serializeFingerprint(fingerprint);
        setHasNewData(false);
        setLastLoadedAt(new Date());
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [enabled, isRefreshing, onRefresh, fetchFingerprint]);

  return {
    lastLoadedAt,
    hasNewData,
    isRefreshing,
    refresh,
  };
}
