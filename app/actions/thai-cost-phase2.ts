"use server";

import { getCurrentUser } from "@/lib/auth";
import { canAccessThaiCost, canWriteThaiCost } from "@/lib/auth-roles";
import { yearMonthKey } from "@/lib/constants/thai-cost";
import { parseDateInput, toDateInputValue } from "@/lib/date-utils";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { computeSongkhlaHandlingCommission } from "@/lib/thai-cost/songkhla-handling-cost";
import { computePattaniHandlingCosts } from "@/lib/thai-cost/pattani-handling-cost";
import {
  fetchLiveStationDispatchTotals,
  resolvePattaniEffectiveQty,
  resolveSongkhlaEffectiveQty,
} from "@/lib/thai-cost/station-handling-qty";
import {
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
import { compareManualVsDispatchCrates } from "@/lib/thai-cost/dispatch-cross-check";
import {
  isThaiRouteMasterCode,
  THAI_ROUTE_MASTER_CODES,
} from "@/lib/constants/thai-route-masters";

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

// ─── Thai route masters (SONGKHLA / PATTANI) ─────────────────────────────────

export interface ThaiRouteMasterRow {
  id: string;
  code: string;
  name: string;
  sadooMileageKm: number | null;
  tollFee: number | null;
  parkingFee: number | null;
}

export async function getThaiRouteMasters(): Promise<ThaiRouteMasterRow[]> {
  await requireRead();
  const rows = await prisma.routeMaster.findMany({
    where: { code: { in: [...THAI_ROUTE_MASTER_CODES] } },
    orderBy: { code: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    sadooMileageKm: decimalToNumber(r.sadooMileageKm),
    tollFee: decimalToNumber(r.tollFee),
    parkingFee: decimalToNumber(r.parkingFee),
  }));
}

export async function saveThaiRouteMaster(input: {
  id: string;
  sadooMileageKm?: number | null;
  tollFee?: number | null;
  parkingFee?: number | null;
}) {
  await requireWrite();
  const existing = await prisma.routeMaster.findUnique({
    where: { id: input.id },
  });
  if (!existing || !isThaiRouteMasterCode(existing.code)) {
    throw new Error("只能编辑泰国路线 SONGKHLA / PATTANI");
  }

  function parseFee(value: number | null | undefined) {
    if (value == null) return null;
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("数值不能为负数");
    }
    return value;
  }

  await prisma.routeMaster.update({
    where: { id: input.id },
    data: {
      sadooMileageKm: parseFee(input.sadooMileageKm),
      tollFee: parseFee(input.tollFee),
      parkingFee: parseFee(input.parkingFee),
    },
  });
  revalidateThaiCost();
}

/** Live dispatch totals for Songkhla/Pattani handling forms. */
export async function getStationDispatchTotalsForDate(
  dateInput: string,
  pickup: "SONGKHLA" | "PATTANI"
): Promise<{
  smallCrateTotalQty: number;
  largeCrateTotalQty: number;
  boxTotalQty: number;
  crateQty: number;
}> {
  await requireRead();
  const date = parseDateInput(dateInput);
  const rates = await resolveThaiCostRatesForMonth(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1
  );
  const totals = await fetchLiveStationDispatchTotals(
    date,
    pickup,
    rates.largeTongTypeCodes
  );
  return {
    smallCrateTotalQty: totals.small,
    largeCrateTotalQty: totals.large,
    boxTotalQty: totals.box,
    crateQty: totals.small + totals.large,
  };
}

// ─── Songkhla handling ───────────────────────────────────────────────────────

export interface SongkhlaHandlingRow {
  id: string;
  date: string;
  /** Effective totals shown/billed (live dispatch or locked manual). */
  smallCrateTotalQty: number;
  largeCrateTotalQty: number;
  boxTotalQty: number;
  manualQty: boolean;
  crateBillableQty: number;
  boxBillableQty: number;
  crateCommissionThb: number;
  boxCommissionThb: number;
  commissionThb: number;
  notes: string | null;
}

export async function getSongkhlaHandlingForDate(
  dateInput: string
): Promise<SongkhlaHandlingRow | null> {
  await requireRead();
  const date = parseDateInput(dateInput);
  const row = await prisma.songkhlaCrateHandlingDaily.findUnique({
    where: { date },
  });
  if (!row) return null;
  const rates = await resolveThaiCostRatesForMonth(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1
  );
  const qty = await resolveSongkhlaEffectiveQty(row, rates);
  const c = computeSongkhlaHandlingCommission(qty, { rateConfig: rates });
  return {
    id: row.id,
    date: toDateInputValue(row.date),
    smallCrateTotalQty: qty.smallCrateTotalQty,
    largeCrateTotalQty: qty.largeCrateTotalQty,
    boxTotalQty: qty.boxTotalQty,
    manualQty: row.manualQty,
    crateBillableQty: c.crateBillableQty,
    boxBillableQty: c.boxBillableQty,
    crateCommissionThb: c.crateCommissionThb,
    boxCommissionThb: c.boxCommissionThb,
    commissionThb: c.totalCommissionThb,
    notes: row.notes,
  };
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
  return Promise.all(
    rows.map(async (row) => {
      const qty = await resolveSongkhlaEffectiveQty(row, rates);
      const c = computeSongkhlaHandlingCommission(qty, { rateConfig: rates });
      return {
        id: row.id,
        date: toDateInputValue(row.date),
        smallCrateTotalQty: qty.smallCrateTotalQty,
        largeCrateTotalQty: qty.largeCrateTotalQty,
        boxTotalQty: qty.boxTotalQty,
        manualQty: row.manualQty,
        crateBillableQty: c.crateBillableQty,
        boxBillableQty: c.boxBillableQty,
        crateCommissionThb: c.crateCommissionThb,
        boxCommissionThb: c.boxCommissionThb,
        commissionThb: c.totalCommissionThb,
        notes: row.notes,
      };
    })
  );
}

/**
 * Save Songkhla handling day.
 * - manualQty=false (restore auto / first register): store live dispatch, unlocked
 * - manualQty=true: store provided totals as locked billable qty
 */
export async function saveSongkhlaHandling(input: {
  id?: string;
  date: string;
  manualQty: boolean;
  smallCrateTotalQty?: number;
  largeCrateTotalQty?: number;
  boxTotalQty?: number;
  notes?: string | null;
}) {
  const user = await requireWrite();
  const date = parseDateInput(input.date);
  const rates = await resolveThaiCostRatesForMonth(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1
  );

  let small: number;
  let large: number;
  let box: number;
  if (input.manualQty) {
    small = Math.max(0, Math.floor(Number(input.smallCrateTotalQty) || 0));
    large = Math.max(0, Math.floor(Number(input.largeCrateTotalQty) || 0));
    box = Math.max(0, Math.floor(Number(input.boxTotalQty) || 0));
  } else {
    const live = await fetchLiveStationDispatchTotals(
      date,
      "SONGKHLA",
      rates.largeTongTypeCodes
    );
    small = live.small;
    large = live.large;
    box = live.box;
  }

  computeSongkhlaHandlingCommission(
    {
      smallCrateTotalQty: small,
      largeCrateTotalQty: large,
      boxTotalQty: box,
    },
    { rateConfig: rates }
  );

  const notes = input.notes?.trim() || null;
  const data = {
    date,
    smallCrateTotalQty: small,
    largeCrateTotalQty: large,
    boxTotalQty: box,
    manualQty: input.manualQty,
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
        manualQty: data.manualQty,
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
        manualQty: data.manualQty,
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

// ─── Vehicle trip daily (plate-level + driver aggregate sync) ───────────────

export interface ThaiVehicleTripRow {
  id: string;
  date: string;
  truckPlate: string;
  driverId: string | null;
  driverName: string | null;
  rentedDriverName: string | null;
  station: "SONGKHLA" | "PATTANI";
  tongQty: number;
  boxQty: number;
  notes: string | null;
}

function parseRentedFromNotes(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/^RENTED:([^;]+)/);
  return m ? m[1].trim() : null;
}

export async function listThaiVehicleTripsForDate(input: {
  date: string;
  station: "SONGKHLA" | "PATTANI";
}): Promise<ThaiVehicleTripRow[]> {
  await requireRead();
  const date = parseDateInput(input.date);
  const rows = await prisma.thaiVehicleTripDaily.findMany({
    where: { date, station: input.station },
    include: { driver: { select: { name: true } } },
    orderBy: [{ truckPlate: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    date: toDateInputValue(r.date),
    truckPlate: r.truckPlate,
    driverId: r.driverId,
    driverName: r.driver?.name ?? null,
    rentedDriverName: parseRentedFromNotes(r.notes),
    station: r.station as "SONGKHLA" | "PATTANI",
    tongQty: r.tongQty,
    boxQty: r.boxQty,
    notes: r.notes,
  }));
}

export async function listThaiVehicleTrips(input: {
  year: number;
  month: number;
  station?: "SONGKHLA" | "PATTANI";
}): Promise<ThaiVehicleTripRow[]> {
  await requireRead();
  const { start, end } = getMonthDateRange(input.year, input.month);
  const rows = await prisma.thaiVehicleTripDaily.findMany({
    where: {
      date: { gte: start, lte: end },
      ...(input.station ? { station: input.station } : {}),
    },
    include: { driver: { select: { name: true } } },
    orderBy: [{ date: "asc" }, { station: "asc" }, { truckPlate: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    date: toDateInputValue(r.date),
    truckPlate: r.truckPlate,
    driverId: r.driverId,
    driverName: r.driver?.name ?? null,
    rentedDriverName: parseRentedFromNotes(r.notes),
    station: r.station as "SONGKHLA" | "PATTANI",
    tongQty: r.tongQty,
    boxQty: r.boxQty,
    notes: r.notes,
  }));
}

import { ensureThaiOtherDriver } from "@/lib/thai-cost/thai-driver-other";

/** Upsert one vehicle trip row and sync thai_driver_trip_daily for formal drivers. */
export async function saveThaiVehicleTripDaily(input: {
  id?: string;
  date: string;
  truckPlate: string;
  station: "SONGKHLA" | "PATTANI";
  tongQty: number;
  boxQty: number;
  /**
   * formal = company driver id;
   * other = sentinel thai_drivers「其他」(baseWage 0), NOT null+notes;
   * rental = driverId null + notes RENTED:name.
   */
  driverMode?: "formal" | "other" | "rental";
  /** Formal driver id; omit when rental / other. */
  driverId?: string | null;
  /** Rental driver name (free text); stored as RENTED:name in notes. */
  rentalDriverName?: string | null;
  notes?: string | null;
}) {
  const user = await requireWrite();
  const plate = input.truckPlate.trim();
  if (!plate) throw new Error("车牌不能为空");
  if (input.station !== "SONGKHLA" && input.station !== "PATTANI") {
    throw new Error("据点必须是宋卡或北大年");
  }
  if (
    !Number.isInteger(input.tongQty) ||
    input.tongQty < 0 ||
    !Number.isInteger(input.boxQty) ||
    input.boxQty < 0
  ) {
    throw new Error("桶数/盒数必须是非负整数");
  }
  if (input.tongQty === 0 && input.boxQty === 0) {
    throw new Error("桶数与盒数不能同时为 0");
  }

  const mode =
    input.driverMode ??
    (input.rentalDriverName?.trim() ? "rental" : "formal");
  const rentalName =
    mode === "rental" ? input.rentalDriverName?.trim() || null : null;

  let driverId: string | null = null;
  if (mode === "rental") {
    if (!rentalName) throw new Error("请填写租车司机姓名");
    driverId = null;
  } else if (mode === "other") {
    driverId = await ensureThaiOtherDriver();
  } else {
    driverId = input.driverId ?? null;
    if (!driverId) throw new Error("请选择司机");
  }

  const date = parseDateInput(input.date);
  const extraNotes = input.notes?.trim() || null;
  // Rented ONLY uses RENTED: prefix. "其他" uses real driverId — never null+notes marker.
  const notes = rentalName
    ? `RENTED:${rentalName}${extraNotes ? `;${extraNotes}` : ""}`
    : extraNotes;

  const data = {
    date,
    truckPlate: plate,
    driverId,
    station: input.station,
    tongQty: input.tongQty,
    boxQty: input.boxQty,
    notes,
    createdBy: user.id,
  };

  if (input.id) {
    await prisma.thaiVehicleTripDaily.update({
      where: { id: input.id },
      data: {
        date: data.date,
        truckPlate: data.truckPlate,
        driverId: data.driverId,
        station: data.station,
        tongQty: data.tongQty,
        boxQty: data.boxQty,
        notes: data.notes,
      },
    });
  } else {
    await prisma.thaiVehicleTripDaily.create({
      data: { id: randomUUID(), ...data },
    });
  }

  if (driverId) {
    await syncDriverTripAggregateForDate(date, driverId, user.id);
  }

  revalidateThaiCost();
}

async function syncDriverTripAggregateForDate(
  date: Date,
  driverId: string,
  createdBy: string
) {
  const vehicleRows = await prisma.thaiVehicleTripDaily.findMany({
    where: { date, driverId },
  });
  let songkhla = 0;
  let pattani = 0;
  for (const v of vehicleRows) {
    if (v.station === "SONGKHLA") songkhla += 1;
    else if (v.station === "PATTANI") pattani += 1;
  }

  if (songkhla === 0 && pattani === 0) {
    await prisma.thaiDriverTripDaily.deleteMany({
      where: { date, driverId },
    });
    return;
  }

  await prisma.thaiDriverTripDaily.upsert({
    where: { date_driverId: { date, driverId } },
    create: {
      id: randomUUID(),
      date,
      driverId,
      songkhlaTripCount: songkhla,
      pattaniTripCount: pattani,
      createdBy,
    },
    update: {
      songkhlaTripCount: songkhla,
      pattaniTripCount: pattani,
    },
  });
}

export async function deleteThaiVehicleTripDaily(id: string) {
  await requireWrite();
  const row = await prisma.thaiVehicleTripDaily.findUnique({
    where: { id },
    select: { date: true, driverId: true, createdBy: true },
  });
  if (!row) return;
  await prisma.thaiVehicleTripDaily.delete({ where: { id } });
  if (row.driverId) {
    await syncDriverTripAggregateForDate(
      row.date,
      row.driverId,
      row.createdBy
    );
  }
  revalidateThaiCost();
}

export async function getDispatchCrossCheck(input: {
  year: number;
  month: number;
  station: "SONGKHLA" | "PATTANI";
}) {
  await requireRead();
  const rates = await resolveThaiCostRatesForMonth(input.year, input.month);
  return compareManualVsDispatchCrates({
    year: input.year,
    month: input.month,
    station: input.station,
    largeTongTypeCodes: rates.largeTongTypeCodes,
  });
}

export async function getVehicleTripPlForMonth(input: {
  year: number;
  month: number;
  station?: "SONGKHLA" | "PATTANI";
}) {
  await requireRead();
  const { loadVehiclePlContext, computeVehicleTripPl } = await import(
    "@/lib/thai-cost/vehicle-pl"
  );
  const { start, end } = getMonthDateRange(input.year, input.month);
  const [rows, ctx] = await Promise.all([
    prisma.thaiVehicleTripDaily.findMany({
      where: {
        date: { gte: start, lte: end },
        ...(input.station ? { station: input.station } : {}),
      },
      include: { driver: { select: { name: true } } },
      orderBy: [{ date: "asc" }, { truckPlate: "asc" }],
    }),
    loadVehiclePlContext(input.year, input.month),
  ]);

  return rows.map((v) => {
    const rented = parseRentedFromNotes(v.notes);
    return computeVehicleTripPl(
      {
        id: v.id,
        date: toDateInputValue(v.date),
        truckPlate: v.truckPlate,
        driverName:
          v.driver?.name ?? (rented ? `RENTED:${rented}` : null),
        station: v.station as "SONGKHLA" | "PATTANI",
        tongQty: v.tongQty,
        boxQty: v.boxQty,
        notes: v.notes,
      },
      ctx
    );
  });
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
  manualQty: boolean;
  crateBillableQty: number;
  boxBillableQty: number;
  contractorThb: number;
  sakriCommissionThb: number;
  dayTotalThb: number;
  notes: string | null;
}

export async function getPattaniHandlingForDate(
  dateInput: string
): Promise<PattaniHandlingRow | null> {
  await requireRead();
  const date = parseDateInput(dateInput);
  const row = await prisma.pattaniCrateHandlingDaily.findUnique({
    where: { date },
  });
  if (!row) return null;
  const rates = await resolveThaiCostRatesForMonth(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1
  );
  const qty = await resolvePattaniEffectiveQty(row, rates);
  const day = computePattaniHandlingCosts(qty, rates);
  return {
    id: row.id,
    date: toDateInputValue(row.date),
    crateQty: qty.crateQty,
    boxQty: qty.boxQty,
    manualQty: row.manualQty,
    crateBillableQty: day.crateBillableQty,
    boxBillableQty: day.boxBillableQty,
    contractorThb: day.contractorThb,
    sakriCommissionThb: day.sakriCommissionThb,
    dayTotalThb: day.dayTotalThb,
    notes: row.notes,
  };
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
  return Promise.all(
    rows.map(async (row) => {
      const qty = await resolvePattaniEffectiveQty(row, rates);
      const day = computePattaniHandlingCosts(qty, rates);
      return {
        id: row.id,
        date: toDateInputValue(row.date),
        crateQty: qty.crateQty,
        boxQty: qty.boxQty,
        manualQty: row.manualQty,
        crateBillableQty: day.crateBillableQty,
        boxBillableQty: day.boxBillableQty,
        contractorThb: day.contractorThb,
        sakriCommissionThb: day.sakriCommissionThb,
        dayTotalThb: day.dayTotalThb,
        notes: row.notes,
      };
    })
  );
}

export async function savePattaniHandling(input: {
  id?: string;
  date: string;
  manualQty: boolean;
  crateQty?: number;
  boxQty?: number;
  notes?: string | null;
}) {
  const user = await requireWrite();
  const date = parseDateInput(input.date);
  const rates = await resolveThaiCostRatesForMonth(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1
  );

  let crateQty: number;
  let boxQty: number;
  if (input.manualQty) {
    crateQty = Math.max(0, Math.floor(Number(input.crateQty) || 0));
    boxQty = Math.max(0, Math.floor(Number(input.boxQty) || 0));
  } else {
    const live = await fetchLiveStationDispatchTotals(
      date,
      "PATTANI",
      rates.largeTongTypeCodes
    );
    crateQty = live.small + live.large;
    boxQty = live.box;
  }

  computePattaniHandlingCosts({ crateQty, boxQty }, rates);

  const notes = input.notes?.trim() || null;
  const data = {
    date,
    crateQty,
    boxQty,
    manualQty: input.manualQty,
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
        manualQty: data.manualQty,
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
        manualQty: data.manualQty,
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

export async function getPattaniContractorMonthly(input: {
  year: number;
  month: number;
}) {
  await requireRead();
  const rows = await listPattaniHandling(input);
  const rates = await resolveThaiCostRatesForMonth(input.year, input.month);
  const { computePattaniContractorMonthlySummary } = await import(
    "@/lib/thai-cost/pattani-contractor-monthly"
  );
  return computePattaniContractorMonthlySummary({
    year: input.year,
    month: input.month,
    crateRate: rates.pattaniContractorCrate,
    boxRate: rates.pattaniContractorBox,
    days: rows.map((r) => ({
      date: r.date,
      crateQty: r.crateQty,
      boxQty: r.boxQty,
    })),
  });
}

export { yearMonthKey };
