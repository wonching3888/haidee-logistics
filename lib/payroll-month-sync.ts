import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/freight-rates";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { syncDriverPayrollTripForDispatch } from "@/lib/driver-payroll-trip-sync";
import {
  dispatchMatchesDriver,
  normalizePayrollDriverName,
} from "@/lib/payroll-driver-match";
import type { MaritalStatus } from "@/lib/constants/payroll";

const dispatchIncludeForPayroll = {
  truck: { select: { type: true, plate: true } },
  lines: {
    include: {
      inboundLine: {
        select: {
          mcDeliveryMode: true,
          stall: { select: { market: { select: { code: true } } } },
        },
      },
    },
  },
} as const;

type DispatchForPayroll = Awaited<
  ReturnType<
    typeof prisma.dispatchOrder.findMany<{ include: typeof dispatchIncludeForPayroll }>
  >
>[number];

type PayrollDriverSync = {
  id: string;
  name: string;
  fullName: string | null;
  nickname: string | null;
  baseSalary: number | null;
  maritalStatus: MaritalStatus | null;
  childCount: number;
};

export {
  dispatchMatchesDriver,
  normalizePayrollDriverName,
} from "@/lib/payroll-driver-match";

function serializeDriverForSync(driver: {
  id: string;
  name: string;
  fullName: string | null;
  nickname: string | null;
  baseSalary: unknown;
  maritalStatus: string | null;
  childCount: number;
}): PayrollDriverSync {
  return {
    id: driver.id,
    name: driver.name,
    fullName: driver.fullName,
    nickname: driver.nickname,
    baseSalary: decimalToNumber(driver.baseSalary),
    maritalStatus: driver.maritalStatus as MaritalStatus | null,
    childCount: driver.childCount,
  };
}

function groupDispatchesForDrivers(
  drivers: PayrollDriverSync[],
  dispatches: DispatchForPayroll[]
) {
  const byDriverId = new Map<string, DispatchForPayroll[]>(
    drivers.map((driver) => [driver.id, []])
  );
  const unmatched: DispatchForPayroll[] = [];

  for (const order of dispatches) {
    const matchedDrivers = drivers.filter((driver) =>
      dispatchMatchesDriver(driver, order)
    );

    if (matchedDrivers.length === 1) {
      byDriverId.get(matchedDrivers[0]!.id)!.push(order);
      continue;
    }

    if (matchedDrivers.length > 1) {
      const orderKey = normalizePayrollDriverName(order.driverName);
      const exact = matchedDrivers.find(
        (driver) => normalizePayrollDriverName(driver.name) === orderKey
      );
      if (exact) {
        byDriverId.get(exact.id)!.push(order);
        continue;
      }
    }

    unmatched.push(order);
  }

  return { byDriverId, unmatched };
}

async function loadPayrollMonthContext(year: number, month: number) {
  const { start, end } = getMonthDateRange(year, month);
  const dispatches = await prisma.dispatchOrder.findMany({
    where: {
      status: { notIn: ["cancelled"] },
      date: { gte: start, lte: end },
    },
    include: dispatchIncludeForPayroll,
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  return { start, end, dispatches };
}

async function ensurePayrollMonth(driverId: string, yearMonth: string) {
  return prisma.driverPayrollMonth.upsert({
    where: { driverId_yearMonth: { driverId, yearMonth } },
    create: { driverId, yearMonth },
    update: {},
  });
}

function logPayrollSyncDiagnostics(input: {
  year: number;
  month: number;
  dateRange: { start: string; end: string };
  dispatchTotal: number;
  drivers: Array<{
    driverName: string;
    dispatchCount: number;
    payrollTripCount: number;
    tripAllowanceTotal: number;
  }>;
  unmatchedDispatchCount: number;
  unmatchedDriverNames: string[];
}) {
  if (input.month !== 6) return;

  console.log("[DriverPayroll][JuneSync]", {
    year: input.year,
    month: input.month,
    dateRange: input.dateRange,
    dispatchTotal: input.dispatchTotal,
    driverCount: input.drivers.length,
    unmatchedDispatchCount: input.unmatchedDispatchCount,
    unmatchedDriverNames: input.unmatchedDriverNames,
    perDriver: input.drivers,
  });
}

async function syncDispatchTripsForMonth(
  payrollMonthId: string,
  _driver: PayrollDriverSync,
  dispatches: DispatchForPayroll[]
) {
  for (const order of dispatches) {
    await syncDriverPayrollTripForDispatch(order.id);
  }

  const dispatchIds = dispatches.map((order) => order.id);
  const [payrollTripCount, linkedTrips] = await Promise.all([
    prisma.driverPayrollTrip.count({ where: { payrollMonthId } }),
    dispatchIds.length > 0
      ? prisma.driverPayrollTrip.findMany({
          where: {
            payrollMonthId,
            dispatchOrderId: { in: dispatchIds },
          },
          select: { tripAllowance: true },
        })
      : Promise.resolve([]),
  ]);

  const tripAllowanceTotal = linkedTrips.reduce(
    (sum, trip) => sum + (decimalToNumber(trip.tripAllowance) ?? 0),
    0
  );

  return {
    dispatchCount: dispatches.length,
    payrollTripCount,
    tripAllowanceTotal: Math.round(tripAllowanceTotal * 100) / 100,
  };
}

export async function syncFleetPayrollForMonth(year: number, month: number) {
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
  const [drivers, monthContext] = await Promise.all([
    prisma.driver.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    loadPayrollMonthContext(year, month),
  ]);

  const serializedDrivers = drivers.map(serializeDriverForSync);
  const grouped = groupDispatchesForDrivers(
    serializedDrivers,
    monthContext.dispatches
  );
  const driverResults: Array<{
    driverName: string;
    dispatchCount: number;
    payrollTripCount: number;
    tripAllowanceTotal: number;
  }> = [];

  for (const driver of serializedDrivers) {
    const payrollMonth = await ensurePayrollMonth(driver.id, yearMonth);
    const result = await syncDispatchTripsForMonth(
      payrollMonth.id,
      driver,
      grouped.byDriverId.get(driver.id) ?? []
    );
    driverResults.push({
      driverName: driver.name,
      ...result,
    });
  }

  logPayrollSyncDiagnostics({
    year,
    month,
    dateRange: {
      start: monthContext.start.toISOString().slice(0, 10),
      end: monthContext.end.toISOString().slice(0, 10),
    },
    dispatchTotal: monthContext.dispatches.length,
    drivers: driverResults,
    unmatchedDispatchCount: grouped.unmatched.length,
    unmatchedDriverNames: Array.from(
      new Set(
        grouped.unmatched
          .map((order) => (order.driverName ?? "").trim())
          .filter(Boolean)
      )
    ),
  });
}

export async function syncDriverPayrollForMonth(
  driverId: string,
  year: number,
  month: number
) {
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
  const [driver, monthContext] = await Promise.all([
    prisma.driver.findUnique({ where: { id: driverId } }),
    loadPayrollMonthContext(year, month),
  ]);
  if (!driver) throw new Error("司机不存在 Driver not found");

  const serializedDriver = serializeDriverForSync(driver);
  const dispatches = monthContext.dispatches.filter((order) =>
    dispatchMatchesDriver(serializedDriver, order)
  );

  const payrollMonth = await ensurePayrollMonth(driverId, yearMonth);
  const result = await syncDispatchTripsForMonth(
    payrollMonth.id,
    serializedDriver,
    dispatches
  );

  logPayrollSyncDiagnostics({
    year,
    month,
    dateRange: {
      start: monthContext.start.toISOString().slice(0, 10),
      end: monthContext.end.toISOString().slice(0, 10),
    },
    dispatchTotal: monthContext.dispatches.length,
    drivers: [{ driverName: serializedDriver.name, ...result }],
    unmatchedDispatchCount: monthContext.dispatches.length - dispatches.length,
    unmatchedDriverNames: [],
  });
}
