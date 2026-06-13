import type { PickupLocation } from "@/lib/constants/pickup-locations";

export const LOCATION_POOL_SHIPPER_CODES = {
  SONGKHLA: "LOC-SONGKHLA",
  PATTANI: "LOC-PATTANI",
} as const;

export const LOCATION_POOL_SHIPPER_LIST = [
  {
    code: LOCATION_POOL_SHIPPER_CODES.SONGKHLA,
    name: "宋卡 SONGKHLA",
    pickupLocation: "SONGKHLA" as PickupLocation,
  },
  {
    code: LOCATION_POOL_SHIPPER_CODES.PATTANI,
    name: "北大年 PATTANI",
    pickupLocation: "PATTANI" as PickupLocation,
  },
] as const;

export function isLocationPoolShipperCode(code: string): boolean {
  return (
    code === LOCATION_POOL_SHIPPER_CODES.SONGKHLA ||
    code === LOCATION_POOL_SHIPPER_CODES.PATTANI
  );
}

export function stockLocationForPoolShipperCode(
  code: string
): "SONGKHLA" | "PATTANI" | null {
  if (code === LOCATION_POOL_SHIPPER_CODES.SONGKHLA) return "SONGKHLA";
  if (code === LOCATION_POOL_SHIPPER_CODES.PATTANI) return "PATTANI";
  return null;
}

export function pickupLocationForPoolShipperCode(
  code: string
): "SONGKHLA" | "PATTANI" | null {
  return stockLocationForPoolShipperCode(code);
}
