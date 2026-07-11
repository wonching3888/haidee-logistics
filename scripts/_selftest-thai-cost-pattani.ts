/**
 * Formal acceptance self-test for Pattani Thai-vehicle PNL (THB).
 * Marker: SELFTEST_THAI_VEHICLE_PNL_PTN
 * Cleans up all rows it creates.
 *
 * Run: npx tsx --env-file=.env.local scripts/_selftest-thai-cost-pattani.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { getPattaniPnl } from "../lib/thai-cost/pattani-pnl";
import {
  thaiVehiclePnlHandlingFeeThb,
  thaiVehiclePnlIncomeThb,
  thaiVehiclePnlWeightedQty,
} from "../lib/thai-cost/thai-vehicle-pnl-calc";
import {
  THAI_DRIVER_OTHER_NAME,
  THAI_VEHICLE_RENTED_NOTES_PREFIX,
} from "../lib/thai-cost/thai-vehicle-pnl-constants";
import { ensureThaiOtherDriver } from "../lib/thai-cost/thai-driver-other";

const MARK = "SELFTEST_THAI_VEHICLE_PNL_PTN";
const YEAR = 2099;
const MONTH = 2;
const DATE = new Date("2099-02-10T00:00:00.000Z");

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
}

async function main() {
  console.log(`=== ${MARK} ===`);
  await cleanup();

  const createdBy = randomUUID();
  const otherId = await ensureThaiOtherDriver();
  const formal = await prisma.thaiDriver.upsert({
    where: { name: "P.NARONG" },
    create: { name: "P.NARONG", baseWage: 8000, active: true },
    update: { active: true },
  });

  await prisma.thaiMonthlyWorker.create({
    data: {
      name: `${MARK}-PTN-WORKER`,
      station: "PATTANI",
      monthlyWage: 2000,
      lunchAllowance: 0,
      fuelAllowance: 0,
      rentRoomAllowance: 0,
      active: true,
    },
  });
  await prisma.thaiMonthlyWorker.create({
    data: {
      name: `${MARK}-SADAO-WORKER`,
      station: "SADAO",
      monthlyWage: 88888,
      lunchAllowance: 0,
      fuelAllowance: 0,
      rentRoomAllowance: 0,
      active: true,
    },
  });

  await prisma.thaiVehicleTripDaily.create({
    data: {
      id: randomUUID(),
      date: DATE,
      truckPlate: "72-3353",
      driverId: formal.id,
      station: "PATTANI",
      tongQty: 8,
      boxQty: 2,
      notes: MARK,
      createdBy,
    },
  });

  await prisma.thaiVehicleTripDaily.create({
    data: {
      id: randomUUID(),
      date: DATE,
      truckPlate: "72-3353",
      driverId: otherId,
      station: "PATTANI",
      tongQty: 4,
      boxQty: 0,
      notes: MARK,
      createdBy,
    },
  });

  await prisma.thaiRentedVehicleTrip.create({
    data: {
      id: randomUUID(),
      date: DATE,
      station: "PATTANI",
      driverName: "SHS",
      truckPlate: "RENT-PTN",
      tripCost: 2200,
      notes: MARK,
      createdBy,
    },
  });
  await prisma.thaiVehicleTripDaily.create({
    data: {
      id: randomUUID(),
      date: DATE,
      truckPlate: "RENT-PTN",
      driverId: null,
      station: "PATTANI",
      tongQty: 3,
      boxQty: 1,
      notes: `${THAI_VEHICLE_RENTED_NOTES_PREFIX}SHS;${MARK}`,
      createdBy,
    },
  });

  const pnl = await getPattaniPnl(YEAR, MONTH);

  const expectedIncome =
    thaiVehiclePnlIncomeThb("PATTANI", 8, 2) +
    thaiVehiclePnlIncomeThb("PATTANI", 4, 0) +
    thaiVehiclePnlIncomeThb("PATTANI", 3, 1);
  assert(
    Math.abs(pnl.incomeThb - expectedIncome) < 0.02,
    `income ${pnl.incomeThb} ≈ ${expectedIncome}`
  );

  const expectedHandling =
    thaiVehiclePnlHandlingFeeThb("PATTANI", 8, 2) +
    thaiVehiclePnlHandlingFeeThb("PATTANI", 4, 0) +
    thaiVehiclePnlHandlingFeeThb("PATTANI", 3, 1);
  assert(
    Math.abs(pnl.handlingFeeThb - expectedHandling) < 0.02,
    `handling ${pnl.handlingFeeThb} ≈ ${expectedHandling}`
  );

  assert(pnl.driverTripBudgetThb === 1200 * 3, `budget ${pnl.driverTripBudgetThb}`);

  const otherTrip = pnl.trips.find((t) => t.isOtherDriver);
  assert(!!otherTrip, "other driver trip");
  assert(otherTrip!.driverTripBudgetThb === 1200, "other gets 1200");
  assert(otherTrip!.driverBaseWageAllocatedThb === 0, "other no base");

  const rented = pnl.trips.find((t) => t.isRented);
  assert(!!rented && rented.vehicleCostThb === 2200, "rented cost 2200");

  assert(
    pnl.monthlyWorkerStationTotalThb < 80000,
    `SADAO excluded (got ${pnl.monthlyWorkerStationTotalThb})`
  );
  assert(
    pnl.monthlyWorkerStationTotalThb >= 2000,
    `includes PTN workers (got ${pnl.monthlyWorkerStationTotalThb})`
  );

  // 4:1 weight check: trip1 w=8*4+2=34, trip2=16, trip3=3*4+1=13, total=63
  const w1 = thaiVehiclePnlWeightedQty("PATTANI", 8, 2);
  const w2 = thaiVehiclePnlWeightedQty("PATTANI", 4, 0);
  const w3 = thaiVehiclePnlWeightedQty("PATTANI", 3, 1);
  assert(w1 === 34 && w2 === 16 && w3 === 13, `weights ${w1}/${w2}/${w3}`);

  const other = await prisma.thaiDriver.findUnique({
    where: { id: otherId },
  });
  assert(other?.name === THAI_DRIVER_OTHER_NAME, "其他 stored as thai_drivers row");

  await cleanup();
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
