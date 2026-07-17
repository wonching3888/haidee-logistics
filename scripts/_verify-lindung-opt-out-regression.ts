/**
 * Regression: with lindung24JamOptOut=false (default), driver month summaries
 * must match the pre-opt-out formula (undefined optOut ≡ false).
 *
 * Run: node --env-file=.env.local --import tsx scripts/_verify-lindung-opt-out-regression.ts
 */
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/freight-rates";
import type { MaritalStatus } from "@/lib/constants/payroll";
import {
  buildDriverPayrollSummaryFromRecords,
  type DriverPayrollDriverInput,
} from "@/lib/payroll-fleet";
import {
  emptyPcbYtd,
  loadPcbYtdBalancesAsOf,
  priorPayrollYearMonth,
} from "@/lib/pcb-ytd-balance";
import {
  isDriverEligibleForPayrollMonth,
  driverQueryCandidatesForPayroll,
} from "@/lib/driver-payroll-eligibility";

const YEAR = 2026;
const MONTH = 6;

function snap(summary: ReturnType<typeof buildDriverPayrollSummaryFromRecords>) {
  return {
    gross: summary.grossSalary,
    net: summary.netSalary,
    epfE: summary.statutory.epfEmployee,
    epfR: summary.statutory.epfEmployer,
    socsoE: summary.statutory.socsoEmployee,
    socsoR: summary.statutory.socsoEmployer,
    lindung: summary.statutory.lindung24Jam,
    eisE: summary.statutory.eisEmployee,
    eisR: summary.statutory.eisEmployer,
    pcb: summary.statutory.pcb,
  };
}

async function main() {
  const yearMonth = `${YEAR}-${String(MONTH).padStart(2, "0")}`;
  const priorYm = priorPayrollYearMonth(YEAR, MONTH);
  const [allDrivers, ytd] = await Promise.all([
    prisma.driver.findMany({
      where: driverQueryCandidatesForPayroll(),
      orderBy: { name: "asc" },
      include: {
        payrollMonths: {
          where: { yearMonth },
          include: { trips: true, extras: true },
        },
      },
    }),
    loadPcbYtdBalancesAsOf(priorYm),
  ]);

  const drivers = allDrivers
    .filter((d) => isDriverEligibleForPayrollMonth(d, YEAR, MONTH))
    .filter((d) => d.payrollMonths.length > 0)
    .slice(0, 8);

  console.log(`Comparing ${drivers.length} drivers for ${yearMonth}`);
  let mismatches = 0;

  for (const driver of drivers) {
    const monthRecord = driver.payrollMonths[0];
    const baseInput: DriverPayrollDriverInput = {
      id: driver.id,
      name: driver.name,
      baseSalary: decimalToNumber(driver.baseSalary),
      maritalStatus: driver.maritalStatus as MaritalStatus | null,
      spouseWorking: driver.spouseWorking,
      childCount: driver.childCount,
      isSocsoSecondCategory: driver.isSocsoSecondCategory,
    };
    const pcbContext = {
      payrollYear: YEAR,
      payrollMonth: MONTH,
      pcbYtdBeforeMonth: ytd.get(driver.id) ?? emptyPcbYtd(),
      pcbLocked: monthRecord.pcbLocked,
      pcbFinal: decimalToNumber(monthRecord.pcbFinal),
    };

    const baseline = buildDriverPayrollSummaryFromRecords({
      driver: { ...baseInput, lindung24JamOptOut: undefined },
      trips: monthRecord.trips,
      extras: monthRecord.extras,
      overrides: monthRecord,
      pcbContext,
    });
    const withFalse = buildDriverPayrollSummaryFromRecords({
      driver: {
        ...baseInput,
        lindung24JamOptOut: driver.lindung24JamOptOut,
      },
      trips: monthRecord.trips,
      extras: monthRecord.extras,
      overrides: monthRecord,
      pcbContext,
    });

    const a = snap(baseline);
    const b = snap(withFalse);
    const same = JSON.stringify(a) === JSON.stringify(b);
    console.log(
      `${same ? "OK" : "FAIL"} ${driver.name} optOut=${driver.lindung24JamOptOut} lindung=${b.lindung} net=${b.net}`
    );
    if (!same) {
      mismatches += 1;
      console.log("  baseline", a);
      console.log("  current ", b);
    }
  }

  if (mismatches > 0) {
    throw new Error(`${mismatches} driver(s) mismatched`);
  }
  console.log("ALL MATCH — optOut=false leaves payslips unchanged");
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
