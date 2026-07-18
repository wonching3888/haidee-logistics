"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getStaffPayrollMonth,
  getStaffPayrollMonthlySummary,
  saveStaffPayrollOverrides,
} from "@/app/actions/staff-payroll";
import { StaffPayrollSummaryTable } from "@/components/staff-payroll/StaffPayrollSummaryTable";
import type { buildStaffPayrollSummary } from "@/lib/staff-payroll-statutory";

interface StaffOption {
  id: string;
  name: string;
}

interface StaffPayrollViewProps {
  staff: StaffOption[];
  initialStaffId?: string;
  initialYear: number;
  initialMonth: number;
}

type PayrollData = Awaited<ReturnType<typeof getStaffPayrollMonth>>;
type SummaryData = Awaited<ReturnType<typeof getStaffPayrollMonthlySummary>>;
type Summary = ReturnType<typeof buildStaffPayrollSummary>;
type PayrollTab = "summary" | "detail";

const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => 2020 + i);

function money(value: number) {
  return value.toFixed(2);
}

export function StaffPayrollView({
  staff,
  initialStaffId,
  initialYear,
  initialMonth,
}: StaffPayrollViewProps) {
  const [staffId, setStaffId] = useState(
    initialStaffId ?? staff[0]?.id ?? ""
  );
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [activeTab, setActiveTab] = useState<PayrollTab>("summary");
  const [data, setData] = useState<PayrollData | null>(null);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [overrideForm, setOverrideForm] = useState<Record<string, string>>({});

  async function fetchSummary() {
    const result = await getStaffPayrollMonthlySummary({ year, month });
    setSummaryData(result);
  }

  async function fetchPayroll() {
    if (!staffId) return;
    const result = await getStaffPayrollMonth({ staffId, year, month });
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
        <Button
          type="button"
          className="bg-haidee-blue text-white"
          disabled={isPending}
          onClick={handleQuery}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "查询 Search"
          )}
        </Button>
      </div>

      <div className="flex gap-2 border-b border-haidee-border">
        {(
          [
            ["summary", "汇总 Summary"],
            ["detail", "明细 Detail"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`border-b-2 px-3 py-2 text-sm ${
              activeTab === key
                ? "border-haidee-blue text-haidee-blue"
                : "border-transparent text-haidee-muted"
            }`}
            onClick={() => {
              setActiveTab(key);
              if (key === "detail") {
                startTransition(async () => {
                  try {
                    await fetchPayroll();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "加载失败");
                  }
                });
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}

      {activeTab === "summary" && summaryData && (
        <div className="space-y-4">
          <StaffPayrollSummaryTable data={summaryData} />
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/staff-payroll/print/batch?year=${year}&month=${month}&returnTo=${encodeURIComponent(`/staff-payroll?year=${year}&month=${month}`)}`}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-haidee-border bg-white px-4 text-sm font-medium hover:bg-haidee-surface"
            >
              <Printer className="h-4 w-4" />
              批量工资单 Batch Payslip ({summaryData.rows.length} 人)
            </Link>
          </div>
        </div>
      )}

      {activeTab === "detail" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">员工 Staff</label>
              <select
                value={staffId}
                onChange={(e) => {
                  setStaffId(e.target.value);
                  startTransition(async () => {
                    try {
                      const result = await getStaffPayrollMonth({
                        staffId: e.target.value,
                        year,
                        month,
                      });
                      setData(result);
                      setOverrideForm({
                        epfEmployee:
                          result.overrides.epfEmployee?.toString() ?? "",
                        epfEmployer:
                          result.overrides.epfEmployer?.toString() ?? "",
                        socsoEmployee:
                          result.overrides.socsoEmployee?.toString() ?? "",
                        socsoEmployer:
                          result.overrides.socsoEmployer?.toString() ?? "",
                        lindung24Jam:
                          result.overrides.lindung24Jam?.toString() ?? "",
                        eisEmployee:
                          result.overrides.eisEmployee?.toString() ?? "",
                        eisEmployer:
                          result.overrides.eisEmployer?.toString() ?? "",
                        pcb: result.overrides.pcb?.toString() ?? "",
                      });
                    } catch (err) {
                      setError(
                        err instanceof Error ? err.message : "加载失败"
                      );
                    }
                  });
                }}
                className="min-h-[44px] min-w-[220px] rounded-lg border border-haidee-border px-3 text-sm"
              >
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            {staffId ? (
              <Link
                href={`/staff-payroll/print?staffId=${encodeURIComponent(staffId)}&year=${year}&month=${month}&returnTo=${encodeURIComponent(`/staff-payroll?staffId=${encodeURIComponent(staffId)}&year=${year}&month=${month}`)}`}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-haidee-border bg-white px-4 text-sm font-medium hover:bg-haidee-surface"
              >
                <Printer className="h-4 w-4" />
                打印工资单 Print
              </Link>
            ) : null}
          </div>

          {data?.staff.pcbNeedsReview && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              PCB 资料待补，请先 Settings → 员工资料 填写婚姻/配偶工作状态。
            </p>
          )}

          {data?.staff.lindung24JamOptOut && (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-haidee-muted">
              已退出 Lindung 24 Jam（自愿）；自动金额为 0（月结手填 override
              仍优先）。
            </p>
          )}

          {data && summary && (
            <>
              <section className="rounded-xl border border-haidee-border bg-white p-4">
                <h3 className="mb-3 font-semibold">本月摘要 Summary</h3>
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    底薪 Base:{" "}
                    <span className="font-mono">{money(summary.baseSalary)}</span>
                  </div>
                  <div>
                    应发 Gross:{" "}
                    <span className="font-mono">{money(summary.grossSalary)}</span>
                  </div>
                  <div>
                    EPF 员工:{" "}
                    <span className="font-mono">
                      {money(summary.statutory.epfEmployee)}
                    </span>
                  </div>
                  <div>
                    SOCSO 员工:{" "}
                    <span className="font-mono">
                      {money(summary.statutory.socsoEmployee)}
                    </span>
                  </div>
                  <div>
                    Lindung:{" "}
                    <span className="font-mono">
                      {money(summary.statutory.lindung24Jam)}
                    </span>
                  </div>
                  <div>
                    EIS 员工:{" "}
                    <span className="font-mono">
                      {money(summary.statutory.eisEmployee)}
                    </span>
                  </div>
                  <div>
                    PCB:{" "}
                    <span className="font-mono">
                      {money(summary.statutory.pcb)}
                    </span>
                  </div>
                  <div>
                    实发 Net:{" "}
                    <span className="font-mono font-semibold">
                      {money(summary.netSalary)}
                    </span>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-haidee-border bg-white p-4">
                <h3 className="mb-3 font-semibold">
                  法定扣款覆盖 Overrides（空=自动）
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {(
                    [
                      ["epfEmployee", "EPF员工", data.autoStatutory.epfEmployee],
                      ["epfEmployer", "EPF雇主", data.autoStatutory.epfEmployer],
                      [
                        "socsoEmployee",
                        "SOCSO员工",
                        data.autoStatutory.socsoEmployee,
                      ],
                      [
                        "socsoEmployer",
                        "SOCSO雇主",
                        data.autoStatutory.socsoEmployer,
                      ],
                      [
                        "lindung24Jam",
                        "Lindung",
                        data.autoStatutory.lindung24Jam,
                      ],
                      ["eisEmployee", "EIS员工", data.autoStatutory.eisEmployee],
                      ["eisEmployer", "EIS雇主", data.autoStatutory.eisEmployer],
                      ["pcb", "PCB", data.autoStatutory.pcb],
                    ] as const
                  ).map(([key, label, auto]) => (
                    <label key={key} className="block space-y-1 text-sm">
                      {label}
                      <Input
                        value={overrideForm[key] ?? ""}
                        placeholder={`自动 ${money(auto)}`}
                        onChange={(e) =>
                          setOverrideForm({
                            ...overrideForm,
                            [key]: e.target.value,
                          })
                        }
                        className="min-h-[44px] font-mono"
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    className="bg-haidee-blue text-white"
                    disabled={isPending}
                    onClick={() =>
                      runAction(async () =>
                        saveStaffPayrollOverrides({
                          payrollMonthId: data.payrollMonthId,
                          epfEmployee: parseOptionalOverride(
                            overrideForm.epfEmployee ?? ""
                          ),
                          epfEmployer: parseOptionalOverride(
                            overrideForm.epfEmployer ?? ""
                          ),
                          socsoEmployee: parseOptionalOverride(
                            overrideForm.socsoEmployee ?? ""
                          ),
                          socsoEmployer: parseOptionalOverride(
                            overrideForm.socsoEmployer ?? ""
                          ),
                          lindung24Jam: parseOptionalOverride(
                            overrideForm.lindung24Jam ?? ""
                          ),
                          eisEmployee: parseOptionalOverride(
                            overrideForm.eisEmployee ?? ""
                          ),
                          eisEmployer: parseOptionalOverride(
                            overrideForm.eisEmployer ?? ""
                          ),
                          pcb: parseOptionalOverride(overrideForm.pcb ?? ""),
                        })
                      )
                    }
                  >
                    保存覆盖 Save overrides
                  </Button>
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
