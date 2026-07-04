/** Thai cost stations (Phase 2). */
export const THAI_COST_STATIONS = ["SADAO", "SONGKHLA", "PATTANI"] as const;

export type ThaiCostStation = (typeof THAI_COST_STATIONS)[number];

export const THAI_COST_STATION_LABELS: Record<
  ThaiCostStation,
  { zh: string; en: string }
> = {
  SADAO: { zh: "沙道", en: "Sadao" },
  SONGKHLA: { zh: "宋卡", en: "Songkhla" },
  PATTANI: { zh: "北大年", en: "Pattani" },
};

export function isThaiCostStation(value: string): value is ThaiCostStation {
  return (THAI_COST_STATIONS as readonly string[]).includes(value);
}

/**
 * Sadao crate handling commission rates (THB per billable unit).
 * Weekday vs holiday (Sunday or public holiday). BOX always uses small-crate rates.
 */
export const SADAO_HANDLING_SMALL_CRATE_WEEKDAY_RATE_THB = 3;
export const SADAO_HANDLING_SMALL_CRATE_HOLIDAY_RATE_THB = 5;
export const SADAO_HANDLING_LARGE_CRATE_WEEKDAY_RATE_THB = 4;
export const SADAO_HANDLING_LARGE_CRATE_HOLIDAY_RATE_THB = 6;

/** @deprecated Use weekday/holiday small rates; kept for display helpers. */
export const SADAO_HANDLING_SMALL_CRATE_RATE_THB =
  SADAO_HANDLING_SMALL_CRATE_WEEKDAY_RATE_THB;
/** @deprecated Use weekday/holiday large rates. */
export const SADAO_HANDLING_LARGE_CRATE_RATE_THB =
  SADAO_HANDLING_LARGE_CRATE_WEEKDAY_RATE_THB;
/** BOX rate always equals small-crate rate (weekday or holiday). */
export const SADAO_HANDLING_BOX_WEEKDAY_RATE_THB =
  SADAO_HANDLING_SMALL_CRATE_WEEKDAY_RATE_THB;
export const SADAO_HANDLING_BOX_HOLIDAY_RATE_THB =
  SADAO_HANDLING_SMALL_CRATE_HOLIDAY_RATE_THB;

export interface SadaoHandlingRates {
  small: number;
  large: number;
  /** Always equal to `small` — do not set independently. */
  box: number;
}

export function getSadaoHandlingRates(holidayRate: boolean): SadaoHandlingRates {
  const small = holidayRate
    ? SADAO_HANDLING_SMALL_CRATE_HOLIDAY_RATE_THB
    : SADAO_HANDLING_SMALL_CRATE_WEEKDAY_RATE_THB;
  const large = holidayRate
    ? SADAO_HANDLING_LARGE_CRATE_HOLIDAY_RATE_THB
    : SADAO_HANDLING_LARGE_CRATE_WEEKDAY_RATE_THB;
  return { small, large, box: small };
}

/** Default monthly LUNCH allowance (THB / person / month). Fixed, not pro-rated by attendance days. */
export const DEFAULT_LUNCH_ALLOWANCE_THB = 1000;

/** Default daily wage (THB) for new attendance rows; each row stores its own rate. */
export const DEFAULT_SADAO_DAILY_WAGE_THB = 300;

/** Suggested holiday daily wage (THB) — clerk enters manually; UI only hints. */
export const SUGGESTED_SADAO_HOLIDAY_DAILY_WAGE_THB = 400;

/**
 * Sadao daily-labor roster headcount for June 2026.
 * Source: PDF original roster lists 21 people (not the earlier 17 placeholder).
 * Actual active headcount is subject to clerk confirmation; stage-1 seed uses PDF 21.
 */
export const SADAO_JUNE_2026_DAILY_LABOR_ROSTER_COUNT = 21;

/**
 * Source note for the June 2026 daily-labor roster figure.
 * Keep visible in UI/seed so clerk can override if someone has left.
 */
export const SADAO_JUNE_2026_DAILY_LABOR_ROSTER_SOURCE =
  "PDF原始记录列出21人；实际在职人数以书记确认为准";

/**
 * Sadao monthly-salaried workers for June 2026 (verified from clerk PDF).
 */
export const SADAO_JUNE_2026_MONTHLY_WORKERS: ReadonlyArray<{
  name: string;
  monthlyWage: number;
  lunchAllowance: number;
  fuelAllowance: number;
  rentRoomAllowance: number;
}> = [
  {
    name: "WIN MYINT KYAW",
    monthlyWage: 6000,
    lunchAllowance: 1000,
    fuelAllowance: 0,
    rentRoomAllowance: 0,
  },
  {
    name: "YE MIN",
    monthlyWage: 6000,
    lunchAllowance: 1000,
    fuelAllowance: 0,
    rentRoomAllowance: 0,
  },
  {
    name: "SOMRAK",
    monthlyWage: 9000,
    lunchAllowance: 1000,
    fuelAllowance: 3000,
    rentRoomAllowance: 2500,
  },
];

export function yearMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}
