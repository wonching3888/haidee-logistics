import { decimalToNumber } from "@/lib/freight-rates";

export const CHARTER_CARGO_TYPES = ["seafood", "general"] as const;
export type CharterCargoType = (typeof CHARTER_CARGO_TYPES)[number];

export const CHARTER_EXTRA_ITEM_TYPES = ["revenue", "cost"] as const;
export type CharterExtraItemType = (typeof CHARTER_EXTRA_ITEM_TYPES)[number];

export const CHARTER_BILLING_COMPANIES = ["haidee", "wtl"] as const;
export type CharterBillingCompany = (typeof CHARTER_BILLING_COMPANIES)[number];

export function isCharterCargoType(value: string): value is CharterCargoType {
  return value === "seafood" || value === "general";
}

export function isCharterExtraItemType(
  value: string
): value is CharterExtraItemType {
  return value === "revenue" || value === "cost";
}

export function isCharterBillingCompany(
  value: string
): value is CharterBillingCompany {
  return value === "haidee" || value === "wtl";
}

export function charterCargoTypeLabel(type: CharterCargoType): string {
  return type === "seafood" ? "海产 Seafood" : "普货 General Cargo";
}

export function charterBillingCompanyLabel(company: CharterBillingCompany) {
  return company === "wtl" ? "WTL EXPRESS" : "HAIDEE";
}

export interface CharterTripLineRecord {
  id: string;
  tongTypeId: string;
  tongTypeCode: string;
  tongTypeName: string;
  isBox: boolean;
  quantity: number;
}

export interface CharterExtraItemRecord {
  id: string;
  itemType: CharterExtraItemType;
  amountMyr: number;
  note: string | null;
  sortOrder: number;
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
  billToCustomerName: string | null;
  billingCompany: CharterBillingCompany;
  driverName: string | null;
  cargoType: CharterCargoType;
  includeBorderFees: boolean;
  charterMileageKm: number;
  charterRevenueMyr: number;
  charterUnloadFeeMyr: number | null;
  charterDriverSalaryMyr: number | null;
  charterOtherCostMyr: number | null;
  charterOtherCostNote: string | null;
  charterTollMyr: number | null;
  totalQuantity: number | null;
  computedLkimMyr: number | null;
  computedCrateRentalMyr: number | null;
  extraRevenueItems: CharterExtraItemRecord[];
  extraCostItems: CharterExtraItemRecord[];
  lines: CharterTripLineRecord[];
}

export interface CharterTripLineInput {
  tongTypeId: string;
  quantity: number;
}

export interface CharterExtraItemInput {
  itemType: CharterExtraItemType;
  amountMyr: string | number;
  note?: string | null;
}

export interface CharterTripInput {
  id?: string;
  date: string;
  truckId: string;
  shipperId?: string | null;
  stockAreaNote?: string | null;
  billToCustomerName?: string | null;
  billingCompany?: CharterBillingCompany;
  driverName?: string | null;
  cargoType: CharterCargoType;
  includeBorderFees: boolean;
  charterMileageKm: string | number;
  charterRevenueMyr: string | number;
  charterUnloadFeeMyr?: string | number | null;
  charterDriverSalaryMyr?: string | number | null;
  charterOtherCostMyr?: string | number | null;
  charterOtherCostNote?: string | null;
  charterTollMyr?: string | number | null;
  totalQuantity?: string | number | null;
  extraItems?: CharterExtraItemInput[];
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

export function parseRequiredCharterQuantity(
  value: string | number | null | undefined,
  label: string
): number {
  if (value == null) {
    throw new Error(`请填写${label} Please enter ${label}`);
  }
  const raw =
    typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(raw) || !Number.isInteger(raw) || raw <= 0) {
    throw new Error(
      `${label}须为正整数 ${label} must be a positive whole number`
    );
  }
  return raw;
}

export function parseCharterQuantityInput(
  value: string | number | null | undefined
): number | null {
  if (value == null) return null;
  const raw =
    typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(raw) || !Number.isInteger(raw) || raw <= 0) {
    return null;
  }
  return raw;
}

export function normalizeCharterNote(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function serializeExtraItem(row: {
  id: string;
  itemType: string;
  amountMyr: unknown;
  note: string | null;
  sortOrder: number;
}): CharterExtraItemRecord | null {
  if (!isCharterExtraItemType(row.itemType)) return null;
  const amountMyr = decimalToNumber(row.amountMyr);
  if (amountMyr == null) return null;
  return {
    id: row.id,
    itemType: row.itemType,
    amountMyr,
    note: row.note,
    sortOrder: row.sortOrder,
  };
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
  billToCustomerName?: string | null;
  billingCompany: string;
  cargoType: string;
  includeBorderFees: boolean;
  charterMileageKm: unknown;
  charterRevenueMyr: unknown;
  charterUnloadFeeMyr: unknown;
  charterDriverSalaryMyr: unknown;
  charterOtherCostMyr: unknown;
  charterOtherCostNote: string | null;
  charterTollMyr?: unknown;
  totalQuantity?: number | null;
  computedLkimMyr: unknown;
  computedCrateRentalMyr: unknown;
  extraItems?: Array<{
    id: string;
    itemType: string;
    amountMyr: unknown;
    note: string | null;
    sortOrder: number;
  }>;
  lines: Array<{
    id: string;
    tongTypeId: string;
    quantity: number;
    tongType: { code: string; name: string; isBox: boolean };
  }>;
}): CharterTripRecord | null {
  if (!isCharterCargoType(row.cargoType)) return null;
  if (!isCharterBillingCompany(row.billingCompany)) return null;

  const mileage = decimalToNumber(row.charterMileageKm);
  const revenue = decimalToNumber(row.charterRevenueMyr);
  if (mileage == null || revenue == null) return null;

  const extraItems = (row.extraItems ?? [])
    .map(serializeExtraItem)
    .filter((item): item is CharterExtraItemRecord => item != null);

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
    billToCustomerName: row.billToCustomerName ?? null,
    billingCompany: row.billingCompany,
    driverName: row.driverName,
    cargoType: row.cargoType,
    includeBorderFees: row.includeBorderFees,
    charterMileageKm: mileage,
    charterRevenueMyr: revenue,
    charterUnloadFeeMyr: decimalToNumber(row.charterUnloadFeeMyr),
    charterDriverSalaryMyr: decimalToNumber(row.charterDriverSalaryMyr),
    charterOtherCostMyr: decimalToNumber(row.charterOtherCostMyr),
    charterOtherCostNote: row.charterOtherCostNote,
    charterTollMyr: decimalToNumber(row.charterTollMyr),
    totalQuantity: row.totalQuantity ?? null,
    computedLkimMyr: decimalToNumber(row.computedLkimMyr),
    computedCrateRentalMyr: decimalToNumber(row.computedCrateRentalMyr),
    extraRevenueItems: extraItems.filter((item) => item.itemType === "revenue"),
    extraCostItems: extraItems.filter((item) => item.itemType === "cost"),
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

export function parseCharterExtraItems(
  items: CharterExtraItemInput[] | undefined,
  itemType: CharterExtraItemType
) {
  if (!items?.length) return [];

  return items
    .map((item, index) => {
      if (item.itemType !== itemType) return null;
      const amountMyr = parseCharterMoneyInput(item.amountMyr);
      if (amountMyr == null || amountMyr <= 0) return null;
      return {
        itemType,
        amountMyr,
        note: normalizeCharterNote(item.note),
        sortOrder: index,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);
}
