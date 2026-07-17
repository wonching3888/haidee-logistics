import type { StaffPayrollMonth } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  diffPayrollOverrideChanges,
  type PayrollOverrideField,
} from "@/lib/payroll-audit";

const OVERRIDE_KEYS = [
  "epfEmployeeOverride",
  "epfEmployerOverride",
  "socsoEmployeeOverride",
  "socsoEmployerOverride",
  "lindung24JamOverride",
  "eisEmployeeOverride",
  "eisEmployerOverride",
  "pcbOverride",
] as const satisfies readonly PayrollOverrideField[];

export type StaffPayrollOverridePatchInput = {
  payrollMonthId: string;
  actorUserId: string;
  epfEmployee?: number | null;
  epfEmployer?: number | null;
  socsoEmployee?: number | null;
  socsoEmployer?: number | null;
  lindung24Jam?: number | null;
  eisEmployee?: number | null;
  eisEmployer?: number | null;
  pcb?: number | null;
};

function overridePatchToPrismaData(input: StaffPayrollOverridePatchInput) {
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

export async function applyStaffPayrollOverridePatch(
  input: StaffPayrollOverridePatchInput
) {
  const existing = await prisma.staffPayrollMonth.findUnique({
    where: { id: input.payrollMonthId },
    include: { staff: { select: { name: true } } },
  });
  if (!existing) {
    throw new Error("薪资月份不存在 Payroll month not found");
  }

  const changes = diffPayrollOverrideChanges(existing, input);
  if (changes.length === 0) {
    return { changed: false as const, changes };
  }

  const metadata: Prisma.InputJsonObject = {
    staffName: existing.staff.name,
  };
  const data = overridePatchToPrismaData(input);

  await prisma.$transaction(async (tx) => {
    await tx.staffPayrollMonth.update({
      where: { id: input.payrollMonthId },
      data,
    });
    await tx.staffPayrollChangeLog.createMany({
      data: changes.map((change) => ({
        payrollMonthId: existing.id,
        staffId: existing.staffId,
        yearMonth: existing.yearMonth,
        eventType: "override_update",
        field: change.field,
        fromValue: change.fromValue,
        toValue: change.toValue,
        metadata,
        changedBy: input.actorUserId,
      })),
    });
  });

  return { changed: true as const, changes };
}

export function staffMonthOverridePick(
  month: Pick<StaffPayrollMonth, (typeof OVERRIDE_KEYS)[number]>
) {
  return {
    epfEmployeeOverride: month.epfEmployeeOverride,
    epfEmployerOverride: month.epfEmployerOverride,
    socsoEmployeeOverride: month.socsoEmployeeOverride,
    socsoEmployerOverride: month.socsoEmployerOverride,
    lindung24JamOverride: month.lindung24JamOverride,
    eisEmployeeOverride: month.eisEmployeeOverride,
    eisEmployerOverride: month.eisEmployerOverride,
    pcbOverride: month.pcbOverride,
  };
}
