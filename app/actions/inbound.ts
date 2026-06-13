"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  addCustomerCratesBatch,
  deductCustomerCratesBatch,
} from "@/app/actions/customerCrateStock";
import { generateSessionNo, isSessionNoUniqueViolation, SESSION_NO_MAX_RETRIES } from "@/lib/inbound";
import { MARKET_ORDER } from "@/lib/constants";
import { getMarketDisplayName } from "@/lib/constants/market-names";
import {
  formatPickupLocationLabel,
  normalizeSessionPickupInput,
  resolveInboundCrateStockLocation,
  resolveSessionPickupLocation,
} from "@/lib/constants/pickup-locations";
import {
  getStallDisplayLabel,
  isOtherMarket,
} from "@/lib/markets";
import { parseDateInput, type InboundLineInput } from "@/lib/inbound-utils";

function aggregateCrateQuantities(
  lines: { tongTypeId: string; quantity: number }[],
  typeMap: Map<string, { trackInventory: boolean; isBox: boolean }>
) {
  const byCrateType = new Map<string, number>();
  for (const line of lines) {
    const crateType = typeMap.get(line.tongTypeId);
    if (!crateType?.trackInventory || crateType.isBox) continue;
    byCrateType.set(
      line.tongTypeId,
      (byCrateType.get(line.tongTypeId) ?? 0) + line.quantity
    );
  }
  return byCrateType;
}

async function loadTongTypeMap(tongTypeIds: string[]) {
  if (tongTypeIds.length === 0) return new Map();
  const tongTypes = await prisma.tongType.findMany({
    where: { id: { in: tongTypeIds } },
    select: { id: true, trackInventory: true, isBox: true },
  });
  return new Map(tongTypes.map((t) => [t.id, t]));
}

type TongTypeMeta = { trackInventory: boolean; isBox: boolean };

async function applyInboundCrateDeduction(
  shipperId: string,
  location: string,
  lines: { tongTypeId: string; quantity: number }[],
  typeMap?: Map<string, TongTypeMeta>
) {
  if (lines.length === 0) return;

  const map =
    typeMap ??
    (await loadTongTypeMap(Array.from(new Set(lines.map((l) => l.tongTypeId)))));
  const byCrateType = aggregateCrateQuantities(lines, map);
  const deductions = Array.from(byCrateType.entries()).map(
    ([crateTypeId, quantity]) => ({ crateTypeId, quantity })
  );

  await deductCustomerCratesBatch(
    shipperId,
    deductions,
    "inbound",
    location?.trim() ?? ""
  );
}

async function reverseInboundCrateDeduction(
  shipperId: string,
  location: string,
  lines: { tongTypeId: string; quantity: number }[],
  typeMap?: Map<string, TongTypeMeta>
) {
  if (lines.length === 0) return;

  const map =
    typeMap ??
    (await loadTongTypeMap(Array.from(new Set(lines.map((l) => l.tongTypeId)))));
  const byCrateType = aggregateCrateQuantities(lines, map);
  const additions = Array.from(byCrateType.entries()).map(
    ([crateTypeId, quantity]) => ({ crateTypeId, quantity })
  );

  await addCustomerCratesBatch(
    shipperId,
    additions,
    "inbound-delete",
    location?.trim() ?? ""
  );
}

async function processNewStalls(
  shipperId: string,
  newStalls: NewStallInput[] | undefined
): Promise<InboundLineInput[]> {
  const createdLines: InboundLineInput[] = [];
  if (!newStalls?.length) return createdLines;

  const marketIds = Array.from(new Set(newStalls.map((ns) => ns.marketId)));
  const markets = await prisma.market.findMany({
    where: { id: { in: marketIds } },
    select: { id: true, code: true },
  });
  const marketCodeById = new Map(markets.map((market) => [market.id, market.code]));

  for (const ns of newStalls) {
    const marketCode = marketCodeById.get(ns.marketId);
    if (isOtherMarket(marketCode) && !ns.name?.trim()) {
      throw new Error(
        "OTHER 市场请填写目的地 Please enter a destination for OTHER market"
      );
    }
  }

  const existingStalls = await prisma.stall.findMany({
    where: {
      OR: newStalls.map((ns) => ({ code: ns.code, marketId: ns.marketId })),
    },
    select: { id: true, code: true, marketId: true },
  });
  const stallMap = new Map(
    existingStalls.map((stall) => [`${stall.code}:${stall.marketId}`, stall])
  );

  const missing = newStalls.filter(
    (ns) => !stallMap.has(`${ns.code}:${ns.marketId}`)
  );
  if (missing.length > 0) {
    await Promise.all(
      missing.map((ns) =>
        prisma.stall
          .create({
            data: {
              code: ns.code.trim(),
              name: ns.name?.trim() || null,
              marketId: ns.marketId,
            },
            select: { id: true, code: true, marketId: true },
          })
          .then((stall) => {
            stallMap.set(`${stall.code}:${stall.marketId}`, stall);
          })
      )
    );
  }

  await Promise.all(
    newStalls
      .filter((ns) => ns.name?.trim())
      .map((ns) => {
        const stall = stallMap.get(`${ns.code}:${ns.marketId}`)!;
        return prisma.stall.update({
          where: { id: stall.id },
          data: { name: ns.name!.trim() },
        });
      })
  );

  await Promise.all(
    newStalls.map((ns) => {
      const stall = stallMap.get(`${ns.code}:${ns.marketId}`)!;
      return prisma.shipperStallDefault.upsert({
        where: {
          shipperId_stallId: { shipperId, stallId: stall.id },
        },
        update: { tongTypeId: ns.tongTypeId },
        create: {
          shipperId,
          stallId: stall.id,
          tongTypeId: ns.tongTypeId,
        },
      });
    })
  );

  for (const ns of newStalls) {
    if (ns.quantity && ns.quantity > 0) {
      const stall = stallMap.get(`${ns.code}:${ns.marketId}`)!;
      createdLines.push({
        stallId: stall.id,
        tongTypeId: ns.tongTypeId,
        quantity: ns.quantity,
      });
    }
  }

  return createdLines;
}

async function syncShipperStallDefaults(
  shipperId: string,
  lines: InboundLineInput[]
) {
  const defaultsByStall = new Map<string, string>();
  for (const line of lines) {
    defaultsByStall.set(line.stallId, line.tongTypeId);
  }

  await Promise.all(
    Array.from(defaultsByStall.entries()).map(([stallId, tongTypeId]) =>
      prisma.shipperStallDefault.updateMany({
        where: { shipperId, stallId },
        data: { tongTypeId },
      })
    )
  );
}

interface ExistingInboundLine {
  id: string;
  quantity: number;
  tongTypeId: string;
  stallId: string;
  originalQuantity: number | null;
}

async function syncInboundLines(
  sessionId: string,
  allLines: InboundLineInput[],
  existingLines: ExistingInboundLine[],
  typeMap: Map<string, TongTypeMeta>,
  tx: Prisma.TransactionClient = prisma
) {
  const existingLineIds = new Set(existingLines.map((line) => line.id));
  const inputLineIds = new Set(
    allLines.filter((line) => line.lineId).map((line) => line.lineId!)
  );

  const deleteIds = existingLines
    .filter((line) => !inputLineIds.has(line.id))
    .map((line) => line.id);
  if (deleteIds.length > 0) {
    await tx.inboundLine.deleteMany({ where: { id: { in: deleteIds } } });
  }

  const updateOps: Promise<unknown>[] = [];
  for (const line of allLines) {
    if (!line.lineId || !existingLineIds.has(line.lineId)) continue;

    const prev = existingLines.find((existing) => existing.id === line.lineId)!;
    const changed =
      prev.quantity !== line.quantity ||
      prev.tongTypeId !== line.tongTypeId ||
      prev.stallId !== line.stallId;

    updateOps.push(
      tx.inboundLine.update({
        where: { id: line.lineId },
        data: {
          stallId: line.stallId,
          tongTypeId: line.tongTypeId,
          quantity: line.quantity,
          isBox: typeMap.get(line.tongTypeId)?.isBox ?? false,
          ...(changed && !prev.originalQuantity
            ? {
                originalQuantity: prev.quantity,
                originalTongTypeId: prev.tongTypeId,
                originalStallId: prev.stallId,
                modifiedAt: new Date(),
              }
            : changed
              ? { modifiedAt: new Date() }
              : {}),
        },
      })
    );
  }
  if (updateOps.length > 0) {
    await Promise.all(updateOps);
  }

  const createLines = allLines.filter(
    (line) => !line.lineId || !existingLineIds.has(line.lineId)
  );
  if (createLines.length > 0) {
    await tx.inboundLine.createMany({
      data: createLines.map((line) => ({
        sessionId,
        stallId: line.stallId,
        tongTypeId: line.tongTypeId,
        quantity: line.quantity,
        isBox: typeMap.get(line.tongTypeId)?.isBox ?? false,
      })),
    });
  }
}

export interface InboundSessionFilters {
  date?: string;
  shipperId?: string;
  status?: "unassigned" | "assigned" | "draft";
  search?: string;
}

export async function getMarkets() {
  const orderMap = new Map<string, number>(
    MARKET_ORDER.map((code, index) => [code, index])
  );
  const allowedCodes = new Set<string>(MARKET_ORDER);

  const markets = await prisma.market.findMany({
    where: { active: true },
    select: { id: true, code: true, name: true },
  });

  return markets
    .filter((market) => allowedCodes.has(market.code))
    .sort(
      (a, b) =>
        (orderMap.get(a.code) ?? 999) - (orderMap.get(b.code) ?? 999)
    )
    .map((market) => ({
      ...market,
      displayName: getMarketDisplayName(market.code),
    }));
}

export async function removeShipperStallDefault(
  shipperId: string,
  stallId: string
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录 Unauthorized");

  await prisma.shipperStallDefault.deleteMany({
    where: { shipperId, stallId },
  });
  revalidatePath("/inbound");
}

export async function getShippers() {
  return prisma.shipper.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      pickupLocation: true,
    },
  });
}

export async function getTongTypes() {
  return prisma.tongType.findMany({
    where: { active: true },
    orderBy: { displayOrder: "asc" },
    select: { id: true, code: true, name: true, isBox: true },
  });
}

export async function getShipperStalls(shipperId: string) {
  const defaults = await prisma.shipperStallDefault.findMany({
    where: { shipperId },
    include: {
      stall: { include: { market: true } },
      tongType: true,
    },
    orderBy: [{ stall: { market: { code: "asc" } } }, { stall: { code: "asc" } }],
  });

  return defaults.map((d) => ({
    stallId: d.stallId,
    stallCode: getStallDisplayLabel(
      d.stall.market?.code ?? "",
      d.stall.code,
      d.stall.name
    ),
    stallName: d.stall.name,
    marketCode: d.stall.market?.code ?? "",
    marketName: d.stall.market?.code
      ? getMarketDisplayName(d.stall.market.code)
      : "",
    defaultTongTypeId: d.tongTypeId,
    defaultTongTypeCode: d.tongType.code,
    defaultTongTypeName: d.tongType.name,
  }));
}

export async function getThVehiclePlates(shipperId: string) {
  return prisma.thVehicle.findMany({
    where: { shipperId, active: true },
    orderBy: { plate: "asc" },
    select: { plate: true },
  });
}

export async function getInboundSessions(filters: InboundSessionFilters = {}) {
  const where: Prisma.InboundSessionWhereInput = {};

  if (filters.date) {
    where.date = parseDateInput(filters.date);
  }

  if (filters.shipperId) {
    where.shipperId = filters.shipperId;
  }

  if (filters.status === "draft") {
    where.status = "draft";
  }

  if (filters.search) {
    where.shipper = {
      name: { contains: filters.search, mode: "insensitive" },
    };
  }

  const sessions = await prisma.inboundSession.findMany({
    where,
    include: {
      shipper: {
        select: { id: true, name: true, code: true, pickupLocation: true },
      },
      lines: {
        select: { quantity: true, dispatchStatus: true, isBox: true },
      },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return sessions
    .map((s) => {
      const totalQty = s.lines.reduce((sum, l) => sum + l.quantity, 0);
      const crateQty = s.lines
        .filter((l) => !l.isBox)
        .reduce((sum, l) => sum + l.quantity, 0);
      const boxQty = s.lines
        .filter((l) => l.isBox)
        .reduce((sum, l) => sum + l.quantity, 0);
      const unassignedQty = s.lines
        .filter((l) => l.dispatchStatus === "unassigned")
        .reduce((sum, l) => sum + l.quantity, 0);
      const unassignedCrateQty = s.lines
        .filter((l) => l.dispatchStatus === "unassigned" && !l.isBox)
        .reduce((sum, l) => sum + l.quantity, 0);
      const unassignedBoxQty = s.lines
        .filter((l) => l.dispatchStatus === "unassigned" && l.isBox)
        .reduce((sum, l) => sum + l.quantity, 0);
      const allAssigned =
        s.lines.length > 0 &&
        s.lines.every((l) => l.dispatchStatus === "assigned");

      return {
        id: s.id,
        sessionNo: s.sessionNo,
        date: s.date,
        status: s.status,
        shipperName: s.shipper.name,
        shipperId: s.shipper.id,
        areaNote: s.areaNote,
        pickupLocation: s.pickupLocation,
        pickupLocationLabel: formatPickupLocationLabel(
          resolveSessionPickupLocation(
            s.pickupLocation,
            s.shipper.pickupLocation
          )
        ),
        thVehiclePlate: s.thVehiclePlate,
        totalQty,
        crateQty,
        boxQty,
        unassignedQty,
        unassignedCrateQty,
        unassignedBoxQty,
        allAssigned,
      };
    })
    .filter((s) => {
      if (filters.status === "unassigned") {
        return s.status === "confirmed" && s.unassignedQty > 0;
      }
      if (filters.status === "assigned") {
        return s.status === "confirmed" && s.unassignedQty === 0 && s.totalQty > 0;
      }
      return true;
    });
}

export async function getInboundSession(id: string) {
  const session = await prisma.inboundSession.findUnique({
    where: { id },
    include: {
      shipper: {
        select: { id: true, name: true, code: true, pickupLocation: true },
      },
      lines: {
        include: {
          stall: { include: { market: true } },
          tongType: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!session) return null;

  return {
    id: session.id,
    sessionNo: session.sessionNo,
    date: session.date,
    status: session.status,
    shipperId: session.shipperId,
    shipperName: session.shipper.name,
    thVehiclePlate: session.thVehiclePlate,
    areaNote: session.areaNote,
    pickupLocation: session.pickupLocation,
    shipperPickupLocation: session.shipper.pickupLocation,
    lines: session.lines.map((l) => ({
      id: l.id,
      stallId: l.stallId,
      stallCode: getStallDisplayLabel(
        l.stall.market?.code ?? "",
        l.stall.code,
        l.stall.name
      ),
      marketCode: l.stall.market?.code ?? "",
      tongTypeId: l.tongTypeId,
      tongTypeCode: l.tongType.code,
      quantity: l.quantity,
      dispatchStatus: l.dispatchStatus,
    })),
  };
}

interface NewStallInput {
  code: string;
  name?: string;
  marketId: string;
  tongTypeId: string;
  quantity?: number;
}

interface SaveInboundInput {
  date: string;
  shipperId: string;
  thVehiclePlate?: string;
  areaNote?: string;
  pickupLocation?: string | null;
  lines: InboundLineInput[];
  removedStallIds?: string[];
  newStalls?: NewStallInput[];
  asDraft: boolean;
  sessionId?: string;
}

export async function saveInboundSession(input: SaveInboundInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录 Unauthorized");

  const date = parseDateInput(input.date);
  const sessionPickupLocation = normalizeSessionPickupInput(input.pickupLocation);
  const shipper = await prisma.shipper.findUnique({
    where: { id: input.shipperId },
    select: { pickupLocation: true },
  });
  const effectivePickup = resolveSessionPickupLocation(
    sessionPickupLocation,
    shipper?.pickupLocation
  );
  const crateStockLocation = resolveInboundCrateStockLocation(
    effectivePickup,
    input.areaNote
  );
  const activeLines = input.lines.filter(
    (l) => l.quantity > 0 && !l.stallId.startsWith("new-")
  );
  const status = input.asDraft ? "draft" : "confirmed";

  const removedStallIds =
    input.removedStallIds?.filter((stallId) => !stallId.startsWith("new-")) ??
    [];
  if (removedStallIds.length > 0) {
    await prisma.shipperStallDefault.deleteMany({
      where: {
        shipperId: input.shipperId,
        stallId: { in: removedStallIds },
      },
    });
  }

  const createdNewStallLines = await processNewStalls(
    input.shipperId,
    input.newStalls
  );
  const allLines = [...activeLines, ...createdNewStallLines];

  if (!input.asDraft && allLines.length === 0) {
    throw new Error("请至少填写一个档口的桶数 Please enter at least one quantity");
  }

  const tongTypeIds = Array.from(
    new Set([
      ...allLines.map((line) => line.tongTypeId),
      ...(input.newStalls?.map((stall) => stall.tongTypeId) ?? []),
    ])
  );
  const typeMap = await loadTongTypeMap(tongTypeIds);

  await syncShipperStallDefaults(input.shipperId, allLines);

  if (input.sessionId) {
    const existing = await prisma.inboundSession.findUnique({
      where: { id: input.sessionId },
      select: {
        sessionNo: true,
        status: true,
        lines: {
          select: {
            id: true,
            quantity: true,
            tongTypeId: true,
            stallId: true,
            originalQuantity: true,
          },
        },
      },
    });
    if (!existing) throw new Error("进货单不存在 Session not found");

    let sessionNo = existing.sessionNo;

    if (status === "confirmed" && !existing.sessionNo) {
      for (let attempt = 0; attempt < SESSION_NO_MAX_RETRIES; attempt++) {
        try {
          await prisma.$transaction(async (tx) => {
            sessionNo = await generateSessionNo(date, tx);
            await tx.inboundSession.update({
              where: { id: input.sessionId },
              data: {
                date,
                shipperId: input.shipperId,
                thVehiclePlate: input.thVehiclePlate || null,
                areaNote: input.areaNote || null,
                pickupLocation: sessionPickupLocation,
                status,
                sessionNo,
              },
            });
            await syncInboundLines(
              input.sessionId!,
              allLines,
              existing.lines,
              typeMap,
              tx
            );
          });
          break;
        } catch (error) {
          if (
            !isSessionNoUniqueViolation(error) ||
            attempt === SESSION_NO_MAX_RETRIES - 1
          ) {
            throw error;
          }
        }
      }
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.inboundSession.update({
          where: { id: input.sessionId },
          data: {
            date,
            shipperId: input.shipperId,
            thVehiclePlate: input.thVehiclePlate || null,
            areaNote: input.areaNote || null,
            pickupLocation: sessionPickupLocation,
            status,
            sessionNo,
          },
        });
        await syncInboundLines(
          input.sessionId!,
          allLines,
          existing.lines,
          typeMap,
          tx
        );
      });
    }

    if (status === "confirmed" && existing.status === "draft") {
      await applyInboundCrateDeduction(
        input.shipperId,
        crateStockLocation,
        allLines,
        typeMap
      );
    }

    revalidatePath("/inbound");
    revalidatePath("/crate/customer-stock");
    return { id: input.sessionId, sessionNo };
  }

  let session: { id: string; sessionNo: string | null };

  if (status === "confirmed") {
    let created: { id: string; sessionNo: string | null } | undefined;

    for (let attempt = 0; attempt < SESSION_NO_MAX_RETRIES; attempt++) {
      try {
        created = await prisma.$transaction(async (tx) => {
          const sessionNo = await generateSessionNo(date, tx);
          return tx.inboundSession.create({
            data: {
              date,
              shipperId: input.shipperId,
              thVehiclePlate: input.thVehiclePlate || null,
              areaNote: input.areaNote || null,
              pickupLocation: sessionPickupLocation,
              status,
              sessionNo,
              createdById: user.id,
              lines: {
                create: allLines.map((line) => ({
                  stallId: line.stallId,
                  tongTypeId: line.tongTypeId,
                  quantity: line.quantity,
                  isBox: typeMap.get(line.tongTypeId)?.isBox ?? false,
                })),
              },
            },
            select: { id: true, sessionNo: true },
          });
        });
        break;
      } catch (error) {
        if (
          !isSessionNoUniqueViolation(error) ||
          attempt === SESSION_NO_MAX_RETRIES - 1
        ) {
          throw error;
        }
      }
    }

    if (!created) {
      throw new Error("无法生成唯一进货编号 Failed to generate unique session number");
    }
    session = created;
  } else {
    session = await prisma.inboundSession.create({
      data: {
        date,
        shipperId: input.shipperId,
        thVehiclePlate: input.thVehiclePlate || null,
        areaNote: input.areaNote || null,
        pickupLocation: sessionPickupLocation,
        status,
        sessionNo: null,
        createdById: user.id,
        lines: {
          create: allLines.map((line) => ({
            stallId: line.stallId,
            tongTypeId: line.tongTypeId,
            quantity: line.quantity,
            isBox: typeMap.get(line.tongTypeId)?.isBox ?? false,
          })),
        },
      },
      select: { id: true, sessionNo: true },
    });
  }

  if (status === "confirmed") {
    await applyInboundCrateDeduction(
      input.shipperId,
      crateStockLocation,
      allLines,
      typeMap
    );
  }

  revalidatePath("/inbound");
  revalidatePath("/crate/customer-stock");
  return { id: session.id, sessionNo: session.sessionNo };
}

export async function deleteInboundSession(sessionId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录 Unauthorized");

  const session = await prisma.inboundSession.findUnique({
    where: { id: sessionId },
    include: {
      shipper: { select: { pickupLocation: true } },
      lines: {
        select: {
          id: true,
          tongTypeId: true,
          quantity: true,
          dispatchLines: { select: { dispatchOrderId: true } },
        },
      },
    },
  });

  if (!session) throw new Error("进货单不存在 Session not found");

  const lineIds = session.lines.map((l) => l.id);
  const dispatchOrderIds = Array.from(
    new Set(
      session.lines.flatMap((l) =>
        l.dispatchLines.map((dl) => dl.dispatchOrderId)
      )
    )
  );

  if (session.status === "confirmed") {
    const crateStockLocation = resolveInboundCrateStockLocation(
      resolveSessionPickupLocation(
        session.pickupLocation,
        session.shipper.pickupLocation
      ),
      session.areaNote
    );
    await reverseInboundCrateDeduction(
      session.shipperId,
      crateStockLocation,
      session.lines
    );
  }

  await prisma.$transaction(async (tx) => {
    if (lineIds.length > 0) {
      await tx.dispatchLine.deleteMany({
        where: { inboundLineId: { in: lineIds } },
      });
      await tx.inboundLine.deleteMany({ where: { sessionId } });
    }

    await tx.inboundSession.delete({ where: { id: sessionId } });

    if (dispatchOrderIds.length > 0) {
      const remaining = await tx.dispatchLine.groupBy({
        by: ["dispatchOrderId"],
        where: { dispatchOrderId: { in: dispatchOrderIds } },
        _count: { _all: true },
      });
      const ordersWithLines = new Set(
        remaining.map((row) => row.dispatchOrderId)
      );
      const emptyOrderIds = dispatchOrderIds.filter(
        (orderId) => !ordersWithLines.has(orderId)
      );
      if (emptyOrderIds.length > 0) {
        await tx.dispatchOrder.deleteMany({
          where: { id: { in: emptyOrderIds } },
        });
      }
    }
  });

  revalidatePath("/inbound");
  revalidatePath("/dispatch");
  revalidatePath("/dashboard");
  revalidatePath("/crate/customer-stock");
}
