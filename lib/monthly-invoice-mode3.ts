import type { MonthlyInvoiceModeConfig } from "@/lib/constants/monthly-invoice";
import {
  aggregateInvoiceLines,
  buildInvoiceListing,
} from "@/lib/monthly-invoice-aggregate";
import {
  buildMonthlyInvoiceData,
  resolveCustomerKeyForInvoice,
  type RawInvoiceLine,
} from "@/lib/monthly-invoice";
import type { Mode3MonthlyInvoiceData } from "@/lib/monthly-invoice-mode4";

const MODE3_AGGREGATE_OPTIONS = { segmentMapping: "mode3" as const };

export function buildMode3MonthlyInvoiceData(input: {
  mode: MonthlyInvoiceModeConfig;
  year: number;
  month: number;
  periodLabel: string;
  customerId: string;
  rawLines: RawInvoiceLine[];
}): Mode3MonthlyInvoiceData | null {
  const legacy = buildMonthlyInvoiceData(input);
  if (!legacy) return null;

  const customerRawLines = input.rawLines.filter((line) => {
    const customer = resolveCustomerKeyForInvoice(line, input.mode.billTo);
    return customer?.id === input.customerId;
  });

  const taxInvoice = aggregateInvoiceLines(
    customerRawLines,
    MODE3_AGGREGATE_OPTIONS
  );
  const listing = buildInvoiceListing(
    customerRawLines,
    MODE3_AGGREGATE_OPTIONS
  );

  if (taxInvoice.grandTotalAmount !== legacy.grandTotalAmount) {
    throw new Error(
      `Mode 3 aggregate total mismatch: aggregated=${taxInvoice.grandTotalAmount}, legacy=${legacy.grandTotalAmount}`
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
    billToRole: "consignee",
    taxInvoice,
    listing,
  };
}
