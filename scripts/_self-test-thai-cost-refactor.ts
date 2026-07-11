/**
 * Self-test for Thai cost module refactor.
 * Run: npx tsx --env-file=.env.local scripts/_self-test-thai-cost-refactor.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "../lib/prisma";
import { getSadaoMonthlyCost } from "../lib/thai-cost/sadao-cost-service";
import {
  computeSadaoBillableCrates,
  computeSadaoHandlingCommission,
} from "../lib/thai-cost/sadao-cost";
import { computeThaiVehicleTripCostThb } from "../lib/thai-cost/vehicle-trip-cost";
import { computeVehicleTripIncomeThb } from "../lib/thai-cost/vehicle-trip-income";
import { compareManualVsDispatchCrates } from "../lib/thai-cost/dispatch-cross-check";
import { getDailyOverview } from "../lib/thai-cost/daily-overview";
import { getSadaoVoucherForDate } from "../lib/thai-cost/sadao-voucher";
import { resolveThaiCostRatesForMonth } from "../lib/thai-cost/rate-settings";
import { parseThaiSegmentRates } from "../lib/constants/thai-segment-rates";
import { listGlobalCostSettings } from "../lib/global-cost-settings-service";

const EXPECTED_JUNE_SADAO_TOTAL = 309661;
const YEAR = 2026;
const MONTH = 6;

const ROUTES = [
  { code: "SONGKHLA", sadooMileageKm: 180, tollFee: 0, parkingFee: 0 },
  { code: "PATTANI", sadooMileageKm: 280, tollFee: 0, parkingFee: 0 },
];
const FUEL = { myrPerLiter: 2.15, thbPerLiter: 40 };
const FX = 8.2;

function pass(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `: ${detail}` : ""}`);
  return ok;
}

async function main() {
  console.log("=== Thai Cost Refactor Self-Test ===\n");
  let allOk = true;

  // 1. June Sadao regression
  const juneCost = await getSadaoMonthlyCost(YEAR, MONTH);
  const regOk = juneCost.totalCostThb === EXPECTED_JUNE_SADAO_TOTAL;
  allOk = pass(
    "June 2026 Sadao total cost",
    regOk,
    `${juneCost.totalCostThb} THB (expected ${EXPECTED_JUNE_SADAO_TOTAL})`
  ) && allOk;

  // 2. Direct (直达) billing deduction
  const billable = computeSadaoBillableCrates({
    smallCrateTotalQty: 100,
    largeCrateTotalQty: 50,
    boxTotalQty: 20,
    smallCrateNoCheckQty: 10,
    largeCrateNoCheckQty: 5,
    boxNoCheckQty: 2,
  });
  allOk =
    pass(
      "Direct qty deduction",
      billable.smallBillableQty === 90 &&
        billable.largeBillableQty === 45 &&
        billable.boxBillableQty === 18
    ) && allOk;

  const commission = computeSadaoHandlingCommission(
    {
      smallCrateTotalQty: 100,
      largeCrateTotalQty: 50,
      boxTotalQty: 20,
      smallCrateNoCheckQty: 10,
      largeCrateNoCheckQty: 5,
      boxNoCheckQty: 2,
    },
    { holidayRate: false }
  );
  allOk =
    pass(
      "Commission on billable qty",
      commission.totalCommissionThb === 90 * 3 + 45 * 4 + 18 * 3
    ) && allOk;

  // 3. Driver trip dual-table (dry run structure check)
  const vehicleTable = await prisma.thaiVehicleTripDaily.count({
    where: {
      date: {
        gte: new Date(Date.UTC(YEAR, MONTH - 1, 1)),
        lte: new Date(Date.UTC(YEAR, MONTH, 0)),
      },
    },
  });
  const driverTable = await prisma.thaiDriverTripDaily.count({
    where: {
      date: {
        gte: new Date(Date.UTC(YEAR, MONTH - 1, 1)),
        lte: new Date(Date.UTC(YEAR, MONTH, 0)),
      },
    },
  });
  allOk =
    pass(
      "June vehicle + driver trip tables populated",
      vehicleTable > 0 && driverTable > 0,
      `vehicle=${vehicleTable} driver=${driverTable}`
    ) && allOk;

  // 4. PKM9389 vehicle cost
  const pkmTruck = {
    plate: "PKM 9389",
    country: "MY",
    fuelEfficiencyKmPerL: 2.5,
    annualMileageKm: 100000,
    costItems: [
      { annualAmount: 50000 },
      { annualAmount: 2200 },
      { annualAmount: 3228 },
      { annualAmount: 1000 },
    ],
  };
  const pkmCost = computeThaiVehicleTripCostThb({
    truckPlate: "PKM 9389",
    station: "SONGKHLA",
    truck: pkmTruck,
    routes: ROUTES,
    fuelPrice: FUEL,
    exchangeRateMyrPerThbUnit: FX,
  });
  allOk =
    pass(
      "PKM9389 Songkhla trip cost",
      !pkmCost.needsReview && pkmCost.tripCostThb > 2000,
      `${pkmCost.tripCostThb} THB`
    ) && allOk;

  const globalSettings = await listGlobalCostSettings();
  const segmentRates = parseThaiSegmentRates(globalSettings);
  const income = computeVehicleTripIncomeThb(
    "SONGKHLA",
    { tongQty: 10, boxQty: 2 },
    segmentRates
  );
  allOk =
    pass(
      "Vehicle income uses segment rates",
      income >= 0,
      `${income} THB for 10 tong + 2 box`
    ) && allOk;

  // 5. Cross-check (non-blocking)
  const rates = await resolveThaiCostRatesForMonth(YEAR, MONTH);
  const crossCheck = await compareManualVsDispatchCrates({
    year: YEAR,
    month: MONTH,
    station: "SONGKHLA",
    largeTongTypeCodes: rates.largeTongTypeCodes,
  });
  allOk =
    pass(
      "Cross-check runs without error",
      crossCheck.manualTotal >= 0 && crossCheck.dispatchTotal >= 0,
      crossCheck.message ?? `gap=${crossCheck.gap} (within threshold)`
    ) && allOk;

  // 6. Daily overview — no merged total
  const overview = await getDailyOverview(`${YEAR}-06-15`);
  const hasSections =
    overview.sadao != null ||
    overview.songkhla != null ||
    overview.pattani != null;
  allOk =
    pass(
      "Daily overview loads for 2026-06-15",
      hasSections,
      `sadao=${!!overview.sadao} sk=${!!overview.songkhla} ptn=${!!overview.pattani}`
    ) && allOk;

  // 7. Voucher
  const voucher = await getSadaoVoucherForDate(`${YEAR}-06-15`);
  allOk =
    pass(
      "Sadao voucher for 2026-06-15",
      voucher != null && voucher.totalThb >= 0,
      voucher ? `${voucher.totalThb} THB` : "null"
    ) && allOk;

  console.log(`\n=== ${allOk ? "ALL PASSED" : "SOME FAILED"} ===`);
  if (!allOk) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
