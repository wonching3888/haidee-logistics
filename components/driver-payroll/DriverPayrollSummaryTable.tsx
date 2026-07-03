"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { STICKY_BODY_FIRST, STICKY_HEAD_FIRST, STICKY_HEAD_TOP } from "@/lib/table-scroll";
import type { getDriverPayrollMonthlySummary } from "@/app/actions/driver-payroll";
import { cn } from "@/lib/utils";

type SummaryData = Awaited<ReturnType<typeof getDriverPayrollMonthlySummary>>;

function money(value: number) {
  return value.toFixed(2);
}

const COLUMNS = [
  { key: "name", label: "小名", align: "left" as const },
  { key: "baseSalary", label: "底薪", align: "right" as const },
  { key: "tripAllowanceTotal", label: "趟次津贴", align: "right" as const },
  { key: "charterSalaryTotal", label: "包车固定工钱", align: "right" as const },
  { key: "crateCommissionTotal", label: "回桶提成", align: "right" as const },
  { key: "extraAllowanceTotal", label: "额外津贴", align: "right" as const },
  { key: "grossSalary", label: "应发", align: "right" as const },
  { key: "epfEmployee", label: "EPF员工", align: "right" as const },
  { key: "socsoEmployee", label: "SOCSO员工", align: "right" as const },
  { key: "lindung24Jam", label: "Lindung", align: "right" as const },
  { key: "eisEmployee", label: "EIS员工", align: "right" as const },
  { key: "pcb", label: "PCB", align: "right" as const },
  { key: "netSalary", label: "实发", align: "right" as const },
  { key: "epfEmployer", label: "雇主EPF", align: "right" as const },
  { key: "socsoEmployer", label: "雇主SOCSO", align: "right" as const },
  { key: "eisEmployer", label: "雇主EIS", align: "right" as const },
  { key: "employerContributionTotal", label: "雇主总供款", align: "right" as const },
] as const;

type NumericColumnKey = Exclude<(typeof COLUMNS)[number]["key"], "name">;

interface DriverPayrollSummaryTableProps {
  data: SummaryData;
}

export function DriverPayrollSummaryTable({ data }: DriverPayrollSummaryTableProps) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-semibold">月度汇总 Monthly Summary</h3>
          <p className="text-sm text-haidee-muted">
            {data.yearMonth} · {data.rows.length} 位在职司机 · 薪资总成本{" "}
            <span className="font-mono font-semibold text-haidee-navy">
              {money(data.totalCostMyr)} MYR
            </span>
            <span className="ml-2 text-xs">
              （应发 {money(data.grossMyr)} + 雇主 {money(data.employerMyr)}）
            </span>
            <span className="mt-1 block text-xs text-haidee-muted">
              现金类参考：实发 {money(data.netMyr)} + 雇主 {money(data.employerMyr)} ={" "}
              {money(data.netMyr + data.employerMyr)} MYR（不含员工代扣上缴）
            </span>
          </p>
        </div>
      </div>

      <ScrollMatrixTable heightOffset={320}>
        <Table className="min-w-[1400px] text-sm">
          <TableHeader>
            <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
              {COLUMNS.map((column, index) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    "whitespace-nowrap px-2",
                    column.align === "right" && "text-right",
                    index === 0 ? STICKY_HEAD_FIRST : STICKY_HEAD_TOP
                  )}
                >
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => (
              <TableRow key={row.driverId}>
                {COLUMNS.map((column, index) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      "whitespace-nowrap px-2 py-1.5",
                      column.align === "right" && "text-right font-mono tabular-nums",
                      index === 0 && STICKY_BODY_FIRST
                    )}
                  >
                    {column.key === "name"
                      ? row.name
                      : money(row[column.key as NumericColumnKey])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            <TableRow className="bg-haidee-navy/5 font-semibold hover:bg-haidee-navy/5">
              {COLUMNS.map((column, index) => (
                <TableCell
                  key={column.key}
                  className={cn(
                    "whitespace-nowrap px-2 py-2",
                    column.align === "right" && "text-right font-mono tabular-nums",
                    index === 0 && STICKY_BODY_FIRST
                  )}
                >
                  {column.key === "name"
                    ? data.totals.name
                    : money(data.totals[column.key as NumericColumnKey])}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </ScrollMatrixTable>
    </section>
  );
}
