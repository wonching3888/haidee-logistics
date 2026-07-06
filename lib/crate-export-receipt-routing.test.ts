import { describe, expect, it } from "vitest";
import { LOCATION_POOL_SHIPPER_CODES } from "@/lib/constants/location-pool-shippers";
import { isLocationPoolShipperCode } from "@/lib/constants/location-pool-shippers";

describe("crate export receipt routing", () => {
  it("Songkhla and Pattani pool codes use pool receipt path", () => {
    expect(isLocationPoolShipperCode(LOCATION_POOL_SHIPPER_CODES.SONGKHLA)).toBe(true);
    expect(isLocationPoolShipperCode(LOCATION_POOL_SHIPPER_CODES.PATTANI)).toBe(true);
  });

  it("operational shippers are not pool receipts", () => {
    expect(isLocationPoolShipperCode("3001-T003")).toBe(false);
  });
});
