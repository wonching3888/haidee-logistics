"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInputField } from "@/components/shared/DateInputField";
import {
  defaultHistoryDateRange,
  normalizeVoucherListItem,
  parseDriverExpensesTab,
  type DriverExpensesTab,
  type DriverVoucherListItem,
} from "@/lib/driver-expense/voucher-list-types";
import type { StoredUserRole } from "@/types";
import { cn } from "@/lib/utils";
import {
  UnloadingFeesCollapsible,
  type UnloadingFeeRow,
} from "./UnloadingFeesCollapsible";
import { VoucherHistoryPanel, type HistoryFilters } from "./VoucherHistoryPanel";
import { VoucherTodayPanel } from "./VoucherTodayPanel";

const DRIVER_EXPENSES_CACHE_KEY = "driver-expenses:search-state:v2";

interface DispatchOption {
  id: string;
  lorry: string;
  driver: string;
  route: string;
}

interface DriverExpensesClientProps {
  initialDate: string;
  userRole: StoredUserRole;
}

function ModuleCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-haidee-border bg-white shadow-sm">
      <header className="border-b border-haidee-border bg-haidee-surface/40 px-4 py-3">
        <h3 className="font-semibold text-haidee-text">{title}</h3>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function parseHistoryFilters(
  searchParams: URLSearchParams,
  fallbackDate: string
): HistoryFilters {
  const defaults = defaultHistoryDateRange(fallbackDate);
  return {
    from: searchParams.get("from") ?? defaults.from,
    to: searchParams.get("to") ?? defaults.to,
    status: searchParams.get("status") ?? "",
    q: searchParams.get("q") ?? "",
    pendingOnly: searchParams.get("pending") === "1",
  };
}

export function DriverExpensesClient({
  initialDate,
  userRole,
}: DriverExpensesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdmin = userRole === "admin";
  const canCreate = userRole !== "thai_accounting";

  const [tab, setTab] = useState<DriverExpensesTab>(() =>
    parseDriverExpensesTab(searchParams.get("tab"))
  );
  const [date, setDate] = useState(initialDate);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [unloadingFees, setUnloadingFees] = useState<UnloadingFeeRow[]>([]);
  const [todayVouchers, setTodayVouchers] = useState<DriverVoucherListItem[]>([]);
  const [historyVouchers, setHistoryVouchers] = useState<DriverVoucherListItem[]>(
    []
  );
  const [historyFilters, setHistoryFilters] = useState<HistoryFilters>(() =>
    parseHistoryFilters(searchParams, initialDate)
  );
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [dispatches, setDispatches] = useState<DispatchOption[]>([]);
  const [loadingToday, setLoadingToday] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const historyInitialLoaded = useRef(false);

  const hasLoadedToday = loadedDate === date;

  const syncUrl = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") params.delete(key);
        else params.set(key, value);
      }
      router.replace(`/documents/driver-expenses?${params.toString()}`);
    },
    [router, searchParams]
  );

  const persistTodayCache = useCallback(
    (targetDate: string, payload: {
      unloadingFees: UnloadingFeeRow[];
      vouchers: DriverVoucherListItem[];
      dispatches: DispatchOption[];
    }) => {
      if (typeof window === "undefined") return;
      window.sessionStorage.setItem(
        DRIVER_EXPENSES_CACHE_KEY,
        JSON.stringify({ date: targetDate, ...payload })
      );
    },
    []
  );

  const loadToday = useCallback(
    async (targetDate: string, options?: { skipCache?: boolean }) => {
      setLoadingToday(true);
      setError(null);
      try {
        const qs = new URLSearchParams({
          startDate: targetDate,
          endDate: targetDate,
        });
        const [unloadingRes, voucherRes, dispatchRes] = await Promise.all([
          fetch(`/api/unloading-fees?${qs}`),
          fetch(`/api/driver-vouchers?${qs}`),
          fetch(`/api/driver-expenses/dispatches?date=${targetDate}`),
        ]);

        if (!unloadingRes.ok || !voucherRes.ok) {
          throw new Error("加载失败 Failed to load data");
        }

        const [unloadingData, voucherData, dispatchData] = await Promise.all([
          unloadingRes.json() as Promise<{ fees?: UnloadingFeeRow[] }>,
          voucherRes.json() as Promise<{ vouchers?: DriverVoucherListItem[] }>,
          dispatchRes.ok
            ? (dispatchRes.json() as Promise<{ dispatches?: DispatchOption[] }>)
            : Promise.resolve({ dispatches: [] }),
        ]);

        const fees = unloadingData.fees ?? [];
        const vouchers = (voucherData.vouchers ?? []).map(normalizeVoucherListItem);
        const dispatchList = dispatchData.dispatches ?? [];

        setUnloadingFees(fees);
        setTodayVouchers(vouchers);
        setDispatches(dispatchList);
        setLoadedDate(targetDate);
        persistTodayCache(targetDate, {
          unloadingFees: fees,
          vouchers,
          dispatches: dispatchList,
        });

        if (options?.skipCache) {
          syncUrl({ refresh: null });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        setLoadingToday(false);
      }
    },
    [persistTodayCache, syncUrl]
  );

  const loadHistory = useCallback(
    async (filters: HistoryFilters) => {
      setLoadingHistory(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (filters.pendingOnly) {
          qs.set("status", "pending_review");
        } else {
          if (filters.from) qs.set("startDate", filters.from);
          if (filters.to) qs.set("endDate", filters.to);
          if (filters.status) qs.set("status", filters.status);
        }
        if (filters.q.trim()) qs.set("q", filters.q.trim());

        const res = await fetch(`/api/driver-vouchers?${qs}`);
        if (!res.ok) throw new Error("加载失败 Failed to load history");
        const data = (await res.json()) as { vouchers?: DriverVoucherListItem[] };
        setHistoryVouchers((data.vouchers ?? []).map(normalizeVoucherListItem));
        setHistoryLoaded(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        setLoadingHistory(false);
      }
    },
    []
  );

  const loadPendingCount = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch("/api/driver-vouchers/pending-count");
      if (!res.ok) return;
      const data = (await res.json()) as { count?: number };
      setPendingCount(data.count ?? 0);
    } catch {
      // ignore
    }
  }, [isAdmin]);

  useEffect(() => {
    setDate(initialDate);
  }, [initialDate]);

  useEffect(() => {
    const nextTab = parseDriverExpensesTab(searchParams.get("tab"));
    setTab(nextTab);
    setHistoryFilters(parseHistoryFilters(searchParams, date));
  }, [searchParams, date]);

  useEffect(() => {
    if (searchParams.get("refresh") === "1") {
      void loadToday(date, { skipCache: true });
    }
  }, [searchParams, date, loadToday]);

  useEffect(() => {
    if (searchParams.get("refresh") === "1") return;
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(DRIVER_EXPENSES_CACHE_KEY);
    if (!raw) return;
    try {
      const cached = JSON.parse(raw) as {
        date?: string;
        unloadingFees?: UnloadingFeeRow[];
        vouchers?: DriverVoucherListItem[];
        dispatches?: DispatchOption[];
      };
      if (cached.date !== date) return;
      setUnloadingFees(cached.unloadingFees ?? []);
      setTodayVouchers(cached.vouchers ?? []);
      setDispatches(cached.dispatches ?? []);
      setLoadedDate(cached.date ?? null);
    } catch {
      // ignore
    }
  }, [date, searchParams]);

  useEffect(() => {
    if (tab !== "history") {
      historyInitialLoaded.current = false;
      return;
    }
    if (historyInitialLoaded.current) return;
    historyInitialLoaded.current = true;
    const filters = parseHistoryFilters(searchParams, date);
    setHistoryFilters(filters);
    void loadHistory(filters);
    void loadPendingCount();
  }, [tab, searchParams, date, loadHistory, loadPendingCount]);

  function updateDate(next: string) {
    setDate(next);
    setLoadedDate(null);
    syncUrl({ date: next, tab: "today" });
  }

  function switchTab(next: DriverExpensesTab) {
    setTab(next);
    syncUrl({ tab: next });
  }

  function handleTodaySearch() {
    void loadToday(date);
  }

  function handleHistorySearch() {
    syncUrl({
      tab: "history",
      from: historyFilters.pendingOnly ? null : historyFilters.from,
      to: historyFilters.pendingOnly ? null : historyFilters.to,
      status: historyFilters.pendingOnly ? null : historyFilters.status || null,
      q: historyFilters.q.trim() || null,
      pending: historyFilters.pendingOnly ? "1" : null,
    });
    void loadHistory(historyFilters);
    void loadPendingCount();
  }

  function handlePendingShortcut() {
    const next: HistoryFilters = {
      ...historyFilters,
      pendingOnly: !historyFilters.pendingOnly,
      status: "pending_review",
    };
    setHistoryFilters(next);
    syncUrl({
      tab: "history",
      pending: next.pendingOnly ? "1" : null,
      from: null,
      to: null,
      status: null,
      q: historyFilters.q.trim() || null,
    });
    void loadHistory(next);
  }

  async function syncFees() {
    setSyncing(true);
    setError(null);
    try {
      let tripIds = dispatches.map((d) => d.id);
      if (tripIds.length === 0) {
        const res = await fetch(`/api/driver-expenses/dispatches?date=${date}`);
        if (res.ok) {
          const data = (await res.json()) as { dispatches?: DispatchOption[] };
          tripIds = (data.dispatches ?? []).map((d) => d.id);
          setDispatches(data.dispatches ?? []);
        }
      }
      await Promise.all(
        tripIds.map((tripId) =>
          fetch("/api/unloading-fees", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tripId, syncAll: true }),
          }).then(async (res) => {
            if (!res.ok) {
              const data = (await res.json()) as { error?: string };
              throw new Error(data.error ?? "同步失败");
            }
          })
        )
      );
      await loadToday(date);
    } catch (e) {
      setError(e instanceof Error ? e.message : "同步失败");
    } finally {
      setSyncing(false);
    }
  }

  async function patchUnloadingFee(
    id: string,
    field: "unloadFeeOverride" | "kpbFeeOverride",
    raw: string
  ) {
    const value = raw.trim() === "" ? null : Number(raw);
    if (value !== null && !Number.isFinite(value)) return;
    try {
      const res = await fetch(`/api/unloading-fees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error("保存失败");
      const data = (await res.json()) as { fee?: UnloadingFeeRow };
      if (data.fee) {
        setUnloadingFees((prev) => {
          const next = prev.map((row) =>
            row.id === id ? { ...row, ...data.fee! } : row
          );
          if (loadedDate) {
            persistTodayCache(loadedDate, {
              unloadingFees: next,
              vouchers: todayVouchers,
              dispatches,
            });
          }
          return next;
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  }

  const tabClass = (active: boolean) =>
    cn(
      "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
      active
        ? "border-haidee-blue text-haidee-blue"
        : "border-transparent text-haidee-muted hover:text-haidee-text"
    );

  return (
    <div className="space-y-6">
      {error && (
        <p className="no-print rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <ModuleCard title="Module 2 — Driver Voucher（司机报销单）">
        <div className="no-print mb-4 flex gap-1 border-b border-haidee-border">
          <button
            type="button"
            className={tabClass(tab === "today")}
            onClick={() => switchTab("today")}
          >
            当日 Today
          </button>
          <button
            type="button"
            className={tabClass(tab === "history")}
            onClick={() => switchTab("history")}
          >
            历史 History
          </button>
        </div>

        {tab === "today" && (
          <div className="no-print mb-4 flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">日期 Date</label>
              <DateInputField value={date} onChange={updateDate} />
            </div>
            <Button
              onClick={handleTodaySearch}
              disabled={loadingToday}
              className="gap-2 bg-haidee-blue text-white hover:bg-haidee-blue/90"
            >
              {loadingToday ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              查询 Search
            </Button>
            <Button
              onClick={() => startTransition(() => syncFees())}
              disabled={syncing || isPending || !hasLoadedToday}
              variant="outline"
              className="gap-2"
            >
              {syncing || isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              重新同步估算
            </Button>
          </div>
        )}

        {tab === "today" ? (
          <VoucherTodayPanel
            date={date}
            vouchers={todayVouchers}
            hasLoaded={hasLoadedToday}
            canCreate={canCreate}
          />
        ) : (
          <VoucherHistoryPanel
            filters={historyFilters}
            onFiltersChange={setHistoryFilters}
            vouchers={historyVouchers}
            loading={loadingHistory}
            hasLoaded={historyLoaded}
            isAdmin={isAdmin}
            pendingCount={pendingCount}
            onSearch={handleHistorySearch}
            onPendingShortcut={handlePendingShortcut}
          />
        )}
      </ModuleCard>

      <UnloadingFeesCollapsible
        date={date}
        fees={unloadingFees}
        hasLoaded={hasLoadedToday}
        onPatchFee={patchUnloadingFee}
      />
    </div>
  );
}
