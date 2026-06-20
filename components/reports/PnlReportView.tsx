"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  PnlCustomerData,
  PnlCustomerMarketRow,
  PnlPeriodData,
  PnlPeriodMode,
  PnlRouteFilter,
  PnlTripListItem,
  PnlTripRow,
  PnlTripsListData,
} from "@/lib/pnl-report-types";
import {
  type PnlCustomerSort,
  type PnlCustomerSortDir,
  type PnlCustomerStatus,
} from "@/lib/pnl-report-types";
import { cn } from "@/lib/utils";
import TripPnlFilter, {
  type TripPnlFilterValues,
} from "./TripPnlFilter";
import {
  buildPnlTripsApiSearchParams,
} from "@/lib/pnl-trip-search-params";
import { ReportFiltersChangedHint } from "@/components/shared/ReportFiltersChangedHint";
import {
  isReportQueryRequested,
  withReportQueryFlag,
} from "@/lib/reports/report-query-params";

const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => 2020 + i);
type PnlTab = "trip" | "period" | "customer";

const PNL_TABLE_CLASS = "whitespace-nowrap [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap";

function getTodayDateInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatMyr(value: number) {
  return value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}

const STATUS_LABELS: Record<
  PnlCustomerStatus,
  { label: string; className: string }
> = {
  excellent: {
    label: "优质",
    className: "bg-emerald-100 text-emerald-800",
  },
  normal: {
    label: "一般",
    className: "bg-amber-100 text-amber-900",
  },
  caution: {
    label: "注意",
    className: "bg-orange-100 text-orange-900",
  },
  loss: {
    label: "亏损",
    className: "bg-red-100 text-red-800",
  },
};

function PnlTrendChart({
  points,
}: {
  points: PnlPeriodData["periodSummary"]["trend"];
}) {
  if (points.length === 0) {
    return (
      <p className="text-sm text-haidee-muted">暂无趋势数据 No trend data</p>
    );
  }

  const width = 720;
  const height = 220;
  const pad = 28;
  const maxValue = Math.max(
    ...points.flatMap((p) => [p.revenueMyr, p.costMyr, p.profitMyr]),
    1
  );

  const x = (index: number) =>
    pad + (index / Math.max(points.length - 1, 1)) * (width - pad * 2);
  const y = (value: number) =>
    height - pad - (value / maxValue) * (height - pad * 2);

  const toPath = (key: "revenueMyr" | "costMyr" | "profitMyr") =>
    points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point[key])}`)
      .join(" ");

  return (
    <div className="overflow-x-auto rounded-xl border border-haidee-border bg-white p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full min-w-[560px]">
        <path d={toPath("revenueMyr")} fill="none" stroke="#059669" strokeWidth="2" />
        <path d={toPath("costMyr")} fill="none" stroke="#dc2626" strokeWidth="2" />
        <path d={toPath("profitMyr")} fill="none" stroke="#2563eb" strokeWidth="2" />
      </svg>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-haidee-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-6 rounded bg-emerald-600" />
          收入 Revenue
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-6 rounded bg-red-600" />
          成本 Cost
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-6 rounded bg-haidee-blue" />
          毛利 Profit
        </span>
      </div>
    </div>
  );
}

interface PnlReportViewProps {
  initialYear: number;
  initialMonth: number;
  initialDay: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const raw = await res.text();
  let body: (T & { error?: string }) | null = null;
  try {
    body = raw ? (JSON.parse(raw) as T & { error?: string }) : null;
  } catch {
    const fallback = raw.trim() || `HTTP ${res.status}`;
    throw new Error(`API 返回非 JSON：${fallback}`);
  }
  if (!res.ok) {
    throw new Error(body?.error ?? "加载失败");
  }
  if (!body) {
    throw new Error("API 返回空响应");
  }
  return body;
}

export function PnlReportView({
  initialYear,
  initialMonth,
  initialDay,
}: PnlReportViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<PnlTab>("trip");
  const [tripDraft, setTripDraft] = useState<TripPnlFilterValues>({
    year: initialYear,
    month: initialMonth,
    route: "ALL",
    driver: "ALL",
    date: "",
  });
  const [tripApplied, setTripApplied] = useState<TripPnlFilterValues | null>(
    null
  );
  const tripAutoRan = useRef(false);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [periodMode, setPeriodMode] = useState<PnlPeriodMode>("month");
  const [periodDay, setPeriodDay] = useState(initialDay);
  const [rangeStart, setRangeStart] = useState(initialDay);
  const [rangeEnd, setRangeEnd] = useState(initialDay);
  const [customerSort, setCustomerSort] = useState<PnlCustomerSort>("profit");
  const [customerSortDir, setCustomerSortDir] =
    useState<PnlCustomerSortDir>("desc");

  const [tripsData, setTripsData] = useState<PnlTripsListData | null>(null);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [expandedTripIds, setExpandedTripIds] = useState<Set<string>>(new Set());
  const [tripDetails, setTripDetails] = useState<Record<string, PnlTripRow>>({});
  const [loadingTripIds, setLoadingTripIds] = useState<Set<string>>(new Set());

  const [periodData, setPeriodData] = useState<PnlPeriodData | null>(null);
  const [periodLoading, setPeriodLoading] = useState(false);

  const [customerData, setCustomerData] = useState<PnlCustomerData | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [expandedCustomerIds, setExpandedCustomerIds] = useState<Set<string>>(
    new Set()
  );
  const [customerMarkets, setCustomerMarkets] = useState<
    Record<string, PnlCustomerMarketRow[]>
  >({});
  const [loadingCustomerIds, setLoadingCustomerIds] = useState<Set<string>>(
    new Set()
  );

  const [error, setError] = useState<string | null>(null);

  const loadTrips = useCallback(
    async (filters: TripPnlFilterValues) => {
      const searchRoute = (filters.route || "ALL") as PnlRouteFilter;
      const searchDriver = filters.driver || "ALL";
      const searchDay = filters.date || "";

      setTripsLoading(true);
      setError(null);
      try {
        const params = buildPnlTripsApiSearchParams({
          year: filters.year,
          month: filters.month,
          routeFilter: searchRoute,
          driverFilter: searchDriver,
          tripDay: searchDay,
        });
        const data = await fetchJson<PnlTripsListData>(
          `/api/pnl/trips?${params}`
        );
        setTripsData(data);
        setExpandedTripIds(new Set());
        setTripDetails({});
        setTripApplied(filters);

        const urlParams = withReportQueryFlag(
          new URLSearchParams({
            year: String(filters.year),
            month: String(filters.month),
          })
        );
        router.replace(`/reports/pnl?${urlParams.toString()}`, {
          scroll: false,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        setTripsLoading(false);
      }
    },
    [router]
  );

  const runTripSearch = useCallback(() => {
    void loadTrips(tripDraft);
  }, [loadTrips, tripDraft]);

  useEffect(() => {
    if (tripAutoRan.current) return;
    if (!isReportQueryRequested(searchParams)) return;
    tripAutoRan.current = true;
    void loadTrips(tripDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- S2: auto-query once when q=1
  }, []);

  async function loadTripDetail(tripId: string) {
    if (tripDetails[tripId]) return;

    setLoadingTripIds((prev) => new Set(prev).add(tripId));
    setError(null);
    try {
      const applied = tripApplied ?? tripDraft;
      const params = new URLSearchParams({
        year: String(applied.year),
        month: String(applied.month),
      });
      const detail = await fetchJson<PnlTripRow>(
        `/api/pnl/trip/${tripId}?${params}`
      );
      setTripDetails((prev) => ({ ...prev, [tripId]: detail }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载趟次详情失败");
      setExpandedTripIds((prev) => {
        const next = new Set(prev);
        next.delete(tripId);
        return next;
      });
    } finally {
      setLoadingTripIds((prev) => {
        const next = new Set(prev);
        next.delete(tripId);
        return next;
      });
    }
  }

  async function toggleTripExpand(tripId: string) {
    const next = new Set(expandedTripIds);
    if (next.has(tripId)) {
      next.delete(tripId);
      setExpandedTripIds(next);
      return;
    }
    next.add(tripId);
    setExpandedTripIds(next);
    await loadTripDetail(tripId);
  }

  async function loadCustomerMarkets(shipperId: string) {
    if (customerMarkets[shipperId]) return;

    setLoadingCustomerIds((prev) => new Set(prev).add(shipperId));
    setError(null);
    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
      });
      const data = await fetchJson<{ markets: PnlCustomerMarketRow[] }>(
        `/api/pnl/customers/${shipperId}/markets?${params}`
      );
      setCustomerMarkets((prev) => ({
        ...prev,
        [shipperId]: data.markets,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载市场明细失败");
      setExpandedCustomerIds((prev) => {
        const next = new Set(prev);
        next.delete(shipperId);
        return next;
      });
    } finally {
      setLoadingCustomerIds((prev) => {
        const next = new Set(prev);
        next.delete(shipperId);
        return next;
      });
    }
  }

  async function toggleCustomerExpand(shipperId: string) {
    const next = new Set(expandedCustomerIds);
    if (next.has(shipperId)) {
      next.delete(shipperId);
      setExpandedCustomerIds(next);
      return;
    }
    next.add(shipperId);
    setExpandedCustomerIds(next);
    await loadCustomerMarkets(shipperId);
  }

  async function loadPeriod() {
    setPeriodLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
        periodMode,
      });
      if (periodMode === "day") params.set("day", periodDay);
      if (periodMode === "range") {
        params.set("rangeStart", rangeStart);
        params.set("rangeEnd", rangeEnd);
      }
      const data = await fetchJson<PnlPeriodData>(
        `/api/pnl/period?${params}`
      );
      setPeriodData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setPeriodLoading(false);
    }
  }

  async function loadCustomers() {
    setCustomerLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
        customerSort,
        customerSortDir,
      });
      const data = await fetchJson<PnlCustomerData>(
        `/api/pnl/customers?${params}`
      );
      setCustomerData(data);
      setExpandedCustomerIds(new Set());
      setCustomerMarkets({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setCustomerLoading(false);
    }
  }

  const trips = tripsData?.trips ?? [];
  const totals = tripsData?.totals;
  const appliedTripDay = tripApplied?.date ?? "";
  const isTodayView = appliedTripDay === getTodayDateInput();
  const emptyTripMessage = isTodayView
    ? "今日暂无趟次记录"
    : appliedTripDay
      ? "该日暂无趟次记录"
      : "暂无趟次数据";

  const tripFiltersDirty =
    tripApplied !== null &&
    (tripDraft.year !== tripApplied.year ||
      tripDraft.month !== tripApplied.month ||
      tripDraft.route !== tripApplied.route ||
      tripDraft.driver !== tripApplied.driver ||
      tripDraft.date !== tripApplied.date);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-haidee-border">
        {[
          { id: "trip" as const, label: "趟次损益 Trip P&L" },
          { id: "period" as const, label: "时间汇总 Period Summary" },
          { id: "customer" as const, label: "顾客分析 Customer Analysis" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "border-haidee-blue text-haidee-blue"
                : "border-transparent text-haidee-muted hover:text-haidee-text"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {activeTab === "trip" && (
        <div className="space-y-4">
          <p className="text-sm text-haidee-muted">
            年份+月份 = 查整月趟次；加选日期 = 只看当日；路线/司机 = 进一步筛选
          </p>
          <TripPnlFilter
            values={tripDraft}
            drivers={tripsData?.drivers ?? []}
            loading={tripsLoading}
            onChange={(patch) =>
              setTripDraft((prev) => ({ ...prev, ...patch }))
            }
            onSearch={runTripSearch}
          />

          <ReportFiltersChangedHint show={tripFiltersDirty} />

          {tripsLoading && !tripsData ? (
            <LoadingState />
          ) : !tripsData ? (
            <p className="text-sm text-haidee-muted">
              请选择筛选条件后点击「查询 Search」加载数据
            </p>
          ) : (
            <ScrollMatrixTable heightOffset={300}>
              <Table className={PNL_TABLE_CLASS}>
                <TableHeader>
                  <TableRow>
                    <TableHead />
                    <TableHead>日期 Date</TableHead>
                    <TableHead>路线 Route</TableHead>
                    <TableHead>司机 Driver</TableHead>
                    <TableHead>车牌 Plate</TableHead>
                    <TableHead className="text-right">总桶数</TableHead>
                    <TableHead className="text-right">总收入 MYR</TableHead>
                    <TableHead className="text-right">直接成本</TableHead>
                    <TableHead className="text-right">分摊成本</TableHead>
                    <TableHead className="text-right">总成本</TableHead>
                    <TableHead className="text-right">毛利 MYR</TableHead>
                    <TableHead className="text-right">毛利率%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trips.map((trip) => (
                    <TripListRow
                      key={trip.tripId}
                      trip={trip}
                      expanded={expandedTripIds.has(trip.tripId)}
                      loading={loadingTripIds.has(trip.tripId)}
                      detail={tripDetails[trip.tripId]}
                      onToggle={() => void toggleTripExpand(trip.tripId)}
                    />
                  ))}
                  {trips.length === 0 && !tripsLoading && (
                    <TableRow>
                      <TableCell
                        colSpan={12}
                        className="py-8 text-center text-haidee-muted"
                      >
                        {emptyTripMessage}
                      </TableCell>
                    </TableRow>
                  )}
                  {totals && trips.length > 0 && (
                    <TableRow className="bg-slate-100 font-semibold">
                      <TableCell />
                      <TableCell colSpan={4}>
                        {appliedTripDay ? "当日合计 Day Total" : "当月合计 Month Total"}
                      </TableCell>
                      <TableCell className="text-right">
                        {totals.totalQuantity}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMyr(totals.revenueMyr)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMyr(totals.directCostMyr)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMyr(totals.allocatedCostMyr)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMyr(totals.totalCostMyr)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMyr(totals.grossProfitMyr)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPct(totals.marginPct)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollMatrixTable>
          )}
        </div>
      )}

      {activeTab === "period" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <FilterSelect
              label="模式 Mode"
              value={periodMode}
              onChange={(value) => setPeriodMode(value as PnlPeriodMode)}
              options={[
                { value: "day", label: "当日 Day" },
                { value: "range", label: "日期范围 Range" },
                { value: "month", label: "月度 Month" },
                { value: "year", label: "年度 Year" },
              ]}
            />
            {periodMode === "day" && (
              <FilterInput
                label="日期 Date"
                type="date"
                value={periodDay}
                onChange={setPeriodDay}
              />
            )}
            {periodMode === "range" && (
              <>
                <FilterInput
                  label="开始 Start"
                  type="date"
                  value={rangeStart}
                  onChange={setRangeStart}
                />
                <FilterInput
                  label="结束 End"
                  type="date"
                  value={rangeEnd}
                  onChange={setRangeEnd}
                />
              </>
            )}
            {periodMode === "month" && (
              <FilterYearMonth
                year={year}
                month={month}
                onYearChange={setYear}
                onMonthChange={setMonth}
              />
            )}
            {periodMode === "year" && (
              <FilterSelect
                label="年份 Year"
                value={String(year)}
                onChange={(value) => setYear(Number(value))}
                options={YEAR_OPTIONS.map((y) => ({
                  value: String(y),
                  label: String(y),
                }))}
              />
            )}
            <SearchButton onClick={loadPeriod} loading={periodLoading} />
          </div>

          {periodLoading && <LoadingState />}
          {!periodLoading && !periodData && (
            <p className="text-sm text-haidee-muted">
              请选择筛选条件后点击「查询」加载数据
            </p>
          )}
          {periodData && !periodLoading && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <SummaryCard
                  label="总收入 Total Revenue"
                  value={`${formatMyr(periodData.periodSummary.revenueMyr)} MYR`}
                />
                <SummaryCard
                  label="总成本 Total Cost"
                  value={`${formatMyr(periodData.periodSummary.costMyr)} MYR`}
                />
                <SummaryCard
                  label="毛利 Gross Profit"
                  value={`${formatMyr(periodData.periodSummary.grossProfitMyr)} MYR`}
                />
                <SummaryCard
                  label="毛利率 Margin"
                  value={formatPct(periodData.periodSummary.marginPct)}
                />
                <SummaryCard
                  label="总趟次 Trips"
                  value={String(periodData.periodSummary.tripCount)}
                />
                <SummaryCard
                  label="总桶数 Crates"
                  value={String(periodData.periodSummary.totalQuantity)}
                />
              </div>
              {periodData.periodSummary.fleetPayrollTotalMyr != null &&
                periodData.periodSummary.netProfitAfterFleetPayrollMyr != null && (
                  <section className="rounded-xl border-2 border-slate-300 bg-slate-50/80 p-5">
                    <h4 className="text-sm font-semibold text-haidee-text">
                      参考指标 Reference Metric
                    </h4>
                    <p className="mt-1 text-xs text-haidee-muted">
                      含全月车队薪资（底薪 + EPF/SOCSO/EIS 雇主供款等），非按趟分摊。此为毛利与全月薪资的简单相减参考值，不影响上方毛利及趟次/顾客分析口径。
                    </p>
                    <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                      <div>
                        <dt className="text-sm text-haidee-muted">
                          车队全月薪资 Fleet Payroll (month)
                        </dt>
                        <dd className="mt-1 font-mono text-lg font-semibold text-haidee-text">
                          {formatMyr(periodData.periodSummary.fleetPayrollTotalMyr)} MYR
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-sm text-haidee-muted">
                          净利润（扣除车队薪资）Net Profit (After Fleet Payroll)
                        </dt>
                        <dd className="mt-1 font-mono text-2xl font-bold text-haidee-navy">
                          {formatMyr(
                            periodData.periodSummary.netProfitAfterFleetPayrollMyr
                          )}{" "}
                          MYR
                        </dd>
                        <dd className="mt-1 text-xs text-haidee-muted">
                          = 毛利 {formatMyr(periodData.periodSummary.grossProfitMyr)} −
                          车队薪资{" "}
                          {formatMyr(periodData.periodSummary.fleetPayrollTotalMyr)}
                        </dd>
                      </div>
                    </dl>
                  </section>
                )}
              <PnlTrendChart points={periodData.periodSummary.trend} />
            </>
          )}
        </div>
      )}

      {activeTab === "customer" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <FilterYearMonth
              year={year}
              month={month}
              onYearChange={setYear}
              onMonthChange={setMonth}
            />
            <FilterSelect
              label="排序 Sort"
              value={customerSort}
              onChange={(value) => setCustomerSort(value as PnlCustomerSort)}
              options={[
                { value: "profit", label: "按毛利 Profit" },
                { value: "quantity", label: "按桶数 Quantity" },
                { value: "revenue", label: "按收入 Revenue" },
                { value: "margin", label: "按毛利率% Margin %" },
              ]}
            />
            <FilterSelect
              label="顺序 Order"
              value={customerSortDir}
              onChange={(value) =>
                setCustomerSortDir(value as PnlCustomerSortDir)
              }
              options={[
                { value: "desc", label: "降序 Desc" },
                { value: "asc", label: "升序 Asc" },
              ]}
            />
            <SearchButton onClick={loadCustomers} loading={customerLoading} />
          </div>

          {customerLoading && <LoadingState />}
          {!customerLoading && !customerData && (
            <p className="text-sm text-haidee-muted">
              请选择筛选条件后点击「查询」加载数据
            </p>
          )}
          {customerData && !customerLoading && (
            <>
              <ScrollMatrixTable heightOffset={300}>
                <Table className={PNL_TABLE_CLASS}>
                  <TableHeader>
                    <TableRow>
                      <TableHead />
                      <TableHead>寄货人</TableHead>
                      <TableHead className="text-right">总桶数</TableHead>
                      <TableHead className="text-right">总收入 MYR</TableHead>
                      <TableHead className="text-right">直接成本</TableHead>
                      <TableHead className="text-right">分摊成本</TableHead>
                      <TableHead className="text-right">总成本</TableHead>
                      <TableHead className="text-right">毛利 MYR</TableHead>
                      <TableHead className="text-right">每桶毛利</TableHead>
                      <TableHead className="text-right">毛利率%</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerData.customers.map((customer) => (
                      <CustomerListRow
                        key={customer.shipperId}
                        customer={customer}
                        expanded={expandedCustomerIds.has(customer.shipperId)}
                        loading={loadingCustomerIds.has(customer.shipperId)}
                        markets={customerMarkets[customer.shipperId]}
                        onToggle={() =>
                          void toggleCustomerExpand(customer.shipperId)
                        }
                      />
                    ))}
                  </TableBody>
                </Table>
              </ScrollMatrixTable>

              <div className="rounded-xl border border-haidee-border bg-white p-4">
                <h3 className="text-lg font-semibold text-haidee-text">
                  建议 Suggestions
                </h3>
                {customerData.lossCustomers.length === 0 ? (
                  <p className="mt-2 text-sm text-haidee-muted">
                    当前筛选周期内暂无亏损或低毛利客户。
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2 text-sm">
                    {customerData.lossCustomers.map((item) => (
                      <li
                        key={item.shipperCode}
                        className="rounded-lg border border-haidee-border px-3 py-2"
                      >
                        <div className="font-medium">
                          {item.shipperName} ({item.shipperCode})
                        </div>
                        <div className="text-haidee-muted">
                          毛利 {formatMyr(item.grossProfitMyr)} · 毛利率{" "}
                          {formatPct(item.marginPct)}
                        </div>
                        <div>{item.message}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function VehicleCostRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <TableRow>
      <TableCell>{label}</TableCell>
      <TableCell className="text-right">{formatMyr(value)}</TableCell>
    </TableRow>
  );
}

function TripListRow({
  trip,
  expanded,
  loading,
  detail,
  onToggle,
}: {
  trip: PnlTripListItem;
  expanded: boolean;
  loading: boolean;
  detail?: PnlTripRow;
  onToggle: () => void;
}) {
  return (
    <Fragment>
      <TableRow>
        <TableCell>
          <button
            type="button"
            onClick={onToggle}
            className="text-haidee-blue"
            aria-label={expanded ? "收起寄货人明细" : "展开寄货人明细"}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </TableCell>
        <TableCell>{trip.date}</TableCell>
        <TableCell>{trip.route}</TableCell>
        <TableCell>{trip.driver ?? "—"}</TableCell>
        <TableCell>{trip.plate}</TableCell>
        <TableCell className="text-right">{trip.totalCrates}</TableCell>
        <TableCell className="text-right">{formatMyr(trip.revenueMyr)}</TableCell>
        <TableCell className="text-right">
          {formatMyr(trip.directCostMyr)}
        </TableCell>
        <TableCell className="text-right">
          {formatMyr(trip.allocatedCostMyr)}
        </TableCell>
        <TableCell className="text-right">{formatMyr(trip.totalCostMyr)}</TableCell>
        <TableCell className="text-right">
          {formatMyr(trip.grossProfitMyr)}
        </TableCell>
        <TableCell className="text-right">{formatPct(trip.marginPct)}</TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={12} className="bg-slate-50 p-0">
            {loading && !detail ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-haidee-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载寄货人明细…
              </div>
            ) : detail ? (
              <div className="space-y-4 overflow-x-auto p-4">
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-haidee-text">
                    车辆开销 Vehicle Costs
                  </h4>
                  <Table className={cn(PNL_TABLE_CLASS, "max-w-xl")}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>费用项目</TableHead>
                        <TableHead className="text-right">金额 (MYR)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <VehicleCostRow
                        label="油费 Fuel"
                        value={detail.vehicleCosts.fuelMyr}
                      />
                      <VehicleCostRow
                        label="维修/保险 Maintenance & Insurance"
                        value={detail.vehicleCosts.maintenanceMyr}
                      />
                      <VehicleCostRow
                        label="过路费 Toll"
                        value={detail.vehicleCosts.tollMyr}
                      />
                      <VehicleCostRow
                        label="Border Pass"
                        value={detail.vehicleCosts.borderPassMyr}
                      />
                      <VehicleCostRow
                        label="EPERMIT"
                        value={detail.vehicleCosts.epermitMyr}
                      />
                      <VehicleCostRow
                        label="Dagang Net"
                        value={detail.vehicleCosts.dagangNetMyr}
                      />
                      <VehicleCostRow
                        label="Forwarding (Zaewe)"
                        value={detail.vehicleCosts.forwardingMyr}
                      />
                      <VehicleCostRow
                        label="司机津贴 Driver Allowance"
                        value={detail.vehicleCosts.driverMyr}
                      />
                      <TableRow className="bg-slate-100 font-semibold">
                        <TableCell>合计 Total</TableCell>
                        <TableCell className="text-right">
                          {formatMyr(detail.vehicleCosts.totalMyr)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <Table className={PNL_TABLE_CLASS}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>寄货人</TableHead>
                      <TableHead className="text-right">桶数</TableHead>
                      <TableHead className="text-right">收入</TableHead>
                      <TableHead className="text-right">租桶费</TableHead>
                      <TableHead className="text-right">LKIM</TableHead>
                      <TableHead className="text-right">泰国段</TableHead>
                      <TableHead className="text-right">MC第三方车力</TableHead>
                      <TableHead className="text-right">下货费</TableHead>
                      <TableHead className="text-right">分摊油费</TableHead>
                      <TableHead className="text-right">分摊过路费</TableHead>
                      <TableHead className="text-right">分摊司机</TableHead>
                      <TableHead className="text-right">总成本</TableHead>
                      <TableHead className="text-right">毛利</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.shippers.map((shipper) => (
                      <TableRow key={shipper.shipperId}>
                        <TableCell>
                          {shipper.shipperName}
                          <div className="text-xs text-haidee-muted">
                            {shipper.shipperCode}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {shipper.quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(shipper.revenueMyr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(shipper.crateRentalMyr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(shipper.lkimMaqisMyr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(shipper.thaiSegmentMyr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(shipper.mcThirdPartyHaulageMyr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(shipper.unloadFeeMyr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(shipper.allocatedFuelMyr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(shipper.allocatedTollMyr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(shipper.allocatedDriverMyr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(shipper.totalCostMyr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(shipper.grossProfitMyr)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}

function CustomerListRow({
  customer,
  expanded,
  loading,
  markets,
  onToggle,
}: {
  customer: PnlCustomerData["customers"][number];
  expanded: boolean;
  loading: boolean;
  markets?: PnlCustomerMarketRow[];
  onToggle: () => void;
}) {
  return (
    <Fragment>
      <TableRow>
        <TableCell>
          <button
            type="button"
            onClick={onToggle}
            className="text-haidee-blue"
            aria-label={expanded ? "收起市场明细" : "展开市场明细"}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </TableCell>
        <TableCell>
          {customer.shipperName}
          <div className="text-xs text-haidee-muted">{customer.shipperCode}</div>
        </TableCell>
        <TableCell className="text-right">{customer.totalQuantity}</TableCell>
        <TableCell className="text-right">
          {formatMyr(customer.revenueMyr)}
        </TableCell>
        <TableCell className="text-right">
          {formatMyr(customer.directCostMyr)}
        </TableCell>
        <TableCell className="text-right">
          {formatMyr(customer.allocatedCostMyr)}
        </TableCell>
        <TableCell className="text-right">
          {formatMyr(customer.totalCostMyr)}
        </TableCell>
        <TableCell className="text-right">
          {formatMyr(customer.grossProfitMyr)}
        </TableCell>
        <TableCell className="text-right">
          {formatMyr(customer.profitPerCrate)}
        </TableCell>
        <TableCell className="text-right">
          {formatPct(customer.marginPct)}
        </TableCell>
        <TableCell>
          <span
            className={cn(
              "rounded px-2 py-1 text-xs font-medium",
              STATUS_LABELS[customer.status].className
            )}
          >
            {STATUS_LABELS[customer.status].label}
          </span>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={11} className="bg-slate-50 p-0">
            {loading && !markets ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-haidee-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载市场明细…
              </div>
            ) : markets && markets.length > 0 ? (
              <div className="overflow-x-auto p-4">
                <Table className={PNL_TABLE_CLASS}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>市场</TableHead>
                      <TableHead className="text-right">桶数</TableHead>
                      <TableHead className="text-right">费率/桶</TableHead>
                      <TableHead className="text-right">收入</TableHead>
                      <TableHead className="text-right">租桶费</TableHead>
                      <TableHead className="text-right">LKIM</TableHead>
                      <TableHead className="text-right">泰国段</TableHead>
                      <TableHead className="text-right">MC第三方车力</TableHead>
                      <TableHead className="text-right">下货费</TableHead>
                      <TableHead className="text-right">分摊成本</TableHead>
                      <TableHead className="text-right">总成本</TableHead>
                      <TableHead className="text-right">毛利</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {markets.map((market) => (
                      <TableRow key={market.marketCode}>
                        <TableCell>
                          {market.marketCode === "CHARTER"
                            ? "包车 CHARTER"
                            : market.marketCode}
                        </TableCell>
                        <TableCell className="text-right">
                          {market.quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(market.ratePerCrate)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(market.revenueMyr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(market.crateRentalMyr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(market.lkimMaqisMyr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(market.thaiSegmentMyr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(market.mcThirdPartyHaulageMyr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(market.unloadFeeMyr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(market.allocatedCostMyr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(market.totalCostMyr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(market.grossProfitMyr)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-haidee-muted">
                暂无市场明细
              </p>
            )}
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-haidee-muted">
      <Loader2 className="h-5 w-5 animate-spin" />
      加载中 Loading…
    </div>
  );
}

function SearchButton({
  onClick,
  loading,
}: {
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="min-h-[44px] rounded-lg bg-haidee-blue px-4 text-sm font-medium text-white hover:bg-haidee-blue/90 disabled:opacity-60"
    >
      {loading ? "查询中…" : "🔍 查询 Search"}
    </button>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-haidee-border bg-white p-4">
      <div className="text-sm text-haidee-muted">{label}</div>
      <div className="mt-2 text-2xl font-bold text-haidee-text">{value}</div>
    </div>
  );
}

function FilterYearMonth({
  year,
  month,
  onYearChange,
  onMonthChange,
}: {
  year: number;
  month: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
}) {
  return (
    <>
      <FilterSelect
        label="年份 Year"
        value={String(year)}
        onChange={(value) => onYearChange(Number(value))}
        options={YEAR_OPTIONS.map((y) => ({
          value: String(y),
          label: String(y),
        }))}
      />
      <FilterSelect
        label="月份 Month"
        value={String(month)}
        onChange={(value) => onMonthChange(Number(value))}
        options={Array.from({ length: 12 }, (_, i) => ({
          value: String(i + 1),
          label: String(i + 1),
        }))}
      />
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[44px] rounded-lg border border-haidee-border px-3 text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function FilterInput({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[44px] rounded-lg border border-haidee-border px-3 text-sm"
      />
    </div>
  );
}
