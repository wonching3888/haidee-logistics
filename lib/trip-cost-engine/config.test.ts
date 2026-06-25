import { afterEach, describe, expect, it } from "vitest";
import {
  getTripCostEngineConfig,
  getVehicleAllocMode,
  getVoucherCostMode,
  isVoucherCostEnforced,
  reloadTripCostEngineConfig,
  shouldWritebackVoucherActualsOnSave,
} from "@/lib/trip-cost-engine/config";

const ORIGINAL_VOUCHER = process.env.VOUCHER_COST_MODE;
const ORIGINAL_VEHICLE = process.env.VEHICLE_ALLOC_MODE;

afterEach(() => {
  if (ORIGINAL_VOUCHER === undefined) {
    delete process.env.VOUCHER_COST_MODE;
  } else {
    process.env.VOUCHER_COST_MODE = ORIGINAL_VOUCHER;
  }
  if (ORIGINAL_VEHICLE === undefined) {
    delete process.env.VEHICLE_ALLOC_MODE;
  } else {
    process.env.VEHICLE_ALLOC_MODE = ORIGINAL_VEHICLE;
  }
  reloadTripCostEngineConfig();
});

describe("trip-cost-engine config", () => {
  it("defaults both modes to legacy when env unset", () => {
    delete process.env.VOUCHER_COST_MODE;
    delete process.env.VEHICLE_ALLOC_MODE;
    reloadTripCostEngineConfig();
    expect(getVoucherCostMode()).toBe("legacy");
    expect(getVehicleAllocMode()).toBe("legacy");
    expect(getTripCostEngineConfig()).toEqual({
      voucherCostMode: "legacy",
      vehicleAllocMode: "legacy",
    });
  });

  it("parses shadow and enforced", () => {
    reloadTripCostEngineConfig({
      VOUCHER_COST_MODE: "shadow",
      VEHICLE_ALLOC_MODE: "enforced",
    });
    expect(getVoucherCostMode()).toBe("shadow");
    expect(getVehicleAllocMode()).toBe("enforced");
  });

  it("falls back to legacy on invalid values", () => {
    reloadTripCostEngineConfig({
      VOUCHER_COST_MODE: "bogus",
      VEHICLE_ALLOC_MODE: "  ENFORCED  ",
    });
    expect(getVoucherCostMode()).toBe("legacy");
    expect(getVehicleAllocMode()).toBe("enforced");
  });

  it("gates step-3 writeback and transition hooks", () => {
    reloadTripCostEngineConfig({ VOUCHER_COST_MODE: "legacy" });
    expect(shouldWritebackVoucherActualsOnSave()).toBe(true);
    expect(isVoucherCostEnforced()).toBe(false);

    reloadTripCostEngineConfig({ VOUCHER_COST_MODE: "enforced" });
    expect(shouldWritebackVoucherActualsOnSave()).toBe(false);
    expect(isVoucherCostEnforced()).toBe(true);

    reloadTripCostEngineConfig({ VOUCHER_COST_MODE: "shadow" });
    expect(shouldWritebackVoucherActualsOnSave()).toBe(true);
    expect(isVoucherCostEnforced()).toBe(false);
  });
});
