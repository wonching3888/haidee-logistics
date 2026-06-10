"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateDispatchNo } from "@/lib/dispatch";
import { parseDateInput } from "@/lib/inbound-utils";
import { DISPATCH_MARKET_ORDER, getActiveMarkets } from "@/lib/markets";

export interface DispatchMatrixData {
  shippers: { id: string; name: string }[];
  markets: string[];
  cells: Record<string, Record<string, number>>;
  rowTotals: Record<string, number>;
  colTotals: Record<string, number>;
  grandTotal: number;
}

export interface StallLineDetail {
  inboundLineId: string;
  stallCode: string;
  quantity: number;
}

export interface AssignableItem {
  key: string;
  sessionId: string;
  shipperId: string;
  shipperName: string;
  marketCode: string;
  quantity: number;
  inboundLineIds: string[];
  stalls: StallLineDetail[];
}

export interface StallAssignment {
  inboundLineId: string;
  quantity: number;
}

export interface DispatchSelection {
  shipperId: string;
  marketCode: string;
  sessionId?: string;
  stallAssignments?: StallAssignment[];
}

function buildSessionLabel(
  shipperName: string,
  areaNote: string | null | undefined
): string {
  if (areaNote?.trim()) return `${shipperName} (${areaNote.trim()})`;
  return shipperName;
}

function sumDispatchLoad(
  lines: { inboundLine: { quantity: number } }[]
): number {
  return lines.reduce((sum, dl) => sum + dl.inboundLine.quantity, 0);
}

async function fetchUnassignedLines(date: Date) {
  return prisma.inboundLine.findMany({
    where: {
      dispatchStatus: "unassigned",
      session: { status: "confirmed", date },
    },
    include: {
      session: { include: { shipper: true } },
      stall: { include: { market: true } },
    },
  });
}

async function fetchLinesForDispatch(dispatchOrderId: string) {
  return prisma.inboundLine.findMany({
    where: {
      dispatchLines: { some: { dispatchOrderId } },
    },
    include: {
      session: { include: { shipper: true } },
      stall: { include: { market: true } },
    },
  });
}

function aggregateLines(
  lines: Awaited<ReturnType<typeof fetchUnassignedLines>>
): AssignableItem[] {
  const map = new Map<string, AssignableItem>();

  for (const line of lines) {
    const marketCode = line.stall.market?.code;
    if (!marketCode) continue;

    const shipperId = line.session.shipperId;
    const sessionId = line.sessionId;
    const key = `${sessionId}:${marketCode}`;

    const existing = map.get(key);
    if (existing) {
      existing.quantity += line.quantity;
      existing.inboundLineIds.push(line.id);
      existing.stalls.push({
        inboundLineId: line.id,
        stallCode: line.stall.code,
        quantity: line.quantity,
      });
    } else {
      map.set(key, {
        key,
        sessionId,
        shipperId,
        shipperName: buildSessionLabel(
          line.session.shipper.name,
          line.session.areaNote
        ),
        marketCode,
        quantity: line.quantity,
        inboundLineIds: [line.id],
        stalls: [
          {
            inboundLineId: line.id,
            stallCode: line.stall.code,
            quantity: line.quantity,
          },
        ],
      });
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.shipperName.localeCompare(b.shipperName)
  );
}

export async function getUnassignedMatrix(
  dateStr: string
): Promise<DispatchMatrixData> {
  const date = parseDateInput(dateStr);
  const lines = await fetchUnassignedLines(date);

  const sessionMap = new Map<string, string>();
  const cells: Record<string, Record<string, number>> = {};
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  let grandTotal = 0;

  for (const line of lines) {
    const marketCode = line.stall.market?.code;
    if (!marketCode) continue;

    const sessionId = line.sessionId;
    sessionMap.set(
      sessionId,
      buildSessionLabel(line.session.shipper.name, line.session.areaNote)
    );

    if (!cells[sessionId]) cells[sessionId] = {};
    cells[sessionId][marketCode] =
      (cells[sessionId][marketCode] ?? 0) + line.quantity;

    rowTotals[sessionId] = (rowTotals[sessionId] ?? 0) + line.quantity;
    colTotals[marketCode] = (colTotals[marketCode] ?? 0) + line.quantity;
    grandTotal += line.quantity;
  }

  const shippers = Array.from(sessionMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const activeMarkets = getActiveMarkets(colTotals, DISPATCH_MARKET_ORDER);

  return {
    shippers,
    markets: activeMarkets,
    cells,
    rowTotals,
    colTotals,
    grandTotal,
  };
}

export async function getTrucks() {
  return prisma.truck.findMany({
    where: { active: true },
    orderBy: { plate: "asc" },
    select: { id: true, plate: true, type: true, capacityTong: true },
  });
}

export async function getDispatchOrders(dateStr: string) {
  const date = parseDateInput(dateStr);
  const orders = await prisma.dispatchOrder.findMany({
    where: { date },
    include: {
      truck: true,
      lines: {
        include: {
          inboundLine: {
            include: { session: { include: { shipper: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((o) => ({
    id: o.id,
    dispatchNo: o.dispatchNo,
    date: o.date,
    truckPlate: o.truck.plate,
    driverName: o.driverName,
    markets: o.markets,
    status: o.status,
    totalQty: sumDispatchLoad(o.lines),
    capacity: o.truck.capacityTong,
  }));
}

export async function getAssignableItems(
  dateStr: string,
  markets: string[],
  dispatchOrderId?: string
): Promise<AssignableItem[]> {
  const date = parseDateInput(dateStr);
  const unassigned = await fetchUnassignedLines(date);
  const assignedHere = dispatchOrderId
    ? await fetchLinesForDispatch(dispatchOrderId)
    : [];

  const filtered = [
    ...unassigned,
    ...assignedHere.filter((l) => l.dispatchStatus === "assigned"),
  ].filter((l) => {
    const code = l.stall.market?.code;
    return code && markets.includes(code);
  });

  return aggregateLines(filtered);
}

export async function getDispatchOrder(id: string) {
  const order = await prisma.dispatchOrder.findUnique({
    where: { id },
    include: {
      truck: true,
      lines: {
        include: {
          inboundLine: {
            include: {
              session: { include: { shipper: true } },
              stall: { include: { market: true } },
            },
          },
        },
      },
    },
  });

  if (!order) return null;

  const selections: DispatchSelection[] = [];
  const selMap = new Map<string, DispatchSelection>();

  for (const dl of order.lines) {
    const line = dl.inboundLine;
    const marketCode = line.stall.market?.code ?? "";
    const key = `${line.sessionId}:${marketCode}`;
    if (!selMap.has(key)) {
      selMap.set(key, {
        shipperId: line.session.shipperId,
        marketCode,
        sessionId: line.sessionId,
      });
    }
  }
  selections.push(...Array.from(selMap.values()));

  return {
    id: order.id,
    dispatchNo: order.dispatchNo,
    date: order.date,
    truckId: order.truckId,
    truckPlate: order.truck.plate,
    capacity: order.truck.capacityTong,
    driverName: order.driverName ?? "",
    markets: order.markets,
    status: order.status,
    selections,
    totalQty: sumDispatchLoad(order.lines),
  };
}

interface SaveDispatchInput {
  date: string;
  truckId: string;
  driverName: string;
  markets: string[];
  selections: DispatchSelection[];
  dispatchOrderId?: string;
}

type LineRecord = Awaited<ReturnType<typeof fetchUnassignedLines>>[number];

async function resolveAssignments(
  date: Date,
  selections: DispatchSelection[],
  dispatchOrderId?: string
): Promise<StallAssignment[]> {
  const unassigned = await fetchUnassignedLines(date);
  const assignedHere = dispatchOrderId
    ? await fetchLinesForDispatch(dispatchOrderId)
    : [];

  const allLines = [...unassigned, ...assignedHere];
  const assignments: StallAssignment[] = [];

  for (const sel of selections) {
    if (sel.stallAssignments && sel.stallAssignments.length > 0) {
      for (const sa of sel.stallAssignments) {
        if (sa.quantity > 0) assignments.push(sa);
      }
      continue;
    }

    const matching = allLines.filter(
      (l) =>
        l.session.shipperId === sel.shipperId &&
        l.stall.market?.code === sel.marketCode &&
        (!sel.sessionId || l.sessionId === sel.sessionId)
    );
    for (const line of matching) {
      assignments.push({ inboundLineId: line.id, quantity: line.quantity });
    }
  }

  return assignments;
}

async function splitAndAssignLine(
  tx: Prisma.TransactionClient,
  line: LineRecord,
  assignQty: number
): Promise<string> {
  if (assignQty <= 0) throw new Error("分配数量无效 Invalid assignment quantity");
  if (assignQty >= line.quantity) return line.id;

  const remainder = line.quantity - assignQty;
  await tx.inboundLine.update({
    where: { id: line.id },
    data: { quantity: assignQty },
  });
  await tx.inboundLine.create({
    data: {
      sessionId: line.sessionId,
      stallId: line.stallId,
      tongTypeId: line.tongTypeId,
      quantity: remainder,
      isBox: line.isBox,
      dispatchStatus: "unassigned",
    },
  });
  return line.id;
}

export async function saveDispatchOrder(input: SaveDispatchInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录 Unauthorized");

  if (input.markets.length === 0 || input.markets.length > 4) {
    throw new Error("请选择1至4个目的市场 Select 1-4 destination markets");
  }

  if (input.selections.length === 0) {
    throw new Error("请至少勾选一项货物 Please select at least one cargo item");
  }

  const date = parseDateInput(input.date);
  const assignments = await resolveAssignments(
    date,
    input.selections,
    input.dispatchOrderId
  );

  if (assignments.length === 0) {
    throw new Error("所选货物不可用或已被分配 Selected cargo unavailable");
  }

  const truck = await prisma.truck.findUnique({ where: { id: input.truckId } });
  if (!truck) throw new Error("车辆不存在 Truck not found");

  if (input.dispatchOrderId) {
    const existing = await prisma.dispatchOrder.findUnique({
      where: { id: input.dispatchOrderId },
      include: { lines: true },
    });
    if (!existing) throw new Error("派车单不存在 Dispatch order not found");

    const truckChanged = existing.truckId !== input.truckId;
    const driverChanged = (existing.driverName ?? "") !== input.driverName;

    await prisma.$transaction(async (tx) => {
      await tx.dispatchOrder.update({
        where: { id: input.dispatchOrderId },
        data: {
          truckId: input.truckId,
          driverName: input.driverName || null,
          markets: input.markets,
          status: "dispatched",
          ...(truckChanged && !existing.originalTruckId
            ? {
                originalTruckId: existing.truckId,
                modifiedAt: new Date(),
              }
            : truckChanged
              ? { modifiedAt: new Date() }
              : {}),
          ...(driverChanged && !existing.originalDriverName
            ? {
                originalDriverName: existing.driverName,
                modifiedAt: new Date(),
              }
            : driverChanged
              ? { modifiedAt: new Date() }
              : {}),
        },
      });

      for (const dl of existing.lines) {
        await tx.dispatchLine.delete({ where: { id: dl.id } });
        await tx.inboundLine.update({
          where: { id: dl.inboundLineId },
          data: { dispatchStatus: "unassigned", truckId: null },
        });
      }

      const unassigned = await fetchUnassignedLines(date);
      const lineMap = new Map(unassigned.map((l) => [l.id, l]));

      for (const assignment of assignments) {
        const line = lineMap.get(assignment.inboundLineId);
        if (!line) continue;
        const lineId = await splitAndAssignLine(
          tx,
          line,
          assignment.quantity
        );
        await tx.dispatchLine.create({
          data: {
            dispatchOrderId: input.dispatchOrderId!,
            inboundLineId: lineId,
          },
        });
        await tx.inboundLine.update({
          where: { id: lineId },
          data: {
            dispatchStatus: "assigned",
            truckId: input.truckId,
          },
        });
      }
    });

    revalidatePath("/dispatch");
    return { id: input.dispatchOrderId, dispatchNo: existing.dispatchNo };
  }

  const dispatchNo = await generateDispatchNo(date);

  const order = await prisma.$transaction(async (tx) => {
    const unassigned = await fetchUnassignedLines(date);
    const lineMap = new Map(unassigned.map((l) => [l.id, l]));
    const resolvedLineIds: string[] = [];

    for (const assignment of assignments) {
      const line = lineMap.get(assignment.inboundLineId);
      if (!line) continue;
      const lineId = await splitAndAssignLine(tx, line, assignment.quantity);
      resolvedLineIds.push(lineId);
    }

    const created = await tx.dispatchOrder.create({
      data: {
        dispatchNo,
        date,
        truckId: input.truckId,
        driverName: input.driverName || null,
        markets: input.markets,
        status: "dispatched",
        createdById: user.id,
        lines: {
          create: resolvedLineIds.map((inboundLineId) => ({ inboundLineId })),
        },
      },
    });

    await tx.inboundLine.updateMany({
      where: { id: { in: resolvedLineIds } },
      data: { dispatchStatus: "assigned", truckId: input.truckId },
    });

    return created;
  });

  revalidatePath("/dispatch");
  return { id: order.id, dispatchNo };
}
