import type { Prisma } from "@prisma/client";
import { LOCATION_POOL_SHIPPER_CODES } from "@/lib/constants/location-pool-shippers";

export const SHIPPER_KIND = {
  OPERATIONAL: "operational",
  LOGISTICS_PARTNER: "logistics_partner",
  CRATE_STOCK_AGENT: "crate_stock_agent",
} as const;

export type ShipperKind = (typeof SHIPPER_KIND)[keyof typeof SHIPPER_KIND];

/** Active shippers used for inbound, export, customer stock, freight settings, etc. */
export const OPERATIONAL_SHIPPER_WHERE: Prisma.ShipperWhereInput = {
  active: true,
  shipperKind: SHIPPER_KIND.OPERATIONAL,
  code: {
    notIn: [
      LOCATION_POOL_SHIPPER_CODES.SONGKHLA,
      LOCATION_POOL_SHIPPER_CODES.PATTANI,
    ],
  },
};

/**
 * Customer crate stock list (P3 UI): operational shippers without agent membership.
 * Excludes crate_stock_agent rows and shippers assigned to an agent.
 */
export const CUSTOMER_CRATE_STOCK_LIST_SHIPPER_WHERE: Prisma.ShipperWhereInput =
  {
    active: true,
    shipperKind: SHIPPER_KIND.OPERATIONAL,
    crateStockAgentMembership: { is: null },
  };

export function isLogisticsPartnerShipper(
  shipper: { shipperKind?: string | null } | null | undefined
): boolean {
  return shipper?.shipperKind === SHIPPER_KIND.LOGISTICS_PARTNER;
}

export function isCrateStockAgentShipper(
  shipper: { shipperKind?: string | null } | null | undefined
): boolean {
  return shipper?.shipperKind === SHIPPER_KIND.CRATE_STOCK_AGENT;
}
