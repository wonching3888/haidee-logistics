import React from "react";
import { DriverPayslipPrint, type DriverPayslipPrintProps } from "@/components/driver-payroll/DriverPayslipPrint";
import { TripListingPrint } from "@/components/driver-payroll/TripListingPrint";
import type { TripListingRow } from "@/lib/driver-trip-listing";

export interface DriverPayslipWithListingPrintProps extends DriverPayslipPrintProps {
  tripListingRows: TripListingRow[];
}

/** Payslip page + trip listing page(s) for one driver — used by single and batch print. */
export function DriverPayslipWithListingPrint({
  tripListingRows,
  ...payslipProps
}: DriverPayslipWithListingPrintProps) {
  return (
    <div className="driver-payslip-package">
      <DriverPayslipPrint {...payslipProps} />
      <TripListingPrint
        year={payslipProps.year}
        month={payslipProps.month}
        driverName={payslipProps.driver.payrollName}
        rows={tripListingRows}
        summary={payslipProps.summary}
      />
    </div>
  );
}
