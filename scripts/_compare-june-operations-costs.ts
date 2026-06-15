import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { decimalToNumber } from "@/lib/freight-rates";
import { aggregateOperationsCosts } from "@/lib/operations-cost";
import {
  estimateTruckMonthlyCosts,
} from "@/lib/operations-dashboard";
import { DEFAULT_FUEL_PRICES } from "@/lib/constants/truck-cost";
import { listGlobalCostSettings } from "@/lib/global-cost-settings-service";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function loadLegacyTripCosts(year: number, month: number) {
  const { getMonthDateRange } = await import("@/lib/reports/period-report-shared");
  const { start, end } = getMonthDateRange(year, month);

  const [markets, dispatches] = await Promise.all([
    prisma.market.findMany({
      where: { active: true },
      select: { code: true, tollFee: true },
    }),
    prisma.dispatchOrder.findMany({
      where: {
        status: { not: "cancelled" },
        date: { gte: start, lte: end },
      },
      select: { markets: true },
    }),
  ]);

  const marketByCode = new Map(markets.map((m) => [m.code, m]));
  let tollFee = 0;
  for (const dispatch of dispatches) {
    const visited = new Set<string>();
    for (const code of dispatch.markets) {
      if (!code || visited.has(code)) continue;
      visited.add(code);
      tollFee += decimalToNumber(marketByCode.get(code)?.tollFee) ?? 0;
    }
  }
  return { tollFee: Math.round(tollFee * 100) / 100, tripCount: dispatches.length };
}

async function main() {
  const year = 2026;
  const month = 6;

  const [newCosts, globalCosts, fuelPriceRow, trucks] = await Promise.all([
    aggregateOperationsCosts(year, month),
    listGlobalCostSettings(),
    prisma.fuelPrice.findUnique({ where: { id: "default" } }),
    prisma.truck.findMany({
      where: { active: true, country: "MY" },
      include: { costItems: true },
    }),
  ]);

  const byKey = new Map(globalCosts.map((row) => [row.key, row.valueMyr]));
  const fuelPriceMyr =
    byKey.get("fuel_price_myr") ??
    decimalToNumber(fuelPriceRow?.myrPerLiter) ??
    DEFAULT_FUEL_PRICES.myrPerLiter;

  const legacyTruckCosts = estimateTruckMonthlyCosts({
    trucks: trucks.map((truck) => ({
      country: truck.country,
      active: truck.active,
      annualMileageKm: truck.annualMileageKm,
      fuelEfficiencyKmPerL: decimalToNumber(truck.fuelEfficiencyKmPerL),
      costItems: truck.costItems.map((item) => ({
        annualAmount: decimalToNumber(item.annualAmount) ?? 0,
      })),
    })),
    fuelPriceMyr,
  });

  const legacyTripCosts = await loadLegacyTripCosts(year, month);

  const before = {
    fuelMyr: legacyTruckCosts.fuelMyr,
    maintenanceMyr: legacyTruckCosts.maintenanceMyr,
    tollFee: legacyTripCosts.tollFee,
    fishCheckingFee: 0,
    parkingFee: 0,
    borderPass: 0,
    epermit: 0,
    dagangNet: 0,
    forwarding: 0,
    tripCount: legacyTripCosts.tripCount,
    note: "油费/维修按全年里程÷12估算；过路费按市场 toll 叠加",
  };

  const after = {
    fuelMyr: newCosts.fuelMyr,
    maintenanceMyr: newCosts.maintenanceMyr,
    tollFee: newCosts.tollFee,
    fishCheckingFee: newCosts.fishCheckingFee,
    parkingFee: newCosts.parkingFee,
    borderPass: newCosts.borderPass,
    epermit: newCosts.epermit,
    dagangNet: newCosts.dagangNet,
    forwarding: newCosts.forwarding,
    crateRental: newCosts.crateRental,
    loadUnloadFee: newCosts.loadUnloadFee,
    tripCount: newCosts.tripCount,
    totalMileageKm: newCosts.totalMileageKm,
    note: "按实际派车趟次×最高路线里程；路线费用按 route_masters",
  };

  const delta = Object.fromEntries(
    (
      [
        "fuelMyr",
        "maintenanceMyr",
        "tollFee",
        "fishCheckingFee",
        "parkingFee",
        "borderPass",
        "epermit",
        "dagangNet",
        "forwarding",
      ] as const
    ).map((key) => [key, round(after[key] - before[key])])
  );

  console.log(
    JSON.stringify(
      {
        year,
        month,
        before,
        after,
        delta,
      },
      null,
      2
    )
  );
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
