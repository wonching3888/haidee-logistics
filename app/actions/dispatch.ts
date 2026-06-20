"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateDispatchNo } from "@/lib/dispatch";
import { parseDateInput } from "@/lib/inbound-utils";
import { buildConsignorSessionLabel } from "@/lib/consignor-label";
import { computeDriverAllowanceAmount } from "@/lib/driver-allowance";
import { decimalToNumber } from "@/lib/freight-rates";
import {
  classifyInboundFreightGap,
  computeInboundLineFreight,
  computeMcThirdPartyFeeForLine,
  MC_MARKET_CODE,
  normalizeMcDeliveryMode,
  serializeOperationalSettings,
  type InboundLineFreightSnapshot,
} from "@/lib/inbound-freight";
import { loadInboundFreightContext } from "@/lib/freight-context";
import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";
import {
  compareDispatchPriority,
  DISPATCH_MARKET_ORDER,
  DISPATCH_PRIORITY_ORDER,
  marketPriorityRank,
  sortMarkets,
} from "@/lib/markets";
import {
  handleUnloadingFeesOnDispatchCancel,
  syncUnloadingFeeEstimatesForTrip,
} from "@/lib/driver-expense-service";

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
  createdAtMs: number;
}

export interface StallAssignment {
  inboundLineId: string;
  quantity: number;
  thirdParty?: boolean;
}

export interface DispatchSelection {
  shipperId: string;
  marketCode: string;
  sessionId?: string;
  stallAssignments?: StallAssignment[];
  thirdParty?: boolean;
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
    const lineCreatedAtMs = line.session.createdAt.getTime();

    const existing = map.get(key);
    if (existing) {
      existing.quantity += line.quantity;
      existing.inboundLineIds.push(line.id);
      existing.createdAtMs = Math.min(existing.createdAtMs, lineCreatedAtMs);
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
        shipperName: buildConsignorSessionLabel(
          line.session.shipper.name,
          line.session.areaNote,
          line.session.pickupLocation,
          line.session.shipper.pickupLocation
        ),
        marketCode,
        quantity: line.quantity,
        crateQuantity: line.isBox ? 0 : line.quantity,
        boxQuantity: line.isBox ? line.quantity : 0,
        inboundLineIds: [line.id],
        createdAtMs: lineCreatedAtMs,
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
    compareDispatchPriority(
      { marketCode: a.marketCode, createdAtMs: a.createdAtMs },
      { marketCode: b.marketCode, createdAtMs: b.createdAtMs }
    )
  );
}

export async function getUnassignedMatrix(
  dateStr: string
): Promise<DispatchMatrixData> {
  const date = parseDateInput(dateStr);
  const lines = await fetchUnassignedLines(date);

  const sessionMap = new Map<string, string>();
  const sessionCreatedAt = new Map<string, number>();
  const sessionBestRank = new Map<string, number>();
  const cells: Record<string, Record<string, CrateBoxQty>> = {};
  const rowTotals: Record<string, CrateBoxQty> = {};
  const colTotals: Record<string, CrateBoxQty> = {};
  let grandTotal = emptyQty();

  for (const line of lines) {
    const marketCode = line.stall.market?.code;
    if (!marketCode) continue;

    const sessionId = line.sessionId;
    const createdAtMs = line.session.createdAt.getTime();
    sessionCreatedAt.set(
      sessionId,
      Math.min(sessionCreatedAt.get(sessionId) ?? createdAtMs, createdAtMs)
    );
    const rank = marketPriorityRank(marketCode);
    sessionBestRank.set(
      sessionId,
      Math.min(sessionBestRank.get(sessionId) ?? rank, rank)
    );
    sessionMap.set(
      sessionId,
      buildConsignorSessionLabel(
        line.session.shipper.name,
        line.session.areaNote,
        line.session.pickupLocation,
        line.session.shipper.pickupLocation
      )
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
    .sort((a, b) => {
      const rankDiff =
        (sessionBestRank.get(a.id) ?? 999) - (sessionBestRank.get(b.id) ?? 999);
      if (rankDiff !== 0) return rankDiff;
      return (
        (sessionCreatedAt.get(a.id) ?? 0) - (sessionCreatedAt.get(b.id) ?? 0)
      );
    });

  return {
    shippers,
    markets: [...DISPATCH_MARKET_ORDER],
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
  const ordered = DISPATCH_PRIORITY_ORDER.filter((code) => codes.has(code));
  const extras = markets
    .map((market) => market.code)
    .filter(
      (code) =>
        !(DISPATCH_PRIORITY_ORDER as readonly string[]).includes(code)
    );
  return [...ordered, ...sortMarkets(extras, DISPATCH_PRIORITY_ORDER)];
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
    orderBy: { createdAt: "asc" },
  });

  const sortedOrders = [...orders].sort((a, b) => {
    const rankA =
      a.markets.length > 0
        ? Math.min(...a.markets.map((code) => marketPriorityRank(code)))
        : 999;
    const rankB =
      b.markets.length > 0
        ? Math.min(...b.markets.map((code) => marketPriorityRank(code)))
        : 999;
    if (rankA !== rankB) return rankA - rankB;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  return sortedOrders.map((o) => ({
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
    const isMcThirdParty =
      marketCode === MC_MARKET_CODE && line.mcDeliveryMode === "third_party";
    if (!selMap.has(key)) {
      selMap.set(key, {
        shipperId: line.session.shipperId,
        marketCode,
        sessionId: line.sessionId,
        thirdParty: isMcThirdParty,
      });
    } else if (isMcThirdParty) {
      const existing = selMap.get(key)!;
      selMap.set(key, { ...existing, thirdParty: true });
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
  const [unassigned, assignedHere] = await Promise.all([
    fetchUnassignedLines(date),
    dispatchOrderId
      ? fetchLinesForDispatch(dispatchOrderId)
      : Promise.resolve([]),
  ]);
  const assignedHereIds = new Set(assignedHere.map((l) => l.id));

  const allLines = [...unassigned, ...assignedHere];
  const assignments: StallAssignment[] = [];

  for (const sel of selections) {
    const thirdParty =
      sel.thirdParty === true && sel.marketCode === MC_MARKET_CODE;

    if (sel.stallAssignments && sel.stallAssignments.length > 0) {
      for (const sa of sel.stallAssignments) {
        if (sa.quantity > 0) {
          assignments.push({
            inboundLineId: sa.inboundLineId,
            quantity: sa.quantity,
            thirdParty: sa.thirdParty ?? thirdParty,
          });
        }
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
      assignments.push({
        inboundLineId: line.id,
        quantity: line.quantity,
        thirdParty,
      });
    }
  }

  return assignments;
}

type SplittableLine = Pick<
  LineRecord,
  "id" | "sessionId" | "stallId" | "tongTypeId" | "quantity" | "isBox"
>;

const freightSnapshotSelect = {
  consigneeId: true,
  paymentParty: true,
  paymentMode: true,
  currency: true,
  billingCompany: true,
  freightRate: true,
  freightAmount: true,
  exchangeRate: true,
  mcDeliveryMode: true,
  thirdPartyFee: true,
  mySegmentFreightRate: true,
  mySegmentFreightAmount: true,
  thFreightRate: true,
  thFreightAmount: true,
} as const;

type FreightSnapshotRow = {
  consigneeId: string | null;
  paymentParty: string | null;
  paymentMode: string | null;
  currency: string | null;
  billingCompany: string | null;
  freightRate: Prisma.Decimal | null;
  freightAmount: Prisma.Decimal | null;
  exchangeRate: Prisma.Decimal | null;
  mcDeliveryMode: string | null;
  thirdPartyFee: Prisma.Decimal | null;
  mySegmentFreightRate: Prisma.Decimal | null;
  mySegmentFreightAmount: Prisma.Decimal | null;
  thFreightRate: Prisma.Decimal | null;
  thFreightAmount: Prisma.Decimal | null;
};

function freightRevenueSnapshotUpdateData(snapshot: InboundLineFreightSnapshot) {
  return {
    consigneeId: snapshot.consigneeId,
    paymentParty: snapshot.paymentParty,
    paymentMode: snapshot.paymentMode,
    currency: snapshot.currency,
    billingCompany: snapshot.billingCompany,
    freightRate: snapshot.freightRate,
    freightAmount: snapshot.freightAmount,
    exchangeRate: snapshot.exchangeRate,
    mySegmentFreightRate: snapshot.mySegmentFreightRate,
    mySegmentFreightAmount: snapshot.mySegmentFreightAmount,
    thFreightRate: snapshot.thFreightRate,
    thFreightAmount: snapshot.thFreightAmount,
  };
}

/**
 * When lines are assigned at dispatch time, backfill freight snapshots if missing.
 * Uses dispatch order date for rate lookup (not session date) so rates effective
 * before dispatch day are available — covers delayed entry + late assignment.
 */
async function ensureFreightSnapshotsForAssignedLines(
  tx: Prisma.TransactionClient,
  lineIds: string[],
  dispatchDate: Date,
  dispatchOrderId: string
) {
  if (lineIds.length === 0) return;

  const lines = await tx.inboundLine.findMany({
    where: { id: { in: lineIds }, freightAmount: null },
    select: {
      id: true,
      stallId: true,
      tongTypeId: true,
      quantity: true,
      mcDeliveryMode: true,
      session: {
        select: {
          shipperId: true,
          pickupLocation: true,
          shipper: { select: { pickupLocation: true } },
        },
      },
      stall: { select: { market: { select: { code: true } } } },
    },
  });
  if (lines.length === 0) return;

  const ctxCache = new Map<
    string,
    Awaited<ReturnType<typeof loadInboundFreightContext>>["ctx"]
  >();

  for (const line of lines) {
    const pickup = resolveSessionPickupLocation(
      line.session.pickupLocation,
      line.session.shipper.pickupLocation
    );
    const cacheKey = `${line.session.shipperId}|${pickup}|${dispatchDate.toISOString().slice(0, 10)}`;
    let freightCtx = ctxCache.get(cacheKey);
    if (!freightCtx) {
      const loaded = await loadInboundFreightContext(
        line.session.shipperId,
        [line.stallId],
        [line.tongTypeId],
        dispatchDate,
        pickup
      );
      freightCtx = loaded.ctx;
      ctxCache.set(cacheKey, freightCtx);
    }

    const marketCode = line.stall.market?.code ?? "";
    const snapshot = computeInboundLineFreight(
      {
        stallId: line.stallId,
        tongTypeId: line.tongTypeId,
        quantity: line.quantity,
        mcDeliveryMode:
          marketCode === MC_MARKET_CODE
            ? "self"
            : normalizeMcDeliveryMode(marketCode, line.mcDeliveryMode),
      },
      freightCtx
    );

    if ((snapshot.freightAmount ?? 0) > 0) {
      await tx.inboundLine.update({
        where: { id: line.id },
        data: freightRevenueSnapshotUpdateData(snapshot),
      });
      continue;
    }

    const gap =
      classifyInboundFreightGap(
        {
          stallId: line.stallId,
          tongTypeId: line.tongTypeId,
          quantity: line.quantity,
          mcDeliveryMode:
            marketCode === MC_MARKET_CODE
              ? "self"
              : normalizeMcDeliveryMode(marketCode, line.mcDeliveryMode),
        },
        freightCtx,
        snapshot
      ) ?? "unknown";

    console.warn(
      JSON.stringify({
        event: "dispatch_freight_snapshot_missing",
        dispatchOrderId,
        inboundLineId: line.id,
        shipperId: line.session.shipperId,
        marketCode,
        gapReason: gap,
        rateAsOfDate: dispatchDate.toISOString().slice(0, 10),
      })
    );
  }
}

function prorateFreightAmount(
  value: Prisma.Decimal | null,
  ratio: number
): number | null {
  const amount = decimalToNumber(value);
  if (amount == null) return null;
  return Math.round(amount * ratio * 100) / 100;
}

type FreightSnapshotWrite = {
  consigneeId: string | null;
  paymentParty: string | null;
  paymentMode: string | null;
  currency: string | null;
  billingCompany: string | null;
  freightRate: Prisma.Decimal | null;
  freightAmount: number | null;
  exchangeRate: Prisma.Decimal | null;
  mcDeliveryMode: string | null;
  thirdPartyFee: number | null;
  mySegmentFreightRate: Prisma.Decimal | null;
  mySegmentFreightAmount: number | null;
  thFreightRate: Prisma.Decimal | null;
  thFreightAmount: number | null;
};

function splitFreightSnapshotFields(
  snapshot: FreightSnapshotRow,
  assignQty: number,
  originalQty: number
): {
  assigned: FreightSnapshotWrite;
  remainder: FreightSnapshotWrite;
} {
  const assignRatio = assignQty / originalQty;
  const remainderRatio = (originalQty - assignQty) / originalQty;

  const shared = {
    consigneeId: snapshot.consigneeId,
    paymentParty: snapshot.paymentParty,
    paymentMode: snapshot.paymentMode,
    currency: snapshot.currency,
    billingCompany: snapshot.billingCompany,
    freightRate: snapshot.freightRate,
    exchangeRate: snapshot.exchangeRate,
    mcDeliveryMode: snapshot.mcDeliveryMode,
    mySegmentFreightRate: snapshot.mySegmentFreightRate,
    thFreightRate: snapshot.thFreightRate,
  };

  const prorateAmounts = (ratio: number) => ({
    ...shared,
    freightAmount: prorateFreightAmount(snapshot.freightAmount, ratio),
    thirdPartyFee: prorateFreightAmount(snapshot.thirdPartyFee, ratio),
    mySegmentFreightAmount: prorateFreightAmount(
      snapshot.mySegmentFreightAmount,
      ratio
    ),
    thFreightAmount: prorateFreightAmount(snapshot.thFreightAmount, ratio),
  });

  return {
    assigned: prorateAmounts(assignRatio),
    remainder: prorateAmounts(remainderRatio),
  };
}

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
  const snapshot = await tx.inboundLine.findUnique({
    where: { id: line.id },
    select: freightSnapshotSelect,
  });
  const freightSplit = splitFreightSnapshotFields(
    snapshot ?? {
      consigneeId: null,
      paymentParty: null,
      paymentMode: null,
      currency: null,
      billingCompany: null,
      freightRate: null,
      freightAmount: null,
      exchangeRate: null,
      mcDeliveryMode: null,
      thirdPartyFee: null,
      mySegmentFreightRate: null,
      mySegmentFreightAmount: null,
      thFreightRate: null,
      thFreightAmount: null,
    },
    assignQty,
    line.quantity
  );

  await tx.inboundLine.update({
    where: { id: line.id },
    data: {
      quantity: assignQty,
      ...freightSplit.assigned,
    },
  });
  await tx.inboundLine.create({
    data: {
      sessionId: line.sessionId,
      stallId: line.stallId,
      tongTypeId: line.tongTypeId,
      quantity: remainder,
      isBox: line.isBox,
      dispatchStatus: "unassigned",
      ...freightSplit.remainder,
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

  await ensureFreightSnapshotsForAssignedLines(
    tx,
    assignedLineIds,
    date,
    dispatchOrderId
  );

  await applyMcDeliveryToAssignedLines(tx, assignments);
}

async function applyMcDeliveryToAssignedLines(
  tx: Prisma.TransactionClient,
  assignments: StallAssignment[]
): Promise<void> {
  if (assignments.length === 0) return;

  const settingsRow = await tx.freightOperationalSettings.findUnique({
    where: { id: "default" },
  });
  const operationalSettings = serializeOperationalSettings(settingsRow);

  const lineIds = Array.from(new Set(assignments.map((a) => a.inboundLineId)));
  const lines = await tx.inboundLine.findMany({
    where: { id: { in: lineIds } },
    select: {
      id: true,
      quantity: true,
      isBox: true,
      stall: { select: { market: { select: { code: true } } } },
    },
  });
  const lineMap = new Map(lines.map((line) => [line.id, line]));
  const thirdPartyByLineId = new Map(
    assignments.map((a) => [a.inboundLineId, a.thirdParty === true])
  );

  for (const lineId of lineIds) {
    const line = lineMap.get(lineId);
    if (!line || line.stall.market?.code !== MC_MARKET_CODE) continue;

    if (thirdPartyByLineId.get(lineId)) {
      const fee = computeMcThirdPartyFeeForLine(
        line.isBox,
        line.quantity,
        operationalSettings
      );
      await tx.inboundLine.update({
        where: { id: lineId },
        data: {
          mcDeliveryMode: "third_party",
          thirdPartyFee: fee ?? 0,
        },
      });
    } else {
      await tx.inboundLine.update({
        where: { id: lineId },
        data: {
          mcDeliveryMode: "self",
          thirdPartyFee: 0,
        },
      });
    }
  }
}

async function resetMcDeliveryOnReleasedLines(
  tx: Prisma.TransactionClient,
  inboundLineIds: string[]
): Promise<void> {
  if (inboundLineIds.length === 0) return;

  const mcLines = await tx.inboundLine.findMany({
    where: {
      id: { in: inboundLineIds },
      stall: { market: { code: MC_MARKET_CODE } },
    },
    select: { id: true },
  });
  if (mcLines.length === 0) return;

  const mcLineIds = mcLines.map((line) => line.id);
  for (let i = 0; i < mcLineIds.length; i += DISPATCH_BATCH_SIZE) {
    const batch = mcLineIds.slice(i, i + DISPATCH_BATCH_SIZE);
    await tx.inboundLine.updateMany({
      where: { id: { in: batch } },
      data: { mcDeliveryMode: "self", thirdPartyFee: 0 },
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

  await resetMcDeliveryOnReleasedLines(tx, inboundLineIds);

  for (let i = 0; i < inboundLineIds.length; i += DISPATCH_BATCH_SIZE) {
    const batch = inboundLineIds.slice(i, i + DISPATCH_BATCH_SIZE);
    await tx.inboundLine.updateMany({
      where: { id: { in: batch } },
      data: { dispatchStatus: "unassigned", truckId: null },
    });
  }
}

async function syncDispatchDriverAllowance(
  tx: Prisma.TransactionClient,
  dispatchOrderId: string
) {
  const [settings, lines] = await Promise.all([
    tx.freightOperationalSettings.findUnique({ where: { id: "default" } }),
    tx.dispatchLine.findMany({
      where: { dispatchOrderId },
      include: {
        inboundLine: {
          include: {
            stall: { include: { market: true } },
          },
        },
      },
    }),
  ]);

  const allowanceLines = lines.map((row) => ({
    marketCode: row.inboundLine.stall.market?.code ?? "",
    quantity: row.inboundLine.quantity,
    isBox: row.inboundLine.isBox,
  }));

  const { crates, amount } = computeDriverAllowanceAmount(
    allowanceLines,
    decimalToNumber(settings?.driverAllowancePerCrate)
  );

  await tx.dispatchOrder.update({
    where: { id: dispatchOrderId },
    data: {
      driverAllowanceCrates: crates,
      driverAllowanceAmount: amount,
    },
  });
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

  if (input.dispatchOrderId) {
    const [truck, existing] = await Promise.all([
      prisma.truck.findUnique({
        where: { id: input.truckId },
        select: { id: true },
      }),
      prisma.dispatchOrder.findUnique({
        where: { id: input.dispatchOrderId },
        select: {
          dispatchNo: true,
          truckId: true,
          driverName: true,
          originalTruckId: true,
          originalDriverName: true,
          lines: { select: { inboundLineId: true } },
        },
      }),
    ]);
    if (!truck) throw new Error("车辆不存在 Truck not found");
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
      await syncDispatchDriverAllowance(tx, input.dispatchOrderId!);
    }, DISPATCH_TRANSACTION_OPTIONS);

    await syncUnloadingFeeEstimatesForTrip(input.dispatchOrderId!);

    revalidatePath("/dispatch");
    revalidatePath("/summary");
    revalidatePath("/documents/driver-expenses");
    return {
      id: input.dispatchOrderId,
      dispatchNo: existing.dispatchNo,
      date: input.date,
    };
  }

  const [truck, dispatchNo] = await Promise.all([
    prisma.truck.findUnique({
      where: { id: input.truckId },
      select: { id: true },
    }),
    generateDispatchNo(date),
  ]);
  if (!truck) throw new Error("车辆不存在 Truck not found");

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
    await syncDispatchDriverAllowance(tx, created.id);

    return created;
  }, DISPATCH_TRANSACTION_OPTIONS);

  await syncUnloadingFeeEstimatesForTrip(order.id);

  revalidatePath("/dispatch");
  revalidatePath("/summary");
  revalidatePath("/documents/driver-expenses");
  return { id: order.id, dispatchNo, date: input.date };
}

export async function cancelDispatchOrder(dispatchOrderId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录 Unauthorized");

  const order = await prisma.dispatchOrder.findUnique({
    where: { id: dispatchOrderId },
    select: {
      status: true,
      lines: { select: { inboundLineId: true } },
    },
  });
  if (!order) throw new Error("派车单不存在 Dispatch order not found");
  if (order.status === "cancelled") {
    throw new Error("派车单已取消 Dispatch order already cancelled");
  }

  const inboundLineIds = order.lines.map((line) => line.inboundLineId);

  await prisma.$transaction(async (tx) => {
    await tx.dispatchOrder.update({
      where: { id: dispatchOrderId },
      data: { status: "cancelled" },
    });

    await tx.dispatchLine.deleteMany({ where: { dispatchOrderId } });

    if (inboundLineIds.length > 0) {
      await resetMcDeliveryOnReleasedLines(tx, inboundLineIds);
      await tx.inboundLine.updateMany({
        where: { id: { in: inboundLineIds } },
        data: { dispatchStatus: "unassigned", truckId: null },
      });
    }
  }, DISPATCH_TRANSACTION_OPTIONS);

  await handleUnloadingFeesOnDispatchCancel(dispatchOrderId);

  revalidatePath("/dispatch");
  revalidatePath("/summary");
  revalidatePath("/documents");
  revalidatePath("/documents/driver-expenses");
}

export async function changeDispatchTruck(
  dispatchOrderId: string,
  truckId: string
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录 Unauthorized");

  const [order, truck] = await Promise.all([
    prisma.dispatchOrder.findUnique({
      where: { id: dispatchOrderId },
      select: {
        status: true,
        truckId: true,
        originalTruckId: true,
        lines: { select: { inboundLineId: true } },
      },
    }),
    prisma.truck.findUnique({
      where: { id: truckId },
      select: { active: true },
    }),
  ]);
  if (!order) throw new Error("派车单不存在 Dispatch order not found");
  if (order.status === "cancelled") {
    throw new Error("已取消的派车单无法换车 Cannot change truck on cancelled order");
  }
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

  await syncUnloadingFeeEstimatesForTrip(dispatchOrderId);

  revalidatePath("/dispatch");
  revalidatePath("/summary");
  revalidatePath("/documents");
  revalidatePath("/documents/driver-expenses");
}
