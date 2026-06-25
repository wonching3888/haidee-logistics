import type { Prisma } from "@prisma/client";
import type { DriverVoucher } from "@prisma/client";

/** Fields audited on voucher amount updates (DB column names). */
export const VOUCHER_AUDITED_FIELD_KEYS = [
  "chop_border_actual",
  "parking_actual",
  "kpb_actual",
  "fish_check_actual",
  "upah_turun_actual",
  "upah_naik_tong_actual",
  "minyak_moto_enabled",
  "minyak_moto_actual",
  "other_actual",
  "duit_jalan",
] as const;

export type VoucherAuditedFieldKey = (typeof VOUCHER_AUDITED_FIELD_KEYS)[number];

export const VOUCHER_AUDITED_FIELD_LABELS: Record<VoucherAuditedFieldKey, string> = {
  chop_border_actual: "Chop/Border 实际",
  parking_actual: "Parking 实际",
  kpb_actual: "KPB 实际",
  fish_check_actual: "Fish Check 实际",
  upah_turun_actual: "Upah Turun 实际",
  upah_naik_tong_actual: "Upah Naik Tong 实际",
  minyak_moto_enabled: "Minyak Moto 启用",
  minyak_moto_actual: "Minyak Moto 实际",
  other_actual: "Lain-lain 实际",
  duit_jalan: "Duit Jalan",
};

const PRISMA_KEY_BY_AUDIT_KEY: Record<
  VoucherAuditedFieldKey,
  keyof Pick<
    DriverVoucher,
    | "chopBorderActual"
    | "parkingActual"
    | "kpbActual"
    | "fishCheckActual"
    | "upahTurunActual"
    | "upahNaikTongActual"
    | "minyakMotoEnabled"
    | "minyakMotoActual"
    | "otherActual"
    | "duitJalan"
  >
> = {
  chop_border_actual: "chopBorderActual",
  parking_actual: "parkingActual",
  kpb_actual: "kpbActual",
  fish_check_actual: "fishCheckActual",
  upah_turun_actual: "upahTurunActual",
  upah_naik_tong_actual: "upahNaikTongActual",
  minyak_moto_enabled: "minyakMotoEnabled",
  minyak_moto_actual: "minyakMotoActual",
  other_actual: "otherActual",
  duit_jalan: "duitJalan",
};

export interface VoucherFieldChange {
  field: VoucherAuditedFieldKey;
  oldValue: string | null;
  newValue: string | null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatVoucherAuditValue(
  field: VoucherAuditedFieldKey,
  value: unknown
): string | null {
  if (value == null) return null;
  if (field === "minyak_moto_enabled") {
    return value === true || value === "true" ? "true" : "false";
  }
  if (typeof value === "number") {
    return roundMoney(value).toFixed(2);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return roundMoney(parsed).toFixed(2);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

function readAuditedValue(
  voucher: Pick<DriverVoucher, (typeof PRISMA_KEY_BY_AUDIT_KEY)[VoucherAuditedFieldKey]>,
  field: VoucherAuditedFieldKey
): unknown {
  const key = PRISMA_KEY_BY_AUDIT_KEY[field];
  return voucher[key];
}

export function diffVoucherFieldChanges(
  existing: DriverVoucher,
  input: Partial<{
    chopBorderActual: number | null;
    parkingActual: number | null;
    kpbActual: number | null;
    fishCheckActual: number | null;
    upahTurunActual: number | null;
    upahNaikTongActual: number | null;
    minyakMotoEnabled: boolean;
    minyakMotoActual: number | null;
    otherActual: number | null;
    duitJalan: number | null;
  }>
): VoucherFieldChange[] {
  const changes: VoucherFieldChange[] = [];

  for (const field of VOUCHER_AUDITED_FIELD_KEYS) {
    const prismaKey = PRISMA_KEY_BY_AUDIT_KEY[field];
    if (!(prismaKey in input)) continue;

    const oldFormatted = formatVoucherAuditValue(
      field,
      readAuditedValue(existing, field)
    );
    const newFormatted = formatVoucherAuditValue(field, input[prismaKey]);
    if (oldFormatted === newFormatted) continue;

    changes.push({
      field,
      oldValue: oldFormatted,
      newValue: newFormatted,
    });
  }

  return changes;
}

export async function appendVoucherFieldChangeLogs(
  tx: Prisma.TransactionClient,
  input: {
    voucherId: string;
    changes: VoucherFieldChange[];
    changedBy: string;
  }
) {
  if (input.changes.length === 0) return;

  await tx.driverVoucherChangeLog.createMany({
    data: input.changes.map((change) => ({
      voucherId: input.voucherId,
      eventType: "field_change",
      field: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      changedBy: input.changedBy,
    })),
  });
}

export function voucherAuditFieldLabel(field: string): string {
  if ((VOUCHER_AUDITED_FIELD_KEYS as readonly string[]).includes(field)) {
    return VOUCHER_AUDITED_FIELD_LABELS[field as VoucherAuditedFieldKey];
  }
  if (field === "status") return "状态";
  return field;
}
