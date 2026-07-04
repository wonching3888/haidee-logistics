import {
  invoiceBankAccountDisplayLabel,
  type InvoiceBankAccount,
} from "@/lib/constants/invoice-bank-accounts";
import type { ReceivableCurrency } from "@/lib/receivable-invoices";

export interface BankReconciliationPaymentRow {
  id: string;
  paymentDate: string;
  customerKey: string;
  customerName: string;
  amount: number;
  currency: ReceivableCurrency;
  bankAccount: InvoiceBankAccount;
  invoiceNos: string;
  isReconciled: boolean;
  reconciledAt: string | null;
  reconciledBy: string | null;
}

export interface BankReconciliationAccountGroup {
  bankAccount: InvoiceBankAccount;
  currency: ReceivableCurrency;
  totalAmount: number;
  reconciledAmount: number;
  unreconciledAmount: number;
  payments: BankReconciliationPaymentRow[];
}

export interface BankReconciliationData {
  dateFrom: string;
  dateTo: string;
  thbGroups: BankReconciliationAccountGroup[];
  myrGroups: BankReconciliationAccountGroup[];
}

/** Calendar month bounds as yyyy-MM-dd (local calendar). */
export function defaultBankReconciliationMonthRange(
  now: Date = new Date()
): { dateFrom: string; dateTo: string } {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    dateFrom: `${year}-${String(month).padStart(2, "0")}-01`,
    dateTo: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** Flat rows for CSV (THB groups then MYR groups, account order preserved). */
export function flattenBankReconciliationRows(
  data: BankReconciliationData
): BankReconciliationPaymentRow[] {
  return [...data.thbGroups, ...data.myrGroups].flatMap(
    (group) => group.payments
  );
}

export function buildBankReconciliationCsv(
  data: BankReconciliationData
): string {
  const header = [
    "Currency",
    "Bank Account",
    "Payment Date",
    "Customer",
    "Amount",
    "Invoice Nos",
    "Reconciled",
    "Reconciled At",
  ];

  const lines = [header.join(",")];
  const escape = (value: string) => {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  };

  for (const group of [...data.thbGroups, ...data.myrGroups]) {
    for (const payment of group.payments) {
      lines.push(
        [
          payment.currency,
          escape(invoiceBankAccountDisplayLabel(payment.bankAccount)),
          payment.paymentDate,
          escape(payment.customerName),
          payment.amount.toFixed(2),
          escape(payment.invoiceNos),
          payment.isReconciled ? "Y" : "N",
          payment.reconciledAt ?? "",
        ].join(",")
      );
    }
  }

  return `\uFEFF${lines.join("\n")}\n`;
}
