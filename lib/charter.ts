import { decimalToNumber } from "@/lib/freight-rates";

export const CHARTER_CARGO_TYPES = ["seafood", "general"] as const;
export type CharterCargoType = (typeof CHARTER_CARGO_TYPES)[number];

export function isCharterCargoType(value: string): value is CharterCargoType {
  return value === "seafood" || value === "general";
}

export function charterCargoTypeLabel(type: CharterCargoType): string {
  return type === "seafood" ? "海产 Seafood" : "普货 General Cargo";
}

export interface CharterTripLineRecord {
  id: string;
  tongTypeId: string;
  tongTypeCode: string;
  tongTypeName: string;
  isBox: boolean;
  quantity: number;
}

export interface CharterTripRecord {
  id: string;
  charterNo: string | null;
  date: string;
  truckId: string;
  truckPlate: string;
  shipperId: string | null;
  shipperCode: string | null;
  shipperName: string | null;
  stockAreaNote: string | null;
  driverName: string | null;
  cargoType: CharterCargoType;
  includeBorderFees: boolean;
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
  computedLkimMyr: number | null;
  computedCrateRentalMyr: number | null;
  lines: CharterTripLineRecord[];
}

export interface CharterTripLineInput {
  tongTypeId: string;
  quantity: number;
}

export interface CharterTripInput {
  id?: string;
  date: string;
  truckId: string;
  shipperId?: string | null;
  stockAreaNote?: string | null;
  driverName?: string | null;
  cargoType: CharterCargoType;
  includeBorderFees: boolean;
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
  lines?: CharterTripLineInput[];
}

export interface CharterTripListItem {
  id: string;
  charterNo: string | null;
  date: string;
  truckPlate: string;
  driverName: string | null;
  cargoType: CharterCargoType;
  charterRevenueMyr: number;
  charterMileageKm: number;
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

export function serializeCharterTrip(row: {
  id: string;
  charterNo: string | null;
  date: Date;
  truckId: string;
  truck: { plate: string };
  shipper?: { code: string; name: string } | null;
  driverName: string | null;
  shipperId?: string | null;
  stockAreaNote?: string | null;
  cargoType: string;
  includeBorderFees: boolean;
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
  computedLkimMyr: unknown;
  computedCrateRentalMyr: unknown;
  lines: Array<{
    id: string;
    tongTypeId: string;
    quantity: number;
    tongType: { code: string; name: string; isBox: boolean };
  }>;
}): CharterTripRecord | null {
  if (!isCharterCargoType(row.cargoType)) return null;

  const mileage = decimalToNumber(row.charterMileageKm);
  const revenue = decimalToNumber(row.charterRevenueMyr);
  if (mileage == null || revenue == null) return null;

  return {
    id: row.id,
    charterNo: row.charterNo,
    date: row.date.toISOString().slice(0, 10),
    truckId: row.truckId,
    truckPlate: row.truck.plate,
    shipperId: row.shipperId ?? null,
    shipperCode: row.shipper?.code ?? null,
    shipperName: row.shipper?.name ?? null,
    stockAreaNote: row.stockAreaNote ?? null,
    driverName: row.driverName,
    cargoType: row.cargoType,
    includeBorderFees: row.includeBorderFees,
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
    computedLkimMyr: decimalToNumber(row.computedLkimMyr),
    computedCrateRentalMyr: decimalToNumber(row.computedCrateRentalMyr),
    lines: row.lines.map((line) => ({
      id: line.id,
      tongTypeId: line.tongTypeId,
      tongTypeCode: line.tongType.code,
      tongTypeName: line.tongType.name,
      isBox: line.tongType.isBox,
      quantity: line.quantity,
    })),
  };
}

export function serializeCharterTripListItem(row: {
  id: string;
  charterNo: string | null;
  date: Date;
  driverName: string | null;
  cargoType: string;
  charterMileageKm: unknown;
  charterRevenueMyr: unknown;
  truck: { plate: string };
}): CharterTripListItem | null {
  if (!isCharterCargoType(row.cargoType)) return null;
  const mileage = decimalToNumber(row.charterMileageKm);
  const revenue = decimalToNumber(row.charterRevenueMyr);
  if (mileage == null || revenue == null) return null;

  return {
    id: row.id,
    charterNo: row.charterNo,
    date: row.date.toISOString().slice(0, 10),
    truckPlate: row.truck.plate,
    driverName: row.driverName,
    cargoType: row.cargoType,
    charterRevenueMyr: revenue,
    charterMileageKm: mileage,
  };
}
