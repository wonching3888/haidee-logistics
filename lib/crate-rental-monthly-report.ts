import { isOtherMarket } from "@/lib/markets";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import {
  listCrateRentalRates,
  type CrateRentalRateRow,
} from "@/lib/crate-rental-rates-service";
import {
  computeCrateRentalLineCostMyr,
  resolveCrateRentalMyrPerUnit,
  type CrateRentalCurrency,
} from "@/lib/crate-rental-cost";
import { loadExchangeRate } from "@/lib/exchange-rate";
import { sortCrateRentalRates } from "@/lib/constants/crate-rental-rates";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export interface CrateRentalCharterDetail {
  shipperLabel: string;
  charterNo: string | null;
  quantity: number;
}

export interface CrateRentalMonthlyRow {
  crateType: string;
  isRental: boolean;
  quantity: number;
  dispatchQuantity: number;
  charterQuantity: number;
  rate: number;
  currency: CrateRentalCurrency;
  amountOriginal: number;
  amountMyr: number;
  notes: string | null;
}

export interface CrateRentalMonthlyReport {
  year: number;
  month: number;
  yearMonth: string;
  exchangeRate: number;
  rows: CrateRentalMonthlyRow[];
  totals: {
    quantity: number;
    dispatchQuantity: number;
    charterQuantity: number;
    amountMyr: number;
  };
}

export interface CrateRentalQuantityBreakdown {
  dispatchByType: Map<string, number>;
  charterByType: Map<string, number>;
  charterDetailsByType: Map<string, CrateRentalCharterDetail[]>;
}

function formatCharterShipperLabel(trip: {
  shipper: { code: string; name: string } | null;
  billToCustomerName: string | null;
}): string {
  if (trip.shipper) {
    return `${trip.shipper.name} (${trip.shipper.code})`;
  }
  const manual = trip.billToCustomerName?.trim();
  return manual || "未指定客户";
}

function charterTripHasRevenue(trip: {
  charterRevenueMyr: unknown;
  totalQuantity: number | null;
  extraItems: Array<{ itemType: string; amountMyr: unknown }>;
}): boolean {
  const totalQuantity = trip.totalQuantity ?? 0;
  if (totalQuantity <= 0) return false;

  const baseRevenue = decimalToNumber(trip.charterRevenueMyr) ?? 0;
  let extraRevenueMyr = 0;
  for (const item of trip.extraItems) {
    if (item.itemType !== "revenue") continue;
    extraRevenueMyr += decimalToNumber(item.amountMyr) ?? 0;
  }

  return baseRevenue + extraRevenueMyr > 0;
}

export function buildCharterRentalNote(
  details: CrateRentalCharterDetail[]
): string | null {
  if (details.length === 0) return null;

  const total = details.reduce((sum, detail) => sum + detail.quantity, 0);
  const tripParts = details.map((detail) => {
    const tripRef = detail.charterNo
      ? `${detail.shipperLabel} · ${detail.charterNo}`
      : detail.shipperLabel;
    return `${tripRef} ${detail.quantity}桶`;
  });

  return `其中包车 ${total} 桶（${tripParts.join("；")}）`;
}

async function aggregateDispatchCrateRentalQuantities(
  year: number,
  month: number
): Promise<Map<string, number>> {
  const { start, end } = getMonthDateRange(year, month);
  const dispatches = await prisma.dispatchOrder.findMany({
    where: {
      status: { not: "cancelled" },
      date: { gte: start, lte: end },
    },
    select: {
      lines: {
        select: {
          inboundLine: {
            select: {
              quantity: true,
              tongType: { select: { code: true } },
              stall: { select: { market: { select: { code: true } } } },
            },
          },
        },
      },
    },
  });

  const quantityByType = new Map<string, number>();
  for (const dispatch of dispatches) {
    for (const line of dispatch.lines) {
      const inboundLine = line.inboundLine;
      if (!inboundLine?.tongType?.code) continue;

      const marketCode = inboundLine.stall?.market?.code;
      if (!marketCode || isOtherMarket(marketCode)) continue;

      const quantity = decimalToNumber(inboundLine.quantity) ?? 0;
      if (quantity <= 0) continue;

      const crateType = inboundLine.tongType.code;
      quantityByType.set(
        crateType,
        (quantityByType.get(crateType) ?? 0) + quantity
      );
    }
  }

  return quantityByType;
}

async function aggregateCharterCrateRentalQuantities(
  year: number,
  month: number,
  rentalCrateTypes: Set<string>
): Promise<{
  charterByType: Map<string, number>;
  charterDetailsByType: Map<string, CrateRentalCharterDetail[]>;
}> {
  const { start, end } = getMonthDateRange(year, month);
  const trips = await prisma.charterTrip.findMany({
    where: { date: { gte: start, lte: end } },
    select: {
      charterNo: true,
      charterRevenueMyr: true,
      totalQuantity: true,
      billToCustomerName: true,
      shipper: { select: { code: true, name: true } },
      extraItems: {
        select: { itemType: true, amountMyr: true },
      },
      lines: {
        select: {
          quantity: true,
          tongType: { select: { code: true } },
        },
      },
    },
  });

  const charterByType = new Map<string, number>();
  const charterDetailsByType = new Map<string, CrateRentalCharterDetail[]>();

  for (const trip of trips) {
    if (!charterTripHasRevenue(trip)) continue;

    const shipperLabel = formatCharterShipperLabel(trip);

    for (const line of trip.lines) {
      if (line.quantity <= 0) continue;

      const crateType = line.tongType.code;
      if (!rentalCrateTypes.has(crateType)) continue;

      charterByType.set(
        crateType,
        (charterByType.get(crateType) ?? 0) + line.quantity
      );

      const details = charterDetailsByType.get(crateType) ?? [];
      details.push({
        shipperLabel,
        charterNo: trip.charterNo,
        quantity: line.quantity,
      });
      charterDetailsByType.set(crateType, details);
    }
  }

  return { charterByType, charterDetailsByType };
}

export async function aggregateCrateRentalQuantities(
  year: number,
  month: number,
  rentalCrateTypes: Set<string>
): Promise<CrateRentalQuantityBreakdown> {
  const [dispatchByType, charterAgg] = await Promise.all([
    aggregateDispatchCrateRentalQuantities(year, month),
    aggregateCharterCrateRentalQuantities(year, month, rentalCrateTypes),
  ]);

  return {
    dispatchByType,
    charterByType: charterAgg.charterByType,
    charterDetailsByType: charterAgg.charterDetailsByType,
  };
}

function buildMonthlyRow(
  rateRow: CrateRentalRateRow,
  dispatchQuantity: number,
  charterQuantity: number,
  charterDetails: CrateRentalCharterDetail[],
  exchangeRate: number
): CrateRentalMonthlyRow {
  const quantity = dispatchQuantity + charterQuantity;
  const ratePerUnitMyr = resolveCrateRentalMyrPerUnit(
    rateRow.rate,
    rateRow.currency,
    exchangeRate
  );
  const amountOriginal =
    rateRow.isRental && rateRow.rate > 0 && quantity > 0
      ? roundMoney(quantity * rateRow.rate)
      : 0;
  const amountMyr = computeCrateRentalLineCostMyr(quantity, ratePerUnitMyr);
  const charterNote = buildCharterRentalNote(charterDetails);
  const notes = [rateRow.notes, charterNote].filter(Boolean).join(" · ") || null;

  return {
    crateType: rateRow.crateType,
    isRental: rateRow.isRental,
    quantity,
    dispatchQuantity,
    charterQuantity,
    rate: rateRow.rate,
    currency: rateRow.currency,
    amountOriginal,
    amountMyr,
    notes,
  };
}

export async function buildCrateRentalMonthlyReport(
  year: number,
  month: number
): Promise<CrateRentalMonthlyReport> {
  const rates = await listCrateRentalRates();
  const rentalCrateTypes = new Set(
    rates.filter((row) => row.isRental).map((row) => row.crateType)
  );

  const [exchangeRate, breakdown] = await Promise.all([
    loadExchangeRate(year, month),
    aggregateCrateRentalQuantities(year, month, rentalCrateTypes),
  ]);

  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
  const rows = sortCrateRentalRates(
    rates.map((rateRow) =>
      buildMonthlyRow(
        rateRow,
        breakdown.dispatchByType.get(rateRow.crateType) ?? 0,
        breakdown.charterByType.get(rateRow.crateType) ?? 0,
        breakdown.charterDetailsByType.get(rateRow.crateType) ?? [],
        exchangeRate
      )
    )
  ).filter((row) => row.isRental);

  const totals = rows.reduce(
    (acc, row) => ({
      quantity: acc.quantity + row.quantity,
      dispatchQuantity: acc.dispatchQuantity + row.dispatchQuantity,
      charterQuantity: acc.charterQuantity + row.charterQuantity,
      amountMyr: roundMoney(acc.amountMyr + row.amountMyr),
    }),
    { quantity: 0, dispatchQuantity: 0, charterQuantity: 0, amountMyr: 0 }
  );

  return {
    year,
    month,
    yearMonth,
    exchangeRate,
    rows,
    totals,
  };
}
