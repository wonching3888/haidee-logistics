import type { Prisma } from "@prisma/client";
import { LOCATION_POOL_SHIPPER_CODES } from "@/lib/constants/location-pool-shippers";

export const SHIPPER_KIND = {
  OPERATIONAL: "operational",
  LOGISTICS_PARTNER: "logistics_partner",
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

export function isLogisticsPartnerShipper(
  shipper: { shipperKind?: string | null } | null | undefined
): boolean {
  return shipper?.shipperKind === SHIPPER_KIND.LOGISTICS_PARTNER;
}
