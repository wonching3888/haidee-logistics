import { getInvoiceMarketShortName } from "@/lib/constants/invoice-route-labels";
import { INVOICE_ROUTE_MARKET_CODES } from "@/lib/constants/invoice-route-labels";
import type { RawInvoiceLine } from "@/lib/monthly-invoice";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export interface HaideeAggregatedRow {
  marketCode: string;
  marketLabel: string;
  quantity: number;
  unitRate: number;
  amount: number;
}

export interface HaideeAggregatedSection {
  kind: "tong" | "box";
  title: string;
  rows: HaideeAggregatedRow[];
  totalQty: number;
  totalAmount: number;
}

export interface HaideeAggregatedInvoiceData {
  sections: HaideeAggregatedSection[];
  grandTotalQty: number;
  grandTotalAmount: number;
}

function marketSortIndex(marketCode: string): number {
  const index = INVOICE_ROUTE_MARKET_CODES.indexOf(
    marketCode as (typeof INVOICE_ROUTE_MARKET_CODES)[number]
  );
  return index === -1 ? INVOICE_ROUTE_MARKET_CODES.length : index;
}

function buildHaideeSection(
  kind: "tong" | "box",
  lines: RawInvoiceLine[]
): HaideeAggregatedSection | null {
  const filtered = lines.filter((line) =>
    kind === "box" ? line.isBox : !line.isBox
  );
  if (filtered.length === 0) return null;

  const byMarket = new Map<string, { quantity: number; amount: number }>();

  for (const line of filtered) {
    if (!line.stallMarketCode) continue;
    if (line.freightAmount == null || line.freightAmount <= 0) continue;

    const existing = byMarket.get(line.stallMarketCode) ?? {
      quantity: 0,
      amount: 0,
    };
    existing.quantity += line.quantity;
    existing.amount = roundMoney(existing.amount + line.freightAmount);
    byMarket.set(line.stallMarketCode, existing);
  }

  const rows: HaideeAggregatedRow[] = Array.from(byMarket.entries())
    .filter(([, bucket]) => bucket.quantity > 0 || bucket.amount > 0)
    .sort(
      ([marketA], [marketB]) =>
        marketSortIndex(marketA) - marketSortIndex(marketB)
    )
    .map(([marketCode, bucket]) => ({
      marketCode,
      marketLabel: getInvoiceMarketShortName(marketCode),
      quantity: bucket.quantity,
      unitRate:
        bucket.quantity > 0
          ? roundMoney(bucket.amount / bucket.quantity)
          : 0,
      amount: bucket.amount,
    }));

  const totalQty = rows.reduce((sum, row) => sum + row.quantity, 0);
  const totalAmount = roundMoney(rows.reduce((sum, row) => sum + row.amount, 0));

  return {
    kind,
    title: kind === "box" ? "箱子 BOX" : "桶 Tong / Crates",
    rows,
    totalQty,
    totalAmount,
  };
}

/**
 * Aggregate Haidee invoice lines into per-market summary rows (no SST / TH-MY split).
 */
export function aggregateHaideeInvoiceLines(
  rawLines: RawInvoiceLine[]
): HaideeAggregatedInvoiceData {
  const billable = rawLines.filter(
    (line) => line.freightAmount != null && line.freightAmount > 0
  );

  const sections = [
    buildHaideeSection("tong", billable),
    buildHaideeSection("box", billable),
  ].filter((section): section is HaideeAggregatedSection => section != null);

  const grandTotalAmount = roundMoney(
    sections.reduce((sum, section) => sum + section.totalAmount, 0)
  );
  const grandTotalQty = sections.reduce(
    (sum, section) => sum + section.totalQty,
    0
  );

  return {
    sections,
    grandTotalQty,
    grandTotalAmount,
  };
}
