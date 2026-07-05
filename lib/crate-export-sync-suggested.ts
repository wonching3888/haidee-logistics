import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toDateInputValue } from "@/lib/inbound-utils";
import { loadCrateExportDayInput } from "@/lib/crate-export-day-context";
import {
  buildInboundDueIndexFromDayInput,
  lookupInboundDue,
} from "@/lib/crate-export-inbound-due";
import { crateExportLineShortage } from "@/lib/crate-export-line-math";
import { isLocationPoolShipperCode } from "@/lib/constants/location-pool-shippers";
import { isCrateStockAgentShipper } from "@/lib/constants/shipper-kind";
import { loadCrateStockAgentMembershipByMemberId } from "@/lib/crate-stock-agent-membership-service";
import { resolveCustomerCrateStockAccount } from "@/lib/customer-crate-stock-account";

export interface CrateExportSyncContext {
  dateInput: string;
  shipperId: string;
}

export function mergeCrateExportSyncContexts(
  contexts: CrateExportSyncContext[]
): CrateExportSyncContext[] {
  const byKey = new Map<string, CrateExportSyncContext>();
  for (const ctx of contexts) {
    const dateInput = ctx.dateInput.trim();
    const shipperId = ctx.shipperId.trim();
    if (!dateInput || !shipperId) continue;
    byKey.set(`${dateInput}|${shipperId}`, { dateInput, shipperId });
  }
  return Array.from(byKey.values());
}

async function resolveExportStockLocation(
  exportNo: string,
  shipperId: string,
  areaNote: string | null
): Promise<string> {
  const agentMembership = await loadCrateStockAgentMembershipByMemberId();
  const shipper = await prisma.shipper.findUnique({
    where: { id: shipperId },
    select: { isMultiOriginCustomer: true },
  });
  const account = resolveCustomerCrateStockAccount({
    operationalShipperId: shipperId,
    location: areaNote?.trim() ?? "",
    isMultiOriginCustomer: shipper?.isMultiOriginCustomer ?? false,
    agentMembershipByMemberId: agentMembership,
  });
  const ledger = await prisma.customerCrateLedger.findFirst({
    where: {
      changeType: "export",
      notes: { contains: exportNo },
      shipperId: account.shipperId,
    },
    select: { location: true },
    orderBy: { createdAt: "asc" },
  });
  return ledger?.location?.trim() ?? areaNote?.trim() ?? "";
}

export async function syncCrateExportSuggestedForContexts(
  contexts: CrateExportSyncContext[],
  tx: Prisma.TransactionClient = prisma
): Promise<{ updatedExportNos: string[] }> {
  const merged = mergeCrateExportSyncContexts(contexts);
  const updatedExportNos: string[] = [];

  const dueIndexCache = new Map<string, ReturnType<typeof buildInboundDueIndexFromDayInput>>();

  for (const { dateInput, shipperId } of merged) {
    let dueIndex = dueIndexCache.get(dateInput);
    if (!dueIndex) {
      const dayInput = await loadCrateExportDayInput(dateInput);
      dueIndex = buildInboundDueIndexFromDayInput(dayInput);
      dueIndexCache.set(dateInput, dueIndex);
    }

    const date = new Date(`${dateInput}T00:00:00.000Z`);
    const exportRows = await tx.tongExport.findMany({
      where: { date, shipperId },
      include: {
        shipper: { select: { code: true, shipperKind: true } },
        tongType: { select: { id: true, code: true, isBox: true } },
      },
      orderBy: [{ exportNo: "asc" }, { tongType: { displayOrder: "asc" } }],
    });

    const byExportNo = new Map<string, typeof exportRows>();
    for (const row of exportRows) {
      const exportNo = row.exportNo?.trim();
      if (!exportNo) continue;
      const list = byExportNo.get(exportNo) ?? [];
      list.push(row);
      byExportNo.set(exportNo, list);
    }

    for (const [exportNo, rows] of Array.from(byExportNo.entries())) {
      const first = rows[0];
      const location = await resolveExportStockLocation(
        exportNo,
        first.shipperId,
        first.areaNote
      );
      const isAgentReceipt =
        isCrateStockAgentShipper(first.shipper) ||
        isLocationPoolShipperCode(first.shipper.code);
      const dueByCode = lookupInboundDue(dueIndex, {
        shipperId: first.shipperId,
        location,
        isAgentReceipt,
      });

      const codes = new Set<string>([
        ...Object.keys(dueByCode),
        ...rows
          .filter((r) => r.quantityActual > 0 || (r.quantitySuggested ?? 0) > 0)
          .map((r) => r.tongType.code),
      ]);

      let touched = false;
      for (const code of Array.from(codes)) {
        const existing = rows.find((r) => r.tongType.code === code);
        const suggested = dueByCode[code] ?? 0;
        const actual = existing?.quantityActual ?? 0;
        const shortage = crateExportLineShortage(suggested, actual);

        if (existing) {
          if (suggested === 0 && actual === 0 && shortage === 0) {
            await tx.tongExport.delete({ where: { id: existing.id } });
            touched = true;
            continue;
          }
          if (
            (existing.quantitySuggested ?? 0) !== suggested ||
            existing.shortage !== shortage
          ) {
            await tx.tongExport.update({
              where: { id: existing.id },
              data: { quantitySuggested: suggested, shortage },
            });
            touched = true;
          }
          continue;
        }

        if (suggested <= 0) continue;

        const tongType = await tx.tongType.findFirst({
          where: { code, active: true, isBox: false },
          select: { id: true },
        });
        if (!tongType) continue;

        await tx.tongExport.create({
          data: {
            exportNo,
            date: first.date,
            thVehiclePlate: first.thVehiclePlate,
            areaNote: first.areaNote,
            shipperId: first.shipperId,
            tongTypeId: tongType.id,
            quantitySuggested: suggested,
            quantityActual: 0,
            shortage,
            createdById: first.createdById,
          },
        });
        touched = true;
      }

      if (touched) {
        updatedExportNos.push(exportNo);
      }
    }
  }

  return { updatedExportNos };
}

export function collectInboundSaveSyncContexts(input: {
  before?: { date: Date; shipperId: string } | null;
  after: { date: Date; shipperId: string };
}): CrateExportSyncContext[] {
  return mergeCrateExportSyncContexts([
    {
      dateInput: toDateInputValue(input.after.date),
      shipperId: input.after.shipperId,
    },
    ...(input.before
      ? [
          {
            dateInput: toDateInputValue(input.before.date),
            shipperId: input.before.shipperId,
          },
        ]
      : []),
  ]);
}
