import type { DriverPayrollMonth } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  appendPayrollChangeLogs,
  diffPayrollOverrideChanges,
  type PayrollOverrideField,
} from "@/lib/payroll-audit";

/** Prisma `data` keys for manual statutory overrides on driver_payroll_months. */
export const PAYROLL_OVERRIDE_PRISMA_DATA_KEYS = [
  "epfEmployeeOverride",
  "epfEmployerOverride",
  "socsoEmployeeOverride",
  "socsoEmployerOverride",
  "lindung24JamOverride",
  "eisEmployeeOverride",
  "eisEmployerOverride",
  "pcbOverride",
] as const satisfies readonly PayrollOverrideField[];

export type PayrollOverridePatchInput = {
  payrollMonthId: string;
  actorUserId: string;
  /** Merged into each override_update log metadata (e.g. incident remediation). */
  auditNote?: string;
  epfEmployee?: number | null;
  epfEmployer?: number | null;
  socsoEmployee?: number | null;
  socsoEmployer?: number | null;
  lindung24Jam?: number | null;
  eisEmployee?: number | null;
  eisEmployer?: number | null;
  pcb?: number | null;
};

export function payrollOverrideDataContainsBlockedFields(
  data: Record<string, unknown> | undefined | null
): boolean {
  if (!data) return false;
  return PAYROLL_OVERRIDE_PRISMA_DATA_KEYS.some((key) => key in data);
}

/**
 * Throws when scripts attempt a bare Prisma write of override columns.
 * Production writes must use applyPayrollOverridePatch (audited).
 */
export function assertBarePayrollOverrideWriteBlocked(
  context: string,
  data: Record<string, unknown> | undefined | null
) {
  if (!payrollOverrideDataContainsBlockedFields(data)) return;
  const keys = PAYROLL_OVERRIDE_PRISMA_DATA_KEYS.filter((key) => data && key in data);
  throw new Error(
    `[payroll-override-guard] Blocked bare driverPayrollMonth override write in ${context}. ` +
      `Fields: ${keys.join(", ")}. Use applyPayrollOverridePatch from lib/payroll-override-write.ts instead.`
  );
}

function overridePatchToPrismaData(input: PayrollOverridePatchInput) {
  return {
    epfEmployeeOverride: input.epfEmployee ?? null,
    epfEmployerOverride: input.epfEmployer ?? null,
    socsoEmployeeOverride: input.socsoEmployee ?? null,
    socsoEmployerOverride: input.socsoEmployer ?? null,
    eisEmployeeOverride: input.eisEmployee ?? null,
    eisEmployerOverride: input.eisEmployer ?? null,
    pcbOverride: input.pcb ?? null,
    lindung24JamOverride: input.lindung24Jam ?? null,
  };
}

/**
 * Single audited path for payroll month override columns (UI + approved scripts).
 */
export async function applyPayrollOverridePatch(input: PayrollOverridePatchInput) {
  const existing = await prisma.driverPayrollMonth.findUnique({
    where: { id: input.payrollMonthId },
    include: { driver: { select: { name: true } } },
  });
  if (!existing) {
    throw new Error("薪资月份不存在 Payroll month not found");
  }

  const changes = diffPayrollOverrideChanges(existing, input);
  if (changes.length === 0) {
    return { changed: false as const, changes };
  }

  const metadata: Prisma.InputJsonObject = {
    driverName: existing.driver.name,
    ...(input.auditNote ? { auditNote: input.auditNote } : {}),
  };

  const data = overridePatchToPrismaData(input);

  await prisma.$transaction(async (tx) => {
    await tx.driverPayrollMonth.update({
      where: { id: input.payrollMonthId },
      data,
    });
    await appendPayrollChangeLogs(tx, {
      actorUserId: input.actorUserId,
      logs: changes.map((change) => ({
        payrollMonthId: existing.id,
        driverId: existing.driverId,
        yearMonth: existing.yearMonth,
        eventType: "override_update" as const,
        field: change.field,
        fromValue: change.fromValue,
        toValue: change.toValue,
        metadata,
      })),
    });
  });

  return { changed: true as const, changes };
}

export function formatOverridePatchPlan(input: {
  driverName: string;
  yearMonth: string;
  existing: Pick<DriverPayrollMonth, PayrollOverrideField>;
  patch: Omit<PayrollOverridePatchInput, "payrollMonthId" | "actorUserId">;
}) {
  const changes = diffPayrollOverrideChanges(input.existing, input.patch);
  return {
    driverName: input.driverName,
    yearMonth: input.yearMonth,
    changes: changes.map((c) => ({
      field: c.field,
      fromValue: c.fromValue,
      toValue: c.toValue,
    })),
  };
}
