import { describe, expect, it } from "vitest";
import {
  assertBarePayrollOverrideWriteBlocked,
  payrollOverrideDataContainsBlockedFields,
} from "@/lib/payroll-override-write";

describe("payroll override write guard", () => {
  it("detects override keys in prisma update data", () => {
    expect(
      payrollOverrideDataContainsBlockedFields({ pcbOverride: 0.49 })
    ).toBe(true);
    expect(
      payrollOverrideDataContainsBlockedFields({ driverId: "x" })
    ).toBe(false);
  });

  it("throws on bare override write", () => {
    expect(() =>
      assertBarePayrollOverrideWriteBlocked("scripts/_bad.ts", {
        pcbOverride: 1,
      })
    ).toThrow(/Blocked bare driverPayrollMonth override write/);
  });
});
