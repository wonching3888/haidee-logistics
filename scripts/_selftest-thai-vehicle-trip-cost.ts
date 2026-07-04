/**
 * Self-test: Thai routes, TH trucks needs_review, dual-plate cost, vehicle trip rows.
 * Run: npx tsx --env-file=.env.local scripts/_selftest-thai-vehicle-trip-cost.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { calendarDateUTC } from "../lib/reports/period-report-shared";
import { decimalToNumber } from "../lib/freight-rates";
import {
  computeThaiVehicleTripCostThb,
  normalizeTruckPlate,
  type TruckCostInput,
} from "../lib/thai-cost/vehicle-trip-cost";

const MARKER = "SELFTEST_VEHICLE_TRIP";
const YEAR = 2026;
const MONTH = 10;

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
  await prisma.thaiVehicleTripDaily.deleteMany({
    where: { notes: { contains: MARKER } },
  });
}

async function main() {
  console.log("=== Thai vehicle trip cost self-test ===\n");

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

  // Routes
  const routes = await prisma.routeMaster.findMany({
    where: { code: { in: ["SONGKHLA", "PATTANI"] } },
  });
  const sk = routes.find((r) => r.code === "SONGKHLA");
  const pt = routes.find((r) => r.code === "PATTANI");
  if (sk && Number(sk.sadooMileageKm) === 180) {
    pass("route SONGKHLA", "180 km");
  } else {
    fail("route SONGKHLA", JSON.stringify(sk));
  }
  if (pt && Number(pt.sadooMileageKm) === 280) {
    pass("route PATTANI", "280 km");
  } else {
    fail("route PATTANI", JSON.stringify(pt));
  }

  // TH trucks
  const thPlates = ["72-3353", "72-3338", "72-3869", "70-9522"];
  const thTrucks = await prisma.truck.findMany({
    where: { plate: { in: thPlates } },
    include: { costItems: true },
  });
  if (thTrucks.length === 4 && thTrucks.every((t) => t.country === "TH")) {
    pass("TH trucks exist", thPlates.join(","));
  } else {
    fail("TH trucks exist", `count=${thTrucks.length}`);
  }

  const fuel = await prisma.fuelPrice.findUnique({ where: { id: "default" } });
  const fuelPrice = {
    myrPerLiter: decimalToNumber(fuel?.myrPerLiter) ?? 2.15,
    thbPerLiter: decimalToNumber(fuel?.thbPerLiter) ?? 40,
  };
  const routeRows = routes.map((r) => ({
    code: r.code,
    sadooMileageKm: decimalToNumber(r.sadooMileageKm),
  }));

  // TH truck needs_review
  const th = thTrucks[0];
  const thInput: TruckCostInput = {
    plate: th.plate,
    country: th.country,
    fuelEfficiencyKmPerL: decimalToNumber(th.fuelEfficiencyKmPerL),
    annualMileageKm: th.annualMileageKm,
    costItems: th.costItems.map((c) => ({
      annualAmount: decimalToNumber(c.annualAmount) ?? 0,
    })),
  };
  const thCost = computeThaiVehicleTripCostThb({
    truckPlate: th.plate,
    station: "SONGKHLA",
    truck: thInput,
    routes: routeRows,
    fuelPrice,
    exchangeRateMyrPerThbUnit: 8.2,
  });
  if (thCost.needsReview && thCost.tripCostThb === 0) {
    pass("TH truck needs_review cost=0", th.plate);
  } else {
    fail("TH truck needs_review cost=0", JSON.stringify(thCost));
  }

  // Dual-plate PKM 9389
  const pkm = await prisma.truck.findUnique({
    where: { plate: "PKM 9389" },
    include: { costItems: true },
  });
  if (!pkm) {
    fail("PKM 9389 exists", "missing");
  } else {
    const pkmInput: TruckCostInput = {
      plate: pkm.plate,
      country: pkm.country,
      fuelEfficiencyKmPerL: decimalToNumber(pkm.fuelEfficiencyKmPerL),
      annualMileageKm: pkm.annualMileageKm,
      costItems: pkm.costItems.map((c) => ({
        annualAmount: decimalToNumber(c.annualAmount) ?? 0,
      })),
    };
    const pkmCost = computeThaiVehicleTripCostThb({
      truckPlate: pkm.plate,
      station: "SONGKHLA",
      truck: pkmInput,
      routes: routeRows,
      fuelPrice,
      exchangeRateMyrPerThbUnit: 8.2,
    });
    // ~1.4243 MYR/km * 8.2 * 180
    const expected = Math.round(1.4243 * 8.2 * 180 * 100) / 100;
    if (
      !pkmCost.needsReview &&
      Math.abs(pkmCost.tripCostThb - expected) < 1
    ) {
      pass(
        "PKM 9389 Songkhla cost",
        `${pkmCost.tripCostThb} ≈ ${expected} THB`
      );
    } else {
      fail("PKM 9389 Songkhla cost", JSON.stringify(pkmCost));
    }

    const pkmPtn = computeThaiVehicleTripCostThb({
      truckPlate: pkm.plate,
      station: "PATTANI",
      truck: pkmInput,
      routes: routeRows,
      fuelPrice,
      exchangeRateMyrPerThbUnit: 8.2,
    });
    const expectedPtn = Math.round(1.4243 * 8.2 * 280 * 100) / 100;
    if (Math.abs(pkmPtn.tripCostThb - expectedPtn) < 1) {
      pass("PKM 9389 Pattani cost", `${pkmPtn.tripCostThb} ≈ ${expectedPtn}`);
    } else {
      fail("PKM 9389 Pattani cost", JSON.stringify(pkmPtn));
    }
  }

  // Insert sample vehicle trips (formal + rented + TH truck)
  const driver = await prisma.thaiDriver.findFirst({
    where: { name: "THONGDANG" },
  });
  if (!driver) throw new Error("THONGDANG missing");

  const samples = [
    {
      plate: "72-3353",
      driverId: driver.id,
      station: "SONGKHLA",
      tong: 100,
      box: 2,
      notes: `${MARKER};formal`,
    },
    {
      plate: "PKM 9389",
      driverId: driver.id,
      station: "PATTANI",
      tong: 50,
      box: 0,
      notes: `${MARKER};dual`,
    },
    {
      plate: "7218",
      driverId: null,
      station: "SONGKHLA",
      tong: 50,
      box: 5,
      notes: `${MARKER};RENTED:UNKNOWN`,
    },
  ];

  for (const s of samples) {
    await prisma.thaiVehicleTripDaily.create({
      data: {
        id: randomUUID(),
        date: calendarDateUTC(YEAR, MONTH, 5),
        truckPlate: s.plate,
        driverId: s.driverId,
        station: s.station,
        tongQty: s.tong,
        boxQty: s.box,
        notes: s.notes,
        createdBy: actor.id,
      },
    });
  }

  const rows = await prisma.thaiVehicleTripDaily.findMany({
    where: { notes: { contains: MARKER } },
  });
  if (rows.length === 3) {
    pass("vehicle trip rows inserted", "3 sample rows");
  } else {
    fail("vehicle trip rows inserted", `count=${rows.length}`);
  }

  const rented = rows.find((r) => r.notes?.includes("RENTED:UNKNOWN"));
  if (rented && rented.driverId == null && rented.truckPlate === "7218") {
    pass("rented trip driverId null", rented.notes ?? "");
  } else {
    fail("rented trip driverId null", JSON.stringify(rented));
  }

  const formal = rows.find((r) => r.truckPlate === "72-3353");
  if (formal && formal.driverId === driver.id && formal.tongQty === 100) {
    pass("formal trip plate+driver+tong", "72-3353");
  } else {
    fail("formal trip plate+driver+tong", JSON.stringify(formal));
  }

  // Plate normalize match for dual
  const dualRow = rows.find(
    (r) => normalizeTruckPlate(r.truckPlate) === "PKM9389"
  );
  if (dualRow) pass("dual plate stored", dualRow.truckPlate);
  else fail("dual plate stored", "missing");

  await cleanup();
  console.log("\nCleanup done.");

  const failed = checks.filter((c) => !c.ok);
  console.log(
    `\n=== Result: ${checks.length - failed.length}/${checks.length} passed ===`
  );
  if (failed.length > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
