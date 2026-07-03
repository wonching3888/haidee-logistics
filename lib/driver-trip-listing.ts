import { formatDisplayDate, parseDateInput, toDateInputValue } from "@/lib/date-utils";
import { payslipWagesTotal } from "@/lib/driver-payslip";
import { decimalToNumber } from "@/lib/freight-rates";
import { getRouteLabel } from "@/lib/payroll-route-label";
import type { PayrollSummary } from "@/lib/payroll-statutory";
import { prisma } from "@/lib/prisma";

export type TripListingRowType = "DO" | "CH" | "ALLOW";

export interface TripListingRow {
  date: string;
  dateLabel: string;
  type: TripListingRowType;
  plate: string | null;
  marketRoute: string;
  tripAllowance: number;
  crateCommission: number;
  subtotal: number;
}

export interface TripListingTripInput {
  charterTripId: string | null;
  date: Date | string;
  route: string | null;
  markets: string[];
  tripAllowance: number;
  charterSalary: number;
  extraAllowance: number;
  crateReturnCommission: number;
  crateReturnMultiMarketAllowance: number;
  plate: string | null;
  charterDestination: string | null;
  sortOrder: number;
}

export interface TripListingExtraInput {
  type: string;
  amount: number;
  note: string | null;
  date: Date | string;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatCharterTripListingDestination(charter: {
  stockAreaNote: string | null;
  shipper: { location: string | null } | null;
}) {
  const stockArea = charter.stockAreaNote?.trim();
  if (stockArea) return stockArea;
  const shipperLocation = charter.shipper?.location?.trim();
  if (shipperLocation) return shipperLocation;
  return "—";
}

export function tripListingMarketRoute(trip: TripListingTripInput) {
  if (trip.charterTripId) {
    return trip.charterDestination?.trim() || trip.route?.trim() || "—";
  }
  if (trip.markets.length > 0) {
    return getRouteLabel(trip.markets);
  }
  return trip.route?.trim() || "—";
}

export function tripListingRowSubtotal(trip: TripListingTripInput) {
  const allowance = trip.charterTripId ? trip.charterSalary : trip.tripAllowance;
  const crate = roundMoney(
    trip.crateReturnCommission + trip.crateReturnMultiMarketAllowance
  );
  return roundMoney(allowance + crate + trip.extraAllowance);
}

/** Build listing rows from stored payroll trips + extras (no allowance recomputation). */
export function buildTripListingRows(input: {
  trips: TripListingTripInput[];
  extras: TripListingExtraInput[];
}): TripListingRow[] {
  const tripRows: TripListingRow[] = input.trips.map((trip) => {
    const isCharter = Boolean(trip.charterTripId);
    const tripAllowance = isCharter ? trip.charterSalary : trip.tripAllowance;
    const crateCommission = roundMoney(
      trip.crateReturnCommission + trip.crateReturnMultiMarketAllowance
    );
    const date =
      typeof trip.date === "string"
        ? trip.date
        : toDateInputValue(trip.date);

    return {
      date,
      dateLabel: formatDisplayDate(parseDateInput(date)),
      type: isCharter ? "CH" : "DO",
      plate: trip.plate?.trim() || null,
      marketRoute: tripListingMarketRoute(trip),
      tripAllowance,
      crateCommission,
      subtotal: tripListingRowSubtotal(trip),
    };
  });

  const allowRows: TripListingRow[] = input.extras
    .filter((item) => item.type === "extra_allowance")
    .map((item) => {
      const date =
        typeof item.date === "string"
          ? item.date
          : toDateInputValue(item.date);
      const amount = roundMoney(item.amount);
      return {
        date,
        dateLabel: formatDisplayDate(parseDateInput(date)),
        type: "ALLOW",
        plate: null,
        marketRoute: item.note?.trim() || "Allowance",
        tripAllowance: amount,
        crateCommission: 0,
        subtotal: amount,
      };
    });

  return [...tripRows, ...allowRows].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    const typeOrder = { DO: 0, CH: 1, ALLOW: 2 };
    return typeOrder[a.type] - typeOrder[b.type];
  });
}

export function tripListingWagesTotal(rows: TripListingRow[]) {
  return roundMoney(rows.reduce((sum, row) => sum + row.subtotal, 0));
}

/** Footer TOTAL WAGES must match payslip WAGES (+) — throws on mismatch. */
export function assertTripListingWagesMatchPayslip(
  rows: TripListingRow[],
  summary: PayrollSummary
) {
  const listingTotal = tripListingWagesTotal(rows);
  const payslipTotal = payslipWagesTotal(summary);
  const diff = Math.abs(listingTotal - payslipTotal);
  if (diff > 0.005) {
    throw new Error(
      `Trip listing TOTAL WAGES ${listingTotal.toFixed(2)} does not match payslip WAGES ${payslipTotal.toFixed(2)}`
    );
  }
}

const tripListingInclude = {
  dispatchOrder: { select: { truck: { select: { plate: true } } } },
  charterTrip: {
    select: {
      stockAreaNote: true,
      shipper: { select: { location: true } },
      truck: { select: { plate: true } },
    },
  },
} as const;

export async function loadTripListingRowsForPayrollMonth(payrollMonthId: string) {
  const month = await prisma.driverPayrollMonth.findUnique({
    where: { id: payrollMonthId },
    include: {
      trips: {
        orderBy: [{ date: "asc" }, { sortOrder: "asc" }],
        include: tripListingInclude,
      },
      extras: { orderBy: [{ date: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!month) {
    throw new Error("薪资记录不存在 Payroll month not found");
  }

  return buildTripListingRows({
    trips: month.trips.map((trip) => ({
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
    extras: month.extras.map((item) => ({
      type: item.type,
      amount: decimalToNumber(item.amount) ?? 0,
      note: item.note,
      date: item.date,
    })),
  });
}

export function tripListingMonthTitle(month: number, year: number) {
  const MONTH_NAMES = [
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
  ] as const;
  const name = MONTH_NAMES[Math.min(12, Math.max(1, month)) - 1];
  return `TRIP LISTING FOR THE MONTH OF ${name} ${year}`;
}
