"use client";

import { useEffect, useState, useTransition } from "react";
import { Download, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  addDriverPayrollExtra,
  deleteDriverPayrollExtra,
  exportDriverPayrollAutoCount,
  getDriverPayrollMonth,
  getDriverPayrollMonthlySummary,
  saveDriverPayrollOverrides,
  saveDriverPayrollTrip,
} from "@/app/actions/driver-payroll";
import { PAYROLL_EXTRA_TYPES } from "@/lib/constants/payroll";
import {
  crateReturnEarningsDisplayTotal,
  type buildPayrollSummary,
} from "@/lib/payroll-statutory";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { getRouteLabel } from "@/lib/payroll-route-label";
import { DriverPayrollSummaryTable } from "@/components/driver-payroll/DriverPayrollSummaryTable";
import { PayrollJvExportPanel } from "@/components/driver-payroll/PayrollJvExportPanel";
import { cn } from "@/lib/utils";

interface DriverOption {
  id: string;
  name: string;
}

interface DriverPayrollViewProps {
  drivers: DriverOption[];
  initialDriverId?: string;
  initialYear: number;
  initialMonth: number;
  canExportJv?: boolean;
}

type PayrollData = Awaited<ReturnType<typeof getDriverPayrollMonth>>;
type SummaryData = Awaited<ReturnType<typeof getDriverPayrollMonthlySummary>>;
type Summary = ReturnType<typeof buildPayrollSummary>;
type PayrollTab = "summary" | "detail";

const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => 2020 + i);

function money(value: number) {
  return value.toFixed(2);
}

export function DriverPayrollView({
  drivers,
  initialDriverId,
  initialYear,
  initialMonth,
  canExportJv = false,
}: DriverPayrollViewProps) {
  const [driverId, setDriverId] = useState(initialDriverId ?? drivers[0]?.id ?? "");
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [activeTab, setActiveTab] = useState<PayrollTab>("summary");
  const [data, setData] = useState<PayrollData | null>(null);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [overrideForm, setOverrideForm] = useState<Record<string, string>>({});
  const [extraForm, setExtraForm] = useState({
    type: "extra_allowance",
    amount: "",
    date: `${year}-${String(month).padStart(2, "0")}-01`,
    note: "",
  });

  async function fetchSummary() {
    const result = await getDriverPayrollMonthlySummary({ year, month });
    setSummaryData(result);
  }

  async function fetchPayroll() {
    if (!driverId) return;
    const result = await getDriverPayrollMonth({ driverId, year, month });
    setData(result);
    setOverrideForm({
      epfEmployee: result.overrides.epfEmployee?.toString() ?? "",
      epfEmployer: result.overrides.epfEmployer?.toString() ?? "",
      socsoEmployee: result.overrides.socsoEmployee?.toString() ?? "",
      socsoEmployer: result.overrides.socsoEmployer?.toString() ?? "",
      lindung24Jam: result.overrides.lindung24Jam?.toString() ?? "",
      eisEmployee: result.overrides.eisEmployee?.toString() ?? "",
      eisEmployer: result.overrides.eisEmployer?.toString() ?? "",
      pcb: result.overrides.pcb?.toString() ?? "",
    });
  }

  async function reloadAll() {
    if (activeTab === "detail") {
      await fetchPayroll();
    }
    await fetchSummary();
  }

  function handleQuery() {
    startTransition(async () => {
      setError(null);
      try {
        await reloadAll();
      } catch (e) {
        setSummaryData(null);
        setData(null);
        setError(e instanceof Error ? e.message : "加载失败");
      }
    });
  }

  useEffect(() => {
    handleQuery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function runAction(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        await reloadAll();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  function parseOptionalOverride(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  async function handleExport() {
    if (!driverId) return;
    try {
      const result = await exportDriverPayrollAutoCount({ driverId, year, month });
      const blob = new Blob([result.content], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败");
    }
  }

  const summary: Summary | undefined = data?.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">年份 Year</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="min-h-[44px] rounded-lg border border-haidee-border px-3 text-sm"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">月份 Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="min-h-[44px] rounded-lg border border-haidee-border px-3 text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m} 月
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={handleQuery}
        disabled={isPending}
        style={{
          backgroundColor: "#2563eb",
          color: "white",
          padding: "10px 32px",
          borderRadius: "8px",
          border: "none",
          cursor: "pointer",
          fontSize: "15px",
          fontWeight: "600",
          display: "block",
        }}
      >
        {isPending ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            加载中…
          </span>
        ) : (
          "查询 Search"
        )}
      </button>

      <div className="flex flex-wrap gap-2 border-b border-haidee-border">
        {(
          [
            ["summary", "汇总 Summary"],
            ["detail", "个人明细 Detail"],
          ] as const
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab
                ? "border-haidee-blue text-haidee-blue"
                : "border-transparent text-haidee-muted hover:text-haidee-text"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "summary" ? (
        isPending && !summaryData ? (
          <div className="h-40 animate-pulse rounded-xl bg-haidee-border/30" />
        ) : summaryData ? (
          <div className="space-y-6">
            <DriverPayrollSummaryTable data={summaryData} />
            {canExportJv ? (
              <PayrollJvExportPanel
                year={year}
                month={month}
                isPending={isPending}
              />
            ) : null}
          </div>
        ) : null
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">司机 Driver</label>
              <select
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                className="min-h-[44px] min-w-[200px] rounded-lg border border-haidee-border px-3 text-sm"
              >
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={!driverId || isPending}
              onClick={handleExport}
            >
              <Download className="h-4 w-4" />
              AutoCount 导出
            </Button>
          </div>

          {isPending && !data ? (
            <div className="h-40 animate-pulse rounded-xl bg-haidee-border/30" />
          ) : data ? (
            <DriverPayrollDetailSections
              data={data}
              summary={summary}
              isPending={isPending}
              overrideForm={overrideForm}
              setOverrideForm={setOverrideForm}
              extraForm={extraForm}
              setExtraForm={setExtraForm}
              runAction={runAction}
              parseOptionalOverride={parseOptionalOverride}
            />
          ) : null}
        </>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}
    </div>
  );
}

function DriverPayrollDetailSections({
  data,
  summary,
  isPending,
  overrideForm,
  setOverrideForm,
  extraForm,
  setExtraForm,
  runAction,
  parseOptionalOverride,
}: {
  data: PayrollData;
  summary: Summary | undefined;
  isPending: boolean;
  overrideForm: Record<string, string>;
  setOverrideForm: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  extraForm: {
    type: string;
    amount: string;
    date: string;
    note: string;
  };
  setExtraForm: React.Dispatch<
    React.SetStateAction<{
      type: string;
      amount: string;
      date: string;
      note: string;
    }>
  >;
  runAction: (fn: () => Promise<void>) => void;
  parseOptionalOverride: (value: string) => number | null;
}) {
  return (
    <>
          <section className="rounded-xl border border-haidee-border bg-white p-4">
            <h3 className="mb-3 font-semibold">趟次记录 Trips</h3>
            <ScrollMatrixTable heightOffset={480}>
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                    <TableHead className="whitespace-nowrap px-2">日期</TableHead>
                    <TableHead className="whitespace-nowrap px-2">路线</TableHead>
                    <TableHead className="whitespace-nowrap px-2 text-center">
                      市场数
                    </TableHead>
                    <TableHead className="whitespace-nowrap px-2 text-right">
                      趟次津贴(RM)
                    </TableHead>
                    <TableHead className="whitespace-nowrap px-2 text-right">
                      包车固定工钱(RM)
                    </TableHead>
                    <TableHead className="whitespace-nowrap px-2 text-right">
                      额外津贴(RM)
                    </TableHead>
                    <TableHead className="whitespace-nowrap px-2 text-right">
                      回桶提成(RM)
                    </TableHead>
                    <TableHead className="whitespace-nowrap px-2 text-right">
                      本趟合计(RM)
                    </TableHead>
                    <TableHead className="whitespace-nowrap px-2">备注</TableHead>
                    <TableHead className="whitespace-nowrap px-2" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.trips.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-6 text-center text-haidee-muted">
                        当月暂无派车趟次
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.trips.map((trip) => (
                      <TripRow
                        key={trip.id}
                        trip={trip}
                        disabled={isPending}
                        onSave={(values) =>
                          runAction(async () =>
                            saveDriverPayrollTrip({
                              id: trip.id,
                              ...values,
                            })
                          )
                        }
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollMatrixTable>
          </section>

          <section className="rounded-xl border border-haidee-border bg-white p-4">
            <h3 className="mb-3 font-semibold">额外项目 Extras</h3>
            <div className="mb-4 grid gap-3 sm:grid-cols-4">
              <select
                value={extraForm.type}
                onChange={(e) =>
                  setExtraForm({ ...extraForm, type: e.target.value })
                }
                className="min-h-[44px] rounded-lg border border-haidee-border px-3 text-sm"
              >
                {PAYROLL_EXTRA_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <Input
                value={extraForm.amount}
                onChange={(e) =>
                  setExtraForm({ ...extraForm, amount: e.target.value })
                }
                placeholder="金额 Amount"
                className="min-h-[44px] font-mono"
              />
              <Input
                type="date"
                value={extraForm.date}
                onChange={(e) =>
                  setExtraForm({ ...extraForm, date: e.target.value })
                }
                className="min-h-[44px]"
              />
              <Input
                value={extraForm.note}
                onChange={(e) =>
                  setExtraForm({ ...extraForm, note: e.target.value })
                }
                placeholder="备注 Note"
                className="min-h-[44px]"
              />
            </div>
            <Button
              type="button"
              className="mb-4 gap-2 bg-haidee-blue text-white"
              disabled={isPending}
              onClick={() =>
                runAction(async () => {
                  const amount = Number(extraForm.amount);
                  if (!Number.isFinite(amount) || amount <= 0) {
                    throw new Error("金额必须大于 0");
                  }
                  await addDriverPayrollExtra({
                    payrollMonthId: data.payrollMonthId,
                    type: extraForm.type,
                    amount,
                    date: extraForm.date,
                    note: extraForm.note,
                  });
                  setExtraForm((prev) => ({ ...prev, amount: "", note: "" }));
                })
              }
            >
              <Plus className="h-4 w-4" />
              新增项目
            </Button>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>类型</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.extras.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-4 text-center text-haidee-muted">
                      暂无额外项目
                    </TableCell>
                  </TableRow>
                ) : (
                  data.extras.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.type === "advance" ? "借支" : "额外津贴"}</TableCell>
                      <TableCell>{item.date}</TableCell>
                      <TableCell>{item.note ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">
                        {money(item.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() =>
                            runAction(async () => deleteDriverPayrollExtra(item.id))
                          }
                        >
                          <Trash2 className="h-4 w-4 text-haidee-red" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-haidee-border bg-white p-4">
              <h3 className="mb-1 font-semibold">法定扣款 Statutory</h3>
              <p className="mb-3 text-sm text-haidee-muted">
                系统自动计算，如需调整请手动输入覆盖。Admin
                输入后点「保存覆盖」生效；留空则使用系统自动计算值。
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["epfEmployee", "EPF 员工 11%"],
                    ["epfEmployer", "EPF 雇主 13%"],
                    ["socsoEmployee", "SOCSO 员工"],
                    ["socsoEmployer", "SOCSO 雇主"],
                    ["lindung24Jam", "Lindung 24 jam (SKBBK)"],
                    ["eisEmployee", "EIS 员工 0.2%"],
                    ["eisEmployer", "EIS 雇主 0.2%"],
                    ["pcb", "PCB 所得税"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block space-y-1 text-sm">
                    {label}
                    <Input
                      value={overrideForm[key] ?? ""}
                      placeholder={
                        data?.autoStatutory
                          ? money(data.autoStatutory[key])
                          : ""
                      }
                      onChange={(e) =>
                        setOverrideForm({ ...overrideForm, [key]: e.target.value })
                      }
                      className="min-h-[44px] font-mono"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() =>
                    runAction(async () =>
                      saveDriverPayrollOverrides({
                        payrollMonthId: data.payrollMonthId,
                        epfEmployee: parseOptionalOverride(overrideForm.epfEmployee),
                        epfEmployer: parseOptionalOverride(overrideForm.epfEmployer),
                        socsoEmployee: parseOptionalOverride(overrideForm.socsoEmployee),
                        socsoEmployer: parseOptionalOverride(overrideForm.socsoEmployer),
                        lindung24Jam: parseOptionalOverride(overrideForm.lindung24Jam),
                        eisEmployee: parseOptionalOverride(overrideForm.eisEmployee),
                        eisEmployer: parseOptionalOverride(overrideForm.eisEmployer),
                        pcb: parseOptionalOverride(overrideForm.pcb),
                      })
                    )
                  }
                >
                  保存覆盖 Save Overrides
                </Button>
              </div>
            </section>

            <section className="rounded-xl border border-haidee-border bg-white p-4">
              <h3 className="mb-3 font-semibold">月薪汇总 Summary</h3>
              {summary && (
                <dl className="space-y-2 text-sm">
                  <SummaryRow label="底薪 Base Salary" value={summary.baseSalary} />
                  <SummaryRow label="趟次津贴 Trips" value={summary.tripAllowanceTotal} />
                  <SummaryRow
                    label="包车固定工钱 Charter Salary"
                    value={summary.charterSalaryTotal}
                  />
                  <SummaryRow
                    label="回桶提成 Crate Return"
                    value={crateReturnEarningsDisplayTotal(summary)}
                  />
                  <SummaryRow label="额外津贴 Extras" value={summary.extraAllowanceTotal} />
                  <SummaryRow label="应发 Gross" value={summary.grossSalary} bold />
                  <SummaryRow label="EPF 员工" value={-summary.statutory.epfEmployee} />
                  <SummaryRow label="SOCSO 员工" value={-summary.statutory.socsoEmployee} />
                  <SummaryRow label="Lindung 24 jam" value={-summary.statutory.lindung24Jam} />
                  <SummaryRow label="EIS 员工" value={-summary.statutory.eisEmployee} />
                  <SummaryRow label="PCB" value={-summary.statutory.pcb} />
                  <SummaryRow label="借支扣除 Advance" value={-summary.advanceTotal} />
                  <div className="border-t border-haidee-border pt-2">
                    <SummaryRow label="实发 Net Salary" value={summary.netSalary} bold />
                  </div>
                  <p className="pt-2 text-xs text-haidee-muted">
                    雇主供款 EPF {money(summary.statutory.epfEmployer)} · SOCSO{" "}
                    {money(summary.statutory.socsoEmployer)} · EIS{" "}
                    {money(summary.statutory.eisEmployer)}
                  </p>
                </dl>
              )}
            </section>
          </div>
        </>
  );
}

function SummaryRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <dt>{label}</dt>
      <dd className="font-mono">{money(value)} MYR</dd>
    </div>
  );
}

function TripRow({
  trip,
  disabled,
  onSave,
}: {
  trip: PayrollData["trips"][number];
  disabled: boolean;
  onSave: (values: {
    tripAllowance: number;
    extraAllowance: number;
    notes?: string;
  }) => void;
}) {
  const defaultTripAllowance =
    trip.tripAllowance !== 0 ? trip.tripAllowance : trip.autoTripAllowance;

  const [tripAllowance, setTripAllowance] = useState(String(defaultTripAllowance));
  const [extraAllowance, setExtraAllowance] = useState(String(trip.extraAllowance));
  const [notes, setNotes] = useState(trip.notes ?? "");

  useEffect(() => {
    const nextTripAllowance =
      trip.tripAllowance !== 0 ? trip.tripAllowance : trip.autoTripAllowance;
    setTripAllowance(String(nextTripAllowance));
    setExtraAllowance(String(trip.extraAllowance));
    setNotes(trip.notes ?? "");
  }, [trip]);

  const tripTotal =
    (Number(tripAllowance) || 0) +
    trip.charterSalary +
    (Number(extraAllowance) || 0) +
    trip.crateReturnCommission +
    (trip.crateReturnMultiMarketAllowance ?? 0);

  const compactInputClass =
    "h-8 w-[90px] px-2 text-right font-mono text-xs tabular-nums";

  const routeLabel = getRouteLabel(
    trip.markets.length > 0 ? trip.markets : trip.route
  );

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap px-2 py-1.5">{trip.dateLabel}</TableCell>
      <TableCell className="max-w-[180px] truncate px-2 py-1.5" title={routeLabel}>
        {routeLabel}
      </TableCell>
      <TableCell className="px-2 py-1.5 text-center tabular-nums">
        {trip.marketCount}
      </TableCell>
      <TableCell className="px-2 py-1.5">
        <Input
          value={tripAllowance}
          onChange={(e) => setTripAllowance(e.target.value)}
          className={compactInputClass}
          disabled={Boolean(trip.charterTripId)}
        />
      </TableCell>
      <TableCell className="px-2 py-1.5">
        <div
          className="flex h-8 w-[90px] items-center justify-end rounded-md border border-haidee-border bg-gray-100 px-2 font-mono text-xs tabular-nums text-haidee-text"
          title="包车固定工钱(来自包车单)"
        >
          {money(trip.charterSalary)}
        </div>
      </TableCell>
      <TableCell className="px-2 py-1.5">
        <Input
          value={extraAllowance}
          onChange={(e) => setExtraAllowance(e.target.value)}
          className={compactInputClass}
        />
      </TableCell>
      <TableCell className="px-2 py-1.5">
        <div
          className="flex h-8 w-[90px] items-center justify-end rounded-md border border-haidee-border bg-gray-100 px-2 font-mono text-xs tabular-nums text-haidee-text"
          title={
            (trip.crateReturnMultiMarketAllowance ?? 0) > 0
              ? `提成 ${trip.crateReturnCommission} + 多市场 ${trip.crateReturnMultiMarketAllowance}`
              : "从派车回桶记录自动计算"
          }
        >
          {money(
            trip.crateReturnCommission +
              (trip.crateReturnMultiMarketAllowance ?? 0)
          )}
        </div>
      </TableCell>
      <TableCell className="px-2 py-1.5">
        <div className="flex h-8 w-[100px] items-center justify-end rounded-md bg-haidee-navy/10 px-2 font-mono text-xs font-bold tabular-nums text-haidee-navy">
          {money(tripTotal)}
        </div>
      </TableCell>
      <TableCell className="px-2 py-1.5">
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-8 w-[120px] px-2 text-xs"
        />
      </TableCell>
      <TableCell className="px-2 py-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-2 text-xs"
          disabled={disabled}
          onClick={() =>
            onSave({
              tripAllowance: Number(tripAllowance) || 0,
              extraAllowance: Number(extraAllowance) || 0,
              notes,
            })
          }
        >
          保存
        </Button>
      </TableCell>
    </TableRow>
  );
}
