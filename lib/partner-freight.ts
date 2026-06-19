import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/freight-rates";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { formatDisplayDate } from "@/lib/date-utils";
import { getMarketDisplayName } from "@/lib/constants/market-names";
import { parseDateInput, toDateInputValue } from "@/lib/inbound-utils";

export interface PartnerFreightRateConfig {
  crateType: string;
  billToShipperId: string;
  billToShipperCode: string;
  billToShipperName: string;
  unitRateMyr: number;
  taxCode: string;
  taxRate: number;
}

export interface PartnerTripSummary {
  tripKey: string;
  tripDate: Date;
  tripDateInput: string;
  tripDateLabel: string;
  truckId: string;
  truckPlate: string;
  marketId: string;
  marketCode: string;
  marketLabel: string;
  crateType: string;
  quantity: number;
  unitRateMyr: number;
  amountMyr: number;
  taxCode: string;
  taxRate: number;
  billToShipperId: string;
  billToShipperCode: string;
  billToShipperName: string;
  invoiceNo: string | null;
  invoiceId: string | null;
}

export interface PartnerTripInvoicePrintData {
  invoiceNo: string;
  invoiceDate: string;
  invoiceDateLabel: string;
  currency: "MYR";
  billToCode: string;
  billToName: string;
  billToLocation: string | null;
  truckPlate: string;
  marketCode: string;
  marketLabel: string;
  lineDescription: string;
  crateType: string;
  quantity: number;
  unitRateMyr: number;
  amountMyr: number;
  taxCode: string;
  taxRate: number;
  taxAmountMyr: number;
  totalMyr: number;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatPartnerInvoiceNo(
  year: number,
  month: number,
  sequence: number
) {
  const yy = String(year).slice(-2);
  const mm = String(month).padStart(2, "0");
  return `EXP-${yy}${mm}-${String(sequence).padStart(3, "0")}`;
}

export function buildPartnerTripKey(input: {
  tripDateInput: string;
  truckId: string;
  marketId: string;
  crateType: string;
}) {
  return `${input.tripDateInput}|${input.truckId}|${input.marketId}|${input.crateType}`;
}

export async function loadActivePartnerFreightRates(): Promise<
  PartnerFreightRateConfig[]
> {
  const rows = await prisma.partnerFreightRate.findMany({
    where: { active: true },
    include: {
      billToShipper: { select: { id: true, code: true, name: true } },
    },
    orderBy: { crateType: "asc" },
  });

  return rows.map((row) => ({
    crateType: row.crateType,
    billToShipperId: row.billToShipperId,
    billToShipperCode: row.billToShipper.code,
    billToShipperName: row.billToShipper.name,
    unitRateMyr: decimalToNumber(row.unitRateMyr) ?? 0,
    taxCode: row.taxCode,
    taxRate: decimalToNumber(row.taxRate) ?? 0,
  }));
}

async function loadPartnerImportsForMonth(year: number, month: number) {
  const { start, end } = getMonthDateRange(year, month);
  const rates = await loadActivePartnerFreightRates();
  if (rates.length === 0) return [];

  const crateTypes = rates.map((rate) => rate.crateType);
  const rateByCrateType = new Map(rates.map((rate) => [rate.crateType, rate]));

  const imports = await prisma.tongImport.findMany({
    where: {
      date: { gte: start, lte: end },
      quantity: { gt: 0 },
      tongType: { code: { in: crateTypes } },
    },
    include: {
      truck: { select: { id: true, plate: true } },
      market: { select: { id: true, code: true } },
      tongType: { select: { code: true } },
    },
    orderBy: [
      { date: "asc" },
      { truck: { plate: "asc" } },
      { market: { code: "asc" } },
    ],
  });

  const tripMap = new Map<
    string,
    {
      tripDate: Date;
      truckId: string;
      truckPlate: string;
      marketId: string;
      marketCode: string;
      crateType: string;
      quantity: number;
      rate: PartnerFreightRateConfig;
    }
  >();

  for (const row of imports) {
    const crateType = row.tongType.code;
    const rate = rateByCrateType.get(crateType);
    if (!rate) continue;

    const tripDateInput = toDateInputValue(row.date);
    const key = buildPartnerTripKey({
      tripDateInput,
      truckId: row.truckId,
      marketId: row.marketId,
      crateType,
    });

    const existing = tripMap.get(key);
    if (existing) {
      existing.quantity += row.quantity;
      continue;
    }

    tripMap.set(key, {
      tripDate: row.date,
      truckId: row.truckId,
      truckPlate: row.truck.plate,
      marketId: row.marketId,
      marketCode: row.market.code,
      crateType,
      quantity: row.quantity,
      rate,
    });
  }

  const invoiceRows = await prisma.partnerTripInvoice.findMany({
    where: { tripDate: { gte: start, lte: end } },
    select: {
      id: true,
      invoiceNo: true,
      tripDate: true,
      truckId: true,
      marketId: true,
      crateType: true,
    },
  });
  const invoiceByTripKey = new Map(
    invoiceRows.map((row) => [
      buildPartnerTripKey({
        tripDateInput: toDateInputValue(row.tripDate),
        truckId: row.truckId,
        marketId: row.marketId,
        crateType: row.crateType,
      }),
      row,
    ])
  );

  return Array.from(tripMap.values()).map((trip) => {
    const tripDateInput = toDateInputValue(trip.tripDate);
    const tripKey = buildPartnerTripKey({
      tripDateInput,
      truckId: trip.truckId,
      marketId: trip.marketId,
      crateType: trip.crateType,
    });
    const amountMyr = roundMoney(trip.quantity * trip.rate.unitRateMyr);
    const invoice = invoiceByTripKey.get(tripKey);

    return {
      tripKey,
      tripDate: trip.tripDate,
      tripDateInput,
      tripDateLabel: formatDisplayDate(trip.tripDate),
      truckId: trip.truckId,
      truckPlate: trip.truckPlate,
      marketId: trip.marketId,
      marketCode: trip.marketCode,
      marketLabel: getMarketDisplayName(trip.marketCode),
      crateType: trip.crateType,
      quantity: trip.quantity,
      unitRateMyr: trip.rate.unitRateMyr,
      amountMyr,
      taxCode: trip.rate.taxCode,
      taxRate: trip.rate.taxRate,
      billToShipperId: trip.rate.billToShipperId,
      billToShipperCode: trip.rate.billToShipperCode,
      billToShipperName: trip.rate.billToShipperName,
      invoiceNo: invoice?.invoiceNo ?? null,
      invoiceId: invoice?.id ?? null,
    } satisfies PartnerTripSummary;
  });
}

export async function listPartnerTripsForMonth(year: number, month: number) {
  const trips = await loadPartnerImportsForMonth(year, month);
  return trips.sort((a, b) => {
    const dateCmp = a.tripDateInput.localeCompare(b.tripDateInput);
    if (dateCmp !== 0) return dateCmp;
    const plateCmp = a.truckPlate.localeCompare(b.truckPlate);
    if (plateCmp !== 0) return plateCmp;
    return a.marketCode.localeCompare(b.marketCode);
  });
}

export async function aggregatePartnerFreightIncomeMyr(
  year: number,
  month: number,
  day?: string | null
): Promise<number> {
  const trips = await loadPartnerImportsForMonth(year, month);
  const filtered = day?.trim()
    ? trips.filter((trip) => trip.tripDateInput === day.trim())
    : trips;
  return roundMoney(filtered.reduce((sum, trip) => sum + trip.amountMyr, 0));
}

async function allocatePartnerInvoiceNo(tripDate: Date): Promise<string> {
  const year = tripDate.getUTCFullYear();
  const month = tripDate.getUTCMonth() + 1;
  const { start, end } = getMonthDateRange(year, month);
  const count = await prisma.partnerTripInvoice.count({
    where: { tripDate: { gte: start, lte: end } },
  });
  return formatPartnerInvoiceNo(year, month, count + 1);
}

export async function ensurePartnerTripInvoice(input: {
  tripDateInput: string;
  truckId: string;
  marketId: string;
  crateType: string;
}): Promise<PartnerTripInvoicePrintData> {
  const tripDate = parseDateInput(input.tripDateInput);
  const rates = await loadActivePartnerFreightRates();
  const rate = rates.find((row) => row.crateType === input.crateType);
  if (!rate) {
    throw new Error(`未配置合作伙伴费率 No partner rate for ${input.crateType}`);
  }

  const imports = await prisma.tongImport.findMany({
    where: {
      date: tripDate,
      truckId: input.truckId,
      marketId: input.marketId,
      tongType: { code: input.crateType },
      quantity: { gt: 0 },
    },
    select: { quantity: true },
  });
  const quantity = imports.reduce((sum, row) => sum + row.quantity, 0);
  if (quantity <= 0) {
    throw new Error("该趟无合作伙伴回桶数量 No partner crate quantity for trip");
  }

  const amountMyr = roundMoney(quantity * rate.unitRateMyr);
  const taxAmountMyr = roundMoney(amountMyr * rate.taxRate);

  const existing = await prisma.partnerTripInvoice.findUnique({
    where: {
      tripDate_truckId_marketId_crateType: {
        tripDate,
        truckId: input.truckId,
        marketId: input.marketId,
        crateType: input.crateType,
      },
    },
    include: {
      truck: { select: { plate: true } },
      market: { select: { code: true } },
      billToShipper: { select: { code: true, name: true, location: true } },
    },
  });

  const invoice =
    existing ??
    (await prisma.partnerTripInvoice.create({
      data: {
        invoiceNo: await allocatePartnerInvoiceNo(tripDate),
        tripDate,
        truckId: input.truckId,
        marketId: input.marketId,
        billToShipperId: rate.billToShipperId,
        crateType: input.crateType,
        quantity,
        unitRateMyr: rate.unitRateMyr,
        amountMyr,
        taxCode: rate.taxCode,
        taxRate: rate.taxRate,
      },
      include: {
        truck: { select: { plate: true } },
        market: { select: { code: true } },
        billToShipper: { select: { code: true, name: true, location: true } },
      },
    }));

  return {
    invoiceNo: invoice.invoiceNo,
    invoiceDate: toDateInputValue(invoice.tripDate),
    invoiceDateLabel: formatDisplayDate(invoice.tripDate),
    currency: "MYR",
    billToCode: invoice.billToShipper.code,
    billToName: invoice.billToShipper.name,
    billToLocation: invoice.billToShipper.location,
    truckPlate: invoice.truck.plate,
    marketCode: invoice.market.code,
    marketLabel: getMarketDisplayName(invoice.market.code),
    lineDescription: "CRATE FREIGHT CHARGES",
    crateType: invoice.crateType,
    quantity: invoice.quantity,
    unitRateMyr: decimalToNumber(invoice.unitRateMyr) ?? 0,
    amountMyr: decimalToNumber(invoice.amountMyr) ?? 0,
    taxCode: invoice.taxCode,
    taxRate: decimalToNumber(invoice.taxRate) ?? 0,
    taxAmountMyr,
    totalMyr: decimalToNumber(invoice.amountMyr) ?? 0,
  };
}
