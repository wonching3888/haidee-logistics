"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessDriverPayroll } from "@/lib/auth-roles";
import type { UserRole } from "@/types";
import { decimalToNumber } from "@/lib/freight-rates";
import { formatDisplayDate, toDateInputValue } from "@/lib/date-utils";
import {
  isMaritalStatus,
  isPayrollExtraType,
  type MaritalStatus,
} from "@/lib/constants/payroll";
import { loadPayrollAllowanceContext } from "@/app/actions/allowance-settings";
import { getRouteLabel } from "@/lib/payroll-route-label";
import {
  calculateTripAllowance,
  countPayrollMarketGroups,
  explainTripAllowance,
  getDriverPayrollName,
} from "@/lib/trip-allowance";
import {
  buildDriverPayrollSummaryFromRecords,
  loadFleetPayrollAggregate,
  type DriverPayrollDriverInput,
} from "@/lib/payroll-fleet";
import {
  syncDriverPayrollForMonth,
} from "@/lib/payroll-month-sync";

function payrollTripRouteSource(trip: {
  markets: string[];
  route: string | null;
}) {
  return trip.markets.length > 0 ? trip.markets : trip.route;
}

async function requirePayrollAccess() {
  const user = await getCurrentUser();
  if (!user || !canAccessDriverPayroll(user.role as UserRole)) {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

function parseYearMonth(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("无效年份 Invalid year");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("无效月份 Invalid month");
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

function serializeDriver(driver: {
  id: string;
  name: string;
  fullName: string | null;
  active: boolean;
  baseSalary: unknown;
  autoCountEmployeeCode: string | null;
  icNumber: string | null;
  epfNumber: string | null;
  socsoNumber: string | null;
  maritalStatus: string | null;
  childCount: number;
}) {
  return {
    id: driver.id,
    name: driver.name,
    fullName: driver.fullName,
    active: driver.active,
    baseSalary: decimalToNumber(driver.baseSalary),
    autoCountEmployeeCode: driver.autoCountEmployeeCode,
    icNumber: driver.icNumber,
    epfNumber: driver.epfNumber,
    socsoNumber: driver.socsoNumber,
    maritalStatus: driver.maritalStatus as MaritalStatus | null,
    childCount: driver.childCount,
    payrollName: getDriverPayrollName({
      fullName: driver.fullName,
      name: driver.name,
    }),
  };
}

function toPayrollDriverInput(
  driver: ReturnType<typeof serializeDriver>
): DriverPayrollDriverInput {
  return {
    id: driver.id,
    name: driver.name,
    baseSalary: driver.baseSalary,
    maritalStatus: driver.maritalStatus,
    childCount: driver.childCount,
  };
}

function buildSummaryFromRecords(input: {
  driver: ReturnType<typeof serializeDriver>;
  trips: {
    tripAllowance: unknown;
    extraAllowance: unknown;
    crateReturnCommission: unknown;
  }[];
  extras: { type: string; amount: unknown }[];
  overrides: {
    epfEmployeeOverride: unknown;
    epfEmployerOverride: unknown;
    socsoEmployeeOverride: unknown;
    socsoEmployerOverride: unknown;
    eisEmployeeOverride: unknown;
    eisEmployerOverride: unknown;
    pcbOverride: unknown;
  };
}) {
  return buildDriverPayrollSummaryFromRecords({
    driver: toPayrollDriverInput(input.driver),
    trips: input.trips,
    extras: input.extras,
    overrides: input.overrides,
  });
}

export async function getDriverPayrollDrivers() {
  await requirePayrollAccess();
  const drivers = await prisma.driver.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  return drivers.map(serializeDriver);
}

export async function getDriverPayrollMonthlySummary(input: {
  year: number;
  month: number;
}) {
  await requirePayrollAccess();
  const aggregate = await loadFleetPayrollAggregate(input.year, input.month);

  return {
    yearMonth: parseYearMonth(input.year, input.month),
    year: input.year,
    month: input.month,
    rows: aggregate.rows,
    totals: aggregate.totals,
    netMyr: aggregate.netMyr,
    employerMyr: aggregate.employerMyr,
    totalCostMyr: aggregate.totalCostMyr,
    hasRecords: aggregate.hasRecords,
  };
}

export async function getDriverPayrollMonth(input: {
  driverId: string;
  year: number;
  month: number;
}) {
  await requirePayrollAccess();
  const yearMonth = parseYearMonth(input.year, input.month);

  const driver = await prisma.driver.findUnique({ where: { id: input.driverId } });
  if (!driver) throw new Error("司机不存在 Driver not found");

  const serializedDriver = serializeDriver(driver);
  await syncDriverPayrollForMonth(input.driverId, input.year, input.month);

  const record = await prisma.driverPayrollMonth.findUnique({
    where: { driverId_yearMonth: { driverId: input.driverId, yearMonth } },
    include: {
      trips: { orderBy: [{ date: "asc" }, { sortOrder: "asc" }] },
      extras: { orderBy: [{ date: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!record) throw new Error("薪资记录不存在 Payroll record not found");

  const allowanceContext = await loadPayrollAllowanceContext();

  const summary = buildSummaryFromRecords({
    driver: serializedDriver,
    trips: record.trips,
    extras: record.extras,
    overrides: record,
  });

  const autoStatutory = buildSummaryFromRecords({
    driver: serializedDriver,
    trips: record.trips,
    extras: record.extras,
    overrides: {
      epfEmployeeOverride: null,
      epfEmployerOverride: null,
      socsoEmployeeOverride: null,
      socsoEmployerOverride: null,
      eisEmployeeOverride: null,
      eisEmployerOverride: null,
      pcbOverride: null,
    },
  }).statutory;

  return {
    yearMonth,
    year: input.year,
    month: input.month,
    driver: serializedDriver,
    payrollMonthId: record.id,
    overrides: {
      epfEmployee: decimalToNumber(record.epfEmployeeOverride),
      epfEmployer: decimalToNumber(record.epfEmployerOverride),
      socsoEmployee: decimalToNumber(record.socsoEmployeeOverride),
      socsoEmployer: decimalToNumber(record.socsoEmployerOverride),
      eisEmployee: decimalToNumber(record.eisEmployeeOverride),
      eisEmployer: decimalToNumber(record.eisEmployerOverride),
      pcb: decimalToNumber(record.pcbOverride),
    },
    trips: record.trips.map((trip) => {
      const crateReturnCommission = decimalToNumber(trip.crateReturnCommission) ?? 0;
      const autoTripAllowanceDebug =
        input.month === 6
          ? explainTripAllowance({
              markets: trip.markets,
              routes: allowanceContext.routes,
              extraMarketAllowance: allowanceContext.extraMarketAllowance,
              truckType: trip.truckType,
              hasCrateReturn: crateReturnCommission > 0,
              crateRates: {
                bigTruckCrateCommission: allowanceContext.bigTruckCrateCommission,
                smallTruckCrateCommission: allowanceContext.smallTruckCrateCommission,
              },
            })
          : null;

      if (input.month === 6 && autoTripAllowanceDebug) {
        console.log("[DriverPayroll][JuneTripAllowanceDebug]", {
          driverId: input.driverId,
          tripId: trip.id,
          dispatchOrderId: trip.dispatchOrderId,
          date: trip.date,
          markets: trip.markets,
          marketCount: trip.marketCount,
          stored: {
            tripAllowance: decimalToNumber(trip.tripAllowance) ?? 0,
            extraAllowance: decimalToNumber(trip.extraAllowance) ?? 0,
            crateReturnCommission,
          },
          computed: {
            primaryRoute: autoTripAllowanceDebug.primaryRouteCode,
            groupCount: autoTripAllowanceDebug.groupCount,
            routeGroups: autoTripAllowanceDebug.routeGroups,
            extraMarketCount: autoTripAllowanceDebug.extraMarketCount,
            formula: autoTripAllowanceDebug.formula,
            crateReturn: autoTripAllowanceDebug.crateReturn,
            tripAllowanceTotal: autoTripAllowanceDebug.tripAllowanceTotal,
          },
        });
      }

      const autoTripAllowance =
        autoTripAllowanceDebug?.tripAllowanceTotal ??
        calculateTripAllowance({
          markets: trip.markets,
          routes: allowanceContext.routes,
          extraMarketAllowance: allowanceContext.extraMarketAllowance,
        }).tripAllowance;

      return {
        id: trip.id,
        dispatchOrderId: trip.dispatchOrderId,
        date: toDateInputValue(trip.date),
        dateLabel: formatDisplayDate(trip.date),
        route: getRouteLabel(payrollTripRouteSource(trip)),
        markets: trip.markets,
        marketCount: countPayrollMarketGroups(
          trip.markets,
          allowanceContext.routes
        ),
        autoTripAllowance,
        tripAllowance: decimalToNumber(trip.tripAllowance) ?? 0,
        extraAllowance: decimalToNumber(trip.extraAllowance) ?? 0,
        crateReturnCommission,
        truckType: trip.truckType,
        notes: trip.notes,
      };
    }),
    extras: record.extras.map((item) => ({
      id: item.id,
      type: item.type,
      amount: decimalToNumber(item.amount) ?? 0,
      note: item.note,
      date: toDateInputValue(item.date),
    })),
    summary,
    autoStatutory,
  };
}

export async function saveDriverPayrollTrip(input: {
  id: string;
  tripAllowance: number;
  extraAllowance: number;
  notes?: string;
}) {
  await requirePayrollAccess();
  await prisma.driverPayrollTrip.update({
    where: { id: input.id },
    data: {
      tripAllowance: input.tripAllowance,
      extraAllowance: input.extraAllowance,
      notes: input.notes?.trim() || null,
    },
  });
  revalidatePath("/driver-payroll");
}

export async function addDriverPayrollExtra(input: {
  payrollMonthId: string;
  type: string;
  amount: number;
  date: string;
  note?: string;
}) {
  await requirePayrollAccess();
  if (!isPayrollExtraType(input.type)) {
    throw new Error("无效类型 Invalid extra type");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("金额必须大于 0 Amount must be greater than 0");
  }
  await prisma.driverPayrollExtra.create({
    data: {
      payrollMonthId: input.payrollMonthId,
      type: input.type,
      amount: input.amount,
      date: new Date(`${input.date}T00:00:00.000Z`),
      note: input.note?.trim() || null,
    },
  });
  revalidatePath("/driver-payroll");
}

export async function deleteDriverPayrollExtra(id: string) {
  await requirePayrollAccess();
  await prisma.driverPayrollExtra.delete({ where: { id } });
  revalidatePath("/driver-payroll");
}

export async function saveDriverPayrollOverrides(input: {
  payrollMonthId: string;
  epfEmployee?: number | null;
  epfEmployer?: number | null;
  socsoEmployee?: number | null;
  socsoEmployer?: number | null;
  eisEmployee?: number | null;
  eisEmployer?: number | null;
  pcb?: number | null;
}) {
  await requirePayrollAccess();
  await prisma.driverPayrollMonth.update({
    where: { id: input.payrollMonthId },
    data: {
      epfEmployeeOverride: input.epfEmployee ?? null,
      epfEmployerOverride: input.epfEmployer ?? null,
      socsoEmployeeOverride: input.socsoEmployee ?? null,
      socsoEmployerOverride: input.socsoEmployer ?? null,
      eisEmployeeOverride: input.eisEmployee ?? null,
      eisEmployerOverride: input.eisEmployer ?? null,
      pcbOverride: input.pcb ?? null,
    },
  });
  revalidatePath("/driver-payroll");
}

function csvEscape(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function exportDriverPayrollAutoCount(input: {
  driverId: string;
  year: number;
  month: number;
}) {
  await requirePayrollAccess();
  const data = await getDriverPayrollMonth(input);
  const { driver, summary, trips, extras, yearMonth } = data;
  const payrollName = driver.payrollName;

  const headers = [
    "EmployeeCode",
    "EmployeeName",
    "YearMonth",
    "LineType",
    "Date",
    "Description",
    "Markets",
    "TripAllowance",
    "TripExtraAllowance",
    "CrateCommission",
    "ExtraAllowance",
    "Advance",
    "BaseSalary",
    "GrossSalary",
    "EPF_Employee",
    "EPF_Employer",
    "SOCSO_Employee",
    "SOCSO_Employer",
    "EIS_Employee",
    "EIS_Employer",
    "PCB",
    "NetSalary",
  ];

  const rows: string[][] = [];

  for (const trip of trips) {
    rows.push([
      driver.autoCountEmployeeCode ?? "",
      payrollName,
      yearMonth,
      "TRIP",
      trip.date,
      trip.notes ?? trip.route,
      trip.markets.join("/"),
      trip.tripAllowance.toFixed(2),
      trip.extraAllowance.toFixed(2),
      trip.crateReturnCommission.toFixed(2),
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
  }

  for (const extra of extras) {
    rows.push([
      driver.autoCountEmployeeCode ?? "",
      payrollName,
      yearMonth,
      extra.type === "advance" ? "ADVANCE" : "EXTRA",
      extra.date,
      extra.note ?? "",
      "",
      "",
      "",
      "",
      extra.type === "extra_allowance" ? extra.amount.toFixed(2) : "",
      extra.type === "advance" ? extra.amount.toFixed(2) : "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
  }

  rows.push([
    driver.autoCountEmployeeCode ?? "",
    payrollName,
    yearMonth,
    "SUMMARY",
    "",
    "Monthly Summary",
    "",
    summary.tripAllowanceTotal.toFixed(2),
    "",
    summary.crateCommissionTotal.toFixed(2),
    summary.extraAllowanceTotal.toFixed(2),
    summary.advanceTotal.toFixed(2),
    summary.baseSalary.toFixed(2),
    summary.grossSalary.toFixed(2),
    summary.statutory.epfEmployee.toFixed(2),
    summary.statutory.epfEmployer.toFixed(2),
    summary.statutory.socsoEmployee.toFixed(2),
    summary.statutory.socsoEmployer.toFixed(2),
    summary.statutory.eisEmployee.toFixed(2),
    summary.statutory.eisEmployer.toFixed(2),
    summary.statutory.pcb.toFixed(2),
    summary.netSalary.toFixed(2),
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");

  return {
    filename: `payroll-${driver.autoCountEmployeeCode || payrollName}-${yearMonth}.csv`,
    content: csv,
  };
}

export async function saveDriverPayrollMaster(input: {
  id?: string;
  name: string;
  fullName?: string | null;
  active: boolean;
  baseSalary?: number | null;
  autoCountEmployeeCode?: string | null;
  icNumber?: string | null;
  epfNumber?: string | null;
  socsoNumber?: string | null;
  maritalStatus?: string | null;
  childCount?: number;
}) {
  await requirePayrollAccess();
  if (!input.name.trim()) {
    throw new Error("小名不能为空 Nickname is required");
  }
  if (
    input.maritalStatus &&
    input.maritalStatus !== "" &&
    !isMaritalStatus(input.maritalStatus)
  ) {
    throw new Error("无效婚姻状况 Invalid marital status");
  }

  const data = {
    name: input.name.trim(),
    fullName: input.fullName?.trim() || null,
    active: input.active,
    baseSalary: input.baseSalary ?? null,
    autoCountEmployeeCode: input.autoCountEmployeeCode?.trim() || null,
    icNumber: input.icNumber?.trim() || null,
    epfNumber: input.epfNumber?.trim() || null,
    socsoNumber: input.socsoNumber?.trim() || null,
    maritalStatus:
      input.maritalStatus && input.maritalStatus !== ""
        ? input.maritalStatus
        : null,
    childCount: input.childCount ?? 0,
  };

  if (input.id) {
    await prisma.driver.update({ where: { id: input.id }, data });
  } else {
    await prisma.driver.create({ data });
  }

  revalidatePath("/settings");
  revalidatePath("/driver-payroll");
}

export async function deleteDriverPayrollMaster(id: string) {
  await requirePayrollAccess();
  await prisma.driver.update({ where: { id }, data: { active: false } });
  revalidatePath("/settings");
  revalidatePath("/driver-payroll");
}

export async function getDriverPayrollSettingsData() {
  await requirePayrollAccess();
  const drivers = await prisma.driver.findMany({
    orderBy: { name: "asc" },
  });
  return drivers.map(serializeDriver);
}
