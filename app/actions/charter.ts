"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseDateInput } from "@/lib/date-utils";
import { INBOUND_VISIBLE_TONG_TYPE_WHERE } from "@/lib/constants/tong-type-scope";
import { listCrateRentalRates } from "@/lib/crate-rental-rates-service";
import { loadExchangeRate } from "@/lib/exchange-rate";
import { generateCharterNo } from "@/lib/charter-no";
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
  isCharterCargoType,
  normalizeCharterNote,
  parseCharterMoneyInput,
  parseRequiredCharterMoney,
  serializeCharterTrip,
  serializeCharterTripListItem,
  type CharterTripInput,
  type CharterTripLineInput,
  type CharterTripListItem,
  type CharterTripRecord,
} from "@/lib/charter";

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
      shipper: { select: { code: true, name: true } },
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

  const shipperId =
    input.cargoType === "seafood"
      ? input.shipperId?.trim() || null
      : null;
  if (input.cargoType === "seafood" && !shipperId) {
    throw new Error("海产包车请选择寄货人 Seafood charter requires a shipper");
  }

  const stockAreaNote =
    input.cargoType === "seafood"
      ? normalizeCharterNote(input.stockAreaNote)
      : null;

  return {
    cargoType: input.cargoType,
    shipperId,
    stockAreaNote,
    includeBorderFees: input.includeBorderFees,
    charterMileageKm,
    charterRevenueMyr,
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
    charterExtraRevenueMyr: parseCharterMoneyInput(input.charterExtraRevenueMyr),
    charterExtraRevenueNote: normalizeCharterNote(input.charterExtraRevenueNote),
    charterExtraCostMyr: parseCharterMoneyInput(input.charterExtraCostMyr),
    charterExtraCostNote: normalizeCharterNote(input.charterExtraCostNote),
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
    });
  }
}

function revalidateCharterPaths(id?: string) {
  revalidatePath("/charter");
  revalidatePath("/crate/customer-stock");
  if (id) revalidatePath(`/charter/${id}`);
}

export async function saveCharterTrip(
  input: CharterTripInput
): Promise<{ ok: true; id: string }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录 Unauthorized");

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

  if (input.id) {
    const existing = await prisma.charterTrip.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        charterNo: true,
        cargoType: true,
        shipperId: true,
        stockAreaNote: true,
        lines: { select: { tongTypeId: true, quantity: true } },
      },
    });
    if (!existing) throw new Error("包车记录不存在 Charter trip not found");

    const beforeSnapshot: CharterStockSnapshot = {
      cargoType: existing.cargoType,
      shipperId: existing.shipperId,
      stockAreaNote: existing.stockAreaNote,
      charterNo: existing.charterNo,
      lines: existing.lines,
    };

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
    return { ok: true, id: input.id };
  }

  const charterNo = await generateCharterNo(date);

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
  return { ok: true, id: created.id };
}

export async function deleteCharterTrip(id: string): Promise<{ ok: true }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录 Unauthorized");

  const existing = await prisma.charterTrip.findUnique({
    where: { id },
    select: {
      charterNo: true,
      cargoType: true,
      shipperId: true,
      stockAreaNote: true,
      lines: { select: { tongTypeId: true, quantity: true } },
    },
  });
  if (!existing) throw new Error("包车记录不存在 Charter trip not found");

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
  });

  await prisma.charterTrip.delete({ where: { id } });
  revalidateCharterPaths();
  return { ok: true };
}
