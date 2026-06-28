import {
  bankAccountsForCurrency,
  type InvoiceBankAccount,
} from "@/lib/constants/invoice-bank-accounts";
import type {
  ReceivableCurrency,
  ReceivableInvoice,
} from "@/lib/receivable-invoices";

export type InvoiceCollectionStatus = "unpaid" | "partial" | "paid";

export interface InvoiceCollectionsCurrencyOverview {
  currency: ReceivableCurrency;
  totalReceivable: number;
  /** Sum of payment.amount in the query month range (cash received). */
  totalReceived: number;
  /** Sum of allocations on invoices in the query month range. */
  totalAllocated: number;
  /** Sum of payment.unallocatedAmount in the query month range (prepaid). */
  totalPrepaid: number;
  /** totalReceivable − totalAllocated (invoice open, excludes prepaid). */
  totalOpen: number;
  invoiceCount: number;
  bankAccounts: Array<{ bankAccount: InvoiceBankAccount; amount: number }>;
}

export interface InvoiceCollectionsOverview {
  thb: InvoiceCollectionsCurrencyOverview;
  myr: InvoiceCollectionsCurrencyOverview;
}

export interface InvoiceCollectionsListFilters {
  customerQuery: string;
  bankAccount: InvoiceBankAccount | "";
  status: InvoiceCollectionStatus | "";
  currency: ReceivableCurrency | "";
}

export interface LedgerWithCollectionRow {
  customerKey: string;
  currency: ReceivableCurrency;
  customerName: string;
  customerCode: string | null;
  collectionStatus: InvoiceCollectionStatus;
}

export function buildPaymentDateBounds(input: {
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
}) {
  const start = new Date(Date.UTC(input.fromYear, input.fromMonth - 1, 1));
  const end = new Date(Date.UTC(input.toYear, input.toMonth, 0));
  return { start, end };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function ledgerCollectionKey(
  customerKey: string,
  currency: ReceivableCurrency
) {
  return `${customerKey}|${currency}`;
}

function invoiceLedgerKey(invoiceType: string, invoiceKey: string) {
  return `${invoiceType}|${invoiceKey}`;
}

function sumAllocatedByCurrency(
  invoices: ReceivableInvoice[],
  allocatedByInvoice: Map<string, number>
) {
  const totals: Record<ReceivableCurrency, number> = { THB: 0, MYR: 0 };
  for (const invoice of invoices) {
    totals[invoice.currency] = roundMoney(
      totals[invoice.currency] +
        (allocatedByInvoice.get(
          invoiceLedgerKey(invoice.invoiceType, invoice.invoiceKey)
        ) ?? 0)
    );
  }
  return totals;
}

function sumReceivableByCurrency(invoices: ReceivableInvoice[]) {
  const totals: Record<ReceivableCurrency, number> = { THB: 0, MYR: 0 };
  let thbCount = 0;
  let myrCount = 0;
  for (const invoice of invoices) {
    if (invoice.currency === "THB") {
      totals.THB = roundMoney(totals.THB + invoice.totalAmount);
      thbCount += 1;
    } else {
      totals.MYR = roundMoney(totals.MYR + invoice.totalAmount);
      myrCount += 1;
    }
  }
  return { totals, counts: { THB: thbCount, MYR: myrCount } };
}

export function buildInvoiceCollectionsOverview(input: {
  invoices: ReceivableInvoice[];
  allocatedByInvoice: Map<string, number>;
  paymentTotalsByCurrency: Record<
    ReceivableCurrency,
    { received: number; prepaid: number }
  >;
  bankAmountsByCurrency: Record<
    ReceivableCurrency,
    Map<InvoiceBankAccount, number>
  >;
}): InvoiceCollectionsOverview {
  const allocated = sumAllocatedByCurrency(
    input.invoices,
    input.allocatedByInvoice
  );
  const { totals: receivable, counts } = sumReceivableByCurrency(input.invoices);

  const buildOne = (currency: ReceivableCurrency): InvoiceCollectionsCurrencyOverview => {
    const totalReceivable = receivable[currency];
    const totalAllocated = allocated[currency];
    const bankMap = input.bankAmountsByCurrency[currency];
    const bankAccounts = bankAccountsForCurrency(currency).map((bankAccount) => ({
      bankAccount,
      amount: roundMoney(bankMap.get(bankAccount) ?? 0),
    }));

    return {
      currency,
      totalReceivable,
      totalReceived: roundMoney(input.paymentTotalsByCurrency[currency].received),
      totalAllocated,
      totalPrepaid: roundMoney(input.paymentTotalsByCurrency[currency].prepaid),
      totalOpen: roundMoney(Math.max(0, totalReceivable - totalAllocated)),
      invoiceCount: counts[currency],
      bankAccounts,
    };
  };

  return {
    thb: buildOne("THB"),
    myr: buildOne("MYR"),
  };
}

export function parseInvoiceCollectionsListFilters(searchParams: {
  get: (key: string) => string | null;
}): InvoiceCollectionsListFilters {
  const statusRaw = searchParams.get("listStatus") ?? "";
  const status =
    statusRaw === "unpaid" ||
    statusRaw === "partial" ||
    statusRaw === "paid"
      ? statusRaw
      : "";

  const currencyRaw = searchParams.get("listCurrency") ?? "";
  const currency = currencyRaw === "THB" || currencyRaw === "MYR" ? currencyRaw : "";

  const bankRaw = searchParams.get("listBank") ?? "";
  const bankAccount =
    bankRaw === "HAIDEE_BBL5030" ||
    bankRaw === "HUPDEE_KBANK5020" ||
    bankRaw === "HUPDEE_BBL7044" ||
    bankRaw === "WTL_PBB1725" ||
    bankRaw === "CASH"
      ? bankRaw
      : "";

  return {
    customerQuery: (searchParams.get("listCustomer") ?? "").trim(),
    bankAccount,
    status,
    currency,
  };
}

export function hasActiveListFilters(filters: InvoiceCollectionsListFilters) {
  return Boolean(
    filters.customerQuery ||
      filters.bankAccount ||
      filters.status ||
      filters.currency
  );
}

export function applyListFiltersToUrlParams(
  params: URLSearchParams,
  filters: InvoiceCollectionsListFilters
) {
  if (filters.customerQuery) {
    params.set("listCustomer", filters.customerQuery);
  } else {
    params.delete("listCustomer");
  }
  if (filters.bankAccount) {
    params.set("listBank", filters.bankAccount);
  } else {
    params.delete("listBank");
  }
  if (filters.status) {
    params.set("listStatus", filters.status);
  } else {
    params.delete("listStatus");
  }
  if (filters.currency) {
    params.set("listCurrency", filters.currency);
  } else {
    params.delete("listCurrency");
  }
}

export const EMPTY_INVOICE_COLLECTIONS_LIST_FILTERS: InvoiceCollectionsListFilters =
  {
    customerQuery: "",
    bankAccount: "",
    status: "",
    currency: "",
  };

export function filterInvoiceCollectionLedgers<
  T extends LedgerWithCollectionRow,
>(ledgers: T[], ledgerBankAccounts: Map<string, InvoiceBankAccount[]>, filters: InvoiceCollectionsListFilters): T[] {
  const query = filters.customerQuery.toLowerCase();

  return ledgers.filter((ledger) => {
    if (filters.currency && ledger.currency !== filters.currency) {
      return false;
    }
    if (filters.status && ledger.collectionStatus !== filters.status) {
      return false;
    }
    if (query) {
      const haystack = `${ledger.customerName} ${ledger.customerCode ?? ""} ${ledger.customerKey}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (filters.bankAccount) {
      const key = ledgerCollectionKey(ledger.customerKey, ledger.currency);
      const banks = ledgerBankAccounts.get(key) ?? [];
      if (!banks.includes(filters.bankAccount)) return false;
    }
    return true;
  });
}
