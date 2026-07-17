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
import type { getStaffPayrollMonthlySummary } from "@/app/actions/staff-payroll";
import { cn } from "@/lib/utils";
import { STICKY_BODY_FIRST, STICKY_HEAD_FIRST, STICKY_HEAD_TOP } from "@/lib/table-scroll";

type SummaryData = Awaited<ReturnType<typeof getStaffPayrollMonthlySummary>>;

function money(value: number) {
  return value.toFixed(2);
}

function categoryLabel(value: string) {
  return value === "director_remuneration" ? "董事袍金" : "薪金";
}

const COLUMNS = [
  { key: "name", label: "姓名", align: "left" as const },
  { key: "payrollCategory", label: "类别", align: "left" as const },
  { key: "baseSalary", label: "底薪", align: "right" as const },
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

type NumericColumnKey = Exclude<
  (typeof COLUMNS)[number]["key"],
  "name" | "payrollCategory"
>;

interface StaffPayrollSummaryTableProps {
  data: SummaryData;
}

export function StaffPayrollSummaryTable({
  data,
}: StaffPayrollSummaryTableProps) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-semibold">月度汇总 Monthly Summary</h3>
        <p className="text-sm text-haidee-muted">
          {data.yearMonth} · {data.rows.length} 位员工 · 薪资总成本{" "}
          <span className="font-mono font-semibold text-haidee-navy">
            {money(data.totalCostMyr)} MYR
          </span>
          <span className="ml-2 text-xs">
            （应发 {money(data.grossMyr)} + 雇主 {money(data.employerMyr)}）
          </span>
        </p>
      </div>

      <ScrollMatrixTable heightOffset={320}>
        <Table className="min-w-[1200px] text-sm">
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
              <TableRow key={row.staffId}>
                {COLUMNS.map((column, index) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      "whitespace-nowrap px-2",
                      column.align === "right" && "text-right font-mono",
                      index === 0 && STICKY_BODY_FIRST
                    )}
                  >
                    {column.key === "name"
                      ? row.name
                      : column.key === "payrollCategory"
                        ? categoryLabel(row.payrollCategory)
                        : money(row[column.key as NumericColumnKey])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            <TableRow className="bg-haidee-surface font-semibold">
              {COLUMNS.map((column, index) => (
                <TableCell
                  key={column.key}
                  className={cn(
                    "whitespace-nowrap px-2",
                    column.align === "right" && "text-right font-mono",
                    index === 0 && STICKY_BODY_FIRST
                  )}
                >
                  {column.key === "name"
                    ? "合计"
                    : column.key === "payrollCategory"
                      ? ""
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
