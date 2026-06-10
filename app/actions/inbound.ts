"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { deductCustomerCrate } from "@/app/actions/customerCrateStock";
import { generateSessionNo } from "@/lib/inbound";
import { MARKET_ORDER } from "@/lib/constants";
import { parseDateInput, type InboundLineInput } from "@/lib/inbound-utils";

async function applyInboundCrateDeduction(
  shipperId: string,
  lines: { tongTypeId: string; quantity: number }[]
) {
  if (lines.length === 0) return;

  const tongTypeIds = Array.from(new Set(lines.map((l) => l.tongTypeId)));
  const tongTypes = await prisma.tongType.findMany({
    where: { id: { in: tongTypeIds } },
  });
  const typeMap = new Map(tongTypes.map((t) => [t.id, t]));

  const byCrateType = new Map<string, number>();
  for (const line of lines) {
    const crateType = typeMap.get(line.tongTypeId);
    if (!crateType?.trackInventory || crateType.isBox) continue;
    byCrateType.set(
      line.tongTypeId,
      (byCrateType.get(line.tongTypeId) ?? 0) + line.quantity
    );
  }

  for (const [crateTypeId, qty] of Array.from(byCrateType.entries())) {
    await deductCustomerCrate(shipperId, crateTypeId, qty, "inbound");
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
    );
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
    select: { id: true, code: true, name: true },
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
    stallCode: d.stall.code,
    stallName: d.stall.name,
    marketCode: d.stall.market?.code ?? "",
    marketName: d.stall.market?.name ?? "",
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
      shipper: { select: { id: true, name: true, code: true } },
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
      shipper: { select: { id: true, name: true, code: true } },
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
    lines: session.lines.map((l) => ({
      id: l.id,
      stallId: l.stallId,
      stallCode: l.stall.code,
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
  marketId: string;
  tongTypeId: string;
  quantity?: number;
}

interface SaveInboundInput {
  date: string;
  shipperId: string;
  thVehiclePlate?: string;
  areaNote?: string;
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
  const activeLines = input.lines.filter(
    (l) => l.quantity > 0 && !l.stallId.startsWith("new-")
  );
  const createdNewStallLines: InboundLineInput[] = [];
  const status = input.asDraft ? "draft" : "confirmed";

  if (input.removedStallIds?.length) {
    for (const stallId of input.removedStallIds) {
      // Client-side temp ids for unsaved stalls must not hit the database
      if (stallId.startsWith("new-")) continue;
      await prisma.shipperStallDefault.deleteMany({
        where: { shipperId: input.shipperId, stallId },
      });
    }
  }

  if (input.newStalls?.length) {
    for (const ns of input.newStalls) {
      let stall = await prisma.stall.findFirst({
        where: { code: ns.code, marketId: ns.marketId },
      });
      if (!stall) {
        stall = await prisma.stall.create({
          data: { code: ns.code, marketId: ns.marketId },
        });
      }
      await prisma.shipperStallDefault.upsert({
        where: {
          shipperId_stallId: {
            shipperId: input.shipperId,
            stallId: stall.id,
          },
        },
        update: { tongTypeId: ns.tongTypeId },
        create: {
          shipperId: input.shipperId,
          stallId: stall.id,
          tongTypeId: ns.tongTypeId,
        },
      });
      if (ns.quantity && ns.quantity > 0) {
        createdNewStallLines.push({
          stallId: stall.id,
          tongTypeId: ns.tongTypeId,
          quantity: ns.quantity,
        });
      }
    }
  }

  const allLines = [...activeLines, ...createdNewStallLines];

  if (!input.asDraft && allLines.length === 0) {
    throw new Error("请至少填写一个档口的桶数 Please enter at least one quantity");
  }

  for (const line of allLines) {
    await prisma.shipperStallDefault.updateMany({
      where: { shipperId: input.shipperId, stallId: line.stallId },
      data: { tongTypeId: line.tongTypeId },
    });
  }

  if (input.sessionId) {
    const existing = await prisma.inboundSession.findUnique({
      where: { id: input.sessionId },
      include: { lines: true },
    });
    if (!existing) throw new Error("进货单不存在 Session not found");

    const sessionNo =
      status === "confirmed" && !existing.sessionNo
        ? await generateSessionNo(date)
        : existing.sessionNo;

    await prisma.inboundSession.update({
      where: { id: input.sessionId },
      data: {
        date,
        shipperId: input.shipperId,
        thVehiclePlate: input.thVehiclePlate || null,
        areaNote: input.areaNote || null,
        status,
        sessionNo,
      },
    });

    const existingLineIds = new Set(existing.lines.map((l) => l.id));
    const inputLineIds = new Set(
      allLines.filter((l) => l.lineId).map((l) => l.lineId!)
    );

    for (const line of existing.lines) {
      if (!inputLineIds.has(line.id)) {
        await prisma.inboundLine.delete({ where: { id: line.id } });
      }
    }

    for (const line of allLines) {
      const tongType = await prisma.tongType.findUnique({
        where: { id: line.tongTypeId },
      });

      if (line.lineId && existingLineIds.has(line.lineId)) {
        const prev = existing.lines.find((l) => l.id === line.lineId)!;
        const changed =
          prev.quantity !== line.quantity ||
          prev.tongTypeId !== line.tongTypeId ||
          prev.stallId !== line.stallId;

        await prisma.inboundLine.update({
          where: { id: line.lineId },
          data: {
            stallId: line.stallId,
            tongTypeId: line.tongTypeId,
            quantity: line.quantity,
            isBox: tongType?.isBox ?? false,
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
        });
      } else {
        await prisma.inboundLine.create({
          data: {
            sessionId: input.sessionId,
            stallId: line.stallId,
            tongTypeId: line.tongTypeId,
            quantity: line.quantity,
            isBox: tongType?.isBox ?? false,
          },
        });
      }
    }

    if (status === "confirmed" && existing.status === "draft") {
      await applyInboundCrateDeduction(input.shipperId, allLines);
    }

    revalidatePath("/inbound");
    revalidatePath("/crate/customer-stock");
    return { id: input.sessionId, sessionNo };
  }

  const sessionNo =
    status === "confirmed" ? await generateSessionNo(date) : null;

  const session = await prisma.inboundSession.create({
    data: {
      date,
      shipperId: input.shipperId,
      thVehiclePlate: input.thVehiclePlate || null,
      areaNote: input.areaNote || null,
      status,
      sessionNo,
      createdById: user.id,
      lines: {
        create: await Promise.all(
          allLines.map(async (line) => {
            const tongType = await prisma.tongType.findUnique({
              where: { id: line.tongTypeId },
            });
            return {
              stallId: line.stallId,
              tongTypeId: line.tongTypeId,
              quantity: line.quantity,
              isBox: tongType?.isBox ?? false,
            };
          })
        ),
      },
    },
  });

  if (status === "confirmed") {
    await applyInboundCrateDeduction(input.shipperId, allLines);
  }

  revalidatePath("/inbound");
  revalidatePath("/crate/customer-stock");
  return { id: session.id, sessionNo: session.sessionNo };
}
