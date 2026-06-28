import type { ReceivableCurrency } from "@/lib/receivable-invoices";

export interface LedgerDetailScope {
  customerKey: string;
  currency: ReceivableCurrency;
}

/** True when fetched detail matches the customer+currency in the URL. */
export function isDetailDataForUrlScope(
  detail: LedgerDetailScope | null | undefined,
  customerKey: string | null | undefined,
  currency: string | null | undefined
): boolean {
  if (!detail || !customerKey || !currency) return false;
  if (currency !== "THB" && currency !== "MYR") return false;
  return detail.customerKey === customerKey && detail.currency === currency;
}

export function buildInvoiceCollectionsUrlScopeKey(input: {
  customerKey: string | null;
  currency: string | null;
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
}): string {
  return [
    input.customerKey ?? "",
    input.currency ?? "",
    input.fromYear,
    input.fromMonth,
    input.toYear,
    input.toMonth,
  ].join("|");
}
