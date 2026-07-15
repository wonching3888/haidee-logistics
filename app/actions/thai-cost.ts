"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  DEFAULT_LUNCH_ALLOWANCE_THB,
  DEFAULT_SADAO_DAILY_WAGE_THB,
  isThaiCostStation,
  yearMonthKey,
  type ThaiCostStation,
} from "@/lib/constants/thai-cost";
import { parseDateInput, toDateInputValue } from "@/lib/date-utils";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";
import { canAccessThaiCost, canWriteThaiCost } from "@/lib/auth-roles";
import {
  buildPublicHolidayKeySet,
  buildPublicHolidayNameMap,
  getHolidayRateInfo,
  isHolidayRate,
  type HolidayRateInfo,
} from "@/lib/thai-cost/holiday";
import {
  computeDailyLaborDayCost,
  computeSadaoHandlingCommission,
  SadaoHandlingValidationError,
} from "@/lib/thai-cost/sadao-cost";
import {
  getSadaoMonthlyCost,
  type SadaoMonthlyCostDetail,
} from "@/lib/thai-cost/sadao-cost-service";
import {
  resolveThaiCostRatesForMonth,
  type ThaiCostRates,
} from "@/lib/thai-cost/rate-settings";
import {
  computeSadaoHandlingDayTotalThb,
  normalizeSadaoHandlingOtherExpenses,
  SadaoHandlingExpenseValidationError,
  sumSadaoHandlingOtherExpensesThb,
  type SadaoHandlingOtherExpenseInput,
  type SadaoHandlingOtherExpenseRow,
} from "@/lib/thai-cost/sadao-handling-expenses";
import { aggregateSadaoDispatchTotalsForDate } from "@/lib/thai-cost/dispatch-crate-aggregate";
import { getSadaoVoucherForDate } from "@/lib/thai-cost/sadao-voucher";
import { getDailyOverview } from "@/lib/thai-cost/daily-overview";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { randomUUID } from "crypto";

export async function revalidateThaiCost() {
  if (process.env.BACKFILL_SKIP_REVALIDATE === "1") return;
  revalidatePath("/thai-cost/workers");
  revalidatePath("/thai-cost/attendance");
  revalidatePath("/thai-cost/sadao-handling");
  revalidatePath("/thai-cost/sadao-summary");
  revalidatePath("/thai-cost/holidays");
  revalidatePath("/thai-cost/settings");
  revalidatePath("/thai-cost/songkhla-handling");
  revalidatePath("/thai-cost/songkhla-summary");
  revalidatePath("/thai-cost/driver-trips");
  revalidatePath("/thai-cost/pattani-handling");
  revalidatePath("/thai-cost/pattani-summary");
  revalidatePath("/thai-cost/rented-vehicles");
  revalidatePath("/thai-cost/data-entry");
  revalidatePath("/thai-cost/monthly-summary");
  revalidatePath("/thai-cost/daily-overview");
  revalidatePath("/thai-cost/sadao-voucher");
  revalidatePath("/thai-cost/handling");
  revalidatePath("/thai-cost/pattani-contractor-monthly");
}

async function requireThaiCostRead() {
  const user = await getCurrentUser();
  if (!user || !canAccessThaiCost(user.role)) {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

async function requireThaiCostWrite() {
  const user = await getCurrentUser();
  if (!user || !canWriteThaiCost(user.role)) {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

function assertNonNegMoney(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label}必须是非负数 must be non-negative`);
  }
}

// ─── Monthly workers ─────────────────────────────────────────────────────────

export interface ThaiMonthlyWorkerRow {
  id: string;
  name: string;
  station: ThaiCostStation;
  monthlyWage: number;
  lunchAllowance: number;
  fuelAllowance: number;
  rentRoomAllowance: number;
  active: boolean;
}

function toWorkerRow(r: {
  id: string;
  name: string;
  station: string;
  monthlyWage: unknown;
  lunchAllowance: unknown;
  fuelAllowance: unknown;
  rentRoomAllowance: unknown;
  active: boolean;
}): ThaiMonthlyWorkerRow {
  return {
    id: r.id,
    name: r.name,
    station: r.station as ThaiCostStation,
    monthlyWage: decimalToNumber(r.monthlyWage) ?? 0,
    lunchAllowance: decimalToNumber(r.lunchAllowance) ?? 0,
    fuelAllowance: decimalToNumber(r.fuelAllowance) ?? 0,
    rentRoomAllowance: decimalToNumber(r.rentRoomAllowance) ?? 0,
    active: r.active,
  };
}

export async function listThaiMonthlyWorkers(options?: {
  station?: ThaiCostStation;
  includeInactive?: boolean;
}): Promise<ThaiMonthlyWorkerRow[]> {
  await requireThaiCostRead();
  const rows = await prisma.thaiMonthlyWorker.findMany({
    where: {
      ...(options?.station ? { station: options.station } : {}),
      ...(options?.includeInactive ? {} : { active: true }),
    },
    orderBy: [{ station: "asc" }, { name: "asc" }],
  });
  return rows.map(toWorkerRow);
}

export async function saveThaiMonthlyWorker(input: {
  id?: string;
  name: string;
  station: string;
  monthlyWage: number;
  lunchAllowance?: number;
  fuelAllowance?: number;
  rentRoomAllowance?: number;
  active?: boolean;
}): Promise<ThaiMonthlyWorkerRow> {
  await requireThaiCostWrite();
  const name = input.name.trim();
  if (!name) throw new Error("姓名不能为空 Name is required");
  if (!isThaiCostStation(input.station)) {
    throw new Error("无效驻点 Invalid station");
  }
  assertNonNegMoney(input.monthlyWage, "月薪");
  const lunchAllowance = input.lunchAllowance ?? DEFAULT_LUNCH_ALLOWANCE_THB;
  const fuelAllowance = input.fuelAllowance ?? 0;
  const rentRoomAllowance = input.rentRoomAllowance ?? 0;
  assertNonNegMoney(lunchAllowance, "LUNCH津贴");
  assertNonNegMoney(fuelAllowance, "FUEL津贴");
  assertNonNegMoney(rentRoomAllowance, "RENT ROOM津贴");

  const data = {
    name,
    station: input.station,
    monthlyWage: input.monthlyWage,
    lunchAllowance,
    fuelAllowance,
    rentRoomAllowance,
    active: input.active ?? true,
  };

  const row = input.id
    ? await prisma.thaiMonthlyWorker.update({ where: { id: input.id }, data })
    : await prisma.thaiMonthlyWorker.create({ data });

  revalidateThaiCost();
  return toWorkerRow(row);
}

export async function deleteThaiMonthlyWorker(id: string): Promise<void> {
  await requireThaiCostWrite();
  await prisma.thaiMonthlyWorker.delete({ where: { id } });
  revalidateThaiCost();
}

// ─── Daily labor monthly roster ──────────────────────────────────────────────

export interface ThaiDailyLaborRosterRow {
  yearMonth: string;
  station: ThaiCostStation;
  rosterCount: number;
  notes: string | null;
  lunchTotalThb: number;
}

export async function getThaiDailyLaborRoster(input: {
  year: number;
  month: number;
  station?: ThaiCostStation;
}): Promise<ThaiDailyLaborRosterRow | null> {
  await requireThaiCostRead();
  const station = input.station ?? "SADAO";
  const yearMonth = yearMonthKey(input.year, input.month);
  const row = await prisma.thaiDailyLaborMonthlyRoster.findUnique({
    where: { yearMonth_station: { yearMonth, station } },
  });
  if (!row) return null;
  return {
    yearMonth: row.yearMonth,
    station: row.station as ThaiCostStation,
    rosterCount: row.rosterCount,
    notes: row.notes,
    lunchTotalThb: row.rosterCount * DEFAULT_LUNCH_ALLOWANCE_THB,
  };
}

export async function saveThaiDailyLaborRoster(input: {
  year: number;
  month: number;
  station: string;
  rosterCount: number;
  notes?: string | null;
}): Promise<ThaiDailyLaborRosterRow> {
  await requireThaiCostWrite();
  if (!isThaiCostStation(input.station)) {
    throw new Error("无效驻点 Invalid station");
  }
  if (
    !Number.isFinite(input.rosterCount) ||
    !Number.isInteger(input.rosterCount) ||
    input.rosterCount < 0
  ) {
    throw new Error("在册人数必须是非负整数 Roster count must be a non-negative integer");
  }

  const yearMonth = yearMonthKey(input.year, input.month);
  const notes = input.notes?.trim() || null;
  const row = await prisma.thaiDailyLaborMonthlyRoster.upsert({
    where: {
      yearMonth_station: { yearMonth, station: input.station },
    },
    create: {
      id: randomUUID(),
      yearMonth,
      station: input.station,
      rosterCount: input.rosterCount,
      notes,
    },
    update: {
      rosterCount: input.rosterCount,
      notes,
    },
  });

  revalidateThaiCost();
  return {
    yearMonth: row.yearMonth,
    station: row.station as ThaiCostStation,
    rosterCount: row.rosterCount,
    notes: row.notes,
    lunchTotalThb: row.rosterCount * DEFAULT_LUNCH_ALLOWANCE_THB,
  };
}

// ─── Daily attendance ────────────────────────────────────────────────────────

export interface ThaiDailyAttendanceRow {
  id: string;
  date: string;
  station: ThaiCostStation;
  attendanceCount: number;
  dailyWage: number;
  /** When set, day cost uses this total (Songkhla); null = count × unit (Sadao). */
  totalWagePaid: number | null;
  dayCostThb: number;
  notes: string | null;
}

export async function listThaiDailyAttendance(input: {
  year: number;
  month: number;
  station?: ThaiCostStation;
}): Promise<ThaiDailyAttendanceRow[]> {
  await requireThaiCostRead();
  const { start, end } = getMonthDateRange(input.year, input.month);
  const rows = await prisma.thaiDailyLaborAttendance.findMany({
    where: {
      date: { gte: start, lte: end },
      ...(input.station ? { station: input.station } : {}),
    },
    orderBy: [{ date: "asc" }, { station: "asc" }],
  });
  return rows.map((r) => mapAttendanceRow(r));
}

function mapAttendanceRow(r: {
  id: string;
  date: Date;
  station: string;
  attendanceCount: number;
  dailyWage: unknown;
  totalWagePaid: unknown;
  notes: string | null;
}): ThaiDailyAttendanceRow {
  const dailyWage = decimalToNumber(r.dailyWage) ?? 0;
  const totalWagePaid = decimalToNumber(r.totalWagePaid);
  return {
    id: r.id,
    date: toDateInputValue(r.date),
    station: r.station as ThaiCostStation,
    attendanceCount: r.attendanceCount,
    dailyWage,
    totalWagePaid,
    dayCostThb: computeDailyLaborDayCost({
      attendanceCount: r.attendanceCount,
      dailyWage,
      totalWagePaid,
    }),
    notes: r.notes,
  };
}

export async function saveThaiDailyAttendance(input: {
  id?: string;
  date: string;
  station: string;
  attendanceCount: number;
  /** Unit rate mode (Sadao). Ignored when totalWagePaid is set. */
  dailyWage?: number | null;
  /** Total paid mode (Songkhla). When set, day cost = this amount. */
  totalWagePaid?: number | null;
  notes?: string | null;
}): Promise<ThaiDailyAttendanceRow> {
  const user = await requireThaiCostWrite();
  if (!isThaiCostStation(input.station)) {
    throw new Error("无效驻点 Invalid station");
  }
  if (
    !Number.isFinite(input.attendanceCount) ||
    !Number.isInteger(input.attendanceCount) ||
    input.attendanceCount < 0
  ) {
    throw new Error("出勤人数必须是非负整数 Attendance count must be a non-negative integer");
  }

  const hasTotal =
    input.totalWagePaid != null &&
    input.totalWagePaid !== undefined &&
    !(typeof input.totalWagePaid === "number" && Number.isNaN(input.totalWagePaid));

  let dailyWage = 0;
  let totalWagePaid: number | null = null;

  if (hasTotal) {
    if (!Number.isFinite(input.totalWagePaid!) || input.totalWagePaid! < 0) {
      throw new Error("实发工资总额必须是非负数 Total wage paid must be non-negative");
    }
    totalWagePaid = input.totalWagePaid!;
    dailyWage =
      input.dailyWage != null && Number.isFinite(input.dailyWage)
        ? input.dailyWage
        : 0;
  } else {
    if (
      input.dailyWage == null ||
      !Number.isFinite(input.dailyWage) ||
      input.dailyWage < 0
    ) {
      throw new Error("日薪必须是非负数 Daily wage must be non-negative");
    }
    dailyWage = input.dailyWage;
    totalWagePaid = null;
  }

  const date = parseDateInput(input.date);
  const notes = input.notes?.trim() || null;
  const data = {
    date,
    station: input.station,
    attendanceCount: input.attendanceCount,
    dailyWage,
    totalWagePaid,
    notes,
    createdBy: user.id,
  };

  let row;
  if (input.id) {
    row = await prisma.thaiDailyLaborAttendance.update({
      where: { id: input.id },
      data: {
        date: data.date,
        station: data.station,
        attendanceCount: data.attendanceCount,
        dailyWage: data.dailyWage,
        totalWagePaid: data.totalWagePaid,
        notes: data.notes,
      },
    });
  } else {
    row = await prisma.thaiDailyLaborAttendance.upsert({
      where: {
        date_station: { date, station: input.station },
      },
      create: data,
      update: {
        attendanceCount: data.attendanceCount,
        dailyWage: data.dailyWage,
        totalWagePaid: data.totalWagePaid,
        notes: data.notes,
      },
    });
  }

  await revalidateThaiCost();
  return mapAttendanceRow(row);
}

export async function deleteThaiDailyAttendance(id: string): Promise<void> {
  await requireThaiCostWrite();
  await prisma.thaiDailyLaborAttendance.delete({ where: { id } });
  revalidateThaiCost();
}

export async function getDefaultDailyWage(): Promise<number> {
  await requireThaiCostRead();
  return DEFAULT_SADAO_DAILY_WAGE_THB;
}

// ─── Sadao handling ──────────────────────────────────────────────────────────

export interface SadaoHandlingRow {
  id: string;
  date: string;
  holidayRate: boolean;
  smallCrateTotalQty: number;
  largeCrateTotalQty: number;
  boxTotalQty: number;
  smallCrateNoCheckQty: number;
  largeCrateNoCheckQty: number;
  boxNoCheckQty: number;
  smallBillableQty: number;
  largeBillableQty: number;
  boxBillableQty: number;
  smallCommissionThb: number;
  largeCommissionThb: number;
  boxCommissionThb: number;
  commissionThb: number;
  otherExpenses: SadaoHandlingOtherExpenseRow[];
  otherExpensesThb: number;
  dayTotalThb: number;
  notes: string | null;
}

function mapOtherExpenseRows(
  rows: Array<{ id: string; description: string; amountThb: unknown }>
): SadaoHandlingOtherExpenseRow[] {
  return rows.map((row) => ({
    id: row.id,
    description: row.description,
    amountThb: decimalToNumber(row.amountThb as never) ?? 0,
  }));
}

function toHandlingRow(
  row: {
    id: string;
    date: Date;
    smallCrateTotalQty: number;
    largeCrateTotalQty: number;
    boxTotalQty: number;
    smallCrateNoCheckQty: number;
    largeCrateNoCheckQty: number;
    boxNoCheckQty: number;
    notes: string | null;
    otherExpenses?: Array<{
      id: string;
      description: string;
      amountThb: unknown;
    }>;
  },
  holidayKeys: ReadonlySet<string>,
  rateConfig: ThaiCostRates
): SadaoHandlingRow {
  const holidayRate = isHolidayRate(row.date, holidayKeys);
  const commission = computeSadaoHandlingCommission(row, {
    holidayRate,
    rateConfig,
  });
  const otherExpenses = mapOtherExpenseRows(row.otherExpenses ?? []);
  const otherExpensesThb = sumSadaoHandlingOtherExpensesThb(otherExpenses);
  return {
    id: row.id,
    date: toDateInputValue(row.date),
    holidayRate,
    smallCrateTotalQty: row.smallCrateTotalQty,
    largeCrateTotalQty: row.largeCrateTotalQty,
    boxTotalQty: row.boxTotalQty,
    smallCrateNoCheckQty: row.smallCrateNoCheckQty,
    largeCrateNoCheckQty: row.largeCrateNoCheckQty,
    boxNoCheckQty: row.boxNoCheckQty,
    smallBillableQty: commission.smallBillableQty,
    largeBillableQty: commission.largeBillableQty,
    boxBillableQty: commission.boxBillableQty,
    smallCommissionThb: commission.smallCommissionThb,
    largeCommissionThb: commission.largeCommissionThb,
    boxCommissionThb: commission.boxCommissionThb,
    commissionThb: commission.totalCommissionThb,
    otherExpenses,
    otherExpensesThb,
    dayTotalThb: computeSadaoHandlingDayTotalThb(
      commission.totalCommissionThb,
      otherExpensesThb
    ),
    notes: row.notes,
  };
}

async function loadHolidayKeysForRange(start: Date, end: Date) {
  const holidays = await prisma.thaiPublicHoliday.findMany({
    where: { date: { gte: start, lte: end } },
    select: { date: true },
  });
  return buildPublicHolidayKeySet(holidays);
}

export async function getSadaoHandlingForDate(
  dateInput: string
): Promise<SadaoHandlingRow | null> {
  await requireThaiCostRead();
  const date = parseDateInput(dateInput);
  const row = await prisma.sadaoCrateHandlingDaily.findUnique({
    where: { date },
    include: {
      otherExpenses: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!row) return null;
  const [holidayKeys, rates] = await Promise.all([
    loadHolidayKeysForRange(date, date),
    resolveThaiCostRatesForMonth(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1
    ),
  ]);
  return toHandlingRow(row, holidayKeys, rates);
}

export async function listSadaoHandling(input: {
  year: number;
  month: number;
}): Promise<SadaoHandlingRow[]> {
  await requireThaiCostRead();
  const { start, end } = getMonthDateRange(input.year, input.month);
  const [rows, holidayKeys, rates] = await Promise.all([
    prisma.sadaoCrateHandlingDaily.findMany({
      where: { date: { gte: start, lte: end } },
      include: {
        otherExpenses: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { date: "asc" },
    }),
    loadHolidayKeysForRange(start, end),
    resolveThaiCostRatesForMonth(input.year, input.month),
  ]);
  return rows.map((row) => toHandlingRow(row, holidayKeys, rates));
}

/** Live dispatch totals for Sadao handling form (read-only display). */
export async function getSadaoDispatchTotalsForDate(dateInput: string): Promise<{
  smallCrateTotalQty: number;
  largeCrateTotalQty: number;
  boxTotalQty: number;
}> {
  await requireThaiCostRead();
  const date = parseDateInput(dateInput);
  const rates = await resolveThaiCostRatesForMonth(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1
  );
  const totals = await aggregateSadaoDispatchTotalsForDate(date, rates);
  return {
    smallCrateTotalQty: totals.small,
    largeCrateTotalQty: totals.large,
    boxTotalQty: totals.box,
  };
}

export async function saveSadaoHandling(input: {
  id?: string;
  date: string;
  smallCrateNoCheckQty: number;
  largeCrateNoCheckQty: number;
  boxNoCheckQty: number;
  notes?: string | null;
  otherExpenses?: SadaoHandlingOtherExpenseInput[];
}): Promise<SadaoHandlingRow> {
  const user = await requireThaiCostWrite();
  const date = parseDateInput(input.date);
  const holiday = await prisma.thaiPublicHoliday.findUnique({
    where: { date },
    select: { date: true },
  });
  const holidayKeys = buildPublicHolidayKeySet(holiday ? [holiday] : []);
  const holidayRate = isHolidayRate(date, holidayKeys);
  const rates = await resolveThaiCostRatesForMonth(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1
  );

  const dispatchTotals = await aggregateSadaoDispatchTotalsForDate(date, rates);
  const qtyInput = {
    smallCrateTotalQty: dispatchTotals.small,
    largeCrateTotalQty: dispatchTotals.large,
    boxTotalQty: dispatchTotals.box,
    smallCrateNoCheckQty: input.smallCrateNoCheckQty,
    largeCrateNoCheckQty: input.largeCrateNoCheckQty,
    boxNoCheckQty: input.boxNoCheckQty,
  };

  let normalizedExpenses: SadaoHandlingOtherExpenseInput[];
  try {
    computeSadaoHandlingCommission(qtyInput, { holidayRate, rateConfig: rates });
    normalizedExpenses = normalizeSadaoHandlingOtherExpenses(input.otherExpenses);
  } catch (e) {
    if (e instanceof SadaoHandlingValidationError) throw e;
    if (e instanceof SadaoHandlingExpenseValidationError) throw e;
    throw e;
  }

  const notes = input.notes?.trim() || null;
  const data = {
    date,
    smallCrateTotalQty: dispatchTotals.small,
    largeCrateTotalQty: dispatchTotals.large,
    boxTotalQty: dispatchTotals.box,
    smallCrateNoCheckQty: input.smallCrateNoCheckQty,
    largeCrateNoCheckQty: input.largeCrateNoCheckQty,
    boxNoCheckQty: input.boxNoCheckQty,
    notes,
    createdBy: user.id,
  };

  const row = await prisma.$transaction(async (tx) => {
    let saved;
    if (input.id) {
      saved = await tx.sadaoCrateHandlingDaily.update({
        where: { id: input.id },
        data: {
          date: data.date,
          smallCrateTotalQty: data.smallCrateTotalQty,
          largeCrateTotalQty: data.largeCrateTotalQty,
          boxTotalQty: data.boxTotalQty,
          smallCrateNoCheckQty: data.smallCrateNoCheckQty,
          largeCrateNoCheckQty: data.largeCrateNoCheckQty,
          boxNoCheckQty: data.boxNoCheckQty,
          notes: data.notes,
        },
      });
    } else {
      saved = await tx.sadaoCrateHandlingDaily.upsert({
        where: { date },
        create: data,
        update: {
          smallCrateTotalQty: data.smallCrateTotalQty,
          largeCrateTotalQty: data.largeCrateTotalQty,
          boxTotalQty: data.boxTotalQty,
          smallCrateNoCheckQty: data.smallCrateNoCheckQty,
          largeCrateNoCheckQty: data.largeCrateNoCheckQty,
          boxNoCheckQty: data.boxNoCheckQty,
          notes: data.notes,
        },
      });
    }

    await tx.sadaoHandlingOtherExpense.deleteMany({
      where: { handlingDailyId: saved.id },
    });
    if (normalizedExpenses.length > 0) {
      await tx.sadaoHandlingOtherExpense.createMany({
        data: normalizedExpenses.map((item) => ({
          id: randomUUID(),
          handlingDailyId: saved.id,
          description: item.description,
          amountThb: item.amountThb,
        })),
      });
    }

    return tx.sadaoCrateHandlingDaily.findUniqueOrThrow({
      where: { id: saved.id },
      include: {
        otherExpenses: { orderBy: { createdAt: "asc" } },
      },
    });
  });

  const { syncHandlingDraftFromDaily } = await import(
    "@/lib/cash-book/thai-cash-book-settlement"
  );
  await syncHandlingDraftFromDaily({
    station: "SADAO",
    dailyId: row.id,
    actorUserId: user.id,
  });

  revalidateThaiCost();
  return toHandlingRow(row, holidayKeys, rates);
}

export async function deleteSadaoHandling(id: string): Promise<void> {
  await requireThaiCostWrite();
  await prisma.sadaoCrateHandlingDaily.delete({ where: { id } });
  revalidateThaiCost();
}

// ─── Public holidays ─────────────────────────────────────────────────────────

export interface ThaiPublicHolidayRow {
  id: string;
  date: string;
  name: string;
}

export async function listThaiPublicHolidays(input?: {
  year?: number;
}): Promise<ThaiPublicHolidayRow[]> {
  await requireThaiCostRead();
  const year = input?.year;
  const where =
    year != null
      ? {
          date: {
            gte: new Date(Date.UTC(year, 0, 1)),
            lte: new Date(Date.UTC(year, 11, 31)),
          },
        }
      : undefined;
  const rows = await prisma.thaiPublicHoliday.findMany({
    where,
    orderBy: { date: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    date: toDateInputValue(r.date),
    name: r.name,
  }));
}

export async function saveThaiPublicHoliday(input: {
  id?: string;
  date: string;
  name: string;
}): Promise<ThaiPublicHolidayRow> {
  const user = await requireThaiCostWrite();
  const name = input.name.trim();
  if (!name) throw new Error("假期名称不能为空 Holiday name is required");
  const date = parseDateInput(input.date);

  let row;
  if (input.id) {
    row = await prisma.thaiPublicHoliday.update({
      where: { id: input.id },
      data: { date, name },
    });
  } else {
    row = await prisma.thaiPublicHoliday.upsert({
      where: { date },
      create: {
        id: randomUUID(),
        date,
        name,
        createdBy: user.id,
      },
      update: { name },
    });
  }

  revalidateThaiCost();
  return {
    id: row.id,
    date: toDateInputValue(row.date),
    name: row.name,
  };
}

export async function deleteThaiPublicHoliday(id: string): Promise<void> {
  await requireThaiCostWrite();
  await prisma.thaiPublicHoliday.delete({ where: { id } });
  revalidateThaiCost();
}

/** Holiday-rate info for a calendar date (Sunday or public holiday). */
export async function getThaiHolidayRateInfo(
  dateInput: string
): Promise<HolidayRateInfo> {
  await requireThaiCostRead();
  const date = parseDateInput(dateInput);
  const holiday = await prisma.thaiPublicHoliday.findUnique({
    where: { date },
    select: { date: true, name: true },
  });
  const keys = buildPublicHolidayKeySet(holiday ? [holiday] : []);
  const names = buildPublicHolidayNameMap(holiday ? [holiday] : []);
  return getHolidayRateInfo(date, keys, names);
}

// ─── Monthly summary ─────────────────────────────────────────────────────────

export async function getSadaoMonthlyCostSummary(
  year: number,
  month: number
): Promise<SadaoMonthlyCostDetail> {
  await requireThaiCostRead();
  return getSadaoMonthlyCost(year, month);
}

export async function getSadaoVoucher(date: string) {
  await requireThaiCostRead();
  return getSadaoVoucherForDate(date);
}

export async function getThaiCostDailyOverview(date: string) {
  await requireThaiCostRead();
  return getDailyOverview(date);
}
