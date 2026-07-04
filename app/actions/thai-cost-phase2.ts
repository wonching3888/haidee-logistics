"use server";

import { getCurrentUser } from "@/lib/auth";
import { canAccessThaiCost, canWriteThaiCost } from "@/lib/auth-roles";
import { yearMonthKey } from "@/lib/constants/thai-cost";
import { parseDateInput, toDateInputValue } from "@/lib/date-utils";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import {
  computeSadaoHandlingCommission,
  SadaoHandlingValidationError,
} from "@/lib/thai-cost/sadao-cost";
import {
  computePattaniDayCosts,
  loadCurrentThaiCostRates,
  resolveThaiCostRatesForMonth,
  saveCurrentThaiCostRates,
  type ThaiCostRates,
} from "@/lib/thai-cost/rate-settings";
import { lockThaiMonthSnapshots } from "@/lib/thai-cost/segment-internal-cost";
import { getSongkhlaPnl, type SongkhlaPnlDetail } from "@/lib/thai-cost/songkhla-pnl";
import { getPattaniPnl, type PattaniPnlDetail } from "@/lib/thai-cost/pattani-pnl";
import { revalidateThaiCost } from "@/app/actions/thai-cost";
import { randomUUID } from "crypto";

async function requireRead() {
  const user = await getCurrentUser();
  if (!user || !canAccessThaiCost(user.role)) {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

async function requireWrite() {
  const user = await getCurrentUser();
  if (!user || !canWriteThaiCost(user.role)) {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

// ─── Rate settings ───────────────────────────────────────────────────────────

export async function getThaiCostRateSettings(): Promise<ThaiCostRates> {
  await requireRead();
  return loadCurrentThaiCostRates();
}

export async function saveThaiCostRateSettings(
  rates: ThaiCostRates
): Promise<ThaiCostRates> {
  const user = await requireWrite();
  const saved = await saveCurrentThaiCostRates(rates, user.id);
  revalidateThaiCost();
  return saved;
}

export async function getThaiCostRatesForMonth(input: {
  year: number;
  month: number;
}) {
  await requireRead();
  return resolveThaiCostRatesForMonth(input.year, input.month);
}

export async function lockThaiCostMonth(input: {
  year: number;
  month: number;
  force?: boolean;
}) {
  const user = await requireWrite();
  const result = await lockThaiMonthSnapshots({
    year: input.year,
    month: input.month,
    createdBy: user.id,
    force: input.force,
    pickups: ["SONGKHLA", "PATTANI"],
  });
  revalidateThaiCost();
  return result;
}

// ─── Songkhla handling ───────────────────────────────────────────────────────

export interface SongkhlaHandlingRow {
  id: string;
  date: string;
  smallCrateTotalQty: number;
  largeCrateTotalQty: number;
  boxTotalQty: number;
  smallCommissionThb: number;
  largeCommissionThb: number;
  boxCommissionThb: number;
  commissionThb: number;
  notes: string | null;
}

export async function listSongkhlaHandling(input: {
  year: number;
  month: number;
}): Promise<SongkhlaHandlingRow[]> {
  await requireRead();
  const { start, end } = getMonthDateRange(input.year, input.month);
  const [rows, rates] = await Promise.all([
    prisma.songkhlaCrateHandlingDaily.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
    }),
    resolveThaiCostRatesForMonth(input.year, input.month),
  ]);
  // Songkhla: no holiday/OT rates — always weekday.
  return rows.map((row) => {
    const c = computeSadaoHandlingCommission(
      {
        smallCrateTotalQty: row.smallCrateTotalQty,
        largeCrateTotalQty: row.largeCrateTotalQty,
        boxTotalQty: row.boxTotalQty,
        smallCrateNoCheckQty: 0,
        largeCrateNoCheckQty: 0,
        boxNoCheckQty: 0,
      },
      { holidayRate: false, rateConfig: rates }
    );
    return {
      id: row.id,
      date: toDateInputValue(row.date),
      smallCrateTotalQty: row.smallCrateTotalQty,
      largeCrateTotalQty: row.largeCrateTotalQty,
      boxTotalQty: row.boxTotalQty,
      smallCommissionThb: c.smallCommissionThb,
      largeCommissionThb: c.largeCommissionThb,
      boxCommissionThb: c.boxCommissionThb,
      commissionThb: c.totalCommissionThb,
      notes: row.notes,
    };
  });
}

export async function saveSongkhlaHandling(input: {
  id?: string;
  date: string;
  smallCrateTotalQty: number;
  largeCrateTotalQty: number;
  boxTotalQty: number;
  notes?: string | null;
}) {
  const user = await requireWrite();
  const date = parseDateInput(input.date);
  try {
    computeSadaoHandlingCommission(
      {
        ...input,
        smallCrateNoCheckQty: 0,
        largeCrateNoCheckQty: 0,
        boxNoCheckQty: 0,
      },
      { holidayRate: false }
    );
  } catch (e) {
    if (e instanceof SadaoHandlingValidationError) throw e;
    throw e;
  }

  const notes = input.notes?.trim() || null;
  const data = {
    date,
    smallCrateTotalQty: input.smallCrateTotalQty,
    largeCrateTotalQty: input.largeCrateTotalQty,
    boxTotalQty: input.boxTotalQty,
    notes,
    createdBy: user.id,
  };

  if (input.id) {
    await prisma.songkhlaCrateHandlingDaily.update({
      where: { id: input.id },
      data: {
        date: data.date,
        smallCrateTotalQty: data.smallCrateTotalQty,
        largeCrateTotalQty: data.largeCrateTotalQty,
        boxTotalQty: data.boxTotalQty,
        notes: data.notes,
      },
    });
  } else {
    await prisma.songkhlaCrateHandlingDaily.upsert({
      where: { date },
      create: data,
      update: {
        smallCrateTotalQty: data.smallCrateTotalQty,
        largeCrateTotalQty: data.largeCrateTotalQty,
        boxTotalQty: data.boxTotalQty,
        notes: data.notes,
      },
    });
  }
  revalidateThaiCost();
}

export async function deleteSongkhlaHandling(id: string) {
  await requireWrite();
  await prisma.songkhlaCrateHandlingDaily.delete({ where: { id } });
  revalidateThaiCost();
}

// ─── Drivers & trips ─────────────────────────────────────────────────────────

export interface ThaiDriverRow {
  id: string;
  name: string;
  baseWage: number;
  active: boolean;
}

export async function listThaiDrivers(): Promise<ThaiDriverRow[]> {
  await requireRead();
  const rows = await prisma.thaiDriver.findMany({ orderBy: { name: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    baseWage: decimalToNumber(r.baseWage) ?? 0,
    active: r.active,
  }));
}

export async function saveThaiDriver(input: {
  id?: string;
  name: string;
  baseWage: number;
  active?: boolean;
}) {
  await requireWrite();
  const name = input.name.trim();
  if (!name) throw new Error("姓名不能为空");
  if (!Number.isFinite(input.baseWage) || input.baseWage < 0) {
    throw new Error("底薪无效");
  }
  if (input.id) {
    await prisma.thaiDriver.update({
      where: { id: input.id },
      data: { name, baseWage: input.baseWage, active: input.active ?? true },
    });
  } else {
    await prisma.thaiDriver.create({
      data: {
        name,
        baseWage: input.baseWage,
        active: input.active ?? true,
      },
    });
  }
  revalidateThaiCost();
}

export interface ThaiDriverTripRow {
  id: string;
  date: string;
  driverId: string;
  driverName: string;
  songkhlaTripCount: number;
  pattaniTripCount: number;
  commissionThb: number;
  notes: string | null;
}

export async function listThaiDriverTrips(input: {
  year: number;
  month: number;
}): Promise<ThaiDriverTripRow[]> {
  await requireRead();
  const { start, end } = getMonthDateRange(input.year, input.month);
  const [rows, rates] = await Promise.all([
    prisma.thaiDriverTripDaily.findMany({
      where: { date: { gte: start, lte: end } },
      include: { driver: { select: { name: true } } },
      orderBy: [{ date: "asc" }, { driver: { name: "asc" } }],
    }),
    resolveThaiCostRatesForMonth(input.year, input.month),
  ]);
  return rows.map((r) => ({
    id: r.id,
    date: toDateInputValue(r.date),
    driverId: r.driverId,
    driverName: r.driver.name,
    songkhlaTripCount: r.songkhlaTripCount,
    pattaniTripCount: r.pattaniTripCount,
    commissionThb:
      r.songkhlaTripCount * rates.driverTripSongkhla +
      r.pattaniTripCount * rates.driverTripPattani,
    notes: r.notes,
  }));
}

export async function saveThaiDriverTrip(input: {
  id?: string;
  date: string;
  driverId: string;
  songkhlaTripCount: number;
  pattaniTripCount: number;
  notes?: string | null;
}) {
  const user = await requireWrite();
  if (
    !Number.isInteger(input.songkhlaTripCount) ||
    input.songkhlaTripCount < 0 ||
    !Number.isInteger(input.pattaniTripCount) ||
    input.pattaniTripCount < 0
  ) {
    throw new Error("趟次必须是非负整数");
  }
  const date = parseDateInput(input.date);
  const notes = input.notes?.trim() || null;
  if (input.id) {
    await prisma.thaiDriverTripDaily.update({
      where: { id: input.id },
      data: {
        date,
        driverId: input.driverId,
        songkhlaTripCount: input.songkhlaTripCount,
        pattaniTripCount: input.pattaniTripCount,
        notes,
      },
    });
  } else {
    await prisma.thaiDriverTripDaily.upsert({
      where: {
        date_driverId: { date, driverId: input.driverId },
      },
      create: {
        id: randomUUID(),
        date,
        driverId: input.driverId,
        songkhlaTripCount: input.songkhlaTripCount,
        pattaniTripCount: input.pattaniTripCount,
        notes,
        createdBy: user.id,
      },
      update: {
        songkhlaTripCount: input.songkhlaTripCount,
        pattaniTripCount: input.pattaniTripCount,
        notes,
      },
    });
  }
  revalidateThaiCost();
}

export async function deleteThaiDriverTrip(id: string) {
  await requireWrite();
  await prisma.thaiDriverTripDaily.delete({ where: { id } });
  revalidateThaiCost();
}

// ─── Songkhla P&L ────────────────────────────────────────────────────────────

export async function getSongkhlaPnlSummary(
  year: number,
  month: number
): Promise<SongkhlaPnlDetail> {
  await requireRead();
  return getSongkhlaPnl(year, month);
}

export async function seedThaiDriversPhase2() {
  await requireWrite();
  const seeds = [
    { name: "THONGDANG", baseWage: 8000 },
    { name: "P.NARONG", baseWage: 8000 },
    { name: "P.PHONG", baseWage: 7000 },
    { name: "P.CHAIRAT", baseWage: 6000 },
  ];
  for (const s of seeds) {
    await prisma.thaiDriver.upsert({
      where: { name: s.name },
      create: s,
      update: { baseWage: s.baseWage, active: true },
    });
  }
  revalidateThaiCost();
  return listThaiDrivers();
}

// ─── Pattani handling & P&L ──────────────────────────────────────────────────

export interface PattaniHandlingRow {
  id: string;
  date: string;
  crateQty: number;
  boxQty: number;
  contractorThb: number;
  sakriCommissionThb: number;
  dayTotalThb: number;
  notes: string | null;
}

export async function listPattaniHandling(input: {
  year: number;
  month: number;
}): Promise<PattaniHandlingRow[]> {
  await requireRead();
  const { start, end } = getMonthDateRange(input.year, input.month);
  const [rows, rates] = await Promise.all([
    prisma.pattaniCrateHandlingDaily.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
    }),
    resolveThaiCostRatesForMonth(input.year, input.month),
  ]);
  return rows.map((row) => {
    const day = computePattaniDayCosts(row.crateQty, row.boxQty, rates);
    return {
      id: row.id,
      date: toDateInputValue(row.date),
      crateQty: row.crateQty,
      boxQty: row.boxQty,
      contractorThb: day.contractorThb,
      sakriCommissionThb: day.sakriCommissionThb,
      dayTotalThb: day.dayTotalThb,
      notes: row.notes,
    };
  });
}

export async function savePattaniHandling(input: {
  id?: string;
  date: string;
  crateQty: number;
  boxQty: number;
  notes?: string | null;
}) {
  const user = await requireWrite();
  if (
    !Number.isInteger(input.crateQty) ||
    input.crateQty < 0 ||
    !Number.isInteger(input.boxQty) ||
    input.boxQty < 0
  ) {
    throw new Error("桶数/盒子必须是非负整数");
  }
  const date = parseDateInput(input.date);
  const notes = input.notes?.trim() || null;
  const data = {
    date,
    crateQty: input.crateQty,
    boxQty: input.boxQty,
    notes,
    createdBy: user.id,
  };
  if (input.id) {
    await prisma.pattaniCrateHandlingDaily.update({
      where: { id: input.id },
      data: {
        date: data.date,
        crateQty: data.crateQty,
        boxQty: data.boxQty,
        notes: data.notes,
      },
    });
  } else {
    await prisma.pattaniCrateHandlingDaily.upsert({
      where: { date },
      create: data,
      update: {
        crateQty: data.crateQty,
        boxQty: data.boxQty,
        notes: data.notes,
      },
    });
  }
  revalidateThaiCost();
}

export async function deletePattaniHandling(id: string) {
  await requireWrite();
  await prisma.pattaniCrateHandlingDaily.delete({ where: { id } });
  revalidateThaiCost();
}

export async function getPattaniPnlSummary(
  year: number,
  month: number
): Promise<PattaniPnlDetail> {
  await requireRead();
  return getPattaniPnl(year, month);
}

/**
 * Insert SAKRI (PATTANI) only when no row exists.
 * Never updates an existing record (manual edits on 月薪工人 page are preserved).
 */
// ─── Rented vehicles ─────────────────────────────────────────────────────────

export interface ThaiRentedVehicleTripRow {
  id: string;
  date: string;
  station: "SONGKHLA" | "PATTANI";
  driverName: string;
  truckPlate: string | null;
  tripCost: number;
  notes: string | null;
}

export async function listThaiRentedVehicleTrips(input: {
  year: number;
  month: number;
  station?: "SONGKHLA" | "PATTANI";
}): Promise<ThaiRentedVehicleTripRow[]> {
  await requireRead();
  const { start, end } = getMonthDateRange(input.year, input.month);
  const rows = await prisma.thaiRentedVehicleTrip.findMany({
    where: {
      date: { gte: start, lte: end },
      ...(input.station ? { station: input.station } : {}),
    },
    orderBy: [{ date: "asc" }, { driverName: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    date: toDateInputValue(r.date),
    station: r.station as "SONGKHLA" | "PATTANI",
    driverName: r.driverName,
    truckPlate: r.truckPlate,
    tripCost: decimalToNumber(r.tripCost) ?? 0,
    notes: r.notes,
  }));
}

export async function saveThaiRentedVehicleTrip(input: {
  id?: string;
  date: string;
  station: "SONGKHLA" | "PATTANI";
  driverName: string;
  truckPlate?: string | null;
  tripCost: number;
  notes?: string | null;
}) {
  const user = await requireWrite();
  const driverName = input.driverName.trim();
  if (!driverName) throw new Error("司机名不能为空");
  if (!Number.isFinite(input.tripCost) || input.tripCost < 0) {
    throw new Error("租车费用必须是非负数");
  }
  if (input.station !== "SONGKHLA" && input.station !== "PATTANI") {
    throw new Error("据点必须是宋卡或北大年");
  }
  const date = parseDateInput(input.date);
  const notes = input.notes?.trim() || null;
  const truckPlate = input.truckPlate?.trim() || null;
  const data = {
    date,
    station: input.station,
    driverName,
    truckPlate,
    tripCost: input.tripCost,
    notes,
    createdBy: user.id,
  };
  if (input.id) {
    await prisma.thaiRentedVehicleTrip.update({
      where: { id: input.id },
      data: {
        date: data.date,
        station: data.station,
        driverName: data.driverName,
        truckPlate: data.truckPlate,
        tripCost: data.tripCost,
        notes: data.notes,
      },
    });
  } else {
    await prisma.thaiRentedVehicleTrip.create({ data });
  }
  revalidateThaiCost();
}

export async function deleteThaiRentedVehicleTrip(id: string) {
  await requireWrite();
  await prisma.thaiRentedVehicleTrip.delete({ where: { id } });
  revalidateThaiCost();
}

export async function seedPattaniSakriWorker(): Promise<{
  inserted: boolean;
}> {
  await requireWrite();
  const existing = await prisma.thaiMonthlyWorker.findFirst({
    where: { name: "SAKRI", station: "PATTANI" },
  });
  if (existing) {
    return { inserted: false };
  }
  await prisma.thaiMonthlyWorker.create({
    data: {
      name: "SAKRI",
      station: "PATTANI",
      monthlyWage: 15000,
      lunchAllowance: 0,
      fuelAllowance: 0,
      rentRoomAllowance: 0,
      active: true,
    },
  });
  revalidateThaiCost();
  return { inserted: true };
}

export { yearMonthKey };
