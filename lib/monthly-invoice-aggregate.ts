import { formatDisplayDate } from "@/lib/date-utils";
import {
  getInvoiceRouteLabel,
  INVOICE_ROUTE_MARKET_CODES,
  INVOICE_TH_SEGMENT_ROUTE_LABEL,
} from "@/lib/constants/invoice-route-labels";
import type { RawInvoiceLine } from "@/lib/monthly-invoice";
import { splitWtlSst } from "@/lib/wtl-sst";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export interface AggregatedInvoiceRow {
  segment: "TH" | "MY";
  routeLabel: string;
  marketCode?: string;
  taxCode: string | null;
  quantity: number;
  unitRate: number;
  /** TH: amount (no SST). MY: inclusive-of-SST subtotal for the row. */
  amount: number;
}

export interface AggregatedInvoiceSection {
  kind: "tong" | "box";
  title: string;
  thRow: AggregatedInvoiceRow | null;
  myRows: AggregatedInvoiceRow[];
  thTotalAmount: number;
  myInclusiveTotal: number;
  totalAmount: number;
  totalQty: number;
}

export interface AggregatedTaxInvoiceTotals {
  subTotalExcludingTax: number;
  sstBase: number;
  sstAmount: number;
  totalInclusive: number;
}

export interface AggregatedInvoiceData {
  sections: AggregatedInvoiceSection[];
  grandTotalQty: number;
  grandTotalAmount: number;
  grandThTotalAmount: number;
  grandMyInclusiveTotal: number;
  totals: AggregatedTaxInvoiceTotals;
  taxSummary: {
    sstBase: number;
    sstAmount: number;
  };
}

export interface InvoiceListingColumn {
  marketCode: string;
  header: string;
}

export interface InvoiceListingRow {
  dateKey: string;
  dateLabel: string;
  values: Record<string, number>;
  rowTotal: number;
}

export interface InvoiceListingSection {
  kind: "tong" | "box";
  title: string;
  columns: InvoiceListingColumn[];
  rows: InvoiceListingRow[];
  columnTotals: Record<string, number>;
  grandTotal: number;
}

export interface InvoiceListingData {
  sections: InvoiceListingSection[];
}

interface BillableRawLine {
  sessionDate: Date;
  marketCode: string;
  quantity: number;
  freightAmount: number;
  thFreightAmount: number;
  myFreightAmount: number;
  isBox: boolean;
}

export type InvoiceSegmentMapping = "default" | "mode3";

export interface AggregateInvoiceLinesOptions {
  segmentMapping?: InvoiceSegmentMapping;
}

function toBillableRawLine(
  line: RawInvoiceLine,
  segmentMapping: InvoiceSegmentMapping = "default"
): BillableRawLine | null {
  if (segmentMapping === "mode3") {
    if (line.freightAmount == null || line.freightAmount <= 0) {
      return null;
    }

    const thFreightAmount = roundMoney(line.thFreightAmount ?? 0);
    const myFreightAmount = roundMoney(
      line.mySegmentFreightAmount ?? line.freightAmount ?? 0
    );

    return {
      sessionDate: line.sessionDate,
      marketCode: line.stallMarketCode,
      quantity: line.quantity,
      freightAmount: roundMoney(thFreightAmount + myFreightAmount),
      thFreightAmount,
      myFreightAmount,
      isBox: line.isBox,
    };
  }

  if (line.freightAmount == null || line.freightAmount <= 0) {
    return null;
  }

  return {
    sessionDate: line.sessionDate,
    marketCode: line.stallMarketCode,
    quantity: line.quantity,
    freightAmount: roundMoney(line.freightAmount),
    thFreightAmount: roundMoney(line.thFreightAmount ?? 0),
    myFreightAmount: roundMoney(line.mySegmentFreightAmount ?? 0),
    isBox: line.isBox,
  };
}

function marketSortIndex(marketCode: string): number {
  const index = INVOICE_ROUTE_MARKET_CODES.indexOf(
    marketCode as (typeof INVOICE_ROUTE_MARKET_CODES)[number]
  );
  return index === -1 ? INVOICE_ROUTE_MARKET_CODES.length : index;
}

function buildAggregatedSection(
  kind: "tong" | "box",
  lines: BillableRawLine[]
): AggregatedInvoiceSection | null {
  const filtered = lines.filter((line) =>
    kind === "box" ? line.isBox : !line.isBox
  );
  if (filtered.length === 0) return null;

  const thQty = filtered.reduce((sum, line) => sum + line.quantity, 0);
  const thTotalAmount = roundMoney(
    filtered.reduce((sum, line) => sum + line.thFreightAmount, 0)
  );

  const thRow: AggregatedInvoiceRow | null =
    thTotalAmount > 0 && thQty > 0
      ? {
          segment: "TH",
          routeLabel: INVOICE_TH_SEGMENT_ROUTE_LABEL,
          taxCode: null,
          quantity: thQty,
          unitRate: thQty > 0 ? roundMoney(thTotalAmount / thQty) : 0,
          amount: thTotalAmount,
        }
      : null;

  const myByMarket = new Map<
    string,
    { quantity: number; inclusiveAmount: number }
  >();

  for (const line of filtered) {
    if (!line.marketCode) continue;
    const existing = myByMarket.get(line.marketCode) ?? {
      quantity: 0,
      inclusiveAmount: 0,
    };
    existing.quantity += line.quantity;
    existing.inclusiveAmount = roundMoney(
      existing.inclusiveAmount + line.myFreightAmount
    );
    myByMarket.set(line.marketCode, existing);
  }

  const myRows: AggregatedInvoiceRow[] = Array.from(myByMarket.entries())
    .filter(([, bucket]) => bucket.quantity > 0 || bucket.inclusiveAmount > 0)
    .sort(
      ([marketA], [marketB]) =>
        marketSortIndex(marketA) - marketSortIndex(marketB)
    )
    .map(([marketCode, bucket]) => ({
      segment: "MY" as const,
      routeLabel: getInvoiceRouteLabel(marketCode),
      marketCode,
      taxCode: "SV-6",
      quantity: bucket.quantity,
      unitRate:
        bucket.quantity > 0
          ? roundMoney(bucket.inclusiveAmount / bucket.quantity)
          : 0,
      amount: bucket.inclusiveAmount,
    }));

  const myInclusiveTotal = roundMoney(
    myRows.reduce((sum, row) => sum + row.amount, 0)
  );
  const totalAmount = roundMoney(thTotalAmount + myInclusiveTotal);
  const totalQty = filtered.reduce((sum, line) => sum + line.quantity, 0);

  return {
    kind,
    title: kind === "box" ? "箱子 BOX" : "桶 Tong / Crates",
    thRow,
    myRows,
    thTotalAmount,
    myInclusiveTotal,
    totalAmount,
    totalQty,
  };
}

/**
 * Aggregate raw invoice lines into TH summary + MY per-market rows for Tax Invoice.
 */
export function aggregateInvoiceLines(
  rawLines: RawInvoiceLine[],
  options?: AggregateInvoiceLinesOptions
): AggregatedInvoiceData {
  const segmentMapping = options?.segmentMapping ?? "default";
  const billable = rawLines
    .map((line) => toBillableRawLine(line, segmentMapping))
    .filter((line): line is BillableRawLine => line != null);

  const sections = [
    buildAggregatedSection("tong", billable),
    buildAggregatedSection("box", billable),
  ].filter((section): section is AggregatedInvoiceSection => section != null);

  const grandTotalAmount = roundMoney(
    sections.reduce((sum, section) => sum + section.totalAmount, 0)
  );
  const grandTotalQty = sections.reduce(
    (sum, section) => sum + section.totalQty,
    0
  );
  const grandThTotalAmount = roundMoney(
    sections.reduce((sum, section) => sum + section.thTotalAmount, 0)
  );
  const grandMyInclusiveTotal = roundMoney(
    sections.reduce((sum, section) => sum + section.myInclusiveTotal, 0)
  );

  const { exTax: myExTax, sst: sstAmount } = splitWtlSst(grandMyInclusiveTotal);
  const subTotalExcludingTax = roundMoney(grandThTotalAmount + myExTax);
  const totalInclusive = grandTotalAmount;

  return {
    sections,
    grandTotalQty,
    grandTotalAmount,
    grandThTotalAmount,
    grandMyInclusiveTotal,
    totals: {
      subTotalExcludingTax,
      sstBase: myExTax,
      sstAmount,
      totalInclusive,
    },
    taxSummary: {
      sstBase: myExTax,
      sstAmount,
    },
  };
}

function buildListingColumns(
  marketCodes: Iterable<string>
): InvoiceListingColumn[] {
  const unique = new Set(marketCodes);
  return INVOICE_ROUTE_MARKET_CODES.filter((code) => unique.has(code)).map(
    (marketCode) => ({
      marketCode,
      header: marketCode,
    })
  );
}

function buildListingSection(
  kind: "tong" | "box",
  lines: BillableRawLine[]
): InvoiceListingSection | null {
  const filtered = lines.filter((line) =>
    kind === "box" ? line.isBox : !line.isBox
  );
  if (filtered.length === 0) return null;

  const marketCodes = new Set(
    filtered.map((line) => line.marketCode).filter(Boolean)
  );
  const columns = buildListingColumns(marketCodes);
  if (columns.length === 0) return null;

  const byDate = new Map<string, InvoiceListingRow>();

  for (const line of filtered) {
    if (!line.marketCode) continue;
    const dateKey = line.sessionDate.toISOString().slice(0, 10);
    const existing = byDate.get(dateKey) ?? {
      dateKey,
      dateLabel: formatDisplayDate(line.sessionDate),
      values: Object.fromEntries(columns.map((col) => [col.marketCode, 0])),
      rowTotal: 0,
    };
    existing.values[line.marketCode] =
      (existing.values[line.marketCode] ?? 0) + line.quantity;
    existing.rowTotal += line.quantity;
    byDate.set(dateKey, existing);
  }

  const rows = Array.from(byDate.values()).sort((a, b) =>
    a.dateKey.localeCompare(b.dateKey)
  );

  const columnTotals = Object.fromEntries(
    columns.map((col) => [
      col.marketCode,
      rows.reduce((sum, row) => sum + (row.values[col.marketCode] ?? 0), 0),
    ])
  );
  const grandTotal = rows.reduce((sum, row) => sum + row.rowTotal, 0);

  return {
    kind,
    title: kind === "box" ? "箱子 BOX" : "桶 Tong / Crates",
    columns,
    rows,
    columnTotals,
    grandTotal,
  };
}

/**
 * Build date × market listing matrix from the same raw lines used for Tax Invoice.
 */
export function buildInvoiceListing(
  rawLines: RawInvoiceLine[],
  options?: AggregateInvoiceLinesOptions
): InvoiceListingData {
  const segmentMapping = options?.segmentMapping ?? "default";
  const billable = rawLines
    .map((line) => toBillableRawLine(line, segmentMapping))
    .filter((line): line is BillableRawLine => line != null);

  const sections = [
    buildListingSection("tong", billable),
    buildListingSection("box", billable),
  ].filter((section): section is InvoiceListingSection => section != null);

  return { sections };
}
