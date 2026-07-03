import type { MaritalStatus } from "@/lib/constants/payroll";
import { toDateInputValue } from "@/lib/date-utils";
import {
  buildTripListingRows,
  formatCharterTripListingDestination,
  type TripListingRow,
} from "@/lib/driver-trip-listing";
import { decimalToNumber } from "@/lib/freight-rates";
import { buildDriverPayrollSummaryFromRecords } from "@/lib/payroll-fleet";
import type { PayrollSummary } from "@/lib/payroll-statutory";
import { syncFleetPayrollForMonth } from "@/lib/payroll-month-sync";
import { prisma } from "@/lib/prisma";
import { getDriverPayrollName } from "@/lib/trip-allowance";

/** Same skip rule as JV export (inactive / non-payslip drivers). */
export const PAYSLIP_BATCH_SKIP_DRIVER_NAMES = ["Din"] as const;

export interface DriverPayslipPrintEntry {
  driverId: string;
  driver: {
    payrollName: string;
    name: string;
    icNumber: string | null;
    bankName: string | null;
    bankAccount: string | null;
    baseSalary: number | null;
  };
  summary: PayrollSummary;
  advances: { date: string; amount: number; note: string | null }[];
  tripListingRows: TripListingRow[];
}

const PAYROLL_TRIP_LISTING_INCLUDE = {
  dispatchOrder: { select: { truck: { select: { plate: true } } } },
  charterTrip: {
    select: {
      stockAreaNote: true,
      shipper: { select: { location: true } },
      truck: { select: { plate: true } },
    },
  },
} as const;

function tripListingRowsFromMonthRecord(
  monthRecord: {
    trips: Array<{
      charterTripId: string | null;
      date: Date;
      route: string | null;
      markets: string[];
      tripAllowance: unknown;
      charterSalary: unknown;
      extraAllowance: unknown;
      crateReturnCommission: unknown;
      crateReturnMultiMarketAllowance: unknown;
      notes: string | null;
      sortOrder: number;
      dispatchOrder: { truck: { plate: string } } | null;
      charterTrip: {
        stockAreaNote: string | null;
        shipper: { location: string | null } | null;
        truck: { plate: string };
      } | null;
    }>;
    extras: Array<{
      type: string;
      amount: unknown;
      note: string | null;
      date: Date;
    }>;
  }
) {
  return buildTripListingRows({
    trips: monthRecord.trips.map((trip) => ({
      charterTripId: trip.charterTripId,
      date: trip.date,
      route: trip.route,
      markets: trip.markets,
      tripAllowance: decimalToNumber(trip.tripAllowance) ?? 0,
      charterSalary: decimalToNumber(trip.charterSalary) ?? 0,
      extraAllowance: decimalToNumber(trip.extraAllowance) ?? 0,
      crateReturnCommission: decimalToNumber(trip.crateReturnCommission) ?? 0,
      crateReturnMultiMarketAllowance:
        decimalToNumber(trip.crateReturnMultiMarketAllowance) ?? 0,
      plate:
        trip.dispatchOrder?.truck?.plate ??
        trip.charterTrip?.truck?.plate ??
        trip.notes?.trim() ??
        null,
      charterDestination: trip.charterTrip
        ? formatCharterTripListingDestination(trip.charterTrip)
        : null,
      sortOrder: trip.sortOrder,
    })),
    extras: monthRecord.extras.map((item) => ({
      type: item.type,
      amount: decimalToNumber(item.amount) ?? 0,
      note: item.note,
      date: item.date,
    })),
  });
}

export const PAYSLIP_BATCH_SORT_NOTE =
  "driver.name ascending (matches monthly summary table and JV export)";

function parseYearMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * One fleet sync + one query for all active payslip drivers.
 * Skips Din and drivers without a payroll month row.
 */
export async function loadBatchDriverPayslipEntries(
  year: number,
  month: number
) {
  await syncFleetPayrollForMonth(year, month);
  const yearMonth = parseYearMonth(year, month);

  const drivers = await prisma.driver.findMany({
    where: {
      active: true,
      name: { notIn: [...PAYSLIP_BATCH_SKIP_DRIVER_NAMES] },
    },
    orderBy: { name: "asc" },
    include: {
      payrollMonths: {
        where: { yearMonth },
        include: {
          trips: {
            orderBy: [{ date: "asc" }, { sortOrder: "asc" }],
            include: PAYROLL_TRIP_LISTING_INCLUDE,
          },
          extras: { orderBy: [{ date: "asc" }, { createdAt: "asc" }] },
        },
      },
    },
  });

  const entries: DriverPayslipPrintEntry[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const skipName of PAYSLIP_BATCH_SKIP_DRIVER_NAMES) {
    skipped.push({ name: skipName, reason: "inactive / excluded from batch payslip" });
  }

  for (const driver of drivers) {
    const monthRecord = driver.payrollMonths[0];
    if (!monthRecord) {
      skipped.push({ name: driver.name, reason: "no payroll month record" });
      continue;
    }

    const driverInput = {
      id: driver.id,
      name: driver.name,
      baseSalary: decimalToNumber(driver.baseSalary),
      maritalStatus: driver.maritalStatus as MaritalStatus | null,
      childCount: driver.childCount,
      isSocsoSecondCategory: driver.isSocsoSecondCategory,
    };

    const summary = buildDriverPayrollSummaryFromRecords({
      driver: driverInput,
      trips: monthRecord.trips,
      extras: monthRecord.extras,
      overrides: monthRecord,
    });

    entries.push({
      driverId: driver.id,
      driver: {
        payrollName: getDriverPayrollName({
          name: driver.name,
          fullName: driver.fullName,
        }),
        name: driver.name,
        icNumber: driver.icNumber,
        bankName: driver.bankName,
        bankAccount: driver.bankAccount,
        baseSalary: decimalToNumber(driver.baseSalary),
      },
      summary,
      advances: monthRecord.extras
        .filter((item) => item.type === "advance")
        .map((item) => ({
          date: toDateInputValue(item.date),
          amount: decimalToNumber(item.amount) ?? 0,
          note: item.note,
        })),
      tripListingRows: tripListingRowsFromMonthRecord(monthRecord),
    });
  }

  return {
    year,
    month,
    yearMonth,
    entries,
    skipped,
    sortNote: PAYSLIP_BATCH_SORT_NOTE,
  };
}
