import { prisma } from "@/lib/prisma";
import {
  LOCATION_POOL_SHIPPER_LIST,
  stockLocationForPoolShipperCode,
} from "@/lib/constants/location-pool-shippers";
import { SHIPPER_KIND } from "@/lib/constants/shipper-kind";
import type { PICKUP_CRATE_STOCK_LOCATIONS } from "@/lib/constants/pickup-locations";

export type LocationPoolShipperIds = Record<
  (typeof PICKUP_CRATE_STOCK_LOCATIONS)[number],
  string
>;

export async function ensureLocationPoolShippersForStock() {
  const shippers = [];
  for (const spec of LOCATION_POOL_SHIPPER_LIST) {
    const shipper = await prisma.shipper.upsert({
      where: { code: spec.code },
      create: {
        code: spec.code,
        name: spec.name,
        pickupLocation: spec.pickupLocation,
        shipperKind: SHIPPER_KIND.CRATE_STOCK_AGENT,
        active: true,
      },
      update: {
        name: spec.name,
        pickupLocation: spec.pickupLocation,
        shipperKind: SHIPPER_KIND.CRATE_STOCK_AGENT,
        active: true,
      },
      select: { id: true, code: true, name: true },
    });
    shippers.push(shipper);
  }
  return shippers;
}

export async function loadLocationPoolShipperIds(): Promise<LocationPoolShipperIds> {
  const shippers = await ensureLocationPoolShippersForStock();
  const ids: LocationPoolShipperIds = { SONGKHLA: "", PATTANI: "" };

  for (const shipper of shippers) {
    const location = stockLocationForPoolShipperCode(shipper.code);
    if (location) {
      ids[location] = shipper.id;
    }
  }

  return ids;
}
