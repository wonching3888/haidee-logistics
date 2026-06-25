/**
 * Emit June P&L trip + operations totals snapshot (used by verify-step7a-wiring parity check).
 * Usage: npx tsx scripts/_step7a-snapshot-core.ts --label=before|after
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { aggregateOperationsCosts } from "@/lib/operations-cost";
import { buildPnlReport } from "@/lib/pnl-report";
import {
  getTripCostEngineConfig,
  reloadTripCostEngineConfig,
} from "@/lib/trip-cost-engine/config";

const YEAR = 2026;
const MONTH = 6;
const labelArg = process.argv.find((a) => a.startsWith("--label="));
const label = labelArg?.split("=")[1] ?? "snapshot";

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

async function main() {
  reloadTripCostEngineConfig({
    VOUCHER_COST_MODE: "legacy",
    VEHICLE_ALLOC_MODE: "legacy",
  });

  const [pnl, ops] = await Promise.all([
    buildPnlReport({ year: YEAR, month: MONTH }),
    aggregateOperationsCosts(YEAR, MONTH),
  ]);

  const trips: TripSnapshot[] = pnl.trips
    .filter((t) => t.tripSource === "dispatch")
    .map((trip) => ({
      dispatchOrderId: trip.dispatchOrderId ?? "",
      date: trip.date,
      routeLabel: trip.routeLabel,
      revenueMyr: trip.revenueMyr,
      directCostMyr: trip.directCostMyr,
      allocatedCostMyr: trip.allocatedCostMyr,
      totalCostMyr: trip.totalCostMyr,
      grossProfitMyr: trip.grossProfitMyr,
      vehicleTotalMyr: trip.vehicleCosts.totalMyr,
      shippers: trip.shippers.map((s) => ({
        shipperId: s.shipperId,
        quantity: s.quantity,
        allocatedCostMyr: s.allocatedCostMyr,
        unloadFeeMyr: s.unloadFeeMyr,
        totalCostMyr: s.totalCostMyr,
      })),
    }));

  const out = {
    label,
    year: YEAR,
    month: MONTH,
    flags: getTripCostEngineConfig(),
    tripCount: trips.length,
    pnlTotals: {
      revenueMyr: pnl.tripTotals.revenueMyr,
      directCostMyr: pnl.tripTotals.directCostMyr,
      allocatedCostMyr: pnl.tripTotals.allocatedCostMyr,
      totalCostMyr: pnl.tripTotals.totalCostMyr,
      grossProfitMyr: pnl.tripTotals.grossProfitMyr,
    },
    operationsTotals: ops,
    trips,
  };

  const dir = join(process.cwd(), "artifacts");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `step7a-snapshot-${label}-2026-06.json`);
  writeFileSync(path, JSON.stringify(out, null, 2), "utf8");
  console.log(`Wrote ${path}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
