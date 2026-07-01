"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { addCustomerCratesBatch, deductCustomerCratesBatch } from "@/app/actions/customerCrateStock";
import type { ReceiptData } from "@/components/tong/TongExportReceipt";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireWrite } from "@/lib/require-auth";
import { parseDateInput, toDateInputValue } from "@/lib/inbound-utils";
import { generateExportNo, getSadaoStockByTongType } from "@/lib/tong";
import { formatDisplayDate, getBangkokDayUtcRange, getBangkokTodayDateInput } from "@/lib/date-utils";
import {
  buildCrateExportDueToday,
  type CrateExportDueTodayData,
  isReturnableCrateTypeCode,
  type CrateExportPrefillMember,
  type CrateExportPrefillTarget,
  qtyMapToRecord,
} from "@/lib/crate-export-due-today";
import {
  isLocationPoolShipperCode,
  stockLocationForPoolShipperCode,
} from "@/lib/constants/location-pool-shippers";
import { SHIPPER_KIND, isCrateStockAgentShipper } from "@/lib/constants/shipper-kind";
import { loadLocationPoolShipperIds } from "@/lib/location-pool-shippers-service";
import {
  CRATE_EXPORT_LIST_LIMIT,
  type CrateExportListRow,
} from "@/lib/crate-export-list";
import { loadCrateStockAgentMembershipByMemberId } from "@/lib/crate-stock-agent-membership-service";
import { resolveCustomerCrateStockAccount } from "@/lib/customer-crate-stock-account";
import { assertOriginInCustomerList } from "@/lib/multi-origin-customer";
import { buildCustomerCrateStockLedgerNotes } from "@/lib/customer-crate-stock-ledger-notes";
import { t } from "@/lib/i18n/translate";
import type { MessageKey } from "@/lib/i18n/messages";
import type { UserLanguage } from "@/types";

export interface CrateExportLineInput {
  tongTypeId: string;
  quantitySuggested: number;
  quantityActual: number;
}

export interface CrateExportSaveInput {
  date: string;
  shipperId: string;
  thVehiclePlate: string;
  areaNote?: string;
  location?: string;
  lines: CrateExportLineInput[];
  forceExportNo?: string;
}

export interface CrateExportEditData {
  exportNo: string;
  date: string;
  shipperId: string;
  shipperName: string;
  thVehiclePlate: string;
  areaNote: string;
  location: string;
  lines: CrateExportLineInput[];
}

export type { CrateExportListRow, CrateExportDueTodayData };

/** Live member inbound breakdown for agent receipt print (same day, same source as due-today). */
export async function loadAgentMemberInboundBreakdown(
  agentShipperId: string,
  dateInput: string
): Promise<CrateExportPrefillMember[]> {
  const sessionDate = parseDateInput(dateInput);
  const memberships = await prisma.crateStockAgentMember.findMany({
    where: { agentShipperId },
    include: {
      memberShipper: { select: { id: true, code: true, name: true } },
    },
    orderBy: { memberShipper: { name: "asc" } },
  });

  if (memberships.length === 0) return [];

  const memberIds = memberships.map((m) => m.memberShipperId);
  const sessions = await prisma.inboundSession.findMany({
    where: {
      date: sessionDate,
      status: "confirmed",
      shipperId: { in: memberIds },
    },
    include: {
      shipper: { select: { id: true, code: true, name: true } },
      lines: {
        include: {
          tongType: {
            select: { code: true, trackInventory: true, isBox: true },
          },
        },
      },
    },
  });

  const dueByMemberId = new Map<string, Map<string, number>>();
  for (const session of sessions) {
    const map = dueByMemberId.get(session.shipperId) ?? new Map<string, number>();
    for (const line of session.lines) {
      if (!line.tongType.trackInventory || line.tongType.isBox) continue;
      if (!isReturnableCrateTypeCode(line.tongType.code)) continue;
      map.set(
        line.tongType.code,
        (map.get(line.tongType.code) ?? 0) + line.quantity
      );
    }
    dueByMemberId.set(session.shipperId, map);
  }

  const members: CrateExportPrefillMember[] = [];
  for (const membership of memberships) {
    const qtyMap = dueByMemberId.get(membership.memberShipperId);
    if (!qtyMap || qtyMap.size === 0) continue;
    const due = qtyMapToRecord(qtyMap);
    const total = Object.values(due).reduce((s, n) => s + n, 0);
    if (total <= 0) continue;
    members.push({
      memberId: membership.memberShipper.id,
      memberCode: membership.memberShipper.code,
      memberName: membership.memberShipper.name,
      label: membership.memberShipper.name,
      due,
    });
  }

  return members.sort((a, b) => a.label.localeCompare(b.label));
}

/** Agent/pool owed prefill when user changes date on the export form. */
export async function getAgentCrateReturnPrefill(
  agentShipperId: string,
  dateInput: string
): Promise<CrateExportPrefillTarget | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const dueToday = await getCrateExportDueTodayForDate(dateInput);
  for (const item of dueToday.items) {
    if (item.kind === "agent" && item.group.agentId === agentShipperId) {
      return item.group.prefill;
    }
    if (
      item.kind === "pool" &&
      (item.group.prefill.agentId === agentShipperId ||
        item.group.poolShipperId === agentShipperId)
    ) {
      return item.group.prefill;
    }
  }
  return null;
}

async function getCrateExportDueTodayForDate(
  dateInput: string
): Promise<CrateExportDueTodayData> {
  const sessionDate = parseDateInput(dateInput);
  const { start: ledgerStart, end: ledgerEnd } = getBangkokDayUtcRange(dateInput);

  const [
    poolIds,
    membershipRows,
    agentShippers,
    multiOriginShippers,
    inboundSessions,
    exports,
    ledgerExports,
  ] = await Promise.all([
    loadLocationPoolShipperIds(),
    prisma.crateStockAgentMember.findMany({
      select: { agentShipperId: true, memberShipperId: true },
    }),
    prisma.shipper.findMany({
      where: { shipperKind: SHIPPER_KIND.CRATE_STOCK_AGENT },
      select: { id: true, code: true, name: true },
    }),
    prisma.shipper.findMany({
      where: { isMultiOriginCustomer: true },
      select: { id: true },
    }),
    prisma.inboundSession.findMany({
      where: { date: sessionDate, status: "confirmed" },
      include: {
        shipper: {
          select: { id: true, code: true, name: true, pickupLocation: true },
        },
        lines: {
          include: {
            tongType: {
              select: { code: true, trackInventory: true, isBox: true },
            },
          },
        },
      },
    }),
    prisma.tongExport.findMany({
      where: { date: sessionDate },
      include: { tongType: { select: { code: true } } },
    }),
    prisma.customerCrateLedger.findMany({
      where: {
        changeType: "export",
        createdAt: { gte: ledgerStart, lt: ledgerEnd },
      },
      include: { crateType: { select: { code: true } } },
    }),
  ]);

  const shippers = new Map<string, { code: string; name: string }>();
  for (const s of inboundSessions) {
    shippers.set(s.shipper.id, { code: s.shipper.code, name: s.shipper.name });
  }
  for (const a of agentShippers) {
    shippers.set(a.id, { code: a.code, name: a.name });
  }

  const agents = new Map<
    string,
    { code: string; name: string; isPool: boolean; pickup?: "SONGKHLA" | "PATTANI" }
  >();
  for (const a of agentShippers) {
    const pickup = stockLocationForPoolShipperCode(a.code) ?? undefined;
    agents.set(a.id, {
      code: a.code,
      name: a.name,
      isPool: Boolean(pickup),
      pickup: pickup ?? undefined,
    });
  }

  const membershipByMemberId = new Map<string, string>();
  for (const m of membershipRows) {
    membershipByMemberId.set(m.memberShipperId, m.agentShipperId);
  }

  const multiOriginByShipperId = new Map<string, boolean>();
  for (const s of multiOriginShippers) {
    multiOriginByShipperId.set(s.id, true);
  }

  const exportsByShipperId = new Map<string, Map<string, number>>();
  for (const row of exports) {
    if (row.quantityActual <= 0) continue;
    const map = exportsByShipperId.get(row.shipperId) ?? new Map();
    map.set(row.tongType.code, (map.get(row.tongType.code) ?? 0) + row.quantityActual);
    exportsByShipperId.set(row.shipperId, map);
  }

  const exportsByShipperLocation = new Map<string, Map<string, number>>();
  for (const row of ledgerExports) {
    if (row.quantity <= 0) continue;
    const loc = row.location?.trim() ?? "";
    const key = `${row.shipperId}|${loc}`;
    const map = exportsByShipperLocation.get(key) ?? new Map();
    map.set(row.crateType.code, (map.get(row.crateType.code) ?? 0) + row.quantity);
    exportsByShipperLocation.set(key, map);
  }

  return buildCrateExportDueToday({
    date: dateInput,
    poolIds,
    agents,
    membershipByMemberId,
    multiOriginByShipperId,
    shippers,
    inboundSessions: inboundSessions.map((s) => ({
      shipperId: s.shipperId,
      sessionDate: s.date,
      pickupLocation: s.pickupLocation,
      shipperPickupLocation: s.shipper.pickupLocation,
      customerOriginLocation: s.customerOriginLocation,
      areaNote: s.areaNote,
      lines: s.lines.map((l) => ({
        tongCode: l.tongType.code,
        quantity: l.quantity,
        trackInventory: l.tongType.trackInventory,
        isBox: l.tongType.isBox,
      })),
    })),
    exportsByShipperId,
    exportsByShipperLocation,
  });
}

function getActiveCrateExportLines(
  lines: CrateExportLineInput[]
): CrateExportLineInput[] {
  return lines.filter(
    (l) => l.quantityActual > 0 || l.quantitySuggested > 0
  );
}

const CRATE_EXPORT_MIN_LINES_ERROR: MessageKey = "crateExport.error.minLines";

/** At least one non-box line with quantityActual>0 or quantitySuggested>0. */
async function assertCrateExportHasActiveLines(
  lines: CrateExportLineInput[],
  locale: UserLanguage
): Promise<CrateExportLineInput[]> {
  const activeLines = getActiveCrateExportLines(lines);
  if (activeLines.length === 0) {
    throw new Error(t(CRATE_EXPORT_MIN_LINES_ERROR, locale));
  }

  const tongTypeIds = Array.from(
    new Set(activeLines.map((line) => line.tongTypeId))
  );
  const tongTypes = await prisma.tongType.findMany({
    where: { id: { in: tongTypeIds } },
    select: { id: true, isBox: true },
  });
  const tongTypeMap = new Map(tongTypes.map((t) => [t.id, t]));

  const hasSavableLine = activeLines.some((line) => {
    const tongType = tongTypeMap.get(line.tongTypeId);
    return tongType && !tongType.isBox;
  });

  if (!hasSavableLine) {
    throw new Error(t(CRATE_EXPORT_MIN_LINES_ERROR, locale));
  }

  return activeLines;
}

/** Today (Bangkok) pending crate returns: inbound due − export returned, no cross-day carry. */
export async function getCrateExportDueToday(): Promise<CrateExportDueTodayData> {
  const user = await getCurrentUser();
  if (!user) {
    return { date: getBangkokTodayDateInput(), items: [], inTransitNote: null };
  }

  return getCrateExportDueTodayForDate(getBangkokTodayDateInput());
}

/** List crate export batches for a calendar day (grouped by exportNo). */
export async function listCrateExportsForDate(
  dateInput: string
): Promise<CrateExportListRow[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const date = parseDateInput(dateInput);
  const rows = await prisma.tongExport.findMany({
    where: { date },
    include: { shipper: { select: { name: true } } },
    orderBy: [{ createdAt: "desc" }],
    take: CRATE_EXPORT_LIST_LIMIT * 20,
  });

  const grouped = new Map<
    string,
    CrateExportListRow & { sortCreatedAt: number }
  >();

  for (const row of rows) {
    const exportNo = row.exportNo?.trim() || row.id;
    const existing = grouped.get(exportNo);
    if (existing) {
      existing.totalActual += row.quantityActual;
      existing.totalShortage += row.shortage;
      existing.lineCount += 1;
      continue;
    }

    grouped.set(exportNo, {
      exportNo,
      date: toDateInputValue(row.date),
      shipperName: row.shipper.name,
      thVehiclePlate: row.thVehiclePlate,
      totalActual: row.quantityActual,
      totalShortage: row.shortage,
      lineCount: 1,
      sortCreatedAt: row.createdAt.getTime(),
    });
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.sortCreatedAt - a.sortCreatedAt)
    .slice(0, CRATE_EXPORT_LIST_LIMIT)
    .map((row) => ({
      exportNo: row.exportNo,
      date: row.date,
      shipperName: row.shipperName,
      thVehiclePlate: row.thVehiclePlate,
      totalActual: row.totalActual,
      totalShortage: row.totalShortage,
      lineCount: row.lineCount,
    }));
}

/**
 * Save crate export (return empty crates to shipper).
 * SADAO stock -quantity via tong_exports; customer stock +quantity.
 */
export async function saveCrateExport(input: CrateExportSaveInput) {
  const user = await requireWrite();
  const locale = user.language;

  const date = parseDateInput(input.date);
  const activeLines = await assertCrateExportHasActiveLines(input.lines, locale);

  const tongTypeIds = Array.from(
    new Set(activeLines.map((line) => line.tongTypeId))
  );

  const exportNoPromise = input.forceExportNo
    ? Promise.resolve(input.forceExportNo.trim())
    : generateExportNo(date);

  const [stock, exportNo, shipper, tongTypes] = await Promise.all([
    getSadaoStockByTongType(),
    exportNoPromise,
    prisma.shipper.findUnique({
      where: { id: input.shipperId },
      select: { name: true, code: true, isMultiOriginCustomer: true },
    }),
    prisma.tongType.findMany({
      where: { id: { in: tongTypeIds } },
      select: { id: true, code: true, name: true, isBox: true },
    }),
  ]);

  if (!shipper) throw new Error(t("error.shipperNotFound", locale));

  const poolStockLocation = stockLocationForPoolShipperCode(shipper.code);
  let customerStockLocation: string;
  if (poolStockLocation) {
    customerStockLocation = poolStockLocation;
  } else if (shipper.isMultiOriginCustomer) {
    const originRows = await prisma.customerOriginLocation.findMany({
      where: { shipperId: input.shipperId },
      orderBy: [{ sortOrder: "asc" }, { locationName: "asc" }],
      select: { locationName: true },
    });
    customerStockLocation = assertOriginInCustomerList(
      input.location,
      originRows.map((row) => row.locationName)
    );
  } else {
    customerStockLocation = input.location?.trim() ?? "";
  }

  const tongTypeMap = new Map(tongTypes.map((t) => [t.id, t]));
  const exportRows: Prisma.TongExportCreateManyInput[] = [];
  const crateAdditions: { crateTypeId: string; quantity: number }[] = [];
  const receiptLines: {
    tongName: string;
    quantity: number;
    quantityActual: number;
    shortage: number;
  }[] = [];

  for (const line of activeLines) {
    const tongType = tongTypeMap.get(line.tongTypeId);
    if (!tongType || tongType.isBox) continue;

    const available = stock[tongType.code]?.stock ?? 0;
    const actual = Math.min(line.quantityActual, available);
    const shortage = Math.max(0, line.quantitySuggested - actual);

    exportRows.push({
      exportNo,
      date,
      thVehiclePlate: input.thVehiclePlate,
      areaNote: input.areaNote?.trim() || null,
      shipperId: input.shipperId,
      tongTypeId: line.tongTypeId,
      quantitySuggested: line.quantitySuggested,
      quantityActual: actual,
      shortage,
      createdById: user.id,
    });

    if (actual > 0) {
      crateAdditions.push({ crateTypeId: line.tongTypeId, quantity: actual });
    }

    if (actual > 0 || shortage > 0) {
      receiptLines.push({
        tongName: tongType.name,
        quantity: line.quantitySuggested,
        quantityActual: actual,
        shortage,
      });
    }
  }

  if (exportRows.length === 0) {
    throw new Error(t(CRATE_EXPORT_MIN_LINES_ERROR, locale));
  }

  await prisma.tongExport.createMany({ data: exportRows });

  if (crateAdditions.length > 0) {
    const agentMembershipByMemberId =
      await loadCrateStockAgentMembershipByMemberId();
    const stockAccount = resolveCustomerCrateStockAccount({
      operationalShipperId: input.shipperId,
      location: customerStockLocation,
      agentMembershipByMemberId,
    });
    const ledgerNotes = buildCustomerCrateStockLedgerNotes({
      baseNote: exportNo ? `归还 ${exportNo}` : undefined,
      operationalShipperId: input.shipperId,
      operationalShipperName: shipper.name,
      stockAccountShipperId: stockAccount.shipperId,
    });

    await addCustomerCratesBatch(
      stockAccount.shipperId,
      crateAdditions,
      "export",
      stockAccount.location,
      ledgerNotes
    );
  }

  revalidatePath("/tong/export");
  revalidatePath("/crate/export");
  revalidatePath("/crate/export/print");
  revalidatePath("/tong/stock");
  revalidatePath("/crate/stock");
  revalidatePath("/crate/customer-stock");

  return {
    exportNo,
    date: formatDisplayDate(date),
    shipperName: shipper.name,
    thVehiclePlate: input.thVehiclePlate,
    lines: receiptLines,
  };
}

async function resolveCrateExportStockAccount(
  exportNo: string,
  operationalShipperId: string,
  fallbackLocation: string
): Promise<{ shipperId: string; location: string }> {
  const trimmed = exportNo.trim();
  if (trimmed) {
    const ledger = await prisma.customerCrateLedger.findFirst({
      where: {
        changeType: "export",
        notes: { contains: trimmed },
      },
      orderBy: { createdAt: "asc" },
      select: { shipperId: true, location: true },
    });
    if (ledger) {
      return { shipperId: ledger.shipperId, location: ledger.location };
    }
  }

  const shipper = await prisma.shipper.findUnique({
    where: { id: operationalShipperId },
    select: { code: true },
  });
  const poolLoc = shipper ? stockLocationForPoolShipperCode(shipper.code) : null;
  const location = poolLoc ?? fallbackLocation;

  const agentMembershipByMemberId =
    await loadCrateStockAgentMembershipByMemberId();
  return resolveCustomerCrateStockAccount({
    operationalShipperId,
    location,
    agentMembershipByMemberId,
  });
}

async function resolveCrateExportStockLocation(
  exportNo: string,
  shipperId: string
): Promise<string> {
  const account = await resolveCrateExportStockAccount(exportNo, shipperId, "");
  return account.location;
}

async function reverseCrateExportInternal(
  exportNo: string,
  locale: UserLanguage
) {
  const trimmed = exportNo.trim();
  if (!trimmed) {
    throw new Error(t("crateExport.error.invalidExportNo", locale));
  }

  const rows = await prisma.tongExport.findMany({
    where: { exportNo: trimmed },
    select: {
      shipperId: true,
      tongTypeId: true,
      quantityActual: true,
    },
  });

  if (rows.length === 0) {
    throw new Error(t("crateExport.error.notFound", locale));
  }

  const operationalShipperId = rows[0].shipperId;
  const operationalShipper = await prisma.shipper.findUnique({
    where: { id: operationalShipperId },
    select: { name: true },
  });
  const stockAccount = await resolveCrateExportStockAccount(
    trimmed,
    operationalShipperId,
    ""
  );

  const deductions = rows
    .filter((row) => row.quantityActual > 0)
    .map((row) => ({
      crateTypeId: row.tongTypeId,
      quantity: row.quantityActual,
    }));

  if (deductions.length > 0) {
    const ledgerNotes = buildCustomerCrateStockLedgerNotes({
      baseNote: `作废 ${trimmed}`,
      operationalShipperId,
      operationalShipperName: operationalShipper?.name,
      stockAccountShipperId: stockAccount.shipperId,
    });

    await deductCustomerCratesBatch(
      stockAccount.shipperId,
      deductions,
      "export_void",
      stockAccount.location,
      ledgerNotes
    );
  }

  await prisma.tongExport.deleteMany({ where: { exportNo: trimmed } });
}

export async function voidCrateExport(exportNo: string) {
  const user = await requireWrite();
  const locale = user.language;

  const trimmed = exportNo.trim();
  if (!trimmed) {
    throw new Error(t("crateExport.error.invalidExportNo", locale));
  }

  await reverseCrateExportInternal(trimmed, locale);

  revalidatePath("/crate/export");
  revalidatePath("/tong/export");
  revalidatePath("/crate/stock");
  revalidatePath("/tong/stock");
  revalidatePath("/crate/customer-stock");

  return { ok: true as const };
}

export async function getCrateExportForEdit(
  exportNo: string
): Promise<CrateExportEditData | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const trimmed = exportNo.trim();
  if (!trimmed) return null;

  const rows = await prisma.tongExport.findMany({
    where: { exportNo: trimmed },
    include: {
      shipper: { select: { id: true, name: true } },
      tongType: { select: { displayOrder: true } },
    },
    orderBy: { tongType: { displayOrder: "asc" } },
  });

  if (rows.length === 0) return null;

  const first = rows[0];
  const location = await resolveCrateExportStockLocation(trimmed, first.shipperId);

  return {
    exportNo: trimmed,
    date: toDateInputValue(first.date),
    shipperId: first.shipperId,
    shipperName: first.shipper.name,
    thVehiclePlate: first.thVehiclePlate,
    areaNote: first.areaNote ?? "",
    location,
    lines: rows.map((row) => ({
      tongTypeId: row.tongTypeId,
      quantitySuggested: row.quantitySuggested ?? 0,
      quantityActual: row.quantityActual,
    })),
  };
}

export async function editCrateExport(
  exportNo: string,
  input: Omit<CrateExportSaveInput, "forceExportNo">
) {
  const user = await requireWrite();
  const locale = user.language;

  const trimmed = exportNo.trim();
  if (!trimmed) {
    throw new Error(t("crateExport.error.invalidExportNo", locale));
  }

  await assertCrateExportHasActiveLines(input.lines, locale);

  await reverseCrateExportInternal(trimmed, locale);

  return saveCrateExport({
    ...input,
    forceExportNo: trimmed,
  });
}

/** Load receipt data for print / reprint by export batch number. */
export async function getCrateExportReceiptData(
  exportNo: string
): Promise<ReceiptData | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const trimmed = exportNo.trim();
  if (!trimmed) return null;

  const rows = await prisma.tongExport.findMany({
    where: { exportNo: trimmed },
    include: {
      shipper: { select: { name: true, code: true, shipperKind: true } },
      tongType: { select: { name: true, code: true, displayOrder: true } },
    },
    orderBy: { tongType: { displayOrder: "asc" } },
  });

  if (rows.length === 0) return null;

  const first = rows[0];
  const isAgentReceipt =
    isCrateStockAgentShipper(first.shipper) ||
    isLocationPoolShipperCode(first.shipper.code);

  if (isAgentReceipt) {
    const actualTotalsByCode: Record<string, number> = {};
    for (const row of rows) {
      if (row.quantityActual <= 0) continue;
      actualTotalsByCode[row.tongType.code] =
        (actualTotalsByCode[row.tongType.code] ?? 0) + row.quantityActual;
    }

    const memberBreakdown = await loadAgentMemberInboundBreakdown(
      first.shipperId,
      toDateInputValue(first.date)
    );

    const lines = rows
      .filter((row) => row.quantityActual > 0)
      .map((row) => ({
        tongName: row.tongType.name,
        tongCode: row.tongType.code,
        quantity: row.quantityActual,
        quantityActual: row.quantityActual,
        shortage: 0,
      }));

    return {
      kind: "agent",
      exportNo: trimmed,
      date: formatDisplayDate(first.date),
      shipperName: first.shipper.name,
      thVehiclePlate: first.thVehiclePlate,
      lines,
      actualTotalsByCode,
      memberBreakdown,
    };
  }

  const lines = rows
    .filter((row) => row.quantityActual > 0 || row.shortage > 0)
    .map((row) => ({
      tongName: row.tongType.name,
      tongCode: row.tongType.code,
      quantity: row.quantitySuggested ?? 0,
      quantityActual: row.quantityActual,
      shortage: row.shortage,
    }));

  return {
    kind: "standard",
    exportNo: trimmed,
    date: formatDisplayDate(first.date),
    shipperName: first.shipper.name,
    thVehiclePlate: first.thVehiclePlate,
    lines,
  };
}
