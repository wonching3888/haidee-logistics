import {
  resolveInboundCrateStockLocation,
  resolveSessionPickupLocation,
} from "@/lib/constants/pickup-locations";
import type { LocationPoolShipperIds } from "@/lib/location-pool-shippers-service";
import {
  INBOUND_OFFICE_POOL_CUTOFF_DATE,
  usesOfficePoolInboundStock,
} from "@/lib/inbound-crate-stock-account";

export interface CustomerCrateStockAccount {
  shipperId: string;
  location: string;
}

export interface ResolveCustomerCrateStockAccountInput {
  operationalShipperId: string;
  /** Used when inbound pickup context is absent (e.g. crate export). */
  location?: string;
  sessionDate?: Date;
  sessionPickupLocation?: string | null;
  shipperPickupLocation?: string | null;
  areaNote?: string | null;
  poolIds?: LocationPoolShipperIds;
  /** memberShipperId → agentShipperId */
  agentMembershipByMemberId?:
    | ReadonlyMap<string, string>
    | Record<string, string>;
}

function normalizeLocation(location?: string | null): string {
  return location?.trim() ?? "";
}

function lookupAgentShipperId(
  memberShipperId: string,
  membership?:
    | ReadonlyMap<string, string>
    | Record<string, string>
): string | undefined {
  if (!membership) return undefined;
  if (membership instanceof Map) {
    return membership.get(memberShipperId);
  }
  return (membership as Record<string, string>)[memberShipperId];
}

function resolveStockLocation(input: ResolveCustomerCrateStockAccountInput): string {
  if (input.location !== undefined) {
    return normalizeLocation(input.location);
  }

  const effectivePickup = resolveSessionPickupLocation(
    input.sessionPickupLocation,
    input.shipperPickupLocation
  );
  return resolveInboundCrateStockLocation(effectivePickup, input.areaNote);
}

function resolveOfficePoolShipperId(input: {
  sessionDate: Date;
  sessionPickupLocation?: string | null;
  shipperPickupLocation?: string | null;
  poolIds: LocationPoolShipperIds;
}): string | null {
  if (!usesOfficePoolInboundStock(input.sessionDate)) {
    return null;
  }

  const effectivePickup = resolveSessionPickupLocation(
    input.sessionPickupLocation,
    input.shipperPickupLocation
  );

  if (effectivePickup === "SONGKHLA") {
    return input.poolIds.SONGKHLA;
  }
  if (effectivePickup === "PATTANI") {
    return input.poolIds.PATTANI;
  }

  return null;
}

/**
 * Resolves which shipper row should receive customer crate stock changes.
 * Unifies SK/PTN office-pool routing (inbound) with generic agent membership.
 * P0: helper only — write paths wire in P1.
 */
export function resolveCustomerCrateStockAccount(
  input: ResolveCustomerCrateStockAccountInput
): CustomerCrateStockAccount {
  const location = resolveStockLocation(input);

  if (input.sessionDate && input.poolIds) {
    const poolShipperId = resolveOfficePoolShipperId({
      sessionDate: input.sessionDate,
      sessionPickupLocation: input.sessionPickupLocation,
      shipperPickupLocation: input.shipperPickupLocation,
      poolIds: input.poolIds,
    });

    if (poolShipperId) {
      const effectivePickup = resolveSessionPickupLocation(
        input.sessionPickupLocation,
        input.shipperPickupLocation
      );
      return {
        shipperId: poolShipperId,
        location:
          effectivePickup === "SONGKHLA" || effectivePickup === "PATTANI"
            ? effectivePickup
            : location,
      };
    }
  }

  const agentShipperId = lookupAgentShipperId(
    input.operationalShipperId,
    input.agentMembershipByMemberId
  );

  return {
    shipperId: agentShipperId ?? input.operationalShipperId,
    location,
  };
}

export { INBOUND_OFFICE_POOL_CUTOFF_DATE, usesOfficePoolInboundStock };
