/**
 * Self-test: Thai large-tong codes independent of MY unload; rented vehicle costs.
 * Run: npx tsx --env-file=.env.local scripts/_selftest-thai-cost-rented-and-large-codes.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { LARGE_CRATE_CODES } from "../lib/driver-expense/constants";
import { prisma } from "../lib/prisma";
import { calendarDateUTC } from "../lib/reports/period-report-shared";
import {
  classifyThaiCostCrate,
  DEFAULT_THAI_COST_LARGE_TONG_TYPE_CODES,
} from "../lib/thai-cost/crate-classify";
import {
  ensureThaiCostRateSettings,
  loadCurrentThaiCostRates,
} from "../lib/thai-cost/rate-settings";
import { getSongkhlaMonthlyRealCost } from "../lib/thai-cost/songkhla-cost-service";
import { getPattaniMonthlyRealCost } from "../lib/thai-cost/pattani-cost-service";
import { calculateTripUnloadingFees } from "../lib/unloading-calculator";

const MARKER = "SELFTEST_RENTED";
const YEAR = 2026;
const MONTH = 9;

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];
function pass(name: string, detail: string) {
  checks.push({ name, ok: true, detail });
  console.log(`  PASS  ${name}: ${detail}`);
}
function fail(name: string, detail: string) {
  checks.push({ name, ok: false, detail });
  console.error(`  FAIL  ${name}: ${detail}`);
}

async function cleanup() {
  await prisma.thaiRentedVehicleTrip.deleteMany({
    where: { notes: { contains: MARKER } },
  });
}

async function main() {
  console.log("=== Thai large codes + rented vehicles self-test ===\n");

  const actor =
    (await prisma.user.findFirst({
      where: { active: true, role: "admin" },
      select: { id: true },
    })) ??
    (await prisma.user.findFirst({
      where: { active: true },
      select: { id: true },
    }));
  if (!actor) throw new Error("No user");

  await cleanup();
  await ensureThaiCostRateSettings();

  // MY unload constants unchanged
  if ([...LARGE_CRATE_CODES].sort().join(",") === "BS,VIO") {
    pass("MY LARGE_CRATE_CODES unchanged", "VIO,BS only");
  } else {
    fail("MY LARGE_CRATE_CODES unchanged", [...LARGE_CRATE_CODES].join(","));
  }

  const rates = await loadCurrentThaiCostRates();
  if (
    rates.largeTongTypeCodes.includes("GKS") &&
    rates.largeTongTypeCodes.includes("VIO")
  ) {
    pass("Thai large codes default", rates.largeTongTypeCodes.join(","));
  } else {
    fail("Thai large codes default", rates.largeTongTypeCodes.join(","));
  }

  if (
    classifyThaiCostCrate("GKS", false, rates.largeTongTypeCodes) === "large" &&
    classifyThaiCostCrate("GKS", false, [...LARGE_CRATE_CODES]) === "small"
  ) {
    pass("GKS large only for Thai cost", "Thai=large MY-set=small");
  } else {
    fail("GKS large only for Thai cost", "mismatch");
  }

  // MY unload fee regression sample
  const ratesByMarket = new Map([
    [
      "KL",
      {
        market: "KL",
        smallCrate: 1.5,
        largeCrate: 2,
        box: 1,
        kpbSmall: 0.5,
        kpbLarge: 0.6,
        kpbBox: 0.3,
        kpbMode: "per_crate",
        unloadMode: "per_crate",
        perTripSmallTruck: null as number | null,
        perTripLargeTruck: null as number | null,
        thirdPartyFlatUnload: null as number | null,
      },
    ],
  ]);
  // Simulate how MY classify works: GKS is small
  const gksAsSmall = calculateTripUnloadingFees({
    lines: [
      {
        market: "KL",
        storeCode: "A1",
        smallCrateQty: 10,
        largeCrateQty: 0,
        boxQty: 0,
      },
    ],
    ratesByMarket,
    truckSize: "large",
  });
  const vioAsLarge = calculateTripUnloadingFees({
    lines: [
      {
        market: "KL",
        storeCode: "A1",
        smallCrateQty: 0,
        largeCrateQty: 10,
        boxQty: 0,
      },
    ],
    ratesByMarket,
    truckSize: "large",
  });
  if (gksAsSmall[0].unloadFee === 15 && vioAsLarge[0].unloadFee === 20) {
    pass("MY unload fees unchanged", "GKS-as-small=15 VIO-as-large=20");
  } else {
    fail(
      "MY unload fees unchanged",
      `gks=${gksAsSmall[0].unloadFee} vio=${vioAsLarge[0].unloadFee}`
    );
  }

  // Rented vehicles
  await prisma.thaiRentedVehicleTrip.create({
    data: {
      date: calendarDateUTC(YEAR, MONTH, 1),
      station: "SONGKHLA",
      driverName: "BANHENG",
      truckPlate: "TEST-1",
      tripCost: 3500,
      notes: MARKER,
      createdBy: actor.id,
    },
  });
  await prisma.thaiRentedVehicleTrip.create({
    data: {
      date: calendarDateUTC(YEAR, MONTH, 1),
      station: "PATTANI",
      driverName: "SHS",
      tripCost: 4200,
      notes: MARKER,
      createdBy: actor.id,
    },
  });

  const sk = await getSongkhlaMonthlyRealCost(YEAR, MONTH);
  const pt = await getPattaniMonthlyRealCost(YEAR, MONTH);
  if (sk.rentedVehicleCostThb === 3500) {
    pass("songkhla rented cost", "3500");
  } else {
    fail("songkhla rented cost", String(sk.rentedVehicleCostThb));
  }
  if (pt.rentedVehicleCostThb === 4200) {
    pass("pattani rented cost", "4200");
  } else {
    fail("pattani rented cost", String(pt.rentedVehicleCostThb));
  }
  if (sk.realCostTotalThb >= 3500 && pt.realCostTotalThb >= 4200) {
    pass("rented included in real totals", "ok");
  } else {
    fail("rented included in real totals", `${sk.realCostTotalThb}/${pt.realCostTotalThb}`);
  }

  // Defaults constant still documents GKS
  if (DEFAULT_THAI_COST_LARGE_TONG_TYPE_CODES.includes("GKS")) {
    pass("default constant has GKS", "ok");
  } else {
    fail("default constant has GKS", "missing");
  }

  await cleanup();
  console.log("\nCleanup done.");

  const failed = checks.filter((c) => !c.ok);
  console.log(
    `\n=== Result: ${checks.length - failed.length}/${checks.length} passed ===`
  );
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
