/**
 * Freeze June 2026 employer EPF at already-paid tiered-table values for the
 * 13 drivers without an override (Pinat already has 655 — skip).
 * Ahead of flat-13% policy shipping. Audited writes only.
 *
 * Run: node --env-file=.env.local --import tsx scripts/_freeze-june-2026-epf-employer.ts
 */
import { lookupEpfContributions } from "@/lib/constants/epf-brackets";
import type { MaritalStatus } from "@/lib/constants/payroll";
import { decimalToNumber } from "@/lib/freight-rates";
import { buildDriverPayrollSummaryFromRecords } from "@/lib/payroll-fleet";
import { applyPayrollOverridePatch } from "@/lib/payroll-override-write";
import { prisma } from "@/lib/prisma";
import type { AppUser } from "@/types";

const YEAR_MONTH = "2026-06";
const AUDIT_NOTE =
  "Freeze June 2026 employer EPF at already-paid tiered-table value ahead of 2026-07 flat-13% policy change";

/** Pinat excluded — already has epfEmployerOverride 655. */
const FREEZE_EPF_EMPLOYER: Record<string, number> = {
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
  Din: 115,
  Ikmal: 601,
};

async function resolveActor() {
  const admin = await prisma.user.findFirst({
    where: { role: "admin", active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true },
  });
  if (!admin) throw new Error("No active admin");
  return admin;
}

async function main() {
  const admin = await resolveActor();
  (globalThis as { __BACKFILL_USER__?: AppUser }).__BACKFILL_USER__ = {
    id: admin.id,
    email: admin.email ?? "admin@system",
    name: admin.name ?? "June EPF freeze",
    role: "admin",
    language: "zh",
  };

  console.log(`=== Freeze June 2026 epfEmployerOverride (${YEAR_MONTH}) ===\n`);
  console.log(`Actor: ${admin.email ?? admin.id}`);
  console.log(`Drivers planned: ${Object.keys(FREEZE_EPF_EMPLOYER).length} (Pinat skipped)\n`);

  const results: Array<{
    name: string;
    status: string;
    detail: string;
  }> = [];

  for (const [name, expectedEmployer] of Object.entries(FREEZE_EPF_EMPLOYER)) {
    const driver = await prisma.driver.findFirst({
      where: { name },
      include: {
        payrollMonths: {
          where: { yearMonth: YEAR_MONTH },
          include: { trips: true, extras: true },
        },
      },
    });
    const month = driver?.payrollMonths[0];
    if (!driver || !month) {
      results.push({ name, status: "FAIL", detail: "no June payroll month" });
      continue;
    }

    const existingOverride = decimalToNumber(month.epfEmployerOverride);
    if (existingOverride != null) {
      results.push({
        name,
        status: "SKIP",
        detail: `already has epfEmployerOverride=${existingOverride}`,
      });
      continue;
    }

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
      trips: month.trips,
      extras: month.extras,
      overrides: month,
    });
    const tableEmployer = lookupEpfContributions(summary.grossSalary).employer;
    if (tableEmployer !== expectedEmployer) {
      results.push({
        name,
        status: "FAIL",
        detail: `live table employer ${tableEmployer} ≠ expected ${expectedEmployer} (gross=${summary.grossSalary}) — abort this driver`,
      });
      continue;
    }

    const result = await applyPayrollOverridePatch({
      payrollMonthId: month.id,
      actorUserId: admin.id,
      auditNote: AUDIT_NOTE,
      epfEmployee: decimalToNumber(month.epfEmployeeOverride),
      epfEmployer: expectedEmployer,
      socsoEmployee: decimalToNumber(month.socsoEmployeeOverride),
      socsoEmployer: decimalToNumber(month.socsoEmployerOverride),
      lindung24Jam: decimalToNumber(month.lindung24JamOverride),
      eisEmployee: decimalToNumber(month.eisEmployeeOverride),
      eisEmployer: decimalToNumber(month.eisEmployerOverride),
      pcb: decimalToNumber(month.pcbOverride),
    });

    const after = await prisma.driverPayrollMonth.findUnique({
      where: { id: month.id },
      select: { epfEmployerOverride: true },
    });
    const written = decimalToNumber(after?.epfEmployerOverride);
    if (written !== expectedEmployer) {
      results.push({
        name,
        status: "FAIL",
        detail: `write verify failed: got ${written}, expected ${expectedEmployer}`,
      });
      continue;
    }

    results.push({
      name,
      status: result.changed ? "OK" : "NOOP",
      detail: `null → ${written} | changed=${result.changed} | fields=${result.changes.map((c) => c.field).join(",") || "none"}`,
    });
  }

  console.log("Results:");
  for (const r of results) {
    console.log(`  ${r.status.padEnd(4)} ${r.name.padEnd(12)} ${r.detail}`);
  }

  const fails = results.filter((r) => r.status === "FAIL");
  const oks = results.filter((r) => r.status === "OK" || r.status === "NOOP");
  const skips = results.filter((r) => r.status === "SKIP");
  console.log(
    `\nSummary: ${oks.length} written/noop, ${skips.length} skipped, ${fails.length} failed`
  );
  if (fails.length > 0) {
    throw new Error(`Freeze incomplete: ${fails.map((f) => f.name).join(", ")}`);
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
