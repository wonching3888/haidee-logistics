import type { PayrollSummary } from "@/lib/payroll-statutory";
import { crateReturnEarningsDisplayTotal } from "@/lib/payroll-statutory";

/** Fixed WTL payslip letterhead (not from DB). Logo: public/logo.png (same as invoice prints). */
export const WTL_PAYSLIP_LOGO_SRC = "/logo.png";

export const WTL_PAYSLIP_LETTERHEAD = {
  companyName: "WTL EXPRESS SDN.BHD.",
  registration: "202201017123 (1462820-W)",
  address: "Lot 1918, Kampung Baru, Pekan Baru, 06010 Changloon, Kedah",
  tel: "011-1150 3888",
  email: "wtlexpress3888@gmail.com",
} as const;

const MONTH_NAMES = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
] as const;

export function payslipMonthTitle(month: number, year: number) {
  const name = MONTH_NAMES[Math.min(12, Math.max(1, month)) - 1];
  return `PAYSLIP FOR THE MONTH OF ${name} ${year}`;
}

/** Trip + charter + crate (incl. multi-market) + allowance — one WAGES line on payslip. */
export function payslipWagesTotal(summary: PayrollSummary) {
  return roundMoney(
    summary.tripAllowanceTotal +
      summary.charterSalaryTotal +
      crateReturnEarningsDisplayTotal(summary) +
      summary.extraAllowanceTotal
  );
}

/** Gross minus employee statutory (excl. advance) — BALANCE line before advance. */
export function payslipBalanceBeforeAdvance(summary: PayrollSummary) {
  const { statutory } = summary;
  return roundMoney(
    summary.grossSalary -
      statutory.epfEmployee -
      statutory.socsoEmployee -
      statutory.lindung24Jam -
      statutory.eisEmployee -
      statutory.pcb
  );
}

/** Portion of advance recovered from net pay (capped at balance before advance). */
export function payslipAdvanceRecoveredFromPay(summary: PayrollSummary) {
  const balance = payslipBalanceBeforeAdvance(summary);
  return roundMoney(Math.min(summary.advanceTotal, Math.max(0, balance)));
}

/** Advance not recoverable from pay — written off (e.g. termination). */
export function payslipAdvanceWriteOff(summary: PayrollSummary) {
  return roundMoney(
    Math.max(0, summary.advanceTotal - payslipAdvanceRecoveredFromPay(summary))
  );
}

export function payslipHasAdvanceWriteOff(summary: PayrollSummary) {
  return payslipAdvanceWriteOff(summary) > 0;
}

export function formatPayslipMoney(value: number) {
  return value.toFixed(2);
}

export function formatPayslipBankAccount(input: {
  bankName: string | null | undefined;
  bankAccount: string | null | undefined;
}) {
  const account = input.bankAccount?.trim();
  if (!account) return "—";
  const bank = input.bankName?.trim();
  return bank ? `${bank} ${account}` : account;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
