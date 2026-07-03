import React from "react";
import { formatPayslipMoney } from "@/lib/driver-payslip";
import {
  assertTripListingWagesMatchPayslip,
  tripListingMonthTitle,
  tripListingWagesTotal,
  type TripListingRow,
} from "@/lib/driver-trip-listing";
import type { PayrollSummary } from "@/lib/payroll-statutory";

export interface TripListingPrintProps {
  year: number;
  month: number;
  driverName: string;
  rows: TripListingRow[];
  summary: PayrollSummary;
}

function typeLabel(type: TripListingRow["type"]) {
  switch (type) {
    case "DO":
      return "DO";
    case "CH":
      return "CH";
    case "ALLOW":
      return "ALLOW";
  }
}

export function TripListingPrint({
  year,
  month,
  driverName,
  rows,
  summary,
}: TripListingPrintProps) {
  assertTripListingWagesMatchPayslip(rows, summary);
  const totalWages = tripListingWagesTotal(rows);

  return (
    <article className="trip-listing-print document-print">
      <p className="trip-listing-title">{tripListingMonthTitle(month, year)}</p>
      <p className="trip-listing-driver">{driverName}</p>
      <p className="trip-listing-driver-sub">Trip Listing</p>

      <table className="trip-listing-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Plate</th>
            <th>Market / Route</th>
            <th className="amount">Trip Wages</th>
            <th className="amount">Crate</th>
            <th className="amount">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="trip-listing-empty">
                No trips this month
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={`${row.date}-${row.type}-${index}`}>
                <td>{row.dateLabel}</td>
                <td>{typeLabel(row.type)}</td>
                <td>{row.plate ?? "—"}</td>
                <td>{row.marketRoute}</td>
                <td className="amount">{formatPayslipMoney(row.tripAllowance)}</td>
                <td className="amount">{formatPayslipMoney(row.crateCommission)}</td>
                <td className="amount">{formatPayslipMoney(row.subtotal)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="trip-listing-total">
            <td colSpan={6}>TOTAL WAGES</td>
            <td className="amount">{formatPayslipMoney(totalWages)}</td>
          </tr>
        </tfoot>
      </table>
    </article>
  );
}
