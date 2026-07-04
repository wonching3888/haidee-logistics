import {
  SADAO_HANDLING_LARGE_CRATE_HOLIDAY_RATE_THB,
  SADAO_HANDLING_LARGE_CRATE_WEEKDAY_RATE_THB,
  SADAO_HANDLING_SMALL_CRATE_HOLIDAY_RATE_THB,
  SADAO_HANDLING_SMALL_CRATE_WEEKDAY_RATE_THB,
  yearMonthKey,
  type SadaoHandlingRates,
} from "@/lib/constants/thai-cost";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_THAI_COST_LARGE_TONG_TYPE_CODES,
  parseLargeTongTypeCodes,
  serializeLargeTongTypeCodes,
} from "@/lib/thai-cost/crate-classify";

export const LARGE_TONG_TYPE_CODES_KEY = "large_tong_type_codes";

export const THAI_COST_RATE_KEYS = [
  "handling_small_weekday",
  "handling_small_holiday",
  "handling_large_weekday",
  "handling_large_holiday",
  "driver_trip_songkhla",
  "driver_trip_pattani",
  "pattani_contractor_crate",
  "pattani_contractor_box",
  "pattani_sakri_crate",
] as const;

export type ThaiCostRateKey = (typeof THAI_COST_RATE_KEYS)[number];

export const DEFAULT_THAI_COST_RATES: Record<ThaiCostRateKey, number> = {
  handling_small_weekday: SADAO_HANDLING_SMALL_CRATE_WEEKDAY_RATE_THB,
  handling_small_holiday: SADAO_HANDLING_SMALL_CRATE_HOLIDAY_RATE_THB,
  handling_large_weekday: SADAO_HANDLING_LARGE_CRATE_WEEKDAY_RATE_THB,
  handling_large_holiday: SADAO_HANDLING_LARGE_CRATE_HOLIDAY_RATE_THB,
  driver_trip_songkhla: 700,
  driver_trip_pattani: 1200,
  pattani_contractor_crate: 20,
  pattani_contractor_box: 5,
  pattani_sakri_crate: 2.2,
};

export interface ThaiCostRates {
  handlingSmallWeekday: number;
  handlingSmallHoliday: number;
  handlingLargeWeekday: number;
  handlingLargeHoliday: number;
  driverTripSongkhla: number;
  driverTripPattani: number;
  pattaniContractorCrate: number;
  pattaniContractorBox: number;
  pattaniSakriCrate: number;
  /** Thai-cost only; independent of MY unloading LARGE_CRATE_CODES. */
  largeTongTypeCodes: string[];
}

export interface ResolvedThaiCostRates extends ThaiCostRates {
  source: "monthly_snapshot" | "current_settings";
  yearMonth: string | null;
  locked: boolean;
}

export function ratesToHandlingPair(
  rates: Pick<
    ThaiCostRates,
    | "handlingSmallWeekday"
    | "handlingSmallHoliday"
    | "handlingLargeWeekday"
    | "handlingLargeHoliday"
  >,
  holidayRate: boolean
): SadaoHandlingRates {
  const small = holidayRate
    ? rates.handlingSmallHoliday
    : rates.handlingSmallWeekday;
  const large = holidayRate
    ? rates.handlingLargeHoliday
    : rates.handlingLargeWeekday;
  return { small, large, box: small };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function computePattaniDayCosts(
  crateQty: number,
  boxQty: number,
  rates: Pick<
    ThaiCostRates,
    "pattaniContractorCrate" | "pattaniContractorBox" | "pattaniSakriCrate"
  >
) {
  const contractorThb = roundMoney(
    crateQty * rates.pattaniContractorCrate +
      boxQty * rates.pattaniContractorBox
  );
  const sakriCommissionThb = roundMoney(crateQty * rates.pattaniSakriCrate);
  return {
    contractorThb,
    sakriCommissionThb,
    dayTotalThb: roundMoney(contractorThb + sakriCommissionThb),
  };
}

function mapRates(r: ThaiCostRates): ThaiCostRates {
  return { ...r };
}

function ratesFromMap(
  byKey: Map<string, number>,
  largeTongTypeCodes: string[]
): ThaiCostRates {
  return mapRates({
    handlingSmallWeekday:
      byKey.get("handling_small_weekday") ??
      DEFAULT_THAI_COST_RATES.handling_small_weekday,
    handlingSmallHoliday:
      byKey.get("handling_small_holiday") ??
      DEFAULT_THAI_COST_RATES.handling_small_holiday,
    handlingLargeWeekday:
      byKey.get("handling_large_weekday") ??
      DEFAULT_THAI_COST_RATES.handling_large_weekday,
    handlingLargeHoliday:
      byKey.get("handling_large_holiday") ??
      DEFAULT_THAI_COST_RATES.handling_large_holiday,
    driverTripSongkhla:
      byKey.get("driver_trip_songkhla") ??
      DEFAULT_THAI_COST_RATES.driver_trip_songkhla,
    driverTripPattani:
      byKey.get("driver_trip_pattani") ??
      DEFAULT_THAI_COST_RATES.driver_trip_pattani,
    pattaniContractorCrate:
      byKey.get("pattani_contractor_crate") ??
      DEFAULT_THAI_COST_RATES.pattani_contractor_crate,
    pattaniContractorBox:
      byKey.get("pattani_contractor_box") ??
      DEFAULT_THAI_COST_RATES.pattani_contractor_box,
    pattaniSakriCrate:
      byKey.get("pattani_sakri_crate") ??
      DEFAULT_THAI_COST_RATES.pattani_sakri_crate,
    largeTongTypeCodes,
  });
}

/** Ensure default keys exist (idempotent). */
export async function ensureThaiCostRateSettings(): Promise<void> {
  for (const key of THAI_COST_RATE_KEYS) {
    const existing = await prisma.thaiCostRateSetting.findUnique({
      where: { key },
    });
    if (!existing) {
      await prisma.thaiCostRateSetting.create({
        data: { key, value: DEFAULT_THAI_COST_RATES[key] },
      });
    }
  }
  const largeCodes = await prisma.thaiCostRateSetting.findUnique({
    where: { key: LARGE_TONG_TYPE_CODES_KEY },
  });
  if (!largeCodes) {
    await prisma.thaiCostRateSetting.create({
      data: {
        key: LARGE_TONG_TYPE_CODES_KEY,
        value: 0,
        valueText: serializeLargeTongTypeCodes([
          ...DEFAULT_THAI_COST_LARGE_TONG_TYPE_CODES,
        ]),
      },
    });
  } else if (!largeCodes.valueText) {
    await prisma.thaiCostRateSetting.update({
      where: { key: LARGE_TONG_TYPE_CODES_KEY },
      data: {
        valueText: serializeLargeTongTypeCodes([
          ...DEFAULT_THAI_COST_LARGE_TONG_TYPE_CODES,
        ]),
      },
    });
  }
}

export async function loadCurrentThaiCostRates(): Promise<ThaiCostRates> {
  await ensureThaiCostRateSettings();
  const rows = await prisma.thaiCostRateSetting.findMany();
  const byKey = new Map(
    rows.map((r) => [r.key, decimalToNumber(r.value) ?? 0])
  );
  const largeRow = rows.find((r) => r.key === LARGE_TONG_TYPE_CODES_KEY);
  const largeTongTypeCodes = parseLargeTongTypeCodes(largeRow?.valueText);
  return ratesFromMap(byKey, largeTongTypeCodes);
}

export async function saveCurrentThaiCostRates(
  rates: ThaiCostRates,
  updatedBy: string
): Promise<ThaiCostRates> {
  const entries: Array<[ThaiCostRateKey, number]> = [
    ["handling_small_weekday", rates.handlingSmallWeekday],
    ["handling_small_holiday", rates.handlingSmallHoliday],
    ["handling_large_weekday", rates.handlingLargeWeekday],
    ["handling_large_holiday", rates.handlingLargeHoliday],
    ["driver_trip_songkhla", rates.driverTripSongkhla],
    ["driver_trip_pattani", rates.driverTripPattani],
    ["pattani_contractor_crate", rates.pattaniContractorCrate],
    ["pattani_contractor_box", rates.pattaniContractorBox],
    ["pattani_sakri_crate", rates.pattaniSakriCrate],
  ];
  for (const [key, value] of entries) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`无效费率 ${key}`);
    }
    await prisma.thaiCostRateSetting.upsert({
      where: { key },
      create: { key, value, updatedBy },
      update: { value, updatedBy },
    });
  }
  const codesJson = serializeLargeTongTypeCodes(rates.largeTongTypeCodes);
  await prisma.thaiCostRateSetting.upsert({
    where: { key: LARGE_TONG_TYPE_CODES_KEY },
    create: {
      key: LARGE_TONG_TYPE_CODES_KEY,
      value: 0,
      valueText: codesJson,
      updatedBy,
    },
    update: { valueText: codesJson, updatedBy },
  });
  return loadCurrentThaiCostRates();
}

export async function resolveThaiCostRatesForMonth(
  year: number,
  month: number
): Promise<ResolvedThaiCostRates> {
  const ym = yearMonthKey(year, month);
  const snap = await prisma.thaiCostMonthlyRateSnapshot.findUnique({
    where: { yearMonth: ym },
  });
  if (snap) {
    return {
      ...mapRates({
        handlingSmallWeekday: decimalToNumber(snap.handlingSmallWeekday) ?? 0,
        handlingSmallHoliday: decimalToNumber(snap.handlingSmallHoliday) ?? 0,
        handlingLargeWeekday: decimalToNumber(snap.handlingLargeWeekday) ?? 0,
        handlingLargeHoliday: decimalToNumber(snap.handlingLargeHoliday) ?? 0,
        driverTripSongkhla: decimalToNumber(snap.driverTripSongkhla) ?? 0,
        driverTripPattani: decimalToNumber(snap.driverTripPattani) ?? 0,
        pattaniContractorCrate:
          decimalToNumber(snap.pattaniContractorCrate) ??
          DEFAULT_THAI_COST_RATES.pattani_contractor_crate,
        pattaniContractorBox:
          decimalToNumber(snap.pattaniContractorBox) ??
          DEFAULT_THAI_COST_RATES.pattani_contractor_box,
        pattaniSakriCrate:
          decimalToNumber(snap.pattaniSakriCrate) ??
          DEFAULT_THAI_COST_RATES.pattani_sakri_crate,
        largeTongTypeCodes: parseLargeTongTypeCodes(snap.largeTongTypeCodes),
      }),
      source: "monthly_snapshot",
      yearMonth: ym,
      locked: true,
    };
  }
  const current = await loadCurrentThaiCostRates();
  return {
    ...current,
    source: "current_settings",
    yearMonth: ym,
    locked: false,
  };
}

export async function lockThaiCostRatesForMonth(input: {
  year: number;
  month: number;
  createdBy: string;
  force?: boolean;
}): Promise<ResolvedThaiCostRates> {
  const ym = yearMonthKey(input.year, input.month);
  const existing = await prisma.thaiCostMonthlyRateSnapshot.findUnique({
    where: { yearMonth: ym },
  });
  if (existing && !input.force) {
    return resolveThaiCostRatesForMonth(input.year, input.month);
  }

  const rates = await loadCurrentThaiCostRates();
  const data = {
    handlingSmallWeekday: rates.handlingSmallWeekday,
    handlingSmallHoliday: rates.handlingSmallHoliday,
    handlingLargeWeekday: rates.handlingLargeWeekday,
    handlingLargeHoliday: rates.handlingLargeHoliday,
    driverTripSongkhla: rates.driverTripSongkhla,
    driverTripPattani: rates.driverTripPattani,
    pattaniContractorCrate: rates.pattaniContractorCrate,
    pattaniContractorBox: rates.pattaniContractorBox,
    pattaniSakriCrate: rates.pattaniSakriCrate,
    largeTongTypeCodes: serializeLargeTongTypeCodes(rates.largeTongTypeCodes),
    snapshotAt: new Date(),
    createdBy: input.createdBy,
  };

  if (existing) {
    await prisma.thaiCostMonthlyRateSnapshot.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.thaiCostMonthlyRateSnapshot.create({
      data: { yearMonth: ym, ...data },
    });
  }
  return resolveThaiCostRatesForMonth(input.year, input.month);
}
