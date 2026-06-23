"use server";

import { prisma } from "@/lib/prisma";
import { requireWrite } from "@/lib/require-auth";
import { parseDateInput } from "@/lib/inbound-utils";
import { getDONumber } from "@/lib/documents";
import { formatDODate } from "@/lib/document-utils";
import { MARKET_ORDER } from "@/lib/markets";
import { getMarketDisplayName } from "@/lib/constants/market-names";
import {
  computeDORowQty,
  DO_TONG_COLUMNS,
  emptyQuantities,
  mapTongToColumn,
  sumQuantities,
  sumColumnQuantities,
} from "@/lib/constants/tong-columns";
import {
  CRATE_TYPE_RECORD_BLOCKS,
  getCrateTypeRecordBlockTitle,
} from "@/lib/crate-type-record-areas";
import { mergeDORows, type DOMergeMode, type DORow } from "@/lib/do-row-merge";

export type { DORow, DOMergeMode } from "@/lib/do-row-merge";

export interface DeliveryOrderData {
  doNumber: string;
  lorryNo: string;
  driver: string;
  date: string;
  rows: DORow[];
}

export interface MarketDORow {
  lorryNo: string;
  receiverName: string;
  stallCode: string;
  area: string;
  quantities: Record<string, number>;
  qty: number;
}

export interface MarketDOData {
  marketCode: string;
  marketCodes: string[];
  marketName: string;
  date: string;
  rows: MarketDORow[];
}

export interface CrateByTypeRow {
  lorryNo: string;
  receiverName: string;
  stallCode: string;
  area: string;
  quantity: number;
}

export interface CrateByTypeData {
  marketCode: string;
  tongCode: string;
  tongHeader: string;
  date: string;
  rows: CrateByTypeRow[];
}

export interface CrateByTypeSection {
  marketCode: string;
  tongCode: string;
  tongHeader: string;
  rows: CrateByTypeRow[];
}

export interface CrateByTypeMergedData {
  date: string;
  sections: CrateByTypeSection[];
}

export interface MarketTongCombo {
  marketCode: string;
  tongCode: string;
  tongHeader: string;
  quantity: number;
}

export interface CrateTypeRecordTruckRow {
  lorryNo: string;
  quantities: Record<string, number>;
  total: number;
}

export interface CrateTypeRecordBlock {
  title: string;
  trucks: CrateTypeRecordTruckRow[];
  totals: Record<string, number>;
  total: number;
}

export interface CrateTypeRecordCrateOption {
  code: string;
  header: string;
}

export interface CrateTypeRecordOptions {
  markets: string[];
  crateTypes: CrateTypeRecordCrateOption[];
}

export interface CrateTypeRecordFilters {
  marketCodes: string[];
  tongCodes: string[];
}

export interface CrateTypeRecordData {
  date: string;
  blocks: CrateTypeRecordBlock[];
  grandTotals: Record<string, number>;
  grandTotal: number;
  activeColumns: { code: string; header: string }[];
}

export async function getDocumentDispatchOrders(dateStr: string) {
  await requireWrite();
  const date = parseDateInput(dateStr);
  const orders = await prisma.dispatchOrder.findMany({
    where: { date, status: { notIn: ["draft", "cancelled"] } },
    include: {
      truck: true,
      lines: { include: { inboundLine: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return Promise.all(
    orders.map(async (o) => ({
      id: o.id,
      dispatchNo: o.dispatchNo,
      doNumber: await getDONumber(o.id),
      truckPlate: o.truck.plate,
      driverName: o.driverName,
      markets: o.markets,
      totalQty: o.lines.reduce(
        (s, l) =>
          s + (l.inboundLine?.isBox ? 0 : (l.inboundLine?.quantity ?? 0)),
        0
      ),
    }))
  );
}

export async function getDeliveryOrderData(
  dispatchOrderId: string,
  options?: { mergeMode?: DOMergeMode }
): Promise<DeliveryOrderData | null> {
  await requireWrite();
  const mergeMode = options?.mergeMode ?? "bySession";
  const order = await prisma.dispatchOrder.findUnique({
    where: { id: dispatchOrderId },
    include: {
      truck: true,
      lines: {
        include: {
          inboundLine: {
            include: {
              session: { include: { shipper: true } },
              stall: { include: { market: true } },
              tongType: true,
            },
          },
        },
      },
    },
  });

  if (!order) return null;

  const lorryNo = order.truck.plate;
  const lineInputs = order.lines
    .map((dl) => dl.inboundLine)
    .filter((line): line is NonNullable<typeof line> => line != null)
    .map((line) => ({
      sessionId: line.sessionId,
      stallId: line.stallId,
      shipperId: line.session.shipperId,
      consignor: line.session.shipper.name,
      store: line.stall.code,
      area: line.stall.market?.code ?? "",
      tongCode: line.tongType.code,
      quantity: line.quantity,
    }));

  const rows = mergeDORows(lorryNo, lineInputs, mergeMode);

  return {
    doNumber: await getDONumber(dispatchOrderId),
    lorryNo: order.truck.plate,
    driver: order.driverName ?? "",
    date: formatDODate(order.date),
    rows,
  };
}

async function fetchAssignedLinesForDate(date: Date, marketCode?: string) {
  return prisma.inboundLine.findMany({
    where: {
      dispatchStatus: "assigned",
      stall: marketCode ? { market: { code: marketCode } } : undefined,
      dispatchLines: {
        some: {
          dispatchOrder: { date, status: { notIn: ["draft", "cancelled"] } },
        },
      },
    },
    include: {
      tongType: true,
      stall: { include: { market: true } },
      session: { include: { shipper: true } },
      dispatchLines: {
        include: {
          dispatchOrder: { include: { truck: true } },
        },
      },
    },
  });
}

function buildMarketDORows(
  lines: Awaited<ReturnType<typeof fetchAssignedLinesForDate>>
): MarketDORow[] {
  const rowMap = new Map<string, MarketDORow>();

  for (const line of lines) {
    const dispatchLine = line.dispatchLines[0];
    if (!dispatchLine) continue;

    const lorryNo = dispatchLine.dispatchOrder.truck.plate;
    const key = `${lorryNo}:${line.stallId}`;
    const receiverName = line.stall.name ?? line.stall.code;
    const stallCode = line.stall.code;
    const area = line.stall.market?.code ?? "";

    const existing = rowMap.get(key);
    if (existing) {
      const col = mapTongToColumn(line.tongType.code);
      existing.quantities[col] =
        (existing.quantities[col] ?? 0) + line.quantity;
      if (!line.isBox) {
        existing.qty += line.quantity;
      }
    } else {
      const quantities = emptyQuantities();
      const col = mapTongToColumn(line.tongType.code);
      quantities[col] = line.quantity;
      rowMap.set(key, {
        lorryNo,
        receiverName,
        stallCode,
        area,
        quantities,
        qty: line.isBox ? 0 : line.quantity,
      });
    }
  }

  return Array.from(rowMap.values()).sort((a, b) =>
    a.stallCode.localeCompare(b.stallCode)
  );
}

export async function getMarketDOData(
  dateStr: string,
  marketCode: string
): Promise<MarketDOData | null> {
  return getMultiMarketDOData(dateStr, [marketCode]);
}

export async function getMultiMarketDOData(
  dateStr: string,
  marketCodes: string[]
): Promise<MarketDOData | null> {
  await requireWrite();
  if (marketCodes.length === 0) return null;

  const date = parseDateInput(dateStr);
  const uniqueCodes = Array.from(new Set(marketCodes));

  const allLines = (
    await Promise.all(
      uniqueCodes.map((code) => fetchAssignedLinesForDate(date, code))
    )
  ).flat();

  const rows = allLines.length > 0 ? buildMarketDORows(allLines) : [];

  const primaryCode = uniqueCodes[0];

  return {
    marketCode: primaryCode,
    marketCodes: uniqueCodes,
    marketName: getMarketDisplayName(primaryCode),
    date: formatDODate(date),
    rows,
  };
}

export async function getCrateByTypeData(
  dateStr: string,
  marketCode: string,
  tongTypeCode: string
): Promise<CrateByTypeData | null> {
  await requireWrite();
  const date = parseDateInput(dateStr);
  const tongType = await prisma.tongType.findUnique({
    where: { code: tongTypeCode },
  });
  if (!tongType) return null;

  const lines = await fetchAssignedLinesForDate(date, marketCode);
  const filtered = lines.filter((l) => l.tongType.code === tongTypeCode);

  const rowMap = new Map<string, CrateByTypeRow>();

  for (const line of filtered) {
    const dispatchLine = line.dispatchLines[0];
    if (!dispatchLine) continue;

    const lorryNo = dispatchLine.dispatchOrder.truck.plate;
    const key = `${lorryNo}:${line.stallId}`;

    const existing = rowMap.get(key);
    if (existing) {
      existing.quantity += line.quantity;
    } else {
      rowMap.set(key, {
        lorryNo,
        receiverName: line.stall.name ?? line.stall.code,
        stallCode: line.stall.code,
        area: line.stall.market?.code ?? "",
        quantity: line.quantity,
      });
    }
  }

  const col = DO_TONG_COLUMNS.find((c) => c.code === tongTypeCode);

  return {
    marketCode,
    tongCode: tongTypeCode,
    tongHeader: col?.header ?? tongType.name,
    date: formatDODate(date),
    rows: Array.from(rowMap.values()).sort((a, b) =>
      a.stallCode.localeCompare(b.stallCode)
    ),
  };
}

export async function getMultiCrateByTypeData(
  dateStr: string,
  selections: { marketCode: string; tongCode: string }[]
): Promise<CrateByTypeMergedData | null> {
  await requireWrite();
  if (selections.length === 0) return null;

  const sections: CrateByTypeSection[] = [];
  let date = "";

  for (const sel of selections) {
    const data = await getCrateByTypeData(
      dateStr,
      sel.marketCode,
      sel.tongCode
    );
    if (!data || data.rows.length === 0) continue;
    date = data.date;
    sections.push({
      marketCode: data.marketCode,
      tongCode: data.tongCode,
      tongHeader: data.tongHeader,
      rows: data.rows,
    });
  }

  if (sections.length === 0) return null;
  return { date, sections };
}

export async function getMarketTongCombos(
  dateStr: string
): Promise<MarketTongCombo[]> {
  await requireWrite();
  const date = parseDateInput(dateStr);
  const lines = await fetchAssignedLinesForDate(date);

  const comboMap = new Map<string, MarketTongCombo>();

  for (const line of lines) {
    const marketCode = line.stall.market?.code;
    if (!marketCode) continue;

    const key = `${marketCode}:${line.tongType.code}`;
    const existing = comboMap.get(key);
    const col = DO_TONG_COLUMNS.find((c) => c.code === line.tongType.code);

    if (existing) {
      existing.quantity += line.quantity;
    } else {
      comboMap.set(key, {
        marketCode,
        tongCode: line.tongType.code,
        tongHeader: col?.header ?? line.tongType.name,
        quantity: line.quantity,
      });
    }
  }

  return Array.from(comboMap.values()).sort(
    (a, b) =>
      a.marketCode.localeCompare(b.marketCode) ||
      a.tongCode.localeCompare(b.tongCode)
  );
}

export async function getCrateTypeRecordOptions(
  dateStr: string
): Promise<CrateTypeRecordOptions> {
  await requireWrite();
  const date = parseDateInput(dateStr);
  const lines = await fetchAssignedLinesForDate(date);

  const marketSet = new Set<string>();
  const tongMap = new Map<string, string>();
  const marketOrder = new Map<string, number>(
    MARKET_ORDER.map((code, index) => [code, index])
  );
  const tongOrder = new Map<string, number>(
    DO_TONG_COLUMNS.map((col, index) => [col.code, index])
  );

  for (const line of lines) {
    const marketCode = line.stall.market?.code;
    if (marketCode) marketSet.add(marketCode);

    const col = DO_TONG_COLUMNS.find((c) => c.code === line.tongType.code);
    tongMap.set(
      line.tongType.code,
      col?.header ?? line.tongType.name
    );
  }

  const markets = Array.from(marketSet).sort(
    (a, b) => (marketOrder.get(a) ?? 999) - (marketOrder.get(b) ?? 999)
  );

  const crateTypes = Array.from(tongMap.entries())
    .sort(
      ([a], [b]) => (tongOrder.get(a) ?? 999) - (tongOrder.get(b) ?? 999)
    )
    .map(([code, header]) => ({ code, header }));

  return { markets, crateTypes };
}

export async function getCrateTypeRecordData(
  dateStr: string,
  filters: CrateTypeRecordFilters
): Promise<CrateTypeRecordData | null> {
  await requireWrite();
  const date = parseDateInput(dateStr);
  const lines = await fetchAssignedLinesForDate(date);
  if (lines.length === 0) return null;

  const marketFilter = new Set(filters.marketCodes);
  const tongFilter = new Set(filters.tongCodes);
  if (marketFilter.size === 0 || tongFilter.size === 0) return null;

  const allowedColumns = new Set(
    filters.tongCodes.map((code) => mapTongToColumn(code))
  );

  const blockTrucks = new Map<string, Map<string, Record<string, number>>>();

  for (const line of lines) {
    const marketCode = line.stall.market?.code;
    if (!marketCode || !marketFilter.has(marketCode)) continue;
    if (!tongFilter.has(line.tongType.code)) continue;

    const blockTitle = getCrateTypeRecordBlockTitle(marketCode);
    if (!blockTitle) continue;

    const dispatchLine = line.dispatchLines[0];
    if (!dispatchLine) continue;

    const lorryNo = dispatchLine.dispatchOrder.truck.plate;
    const col = mapTongToColumn(line.tongType.code);
    if (!allowedColumns.has(col)) continue;

    if (!blockTrucks.has(blockTitle)) {
      blockTrucks.set(blockTitle, new Map());
    }
    const truckMap = blockTrucks.get(blockTitle)!;

    if (!truckMap.has(lorryNo)) {
      truckMap.set(lorryNo, emptyQuantities());
    }
    const quantities = truckMap.get(lorryNo)!;
    quantities[col] = (quantities[col] ?? 0) + line.quantity;
  }

  const blocks: CrateTypeRecordBlock[] = [];

  for (const { title } of CRATE_TYPE_RECORD_BLOCKS) {
    const truckMap = blockTrucks.get(title);
    if (!truckMap || truckMap.size === 0) continue;

    const trucks: CrateTypeRecordTruckRow[] = Array.from(truckMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([lorryNo, quantities]) => ({
        lorryNo,
        quantities,
        total: computeDORowQty(quantities),
      }))
      .filter((truck) => truck.total > 0);

    if (trucks.length === 0) continue;

    const total = trucks.reduce((sum, truck) => sum + truck.total, 0);

    blocks.push({ title, trucks, totals: {}, total });
  }

  if (blocks.length === 0) return null;

  const allTrucks = blocks.flatMap((block) => block.trucks);
  const grandTotals = sumQuantities(allTrucks);
  const grandTotal = blocks.reduce((sum, block) => sum + block.total, 0);

  const activeColumns = DO_TONG_COLUMNS.filter(
    (col) =>
      allowedColumns.has(col.code) && (grandTotals[col.code] ?? 0) > 0
  ).map((col) => ({ code: col.code, header: col.header }));

  const activeColumnCodes = activeColumns.map((col) => col.code);
  const serializedBlocks: CrateTypeRecordBlock[] = blocks.map((block) => {
    const totals = Object.fromEntries(
      activeColumnCodes.map((code) => [
        code,
        sumColumnQuantities(block.trucks, code),
      ])
    );

    return {
      title: block.title,
      trucks: block.trucks.map((truck) => ({
        lorryNo: truck.lorryNo,
        quantities: { ...truck.quantities },
        total: truck.total,
      })),
      totals,
      total: block.total,
    };
  });

  return {
    date: formatDODate(date),
    blocks: serializedBlocks,
    grandTotals: { ...grandTotals },
    grandTotal,
    activeColumns: activeColumns.map((col) => ({ ...col })),
  };
}
