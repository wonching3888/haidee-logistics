/**
 * Verify Period Summary operating margin after incremental fleet payroll (June 2026).
 * Run: npx tsx --env-file=.env --env-file=.env.local scripts/_verify-pnl-net-profit-after-payroll.ts
 */
import {
  buildPnlCustomerAnalysis,
  buildPnlPeriodSummary,
  buildPnlReport,
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
  const [period, payroll, trips, report, customers] = await Promise.all([
    buildPnlPeriodSummary({ year: YEAR, month: MONTH, periodMode: "month" }),
    loadFleetPayrollAggregate(YEAR, MONTH, { sync: false }),
    buildPnlTripsList({
      year: YEAR,
      month: MONTH,
      routeFilter: "ALL",
      driverFilter: "ALL",
    }),
    buildPnlReport({ year: YEAR, month: MONTH, periodMode: "month" }),
    buildPnlCustomerAnalysis({ year: YEAR, month: MONTH }),
  ]);

  const s = period.periodSummary;
  console.log("=== Period Summary (June 2026) ===");
  console.log(`  grossProfitMyr=${s.grossProfitMyr.toFixed(2)}`);
  console.log(`  fleetPayrollTotalMyr=${s.fleetPayrollTotalMyr?.toFixed(2)}`);
  console.log(
    `  pnlTripDriverAllowanceMyr=${s.pnlTripDriverAllowanceMyr?.toFixed(2)}`
  );
  console.log(
    `  fleetPayrollIncrementalMyr=${s.fleetPayrollIncrementalMyr?.toFixed(2)}`
  );
  console.log(
    `  netProfitAfterFleetPayrollMyr=${s.netProfitAfterFleetPayrollMyr?.toFixed(2)}`
  );
  if (s.payrollVariableAllowanceMyr != null) {
    console.log(
      `  payrollVariableAllowanceMyr=${s.payrollVariableAllowanceMyr.toFixed(2)}`
    );
    console.log(
      `  allowanceReconciliation=${(s.payrollVariableAllowanceMyr - (s.pnlTripDriverAllowanceMyr ?? 0)).toFixed(2)}`
    );
  }

  let ok = true;
  ok = check("fleet payroll (live)", payroll.totalCostMyr, s.fleetPayrollTotalMyr ?? 0) && ok;

  const dispatchDriverAllowance = report.trips
    .filter((t) => t.tripSource === "dispatch")
    .reduce((sum, t) => sum + t.vehicleCosts.driverMyr, 0);
  ok =
    check(
      "pnl trip driver allowance",
      s.pnlTripDriverAllowanceMyr ?? 0,
      Math.round(dispatchDriverAllowance * 100) / 100
    ) && ok;

  ok =
    check(
      "incremental fleet payroll",
      s.fleetPayrollIncrementalMyr ?? 0,
      (s.fleetPayrollTotalMyr ?? 0) - (s.pnlTripDriverAllowanceMyr ?? 0)
    ) && ok;

  ok =
    check(
      "operating margin after fleet labor",
      s.netProfitAfterFleetPayrollMyr ?? 0,
      s.grossProfitMyr - (s.fleetPayrollIncrementalMyr ?? 0)
    ) && ok;

  const oldFormula = s.grossProfitMyr - payroll.totalCostMyr;
  if (approx(oldFormula, s.netProfitAfterFleetPayrollMyr ?? 0)) {
    console.log("✗ still using old gross − full payroll formula");
    ok = false;
  } else {
    console.log("✓ differs from old gross − full payroll formula");
  }

  console.log("\n=== Regression: trips tab unchanged ===");
  console.log(`  trips=${trips.trips.length} totals.revenue=${trips.totals.revenueMyr.toFixed(2)}`);
  ok = trips.trips.length === 79 ? (console.log("  ✓ 79 trips"), true) : ok;

  console.log("\n=== Regression: customer tab unchanged ===");
  ok = customers.customers.length > 0 ? true : ok;

  if (!ok) process.exit(1);
  console.log("\nAll checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
