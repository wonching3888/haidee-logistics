import {
  resolveSessionPickupLocation,
} from "@/lib/constants/pickup-locations";
import { stockLocationForPoolShipperCode } from "@/lib/constants/location-pool-shippers";
import type { LocationPoolShipperIds } from "@/lib/location-pool-shippers-service";
import {
  INBOUND_OFFICE_POOL_CUTOFF_DATE,
  usesOfficePoolInboundStock,
} from "@/lib/inbound-crate-stock-account";
import {
  resolveSubCustomerChannelStockAccount,
  type SubCustomerChannelRecord,
} from "@/lib/sub-customer-channel";

export interface CustomerCrateStockAccount {
  shipperId: string;
  location: string;
}

export interface ResolveCustomerCrateStockAccountInput {
  operationalShipperId: string;
  /** Used when inbound pickup context is absent (e.g. crate export). */
  location?: string;
  /** Standard Thai origin for multi-origin customers (overrides areaNote for stock bucket). */
  customerOriginLocation?: string | null;
  /** When false, SADAO inbound / export use a single total ledger (location ""). */
  isMultiOriginCustomer?: boolean;
  sessionDate?: Date;
  sessionPickupLocation?: string | null;
  shipperPickupLocation?: string | null;
  areaNote?: string | null;
  poolIds?: LocationPoolShipperIds;
  /** memberShipperId → agentShipperId */
  agentMembershipByMemberId?:
    | ReadonlyMap<string, string>
    | Record<string, string>;
  /** agentShipperId → shipper code (for SK/PTN pool location on export redirect). */
  agentShipperCodeById?:
    | ReadonlyMap<string, string>
    | Record<string, string>;
  /** Parent-billing sub-customer crate route (overrides membership / office pool). */
  subChannel?: SubCustomerChannelRecord | null;
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

function lookupAgentShipperCode(
  agentShipperId: string,
  codes?: ReadonlyMap<string, string> | Record<string, string>
): string | undefined {
  if (!codes) return undefined;
  if (codes instanceof Map) {
    return codes.get(agentShipperId);
  }
  return (codes as Record<string, string>)[agentShipperId];
}

function resolveStockLocation(input: ResolveCustomerCrateStockAccountInput): string {
  const effectivePickup = resolveSessionPickupLocation(
    input.sessionPickupLocation,
    input.shipperPickupLocation
  );

  // SK/PTN office-pool buckets — unchanged regardless of multi-origin flag.
  if (effectivePickup === "SONGKHLA") return "SONGKHLA";
  if (effectivePickup === "PATTANI") return "PATTANI";

  // Export path (explicit location param; pool shippers pass SONGKHLA/PATTANI).
  if (input.location !== undefined) {
    const loc = normalizeLocation(input.location);
    if (loc === "SONGKHLA" || loc === "PATTANI") return loc;
    if (input.isMultiOriginCustomer) return loc;
    return "";
  }

  // Multi-origin SADAO: standard origin from customer_origin_locations.
  if (input.isMultiOriginCustomer && input.customerOriginLocation?.trim()) {
    return normalizeLocation(input.customerOriginLocation);
  }

  // Non-multi-origin customers and agents: one total ledger; areaNote is remark only.
  return "";
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
  if (input.subChannel) {
    return resolveSubCustomerChannelStockAccount({
      parentShipperId: input.operationalShipperId,
      channel: input.subChannel,
      customerOriginLocation: input.customerOriginLocation,
    });
  }

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

  if (agentShipperId) {
    const agentCode = lookupAgentShipperCode(
      agentShipperId,
      input.agentShipperCodeById
    );
    const poolLocation = agentCode
      ? stockLocationForPoolShipperCode(agentCode)
      : null;
    if (poolLocation) {
      return { shipperId: agentShipperId, location: poolLocation };
    }
    return { shipperId: agentShipperId, location };
  }

  return {
    shipperId: input.operationalShipperId,
    location,
  };
}

export { INBOUND_OFFICE_POOL_CUTOFF_DATE, usesOfficePoolInboundStock };
