import { describe, expect, it } from "vitest";
import { canAdjustSadaoGateStock } from "./sadao-gate-stock-permissions";

describe("canAdjustSadaoGateStock", () => {
  it("allows admin only", () => {
    expect(canAdjustSadaoGateStock("admin")).toBe(true);
    expect(canAdjustSadaoGateStock("clerk")).toBe(false);
    expect(canAdjustSadaoGateStock("thai_accounting")).toBe(false);
    expect(canAdjustSadaoGateStock("viewer")).toBe(false);
  });
});
