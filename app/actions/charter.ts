"use server";

import { revalidatePath } from "next/cache";
import { invalidatePnlTripsCache } from "@/lib/pnl-cache-invalidation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { requireRole, requireWrite } from "@/lib/require-auth";
import { parseDateInput, formatDisplayDate, toDateInputValue } from "@/lib/date-utils";
import { INBOUND_VISIBLE_TONG_TYPE_WHERE } from "@/lib/constants/tong-type-scope";
import { listCrateRentalRates } from "@/lib/crate-rental-rates-service";
import { loadExchangeRate } from "@/lib/exchange-rate";
import { generateCharterNo } from "@/lib/charter-no";
import { syncDriverPayrollTripForCharter } from "@/lib/driver-payroll-trip-sync";
import {
  appendDispatchChangeLogs,
  buildCharterCreateMetadata,
  diffCharterLines,
  diffDispatchScalarFields,
  formatAuditMoney,
  formatDateAudit,
  type CharterExtraSnapshot,
  type CharterLineSnapshot,
  type DispatchChangeLogInput,
} from "@/lib/dispatch-audit";
import {
  applyCharterCrateDeduction,
  charterLinesToStockLines,
  resolveCharterStockContext,
  reverseCharterCrateDeduction,
} from "@/lib/charter-crate-stock";
import { OPERATIONAL_SHIPPER_WHERE } from "@/lib/constants/shipper-kind";
import {
  buildCharterCostPreview,
  computeCharterStoredCosts,
  type CharterCostPreview,
} from "@/lib/charter-costs";
import {
  isCharterBillingCompany,
  isCharterCargoType,
  normalizeCharterNote,
  parseCharterExtraItems,
  parseCharterMoneyInput,
  parseRequiredCharterMoney,
  parseRequiredCharterQuantity,
  serializeCharterTrip,
  serializeCharterTripListItem,
  charterBillingCompanyLabel,
  type CharterBillingCompany,
  type CharterTripInput,
  type CharterTripLineInput,
  type CharterTripListItem,
  type CharterTripRecord,
} from "@/lib/charter";
import {
  buildCharterInvoiceFromTrip,
  computeCharterInvoiceAmountMyr,
  resolveCharterBillToDisplayLabelFromTrip,
  type CharterInvoiceData,
} from "@/lib/charter-invoice";
import {
  charterTripPnlSelect,
  computeCharterPnlRow,
  type CharterTripPnlInput,
} from "@/lib/charter-pnl";
import { attachPayrollCharterSalaries } from "@/lib/charter-payroll-salary";
import { loadCharterVoucherContextByTripId } from "@/lib/charter-voucher-cost-resolver";
import { loadGlobalTripCostValues } from "@/lib/operations-cost";
import { canViewInvoiceAmounts } from "@/lib/auth-roles";
import type { UserRole } from "@/types";

export async function getCharterTrips(dateStr: string): Promise<CharterTripListItem[]> {
  const date = parseDateInput(dateStr);
  const rows = await prisma.charterTrip.findMany({
    where: { date },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      charterNo: true,
      date: true,
      driverName: true,
      cargoType: true,
      charterMileageKm: true,
      charterRevenueMyr: true,
      truck: { select: { plate: true } },
    },
  });

  return rows
    .map((row) => serializeCharterTripListItem(row))
    .filter((row): row is CharterTripListItem => row != null);
}

export async function getCharterTrip(id: string): Promise<CharterTripRecord | null> {
  const row = await prisma.charterTrip.findUnique({
    where: { id },
    include: {
      truck: { select: { plate: true } },
      shipper: { select: { code: true, name: true, location: true } },
      extraItems: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      lines: {
        orderBy: { id: "asc" },
        include: {
          tongType: { select: { code: true, name: true, isBox: true } },
        },
      },
    },
  });
  if (!row) return null;
  return serializeCharterTrip(row);
}

export async function getCharterInvoiceData(
  id: string
): Promise<CharterInvoiceData> {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录 Unauthorized");

  const row = await prisma.charterTrip.findUnique({
    where: { id },
    include: {
      truck: { select: { plate: true } },
      shipper: { select: { code: true, name: true, location: true } },
      extraItems: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    },
  });
  if (!row) throw new Error("包车记录不存在 Charter trip not found");
  return buildCharterInvoiceFromTrip(row);
}

export interface CharterInvoiceMonthTrip {
  id: string;
  charterNo: string;
  date: string;
  dateLabel: string;
  truckPlate: string;
  billToDisplayLabel: string | null;
  billingCompany: CharterBillingCompany;
  billingCompanyLabel: string;
  amountMyr: number;
}

function parseCharterInvoiceYearMonth(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("无效年份 Invalid year");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("无效月份 Invalid month");
  }
}

function charterMonthDateRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = new Date(Date.UTC(year, month - 1, lastDay));
  return { start, end };
}

export async function getCharterInvoiceTripsForMonth(input: {
  year: number;
  month: number;
}): Promise<{ trips: CharterInvoiceMonthTrip[]; totalAmountMyr: number }> {
  const user = await getCurrentUser();
  if (!user || !canViewInvoiceAmounts(user.role as UserRole)) {
    throw new Error("无权限查看账单 Unauthorized");
  }

  parseCharterInvoiceYearMonth(input.year, input.month);
  const { start, end } = charterMonthDateRange(input.year, input.month);

  const rows = await prisma.charterTrip.findMany({
    where: {
      date: { gte: start, lte: end },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      charterNo: true,
      date: true,
      billingCompany: true,
      billToCustomerName: true,
      charterRevenueMyr: true,
      cargoType: true,
      truck: { select: { plate: true } },
      shipper: { select: { code: true, name: true } },
      extraItems: {
        where: { itemType: "revenue" },
        select: { itemType: true, amountMyr: true },
      },
    },
  });

  const trips: CharterInvoiceMonthTrip[] = [];
  for (const row of rows) {
    if (!isCharterCargoType(row.cargoType)) continue;
    if (!isCharterBillingCompany(row.billingCompany)) continue;

    const amountMyr = computeCharterInvoiceAmountMyr(row);
    if (amountMyr <= 0) continue;

    trips.push({
      id: row.id,
      charterNo: row.charterNo ?? row.id.slice(0, 8),
      date: row.date.toISOString().slice(0, 10),
      dateLabel: formatDisplayDate(row.date),
      truckPlate: row.truck.plate,
      billToDisplayLabel: resolveCharterBillToDisplayLabelFromTrip(row),
      billingCompany: row.billingCompany,
      billingCompanyLabel: charterBillingCompanyLabel(row.billingCompany),
      amountMyr,
    });
  }

  const totalAmountMyr =
    Math.round(trips.reduce((sum, trip) => sum + trip.amountMyr, 0) * 100) / 100;

  return { trips, totalAmountMyr };
}

function buildAllExtraItems(input: CharterTripInput) {
  const revenue = parseCharterExtraItems(input.extraItems, "revenue");
  const cost = parseCharterExtraItems(input.extraItems, "cost");
  return [
    ...revenue.map((item, index) => ({ ...item, sortOrder: index })),
    ...cost.map((item, index) => ({
      ...item,
      sortOrder: revenue.length + index,
    })),
  ];
}

export async function getCharterFormOptions() {
  const [trucks, drivers, tongTypes, shippers] = await Promise.all([
    prisma.truck.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { plate: "asc" }],
      select: {
        id: true,
        plate: true,
        type: true,
        defaultDriverId: true,
        defaultDriver: { select: { name: true } },
      },
    }),
    prisma.driver.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.tongType.findMany({
      where: INBOUND_VISIBLE_TONG_TYPE_WHERE,
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
      select: { id: true, code: true, name: true, isBox: true },
    }),
    prisma.shipper.findMany({
      where: OPERATIONAL_SHIPPER_WHERE,
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, pickupLocation: true },
    }),
  ]);

  return {
    trucks: trucks.map((truck) => ({
      id: truck.id,
      plate: truck.plate,
      type: truck.type,
      defaultDriverId: truck.defaultDriverId,
      defaultDriverName: truck.defaultDriver?.name ?? "",
    })),
    drivers,
    tongTypes,
    shippers,
  };
}

export async function previewCharterCosts(input: {
  date: string;
  truckId: string;
  cargoType: "seafood" | "general";
  includeBorderFees: boolean;
  mileageKm: string | number;
  lines: Array<{ tongTypeId: string; quantity: number }>;
}): Promise<CharterCostPreview> {
  const mileage =
    parseCharterMoneyInput(input.mileageKm) ??
    (typeof input.mileageKm === "number" ? input.mileageKm : 0);

  const tongTypeIds = input.lines
    .map((line) => line.tongTypeId)
    .filter(Boolean);
  const tongTypes =
    tongTypeIds.length > 0
      ? await prisma.tongType.findMany({
          where: { id: { in: tongTypeIds } },
          select: { id: true, code: true, isBox: true },
        })
      : [];
  const tongTypeById = new Map(tongTypes.map((t) => [t.id, t]));

  const costLines = input.lines
    .map((line) => {
      const tongType = tongTypeById.get(line.tongTypeId);
      if (!tongType || line.quantity <= 0) return null;
      return {
        tongTypeCode: tongType.code,
        isBox: tongType.isBox,
        quantity: line.quantity,
      };
    })
    .filter((line): line is NonNullable<typeof line> => line != null);

  return buildCharterCostPreview({
    date: input.date,
    truckId: input.truckId,
    cargoType: input.cargoType,
    includeBorderFees: input.includeBorderFees,
    mileageKm: mileage,
    lines: costLines,
  });
}

async function resolveSeafoodLines(lines: CharterTripLineInput[] | undefined) {
  if (!lines?.length) return [];

  const tongTypeIds = Array.from(
    new Set(lines.map((line) => line.tongTypeId).filter(Boolean))
  );
  const tongTypes = await prisma.tongType.findMany({
    where: { id: { in: tongTypeIds } },
    select: { id: true, code: true, isBox: true },
  });
  const tongTypeById = new Map(tongTypes.map((t) => [t.id, t]));

  const resolved: Array<{
    tongTypeId: string;
    quantity: number;
    tongTypeCode: string;
    isBox: boolean;
  }> = [];

  for (const line of lines) {
    if (!line.tongTypeId || line.quantity <= 0) continue;
    const tongType = tongTypeById.get(line.tongTypeId);
    if (!tongType) {
      throw new Error("桶型无效 Invalid crate type");
    }
    resolved.push({
      tongTypeId: line.tongTypeId,
      quantity: Math.round(line.quantity),
      tongTypeCode: tongType.code,
      isBox: tongType.isBox,
    });
  }

  return resolved;
}

function buildCharterTripData(input: CharterTripInput) {
  if (!isCharterCargoType(input.cargoType)) {
    throw new Error(
      "请选择货类：海产或普货 Select cargo type: Seafood or General Cargo"
    );
  }

  const charterMileageKm = parseRequiredCharterMoney(
    input.charterMileageKm,
    "公里数 mileage"
  );
  if (charterMileageKm <= 0) {
    throw new Error("公里数须大于 0 Mileage must be greater than 0");
  }

  const charterRevenueMyr = parseRequiredCharterMoney(
    input.charterRevenueMyr,
    "顾客总价 revenue"
  );
  if (charterRevenueMyr < 0) {
    throw new Error("顾客总价不能为负数 Revenue cannot be negative");
  }

  if (!input.truckId) {
    throw new Error("请选择车牌 Select truck plate");
  }

  const shipperId = input.shipperId?.trim() || null;
  if (input.cargoType === "seafood" && !shipperId) {
    throw new Error("海产包车请选择寄货人 Seafood charter requires a shipper");
  }

  const billingCompany = input.billingCompany ?? "haidee";
  if (!isCharterBillingCompany(billingCompany)) {
    throw new Error("请选择开票主体 Select billing company");
  }

  const stockAreaNote =
    input.cargoType === "seafood"
      ? normalizeCharterNote(input.stockAreaNote)
      : null;

  return {
    cargoType: input.cargoType,
    shipperId,
    stockAreaNote,
    billToCustomerName: normalizeCharterNote(input.billToCustomerName),
    billingCompany,
    includeBorderFees: input.includeBorderFees,
    charterMileageKm,
    charterRevenueMyr,
    totalQuantity: parseRequiredCharterQuantity(
      input.totalQuantity,
      "实际总桶数 total quantity"
    ),
    charterTollMyr: parseCharterMoneyInput(input.charterTollMyr),
    charterUnloadFeeMyr: parseCharterMoneyInput(input.charterUnloadFeeMyr),
    charterDriverSalaryMyr: parseCharterMoneyInput(input.charterDriverSalaryMyr),
    charterOtherCostMyr:
      input.cargoType === "general"
        ? parseCharterMoneyInput(input.charterOtherCostMyr)
        : null,
    charterOtherCostNote:
      input.cargoType === "general"
        ? normalizeCharterNote(input.charterOtherCostNote)
        : null,
  };
}

type CharterStockSnapshot = {
  cargoType: string;
  shipperId: string | null;
  stockAreaNote: string | null;
  charterNo: string | null;
  lines: Array<{ tongTypeId: string; quantity: number }>;
};

async function syncCharterCrateStock(input: {
  before: CharterStockSnapshot | null;
  after: CharterStockSnapshot;
  tx?: Prisma.TransactionClient;
}) {
  if (
    input.before?.cargoType === "seafood" &&
    input.before.shipperId &&
    input.before.lines.length > 0
  ) {
    const { stockLocation } = await resolveCharterStockContext(
      input.before.shipperId,
      input.before.stockAreaNote
    );
    const stockLines = await charterLinesToStockLines(input.before.lines);
    await reverseCharterCrateDeduction({
      shipperId: input.before.shipperId,
      stockLocation,
      lines: stockLines,
      charterNo: input.before.charterNo,
      tx: input.tx,
    });
  }

  if (
    input.after.cargoType === "seafood" &&
    input.after.shipperId &&
    input.after.lines.length > 0
  ) {
    const { stockLocation } = await resolveCharterStockContext(
      input.after.shipperId,
      input.after.stockAreaNote
    );
    const stockLines = await charterLinesToStockLines(input.after.lines);
    await applyCharterCrateDeduction({
      shipperId: input.after.shipperId,
      stockLocation,
      lines: stockLines,
      charterNo: input.after.charterNo,
      tx: input.tx,
    });
  }
}

function revalidateCharterPaths(id?: string) {
  invalidatePnlTripsCache();
  try {
    revalidatePath("/charter");
    revalidatePath("/crate/customer-stock");
    revalidatePath("/driver-payroll");
    revalidatePath("/history");
    if (id) {
      revalidatePath(`/charter/${id}`);
      revalidatePath(`/charter/${id}/invoice`);
    }
  } catch {
    // Outside Next.js request context (e.g. verification scripts)
  }
}

export async function saveCharterTrip(
  input: CharterTripInput
): Promise<{ ok: true; id: string }> {
  const user = await requireWrite();

  const date = parseDateInput(input.date);
  const data = buildCharterTripData(input);
  const resolvedLines = await resolveSeafoodLines(input.lines);

  if (data.cargoType === "seafood" && resolvedLines.length === 0) {
    throw new Error(
      "海产包车请至少录入一行桶型与数量 Seafood charter requires at least one crate line"
    );
  }

  const [year, month] = input.date.split("-").map(Number);
  const [exchangeRate, crateRentalRates] = await Promise.all([
    loadExchangeRate(year, month),
    listCrateRentalRates(),
  ]);

  const storedCosts = await computeCharterStoredCosts({
    cargoType: data.cargoType,
    lines: resolvedLines,
    exchangeRate,
    crateRentalRates,
  });

  const driverName = normalizeCharterNote(input.driverName) ?? null;
  const afterLines = resolvedLines.map((line) => ({
    tongTypeId: line.tongTypeId,
    quantity: line.quantity,
  }));
  const extraItems = buildAllExtraItems(input);

  if (input.id) {
    const [existing, newTruck] = await Promise.all([
      prisma.charterTrip.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          charterNo: true,
          date: true,
          cargoType: true,
          shipperId: true,
          stockAreaNote: true,
          driverName: true,
          charterRevenueMyr: true,
          charterDriverSalaryMyr: true,
          billingCompany: true,
          totalQuantity: true,
          truck: { select: { plate: true } },
          lines: {
            select: {
              tongTypeId: true,
              quantity: true,
              tongType: { select: { code: true } },
            },
          },
          extraItems: {
            select: { itemType: true, amountMyr: true, note: true, sortOrder: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      }),
      prisma.truck.findUnique({
        where: { id: input.truckId },
        select: { plate: true },
      }),
    ]);
    if (!existing) throw new Error("包车记录不存在 Charter trip not found");
    if (!newTruck) throw new Error("请选择车牌 Select truck plate");

    const beforeSnapshot: CharterStockSnapshot = {
      cargoType: existing.cargoType,
      shipperId: existing.shipperId,
      stockAreaNote: existing.stockAreaNote,
      charterNo: existing.charterNo,
      lines: existing.lines,
    };

    const beforeLines: CharterLineSnapshot[] = existing.lines.map((line) => ({
      tongTypeId: line.tongTypeId,
      tongTypeCode: line.tongType.code,
      quantity: line.quantity,
    }));
    const afterLines: CharterLineSnapshot[] = resolvedLines.map((line) => ({
      tongTypeId: line.tongTypeId,
      tongTypeCode: line.tongTypeCode,
      quantity: line.quantity,
    }));
    const beforeExtras: CharterExtraSnapshot[] = existing.extraItems.map((item) => ({
      itemType: item.itemType,
      amountMyr: Number(item.amountMyr),
      note: item.note,
    }));
    const afterExtras: CharterExtraSnapshot[] = extraItems.map((item) => ({
      itemType: item.itemType,
      amountMyr: Number(item.amountMyr),
      note: item.note,
    }));

    await prisma.$transaction(async (tx) => {
      await tx.charterTrip.update({
        where: { id: input.id },
        data: {
          date,
          truckId: input.truckId,
          driverName,
          ...data,
          computedLkimMyr: storedCosts.lkimMyr,
          computedCrateRentalMyr: storedCosts.crateRentalMyr,
        },
      });

      await tx.charterTripLine.deleteMany({
        where: { charterTripId: input.id },
      });

      if (resolvedLines.length > 0) {
        await tx.charterTripLine.createMany({
          data: resolvedLines.map((line) => ({
            charterTripId: input.id!,
            tongTypeId: line.tongTypeId,
            quantity: line.quantity,
          })),
        });
      }

      await tx.charterTripExtraItem.deleteMany({
        where: { charterTripId: input.id },
      });
      if (extraItems.length > 0) {
        await tx.charterTripExtraItem.createMany({
          data: extraItems.map((item) => ({
            charterTripId: input.id!,
            itemType: item.itemType,
            amountMyr: item.amountMyr,
            note: item.note,
            sortOrder: item.sortOrder,
          })),
        });
      }

      const fieldChanges = diffDispatchScalarFields(
        {
          date: formatDateAudit(existing.date),
          plate: existing.truck.plate,
          driverName: existing.driverName ?? null,
          charterRevenueMyr: formatAuditMoney(existing.charterRevenueMyr),
          charterDriverSalaryMyr: formatAuditMoney(existing.charterDriverSalaryMyr),
          billingCompany: existing.billingCompany,
          cargoType: existing.cargoType,
          totalQuantity:
            existing.totalQuantity != null ? String(existing.totalQuantity) : null,
        },
        {
          date: formatDateAudit(date),
          plate: newTruck.plate,
          driverName,
          charterRevenueMyr: formatAuditMoney(data.charterRevenueMyr),
          charterDriverSalaryMyr: formatAuditMoney(data.charterDriverSalaryMyr),
          billingCompany: data.billingCompany,
          cargoType: data.cargoType,
          totalQuantity:
            data.totalQuantity != null ? String(data.totalQuantity) : null,
        },
        [
          "date",
          "plate",
          "driverName",
          "charterRevenueMyr",
          "charterDriverSalaryMyr",
          "billingCompany",
          "cargoType",
          "totalQuantity",
        ]
      );
      const lineDiff = diffCharterLines(beforeLines, afterLines);
      const auditLogs: DispatchChangeLogInput[] = fieldChanges.map((change) => ({
        entityType: "charter",
        entityId: input.id!,
        entityLabel: existing.charterNo,
        eventType: "update",
        field: change.field,
        fromValue: change.fromValue,
        toValue: change.toValue,
      }));
      if (lineDiff) {
        auditLogs.push({
          entityType: "charter",
          entityId: input.id!,
          entityLabel: existing.charterNo,
          eventType: "update",
          field: "lines",
          fromValue: `变更 ${lineDiff.removed.length + lineDiff.qtyChanged.length} 行`,
          toValue: `变更 ${lineDiff.added.length + lineDiff.qtyChanged.length} 行`,
          metadata: { lines: lineDiff } as unknown as Prisma.InputJsonValue,
        });
      }
      const beforeExtrasJson = JSON.stringify(beforeExtras);
      const afterExtrasJson = JSON.stringify(afterExtras);
      if (beforeExtrasJson !== afterExtrasJson) {
        auditLogs.push({
          entityType: "charter",
          entityId: input.id!,
          entityLabel: existing.charterNo,
          eventType: "update",
          field: "extraItems",
          fromValue: `${beforeExtras.length} 项`,
          toValue: `${afterExtras.length} 项`,
          metadata: {
            extraItems: { before: beforeExtras, after: afterExtras },
          } as unknown as Prisma.InputJsonValue,
        });
      }
      await appendDispatchChangeLogs(tx, {
        actorUserId: user.id,
        logs: auditLogs,
      });
    });

    await syncCharterCrateStock({
      before: beforeSnapshot,
      after: {
        cargoType: data.cargoType,
        shipperId: data.shipperId,
        stockAreaNote: data.stockAreaNote,
        charterNo: existing.charterNo,
        lines: afterLines,
      },
    });

    revalidateCharterPaths(input.id);
    await syncDriverPayrollTripForCharter(input.id);
    return { ok: true, id: input.id };
  }

  const charterNo = await generateCharterNo(date);
  const createTruck = await prisma.truck.findUnique({
    where: { id: input.truckId },
    select: { plate: true },
  });
  if (!createTruck) throw new Error("请选择车牌 Select truck plate");

  const created = await prisma.$transaction(async (tx) => {
    const trip = await tx.charterTrip.create({
      data: {
        charterNo,
        date,
        truckId: input.truckId,
        driverName,
        createdById: user.id,
        ...data,
        computedLkimMyr: storedCosts.lkimMyr,
        computedCrateRentalMyr: storedCosts.crateRentalMyr,
      },
    });

    if (resolvedLines.length > 0) {
      await tx.charterTripLine.createMany({
        data: resolvedLines.map((line) => ({
          charterTripId: trip.id,
          tongTypeId: line.tongTypeId,
          quantity: line.quantity,
        })),
      });
    }

    if (extraItems.length > 0) {
      await tx.charterTripExtraItem.createMany({
        data: extraItems.map((item) => ({
          charterTripId: trip.id,
          itemType: item.itemType,
          amountMyr: item.amountMyr,
          note: item.note,
          sortOrder: item.sortOrder,
        })),
      });
    }

    await appendDispatchChangeLogs(tx, {
      actorUserId: user.id,
      logs: [
        {
          entityType: "charter",
          entityId: trip.id,
          entityLabel: charterNo,
          eventType: "create",
          metadata: buildCharterCreateMetadata({
            charterNo,
            date,
            plate: createTruck.plate,
            driverName,
            cargoType: data.cargoType,
            charterRevenueMyr: data.charterRevenueMyr,
            lineCount: resolvedLines.length,
            totalQty: resolvedLines.reduce((sum, line) => sum + line.quantity, 0),
          }),
        },
      ],
    });

    return trip;
  });

  await syncCharterCrateStock({
    before: null,
    after: {
      cargoType: data.cargoType,
      shipperId: data.shipperId,
      stockAreaNote: data.stockAreaNote,
      charterNo,
      lines: afterLines,
    },
  });

  revalidateCharterPaths(created.id);
  await syncDriverPayrollTripForCharter(created.id);
  return { ok: true, id: created.id };
}

export async function deleteCharterTrip(id: string): Promise<{ ok: true }> {
  const user = await requireWrite();

  const existing = await prisma.charterTrip.findUnique({
    where: { id },
    select: {
      charterNo: true,
      date: true,
      cargoType: true,
      driverName: true,
      charterRevenueMyr: true,
      charterDriverSalaryMyr: true,
      billingCompany: true,
      shipperId: true,
      stockAreaNote: true,
      truck: { select: { plate: true } },
      lines: { select: { tongTypeId: true, quantity: true } },
    },
  });
  if (!existing) throw new Error("包车记录不存在 Charter trip not found");

  await prisma.$transaction(async (tx) => {
    await appendDispatchChangeLogs(tx, {
      actorUserId: user.id,
      logs: [
        {
          entityType: "charter",
          entityId: id,
          entityLabel: existing.charterNo,
          eventType: "delete",
          metadata: {
            charterNo: existing.charterNo,
            date: toDateInputValue(existing.date),
            plate: existing.truck.plate,
            driverName: existing.driverName,
            cargoType: existing.cargoType,
            charterRevenueMyr: formatAuditMoney(existing.charterRevenueMyr),
            charterDriverSalaryMyr: formatAuditMoney(existing.charterDriverSalaryMyr),
            billingCompany: existing.billingCompany,
            lineCount: existing.lines.length,
            totalQty: existing.lines.reduce((sum, line) => sum + line.quantity, 0),
          },
        },
      ],
    });

    await tx.driverVoucher.deleteMany({
      where: { tripId: id, tripSource: "charter" },
    });

    await syncCharterCrateStock({
      before: {
        cargoType: existing.cargoType,
        shipperId: existing.shipperId,
        stockAreaNote: existing.stockAreaNote,
        charterNo: existing.charterNo,
        lines: existing.lines,
      },
      after: {
        cargoType: "general",
        shipperId: null,
        stockAreaNote: null,
        charterNo: existing.charterNo,
        lines: [],
      },
      tx,
    });

    await tx.charterTrip.delete({ where: { id } });
  });

  revalidateCharterPaths();
  return { ok: true };
}

export interface CharterMonthlyLedgerRow {
  id: string;
  date: string;
  charterNo: string | null;
  truckPlate: string;
  customerName: string;
  locationLabel: string;
  revenueMyr: number;
  grossProfitMyr: number;
}

const charterMonthlyLedgerSelect = {
  stockAreaNote: true,
  ...charterTripPnlSelect,
  shipper: { select: { id: true, code: true, name: true, location: true } },
} as const;

type CharterMonthlyLedgerDbRow = CharterTripPnlInput & {
  stockAreaNote: string | null;
  shipper?: { id: string; code: string; name: string; location: string | null } | null;
};

function resolveCharterLedgerLocation(row: CharterMonthlyLedgerDbRow): string {
  const stockArea = row.stockAreaNote?.trim();
  if (stockArea) return stockArea;
  const shipperLocation = row.shipper?.location?.trim();
  if (shipperLocation) return shipperLocation;
  return "—";
}

export async function getCharterMonthlyLedger(input: {
  year: number;
  month: number;
}): Promise<{ rows: CharterMonthlyLedgerRow[] }> {
  await requireRole(["admin"]);

  parseCharterInvoiceYearMonth(input.year, input.month);
  const { start, end } = charterMonthDateRange(input.year, input.month);
  const globalCosts = await loadGlobalTripCostValues();

  const dbRows = (await prisma.charterTrip.findMany({
    where: { date: { gte: start, lte: end } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: charterMonthlyLedgerSelect,
  })) as CharterMonthlyLedgerDbRow[];

  const voucherByTripId = await loadCharterVoucherContextByTripId(
    dbRows.map((trip) => trip.id)
  );
  const rowsWithPayroll = await attachPayrollCharterSalaries(dbRows);

  const rows: CharterMonthlyLedgerRow[] = [];
  for (const trip of rowsWithPayroll) {
    const pnlRow = computeCharterPnlRow(
      trip,
      globalCosts,
      voucherByTripId.get(trip.id)
    );
    if (!pnlRow) continue;

    const customerName = pnlRow.shippers[0]?.shipperName ?? "—";
    rows.push({
      id: trip.id,
      date: toDateInputValue(trip.date),
      charterNo: trip.charterNo,
      truckPlate: pnlRow.truckPlate,
      customerName,
      locationLabel: resolveCharterLedgerLocation(trip),
      revenueMyr: pnlRow.revenueMyr,
      grossProfitMyr: pnlRow.grossProfitMyr,
    });
  }

  return { rows };
}
