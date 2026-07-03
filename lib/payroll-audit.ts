import type { Prisma } from "@prisma/client";
import type { DriverPayrollMonth, DriverPayrollTrip } from "@prisma/client";

export type PayrollAuditEventType =
  | "trip_update"
  | "extra_create"
  | "extra_delete"
  | "override_update";

export const PAYROLL_TRIP_AUDITED_FIELDS = [
  "tripAllowance",
  "extraAllowance",
  "notes",
] as const;

export type PayrollTripAuditedField =
  (typeof PAYROLL_TRIP_AUDITED_FIELDS)[number];

export const PAYROLL_OVERRIDE_FIELDS = [
  "epfEmployeeOverride",
  "epfEmployerOverride",
  "socsoEmployeeOverride",
  "socsoEmployerOverride",
  "lindung24JamOverride",
  "eisEmployeeOverride",
  "eisEmployerOverride",
  "pcbOverride",
] as const;

export type PayrollOverrideField = (typeof PAYROLL_OVERRIDE_FIELDS)[number];

export const PAYROLL_TRIP_FIELD_LABELS: Record<PayrollTripAuditedField, string> =
  {
    tripAllowance: "趟费 Trip allowance",
    extraAllowance: "额外津贴 Extra allowance",
    notes: "备注 Notes",
  };

export const PAYROLL_OVERRIDE_FIELD_LABELS: Record<PayrollOverrideField, string> =
  {
    epfEmployeeOverride: "EPF 员工",
    epfEmployerOverride: "EPF 雇主",
    socsoEmployeeOverride: "SOCSO 员工",
    socsoEmployerOverride: "SOCSO 雇主",
    lindung24JamOverride: "Lindung 24 jam",
    eisEmployeeOverride: "EIS 员工",
    eisEmployerOverride: "EIS 雇主",
    pcbOverride: "PCB",
  };

export interface PayrollFieldChange {
  field: PayrollTripAuditedField | PayrollOverrideField;
  fromValue: string | null;
  toValue: string | null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function decimalToAuditString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const num = (value as { toNumber(): number }).toNumber();
    if (!Number.isFinite(num)) return null;
    return roundMoney(num).toFixed(2);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return roundMoney(value).toFixed(2);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return roundMoney(parsed).toFixed(2);
  }
  return String(value);
}

function notesToAuditString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

export function diffPayrollTripFieldChanges(
  existing: Pick<
    DriverPayrollTrip,
    "tripAllowance" | "extraAllowance" | "notes"
  >,
  input: {
    tripAllowance: number;
    extraAllowance: number;
    notes?: string | null;
  }
): PayrollFieldChange[] {
  const changes: PayrollFieldChange[] = [];

  const pairs: Array<
    [PayrollTripAuditedField, string | null, string | null]
  > = [
    [
      "tripAllowance",
      decimalToAuditString(existing.tripAllowance),
      decimalToAuditString(input.tripAllowance),
    ],
    [
      "extraAllowance",
      decimalToAuditString(existing.extraAllowance),
      decimalToAuditString(input.extraAllowance),
    ],
    [
      "notes",
      notesToAuditString(existing.notes),
      notesToAuditString(input.notes ?? null),
    ],
  ];

  for (const [field, fromValue, toValue] of pairs) {
    if (fromValue === toValue) continue;
    changes.push({ field, fromValue, toValue });
  }

  return changes;
}

export function diffPayrollOverrideChanges(
  existing: Pick<DriverPayrollMonth, PayrollOverrideField>,
  input: {
    epfEmployee?: number | null;
    epfEmployer?: number | null;
    socsoEmployee?: number | null;
    socsoEmployer?: number | null;
    lindung24Jam?: number | null;
    eisEmployee?: number | null;
    eisEmployer?: number | null;
    pcb?: number | null;
  }
): PayrollFieldChange[] {
  const inputByField: Record<
    PayrollOverrideField,
    number | null | undefined
  > = {
    epfEmployeeOverride: input.epfEmployee,
    epfEmployerOverride: input.epfEmployer,
    socsoEmployeeOverride: input.socsoEmployee,
    socsoEmployerOverride: input.socsoEmployer,
    lindung24JamOverride: input.lindung24Jam,
    eisEmployeeOverride: input.eisEmployee,
    eisEmployerOverride: input.eisEmployer,
    pcbOverride: input.pcb,
  };

  const changes: PayrollFieldChange[] = [];

  for (const field of PAYROLL_OVERRIDE_FIELDS) {
    if (!(field in inputByField)) continue;
    const fromValue = decimalToAuditString(existing[field]);
    const toValue = decimalToAuditString(inputByField[field] ?? null);
    if (fromValue === toValue) continue;
    changes.push({ field, fromValue, toValue });
  }

  return changes;
}

export interface PayrollChangeLogInput {
  payrollMonthId?: string | null;
  payrollTripId?: string | null;
  payrollExtraId?: string | null;
  driverId: string;
  yearMonth: string;
  eventType: PayrollAuditEventType;
  field?: string | null;
  fromValue?: string | null;
  toValue?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}

export async function appendPayrollChangeLogs(
  tx: Prisma.TransactionClient,
  input: {
    actorUserId: string;
    logs: PayrollChangeLogInput[];
  }
) {
  if (input.logs.length === 0) return;

  await tx.payrollChangeLog.createMany({
    data: input.logs.map((log) => ({
      payrollMonthId: log.payrollMonthId ?? null,
      payrollTripId: log.payrollTripId ?? null,
      payrollExtraId: log.payrollExtraId ?? null,
      driverId: log.driverId,
      yearMonth: log.yearMonth,
      eventType: log.eventType,
      field: log.field ?? null,
      fromValue: log.fromValue ?? null,
      toValue: log.toValue ?? null,
      metadata: log.metadata ?? undefined,
      changedBy: input.actorUserId,
    })),
  });
}

export function payrollAuditFieldLabel(field: string): string {
  if ((PAYROLL_TRIP_AUDITED_FIELDS as readonly string[]).includes(field)) {
    return PAYROLL_TRIP_FIELD_LABELS[field as PayrollTripAuditedField];
  }
  if ((PAYROLL_OVERRIDE_FIELDS as readonly string[]).includes(field)) {
    return PAYROLL_OVERRIDE_FIELD_LABELS[field as PayrollOverrideField];
  }
  return field;
}

export function payrollAuditEventLabel(eventType: string): string {
  switch (eventType) {
    case "trip_update":
      return "趟次工资修改";
    case "extra_create":
      return "借支/额外新增";
    case "extra_delete":
      return "借支/额外删除";
    case "override_update":
      return "法定扣款覆盖";
    default:
      return eventType;
  }
}
