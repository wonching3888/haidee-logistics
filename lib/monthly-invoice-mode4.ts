import type { MonthlyInvoiceModeConfig } from "@/lib/constants/monthly-invoice";
import {
  aggregateInvoiceLines,
  buildInvoiceListing,
  type AggregatedInvoiceData,
  type InvoiceListingData,
} from "@/lib/monthly-invoice-aggregate";
import {
  buildMonthlyInvoiceData,
  resolveCustomerKeyForInvoice,
  type MonthlyInvoiceData,
  type RawInvoiceLine,
} from "@/lib/monthly-invoice";

export type WtlMonthlyInvoiceBillToRole = "shipper" | "consignee";

/** Shared print payload for Mode 3 / Mode 4 WTL aggregated Tax Invoice + Listing. */
export interface WtlMonthlyInvoiceData {
  mode: MonthlyInvoiceModeConfig;
  year: number;
  month: number;
  periodLabel: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  currency: string;
  grandTotalQty: number;
  grandTotalAmount: number;
  billToRole: WtlMonthlyInvoiceBillToRole;
  taxInvoice: AggregatedInvoiceData;
  listing: InvoiceListingData;
}

export type Mode4MonthlyInvoiceData = WtlMonthlyInvoiceData;
export type Mode3MonthlyInvoiceData = WtlMonthlyInvoiceData;

export type MonthlyInvoicePrintData = MonthlyInvoiceData | WtlMonthlyInvoiceData;

export function isWtlMonthlyInvoiceData(
  data: MonthlyInvoicePrintData
): data is WtlMonthlyInvoiceData {
  return (
    (data.mode.value === "3" || data.mode.value === "4") && "taxInvoice" in data
  );
}

/** @deprecated Use isWtlMonthlyInvoiceData */
export function isMode4MonthlyInvoiceData(
  data: MonthlyInvoicePrintData
): data is Mode4MonthlyInvoiceData {
  return isWtlMonthlyInvoiceData(data);
}

export function buildMode4MonthlyInvoiceData(input: {
  mode: MonthlyInvoiceModeConfig;
  year: number;
  month: number;
  periodLabel: string;
  customerId: string;
  rawLines: RawInvoiceLine[];
}): Mode4MonthlyInvoiceData | null {
  const legacy = buildMonthlyInvoiceData(input);
  if (!legacy) return null;

  const customerRawLines = input.rawLines.filter((line) => {
    const customer = resolveCustomerKeyForInvoice(line, input.mode.billTo);
    return customer?.id === input.customerId;
  });

  const taxInvoice = aggregateInvoiceLines(customerRawLines);
  const listing = buildInvoiceListing(customerRawLines);

  if (taxInvoice.grandTotalAmount !== legacy.grandTotalAmount) {
    throw new Error(
      `Mode 4 aggregate total mismatch: aggregated=${taxInvoice.grandTotalAmount}, legacy=${legacy.grandTotalAmount}`
    );
  }

  return {
    mode: input.mode,
    year: input.year,
    month: input.month,
    periodLabel: input.periodLabel,
    customerId: legacy.customerId,
    customerCode: legacy.customerCode,
    customerName: legacy.customerName,
    currency: legacy.currency,
    grandTotalQty: legacy.grandTotalQty,
    grandTotalAmount: legacy.grandTotalAmount,
    billToRole: "shipper",
    taxInvoice,
    listing,
  };
}
