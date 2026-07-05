import {
  DEFAULT_LUNCH_ALLOWANCE_THB,
  getSadaoHandlingRates,
  type SadaoHandlingRates,
} from "@/lib/constants/thai-cost";
import { ratesToHandlingPair, type ThaiCostRates } from "@/lib/thai-cost/rate-settings";

export class SadaoHandlingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SadaoHandlingValidationError";
  }
}

export interface SadaoHandlingQtyInput {
  smallCrateTotalQty: number;
  largeCrateTotalQty: number;
  boxTotalQty: number;
  smallCrateNoCheckQty: number;
  largeCrateNoCheckQty: number;
  boxNoCheckQty: number;
}

export interface SadaoBillableCrates {
  smallBillableQty: number;
  largeBillableQty: number;
  boxBillableQty: number;
}

export interface SadaoHandlingCommission extends SadaoBillableCrates {
  holidayRate: boolean;
  rates: SadaoHandlingRates;
  smallCommissionThb: number;
  largeCommissionThb: number;
  boxCommissionThb: number;
  totalCommissionThb: number;
}

function assertNonNegativeInt(value: number, field: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new SadaoHandlingValidationError(
      `${field} 必须是非负整数 must be a non-negative integer`
    );
  }
  return value;
}

/**
 * Billable units = total − no-check (per category).
 * Rejects no-check > total (no silent negative billable qty).
 * Categories are validated independently.
 */
export function computeSadaoBillableCrates(
  input: SadaoHandlingQtyInput
): SadaoBillableCrates {
  const smallTotal = assertNonNegativeInt(
    input.smallCrateTotalQty,
    "smallCrateTotalQty"
  );
  const largeTotal = assertNonNegativeInt(
    input.largeCrateTotalQty,
    "largeCrateTotalQty"
  );
  const boxTotal = assertNonNegativeInt(input.boxTotalQty, "boxTotalQty");
  const smallNoCheck = assertNonNegativeInt(
    input.smallCrateNoCheckQty,
    "smallCrateNoCheckQty"
  );
  const largeNoCheck = assertNonNegativeInt(
    input.largeCrateNoCheckQty,
    "largeCrateNoCheckQty"
  );
  const boxNoCheck = assertNonNegativeInt(
    input.boxNoCheckQty,
    "boxNoCheckQty"
  );

  if (smallNoCheck > smallTotal) {
    throw new SadaoHandlingValidationError(
      `直达小桶数(${smallNoCheck})不能超过小桶总数(${smallTotal}) direct small qty cannot exceed small total`
    );
  }
  if (largeNoCheck > largeTotal) {
    throw new SadaoHandlingValidationError(
      `直达大桶数(${largeNoCheck})不能超过大桶总数(${largeTotal}) direct large qty cannot exceed large total`
    );
  }
  if (boxNoCheck > boxTotal) {
    throw new SadaoHandlingValidationError(
      `直达盒子数(${boxNoCheck})不能超过盒子总数(${boxTotal}) direct box qty cannot exceed box total`
    );
  }

  return {
    smallBillableQty: smallTotal - smallNoCheck,
    largeBillableQty: largeTotal - largeNoCheck,
    boxBillableQty: boxTotal - boxNoCheck,
  };
}

/**
 * Daily handling commission using weekday or holiday rates.
 * BOX always uses the small-crate rate.
 * Pass `rateConfig` from monthly snapshot or current settings for historical stability.
 */
export function computeSadaoHandlingCommission(
  input: SadaoHandlingQtyInput,
  options: { holidayRate: boolean; rateConfig?: ThaiCostRates }
): SadaoHandlingCommission {
  const billable = computeSadaoBillableCrates(input);
  const rates = options.rateConfig
    ? ratesToHandlingPair(options.rateConfig, options.holidayRate)
    : getSadaoHandlingRates(options.holidayRate);
  const smallCommissionThb = billable.smallBillableQty * rates.small;
  const largeCommissionThb = billable.largeBillableQty * rates.large;
  const boxCommissionThb = billable.boxBillableQty * rates.box;
  return {
    ...billable,
    holidayRate: options.holidayRate,
    rates,
    smallCommissionThb,
    largeCommissionThb,
    boxCommissionThb,
    totalCommissionThb:
      smallCommissionThb + largeCommissionThb + boxCommissionThb,
  };
}

/** Day cost for daily-wage labor = headcount × that day's wage rate. */
export function computeDailyLaborCost(
  attendanceCount: number,
  dailyWage: number
): number {
  if (
    !Number.isFinite(attendanceCount) ||
    !Number.isInteger(attendanceCount) ||
    attendanceCount < 0
  ) {
    throw new SadaoHandlingValidationError(
      "attendanceCount 必须是非负整数 must be a non-negative integer"
    );
  }
  if (!Number.isFinite(dailyWage) || dailyWage < 0) {
    throw new SadaoHandlingValidationError(
      "dailyWage 必须是非负数 must be non-negative"
    );
  }
  return attendanceCount * dailyWage;
}

/**
 * Resolve one attendance day's wage cost.
 * Prefer totalWagePaid when present (Songkhla mixed rates);
 * otherwise attendanceCount × dailyWage (Sadao).
 */
export function computeDailyLaborDayCost(input: {
  attendanceCount: number;
  dailyWage: number;
  totalWagePaid?: number | null;
}): number {
  if (input.totalWagePaid != null) {
    if (!Number.isFinite(input.totalWagePaid) || input.totalWagePaid < 0) {
      throw new SadaoHandlingValidationError(
        "totalWagePaid 必须是非负数 must be non-negative"
      );
    }
    return input.totalWagePaid;
  }
  return computeDailyLaborCost(input.attendanceCount, input.dailyWage);
}

/**
 * Daily-labor LUNCH = roster headcount × monthly lunch rate.
 * Fixed full amount (not pro-rated by attendance days).
 */
export function computeDailyLaborLunchTotal(
  rosterCount: number,
  lunchPerPersonThb: number = DEFAULT_LUNCH_ALLOWANCE_THB
): number {
  if (
    !Number.isFinite(rosterCount) ||
    !Number.isInteger(rosterCount) ||
    rosterCount < 0
  ) {
    throw new SadaoHandlingValidationError(
      "rosterCount 必须是非负整数 must be a non-negative integer"
    );
  }
  if (!Number.isFinite(lunchPerPersonThb) || lunchPerPersonThb < 0) {
    throw new SadaoHandlingValidationError(
      "lunchPerPersonThb 必须是非负数 must be non-negative"
    );
  }
  return rosterCount * lunchPerPersonThb;
}

export interface MonthlyWorkerCostInput {
  monthlyWage: number;
  lunchAllowance: number;
  fuelAllowance: number;
  rentRoomAllowance: number;
}

export function computeMonthlyWorkerTotal(
  input: MonthlyWorkerCostInput
): number {
  return (
    (Number(input.monthlyWage) || 0) +
    (Number(input.lunchAllowance) || 0) +
    (Number(input.fuelAllowance) || 0) +
    (Number(input.rentRoomAllowance) || 0)
  );
}

export interface SadaoMonthlyCostParts {
  monthlyWageTotalThb: number;
  monthlyLunchTotalThb: number;
  monthlyFuelTotalThb: number;
  monthlyRentRoomTotalThb: number;
  dailyLaborWageTotalThb: number;
  dailyLaborLunchTotalThb: number;
  handlingSmallCommissionThb: number;
  handlingLargeCommissionThb: number;
  handlingBoxCommissionThb: number;
}

export interface SadaoMonthlyCostSummary extends SadaoMonthlyCostParts {
  monthlyWorkerTotalThb: number;
  dailyLaborTotalThb: number;
  handlingCommissionTotalThb: number;
  totalCostThb: number;
}

/**
 * Sum all Sadao cost buckets for a month:
 * monthly (wage+LUNCH+FUEL+RENT) + daily wages + daily LUNCH + handling.
 */
export function sumSadaoMonthlyCost(
  parts: SadaoMonthlyCostParts
): SadaoMonthlyCostSummary {
  const monthlyWageTotalThb = Number(parts.monthlyWageTotalThb) || 0;
  const monthlyLunchTotalThb = Number(parts.monthlyLunchTotalThb) || 0;
  const monthlyFuelTotalThb = Number(parts.monthlyFuelTotalThb) || 0;
  const monthlyRentRoomTotalThb = Number(parts.monthlyRentRoomTotalThb) || 0;
  const dailyLaborWageTotalThb = Number(parts.dailyLaborWageTotalThb) || 0;
  const dailyLaborLunchTotalThb = Number(parts.dailyLaborLunchTotalThb) || 0;
  const handlingSmallCommissionThb =
    Number(parts.handlingSmallCommissionThb) || 0;
  const handlingLargeCommissionThb =
    Number(parts.handlingLargeCommissionThb) || 0;
  const handlingBoxCommissionThb =
    Number(parts.handlingBoxCommissionThb) || 0;

  const monthlyWorkerTotalThb =
    monthlyWageTotalThb +
    monthlyLunchTotalThb +
    monthlyFuelTotalThb +
    monthlyRentRoomTotalThb;
  const dailyLaborTotalThb = dailyLaborWageTotalThb + dailyLaborLunchTotalThb;
  const handlingCommissionTotalThb =
    handlingSmallCommissionThb +
    handlingLargeCommissionThb +
    handlingBoxCommissionThb;

  return {
    monthlyWageTotalThb,
    monthlyLunchTotalThb,
    monthlyFuelTotalThb,
    monthlyRentRoomTotalThb,
    dailyLaborWageTotalThb,
    dailyLaborLunchTotalThb,
    handlingSmallCommissionThb,
    handlingLargeCommissionThb,
    handlingBoxCommissionThb,
    monthlyWorkerTotalThb,
    dailyLaborTotalThb,
    handlingCommissionTotalThb,
    totalCostThb:
      monthlyWorkerTotalThb + dailyLaborTotalThb + handlingCommissionTotalThb,
  };
}
