"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInputField } from "@/components/shared/DateInputField";
import { useT } from "@/components/shared/locale-context";
import {
  buildExpenseTripRows,
  defaultHistoryDateRange,
  normalizeVoucherListItem,
  type DispatchOption,
  type DriverVoucherListItem,
} from "@/lib/driver-expense/voucher-list-types";
import type { DriverExpenseTodoItem } from "@/lib/driver-expense/todo-list";
import type { StoredUserRole } from "@/types";
import { canWriteDriverVoucher } from "@/lib/auth-roles";
import {
  UnloadingFeesCollapsible,
  type UnloadingFeeRow,
} from "./UnloadingFeesCollapsible";
import { VoucherHistoryPanel, type HistoryFilters } from "./VoucherHistoryPanel";
import { VoucherTodayPanel } from "./VoucherTodayPanel";
import { VoucherTodoPanel } from "./VoucherTodoPanel";

const DRIVER_EXPENSES_CACHE_KEY = "driver-expenses:search-state:v3";

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
    <section className="min-w-0 overflow-x-auto overflow-y-visible rounded-xl border border-haidee-border bg-white shadow-sm">
      <header className="border-b border-haidee-border bg-haidee-surface/40 px-4 py-3">
        <h3 className="font-semibold text-haidee-text">{title}</h3>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ZoneSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-b border-haidee-border pb-6 last:border-b-0 last:pb-0">
      <h4 className="text-sm font-semibold text-haidee-text">{title}</h4>
      {children}
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
  };
}

export function DriverExpensesClient({
  initialDate,
  userRole,
}: DriverExpensesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useT();
  const isAdmin = userRole === "admin";
  const canWrite = canWriteDriverVoucher(userRole);

  const [date, setDate] = useState(initialDate);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [unloadingFees, setUnloadingFees] = useState<UnloadingFeeRow[]>([]);
  const [todayVouchers, setTodayVouchers] = useState<DriverVoucherListItem[]>([]);
  const [todoItems, setTodoItems] = useState<DriverExpenseTodoItem[]>([]);
  const [historyVouchers, setHistoryVouchers] = useState<DriverVoucherListItem[]>(
    []
  );
  const [historyFilters, setHistoryFilters] = useState<HistoryFilters>(() =>
    parseHistoryFilters(searchParams, initialDate)
  );
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [todoLoaded, setTodoLoaded] = useState(false);
  const [dispatches, setDispatches] = useState<DispatchOption[]>([]);
  const [loadingToday, setLoadingToday] = useState(false);
  const [loadingTodo, setLoadingTodo] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const initialLoadsDone = useRef(false);

  const hasLoadedToday = loadedDate === date;
  const dispatchTrips = useMemo(
    () => buildExpenseTripRows(date, dispatches, todayVouchers),
    [date, dispatches, todayVouchers]
  );
  const sortedTodo = todoItems;

  const syncUrl = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") params.delete(key);
        else params.set(key, value);
      }
      params.delete("tab");
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
          throw new Error(t("driverExpenses.loadFailed"));
        }

        const [unloadingData, voucherData, dispatchData] = await Promise.all([
          unloadingRes.json() as Promise<{ fees?: UnloadingFeeRow[] }>,
          voucherRes.json() as Promise<{ vouchers?: DriverVoucherListItem[] }>,
          dispatchRes.ok
            ? (dispatchRes.json() as Promise<{
                dispatches?: DispatchOption[];
                trips?: DispatchOption[];
              }>)
            : Promise.resolve({ dispatches: [], trips: [] }),
        ]);

        const fees = unloadingData.fees ?? [];
        const vouchers = (voucherData.vouchers ?? []).map(normalizeVoucherListItem);
        const tripList =
          dispatchData.trips ??
          dispatchData.dispatches ??
          [];

        setUnloadingFees(fees);
        setTodayVouchers(vouchers);
        setDispatches(tripList);
        setLoadedDate(targetDate);
        persistTodayCache(targetDate, {
          unloadingFees: fees,
          vouchers,
          dispatches: tripList,
        });

        if (options?.skipCache) {
          syncUrl({ refresh: null });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : t("driverExpenses.loadFailed"));
      } finally {
        setLoadingToday(false);
      }
    },
    [persistTodayCache, syncUrl, t]
  );

  const loadTodo = useCallback(async () => {
    setLoadingTodo(true);
    setError(null);
    try {
      const res = await fetch("/api/driver-vouchers/todo");
      if (!res.ok) throw new Error(t("driverExpenses.loadFailed"));
      const data = (await res.json()) as {
        items?: DriverExpenseTodoItem[];
      };
      setTodoItems(data.items ?? []);
      setTodoLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("driverExpenses.loadFailed"));
    } finally {
      setLoadingTodo(false);
    }
  }, [t]);

  const loadHistory = useCallback(
    async (filters: HistoryFilters) => {
      setLoadingHistory(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (filters.from) qs.set("startDate", filters.from);
        if (filters.to) qs.set("endDate", filters.to);
        if (filters.status) qs.set("status", filters.status);
        if (filters.q.trim()) qs.set("q", filters.q.trim());

        const res = await fetch(`/api/driver-vouchers?${qs}`);
        if (!res.ok) throw new Error(t("driverExpenses.loadFailed"));
        const data = (await res.json()) as { vouchers?: DriverVoucherListItem[] };
        setHistoryVouchers((data.vouchers ?? []).map(normalizeVoucherListItem));
        setHistoryLoaded(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("driverExpenses.loadFailed"));
      } finally {
        setLoadingHistory(false);
      }
    },
    [t]
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

  const refreshAll = useCallback(async () => {
    const filters = parseHistoryFilters(searchParams, date);
    await Promise.all([
      loadToday(date, { skipCache: true }),
      loadTodo(),
      loadPendingCount(),
      historyLoaded ? loadHistory(filters) : Promise.resolve(),
    ]);
  }, [
    date,
    historyLoaded,
    loadHistory,
    loadPendingCount,
    loadToday,
    loadTodo,
    searchParams,
  ]);

  useEffect(() => {
    setDate(initialDate);
  }, [initialDate]);

  useEffect(() => {
    setHistoryFilters(parseHistoryFilters(searchParams, date));
  }, [searchParams, date]);

  useEffect(() => {
    if (searchParams.get("refresh") === "1") {
      initialLoadsDone.current = true;
      void refreshAll();
      return;
    }
    if (initialLoadsDone.current) return;
    initialLoadsDone.current = true;
    const filters = parseHistoryFilters(searchParams, date);
    void loadTodo();
    void loadPendingCount();
    void loadHistory(filters);
  }, [searchParams, date, refreshAll, loadTodo, loadPendingCount, loadHistory]);

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

  function updateDate(next: string) {
    setDate(next);
    setLoadedDate(null);
    syncUrl({ date: next });
  }

  function handleTodaySearch() {
    void loadToday(date);
  }

  function handleHistorySearch() {
    syncUrl({
      from: historyFilters.from,
      to: historyFilters.to,
      status: historyFilters.status || null,
      q: historyFilters.q.trim() || null,
    });
    void loadHistory(historyFilters);
  }

  async function syncFees() {
    setSyncing(true);
    setError(null);
    try {
      let tripIds = dispatches
        .filter((d) => (d.tripSource ?? "dispatch") === "dispatch")
        .map((d) => d.id);
      if (tripIds.length === 0) {
        const res = await fetch(`/api/driver-expenses/dispatches?date=${date}`);
        if (res.ok) {
          const data = (await res.json()) as {
            dispatches?: DispatchOption[];
            trips?: DispatchOption[];
          };
          const tripList = data.trips ?? data.dispatches ?? [];
          tripIds = tripList
            .filter((d) => (d.tripSource ?? "dispatch") === "dispatch")
            .map((d) => d.id);
          setDispatches(tripList);
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
              throw new Error(data.error ?? t("driverExpenses.syncFailed"));
            }
          })
        )
      );
      await loadToday(date);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("driverExpenses.syncFailed"));
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
      if (!res.ok) throw new Error(t("driverExpenses.saveFailed"));
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
      setError(e instanceof Error ? e.message : t("driverExpenses.saveFailed"));
    }
  }

  const tripIdsWithVoucher = useMemo(
    () => new Set(todayVouchers.map((voucher) => voucher.tripId)),
    [todayVouchers]
  );

  return (
    <div className="space-y-6">
      {error && (
        <p className="no-print rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <ModuleCard title={t("driverExpenses.module.voucher")}>
        <div className="no-print mb-6 flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">{t("common.date")}</label>
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
            {t("driverExpenses.search")}
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
            {t("driverExpenses.syncEstimates")}
          </Button>
        </div>

        <ZoneSection title={t("driverExpenses.zone.today")}>
          <VoucherTodayPanel
            date={date}
            trips={dispatchTrips}
            hasLoaded={hasLoadedToday}
            canWrite={canWrite}
            isAdmin={isAdmin}
          />
        </ZoneSection>

        <ZoneSection title={t("driverExpenses.zone.todo")}>
          <VoucherTodoPanel
            items={sortedTodo}
            loading={loadingTodo}
            hasLoaded={todoLoaded}
            canWrite={canWrite}
            isAdmin={isAdmin}
            pendingCount={pendingCount}
          />
        </ZoneSection>

        <ZoneSection title={t("driverExpenses.zone.history")}>
          <VoucherHistoryPanel
            filters={historyFilters}
            onFiltersChange={setHistoryFilters}
            vouchers={historyVouchers}
            loading={loadingHistory}
            hasLoaded={historyLoaded}
            isAdmin={isAdmin}
            onSearch={handleHistorySearch}
          />
        </ZoneSection>
      </ModuleCard>

      <UnloadingFeesCollapsible
        date={date}
        fees={unloadingFees}
        hasLoaded={hasLoadedToday}
        tripIdsWithVoucher={tripIdsWithVoucher}
        onPatchFee={patchUnloadingFee}
      />
    </div>
  );
}
