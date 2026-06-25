/**
 * Step 7a: verify P&L + operations wiring leaves legacy output unchanged.
 *
 * Runs before (HEAD pnl/operations) vs after (wired facade) June 2026 snapshots.
 *
 * Usage: npx tsx scripts/verify-step7a-wiring.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { execSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const BACKUP_DIR = join(ROOT, ".step7a-backup");
const ARTIFACTS = join(ROOT, "artifacts");
const BEFORE_PATH = join(ARTIFACTS, "step7a-snapshot-before-2026-06.json");
const AFTER_PATH = join(ARTIFACTS, "step7a-snapshot-after-2026-06.json");
const REPORT_PATH = join(ARTIFACTS, "step7a-wiring-verify-2026-06.json");

const WIRED_FILES = [
  "lib/pnl-report.ts",
  "lib/operations-cost.ts",
  "lib/trip-cost-engine/index.ts",
] as const;

interface TripSnapshot {
  dispatchOrderId: string;
  date: string;
  routeLabel: string;
  revenueMyr: number;
  directCostMyr: number;
  allocatedCostMyr: number;
  totalCostMyr: number;
  grossProfitMyr: number;
  vehicleTotalMyr: number;
  shippers: Array<{
    shipperId: string;
    quantity: number;
    allocatedCostMyr: number;
    unloadFeeMyr: number;
    totalCostMyr: number;
  }>;
}

interface SnapshotFile {
  label: string;
  tripCount: number;
  pnlTotals: Record<string, number>;
  operationsTotals: Record<string, number>;
  trips: TripSnapshot[];
}

function runSnapshot(label: "before" | "after") {
  execSync(`npx tsx scripts/_step7a-snapshot-core.ts --label=${label}`, {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
}

function backupWiredFiles() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  for (const rel of WIRED_FILES) {
    copyFileSync(join(ROOT, rel), join(BACKUP_DIR, rel.replace(/\//g, "__")));
  }
}

function restoreWiredFiles() {
  for (const rel of WIRED_FILES) {
    copyFileSync(join(BACKUP_DIR, rel.replace(/\//g, "__")), join(ROOT, rel));
  }
}

function checkoutPreWiringFiles() {
  execSync(`git checkout HEAD -- ${WIRED_FILES.join(" ")}`, {
    cwd: ROOT,
    stdio: "inherit",
  });
}

function compareTrips(
  before: TripSnapshot[],
  after: TripSnapshot[]
): Array<{ tripId: string; field: string; before: number; after: number }> {
  const byId = new Map(after.map((t) => [t.dispatchOrderId, t]));
  const mismatches: Array<{
    tripId: string;
    field: string;
    before: number;
    after: number;
  }> = [];

  for (const trip of before) {
    const other = byId.get(trip.dispatchOrderId);
    if (!other) {
      mismatches.push({
        tripId: trip.dispatchOrderId,
        field: "missing_trip",
        before: 1,
        after: 0,
      });
      continue;
    }

    const fields: (keyof Omit<
      TripSnapshot,
      "dispatchOrderId" | "date" | "routeLabel" | "shippers"
    >)[] = [
      "revenueMyr",
      "directCostMyr",
      "allocatedCostMyr",
      "totalCostMyr",
      "grossProfitMyr",
      "vehicleTotalMyr",
    ];
    for (const field of fields) {
      if (Math.abs(trip[field] - other[field]) > 0.01) {
        mismatches.push({
          tripId: trip.dispatchOrderId,
          field,
          before: trip[field],
          after: other[field],
        });
      }
    }

    const afterShippers = new Map(other.shippers.map((s) => [s.shipperId, s]));
    for (const shipper of trip.shippers) {
      const otherShipper = afterShippers.get(shipper.shipperId);
      if (!otherShipper) {
        mismatches.push({
          tripId: trip.dispatchOrderId,
          field: `shipper_missing:${shipper.shipperId}`,
          before: 1,
          after: 0,
        });
        continue;
      }
      for (const field of [
        "allocatedCostMyr",
        "unloadFeeMyr",
        "totalCostMyr",
      ] as const) {
        if (Math.abs(shipper[field] - otherShipper[field]) > 0.01) {
          mismatches.push({
            tripId: trip.dispatchOrderId,
            field: `shipper.${shipper.shipperId}.${field}`,
            before: shipper[field],
            after: otherShipper[field],
          });
        }
      }
    }
  }

  return mismatches;
}

function compareTotals(
  before: Record<string, number>,
  after: Record<string, number>,
  prefix: string
) {
  const mismatches: Array<{
    tripId: string;
    field: string;
    before: number;
    after: number;
  }> = [];
  for (const key of Object.keys(before)) {
    const b = before[key] ?? 0;
    const a = after[key] ?? 0;
    if (typeof b === "number" && typeof a === "number" && Math.abs(b - a) > 0.01) {
      mismatches.push({
        tripId: prefix,
        field: key,
        before: b,
        after: a,
      });
    }
  }
  return mismatches;
}

async function main() {
  backupWiredFiles();

  try {
    console.log("=== Step 7a parity: snapshot BEFORE wiring (HEAD pnl/operations) ===");
    checkoutPreWiringFiles();
    runSnapshot("before");

    console.log("\n=== Step 7a parity: snapshot AFTER wiring (facade + legacy flags) ===");
    restoreWiredFiles();
    runSnapshot("after");
  } finally {
    restoreWiredFiles();
  }

  if (!existsSync(BEFORE_PATH) || !existsSync(AFTER_PATH)) {
    throw new Error("Snapshot files missing after parity run");
  }

  const before = JSON.parse(readFileSync(BEFORE_PATH, "utf8")) as SnapshotFile;
  const after = JSON.parse(readFileSync(AFTER_PATH, "utf8")) as SnapshotFile;

  const tripMismatches = compareTrips(before.trips, after.trips);
  const pnlTotalMismatches = compareTotals(
    before.pnlTotals,
    after.pnlTotals,
    "pnl_totals"
  );
  const opsTotalMismatches = compareTotals(
    before.operationsTotals,
    after.operationsTotals,
    "operations_totals"
  );
  const mismatches = [
    ...tripMismatches,
    ...pnlTotalMismatches,
    ...opsTotalMismatches,
  ];

  const report = {
    year: 2026,
    month: 6,
    flags: { voucherCostMode: "legacy", vehicleAllocMode: "legacy" },
    beforeTripCount: before.tripCount,
    afterTripCount: after.tripCount,
    pnlTotalsBefore: before.pnlTotals,
    pnlTotalsAfter: after.pnlTotals,
    operationsTotalsBefore: before.operationsTotals,
    operationsTotalsAfter: after.operationsTotals,
    legacyParityPass: mismatches.length === 0,
    mismatchCount: mismatches.length,
    mismatches: mismatches.slice(0, 50),
    wiringNote:
      "before=HEAD pnl/operations; after=wired trip-cost-facade with legacy flags",
  };

  mkdirSync(ARTIFACTS, { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");

  console.log(`\nWrote ${REPORT_PATH}`);
  console.log(
    `P&L totals: revenue ${before.pnlTotals.revenueMyr} → ${after.pnlTotals.revenueMyr} | cost ${before.pnlTotals.totalCostMyr} → ${after.pnlTotals.totalCostMyr}`
  );
  console.log(
    `Operations: fuel ${before.operationsTotals.fuelMyr} → ${after.operationsTotals.fuelMyr} | loadUnload ${before.operationsTotals.loadUnloadFee} → ${after.operationsTotals.loadUnloadFee}`
  );

  if (mismatches.length === 0) {
    console.log("\n✓ Legacy parity PASS — wiring did not change June 2026 numbers.");
  } else {
    console.error(`\n✗ Legacy parity FAIL — ${mismatches.length} mismatch(es):`);
    for (const m of mismatches.slice(0, 10)) {
      console.error(
        `  ${m.tripId} ${m.field}: before=${m.before} after=${m.after}`
      );
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
