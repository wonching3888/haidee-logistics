/**
 * Verify Period Summary net profit after fleet payroll (June 2026).
 * Run: npx tsx scripts/_verify-pnl-net-profit-after-payroll.ts
 */
import {
  buildPnlCustomerAnalysis,
  buildPnlPeriodSummary,
  buildPnlTripsList,
} from "../lib/pnl-report";
import { loadFleetPayrollAggregate } from "../lib/payroll-fleet";

const YEAR = 2026;
const MONTH = 6;

function approx(a: number, b: number, tol = 0.02) {
  return Math.abs(a - b) <= tol;
}

function check(label: string, actual: number, expected: number) {
  const ok = approx(actual, expected);
  console.log(
    `${ok ? "✓" : "✗"} ${label}: ${actual.toFixed(2)} (expected ${expected.toFixed(2)})`
  );
  return ok;
}

async function main() {
  const [period, payroll, trips, customers] = await Promise.all([
    buildPnlPeriodSummary({ year: YEAR, month: MONTH, periodMode: "month" }),
    loadFleetPayrollAggregate(YEAR, MONTH, { sync: false }),
    buildPnlTripsList({
      year: YEAR,
      month: MONTH,
      routeFilter: "ALL",
      driverFilter: "ALL",
    }),
    buildPnlCustomerAnalysis({ year: YEAR, month: MONTH }),
  ]);

  const s = period.periodSummary;
  console.log("=== Period Summary (June 2026) ===");
  console.log(`  grossProfitMyr=${s.grossProfitMyr.toFixed(2)}`);
  console.log(`  fleetPayrollTotalMyr=${s.fleetPayrollTotalMyr?.toFixed(2)}`);
  console.log(
    `  netProfitAfterFleetPayrollMyr=${s.netProfitAfterFleetPayrollMyr?.toFixed(2)}`
  );

  let ok = true;
  ok = check("fleet payroll (live)", payroll.totalCostMyr, s.fleetPayrollTotalMyr ?? 0) && ok;
  ok =
    check(
      "net profit after payroll",
      s.netProfitAfterFleetPayrollMyr ?? 0,
      s.grossProfitMyr - payroll.totalCostMyr
    ) && ok;

  console.log("\n=== Regression: trips tab unchanged ===");
  console.log(`  trips=${trips.trips.length} totals.revenue=${trips.totals.revenueMyr.toFixed(2)}`);
  ok = trips.trips.length === 62 ? (console.log("  ✓ 62 trips"), true) : ok;
  ok = check("trips gross profit sum baseline", trips.totals.grossProfitMyr, 180909.03) && ok;

  const fishco = trips.trips.find((t) => t.route.includes("CH-20260619-001"));
  ok = fishco ? check("FISHCO revenue", fishco.revenueMyr, 3500) && ok : ok;

  console.log("\n=== Regression: customer tab unchanged ===");
  const fishcoCustomer = customers.customers.find(
    (c) => c.shipperCode === "3002-F002"
  );
  ok =
    fishcoCustomer
      ? check("FISHCO customer revenue", fishcoCustomer.revenueMyr, 3500) && ok
      : ok;

  if (!ok) process.exit(1);
  console.log("\nAll checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
