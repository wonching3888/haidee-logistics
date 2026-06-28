import type { ReceivableCurrency, ReceivableIssuerKey } from "@/lib/receivable-invoices";
import type { MessageKey } from "@/lib/i18n/messages";

export const INVOICE_BANK_ACCOUNTS = [
  {
    value: "HAIDEE_BBL5030",
    currency: "THB",
    labelKey: "invoiceCollections.bankAccount.haideeBbl5030",
  },
  {
    value: "HUPDEE_KBANK5020",
    currency: "THB",
    labelKey: "invoiceCollections.bankAccount.hupdeeKbank5020",
  },
  {
    value: "HUPDEE_BBL7044",
    currency: "THB",
    labelKey: "invoiceCollections.bankAccount.hupdeeBbl7044",
  },
  {
    value: "WTL_PBB1725",
    currency: "MYR",
    labelKey: "invoiceCollections.bankAccount.wtlPbb1725",
  },
  {
    value: "CASH",
    currency: "BOTH",
    labelKey: "invoiceCollections.bankAccount.cash",
  },
] as const;

export type InvoiceBankAccount = (typeof INVOICE_BANK_ACCOUNTS)[number]["value"];

export type InvoiceAllocationStrategy = "auto" | "manual";

export function isInvoiceBankAccount(value: string): value is InvoiceBankAccount {
  return INVOICE_BANK_ACCOUNTS.some((item) => item.value === value);
}

export function isInvoiceAllocationStrategy(
  value: string
): value is InvoiceAllocationStrategy {
  return value === "auto" || value === "manual";
}

export function isBankAccountValidForCurrency(
  bankAccount: InvoiceBankAccount,
  currency: ReceivableCurrency
): boolean {
  if (bankAccount === "CASH") return true;
  const config = INVOICE_BANK_ACCOUNTS.find((item) => item.value === bankAccount);
  if (!config) return false;
  return config.currency === currency;
}

export function bankAccountsForCurrency(
  currency: ReceivableCurrency
): InvoiceBankAccount[] {
  return INVOICE_BANK_ACCOUNTS.filter(
    (item) => item.currency === currency || item.currency === "BOTH"
  ).map((item) => item.value);
}

export function inferDefaultBankAccount(input: {
  currency: ReceivableCurrency;
  issuerKey?: ReceivableIssuerKey | null;
}): InvoiceBankAccount {
  if (input.currency === "MYR" && input.issuerKey === "wtl") {
    return "WTL_PBB1725";
  }
  if (input.currency === "THB") {
    return "HAIDEE_BBL5030";
  }
  if (input.currency === "MYR") {
    return "WTL_PBB1725";
  }
  return "CASH";
}

export function invoiceBankAccountLabelKey(
  bankAccount: InvoiceBankAccount
): MessageKey {
  const config = INVOICE_BANK_ACCOUNTS.find((item) => item.value === bankAccount);
  return (config?.labelKey ?? "invoiceCollections.bankAccount.cash") as MessageKey;
}
