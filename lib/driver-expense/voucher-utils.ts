export interface VoucherMarketActualData {
  feeType: "parking" | "kpb" | "unload";
  displayMarket: string;
  amount: number | null;
}

export interface DriverVoucherData {
  id?: string;
  voucherNo: string;
  tripId: string;
  tripSource?: "dispatch" | "charter";
  tripDate: string;
  lorry: string;
  driverName: string;
  route: string;
  chopBorderAmt: number | null;
  chopBorderActual: number | null;
  parkingAmt: number | null;
  parkingActual: number | null;
  kpbAmt: number | null;
  kpbActual: number | null;
  fishCheckAmt: number | null;
  fishCheckActual: number | null;
  upahTurunAmt: number | null;
  upahTurunActual: number | null;
  upahNaikTongAmt: number | null;
  upahNaikTongActual: number | null;
  minyakMotoEnabled: boolean;
  minyakMotoAmt: number;
  minyakMotoActual: number | null;
  otherActual: number | null;
  duitJalan: number | null;
  belanja: number | null;
  baki: number | null;
  status?: string;
  clerkNote?: string | null;
  reviewNote?: string | null;
  marketActuals?: VoucherMarketActualData[];
}

export interface VoucherPrintMarketRow {
  market: string;
  suggested: number;
  actual?: number | null;
}

export interface VoucherPrintBreakdown {
  driverDisplayName?: string;
  parking: VoucherPrintMarketRow[];
  kpb: VoucherPrintMarketRow[];
  upahTurun: VoucherPrintMarketRow[];
  upahNaikTongLabel: string;
  upahNaikTongSuggested: number;
}

export const VOUCHER_LABELS = {
  duitJalan: "Duit Jalan",
  perkara: "项目 Item",
  cadangan: "系统建议 Suggested",
  sebenar: "实际 Actual",
  cadanganRm: "系统建议 Suggested (RM)",
  sebenarRm: "实际 Actual (RM)",
  minyakMoto: "Minyak Moto",
  lainLain: "Lain-lain / Other",
  subtotal: "小计 Subtotal",
  belanja: "Belanja（支出）",
  baki: "Baki（余额）",
  simpan: "保存 Save",
  cetak: "打印 Print",
  batal: "取消 Cancel",
  kembali: "返回 / Back",
  nama: "Nama",
  noLorry: "No Lorry",
  tarikh: "Tarikh",
  trip: "Trip",
  voucherNo: "Voucher No",
  newVoucher: "新增报销单 / New Voucher",
  editVoucher: "编辑报销单 / Edit Voucher",
  selectTrip: "选择趟次 / Select Trip",
} as const;

export const VOUCHER_LINE_ITEMS = [
  {
    key: "chopBorder",
    label: "Chop/Border",
    amtKey: "chopBorderAmt",
    actualKey: "chopBorderActual",
  },
  {
    key: "parking",
    label: "Parking",
    amtKey: "parkingAmt",
    actualKey: "parkingActual",
  },
  {
    key: "kpb",
    label: "KPB",
    amtKey: "kpbAmt",
    actualKey: "kpbActual",
  },
  {
    key: "fishCheck",
    label: "Fish Check",
    amtKey: "fishCheckAmt",
    actualKey: "fishCheckActual",
  },
  {
    key: "upahTurun",
    label: "Upah Turun",
    amtKey: "upahTurunAmt",
    actualKey: "upahTurunActual",
  },
  {
    key: "upahNaikTong",
    label: "Upah Naik Tong",
    amtKey: "upahNaikTongAmt",
    actualKey: "upahNaikTongActual",
  },
] as const;

/** Charter voucher: 6 reimbursement lines (excludes Parking/KPB/Fish Check). */
export const CHARTER_VOUCHER_LINE_KEYS = [
  "chopBorder",
  "upahTurun",
  "upahNaikTong",
] as const;

/** Labels used only in print output (@media print). */
export const VOUCHER_PRINT_LABELS = {
  perkara: "Perkara / Item",
  cadangan: "Cadangan / Suggested",
  sebenar: "Sebenar / Actual",
  cadanganRm: "Cadangan / Suggested (RM)",
  sebenarRm: "Sebenar / Actual (RM)",
  minyakMoto: "Minyak Moto / Petrol (Moto)",
  lainLain: "Lain-lain / Other",
  subtotal: "Jumlah Kecil / Subtotal",
  duitJalan: "Duit Jalan",
  belanja: "Belanja / Expenses",
  baki: "Baki / Balance",
  nama: "Nama",
  noLorry: "No Lorry",
  tarikh: "Tarikh",
  trip: "Trip",
  voucherNo: "Voucher No",
} as const;

export const VOUCHER_PRINT_LINE_ITEMS = [
  {
    key: "chopBorder",
    label: "Chop Border",
    amtKey: "chopBorderAmt" as const,
    actualKey: "chopBorderActual" as const,
  },
  {
    key: "parking",
    label: "Parking",
    amtKey: "parkingAmt" as const,
    actualKey: "parkingActual" as const,
  },
  {
    key: "kpb",
    label: "KPB",
    amtKey: "kpbAmt" as const,
    actualKey: "kpbActual" as const,
  },
  {
    key: "fishCheck",
    label: "Semak Ikan / Fish Check",
    amtKey: "fishCheckAmt" as const,
    actualKey: "fishCheckActual" as const,
  },
  {
    key: "upahTurun",
    label: "Upah Turun / Unloading",
    amtKey: "upahTurunAmt" as const,
    actualKey: "upahTurunActual" as const,
  },
  {
    key: "upahNaikTong",
    label: "Upah Naik Tong / Crate Loading",
    amtKey: "upahNaikTongAmt" as const,
    actualKey: "upahNaikTongActual" as const,
  },
] as const;

import { formatMoneyAmount } from "@/lib/number-format";

export function formatMyr(value: number) {
  return formatMoneyAmount(value);
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function sumCharterActualBelanja(v: {
  chopBorderActual: number | null;
  upahTurunActual: number | null;
  upahNaikTongActual: number | null;
  minyakMotoEnabled: boolean;
  minyakMotoActual: number | null;
  otherActual: number | null;
}) {
  let total = 0;
  for (const value of [
    v.chopBorderActual,
    v.upahTurunActual,
    v.upahNaikTongActual,
    v.otherActual,
  ]) {
    if (value != null) total += value;
  }
  if (v.minyakMotoEnabled && v.minyakMotoActual != null) {
    total += v.minyakMotoActual;
  }
  return roundMoney(total);
}

export type VoucherSettlementActualFields = {
  chopBorderActual: number | null;
  parkingActual: number | null;
  kpbActual: number | null;
  fishCheckActual: number | null;
  upahTurunActual: number | null;
  upahNaikTongActual: number | null;
  minyakMotoEnabled: boolean;
  minyakMotoActual: number | null;
  otherActual: number | null;
};

/** True when any settlement Actual field is present (belanja would be from these). */
export function hasVoucherSettlementActuals(
  v: VoucherSettlementActualFields,
  options?: { tripSource?: "dispatch" | "charter" }
): boolean {
  if (options?.tripSource === "charter") {
    return (
      v.chopBorderActual != null ||
      v.upahTurunActual != null ||
      v.upahNaikTongActual != null ||
      v.otherActual != null ||
      (v.minyakMotoEnabled && v.minyakMotoActual != null)
    );
  }
  return (
    v.chopBorderActual != null ||
    v.parkingActual != null ||
    v.kpbActual != null ||
    v.fishCheckActual != null ||
    v.upahTurunActual != null ||
    v.upahNaikTongActual != null ||
    v.otherActual != null ||
    (v.minyakMotoEnabled && v.minyakMotoActual != null)
  );
}

/**
 * draft + Duit Jalan recorded + no Actuals → "已预支待结算".
 * Other draft rows (legacy estimate-only / empty shells) keep the generic draft label.
 */
export function isAdvancePendingSettlement(v: {
  status: string;
  duitJalan: number | null;
} & VoucherSettlementActualFields): boolean {
  if (v.status !== "draft") return false;
  if (v.duitJalan == null || !(v.duitJalan > 0)) return false;
  return !hasVoucherSettlementActuals(v);
}

export function sumActualBelanja(
  v: VoucherSettlementActualFields,
  options?: { tripSource?: "dispatch" | "charter" }
) {
  if (options?.tripSource === "charter") {
    return sumCharterActualBelanja(v);
  }
  let total = 0;
  for (const value of [
    v.chopBorderActual,
    v.parkingActual,
    v.kpbActual,
    v.fishCheckActual,
    v.upahTurunActual,
    v.upahNaikTongActual,
    v.otherActual,
  ]) {
    if (value != null) total += value;
  }
  if (v.minyakMotoEnabled && v.minyakMotoActual != null) {
    total += v.minyakMotoActual;
  }
  return roundMoney(total);
}

export function sumCharterSuggestedAmounts(v: {
  chopBorderAmt: number | null;
  upahTurunAmt: number | null;
  upahNaikTongAmt: number | null;
  minyakMotoEnabled: boolean;
  minyakMotoAmt: number;
}) {
  let total = 0;
  for (const value of [v.chopBorderAmt, v.upahTurunAmt, v.upahNaikTongAmt]) {
    if (value != null) total += value;
  }
  if (v.minyakMotoEnabled) total += v.minyakMotoAmt;
  return roundMoney(total);
}

export function sumSuggestedAmounts(v: {
  chopBorderAmt: number | null;
  parkingAmt: number | null;
  kpbAmt: number | null;
  fishCheckAmt: number | null;
  upahTurunAmt: number | null;
  upahNaikTongAmt: number | null;
  minyakMotoEnabled: boolean;
  minyakMotoAmt: number;
}) {
  let total = 0;
  for (const value of [
    v.chopBorderAmt,
    v.parkingAmt,
    v.kpbAmt,
    v.fishCheckAmt,
    v.upahTurunAmt,
    v.upahNaikTongAmt,
  ]) {
    if (value != null) total += value;
  }
  if (v.minyakMotoEnabled) {
    total += v.minyakMotoAmt;
  }
  return roundMoney(total);
}
