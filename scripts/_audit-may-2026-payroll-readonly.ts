/**
 * Read-only: inspect May 2026 DriverPayrollMonth rows — real data vs empty?
 * Run: node --env-file=.env.local --import tsx scripts/_audit-may-2026-payroll-readonly.ts
 */
import type { MaritalStatus } from "@/lib/constants/payroll";
import { decimalToNumber } from "@/lib/freight-rates";
import { buildDriverPayrollSummaryFromRecords } from "@/lib/payroll-fleet";
import { prisma } from "@/lib/prisma";

function fmt(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(2);
}

function sumField(
  trips: Array<Record<string, unknown>>,
  key: string
): number {
  return trips.reduce((s, t) => s + (decimalToNumber(t[key]) ?? 0), 0);
}

async function main() {
  const months = await prisma.driverPayrollMonth.findMany({
    where: { yearMonth: "2026-05" },
    include: {
      driver: { select: { name: true, baseSalary: true, maritalStatus: true, spouseWorking: true, childCount: true, isSocsoSecondCategory: true, lindung24JamOptOut: true } },
      trips: true,
      extras: true,
    },
    orderBy: { driver: { name: "asc" } },
  });

  console.log(`May 2026 DriverPayrollMonth rows: ${months.length}\n`);
  console.log(
    [
      "Name".padEnd(12),
      "Base".padStart(8),
      "Trips".padStart(5),
      "TripCreatedAt range".padEnd(42),
      "TripAllow".padStart(9),
      "Charter".padStart(8),
      "CrateComm".padStart(9),
      "MultiMkt".padStart(8),
      "Extras".padStart(6),
      "ExtraAmt".padStart(9),
      "Gross".padStart(9),
      "Month.updatedAt",
    ].join(" ")
  );

  for (const m of months) {
    const d = m.driver;
    const tripCount = m.trips.length;
    let createdRange = "—";
    if (tripCount > 0) {
      const times = m.trips.map((t) => t.createdAt.getTime());
      const min = new Date(Math.min(...times)).toISOString();
      const max = new Date(Math.max(...times)).toISOString();
      createdRange = min === max ? min : `${min} .. ${max}`;
    }

    const tripAllow = sumField(m.trips, "tripAllowance");
    const charter = sumField(m.trips, "charterSalary");
    const crateComm = sumField(m.trips, "crateReturnCommission");
    const multiMkt = sumField(m.trips, "crateReturnMultiMarketAllowance");
    const extraAmt = m.extras.reduce(
      (s, e) => s + (decimalToNumber(e.amount) ?? 0),
      0
    );

    const summary = buildDriverPayrollSummaryFromRecords({
      driver: {
        id: m.driverId,
        name: d.name,
        baseSalary: decimalToNumber(d.baseSalary),
        maritalStatus: d.maritalStatus as MaritalStatus | null,
        spouseWorking: d.spouseWorking,
        childCount: d.childCount,
        isSocsoSecondCategory: d.isSocsoSecondCategory,
        lindung24JamOptOut: d.lindung24JamOptOut,
      },
      trips: m.trips,
      extras: m.extras,
      overrides: m,
    });

    console.log(
      [
        d.name.padEnd(12),
        fmt(decimalToNumber(d.baseSalary)).padStart(8),
        String(tripCount).padStart(5),
        createdRange.padEnd(42),
        fmt(tripAllow).padStart(9),
        fmt(charter).padStart(8),
        fmt(crateComm).padStart(9),
        fmt(multiMkt).padStart(8),
        String(m.extras.length).padStart(6),
        fmt(extraAmt).padStart(9),
        fmt(summary.grossSalary).padStart(9),
        m.updatedAt.toISOString(),
      ].join(" ")
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
