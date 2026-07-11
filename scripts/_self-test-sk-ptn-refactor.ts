/**
 * Self-test: route MY/TH split, SK/PTN handling automation, vehicle cost regression.
 * Run: npx tsx --env-file=.env.local scripts/_self-test-sk-ptn-refactor.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "../lib/prisma";
import { decimalToNumber } from "../lib/freight-rates";
import {
  aggregateDispatchCrateTotalForMonth,
} from "../lib/thai-cost/dispatch-crate-aggregate";
import { resolveThaiCostRatesForMonth } from "../lib/thai-cost/rate-settings";
import {
  computeThaiVehicleTripCostThb,
} from "../lib/thai-cost/vehicle-trip-cost";
import {
  isMalaysiaPayrollRouteCode,
  isThaiRouteMasterCode,
  THAI_ROUTE_MASTER_CODES,
} from "../lib/constants/thai-route-masters";

const YEAR = 2026;
const MONTH = 6;
const EXPECT_SK_DISPATCH = 3069;
const EXPECT_PTN_DISPATCH = 5822;

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`✓ ${msg}`);
}

async function main() {
  console.log("=== 1. MY payroll route filter ===");
  const allRoutes = await prisma.routeMaster.findMany({
    where: { active: true },
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
  });
  const payrollCodes = allRoutes
    .filter((r) => isMalaysiaPayrollRouteCode(r.code))
    .map((r) => r.code);
  assert(!payrollCodes.includes("SONGKHLA"), "payroll routes exclude SONGKHLA");
  assert(!payrollCodes.includes("PATTANI"), "payroll routes exclude PATTANI");
  assert(payrollCodes.includes("BM"), "payroll routes still include BM");

  console.log("\n=== 2. route_masters data intact ===");
  for (const code of THAI_ROUTE_MASTER_CODES) {
    const r = await prisma.routeMaster.findUnique({ where: { code } });
    assert(Boolean(r), `${code} row exists`);
    assert(
      decimalToNumber(r!.sadooMileageKm)! > 0,
      `${code} mileage=${decimalToNumber(r!.sadooMileageKm)}`
    );
    assert(isThaiRouteMasterCode(code), `${code} isThaiRouteMasterCode`);
    assert(!isMalaysiaPayrollRouteCode(code), `${code} not MY payroll`);
  }

  console.log("\n=== 3. June dispatch pickup totals ===");
  const rates = await resolveThaiCostRatesForMonth(YEAR, MONTH);
  const skTotal = await aggregateDispatchCrateTotalForMonth(
    YEAR,
    MONTH,
    "SONGKHLA",
    rates.largeTongTypeCodes
  );
  const ptnTotal = await aggregateDispatchCrateTotalForMonth(
    YEAR,
    MONTH,
    "PATTANI",
    rates.largeTongTypeCodes
  );
  console.log(`  SONGKHLA dispatch total=${skTotal} (expected ${EXPECT_SK_DISPATCH})`);
  console.log(`  PATTANI dispatch total=${ptnTotal} (expected ${EXPECT_PTN_DISPATCH})`);
  assert(skTotal === EXPECT_SK_DISPATCH, `SONGKHLA June dispatch=${skTotal}`);
  assert(ptnTotal === EXPECT_PTN_DISPATCH, `PATTANI June dispatch=${ptnTotal}`);

  console.log("\n=== 4. Vehicle cost regression (PKM9389) ===");
  const routes = await prisma.routeMaster.findMany({
    where: { code: { in: ["SONGKHLA", "PATTANI"] } },
  });
  const routeRows = routes.map((r) => ({
    code: r.code,
    sadooMileageKm: decimalToNumber(r.sadooMileageKm),
    tollFee: decimalToNumber(r.tollFee),
    parkingFee: decimalToNumber(r.parkingFee),
  }));
  const truck = await prisma.truck.findFirst({
    where: { plate: { contains: "9389", mode: "insensitive" } },
    include: { costItems: true },
  });
  assert(Boolean(truck), "PKM9389 truck found");
  const truckInput = {
    plate: truck!.plate,
    country: truck!.country,
    fuelEfficiencyKmPerL: decimalToNumber(truck!.fuelEfficiencyKmPerL),
    annualMileageKm: truck!.annualMileageKm,
    costItems: truck!.costItems.map((c) => ({
      annualAmount: decimalToNumber(c.annualAmount) ?? 0,
    })),
  };
  const fuelPrice = await prisma.fuelPrice.findUnique({
    where: { id: "default" },
  });
  const fp = {
    myrPerLiter: decimalToNumber(fuelPrice?.myrPerLiter) ?? 2.5,
    thbPerLiter: decimalToNumber(fuelPrice?.thbPerLiter) ?? 30,
  };
  const ex = await prisma.exchangeRate.findUnique({
    where: { yearMonth: "2026-06" },
  });
  const fx = decimalToNumber(ex?.rate) ?? 8.2;

  const skCost = computeThaiVehicleTripCostThb({
    truckPlate: truck!.plate,
    station: "SONGKHLA",
    truck: truckInput,
    routes: routeRows,
    fuelPrice: fp,
    exchangeRateMyrPerThbUnit: fx,
  });
  console.log(
    `  PKM9389 SONGKHLA: distance=${skCost.distanceKm} cost=${skCost.tripCostThb} review=${skCost.needsReview}`
  );
  const skRoute = routes.find((r) => r.code === "SONGKHLA")!;
  const skToll = decimalToNumber(skRoute.tollFee) ?? 0;
  const skPark = decimalToNumber(skRoute.parkingFee) ?? 0;
  const expectedSk =
    Math.round((2102.27 + skToll + skPark) * 100) / 100;
  assert(skCost.distanceKm === 180, "PKM9389 uses 180km SONGKHLA");
  assert(
    Math.abs(skCost.tripCostThb - expectedSk) < 0.02,
    `PKM9389 trip cost ≈${expectedSk} (got ${skCost.tripCostThb}, toll=${skToll} parking=${skPark})`
  );

  console.log("\n=== 5. Thai route toll/parking fields readable ===");
  assert(
    decimalToNumber(skRoute.tollFee) === 0 || skRoute.tollFee != null,
    `SONGKHLA tollFee readable (${decimalToNumber(skRoute.tollFee)})`
  );
  assert(
    decimalToNumber(skRoute.parkingFee) === 0 || skRoute.parkingFee != null,
    `SONGKHLA parkingFee readable (${decimalToNumber(skRoute.parkingFee)})`
  );

  console.log("\n=== ALL PASSED ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
