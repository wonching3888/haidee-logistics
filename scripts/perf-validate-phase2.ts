/**
 * Phase 2 validation: perf timing + data snapshot for June 2026.
 * Usage: npx tsx --env-file=.env.local scripts/perf-validate-phase2.ts [baseline|after]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { performance } from "node:perf_hooks";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { aggregateOperationsCosts } from "../lib/operations-cost";
import { aggregateOperationsIncome } from "../lib/operations-income";
import { aggregateLkimMaqisCost } from "../lib/operations-lkim-maqis";
import { aggregateThaiSegmentFreightCost } from "../lib/operations-thai-segment";
import {
  buildPnlCustomerAnalysis,
  buildPnlPeriodSummary,
  buildPnlTripsList,
  buildPnlTripDetail,
} from "../lib/pnl-report";
import { getFreightContextLoadCount, resetFreightContextLoadCount } from "../lib/perf-metrics";
import { clearPnlMonthTripsCache } from "../lib/pnl-month-cache";

const YEAR = 2026;
const MONTH = 6;
const LABEL = process.argv[2] ?? "after";
const OUT = `scripts/perf-snapshot-${LABEL}.json`;

async function time<T>(label: string, fn: () => Promise<T>) {
  resetFreightContextLoadCount();
  const start = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - start);
  const freightLoads = getFreightContextLoadCount();
  console.log(`[${LABEL}] ${label}: ${(ms / 1000).toFixed(2)}s, freightCtx=${freightLoads}`);
  return { result, ms, freightLoads };
}

async function main() {
  clearPnlMonthTripsCache();
  const snapshot: Record<string, unknown> = { label: LABEL, year: YEAR, month: MONTH };

  const trips = await time("buildPnlTripsList", () =>
    buildPnlTripsList({ year: YEAR, month: MONTH, day: null })
  );
  snapshot.tripsMs = trips.ms;
  snapshot.tripsFreightLoads = trips.freightLoads;
  snapshot.tripsTotals = trips.result.totals;
  snapshot.tripSamples = trips.result.trips.slice(0, 5).map((t) => ({
    tripId: t.tripId,
    date: t.date,
    revenueMyr: t.revenueMyr,
    totalCostMyr: t.totalCostMyr,
    grossProfitMyr: t.grossProfitMyr,
  }));

  const period = await time("buildPnlPeriodSummary", () =>
    buildPnlPeriodSummary({ year: YEAR, month: MONTH, periodMode: "month" })
  );
  snapshot.periodMs = period.ms;
  snapshot.periodSummary = period.result.periodSummary;

  const customers = await time("buildPnlCustomerAnalysis", () =>
    buildPnlCustomerAnalysis({ year: YEAR, month: MONTH })
  );
  snapshot.customersMs = customers.ms;
  snapshot.customerCount = customers.result.customers.length;
  snapshot.topCustomers = customers.result.customers.slice(0, 3).map((c) => ({
    shipperCode: c.shipperCode,
    revenueMyr: c.revenueMyr,
    totalCostMyr: c.totalCostMyr,
    grossProfitMyr: c.grossProfitMyr,
  }));

  const sampleIds = trips.result.trips.slice(0, 3).map((t) => t.tripId);
  snapshot.tripDetails = [];
  for (const tripId of sampleIds) {
    resetFreightContextLoadCount();
    const start = performance.now();
    const detail = await buildPnlTripDetail({ tripId, year: YEAR, month: MONTH });
    snapshot.tripDetails.push({
      tripId,
      ms: Math.round(performance.now() - start),
      freightLoads: getFreightContextLoadCount(),
      revenueMyr: detail.revenueMyr,
      directCostMyr: detail.directCostMyr,
      allocatedCostMyr: detail.allocatedCostMyr,
      totalCostMyr: detail.totalCostMyr,
      grossProfitMyr: detail.grossProfitMyr,
      marginPct: detail.marginPct,
      shipperCount: detail.shippers.length,
    });
  }

  const income = await time("aggregateOperationsIncome", () =>
    aggregateOperationsIncome(YEAR, MONTH)
  );
  snapshot.incomeMs = income.ms;
  snapshot.income = {
    mode1aThb: income.result.mode1aThb,
    mode1bMyr: income.result.mode1bMyr,
    mode2Myr: income.result.mode2Myr,
    wtlMode3Myr: income.result.wtlMode3Myr,
    lineCount: income.result.lineCount,
  };

  const costs = await time("aggregateOperationsCosts", () =>
    aggregateOperationsCosts(YEAR, MONTH)
  );
  snapshot.costsMs = costs.ms;
  snapshot.opsCosts = {
    tripCount: costs.result.tripCount,
    fuelMyr: costs.result.fuelMyr,
    tollFee: costs.result.tollFee,
    loadUnloadFee: costs.result.loadUnloadFee,
    crateRental: costs.result.crateRental,
  };

  await time("aggregateLkimMaqisCost", () => aggregateLkimMaqisCost(YEAR, MONTH));
  await time("aggregateThaiSegmentFreightCost", () =>
    aggregateThaiSegmentFreightCost(YEAR, MONTH)
  );

  writeFileSync(OUT, JSON.stringify(snapshot, null, 2));
  console.log(`\nWrote ${OUT}`);

  if (LABEL === "after" && existsSync("scripts/perf-snapshot-baseline.json")) {
    const base = JSON.parse(readFileSync("scripts/perf-snapshot-baseline.json", "utf8"));
    console.log("\n=== Comparison vs baseline ===");
    for (const key of ["tripsMs", "periodMs", "customersMs", "incomeMs", "costsMs", "tripsFreightLoads"]) {
      const b = base[key];
      const a = snapshot[key];
      if (b != null && a != null) {
        const pct = b ? Math.round(((b - a) / b) * 100) : 0;
        console.log(`${key}: ${b}ms -> ${a}ms (${pct}% faster)`);
      }
    }
    const fields = ["revenueMyr", "totalCostMyr", "grossProfitMyr"] as const;
    let mismatch = false;
    for (const field of fields) {
      const b = (base.tripsTotals as Record<string, number>)?.[field];
      const a = (snapshot.tripsTotals as Record<string, number>)?.[field];
      if (b !== a) {
        console.log(`MISMATCH tripsTotals.${field}: ${b} vs ${a}`);
        mismatch = true;
      }
    }
    if (!mismatch) console.log("tripsTotals: MATCH");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
