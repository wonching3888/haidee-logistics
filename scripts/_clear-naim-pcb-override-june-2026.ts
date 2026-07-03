/**
 * Clear accidental Naim June pcbOverride (rev3 script pollution) via audited path.
 * Run: node --env-file=.env.local --import tsx scripts/_clear-naim-pcb-override-june-2026.ts
 */
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/freight-rates";
import {
  applyPayrollOverridePatch,
  formatOverridePatchPlan,
} from "@/lib/payroll-override-write";
import type { AppUser } from "@/types";

const YEAR_MONTH = "2026-06";
const AUDIT_NOTE =
  "清除 rev3 生成脚本误写的 pcbOverride=0.49（JV快照值，非用户手动录入）";

async function resolveActorUserId() {
  const admin = await prisma.user.findFirst({
    where: { role: "admin", active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });
  if (!admin) throw new Error("No active admin user for audit actorUserId");
  return admin;
}

async function main() {
  const naim = await prisma.driver.findFirst({
    where: { name: "Naim" },
    include: { payrollMonths: { where: { yearMonth: YEAR_MONTH } } },
  });
  const month = naim?.payrollMonths[0];
  if (!month) throw new Error("Naim June payroll month not found");

  const before = decimalToNumber(month.pcbOverride);
  console.log("\n=== Before clear ===");
  console.log({
    driver: "Naim",
    yearMonth: YEAR_MONTH,
    payrollMonthId: month.id,
    pcbOverride: before,
  });

  if (before == null) {
    console.log("pcbOverride already null — nothing to clear.");
    return;
  }

  const admin = await resolveActorUserId();
  (globalThis as { __BACKFILL_USER__?: AppUser }).__BACKFILL_USER__ = {
    id: admin.id,
    email: admin.email ?? "admin@system",
    name: "Payroll override remediation",
    role: "admin",
    language: "zh",
  };

  const plan = formatOverridePatchPlan({
    driverName: "Naim",
    yearMonth: YEAR_MONTH,
    existing: month,
    patch: {
      epfEmployee: decimalToNumber(month.epfEmployeeOverride),
      epfEmployer: decimalToNumber(month.epfEmployerOverride),
      socsoEmployee: decimalToNumber(month.socsoEmployeeOverride),
      socsoEmployer: decimalToNumber(month.socsoEmployerOverride),
      lindung24Jam: decimalToNumber(month.lindung24JamOverride),
      eisEmployee: decimalToNumber(month.eisEmployeeOverride),
      eisEmployer: decimalToNumber(month.eisEmployerOverride),
      pcb: null,
      auditNote: AUDIT_NOTE,
    },
  });
  console.log("\n=== Override patch plan ===");
  console.log(JSON.stringify(plan, null, 2));

  const result = await applyPayrollOverridePatch({
    payrollMonthId: month.id,
    actorUserId: admin.id,
    auditNote: AUDIT_NOTE,
    epfEmployee: decimalToNumber(month.epfEmployeeOverride),
    epfEmployer: decimalToNumber(month.epfEmployerOverride),
    socsoEmployee: decimalToNumber(month.socsoEmployeeOverride),
    socsoEmployer: decimalToNumber(month.socsoEmployerOverride),
    lindung24Jam: decimalToNumber(month.lindung24JamOverride),
    eisEmployee: decimalToNumber(month.eisEmployeeOverride),
    eisEmployer: decimalToNumber(month.eisEmployerOverride),
    pcb: null,
  });

  const after = await prisma.driverPayrollMonth.findUnique({
    where: { id: month.id },
    select: { pcbOverride: true, updatedAt: true },
  });

  const logs = await prisma.payrollChangeLog.findMany({
    where: {
      payrollMonthId: month.id,
      eventType: "override_update",
      field: "pcbOverride",
    },
    orderBy: { changedAt: "desc" },
    take: 3,
  });

  console.log("\n=== After clear ===");
  console.log({
    changed: result.changed,
    pcbOverride: decimalToNumber(after?.pcbOverride ?? null),
    updatedAt: after?.updatedAt.toISOString(),
  });
  console.log("\n=== Latest pcbOverride audit logs ===");
  for (const log of logs) {
    console.log({
      changedAt: log.changedAt.toISOString(),
      fromValue: log.fromValue,
      toValue: log.toValue,
      changedBy: log.changedBy,
      metadata: log.metadata,
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
