import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/freight-rates";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { formatInvoicePeriodLabel } from "@/lib/constants/monthly-invoice";
import {
  getInvoiceMarketShortName,
  INVOICE_ROUTE_MARKET_CODES,
} from "@/lib/constants/invoice-route-labels";
import { toDateInputValue } from "@/lib/inbound-utils";
import { formatDisplayDate } from "@/lib/date-utils";

export type CrateReturnChargeKind = "freight" | "collection";

export interface CrateReturnFreightRateConfig {
  crateType: string;
  billToShipperId: string;
  billToShipperCode: string;
  billToShipperName: string;
  freightRateMyr: number;
  collectionRateMyr: number;
}

export interface CrateReturnMonthlyInvoiceSummary {
  invoiceId: string;
  invoiceNo: string;
  yearMonth: string;
  year: number;
  month: number;
  crateType: string;
  billToShipperId: string;
  billToCode: string;
  billToName: string;
  quantity: number;
  freightRateMyr: number;
  collectionRateMyr: number;
  freightAmountMyr: number;
  collectionAmountMyr: number;
  totalAmountMyr: number;
}

export interface CrateReturnMonthlyInvoiceLinePrint {
  marketCode: string;
  marketLabel: string;
  quantity: number;
  unitRateMyr: number;
  amountMyr: number;
}

export interface CrateReturnMonthlyInvoiceSectionPrint {
  kind: "freight" | "collection";
  title: string;
  lineDescription: string;
  unitRateMyr: number;
  rows: CrateReturnMonthlyInvoiceLinePrint[];
  totalQty: number;
  totalAmountMyr: number;
}

export interface CrateReturnMonthlyInvoiceDetailRowPrint {
  tripKey: string;
  tripDateLabel: string;
  truckPlate: string;
  marketCode: string;
  marketLabel: string;
  crateType: string;
  quantity: number;
  chargeKind: CrateReturnChargeKind;
  /** Shown under market when freight + collection both apply (GKS). */
  chargeLabel: string | null;
  unitRateMyr: number;
  amountMyr: number;
}

export interface CrateReturnMonthlyInvoicePrintData {
  invoiceNo: string;
  periodLabel: string;
  yearMonth: string;
  currency: "MYR";
  billToCode: string;
  billToName: string;
  billToLocation: string | null;
  crateType: string;
  quantity: number;
  freightRateMyr: number;
  collectionRateMyr: number;
  freightAmountMyr: number;
  collectionAmountMyr: number;
  totalAmountMyr: number;
  /** Per-trip detail rows for print (freight + optional collection row per trip). */
  detailRows: CrateReturnMonthlyInvoiceDetailRowPrint[];
  /** @deprecated Market summary sections; kept for existing verify scripts. */
  sections: CrateReturnMonthlyInvoiceSectionPrint[];
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatYearMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function formatCrateReturnInvoiceNo(
  year: number,
  month: number,
  sequence: number
) {
  const yy = String(year).slice(-2);
  const mm = String(month).padStart(2, "0");
  return `RET-${yy}${mm}-${String(sequence).padStart(3, "0")}`;
}

function marketSortIndex(marketCode: string): number {
  const index = INVOICE_ROUTE_MARKET_CODES.indexOf(
    marketCode as (typeof INVOICE_ROUTE_MARKET_CODES)[number]
  );
  return index === -1 ? INVOICE_ROUTE_MARKET_CODES.length : index;
}

export async function loadActiveCrateReturnFreightRates(): Promise<
  CrateReturnFreightRateConfig[]
> {
  const rows = await prisma.crateReturnFreightRate.findMany({
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
    freightRateMyr: decimalToNumber(row.freightRateMyr) ?? 0,
    collectionRateMyr: decimalToNumber(row.collectionRateMyr) ?? 0,
  }));
}

async function loadImportsForCrateType(
  year: number,
  month: number,
  crateType: string
) {
  const { start, end } = getMonthDateRange(year, month);
  return prisma.tongImport.findMany({
    where: {
      date: { gte: start, lte: end },
      quantity: { gt: 0 },
      tongType: { code: crateType },
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
}

export type CrateReturnImportRow = Awaited<
  ReturnType<typeof loadImportsForCrateType>
>[number];

export interface CrateReturnTripAggregate {
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
}

export function buildCrateReturnTripKey(input: {
  tripDateInput: string;
  truckId: string;
  marketId: string;
  crateType: string;
}) {
  return `${input.tripDateInput}|${input.truckId}|${input.marketId}|${input.crateType}`;
}

export function aggregateCrateReturnTrips(
  imports: CrateReturnImportRow[],
  crateType: string
): CrateReturnTripAggregate[] {
  const tripMap = new Map<string, CrateReturnTripAggregate>();

  for (const row of imports) {
    if (!row.marketId || !row.market) continue;

    const tripDateInput = toDateInputValue(row.date);
    const typeCode = row.tongType.code;
    const tripKey = buildCrateReturnTripKey({
      tripDateInput,
      truckId: row.truckId,
      marketId: row.marketId,
      crateType: typeCode,
    });

    const existing = tripMap.get(tripKey);
    if (existing) {
      existing.quantity += row.quantity;
      continue;
    }

    tripMap.set(tripKey, {
      tripKey,
      tripDate: row.date,
      tripDateInput,
      tripDateLabel: formatDisplayDate(row.date),
      truckId: row.truckId,
      truckPlate: row.truck?.plate?.trim() || "—",
      marketId: row.marketId,
      marketCode: row.market.code,
      marketLabel: getInvoiceMarketShortName(row.market.code),
      crateType: typeCode,
      quantity: row.quantity,
    });
  }

  return Array.from(tripMap.values())
    .filter((trip) => trip.crateType === crateType)
    .sort((a, b) => {
      const dateCmp = a.tripDateInput.localeCompare(b.tripDateInput);
      if (dateCmp !== 0) return dateCmp;
      const plateCmp = a.truckPlate.localeCompare(b.truckPlate);
      if (plateCmp !== 0) return plateCmp;
      return (
        marketSortIndex(a.marketCode) - marketSortIndex(b.marketCode)
      );
    });
}

export function buildCrateReturnDetailRows(input: {
  trips: CrateReturnTripAggregate[];
  freightRateMyr: number;
  collectionRateMyr: number;
}): CrateReturnMonthlyInvoiceDetailRowPrint[] {
  const showChargeLabel = input.collectionRateMyr > 0;
  const rows: CrateReturnMonthlyInvoiceDetailRowPrint[] = [];

  for (const trip of input.trips) {
    rows.push({
      tripKey: trip.tripKey,
      tripDateLabel: trip.tripDateLabel,
      truckPlate: trip.truckPlate,
      marketCode: trip.marketCode,
      marketLabel: trip.marketLabel,
      crateType: trip.crateType,
      quantity: trip.quantity,
      chargeKind: "freight",
      chargeLabel: showChargeLabel ? "车力 Freight" : null,
      unitRateMyr: input.freightRateMyr,
      amountMyr: roundMoney(trip.quantity * input.freightRateMyr),
    });

    if (input.collectionRateMyr > 0) {
      rows.push({
        tripKey: trip.tripKey,
        tripDateLabel: trip.tripDateLabel,
        truckPlate: trip.truckPlate,
        marketCode: trip.marketCode,
        marketLabel: trip.marketLabel,
        crateType: trip.crateType,
        quantity: trip.quantity,
        chargeKind: "collection",
        chargeLabel: "收桶 Collection",
        unitRateMyr: input.collectionRateMyr,
        amountMyr: roundMoney(trip.quantity * input.collectionRateMyr),
      });
    }
  }

  return rows;
}

export function sumDetailRowsByChargeKind(
  rows: CrateReturnMonthlyInvoiceDetailRowPrint[],
  kind: CrateReturnChargeKind
) {
  const filtered = rows.filter((row) => row.chargeKind === kind);
  return {
    quantity: filtered.reduce((sum, row) => sum + row.quantity, 0),
    amountMyr: roundMoney(filtered.reduce((sum, row) => sum + row.amountMyr, 0)),
  };
}

function aggregateMarketQuantities(
  imports: Awaited<ReturnType<typeof loadImportsForCrateType>>
) {
  const byMarket = new Map<string, { marketId: string; marketCode: string; quantity: number }>();

  for (const row of imports) {
    if (!row.marketId || !row.market) continue;

    const existing = byMarket.get(row.marketId);
    if (existing) {
      existing.quantity += row.quantity;
      continue;
    }
    byMarket.set(row.marketId, {
      marketId: row.marketId,
      marketCode: row.market.code,
      quantity: row.quantity,
    });
  }

  return Array.from(byMarket.values()).sort(
    (a, b) => marketSortIndex(a.marketCode) - marketSortIndex(b.marketCode)
  );
}

async function allocateCrateReturnInvoiceNo(year: number, month: number) {
  const yearMonth = formatYearMonth(year, month);
  const count = await prisma.crateReturnMonthlyInvoice.count({
    where: { yearMonth },
  });
  return formatCrateReturnInvoiceNo(year, month, count + 1);
}

function buildPrintSections(input: {
  marketRows: ReturnType<typeof aggregateMarketQuantities>;
  freightRateMyr: number;
  collectionRateMyr: number;
}): CrateReturnMonthlyInvoiceSectionPrint[] {
  const freightRows: CrateReturnMonthlyInvoiceLinePrint[] = input.marketRows.map(
    (row) => ({
      marketCode: row.marketCode,
      marketLabel: getInvoiceMarketShortName(row.marketCode),
      quantity: row.quantity,
      unitRateMyr: input.freightRateMyr,
      amountMyr: roundMoney(row.quantity * input.freightRateMyr),
    })
  );
  const freightTotalQty = freightRows.reduce((sum, row) => sum + row.quantity, 0);
  const freightTotalAmount = roundMoney(
    freightRows.reduce((sum, row) => sum + row.amountMyr, 0)
  );

  const sections: CrateReturnMonthlyInvoiceSectionPrint[] = [
    {
      kind: "freight",
      title: "车力费 Freight Charges",
      lineDescription: "CRATE FREIGHT CHARGES",
      unitRateMyr: input.freightRateMyr,
      rows: freightRows,
      totalQty: freightTotalQty,
      totalAmountMyr: freightTotalAmount,
    },
  ];

  if (input.collectionRateMyr > 0) {
    const collectionRows: CrateReturnMonthlyInvoiceLinePrint[] =
      input.marketRows.map((row) => ({
        marketCode: row.marketCode,
        marketLabel: getInvoiceMarketShortName(row.marketCode),
        quantity: row.quantity,
        unitRateMyr: input.collectionRateMyr,
        amountMyr: roundMoney(row.quantity * input.collectionRateMyr),
      }));
    sections.push({
      kind: "collection",
      title: "收桶费 Collection Charges",
      lineDescription: "CRATE COLLECTION CHARGES",
      unitRateMyr: input.collectionRateMyr,
      rows: collectionRows,
      totalQty: collectionRows.reduce((sum, row) => sum + row.quantity, 0),
      totalAmountMyr: roundMoney(
        collectionRows.reduce((sum, row) => sum + row.amountMyr, 0)
      ),
    });
  }

  return sections;
}

function toPrintData(input: {
  invoice: {
    invoiceNo: string;
    yearMonth: string;
    crateType: string;
    quantity: number;
    freightRateMyr: unknown;
    collectionRateMyr: unknown;
    freightAmountMyr: unknown;
    collectionAmountMyr: unknown;
    totalAmountMyr: unknown;
    billToShipper: {
      code: string;
      name: string;
      location: string | null;
    };
  };
  year: number;
  month: number;
  sections: CrateReturnMonthlyInvoiceSectionPrint[];
  detailRows: CrateReturnMonthlyInvoiceDetailRowPrint[];
}): CrateReturnMonthlyInvoicePrintData {
  return {
    invoiceNo: input.invoice.invoiceNo,
    periodLabel: formatInvoicePeriodLabel(input.year, input.month),
    yearMonth: input.invoice.yearMonth,
    currency: "MYR",
    billToCode: input.invoice.billToShipper.code,
    billToName: input.invoice.billToShipper.name,
    billToLocation: input.invoice.billToShipper.location,
    crateType: input.invoice.crateType,
    quantity: input.invoice.quantity,
    freightRateMyr: decimalToNumber(input.invoice.freightRateMyr) ?? 0,
    collectionRateMyr: decimalToNumber(input.invoice.collectionRateMyr) ?? 0,
    freightAmountMyr: decimalToNumber(input.invoice.freightAmountMyr) ?? 0,
    collectionAmountMyr: decimalToNumber(input.invoice.collectionAmountMyr) ?? 0,
    totalAmountMyr: decimalToNumber(input.invoice.totalAmountMyr) ?? 0,
    detailRows: input.detailRows,
    sections: input.sections,
  };
}

export async function ensureCrateReturnMonthlyInvoice(
  year: number,
  month: number,
  crateType: string
): Promise<CrateReturnMonthlyInvoicePrintData | null> {
  const rateRow = await prisma.crateReturnFreightRate.findFirst({
    where: { crateType, active: true },
    include: {
      billToShipper: { select: { id: true, code: true, name: true, location: true } },
    },
  });
  if (!rateRow) {
    throw new Error(`未配置回收桶费率 No crate return rate for ${crateType}`);
  }

  const yearMonth = formatYearMonth(year, month);
  const imports = await loadImportsForCrateType(year, month, crateType);
  const marketRows = aggregateMarketQuantities(imports);
  const quantity = marketRows.reduce((sum, row) => sum + row.quantity, 0);

  const freightRateMyr = decimalToNumber(rateRow.freightRateMyr) ?? 0;
  const collectionRateMyr = decimalToNumber(rateRow.collectionRateMyr) ?? 0;
  const freightAmountMyr = roundMoney(quantity * freightRateMyr);
  const collectionAmountMyr = roundMoney(quantity * collectionRateMyr);
  const totalAmountMyr = roundMoney(freightAmountMyr + collectionAmountMyr);

  const existing = await prisma.crateReturnMonthlyInvoice.findUnique({
    where: {
      yearMonth_billToShipperId_crateType: {
        yearMonth,
        billToShipperId: rateRow.billToShipperId,
        crateType,
      },
    },
    include: {
      billToShipper: { select: { code: true, name: true, location: true } },
    },
  });

  if (quantity <= 0) {
    if (existing) {
      await prisma.crateReturnMonthlyInvoice.delete({ where: { id: existing.id } });
    }
    return null;
  }

  const sections = buildPrintSections({
    marketRows,
    freightRateMyr,
    collectionRateMyr,
  });
  const trips = aggregateCrateReturnTrips(imports, crateType);
  const detailRows = buildCrateReturnDetailRows({
    trips,
    freightRateMyr,
    collectionRateMyr,
  });

  const invoice = await prisma.$transaction(async (tx) => {
    const saved = existing
      ? await tx.crateReturnMonthlyInvoice.update({
          where: { id: existing.id },
          data: {
            quantity,
            freightRateMyr,
            collectionRateMyr,
            freightAmountMyr,
            collectionAmountMyr,
            totalAmountMyr,
          },
          include: {
            billToShipper: { select: { code: true, name: true, location: true } },
          },
        })
      : await tx.crateReturnMonthlyInvoice.create({
          data: {
            invoiceNo: await allocateCrateReturnInvoiceNo(year, month),
            yearMonth,
            billToShipperId: rateRow.billToShipperId,
            crateType,
            quantity,
            freightRateMyr,
            collectionRateMyr,
            freightAmountMyr,
            collectionAmountMyr,
            totalAmountMyr,
          },
          include: {
            billToShipper: { select: { code: true, name: true, location: true } },
          },
        });

    await tx.crateReturnMonthlyInvoiceLine.deleteMany({
      where: { invoiceId: saved.id },
    });

    if (marketRows.length > 0) {
      await tx.crateReturnMonthlyInvoiceLine.createMany({
        data: marketRows.map((row) => ({
          invoiceId: saved.id,
          marketId: row.marketId,
          quantity: row.quantity,
          freightAmountMyr: roundMoney(row.quantity * freightRateMyr),
          collectionAmountMyr: roundMoney(row.quantity * collectionRateMyr),
        })),
      });
    }

    return saved;
  });

  return toPrintData({
    invoice,
    year,
    month,
    sections,
    detailRows,
  });
}

export async function listCrateReturnMonthlyInvoicesForMonth(
  year: number,
  month: number
): Promise<CrateReturnMonthlyInvoiceSummary[]> {
  const rates = await loadActiveCrateReturnFreightRates();
  const summaries: CrateReturnMonthlyInvoiceSummary[] = [];

  for (const rate of rates) {
    const imports = await loadImportsForCrateType(year, month, rate.crateType);
    const quantity = imports.reduce((sum, row) => sum + row.quantity, 0);
    if (quantity <= 0) continue;

    const printData = await ensureCrateReturnMonthlyInvoice(
      year,
      month,
      rate.crateType
    );
    if (!printData) continue;

    const invoice = await prisma.crateReturnMonthlyInvoice.findUnique({
      where: {
        yearMonth_billToShipperId_crateType: {
          yearMonth: formatYearMonth(year, month),
          billToShipperId: rate.billToShipperId,
          crateType: rate.crateType,
        },
      },
    });
    if (!invoice) continue;

    summaries.push({
      invoiceId: invoice.id,
      invoiceNo: printData.invoiceNo,
      yearMonth: printData.yearMonth,
      year,
      month,
      crateType: rate.crateType,
      billToShipperId: rate.billToShipperId,
      billToCode: printData.billToCode,
      billToName: printData.billToName,
      quantity: printData.quantity,
      freightRateMyr: printData.freightRateMyr,
      collectionRateMyr: printData.collectionRateMyr,
      freightAmountMyr: printData.freightAmountMyr,
      collectionAmountMyr: printData.collectionAmountMyr,
      totalAmountMyr: printData.totalAmountMyr,
    });
  }

  return summaries.sort((a, b) => a.crateType.localeCompare(b.crateType));
}

export async function getCrateReturnMonthlyInvoicePrintData(input: {
  year: number;
  month: number;
  crateType: string;
}): Promise<CrateReturnMonthlyInvoicePrintData> {
  const data = await ensureCrateReturnMonthlyInvoice(
    input.year,
    input.month,
    input.crateType
  );
  if (!data) {
    throw new Error("该月无回收桶记录 No crate return records for this month");
  }
  return data;
}

export async function ensureCrateReturnMonthlyInvoicesForDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const rates = await loadActiveCrateReturnFreightRates();
  for (const rate of rates) {
    await ensureCrateReturnMonthlyInvoice(year, month, rate.crateType);
  }
}

export async function ensureCrateReturnMonthlyInvoicesForCrateTypes(
  date: Date,
  crateTypes: string[]
) {
  const unique = Array.from(new Set(crateTypes.map((code) => code.trim()).filter(Boolean)));
  if (unique.length === 0) return;

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const active = new Set(
    (await loadActiveCrateReturnFreightRates()).map((row) => row.crateType)
  );

  for (const crateType of unique) {
    if (!active.has(crateType)) continue;
    await ensureCrateReturnMonthlyInvoice(year, month, crateType);
  }
}

export async function aggregateCrateReturnIncomeMyr(
  year: number,
  month: number,
  day?: string | null
): Promise<number> {
  const rates = await loadActiveCrateReturnFreightRates();
  if (rates.length === 0) return 0;

  const { start, end } = getMonthDateRange(year, month);
  const imports = await prisma.tongImport.findMany({
    where: {
      date: { gte: start, lte: end },
      quantity: { gt: 0 },
      tongType: { code: { in: rates.map((rate) => rate.crateType) } },
    },
    select: {
      date: true,
      quantity: true,
      tongType: { select: { code: true } },
    },
  });

  const rateByCrateType = new Map(rates.map((rate) => [rate.crateType, rate]));
  let total = 0;

  for (const row of imports) {
    const crateType = row.tongType.code;
    const rate = rateByCrateType.get(crateType);
    if (!rate) continue;

    if (day?.trim()) {
      if (toDateInputValue(row.date) !== day.trim()) continue;
    }

    const unitTotal = rate.freightRateMyr + rate.collectionRateMyr;
    total += row.quantity * unitTotal;
  }

  return roundMoney(total);
}
