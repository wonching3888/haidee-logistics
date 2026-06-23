import { parseDateInput } from "@/lib/date-utils";
import {
  resolveInboundCrateStockLocation,
  resolveSessionPickupLocation,
} from "@/lib/constants/pickup-locations";
import type { LocationPoolShipperIds } from "@/lib/location-pool-shippers-service";

/** Inbound sessions on/after this date deduct SK/PTN office stock from LOC-* pool. */
export const INBOUND_OFFICE_POOL_CUTOFF_DATE = parseDateInput("2026-06-24");

export interface InboundCrateStockAccount {
  shipperId: string;
  location: string;
}

export function usesOfficePoolInboundStock(sessionDate: Date): boolean {
  return sessionDate.getTime() >= INBOUND_OFFICE_POOL_CUTOFF_DATE.getTime();
}

export function resolveInboundCrateStockAccount(input: {
  sessionDate: Date;
  operationalShipperId: string;
  sessionPickupLocation: string | null | undefined;
  shipperPickupLocation: string | null | undefined;
  areaNote: string | null | undefined;
  poolIds: LocationPoolShipperIds;
}): InboundCrateStockAccount {
  const effectivePickup = resolveSessionPickupLocation(
    input.sessionPickupLocation,
    input.shipperPickupLocation
  );
  const location = resolveInboundCrateStockLocation(
    effectivePickup,
    input.areaNote
  );

  if (!usesOfficePoolInboundStock(input.sessionDate)) {
    return {
      shipperId: input.operationalShipperId,
      location,
    };
  }

  if (effectivePickup === "SONGKHLA") {
    return {
      shipperId: input.poolIds.SONGKHLA,
      location: "SONGKHLA",
    };
  }

  if (effectivePickup === "PATTANI") {
    return {
      shipperId: input.poolIds.PATTANI,
      location: "PATTANI",
    };
  }

  return {
    shipperId: input.operationalShipperId,
    location,
  };
}
