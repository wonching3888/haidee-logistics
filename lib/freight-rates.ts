import { format } from "date-fns";
import {
  MARKET_ORDER,
  MARKETS_WITHOUT_FREIGHT,
} from "@/lib/markets";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants/freight-settings";
import { RATE_DEFAULT_EFFECTIVE_FLOOR } from "@/lib/constants/rate-effective-date";
import { parseDateInput, toDateInputValue } from "@/lib/date-utils";

export interface RateCell {
  rateTong: number | null;
  rateBox: number | null;
  effectiveDate: string | null;
}

export interface EffectiveRateRow {
  marketId: string;
  effectiveDate: Date;
  rateTong: number | null;
  rateBox: number | null;
}

function calendarDay(date: Date) {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function getFreightMarketCodes() {
  return MARKET_ORDER.filter(
    (code) => !MARKETS_WITHOUT_FREIGHT.includes(code as (typeof MARKETS_WITHOUT_FREIGHT)[number])
  );
}

export function getCurrentYearMonth(date = new Date()) {
  return format(date, "yyyy-MM");
}

export function getNextMonthFirstDayInput(date = new Date()) {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return toDateInputValue(next);
}

export function entityHasFreightRateHistory(matrix: Record<string, RateCell>) {
  return Object.values(matrix).some((cell) => cell.effectiveDate != null);
}

export function getDefaultRateEffectiveDateInputs(hasExistingRates: boolean) {
  if (!hasExistingRates) {
    return {
      immediate: false,
      scheduledDate: RATE_DEFAULT_EFFECTIVE_FLOOR,
    };
  }
  return {
    immediate: true,
    scheduledDate: toDateInputValue(new Date()),
  };
}

export function resolveEffectiveDateInput(input: {
  immediate: boolean;
  scheduledDate?: string;
}) {
  if (input.immediate) {
    return parseDateInput(toDateInputValue(new Date()));
  }
  if (!input.scheduledDate?.trim()) {
    throw new Error("请选择生效日期 Please select an effective date");
  }
  return parseDateInput(input.scheduledDate);
}

export function pickEffectiveRates<T extends EffectiveRateRow>(
  rates: T[],
  asOfDate: Date = new Date()
): Map<string, T> {
  const asOf = calendarDay(asOfDate).getTime();
  const sorted = [...rates].sort(
    (a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime()
  );
  const byMarket = new Map<string, T>();

  for (const rate of sorted) {
    if (calendarDay(rate.effectiveDate).getTime() > asOf) continue;
    if (!byMarket.has(rate.marketId)) {
      byMarket.set(rate.marketId, rate);
    }
  }

  return byMarket;
}

export function decimalToNumber(value: unknown): number | null {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function parseOptionalRate(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error("费率必须为非负数 Rate must be a non-negative number");
  }
  return num;
}

export function buildRateMatrix<T extends EffectiveRateRow>(input: {
  entityId: string;
  rates: T[];
  marketIdsByCode: Map<string, string>;
  asOfDate?: Date;
}) {
  const effectiveByMarket = pickEffectiveRates(input.rates, input.asOfDate);
  const cells: Record<string, RateCell> = {};

  for (const [code, marketId] of Array.from(input.marketIdsByCode.entries())) {
    const rate = effectiveByMarket.get(marketId);
    cells[code] = {
      rateTong: rate ? decimalToNumber(rate.rateTong) : null,
      rateBox: rate ? decimalToNumber(rate.rateBox) : null,
      effectiveDate: rate ? toDateInputValue(rate.effectiveDate) : null,
    };
  }

  return {
    entityId: input.entityId,
    cells,
  };
}

export function formatYearMonthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split("-");
  return `${year}年${Number(month)}月`;
}

export function convertThbToMyr(amountThb: number, rate = DEFAULT_EXCHANGE_RATE) {
  return amountThb / rate;
}

export function convertMyrToThb(amountMyr: number, rate = DEFAULT_EXCHANGE_RATE) {
  return amountMyr * rate;
}
