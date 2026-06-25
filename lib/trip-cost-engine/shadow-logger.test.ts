import { afterEach, describe, expect, it } from "vitest";
import {
  configureShadowLogger,
  flushShadowLoggerBuffer,
  getShadowLoggerBuffer,
  logTripCostShadowDiff,
  resetShadowLoggerBuffer,
  selectShadowOutput,
} from "@/lib/trip-cost-engine/shadow-logger";
import { shouldUseLegacyTripCostOutput } from "@/lib/trip-cost-engine/config";
import { reloadTripCostEngineConfig } from "@/lib/trip-cost-engine/config";

describe("shadow-logger", () => {
  afterEach(() => {
    resetShadowLoggerBuffer();
    reloadTripCostEngineConfig({ VEHICLE_ALLOC_MODE: "legacy" });
  });

  it("buffers diffs and selectShadowOutput returns legacy value", () => {
    resetShadowLoggerBuffer();
    const value = selectShadowOutput(
      "trip-1",
      "vehicle",
      "totalMyr",
      100,
      120
    );
    expect(value).toBe(100);
    expect(getShadowLoggerBuffer()).toHaveLength(1);
    expect(getShadowLoggerBuffer()[0]?.deltaMyr).toBe(20);
  });

  it("skips logging when legacy equals next", () => {
    logTripCostShadowDiff({
      tripId: "t",
      scope: "vehicle",
      field: "fuelMyr",
      legacyMyr: 50,
      nextMyr: 50,
      deltaMyr: 0,
    });
    expect(getShadowLoggerBuffer()).toHaveLength(1);
    selectShadowOutput("t", "vehicle", "fuelMyr", 50, 50);
    expect(getShadowLoggerBuffer()).toHaveLength(1);
  });

  it("flush writes without throwing when output path configured", () => {
    configureShadowLogger({
      outputPath: "artifacts/test-shadow-logger.jsonl",
    });
    logTripCostShadowDiff({
      tripId: "t2",
      scope: "unload",
      field: "loadUnloadMyr",
      legacyMyr: 10,
      nextMyr: 8,
      deltaMyr: -2,
    });
    expect(() => flushShadowLoggerBuffer({ test: true })).not.toThrow();
    expect(getShadowLoggerBuffer()).toHaveLength(0);
  });
});

describe("shouldUseLegacyTripCostOutput", () => {
  afterEach(() => {
    reloadTripCostEngineConfig({ VEHICLE_ALLOC_MODE: "legacy" });
  });

  it("returns true for legacy and shadow", () => {
    reloadTripCostEngineConfig({ VEHICLE_ALLOC_MODE: "legacy" });
    expect(shouldUseLegacyTripCostOutput()).toBe(true);
    reloadTripCostEngineConfig({ VEHICLE_ALLOC_MODE: "shadow" });
    expect(shouldUseLegacyTripCostOutput()).toBe(true);
    reloadTripCostEngineConfig({ VEHICLE_ALLOC_MODE: "enforced" });
    expect(shouldUseLegacyTripCostOutput()).toBe(false);
  });
});
