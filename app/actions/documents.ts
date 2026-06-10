"use server";

import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/inbound-utils";
import { getDONumber } from "@/lib/documents";
import { formatDODate } from "@/lib/document-utils";
import {
  DO_TONG_COLUMNS,
  emptyQuantities,
  mapTongToColumn,
} from "@/lib/constants/tong-columns";

export interface DORow {
  consignor: string;
  store: string;
  area: string;
  quantities: Record<string, number>;
  qty: number;
}

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

export interface MarketTongCombo {
  marketCode: string;
  tongCode: string;
  tongHeader: string;
  quantity: number;
}

function buildDORow(
  consignor: string,
  store: string,
  area: string,
  tongCode: string,
  quantity: number
): DORow {
  const quantities = emptyQuantities();
  const col = mapTongToColumn(tongCode);
  quantities[col] = quantity;
  return { consignor, store, area, quantities, qty: quantity };
}

function mergeDORow(existing: DORow, tongCode: string, quantity: number) {
  const col = mapTongToColumn(tongCode);
  existing.quantities[col] = (existing.quantities[col] ?? 0) + quantity;
  existing.qty += quantity;
}

export async function getDocumentDispatchOrders(dateStr: string) {
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
      totalQty: o.lines.reduce((s, l) => s + (l.inboundLine?.quantity ?? 0), 0),
    }))
  );
}

export async function getDeliveryOrderData(
  dispatchOrderId: string
): Promise<DeliveryOrderData | null> {
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

  const rowMap = new Map<string, DORow>();

  for (const dl of order.lines) {
    const line = dl.inboundLine;
    const key = `${line.session.shipperId}:${line.stallId}`;
    const consignor = line.session.shipper.name;
    const store = line.stall.code;
    const area = line.stall.market?.code ?? "";

    const existing = rowMap.get(key);
    if (existing) {
      mergeDORow(existing, line.tongType.code, line.quantity);
    } else {
      rowMap.set(
        key,
        buildDORow(consignor, store, area, line.tongType.code, line.quantity)
      );
    }
  }

  const rows = Array.from(rowMap.values()).sort((a, b) =>
    a.consignor.localeCompare(b.consignor)
  );

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
      existing.qty += line.quantity;
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
        qty: line.quantity,
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
  if (marketCodes.length === 0) return null;

  const date = parseDateInput(dateStr);
  const uniqueCodes = Array.from(new Set(marketCodes));

  const allLines = (
    await Promise.all(
      uniqueCodes.map((code) => fetchAssignedLinesForDate(date, code))
    )
  ).flat();

  if (allLines.length === 0) return null;

  const rows = buildMarketDORows(allLines);
  if (rows.length === 0) return null;

  const primaryCode = uniqueCodes[0];
  const market = await prisma.market.findUnique({
    where: { code: primaryCode },
  });

  return {
    marketCode: primaryCode,
    marketCodes: uniqueCodes,
    marketName: market?.name ?? primaryCode,
    date: formatDODate(date),
    rows,
  };
}

export async function getCrateByTypeData(
  dateStr: string,
  marketCode: string,
  tongTypeCode: string
): Promise<CrateByTypeData | null> {
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

export async function getMarketTongCombos(
  dateStr: string
): Promise<MarketTongCombo[]> {
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
