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
