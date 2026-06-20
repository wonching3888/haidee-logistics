import { decimalToNumber } from "@/lib/freight-rates";

export const CHARTER_CLASSES = ["A", "B"] as const;
export type CharterClass = (typeof CHARTER_CLASSES)[number];

export function isCharterClass(value: string): value is CharterClass {
  return value === "A" || value === "B";
}

export interface CharterFinanceRecord {
  id: string;
  dispatchOrderId: string;
  charterClass: CharterClass;
  charterMileageKm: number;
  charterRevenueMyr: number;
  charterUnloadFeeMyr: number | null;
  charterDriverSalaryMyr: number | null;
  charterOtherCostMyr: number | null;
  charterOtherCostNote: string | null;
  charterExtraRevenueMyr: number | null;
  charterExtraRevenueNote: string | null;
  charterExtraCostMyr: number | null;
  charterExtraCostNote: string | null;
}

export interface CharterFinanceInput {
  dispatchOrderId: string;
  charterClass: CharterClass;
  charterMileageKm: string | number;
  charterRevenueMyr: string | number;
  charterUnloadFeeMyr?: string | number | null;
  charterDriverSalaryMyr?: string | number | null;
  charterOtherCostMyr?: string | number | null;
  charterOtherCostNote?: string | null;
  charterExtraRevenueMyr?: string | number | null;
  charterExtraRevenueNote?: string | null;
  charterExtraCostMyr?: string | number | null;
  charterExtraCostNote?: string | null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function parseCharterMoneyInput(
  value: string | number | null | undefined
): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? roundMoney(value) : null;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return roundMoney(parsed);
}

export function parseRequiredCharterMoney(
  value: string | number,
  label: string
): number {
  const parsed = parseCharterMoneyInput(value);
  if (parsed == null) {
    throw new Error(`请填写${label} Please enter ${label}`);
  }
  return parsed;
}

export function normalizeCharterNote(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function serializeCharterFinance(row: {
  id: string;
  dispatchOrderId: string;
  charterClass: string;
  charterMileageKm: unknown;
  charterRevenueMyr: unknown;
  charterUnloadFeeMyr: unknown;
  charterDriverSalaryMyr: unknown;
  charterOtherCostMyr: unknown;
  charterOtherCostNote: string | null;
  charterExtraRevenueMyr: unknown;
  charterExtraRevenueNote: string | null;
  charterExtraCostMyr: unknown;
  charterExtraCostNote: string | null;
}): CharterFinanceRecord | null {
  if (!isCharterClass(row.charterClass)) return null;

  const mileage = decimalToNumber(row.charterMileageKm);
  const revenue = decimalToNumber(row.charterRevenueMyr);
  if (mileage == null || revenue == null) return null;

  return {
    id: row.id,
    dispatchOrderId: row.dispatchOrderId,
    charterClass: row.charterClass,
    charterMileageKm: mileage,
    charterRevenueMyr: revenue,
    charterUnloadFeeMyr: decimalToNumber(row.charterUnloadFeeMyr),
    charterDriverSalaryMyr: decimalToNumber(row.charterDriverSalaryMyr),
    charterOtherCostMyr: decimalToNumber(row.charterOtherCostMyr),
    charterOtherCostNote: row.charterOtherCostNote,
    charterExtraRevenueMyr: decimalToNumber(row.charterExtraRevenueMyr),
    charterExtraRevenueNote: row.charterExtraRevenueNote,
    charterExtraCostMyr: decimalToNumber(row.charterExtraCostMyr),
    charterExtraCostNote: row.charterExtraCostNote,
  };
}
