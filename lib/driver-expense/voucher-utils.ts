export interface DriverVoucherData {
  id?: string;
  voucherNo: string;
  tripId: string;
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
  duitJalan: number | null;
  belanja: number | null;
  baki: number | null;
}

export const VOUCHER_LINE_ITEMS = [
  { key: "chopBorder", label: "Chop/Border", amtKey: "chopBorderAmt", actualKey: "chopBorderActual" },
  { key: "parking", label: "Parking", amtKey: "parkingAmt", actualKey: "parkingActual" },
  { key: "kpb", label: "KPB", amtKey: "kpbAmt", actualKey: "kpbActual" },
  { key: "fishCheck", label: "Fish Check", amtKey: "fishCheckAmt", actualKey: "fishCheckActual" },
  { key: "upahTurun", label: "Upah Turun", amtKey: "upahTurunAmt", actualKey: "upahTurunActual" },
  { key: "upahNaikTong", label: "Upah Naik Tong", amtKey: "upahNaikTongAmt", actualKey: "upahNaikTongActual" },
] as const;

export function formatMyr(value: number) {
  return value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

export function sumActualBelanja(v: {
  chopBorderActual: number | null;
  parkingActual: number | null;
  kpbActual: number | null;
  fishCheckActual: number | null;
  upahTurunActual: number | null;
  upahNaikTongActual: number | null;
  minyakMotoEnabled: boolean;
  minyakMotoActual: number | null;
}) {
  let total = 0;
  for (const value of [
    v.chopBorderActual,
    v.parkingActual,
    v.kpbActual,
    v.fishCheckActual,
    v.upahTurunActual,
    v.upahNaikTongActual,
  ]) {
    if (value != null) total += value;
  }
  if (v.minyakMotoEnabled && v.minyakMotoActual != null) {
    total += v.minyakMotoActual;
  }
  return roundMoney(total);
}
