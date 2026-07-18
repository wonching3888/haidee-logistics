import React from "react";
import {
  formatPayslipBankAccount,
  formatPayslipMoney,
  payslipMonthTitle,
  WTL_PAYSLIP_LETTERHEAD,
  WTL_PAYSLIP_LOGO_SRC,
} from "@/lib/staff-payslip";
import type { StaffPayrollSummary } from "@/lib/staff-payroll-statutory";

export interface StaffPayslipPrintProps {
  year: number;
  month: number;
  staff: {
    name: string;
    nickname: string | null;
    icNumber: string | null;
    bankName: string | null;
    bankAccount: string | null;
    baseSalary: number | null;
  };
  summary: StaffPayrollSummary;
}

function AmountRow({
  label,
  value,
  emphasis,
  sectionLine,
  net,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  sectionLine?: boolean;
  net?: boolean;
}) {
  const display = formatPayslipMoney(Math.abs(value));
  const prefix = value < 0 ? "-" : "";
  const rowClass = net
    ? "payslip-net"
    : emphasis
      ? "payslip-total"
      : sectionLine
        ? "payslip-section-line"
        : undefined;
  return (
    <tr className={rowClass}>
      <td>{label}</td>
      <td>
        {prefix}
        {display}
      </td>
    </tr>
  );
}

export function StaffPayslipPrint({
  year,
  month,
  staff,
  summary,
}: StaffPayslipPrintProps) {
  const { statutory } = summary;
  const displayName = staff.name;
  const nickname = staff.nickname?.trim();

  return (
    <article className="driver-payslip-print document-print">
      <header className="payslip-letterhead">
        <div className="payslip-letterhead-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={WTL_PAYSLIP_LOGO_SRC}
            alt="WTL Express"
            className="payslip-letterhead-logo"
          />
          <div className="payslip-letterhead-text">
            <h1>{WTL_PAYSLIP_LETTERHEAD.companyName}</h1>
            <p>{WTL_PAYSLIP_LETTERHEAD.registration}</p>
            <p>{WTL_PAYSLIP_LETTERHEAD.address}</p>
            <p>
              Tel: {WTL_PAYSLIP_LETTERHEAD.tel}&nbsp;&nbsp;&nbsp;Email:{" "}
              {WTL_PAYSLIP_LETTERHEAD.email}
            </p>
          </div>
        </div>
      </header>

      <p className="payslip-title">{payslipMonthTitle(month, year)}</p>

      <div className="payslip-grid">
        <section className="payslip-cell">
          <h2>Employee</h2>
          <dl className="payslip-kv">
            <dt>NAME</dt>
            <dd>{displayName}</dd>
            <dt>I/C NO.</dt>
            <dd>{staff.icNumber?.trim() || "—"}</dd>
            <dt>A/C NO.</dt>
            <dd>
              {formatPayslipBankAccount({
                bankName: staff.bankName,
                bankAccount: staff.bankAccount,
              })}
            </dd>
            <dt>BASIC RATE</dt>
            <dd>
              {formatPayslipMoney(staff.baseSalary ?? summary.baseSalary)}
            </dd>
          </dl>
          {nickname && nickname !== displayName ? (
            <p className="payslip-nickname">({nickname})</p>
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
              <AmountRow
                label="GROSS PAY"
                value={summary.grossSalary}
                emphasis
              />
              <AmountRow label="EPF" value={-statutory.epfEmployee} />
              <AmountRow label="SOCSO" value={-statutory.socsoEmployee} />
              <AmountRow label="EIS" value={-statutory.eisEmployee} />
              <AmountRow
                label="LINDUNG 24 JAM"
                value={-statutory.lindung24Jam}
              />
              <AmountRow label="PCB" value={-statutory.pcb} sectionLine />
              <AmountRow label="NET PAY" value={summary.netSalary} net />
            </tbody>
          </table>
        </section>
      </div>
    </article>
  );
}
