import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/freight-rates";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { loadPayrollAllowanceContext } from "@/app/actions/allowance-settings";
import { getRouteLabel } from "@/lib/payroll-route-label";
import {
  buildCrateReturnImportLookup,
  calculateTripAllowance,
  countPayrollMarketGroups,
  crateReturnCommissionForDispatch,
  dispatchHasCrateReturn,
} from "@/lib/trip-allowance";
import type { MaritalStatus } from "@/lib/constants/payroll";

const dispatchIncludeForPayroll = {
  truck: { select: { type: true, plate: true } },
} as const;

type DispatchForPayroll = Awaited<
  ReturnType<
    typeof prisma.dispatchOrder.findMany<{ include: typeof dispatchIncludeForPayroll }>
  >
>[number];

type AllowanceContext = Awaited<ReturnType<typeof loadPayrollAllowanceContext>>;

type PayrollDriverSync = {
  id: string;
  name: string;
  fullName: string | null;
  nickname: string | null;
  baseSalary: number | null;
  maritalStatus: MaritalStatus | null;
  childCount: number;
};

export function normalizePayrollDriverName(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function buildDriverMatchKeys(driver: {
  name: string;
  fullName: string | null;
  nickname: string | null;
}) {
  const keys = new Set<string>();
  for (const value of [driver.name, driver.fullName, driver.nickname]) {
    const key = normalizePayrollDriverName(value);
    if (key) keys.add(key);
  }
  return keys;
}

export function dispatchMatchesDriver(
  driver: {
    name: string;
    fullName: string | null;
    nickname: string | null;
  },
  order: { driverName: string | null }
) {
  const orderKey = normalizePayrollDriverName(order.driverName);
  if (!orderKey) return false;
  return buildDriverMatchKeys(driver).has(orderKey);
}

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

function computePayrollTripFields(
  order: DispatchForPayroll,
  allowanceContext: AllowanceContext,
  hasCrateReturn: boolean
) {
  const allowanceResult = calculateTripAllowance({
    markets: order.markets,
    routes: allowanceContext.routes,
    extraMarketAllowance: allowanceContext.extraMarketAllowance,
  });
  return {
    autoTripAllowance: allowanceResult.tripAllowance,
    marketCount: countPayrollMarketGroups(
      order.markets,
      allowanceContext.routes
    ),
    crateReturnCommission: crateReturnCommissionForDispatch({
      truckType: order.truck.type,
      hasCrateReturn,
      rates: {
        bigTruckCrateCommission: allowanceContext.bigTruckCrateCommission,
        smallTruckCrateCommission: allowanceContext.smallTruckCrateCommission,
      },
    }),
    routeLabel: getRouteLabel(order.markets),
  };
}

async function loadCrateReturnImports(start: Date, end: Date) {
  return prisma.tongImport.findMany({
    where: {
      date: { gte: start, lte: end },
      quantity: { gt: 0 },
    },
    select: {
      date: true,
      quantity: true,
      truck: { select: { plate: true } },
    },
  });
}

async function loadPayrollMonthContext(year: number, month: number) {
  const { start, end } = getMonthDateRange(year, month);
  const [dispatches, crateImports, allowanceContext] = await Promise.all([
    prisma.dispatchOrder.findMany({
      where: {
        status: { notIn: ["cancelled"] },
        date: { gte: start, lte: end },
      },
      include: dispatchIncludeForPayroll,
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    loadCrateReturnImports(start, end),
    loadPayrollAllowanceContext(),
  ]);

  return {
    start,
    end,
    dispatches,
    allowanceContext,
    importLookup: buildCrateReturnImportLookup(crateImports),
  };
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
  driver: PayrollDriverSync,
  dispatches: DispatchForPayroll[],
  allowanceContext: AllowanceContext,
  importLookup: Set<string>
) {
  const existingTrips = await prisma.driverPayrollTrip.findMany({
    where: { payrollMonthId },
  });

  const dispatchById = new Map(dispatches.map((order) => [order.id, order]));
  const linkedIds = new Set(
    existingTrips
      .map((trip) => trip.dispatchOrderId)
      .filter((id): id is string => Boolean(id))
  );

  let tripAllowanceTotal = 0;

  for (const trip of existingTrips) {
    if (!trip.dispatchOrderId) continue;
    const order = dispatchById.get(trip.dispatchOrderId);
    if (!order) continue;

    const computed = computePayrollTripFields(
      order,
      allowanceContext,
      dispatchHasCrateReturn(order, importLookup)
    );

    await prisma.driverPayrollTrip.update({
      where: { id: trip.id },
      data: {
        route: computed.routeLabel,
        markets: order.markets,
        marketCount: computed.marketCount,
        tripAllowance: computed.autoTripAllowance,
        crateReturnCommission: computed.crateReturnCommission,
        truckType: order.truck.type,
      },
    });
    tripAllowanceTotal += computed.autoTripAllowance;
  }

  const toCreate = dispatches.filter((order) => !linkedIds.has(order.id));
  if (toCreate.length > 0) {
    await prisma.driverPayrollTrip.createMany({
      data: toCreate.map((order, index) => {
        const computed = computePayrollTripFields(
          order,
          allowanceContext,
          dispatchHasCrateReturn(order, importLookup)
        );
        tripAllowanceTotal += computed.autoTripAllowance;
        return {
          payrollMonthId,
          dispatchOrderId: order.id,
          date: order.date,
          route: computed.routeLabel,
          markets: order.markets,
          marketCount: computed.marketCount,
          tripAllowance: computed.autoTripAllowance,
          crateReturnCommission: computed.crateReturnCommission,
          truckType: order.truck.type,
          notes: order.truck.plate,
          sortOrder: existingTrips.length + index,
        };
      }),
    });
  }

  return {
    dispatchCount: dispatches.length,
    payrollTripCount: existingTrips.length + toCreate.length,
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
      grouped.byDriverId.get(driver.id) ?? [],
      monthContext.allowanceContext,
      monthContext.importLookup
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
    dispatches,
    monthContext.allowanceContext,
    monthContext.importLookup
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
