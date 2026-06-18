import { convertThbToMyr } from "@/lib/freight-rates";
import type { CrateRentalRateRow } from "@/lib/crate-rental-rates-service";

export type CrateRentalCurrency = "THB" | "MYR";

export const CRATE_RENTAL_CURRENCIES: CrateRentalCurrency[] = ["MYR", "THB"];

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function normalizeCrateRentalCurrency(
  value: string | null | undefined
): CrateRentalCurrency {
  return value?.toUpperCase() === "THB" ? "THB" : "MYR";
}

/** Per-crate rental cost in MYR for P&L / operations dashboards. */
export function resolveCrateRentalMyrPerUnit(
  rate: number,
  currency: CrateRentalCurrency,
  exchangeRate: number
): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  if (currency === "THB") {
    return roundMoney(convertThbToMyr(rate, exchangeRate));
  }
  return roundMoney(rate);
}

export function buildCrateRentalMyrRateMap(
  rates: CrateRentalRateRow[],
  exchangeRate: number
): Map<string, number> {
  return new Map(
    rates
      .filter((row) => row.isRental)
      .map((row) => [
        row.crateType,
        resolveCrateRentalMyrPerUnit(row.rate, row.currency, exchangeRate),
      ])
  );
}

export function computeCrateRentalLineCostMyr(
  quantity: number,
  ratePerUnitMyr: number
): number {
  if (quantity <= 0 || ratePerUnitMyr <= 0) return 0;
  return roundMoney(quantity * ratePerUnitMyr);
}
