import React from "react";
import { cn } from "@/lib/utils";
import {
  StaffPayslipPrint,
  type StaffPayslipPrintProps,
} from "@/components/staff-payroll/StaffPayslipPrint";

export interface StaffPayslipPrintEntry {
  staffId: string;
  staff: StaffPayslipPrintProps["staff"];
  summary: StaffPayslipPrintProps["summary"];
}

export interface StaffPayslipBatchPrintProps {
  year: number;
  month: number;
  entries: StaffPayslipPrintEntry[];
}

export function StaffPayslipBatchPrint({
  year,
  month,
  entries,
}: StaffPayslipBatchPrintProps) {
  return (
    <div className="driver-payslip-batch-print">
      {entries.map((entry, index) => (
        <div
          key={entry.staffId}
          className={cn(
            "driver-payslip-batch-page",
            index === entries.length - 1 && "driver-payslip-batch-page--last"
          )}
        >
          <StaffPayslipPrint
            year={year}
            month={month}
            staff={entry.staff}
            summary={entry.summary}
          />
        </div>
      ))}
    </div>
  );
}
