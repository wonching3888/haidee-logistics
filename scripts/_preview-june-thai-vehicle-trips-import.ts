/**
 * Preview: parse TRIP RECORD JUN 2026.xlsx → thai_vehicle_trip_daily plan (86 rows).
 * Also prints vehicle cost preview (dual-plate MYR→THB; TH trucks needs_review).
 *
 * Default: PREVIEW ONLY (no writes).
 * Write: --write  (vehicle trips only; does not touch thai_driver_trip_daily)
 *
 * Run: npx tsx --env-file=.env.local scripts/_preview-june-thai-vehicle-trips-import.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "crypto";
import { existsSync } from "fs";
import * as XLSX from "xlsx";
import { DEFAULT_EXCHANGE_RATE } from "../lib/constants/freight-settings";
import { yearMonthKey } from "../lib/constants/thai-cost";
import { decimalToNumber } from "../lib/freight-rates";
import { prisma } from "../lib/prisma";
import {
  calendarDateUTC,
  getMonthDateRange,
} from "../lib/reports/period-report-shared";
import {
  computeThaiVehicleTripCostThb,
  normalizeTruckPlate,
  type ThaiVehicleStation,
  type TruckCostInput,
} from "../lib/thai-cost/vehicle-trip-cost";

const YEAR = 2026;
const MONTH = 6;
const YM = yearMonthKey(YEAR, MONTH);
const DEFAULT_XLSX = "C:/Users/wonch/Downloads/TRIP RECORD JUN 2026.xlsx";
const WRITE = process.argv.includes("--write");
const NOTES_PREFIX = "JUNE2026_VEHICLE_TRIP";

const DRIVER_MAP: Record<string, string> = {
  DAENG: "THONGDANG",
  NARONG: "P.NARONG",
  CHAIRAT: "P.CHAIRAT",
  PONG: "P.PHONG",
};
const RENTED = new Set(["BANHENG", "SHS", "YIN"]);
const TRIP_SKIP_DAYS = new Set([7, 14, 21, 28, 30]);

type Area = "SK" | "PTN";

const UNKNOWN_RENTED: ReadonlyArray<{
  day: number;
  area: Area;
  truckNeedle: string;
  tong: number;
  box: number;
  rentedTag: string;
}> = [
  {
    day: 22,
    area: "SK",
    truckNeedle: "7218",
    tong: 50,
    box: 5,
    rentedTag: "UNKNOWN",
  },
  {
    day: 8,
    area: "PTN",
    truckNeedle: "",
    tong: 25,
    box: 0,
    rentedTag: "UNKNOWN",
  },
];

type RawTrip = {
  day: number;
  area: Area;
  driverRaw: string;
  truck: string;
  tong: number;
  box: number;
};

type VehicleTripPlan = {
  day: number;
  dateKey: string;
  date: Date;
  truckPlate: string;
  driverId: string | null;
  driverName: string | null;
  station: ThaiVehicleStation;
  tongQty: number;
  boxQty: number;
  notes: string;
  isFormal: boolean;
};

function normalizeDriver(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function parseArea(raw: unknown): Area | null {
  const a = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (a === "SK" || a === "SONGKHLA") return "SK";
  if (a === "PTN" || a === "PATTANI" || a === "PT") return "PTN";
  return null;
}

function isNumericTong(raw: unknown): boolean {
  if (typeof raw === "number" && Number.isFinite(raw)) return true;
  const s = String(raw ?? "").trim();
  return s !== "" && /^\d+(\.\d+)?$/.test(s);
}

function sheetDay(name: string): number | null {
  const n = name.trim();
  if (!n || /^BLANK$/i.test(n) || /工作表/.test(n)) return null;
  const m6 = n.match(/^(\d{1,2})6$/);
  if (m6) {
    const d = Number(m6[1]);
    if (d >= 1 && d <= 30) return d;
  }
  const m06 = n.match(/^(\d{1,2})06$/);
  if (m06) {
    const d = Number(m06[1]);
    if (d >= 1 && d <= 30) return d;
  }
  return null;
}

function findTripTableHeader(rows: unknown[][]): number {
  let titleIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const joined = rows[i]
      .map((c) => String(c ?? "").trim().toUpperCase())
      .join("|");
    if (joined.includes("TRIP IN THAILAND")) {
      titleIdx = i;
      break;
    }
  }
  const searchFrom = titleIdx >= 0 ? titleIdx : 0;
  const searchTo =
    titleIdx >= 0 ? Math.min(rows.length, titleIdx + 5) : rows.length;
  for (let i = searchFrom; i < searchTo; i++) {
    const row = rows[i].map((c) => String(c ?? "").trim().toUpperCase());
    if (row.includes("AREA") && row.includes("DRIVER") && row.includes("TONG")) {
      return i;
    }
  }
  return -1;
}

function colIndex(header: string[], ...names: string[]): number {
  for (const n of names) {
    const i = header.findIndex((h) => h === n || h.includes(n));
    if (i >= 0) return i;
  }
  return -1;
}

function formatPlate(raw: unknown): string {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(Math.trunc(raw));
  }
  return String(raw ?? "").trim();
}

function matchUnknownRented(t: RawTrip) {
  return UNKNOWN_RENTED.find((u) => {
    if (u.day !== t.day || u.area !== t.area) return false;
    if (u.tong !== t.tong || u.box !== t.box) return false;
    if (u.truckNeedle) {
      return normalizeTruckPlate(t.truck).includes(u.truckNeedle);
    }
    return true;
  });
}

function parseSheet(name: string, rows: unknown[][]): RawTrip[] {
  const day = sheetDay(name);
  if (day == null) return [];
  if (name.toUpperCase() === "BLANK" || /工作表\s*2/i.test(name)) return [];

  const headerIdx = findTripTableHeader(rows);
  if (headerIdx < 0) return [];

  const header = rows[headerIdx].map((c) =>
    String(c ?? "")
      .trim()
      .toUpperCase()
  );
  const iArea = colIndex(header, "AREA");
  const iDriver = colIndex(header, "DRIVER");
  const iTruck = colIndex(header, "TRUCK", "LORRY", "PLATE");
  const iTong = colIndex(header, "TONG");
  const iBox = colIndex(header, "BOX");
  if (iArea < 0 || iDriver < 0 || iTong < 0) return [];

  const trips: RawTrip[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const area = parseArea(row[iArea]);
    if (!area) {
      const cell0 = String(row[iArea] ?? "")
        .trim()
        .toUpperCase();
      if (
        cell0.includes("READY") ||
        cell0.includes("TRAILER") ||
        cell0.includes("REPAIR") ||
        cell0.includes("MAINT")
      ) {
        break;
      }
      if (!cell0) continue;
      if (cell0.length > 3 && !["SK", "PTN", "PT"].includes(cell0)) break;
      continue;
    }
    if (!isNumericTong(row[iTong])) break;

    trips.push({
      day,
      area,
      driverRaw: normalizeDriver(row[iDriver]),
      truck: formatPlate(iTruck >= 0 ? row[iTruck] : ""),
      tong: Number(row[iTong]),
      box:
        iBox >= 0 && row[iBox] !== "" && row[iBox] != null
          ? Number(row[iBox]) || 0
          : 0,
    });
  }
  return trips;
}

function buildPlan(
  allTrips: RawTrip[],
  idByName: Map<string, string>
): VehicleTripPlan[] {
  const plan: VehicleTripPlan[] = [];

  for (const t of allTrips) {
    if (TRIP_SKIP_DAYS.has(t.day)) continue;

    const station: ThaiVehicleStation =
      t.area === "SK" ? "SONGKHLA" : "PATTANI";
    const dateKey = `${YEAR}-06-${String(t.day).padStart(2, "0")}`;
    const date = calendarDateUTC(YEAR, MONTH, t.day);
    const plate = t.truck || "(NO_PLATE)";

    const unknown = matchUnknownRented(t);
    if (unknown) {
      plan.push({
        day: t.day,
        dateKey,
        date,
        truckPlate: plate,
        driverId: null,
        driverName: null,
        station,
        tongQty: t.tong,
        boxQty: t.box,
        notes: `${NOTES_PREFIX};RENTED:UNKNOWN`,
        isFormal: false,
      });
      continue;
    }

    if (RENTED.has(t.driverRaw)) {
      plan.push({
        day: t.day,
        dateKey,
        date,
        truckPlate: plate,
        driverId: null,
        driverName: t.driverRaw,
        station,
        tongQty: t.tong,
        boxQty: t.box,
        notes: `${NOTES_PREFIX};RENTED:${t.driverRaw}`,
        isFormal: false,
      });
      continue;
    }

    const official = DRIVER_MAP[t.driverRaw];
    if (official) {
      const driverId = idByName.get(official);
      if (!driverId) {
        throw new Error(`Missing driver id for ${official}`);
      }
      plan.push({
        day: t.day,
        dateKey,
        date,
        truckPlate: plate,
        driverId,
        driverName: official,
        station,
        tongQty: t.tong,
        boxQty: t.box,
        notes: NOTES_PREFIX,
        isFormal: true,
      });
      continue;
    }

    if (!t.driverRaw) {
      // blank driver not matched as UNKNOWN — still record as rented unknown
      plan.push({
        day: t.day,
        dateKey,
        date,
        truckPlate: plate,
        driverId: null,
        driverName: null,
        station,
        tongQty: t.tong,
        boxQty: t.box,
        notes: `${NOTES_PREFIX};RENTED:UNKNOWN`,
        isFormal: false,
      });
      continue;
    }

    console.warn(`SKIP unknown driver ${t.driverRaw} day=${t.day}`);
  }

  return plan;
}

async function main() {
  const xlsxPath =
    process.argv.find((a) => !a.startsWith("-") && a.endsWith(".xlsx")) ??
    DEFAULT_XLSX;

  console.log("============================================================");
  console.log(
    `June 2026 thai_vehicle_trip_daily — ${WRITE ? "WRITE" : "PREVIEW ONLY"}`
  );
  console.log("============================================================\n");

  if (!existsSync(xlsxPath)) throw new Error(`Excel not found: ${xlsxPath}`);

  const drivers = await prisma.thaiDriver.findMany({ where: { active: true } });
  const idByName = new Map(drivers.map((d) => [d.name, d.id]));

  const wb = XLSX.readFile(xlsxPath);
  const allTrips: RawTrip[] = [];
  for (const name of wb.SheetNames) {
    if (name.toUpperCase() === "BLANK" || /工作表\s*2/i.test(name)) continue;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], {
      header: 1,
      defval: "",
      raw: true,
    }) as unknown[][];
    allTrips.push(...parseSheet(name, rows));
  }

  const plan = buildPlan(allTrips, idByName);
  const formal = plan.filter((p) => p.isFormal);
  const rented = plan.filter((p) => !p.isFormal);

  console.log("=== Per-trip plan (one row = one Excel trip) ===");
  console.log(
    "date,truckPlate,driver,station,tongQty,boxQty,notes"
  );
  for (const p of plan) {
    console.log(
      [
        p.dateKey,
        p.truckPlate,
        p.driverName ?? "(null)",
        p.station,
        p.tongQty,
        p.boxQty,
        p.notes,
      ].join(",")
    );
  }

  console.log(`\nTotal rows: ${plan.length} (formal=${formal.length} rented=${rented.length})`);
  console.log(
    `ALIGN: formal ${formal.length} + rented ${rented.length} = ${plan.length} (expect 79+7=86)`
  );
  const aligned = formal.length === 79 && rented.length === 7 && plan.length === 86;
  console.log(aligned ? "ALIGN OK" : "ALIGN FAIL");

  console.log("\n=== By plate (trips / tong / box) ===");
  const byPlate = new Map<
    string,
    { trips: number; tong: number; box: number; stations: Set<string> }
  >();
  for (const p of plan) {
    const k = p.truckPlate;
    const cur = byPlate.get(k) ?? {
      trips: 0,
      tong: 0,
      box: 0,
      stations: new Set<string>(),
    };
    cur.trips += 1;
    cur.tong += p.tongQty;
    cur.box += p.boxQty;
    cur.stations.add(p.station);
    byPlate.set(k, cur);
  }
  for (const [plate, a] of [...byPlate.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    console.log(
      `  ${plate}: trips=${a.trips} tong=${a.tong} box=${a.box} stations=${[...a.stations].join("|")}`
    );
  }

  // Vehicle cost preview
  const { start, end } = getMonthDateRange(YEAR, MONTH);
  void start;
  void end;
  const [routes, trucks, fuel, fxRow] = await Promise.all([
    prisma.routeMaster.findMany({
      where: { code: { in: ["SONGKHLA", "PATTANI"] } },
    }),
    prisma.truck.findMany({ include: { costItems: true } }),
    prisma.fuelPrice.findUnique({ where: { id: "default" } }),
    prisma.exchangeRate.findUnique({ where: { yearMonth: YM } }),
  ]);

  console.log("\n=== Routes ===");
  for (const r of routes) {
    console.log(`  ${r.code}: mileage=${r.sadooMileageKm} markets=${r.markets}`);
  }

  const fuelPrice = {
    myrPerLiter: decimalToNumber(fuel?.myrPerLiter) ?? 2.15,
    thbPerLiter: decimalToNumber(fuel?.thbPerLiter) ?? 40,
  };
  const exchangeRate =
    decimalToNumber(fxRow?.rate) ?? DEFAULT_EXCHANGE_RATE;

  const trucksByNorm = new Map<string, TruckCostInput>();
  for (const t of trucks) {
    trucksByNorm.set(normalizeTruckPlate(t.plate), {
      plate: t.plate,
      country: t.country,
      fuelEfficiencyKmPerL: decimalToNumber(t.fuelEfficiencyKmPerL),
      annualMileageKm: t.annualMileageKm,
      costItems: t.costItems.map((c) => ({
        annualAmount: decimalToNumber(c.annualAmount) ?? 0,
      })),
    });
  }

  console.log("\n=== Vehicle cost preview (THB) ===");
  console.log(`FX=${exchangeRate} (MYR→THB: costMyr * FX)`);
  let totalCost = 0;
  let needsReview = 0;
  const costByPlate = new Map<
    string,
    { trips: number; costThb: number; needsReview: boolean }
  >();

  for (const p of plan) {
    const truck = trucksByNorm.get(normalizeTruckPlate(p.truckPlate)) ?? null;
    const result = computeThaiVehicleTripCostThb({
      truckPlate: p.truckPlate,
      station: p.station,
      truck,
      routes: routes.map((r) => ({
        code: r.code,
        sadooMileageKm: decimalToNumber(r.sadooMileageKm),
        tollFee: decimalToNumber(r.tollFee),
        parkingFee: decimalToNumber(r.parkingFee),
      })),
      fuelPrice,
      exchangeRateMyrPerThbUnit: exchangeRate,
    });
    totalCost = Math.round((totalCost + result.tripCostThb) * 100) / 100;
    if (result.needsReview) needsReview += 1;
    const norm = normalizeTruckPlate(p.truckPlate);
    const cur = costByPlate.get(norm) ?? {
      trips: 0,
      costThb: 0,
      needsReview: false,
    };
    cur.trips += 1;
    cur.costThb = Math.round((cur.costThb + result.tripCostThb) * 100) / 100;
    cur.needsReview = cur.needsReview || result.needsReview;
    costByPlate.set(norm, cur);
  }

  for (const [plate, a] of [...costByPlate.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    console.log(
      `  ${plate}: trips=${a.trips} costThb=${a.costThb}${a.needsReview ? " needs_review" : ""}`
    );
  }
  console.log(
    `Total vehicle cost THB=${totalCost} needs_review_trips=${needsReview}`
  );

  // Dual-plate presence
  const dual = plan.filter((p) => {
    const n = normalizeTruckPlate(p.truckPlate);
    return n === "PKM9389" || n === "PKS7679";
  });
  console.log(`\nDual-plate trips in June Excel: ${dual.length}`);

  if (!aligned) {
    throw new Error(
      `Trip alignment failed: formal=${formal.length} rented=${rented.length} total=${plan.length}`
    );
  }

  if (!WRITE) {
    console.log("\n*** PREVIEW ONLY — no database writes for vehicle trips. ***");
    console.log("Re-run with --write after confirmation.");
    return;
  }

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

  // Replace prior import for June notes prefix
  const { start: mStart, end: mEnd } = getMonthDateRange(YEAR, MONTH);
  await prisma.thaiVehicleTripDaily.deleteMany({
    where: {
      date: { gte: mStart, lte: mEnd },
      notes: { startsWith: NOTES_PREFIX },
    },
  });

  for (const p of plan) {
    await prisma.thaiVehicleTripDaily.create({
      data: {
        id: randomUUID(),
        date: p.date,
        truckPlate: p.truckPlate,
        driverId: p.driverId,
        station: p.station,
        tongQty: p.tongQty,
        boxQty: p.boxQty,
        notes: p.notes,
        createdBy: actor.id,
      },
    });
  }

  const written = await prisma.thaiVehicleTripDaily.count({
    where: {
      date: { gte: mStart, lte: mEnd },
      notes: { startsWith: NOTES_PREFIX },
    },
  });
  console.log(`\nWRITE COMPLETE: ${written} rows (expect 86)`);
  if (written !== 86) throw new Error(`Write count mismatch: ${written}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
