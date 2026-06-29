"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { requireWrite } from "@/lib/require-auth";
import { canViewFreightOnEntry } from "@/lib/auth-roles";
import { t } from "@/lib/i18n/translate";
import type { UserLanguage, UserRole } from "@/types";
import {
  addCustomerCratesBatch,
  deductCustomerCratesBatch,
} from "@/app/actions/customerCrateStock";
import { generateSessionNo, isSessionNoUniqueViolation, SESSION_NO_MAX_RETRIES } from "@/lib/inbound";
import { INBOUND_VISIBLE_TONG_TYPE_WHERE } from "@/lib/constants/tong-type-scope";
import { getMarketDisplayName } from "@/lib/constants/market-names";
import {
  formatPickupLocationLabel,
  normalizeSessionPickupInput,
  resolveSessionPickupLocation,
} from "@/lib/constants/pickup-locations";
import { loadLocationPoolShipperIds } from "@/lib/location-pool-shippers-service";
import { loadCrateStockAgentMembershipByMemberId } from "@/lib/crate-stock-agent-membership-service";
import { resolveCustomerCrateStockAccount } from "@/lib/customer-crate-stock-account";
import { buildCustomerCrateStockLedgerNotes } from "@/lib/customer-crate-stock-ledger-notes";
import { OPERATIONAL_SHIPPER_WHERE } from "@/lib/constants/shipper-kind";
import {
  getStallDisplayLabel,
  isOtherMarket,
  MARKET_ORDER,
} from "@/lib/markets";
import { parseDateInput, type InboundLineInput } from "@/lib/inbound-utils";
import {
  aggregateInboundMarketQtys,
  INBOUND_SESSIONS_LIST_LIMIT,
} from "@/lib/inbound-list";
import {
  buildInboundChangeLogs,
  computeCrateStockAdjustments,
  resolveCrateStockBucket,
  type InboundSessionSnapshot,
} from "@/lib/inbound-edit-sync";
import {
  computeInboundLineFreight,
  MC_MARKET_CODE,
  normalizeMcDeliveryMode,
  type InboundFreightContext,
  type InboundLineFreightSnapshot,
} from "@/lib/inbound-freight";
import { loadInboundFreightContext } from "@/lib/freight-context";
import { serializeInboundFreightLines } from "@/lib/inbound-form-serialize";

const INBOUND_TX_TIMEOUT_MS = 30_000;

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

async function loadLineMeta(lines: InboundLineInput[]) {
  const stallIds = Array.from(new Set(lines.map((line) => line.stallId)));
  const tongTypeIds = Array.from(new Set(lines.map((line) => line.tongTypeId)));

  const [stalls, tongTypes] = await Promise.all([
    prisma.stall.findMany({
      where: { id: { in: stallIds } },
      include: { market: { select: { code: true } } },
    }),
    prisma.tongType.findMany({
      where: { id: { in: tongTypeIds } },
      select: { id: true, code: true, name: true },
    }),
  ]);

  return {
    stallMeta: new Map(
      stalls.map((stall) => [
        stall.id,
        {
          stallCode: getStallDisplayLabel(
            stall.market?.code ?? "",
            stall.code,
            stall.name
          ),
          marketCode: stall.market?.code ?? "",
        },
      ])
    ),
    tongMeta: new Map(
      tongTypes.map((tongType) => [
        tongType.id,
        {
          tongTypeCode: tongType.code,
          tongTypeName: tongType.name,
        },
      ])
    ),
  };
}

async function cleanupEmptyDispatchOrders(
  tx: Prisma.TransactionClient,
  dispatchOrderIds: string[]
) {
  if (dispatchOrderIds.length === 0) return;

  const remaining = await tx.dispatchLine.groupBy({
    by: ["dispatchOrderId"],
    where: { dispatchOrderId: { in: dispatchOrderIds } },
    _count: { _all: true },
  });
  const ordersWithLines = new Set(remaining.map((row) => row.dispatchOrderId));
  const emptyOrderIds = dispatchOrderIds.filter(
    (orderId) => !ordersWithLines.has(orderId)
  );
  if (emptyOrderIds.length > 0) {
    await tx.dispatchOrder.deleteMany({ where: { id: { in: emptyOrderIds } } });
  }
}

async function removeDispatchLinksForLines(
  tx: Prisma.TransactionClient,
  lineIds: string[]
) {
  if (lineIds.length === 0) return;

  const links = await tx.dispatchLine.findMany({
    where: { inboundLineId: { in: lineIds } },
    select: { dispatchOrderId: true },
  });
  const dispatchOrderIds = Array.from(
    new Set(links.map((link) => link.dispatchOrderId))
  );

  await tx.dispatchLine.deleteMany({
    where: { inboundLineId: { in: lineIds } },
  });
  await cleanupEmptyDispatchOrders(tx, dispatchOrderIds);
}

async function applyCrateStockAdjustments(
  adjustments: ReturnType<typeof computeCrateStockAdjustments>,
  baseNote: string,
  resolveOperational?: (
    adjustment: ReturnType<typeof computeCrateStockAdjustments>[number]
  ) => { id: string; name: string }
) {
  const bucketKey = (shipperId: string, location: string) =>
    `${shipperId}:${location}`;

  const additionsByBucket = new Map<
    string,
    {
      shipperId: string;
      location: string;
      note: string;
      items: { crateTypeId: string; quantity: number }[];
    }
  >();
  const deductionsByBucket = new Map<
    string,
    {
      shipperId: string;
      location: string;
      note: string;
      items: { crateTypeId: string; quantity: number }[];
    }
  >();

  for (const adjustment of adjustments) {
    const operational = resolveOperational?.(adjustment);
    const note =
      buildCustomerCrateStockLedgerNotes({
        baseNote,
        operationalShipperId: operational?.id ?? adjustment.shipperId,
        operationalShipperName: operational?.name,
        stockAccountShipperId: adjustment.shipperId,
      }) ?? baseNote;

    const key = bucketKey(adjustment.shipperId, adjustment.location);
    if (adjustment.delta > 0) {
      const bucket = additionsByBucket.get(key) ?? {
        shipperId: adjustment.shipperId,
        location: adjustment.location,
        note,
        items: [],
      };
      bucket.items.push({
        crateTypeId: adjustment.crateTypeId,
        quantity: adjustment.delta,
      });
      additionsByBucket.set(key, bucket);
    } else if (adjustment.delta < 0) {
      const bucket = deductionsByBucket.get(key) ?? {
        shipperId: adjustment.shipperId,
        location: adjustment.location,
        note,
        items: [],
      };
      bucket.items.push({
        crateTypeId: adjustment.crateTypeId,
        quantity: Math.abs(adjustment.delta),
      });
      deductionsByBucket.set(key, bucket);
    }
  }

  for (const bucket of Array.from(additionsByBucket.values())) {
    await addCustomerCratesBatch(
      bucket.shipperId,
      bucket.items,
      "inbound-edit",
      bucket.location,
      bucket.note
    );
  }

  for (const bucket of Array.from(deductionsByBucket.values())) {
    await deductCustomerCratesBatch(
      bucket.shipperId,
      bucket.items,
      "inbound-edit",
      bucket.location,
      bucket.note
    );
  }
}

function revalidateInboundRelatedPaths() {
  if (process.env.BACKFILL_SKIP_REVALIDATE === "1") return;
  // "page" scope avoids revalidating /inbound/[id]/edit while the form is still mounted.
  revalidatePath("/inbound", "page");
  revalidatePath("/dispatch");
  revalidatePath("/summary");
  revalidatePath("/documents");
  revalidatePath("/history");
  revalidatePath("/reports/market");
  revalidatePath("/reports/crate");
  revalidatePath("/crate/customer-stock");
  revalidatePath("/dashboard");
}

async function loadTongTypeMap(tongTypeIds: string[]) {
  if (tongTypeIds.length === 0) return new Map<string, TongTypeMeta>();
  const tongTypes = await prisma.tongType.findMany({
    where: { id: { in: tongTypeIds } },
    select: { id: true, trackInventory: true, isBox: true },
  });
  return new Map(tongTypes.map((tongType) => [tongType.id, tongType]));
}

type TongTypeMeta = { trackInventory: boolean; isBox: boolean };

async function applyInboundCrateDeduction(
  stockAccount: { shipperId: string; location: string },
  operationalShipper: { id: string; name: string },
  lines: { tongTypeId: string; quantity: number }[],
  typeMap?: Map<string, TongTypeMeta>,
  baseNote?: string
) {
  if (lines.length === 0) return;

  const map =
    typeMap ??
    (await loadTongTypeMap(Array.from(new Set(lines.map((l) => l.tongTypeId)))));
  const byCrateType = aggregateCrateQuantities(lines, map);
  const deductions = Array.from(byCrateType.entries()).map(
    ([crateTypeId, quantity]) => ({ crateTypeId, quantity })
  );

  const notes = buildCustomerCrateStockLedgerNotes({
    baseNote,
    operationalShipperId: operationalShipper.id,
    operationalShipperName: operationalShipper.name,
    stockAccountShipperId: stockAccount.shipperId,
  });

  await deductCustomerCratesBatch(
    stockAccount.shipperId,
    deductions,
    "inbound",
    stockAccount.location?.trim() ?? "",
    notes
  );
}

async function reverseInboundCrateDeduction(
  stockAccount: { shipperId: string; location: string },
  operationalShipper: { id: string; name: string },
  lines: { tongTypeId: string; quantity: number }[],
  typeMap?: Map<string, TongTypeMeta>,
  baseNote?: string
) {
  if (lines.length === 0) return;

  const map =
    typeMap ??
    (await loadTongTypeMap(Array.from(new Set(lines.map((l) => l.tongTypeId)))));
  const byCrateType = aggregateCrateQuantities(lines, map);
  const additions = Array.from(byCrateType.entries()).map(
    ([crateTypeId, quantity]) => ({ crateTypeId, quantity })
  );

  const notes = buildCustomerCrateStockLedgerNotes({
    baseNote,
    operationalShipperId: operationalShipper.id,
    operationalShipperName: operationalShipper.name,
    stockAccountShipperId: stockAccount.shipperId,
  });

  await addCustomerCratesBatch(
    stockAccount.shipperId,
    additions,
    "inbound-delete",
    stockAccount.location?.trim() ?? "",
    notes
  );
}

async function processNewStalls(
  shipperId: string,
  newStalls: NewStallInput[] | undefined,
  locale: UserLanguage
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
      throw new Error(t("error.otherMarketDestination", locale));
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

  const shipper = await prisma.shipper.findUnique({
    where: { id: shipperId },
    select: { defaultTongTypeId: true },
  });
  const pairingTongTypeId = shipper?.defaultTongTypeId;

  await Promise.all(
    newStalls.map((ns) => {
      const stall = stallMap.get(`${ns.code}:${ns.marketId}`)!;
      return prisma.shipperStallDefault.upsert({
        where: {
          shipperId_stallId: { shipperId, stallId: stall.id },
        },
        update: {},
        create: {
          shipperId,
          stallId: stall.id,
          tongTypeId: pairingTongTypeId ?? ns.tongTypeId,
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

interface ExistingInboundLine {
  id: string;
  quantity: number;
  tongTypeId: string;
  stallId: string;
  originalQuantity: number | null;
}

function freightFields(snapshot: InboundLineFreightSnapshot) {
  return {
    consigneeId: snapshot.consigneeId,
    paymentParty: snapshot.paymentParty,
    paymentMode: snapshot.paymentMode,
    currency: snapshot.currency,
    billingCompany: snapshot.billingCompany,
    freightRate: snapshot.freightRate,
    freightAmount: snapshot.freightAmount,
    exchangeRate: snapshot.exchangeRate,
    mcDeliveryMode: snapshot.mcDeliveryMode,
    thirdPartyFee: snapshot.thirdPartyFee,
    mySegmentFreightRate: snapshot.mySegmentFreightRate,
    mySegmentFreightAmount: snapshot.mySegmentFreightAmount,
    thFreightRate: snapshot.thFreightRate,
    thFreightAmount: snapshot.thFreightAmount,
    dualPaymentWtlRate: snapshot.dualPaymentWtlRate ?? null,
    dualPaymentWtlAmount: snapshot.dualPaymentWtlAmount ?? null,
    dualPaymentWtlConsigneeId: snapshot.dualPaymentWtlConsigneeId ?? null,
  };
}

function computeFreightSnapshots(
  lines: InboundLineInput[],
  ctx: InboundFreightContext
) {
  return lines.map((line) => {
    const marketCode = ctx.stalls.get(line.stallId)?.marketCode ?? "";
    const mcDeliveryMode =
      marketCode === MC_MARKET_CODE
        ? "self"
        : normalizeMcDeliveryMode(marketCode, line.mcDeliveryMode);
    return computeInboundLineFreight(
      {
        stallId: line.stallId,
        tongTypeId: line.tongTypeId,
        quantity: line.quantity,
        mcDeliveryMode,
      },
      ctx
    );
  });
}

async function syncInboundLines(
  sessionId: string,
  allLines: InboundLineInput[],
  existingLines: ExistingInboundLine[],
  typeMap: Map<string, TongTypeMeta>,
  freightSnapshots: InboundLineFreightSnapshot[],
  tx: Prisma.TransactionClient = prisma
): Promise<Map<number, string>> {
  const lineIdByIndex = new Map<number, string>();
  const existingLineIds = new Set(existingLines.map((line) => line.id));
  const inputLineIds = new Set(
    allLines.filter((line) => line.lineId).map((line) => line.lineId!)
  );

  const deleteIds = existingLines
    .filter((line) => !inputLineIds.has(line.id))
    .map((line) => line.id);
  if (deleteIds.length > 0) {
    await removeDispatchLinksForLines(tx, deleteIds);
    await tx.inboundLine.deleteMany({ where: { id: { in: deleteIds } } });
  }

  const updateOps: Promise<unknown>[] = [];
  for (let index = 0; index < allLines.length; index++) {
    const line = allLines[index];
    const freight = freightSnapshots[index];
    if (!line.lineId || !existingLineIds.has(line.lineId)) continue;

    lineIdByIndex.set(index, line.lineId);

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
          ...freightFields(freight),
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

  const createLineEntries = allLines
    .map((line, index) => ({ line, index }))
    .filter(
      ({ line }) => !line.lineId || !existingLineIds.has(line.lineId)
    );

  if (createLineEntries.length > 0) {
    const created = await tx.inboundLine.createManyAndReturn({
      data: createLineEntries.map(({ line, index }) => ({
        sessionId,
        stallId: line.stallId,
        tongTypeId: line.tongTypeId,
        quantity: line.quantity,
        isBox: typeMap.get(line.tongTypeId)?.isBox ?? false,
        ...freightFields(freightSnapshots[index]),
      })),
    });
    createLineEntries.forEach(({ index }, createdIndex) => {
      const createdLine = created[createdIndex];
      if (createdLine) {
        lineIdByIndex.set(index, createdLine.id);
      }
    });
  }

  return lineIdByIndex;
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
  await requireWrite();

  await prisma.shipperStallDefault.deleteMany({
    where: { shipperId, stallId },
  });
  revalidatePath("/inbound");
}

export async function getShippers() {
  return prisma.shipper.findMany({
    where: OPERATIONAL_SHIPPER_WHERE,
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      pickupLocation: true,
      defaultTongTypeId: true,
    },
  });
}

export async function getTongTypes() {
  return prisma.tongType.findMany({
    where: INBOUND_VISIBLE_TONG_TYPE_WHERE,
    orderBy: { displayOrder: "asc" },
    select: { id: true, code: true, name: true, isBox: true },
  });
}

export async function getShipperStalls(shipperId: string) {
  const [shipper, defaults] = await Promise.all([
    prisma.shipper.findUnique({
      where: { id: shipperId },
      select: {
        defaultTongTypeId: true,
        defaultTongType: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.shipperStallDefault.findMany({
      where: { shipperId },
      include: {
        stall: { include: { market: true } },
      },
      orderBy: [
        { stall: { market: { code: "asc" } } },
        { stall: { code: "asc" } },
      ],
    }),
  ]);

  const defaultTongTypeId = shipper?.defaultTongTypeId ?? "";
  const defaultTongTypeCode = shipper?.defaultTongType?.code ?? "";
  const defaultTongTypeName = shipper?.defaultTongType?.name ?? "";

  return defaults.map((d) => ({
    stallId: d.stallId,
    stallCode: getStallDisplayLabel(
      d.stall?.market?.code ?? "",
      d.stall?.code ?? "",
      d.stall?.name
    ),
    stallName: d.stall?.name ?? null,
    marketCode: d.stall?.market?.code ?? "",
    marketName: d.stall?.market?.code
      ? getMarketDisplayName(d.stall.market.code)
      : "",
    defaultTongTypeId,
    defaultTongTypeCode,
    defaultTongTypeName,
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
  const user = await getCurrentUser();
  const locale = user?.language ?? "zh";
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
        select: {
          quantity: true,
          dispatchStatus: true,
          isBox: true,
          stall: { select: { market: { select: { code: true } } } },
        },
      },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: INBOUND_SESSIONS_LIST_LIMIT,
  });

  return sessions
    .map((s) => {
      const totalQty = s.lines.reduce((sum, l) => sum + Number(l.quantity || 0), 0);
      const crateQty = s.lines
        .filter((l) => !l.isBox)
        .reduce((sum, l) => sum + Number(l.quantity || 0), 0);
      const boxQty = s.lines
        .filter((l) => l.isBox)
        .reduce((sum, l) => sum + Number(l.quantity || 0), 0);
      const unassignedQty = s.lines
        .filter((l) => l.dispatchStatus === "unassigned")
        .reduce((sum, l) => sum + Number(l.quantity || 0), 0);
      const unassignedCrateQty = s.lines
        .filter((l) => l.dispatchStatus === "unassigned" && !l.isBox)
        .reduce((sum, l) => sum + Number(l.quantity || 0), 0);
      const unassignedBoxQty = s.lines
        .filter((l) => l.dispatchStatus === "unassigned" && l.isBox)
        .reduce((sum, l) => sum + Number(l.quantity || 0), 0);
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
          ),
          locale
        ),
        thVehiclePlate: s.thVehiclePlate,
        totalQty,
        crateQty,
        boxQty,
        unassignedQty,
        unassignedCrateQty,
        unassignedBoxQty,
        allAssigned,
        marketQtys: aggregateInboundMarketQtys(s.lines),
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

interface PreviewFreightLineInput {
  stallId: string;
  tongTypeId: string;
  quantity: number;
  lineId?: string;
  stallCode?: string;
  marketCode?: string;
}

interface PreviewInboundFreightInput {
  date: string;
  shipperId: string;
  pickupLocation?: string | null;
  areaNote?: string | null;
  lines: PreviewFreightLineInput[];
}

export async function previewInboundFreightLines(input: PreviewInboundFreightInput) {
  try {
    const user = await getCurrentUser();
    if (!user || !canViewFreightOnEntry(user.role as UserRole)) {
      return [];
    }

    const activeLines: InboundLineInput[] = input.lines
      .filter((line) => line.quantity > 0 && !line.stallId.startsWith("new-"))
      .map((line) => ({
        stallId: line.stallId,
        tongTypeId: line.tongTypeId,
        quantity: line.quantity,
        lineId: line.lineId,
      }));

    if (activeLines.length === 0) return [];

    const date = parseDateInput(input.date);
    const shipper = await prisma.shipper.findUnique({
      where: { id: input.shipperId },
      select: { pickupLocation: true },
    });
    if (!shipper) return [];

    const previewLocale = user?.language ?? "zh";
    const effectivePickup = resolveSessionPickupLocation(
      normalizeSessionPickupInput(input.pickupLocation, previewLocale),
      shipper.pickupLocation
    );

    const { ctx } = await loadInboundFreightContext(
      input.shipperId,
      activeLines.map((line) => line.stallId),
      activeLines.map((line) => line.tongTypeId),
      date,
      effectivePickup
    );

    const freightSnapshots = computeFreightSnapshots(activeLines, ctx);
    const { stallMeta, tongMeta } = await loadLineMeta(activeLines);
    const displayByLineId = new Map(
      input.lines
        .filter((line) => line.lineId)
        .map((line) => [line.lineId!, line])
    );

    return serializeInboundFreightLines(
      activeLines.map((line, index) => {
        const snapshot = freightSnapshots[index];
        const display = line.lineId ? displayByLineId.get(line.lineId) : undefined;
        const stall = stallMeta.get(line.stallId);
        const tong = tongMeta.get(line.tongTypeId);

        return {
          id: line.lineId ?? `preview-${line.stallId}-${index}`,
          stallId: line.stallId,
          tongTypeId: line.tongTypeId,
          stallCode: display?.stallCode ?? stall?.stallCode ?? "",
          marketCode: display?.marketCode ?? stall?.marketCode ?? "",
          tongTypeCode: tong?.tongTypeCode ?? "",
          quantity: line.quantity,
          mcDeliveryMode: snapshot.mcDeliveryMode,
          paymentParty: snapshot.paymentParty,
          paymentMode: snapshot.paymentMode,
          currency: snapshot.currency,
          billingCompany: snapshot.billingCompany,
          freightRate: snapshot.freightRate,
          freightAmount: snapshot.freightAmount,
          thirdPartyFee: snapshot.thirdPartyFee,
          mySegmentFreightRate: snapshot.mySegmentFreightRate,
          mySegmentFreightAmount: snapshot.mySegmentFreightAmount,
          thFreightRate: snapshot.thFreightRate,
          thFreightAmount: snapshot.thFreightAmount,
        };
      })
    );
  } catch (error) {
    console.error("previewInboundFreightLines failed:", error);
    return [];
  }
}

export async function getInboundSession(id: string) {
  const user = await getCurrentUser();
  const showFreightInfo = user
    ? canViewFreightOnEntry(user.role as UserRole)
    : false;

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
    date: session.date.toISOString().slice(0, 10),
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
        l.stall?.market?.code ?? "",
        l.stall?.code ?? "",
        l.stall?.name
      ),
      marketCode: l.stall?.market?.code ?? "",
      tongTypeId: l.tongTypeId,
      tongTypeCode: l.tongType?.code ?? "",
      quantity: Number(l.quantity) || 0,
      dispatchStatus: l.dispatchStatus,
      mcDeliveryMode: l.mcDeliveryMode as "self" | "third_party" | null,
      ...(showFreightInfo
        ? {
            paymentParty: l.paymentParty as "shipper" | "consignee" | null,
            paymentMode: l.paymentMode,
            currency: l.currency,
            billingCompany: l.billingCompany,
            freightRate: l.freightRate != null ? Number(l.freightRate) : null,
            freightAmount:
              l.freightAmount != null ? Number(l.freightAmount) : null,
            thirdPartyFee:
              l.thirdPartyFee != null ? Number(l.thirdPartyFee) : null,
            mySegmentFreightRate:
              l.mySegmentFreightRate != null
                ? Number(l.mySegmentFreightRate)
                : null,
            mySegmentFreightAmount:
              l.mySegmentFreightAmount != null
                ? Number(l.mySegmentFreightAmount)
                : null,
            thFreightRate:
              l.thFreightRate != null ? Number(l.thFreightRate) : null,
            thFreightAmount:
              l.thFreightAmount != null ? Number(l.thFreightAmount) : null,
          }
        : {}),
    })),
    showFreightInfo,
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
  /** Backfill only: use this date for freight rate lookup instead of session date. */
  freightRateAsOfDate?: string;
}

export async function saveInboundSession(input: SaveInboundInput) {
  let locale: UserLanguage = "zh";
  try {
  const user = await requireWrite();
  locale = user.language;

  const date = parseDateInput(input.date);
  const sessionPickupLocation = normalizeSessionPickupInput(
    input.pickupLocation,
    locale
  );
  const shipper = await prisma.shipper.findUnique({
    where: { id: input.shipperId },
    select: { pickupLocation: true, currency: true, name: true },
  });
  const effectivePickup = resolveSessionPickupLocation(
    sessionPickupLocation,
    shipper?.pickupLocation
  );
  const [poolIds, agentMembershipByMemberId] = await Promise.all([
    loadLocationPoolShipperIds(),
    loadCrateStockAgentMembershipByMemberId(),
  ]);
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
    input.newStalls,
    locale
  );
  const allLines = [...activeLines, ...createdNewStallLines];

  if (!input.asDraft && allLines.length === 0) {
    throw new Error("请至少填写一个收货人的桶数 Please enter at least one quantity");
  }

  const tongTypeIds = Array.from(
    new Set([
      ...allLines.map((line) => line.tongTypeId),
      ...(input.newStalls?.map((stall) => stall.tongTypeId) ?? []),
    ])
  );
  const typeMap = await loadTongTypeMap(tongTypeIds);

  const freightRateDate = input.freightRateAsOfDate
    ? parseDateInput(input.freightRateAsOfDate)
    : date;

  const { ctx: freightCtx, shipperCurrency } = await loadInboundFreightContext(
    input.shipperId,
    allLines.map((line) => line.stallId),
    allLines.map((line) => line.tongTypeId),
    freightRateDate,
    effectivePickup
  );
  const freightSnapshots = computeFreightSnapshots(allLines, freightCtx);

  if (input.sessionId) {
    const existing = await prisma.inboundSession.findUnique({
      where: { id: input.sessionId },
      include: {
        shipper: {
          select: { id: true, name: true, pickupLocation: true },
        },
        lines: {
          include: {
            stall: { include: { market: { select: { code: true } } } },
            tongType: { select: { code: true, name: true } },
          },
        },
      },
    });
    if (!existing) throw new Error(t("error.sessionNotFound", locale));

    if (status === "draft" && existing.status === "confirmed") {
      const hasAssigned = existing.lines.some(
        (line) => line.dispatchStatus === "assigned"
      );
      if (hasAssigned) {
        throw new Error(t("error.cannotRevertDispatched", locale));
      }
    }

    const afterShipper =
      input.shipperId === existing.shipperId
        ? existing.shipper
        : await prisma.shipper.findUnique({
            where: { id: input.shipperId },
            select: { id: true, name: true, pickupLocation: true },
          });
    if (!afterShipper) throw new Error(t("error.shipperNotFound", locale));

    const beforeSnapshot: InboundSessionSnapshot = {
      date: existing.date,
      shipperId: existing.shipperId,
      shipperName: existing.shipper.name,
      shipperPickupLocation: existing.shipper.pickupLocation,
      pickupLocation: existing.pickupLocation,
      areaNote: existing.areaNote,
      thVehiclePlate: existing.thVehiclePlate,
      lines: existing.lines.map((line) => ({
        id: line.id,
        quantity: line.quantity,
        tongTypeId: line.tongTypeId,
        stallId: line.stallId,
        originalQuantity: line.originalQuantity,
        stallCode: line.stall.code,
        marketCode: line.stall.market?.code ?? "",
        tongTypeCode: line.tongType.code,
        tongTypeName: line.tongType.name,
      })),
    };

    const beforeBucket = resolveCrateStockBucket(
      existing.date,
      existing.shipperId,
      existing.shipper.pickupLocation,
      existing.pickupLocation,
      existing.areaNote,
      poolIds,
      agentMembershipByMemberId
    );
    const afterBucket = resolveCrateStockBucket(
      date,
      input.shipperId,
      afterShipper.pickupLocation,
      sessionPickupLocation,
      input.areaNote,
      poolIds,
      agentMembershipByMemberId
    );

    const beforeLinesForCrate =
      existing.status === "confirmed"
        ? existing.lines.map((line) => ({
            tongTypeId: line.tongTypeId,
            quantity: line.quantity,
          }))
        : [];
    const afterLinesForCrate =
      status === "confirmed"
        ? allLines.map((line) => ({
            tongTypeId: line.tongTypeId,
            quantity: line.quantity,
          }))
        : [];

    const { stallMeta, tongMeta } = await loadLineMeta(allLines);
    let sessionNo = existing.sessionNo;
    let lineIdByIndex = new Map<number, string>();
    const existingLinesForSync = existing.lines.map((line) => ({
      id: line.id,
      quantity: line.quantity,
      tongTypeId: line.tongTypeId,
      stallId: line.stallId,
      originalQuantity: line.originalQuantity,
    }));

    if (status === "confirmed" && !existing.sessionNo) {
      for (let attempt = 0; attempt < SESSION_NO_MAX_RETRIES; attempt++) {
        try {
          lineIdByIndex = await prisma.$transaction(
            async (tx) => {
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
                shipperCurrency,
              },
            });
            return syncInboundLines(
              input.sessionId!,
              allLines,
              existingLinesForSync,
              typeMap,
              freightSnapshots,
              tx
            );
          },
            { timeout: INBOUND_TX_TIMEOUT_MS }
          );
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
      lineIdByIndex = await prisma.$transaction(
        async (tx) => {
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
            shipperCurrency,
          },
        });
        return syncInboundLines(
          input.sessionId!,
          allLines,
          existingLinesForSync,
          typeMap,
          freightSnapshots,
          tx
        );
      },
        { timeout: INBOUND_TX_TIMEOUT_MS }
      );
    }

    const editNote = `进货单修改 ${sessionNo ?? input.sessionId}`;

    if (existing.status === "confirmed" && status === "confirmed") {
      const adjustments = computeCrateStockAdjustments({
        beforeLines: beforeLinesForCrate,
        afterLines: afterLinesForCrate,
        beforeBucket,
        afterBucket,
        typeMap,
      });
      await applyCrateStockAdjustments(
        adjustments,
        editNote,
        (adjustment) => {
          if (
            adjustment.shipperId === beforeBucket.shipperId &&
            adjustment.location === beforeBucket.location
          ) {
            return {
              id: beforeSnapshot.shipperId,
              name: beforeSnapshot.shipperName,
            };
          }
          return { id: afterShipper.id, name: afterShipper.name };
        }
      );
    } else if (existing.status === "confirmed" && status === "draft") {
      await reverseInboundCrateDeduction(
        beforeBucket,
        { id: beforeSnapshot.shipperId, name: beforeSnapshot.shipperName },
        beforeLinesForCrate,
        typeMap,
        editNote
      );
    } else if (existing.status === "draft" && status === "confirmed") {
      await applyInboundCrateDeduction(
        afterBucket,
        { id: afterShipper.id, name: afterShipper.name },
        allLines,
        typeMap
      );
    }

    const allLinesWithIds = allLines.map((line, index) => ({
      ...line,
      lineId: lineIdByIndex.get(index) ?? line.lineId,
    }));
    const changeLogs =
      existing.status === "confirmed" && status === "confirmed"
        ? buildInboundChangeLogs({
            sessionId: input.sessionId!,
            userId: user.id,
            before: beforeSnapshot,
            after: {
              date,
              shipperId: input.shipperId,
              shipperName: afterShipper.name,
              shipperPickupLocation: afterShipper.pickupLocation,
              pickupLocation: sessionPickupLocation,
              areaNote: input.areaNote || null,
              thVehiclePlate: input.thVehiclePlate || null,
              lines: allLinesWithIds,
            },
            afterLineMeta: stallMeta,
            afterTongMeta: tongMeta,
          })
        : [];

    if (changeLogs.length > 0) {
      const validLineIds = new Set(lineIdByIndex.values());
      await prisma.inboundChangeLog.createMany({
        data: changeLogs.map((log) => ({
          sessionId: log.sessionId,
          lineId:
            log.lineId && validLineIds.has(log.lineId) ? log.lineId : null,
          userId: log.userId,
          field: log.field,
          fromValue: log.fromValue,
          toValue: log.toValue,
        })),
      });
    }

    revalidateInboundRelatedPaths();
    return { ok: true as const };
  }

  if (status === "confirmed") {
    let created: { id: string; sessionNo: string | null } | undefined;

    for (let attempt = 0; attempt < SESSION_NO_MAX_RETRIES; attempt++) {
      try {
        created = await prisma.$transaction(
          async (tx) => {
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
              shipperCurrency,
              createdById: user.id,
              lines: {
                create: allLines.map((line, index) => ({
                  stallId: line.stallId,
                  tongTypeId: line.tongTypeId,
                  quantity: line.quantity,
                  isBox: typeMap.get(line.tongTypeId)?.isBox ?? false,
                  ...freightFields(freightSnapshots[index]),
                })),
              },
            },
            select: { id: true, sessionNo: true },
          });
        },
          { timeout: INBOUND_TX_TIMEOUT_MS }
        );
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
      throw new Error(t("error.sessionNoFailed", locale));
    }
  } else {
    await prisma.inboundSession.create({
      data: {
        date,
        shipperId: input.shipperId,
        thVehiclePlate: input.thVehiclePlate || null,
        areaNote: input.areaNote || null,
        pickupLocation: sessionPickupLocation,
        status,
        sessionNo: null,
        shipperCurrency,
        createdById: user.id,
        lines: {
          create: allLines.map((line, index) => ({
            stallId: line.stallId,
            tongTypeId: line.tongTypeId,
            quantity: line.quantity,
            isBox: typeMap.get(line.tongTypeId)?.isBox ?? false,
            ...freightFields(freightSnapshots[index]),
          })),
        },
      },
      select: { id: true },
    });
  }

  if (status === "confirmed") {
    const crateStockAccount = resolveCustomerCrateStockAccount({
      sessionDate: date,
      operationalShipperId: input.shipperId,
      sessionPickupLocation,
      shipperPickupLocation: shipper?.pickupLocation,
      areaNote: input.areaNote,
      poolIds,
      agentMembershipByMemberId,
    });
    await applyInboundCrateDeduction(
      crateStockAccount,
      {
        id: input.shipperId,
        name: shipper?.name ?? input.shipperId,
      },
      allLines,
      typeMap
    );
  }

  revalidateInboundRelatedPaths();
  return { ok: true as const };
  } catch (error) {
    console.error("saveInboundSession failed:", error);
    return {
      ok: false as const,
      error:
        error instanceof Error ? error.message : t("error.saveFailed", locale),
    };
  }
}

export async function deleteInboundSession(sessionId: string) {
  const user = await requireWrite();

  const session = await prisma.inboundSession.findUnique({
    where: { id: sessionId },
    include: {
      shipper: { select: { pickupLocation: true, name: true } },
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

  if (!session) throw new Error(t("error.sessionNotFound", user.language));

  const lineIds = session.lines.map((l) => l.id);
  const dispatchOrderIds = Array.from(
    new Set(
      session.lines.flatMap((l) =>
        l.dispatchLines.map((dl) => dl.dispatchOrderId)
      )
    )
  );

  if (session.status === "confirmed") {
    const [poolIds, agentMembershipByMemberId] = await Promise.all([
      loadLocationPoolShipperIds(),
      loadCrateStockAgentMembershipByMemberId(),
    ]);
    const crateStockAccount = resolveCustomerCrateStockAccount({
      sessionDate: session.date,
      operationalShipperId: session.shipperId,
      sessionPickupLocation: session.pickupLocation,
      shipperPickupLocation: session.shipper.pickupLocation,
      areaNote: session.areaNote,
      poolIds,
      agentMembershipByMemberId,
    });
    await reverseInboundCrateDeduction(
      crateStockAccount,
      { id: session.shipperId, name: session.shipper.name },
      session.lines
    );
  }

  await prisma.$transaction(
    async (tx) => {
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
  },
    { timeout: INBOUND_TX_TIMEOUT_MS }
  );

  revalidatePath("/inbound");
  revalidatePath("/dispatch");
  revalidatePath("/dashboard");
  revalidatePath("/crate/customer-stock");
}
