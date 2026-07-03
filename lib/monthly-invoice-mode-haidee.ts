import type { MonthlyInvoiceModeConfig } from "@/lib/constants/monthly-invoice";
import type { ShipperInvoiceCompany } from "@/lib/constants/shipper-invoice-company";
import { aggregateHaideeInvoiceLines } from "@/lib/monthly-invoice-haidee-aggregate";
import type { HaideeAggregatedInvoiceData } from "@/lib/monthly-invoice-haidee-aggregate";
import { buildInvoiceListing, buildInvoiceListingByShipper } from "@/lib/monthly-invoice-aggregate";
import type {
  InvoiceListingByShipperData,
  InvoiceListingData,
} from "@/lib/monthly-invoice-aggregate";
import {
  buildMonthlyInvoiceData,
  resolveCustomerKeyForInvoice,
  type RawInvoiceLine,
} from "@/lib/monthly-invoice";

export type HaideeMonthlyInvoiceBillToRole = "shipper" | "consignee";

export interface HaideeMonthlyInvoiceData {
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
  billToRole: HaideeMonthlyInvoiceBillToRole;
  /** Mode 1a only: tax invoice issuer (Haidee vs HUP DEE bank). */
  invoiceCompany?: ShipperInvoiceCompany;
  summary: HaideeAggregatedInvoiceData;
  listing: InvoiceListingData;
  /** Mode 2 only: listing grouped by inbound shipper. */
  listingByShipper?: InvoiceListingByShipperData;
  extraCharges?: Array<{
    id: string;
    description: string;
    quantity: number | null;
    unit: string | null;
    unitPrice: number | null;
    amount: number;
    sortOrder: number;
  }>;
  /** Mode 1a/1b/2 accounting print fields (invoice no, date, terms). */
  accountingPrint?: {
    invoiceNo: string;
    invoiceDateLabel: string;
    termsLabel: string;
  };
  /** @deprecated Use accountingPrint */
  mode1aPrint?: {
    invoiceNo: string;
    invoiceDateLabel: string;
    termsLabel: string;
  };
}

export function isHaideeMonthlyInvoiceData(
  data: unknown
): data is HaideeMonthlyInvoiceData {
  if (!data || typeof data !== "object") return false;
  const candidate = data as HaideeMonthlyInvoiceData;
  return (
    (candidate.mode?.value === "1a" ||
      candidate.mode?.value === "1b" ||
      candidate.mode?.value === "2") &&
    "summary" in candidate
  );
}

function billToRoleForMode(
  mode: MonthlyInvoiceModeConfig
): HaideeMonthlyInvoiceBillToRole {
  return mode.billTo === "consignee" ? "consignee" : "shipper";
}

export function buildHaideeMonthlyInvoiceData(input: {
  mode: MonthlyInvoiceModeConfig;
  year: number;
  month: number;
  periodLabel: string;
  customerId: string;
  rawLines: RawInvoiceLine[];
}): HaideeMonthlyInvoiceData | null {
  const legacy = buildMonthlyInvoiceData(input);
  if (!legacy) return null;

  const customerRawLines = input.rawLines.filter((line) => {
    const customer = resolveCustomerKeyForInvoice(line, input.mode.billTo);
    return customer?.id === input.customerId;
  });

  const summary = aggregateHaideeInvoiceLines(customerRawLines);
  const listing = buildInvoiceListing(customerRawLines);
  const listingByShipper =
    input.mode.value === "2"
      ? buildInvoiceListingByShipper(customerRawLines)
      : undefined;

  if (listingByShipper && listingByShipper.overallTotalQty !== summary.grandTotalQty) {
    throw new Error(
      `Mode 2 shipper listing qty ${listingByShipper.overallTotalQty} != invoice qty ${summary.grandTotalQty}`
    );
  }

  if (summary.grandTotalAmount !== legacy.grandTotalAmount) {
    throw new Error(
      `Mode ${input.mode.value} aggregate total mismatch: aggregated=${summary.grandTotalAmount}, legacy=${legacy.grandTotalAmount}`
    );
  }

  for (const section of summary.sections) {
    const listingSection = listing.sections.find(
      (item) => item.kind === section.kind
    );
    if (!listingSection) {
      throw new Error(
        `Mode ${input.mode.value} missing listing section for ${section.kind}`
      );
    }
    if (listingSection.grandTotal !== section.totalQty) {
      throw new Error(
        `Mode ${input.mode.value} ${section.kind} listing qty ${listingSection.grandTotal} != invoice qty ${section.totalQty}`
      );
    }
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
    billToRole: billToRoleForMode(input.mode),
    summary,
    listing,
    listingByShipper,
  };
}
