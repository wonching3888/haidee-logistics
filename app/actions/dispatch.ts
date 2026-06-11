"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateDispatchNo } from "@/lib/dispatch";
import { parseDateInput } from "@/lib/inbound-utils";
import { buildConsignorAreaLabel } from "@/lib/consignor-label";
import {
  DISPATCH_MARKET_ORDER,
  MARKET_ORDER,
  sortMarkets,
} from "@/lib/markets";

export interface CrateBoxQty {
  crate: number;
  box: number;
}

export interface DispatchMatrixData {
  shippers: { id: string; name: string }[];
  markets: string[];
  cells: Record<string, Record<string, CrateBoxQty>>;
  rowTotals: Record<string, CrateBoxQty>;
  colTotals: Record<string, CrateBoxQty>;
  grandTotal: CrateBoxQty;
}

function emptyQty(): CrateBoxQty {
  return { crate: 0, box: 0 };
}

function addLineQty(
  qty: CrateBoxQty,
  quantity: number,
  isBox: boolean
): CrateBoxQty {
  if (isBox) return { ...qty, box: qty.box + quantity };
  return { ...qty, crate: qty.crate + quantity };
}

function hasQty(qty: CrateBoxQty): boolean {
  return qty.crate > 0 || qty.box > 0;
}

export interface StallLineDetail {
  inboundLineId: string;
  stallCode: string;
  quantity: number;
  isBox: boolean;
}

export interface AssignableItem {
  key: string;
  sessionId: string;
  shipperId: string;
  shipperName: string;
  marketCode: string;
  quantity: number;
  crateQuantity: number;
  boxQuantity: number;
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

function sumDispatchLoad(
  lines: { inboundLine: { quantity: number; isBox: boolean } }[]
): number {
  return lines.reduce(
    (sum, dl) =>
      sum + (dl.inboundLine.isBox ? 0 : dl.inboundLine.quantity),
    0
  );
}

const DISPATCH_BATCH_SIZE = 10;

const DISPATCH_TRANSACTION_OPTIONS = {
  timeout: 60_000,
  maxWait: 15_000,
} as const;

const lineInclude = {
  session: { include: { shipper: true } },
  stall: { include: { market: true } },
} as const;

function unassignedLineWhere(date: Date): Prisma.InboundLineWhereInput {
  return {
    dispatchStatus: "unassigned",
    dispatchLines: { none: {} },
    session: { status: "confirmed", date },
  };
}

async function fetchUnassignedLines(date: Date) {
  return prisma.inboundLine.findMany({
    where: unassignedLineWhere(date),
    include: lineInclude,
  });
}

async function fetchLinesForDispatch(dispatchOrderId: string) {
  return prisma.inboundLine.findMany({
    where: {
      dispatchLines: { some: { dispatchOrderId } },
    },
    include: lineInclude,
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
        isBox: line.isBox,
      });
      if (!line.isBox) {
        existing.crateQuantity += line.quantity;
      } else {
        existing.boxQuantity += line.quantity;
      }
    } else {
      map.set(key, {
        key,
        sessionId,
        shipperId,
        shipperName: buildConsignorAreaLabel(
          line.session.shipper.name,
          line.session.areaNote
        ),
        marketCode,
        quantity: line.quantity,
        crateQuantity: line.isBox ? 0 : line.quantity,
        boxQuantity: line.isBox ? line.quantity : 0,
        inboundLineIds: [line.id],
        stalls: [
          {
            inboundLineId: line.id,
            stallCode: line.stall.code,
            quantity: line.quantity,
            isBox: line.isBox,
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
  const cells: Record<string, Record<string, CrateBoxQty>> = {};
  const rowTotals: Record<string, CrateBoxQty> = {};
  const colTotals: Record<string, CrateBoxQty> = {};
  let grandTotal = emptyQty();

  for (const line of lines) {
    const marketCode = line.stall.market?.code;
    if (!marketCode) continue;

    const sessionId = line.sessionId;
    sessionMap.set(
      sessionId,
      buildConsignorAreaLabel(line.session.shipper.name, line.session.areaNote)
    );

    if (!cells[sessionId]) cells[sessionId] = {};
    const cell = cells[sessionId][marketCode] ?? emptyQty();
    cells[sessionId][marketCode] = addLineQty(cell, line.quantity, line.isBox);

    rowTotals[sessionId] = addLineQty(
      rowTotals[sessionId] ?? emptyQty(),
      line.quantity,
      line.isBox
    );
    colTotals[marketCode] = addLineQty(
      colTotals[marketCode] ?? emptyQty(),
      line.quantity,
      line.isBox
    );
    grandTotal = addLineQty(grandTotal, line.quantity, line.isBox);
  }

  const shippers = Array.from(sessionMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const activeMarkets = (() => {
    const withData = DISPATCH_MARKET_ORDER.filter((c) =>
      hasQty(colTotals[c] ?? emptyQty())
    );
    return withData.length > 0 ? [...withData] : [...DISPATCH_MARKET_ORDER];
  })();

  return {
    shippers,
    markets: activeMarkets,
    cells,
    rowTotals,
    colTotals,
    grandTotal,
  };
}

export async function getDispatchMarkets(): Promise<string[]> {
  const markets = await prisma.market.findMany({
    where: { active: true },
    select: { code: true },
  });
  const codes = new Set(markets.map((market) => market.code));
  const ordered = DISPATCH_MARKET_ORDER.filter((code) => codes.has(code));
  const extras = markets
    .map((market) => market.code)
    .filter(
      (code) =>
        !(DISPATCH_MARKET_ORDER as readonly string[]).includes(code)
    );
  return [...ordered, ...sortMarkets(extras, MARKET_ORDER)];
}

export async function getDrivers() {
  return prisma.driver.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getTrucks() {
  const trucks = await prisma.truck.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { plate: "asc" }],
    select: {
      id: true,
      plate: true,
      type: true,
      capacityTong: true,
      defaultDriverId: true,
      defaultDriver: { select: { name: true } },
    },
  });

  return trucks.map((truck) => ({
    id: truck.id,
    plate: truck.plate,
    type: truck.type,
    capacityTong: truck.capacityTong,
    defaultDriverId: truck.defaultDriverId,
    defaultDriverName: truck.defaultDriver?.name ?? "",
  }));
}

export async function getDispatchOrders(dateStr: string) {
  const date = parseDateInput(dateStr);
  const orders = await prisma.dispatchOrder.findMany({
    where: { date, status: { notIn: ["draft", "cancelled"] } },
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
    truckId: o.truckId,
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

  const lines = dispatchOrderId
    ? [
        ...(await fetchUnassignedLines(date)),
        ...(await fetchLinesForDispatch(dispatchOrderId)).filter(
          (l) => l.dispatchStatus === "assigned"
        ),
      ]
    : await fetchUnassignedLines(date);

  const filtered = lines.filter((l) => {
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
  const assignedHereIds = new Set(assignedHere.map((l) => l.id));

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
        (!sel.sessionId || l.sessionId === sel.sessionId) &&
        (l.dispatchStatus === "unassigned" || assignedHereIds.has(l.id))
    );
    for (const line of matching) {
      assignments.push({ inboundLineId: line.id, quantity: line.quantity });
    }
  }

  return assignments;
}

type SplittableLine = Pick<
  LineRecord,
  "id" | "sessionId" | "stallId" | "tongTypeId" | "quantity" | "isBox"
>;

async function splitAndAssignLine(
  tx: Prisma.TransactionClient,
  line: SplittableLine,
  assignQty: number
): Promise<string> {
  if (assignQty <= 0) throw new Error("分配数量无效 Invalid assignment quantity");
  if (assignQty > line.quantity) {
    throw new Error(
      `分配数量不能超过可用数量 ${line.quantity} Cannot assign more than available quantity`
    );
  }
  if (assignQty === line.quantity) return line.id;

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

async function assignLinesToOrder(
  tx: Prisma.TransactionClient,
  dispatchOrderId: string,
  truckId: string,
  date: Date,
  assignments: StallAssignment[]
): Promise<void> {
  if (assignments.length === 0) return;

  const lineIds = Array.from(
    new Set(assignments.map((a) => a.inboundLineId))
  );
  const lines = await tx.inboundLine.findMany({
    where: {
      id: { in: lineIds },
      ...unassignedLineWhere(date),
    },
    select: {
      id: true,
      sessionId: true,
      stallId: true,
      tongTypeId: true,
      quantity: true,
      isBox: true,
    },
  });
  const lineMap = new Map(lines.map((line) => [line.id, line]));

  const dispatchLineRows: {
    dispatchOrderId: string;
    inboundLineId: string;
  }[] = [];
  const assignedLineIds: string[] = [];

  for (const assignment of assignments) {
    const line = lineMap.get(assignment.inboundLineId);
    if (!line) {
      throw new Error(
        "所选货物不可用或已被分配 Selected cargo unavailable or already assigned"
      );
    }

    const lineId = await splitAndAssignLine(tx, line, assignment.quantity);
    dispatchLineRows.push({ dispatchOrderId, inboundLineId: lineId });
    assignedLineIds.push(lineId);
  }

  for (let i = 0; i < dispatchLineRows.length; i += DISPATCH_BATCH_SIZE) {
    const batch = dispatchLineRows.slice(i, i + DISPATCH_BATCH_SIZE);
    await tx.dispatchLine.createMany({ data: batch });
  }

  for (let i = 0; i < assignedLineIds.length; i += DISPATCH_BATCH_SIZE) {
    const batch = assignedLineIds.slice(i, i + DISPATCH_BATCH_SIZE);
    await tx.inboundLine.updateMany({
      where: { id: { in: batch } },
      data: { dispatchStatus: "assigned", truckId },
    });
  }
}

async function releaseDispatchLines(
  tx: Prisma.TransactionClient,
  dispatchOrderId: string,
  inboundLineIds: string[]
): Promise<void> {
  await tx.dispatchLine.deleteMany({ where: { dispatchOrderId } });
  if (inboundLineIds.length === 0) return;

  for (let i = 0; i < inboundLineIds.length; i += DISPATCH_BATCH_SIZE) {
    const batch = inboundLineIds.slice(i, i + DISPATCH_BATCH_SIZE);
    await tx.inboundLine.updateMany({
      where: { id: { in: batch } },
      data: { dispatchStatus: "unassigned", truckId: null },
    });
  }
}

export async function saveDispatchOrder(input: SaveDispatchInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录 Unauthorized");

  if (input.markets.length === 0) {
    throw new Error("请至少选择一个目的市场 Select at least one destination market");
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

      await releaseDispatchLines(
        tx,
        input.dispatchOrderId!,
        existing.lines.map((dl) => dl.inboundLineId)
      );

      await assignLinesToOrder(
        tx,
        input.dispatchOrderId!,
        input.truckId,
        date,
        assignments
      );
    }, DISPATCH_TRANSACTION_OPTIONS);

    revalidatePath("/dispatch");
    revalidatePath("/summary");
    return {
      id: input.dispatchOrderId,
      dispatchNo: existing.dispatchNo,
      date: input.date,
    };
  }

  const dispatchNo = await generateDispatchNo(date);

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.dispatchOrder.create({
      data: {
        dispatchNo,
        date,
        truckId: input.truckId,
        driverName: input.driverName || null,
        markets: input.markets,
        status: "dispatched",
        createdById: user.id,
      },
    });

    await assignLinesToOrder(
      tx,
      created.id,
      input.truckId,
      date,
      assignments
    );

    return created;
  }, DISPATCH_TRANSACTION_OPTIONS);

  revalidatePath("/dispatch");
  revalidatePath("/summary");
  return { id: order.id, dispatchNo, date: input.date };
}

export async function cancelDispatchOrder(dispatchOrderId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录 Unauthorized");

  const order = await prisma.dispatchOrder.findUnique({
    where: { id: dispatchOrderId },
    include: { lines: true },
  });
  if (!order) throw new Error("派车单不存在 Dispatch order not found");
  if (order.status === "cancelled") {
    throw new Error("派车单已取消 Dispatch order already cancelled");
  }

  await prisma.$transaction(async (tx) => {
    await tx.dispatchOrder.update({
      where: { id: dispatchOrderId },
      data: { status: "cancelled" },
    });

    for (const dl of order.lines) {
      await tx.dispatchLine.delete({ where: { id: dl.id } });
      await tx.inboundLine.update({
        where: { id: dl.inboundLineId },
        data: { dispatchStatus: "unassigned", truckId: null },
      });
    }
  }, DISPATCH_TRANSACTION_OPTIONS);

  revalidatePath("/dispatch");
  revalidatePath("/summary");
  revalidatePath("/documents");
}

export async function changeDispatchTruck(
  dispatchOrderId: string,
  truckId: string
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录 Unauthorized");

  const order = await prisma.dispatchOrder.findUnique({
    where: { id: dispatchOrderId },
    include: { lines: true },
  });
  if (!order) throw new Error("派车单不存在 Dispatch order not found");
  if (order.status === "cancelled") {
    throw new Error("已取消的派车单无法换车 Cannot change truck on cancelled order");
  }

  const truck = await prisma.truck.findUnique({ where: { id: truckId } });
  if (!truck?.active) throw new Error("车辆不存在 Truck not found");

  const truckChanged = order.truckId !== truckId;

  await prisma.$transaction(async (tx) => {
    await tx.dispatchOrder.update({
      where: { id: dispatchOrderId },
      data: {
        truckId,
        ...(truckChanged && !order.originalTruckId
          ? { originalTruckId: order.truckId, modifiedAt: new Date() }
          : truckChanged
            ? { modifiedAt: new Date() }
            : {}),
      },
    });

    const lineIds = order.lines.map((dl) => dl.inboundLineId);
    if (lineIds.length > 0) {
      await tx.inboundLine.updateMany({
        where: { id: { in: lineIds } },
        data: { truckId },
      });
    }
  }, DISPATCH_TRANSACTION_OPTIONS);

  revalidatePath("/dispatch");
  revalidatePath("/summary");
  revalidatePath("/documents");
}
