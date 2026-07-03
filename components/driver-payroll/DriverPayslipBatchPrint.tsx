import React from "react";
import { cn } from "@/lib/utils";
import type { DriverPayslipPrintEntry } from "@/lib/driver-payslip-batch";
import { DriverPayslipWithListingPrint } from "@/components/driver-payroll/DriverPayslipWithListingPrint";

export interface DriverPayslipBatchPrintProps {
  year: number;
  month: number;
  entries: DriverPayslipPrintEntry[];
}

export function DriverPayslipBatchPrint({
  year,
  month,
  entries,
}: DriverPayslipBatchPrintProps) {
  return (
    <div className="driver-payslip-batch-print">
      {entries.map((entry, index) => (
        <div
          key={entry.driverId}
          className={cn(
            "driver-payslip-batch-page",
            index === entries.length - 1 && "driver-payslip-batch-page--last"
          )}
        >
          <DriverPayslipWithListingPrint
            year={year}
            month={month}
            driver={entry.driver}
            summary={entry.summary}
            advances={entry.advances}
            tripListingRows={entry.tripListingRows}
          />
        </div>
      ))}
    </div>
  );
}
