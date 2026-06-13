export const PICKUP_LOCATIONS = ["SADAO", "SONGKHLA", "PATTANI"] as const;

export type PickupLocation = (typeof PICKUP_LOCATIONS)[number];

export const DEFAULT_PICKUP_LOCATION: PickupLocation = "SADAO";

export const PICKUP_LOCATION_LABELS: Record<PickupLocation, string> = {
  SADAO: "SADAO",
  SONGKHLA: "宋卡 SONGKHLA",
  PATTANI: "北大年 PATTANI",
};

export const SESSION_PICKUP_USE_DEFAULT = "__USE_DEFAULT__";

export function tripPickupSelectValue(
  sessionPickup: string | null | undefined,
  shipperPickup: string | null | undefined
): string {
  if (sessionPickup && isPickupLocation(sessionPickup)) {
    return sessionPickup;
  }
  if (shipperPickup && isPickupLocation(shipperPickup)) {
    return shipperPickup;
  }
  return DEFAULT_PICKUP_LOCATION;
}

export function tripPickupSaveValue(
  selected: string,
  shipperPickup: string | null | undefined
): PickupLocation | null {
  if (
    !selected ||
    selected === SESSION_PICKUP_USE_DEFAULT ||
    selected === ""
  ) {
    return null;
  }
  const shipperDefault = resolveSessionPickupLocation(null, shipperPickup);
  if (selected === shipperDefault) return null;
  if (!isPickupLocation(selected)) {
    throw new Error("无效的收货地点 Invalid pickup location");
  }
  return selected;
}

export function isPickupLocation(value: string): value is PickupLocation {
  return (PICKUP_LOCATIONS as readonly string[]).includes(value);
}

export function resolveSessionPickupLocation(
  sessionPickup: string | null | undefined,
  shipperPickup: string | null | undefined
): PickupLocation {
  const raw = sessionPickup ?? shipperPickup ?? DEFAULT_PICKUP_LOCATION;
  return isPickupLocation(raw) ? raw : DEFAULT_PICKUP_LOCATION;
}

export function formatPickupLocationLabel(
  code: string | null | undefined
): string {
  if (code && isPickupLocation(code)) {
    return PICKUP_LOCATION_LABELS[code];
  }
  return PICKUP_LOCATION_LABELS[DEFAULT_PICKUP_LOCATION];
}

export function normalizeSessionPickupInput(
  value: string | null | undefined
): PickupLocation | null {
  if (
    !value ||
    value === SESSION_PICKUP_USE_DEFAULT ||
    value === ""
  ) {
    return null;
  }
  if (!isPickupLocation(value)) {
    throw new Error("无效的收货地点 Invalid pickup location");
  }
  return value;
}

/** Customer crate stock bucket for inbound deductions. */
export function resolveInboundCrateStockLocation(
  pickupLocation: PickupLocation,
  areaNote: string | null | undefined
): string {
  if (pickupLocation === "SONGKHLA") return "SONGKHLA";
  if (pickupLocation === "PATTANI") return "PATTANI";
  return areaNote?.trim() ?? "";
}

export const PICKUP_CRATE_STOCK_LOCATIONS = ["SONGKHLA", "PATTANI"] as const;
