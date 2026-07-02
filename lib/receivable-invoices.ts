import {
  formatInvoicePeriodLabel,
  getMonthlyInvoiceModeConfig,
  MONTHLY_INVOICE_MODES,
  type MonthlyInvoiceMode,
} from "@/lib/constants/monthly-invoice";
import {
  formatYearMonth,
  listCrateReturnMonthlyInvoicesForMonth,
} from "@/lib/crate-return-billing";
import {
  buildCharterInvoiceFromTrip,
  formatCharterBillToDisplayLabel,
} from "@/lib/charter-invoice";
import {
  isCharterBillingCompany,
  isCharterCargoType,
} from "@/lib/charter";
import {
  buildMonthlyInvoiceCustomerSummaries,
  buildMonthlyInvoiceData,
} from "@/lib/monthly-invoice";
import { fetchRawInvoiceLines } from "@/lib/monthly-invoice-lines";
import { applyMonthlyInvoiceExtraChargesToPrintData } from "@/lib/monthly-invoice-extra-charges";
import { buildHaideeMonthlyInvoiceData, isHaideeMonthlyInvoiceData } from "@/lib/monthly-invoice-mode-haidee";
import { buildMode3MonthlyInvoiceData } from "@/lib/monthly-invoice-mode3";
import {
  buildMode4MonthlyInvoiceData,
  isWtlMonthlyInvoiceData,
} from "@/lib/monthly-invoice-mode4";
import type { MonthlyInvoicePrintData } from "@/lib/monthly-invoice-print-data";
import { prisma } from "@/lib/prisma";

export type ReceivableInvoiceType = "freight" | "crate_return" | "charter";
export type ReceivableCurrency = "THB" | "MYR";
export type ReceivableCustomerKind = "shipper" | "consignee" | "charter_manual";
export type ReceivableIssuerKey = "haidee" | "wtl";

export interface ReceivableInvoiceSourceMeta {
  mode?: MonthlyInvoiceMode;
  crateType?: string;
  charterNo?: string;
  billingCompany?: string;
  billToKind?: ReceivableCustomerKind;
}

export interface ReceivableInvoice {
  invoiceType: ReceivableInvoiceType;
  invoiceKey: string;
  invoiceNo: string | null;
  customerKey: string;
  customerKind: ReceivableCustomerKind;
  customerId: string | null;
  customerCode: string | null;
  customerName: string;
  yearMonth: string;
  sortDate: string;
  currency: ReceivableCurrency;
  issuerKey: ReceivableIssuerKey;
  totalAmount: number;
  sourceMeta: ReceivableInvoiceSourceMeta;
  printHref: string;
}

export interface ReceivableCustomerLedger {
  customerKey: string;
  customerKind: ReceivableCustomerKind;
  customerId: string | null;
  customerCode: string | null;
  customerName: string;
  currency: ReceivableCurrency;
  earliestYearMonth: string;
  totalReceivable: number;
  invoiceCount: number;
}

export interface ReceivableOverviewTotals {
  totalReceivable: number;
  invoiceCount: number;
}

export interface ReceivableOverview {
  thb: ReceivableOverviewTotals;
  myr: ReceivableOverviewTotals;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function normalizeCharterManualCustomerName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toUpperCase();
}

export function buildReceivableCustomerKey(
  kind: ReceivableCustomerKind,
  idOrName: string
): string {
  if (kind === "charter_manual") {
    return `charter_manual:${normalizeCharterManualCustomerName(idOrName)}`;
  }
  return `${kind}:${idOrName}`;
}

export function parseReceivableCustomerKey(customerKey: string): {
  kind: ReceivableCustomerKind;
  idOrName: string;
} {
  const [kind, ...rest] = customerKey.split(":");
  if (
    kind !== "shipper" &&
    kind !== "consignee" &&
    kind !== "charter_manual"
  ) {
    throw new Error(`无效客户键 Invalid customer key: ${customerKey}`);
  }
  const idOrName = rest.join(":");
  if (!idOrName) {
    throw new Error(`无效客户键 Invalid customer key: ${customerKey}`);
  }
  return { kind, idOrName };
}

export function compareReceivableInvoices(
  a: ReceivableInvoice,
  b: ReceivableInvoice
): number {
  const yearMonthCompare = a.yearMonth.localeCompare(b.yearMonth);
  if (yearMonthCompare !== 0) return yearMonthCompare;

  const sortDateCompare = a.sortDate.localeCompare(b.sortDate);
  if (sortDateCompare !== 0) return sortDateCompare;

  const typeOrder: Record<ReceivableInvoiceType, number> = {
    freight: 0,
    crate_return: 1,
    charter: 2,
  };
  const typeCompare = typeOrder[a.invoiceType] - typeOrder[b.invoiceType];
  if (typeCompare !== 0) return typeCompare;

  return a.invoiceKey.localeCompare(b.invoiceKey);
}

export function groupReceivableCustomerLedgers(
  invoices: ReceivableInvoice[]
): ReceivableCustomerLedger[] {
  const map = new Map<string, ReceivableCustomerLedger>();

  for (const invoice of invoices) {
    const ledgerKey = `${invoice.customerKey}|${invoice.currency}`;
    const existing = map.get(ledgerKey);
    if (!existing) {
      map.set(ledgerKey, {
        customerKey: invoice.customerKey,
        customerKind: invoice.customerKind,
        customerId: invoice.customerId,
        customerCode: invoice.customerCode,
        customerName: invoice.customerName,
        currency: invoice.currency,
        earliestYearMonth: invoice.yearMonth,
        totalReceivable: invoice.totalAmount,
        invoiceCount: 1,
      });
      continue;
    }

    existing.totalReceivable = roundMoney(
      existing.totalReceivable + invoice.totalAmount
    );
    existing.invoiceCount += 1;
    if (invoice.yearMonth < existing.earliestYearMonth) {
      existing.earliestYearMonth = invoice.yearMonth;
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const yearMonthCompare = a.earliestYearMonth.localeCompare(
      b.earliestYearMonth
    );
    if (yearMonthCompare !== 0) return yearMonthCompare;
    return a.customerName.localeCompare(b.customerName);
  });
}

export function summarizeReceivableOverview(
  invoices: ReceivableInvoice[]
): ReceivableOverview {
  const thb: ReceivableOverviewTotals = { totalReceivable: 0, invoiceCount: 0 };
  const myr: ReceivableOverviewTotals = { totalReceivable: 0, invoiceCount: 0 };

  for (const invoice of invoices) {
    const bucket = invoice.currency === "THB" ? thb : myr;
    bucket.totalReceivable = roundMoney(
      bucket.totalReceivable + invoice.totalAmount
    );
    bucket.invoiceCount += 1;
  }

  return { thb, myr };
}

function assertReceivableCurrency(value: string): ReceivableCurrency {
  if (value === "THB" || value === "MYR") return value;
  throw new Error(`无效币种 Invalid currency: ${value}`);
}

function resolveBillToKind(
  data: MonthlyInvoicePrintData
): ReceivableCustomerKind {
  if (isHaideeMonthlyInvoiceData(data)) return data.billToRole;
  if (isWtlMonthlyInvoiceData(data)) return data.billToRole;
  return data.mode.billTo === "consignee" ? "consignee" : "shipper";
}

/** Same grand total field used on all monthly invoice print payloads. */
export function extractMonthlyInvoicePrintGrandTotal(
  data: MonthlyInvoicePrintData
): number {
  return data.grandTotalAmount;
}

/**
 * Build freight print payload — same branch logic as `getMonthlyInvoicePrintData`.
 */
export async function buildFreightMonthlyInvoicePrintData(input: {
  year: number;
  month: number;
  mode: MonthlyInvoiceMode;
  customerId: string;
  rawLines?: Awaited<ReturnType<typeof fetchRawInvoiceLines>>;
}): Promise<MonthlyInvoicePrintData | null> {
  const config = getMonthlyInvoiceModeConfig(input.mode);
  if (!config) return null;

  const rawLines =
    input.rawLines ??
    (await fetchRawInvoiceLines(input.year, input.month, input.mode));
  const periodLabel = formatInvoicePeriodLabel(input.year, input.month);

  let data: MonthlyInvoicePrintData | null = null;

  if (input.mode === "4") {
    data = buildMode4MonthlyInvoiceData({
      mode: config,
      year: input.year,
      month: input.month,
      periodLabel,
      customerId: input.customerId,
      rawLines,
    });
  } else if (input.mode === "3") {
    data = buildMode3MonthlyInvoiceData({
      mode: config,
      year: input.year,
      month: input.month,
      periodLabel,
      customerId: input.customerId,
      rawLines,
    });
  } else if (input.mode === "1a" || input.mode === "1b" || input.mode === "2") {
    data = buildHaideeMonthlyInvoiceData({
      mode: config,
      year: input.year,
      month: input.month,
      periodLabel,
      customerId: input.customerId,
      rawLines,
    });
  } else {
    data = buildMonthlyInvoiceData({
      mode: config,
      year: input.year,
      month: input.month,
      periodLabel,
      customerId: input.customerId,
      rawLines,
    });
  }

  if (!data) return null;

  if (input.mode === "1a" || input.mode === "1b" || input.mode === "2" || input.mode === "3" || input.mode === "4") {
    return applyMonthlyInvoiceExtraChargesToPrintData(data, {
      year: input.year,
      month: input.month,
      mode: input.mode,
      customerId: input.customerId,
    });
  }

  return data;
}

function buildFreightInvoiceNo(
  mode: MonthlyInvoiceMode,
  yearMonth: string,
  customerCode: string
): string {
  return `${mode.toUpperCase()}-${yearMonth.replace("-", "")}-${customerCode}`;
}

function buildFreightInvoiceKey(input: {
  mode: MonthlyInvoiceMode;
  billToKind: ReceivableCustomerKind;
  customerId: string;
  yearMonth: string;
}): string {
  return `freight:${input.mode}:${input.billToKind}:${input.customerId}:${input.yearMonth}`;
}

export async function loadFreightReceivableInvoicesForMonth(
  year: number,
  month: number
): Promise<ReceivableInvoice[]> {
  const yearMonth = formatYearMonth(year, month);
  const sortDate = `${yearMonth}-01`;
  const invoices: ReceivableInvoice[] = [];

  for (const modeConfig of MONTHLY_INVOICE_MODES) {
    const rawLines = await fetchRawInvoiceLines(year, month, modeConfig.value);
    const customers = buildMonthlyInvoiceCustomerSummaries(rawLines, modeConfig);

    for (const customer of customers) {
      const printData = await buildFreightMonthlyInvoicePrintData({
        year,
        month,
        mode: modeConfig.value,
        customerId: customer.customerId,
        rawLines,
      });
      if (!printData) continue;

      const totalAmount = extractMonthlyInvoicePrintGrandTotal(printData);
      if (totalAmount <= 0) continue;

      const billToKind = resolveBillToKind(printData);
      const currency = assertReceivableCurrency(printData.currency);

      invoices.push({
        invoiceType: "freight",
        invoiceKey: buildFreightInvoiceKey({
          mode: modeConfig.value,
          billToKind,
          customerId: customer.customerId,
          yearMonth,
        }),
        invoiceNo: buildFreightInvoiceNo(
          modeConfig.value,
          yearMonth,
          customer.customerCode
        ),
        customerKey: buildReceivableCustomerKey(billToKind, customer.customerId),
        customerKind: billToKind,
        customerId: customer.customerId,
        customerCode: customer.customerCode,
        customerName: customer.customerName,
        yearMonth,
        sortDate,
        currency,
        issuerKey: modeConfig.issuerKey,
        totalAmount,
        sourceMeta: {
          mode: modeConfig.value,
          billToKind,
        },
        printHref: `/documents/monthly-invoice/print?year=${year}&month=${month}&mode=${modeConfig.value}&customerId=${encodeURIComponent(customer.customerId)}`,
      });
    }
  }

  return invoices;
}

export async function loadCrateReturnReceivableInvoicesForMonth(
  year: number,
  month: number
): Promise<ReceivableInvoice[]> {
  const summaries = await listCrateReturnMonthlyInvoicesForMonth(year, month);

  return summaries
    .filter((row) => row.totalAmountMyr > 0)
    .sort((a, b) => (a.invoiceNo ?? "").localeCompare(b.invoiceNo ?? ""))
    .map((row) => ({
      invoiceType: "crate_return" as const,
      invoiceKey: `crate_return:${row.invoiceId}`,
      invoiceNo: row.invoiceNo,
      customerKey: buildReceivableCustomerKey("shipper", row.billToShipperId),
      customerKind: "shipper" as const,
      customerId: row.billToShipperId,
      customerCode: row.billToCode,
      customerName: row.billToName,
      yearMonth: row.yearMonth,
      sortDate: `${row.yearMonth}-01`,
      currency: "MYR" as const,
      issuerKey: "haidee" as const,
      totalAmount: row.totalAmountMyr,
      sourceMeta: {
        crateType: row.crateType,
        billToKind: "shipper",
      },
      printHref: `/documents/crate-return-invoice/print?year=${row.year}&month=${row.month}&crateType=${encodeURIComponent(row.crateType)}`,
    }));
}

function charterMonthDateRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = new Date(Date.UTC(year, month - 1, lastDay));
  return { start, end };
}

function resolveCharterReceivableCustomer(
  row: {
    shipper: { id: string; code: string; name: string } | null;
    billToCustomerName: string | null;
  },
  invoice: ReturnType<typeof buildCharterInvoiceFromTrip>
): Pick<
  ReceivableInvoice,
  | "customerKey"
  | "customerKind"
  | "customerId"
  | "customerCode"
  | "customerName"
> {
  if (row.shipper) {
    return {
      customerKey: buildReceivableCustomerKey("shipper", row.shipper.id),
      customerKind: "shipper",
      customerId: row.shipper.id,
      customerCode: row.shipper.code,
      customerName: row.shipper.name,
    };
  }

  const manual = row.billToCustomerName?.trim() || invoice.billTo.name;
  return {
    customerKey: buildReceivableCustomerKey("charter_manual", manual),
    customerKind: "charter_manual",
    customerId: null,
    customerCode: null,
    customerName: manual,
  };
}

export async function loadCharterReceivableInvoicesForMonth(
  year: number,
  month: number
): Promise<ReceivableInvoice[]> {
  const { start, end } = charterMonthDateRange(year, month);
  const rows = await prisma.charterTrip.findMany({
    where: { date: { gte: start, lte: end } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: {
      truck: { select: { plate: true } },
      shipper: { select: { id: true, code: true, name: true, location: true } },
      extraItems: {
        where: { itemType: "revenue" },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
    },
  });

  const invoices: ReceivableInvoice[] = [];

  for (const row of rows) {
    if (!isCharterCargoType(row.cargoType)) continue;
    if (!isCharterBillingCompany(row.billingCompany)) continue;

    const invoice = buildCharterInvoiceFromTrip(row);
    if (invoice.grandTotalMyr <= 0) continue;

    const tripDate = row.date.toISOString().slice(0, 10);
    const yearMonth = tripDate.slice(0, 7);
    const issuerKey: ReceivableIssuerKey =
      row.billingCompany === "wtl" ? "wtl" : "haidee";

    const customer = resolveCharterReceivableCustomer(row, invoice);

    invoices.push({
      invoiceType: "charter",
      invoiceKey: `charter:${row.id}`,
      invoiceNo: invoice.charterNo,
      ...customer,
      yearMonth,
      sortDate: tripDate,
      currency: "MYR",
      issuerKey,
      totalAmount: invoice.grandTotalMyr,
      sourceMeta: {
        charterNo: invoice.charterNo,
        billingCompany: row.billingCompany,
        billToKind: customer.customerKind,
      },
      printHref: `/charter/${row.id}/invoice?returnTo=${encodeURIComponent("/financial/invoice-collections")}`,
    });
  }

  return invoices;
}

export function iterateYearMonths(
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number
): Array<{ year: number; month: number }> {
  const items: Array<{ year: number; month: number }> = [];
  let year = fromYear;
  let month = fromMonth;

  while (year < toYear || (year === toYear && month <= toMonth)) {
    items.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return items;
}

export async function loadReceivableInvoicesForMonth(
  year: number,
  month: number
): Promise<ReceivableInvoice[]> {
  const [freight, crateReturn, charter] = await Promise.all([
    loadFreightReceivableInvoicesForMonth(year, month),
    loadCrateReturnReceivableInvoicesForMonth(year, month),
    loadCharterReceivableInvoicesForMonth(year, month),
  ]);

  return [...freight, ...crateReturn, ...charter].sort(compareReceivableInvoices);
}

export async function loadReceivableInvoicesForRange(input: {
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
}): Promise<ReceivableInvoice[]> {
  const months = iterateYearMonths(
    input.fromYear,
    input.fromMonth,
    input.toYear,
    input.toMonth
  );

  const monthlyBatches = await Promise.all(
    months.map(({ year, month }) => loadReceivableInvoicesForMonth(year, month))
  );

  return monthlyBatches.flat().sort(compareReceivableInvoices);
}

export function filterReceivableInvoicesForLedger(
  invoices: ReceivableInvoice[],
  customerKey: string,
  currency: ReceivableCurrency
): ReceivableInvoice[] {
  return invoices
    .filter(
      (invoice) =>
        invoice.customerKey === customerKey && invoice.currency === currency
    )
    .sort(compareReceivableInvoices);
}

export function formatReceivableInvoiceTypeLabel(
  invoiceType: ReceivableInvoiceType
): string {
  switch (invoiceType) {
    case "freight":
      return "车力";
    case "crate_return":
      return "回收桶";
    case "charter":
      return "包车";
    default:
      return invoiceType;
  }
}

export function formatCharterCustomerDisplayName(
  invoice: Pick<ReceivableInvoice, "customerName" | "customerCode">
): string {
  if (invoice.customerCode) {
    return formatCharterBillToDisplayLabel({
      code: invoice.customerCode,
      name: invoice.customerName,
      location: null,
      source: "shipper",
    });
  }
  return invoice.customerName;
}
