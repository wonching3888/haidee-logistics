export const DRIVER_VOUCHER_TRIP_SOURCES = ["dispatch", "charter"] as const;

export type DriverVoucherTripSource = (typeof DRIVER_VOUCHER_TRIP_SOURCES)[number];

export function isDriverVoucherTripSource(
  value: string | null | undefined
): value is DriverVoucherTripSource {
  return value === "dispatch" || value === "charter";
}

export function parseDriverVoucherTripSource(
  value: string | null | undefined,
  fallback: DriverVoucherTripSource = "dispatch"
): DriverVoucherTripSource {
  return isDriverVoucherTripSource(value) ? value : fallback;
}

export function expenseTripKey(
  tripId: string,
  tripSource: DriverVoucherTripSource
): string {
  return `${tripSource}:${tripId}`;
}
