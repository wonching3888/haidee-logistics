import type { PickupLocation } from "@/lib/constants/pickup-locations";

export interface MultiOriginCustomerConfig {
  isMultiOrigin: boolean;
  locations: string[];
}

/** Multi-origin dropdown applies on SADAO pickup only (SK/PTN office pool unchanged). */
export function requiresCustomerOriginSelection(
  isMultiOrigin: boolean,
  effectivePickup: PickupLocation
): boolean {
  return isMultiOrigin && effectivePickup === "SADAO";
}

export function normalizeOriginLocationName(name: string): string {
  return name.trim();
}

export function parseOriginLocationNames(raw: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    const name = normalizeOriginLocationName(item);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

export interface MultiOriginStockLocationRow {
  location: string;
  quantities: Record<string, number>;
  /** Stock at a location not in the customer's standard origin list (legacy). */
  outsideStandardOrigin?: boolean;
}

/** Drop blank names from multi-origin dropdowns (never a valid standard origin). */
export function filterMultiOriginDropdownOptions(
  locations: readonly string[]
): string[] {
  return locations.filter((loc) => loc.trim() !== "");
}

function findStockLocationKey(
  stockByLocation: ReadonlyMap<string, Record<string, number>>,
  originName: string
): string | undefined {
  const target = originName.toLowerCase();
  for (const key of Array.from(stockByLocation.keys())) {
    if (key.toLowerCase() === target) return key;
  }
  return undefined;
}

/**
 * Merge standard origin list with existing stock locations for multi-origin customers.
 * Standard origins appear even at qty 0; legacy locations only when qty > 0.
 */
export function buildMultiOriginCustomerStockLocations(
  standardOrigins: readonly string[],
  stockByLocation: ReadonlyMap<string, Record<string, number>>,
  initEmptyQuantities: () => Record<string, number>
): MultiOriginStockLocationRow[] {
  const standardLower = new Set(
    standardOrigins.map((name) => name.toLowerCase())
  );
  const consumedStockKeys = new Set<string>();
  const result: MultiOriginStockLocationRow[] = [];

  for (const standardName of standardOrigins) {
    const stockKey = findStockLocationKey(stockByLocation, standardName);
    const quantities =
      stockKey !== undefined
        ? stockByLocation.get(stockKey)!
        : initEmptyQuantities();
    if (stockKey !== undefined) consumedStockKeys.add(stockKey);
    result.push({
      location: standardName,
      quantities,
      outsideStandardOrigin: false,
    });
  }

  const legacy: MultiOriginStockLocationRow[] = [];
  for (const [loc, quantities] of Array.from(stockByLocation.entries())) {
    if (consumedStockKeys.has(loc)) continue;
    const hasQty = Object.values(quantities).some((q) => q !== 0);
    if (!standardLower.has(loc.toLowerCase()) && hasQty) {
      legacy.push({ location: loc, quantities, outsideStandardOrigin: true });
    }
  }

  legacy.sort((a, b) => {
    if (a.location === "") return 1;
    if (b.location === "") return -1;
    return a.location.localeCompare(b.location);
  });

  return [...result, ...legacy];
}

/** Edit / inbound / export dropdown options for multi-origin customers (no blank origin). */
export function selectableMultiOriginStockLocations<
  T extends { location: string },
>(locations: readonly T[]): T[] {
  return locations.filter((loc) => loc.location.trim() !== "");
}

export function assertOriginInCustomerList(
  origin: string | null | undefined,
  locations: readonly string[]
): string {
  const trimmed = normalizeOriginLocationName(origin ?? "");
  if (!trimmed) {
    throw new Error("请选择标准产地 Origin is required for this customer");
  }
  const match = locations.find(
    (loc) => loc.toLowerCase() === trimmed.toLowerCase()
  );
  if (!match) {
    throw new Error("所选产地不在该客户标准清单中 Invalid origin for this customer");
  }
  return match;
}
