import { decimalToNumber } from "@/lib/freight-rates";
import { splitWtlSst } from "@/lib/wtl-sst";
import {
  charterCargoTypeLabel,
  isCharterBillingCompany,
  type CharterBillingCompany,
  type CharterCargoType,
} from "@/lib/charter";
import { formatDisplayDate } from "@/lib/date-utils";

export type { CharterBillingCompany };

export interface CharterInvoiceLine {
  description: string;
  amountMyr: number;
}

export interface CharterInvoiceBillTo {
  code: string | null;
  name: string;
  location: string | null;
  source: "shipper" | "manual";
}

export function formatCharterBillToDisplayLabel(billTo: CharterInvoiceBillTo): string {
  if (billTo.code) {
    return `${billTo.name} (${billTo.code})`;
  }
  return billTo.name;
}

export interface CharterInvoiceData {
  charterTripId: string;
  charterNo: string;
  date: string;
  dateLabel: string;
  billingCompany: CharterBillingCompany;
  currency: "MYR";
  billTo: CharterInvoiceBillTo;
  /** Subtitle / list display: 名字 (代码) when code exists */
  billToDisplayLabel: string;
  truckPlate: string;
  driverName: string | null;
  cargoTypeLabel: string;
  lines: CharterInvoiceLine[];
  grandTotalMyr: number;
  wtlSst?: {
    subTotalExTax: number;
    sstAmount: number;
    totalInclusive: number;
  };
}

export function buildCharterInvoiceFromTrip(trip: {
  id: string;
  charterNo: string | null;
  date: Date;
  billingCompany: string;
  billToCustomerName: string | null;
  driverName: string | null;
  cargoType: string;
  charterRevenueMyr: unknown;
  truck: { plate: string };
  shipper: { code: string; name: string; location: string | null } | null;
  extraItems: Array<{
    itemType: string;
    amountMyr: unknown;
    note: string | null;
    sortOrder: number;
  }>;
}): CharterInvoiceData {
  if (!isCharterBillingCompany(trip.billingCompany)) {
    throw new Error("无效的开票主体 Invalid billing company");
  }

  const charterNo = trip.charterNo ?? trip.id.slice(0, 8);
  const revenue = decimalToNumber(trip.charterRevenueMyr) ?? 0;
  const dateStr = trip.date.toISOString().slice(0, 10);
  const cargoType = trip.cargoType as CharterCargoType;

  const billTo = resolveCharterInvoiceBillTo(trip);
  if (!billTo) {
    throw new Error(
      "请填写 Bill To 客户名或选择寄货人 Bill To requires shipper or customer name"
    );
  }

  const extraRevenue = trip.extraItems
    .filter((item) => item.itemType === "revenue")
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const lines: CharterInvoiceLine[] = [
    {
      description: `Charter service 包车服务 — ${dateStr} · ${trip.truck.plate}`,
      amountMyr: revenue,
    },
    ...extraRevenue.map((item) => ({
      description: item.note?.trim() || "Extra charge 额外收费",
      amountMyr: decimalToNumber(item.amountMyr) ?? 0,
    })),
  ].filter((line) => line.amountMyr > 0);

  const grandTotalMyr = roundMoney(
    lines.reduce((sum, line) => sum + line.amountMyr, 0)
  );

  const data: CharterInvoiceData = {
    charterTripId: trip.id,
    charterNo,
    date: dateStr,
    dateLabel: formatDisplayDate(trip.date),
    billingCompany: trip.billingCompany,
    currency: "MYR",
    billTo,
    billToDisplayLabel: formatCharterBillToDisplayLabel(billTo),
    truckPlate: trip.truck.plate,
    driverName: trip.driverName,
    cargoTypeLabel: charterCargoTypeLabel(cargoType),
    lines,
    grandTotalMyr,
  };

  if (trip.billingCompany === "wtl") {
    const split = splitWtlSst(grandTotalMyr);
    data.wtlSst = {
      subTotalExTax: split.exTax,
      sstAmount: split.sst,
      totalInclusive: split.inclusive,
    };
  }

  return data;
}

function resolveCharterInvoiceBillTo(trip: {
  shipper: { code: string; name: string; location: string | null } | null;
  billToCustomerName: string | null;
}): CharterInvoiceBillTo | null {
  if (trip.shipper) {
    return {
      code: trip.shipper.code,
      name: trip.shipper.name,
      location: trip.shipper.location,
      source: "shipper",
    };
  }

  const manual = trip.billToCustomerName?.trim();
  if (manual) {
    return {
      code: null,
      name: manual,
      location: null,
      source: "manual",
    };
  }

  return null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
