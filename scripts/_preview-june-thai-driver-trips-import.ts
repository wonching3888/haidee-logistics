/**
 * Preview only: parse TRIP RECORD JUN 2026.xlsx → thai_driver_trip_daily plan.
 * Does NOT write.
 *
 * Run: npx tsx --env-file=.env.local scripts/_preview-june-thai-driver-trips-import.ts [path-to-xlsx]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import * as XLSX from "xlsx";
import { existsSync } from "fs";
import { prisma } from "../lib/prisma";

const DEFAULT_PATH =
  "C:/Users/wonch/Downloads/TRIP RECORD JUN 2026.xlsx";

const DRIVER_MAP: Record<string, string> = {
  DAENG: "THONGDANG",
  NARONG: "P.NARONG",
  CHAIRAT: "P.CHAIRAT",
  PONG: "P.PHONG",
};

const RENTED = new Set(["BANHENG", "SHS", "YIN"]);

const SKIP_DAYS = new Set([7, 14, 21, 28, 30]); // Sundays + Jun 30 pending

type Area = "SK" | "PTN";

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

/**
 * Sheet names are day+month for June: "16"=1 Jun, "106"=10 Jun, "306"=30 Jun.
 * Exception: "2706"=27 Jun (zero-padded month).
 */
function sheetDay(name: string): number | null {
  const n = name.trim();
  if (!n || /^BLANK$/i.test(n) || /工作表/.test(n)) return null;
  // Prefer D+6 / DD+6 (16, 26, …, 106, 306)
  const m6 = n.match(/^(\d{1,2})6$/);
  if (m6) {
    const d = Number(m6[1]);
    if (d >= 1 && d <= 30) return d;
  }
  // 2706 → 27 Jun
  const m06 = n.match(/^(\d{1,2})06$/);
  if (m06) {
    const d = Number(m06[1]);
    if (d >= 1 && d <= 30) return d;
  }
  return null;
}

function findTripTableHeader(rows: unknown[][]): number {
  // Find "TRIP IN THAILAND" title, then the AREA/DRIVER/TONG header below it.
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

type TripRow = {
  day: number;
  area: Area;
  driverRaw: string;
  truck: string;
  tong: number;
  box: number;
};

function parseSheet(
  name: string,
  rows: unknown[][]
): { day: number | null; trips: TripRow[]; skipReason?: string } {
  const day = sheetDay(name);
  if (day == null) {
    return { day: null, trips: [], skipReason: "no day in sheet name" };
  }
  if (name.toUpperCase().includes("BLANK") || name === "2") {
    // User said skip sheet 2 / BLANK — sheet "2" might be day 2 though!
    // User: "除工作表2/BLANK" — likely means a sheet literally named something like
    // "工作表2" or "BLANK", not day 2. Day 2 is a valid Monday.
    if (name.toUpperCase() === "BLANK" || /工作表\s*2/i.test(name)) {
      return { day, trips: [], skipReason: "blank/sheet2 excluded" };
    }
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
      // Stop when we leave the trip block (READY/TRAILER section)
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
      // empty area — skip row but continue (might be blank lines)
      if (!cell0) continue;
      // unknown area — stop if looks like section header
      if (cell0.length > 3 && !["SK", "PTN", "PT"].includes(cell0)) break;
      continue;
    }

    if (!isNumericTong(row[iTong])) {
      // Non-numeric TONG = not a trip row (READY/TRAILER block)
      break;
    }

    const driverRaw = normalizeDriver(row[iDriver]);
    if (!driverRaw) continue;

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

async function main() {
  const path = process.argv[2] || DEFAULT_PATH;
  if (!existsSync(path)) {
    throw new Error(`Excel not found: ${path}`);
  }

  const wb = XLSX.readFile(path);
  console.log("Sheets:", wb.SheetNames.join(" | "));
  console.log("");

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

  console.log("=== Sheet parse notes ===");
  for (const n of sheetNotes) console.log(" ", n);
  console.log(`Total trip rows parsed: ${allTrips.length}`);
  console.log("");

  // Aggregate by day+driver for formal and rented
  type Agg = { songkhla: number; pattani: number };
  const formal = new Map<string, Map<number, Agg>>(); // officialName -> day -> counts
  const rented = new Map<string, Map<number, Agg>>();
  const unknownDrivers = new Map<string, number>();

  for (const t of allTrips) {
    if (SKIP_DAYS.has(t.day)) continue;

    const key = t.driverRaw;
    const official = DRIVER_MAP[key];
    const isRented = RENTED.has(key);

    if (!official && !isRented) {
      unknownDrivers.set(key, (unknownDrivers.get(key) ?? 0) + 1);
      continue;
    }

    const bucket = official ? formal : rented;
    const name = official ?? key;
    if (!bucket.has(name)) bucket.set(name, new Map());
    const byDay = bucket.get(name)!;
    if (!byDay.has(t.day)) byDay.set(t.day, { songkhla: 0, pattani: 0 });
    const a = byDay.get(t.day)!;
    if (t.area === "SK") a.songkhla += 1;
    else a.pattani += 1;
  }

  // Resolve driver IDs
  const drivers = await prisma.thaiDriver.findMany({
    where: { name: { in: Object.values(DRIVER_MAP) } },
  });
  const idByName = new Map(drivers.map((d) => [d.name, d.id]));

  console.log("=== FORMAL DRIVERS — import preview (thai_driver_trip_daily) ===");
  console.log("date,driver,driverId,songkhlaTripCount,pattaniTripCount");

  const formalRows: Array<{
    day: number;
    driverName: string;
    driverId: string | undefined;
    songkhla: number;
    pattani: number;
  }> = [];

  for (const [name, byDay] of [...formal.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    for (const day of [...byDay.keys()].sort((a, b) => a - b)) {
      const a = byDay.get(day)!;
      const date = `2026-06-${String(day).padStart(2, "0")}`;
      const driverId = idByName.get(name);
      formalRows.push({
        day,
        driverName: name,
        driverId,
        songkhla: a.songkhla,
        pattani: a.pattani,
      });
      console.log(
        `${date},${name},${driverId ?? "MISSING"},${a.songkhla},${a.pattani}`
      );
    }
  }

  console.log(`\nFormal rows to write: ${formalRows.length}`);
  for (const name of Object.values(DRIVER_MAP)) {
    const days = formal.get(name);
    let sk = 0;
    let pt = 0;
    if (days) {
      for (const a of days.values()) {
        sk += a.songkhla;
        pt += a.pattani;
      }
    }
    console.log(
      `  ${name}: days=${days?.size ?? 0} SK=${sk} PTN=${pt} id=${idByName.get(name) ?? "MISSING"}`
    );
  }

  console.log("\n=== RENTED (BANHENG/SHS/YIN) — stats only, NOT written ===");
  console.log("date,driver,area_trips");
  for (const [name, byDay] of [...rented.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    let sk = 0;
    let pt = 0;
    for (const day of [...byDay.keys()].sort((a, b) => a - b)) {
      const a = byDay.get(day)!;
      sk += a.songkhla;
      pt += a.pattani;
      const date = `2026-06-${String(day).padStart(2, "0")}`;
      const parts: string[] = [];
      if (a.songkhla) parts.push(`SK×${a.songkhla}`);
      if (a.pattani) parts.push(`PTN×${a.pattani}`);
      console.log(`${date},${name},${parts.join(" ")}`);
    }
    console.log(`  ${name} TOTAL: SK=${sk} PTN=${pt} trips=${sk + pt}`);
  }

  if (unknownDrivers.size > 0) {
    console.log("\n=== UNKNOWN drivers (skipped) ===");
    for (const [n, c] of unknownDrivers) console.log(`  ${n}: ${c} rows`);
  }

  // Trips on skip days (should be empty or noted)
  const skipDayTrips = allTrips.filter((t) => SKIP_DAYS.has(t.day));
  console.log(
    `\nTrips on excluded days (7/14/21/28/30): ${skipDayTrips.length} (not imported)`
  );
  if (skipDayTrips.length > 0) {
    const byDay = new Map<number, number>();
    for (const t of skipDayTrips) {
      byDay.set(t.day, (byDay.get(t.day) ?? 0) + 1);
    }
    for (const [d, c] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
      console.log(`  Jun ${d}: ${c} rows`);
    }
  }

  console.log("\nPREVIEW ONLY — no writes.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
