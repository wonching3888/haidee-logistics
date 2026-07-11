/**
 * Formal acceptance self-test for Songkhla Thai-vehicle PNL (THB).
 * Marker: SELFTEST_THAI_VEHICLE_PNL_SK
 * Cleans up all rows it creates.
 *
 * Run: npx tsx --env-file=.env.local scripts/_selftest-thai-cost-phase2-songkhla.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { getSongkhlaPnl } from "../lib/thai-cost/songkhla-pnl";
import {
  thaiVehiclePnlHandlingFeeThb,
  thaiVehiclePnlIncomeThb,
} from "../lib/thai-cost/thai-vehicle-pnl-calc";
import {
  THAI_DRIVER_OTHER_NAME,
  THAI_VEHICLE_RENTED_NOTES_PREFIX,
} from "../lib/thai-cost/thai-vehicle-pnl-constants";
import { ensureThaiOtherDriver } from "../lib/thai-cost/thai-driver-other";

const MARK = "SELFTEST_THAI_VEHICLE_PNL_SK";
const YEAR = 2099;
const MONTH = 1;
const DATE = new Date("2099-01-15T00:00:00.000Z");

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`PASS: ${msg}`);
}

async function cleanup() {
  await prisma.thaiVehicleTripDaily.deleteMany({
    where: { notes: { contains: MARK } },
  });
  await prisma.thaiRentedVehicleTrip.deleteMany({
    where: { notes: { contains: MARK } },
  });
  await prisma.thaiMonthlyWorker.deleteMany({
    where: { name: { contains: MARK } },
  });
  // Do not delete sentinel 其他 driver (shared).
}

async function main() {
  console.log(`=== ${MARK} ===`);
  await cleanup();

  const createdBy = randomUUID();
  const otherId = await ensureThaiOtherDriver();
  const formal = await prisma.thaiDriver.upsert({
    where: { name: "THONGDANG" },
    create: { name: "THONGDANG", baseWage: 8000, active: true },
    update: { active: true },
  });

  await prisma.thaiMonthlyWorker.create({
    data: {
      name: `${MARK}-SK-WORKER`,
      station: "SONGKHLA",
      monthlyWage: 1000,
      lunchAllowance: 0,
      fuelAllowance: 0,
      rentRoomAllowance: 0,
      active: true,
    },
  });
  // SADAO worker must NOT enter Songkhla PNL
  await prisma.thaiMonthlyWorker.create({
    data: {
      name: `${MARK}-SADAO-WORKER`,
      station: "SADAO",
      monthlyWage: 99999,
      lunchAllowance: 0,
      fuelAllowance: 0,
      rentRoomAllowance: 0,
      active: true,
    },
  });

  const truck = await prisma.truck.findFirst({
    where: { plate: { contains: "9389" } },
    include: { costItems: true },
  });

  // Formal trip
  await prisma.thaiVehicleTripDaily.create({
    data: {
      id: randomUUID(),
      date: DATE,
      truckPlate: truck?.plate ?? "PKM 9389",
      driverId: formal.id,
      station: "SONGKHLA",
      tongQty: 10,
      boxQty: 4,
      notes: MARK,
      createdBy,
    },
  });

  // Other driver trip — own-fleet cost, budget 700, no base wage
  await prisma.thaiVehicleTripDaily.create({
    data: {
      id: randomUUID(),
      date: DATE,
      truckPlate: truck?.plate ?? "PKM 9389",
      driverId: otherId,
      station: "SONGKHLA",
      tongQty: 2,
      boxQty: 0,
      notes: MARK,
      createdBy,
    },
  });

  // Rented trip
  await prisma.thaiRentedVehicleTrip.create({
    data: {
      id: randomUUID(),
      date: DATE,
      station: "SONGKHLA",
      driverName: "BANHENG",
      truckPlate: "RENT-SK",
      tripCost: 1500,
      notes: MARK,
      createdBy,
    },
  });
  await prisma.thaiVehicleTripDaily.create({
    data: {
      id: randomUUID(),
      date: DATE,
      truckPlate: "RENT-SK",
      driverId: null,
      station: "SONGKHLA",
      tongQty: 5,
      boxQty: 1,
      notes: `${THAI_VEHICLE_RENTED_NOTES_PREFIX}BANHENG;${MARK}`,
      createdBy,
    },
  });

  const pnl = await getSongkhlaPnl(YEAR, MONTH);

  const expectedIncome =
    thaiVehiclePnlIncomeThb("SONGKHLA", 10, 4) +
    thaiVehiclePnlIncomeThb("SONGKHLA", 2, 0) +
    thaiVehiclePnlIncomeThb("SONGKHLA", 5, 1);
  assert(
    Math.abs(pnl.incomeThb - expectedIncome) < 0.02,
    `income ${pnl.incomeThb} ≈ ${expectedIncome}`
  );

  const expectedHandling =
    thaiVehiclePnlHandlingFeeThb("SONGKHLA", 10, 4) +
    thaiVehiclePnlHandlingFeeThb("SONGKHLA", 2, 0) +
    thaiVehiclePnlHandlingFeeThb("SONGKHLA", 5, 1);
  assert(
    Math.abs(pnl.handlingFeeThb - expectedHandling) < 0.02,
    `handling ${pnl.handlingFeeThb} ≈ ${expectedHandling}`
  );

  assert(pnl.driverTripBudgetThb === 700 * 3, `driver budget ${pnl.driverTripBudgetThb}`);

  const otherTrip = pnl.trips.find((t) => t.isOtherDriver);
  assert(!!otherTrip, "other driver trip present");
  assert(otherTrip!.driverTripBudgetThb === 700, "other driver still gets 700");
  assert(otherTrip!.driverBaseWageAllocatedThb === 0, "other driver no base wage");
  assert(!otherTrip!.isRented, "other is not rented");

  const rentedTrip = pnl.trips.find((t) => t.isRented);
  assert(!!rentedTrip, "rented trip present");
  assert(rentedTrip!.vehicleCostThb === 1500, `rented cost ${rentedTrip!.vehicleCostThb}`);

  assert(
    pnl.monthlyWorkerStationTotalThb < 90000,
    `SADAO worker excluded (station total ${pnl.monthlyWorkerStationTotalThb})`
  );
  assert(
    pnl.monthlyWorkerStationTotalThb >= 1000,
    `includes SK workers (got ${pnl.monthlyWorkerStationTotalThb})`
  );
  assert(
    Math.abs(pnl.monthlyWorkerAllocatedThb - pnl.monthlyWorkerStationTotalThb) <
      0.02,
    `worker alloc sums to station total ${pnl.monthlyWorkerAllocatedThb}`
  );

  // Merge small+large check via pure helper already unit-tested; income uses trip tongQty.
  assert(pnl.station === "SONGKHLA", "station SONGKHLA");
  assert(typeof pnl.profitThb === "number", "profitThb present");

  await cleanup();
  // remove SADAO marker worker
  await prisma.thaiMonthlyWorker.deleteMany({
    where: { name: { contains: MARK } },
  });
  console.log("CLEANED");
  console.log("ALL PASS");
}

main()
  .catch(async (e) => {
    console.error(e);
    await cleanup().catch(() => undefined);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
