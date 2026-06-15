import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/freight-rates";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { loadPayrollAllowanceContext } from "@/app/actions/allowance-settings";
import { getRouteLabel } from "@/lib/payroll-route-label";
import {
  buildCrateReturnExportLookup,
  calculateTripAllowance,
  countPayrollMarketGroups,
  crateReturnCommissionForDispatch,
  dispatchHasCrateReturn,
} from "@/lib/trip-allowance";
import type { MaritalStatus } from "@/lib/constants/payroll";

const dispatchIncludeForPayroll = {
  truck: { select: { type: true, plate: true } },
  lines: {
    include: {
      inboundLine: {
        include: { session: { select: { thVehiclePlate: true } } },
      },
    },
  },
} as const;

type DispatchForPayroll = Awaited<
  ReturnType<
    typeof prisma.dispatchOrder.findMany<{ include: typeof dispatchIncludeForPayroll }>
  >
>[number];

type AllowanceContext = Awaited<ReturnType<typeof loadPayrollAllowanceContext>>;

function serializeDriverForSync(driver: {
  id: string;
  name: string;
  fullName: string | null;
  baseSalary: unknown;
  maritalStatus: string | null;
  childCount: number;
}) {
  return {
    id: driver.id,
    name: driver.name,
    baseSalary: decimalToNumber(driver.baseSalary),
    maritalStatus: driver.maritalStatus as MaritalStatus | null,
    childCount: driver.childCount,
  };
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

async function loadCrateReturnExports(start: Date, end: Date) {
  return prisma.tongExport.findMany({
    where: {
      date: { gte: start, lte: end },
      quantityActual: { gt: 0 },
      tongType: { isBox: false },
    },
    select: { date: true, thVehiclePlate: true },
  });
}

async function ensurePayrollMonth(driverId: string, yearMonth: string) {
  return prisma.driverPayrollMonth.upsert({
    where: { driverId_yearMonth: { driverId, yearMonth } },
    create: { driverId, yearMonth },
    update: {},
  });
}

async function syncDispatchTripsForMonth(
  payrollMonthId: string,
  driver: ReturnType<typeof serializeDriverForSync>,
  year: number,
  month: number
) {
  const { start, end } = getMonthDateRange(year, month);

  const [existingTrips, dispatches, crateExports, allowanceContext] =
    await Promise.all([
      prisma.driverPayrollTrip.findMany({ where: { payrollMonthId } }),
      prisma.dispatchOrder.findMany({
        where: {
          status: { not: "cancelled" },
          driverName: driver.name,
          date: { gte: start, lte: end },
        },
        include: dispatchIncludeForPayroll,
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
      loadCrateReturnExports(start, end),
      loadPayrollAllowanceContext(),
    ]);

  const exportLookup = buildCrateReturnExportLookup(crateExports);
  const dispatchById = new Map(dispatches.map((order) => [order.id, order]));
  const linkedIds = new Set(
    existingTrips
      .map((trip) => trip.dispatchOrderId)
      .filter((id): id is string => Boolean(id))
  );

  for (const trip of existingTrips) {
    if (!trip.dispatchOrderId) continue;
    const order = dispatchById.get(trip.dispatchOrderId);
    if (!order) continue;

    const computed = computePayrollTripFields(
      order,
      allowanceContext,
      dispatchHasCrateReturn(order, exportLookup)
    );
    const storedAllowance = decimalToNumber(trip.tripAllowance) ?? 0;

    await prisma.driverPayrollTrip.update({
      where: { id: trip.id },
      data: {
        route: computed.routeLabel,
        markets: order.markets,
        marketCount: computed.marketCount,
        crateReturnCommission: computed.crateReturnCommission,
        truckType: order.truck.type,
        ...(storedAllowance === 0 && computed.autoTripAllowance > 0
          ? { tripAllowance: computed.autoTripAllowance }
          : {}),
      },
    });
  }

  const toCreate = dispatches.filter((order) => !linkedIds.has(order.id));
  if (toCreate.length === 0) return;

  await prisma.driverPayrollTrip.createMany({
    data: toCreate.map((order, index) => {
      const computed = computePayrollTripFields(
        order,
        allowanceContext,
        dispatchHasCrateReturn(order, exportLookup)
      );
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

export async function syncFleetPayrollForMonth(year: number, month: number) {
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
  const drivers = await prisma.driver.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  for (const driver of drivers) {
    const payrollMonth = await ensurePayrollMonth(driver.id, yearMonth);
    await syncDispatchTripsForMonth(
      payrollMonth.id,
      serializeDriverForSync(driver),
      year,
      month
    );
  }
}

export async function syncDriverPayrollForMonth(
  driverId: string,
  year: number,
  month: number
) {
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) throw new Error("司机不存在 Driver not found");

  const payrollMonth = await ensurePayrollMonth(driverId, yearMonth);
  await syncDispatchTripsForMonth(
    payrollMonth.id,
    serializeDriverForSync(driver),
    year,
    month
  );
}
