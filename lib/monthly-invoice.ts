import { formatDisplayDate } from "@/lib/date-utils";
import type {
  MonthlyInvoiceBillTo,
  MonthlyInvoiceModeConfig,
} from "@/lib/constants/monthly-invoice";
import { getMarketDisplayName } from "@/lib/constants/market-names";
import { getStallDisplayLabel } from "@/lib/markets";

export interface MonthlyInvoiceLineItem {
  date: string;
  dateLabel: string;
  stallLabel: string;
  marketCode: string;
  marketLabel: string;
  tongTypeCode: string;
  quantity: number;
  unitRate: number;
  subtotal: number;
  isBox: boolean;
}

export interface MonthlyInvoiceSection {
  kind: "tong" | "box";
  title: string;
  lines: MonthlyInvoiceLineItem[];
  totalQty: number;
  totalAmount: number;
}

export interface MonthlyInvoiceCustomerSummary {
  customerId: string;
  customerCode: string;
  customerName: string;
  tongQty: number;
  boxQty: number;
  tongAmount: number;
  boxAmount: number;
  grandTotal: number;
  lineCount: number;
}

export interface MonthlyInvoiceData {
  mode: MonthlyInvoiceModeConfig;
  year: number;
  month: number;
  periodLabel: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  currency: string;
  sections: MonthlyInvoiceSection[];
  grandTotalQty: number;
  grandTotalAmount: number;
}

interface RawInvoiceLine {
  sessionDate: Date;
  stallMarketCode: string;
  stallCode: string;
  stallName: string | null;
  tongTypeCode: string;
  quantity: number;
  freightRate: number | null;
  freightAmount: number | null;
  isBox: boolean;
  shipperId: string;
  shipperCode: string;
  shipperName: string;
  consigneeId: string | null;
  consigneeCode: string | null;
  consigneeName: string | null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function resolveCustomerKey(
  line: RawInvoiceLine,
  billTo: MonthlyInvoiceBillTo
): { id: string; code: string; name: string } | null {
  if (billTo === "shipper") {
    return {
      id: line.shipperId,
      code: line.shipperCode,
      name: line.shipperName,
    };
  }
  if (!line.consigneeId) return null;
  return {
    id: line.consigneeId,
    code: line.consigneeCode ?? line.consigneeId,
    name: line.consigneeName ?? line.consigneeCode ?? "Unknown",
  };
}

function toLineItem(line: RawInvoiceLine): MonthlyInvoiceLineItem | null {
  if (
    line.freightAmount == null ||
    line.freightAmount <= 0 ||
    line.freightRate == null
  ) {
    return null;
  }

  return {
    date: line.sessionDate.toISOString(),
    dateLabel: formatDisplayDate(line.sessionDate),
    stallLabel: getStallDisplayLabel(
      line.stallMarketCode,
      line.stallCode,
      line.stallName
    ),
    marketCode: line.stallMarketCode,
    marketLabel: getMarketDisplayName(line.stallMarketCode),
    tongTypeCode: line.tongTypeCode,
    quantity: line.quantity,
    unitRate: line.freightRate,
    subtotal: roundMoney(line.freightAmount),
    isBox: line.isBox,
  };
}

function buildSection(
  kind: "tong" | "box",
  lines: MonthlyInvoiceLineItem[]
): MonthlyInvoiceSection | null {
  const filtered = lines.filter((line) =>
    kind === "box" ? line.isBox : !line.isBox
  );
  if (filtered.length === 0) return null;

  return {
    kind,
    title: kind === "box" ? "箱子 BOX" : "桶 Tong / Crates",
    lines: filtered,
    totalQty: filtered.reduce((sum, line) => sum + line.quantity, 0),
    totalAmount: roundMoney(
      filtered.reduce((sum, line) => sum + line.subtotal, 0)
    ),
  };
}

export function buildMonthlyInvoiceCustomerSummaries(
  rawLines: RawInvoiceLine[],
  mode: MonthlyInvoiceModeConfig
): MonthlyInvoiceCustomerSummary[] {
  const map = new Map<string, MonthlyInvoiceCustomerSummary>();

  for (const raw of rawLines) {
    const customer = resolveCustomerKey(raw, mode.billTo);
    const item = toLineItem(raw);
    if (!customer || !item) continue;

    const existing = map.get(customer.id);
    if (!existing) {
      map.set(customer.id, {
        customerId: customer.id,
        customerCode: customer.code,
        customerName: customer.name,
        tongQty: item.isBox ? 0 : item.quantity,
        boxQty: item.isBox ? item.quantity : 0,
        tongAmount: item.isBox ? 0 : item.subtotal,
        boxAmount: item.isBox ? item.subtotal : 0,
        grandTotal: item.subtotal,
        lineCount: 1,
      });
      continue;
    }

    if (item.isBox) {
      existing.boxQty += item.quantity;
      existing.boxAmount = roundMoney(existing.boxAmount + item.subtotal);
    } else {
      existing.tongQty += item.quantity;
      existing.tongAmount = roundMoney(existing.tongAmount + item.subtotal);
    }
    existing.grandTotal = roundMoney(existing.grandTotal + item.subtotal);
    existing.lineCount += 1;
  }

  return Array.from(map.values()).sort((a, b) =>
    a.customerName.localeCompare(b.customerName)
  );
}

export function buildMonthlyInvoiceData(input: {
  mode: MonthlyInvoiceModeConfig;
  year: number;
  month: number;
  periodLabel: string;
  customerId: string;
  rawLines: RawInvoiceLine[];
}): MonthlyInvoiceData | null {
  const customerLines = input.rawLines
    .map((raw) => {
      const customer = resolveCustomerKey(raw, input.mode.billTo);
      if (!customer || customer.id !== input.customerId) return null;
      return toLineItem(raw);
    })
    .filter((item): item is MonthlyInvoiceLineItem => item != null)
    .sort((a, b) => {
      const dateCompare = a.dateLabel.localeCompare(b.dateLabel);
      if (dateCompare !== 0) return dateCompare;
      return a.stallLabel.localeCompare(b.stallLabel);
    });

  if (customerLines.length === 0) return null;

  const matchingRaw = input.rawLines.find((raw) => {
    const resolved = resolveCustomerKey(raw, input.mode.billTo);
    return resolved?.id === input.customerId;
  });
  if (!matchingRaw) return null;

  const customer = resolveCustomerKey(matchingRaw, input.mode.billTo);
  if (!customer) return null;

  const sections = [
    buildSection("tong", customerLines),
    buildSection("box", customerLines),
  ].filter((section): section is MonthlyInvoiceSection => section != null);

  const grandTotalAmount = roundMoney(
    sections.reduce((sum, section) => sum + section.totalAmount, 0)
  );
  const grandTotalQty = sections.reduce(
    (sum, section) => sum + section.totalQty,
    0
  );

  return {
    mode: input.mode,
    year: input.year,
    month: input.month,
    periodLabel: input.periodLabel,
    customerId: customer.id,
    customerCode: customer.code,
    customerName: customer.name,
    currency: input.mode.currency,
    sections,
    grandTotalQty,
    grandTotalAmount,
  };
}

export type { RawInvoiceLine };
