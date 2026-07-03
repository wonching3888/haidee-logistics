/**
 * Read-only: compare PAYSLIP gross vs JV wages for crate return commission.
 * Run: node --env-file=.env.local --import tsx scripts/_audit-crate-commission-payslip-vs-jv-june-2026.ts
 */
import { decimalToNumber } from "../lib/freight-rates";
import { toDateInputValue } from "../lib/date-utils";
import { getRouteLabel } from "../lib/payroll-route-label";
import {
  buildDriverPayrollSummaryFromRecords,
  type DriverPayrollDriverInput,
} from "../lib/payroll-fleet";
import { buildDriverJvFromSummary } from "../lib/payroll-jv-export";
import { syncFleetPayrollForMonth } from "../lib/payroll-month-sync";
import type { MaritalStatus } from "../lib/constants/payroll";

const YEAR = 2026;
const MONTH = 6;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function jvWagesFromSummary(summary: ReturnType<typeof buildDriverPayrollSummaryFromRecords>) {
  return round2(
    summary.tripAllowanceTotal +
      summary.charterSalaryTotal +
      summary.crateCommissionTotal +
      summary.crateMultiMarketTotal +
      summary.extraAllowanceTotal
  );
}

function visibleEarningsSum(summary: ReturnType<typeof buildDriverPayrollSummaryFromRecords>) {
  return round2(
    summary.baseSalary +
      summary.tripAllowanceTotal +
      summary.charterSalaryTotal +
      summary.crateCommissionTotal +
      summary.extraAllowanceTotal
  );
}

async function main() {
  const { prisma } = await import("../lib/prisma");
  await syncFleetPayrollForMonth(YEAR, MONTH);

  const yearMonth = `${YEAR}-${String(MONTH).padStart(2, "0")}`;
  const drivers = await prisma.driver.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: {
      payrollMonths: {
        where: { yearMonth },
        include: { trips: { orderBy: [{ date: "asc" }, { sortOrder: "asc" }] }, extras: true },
      },
    },
  });

  console.log("\n=== Crate Return Commission: PAYSLIP vs JV (June 2026) ===\n");

  const focus = ["Akim", "Pinat"];
  const allRows: Array<{
    name: string;
    crateCommission: number;
    crateMultiMarket: number;
    gross: number;
    visibleSum: number;
    grossGap: number;
    jvWages: number;
    jvVsGrossExBase: number;
  }> = [];

  for (const driver of drivers) {
    const month = driver.payrollMonths[0];
    const trips = month?.trips ?? [];
    const driverInput: DriverPayrollDriverInput = {
      id: driver.id,
      name: driver.name,
      baseSalary: decimalToNumber(driver.baseSalary),
      maritalStatus: driver.maritalStatus as MaritalStatus | null,
      childCount: driver.childCount,
      isSocsoSecondCategory: driver.isSocsoSecondCategory,
    };

    const summary = buildDriverPayrollSummaryFromRecords({
      driver: driverInput,
      trips,
      extras: month?.extras ?? [],
      overrides: month ?? undefined,
    });

    const jv = buildDriverJvFromSummary({
      driver: {
        id: driver.id,
        name: driver.name,
        fullName: driver.fullName,
        accountCodeSuffix: driver.accountCodeSuffix ?? driver.name.toUpperCase(),
      },
      summary,
      jvNo: "AUDIT",
      jvDate: "2026-06-30",
    });

    const crateCommission = summary.crateCommissionTotal;
    const crateMultiMarket = summary.crateMultiMarketTotal;
    const visibleSum = visibleEarningsSum(summary);
    const grossGap = round2(summary.grossSalary - visibleSum);
    const jvWages = jv.amounts.wages;
    const jvVsGrossExBase = round2(
      jvWages - (summary.grossSalary - summary.baseSalary)
    );

    allRows.push({
      name: driver.name,
      crateCommission,
      crateMultiMarket,
      gross: summary.grossSalary,
      visibleSum,
      grossGap,
      jvWages,
      jvVsGrossExBase,
    });

    if (!focus.includes(driver.name) && crateMultiMarket === 0 && crateCommission === 0) {
      continue;
    }

    console.log(`\n--- ${driver.name} ---`);
    console.log(
      `Totals: commission=${crateCommission.toFixed(2)} multiMarket=${crateMultiMarket.toFixed(2)} gross=${summary.grossSalary.toFixed(2)}`
    );
    console.log(
      `UI visible sum (no multiMarket line): ${visibleSum.toFixed(2)} | gap vs gross: ${grossGap.toFixed(2)}`
    );
    console.log(
      `JV wages (6307): ${jvWages.toFixed(2)} | JV wages - (gross-base): ${jvVsGrossExBase.toFixed(2)}`
    );

    const tripDetails = trips
      .filter(
        (t) =>
          (decimalToNumber(t.crateReturnCommission) ?? 0) > 0 ||
          (decimalToNumber(t.crateReturnMultiMarketAllowance) ?? 0) > 0
      )
      .map((t) => ({
        date: toDateInputValue(t.date),
        route: getRouteLabel(t.markets.length > 0 ? t.markets : t.route),
        markets: t.markets.join("/"),
        commission: decimalToNumber(t.crateReturnCommission) ?? 0,
        multiMarket: decimalToNumber(t.crateReturnMultiMarketAllowance) ?? 0,
      }));

    if (tripDetails.length) {
      console.log("Per-trip crate earnings:");
      for (const row of tripDetails) {
        console.log(
          `  ${row.date} | ${row.route} | markets=${row.markets} | commission=${row.commission.toFixed(2)} multiMarket=${row.multiMarket.toFixed(2)}`
        );
      }
    } else {
      console.log("Per-trip crate earnings: (none stored)");
    }
  }

  console.log("\n\n=== All 14 drivers summary ===\n");
  console.log(
    "| Driver | Commission | MultiMarket | Gross | VisibleSum* | GrossGap | JV Wages |"
  );
  console.log(
    "|--------|----------:|------------:|------:|------------:|---------:|---------:|"
  );
  for (const row of allRows) {
    console.log(
      `| ${row.name} | ${row.crateCommission.toFixed(2)} | ${row.crateMultiMarket.toFixed(2)} | ${row.gross.toFixed(2)} | ${row.visibleSum.toFixed(2)} | ${row.grossGap.toFixed(2)} | ${row.jvWages.toFixed(2)} |`
    );
  }
  console.log(
    "\n*VisibleSum = base + trip + charter + crateCommission + extra (PAYSLIP UI line items, excludes multiMarket column)"
  );

  const withGap = allRows.filter((r) => Math.abs(r.grossGap) > 0.001);
  console.log(`\nDrivers with grossGap > 0 (multiMarket in gross but not in visible lines): ${withGap.length}`);
  if (withGap.length) {
    for (const r of withGap) {
      console.log(`  ${r.name}: gap=${r.grossGap.toFixed(2)} (= crateMultiMarket ${r.crateMultiMarket.toFixed(2)})`);
    }
  }

  const jvMismatch = allRows.filter((r) => Math.abs(r.jvVsGrossExBase) > 0.01);
  console.log(`\nJV wages vs gross(ex-base) mismatch: ${jvMismatch.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
