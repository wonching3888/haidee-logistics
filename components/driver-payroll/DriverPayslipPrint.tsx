import React from "react";
import { formatDisplayDate, parseDateInput } from "@/lib/date-utils";
import {
  formatPayslipBankAccount,
  formatPayslipMoney,
  payslipBalanceBeforeAdvance,
  payslipMonthTitle,
  payslipWagesTotal,
  WTL_PAYSLIP_LETTERHEAD,
} from "@/lib/driver-payslip";
import type { PayrollSummary } from "@/lib/payroll-statutory";

export interface DriverPayslipPrintProps {
  year: number;
  month: number;
  driver: {
    payrollName: string;
    name: string;
    icNumber: string | null;
    bankName: string | null;
    bankAccount: string | null;
    baseSalary: number | null;
  };
  summary: PayrollSummary;
  advances: { date: string; amount: number; note: string | null }[];
}

function AmountRow({
  label,
  value,
  emphasis,
  net,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  net?: boolean;
}) {
  const display = formatPayslipMoney(Math.abs(value));
  const prefix = value < 0 ? "-" : "";
  return (
    <tr className={net ? "payslip-net" : emphasis ? "payslip-total" : undefined}>
      <td>{label}</td>
      <td>
        {prefix}
        {display}
      </td>
    </tr>
  );
}

export function DriverPayslipPrint({
  year,
  month,
  driver,
  summary,
  advances,
}: DriverPayslipPrintProps) {
  const { statutory } = summary;
  const wages = payslipWagesTotal(summary);
  const balance = payslipBalanceBeforeAdvance(summary);
  const advanceTotal = summary.advanceTotal;

  return (
    <article className="driver-payslip-print document-print">
      <header className="payslip-letterhead">
        <h1>{WTL_PAYSLIP_LETTERHEAD.companyName}</h1>
        <p>{WTL_PAYSLIP_LETTERHEAD.registration}</p>
        <p>{WTL_PAYSLIP_LETTERHEAD.address}</p>
        <p>
          Tel: {WTL_PAYSLIP_LETTERHEAD.tel}&nbsp;&nbsp;&nbsp;Email:{" "}
          {WTL_PAYSLIP_LETTERHEAD.email}
        </p>
      </header>

      <p className="payslip-title">{payslipMonthTitle(month, year)}</p>

      <div className="payslip-grid">
        <section className="payslip-cell">
          <h2>Employee</h2>
          <dl className="payslip-kv">
            <dt>NAME</dt>
            <dd>{driver.payrollName}</dd>
            <dt>I/C NO.</dt>
            <dd>{driver.icNumber?.trim() || "—"}</dd>
            <dt>A/C NO.</dt>
            <dd>
              {formatPayslipBankAccount({
                bankName: driver.bankName,
                bankAccount: driver.bankAccount,
              })}
            </dd>
            <dt>BASIC RATE</dt>
            <dd>{formatPayslipMoney(driver.baseSalary ?? summary.baseSalary)}</dd>
          </dl>
          {driver.name !== driver.payrollName ? (
            <p className="payslip-nickname">({driver.name})</p>
          ) : null}
        </section>

        <section className="payslip-cell">
          <h2>Others</h2>
          <table className="payslip-amount-table">
            <tbody>
              <AmountRow label="EPF'YER" value={statutory.epfEmployer} />
              <AmountRow label="SOCSO'YER" value={statutory.socsoEmployer} />
              <AmountRow label="EIS'YER" value={statutory.eisEmployer} />
            </tbody>
          </table>
        </section>

        <section className="payslip-cell">
          <h2>Payment</h2>
          <table className="payslip-amount-table">
            <tbody>
              <AmountRow label="BASIC PAY" value={summary.baseSalary} />
              <AmountRow label="WAGES (+)" value={wages} />
              <AmountRow label="GROSS PAY" value={summary.grossSalary} emphasis />
              <AmountRow label="EPF (-)" value={-statutory.epfEmployee} />
              <AmountRow label="SOCSO (-)" value={-statutory.socsoEmployee} />
              <AmountRow label="EIS (-)" value={-statutory.eisEmployee} />
              <AmountRow label="LINDUNG 24 JAM (-)" value={-statutory.lindung24Jam} />
              <AmountRow label="PCB (-)" value={-statutory.pcb} />
              <AmountRow label="BALANCE" value={balance} emphasis />
              <AmountRow label="ADVANCE (-)" value={-advanceTotal} />
              <AmountRow label="NET PAY" value={summary.netSalary} net />
            </tbody>
          </table>
        </section>

        <section className="payslip-cell">
          <h2>Advance</h2>
          {advances.length > 0 ? (
            <table className="payslip-advance-list">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="amount">Amount (RM)</th>
                </tr>
              </thead>
              <tbody>
                {advances.map((item, index) => (
                  <tr key={`${item.date}-${index}`}>
                    <td>{formatDisplayDate(parseDateInput(item.date))}</td>
                    <td className="amount">{formatPayslipMoney(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ fontSize: "9pt", margin: "0 0 8px" }}>—</p>
          )}
          <div className="payslip-signature-row">
            <div className="payslip-signature-line">EMPLOYEE&apos;S SIGNATURE</div>
            <div>
              TOTAL&nbsp;&nbsp;
              <span style={{ fontFamily: "ui-monospace, monospace" }}>
                {formatPayslipMoney(advanceTotal)}
              </span>
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}
