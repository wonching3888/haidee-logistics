/**
 * Read-only: employer EPF before (Third Schedule table) vs after (flat 13% of gross)
 * for all drivers + staff in a payroll month. No DB writes.
 *
 * Run:
 *   node --env-file=.env.local --import tsx scripts/_audit-epf-flat-13-readonly.ts
 *   node --env-file=.env.local --import tsx scripts/_audit-epf-flat-13-readonly.ts 2026 6
 *   node --env-file=.env.local --import tsx scripts/_audit-epf-flat-13-readonly.ts 2026 7
 */
import { lookupEpfContributions } from "@/lib/constants/epf-brackets";
import { decimalToNumber } from "@/lib/freight-rates";
import type { MaritalStatus } from "@/lib/constants/payroll";
import {
  buildDriverPayrollSummaryFromRecords,
} from "@/lib/payroll-fleet";
import { buildStaffMonthPayrollSummary } from "@/lib/staff-payroll-calc";
import { prisma } from "@/lib/prisma";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function fmt(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(2);
}

const JUNE_BASELINE_EMPLOYER: Record<string, number> = {
  Halim: 463,
  Awang: 624,
  Azrin: 533,
  Wan: 624,
  Own: 541,
  Rozaime: 541,
  Fook: 588,
  Faizal: 606,
  Akim: 604,
  Naim: 630,
  Azhar: 617,
  Pinat: 612,
  Din: 115,
  Ikmal: 601,
};

async function auditDrivers(year: number, month: number) {
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
  const drivers = await prisma.driver.findMany({
    where: {
      OR: [{ active: true }, { terminationDate: { not: null } }],
    },
    orderBy: { name: "asc" },
    include: {
      payrollMonths: {
        where: { yearMonth },
        include: { trips: true, extras: true },
      },
    },
  });

  console.log(`\n=== Drivers ${yearMonth} (n=${drivers.length}) ===\n`);
  console.log(
    [
      "Name".padEnd(12),
      "Base".padStart(8),
      "Gross".padStart(8),
      "Override".padStart(10),
      "Before".padStart(8),
      "After13%".padStart(9),
      "Δ".padStart(8),
      "Note",
    ].join(" ")
  );

  for (const driver of drivers) {
    const m = driver.payrollMonths[0];
    if (!m) {
      console.log(
        `${driver.name.padEnd(12)} ${"—".padStart(8)} ${"—".padStart(8)} ${"—".padStart(10)} ${"—".padStart(8)} ${"—".padStart(9)} ${"—".padStart(8)} no payroll month`
      );
      continue;
    }

    const override = decimalToNumber(m.epfEmployerOverride);
    const summary = buildDriverPayrollSummaryFromRecords({
      driver: {
        id: driver.id,
        name: driver.name,
        baseSalary: decimalToNumber(driver.baseSalary),
        maritalStatus: driver.maritalStatus as MaritalStatus | null,
        spouseWorking: driver.spouseWorking,
        childCount: driver.childCount,
        isSocsoSecondCategory: driver.isSocsoSecondCategory,
        lindung24JamOptOut: driver.lindung24JamOptOut,
      },
      trips: m.trips,
      extras: m.extras,
      overrides: m,
    });

    const tableEmployer = lookupEpfContributions(summary.grossSalary).employer;
    const flatEmployer = roundMoney(summary.grossSalary * 0.13);
    const before = override ?? tableEmployer;
    const after = summary.statutory.epfEmployer; // policy path (override or flat 13%)
    const delta = roundMoney(after - before);
    const notes: string[] = [];
    if (override != null) notes.push("override");
    if (summary.grossSalary > 5000) notes.push(">5k");
    if (yearMonth === "2026-06" && JUNE_BASELINE_EMPLOYER[driver.name] != null) {
      const expected = JUNE_BASELINE_EMPLOYER[driver.name];
      if (Math.abs(tableEmployer - expected) > 0.01) {
        notes.push(`baseline≠${expected}`);
      } else {
        notes.push("baselineOK");
      }
    }

    console.log(
      [
        driver.name.padEnd(12),
        fmt(summary.baseSalary).padStart(8),
        fmt(summary.grossSalary).padStart(8),
        (override != null ? fmt(override) : "—").padStart(10),
        fmt(before).padStart(8),
        fmt(after).padStart(9),
        fmt(delta).padStart(8),
        notes.join(",") || "",
      ].join(" ")
    );
  }
}

async function auditStaff(year: number, month: number) {
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
  const staffList = await prisma.staff.findMany({
    where: {
      OR: [{ active: true }, { terminationDate: { not: null } }],
    },
    orderBy: { name: "asc" },
    include: {
      payrollMonths: { where: { yearMonth } },
    },
  });

  console.log(`\n=== Staff ${yearMonth} (n=${staffList.length}) ===\n`);
  console.log(
    [
      "Name".padEnd(24),
      "Base".padStart(8),
      "Gross".padStart(8),
      "Override".padStart(10),
      "Before".padStart(8),
      "After13%".padStart(9),
      "Δ".padStart(8),
      "Note",
    ].join(" ")
  );

  for (const staff of staffList) {
    const m = staff.payrollMonths[0];
    const base = decimalToNumber(staff.baseSalary) ?? 0;
    const override = decimalToNumber(m?.epfEmployerOverride);
    const summary = buildStaffMonthPayrollSummary({
      baseSalary: base,
      maritalStatus: staff.maritalStatus as MaritalStatus | null,
      spouseWorking: staff.spouseWorking,
      childCount: staff.childCount,
      isSocsoSecondCategory: staff.isSocsoSecondCategory,
      lindung24JamOptOut: staff.lindung24JamOptOut,
      year,
      month,
      pcbLocked: m?.pcbLocked,
      pcbFinal: decimalToNumber(m?.pcbFinal),
      monthOverrides: m,
    });

    const tableEmployer = lookupEpfContributions(base).employer;
    const before = override ?? tableEmployer;
    const after = summary.statutory.epfEmployer;
    const delta = roundMoney(after - before);
    const notes: string[] = [];
    if (!m) notes.push("no month row");
    if (override != null) notes.push("override");
    if (base > 5000) notes.push(">5k");

    console.log(
      [
        staff.name.slice(0, 24).padEnd(24),
        fmt(base).padStart(8),
        fmt(summary.grossSalary).padStart(8),
        (override != null ? fmt(override) : "—").padStart(10),
        fmt(before).padStart(8),
        fmt(after).padStart(9),
        fmt(delta).padStart(8),
        notes.join(",") || "",
      ].join(" ")
    );
  }
}

async function main() {
  const year = Number(process.argv[2] ?? 2026);
  const month = Number(process.argv[3] ?? 7);
  console.log(
    `Read-only EPF flat-13% preview for ${year}-${String(month).padStart(2, "0")}`
  );
  console.log(
    "Before = epfEmployerOverride ?? Third Schedule table; After = current policy (override ?? gross×13%)."
  );
  console.log("No writes.");

  await auditDrivers(year, month);
  await auditStaff(year, month);

  if (year !== 2026 || month !== 6) {
    console.log("\n--- Also printing June 2026 for known-baseline check ---\n");
    await auditDrivers(2026, 6);
    await auditStaff(2026, 6);
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
