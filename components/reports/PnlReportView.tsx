"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getPnlReport } from "@/app/actions/pnl-report";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PnlReportData } from "@/lib/pnl-report-types";
import {
  PNL_ROUTE_FILTERS,
  type PnlCustomerSort,
  type PnlCustomerStatus,
  type PnlPeriodMode,
  type PnlRouteFilter,
} from "@/lib/pnl-report-types";
import { cn } from "@/lib/utils";

const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => 2020 + i);
type PnlTab = "trip" | "period" | "customer";

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
  points: PnlReportData["periodSummary"]["trend"];
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
          <span className="h-2 w-6 rounded bg-blue-600" />
          毛利 Profit
        </span>
      </div>
    </div>
  );
}

interface PnlReportViewProps {
  initialYear: number;
  initialMonth: number;
  initialData: PnlReportData;
}

export function PnlReportView({
  initialYear,
  initialMonth,
  initialData,
}: PnlReportViewProps) {
  const [activeTab, setActiveTab] = useState<PnlTab>("trip");
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [periodMode, setPeriodMode] = useState<PnlPeriodMode>("month");
  const [day, setDay] = useState(
    `${initialYear}-${String(initialMonth).padStart(2, "0")}-01`
  );
  const [rangeStart, setRangeStart] = useState(day);
  const [rangeEnd, setRangeEnd] = useState(day);
  const [routeFilter, setRouteFilter] = useState<PnlRouteFilter>("ALL");
  const [driverFilter, setDriverFilter] = useState("ALL");
  const [customerSort, setCustomerSort] = useState<PnlCustomerSort>("profit");
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [data, setData] = useState(initialData);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const skipInitialFetch = useRef(true);

  function loadReport() {
    startTransition(async () => {
      setError(null);
      try {
        const result = await getPnlReport({
          year,
          month,
          periodMode: activeTab === "period" ? periodMode : "month",
          day: activeTab === "period" && periodMode === "day" ? day : undefined,
          rangeStart:
            activeTab === "period" && periodMode === "range"
              ? rangeStart
              : undefined,
          rangeEnd:
            activeTab === "period" && periodMode === "range"
              ? rangeEnd
              : undefined,
          routeFilter: activeTab === "trip" ? routeFilter : "ALL",
          driverFilter: activeTab === "trip" ? driverFilter : "ALL",
          customerSort: activeTab === "customer" ? customerSort : "profit",
        });
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      }
    });
  }

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    year,
    month,
    periodMode,
    day,
    rangeStart,
    rangeEnd,
    routeFilter,
    driverFilter,
    customerSort,
    activeTab,
  ]);

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
                ? "border-haidee-teal text-haidee-teal"
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
          <div className="flex flex-wrap items-end gap-4">
            <FilterYearMonth
              year={year}
              month={month}
              onYearChange={setYear}
              onMonthChange={setMonth}
            />
            <FilterSelect
              label="路线 Route"
              value={routeFilter}
              onChange={(value) => setRouteFilter(value as PnlRouteFilter)}
              options={PNL_ROUTE_FILTERS.map((route) => ({
                value: route,
                label: route === "ALL" ? "全部 All" : route,
              }))}
            />
            <FilterSelect
              label="司机 Driver"
              value={driverFilter}
              onChange={setDriverFilter}
              options={[
                { value: "ALL", label: "全部 All" },
                ...data.drivers.map((driver) => ({
                  value: driver,
                  label: driver,
                })),
              ]}
            />
          </div>

          <ScrollMatrixTable>
            <Table>
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
                {data.trips.map((trip) => {
                  const expanded = expandedTripId === trip.dispatchOrderId;
                  return (
                    <Fragment key={trip.dispatchOrderId}>
                      <TableRow>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedTripId(
                                expanded ? null : trip.dispatchOrderId
                              )
                            }
                            className="text-haidee-teal"
                          >
                            {expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell>{trip.date}</TableCell>
                        <TableCell>{trip.routeLabel}</TableCell>
                        <TableCell>{trip.driverName ?? "—"}</TableCell>
                        <TableCell>{trip.truckPlate}</TableCell>
                        <TableCell className="text-right">
                          {trip.totalQuantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(trip.revenueMyr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(trip.directCostMyr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(trip.allocatedCostMyr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(trip.totalCostMyr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMyr(trip.grossProfitMyr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPct(trip.marginPct)}
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow>
                          <TableCell colSpan={12} className="bg-slate-50 p-0">
                            <div className="overflow-x-auto p-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>寄货人</TableHead>
                                    <TableHead className="text-right">桶数</TableHead>
                                    <TableHead className="text-right">收入</TableHead>
                                    <TableHead className="text-right">租桶费</TableHead>
                                    <TableHead className="text-right">LKIM</TableHead>
                                    <TableHead className="text-right">下货费</TableHead>
                                    <TableHead className="text-right">分摊油费</TableHead>
                                    <TableHead className="text-right">分摊过路费</TableHead>
                                    <TableHead className="text-right">分摊司机</TableHead>
                                    <TableHead className="text-right">总成本</TableHead>
                                    <TableHead className="text-right">毛利</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {trip.shippers.map((shipper) => (
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
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
                <TableRow className="bg-slate-100 font-semibold">
                  <TableCell colSpan={5}>当月合计 Month Total</TableCell>
                  <TableCell className="text-right">
                    {data.tripTotals.totalQuantity}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMyr(data.tripTotals.revenueMyr)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMyr(data.tripTotals.directCostMyr)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMyr(data.tripTotals.allocatedCostMyr)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMyr(data.tripTotals.totalCostMyr)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMyr(data.tripTotals.grossProfitMyr)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPct(data.tripTotals.marginPct)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </ScrollMatrixTable>
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
                value={day}
                onChange={setDay}
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <SummaryCard
              label="总收入 Total Revenue"
              value={`${formatMyr(data.periodSummary.revenueMyr)} MYR`}
            />
            <SummaryCard
              label="总成本 Total Cost"
              value={`${formatMyr(data.periodSummary.costMyr)} MYR`}
            />
            <SummaryCard
              label="毛利 Gross Profit"
              value={`${formatMyr(data.periodSummary.grossProfitMyr)} MYR`}
            />
            <SummaryCard
              label="毛利率 Margin"
              value={formatPct(data.periodSummary.marginPct)}
            />
            <SummaryCard
              label="总趟次 Trips"
              value={String(data.periodSummary.tripCount)}
            />
            <SummaryCard
              label="总桶数 Crates"
              value={String(data.periodSummary.totalQuantity)}
            />
          </div>

          <PnlTrendChart points={data.periodSummary.trend} />
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
              ]}
            />
          </div>

          <ScrollMatrixTable>
            <Table>
              <TableHeader>
                <TableRow>
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
                {data.customers.map((customer) => (
                  <TableRow key={customer.shipperId}>
                    <TableCell>
                      {customer.shipperName}
                      <div className="text-xs text-haidee-muted">
                        {customer.shipperCode}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {customer.totalQuantity}
                    </TableCell>
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
                ))}
              </TableBody>
            </Table>
          </ScrollMatrixTable>

          <div className="rounded-xl border border-haidee-border bg-white p-4">
            <h3 className="text-lg font-semibold text-haidee-text">
              建议 Suggestions
            </h3>
            {data.lossCustomers.length === 0 ? (
              <p className="mt-2 text-sm text-haidee-muted">
                当前筛选周期内暂无亏损或低毛利客户。
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {data.lossCustomers.map((item) => (
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
        </div>
      )}

      {isPending && (
        <p className="text-sm text-haidee-muted">加载中 Loading…</p>
      )}
    </div>
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
