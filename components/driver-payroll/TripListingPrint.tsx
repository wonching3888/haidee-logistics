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
      <p className="trip-listing-driver">
        {driverName}
        <span className="trip-listing-driver-sub"> · 趟次明细 Trip Listing</span>
      </p>

      <table className="trip-listing-table">
        <thead>
          <tr>
            <th>日期 Date</th>
            <th>类型 Type</th>
            <th>车牌 Plate</th>
            <th>市场/路线 Market / Route</th>
            <th className="amount">趟次津贴 Trip Wages</th>
            <th className="amount">回桶提成 Crate</th>
            <th className="amount">小计 Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="trip-listing-empty">
                当月暂无趟次 No trips this month
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
            <td colSpan={6}>TOTAL WAGES 工钱合计</td>
            <td className="amount">{formatPayslipMoney(totalWages)}</td>
          </tr>
        </tfoot>
      </table>
    </article>
  );
}
