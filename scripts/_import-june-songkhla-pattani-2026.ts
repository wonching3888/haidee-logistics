/**
 * June 2026 Songkhla / Pattani import:
 *   1) thai_driver_trip_daily (formal drivers only)
 *   2) songkhla_crate_handling_daily / pattani_crate_handling_daily
 *      (dispatch assigned qty by pickup; Thai large codes VIO/BS/GKS)
 *   3) lock rate + segment internal-cost snapshots for 2026-06
 *   4) print real cost + P&L (excluding external rented-vehicle cost)
 *
 * Default: PREVIEW ONLY (no writes).
 * Write all:  --write
 * Write trips only: --write-trips
 *
 * Optional Excel path as first non-flag arg.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "crypto";
import { existsSync } from "fs";
import * as XLSX from "xlsx";
import { DEFAULT_EXCHANGE_RATE } from "../lib/constants/freight-settings";
import { yearMonthKey } from "../lib/constants/thai-cost";
import {
  resolveSessionPickupLocation,
  type PickupLocation,
} from "../lib/constants/pickup-locations";
import { toDateInputValue } from "../lib/date-utils";
import { decimalToNumber } from "../lib/freight-rates";
import { prisma } from "../lib/prisma";
import {
  calendarDateUTC,
  getMonthDateRange,
} from "../lib/reports/period-report-shared";
import { classifyThaiCostCrate } from "../lib/thai-cost/crate-classify";
import {
  computeDailyLaborDayCost,
  computeMonthlyWorkerTotal,
  computeSadaoHandlingCommission,
  sumSadaoMonthlyCost,
} from "../lib/thai-cost/sadao-cost";
import {
  computePattaniDayCosts,
  loadCurrentThaiCostRates,
  type ThaiCostRates,
} from "../lib/thai-cost/rate-settings";
import {
  computeThaiSegmentInternalCostByPickup,
  lockThaiMonthSnapshots,
} from "../lib/thai-cost/segment-internal-cost";

const YEAR = 2026;
const MONTH = 6;
const YM = yearMonthKey(YEAR, MONTH);

const DEFAULT_XLSX = "C:/Users/wonch/Downloads/TRIP RECORD JUN 2026.xlsx";

const DRIVER_MAP: Record<string, string> = {
  DAENG: "THONGDANG",
  NARONG: "P.NARONG",
  CHAIRAT: "P.CHAIRAT",
  PONG: "P.PHONG",
};

const RENTED = new Set(["BANHENG", "SHS", "YIN"]);

type Area = "SK" | "PTN";

/**
 * External rented trips with blank DRIVER in Excel (user-confirmed pending).
 * Matched by day+area+truck/tong; never written to any table.
 */
const UNKNOWN_RENTED_TRIPS: ReadonlyArray<{
  day: number;
  area: Area;
  truckNeedle: string;
  tong: number;
  box: number;
  label: string;
  detail: string;
}> = [
  {
    day: 22,
    area: "SK",
    truckNeedle: "7218",
    tong: 50,
    box: 5,
    label: "UNKNOWN（待补，2026-06-22 SK 车牌7218）",
    detail: "SK×1（50桶+5盒）",
  },
  {
    day: 8,
    area: "PTN",
    truckNeedle: "",
    tong: 25,
    box: 0,
    label: "UNKNOWN（待补，2026-06-08 PTN）",
    detail: "PTN×1（25桶）",
  },
];

/** Sundays + Jun 30 pending — no trip rows written. */
const TRIP_SKIP_DAYS = new Set([7, 14, 21, 28, 30]);

/** Jun 30 pending clerk confirm — no handling rows written. */
const HANDLING_SKIP_DAYS = new Set([30]);

const TRIP_NOTES =
  "JUNE2026_IMPORT from TRIP RECORD JUN 2026.xlsx (formal drivers only)";
const HANDLING_NOTES =
  "JUNE2026_IMPORT from dispatch (all assigned, pickup=SONGKHLA|PATTANI; large=VIO/BS/GKS)";

const WRITE_ALL = process.argv.includes("--write");
const WRITE_TRIPS = process.argv.includes("--write-trips") || WRITE_ALL;

type Qty = { small: number; large: number; box: number };

type TripRow = {
  day: number;
  area: Area;
  driverRaw: string;
  truck: string;
  tong: number;
  box: number;
};

type RentedTripDetail = {
  name: string;
  day: number;
  dateKey: string;
  area: Area;
  trips: number;
  tong?: number;
  box?: number;
  detail: string;
};

type FormalTripPlan = {
  day: number;
  dateKey: string;
  date: Date;
  driverName: string;
  driverId: string;
  songkhla: number;
  pattani: number;
};

function money(n: number) {
  return Math.round(n * 100) / 100;
}

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
  if (!s) return false;
  return /^\d+(\.\d+)?$/.test(s);
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

function parseSheet(
  name: string,
  rows: unknown[][]
): { day: number | null; trips: TripRow[]; skipReason?: string } {
  const day = sheetDay(name);
  if (day == null) {
    return { day: null, trips: [], skipReason: "no day in sheet name" };
  }
  if (name.toUpperCase() === "BLANK" || /工作表\s*2/i.test(name)) {
    return { day, trips: [], skipReason: "blank/sheet2 excluded" };
  }

  const headerIdx = findTripTableHeader(rows);
  if (headerIdx < 0) {
    return { day, trips: [], skipReason: "no TRIP IN THAILAND header" };
  }

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

  if (iArea < 0 || iDriver < 0 || iTong < 0) {
    return {
      day,
      trips: [],
      skipReason: `bad header cols area=${iArea} driver=${iDriver} tong=${iTong}`,
    };
  }

  const trips: TripRow[] = [];
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

    // Blank DRIVER is allowed (external rented / UNKNOWN pending).
    const driverRaw = normalizeDriver(row[iDriver]);

    const tong = Number(row[iTong]);
    const box =
      iBox >= 0 && row[iBox] !== "" && row[iBox] != null
        ? Number(row[iBox]) || 0
        : 0;
    const truck = iTruck >= 0 ? String(row[iTruck] ?? "").trim() : "";

    trips.push({ day, area, driverRaw, truck, tong, box });
  }

  return { day, trips };
}

function parseTripExcel(path: string): {
  allTrips: TripRow[];
  sheetNotes: string[];
} {
  const wb = XLSX.readFile(path);
  const allTrips: TripRow[] = [];
  const sheetNotes: string[] = [];

  for (const name of wb.SheetNames) {
    if (name.toUpperCase() === "BLANK" || /工作表\s*2/i.test(name)) {
      sheetNotes.push(`SKIP sheet "${name}" (BLANK/工作表2)`);
      continue;
    }
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], {
      header: 1,
      defval: "",
      raw: true,
    }) as unknown[][];
    const parsed = parseSheet(name, rows);
    if (parsed.day == null) {
      sheetNotes.push(`SKIP sheet "${name}": ${parsed.skipReason}`);
      continue;
    }
    if (parsed.skipReason && parsed.trips.length === 0) {
      sheetNotes.push(`Day ${parsed.day} sheet "${name}": ${parsed.skipReason}`);
      continue;
    }
    sheetNotes.push(
      `Day ${parsed.day} sheet "${name}": ${parsed.trips.length} trip rows`
    );
    allTrips.push(...parsed.trips);
  }

  return { allTrips, sheetNotes };
}

function emptyQty(): Qty {
  return { small: 0, large: 0, box: 0 };
}

function addQty(target: Qty, bucket: keyof Qty, qty: number) {
  target[bucket] += qty;
}

async function loadHandlingByPickup(): Promise<{
  songkhla: Map<string, Qty>;
  pattani: Map<string, Qty>;
  largeCodes: string[];
  skippedUnassigned: number;
  day30: { songkhla: Qty; pattani: Qty };
}> {
  const { start, end } = getMonthDateRange(YEAR, MONTH);
  const rates = await loadCurrentThaiCostRates();
  const largeCodes = rates.largeTongTypeCodes;

  const dispatches = await prisma.dispatchOrder.findMany({
    where: {
      status: { not: "cancelled" },
      date: { gte: start, lte: end },
    },
    select: {
      date: true,
      lines: {
        select: {
          inboundLine: {
            select: {
              quantity: true,
              dispatchStatus: true,
              isBox: true,
              tongType: { select: { code: true, isBox: true } },
              session: {
                select: {
                  pickupLocation: true,
                  shipper: { select: { pickupLocation: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { date: "asc" },
  });

  const songkhla = new Map<string, Qty>();
  const pattani = new Map<string, Qty>();
  let skippedUnassigned = 0;
  const day30 = { songkhla: emptyQty(), pattani: emptyQty() };

  for (const d of dispatches) {
    const dateKey = toDateInputValue(d.date);
    const day = Number(dateKey.slice(-2));

    for (const dl of d.lines) {
      const line = dl.inboundLine;
      if (!line) continue;
      if (line.dispatchStatus !== "assigned") {
        skippedUnassigned += 1;
        continue;
      }
      const qty = line.quantity ?? 0;
      if (qty <= 0) continue;

      const tongCode = line.tongType?.code ?? "";
      const isBox = line.tongType?.isBox ?? line.isBox ?? false;
      const bucket = classifyThaiCostCrate(tongCode, isBox, largeCodes);
      const pickup = resolveSessionPickupLocation(
        line.session.pickupLocation,
        line.session.shipper.pickupLocation
      ) as PickupLocation;

      if (pickup !== "SONGKHLA" && pickup !== "PATTANI") continue;

      if (HANDLING_SKIP_DAYS.has(day)) {
        addQty(
          pickup === "SONGKHLA" ? day30.songkhla : day30.pattani,
          bucket,
          qty
        );
        continue;
      }

      const map = pickup === "SONGKHLA" ? songkhla : pattani;
      const cur = map.get(dateKey) ?? emptyQty();
      addQty(cur, bucket, qty);
      map.set(dateKey, cur);
    }
  }

  return { songkhla, pattani, largeCodes, skippedUnassigned, day30 };
}

function matchUnknownRented(t: TripRow) {
  return UNKNOWN_RENTED_TRIPS.find((u) => {
    if (u.day !== t.day || u.area !== t.area) return false;
    if (u.tong !== t.tong) return false;
    if (u.box !== t.box) return false;
    if (u.truckNeedle) {
      const truck = t.truck.replace(/[-\s]/g, "");
      return truck.includes(u.truckNeedle);
    }
    return true;
  });
}

function addTripCount(
  bucket: Map<string, Map<number, { songkhla: number; pattani: number }>>,
  name: string,
  day: number,
  area: Area
) {
  if (!bucket.has(name)) bucket.set(name, new Map());
  const byDay = bucket.get(name)!;
  if (!byDay.has(day)) byDay.set(day, { songkhla: 0, pattani: 0 });
  const a = byDay.get(day)!;
  if (area === "SK") a.songkhla += 1;
  else a.pattani += 1;
}

function buildFormalTripPlan(
  allTrips: TripRow[],
  idByName: Map<string, string>
): {
  formal: FormalTripPlan[];
  rented: Map<string, Map<number, { songkhla: number; pattani: number }>>;
  rentedDetails: RentedTripDetail[];
  unknownDrivers: Map<string, number>;
  missingDriverIds: string[];
  blankDriverSkipped: number;
} {
  const formalAgg = new Map<
    string,
    Map<number, { songkhla: number; pattani: number }>
  >();
  const rented = new Map<
    string,
    Map<number, { songkhla: number; pattani: number }>
  >();
  const rentedDetails: RentedTripDetail[] = [];
  const unknownDrivers = new Map<string, number>();
  let blankDriverSkipped = 0;

  for (const t of allTrips) {
    if (TRIP_SKIP_DAYS.has(t.day)) continue;

    const unknown = matchUnknownRented(t);
    if (unknown) {
      addTripCount(rented, unknown.label, t.day, t.area);
      rentedDetails.push({
        name: unknown.label,
        day: t.day,
        dateKey: `${YEAR}-06-${String(t.day).padStart(2, "0")}`,
        area: t.area,
        trips: 1,
        tong: t.tong,
        box: t.box,
        detail: unknown.detail,
      });
      continue;
    }

    if (!t.driverRaw) {
      blankDriverSkipped += 1;
      continue;
    }

    const official = DRIVER_MAP[t.driverRaw];
    const isRented = RENTED.has(t.driverRaw);
    if (!official && !isRented) {
      unknownDrivers.set(
        t.driverRaw,
        (unknownDrivers.get(t.driverRaw) ?? 0) + 1
      );
      continue;
    }

    const name = official ?? t.driverRaw;
    addTripCount(official ? formalAgg : rented, name, t.day, t.area);
    if (!official) {
      rentedDetails.push({
        name,
        day: t.day,
        dateKey: `${YEAR}-06-${String(t.day).padStart(2, "0")}`,
        area: t.area,
        trips: 1,
        tong: t.tong,
        box: t.box,
        detail:
          t.area === "SK"
            ? `SK×1（${t.tong}桶${t.box ? `+${t.box}盒` : ""}）`
            : `PTN×1（${t.tong}桶${t.box ? `+${t.box}盒` : ""}）`,
      });
    }
  }

  const formal: FormalTripPlan[] = [];
  const missingDriverIds: string[] = [];

  for (const [name, byDay] of [...formalAgg.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    const driverId = idByName.get(name);
    if (!driverId) {
      missingDriverIds.push(name);
      continue;
    }
    for (const day of [...byDay.keys()].sort((a, b) => a - b)) {
      const a = byDay.get(day)!;
      formal.push({
        day,
        dateKey: `${YEAR}-06-${String(day).padStart(2, "0")}`,
        date: calendarDateUTC(YEAR, MONTH, day),
        driverName: name,
        driverId,
        songkhla: a.songkhla,
        pattani: a.pattani,
      });
    }
  }

  return {
    formal,
    rented,
    rentedDetails,
    unknownDrivers,
    missingDriverIds,
    blankDriverSkipped,
  };
}

function countTrips(
  formal: FormalTripPlan[],
  rentedDetails: RentedTripDetail[]
) {
  const formalTrips = formal.reduce(
    (s, r) => s + r.songkhla + r.pattani,
    0
  );
  const rentedTrips = rentedDetails.reduce((s, r) => s + r.trips, 0);
  return { formalTrips, rentedTrips, totalTrips: formalTrips + rentedTrips };
}

function computeDriverCosts(
  drivers: Array<{ id: string; name: string; baseWage: number }>,
  tripsByDriver: Map<string, { songkhla: number; pattani: number }>,
  rates: ThaiCostRates,
  station: "SONGKHLA" | "PATTANI"
) {
  let driverBaseWageAllocatedThb = 0;
  let driverTripCommissionThb = 0;
  const details: Array<{
    name: string;
    baseWage: number;
    songkhla: number;
    pattani: number;
    baseAllocated: number;
    tripCommission: number;
  }> = [];

  for (const d of drivers) {
    const trips = tripsByDriver.get(d.id) ?? { songkhla: 0, pattani: 0 };
    const totalTrips = trips.songkhla + trips.pattani;
    const stationTrips =
      station === "SONGKHLA" ? trips.songkhla : trips.pattani;
    const share = totalTrips > 0 ? stationTrips / totalTrips : 0;
    const baseAllocated = money(d.baseWage * share);
    const tripCommission =
      station === "SONGKHLA"
        ? trips.songkhla * rates.driverTripSongkhla
        : trips.pattani * rates.driverTripPattani;

    driverBaseWageAllocatedThb += baseAllocated;
    driverTripCommissionThb += tripCommission;

    if (trips.songkhla > 0 || trips.pattani > 0) {
      details.push({
        name: d.name,
        baseWage: d.baseWage,
        songkhla: trips.songkhla,
        pattani: trips.pattani,
        baseAllocated,
        tripCommission,
      });
    }
  }

  return {
    driverBaseWageAllocatedThb: money(driverBaseWageAllocatedThb),
    driverTripCommissionThb: money(driverTripCommissionThb),
    driverTotalThb: money(
      driverBaseWageAllocatedThb + driverTripCommissionThb
    ),
    details,
  };
}

async function main() {
  const xlsxPath =
    process.argv.find((a) => !a.startsWith("-") && a.endsWith(".xlsx")) ??
    DEFAULT_XLSX;

  const modeLabel = WRITE_ALL
    ? "WRITE ALL"
    : WRITE_TRIPS
      ? "WRITE TRIPS ONLY"
      : "PREVIEW ONLY";
  console.log("============================================================");
  console.log(`June 2026 Songkhla/Pattani import — ${modeLabel}`);
  console.log(
    "外部租车成本未计入，待用户补充 BANHENG/SHS/YIN/UNKNOWN 实际费用后重新计算"
  );
  console.log("============================================================\n");

  if (!existsSync(xlsxPath)) {
    throw new Error(`Excel not found: ${xlsxPath}`);
  }

  const { start, end } = getMonthDateRange(YEAR, MONTH);
  const rates = await loadCurrentThaiCostRates();
  const fxRow = await prisma.exchangeRate.findUnique({
    where: { yearMonth: YM },
  });
  const exchangeRate =
    decimalToNumber(fxRow?.rate) ?? DEFAULT_EXCHANGE_RATE;

  const drivers = await prisma.thaiDriver.findMany({
    where: { active: true },
  });
  const idByName = new Map(drivers.map((d) => [d.name, d.id]));
  const driverMeta = drivers.map((d) => ({
    id: d.id,
    name: d.name,
    baseWage: decimalToNumber(d.baseWage) ?? 0,
  }));

  // ── 1) Driver trips ──────────────────────────────────────────────────────
  const { allTrips, sheetNotes } = parseTripExcel(xlsxPath);
  const {
    formal,
    rentedDetails,
    unknownDrivers,
    missingDriverIds,
    blankDriverSkipped,
  } = buildFormalTripPlan(allTrips, idByName);
  const tripCounts = countTrips(formal, rentedDetails);

  console.log("=== 1. DRIVER TRIPS (thai_driver_trip_daily) ===");
  console.log(`Excel: ${xlsxPath}`);
  console.log("Sheet notes:");
  for (const n of sheetNotes) console.log(`  ${n}`);
  console.log(
    `Skip days (not written): ${[...TRIP_SKIP_DAYS].sort((a, b) => a - b).join(", ")}`
  );
  console.log("date,driver,driverId,songkhlaTripCount,pattaniTripCount");
  for (const r of formal) {
    console.log(
      `${r.dateKey},${r.driverName},${r.driverId},${r.songkhla},${r.pattani}`
    );
  }
  console.log(`Formal rows to write: ${formal.length}`);
  let formalSk = 0;
  let formalPt = 0;
  for (const name of Object.values(DRIVER_MAP)) {
    const rows = formal.filter((r) => r.driverName === name);
    const sk = rows.reduce((s, r) => s + r.songkhla, 0);
    const pt = rows.reduce((s, r) => s + r.pattani, 0);
    formalSk += sk;
    formalPt += pt;
    console.log(
      `  ${name}: days=${rows.length} SK=${sk} PTN=${pt} trips=${sk + pt} id=${idByName.get(name) ?? "MISSING"}`
    );
  }
  console.log(
    `Formal trip total: SK=${formalSk} PTN=${formalPt} trips=${tripCounts.formalTrips}`
  );
  if (missingDriverIds.length > 0) {
    console.log("MISSING driver IDs:", missingDriverIds.join(", "));
  }

  console.log(
    "\n--- RENTED PENDING (BANHENG/SHS/YIN/UNKNOWN) — stats only, NOT written ---"
  );
  for (const d of rentedDetails.sort((a, b) =>
    a.dateKey === b.dateKey
      ? a.name.localeCompare(b.name)
      : a.dateKey.localeCompare(b.dateKey)
  )) {
    console.log(`${d.dateKey},${d.name},${d.detail}`);
  }
  console.log("\n待补租车成本清单:");
  // Named rented first, then UNKNOWN
  const namedOrder = ["BANHENG", "SHS", "YIN"];
  for (const name of namedOrder) {
    const list = rentedDetails.filter((d) => d.name === name);
    if (list.length === 0) continue;
    const sk = list.filter((d) => d.area === "SK").length;
    const pt = list.filter((d) => d.area === "PTN").length;
    const parts: string[] = [];
    if (sk) parts.push(`SK×${sk}`);
    if (pt) parts.push(`PTN×${pt}`);
    console.log(`  - ${name}：${parts.join(" ")}`);
  }
  for (const d of rentedDetails.filter((x) => x.name.startsWith("UNKNOWN"))) {
    console.log(`  - ${d.name}：${d.detail}`);
  }
  console.log(
    `Rented pending total: trips=${tripCounts.rentedTrips} (cost pending)`
  );

  console.log("\n--- Trip count alignment ---");
  console.log(
    `正式司机 ${tripCounts.formalTrips} 趟 + 待补租车 ${tripCounts.rentedTrips} 趟 = ${tripCounts.totalTrips} 趟`
  );
  const EXPECTED_FORMAL = 79;
  const EXPECTED_RENTED = 7;
  const EXPECTED_TOTAL = 86;
  const aligned =
    tripCounts.formalTrips === EXPECTED_FORMAL &&
    tripCounts.rentedTrips === EXPECTED_RENTED &&
    tripCounts.totalTrips === EXPECTED_TOTAL;
  console.log(
    aligned
      ? `ALIGN OK: ${EXPECTED_FORMAL}+${EXPECTED_RENTED}=${EXPECTED_TOTAL}`
      : `ALIGN FAIL: expected ${EXPECTED_FORMAL}+${EXPECTED_RENTED}=${EXPECTED_TOTAL}, got ${tripCounts.formalTrips}+${tripCounts.rentedTrips}=${tripCounts.totalTrips}`
  );

  if (unknownDrivers.size > 0) {
    console.log("\nUNKNOWN drivers (skipped, not in pending list):");
    for (const [n, c] of unknownDrivers) console.log(`  ${n}: ${c} rows`);
  }
  if (blankDriverSkipped > 0) {
    console.log(
      `\nBlank DRIVER rows not matched to UNKNOWN pending: ${blankDriverSkipped}`
    );
  }

  const skipDayTrips = allTrips.filter((t) => TRIP_SKIP_DAYS.has(t.day));
  console.log(
    `\nTrips on excluded days (7/14/21/28/30): ${skipDayTrips.length} (not imported)`
  );

  if (!aligned) {
    throw new Error(
      `Trip totals not aligned (formal=${tripCounts.formalTrips} rented=${tripCounts.rentedTrips} total=${tripCounts.totalTrips}); aborting`
    );
  }

  // ── 2) Handling ──────────────────────────────────────────────────────────
  const handling = await loadHandlingByPickup();

  console.log("\n=== 2. CRATE HANDLING (dispatch assigned by pickup) ===");
  console.log(`large_tong_type_codes: ${handling.largeCodes.join(", ")}`);
  console.log(`skipped unassigned lines: ${handling.skippedUnassigned}`);
  console.log("Skip day 30 (pending clerk confirm) — not written:");
  console.log(
    `  SONGKHLA 2026-06-30: small=${handling.day30.songkhla.small} large=${handling.day30.songkhla.large} box=${handling.day30.songkhla.box}`
  );
  console.log(
    `  PATTANI  2026-06-30: small=${handling.day30.pattani.small} large=${handling.day30.pattani.large} box=${handling.day30.pattani.box}`
  );

  console.log("\n--- songkhla_crate_handling_daily ---");
  console.log("date,small,large,box");
  let skS = 0;
  let skL = 0;
  let skB = 0;
  const skDays = [...handling.songkhla.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  );
  for (const [dateKey, q] of skDays) {
    skS += q.small;
    skL += q.large;
    skB += q.box;
    console.log(`${dateKey},${q.small},${q.large},${q.box}`);
  }
  console.log(
    `Songkhla rows=${skDays.length} totals: small=${skS} large=${skL} box=${skB} all=${skS + skL + skB}`
  );

  console.log("\n--- pattani_crate_handling_daily ---");
  console.log("date,crateQty(=small+large),boxQty");
  let ptCrate = 0;
  let ptBox = 0;
  const ptDays = [...handling.pattani.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  );
  for (const [dateKey, q] of ptDays) {
    const crateQty = q.small + q.large;
    ptCrate += crateQty;
    ptBox += q.box;
    console.log(`${dateKey},${crateQty},${q.box}`);
  }
  console.log(
    `Pattani rows=${ptDays.length} totals: crate=${ptCrate} box=${ptBox}`
  );

  // ── 3) Snapshot preview ──────────────────────────────────────────────────
  const segmentPreview = await computeThaiSegmentInternalCostByPickup(
    YEAR,
    MONTH
  );
  const existingRateSnap =
    await prisma.thaiCostMonthlyRateSnapshot.findUnique({
      where: { yearMonth: YM },
    });
  const existingSegSnaps =
    await prisma.thaiSegmentInternalCostSnapshot.findMany({
      where: { yearMonth: YM },
    });

  console.log("\n=== 3. SNAPSHOT LOCK PREVIEW (2026-06) ===");
  console.log("Rates to lock (from current settings):");
  console.log(
    `  handling small weekday/holiday: ${rates.handlingSmallWeekday}/${rates.handlingSmallHoliday}`
  );
  console.log(
    `  handling large weekday/holiday: ${rates.handlingLargeWeekday}/${rates.handlingLargeHoliday}`
  );
  console.log(
    `  driver trip SK/PTN: ${rates.driverTripSongkhla}/${rates.driverTripPattani}`
  );
  console.log(
    `  pattani contractor crate/box: ${rates.pattaniContractorCrate}/${rates.pattaniContractorBox}`
  );
  console.log(`  pattani sakri crate: ${rates.pattaniSakriCrate}`);
  console.log(`  large codes: ${rates.largeTongTypeCodes.join(", ")}`);
  console.log(
    `  existing rate snapshot: ${existingRateSnap ? "EXISTS (will keep unless --write force)" : "NONE (will create)"}`
  );
  console.log("Segment internal cost (computed, MYR):");
  console.log(
    `  SONGKHLA: ${segmentPreview.byPickup.SONGKHLA} MYR (lines=${segmentPreview.lineCounts.SONGKHLA})`
  );
  console.log(
    `  PATTANI:  ${segmentPreview.byPickup.PATTANI} MYR (lines=${segmentPreview.lineCounts.PATTANI})`
  );
  console.log(`  exchangeRate: ${segmentPreview.exchangeRate}`);
  console.log(
    `  existing segment snaps: ${
      existingSegSnaps.length === 0
        ? "NONE"
        : existingSegSnaps
            .map((s) => `${s.pickupLocation}=${s.totalAmountMyr}`)
            .join(", ")
    }`
  );

  // ── 4) Cost + P&L (in-memory, as if written) ─────────────────────────────
  const tripsByDriver = new Map<
    string,
    { songkhla: number; pattani: number }
  >();
  for (const r of formal) {
    const cur = tripsByDriver.get(r.driverId) ?? { songkhla: 0, pattani: 0 };
    cur.songkhla += r.songkhla;
    cur.pattani += r.pattani;
    tripsByDriver.set(r.driverId, cur);
  }

  // Songkhla master data (already in DB — not part of this import)
  const skWorkers = await prisma.thaiMonthlyWorker.findMany({
    where: { station: "SONGKHLA", active: true },
  });
  const skAttendance = await prisma.thaiDailyLaborAttendance.findMany({
    where: { station: "SONGKHLA", date: { gte: start, lte: end } },
  });
  const skRoster = await prisma.thaiDailyLaborMonthlyRoster.findUnique({
    where: { yearMonth_station: { yearMonth: YM, station: "SONGKHLA" } },
  });

  const skMonthlyWorkers = skWorkers.map((w) => {
    const monthlyWage = decimalToNumber(w.monthlyWage) ?? 0;
    const lunchAllowance = decimalToNumber(w.lunchAllowance) ?? 0;
    const fuelAllowance = decimalToNumber(w.fuelAllowance) ?? 0;
    const rentRoomAllowance = decimalToNumber(w.rentRoomAllowance) ?? 0;
    return {
      name: w.name,
      monthlyWage,
      lunchAllowance,
      fuelAllowance,
      rentRoomAllowance,
      totalThb: computeMonthlyWorkerTotal({
        monthlyWage,
        lunchAllowance,
        fuelAllowance,
        rentRoomAllowance,
      }),
    };
  });

  const monthlyWageTotalThb = skMonthlyWorkers.reduce(
    (s, w) => s + w.monthlyWage,
    0
  );
  const monthlyLunchTotalThb = skMonthlyWorkers.reduce(
    (s, w) => s + w.lunchAllowance,
    0
  );
  const monthlyFuelTotalThb = skMonthlyWorkers.reduce(
    (s, w) => s + w.fuelAllowance,
    0
  );
  const monthlyRentRoomTotalThb = skMonthlyWorkers.reduce(
    (s, w) => s + w.rentRoomAllowance,
    0
  );
  const dailyLaborWageTotalThb = skAttendance.reduce(
    (sum, row) =>
      sum +
      computeDailyLaborDayCost({
        attendanceCount: row.attendanceCount,
        dailyWage: decimalToNumber(row.dailyWage) ?? 0,
        totalWagePaid: decimalToNumber(row.totalWagePaid),
      }),
    0
  );
  const dailyLaborRosterCount = skRoster?.rosterCount ?? 0;
  // Songkhla daily labor has no LUNCH allowance.
  const dailyLaborLunchTotalThb = 0;

  let handlingSmallCommissionThb = 0;
  let handlingLargeCommissionThb = 0;
  let handlingBoxCommissionThb = 0;
  for (const [, q] of skDays) {
    const commission = computeSadaoHandlingCommission(
      {
        smallCrateTotalQty: q.small,
        largeCrateTotalQty: q.large,
        boxTotalQty: q.box,
        smallCrateNoCheckQty: 0,
        largeCrateNoCheckQty: 0,
        boxNoCheckQty: 0,
      },
      { holidayRate: false, rateConfig: rates }
    );
    handlingSmallCommissionThb += commission.smallCommissionThb;
    handlingLargeCommissionThb += commission.largeCommissionThb;
    handlingBoxCommissionThb += commission.boxCommissionThb;
  }

  const skLabor = sumSadaoMonthlyCost({
    monthlyWageTotalThb,
    monthlyLunchTotalThb,
    monthlyFuelTotalThb,
    monthlyRentRoomTotalThb,
    dailyLaborWageTotalThb,
    dailyLaborLunchTotalThb,
    handlingSmallCommissionThb,
    handlingLargeCommissionThb,
    handlingBoxCommissionThb,
  });

  const skDrivers = computeDriverCosts(
    driverMeta,
    tripsByDriver,
    rates,
    "SONGKHLA"
  );
  const skRentedVehicleCostThb = 0; // pending
  const skRealCostThb = money(
    skLabor.totalCostThb + skDrivers.driverTotalThb + skRentedVehicleCostThb
  );
  const skRealCostMyr = money(skRealCostThb / exchangeRate);
  const skInternalMyr = segmentPreview.byPickup.SONGKHLA;
  const skPnlMyr = money(skInternalMyr - skRealCostMyr);

  console.log("\n=== 4a. SONGKHLA REAL COST + P&L (current version) ===");
  console.log("⚠ 不含外部租车成本，待补");
  console.log(
    "⚠ 外部租车成本未计入，待用户补充 BANHENG/SHS/YIN/UNKNOWN 实际费用后重新计算"
  );
  if (skMonthlyWorkers.length === 0) {
    console.log(
      "⚠ MASTER DATA GAP: no active SONGKHLA monthly workers in DB (月薪工人=0)"
    );
  }
  if (skAttendance.length === 0) {
    console.log(
      "⚠ MASTER DATA GAP: no SONGKHLA daily attendance for June (日薪工资=0)"
    );
  }
  if (!skRoster) {
    console.log(
      "⚠ MASTER DATA GAP: no SONGKHLA daily-labor roster for 2026-06 (日薪LUNCH=0)"
    );
  }
  console.log("Monthly workers:");
  for (const w of skMonthlyWorkers) {
    console.log(
      `  ${w.name}: wage=${w.monthlyWage} lunch=${w.lunchAllowance} fuel=${w.fuelAllowance} rent=${w.rentRoomAllowance} total=${w.totalThb}`
    );
  }
  console.log(`  monthly wage total: ${monthlyWageTotalThb}`);
  console.log(`  monthly lunch total: ${monthlyLunchTotalThb}`);
  console.log(`  monthly fuel total: ${monthlyFuelTotalThb}`);
  console.log(`  monthly rent total: ${monthlyRentRoomTotalThb}`);
  console.log(
    `Daily labor wage: ${dailyLaborWageTotalThb} (${skAttendance.length} days)`
  );
  console.log(
    `Daily labor LUNCH: ${dailyLaborLunchTotalThb} (Songkhla daily labor has no LUNCH; roster=${dailyLaborRosterCount})`
  );
  console.log(
    `Handling commission: small=${handlingSmallCommissionThb} large=${handlingLargeCommissionThb} box=${handlingBoxCommissionThb} total=${skLabor.handlingCommissionTotalThb}`
  );
  console.log("Drivers:");
  for (const d of skDrivers.details) {
    console.log(
      `  ${d.name}: base=${d.baseWage} SK=${d.songkhla} PTN=${d.pattani} baseAlloc=${d.baseAllocated} tripComm=${d.tripCommission}`
    );
  }
  console.log(`  driver base allocated: ${skDrivers.driverBaseWageAllocatedThb}`);
  console.log(`  driver trip commission: ${skDrivers.driverTripCommissionThb}`);
  console.log(`  driver total: ${skDrivers.driverTotalThb}`);
  console.log(`  rented vehicle cost: ${skRentedVehicleCostThb} (PENDING)`);
  console.log(`REAL COST TOTAL: ${skRealCostThb} THB = ${skRealCostMyr} MYR (FX=${exchangeRate})`);
  console.log(`Internal segment cost snapshot: ${skInternalMyr} MYR`);
  console.log(`P&L = internal − real = ${skPnlMyr} MYR`);

  // Pattani
  const ptWorkers = await prisma.thaiMonthlyWorker.findMany({
    where: { station: "PATTANI", active: true },
  });
  const ptWorkerDetails = ptWorkers.map((w) => {
    const monthlyWage = decimalToNumber(w.monthlyWage) ?? 0;
    const lunchAllowance = decimalToNumber(w.lunchAllowance) ?? 0;
    const fuelAllowance = decimalToNumber(w.fuelAllowance) ?? 0;
    const rentRoomAllowance = decimalToNumber(w.rentRoomAllowance) ?? 0;
    return {
      name: w.name,
      monthlyWage,
      totalThb: computeMonthlyWorkerTotal({
        monthlyWage,
        lunchAllowance,
        fuelAllowance,
        rentRoomAllowance,
      }),
    };
  });
  const sakriMonthlyWageThb = ptWorkerDetails.reduce(
    (s, w) => s + w.totalThb,
    0
  );

  let contractorThb = 0;
  let sakriCommissionThb = 0;
  for (const [, q] of ptDays) {
    const day = computePattaniDayCosts(q.small + q.large, q.box, rates);
    contractorThb += day.contractorThb;
    sakriCommissionThb += day.sakriCommissionThb;
  }
  contractorThb = money(contractorThb);
  sakriCommissionThb = money(sakriCommissionThb);

  const ptDrivers = computeDriverCosts(
    driverMeta,
    tripsByDriver,
    rates,
    "PATTANI"
  );
  const ptRentedVehicleCostThb = 0;
  const ptRealCostThb = money(
    sakriMonthlyWageThb +
      sakriCommissionThb +
      contractorThb +
      ptDrivers.driverTotalThb +
      ptRentedVehicleCostThb
  );
  const ptRealCostMyr = money(ptRealCostThb / exchangeRate);
  const ptInternalMyr = segmentPreview.byPickup.PATTANI;
  const ptPnlMyr = money(ptInternalMyr - ptRealCostMyr);

  console.log("\n=== 4b. PATTANI REAL COST + P&L (current version) ===");
  console.log("⚠ 不含外部租车成本，待补");
  console.log(
    "⚠ 外部租车成本未计入，待用户补充 BANHENG/SHS/YIN/UNKNOWN 实际费用后重新计算"
  );
  console.log("SAKRI / monthly workers:");
  for (const w of ptWorkerDetails) {
    console.log(`  ${w.name}: total=${w.totalThb}`);
  }
  console.log(`  SAKRI monthly total: ${sakriMonthlyWageThb}`);
  console.log(`SAKRI commission: ${sakriCommissionThb}`);
  console.log(`Contractor (外包): ${contractorThb}`);
  console.log("Drivers:");
  for (const d of ptDrivers.details) {
    console.log(
      `  ${d.name}: base=${d.baseWage} SK=${d.songkhla} PTN=${d.pattani} baseAlloc=${d.baseAllocated} tripComm=${d.tripCommission}`
    );
  }
  console.log(`  driver base allocated: ${ptDrivers.driverBaseWageAllocatedThb}`);
  console.log(`  driver trip commission: ${ptDrivers.driverTripCommissionThb}`);
  console.log(`  driver total: ${ptDrivers.driverTotalThb}`);
  console.log(`  rented vehicle cost: ${ptRentedVehicleCostThb} (PENDING)`);
  console.log(`REAL COST TOTAL: ${ptRealCostThb} THB = ${ptRealCostMyr} MYR (FX=${exchangeRate})`);
  console.log(`Internal segment cost snapshot: ${ptInternalMyr} MYR`);
  console.log(`P&L = internal − real = ${ptPnlMyr} MYR`);

  // ── Summary table ────────────────────────────────────────────────────────
  console.log("\n=== SUMMARY ===");
  console.log(
    [
      "station",
      "realCostThb",
      "realCostMyr",
      "internalMyr",
      "pnlMyr",
      "rentedPending",
    ].join("\t")
  );
  console.log(
    ["SONGKHLA", skRealCostThb, skRealCostMyr, skInternalMyr, skPnlMyr, "YES"].join(
      "\t"
    )
  );
  console.log(
    ["PATTANI", ptRealCostThb, ptRealCostMyr, ptInternalMyr, ptPnlMyr, "YES"].join(
      "\t"
    )
  );

  if (missingDriverIds.length > 0) {
    throw new Error(
      `Cannot proceed: missing driver IDs for ${missingDriverIds.join(", ")}`
    );
  }

  if (!WRITE_TRIPS && !WRITE_ALL) {
    console.log("\n*** PREVIEW ONLY — no database writes. ***");
    console.log(
      "Re-run with --write-trips (trips only) or --write (full import)."
    );
    return;
  }

  // ── WRITE ────────────────────────────────────────────────────────────────
  const actor =
    (await prisma.user.findFirst({
      where: { active: true, role: "admin" },
      select: { id: true },
    })) ??
    (await prisma.user.findFirst({
      where: { active: true },
      select: { id: true },
    }));
  if (!actor) throw new Error("No active user for createdBy");

  console.log("\n=== WRITING thai_driver_trip_daily ===");

  let tripUpserts = 0;
  let tripCreated = 0;
  let tripUpdated = 0;
  for (const r of formal) {
    const existing = await prisma.thaiDriverTripDaily.findUnique({
      where: {
        date_driverId: { date: r.date, driverId: r.driverId },
      },
    });
    if (existing) {
      await prisma.thaiDriverTripDaily.update({
        where: { id: existing.id },
        data: {
          songkhlaTripCount: r.songkhla,
          pattaniTripCount: r.pattani,
          notes: TRIP_NOTES,
        },
      });
      tripUpdated += 1;
    } else {
      await prisma.thaiDriverTripDaily.create({
        data: {
          id: randomUUID(),
          date: r.date,
          driverId: r.driverId,
          songkhlaTripCount: r.songkhla,
          pattaniTripCount: r.pattani,
          notes: TRIP_NOTES,
          createdBy: actor.id,
        },
      });
      tripCreated += 1;
    }
    tripUpserts += 1;
  }

  // Verify written trip sum for June formal drivers
  const writtenRows = await prisma.thaiDriverTripDaily.findMany({
    where: {
      date: { gte: start, lte: end },
      notes: TRIP_NOTES,
    },
  });
  const writtenTripSum = writtenRows.reduce(
    (s, r) => s + r.songkhlaTripCount + r.pattaniTripCount,
    0
  );
  console.log(`Rows written (upserted): ${tripUpserts} (created=${tripCreated} updated=${tripUpdated})`);
  console.log(`Rows in DB with import notes: ${writtenRows.length}`);
  console.log(
    `Written trip sum (songkhla+pattani): ${writtenTripSum} (expected ${EXPECTED_FORMAL})`
  );
  if (writtenTripSum !== EXPECTED_FORMAL || tripUpserts !== formal.length) {
    throw new Error(
      `Trip write verification failed: rows=${tripUpserts} sum=${writtenTripSum}`
    );
  }
  console.log("TRIP WRITE VERIFY OK: 79 trips across formal drivers.");

  if (!WRITE_ALL) {
    console.log(
      "\n*** TRIPS ONLY — handling / snapshots not written (use --write for full import). ***"
    );
    return;
  }

  let skUpserts = 0;
  for (const [dateKey, q] of skDays) {
    const date = calendarDateUTC(
      YEAR,
      MONTH,
      Number(dateKey.slice(-2))
    );
    const existing = await prisma.songkhlaCrateHandlingDaily.findUnique({
      where: { date },
    });
    const data = {
      smallCrateTotalQty: q.small,
      largeCrateTotalQty: q.large,
      boxTotalQty: q.box,
      notes: HANDLING_NOTES,
    };
    if (existing) {
      await prisma.songkhlaCrateHandlingDaily.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.songkhlaCrateHandlingDaily.create({
        data: {
          id: randomUUID(),
          date,
          ...data,
          createdBy: actor.id,
        },
      });
    }
    skUpserts += 1;
  }
  console.log(`Songkhla handling upserted: ${skUpserts}`);

  let ptUpserts = 0;
  for (const [dateKey, q] of ptDays) {
    const date = calendarDateUTC(
      YEAR,
      MONTH,
      Number(dateKey.slice(-2))
    );
    const existing = await prisma.pattaniCrateHandlingDaily.findUnique({
      where: { date },
    });
    const data = {
      crateQty: q.small + q.large,
      boxQty: q.box,
      notes: HANDLING_NOTES,
    };
    if (existing) {
      await prisma.pattaniCrateHandlingDaily.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.pattaniCrateHandlingDaily.create({
        data: {
          id: randomUUID(),
          date,
          ...data,
          createdBy: actor.id,
        },
      });
    }
    ptUpserts += 1;
  }
  console.log(`Pattani handling upserted: ${ptUpserts}`);

  const lockResult = await lockThaiMonthSnapshots({
    year: YEAR,
    month: MONTH,
    createdBy: actor.id,
    force: false,
    pickups: ["SONGKHLA", "PATTANI"],
  });
  console.log("Snapshots locked:");
  console.log(
    `  rates source=${lockResult.rateSnap.source} locked=${lockResult.rateSnap.locked}`
  );
  for (const s of lockResult.segmentSnapshots) {
    console.log(
      `  ${s.pickupLocation}: ${s.totalAmountMyr} MYR created=${s.created}`
    );
  }

  console.log("\nWRITE COMPLETE.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
